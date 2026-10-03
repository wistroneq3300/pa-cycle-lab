"""Offline UI harness: production routes/SQLite, synthetic event journal, no runner."""
import time
import uuid
from types import SimpleNamespace
from .telemetry_preview import create_app as telemetry_app


def create_app():
    app=telemetry_app()
    from integration import web
    from integration.targets import inventory
    from integration.settings import ARTIFACTS
    from scripts.native_demo import fixture
    service=web.telemetry_provision_service()
    original_transport=service.transport
    def transport(target):
        wire=original_transport(target);read=wire.ssh
        def ssh(*args,**kwargs):
            result=read(*args,**kwargs)
            if service.monitor.scenarios.get(target['node_id'])=='identity_mismatch':
                # Real canonical recheck must reject an endpoint edited during IO.
                with web.pa._DATA_LOCK:
                    for machine in web.pa.machines.values():
                        for entry in machine.get('os',[]):
                            if entry.get('node_id')==target['node_id']:
                                entry['ip']='192.0.2.254'
            return result
        wire.ssh=ssh
        return wire
    service.transport=transport

    @app.post('/__validation/campaign')
    def campaign(body:dict):
        count=int(body.get('count',4))
        if count not in (1,4,32,128): raise ValueError('Supported synthetic sizes only')
        doc=fixture(chassis=max(1,count//4),nodes=min(4,count))
        targets=inventory(SimpleNamespace(**doc))
        token=uuid.uuid4().hex[:8]
        for i,t in enumerate(targets):
            t['name']=token+'-'+t['name'];t['node_id']=token+'-'+t['node_id'];t['chassis_id']=token+'-'+str(t['chassis_id'])
            t['os_ip']=f'192.0.{count}.{i+1}';t['bmc_ip']=f'198.18.{count}.{i+1}'
            t['controller_id']=token+'-controller-'+str(i)
            t['power_domain']=token+'-p-'+str(i);t['aux_domain']=token+'-a-'+str(i)
        job=web.store.create('Neutrino Demo',dict(idempotency_key=token,cycle_mode='power_cycle',channel='outband',limits={'loops':100},parallelism=4),targets,'fixture',mode='synthetic')
        nodes=[]
        for i,t in enumerate(targets):
            bucket='PASS';recovery=(i<10 if count>=32 else i==1)
            if count>=4 and i==count-1:bucket='FAIL'
            if count>=4 and i==count-2:bucket='WARN'
            if count>=32 and i==count-3:bucket='FAIL'
            if count>=32 and i==count-4:bucket='WARN'
            if body.get('healthy'):bucket='PASS';recovery=False
            nodes.append(dict(machine_id=t['name'],stage='waiting OS boot' if recovery else 'system check done',loop=4,attempts=4,completed=3 if recovery else 4,boot_confirmed=3 if recovery else 4,valid_cycles=3 if recovery else 4,health=bucket,cumulative_health=bucket,coverage='EXERCISED',unique_issues=int(bucket!='PASS'),first_this_round=int(bucket!='PASS'),updated_at=time.time(),stop_reason=''))
            kinds=[('PRE_COMPLETED','PRE','PASS'),('COMMAND_DISPATCHED','ACTION','CMD'),('WAIT_RECOVERY','RECOVERY','WAIT')] if recovery else [('PRE_COMPLETED','PRE','PASS'),('COMMAND_DISPATCHED','ACTION','CMD'),('BOOT_ID_CHANGED','RECOVERY','PASS'),('RECOVERY_DETECTED','RECOVERY','PASS'),('POST_COMPLETED','POST','PASS')]
            if bucket!='PASS':kinds.append(('ISSUE_NEW','POST',bucket))
            for kind,phase,level in kinds:
                web.store.append_event(job['id'],dict(machine_id=t['name'],tray=t['tray'],node=t['node'],loop=4,event_type=kind,phase=phase,level=level,message='Synthetic '+('Sensor threshold warning' if bucket=='WARN' and kind=='ISSUE_NEW' else 'PCI_DRIFT' if bucket=='FAIL' and kind=='ISSUE_NEW' else kind),evidence='node/evidence.log'))
        (ARTIFACTS/job['id']/'node').mkdir(parents=True,exist_ok=True)
        (ARTIFACTS/job['id']/'node/evidence.log').write_text('Offline structured event evidence. No hardware operation.\n',encoding='utf-8')
        web.store.update(job['id'],state='RUNNING',nodes=nodes,health='FAIL' if count>1 else 'PASS',heartbeat=time.time(),pre={'runnable_ids':[t['name'] for t in targets],'excluded':[],'findings':[],'version':'fixture'})
        return web.store.get(job['id'])

    @app.post('/__validation/events')
    def events(body:dict):
        job=web.store.get(body['job_id'])
        with web.store.tx() as db:
            for i in range(min(6000,int(body.get('count',2200)))):
                t=job['targets'][i%len(job['targets'])]
                web.store._event(db,job['id'],job['run_id'],dict(machine_id=t['name'],tray=t['tray'],node=t['node'],loop=4,phase='POST',level='INFO',event_type='COLLECTION_FINISHED',message=f'Synthetic throughput sample {i}',detail='Bounded offline load'))
        return {'ok':True}
    return app
