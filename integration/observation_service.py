"""Independent authorized CPU observation. No destructive operation or inventory write."""
import json
import time
from types import SimpleNamespace
from cycle_core import Target
from cycle_transport import Transport
from .settings import DATA, RUNTIME, MODE
from .store import Store, Conflict, scopes
from .targets import inventory
from .authorization import configured_provider
from .runner import process_lock
import sys
from .settings import ROOT
sys.path.insert(0,str(ROOT/'app'))
import telemetry_core as telemetry


def collect_once(store, provider, document=None):
    if MODE != 'live': return []
    principal=getattr(provider,'service_principal',lambda purpose:None)('telemetry')
    if not principal: raise Conflict('Verified telemetry service principal required')
    # The writer publishes inventory inside this same database transaction.
    with store.tx() as db:
        doc=document if document is not None else json.loads((DATA/'data.json').read_text(encoding='utf-8'))
        targets=inventory(SimpleNamespace(**doc))
    telemetry.init_db()
    results=[]
    for target in targets:
        if target.get('mgx_type','server')!='server': continue
        if not provider.authorize(principal,target.get('project'),'observe'): continue
        result=dict(node_id=target.get('node_id',target['name']),project=target.get('project'),
                    binding_revision=target.get('revision'),attempted_at=time.time(),gpu_state='NOT_CONFIGURED')
        owner='observation-'+__import__('uuid').uuid4().hex
        try:
            with store.tx() as db:
                if document is None:
                    latest=json.loads((DATA/'data.json').read_text(encoding='utf-8'))
                    current=next((t for t in inventory(SimpleNamespace(**latest)) if t['name']==target['name']),None)
                    if current!=target: raise Conflict('Binding changed before observation')
                store.reserve(db,owner,scopes(target))
                store.observation_status(result['node_id'],dict(result,state='COLLECTING',owner=owner))
            if not target.get('credential_ref'): raise Conflict('Credential reference is not configured')
            secrets=provider.credentials(target['credential_ref'],target.get('credential_version'))
            transport=Transport({'os':secrets.get('os_password','')},RUNTIME/'observation-host-keys',
                                users={'os':target.get('os_user','')},ports={'os':target.get('os_port',22)})
            node=Target(target.get('tray',''),target.get('node',''),target.get('os_ip',''),target.get('bmc_ip',''))
            def read(host,user,password,port,command,timeout=25):
                if (host,user,port,command)!=(target.get('os_ip'),target.get('os_user'),target.get('os_port',22),telemetry._OS_CMD):
                    raise Conflict('Observation outside fixed CPU collection contract')
                response=transport.ssh(node,'os',command,timeout=min(timeout,35))
                return response.output,response.code,'' if response.code==0 else 'Observation transport failed'
            machine=dict(target,os_pass='provider-managed')
            stamp,row,net,disk=telemetry.collect_os(machine,ssh=read)
            if row is None: result.update(state='ERROR',reason='No valid OS sample collected')
            else:
                telemetry.store_os(stamp,result['node_id'],row)
                telemetry.store_net(stamp,result['node_id'],net)
                telemetry.store_disk(stamp,result['node_id'],disk)
                result.update(state='COLLECTED',collected_at=stamp)
            vendor=target.get('capabilities',{}).get('telemetry_gpu')
            if vendor in {'nvidia','amd'}:
                command=(f'nvidia-smi --query-gpu={telemetry.GPU_QUERY} --format=csv,noheader,nounits'
                         if vendor=='nvidia' else telemetry.AMD_GPU_CMD)
                response=transport.ssh(node,'os',command,timeout=25)
                rows=(telemetry.parse_gpu(response.output) if vendor=='nvidia' else telemetry.parse_amdgpu(response.output)) if response.code==0 else []
                if rows:
                    telemetry.store_gpu(time.time(),result['node_id'],rows)
                    telemetry.evaluate_gpu_alerts(result['node_id'],enrich=False)
                    result['gpu_state']='COLLECTED'
                else:result['gpu_state']='ERROR'
        except Conflict as exc:
            result.update(state='DEFERRED',reason=str(exc))
        except Exception:
            # Provider/transport exception objects can contain credentials.
            result.update(state='ERROR',reason='Observation or persistence failed')
        finally:
            with store.tx() as db: db.execute('DELETE FROM locks WHERE owner=?',(owner,))
        results.append(result)
        store.observation_status(result['node_id'],result)
    return results


def service():
    if MODE!='live': raise Conflict('Synthetic mode never starts the live observation service')
    provider=configured_provider()
    if provider is None: raise Conflict('Observation provider is required')
    with process_lock(RUNTIME/'observation-service.lock'):
        store=Store()
        # Only this dedicated Paramiko observation process can own these rows.
        # Acquiring its OS lock proves the old service exited; no heartbeat timeout.
        with store.tx() as db:
            for row in db.execute('SELECT node_id,data FROM observation_status').fetchall():
                status=json.loads(row['data'])
                if status.get('state')=='COLLECTING' and status.get('owner','').startswith('observation-'):
                    db.execute('DELETE FROM locks WHERE owner=?',(status['owner'],))
                    status.update(state='INTERRUPTED',reason='Observation service exited during a read-only sample')
                    store.observation_status(row['node_id'],status)
        while True:
            collect_once(store,provider)
            time.sleep(max(5,telemetry.COLLECT_INTERVAL))
