"""Persistent console regressions. Synthetic/local fault injection only."""
import concurrent.futures
import json
import os
import sqlite3
import time
import unittest
from unittest.mock import patch
import test_integration as base
from integration import web, runner
from integration.events import structured, evidence_reference
from integration.settings import ARTIFACTS
from integration.store import Store, TERMINAL
from integration.synthetic import SyntheticTransport
from cycle_core import EvidencePersistenceError


class ConsoleTests(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown
    body=base.IntegrationTests.body
    create=base.IntegrationTests.create
    worker=base.IntegrationTests.worker
    wait=base.IntegrationTests.wait
    confirm=base.IntegrationTests.confirm

    def url(self,job): return f'{self.base}/jobs/{job["id"]}/events'

    def emit(self,job,**fields):
        return self.store.append_event(job['id'],dict(phase='POST',level='INFO',message='collection',**fields))

    def test_structured_persistence_reopen_and_refresh(self):
        job=self.create();seq=self.emit(job,machine_id='neutrino-n1',tray='t1',node='n1',loop=12,event_type='COLLECTION_STARTED')
        web.store=Store(self.store.path)
        first=self.client.get(self.url(job)).json();second=self.client.get(self.url(job)).json()
        self.assertEqual(first,second)
        event=first['events'][-1]
        self.assertEqual(event['sequence'],seq)
        for key in ('timestamp','job_id','run_id','machine_id','tray','node','loop','phase','level','message','event_type'): self.assertIn(key,event)
        self.assertEqual(event['job_id'],job['id']);self.assertEqual(event['run_id'],job['run_id'])

    def test_incremental_pages_tail_and_older_have_no_duplicates(self):
        job=self.create()
        for i in range(520):self.emit(job,loop=i)
        a=self.client.get(self.url(job)).json();self.assertEqual(len(a['events']),500);self.assertTrue(a['has_more'])
        b=self.client.get(self.url(job),params={'after':a['next_sequence']}).json()
        self.assertEqual(len(a['events'])+len(b['events']),521);self.assertFalse(b['has_more'])
        self.assertLess(a['next_sequence'],b['oldest_sequence'])
        tail=self.client.get(self.url(job),params={'tail':True,'limit':20}).json()
        older=self.client.get(self.url(job),params={'before':tail['oldest_sequence'],'limit':20}).json()
        self.assertLess(older['next_sequence'],tail['oldest_sequence'])
        self.assertEqual(self.client.get(self.url(job),params={'after':b['next_sequence']}).json()['events'],[])

    def test_multi_node_error_only_and_search(self):
        job=self.create()
        for node,level,msg in [('n1','PASS','healthy'),('n1','FAIL','PCI AER'),('n2','ERROR','PCI timeout'),('n2','WARN','ambiguous')]:
            self.store.append_event(job['id'],dict(machine_id=node,level=level,message=msg))
        data=self.client.get(self.url(job),params={'machine_id':'n1','errors_only':True,'search':'PCI'}).json()['events']
        self.assertEqual([e['message'] for e in data],['PCI AER'])
        data=self.client.get(self.url(job),params={'errors_only':True}).json()['events']
        self.assertEqual([e['level'] for e in data],['FAIL','ERROR'])
        self.assertEqual(self.client.get(self.url(job),params={'search':"' OR 1=1 --"}).json()['events'],[])

    def test_redaction_before_sqlite_api_and_download(self):
        job=self.create();password='fixture-os-very-private';token='fixture-environment-secret'
        with patch.dict(os.environ,{'CONSOLE_TEST_TOKEN':token}):
            self.store.append_event(job['id'],dict(message=f'{password} {token}',detail='Authorization: Bearer TOPSECRET\ncredential_ref=hidden\n'+'x'*590+password,password=password,environment={'value':token}),secrets=[password])
            with sqlite3.connect(self.store.path) as db: raw=str(db.execute('SELECT data FROM events').fetchall())
            api=self.client.get(self.url(job)).text;download=self.client.get(self.url(job)+'/download').text
            for output in (raw,api,download):
                for value in (password,token,'TOPSECRET','hidden'):self.assertNotIn(value,output)
                self.assertIn('[REDACTED]',output)
            self.assertNotIn('environment',raw)

    def test_sanitizer_hostile_fields_and_truncation(self):
        secret='123456789-SECRET'
        e=structured('job','run',dict(level=[],message='x'*595+secret,detail='\x1b[31mFAIL\n\u202e forged'),time.time(),[secret])
        self.assertEqual(e['level'],'INFO');self.assertNotIn('12345',e['message'])
        self.assertNotIn('\x1b',e['detail']);self.assertNotIn('\n',e['detail']);self.assertNotIn('\u202e',e['detail'])

    def test_artifact_references_reuse_path_boundary(self):
        job=self.create();root=ARTIFACTS/job['id'];root.mkdir(parents=True,exist_ok=True)
        (root/'dmesg.txt').write_text('synthetic',encoding='utf-8')
        for path in ('../outside','/absolute','C:/secret','..%2fsecret','.ssh/key','credential.json','a\\b','missing.txt','dmesg.txt'):
            self.emit(job,evidence=path)
        events=self.client.get(self.url(job)).json()['events']
        self.assertEqual([e['evidence'] for e in events if 'evidence' in e],['dmesg.txt'])
        for path in ('../outside','/absolute','C:/secret','..%2fsecret','.ssh/key','credential.json','a\\b'):self.assertIsNone(evidence_reference(path))
        for path in ('%2e%2e%2foutside','.ssh/key','credential.json'):
            self.assertEqual(self.client.get(self.url(job).replace('/events','/files/')+path).status_code,404)

    def test_concurrent_ordering_and_terminal_is_last(self):
        job=self.create();before=self.store.get(job['id']);locks=self.store.lock_owners()
        def writer(n):
            for i in range(30): self.emit(job,machine_id=str(n),loop=i)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(writer,range(4)))
        events=self.store.events(job['id'],0)
        sequences=[e['sequence'] for e in events];self.assertEqual(sequences,sorted(set(sequences)))
        for n in range(4): self.assertEqual([e['loop'] for e in events if e['machine_id']==str(n)],list(range(30)))
        self.assertEqual(self.store.get(job['id']),before);self.assertEqual(self.store.lock_owners(),locks)
        self.store.finish(job['id'],'INCOMPLETE','fixture')
        self.assertIsNone(self.emit(job,message_unused='late'))
        self.assertEqual(self.store.events(job['id'],0)[-1]['phase'],'INCOMPLETE')

    def test_console_reads_and_download_never_change_job_or_locks(self):
        job=self.create();before=self.store.get(job['id']);locks=self.store.lock_owners()
        for _ in range(3):
            self.assertEqual(self.client.get(self.url(job)).status_code,200)
            response=self.client.get(self.url(job)+'/download');self.assertEqual(response.status_code,200)
            self.assertIn('attachment',response.headers['content-disposition'])
        self.assertEqual(before,self.store.get(job['id']));self.assertEqual(locks,self.store.lock_owners())
        self.assertEqual(self.client.get(self.url(job).replace('Neutrino%20Demo','Other%20platform')+'/download').status_code,404)

    def test_legacy_rows_remain_readable(self):
        job=self.create()
        with self.store.tx() as db:db.execute('INSERT INTO events(job_id,at,data) VALUES(?,?,?)',(job['id'],time.time(),json.dumps({'phase':'WORKER_LOST','reason':'legacy'})))
        e=self.store.events(job['id'],0)[-1];self.assertEqual(e['level'],'ERROR');self.assertEqual(e['detail'],'legacy')

    def test_invalid_query_bounds(self):
        job=self.create()
        for params in ({'after':-1},{'limit':501},{'before':0},{'search':'x'*201},{'after':2**64}):
            self.assertEqual(self.client.get(self.url(job),params=params).status_code,422)

    def test_worker_lost_event_and_no_replay(self):
        job=self.create();self.store.claim(job['id'],123456)
        runner.recover(self.store,self.store.get(job['id']))
        events=self.store.events(job['id'],0)
        self.assertEqual([e['phase'] for e in events][-2:],['WORKER_LOST','RECONCILIATION_REQUIRED'])
        self.assertEqual(events[-2]['level'],'ERROR');self.assertFalse(self.store.claim(job['id'],123))

    def test_response_lost_operational_sequence_no_false_pass(self):
        transports=[]
        class Lost(SyntheticTransport):
            def __init__(inner,*args):super().__init__(*args);inner.response_lost=True;transports.append(inner)
        job=self.create(machine_ids=['neutrino-n1'],limits=dict(loops=1,hours=0));self.worker(job,Lost)
        self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));self.wait(job,TERMINAL)
        events=self.store.events(job['id'],0);kinds=[e['event_type'] for e in events]
        for kind in ('PRE_STARTED','IDENTITY_CHECK','DEPENDENCY_CHECK','BASELINE_COLLECTION','CONFIRMED','LOOP_STARTED','COMMAND_DISPATCHING','COMMAND_DISPATCHED','RESPONSE_LOST','WAIT_OFFLINE','BOOT_ID_CHANGED','RECOVERY_DETECTED','POST_STARTED','POST_COMPLETED','COMPLETE'): self.assertIn(kind,kinds)
        self.assertEqual([e['level'] for e in events if e['event_type']=='RESPONSE_LOST'],['WARN'])
        self.assertLess(kinds.index('COMMAND_DISPATCHING'),kinds.index('RESPONSE_LOST'))
        self.assertLess(kinds.index('RESPONSE_LOST'),kinds.index('RECOVERY_DETECTED'))
        self.assertEqual(sum(c[2]=='reboot' for c in transports[0].calls),1)
        self.assertEqual(events[-1]['level'],'INFO')

    def test_stop_round_event_and_complete_post(self):
        class Stop(SyntheticTransport):
            def action(inner,target):
                result=super().action(target);self.store.stop(job['id'],'test');return result
        job=self.create(machine_ids=['neutrino-n1'],limits=dict(loops=100,hours=0));self.worker(job,Stop)
        self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
        kinds=[e['event_type'] for e in self.store.events(job['id'],0)]
        self.assertLess(kinds.index('STOP_REQUESTED'),kinds.index('STOPPING_AFTER_ROUND'))
        self.assertLess(kinds.index('STOPPING_AFTER_ROUND'),kinds.index('POST_COMPLETED'))
        self.assertEqual(final['nodes'][0]['completed'],1)

    def test_event_failure_after_dispatch_never_retries(self):
        transports=[];real=self.store.append_event
        def append(jid,event,**kw):
            if event.get('event_type')=='COMMAND_DISPATCHED':raise sqlite3.OperationalError('disk full')
            return real(jid,event,**kw)
        def factory(*args):t=SyntheticTransport(*args);transports.append(t);return t
        job=self.create(machine_ids=['neutrino-n1'],limits=dict(loops=3,hours=0))
        with patch.object(self.store,'append_event',side_effect=append):
            self.worker(job,factory);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'RECONCILIATION_REQUIRED');self.assertIn('Evidence persistence failure',final['stop_reason'])
        self.assertEqual(sum(c[2]=='reboot' for c in transports[0].calls),1)

    def test_large_journal_indexed_pages_and_bounded_export(self):
        job=self.create();payload=json.dumps(structured(job['id'],job['run_id'],dict(machine_id='n1',message='load fixture'),time.time()))
        with self.store.tx() as db:
            db.executemany('INSERT INTO events(job_id,at,data) VALUES(?,?,?)',((job['id'],time.time(),payload) for _ in range(100000)))
            plan=str([tuple(r) for r in db.execute('EXPLAIN QUERY PLAN SELECT seq FROM events WHERE job_id=? AND seq>? ORDER BY seq LIMIT 501',(job['id'],0))])
            self.assertIn('events_job_sequence',plan)
        started=time.monotonic();tail=self.store.event_page(job['id'],tail=True);elapsed=time.monotonic()-started
        self.assertEqual(len(tail['events']),500);self.assertTrue(tail['has_more'])
        self.assertLess(elapsed,5,'Indexed 500-row tail should not deserialize full history')
        after=tail['next_sequence'];self.assertEqual(self.store.event_page(job['id'],after)['events'],[])
        filtered=self.store.event_page(job['id'],machine_id='n1',tail=True,search='fixture');self.assertEqual(len(filtered['events']),500)
        # A download captures its upper sequence at creation, even if a writer appends.
        response=web.download_events('Neutrino Demo',job['id'])
        self.emit(job,event_type='AFTER_SNAPSHOT')
        import asyncio
        async def consume():
            count=0;tail_text=''
            async for part in response.body_iterator:count+=1;tail_text=str(part)
            return count,tail_text
        count,last=asyncio.run(consume());self.assertEqual(count,100002);self.assertNotIn('AFTER_SNAPSHOT',last)
        self.assertIn('load fixture',last)

    def test_observer_redacts_backend_credential_values_in_findings(self):
        secret='console-fixture-password'
        import cycle_engine
        original=cycle_engine.config_issues
        def findings(*args):
            result=original(*args)
            for item in result:item['detail']+=' '+secret
            return result
        def factory(*args):
            t=SyntheticTransport(*args);t.credentials={'os':secret,'bmc':'console-bmc-password'};t.hardware_failure=True;return t
        job=self.create(machine_ids=['neutrino-n1'],limits=dict(loops=1,hours=0))
        with patch.object(cycle_engine,'config_issues',findings):
            self.worker(job,factory);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));self.wait(job,TERMINAL)
        events=self.client.get(self.url(job)).text;download=self.client.get(self.url(job)+'/download').text
        with sqlite3.connect(self.store.path) as db:raw=str(db.execute('SELECT data FROM events').fetchall())
        for text in (events,download,raw):self.assertNotIn(secret,text);self.assertIn('[REDACTED]',text)
