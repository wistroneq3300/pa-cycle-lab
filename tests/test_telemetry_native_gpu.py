import json
from dataclasses import replace
import pytest
from test_telemetry_provision import rig, enqueue, execute
from integration.telemetry_monitoring import register_target, unregister_target
from integration.telemetry_gpu import parse_gpu


@pytest.mark.parametrize('count',[1,4,8])
def test_gpu_provision_and_native_charts_real_route(rig,count):
    r=rig;nid=r.nodes[0]['node_id'];r.monitor.gpus[nid]=count
    config=replace(r.config,dcgm_image='nvcr.io/nvidia/k8s/dcgm-exporter:4.1.1-4.0.4-ubuntu22.04')
    r.svc.config=r.monitor.config=config
    result=execute(r,enqueue(r));assert result['state']=='READY'
    rows=json.loads(r.tmp.joinpath('targets.json').read_text())
    assert len(rows)==2 and {x['labels']['instance'] for x in rows}=={nid}
    assert any(x['targets']==['192.0.2.1:9400'] for x in rows)
    payload=r.client.get('/api/telemetry/nodes/'+nid+'/charts?period=7d').json()
    assert len(payload['panels'])==8
    assert len(next(p for p in payload['panels'] if p['id']=='gpu')['series'])==count
    assert all(len(s['points'])<=602 for p in payload['panels'] for s in p['series'])
    execute(r,enqueue(r,key='retry-after-ready'))
    assert sum(c[2].startswith('docker run') for c in r.monitor.calls if c[0]=='ssh')==1
    assert len(json.loads(r.tmp.joinpath('targets.json').read_text()))==2


@pytest.mark.parametrize('mode,expected,install',[('healthy','READY',0),('occupied','DEGRADED',0),('stopped','READY',0),('down','DEGRADED',1)])
def test_gpu_partial_does_not_break_host(rig,mode,expected,install):
    r=rig;nid=r.nodes[0]['node_id'];r.monitor.gpus[nid]=1;r.monitor.gpu_scenarios[nid]=mode
    r.svc.config=replace(r.config,dcgm_image='registry.example/dcgm:validated-v1')
    result=execute(r,enqueue(r));assert result['state']==expected
    assert r.store.components(nid)['host']=='READY'
    commands=[c[2] for c in r.monitor.calls if c[0]=='ssh']
    assert sum(c.startswith('docker run') for c in commands)==install
    assert not any('kill ' in c or 'reboot' in c or 'upgrade' in c for c in commands)


def test_host_gpu_identity_continuity_and_unregister(rig):
    r=rig;t=r.svc.resolve(r.nodes[0]['node_id'])
    for role in ('host','gpu'):register_target(r.config,t,role)
    before=json.loads(r.tmp.joinpath('targets.json').read_text())
    for role in ('host','gpu'):register_target(r.config,dict(t,os_ip='192.0.2.99',os_hostname='new',revision='99'),role)
    after=json.loads(r.tmp.joinpath('targets.json').read_text())
    assert [r['labels'] for r in before]==[r['labels'] for r in after]
    assert len(after)==2 and all('192.0.2.99:' in r['targets'][0] for r in after)
    unregister_target(r.config,t['node_id'],'gpu')
    assert len(json.loads(r.tmp.joinpath('targets.json').read_text()))==1


def test_unknown_gpu_is_not_cpu_only():
    assert parse_gpu('SMI_RC=127\nPCI_RC=127')[0]=='UNAVAILABLE'
    assert parse_gpu('SMI_RC=1\n0000:01:00.0 0302: 10de:1234\nPCI_RC=0')[0]=='UNAVAILABLE'
    assert parse_gpu('SMI_RC=127\n0000:01:00.0 0200: 10de:1234\nPCI_RC=0')[0]=='NOT_APPLICABLE'


def test_invalid_range_rejected_without_prometheus(rig):
    assert rig.client.get('/api/telemetry/nodes/'+rig.nodes[0]['node_id']+'/charts?period=unlimited').status_code==422


@pytest.mark.parametrize('mode,expected',[('empty','NO_DATA'),('stale','STALE'),('error','QUERY_ERROR')])
def test_chart_data_quality_is_not_reported_as_healthy(rig,mode,expected):
    rig.monitor.installed.add(rig.nodes[0]['node_id'])
    original=rig.monitor.api
    def api(path,params):
        if path=='query_range':
            if mode=='error': raise TimeoutError('sensitive exception')
            if mode=='empty': return {'result':[]}
        result=original(path,params)
        if mode=='stale' and params['query'].startswith('timestamp('):
            for row in result['result']:row['value'][1]='1'
        return result
    rig.monitor.api=api
    response=rig.client.get('/api/telemetry/nodes/'+rig.nodes[0]['node_id']+'/charts')
    assert response.status_code==200
    assert response.json()['panels'][0]['state']==expected
    assert 'sensitive exception' not in response.text


def test_gpu_without_approved_image_preserves_host(rig):
    nid=rig.nodes[0]['node_id'];rig.monitor.gpus[nid]=1
    assert execute(rig,enqueue(rig))['state']=='DEGRADED'
    assert rig.store.components(nid)['host']=='READY'
    assert not any(c[0]=='ssh' and c[2].startswith('docker run') for c in rig.monitor.calls)


@pytest.mark.parametrize('gpu_count,mode,gpu_state',[(0,'missing','NOT_APPLICABLE'),(1,'occupied','DEGRADED')])
def test_host_charts_remain_available_without_gpu_and_help_points_to_current_manager(rig,gpu_count,mode,gpu_state):
    nid=rig.nodes[0]['node_id'];rig.monitor.gpus[nid]=gpu_count;rig.monitor.gpu_scenarios[nid]=mode
    execute(rig,enqueue(rig))
    node=rig.client.get('/api/telemetry/nodes/'+nid).json()
    assert node['components']['host']=='READY' and node['components']['gpu']['state']==gpu_state
    panels=rig.client.get('/api/telemetry/nodes/'+nid+'/charts').json()['panels']
    assert all(p['state']=='READY' and p['series'] for p in panels if p['id'] in ('cpu','memory','disk','network'))
    if not gpu_count: assert all(p['state']=='NOT_APPLICABLE' for p in panels if p['id'] in ('gpu','hbm','temperature','power'))
    help=node['gpu_setup']
    assert help['prometheus_url']==rig.config.prometheus_url
    assert help['exporter_url']=='http://192.0.2.1:9400/metrics'
    assert help['file_sd']==rig.config.file_sd
    before=list(rig.monitor.calls)
    rig.client.get('/api/telemetry/nodes/'+nid)
    assert rig.monitor.calls==before


def test_host_readiness_is_published_before_gpu_work(rig,monkeypatch):
    from integration.telemetry_fixture import FixtureProvisionTransport
    original=FixtureProvisionTransport.ssh;observed=[]
    def ssh(wire,target,role,command,*args,**kwargs):
        if command.startswith('# PA_GPU_CAPABILITY'):
            states=rig.store.components(wire.binding['node_id']);observed.append(states)
            assert states['host']=='READY' and states['gpu']['state']=='PROVISIONING'
        return original(wire,target,role,command,*args,**kwargs)
    monkeypatch.setattr(FixtureProvisionTransport,'ssh',ssh)
    execute(rig,enqueue(rig));assert len(observed)==1
