"""Kill only a freshly spawned isolated fixture Web during install intent. No DUT."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import uuid
import httpx

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/telemetry-provision';OUT.mkdir(parents=True,exist_ok=True)


def main():
    with socket.socket() as sock: sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env=dict(os.environ,PYTHONUTF8='1',CYCLE_MODE='synthetic',CYCLE_INSTANCE='data/telemetry-preview-process-'+uuid.uuid4().hex,
             PA_PREVIEW_URL=f'http://127.0.0.1:{port}')
    env.pop('PA_DATA_DIR',None);env.pop('CYCLE_ARTIFACTS_DIR',None)
    base=env['PA_PREVIEW_URL'];client=httpx.Client(base_url=base,timeout=3);process=None
    log=(OUT/'process-server.log').open('w',encoding='utf-8')
    def start():
        proc=subprocess.Popen([sys.executable,'-m','uvicorn','scripts.telemetry_preview:create_app','--factory','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=log)
        for _ in range(100):
            try:
                if client.get('/__telemetry/results').is_success:return proc
            except httpx.HTTPError: pass
            if proc.poll() is not None:raise AssertionError('Isolated server failed; see process-server.log')
            time.sleep(.1)
        proc.kill();proc.wait();raise AssertionError('Server timeout')
    try:
        process=start();node=client.get('/api/telemetry/systems/chassis-01/nodes').json()['nodes'][0]
        client.post('/__telemetry/fixture',json={'index':0,'mode':'slow'}).raise_for_status()
        job=client.post('/api/telemetry/nodes/'+node['node_id']+'/enable',json={'idempotency_key':'crash-process-test','expected_binding_revision':node['binding_revision']}).json()
        for _ in range(100):
            observed=client.get('/api/telemetry/jobs/'+job['job_id']).json()
            if observed['current_step']=='INSTALL':break
            time.sleep(.1)
        assert observed['current_step']=='INSTALL'
        before=client.get('/api/telemetry/jobs/'+job['job_id']+'/events').json()['events']
        process.kill();process.wait(timeout=10);process=start()
        after=client.get('/api/telemetry/jobs/'+job['job_id']+'/events').json()
        assert after['job']['state']=='INTERRUPTED'
        assert after['events'][:len(before)]==before
        time.sleep(1)
        state=client.get('/__telemetry/results').json();assert state['calls']==[] and state['cycle_jobs']==0
        result={'result':'PASS','job_id':job['job_id'],'events_before':len(before),'events_after':len(after['events']),
                'state':'INTERRUPTED','replayed_commands':0,'isolated_instance':env['CYCLE_INSTANCE']}
        (OUT/'process-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
    finally:
        if process and process.poll() is None:process.terminate();process.wait(timeout=15)
        client.close();log.close()


if __name__=='__main__':main()
