"""DCGM setup explains exactly where it is blocked, and logs it to the console."""
from dataclasses import replace
import json
from test_telemetry_provision import rig, enqueue, execute


def _gpu_diag(r,scenario):
    r=rig if False else r
    nid=r.nodes[0]['node_id']
    r.monitor.gpus[nid]=4
    r.monitor.gpu_scenarios[nid]=scenario
    r.svc.config=r.monitor.config=replace(r.config,dcgm_image='registry.example/dcgm:validated-v1')
    r.monitor.installed.add(nid);r.monitor.scenarios[nid]='healthy'  # host ready
    job=execute(r,enqueue(r,key='diag-key-001'))
    events=r.store.events(job['job_id'])
    return job,events


def test_runtime_configured_but_not_loaded_is_diagnosed(rig):
    job,events=_gpu_diag(rig,'runtime-configured-not-loaded')
    diag=[e['message'] for e in events if e['step']=='GPU_DIAGNOSE']
    assert diag, 'expected GPU_DIAGNOSE events on the console'
    joined='\n'.join(diag)
    assert 'Docker executable: /usr/bin/docker' in joined
    assert 'daemon currently exposes the "nvidia" runtime: no' in joined
    assert 'configured on disk but the running Docker daemon has not loaded it' in joined
    assert 'nvidia-ctk runtime configure --runtime=docker' in joined
    # The job stays DEGRADED (no install dispatched) but the host is preserved.
    assert job['state']=='DEGRADED'
    assert rig.store.components(rig.nodes[0]['node_id'])['host']=='READY'
    commands=[c[2] for c in rig.monitor.calls if c[0]=='ssh']
    assert not any(c.startswith('docker run') for c in commands)
    assert not any('restart docker' in c for c in commands)


def test_missing_runtime_lists_prerequisites(rig):
    job,events=_gpu_diag(rig,'missing')
    diag='\n'.join(e['message'] for e in events if e['step']=='GPU_DIAGNOSE')
    assert 'nvidia-container-toolkit package' in diag
    assert job['state']=='DEGRADED'
