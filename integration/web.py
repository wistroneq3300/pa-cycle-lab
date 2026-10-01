"""PA copy plus Cycle API. Safe default is loopback SYNTHETIC operation."""
from contextlib import asynccontextmanager
import base64
import copy
import hmac
import ipaddress
import json
import os
from pathlib import Path
import re
import sys
import sqlite3
import time
from urllib.parse import unquote
from fastapi import APIRouter, HTTPException, Request, Query, Depends
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool
from .settings import ROOT, DATA, MODE, ARTIFACTS, RUNTIME
from .inventory import synchronized, mutate, local_write, validate_machine
from .boundary import category
from . import control as manual
from .credentials import load_credentials
from .store import Store, Conflict, SAFE_FIELDS, TERMINAL, scopes, target_reason, validate_request, fingerprint
from cycle_core import EvidencePersistenceError
from .events import log_line
from .targets import inventory as node_inventory, resolve_target, resolve_control_target, public
from .authorization import authorize, configured_provider
from . import coordinator

sys.path.insert(0,str(ROOT/'app'))
import main as pa

if MODE=='synthetic':
    pa.ping_check=lambda *a,**k:False
    pa._kick_status_scan=lambda *a,**k:None
app=pa.app
app.title='PA Server Manager Next - Cycle Integration'
store=Store()
# One ordering for inventory mutation and snapshot/reservation acquisition.
from . import inventory as inventory_module
pa._DATA_LOCK=inventory_module.MUTEX
coordinator.install(pa,lambda:store)
from . import legacy_observation
legacy_observation.install(pa,lambda:store,lambda:getattr(app.state,'cycle_provider',None) or configured_provider())
from . import project_access
project_access.install(pa,app)
pa._observation_status=lambda node_id:store.observation_status(node_id)
from . import inventory as inventory_mutations
# Snapshot creation and every original Next transaction must share the same
# lock, including probe-then-commit routes that do not use local_write.
inventory_mutations.MUTEX=pa._DATA_LOCK

def access(request:Request):
    project=request.path_params.get('project')
    from .authorization import authenticate
    request.state.actor=authorize(request,project,'read' if request.method=='GET' else 'operate') if project is not None else authenticate(request)

router=APIRouter(dependencies=[Depends(access)])

# The copied PA inventory is process-local. Enforce one Web process per instance;
# the independent scheduler/workers coordinate through SQLite reservations.
@asynccontextmanager
async def web_lifespan(app):
    from .runner import process_lock
    with process_lock(RUNTIME/'web-service.lock'):
        yield

app.router.lifespan_context=web_lifespan

# Serialize existing local project/link/reorder writes with snapshot creation.
for route in app.routes:
    local_mutation = getattr(route,'path','').startswith(('/api/projects','/api/machines')) or getattr(route,'path','') in {'/api/links','/api/rack/passive'}
    observation = getattr(route,'path','').endswith(('/probe-bmc','/probe','/ping','/change-os-ip','/change-bmc-ip'))
    if local_mutation and not observation and getattr(route,'methods',set()) & {'POST','PATCH','DELETE'} and hasattr(route,'dependant'):
        route.dependant.call=local_write(pa,route.dependant.call)

def fail(exc):
    if isinstance(exc,Conflict): return HTTPException(409,str(exc))
    if isinstance(exc,KeyError): return HTTPException(404,'找不到專案、機台或任務')
    return HTTPException(422,str(exc))

def actor(request):
    return getattr(request.state,'actor','local-operator')

def scoped(project,job_id):
    try: job=store.get(job_id)
    except KeyError as exc: raise fail(exc)
    if job['project']!=project: raise HTTPException(404,'找不到此專案的任務')
    return job

def project_targets(project):
    if project not in pa.projects: raise HTTPException(404,'找不到專案')
    profile=pa.projects[project].get('cycle_profile')
    from .profiles import resolve as resolve_profile
    with store.tx(write=False) as db:
        frozen=resolve_profile(db,pa.projects[project].get('project_id'),profile)
    if frozen: profile=frozen['package']['profile_id']
    owners=store.lock_owners(); rows=[]
    all_targets=node_inventory(pa)
    for m in all_targets:
        name=m['name']
        if m.get('project')!=project: continue
        safe={k:copy.deepcopy(m[k]) for k in SAFE_FIELDS if k in m}; safe['name']=name
        reasons=target_reason(safe,profile,require_profile=not bool(frozen))
        if safe.get('node_id') and safe.get('mapping_status')!='confirmed': reasons.append('Physical slot/action scope mapping needs confirmation')
        for role in ('os','bmc'):
            addr=safe.get(role+'_ip')
            if addr and any(other['name']!=name and addr in (other.get('os_ip'),other.get('bmc_ip')) and not (role=='bmc' and safe.get('controller_id') and safe.get('controller_id')==other.get('controller_id')) for other in all_targets):
                reasons.append('Inventory endpoint 重複：'+role)
        try: occupied=sorted({owners[k] for k in scopes(safe) if k in owners})
        except ValueError: occupied=[]
        if occupied: reasons.append('控制範圍已被占用：'+', '.join(occupied))
        rows.append(dict(**safe,machine_id=name,reasons=reasons,occupied_by=occupied,
                         os_status='SYNTHETIC' if MODE=='synthetic' else 'PRE 待驗證',
                         bmc_status='SYNTHETIC' if MODE=='synthetic' else 'PRE 待驗證'))
    return dict(profile=profile,profile_detail={k:v for k,v in frozen.items() if k not in {'checker','policy'}} if frozen else None,targets=rows,mode=MODE)

@router.get('/api/cycle/status')
def cycle_status():
    try: heartbeat=float((RUNTIME/'service-heartbeat.txt').read_text())
    except (OSError,ValueError): heartbeat=0
    return dict(mode=MODE,web_pid=os.getpid(),runner_available=time.time()-heartbeat<10,
                single_operator=not bool(os.environ.get('CYCLE_USERS_JSON')))

@router.get('/api/projects/{project}/cycle/targets')
def targets(project:str): return project_targets(project)

@router.post('/api/projects/{project}/cycle/jobs')
@synchronized
def create_job(project:str,body:dict,request:Request):
    try:
        config=validate_request(body)
        # Resolve idempotent retries before mutable inventory / lock checks.
        for existing in store.jobs(project):
            if existing['config']['idempotency_key']==config['idempotency_key']:
                if fingerprint(existing['config'])!=fingerprint(config): raise Conflict('重試識別碼已用於不同設定')
                return existing
        candidates=project_targets(project)
        by_id={t['machine_id']:t for t in candidates['targets']}
        chosen=[]
        for name in config['machine_ids']:
            if name not in by_id: raise ValueError('目標不存在或不屬於此專案：'+name)
            row=by_id[name]
            if row['reasons']: raise Conflict(name+'：'+'；'.join(row['reasons']))
            chosen.append({k:row[k] for k in SAFE_FIELDS if k in row})
        endpoints=[str(ipaddress.ip_address(m['os_ip'])) for m in chosen]
        identities=[(m['tray'].lower(),m['node'].lower()) for m in chosen]
        if len(set(endpoints))!=len(endpoints) or len(set(identities))!=len(identities):
            raise ValueError('選取目標有重複 endpoint 或 tray/node')
        if config['cycle_mode']=='power_cycle' or config['channel']=='outband':
            for machine in chosen:
                if MODE=='live':
                    peers=[m for m in node_inventory(pa) if m.get('controller_id')==machine.get('controller_id') or m.get('bmc_ip')==machine.get('bmc_ip')]
                    if not machine.get('controller_id') or len(peers)>1 or not machine.get('capabilities',{}).get('independent_power'):
                        raise Conflict('Independent controller/action scope required; shared host selector is not implemented for live dispatch')
                impacted={m['name'] for m in node_inventory(pa) if m.get('power_domain')==machine['power_domain']}
                if len(impacted)>1:
                    if not impacted.issubset(set(config['machine_ids'])): raise Conflict('Select all affected nodes in power domain')
                    if MODE!='synthetic' or not all(m.get('capabilities',{}).get('shared_power')=='synthetic-confirmed' for m in chosen if m['name'] in impacted): raise Conflict('Shared action selector not validated for live hardware')
        if config['cycle_mode']=='aux_cycle':
            for machine in chosen:
                if MODE=='live':
                    peers=[m for m in node_inventory(pa) if m.get('controller_id')==machine.get('controller_id') or m.get('bmc_ip')==machine.get('bmc_ip')]
                    if not machine.get('controller_id') or len(peers)>1 or not machine.get('capabilities',{}).get('independent_aux'):
                        raise Conflict('Live AUX requires a verified independent standby-power adapter and controller')
                domain=machine.get('aux_domain')
                if not domain or not machine.get('aux_scope_confirmed'): raise Conflict('AUX 實體影響範圍尚未確認')
                impacted={m['name'] for m in node_inventory(pa) if m.get('aux_domain')==domain}
                if not impacted.issubset(set(config['machine_ids'])):
                    raise Conflict('AUX 必須包含完整影響範圍：'+', '.join(sorted(impacted)))
            # Shared AUX needs power-domain orchestration, absent in upstream V1.
            domains=[m['aux_domain'] for m in chosen]
            if len(set(domains))!=len(domains) and (MODE!='synthetic' or not all(m.get('capabilities',{}).get('shared_power')=='synthetic-confirmed' for m in chosen)):
                raise Conflict('V1 尚未驗證共享 AUX domain 的單次派送；此範圍暫不允許啟動')
        from .profiles import resolve as resolve_profile
        # Activation and run creation use the same transaction; no mutable path
        # is handed to the worker. Later activations affect only future runs.
        with store.tx() as db:
            project_data=pa.projects[project]
            frozen=resolve_profile(db,project_data.get('project_id'),project_data.get('cycle_profile'))
            if not frozen or frozen['package']['profile_id']!=config['cycle_profile']:
                raise Conflict('Selected profile differs from the activated Project profile')
            return store.create(project,config,chosen,actor(request),profile_snapshot=frozen)
    except (ValueError,KeyError) as exc: raise fail(exc)

@router.get('/api/projects/{project}/cycle/jobs')
def jobs(project:str,offset:int=Query(0,ge=0),limit:int=Query(50,ge=1,le=100)): return {'jobs':store.jobs_page([project],offset,limit)}

@router.get('/api/projects/{project}/cycle/jobs/{job_id}')
def get_job(project:str,job_id:str): return scoped(project,job_id)

@router.post('/api/projects/{project}/cycle/jobs/{job_id}/confirm')
@synchronized
def confirm(project:str,job_id:str,body:dict,request:Request):
    job=scoped(project,job_id)
    for target in job['targets']:
        if target.get('revision'):
            try: resolve_target(pa,target['name'],target['revision'])
            except (ValueError,KeyError) as exc: raise fail(exc)
    try: return store.confirm(job_id,body.get('version'),body.get('machine_ids'),actor(request))
    except (ValueError,KeyError) as exc: raise fail(exc)

@router.post('/api/projects/{project}/cycle/jobs/{job_id}/stop')
def stop(project:str,job_id:str,request:Request):
    scoped(project,job_id)
    return store.stop(job_id,actor(request))

@router.get('/api/projects/{project}/cycle/jobs/{job_id}/reconciliation')
def reconciliation_review(project:str,job_id:str):
    scoped(project,job_id)
    actions=store.actions(job_id)
    return dict(actions=actions,reviewed_actions_hash=fingerprint(actions))

@router.post('/api/projects/{project}/cycle/jobs/{job_id}/reconcile')
def reconcile_job(project:str,job_id:str,body:dict,request:Request):
    from .runner import process_lock
    from .authorization import configured_provider
    job=scoped(project,job_id)
    authorize(request,project,'reconcile')
    reason=body.get('reason','')
    if not isinstance(reason,str) or not 10<=len(reason)<=500: raise HTTPException(422,'A reviewed reconciliation reason is required')
    try:
        with process_lock(RUNTIME/(job_id+'.lock')):
            if not job['synthetic']:
                provider=getattr(app.state,'cycle_provider',None) or configured_provider()
                if not provider or not provider.verify_reconciliation(job,store.actions(job_id)):
                    raise HTTPException(409,'Provider must verify local subprocesses and hardware scope using read-only observations')
            return store.reconcile(job_id,body.get('reviewed_actions_hash'),actor(request),reason)
    except (OSError,BlockingIOError): raise HTTPException(409,'Worker still owns the scope or evidence storage unavailable')
    except ValueError as exc: raise fail(exc)

@router.get('/api/projects/{project}/cycle/jobs/{job_id}/events')
def events(project:str,job_id:str,after:int=Query(0,ge=0,le=9223372036854775807),limit:int=Query(500,ge=1,le=500),
           before:int|None=Query(None,ge=1,le=9223372036854775807),tail:bool=False,machine_id:str|None=Query(None,max_length=128),
           errors_only:bool=False,search:str=Query('',max_length=200)):
    scoped(project,job_id)
    page=store.event_page(job_id,after,limit,before,tail,machine_id,errors_only,search)
    for event in page['events']: secure_event_evidence(job_id,event)
    return JSONResponse(page,headers={'Cache-Control':'no-store'})


def secure_event_evidence(job_id,event):
    if event.get('evidence'):
        try: artifact_path(job_id,event['evidence'])
        except HTTPException: event.pop('evidence',None)
    return event


@router.get('/api/projects/{project}/cycle/jobs/{job_id}/events/download')
def download_events(project:str,job_id:str):
    job=scoped(project,job_id)
    snapshot=store.event_page(job_id,tail=True,limit=1)['next_sequence']
    event_store=store
    def stream():
        yield f"Cycle Live Console | Job {job_id} | {'SYNTHETIC: no hardware operated' if job['synthetic'] else 'LIVE'} | retained events through #{snapshot}\n"
        after=0
        while after<snapshot:
            page=event_store.event_page(job_id,after,until=snapshot)
            if not page['events']: break
            for event in page['events']: yield log_line(secure_event_evidence(job_id,event))
            after=page['next_sequence']
    return StreamingResponse(stream(),media_type='text/plain; charset=utf-8',
                             headers={'Content-Disposition':f'attachment; filename="cycle-{job_id}.log"',
                                      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})

def public_artifact(path):
    return not any(p.startswith('.') or any(word in p.lower() for word in ('credential','password','secret','private_key','id_rsa','id_ed25519')) for p in Path(path).parts)


def artifact_path(job_id,path):
    base=(ARTIFACTS/job_id).resolve()
    candidate=(base/path).resolve()
    if not candidate.is_relative_to(base) or not public_artifact(path) or not candidate.is_file():
        raise HTTPException(404,'找不到報告檔案')
    return candidate

@router.get('/api/projects/{project}/cycle/jobs/{job_id}/artifacts')
def artifacts(project:str,job_id:str):
    job=scoped(project,job_id)
    base=ARTIFACTS/job_id
    files=[p.relative_to(base).as_posix() for p in sorted(base.rglob('*')) if p.is_file()
                     and public_artifact(p.relative_to(base))
                     and p.resolve().is_relative_to(base.resolve())]
    import hashlib
    indexed=store.artifact_index(job_id)
    manifest=[];changed=[]
    for path in files:
        file=artifact_path(job_id,path)
        artifact_id=fingerprint(dict(job=job_id,path=path))
        def signature():
            stat=file.stat()
            return str((stat.st_dev,stat.st_ino,stat.st_size,stat.st_mtime_ns,stat.st_ctime_ns))
        before=signature()
        cached=indexed.get(artifact_id)
        if cached and cached[0]==before:
            manifest.append(cached[1]);continue
        digest=hashlib.sha256()
        with file.open('rb') as source:
            for chunk in iter(lambda:source.read(1024*1024),b''): digest.update(chunk)
        if signature()!=before: raise HTTPException(409,'Evidence is being written; retry manifest')
        item=dict(artifact_id=artifact_id,path=path,size=file.stat().st_size,sha256=digest.hexdigest(),
                  engine_hash=job['engine_hash'],
                  kind='html-report' if file.suffix=='.html' else 'structured-result' if file.suffix=='.json' else 'raw-evidence')
        manifest.append(item);changed.append((before,item))
    store.index_artifacts(job_id,changed)
    return dict(files=files,manifest=manifest)

@router.get('/api/projects/{project}/cycle/jobs/{job_id}/artifact/{artifact_id}')
def download_artifact(project:str,job_id:str,artifact_id:str):
    scoped(project,job_id)
    indexed=store.artifact_index(job_id,artifact_id).get(artifact_id)
    if indexed is None: raise HTTPException(404,'Artifact ID not found; load the manifest first')
    return download(project,job_id,indexed[1]['path'])

@router.get('/api/projects/{project}/cycle/jobs/{job_id}/files/{path:path}')
def download(project:str,job_id:str,path:str):
    scoped(project,job_id)
    file=artifact_path(job_id,path)
    # HTML is generated locally with escaped evidence; reports need only inline assets.
    return FileResponse(file,headers={'X-Content-Type-Options':'nosniff',
                        'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'"})

def control_transport(machine):
    from cycle_transport import Transport
    from .authorization import configured_provider
    provider=configured_provider()
    if provider is None: raise HTTPException(503,'Manual live control requires the verified provider')
    secrets=provider.credentials(machine['credential_ref'],machine.get('credential_version'))
    if not callable(getattr(provider,'verify_identity',None)): raise HTTPException(503,'Identity/trust verification provider required')
    transport=Transport({r:secrets.get(r+'_password','') for r in ('os','bmc')},RUNTIME/'control-host-keys',
                     users={r:machine[r+'_user'] for r in ('os','bmc')},
                     ports={r:machine.get(r+'_port',22) for r in ('os','bmc')},cipher=machine.get('ipmi_cipher',17),ipmi_port=machine.get('ipmi_port',623))
    transport.verify_identity=lambda role:provider.verify_identity(machine,role,transport)
    return transport


@synchronized
def prepare_control(name,action,body,operator):
    try: manual.validate(action,body)
    except ValueError as exc: raise fail(exc)
    if MODE!='live': raise HTTPException(409,'SYNTHETIC 模式不操作實際機台')
    try: machine=resolve_control_target(pa,name,body)
    except (KeyError,ValueError) as exc: raise fail(exc)
    try:
        if any(t['name']!=machine['name'] and machine.get('os_ip') in (t.get('os_ip'),t.get('bmc_ip')) for t in node_inventory(pa)):
            raise Conflict('OS endpoint is registered to more than one target')
        impacted={m['name'] for m in node_inventory(pa) if m.get('power_domain')==machine.get('power_domain')}
        if not machine.get('power_domain') or len(impacted)>1:
            raise Conflict('需要已確認且獨立的 power domain')
        if action=='power' and machine.get('node_id'):
            peers=[t for t in node_inventory(pa) if t.get('bmc_ip')==machine.get('bmc_ip') or
                   machine.get('controller_id') and t.get('controller_id')==machine['controller_id']]
            if len(peers)>1 or not machine.get('capabilities',{}).get('independent_power'):
                raise Conflict('Manual power requires verified independent controller scope; shared selector is unavailable')
        profile=pa.projects.get(machine.get('project'),{}).get('cycle_profile')
        reasons=target_reason(machine,profile,mode='live',require_profile=False)
        if reasons: raise Conflict('；'.join(reasons))

        if not machine.get('parent_name'): validate_machine(pa,name,machine)
        transport=control_transport(machine)
        prepared=store.begin_control(machine,action,body.get('on'),operator,body['idempotency_key'])
        return machine,transport,prepared
    except ValueError as exc: raise fail(exc)
    except (OSError,KeyError): raise HTTPException(409,'控制紀錄或後端憑證無法讀寫；未確認操作不得重送')


def legacy_control(name,action,body,operator='local-operator'):
    machine,transport,prepared=prepare_control(name,action,body,operator)
    result=manual.execute(store,machine,action,body,operator,transport,prepared=prepared)
    complete=result['state']=='CONTROL_COMPLETE'
    return dict(ok=complete,info=f"{result['state']}: {result.get('reason','')} [{result['id']}]",
                power_status=('ON' if action=='reboot' or body.get('on') else 'OFF') if complete else 'UNKNOWN',**result)


@router.get('/api/cycle/controls')
def controls(request:Request):
    result=[]
    for item in store.controls():
        try: authorize(request,item['target'].get('project'),'read')
        except HTTPException: continue
        result.append(item)
    return {'controls':result}


@router.get('/api/cycle/controls/{control_id}')
def get_control(control_id:str,request:Request):
    try:
        saved=store.get_control(control_id)
        authorize(request,saved['target'].get('project'),'read')
        return saved
    except KeyError as exc: raise fail(exc)


@router.post('/api/cycle/controls/{control_id}/reconcile')
def reconcile_control(control_id:str,request:Request):
    if MODE!='live': raise HTTPException(409,'Live reconciliation is disabled in synthetic mode')
    try:
        saved=store.get_control(control_id)
        authorize(request,saved['target'].get('project'),'reconcile')
        return manual.reconcile(store,control_id,control_transport(saved['target']))
    except KeyError as exc: raise fail(exc)
    except OSError: raise HTTPException(409,'Control is busy or evidence storage unavailable; reservation retained')


# Preserve inventory/project/library operations. Arbitrary legacy SSH, KVM and terminal
# surfaces stay disabled until they can enforce the same reservations and auth.
@app.middleware('http')
async def boundary(request:Request,call_next):
    path=request.url.path
    if '/cycle/' not in path and not path.startswith('/api/cycle/'):
        try:
            from .authorization import authenticate
            request.state.actor=authenticate(request) if path.startswith('/api/') else authorize(request,None,'navigate')
        except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
    # Browser mutations must originate at this service; no permissive upstream CORS.
    if request.method not in {'GET','HEAD','OPTIONS'}:
        origin=request.headers.get('origin')
        if origin and origin!=str(request.base_url).rstrip('/'):
            return JSONResponse({'detail':'Cross-origin write rejected'},403)
    route_category=category(request.method,path)
    if path.startswith('/api/') and '/cycle/' not in path and not path.startswith('/api/cycle/'):
        try:
            body=await request.json() if request.method in {'POST','PATCH','PUT','DELETE'} and await request.body() else {}
            project_access.check(request,pa,body)
        except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
        except ValueError: return JSONResponse({'detail':'Invalid request body'},422)
    if re.fullmatch(r'/api/machine/[^/]+/aux',path) and request.method=='POST':
        return JSONResponse({'detail':'Manual AUX requires a verified adapter; no chassis-power fallback permitted'},409)
    if route_category=='DISABLED_REMOTE_ROUTES' and MODE=='synthetic':
        return JSONResponse({'detail':'此舊功能尚未接入 Cycle 任務互斥；本版停用遠端操作'},409)
    control=re.fullmatch(r'/api/machine/([^/]+)/(power|reboot)',path)
    if control and request.method=='POST':
        try:
            name=unquote(control[1])
            body={} if control[2]=='reboot' and not await request.body() else await request.json()
            manual.validate(control[2],body)
            target=resolve_control_target(pa,name,body)
            authorize(request,target.get('project'),'operate')
            result=await run_in_threadpool(legacy_control,unquote(control[1]),control[2],body,actor(request))
            return JSONResponse(result)
        except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
        except (ValueError,KeyError) as exc:
            error=fail(exc); return JSONResponse({'detail':error.detail},error.status_code)
        except (sqlite3.Error,OSError,EvidencePersistenceError):
            return JSONResponse({'detail':'Evidence persistence failure: inspect control status; never resend an uncertain command'},503)
    metadata=re.fullmatch(r'/api/(machines|projects)/([^/]+)',path)
    if metadata and request.method in {'PATCH','DELETE'}:
        try:
            body=await request.json() if request.method=='PATCH' else {}
            return JSONResponse(await run_in_threadpool(mutate,pa,store,metadata[1],metadata[2],request.method,body,
                lambda project,action='operate':authorize(request,project,action)))
        except (ValueError,KeyError) as exc:
            error=fail(exc); return JSONResponse({'detail':error.detail},error.status_code)
        except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
        except (OSError,EvidencePersistenceError,sqlite3.Error): return JSONResponse({'detail':'Evidence persistence failure: inventory was not saved'},503)
    token=legacy_observation.caller.set(getattr(request.state,'actor',None))
    scope_token=legacy_observation.project_scope.set(
        frozenset([body['project']]) if path=='/api/copilot' and isinstance(body,dict) and body.get('project') else None)
    enrollment_token=None
    from . import enrollment
    try:
        if request.method=='POST' and (path in {'/api/machines','/api/machines/probe-bmc'} or re.fullmatch(r'/api/machines/[^/]+/change-(os|bmc)-ip',path)):
            plan=enrollment.request_plan(path,await request.json(),pa)
            if plan:
                provider=getattr(app.state,'cycle_provider',None) or configured_provider()
                results=await run_in_threadpool(enrollment.prepare,plan,pa,store,provider,actor(request))
                enrollment_token=enrollment.current.set(results)
        return await call_next(request)
    except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
    except (ValueError,KeyError) as exc:
        error=fail(exc); return JSONResponse({"detail":error.detail},error.status_code)
    except (OSError,EvidencePersistenceError,sqlite3.Error):
        return JSONResponse({'detail':'Evidence persistence failure; inspect persisted job/control state before any further action'},503)
    finally:
        if enrollment_token is not None: enrollment.current.reset(enrollment_token)
        legacy_observation.caller.reset(token)
        legacy_observation.project_scope.reset(scope_token)

@router.get('/api/cycle/inventory')
def native_inventory(request:Request):
    result=[]
    for project in pa.projects:
        try: authorize(request,project,'read')
        except HTTPException: continue
        result.append(dict(name=project,project_id=pa.projects[project].get('project_id'),**project_targets(project)))
    return {'projects':result,'mode':MODE,'live_enabled':False if MODE=='synthetic' else bool(getattr(app.state,'cycle_provider',None))}

@router.get('/api/cycle/runs/{job_id}')
def native_run(job_id:str,request:Request):
    try: job=store.get(job_id)
    except KeyError as exc: raise fail(exc)
    authorize(request,job['project'],'read')
    return job

@router.post('/api/cycle/runs')
@synchronized
def native_create(body:dict,request:Request):
    project=body.get('project')
    authorize(request,project,'operate')
    config=validate_request({k:v for k,v in body.items() if k!='project'})
    try: return create_job(project,config,request)
    except HTTPException as exc:
        if exc.status_code!=409: raise
        selected=[t for t in node_inventory(pa) if t['name'] in config['machine_ids'] and t.get('project')==project]
        return store.blocked(project,config,selected,actor(request),str(exc.detail))

@router.get('/api/cycle/runs')
def native_runs(request:Request,offset:int=Query(0,ge=0),limit:int=Query(25,ge=1,le=100)):
    allowed=[]
    for project in store.history_projects():
        try: authorize(request,project,'read')
        except HTTPException: continue
        allowed.append(project)
    page=store.jobs_page(allowed,offset,limit+1)
    result=[{k:job[k] for k in ('id','project','state','created_at','updated_at','health','synthetic')} for job in page[:limit]]
    return {'runs':result,'has_more':len(page)>limit}

@router.get('/api/cycle/capabilities')
def native_capabilities():
    return dict(mode=MODE,profiles=['neutrino'],max_targets=4096,shared_live=False,
                note='Live requires provider, verified identity and confirmed action mapping')

from .sessions import SessionReservations

@router.get('/api/cycle/sessions')
def input_sessions(request:Request):
    from .coordinator import session_alive
    result=[]
    for record in store.input_sessions():
        try:
            for project in {t.get('project') for t in record['targets']}:authorize(request,project,'read')
        except HTTPException:continue
        result.append(dict(record,owner_alive=session_alive(store,record['id']),reviewed_hash=fingerprint(record)))
    return dict(sessions=result)


@router.post('/api/cycle/sessions/{owner}/reconcile')
def reconcile_input_session(owner:str,body:dict,request:Request):
    from .coordinator import session_lock_path
    from .runner import process_lock
    try:record=store.input_session(owner)
    except KeyError:raise HTTPException(404,'Input session not found')
    for project in {t.get('project') for t in record['targets']}:authorize(request,project,'reconcile')
    if body.get('reviewed_hash')!=fingerprint(record):raise HTTPException(409,'Session evidence changed; review again')
    reason=body.get('reason')
    if not isinstance(reason,str) or not 10<=len(reason)<=500:raise HTTPException(422,'Reviewed reconciliation reason required')
    try:
        with process_lock(session_lock_path(store,owner)):
            provider=getattr(app.state,'cycle_provider',None) or configured_provider()
            verify=getattr(provider,'verify_session_reconciliation',None)
            if not callable(verify) or not verify(record):
                raise HTTPException(409,'Provider must verify the bridge, remaining subprocesses and input scope are closed')
            with store.tx() as db:
                if fingerprint(store.input_session(owner))!=body['reviewed_hash']:raise HTTPException(409,'Session state changed')
                db.execute('DELETE FROM locks WHERE owner=?',(owner,))
                return store.input_session(owner,dict(record,state='RECONCILED',reviewed_by=actor(request),reason=reason,closed_at=time.time()))
    except (OSError,BlockingIOError):raise HTTPException(409,'Session owner is still active or storage unavailable; reservations retained')

app.add_middleware(SessionReservations, pa=pa, store_getter=lambda:store, mode=MODE)
app.include_router(router)
