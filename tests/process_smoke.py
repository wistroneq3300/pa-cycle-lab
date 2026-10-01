"""Kill/restart a real isolated Web process while the independent runner runs."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import sys
import time
import uuid
import httpx

ROOT=Path(__file__).resolve().parents[1]
instance='data/process-smoke-'+uuid.uuid4().hex
folder=ROOT/instance;folder.mkdir(parents=True)
env={**os.environ,'CYCLE_INSTANCE':instance,'CYCLE_MODE':'synthetic','PYTHONUTF8':'1'}
env.pop('CYCLE_USERS_JSON',None)
env.pop('PA_DATA_DIR',None)
flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
log=(folder/'process.log').open('w',encoding='utf-8')
with socket.socket() as probe:
    probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
url=f'http://127.0.0.1:{port}'
client=httpx.Client(base_url=url,timeout=3,trust_env=False)
processes=[];pids=set()

def launch(*arguments):
    child=subprocess.Popen([sys.executable,*arguments],cwd=ROOT,env=env,creationflags=flags,stdout=log,stderr=log)
    processes.append(child);return child

def wait_for(function,timeout=25):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        try:
            value=function()
            if value:return value
        except (httpx.HTTPError,FileNotFoundError,ValueError):pass
        time.sleep(.1)
    raise AssertionError('Timed out waiting for process state; inspect '+str(folder/'process.log'))

def terminate(pid):
    try:os.kill(pid,signal.SIGTERM if os.name=='nt' else signal.SIGKILL)
    except ProcessLookupError:pass

try:
    subprocess.run([sys.executable,'scripts/native_demo.py','--chassis','32' if '--browser' in sys.argv else '1'],cwd=ROOT,env=env,check=True,stdout=log,creationflags=flags)
    scheduler=launch('run.py','runner')
    runner_pid=wait_for(lambda:int((folder/'runtime/service-pid.txt').read_text()));pids.add(runner_pid)
    first=launch('run.py','web','--port',str(port))
    web_pid=wait_for(lambda:client.get('/api/cycle/status').json().get('web_pid'));pids.add(web_pid)
    base='/api/projects/Neutrino%20Demo/cycle/jobs'
    targets=client.get('/api/projects/Neutrino%20Demo/cycle/targets').json()['targets']
    body=dict(machine_ids=[t['name'] for t in targets[:4]],cycle_profile='neutrino',cycle_mode='reboot',channel='inband',
              limits={'loops':100,'hours':0},idempotency_key=uuid.uuid4().hex)
    response=client.post(base,json=body);response.raise_for_status();job=response.json();jid=job['id']
    def read_job():return client.get(base+'/'+jid).json()
    def at_state(state):
        job=read_job();return job if job['state']==state else None
    ready=wait_for(lambda:at_state('AWAITING_CONFIRMATION'))
    worker_pid=ready['worker_pid'];pids.add(worker_pid)
    response=client.post(base+'/'+jid+'/confirm',json={'version':ready['pre']['version'],'machine_ids':ready['pre']['runnable_ids']})
    response.raise_for_status()
    wait_for(lambda:any(n['completed']>=1 for n in read_job()['nodes']))
    console_before=client.get(base+'/'+jid+'/events').json()['events']
    assert console_before
    terminate(web_pid);first.wait(10);pids.discard(web_pid)
    launch('run.py','web','--port',str(port))
    second_pid=wait_for(lambda:client.get('/api/cycle/status').json().get('web_pid'));pids.add(second_pid)
    assert second_pid!=web_pid
    reconnected=read_job()
    assert reconnected['worker_pid']==worker_pid
    console_after=client.get(base+'/'+jid+'/events').json()['events']
    assert console_after[:len(console_before)]==console_before
    incremental=client.get(base+'/'+jid+'/events',params={'after':console_before[-1]['sequence']}).json()['events']
    assert all(e['sequence']>console_before[-1]['sequence'] for e in incremental)
    assert reconnected['state']=='RUNNING',reconnected['state']
    # Scheduler death/restart must neither kill nor replay the independent worker.
    terminate(runner_pid);scheduler.wait(10);pids.discard(runner_pid)
    launch('run.py','runner')
    def new_scheduler():
        pid=int((folder/'runtime/service-pid.txt').read_text())
        return pid if pid!=runner_pid else None
    second_runner=wait_for(new_scheduler);pids.add(second_runner)
    assert read_job()['worker_pid']==worker_pid
    wait_for(lambda:all(n['completed']>=2 for n in read_job()['nodes']))
    assert read_job()['worker_pid']==worker_pid
    assert client.post(base+'/'+jid+'/stop',json={}).status_code==200
    final=wait_for(lambda:at_state('INCOMPLETE'))
    assert all(n['completed']>=1 for n in final['nodes'])
    assert all(n['completed']<=n['attempts'] for n in final['nodes'])  # independent domain barriers
    pids.discard(worker_pid)
    if '--browser' in sys.argv:
        browser_result=subprocess.run(['node','tests/native-browser.cjs'],cwd=ROOT,
                       env={**env,'PA_CYCLE_BASE_URL':url},capture_output=True,text=True,encoding='utf-8',
                       timeout=180,creationflags=flags)
        print(browser_result.stdout,flush=True)
        if browser_result.returncode: print(browser_result.stderr,flush=True)
        browser_result.check_returncode()
    result={'passed':True,'instance':instance,'job_id':jid,'web_pid_changed':True,'worker_pid_unchanged':True,
            'console_history_survived_web_restart':True,'incremental_events_verified':True,
            'scheduler_pid_changed':True,'worker_survived_scheduler_restart':True,
            'state':final['state'],'completed_rounds':final['nodes'][0]['completed']}
    (ROOT/'data/process-smoke-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))
finally:
    for pid in pids:terminate(pid)
    for child in processes:
        try:child.wait(5)
        except subprocess.TimeoutExpired:child.kill();child.wait(5)
    client.close();log.close()
