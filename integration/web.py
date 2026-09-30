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
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse
from starlette.concurrency import run_in_threadpool
from .settings import ROOT, DATA, MODE, ARTIFACTS, RUNTIME
from .inventory import synchronized, mutate, local_write, validate_machine
from .boundary import category
from . import control as manual
from .credentials import load_credentials
from .store import Store, Conflict, SAFE_FIELDS, TERMINAL, scopes, target_reason, validate_request, fingerprint
from cycle_core import EvidencePersistenceError

sys.path.insert(0,str(ROOT/'app'))
import main as pa

app=pa.app
app.title='PA Cycle Lab'
store=Store()

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
    if getattr(route,'methods',set()) & {'POST','PATCH','DELETE'} and hasattr(route,'dependant'):
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
    owners=store.lock_owners(); rows=[]
    for name,m in pa.machines.items():
        if m.get('project')!=project: continue
        safe={k:copy.deepcopy(m[k]) for k in SAFE_FIELDS if k in m}; safe['name']=name
        reasons=target_reason(safe,profile)
        for role in ('os','bmc'):
            addr=safe.get(role+'_ip')
            if addr and any(other_name!=name and addr in (other.get('os_ip'),other.get('bmc_ip')) for other_name,other in pa.machines.items()):
                reasons.append('Inventory endpoint 重複：'+role)
        try: occupied=sorted({owners[k] for k in scopes(safe) if k in owners})
        except ValueError: occupied=[]
        if occupied: reasons.append('控制範圍已被占用：'+', '.join(occupied))
        rows.append(dict(**safe,machine_id=name,reasons=reasons,occupied_by=occupied,
                         os_status='SYNTHETIC' if MODE=='synthetic' else 'PRE 待驗證',
                         bmc_status='SYNTHETIC' if MODE=='synthetic' else 'PRE 待驗證'))
    return dict(profile=profile,targets=rows,mode=MODE)

@app.get('/api/cycle/status')
def cycle_status():
    try: heartbeat=float((RUNTIME/'service-heartbeat.txt').read_text())
    except (OSError,ValueError): heartbeat=0
    return dict(mode=MODE,web_pid=os.getpid(),runner_available=time.time()-heartbeat<10,
                single_operator=not bool(os.environ.get('CYCLE_USERS_JSON')))

@app.get('/api/projects/{project}/cycle/targets')
def targets(project:str): return project_targets(project)

@app.post('/api/projects/{project}/cycle/jobs')
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
        endpoints=[str(ipaddress.ip_address(m[r+'_ip'])) for m in chosen for r in ('os','bmc')]
        identities=[(m['tray'].lower(),m['node'].lower()) for m in chosen]
        if len(set(endpoints))!=len(endpoints) or len(set(identities))!=len(identities):
            raise ValueError('選取目標有重複 endpoint 或 tray/node')
        if config['cycle_mode']=='power_cycle' or config['channel']=='outband':
            for machine in chosen:
                impacted={n for n,m in pa.machines.items() if m.get('power_domain')==machine['power_domain']}
                if len(impacted)>1:
                    raise Conflict('V1 尚未驗證共享 power domain；此範圍暫不允許啟動')
        if config['cycle_mode']=='aux_cycle':
            for machine in chosen:
                domain=machine.get('aux_domain')
                if not domain or not machine.get('aux_scope_confirmed'): raise Conflict('AUX 實體影響範圍尚未確認')
                impacted={n for n,m in pa.machines.items() if m.get('aux_domain')==domain}
                if not impacted.issubset(set(config['machine_ids'])):
                    raise Conflict('AUX 必須包含完整影響範圍：'+', '.join(sorted(impacted)))
            # Shared AUX needs power-domain orchestration, absent in upstream V1.
            domains=[m['aux_domain'] for m in chosen]
            if len(set(domains))!=len(domains):
                raise Conflict('V1 尚未驗證共享 AUX domain 的單次派送；此範圍暫不允許啟動')
        return store.create(project,config,chosen,actor(request))
    except (ValueError,KeyError) as exc: raise fail(exc)

@app.get('/api/projects/{project}/cycle/jobs')
def jobs(project:str): return {'jobs':store.jobs(project)}

@app.get('/api/projects/{project}/cycle/jobs/{job_id}')
def get_job(project:str,job_id:str): return scoped(project,job_id)

@app.post('/api/projects/{project}/cycle/jobs/{job_id}/confirm')
def confirm(project:str,job_id:str,body:dict,request:Request):
    scoped(project,job_id)
    try: return store.confirm(job_id,body.get('version'),body.get('machine_ids'),actor(request))
    except (ValueError,KeyError) as exc: raise fail(exc)

@app.post('/api/projects/{project}/cycle/jobs/{job_id}/stop')
def stop(project:str,job_id:str,request:Request):
    scoped(project,job_id)
    return store.stop(job_id,actor(request))

@app.get('/api/projects/{project}/cycle/jobs/{job_id}/events')
def events(project:str,job_id:str,after:int=0):
    scoped(project,job_id)
    return {'events':store.events(job_id,max(0,after))}

def public_artifact(path):
    return not any(p.startswith('.') or any(word in p.lower() for word in ('credential','password','secret','private_key','id_rsa','id_ed25519')) for p in Path(path).parts)


def artifact_path(job_id,path):
    base=(ARTIFACTS/job_id).resolve()
    candidate=(base/path).resolve()
    if not candidate.is_relative_to(base) or not public_artifact(path) or not candidate.is_file():
        raise HTTPException(404,'找不到報告檔案')
    return candidate

@app.get('/api/projects/{project}/cycle/jobs/{job_id}/artifacts')
def artifacts(project:str,job_id:str):
    scoped(project,job_id)
    base=ARTIFACTS/job_id
    return {'files':[p.relative_to(base).as_posix() for p in sorted(base.rglob('*')) if p.is_file()
                     and public_artifact(p.relative_to(base))
                     and p.resolve().is_relative_to(base.resolve())]}

@app.get('/api/projects/{project}/cycle/jobs/{job_id}/files/{path:path}')
def download(project:str,job_id:str,path:str):
    scoped(project,job_id)
    file=artifact_path(job_id,path)
    # HTML is generated locally with escaped evidence; reports need only inline assets.
    return FileResponse(file,headers={'X-Content-Type-Options':'nosniff',
                        'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'"})

def control_transport(machine):
    from cycle_transport import Transport
    secrets=load_credentials()[machine['credential_ref']]
    return Transport({r:secrets.get(r+'_password','') for r in ('os','bmc')},RUNTIME/'control-host-keys',
                     users={r:machine[r+'_user'] for r in ('os','bmc')},
                     ports={r:machine.get(r+'_port',22) for r in ('os','bmc')},cipher=machine.get('ipmi_cipher',17))


@synchronized
def prepare_control(name,action,body,operator):
    try: manual.validate(action,body)
    except ValueError as exc: raise fail(exc)
    if MODE!='live': raise HTTPException(409,'SYNTHETIC 模式不操作實際機台')
    if name not in pa.machines: raise HTTPException(404,'機台不存在')
    machine=dict(pa.machines[name],name=name)
    try:
        impacted={n for n,m in pa.machines.items() if m.get('power_domain')==machine.get('power_domain')}
        if not machine.get('power_domain') or len(impacted)>1:
            raise Conflict('需要已確認且獨立的 power domain')
        profile=pa.projects.get(machine.get('project'),{}).get('cycle_profile')
        reasons=target_reason(machine,profile,mode='live')
        if reasons: raise Conflict('；'.join(reasons))
        validate_machine(pa,name,machine)
        transport=control_transport(machine)
        prepared=store.begin_control(machine,action,body.get('on'),operator)
        return machine,transport,prepared
    except ValueError as exc: raise fail(exc)
    except (OSError,KeyError): raise HTTPException(409,'控制紀錄或後端憑證無法讀寫；未確認操作不得重送')


def legacy_control(name,action,body,operator='local-operator'):
    machine,transport,prepared=prepare_control(name,action,body,operator)
    result=manual.execute(store,machine,action,body,operator,transport,prepared=prepared)
    complete=result['state']=='CONTROL_COMPLETE'
    return dict(ok=complete,info=f"{result['state']}: {result.get('reason','')} [{result['id']}]",
                power_status=('ON' if action=='reboot' or body.get('on') else 'OFF') if complete else 'UNKNOWN',**result)


@app.get('/api/cycle/controls')
def controls(): return {'controls':store.controls()}


@app.get('/api/cycle/controls/{control_id}')
def get_control(control_id:str):
    try: return store.get_control(control_id)
    except KeyError as exc: raise fail(exc)


@app.post('/api/cycle/controls/{control_id}/reconcile')
def reconcile_control(control_id:str):
    if MODE!='live': raise HTTPException(409,'Live reconciliation is disabled in synthetic mode')
    try:
        saved=store.get_control(control_id)
        return manual.reconcile(store,control_id,control_transport(saved['target']))
    except KeyError as exc: raise fail(exc)
    except OSError: raise HTTPException(409,'Control is busy or evidence storage unavailable; reservation retained')


# Preserve inventory/project/library operations. Arbitrary legacy SSH, KVM and terminal
# surfaces stay disabled until they can enforce the same reservations and auth.
@app.middleware('http')
async def boundary(request:Request,call_next):
    path=request.url.path
    users_text=os.environ.get('CYCLE_USERS_JSON','')
    if MODE=='live' and not users_text:
        return JSONResponse({'detail':'Live service requires CYCLE_USERS_JSON authentication'},status_code=503)
    if users_text:
        valid=False
        try:
            users=json.loads(users_text)
            kind,encoded=request.headers.get('authorization','').split(' ',1)
            user,password=base64.b64decode(encoded).decode().split(':',1)
            valid=kind.lower()=='basic' and user in users and hmac.compare_digest(password,users[user])
        except (ValueError,KeyError,TypeError): pass
        if not valid: return JSONResponse({'detail':'需要登入'},401,headers={'WWW-Authenticate':'Basic realm="PA Cycle Lab"'})
        request.state.actor=user
    else: request.state.actor='local-operator'
    # Browser mutations must originate at this service; no permissive upstream CORS.
    if request.method not in {'GET','HEAD','OPTIONS'}:
        origin=request.headers.get('origin')
        if origin and origin!=str(request.base_url).rstrip('/'):
            return JSONResponse({'detail':'Cross-origin write rejected'},403)
    route_category=category(request.method,path)
    if route_category=='DISABLED_REMOTE_ROUTES':
        return JSONResponse({'detail':'此舊功能尚未接入 Cycle 任務互斥；本版停用遠端操作'},409)
    control=re.fullmatch(r'/api/machine/([^/]+)/(power|reboot)',path)
    if control and request.method=='POST':
        try:
            body={} if control[2]=='reboot' and not await request.body() else await request.json()
            result=await run_in_threadpool(legacy_control,unquote(control[1]),control[2],body,actor(request))
            return JSONResponse(result)
        except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
        except ValueError: return JSONResponse({'detail':'Invalid request'},422)
        except (sqlite3.Error,OSError,EvidencePersistenceError):
            return JSONResponse({'detail':'Evidence persistence failure: inspect control status; never resend an uncertain command'},503)
    metadata=re.fullmatch(r'/api/(machines|projects)/([^/]+)',path)
    if metadata and request.method in {'PATCH','DELETE'}:
        try:
            body=await request.json() if request.method=='PATCH' else {}
            return JSONResponse(await run_in_threadpool(mutate,pa,store,metadata[1],metadata[2],request.method,body))
        except (ValueError,KeyError) as exc:
            error=fail(exc); return JSONResponse({'detail':error.detail},error.status_code)
        except HTTPException as exc: return JSONResponse({'detail':exc.detail},exc.status_code)
        except (OSError,EvidencePersistenceError,sqlite3.Error): return JSONResponse({'detail':'Evidence persistence failure: inventory was not saved'},503)
    try: return await call_next(request)
    except (OSError,EvidencePersistenceError,sqlite3.Error):
        return JSONResponse({'detail':'Evidence persistence failure; inspect persisted job/control state before any further action'},503)

class NoLegacyWebSockets:
    def __init__(self,app): self.inner=app
    async def __call__(self,scope,receive,send):
        if scope['type']=='websocket':
            await send({'type':'websocket.close','code':1008}); return
        await self.inner(scope,receive,send)

app.add_middleware(NoLegacyWebSockets)
