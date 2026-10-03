import json
import time
from concurrent.futures import ThreadPoolExecutor
from integration.inspection import InspectionStore, InspectionEvaluator
from integration.inspection_service import InspectionService


def seed(store, count=1):
    store.configure('s', {'ai_enabled': True, 'duration_seconds': 0}, 'test')
    now=time.time()
    observations=[dict(node_id='n'+str(i),component='cpu',rule='cpu.high',kind='utilization',metric='cpu',value=99,sample_at=now,source='Telemetry') for i in range(count)]
    InspectionEvaluator(store,lambda:now).evaluate('s',observations)
    return store.issues('s',200)


def test_warning_backlog_is_durable_not_limited_to_sixteen(tmp_path):
    store=InspectionStore(tmp_path/'i.db'); items=seed(store,35)
    with store.tx(False) as db:
        assert db.execute("SELECT count(*) FROM inspection_advice WHERE state='QUEUED'").fetchone()[0]==35
    assert all(i['analysis']['state']=='QUEUED' and i['severity']=='WARNING' for i in items)


def test_manual_repeated_request_coalesces_and_structured_completion(tmp_path):
    svc=InspectionService(tmp_path/'i.db',lambda:[],None,ai=lambda _:json.dumps(dict(possible_causes=['正常工作負載'],recommended_checks=['核對工作負載'],conclusion='尚不能確認硬體故障',confidence_note='需更多資料',based_on=['Telemetry'])))
    item=seed(svc.store)[0]
    for _ in range(5): svc.store.advice('s',item['id'],manual=True)
    svc.ai_once()
    result=svc.store.issues('s')[0]
    assert result['analysis']['state']=='COMPLETE'
    assert result['analysis']['result']['possible_causes']==['正常工作負載']
    assert result['severity']=='WARNING'
    with svc.store.tx(False) as db: assert db.execute('SELECT count(*) FROM inspection_advice').fetchone()[0]==1
    svc.close()


def test_archive_preserves_history_and_reopen(tmp_path):
    store=InspectionStore(tmp_path/'i.db'); item=seed(store)[0]
    with store.tx() as db:
        item.update(status='RECOVERED',resolved_at=time.time()-8*86400)
        db.execute('UPDATE inspection_items SET data=? WHERE id=?',(json.dumps(item),item['id']))
    store.archive_recovered(time.time())
    assert store.issues('s',status='ARCHIVED')[0]['id']==item['id']
    assert store.issues('s',status='current')==[]
    seed(store)
    result=store.issues('s')[0]
    assert result['status']=='ACTIVE' and result['recurrences']==1
    assert any(h['kind']=='ARCHIVED' for h in store.history('s',item['id']))


def test_priority_two_slots_restart_and_no_writer_lock(tmp_path):
    import threading
    entered=[];gate=threading.Event();lock=threading.Lock()
    def slow(data):
        with lock: entered.append(json.loads(data))
        gate.wait(3)
        return json.dumps(dict(possible_causes=['原因'],recommended_checks=['查核'],conclusion='待確認',confidence_note='建議',based_on=['source']))
    svc=InspectionService(tmp_path/'i.db',lambda:[],None,ai=slow)
    seed(svc.store,35)
    now=time.time()
    InspectionEvaluator(svc.store,lambda:now).evaluate('s',[dict(node_id='fail',component='PCIe',rule='pci.error',kind='finding',severity='FAIL',verified_rule=True,message='PCI error',sample_at=now)])
    with ThreadPoolExecutor(3) as pool:
        first=pool.submit(svc.ai_once,0)
        for _ in range(100):
            if entered: break
            time.sleep(.01)
        second=pool.submit(svc.ai_once,1)
        for _ in range(100):
            if len(entered)==2:break
            time.sleep(.01)
        duplicate=pool.submit(svc.ai_once,0);duplicate.result(1)
        assert len(entered)==2 and entered[0]['severity']=='FAIL'
        svc.store.configure('s',{'interval_seconds':180},'test')
        gate.set();first.result();second.result()
    with svc.store.tx() as db:
        row=db.execute("SELECT id FROM inspection_advice WHERE state='QUEUED' LIMIT 1").fetchone()
        db.execute("UPDATE inspection_advice SET state='RUNNING',worker_slot=0 WHERE id=?",(row['id'],))
    svc.ai_once(0)
    with svc.store.tx(False) as db: assert db.execute('SELECT state FROM inspection_advice WHERE id=?',(row['id'],)).fetchone()[0]=='COMPLETE'
    svc.close()


def test_unchanged_warning_samples_do_not_reinfer_and_disabled_does_not_queue(tmp_path):
    store=InspectionStore(tmp_path/'i.db');item=seed(store)[0]
    now=time.time()
    for i in range(10):
        InspectionEvaluator(store,lambda:now+i).evaluate('s',[dict(node_id='n0',component='cpu',rule='cpu.high',kind='utilization',metric='cpu',value=95+i%5,sample_at=now+i,source='Telemetry')])
    with store.tx(False) as db: assert db.execute('SELECT count(*) FROM inspection_advice').fetchone()[0]==1
    store.configure('s',{'ai_enabled':False},'test')
    InspectionEvaluator(store,lambda:now+20).evaluate('s',[dict(node_id='n-new',component='cpu',rule='cpu.high',kind='utilization',metric='cpu',value=99,sample_at=now+20)])
    with store.tx(False) as db: assert db.execute('SELECT count(*) FROM inspection_advice').fetchone()[0]==1


def test_completed_warning_reuses_analysis_and_sensor_change_does_not(tmp_path):
    answer=dict(possible_causes=['workload'],recommended_checks=['observe'],conclusion='advisory',confidence_note='unconfirmed',based_on=['sample'])
    svc=InspectionService(tmp_path/'i.db',lambda:[],None,ai=lambda _:answer)
    seed(svc.store);svc.ai_once()
    now=time.time()
    InspectionEvaluator(svc.store,lambda:now).evaluate('s',[dict(node_id='n0',component='cpu',rule='cpu.high',kind='utilization',metric='cpu',value=96,sample_at=now,source='Telemetry')])
    with svc.store.tx(False) as db: assert db.execute('SELECT count(*) FROM inspection_advice').fetchone()[0]==1
    from integration.inspection_advice import material
    assert material(dict(rule='temperature.high',severity='WARNING',facts='90 C'))!=material(dict(rule='temperature.high',severity='WARNING',facts='100 C'))
    svc.close()


def test_ai_excerpt_is_bounded_redacted_and_does_not_change_verdict(tmp_path):
    from types import SimpleNamespace
    from integration.inspection import encode
    seen=[]
    answer=dict(possible_causes=['possible'],recommended_checks=['read evidence'],conclusion='unconfirmed',confidence_note='advisory',based_on=['raw'])
    svc=InspectionService(tmp_path/'i.db',lambda:[],None,ai=lambda text:(seen.append(json.loads(text)) or answer),secrets=lambda:['SECRET-SENTINEL'])
    svc.source=SimpleNamespace(evidence=tmp_path)
    (tmp_path/'raw.txt').write_text('x'*12000+'\ncpu SECRET-SENTINEL\n'+'z'*12000)
    item=seed(svc.store)[0]
    with svc.store.tx() as db:
        db.execute('INSERT INTO inspection_snapshots VALUES(?,?,?,?,?)',('snap','s','n0',time.time(),encode({'raw_evidence':'raw.txt'})))
        item['evidence_ref']={'snapshot_id':'snap'}
        svc.store.queue_advice(db,item,True)
    svc.ai_once()
    assert len(seen[0]['raw_excerpt'].encode())<=8192
    assert 'SECRET-SENTINEL' not in json.dumps(seen)
    after=svc.store.issues('s')[0]
    assert after['severity']=='WARNING' and after['status']=='ACTIVE'
    assert after['analysis']['state']=='COMPLETE'
    assert after['analysis']['based_on']['evidence_ref']['snapshot_id']=='snap'
    svc.close()


def test_legacy_queue_migration_is_repeatable_and_preserves_history(tmp_path):
    store=InspectionStore(tmp_path/'i.db');item=seed(store)[0]
    before=store.history('s',item['id'])
    with store.tx() as db:
        db.execute('PRAGMA user_version=2')
        row=db.execute('SELECT * FROM inspection_advice').fetchone()
        db.execute("UPDATE inspection_advice SET state='RUNNING',worker_slot=NULL")
        db.execute("INSERT INTO inspection_advice(id,system_id,issue_id,state,data) VALUES('newer','s',?,'QUEUED',?)",(item['id'],row['data']))
    for _ in range(2):store=InspectionStore(tmp_path/'i.db')
    with store.tx(False) as db:
        assert db.execute("SELECT count(*) FROM inspection_advice WHERE state IN ('RUNNING','QUEUED')").fetchone()[0]==1
        assert db.execute('SELECT count(*) FROM inspection_advice').fetchone()[0]==2
    assert store.history('s',item['id'])==before
    assert store.issues('s')[0]['id']==item['id']
