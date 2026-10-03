"""The Telemetry provision flow installs host and GPU components independently."""
from dataclasses import replace
import json
import pytest
from test_telemetry_provision import rig, enqueue, execute


def enqueue_scope(r,scope,index=0,key=None):
    node=r.client.get('/api/telemetry/systems/box/nodes').json()['nodes'][index]
    body={'expected_binding_revision':node['binding_revision'],'scope':scope}
    if key: body['idempotency_key']=key
    body.setdefault('idempotency_key',{'host':'scope-host-1','gpu':'scope-gpu-1','all':'scope-all-1'}[scope])
    response=r.client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',json=body)
    assert response.status_code==202,response.text
    return response.json()


def test_host_scope_stops_before_gpu(rig):
    r=rig;nid=r.nodes[0]['node_id'];r.monitor.gpus[nid]=4
    r.svc.config=r.monitor.config=replace(r.config,dcgm_image='registry.example/dcgm:validated-v1')
    job=execute(r,enqueue_scope(r,'host'))
    assert job['state']=='READY' and job['scope']=='host'
    assert r.store.components(nid)['host']=='READY'
    # No GPU detection or docker run happened during a host-only job.
    commands=[c[2] for c in r.monitor.calls if c[0]=='ssh']
    assert not any(c.startswith('# PA_GPU_CAPABILITY') for c in commands)
    assert not any(c.startswith('docker run') for c in commands)
    assert json.loads(r.tmp.joinpath('targets.json').read_text())  # host target published


def test_gpu_scope_installs_dcgm_on_ready_host(rig):
    r=rig;nid=r.nodes[0]['node_id'];r.monitor.gpus[nid]=4
    r.svc.config=r.monitor.config=replace(r.config,dcgm_image='registry.example/dcgm:validated-v1')
    r.monitor.installed.add(nid);r.monitor.scenarios[nid]='healthy'  # host already healthy
    job=execute(r,enqueue_scope(r,'gpu'))
    assert job['state']=='READY' and job['scope']=='gpu'
    assert r.store.components(nid)['gpu']['state']=='READY'
    commands=[c[2] for c in r.monitor.calls if c[0]=='ssh']
    assert any(c.startswith('# PA_GPU_CAPABILITY') for c in commands)
    assert sum(c.startswith('docker run') for c in commands)==1
    # A GPU-only job must never install or restart the host exporter.
    assert not any('apt-get' in c for c in commands)


def test_gpu_scope_not_blocked_when_host_not_ready(rig):
    # The user may install GPU telemetry even when host monitoring is unfinished.
    r=rig;nid=r.nodes[0]['node_id'];r.monitor.gpus[nid]=0
    r.svc.config=r.monitor.config=replace(r.config,dcgm_image='registry.example/dcgm:validated-v1')
    job=execute(r,enqueue_scope(r,'gpu'))
    # No GPU present -> NOT_APPLICABLE, but the job still ran the GPU detection.
    assert r.store.components(nid)['gpu']['state']=='NOT_APPLICABLE'
    commands=[c[2] for c in r.monitor.calls if c[0]=='ssh']
    assert any(c.startswith('# PA_GPU_CAPABILITY') for c in commands)


def test_legacy_enqueue_defaults_to_full_stack(rig):
    # A request without a scope must still target the full stack (all).
    job=enqueue(rig,key='legacy-all-1')
    assert job['scope']=='all'


def test_unknown_scope_is_rejected(rig):
    r=rig
    node=r.nodes[0]
    response=r.client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',
                           json={'idempotency_key':'scope-bad-1','expected_binding_revision':node['binding_revision'],'scope':'bogus'})
    assert response.status_code==422
