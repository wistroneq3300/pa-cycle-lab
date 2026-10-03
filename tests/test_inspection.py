"""Offline contracts: no lifespan/collector startup, transport or production data."""
import os
import uuid
import sys
if 'integration.settings' not in sys.modules:
    os.environ['CYCLE_MODE']='synthetic'
    os.environ['CYCLE_INSTANCE']='data/inspection-tests-'+uuid.uuid4().hex
import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from integration.inspection import InspectionStore, InspectionEvaluator, key
from integration.inspection_service import InspectionService, EvidenceSource


class Rules(unittest.TestCase):
    def test_four_node_recovery_is_independent_of_active_selection(self):
        self.evaluate(*(self.obs(node_id='n'+str(i)) for i in range(1,5)))
        self.assertEqual(self.store.summary('s')['summary'],{'fail':0,'warning':4})
        for _ in range(2):
            self.now+=1
            self.evaluate(self.obs(node_id='n3',value=40))
        items={i['node_id']:i for i in self.store.issues('s')}
        self.assertEqual(items['n3']['status'],'RECOVERED')
        self.assertTrue(all(items[n]['status']=='ACTIVE' for n in ('n1','n2','n4')))
        self.assertEqual(items['n1']['last_seen_at'],1000)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.path=Path(self.tmp.name)/'inspection.db'
        self.store=InspectionStore(self.path); self.now=1000
        self.engine=InspectionEvaluator(self.store,lambda:self.now)
        self.store.configure('s',{'duration_seconds':0},'test')
    def tearDown(self): self.tmp.cleanup()
    def obs(self,**changes):
        return dict(dict(node_id='n1',component='cpu',rule='cpu.utilization.high',metric='cpu',value=99,kind='utilization',source='telemetry',sample_at=self.now),**changes)
    def evaluate(self,*rows,**kwargs): return self.engine.evaluate('s',rows,**kwargs)
    def test_ten_new_high_samples_one_warning_and_old_sample_no_increment(self):
        for i in range(10): self.now+=1; self.evaluate(self.obs())
        issue=self.store.issues('s')[0]; self.assertEqual(issue['observations'],10)
        self.evaluate(self.obs()); self.assertEqual(self.store.issues('s')[0],issue)
        self.assertEqual(self.store.summary('s')['summary'],{'fail':0,'warning':1})
    def test_duration_and_hysteresis_recovery_and_recurrence(self):
        self.store.configure('s',{'duration_seconds':120},'test')
        self.evaluate(self.obs()); self.assertEqual(self.store.issues('s'),[])
        self.now+=120; self.evaluate(self.obs()); self.assertEqual(len(self.store.issues('s')),1)
        for value in (89,80): self.now+=10; self.evaluate(self.obs(value=value))
        self.assertEqual(self.store.issues('s')[0]['status'],'ACTIVE')
        self.now+=10; self.evaluate(self.obs(value=80)); self.assertEqual(self.store.issues('s')[0]['status'],'RECOVERED')
        self.now+=10; self.evaluate(self.obs()); self.now+=120; self.evaluate(self.obs())
        issue=self.store.issues('s')[0]; self.assertEqual(issue['recurrences'],1)
        self.assertEqual([r['kind'] for r in self.store.history('s',issue['id'])],['REOPENED','RECOVERED','OPENED'])
    def test_missing_future_and_stale_never_clear_or_advance_last_seen(self):
        self.evaluate(self.obs()); before=self.store.issues('s')[0]
        self.now+=600
        self.evaluate(self.obs(value=0,sample_at=1000),self.obs(value=0,sample_at=self.now+10))
        self.assertEqual(self.store.issues('s')[0],before)
    def test_event_generation_dedup_restart_and_escalation(self):
        self.evaluate(self.obs())
        event=self.obs(kind='explicit_failure',verified_rule=True,event_id='42',generation='boot1',message='evidence',sample_at=1001)
        self.now=1001; self.evaluate(event)
        self.engine=InspectionEvaluator(InspectionStore(self.path),lambda:self.now)
        self.evaluate(event); issue=self.store.issues('s')[0]
        self.assertEqual(issue['severity'],'FAIL'); self.assertEqual(issue['observations'],2)
        self.now=1002; self.evaluate(dict(event,generation='boot2',sample_at=1002))
        self.assertEqual(self.store.issues('s')[0]['observations'],3)
    def test_unverified_or_ai_prose_cannot_produce_fail(self):
        self.evaluate(self.obs(kind='explicit_failure',message='AI thinks FAIL'))
        self.assertEqual(self.store.issues('s'),[])
    def test_ack_known_and_mute_do_not_recover(self):
        self.evaluate(self.obs()); issue=self.store.issues('s')[0]
        self.store.handle('s',issue['id'],{'acknowledged':True,'known_issue':True,'mute_until':10000},'test')
        self.assertEqual(self.store.issues('s')[0]['status'],'ACTIVE')
    def test_independent_nodes_and_exact_cycle_offline_window(self):
        context=[dict(node_id='n1',phase='WAITING_RECOVERY',started_at=900,deadline=1050)]
        event=self.obs(rule='connectivity.lost',kind='explicit_failure',verified_rule=True,event_id='1')
        self.evaluate(event,dict(event,node_id='n2'),cycle_context=context)
        self.assertEqual([i['node_id'] for i in self.store.issues('s')],['n2'])
        self.now=1060; self.evaluate(dict(event,event_id='2',sample_at=1060),cycle_context=context)
        self.assertEqual(len(self.store.issues('s')),2)
    def test_redaction_before_persistence_and_ai(self):
        self.store.configure('s',{'ai_enabled':True},'test')
        self.evaluate(self.obs(kind='explicit_failure',verified_rule=True,event_id='e',message='sentinel-password token=abc',evidence='sentinel-password'),secrets=['sentinel-password'])
        with self.store.tx(False) as db:
            text=' '.join(r[0] for table in ('inspection_items','inspection_changes','inspection_advice') for r in db.execute('SELECT data FROM '+table))
        self.assertNotIn('sentinel-password',text); self.assertNotIn('token=abc',text)
    def test_ai_failure_does_not_change_issue_and_warning_is_auto_queued(self):
        self.store.configure('s',{'ai_enabled':True},'test'); self.evaluate(self.obs())
        with self.store.tx(False) as db: self.assertEqual(db.execute("SELECT count(*) FROM inspection_advice WHERE state='QUEUED'").fetchone()[0],1)
        self.now+=1; self.evaluate(self.obs(kind='explicit_failure',verified_rule=True,event_id='e'))
        def unavailable(data): raise TimeoutError()
        svc=InspectionService(self.path,lambda:[],lambda *a:([],[],[]),ai=unavailable)
        try: svc.ai_once()
        finally: svc.close()
        issue=self.store.issues('s')[0]; self.assertEqual(issue['severity'],'FAIL'); self.assertEqual(issue['analysis']['state'],'ERROR'); self.assertEqual(issue['analysis']['error_category'],'TIMEOUT')
    def test_slow_ai_does_not_hold_writer_and_new_evidence_is_coalesced(self):
        self.store.configure('s',{'ai_enabled':True},'test')
        self.evaluate(self.obs(kind='explicit_failure',verified_rule=True,event_id='first',fingerprint='A',evidence='first'))
        entered=threading.Event();release=threading.Event()
        def slow(data):
            entered.set();release.wait(3)
            return json.dumps(dict(possible_causes=['Possible cause only'],recommended_checks=['Review evidence'],conclusion='Unconfirmed',confidence_note='Advisory',based_on=['first']))
        svc=InspectionService(self.path,lambda:[],lambda *a:([],[],[]),ai=slow)
        worker=threading.Thread(target=svc.ai_once);worker.start()
        try:
            self.assertTrue(entered.wait(1))
            self.store.configure('s',{'interval_seconds':180},'test')
            for i in range(10):
                self.now+=1
                self.evaluate(self.obs(kind='explicit_failure',verified_rule=True,event_id=str(i),fingerprint=str(i),evidence='new-'+str(i)))
            with self.store.tx(False) as db:
                self.assertEqual(db.execute("SELECT count(*) FROM inspection_advice WHERE state IN ('QUEUED','RUNNING')").fetchone()[0],1)
                pending=json.loads(db.execute("SELECT data FROM inspection_advice WHERE state='RUNNING'").fetchone()[0])
                self.assertEqual(pending['next_input']['evidence'],'new-9')
                self.assertEqual(pending['input']['evidence'],'first')
        finally: release.set();worker.join(3);svc.close()
        self.assertEqual(self.store.issues('s')[0]['analysis']['based_on']['evidence'],'first')


class Scheduling(unittest.TestCase):
    def test_process_death_releases_only_inspection_lock_and_preserves_problem(self):
        import subprocess, sys, time
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); path=root/'i.db'; store=InspectionStore(path)
            store.configure('s',{'duration_seconds':0},'test',now=1000)
            sample=dict(node_id='n1',component='cpu',rule='cpu.utilization.high',kind='utilization',metric='cpu',value=99,sample_at=1000)
            InspectionEvaluator(store,lambda:1000).evaluate('s',[sample])
            code="""
import sys,time
from pathlib import Path
from integration.runner import process_lock
from integration.inspection import key
root=Path(sys.argv[1])
with process_lock(root/'inspection-locks'/key('s')):
    (root/'ready').write_text('ready')
    time.sleep(30)
"""
            child=subprocess.Popen([sys.executable,'-c',code,folder],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            calls=[]; systems=[dict(id='s',name='box',project='p',nodes=[])]
            def source(*args): calls.append(1); return [sample],[],[]
            svc=InspectionService(path,lambda:systems,source,clock=lambda:1000)
            try:
                deadline=time.monotonic()+10
                while not (root/'ready').exists() and time.monotonic()<deadline: time.sleep(.02)
                self.assertTrue((root/'ready').exists())
                svc.run(systems[0]);self.assertEqual(calls,[])
                subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL) if os.name=='nt' else child.terminate();child.wait(5)
                svc.run(systems[0]);self.assertEqual(calls,[1])
                self.assertEqual(store.issues('s')[0]['observations'],1)
            finally:
                if child.poll() is None: subprocess.run(['taskkill','/PID',str(child.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL) if os.name=='nt' else child.terminate();child.wait(5)
                svc.close()

    def test_bounded_admission_and_cross_service_single_flight(self):
        with tempfile.TemporaryDirectory() as folder:
            release=threading.Event(); entered=threading.Event(); calls=[]
            systems=[dict(id='s'+str(i),name='box'+str(i),project='p',nodes=[]) for i in range(3)]
            def source(system,*args): calls.append(system['id']); entered.set(); release.wait(3); return [],[],[]
            first=InspectionService(Path(folder)/'i.db',lambda:systems,source)
            other=InspectionService(Path(folder)/'i.db',lambda:systems,source)
            try:
                self.assertEqual(first.submit('box0'),'ACCEPTED'); self.assertTrue(entered.wait(1))
                other.run(systems[0]); self.assertEqual(calls,['s0'])
                self.assertEqual(first.submit('box1'),'ACCEPTED')
                self.assertEqual(first.submit('box2'),'BUSY')
            finally:
                release.set()
                for future,_ in first._active.values(): future.result(3)
                first.close(); other.close()

    def test_native_report_generation_dedup_and_live_synthetic_separation(self):
        from datetime import datetime, timezone
        from integration.inspection import DEFAULTS
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); dbpath=root/'jobs.db'
            job=dict(id='run1',mode='synthetic',targets=[dict(node_id='n3',tray='t',node='n3')])
            with sqlite3.connect(dbpath) as db:
                db.execute('CREATE TABLE jobs(data TEXT, project TEXT, updated REAL)')
                db.execute('CREATE TABLE node_status(job_id TEXT,node_id TEXT,data TEXT)')
                db.execute('INSERT INTO jobs VALUES(?,?,?)',(json.dumps(job),'p',1000))
                db.execute('INSERT INTO node_status VALUES(?,?,?)',('run1','n3',json.dumps({'loop':1})))
            db.close()
            record=dict(finished=datetime.fromtimestamp(1000,timezone.utc).isoformat(),identities={'os':{'boot_id':'boot1'}},issues=[dict(code='DMESG_APEI',component='PCIe',fingerprint='AAA',severity='FAIL',detail='Hardware event')])
            for tail in ('pre_report.json','loop0001/report.json'):
                dest=root/'run1/t_n3'/tail;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(record),encoding='utf-8')
            system=dict(project='p',nodes=[dict(node_id='n3')])
            source=EvidenceSource(root/'missing',dbpath,root)
            facts,_=source.reports(system,DEFAULTS,1000)
            store=InspectionStore(root/'inspection.db');evaluator=InspectionEvaluator(store,lambda:1000)
            evaluator.evaluate('s',facts);evaluator.evaluate('s',facts)
            self.assertEqual(store.issues('s')[0]['observations'],1)
            self.assertEqual(EvidenceSource(root/'missing',dbpath,root,mode='live').reports(system,DEFAULTS,1000)[0],[])

    def test_single_flight_capacity_disabled_and_persistent_interval(self):
        with tempfile.TemporaryDirectory() as folder:
            entered=threading.Event(); release=threading.Event(); calls=[]
            systems=[dict(id='s',name='box',project='p',nodes=[])]
            def source(*args): calls.append(1); entered.set(); release.wait(3); return [],[],[]
            svc=InspectionService(Path(folder)/'i.db',lambda:systems,source,clock=lambda:1000)
            try:
                svc.tick(); self.assertEqual(calls,[])
                svc.store.configure('s',{'enabled':True,'interval_seconds':300},'test',now=900)
                svc.tick(); self.assertTrue(entered.wait(2)); self.assertEqual(svc.submit('box'),'RUNNING')
                release.set(); svc._active['s'][0].result(3)
                svc.tick(); self.assertEqual(len(calls),1)
                self.assertEqual(svc.store.system('s')['next_due'],1300)
            finally: release.set(); svc.close()
    def test_parent_telemetry_is_not_copied_to_four_nodes(self):
        with tempfile.TemporaryDirectory() as folder:
            dbpath=Path(folder)/'telemetry.db'
            with sqlite3.connect(dbpath) as db:
                db.execute('CREATE TABLE os_metrics(id INTEGER, machine TEXT, ts REAL,cpu_used REAL,mem_used_pct REAL)')
                db.execute('CREATE TABLE gpu_metrics(id INTEGER,machine TEXT,ts REAL,gpu INTEGER,util REAL,mem_total REAL,mem_used REAL)')
                db.executemany('INSERT INTO os_metrics VALUES(?,?,?,?,?)',[(1,'box',1000,99,99),(2,'n3',1000,95,90)])
            db.close()
            source=EvidenceSource(dbpath,Path(folder)/'missing.db',folder)
            system=dict(project='p',nodes=[dict(node_id='n'+str(i),label='N'+str(i)) for i in range(1,5)])
            from integration.inspection import DEFAULTS
            rows,coverage,_=source(system,DEFAULTS,1000)
            self.assertEqual({r['node_id'] for r in rows},{'n3'})
            self.assertEqual(sum(c['state']=='MISSING' for c in coverage),3)


class Routes(unittest.TestCase):
    def test_real_asgi_permissions_settings_run_and_no_transport(self):
        from integration import web
        from integration.store import Store
        from integration.settings import DATA
        from fastapi.testclient import TestClient
        previous_store=web.store; previous_machines=web.pa.machines; previous_projects=web.pa.projects
        web.store=Store(DATA/'inspection-route'/ 'jobs.sqlite3')
        web.pa.projects={'A':{},'B':{}}
        web.pa.machines={name:dict(id=name,name=name,project=project,mgx_type='server',os=[dict(slot=i,node_id=name+'-n'+str(i),ip='192.0.2.'+str(i),user='fixture',port=2200+i) for i in range(1,5)]) for name,project in [('box','A'),('other','B')]}
        class Provider:
            def authenticate(self,request): return 'reader' if request.headers.get('x-test')=='reader' else 'operator'
            def authorize(self,actor,project,action): return project!='B' and (actor!='reader' or action in {'read','navigate'})
        web.app.state.cycle_provider=Provider()
        try:
            # Deliberately no TestClient lifespan: inherited startup scans are out of scope.
            with patch.object(web.pa,'ssh_run',side_effect=AssertionError('hardware forbidden')):
                client=TestClient(web.app)
                base='/api/machine/box/inspection'
                data=client.get(base).json(); self.assertEqual(len(data['nodes']),4); self.assertFalse(data['config']['enabled'])
                self.assertEqual(client.get('/api/machine/other/inspection').status_code,403)
                self.assertEqual(client.patch(base+'/settings',json={'enabled':True},headers={'x-test':'reader'}).status_code,403)
                self.assertEqual(client.patch(base+'/settings',json={'enabled':'yes'}).status_code,422)
                self.assertEqual(client.patch(base+'/settings',json={'enabled':True,'interval_seconds':60}).status_code,200)
                self.assertEqual(client.post(base+'/run').status_code,202)
                service=web.inspection_service()
                for future,_ in list(service._active.values()): future.result(5)
                self.assertIsNotNone(client.get(base).json()['last_completed_at'])
                self.assertEqual(client.get(base+'/issues').json()['issues'],[])
                client.close()
        finally:
            web.inspection_service().close(); web.app.state.cycle_provider=None
            web.store=previous_store; web.pa.machines=previous_machines; web.pa.projects=previous_projects


if __name__=='__main__': unittest.main()
