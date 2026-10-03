"""Bounded observation and event contracts, real service/store, fake device IO."""
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'engine/vera_cycle'))
from cycle_core import Target
from cycle_transport import Command
from validation_collectors import Collector
from validation_events import kernel_events
from validation_transport import ObservationTransport
from integration.inspection import InspectionStore,InspectionEvaluator,DEFAULTS
from integration.inspection_service import InspectionService,EvidenceSource
from integration.inspection_fixture import FixtureTransport


class Edges(unittest.TestCase):
    def test_two_projects_and_existing_naboo_use_their_own_checker(self):
        from unittest.mock import patch
        from integration import profiles
        from validation_checker import run_checker
        from validation_rules import config_issues
        from integration.inspection_fixture import outputs
        raw=outputs();inputs={k:dict(raw=v,code=0,collection_status='SUCCESS') for k,v in raw.items()}
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);original=(profiles.ENGINE/'neutrino_config.sh').read_text(encoding='utf-8')
            (root/'project_a_config.sh').write_text(original,encoding='utf-8')
            (root/'project_b_config.sh').write_text(original.replace('DIMM_EXPECTED=16','DIMM_EXPECTED=20'),encoding='utf-8')
            (root/'issue_policy.md').write_text('',encoding='utf-8')
            with patch.object(profiles,'ENGINE',root):
                a=profiles.freeze(profiles.default_package(),'fixture','PROJECT A')
                b=profiles.freeze(profiles.default_package(),'fixture','Project B')
                with self.assertRaises(profiles.CheckerMissing):profiles.freeze(profiles.default_package(),'fixture','unknown')
            self.assertNotEqual(a['content_hash'],b['content_hash'])
            ar=run_checker(a['checker'],inputs);br=run_checker(b['checker'],inputs)
            self.assertFalse(any(i['code']=='DIMM_COUNT' for i in config_issues(ar.output,ar.code)))
            self.assertTrue(any(i['code']=='DIMM_COUNT' for i in config_issues(br.output,br.code)))
        naboo=profiles.freeze(profiles.default_package(),'fixture','Naboo')
        nr=run_checker(naboo['checker'],inputs)
        self.assertEqual(nr.code,0,nr.output)

    def test_source_switch_does_not_invent_precise_duplicate_count(self):
        batch=dict(source='dmesg',raw='[1.0] NVRM: Xid (PCI:0000:01:00): 79, fallen off the bus',gap=True)
        findings,_,gap=kernel_events(batch,'b',{'source':'journal','initialized':True})
        self.assertTrue(gap);self.assertFalse(findings[0]['countable']);self.assertEqual(findings[0]['occurrence_precision'],'uncertain')

    def test_redfish_discovery_paging_resume_and_duplicate_page(self):
        node=Target('t','n','b','o'); calls=[]
        class Fake(FixtureTransport):
            def redfish_get(self,t,path,token,timeout=30):
                calls.append(path)
                if path.endswith('/Entries'): return Command(0,json.dumps({'Members':[{'Id':'1','Severity':'Critical'}],'Members@odata.nextLink':path+'?page=2'}))
                if path.endswith('?page=2'): return Command(0,json.dumps({'Members':[{'Id':'2','Severity':'Warning'}]}))
                return super().redfish_get(t,path,token,timeout)
        collector=Collector(Fake({'node_id':'n'}),node)
        first=collector.redfish(max_pages=1)
        self.assertTrue(first['backlog']);self.assertEqual([e['Id'] for e in first['entries']],['1'])
        second=collector.redfish(resume=first['next_pages'])
        self.assertEqual([e['Id'] for e in second['entries']],['2']);self.assertFalse(second['backlog'])

    def test_redfish_network_failure_is_not_unsupported(self):
        c=Collector(FixtureTransport({'node_id':'n'},{'failed':['redfish']}),Target('t','n','b','o'))
        self.assertEqual(c.redfish()['collection_status'],'FAILED')

    def test_journal_page_keeps_cursor_when_oversize(self):
        fake=SimpleNamespace(ssh=lambda *a:Command(0,'x'*2097153))
        result=Collector(fake,Target('t','n','b','o')).kernel('old')
        self.assertEqual(result['cursor'],'old');self.assertEqual(result['collection_status'],'TRUNCATED')

    def test_partial_ghes_page_is_not_dropped(self):
        rows=[dict(MESSAGE='[Hardware Error]: event severity: fatal',__CURSOR='1',_BOOT_ID='b'),
              dict(MESSAGE='[Hardware Error]: Error 0, type: fatal',__CURSOR='2',_BOOT_ID='b')]
        _,state,_=kernel_events(dict(source='journal',rows=rows,cursor='2',backlog=True),'b')
        self.assertEqual(len(state['pending']),2)
        events,done,_=kernel_events(dict(source='journal',rows=[],cursor='2',backlog=False),'b',state)
        self.assertEqual(done['pending'],[]);self.assertTrue(events)

    def test_observation_subprocess_output_is_bounded(self):
        with tempfile.TemporaryDirectory() as folder:
            transport=ObservationTransport({},folder);transport.output_limit=100000
            result=transport.bounded([sys.executable,'-c','import sys; sys.stdout.write("x"*1000000)'],10)
            self.assertEqual(result.state,'OUTPUT_LIMIT');self.assertLessEqual(len(result.output),165536)

    def test_128_target_fair_service_admission_and_no_browser(self):
        with tempfile.TemporaryDirectory() as folder:
            systems=[dict(id='s'+str(i),name='box'+str(i),nodes=[dict(node_id=f'n{i}-{j}') for j in range(4)]) for i in range(32)]
            seen=[]; concurrent=[0,0];guard=threading.Lock()
            def source(system,config,now):
                with guard: concurrent[0]+=1;concurrent[1]=max(concurrent)
                time.sleep(.02 if system['id']=='s0' else .002)
                with guard: seen.extend(n['node_id'] for n in system['nodes']);concurrent[0]-=1
                return [],[],[]
            svc=InspectionService(Path(folder)/'i.db',lambda:systems,source,clock=lambda:1000)
            try:
                for s in systems:svc.store.configure(s['id'],{'enabled':True},'fixture',now=0)
                deadline=time.monotonic()+10
                while len(seen)<128 and time.monotonic()<deadline:svc.tick();time.sleep(.01)
                for f,_ in list(svc._active.values()):f.result(3)
                self.assertEqual(len(set(seen)),128);self.assertEqual(len(seen),128);self.assertLessEqual(concurrent[1],2)
            finally:svc.close()

    def test_process_lock_survives_second_service_and_restart_cursor(self):
        with tempfile.TemporaryDirectory() as folder:
            entered=threading.Event();release=threading.Event();calls=[]
            system=dict(id='s',name='box',nodes=[])
            def source(*a):calls.append(1);entered.set();release.wait(2);return [],[],[]
            a=InspectionService(Path(folder)/'i.db',lambda:[system],source,clock=lambda:1000)
            b=InspectionService(Path(folder)/'i.db',lambda:[system],source,clock=lambda:1000)
            try:
                a.store.configure('s',{'enabled':True},'fixture',now=0)
                a.submit('box',True);self.assertTrue(entered.wait(2))
                b.submit('box',True);b._active['s'][0].result(2)
                release.set();a._active['s'][0].result(2);b.tick()
                self.assertEqual(len(calls),1);self.assertEqual(b.store.system('s')['last_completed_at'],1000)
            finally:release.set();a.close();b.close()

    def test_cycle_expected_offline_only_matching_node_and_deadline(self):
        import sqlite3
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'jobs.db'
            with sqlite3.connect(path) as db:
                db.execute('CREATE TABLE jobs(id TEXT,project TEXT,data TEXT)');db.execute('CREATE TABLE events(seq INTEGER,job_id TEXT,at REAL,data TEXT)')
                db.execute('INSERT INTO jobs VALUES(?,?,?)',('j','p',json.dumps({'state':'RUNNING','config':{'boot_timeout':60}})))
                db.execute('INSERT INTO events VALUES(?,?,?,?)',(1,'j',100,json.dumps({'event_type':'WAIT_OFFLINE','machine_id':'n3','loop':1})))
            db.close()
            src=EvidenceSource(path,path,folder);system=dict(project='p',nodes=[{'node_id':'n3'},{'node_id':'n4'}])
            self.assertEqual([c['node_id'] for c in src.context(system,120)],['n3'])
            self.assertEqual(src.context(system,161),[])

    def test_version_two_store_preserves_legacy_handling(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'i.db';a=InspectionStore(path)
            obs=dict(node_id='n',component='cpu',rule='cpu.utilization.high',kind='utilization',metric='cpu',value=99,sample_at=100)
            a.configure('s',{'duration_seconds':0},'fixture',now=100)
            InspectionEvaluator(a,lambda:100).evaluate('s',[obs]);item=a.issues('s')[0]
            a.handle('s',item['id'],{'known_issue':True},'fixture')
            b=InspectionStore(path);self.assertTrue(b.issues('s')[0]['known_issue']);self.assertEqual(len(b.history('s',item['id'])),2)

if __name__=='__main__':unittest.main()
