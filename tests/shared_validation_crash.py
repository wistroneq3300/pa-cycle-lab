"""Kill actual synthetic workers at four action boundaries; never contact DUTs."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import uuid

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

def worker(phase):
    from integration.settings import DATA
    from integration.store import Store
    from integration.runner import run_job
    from integration.synthetic import SyntheticTransport
    from integration.targets import inventory
    from scripts.native_demo import fixture
    from types import SimpleNamespace
    doc=fixture();targets=inventory(SimpleNamespace(**doc))[:1];store=Store()
    from integration.store import validate_request
    body=validate_request(dict(machine_ids=[targets[0]['name']],cycle_profile='neutrino',cycle_mode='reboot',channel='inband',limits={'loops':2},idempotency_key=uuid.uuid4().hex))
    job=store.create('Neutrino',body,targets,'synthetic-test')
    (DATA/'job-id').write_text(job['id'])
    def halt():
        (DATA/'fault-reached').write_text(phase)
        while True: time.sleep(1)
    real_intent=store.intent;real_result=store.action_result
    if phase=='before-intent':
        def intent(*args): halt();return real_intent(*args)
        store.intent=intent
    if phase=='after-response':
        def result(*args): real_result(*args);halt()
        store.action_result=result
    class Fake(SyntheticTransport):
        dispatched=False
        def ssh(self,t,role,cmd,*args,**kwargs):
            result=super().ssh(t,role,cmd,*args,**kwargs)
            if cmd=='reboot':
                self.dispatched=True
                with (DATA/'dispatches').open('a') as f:f.write('reboot\n');f.flush();os.fsync(f.fileno())
                if phase=='during-command':halt()
            if phase=='during-post' and self.dispatched and cmd=='lspci -Dvv -nn':halt()
            return result
    run_job(store,job['id'],Fake)

def check():
    # Parent's own imports stay isolated too; each killed worker gets a separate instance.
    os.environ['CYCLE_INSTANCE']='data/crash-controller-'+uuid.uuid4().hex
    os.environ['CYCLE_MODE']='synthetic';os.environ.pop('PA_DATA_DIR',None)
    from integration.store import Store
    from integration import runner
    from unittest.mock import patch
    results=[]
    for phase in ('before-intent','during-command','after-response','during-post'):
        relative='data/crash-'+phase+'-'+uuid.uuid4().hex;folder=ROOT/relative;folder.mkdir()
        env={**os.environ,'CYCLE_INSTANCE':relative,'PYTHONUTF8':'1'};env.pop('PA_DATA_DIR',None)
        flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
        with (folder/'process.log').open('w',encoding='utf-8') as log:
            child=subprocess.Popen([sys.executable,__file__,'worker',phase],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=flags)
            pid=None
            try:
                deadline=time.time()+45;store=None;job=None
                while time.time()<deadline:
                    if (folder/'job-id').exists():
                        store=Store(folder/'jobs.sqlite3');job=store.get((folder/'job-id').read_text());pid=job.get('worker_pid')
                        if job['state']=='AWAITING_CONFIRMATION':store.confirm(job['id'],job['pre']['version'],job['pre']['runnable_ids'],'test')
                    if (folder/'fault-reached').exists():break
                    time.sleep(.05)
                else:raise AssertionError('Fault checkpoint timed out: '+phase)
                os.kill(pid,signal.SIGTERM if os.name=='nt' else signal.SIGKILL);child.wait(10)
                with patch.object(runner,'ARTIFACTS',folder/'artifacts'):
                    runner.recover(store,store.get(job['id']))
                final=store.get(job['id'])
                assert final['state']=='RECONCILIATION_REQUIRED'
                # Pinned baseline intentionally removed reservation enforcement.
                # Verify no replay without claiming retained locks that do not exist.
                assert store.lock_owners()=={}
                assert store.claim(job['id'],'replay') is None
                count=len((folder/'dispatches').read_text().splitlines()) if (folder/'dispatches').exists() else 0
                assert count==(0 if phase=='before-intent' else 1)
                results.append(dict(phase=phase,dispatches=count,state=final['state'],baseline_reservations_disabled=True))
            finally:
                if child.poll() is None:
                    if pid:
                        try:os.kill(pid,signal.SIGTERM)
                        except ProcessLookupError:pass
                    child.kill();child.wait(10)
    (ROOT/'artifacts/shared-validation/crash-results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(dict(passed=4,failed=0,phases=results)))

if __name__=='__main__':
    if len(sys.argv)>1 and sys.argv[1]=='worker':worker(sys.argv[2])
    else:check()
