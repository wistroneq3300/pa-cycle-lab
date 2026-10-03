"""Canonical node Telemetry API, using the existing PA authorization interface."""
import copy
import threading
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import StreamingResponse
from .authorization import authorize
from .settings import DATA, RUNTIME, MODE
from .targets import expand
from .identity_sync import IdentitySync
from .telemetry_store import ProvisionStore
from .telemetry_monitoring import MonitoringConfig, MonitoringClient
from .telemetry_provision import ProvisionService


def install(app,pa):
    current={};mutex=threading.RLock()

    def targets(name=None):
        result=[]
        with pa._DATA_LOCK:
            for key,parent in pa.machines.items():
                if name is not None and key!=name: continue
                if parent.get('mgx_type','server')!='server' or parent.get('passive'): continue
                canonical=pa.node_identity.canonical(dict(parent,name=key))
                canonical['project_id']=pa.projects.get(parent.get('project'),{}).get('project_id')
                for target in expand(key,canonical):
                    entry=next(e for e in canonical['os'] if e['node_id']==target['node_id'])
                    if entry.get('retired') or entry.get('status')=='retired': continue
                    target['binding_revision']=entry.get('binding_revision',1)
                    for field in ('hardware_uuid','node_serial','expected_identity'):
                        if entry.get(field): target[field]=copy.deepcopy(entry[field])
                    result.append(target)
        return result

    def resolve(node_id):
        rows=[t for t in targets() if t['node_id']==node_id]
        if len(rows)!=1: raise KeyError('Canonical node unavailable')
        return rows[0]

    def secrets():
        return [t.get(key,'') for t in targets() for key in ('os_password','bmc_password')]

    def service():
        override=getattr(app.state,'telemetry_provision',None)
        if override is not None: return override
        with mutex:
            if 'service' not in current:
                config=MonitoringConfig.environment()
                if MODE=='synthetic':
                    # Synthetic never connects to real monitoring/DUT or writes /etc.
                    from .telemetry_fixture import FixtureMonitor, FixtureProvisionTransport
                    from dataclasses import replace
                    config=replace(config,prometheus_url='http://synthetic.invalid',file_sd=str(DATA/'telemetry-targets.json'))
                    monitor=FixtureMonitor(config);transport=lambda t:FixtureProvisionTransport(t,monitor)
                else:
                    from validation_transport import ObservationTransport
                    monitor=MonitoringClient(config)
                    def transport(target):
                        return ObservationTransport({'os':target.get('os_password',''),'bmc':''},RUNTIME/'telemetry-host-keys',
                              users={'os':target.get('os_user') or 'root'},ports={'os':target.get('os_port',22)})
                current['service']=ProvisionService(ProvisionStore(DATA/'telemetry-provision.sqlite3',secrets),resolve,transport,IdentitySync(pa),monitor,config)
            return current['service']

    router=APIRouter(prefix='/api/telemetry')

    def access(node_id,request,action='read'):
        try: target=resolve(node_id)
        except KeyError: raise HTTPException(404,'找不到目前的 Node')
        authorize(request,target['project'],action)
        return target

    @router.get('/systems/{name}/nodes')
    def nodes(name:str,request:Request):
        with pa._DATA_LOCK:
            parent=pa.machines.get(name)
            if not parent: raise HTTPException(404,'找不到系統')
            authorize(request,parent.get('project'),'read')
        return {'nodes':[service().snapshot(t['node_id']) for t in targets(name)]}

    @router.get('/nodes/{node_id}')
    def status(node_id:str,request:Request):
        access(node_id,request);svc=service();svc.refresh(node_id);return svc.snapshot(node_id)

    @router.post('/nodes/{node_id}/enable',status_code=202)
    def enable(node_id:str,body:dict,request:Request):
        access(node_id,request,'operate')
        if set(body)-{'scope'} != {'idempotency_key','expected_binding_revision'}: raise HTTPException(422,'請提供目前節點版本與請求識別碼')
        scope=body.get('scope','all')
        if scope not in ('all','host','gpu'): raise HTTPException(422,'不支援的安裝範圍')
        try: return service().enable(node_id,body['idempotency_key'],body['expected_binding_revision'],scope)
        except (ValueError,KeyError) as exc: raise HTTPException(409,str(exc))

    @router.get('/nodes/{node_id}/charts')
    def charts(node_id:str,request:Request,period:str=Query('1h',pattern='^(1h|6h|24h|7d)$')):
        target=access(node_id,request);svc=service()
        gpu=svc.store.components(node_id).get('gpu',{}).get('state')
        return svc.charts.read(target,period,gpu)

    def job_access(job_id,request):
        try: job=service().store.get(job_id)
        except KeyError: raise HTTPException(404,'找不到 Telemetry 任務')
        # Historic jobs keep their original project boundary, including retired nodes.
        authorize(request,job['project'],'read')
        try: current_target=resolve(job['node_id'])
        except KeyError: current_target=None
        if current_target: authorize(request,current_target['project'],'read')
        return job

    @router.get('/jobs/{job_id}')
    def job(job_id:str,request:Request): return job_access(job_id,request)

    @router.get('/jobs/{job_id}/events')
    def events(job_id:str,request:Request,after_seq:int=Query(0,ge=0),limit:int=Query(250,ge=1,le=500)):
        job=job_access(job_id,request);rows=service().store.events(job_id,after_seq,limit)
        return {'job':job,'events':rows,'next_sequence':rows[-1]['sequence'] if rows else after_seq,'has_more':len(rows)==limit}

    @router.get('/jobs/{job_id}/log')
    def download(job_id:str,request:Request):
        job_access(job_id,request);store=service().store
        def lines():
            cursor=0
            while True:
                rows=store.events(job_id,cursor,500)
                if not rows: return
                for row in rows:
                    stamp=datetime.fromtimestamp(row['timestamp'],timezone(timedelta(hours=8))).isoformat(timespec='seconds')
                    yield f"{stamp} [{row['level']}] {row['step']} {row['message']}\n"
                cursor=rows[-1]['sequence']
        return StreamingResponse(lines(),media_type='text/plain; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="telemetry-{job_id}.log"'})

    app.include_router(router)
    return service
