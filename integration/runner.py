"""Independent service and child workers. Web restarts cannot replay power actions."""
from concurrent.futures import ThreadPoolExecutor, wait as wait_futures, FIRST_COMPLETED
from collections import deque
from contextlib import contextmanager
from dataclasses import fields
from pathlib import Path
from types import SimpleNamespace
import copy
import json
import os
import signal
import sqlite3
import subprocess
import sys
import threading
import time
import uuid

from .settings import ROOT, DATA, RUNTIME, ARTIFACTS, ENGINE, MODE
from .store import Store, TERMINAL, fingerprint, engine_hash
from .synthetic import SyntheticTransport
from .credentials import load_credentials
from cycle_core import Target, digest, now, issue_key, node_records, records_health, write_json, atomic_write, EvidencePersistenceError
from .domain import CoordinatedSession as NodeSession, Domain
from cycle_report import write_reports, status
from cycle_transport import Transport
from console_log import ConsoleLog

def save_reports(root, campaign):
    try: write_reports(root,campaign)
    except Exception as exc:
        raise EvidencePersistenceError('Evidence persistence failure: report generation') from exc

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
    records=node_records(n)
    seen={issue_key(i) for i in n['pre']['issues']}
    first=0
    for record in records[1:]:
        keys={issue_key(i) for i in record['issues']}
        first=len(keys-seen); seen|=keys
    record=records[-1]
    pending=not record.get('finished')
    return dict(machine_id=session.machine_id,key=n['key'],stage=n['stage'] or record['phase'],
                loop=record.get('loop',0),completed=n['completed'],attempts=n['attempts'],
                boot_confirmed=n.get('boot_confirmed',0),valid_cycles=n.get('valid_cycles',0),
                cumulative_health=records_health(records),
                health='PENDING' if pending else record['status'],updated_at=getattr(session,'last_activity',time.time()),
                first_this_round=None if pending else first,unique_issues=len(seen),
                coverage=n.get('coverage','EXERCISED' if n['attempts'] else 'NOT_EXERCISED'),
                coverage_reason=n.get('coverage_reason',''),
                stop_reason=n['stop_reason'],blocked=n['blocked'])

def _inventory_secrets(names):
    """Return {name: {os_password, bmc_password}} from the live data.json inventory.

    Job snapshots are redacted by snapshot_target(), so the worker must re-derive
    secrets from the same source the web tier used, not from the stored job."""
    from .targets import inventory
    raw=json.loads((DATA/'data.json').read_text(encoding='utf-8'))
    shim=SimpleNamespace(machines=raw.get('machines',{}),projects=raw.get('projects',{}))
    by_name={t['name']:t for t in inventory(shim)}
    wanted=set(names)
    return {t['name']:{'os_password':t.get('os_password',''),'bmc_password':t.get('bmc_password','')}
            for t in by_name.values() if t['name'] in wanted}


def run_job(store, job_id, transport_factory=None):
    with process_lock(RUNTIME/(job_id+'.lock')):
        job=store.claim(job_id,uuid.uuid4().hex)
        if not job: return
        root=ARTIFACTS/job_id
        sessions=[]; done=threading.Event(); state='ERROR'; reason='Preparation failed'; campaign=None
        # Set once the campaign and its target list are known; observe() writes through it.
        console=None
        # All writes for event callbacks are serialized; reports are written between rounds.
        mutex=threading.RLock()
        persistence_failed=threading.Event()
        def persistence_guard():
            if persistence_failed.is_set(): raise EvidencePersistenceError('Evidence persistence failure')
            try: store.touch(job_id)
            except sqlite3.Error as exc:
                persistence_failed.set()
                raise EvidencePersistenceError('Evidence persistence failure: SQLite') from exc
        def emit(session, phase):
            with mutex:
                session.last_activity=time.time()
                snap=compact(session)
                persistence_guard()
                try:
                    store.node_update(job_id,snap)
                except sqlite3.Error as exc:
                    persistence_failed.set()
                    raise EvidencePersistenceError('Evidence persistence failure: event journal') from exc
        def observe(session, event, secret_values):
            try:
                store.append_event(job_id,dict(event,machine_id=session.machine_id),secrets=secret_values)
            except Exception as exc:
                persistence_failed.set()
                raise EvidencePersistenceError('Evidence persistence failure: structured event journal') from exc
            # The transcript is derived from the same event; it never gates the journal.
            if console is not None:
                try:
                    record=dict(event,machine_id=session.machine_id)
                    if record.get('machine_id') or record.get('node'):
                        console.node_event(record)
                    else:
                        console.job_event(record)
                except Exception:
                    pass
        def heartbeat():
            while not done.wait(2):
                try: persistence_guard()
                except EvidencePersistenceError: return
        thread=threading.Thread(target=heartbeat,daemon=True); thread.start()
        def stop_signal(*_): store.stop(job_id,'runner-signal')
        if threading.current_thread() is threading.main_thread():
            signal.signal(signal.SIGTERM,stop_signal); signal.signal(signal.SIGINT,stop_signal)
        def parallel(method, selected, *args):
            def invoke(session):
                session.stage(method.upper())
                try: getattr(session,method)(*args)
                except Exception as exc:
                    if isinstance(exc,(EvidencePersistenceError,sqlite3.Error,OSError)):
                        persistence_failed.set(); raise EvidencePersistenceError("Evidence persistence failure") from exc
                    session.node.update(active=False,stop_reason=f'{method}: {type(exc).__name__}')
                    record=session.node.get('start',session.node['pre'])
                    session.add(record,'EXECUTION_ERROR',method,f'{type(exc).__name__}; retained evidence')
                    if method=='precheck': session.node['blocked'].append('PRE execution failed')
                    session.finish(record)
                emit(session,method.upper()+'_FINISHED')
            with ThreadPoolExecutor(max_workers=min(job['config'].get('parallelism',8),len(selected) or 1)) as pool:
                list(pool.map(invoke,selected))
        try:
            root.mkdir(exist_ok=True)
            if engine_hash()!=job['engine_hash']: raise RuntimeError('Engine changed since job creation')
            options=SimpleNamespace(**{k:v for k,v in job['config'].items() if k in {'cycle_mode','channel','boot_timeout'}},
                                    poll_interval=0.05 if job['synthetic'] else 5,memory_min_ratio=.9,loop_limit=job['config']['limits']['loops'])
            frozen=job.get('profile_snapshot')
            rules=[]  # V1 policy exceptions are explicitly inactive; PRE-relative classification only.
            if frozen:
                if fingerprint({k:v for k,v in frozen.items() if k!='content_hash'})!=frozen['content_hash']:
                    raise RuntimeError('Frozen profile content hash mismatch')
                script=frozen['checker'].encode('utf-8');policy=frozen['policy']
                options.memory_min_ratio=frozen['package']['thresholds']['memory_min_ratio']
            else:
                # No frozen snapshot: select this project's checker script; never fall back.
                from .profiles import checker_script_path, CheckerMissing, checker_missing_message
                path=checker_script_path(job.get('project'))
                if path is None: raise CheckerMissing(checker_missing_message(job.get('project')))
                script=path.read_bytes().replace(b'\r\n',b'\n')
                policy=(ENGINE/'issue_policy.md').read_text(encoding='utf-8')
            atomic_write(root/'neutrino_config.snapshot.sh',script.decode())
            atomic_write(root/'issue_policy.snapshot.md',policy)
            write_json(root/'job_snapshot.json',job)
            secrets={}; provider=None
            if not job['synthetic']:
                if MODE!='live': raise RuntimeError('Live execution is not enabled')
                from .authorization import configured_provider
                provider=configured_provider()
                if provider is None or not provider.approve_dispatch(job): raise RuntimeError('Live provider did not authorize immutable run')
                if not callable(getattr(provider,'verify_identity',None)): raise RuntimeError('Live provider must verify hardware identity and trust')
                if frozen:
                    from .profiles import default_package
                    action_key=options.cycle_mode+':'+options.channel
                    action=frozen['package']['actions'][action_key]
                    if action!=default_package()['actions'][action_key]:
                        verify=getattr(provider,'verify_action_scope',None)
                        if not callable(verify) or not all(verify(job,m,action) for m in job['targets']):
                            raise RuntimeError('Custom profile action requires explicit provider verification of selector and affected scope')
                # Credentials come straight from inventory (internal lab): no credential_ref
                # indirection. The persisted job targets are redacted by snapshot_target(),
                # so re-read passwords from data.json here instead of trusting job['targets'].
                secrets=_inventory_secrets(m['name'] for m in job['targets'])
            for machine in job['targets']:
                target=Target(**{f.name:machine[f.name] for f in fields(Target) if f.name in machine})
                if transport_factory:
                    transport=transport_factory({},root/'.ssh')
                elif job['synthetic']:
                    transport=SyntheticTransport({},root/'.ssh')
                else:
                    credentials=secrets[machine['name']]
                    transport=Transport({r:credentials.get(r+'_password','') for r in ('os','bmc')},root/'.ssh',
                                        users={r:machine[r+'_user'] for r in ('os','bmc')},
                                        ports={r:machine.get(r+'_port',22) for r in ('os','bmc')},cipher=machine.get('ipmi_cipher',17),ipmi_port=machine.get('ipmi_port',623))
                session=NodeSession(target,transport,root,job['run_id'],script,digest(script),options,rules)
                session.machine_id=machine['name']
                session.store=store; session.job_id=job_id; session.snapshot=machine
                session.identity_provider=provider
                session.profile_snapshot=frozen
                secret_values=tuple(v for item in secrets.values() if isinstance(item,dict) for v in item.values() if isinstance(v,str))
                secret_values+=tuple(getattr(transport,'credentials',{}).values())
                session.observer=lambda event,s=session,values=secret_values:observe(s,event,values)
                session.dispatch_guard=persistence_guard
                session.progress=lambda phase,s=session:emit(s,phase)
                sessions.append(session)
            groups={}
            for session in sessions:
                m=session.snapshot
                # Every node is independently powered: no shared power/aux domain
                # coordination. Grouping each node under its own unique name keeps
                # each node its own leader so every node dispatches to its own BMC.
                # (Previously an unset aux_domain/power_domain collapsed all nodes
                # into one group, so only the leader dispatched and peers silently
                # skipped their own power action.)
                key=m['name']
                groups.setdefault(key,[]).append(session)
            domains=[Domain(key, members, store, job_id) for key,members in groups.items()]
            controllers={}
            for session in sessions:
                key=session.snapshot.get('controller_id') or session.snapshot.get('bmc_ip')
                controllers.setdefault(key,[]).append(session)
            for key,members in controllers.items():
                if len(members)>1:
                    collector=Domain(key,members,store,job_id)
                    for session in members: session.controller_collector=collector
            for domain in domains:
                for session in domain.sessions: session.domain=domain
                if job['synthetic'] and len(domain.sessions)>1:
                    transport=domain.sessions[0].transport
                    transport.affected_targets=[s.target for s in domain.sessions]
                    for session in domain.sessions: session.transport=transport
            campaign=dict(run_id=job['run_id'],job_id=job_id,project=job['project'],started=now(),finished=None,
                          tool_version=(ENGINE/'VERSION').read_text().strip(),state='PRE_RUNNING',stop_reason='',
                          cycle_mode=options.cycle_mode,channel=options.channel,limits=job['config']['limits'],
                          script_sha256=digest(script),engine_hash=job['engine_hash'],synthetic=job['synthetic'],
                          source_versions=job['source_versions'],integration_version=job['integration_version'],
                          policy_exceptions='NOT_ACTIVE_IN_V1',
                          nodes=[s.node for s in sessions])
            # Start the operator transcript now that targets are known. The report
            # renders this file in its Console panel.
            try:
                targets=[s.node.get('display_name') or s.node.get('key') for s in sessions]
                console=ConsoleLog(root/'console.log',targets)
                console.header(campaign)
            except Exception:
                console=None
            # PRE can install packages. The UI discloses this before job creation.
            store.append_event(job_id,dict(phase='PRE',level='PRE',event_type='CONTROLLER_DEPENDENCY_CHECK',message='Checking Controller dependencies'))
            dependencies=sessions[0].transport.local_dependencies()
            atomic_write(root/'pre_orchestrator_dependencies.txt',f'Exit: {dependencies.code}\n{dependencies.output}')
            parallel('precheck',sessions)
            if dependencies.code:
                for s in sessions:
                    s.node['blocked'].append('Controller ipmitool unavailable')
                    s.add(s.node['pre'],'ORCHESTRATOR_DEPENDENCY','ipmitool','Controller dependency failed')
                    s.finish(s.node['pre'])
            runnable=[s for s in sessions if not s.node['blocked']]
            for d in domains:
                if any(s not in runnable for s in d.sessions):
                    blocked_peers=[s.snapshot.get('display_name',s.machine_id) for s in d.sessions if s not in runnable]
                    for s in d.sessions:
                        if not s.node['blocked']:
                            s.node['blocked'].append('Shared action domain '+str(d.key)+' blocked by: '+', '.join(blocked_peers))
                    runnable=[s for s in runnable if s not in d.sessions]
            # AUX approval covers every target in the shared power scope: no partial continuation.
            if options.cycle_mode=='aux_cycle' and len(runnable)!=len(sessions):
                runnable=[]
                reason='AUX scope incomplete after PRE; no power action permitted'
                for s in sessions:
                    if not s.node['blocked']:s.node['blocked'].append(reason)
            save_reports(root,campaign)

            if store.get(job_id)['stop_requested']:
                state='CANCELLED'; reason='Cancelled during PRE'; return
            pre=dict(runnable_ids=[s.machine_id for s in runnable],excluded=[dict(machine_id=s.machine_id,reasons=s.node['blocked']) for s in sessions if s not in runnable],
                     findings=[dict(machine_id=s.machine_id,issues=copy.deepcopy(s.node['pre']['issues'])) for s in sessions],
                     baseline_hash=fingerprint([s.node['pre'] for s in sessions]))
            store.ready(job_id,pre,[compact(s) for s in sessions])
            if not runnable:
                state='BLOCKED'; reason='No complete runnable action domains after PRE'; return
            campaign['state']='AWAITING_CONFIRMATION'; save_reports(root,campaign)
            while True:
                persistence_guard()
                current=store.get(job_id)
                if current['stop_requested']:
                    state='CANCELLED'; reason='Cancelled before cycle confirmation'; return
                if current['state']=='RUNNING': break
                if current['state'] in TERMINAL: return
                time.sleep(.2)
            if engine_hash()!=job['engine_hash'] or fingerprint([s.node['pre'] for s in sessions])!=pre['baseline_hash']:
                raise RuntimeError('Reviewed PRE or engine changed')
            write_json(root/'confirmation.json',current['confirmation'])
            campaign['state']='RUNNING'; save_reports(root,campaign)
            parallel('start',runnable)
            began=time.monotonic()
            limits=job['config']['limits']
            # Hours are a whole-run dispatch budget measured after START. Recovery
            # and POST for an already dispatched action are allowed to finish.
            deadline=began+limits['hours']*3600 if limits['hours'] else None
            budget_open=lambda:deadline is None or time.monotonic()<deadline
            rounds={d:0 for d in domains}
            ready=deque(d for d in domains if all(s in runnable and s.node['active'] for s in d.sessions))
            for d in domains: d.dispatch_allowed=budget_open
            def drive_round(domain, number):
                persistence_guard()
                if store.get(job_id)['stop_requested'] or not budget_open(): return
                members=domain.sessions
                if not all(s.node['active'] for s in members): return
                domain.new_round()
                if len(members)==1:
                    members[0].one_loop(number); emit(members[0],'POST_FINISHED')
                else:
                    with ThreadPoolExecutor(max_workers=len(members)) as group:
                        list(group.map(lambda s:s.one_loop(number),members))
                    for s in members: emit(s,'POST_FINISHED')
                if console is not None:
                    for s in members:
                        try:
                            loops=s.node.get('loops') or []
                            if loops: console.loop_result(s.node.get('display_name') or s.node.get('key'),loops[-1])
                        except Exception:
                            pass
                try:
                    with mutex: save_reports(root,campaign)
                except EvidencePersistenceError:
                    persistence_failed.set()
                    raise
            with ThreadPoolExecutor(max_workers=job['config'].get('parallelism',8)) as pool:
                running={}
                while ready or running:
                    current=store.get(job_id)
                    if current['stop_requested'] or not budget_open(): ready.clear()
                    while ready and len(running)<job['config'].get('parallelism',8):
                        domain=ready.popleft()
                        rounds[domain]+=1
                        running[pool.submit(drive_round,domain,rounds[domain])]=domain
                    if not running: break
                    completed,_=wait_futures(running,timeout=30,return_when=FIRST_COMPLETED)
                    if not completed:
                        # A long silence must be attributable to a phase, never
                        # mistaken for a hang. Print where each node currently is.
                        if console is not None:
                            console.still_running()
                        continue
                    for future in completed:
                        domain=running.pop(future);future.result()
                        if (budget_open() and not store.get(job_id)['stop_requested']
                            and (not limits['loops'] or rounds[domain]<limits['loops'])
                            and all(s.node['active'] for s in domain.sessions)):
                            ready.append(domain)
            current=store.get(job_id)
            for session in sessions:
                issued=any(a.get('state') not in (None,'NOT_ISSUED') for r in session.node['loops'] for a in r.get('action',[]))
                session.node['coverage']='EXERCISED' if issued else 'NOT_EXERCISED'
                session.node['coverage_reason']='TIME_BUDGET_EXHAUSTED' if not budget_open() else ('STOP_REQUESTED' if current['stop_requested'] else '')
            covered=all(s.node['coverage']=='EXERCISED' for s in runnable)
            state='COMPLETE' if not current['stop_requested'] and covered and all(s.node['active'] for s in runnable) else 'INCOMPLETE'
            reason=('Requested whole-run limit reached' if state=='COMPLETE' else
                    'TIME_BUDGET_EXHAUSTED; one or more targets NOT_EXERCISED' if not budget_open() and not covered else
                    'Stopped or one or more domains unavailable')
            save_reports(root,campaign)

        except Exception as exc:
            state='INCOMPLETE' if campaign and campaign['state']=='RUNNING' else 'ERROR'
            evidence_failure=isinstance(exc,(EvidencePersistenceError,OSError,sqlite3.Error)) or persistence_failed.is_set()
            reason=('Evidence persistence failure: ' if evidence_failure else 'Execution failed: ')+type(exc).__name__
            try: store.append_event(job_id,dict(phase='JOB',level='ERROR',event_type='WORKER_ERROR',message='Worker execution error; no command replay',detail=reason))
            except Exception: pass
            if evidence_failure: persistence_failed.set()
            try: atomic_write(root/'runner_error.txt',reason+'\n')
            except Exception: pass
        finally:
            done.set(); thread.join(timeout=3)
            for s in sessions: s.cleanup_remote()
            if persistence_failed.is_set():
                state='INCOMPLETE' if campaign and campaign['state']=='RUNNING' else 'ERROR'
                reason='Evidence persistence failure; commands are never replayed'
            try:
                uncertain=any(a.get('outcome')=='DISPATCH_INTENT' for a in store.actions(job_id)) or any(a.get('state') in {'SENT','RESPONSE_LOST'} and not r.get('valid_cycle') for s in sessions for r in s.node['loops'] for a in r.get('action',[]))
                if uncertain or (persistence_failed.is_set() and store.actions(job_id)):
                    state='RECONCILIATION_REQUIRED'
                if campaign:
                    campaign.update(state=state,stop_reason=reason,finished=now())
                    save_reports(root,campaign)
                # Evidence must be saved before terminal publication / lock release.
                final=dict(store.get(job_id),state=state,stop_reason=reason,
                           nodes=[compact(s) for s in sessions],health=status(campaign)['health'] if campaign else 'UNKNOWN')
                write_json(root/'job_final.json',final)
            except Exception:
                state='RECONCILIATION_REQUIRED' if store.actions(job_id) else 'ERROR'
                reason='Evidence persistence failure; final report/snapshot unavailable; commands are never replayed'
                persistence_failed.set()
                if campaign:
                    campaign.update(state=state,stop_reason=reason)
                    try: save_reports(root,campaign)
                    except EvidencePersistenceError: pass
            try:
                uncertain=any(a.get('outcome')=='DISPATCH_INTENT' for a in store.actions(job_id)) or any(a.get('state') in {'SENT','RESPONSE_LOST'} and not r.get('valid_cycle') for s in sessions for r in s.node['loops'] for a in r.get('action',[]))
                if uncertain or (persistence_failed.is_set() and store.actions(job_id)): state='RECONCILIATION_REQUIRED'
                store.finish(job_id,state,reason,nodes=[compact(s) for s in sessions],
                             health='UNKNOWN' if persistence_failed.is_set() else status(campaign)['health'] if campaign else 'UNKNOWN')
            except sqlite3.Error:
                # Keep reservation and nonterminal DB state. Recovery never replays a claimed job.
                print('Evidence persistence failure: SQLite finalization unavailable; reservation retained',flush=True)
                reason='Evidence persistence failure: SQLite finalization unavailable; reservation retained; no replay'
                if campaign:
                    campaign.update(state='INCOMPLETE',stop_reason=reason)
                    try:
                        save_reports(root,campaign)
                        write_json(root/'job_final.json',dict(id=job_id,state='INCOMPLETE',health='UNKNOWN',stop_reason=reason))
                    except Exception: pass


def recover(store,job):
    reason='Worker died; retained evidence, no automatic resume'
    store.update(job['id'],event=dict(phase='WORKER_LOST',event_type='WORKER_LOST',level='ERROR',
                                    message='Worker lost; recovery retains evidence and never replays commands'))
    try:
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
            save_reports(root,data)

    except Exception:
        reason='Evidence persistence failure during crash recovery; no automatic resume'
    store.finish(job['id'],'RECONCILIATION_REQUIRED',reason+'; reservations retained for explicit reconciliation',health='UNKNOWN')


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
