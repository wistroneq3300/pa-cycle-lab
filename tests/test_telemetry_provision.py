"""Actual ASGI routes/service/identity/store; only device/monitoring IO is fake."""
import copy
import json
import os
from pathlib import Path
import tempfile
import threading
import time
from types import SimpleNamespace
from unittest.mock import Mock
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from integration import settings
from integration.targets import node_identity, inventory
from integration.identity_sync import IdentitySync
from integration.telemetry_store import ProvisionStore
from integration.telemetry_monitoring import MonitoringConfig, MonitoringClient, REQUIRED, register_target
from integration.telemetry_provision import ProvisionService, detection_command
from integration.telemetry_fixture import FixtureMonitor, FixtureProvisionTransport
from integration.telemetry_routes import install
from cycle_transport import Command


@pytest.fixture
def rig(tmp_path):
    machine=node_identity.canonical(dict(id='telemetry-box',name='box',project='P',active_os=1,os=[dict(slot=i,ip='192.0.2.'+str(i),
      user='user'+str(i),port=2200+i,os_hostname='n'+str(i),**{'pass':'SECRET-OS-'+str(i)}) for i in range(1,5)]))
    pa=SimpleNamespace(machines={'box':machine},projects={'P':{'project_id':'p'}},node_identity=node_identity,_DATA_LOCK=threading.RLock(),_invalidate_machine_cache=Mock())
    pa._save_data=Mock(side_effect=lambda:(tmp_path/'inventory.json').write_text(json.dumps(pa.machines)))
    def resolve(nid):
        target=next(t for t in inventory(pa) if t['node_id']==nid)
        entry=next(e for e in pa.machines['box']['os'] if e['node_id']==nid)
        if entry.get('retired'): raise KeyError(nid)
        return dict(target,binding_revision=entry.get('binding_revision',1))
    config=MonitoringConfig('http://monitor.invalid',str(tmp_path/'targets.json'),'http://grafana.invalid:3100',verify_seconds=0,poll_seconds=.01)
    monitor=FixtureMonitor(config);store=ProvisionStore(tmp_path/'jobs.sqlite3',lambda:['SECRET-OS-'+str(i) for i in range(1,5)])
    svc=ProvisionService(store,resolve,lambda t:FixtureProvisionTransport(t,monitor),IdentitySync(pa),monitor,config)
    app=FastAPI();app.state.telemetry_provision=svc;install(app,pa)
    result=SimpleNamespace(pa=pa,store=store,svc=svc,monitor=monitor,config=config,client=TestClient(app),app=app,tmp=tmp_path)
    result.nodes=result.client.get('/api/telemetry/systems/box/nodes').json()['nodes']
    yield result
    if svc.thread: svc.close()


def enqueue(r,index=0,key='request-001'):
    node=r.client.get('/api/telemetry/systems/box/nodes').json()['nodes'][index]
    response=r.client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',json={'idempotency_key':key,'expected_binding_revision':node['binding_revision']})
    assert response.status_code==202,response.text
    return response.json()


def execute(r,job):
    assert r.store.claim(job['job_id']);r.svc.execute(job['job_id']);return r.store.get(job['job_id'])


@pytest.mark.parametrize('scenario,expected,installs,starts', [('missing','READY',1,1),('healthy','READY',0,0),('stopped','READY',0,1),
    ('occupied','ERROR',0,0),('unreachable','UNREACHABLE',0,0),('degraded','DEGRADED',1,1),('lost','INTERRUPTED',1,0)])
def test_provision_paths_real_service(rig,scenario,expected,installs,starts):
    r=rig;nid=r.nodes[0]['node_id'];r.monitor.scenarios[nid]=scenario
    job=execute(r,enqueue(r));assert job['state']==expected
    commands=[c[2] for c in r.monitor.calls if c[0]=='ssh']
    assert sum('apt-get' in c for c in commands)==installs
    assert sum(c.startswith('systemctl ') for c in commands)==starts
    assert not any(any(s in c for s in ('reboot','power cycle','dmesg -c','sel clear')) for c in commands)
    if scenario=='occupied': assert 'pid=912' in job['error']
    import re
    assert not any(re.search(r'[\u3400-\u9fff]',e['message']) for e in r.store.events(job['job_id']))


def test_idempotency_concurrent_users_and_refresh_do_not_install(rig):
    r=rig
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(8) as pool: jobs=list(pool.map(lambda i:enqueue(r,key='request-'+str(i)),range(8)))
    assert len({j['job_id'] for j in jobs})==1
    for _ in range(5): r.client.get('/api/telemetry/nodes/'+r.nodes[0]['node_id'])
    assert r.monitor.calls==[]
    execute(r,jobs[0]);assert enqueue(r,key=jobs[0]['idempotency_key'])['job_id']==jobs[0]['job_id']
    for i in range(8): assert enqueue(r,key='request-'+str(i))['job_id']==jobs[0]['job_id']


def test_events_cursor_restart_redaction_and_full_download(rig):
    r=rig;job=execute(r,enqueue(r));jid=job['job_id']
    r.store.step(jid,'CHECK','SECRET-OS-1 Authorization=Bearer xyz\x1b[31m',level='WARN')
    first=r.client.get(f'/api/telemetry/jobs/{jid}/events?limit=2').json()
    rest=r.client.get(f'/api/telemetry/jobs/{jid}/events?after_seq={first["next_sequence"]}').json()
    assert first['events'][-1]['sequence']<rest['events'][0]['sequence']
    reopened=ProvisionStore(r.store.path);assert reopened.get(jid)['state']=='READY';assert len(reopened.events(jid))>2
    text=r.client.get(f'/api/telemetry/jobs/{jid}/log').text
    assert '+08:00' in text and 'SECRET-OS-1' not in text and 'Bearer xyz' not in text and '\x1b' not in text
    assert b'SECRET-OS-1' not in r.store.path.read_bytes()
    assert r.client.get(f'/api/telemetry/jobs/{jid}/events?after_seq=-1').status_code==422


def test_web_restart_interrupted_install_not_replayed(rig):
    r=rig;job=enqueue(r);r.store.claim(job['job_id']);r.store.step(job['job_id'],'INSTALL','Installation intent')
    r.store.recover();r.store.recover()
    assert r.store.get(job['job_id'])['state']=='INTERRUPTED'
    assert len([e for e in r.store.events(job['job_id']) if e['step']=='INTERRUPTED'])==1
    assert r.monitor.calls==[] and not r.store.queued()
    retry=enqueue(r,key='explicit-retry');r.monitor.scenarios[r.nodes[0]['node_id']]='healthy'
    assert execute(r,retry)['state']=='READY'
    assert not any('apt-get' in c[-1] for c in r.monitor.calls if c[0]=='ssh')


def test_binding_edit_stops_before_install(rig):
    r=rig;job=enqueue(r);r.pa.machines['box']['os'][0]['ip']='192.0.2.99'
    assert execute(r,job)['state']=='ERROR';assert not r.monitor.calls
    assert r.client.post('/api/telemetry/nodes/'+r.nodes[0]['node_id']+'/enable',json={'idempotency_key':'new-request','expected_binding_revision':r.nodes[0]['binding_revision']}).status_code==409


def test_identity_shared_rename_and_active_os_do_not_redirect(rig):
    r=rig;old=r.nodes[2]['node_id'];job=enqueue(r,2)
    def transport(t):
        wire=FixtureProvisionTransport(t,r.monitor);wire.scenario['hostname']='new-n3';return wire
    r.svc.transport=transport;r.pa.machines['box']['active_os']=4
    assert execute(r,job)['state']=='READY'
    assert r.pa.machines['box']['os'][2]['os_hostname']=='new-n3'
    assert r.pa.machines['box']['os'][2]['node_id']==old
    assert all(c[1]==old for c in r.monitor.calls)
    labels=json.loads(Path(r.config.file_sd).read_text())[0]['labels'];assert labels['node_id']==old and labels['instance']==old and 'hostname' not in labels
    assert r.svc.snapshot(old)['hostname']=='new-n3'


def test_edit_during_shared_identity_read_stops(rig):
    r=rig;original=r.svc.transport
    def transport(t):
        wire=original(t);ssh=wire.ssh
        def call(*args,**kwargs):
            result=ssh(*args,**kwargs)
            if 'BOOT_ID=' in args[2]: r.pa.machines['box']['os'][0]['port']=9999
            return result
        wire.ssh=call;return wire
    r.svc.transport=transport
    assert execute(r,enqueue(r))['state']=='ERROR'
    assert not any('apt-get' in c[-1] for c in r.monitor.calls if c[0]=='ssh')


def test_inventory_retired_or_asset_mismatch_no_install(rig):
    r=rig;job=enqueue(r)
    r.pa.machines['box']['os'][0]['retired']=True
    assert execute(r,job)['state']=='ERROR';assert not r.monitor.calls


def test_evidence_write_failure_before_install_no_dispatch(rig,monkeypatch):
    r=rig;original=r.store.step
    def step(jid,name,*args,**kwargs):
        if name=='INSTALL': raise OSError('disk full')
        return original(jid,name,*args,**kwargs)
    monkeypatch.setattr(r.store,'step',step)
    assert execute(r,enqueue(r))['state']=='ERROR'
    assert not any('apt-get' in c[-1] for c in r.monitor.calls if c[0]=='ssh')


def test_file_sd_preserves_unrelated_and_invalid_file(rig):
    r=rig;path=Path(r.config.file_sd);other={'targets':['192.0.2.200:9100'],'labels':{'team':'existing'}}
    path.write_text(json.dumps([other]));assert execute(r,enqueue(r))['state']=='READY'
    rows=json.loads(path.read_text());assert rows[0]==other
    target=r.svc.resolve(r.nodes[0]['node_id']);register_target(r.config,target);assert len(json.loads(path.read_text()))==2
    path.write_text('{corrupt');before=path.read_bytes()
    with pytest.raises(ValueError):register_target(r.config,target)
    assert path.read_bytes()==before


def test_same_endpoint_owned_elsewhere_not_replaced(rig):
    r=rig;path=Path(r.config.file_sd);path.write_text(json.dumps([{'targets':['192.0.2.1:9100'],'labels':{'node_id':'another-node'}}]))
    before=path.read_bytes();assert execute(r,enqueue(r))['state']=='ERROR';assert path.read_bytes()==before


def test_adopt_poc_target_without_duplicate_or_losing_group(rig):
    r=rig;path=Path(r.config.file_sd)
    path.write_text(json.dumps([{'targets':['192.0.2.1:9100','192.0.2.200:9100'],'labels':{'site':'lab'}}]))
    r.monitor.scenarios[r.nodes[0]['node_id']]='healthy'
    assert execute(r,enqueue(r))['state']=='READY'
    rows=json.loads(path.read_text());assert sum('192.0.2.1:9100' in r['targets'] for r in rows)==1
    assert rows[0]=={'targets':['192.0.2.200:9100'],'labels':{'site':'lab'}}
    assert rows[1]['labels']['site']=='lab'


def test_background_job_browser_independent_four_nodes(rig):
    r=rig;r.svc.start();jobs=[enqueue(r,i,'node-'+str(i)+'-key') for i in range(4)]
    r.client.close()
    deadline=time.monotonic()+8
    while time.monotonic()<deadline and any(r.store.get(j['job_id'])['state']!='READY' for j in jobs):time.sleep(.05)
    assert [r.store.get(j['job_id'])['state'] for j in jobs]==['READY']*4
    assert len(json.loads(Path(r.config.file_sd).read_text()))==4


def test_authorization_existing_provider(rig):
    r=rig;r.app.state.cycle_provider=SimpleNamespace(authenticate=lambda req:'viewer',authorize=lambda actor,project,action:project=='P' and action=='read')
    node=r.nodes[0]
    assert r.client.get('/api/telemetry/systems/box/nodes').status_code==200
    assert r.client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',json={}).status_code==403
    r.app.state.cycle_provider.authorize=lambda *args:False
    assert r.client.get('/api/telemetry/systems/box/nodes').status_code==403


@pytest.mark.parametrize('mode,expected',[('ok','READY'),('down','DEGRADED'),('missing','DEGRADED'),('stale','DEGRADED'),('future','DEGRADED'),('wrong_instance','DEGRADED'),('non_exporter','DEGRADED')])
def test_real_prometheus_http_contract(rig,mode,expected):
    r=rig;target=r.svc.resolve(r.nodes[0]['node_id']);queries=[]
    def handler(request):
        if request.url.path=='/metrics':return httpx.Response(200,text='not exporter' if mode=='non_exporter' else 'node_exporter_build_info{version="1.8.2"} 1\n')
        if request.url.path.endswith('/targets'):
            data={'activeTargets':[{'labels':{'node_id':target['node_id'],'instance':'wrong' if mode=='wrong_instance' else target['node_id']},'scrapeUrl':'http://192.0.2.1:9100/metrics','health':'down' if mode=='down' else 'up'}]}
        else:
            queries.append(request.url.params['query']);stamp=100 if mode=='stale' else 2001 if mode=='future' else 1999
            data={'result':[] if mode=='missing' else [{'value':[2000,str(stamp)]}]}
        return httpx.Response(200,json={'status':'success','data':data})
    client=MonitoringClient(r.config,httpx.Client(transport=httpx.MockTransport(handler)),clock=lambda:2000)
    assert client.health(target)[0]==expected
    if mode=='ok':assert len(queries)==len(REQUIRED) and all(q.startswith('timestamp(') for q in queries)
    client.close()


def test_dashboard_canonical_scope_and_configurable_endpoint(rig):
    from urllib.parse import urlsplit,parse_qs
    url=rig.config.dashboard(rig.nodes[2]['node_id'],'dark');parsed=urlsplit(url)
    assert parsed.netloc=='grafana.invalid:3100' and parse_qs(parsed.query)['var-node_id']==[rig.nodes[2]['node_id']]
    assert parse_qs(parsed.query)['theme']==['dark']


def test_old_ready_not_presented_as_current_ready(rig):
    r=rig;job=execute(r,enqueue(r))
    with r.store.tx() as db: db.execute('UPDATE telemetry_nodes SET checked_at=0')
    assert r.svc.snapshot(r.nodes[0]['node_id'])['state']=='DEGRADED'
    assert r.store.get(job['job_id'])['state']=='READY'


def test_metric_identity_survives_binding_hostname_and_ip_change(rig):
    r=rig;target=r.svc.resolve(r.nodes[0]['node_id'])
    register_target(r.config,target)
    original=json.loads(Path(r.config.file_sd).read_text())[0]
    changed=dict(target,revision='new-binding',os_hostname='renamed.example',os_ip='192.0.2.150')
    register_target(r.config,changed)
    current=json.loads(Path(r.config.file_sd).read_text())[0]
    assert current['labels']==original['labels']
    assert current['labels']['instance']==target['node_id']
    assert current['labels']['slot']==target['slot_key']
    assert not {'pa_binding','hostname','ip'} & current['labels'].keys()
    assert current['targets']==['192.0.2.150:9100']
    assert r.config.dashboard(target['node_id'])==r.config.dashboard(changed['node_id'])


def test_preferred_exporter_never_upgrades_healthy(rig):
    from dataclasses import replace
    r=rig;r.svc.config=replace(r.config,preferred_exporter_version='9.9.9')
    r.monitor.scenarios[r.nodes[0]['node_id']]='healthy'
    job=execute(r,enqueue(r))
    assert job['state']=='READY'
    assert not any('apt-get' in c[-1] for c in r.monitor.calls if c[0]=='ssh')
    assert any('9.9.9' in e['message'] for e in r.store.events(job['job_id']))


def test_cycle_console_summary_is_read_only_and_does_not_infer_dispatch(rig,monkeypatch):
    from integration import web
    from integration.store import Store
    r=rig;store=Store(r.tmp/'cycle.sqlite3')
    monkeypatch.setattr(web,'store',store)
    monkeypatch.setattr(web.app.state,'cycle_provider',SimpleNamespace(authenticate=lambda req:'reader',authorize=lambda actor,project,action:project=='P' and action=='read'),raising=False)
    target=r.svc.resolve(r.nodes[0]['node_id'])
    job=store.create('P',{'idempotency_key':'summary-test','cycle_mode':'reboot'},[target],'fixture',mode='synthetic')
    for loop,kind in [(1,'COMMAND_DISPATCHED'),(1,'POST_COMPLETED'),(2,'COMMAND_DISPATCHING'),(2,'RESPONSE_LOST')]:
        store.append_event(job['id'],dict(machine_id=target['name'],loop=loop,event_type=kind,phase='CYCLE'))
    before=store.get(job['id'])
    client=TestClient(web.app);url=f"/api/projects/P/cycle/jobs/{job['id']}/console-summary"
    response=client.get(url);assert response.status_code==200,response.text
    row=response.json()['nodes'][0]
    assert row['loop']==2 and row['completed']==[]
    assert store.get(job['id'])==before
    assert client.get(url.replace('/projects/P/','/projects/other/')).status_code==403
    store.append_event(job['id'],dict(machine_id=target['name'],loop=2,event_type='BOOT_ID_CHANGED',phase='RECOVERY'))
    assert client.get(url).json()['nodes'][0]['completed']==[]
    store.append_event(job['id'],dict(machine_id=target['name'],loop=2,event_type='RECOVERY_DETECTED',phase='CYCLE'))
    assert client.get(url).json()['nodes'][0]['completed']==['RECOVERY']
    store.append_event(job['id'],dict(machine_id=target['name'],loop=2,event_type='ISSUE_NEW',phase='POST',level='FAIL',message='Evidence boundary',evidence='../private/credentials.json'))
    assert all('evidence' not in e for e in client.get(url).json()['nodes'][0]['markers'])


def test_grafana_dashboard_uses_nine_real_metric_legends():
    dashboard=json.loads((Path(__file__).resolve().parents[1]/'deploy/telemetry/pa-node-telemetry.json').read_text())
    assert len(dashboard['panels'])==9
    for panel in dashboard['panels']:
        query=panel['targets'][0]
        assert 'node_id="$node_id"' in query['expr'] and 'pa_binding' not in query['expr']
        if panel['title'] in ('CPU Utilization','Memory Utilization','System Load','Uptime'): assert query['legendFormat']=='{{node_id}}'
        elif panel['title']=='Filesystem Used': assert query['legendFormat']=='{{mountpoint}}'
        else: assert query['legendFormat']=='{{device}}'


def test_full_production_middleware_project_only_caller(rig,monkeypatch):
    from integration import web
    r=rig
    monkeypatch.setattr(web.pa,'machines',r.pa.machines)
    monkeypatch.setattr(web.pa,'projects',r.pa.projects)
    monkeypatch.setattr(web.app.state,'telemetry_provision',r.svc,raising=False)
    provider=SimpleNamespace(authenticate=lambda req:'project-operator',authorize=lambda actor,project,action:project=='P' and action in ('read','operate'))
    monkeypatch.setattr(web.app.state,'cycle_provider',provider,raising=False)
    client=TestClient(web.app);node=r.nodes[0]
    response=client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',json={'idempotency_key':'production-route','expected_binding_revision':node['binding_revision']})
    assert response.status_code==202,response.text
    jid=response.json()['job_id']
    assert client.get('/api/telemetry/jobs/'+jid+'/events').status_code==200
    assert client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',headers={'Origin':'http://another-origin'},json={}).status_code==403
    provider.authorize=lambda *args:False
    assert client.get('/api/telemetry/jobs/'+jid+'/log').status_code==403
    client.close()
