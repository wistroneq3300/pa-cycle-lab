"""Independent service and child workers. Web restarts cannot replay power actions."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import fields
from pathlib import Path
from types import SimpleNamespace
import copy
import json
import os
import signal
import subprocess
import sys
import threading
import time
import uuid

from .settings import ROOT, DATA, RUNTIME, ARTIFACTS, ENGINE, MODE
from .store import Store, TERMINAL, fingerprint, engine_hash
from .synthetic import SyntheticTransport
from cycle_core import Target, digest, now, parse_policy, write_json, atomic_write
from cycle_engine import NodeSession
from cycle_report import write_reports, status
from cycle_transport import Transport

@contextmanager
def process_lock(path):
    """OS releases this lock on death; never infer death from a slow heartbeat."""
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    stream=path.open('a+b')
    stream.seek(0); stream.write(b'0'); stream.flush(); stream.seek(0)
    acquired=False
    try:
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        acquired=True
        yield
    finally:
        if acquired:
            stream.seek(0)
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(),fcntl.LOCK_UN)
        stream.close()

def alive(job_id):
    try:
        with process_lock(RUNTIME/(job_id+'.lock')):
            return False
    except (OSError,BlockingIOError):
        return True

def compact(session):
    n=session.node
    records=[n['pre'],*n['loops']]
    seen={(i['code'],i['component']) for i in n['pre']['issues']}
    first=0
    for record in n['loops']:
        keys={(i['code'],i['component']) for i in record['issues']}
        first=len(keys-seen); seen|=keys
    record=records[-1]
    pending=not record.get('finished')
    return dict(machine_id=session.machine_id,key=n['key'],stage=n['stage'] or record['phase'],
                loop=record.get('loop',0),completed=n['completed'],attempts=n['attempts'],
                health='PENDING' if pending else record['status'],updated_at=getattr(session,'last_activity',time.time()),
                first_this_round=None if pending else first,unique_issues=len(seen),
                stop_reason=n['stop_reason'],blocked=n['blocked'])

def run_job(store, job_id, transport_factory=None):
    with process_lock(RUNTIME/(job_id+'.lock')):
        job=store.claim(job_id,uuid.uuid4().hex)
        if not job: return
        root=ARTIFACTS/job_id; root.mkdir(exist_ok=True)
        sessions=[]; done=threading.Event(); state='ERROR'; reason='Preparation failed'; campaign=None
        # All writes for event callbacks are serialized; reports are written between rounds.
        mutex=threading.RLock()
        def emit(session, phase):
            with mutex:
                session.last_activity=time.time()
                snap=compact(session)
                store.update(job_id,event=dict(phase=phase,machine_id=session.machine_id,loop=snap['loop']),
                             nodes=[compact(s) for s in sessions])
        def heartbeat():
            while not done.wait(2):
                store.update(job_id,heartbeat=time.time())
        thread=threading.Thread(target=heartbeat,daemon=True); thread.start()
        def stop_signal(*_): store.stop(job_id,'runner-signal')
        if threading.current_thread() is threading.main_thread():
            signal.signal(signal.SIGTERM,stop_signal); signal.signal(signal.SIGINT,stop_signal)
        def parallel(method, selected, *args):
            def invoke(session):
                session.stage(method.upper())
                try: getattr(session,method)(*args)
                except Exception as exc:
                    session.node.update(active=False,stop_reason=f'{method}: {type(exc).__name__}')
                    record=session.node.get('start',session.node['pre'])
                    session.add(record,'EXECUTION_ERROR',method,f'{type(exc).__name__}; retained evidence')
                    if method=='precheck': session.node['blocked'].append('PRE execution failed')
                    session.finish(record)
                emit(session,method.upper()+'_FINISHED')
            with ThreadPoolExecutor(max_workers=min(32,len(selected) or 1)) as pool:
                list(pool.map(invoke,selected))
        try:
            if engine_hash()!=job['engine_hash']: raise RuntimeError('Engine changed since job creation')
            options=SimpleNamespace(**{k:v for k,v in job['config'].items() if k in {'cycle_mode','channel','boot_timeout'}},
                                    poll_interval=0.05 if job['synthetic'] else 5,memory_min_ratio=.9)
            script=(ENGINE/'neutrino_config.sh').read_bytes().replace(b'\r\n',b'\n')
            policy=(ENGINE/'issue_policy.md').read_text(encoding='utf-8')
            rules=parse_policy(policy)
            atomic_write(root/'neutrino_config.snapshot.sh',script.decode())
            atomic_write(root/'issue_policy.snapshot.md',policy)
            write_json(root/'job_snapshot.json',job)
            secrets={}
            if not job['synthetic']:
                if MODE!='live': raise RuntimeError('Live execution is not enabled')
                secrets=json.loads((DATA/'credentials.json').read_text(encoding='utf-8'))
            for machine in job['targets']:
                target=Target(**{f.name:machine[f.name] for f in fields(Target) if f.name in machine})
                if transport_factory:
                    transport=transport_factory({},root/'.ssh')
                elif job['synthetic']:
                    transport=SyntheticTransport({},root/'.ssh')
                else:
                    credentials=secrets[machine['credential_ref']]
                    transport=Transport({r:credentials.get(r+'_password','') for r in ('os','bmc')},root/'.ssh',
                                        users={r:machine[r+'_user'] for r in ('os','bmc')},
                                        ports={r:machine.get(r+'_port',22) for r in ('os','bmc')},cipher=machine.get('ipmi_cipher',17))
                session=NodeSession(target,transport,root,job['run_id'],script,digest(script),options,rules)
                session.machine_id=machine['name']
                session.progress=lambda phase,s=session:emit(s,phase)
                sessions.append(session)
            campaign=dict(run_id=job['run_id'],job_id=job_id,project='neutrino',started=now(),finished=None,
                          tool_version=(ENGINE/'VERSION').read_text().strip(),state='PRE_RUNNING',stop_reason='',
                          cycle_mode=options.cycle_mode,channel=options.channel,limits=job['config']['limits'],
                          script_sha256=digest(script),engine_hash=job['engine_hash'],synthetic=job['synthetic'],
                          source_versions=job['source_versions'],integration_version=job['integration_version'],
                          nodes=[s.node for s in sessions])
            # PRE can install packages. The UI discloses this before job creation.
            dependencies=sessions[0].transport.local_dependencies()
            atomic_write(root/'pre_orchestrator_dependencies.txt',f'Exit: {dependencies.code}\n{dependencies.output}')
            parallel('precheck',sessions)
            if dependencies.code:
                for s in sessions:
                    s.node['blocked'].append('Controller ipmitool unavailable')
                    s.add(s.node['pre'],'ORCHESTRATOR_DEPENDENCY','ipmitool','Controller dependency failed')
                    s.finish(s.node['pre'])
            runnable=[s for s in sessions if not s.node['blocked']]
            # AUX approval covers every target in the shared power scope: no partial continuation.
            if options.cycle_mode=='aux_cycle' and len(runnable)!=len(sessions):
                runnable=[]
                reason='AUX scope incomplete after PRE; no power action permitted'
            write_reports(root,campaign)
            if not runnable:
                state='BLOCKED'; reason=reason if options.cycle_mode=='aux_cycle' else 'No runnable PRE targets'; return
            if store.get(job_id)['stop_requested']:
                state='CANCELLED'; reason='Cancelled during PRE'; return
            pre=dict(runnable_ids=[s.machine_id for s in runnable],excluded=[dict(machine_id=s.machine_id,reasons=s.node['blocked']) for s in sessions if s not in runnable],
                     findings=[dict(machine_id=s.machine_id,issues=copy.deepcopy(s.node['pre']['issues'])) for s in sessions],
                     baseline_hash=fingerprint([s.node['pre'] for s in sessions]))
            store.ready(job_id,pre,[compact(s) for s in sessions])
            campaign['state']='AWAITING_CONFIRMATION'; write_reports(root,campaign)
            while True:
                current=store.get(job_id)
                if current['stop_requested']:
                    state='CANCELLED'; reason='Cancelled before cycle confirmation'; return
                if current['state']=='RUNNING': break
                if current['state'] in TERMINAL: return
                time.sleep(.2)
            if engine_hash()!=job['engine_hash'] or fingerprint([s.node['pre'] for s in sessions])!=pre['baseline_hash']:
                raise RuntimeError('Reviewed PRE or engine changed')
            write_json(root/'confirmation.json',current['confirmation'])
            campaign['state']='RUNNING'; write_reports(root,campaign)
            parallel('start',runnable)
            began=time.monotonic(); number=0
            limits=job['config']['limits']
            while True:
                current=store.get(job_id)
                active=[s for s in runnable if s.node['active']]
                if current['stop_requested']:
                    state='INCOMPLETE'; reason='Operator requested stop after current round POST'; break
                reached=(limits['loops'] and number>=limits['loops']) or (limits['hours'] and time.monotonic()-began>=limits['hours']*3600)
                if reached:
                    state='COMPLETE' if number and len(active)==len(runnable) else 'INCOMPLETE'
                    reason='Requested limit reached' if state=='COMPLETE' else 'No cycles or one or more targets unavailable'; break
                if not active or (options.cycle_mode=='aux_cycle' and len(active)!=len(runnable)):
                    state='INCOMPLETE'; reason='Approved targets unavailable'; break
                number+=1
                parallel('one_loop',active,number)
                write_reports(root,campaign)
                store.update(job_id,health=status(campaign)['health'],nodes=[compact(s) for s in sessions])
        except Exception as exc:
            state='INCOMPLETE' if store.get(job_id).get('confirmation') else 'ERROR'
            reason=f'{type(exc).__name__}: preparation or execution failed; inspect retained evidence'
            atomic_write(root/'runner_error.txt',reason+'\n')
        finally:
            # Cleanup precedes lock release, so a new job cannot race the old worker.
            for s in sessions: s.cleanup_remote()
            done.set(); thread.join(timeout=3)
            if campaign:
                campaign.update(state=state,stop_reason=reason,finished=now())
                try: write_reports(root,campaign)
                except Exception: reason+='; final report generation failed, journal retained'
            store.finish(job_id,state,reason,nodes=[compact(s) for s in sessions],
                         health=status(campaign)['health'] if campaign else 'UNKNOWN')
            write_json(root/'job_final.json',store.get(job_id))

def recover(store,job):
    root=ARTIFACTS/job['id']; journal=root/'campaign.json'
    if journal.is_file():
        data=json.loads(journal.read_text(encoding='utf-8'))
        # Reconstruct newer per-node journals if the worker died mid-round.
        for node in data['nodes']:
            folder=root/node['key']
            pre=folder/'pre_report.json'
            if pre.exists(): node['pre']=json.loads(pre.read_text(encoding='utf-8'))
            loops=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(folder.glob('loop*/report.json'))]
            if loops: node['loops']=loops
            node['completed']=sum(bool(r.get('post_complete')) for r in node['loops'])
        data.update(state='INCOMPLETE',finished=now(),stop_reason='Worker died; commands are never replayed')
        write_reports(root,data)
    store.finish(job['id'],'INCOMPLETE','Worker died; retained evidence, no automatic resume',health='UNKNOWN')

def service():
    store=Store(); children={}
    with process_lock(RUNTIME/'runner-service.lock'):
        atomic_write(RUNTIME/'service-pid.txt',str(os.getpid()))
        print('PA Cycle Lab runner ready',flush=True)
        while True:
            for job in store.jobs():
                jid=job['id']
                if job['state']=='CREATED' and (jid not in children or children[jid].poll() is not None):
                    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
                    children[jid]=subprocess.Popen([sys.executable,'-m','integration.runner','--job',jid],cwd=ROOT,
                                                    creationflags=flags,start_new_session=os.name!='nt')
                elif job['state'] not in TERMINAL and job['state']!='CREATED' and not alive(jid):
                    recover(store,job)
            children={k:p for k,p in children.items() if p.poll() is None}
            atomic_write(RUNTIME/'service-heartbeat.txt',str(time.time()))
            time.sleep(.5)

if __name__=='__main__':
    if len(sys.argv)==3 and sys.argv[1]=='--job': run_job(Store(),sys.argv[2])
    else: service()
