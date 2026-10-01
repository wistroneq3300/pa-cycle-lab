"""Offline acceptance: real Web/store/NodeSession/report with strict fake transport."""
import os
import uuid
os.environ['CYCLE_MODE']='synthetic'
os.environ['CYCLE_INSTANCE']='data/test-'+uuid.uuid4().hex
import copy
import json
from pathlib import Path
import subprocess
import signal
import sys
import threading
import time
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from integration import web
from integration.settings import ROOT, DATA, ARTIFACTS
from integration.store import Store, Conflict, TERMINAL, validate_request
from integration.runner import run_job, recover, alive
from integration.synthetic import SyntheticTransport
from scripts.bootstrap import bootstrap

bootstrap()
INVENTORY=json.loads((DATA/'data.json').read_text(encoding='utf-8'))

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.store=Store(DATA/(uuid.uuid4().hex+'.sqlite3')); web.store=self.store
        web.pa.projects=copy.deepcopy(INVENTORY['projects']); web.pa.machines=copy.deepcopy(INVENTORY['machines'])
        self.client=TestClient(web.app)
        self.base='/api/projects/Neutrino%20Demo/cycle'
        self.threads=[]

    def tearDown(self):
        for job in self.store.jobs():
            if job['state'] not in TERMINAL: self.store.stop(job['id'],'test-teardown')
        for thread in self.threads: thread.join(10)
        self.client.close()

    def body(self,**changes):
        body=dict(machine_ids=['neutrino-n1','neutrino-n2'],cycle_profile='neutrino',cycle_mode='reboot',channel='inband',
                  limits=dict(loops=2,hours=0),idempotency_key=uuid.uuid4().hex)
        body.update(changes); return body

    def create(self,**changes):
        response=self.client.post(self.base+'/jobs',json=self.body(**changes))
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def worker(self,job,factory=None):
        thread=threading.Thread(target=run_job,args=(self.store,job['id'],factory))
        thread.start();self.threads.append(thread)

    def wait(self,job,states,timeout=15):
        end=time.monotonic()+timeout
        while time.monotonic()<end:
            current=self.store.get(job['id'])
            if current['state'] in states:return current
            if current['state'] in TERMINAL:self.fail(f'Unexpected terminal state: {current}')
            time.sleep(.04)
        self.fail(f'Timed out: {self.store.get(job["id"])}')

    def confirm(self,job):
        pre=job['pre']
        response=self.client.post(f'{self.base}/jobs/{job["id"]}/confirm',json=dict(version=pre['version'],machine_ids=pre['runnable_ids']))
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def test_complete_actual_engine_reports_events_and_no_passwords(self):
        job=self.create();self.worker(job)
        job=self.wait(job,{'AWAITING_CONFIRMATION'});self.assertEqual(len(job['pre']['runnable_ids']),2)
        self.confirm(job);final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'COMPLETE');self.assertEqual(final['health'],'PASS')
        self.assertTrue(all(n['completed']==2 for n in final['nodes']))
        files=self.client.get(f'{self.base}/jobs/{job["id"]}/artifacts').json()['files']
        self.assertIn('CYCLE_REVIEW_REPORT.html',files);self.assertIn('campaign.json',files)
        report=self.client.get(f'{self.base}/jobs/{job["id"]}/files/CYCLE_REVIEW_REPORT.html')
        self.assertEqual(report.status_code,200);self.assertIn('SYNTHETIC DEMONSTRATION',report.text)
        events=self.client.get(f'{self.base}/jobs/{job["id"]}/events?after=0').json()['events']
        self.assertTrue(any(e['phase']=='COMPLETE' for e in events));self.assertEqual(self.store.lock_owners(),{})
        self.assertNotIn('os_pass',json.dumps(final))

    def test_idempotency_and_conflicting_reuse(self):
        body=self.body();a=self.client.post(self.base+'/jobs',json=body);b=self.client.post(self.base+'/jobs',json=body)
        self.assertEqual(a.json()['id'],b.json()['id']);self.assertEqual(len(self.store.jobs()),1)
        body['limits']['loops']=4
        self.assertEqual(self.client.post(self.base+'/jobs',json=body).status_code,409)

    def test_concurrent_reservations_and_direct_control_conflict(self):
        job=self.create(machine_ids=['neutrino-n1'])
        # Same shared AUX domain is conservatively reserved even for reboot.
        response=self.client.post(self.base+'/jobs',json=self.body(machine_ids=['neutrino-n2']))
        self.assertEqual(response.status_code,409)
        with self.assertRaises(Conflict):
            with self.store.control(web.pa.machines['neutrino-n1']):pass
        self.store.stop(job['id'],'tester')
        with self.store.control(web.pa.machines['neutrino-n1']):pass

    def test_input_and_project_isolation(self):
        for body in [self.body(machine_ids=[]),self.body(machine_ids=['neutrino-n1']*2),
                     self.body(machine_ids=['missing']),self.body(limits=dict(loops=0,hours=0)),
                     self.body(limits=dict(loops=1.5,hours=0)),self.body(shell='reboot')]:
            self.assertEqual(self.client.post(self.base+'/jobs',json=body).status_code,422)
        self.assertEqual(self.client.post(self.base+'/jobs',json=self.body(machine_ids=['neutrino-n0'])).status_code,409)
        self.assertEqual(self.client.post('/api/projects/Other%20platform/cycle/jobs',json=self.body()).status_code,422)
        job=self.create()
        self.assertEqual(self.client.get(f'/api/projects/Other%20platform/cycle/jobs/{job["id"]}').status_code,404)

    def test_stale_pre_confirmation_and_fixed_target_snapshot(self):
        job=self.create();self.worker(job);job=self.wait(job,{'AWAITING_CONFIRMATION'})
        url=f'{self.base}/jobs/{job["id"]}/confirm'
        self.assertEqual(self.client.post(url,json=dict(version='old',machine_ids=job['pre']['runnable_ids'])).status_code,409)
        self.assertEqual(self.client.post(url,json=dict(version=job['pre']['version'],machine_ids=['neutrino-n1'])).status_code,409)
        web.pa.machines['neutrino-n1']['os_ip']='203.0.113.10'
        web.pa.machines['neutrino-n1']['project']='Other platform'
        self.assertEqual(self.store.get(job['id'])['targets'][0]['os_ip'],'192.0.2.11')
        self.confirm(job);self.assertEqual(self.wait(job,TERMINAL)['state'],'COMPLETE')

    def test_graceful_stop_finishes_entire_round(self):
        started=threading.Event()
        class StopTransport(SyntheticTransport):
            def action(inner,t):
                result=super().action(t)
                if not started.is_set():
                    started.set();self.store.stop(job['id'],'tester')
                return result
        job=self.create(limits=dict(loops=100,hours=0));self.worker(job,StopTransport)
        self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'INCOMPLETE');self.assertTrue(all(n['completed']==1 for n in final['nodes']))
        self.assertTrue(all(n['attempts']==1 for n in final['nodes']))

    def test_cancel_preserves_pre_and_releases_locks(self):
        job=self.create();self.worker(job);job=self.wait(job,{'AWAITING_CONFIRMATION'})
        self.client.post(f'{self.base}/jobs/{job["id"]}/stop',json={})
        final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'CANCELLED');self.assertTrue((ARTIFACTS/job['id']/'campaign.json').exists())
        self.assertEqual(self.store.lock_owners(),{})

    def test_collection_failure_never_becomes_pass(self):
        class Broken(SyntheticTransport):
            def __init__(inner,*args):super().__init__(*args);inner.hardware_failure=True
        job=self.create(limits=dict(loops=1,hours=0));self.worker(job,Broken)
        self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}));final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'COMPLETE');self.assertEqual(final['health'],'FAIL')

    def test_all_pre_blocked_keeps_evidence(self):
        class Wrong(SyntheticTransport):
            def __init__(inner,*args):super().__init__(*args);inner.mismatch=True
        job=self.create();self.worker(job,Wrong);final=self.wait(job,TERMINAL)
        self.assertEqual(final['state'],'BLOCKED');self.assertTrue((ARTIFACTS/job['id']/'campaign.json').exists())

    def test_shared_aux_scope_rejected_before_any_job(self):
        response=self.client.post(self.base+'/jobs',json=self.body(cycle_mode='aux_cycle'))
        self.assertEqual(response.status_code,409);self.assertIn('完整影響範圍',response.text)
        self.assertEqual(self.store.jobs(),[])

    def test_artifact_traversal_and_ssh_keys_hidden(self):
        job=self.create();root=ARTIFACTS/job['id'];(root/'.ssh').mkdir(parents=True)
        (root/'.ssh'/'secret').write_text('private');(root/'ok.txt').write_text('evidence')
        self.assertNotIn('.ssh/secret',self.client.get(f'{self.base}/jobs/{job["id"]}/artifacts').json()['files'])
        for path in ['.ssh/secret','..\\..\\data.json']:
            self.assertEqual(self.client.get(f'{self.base}/jobs/{job["id"]}/files/{path}').status_code,404)

    def test_local_transport_boundaries_and_csrf(self):
        self.assertEqual(self.client.post('/api/machine/neutrino-n1/reboot',json={}).status_code,422)
        self.assertEqual(self.client.get('/api/machine/neutrino-n1/sensors').status_code,409)
        self.assertEqual(self.client.post(self.base+'/jobs',json=self.body(),headers={'Origin':'https://foreign.example'}).status_code,403)

    def test_new_web_client_reconnects_to_same_running_worker(self):
        job=self.create();self.worker(job);job=self.wait(job,{'AWAITING_CONFIRMATION'})
        with TestClient(web.app) as second:
            retrieved=second.get(f'{self.base}/jobs/{job["id"]}').json()
            self.assertEqual(retrieved['pre']['version'],job['pre']['version'])
        self.confirm(job);self.assertEqual(self.wait(job,TERMINAL)['state'],'COMPLETE')

    def test_process_death_recovery_no_replay(self):
        # Child uses the standard DB, isolated by CYCLE_INSTANCE.
        standard=Store();web.store=standard;self.store=standard
        job=self.create()
        process=subprocess.Popen([sys.executable,'-m','integration.runner','--job',job['id']],cwd=ROOT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        try:
            running=self.wait(job,{'AWAITING_CONFIRMATION'});self.assertTrue(alive(job['id']))
            # Windows venv launches a child interpreter; terminate the worker's
            # actual PID, not just its launcher, to exercise real crash recovery.
            os.kill(running['worker_pid'],signal.SIGTERM if os.name=='nt' else signal.SIGKILL)
            process.wait(10)
            self.assertFalse(alive(job['id']))
            recover(self.store,self.store.get(job['id']))
            final=self.store.get(job['id']);self.assertEqual(final['state'],'RECONCILIATION_REQUIRED')
            self.assertIn('no automatic resume',final['stop_reason']);self.assertTrue(self.store.lock_owners())
            self.assertIsNone(self.store.claim(job['id'],'another-worker'))
        finally:
            if process.poll() is None:process.kill();process.wait(10)

    def test_all_modes_and_channels_use_real_node_session(self):
        # Independent synthetic AUX domains are explicit; shared tray AUX stays blocked.
        for m in web.pa.machines.values():m['aux_domain']=m['name']
        for mode in ('reboot','power_cycle','aux_cycle'):
            for channel in ('inband','outband'):
                with self.subTest(mode=mode,channel=channel):
                    job=self.create(machine_ids=['neutrino-n1'],cycle_mode=mode,channel=channel,limits=dict(loops=1,hours=0))
                    self.worker(job);self.confirm(self.wait(job,{'AWAITING_CONFIRMATION'}))
                    final=self.wait(job,TERMINAL);self.assertEqual(final['state'],'COMPLETE');self.assertEqual(final['health'],'PASS')

    def test_per_target_transport_settings_and_redaction(self):
        from cycle_transport import Transport
        from cycle_core import Target
        target=Target('tray','n1','192.0.2.1','192.0.2.2')
        client=MagicMock()
        transport=Transport({'os':'private-os','bmc':'private-bmc'},DATA/'keys',users={'os':'alice','bmc':'bob'},ports={'os':2222},cipher=3)
        before=dict(os.environ)
        with patch('paramiko.SSHClient',return_value=client):transport._connect(target,'os',1)
        self.assertEqual(client.connect.call_args.kwargs['username'],'alice')
        self.assertEqual(client.connect.call_args.kwargs['port'],2222)
        with patch('cycle_transport.subprocess.run',return_value=MagicMock(returncode=0,stdout='private-bmc',stderr='')) as execute:
            result=transport.oob(target,'power status')
            argv=execute.call_args.args[0]
            self.assertEqual(argv[argv.index('-C')+1],'3');self.assertEqual(argv[argv.index('-U')+1],'bob')
            self.assertNotIn('private-bmc',argv);self.assertNotIn('private-bmc',result.output)
        with patch('cycle_transport.subprocess.run',side_effect=subprocess.TimeoutExpired('ipmitool',30,output=b'private-bmc',stderr=b'')):
            result=transport.oob(target,'power cycle')
            self.assertEqual(result.state,'RESPONSE_LOST');self.assertNotIn('private-bmc',result.output)
        self.assertEqual(dict(os.environ),before)

    def test_local_atomic_write_retries_only_permission_errors(self):
        from cycle_core import atomic_write
        original=Path.replace; attempts=[]
        def intermittent(path,target):
            attempts.append(1)
            if len(attempts)<3:raise PermissionError('simulated Windows sharing violation')
            return original(path,target)
        destination=DATA/'atomic-evidence.txt'
        with patch.object(Path,'replace',intermittent):atomic_write(destination,'retained evidence')
        self.assertEqual(destination.read_text(),'retained evidence');self.assertEqual(len(attempts),3)

    def test_first_this_round_differs_from_new_relative_to_pre(self):
        from integration.runner import compact
        from types import SimpleNamespace
        finding=dict(code='NEW_FAULT',component='GPU')
        session=SimpleNamespace(machine_id='n1',node=dict(key='t_n1',pre={'issues':[]},
            loops=[dict(issues=[finding],loop=1,finished=True,status='FAIL')],stage='DONE',completed=1,attempts=1,stop_reason='',blocked=[]))
        self.assertEqual(compact(session)['first_this_round'],1)
        session.node['loops'].append(dict(issues=[finding],loop=2,finished=True,status='FAIL'))
        self.assertEqual(compact(session)['first_this_round'],0);self.assertEqual(compact(session)['unique_issues'],1)

    def test_project_and_machine_metadata_preserved_without_passwords(self):
        web.pa.machines['neutrino-n1']['os_pass']='never-return-this'
        with patch.object(web.pa,'_save_data'):
            response=self.client.patch('/api/machines/neutrino-n1',json={'order':10})
            self.assertEqual(response.status_code,200);self.assertNotIn('never-return-this',response.text)
            response=self.client.patch('/api/projects/Neutrino%20Demo',json={'name':'Renamed Neutrino','desc':'demo'})
            self.assertEqual(response.status_code,200)
            self.assertEqual(web.pa.projects['Renamed Neutrino']['cycle_profile'],'neutrino')

    def test_pending_post_does_not_claim_zero_or_pass(self):
        from integration.runner import compact
        from types import SimpleNamespace
        session=SimpleNamespace(machine_id='n1',node=dict(key='t_n1',pre={'issues':[]},
            loops=[dict(issues=[],loop=1,finished=None,status='PENDING')],stage='waiting OS boot',completed=0,attempts=1,stop_reason='',blocked=[]))
        result=compact(session)
        self.assertEqual(result['health'],'PENDING');self.assertIsNone(result['first_this_round'])

if __name__=='__main__':unittest.main()
