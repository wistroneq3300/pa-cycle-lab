"""Offline acceptance only: production UI/routes/services, fake bottom IO and LLM."""
import json
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from .validation_console_preview import create_app as base_app


def create_app():
    app=base_app()
    from integration import web
    from integration.inspection_fixture import FixtureTransport
    provision=web.telemetry_provision_service();inspection=web.inspection_service()
    provision.config=replace(provision.config,dcgm_image='nvcr.io/nvidia/k8s/dcgm-exporter:4.1.1-4.0.4-ubuntu22.04')
    provision.monitor.config=provision.config
    scenario={'ai':'ok','journal':[]};calls=[]
    inspection.source.transport=lambda t:FixtureTransport(t,scenario,calls)
    def telemetry(system,config,now):
        return ([dict(node_id=n['node_id'],component='cpu',rule='cpu.utilization.high',kind='utilization',metric='cpu',value=99,
                      sample_at=now,source='Telemetry') for n in system['nodes']],[],[])
    inspection.source.telemetry=telemetry
    def ai(data):
        time.sleep(2)
        if scenario['ai']=='timeout':raise TimeoutError('fixture timeout')
        facts=json.loads(data)
        return json.dumps(dict(possible_causes=['目前工作負載可能使資源持續忙碌。','需核對同時段的裝置狀態與核心事件。'],
                              recommended_checks=['比較目前測試工作與採集時間。','檢視原始證據與相關裝置的變更紀錄。'],
                              conclusion='這是依現有觀測提出的建議，尚不能確認硬體根因。',confidence_note='規則判定與原始證據保持不變。',based_on=[facts.get('source') or '已保存觀測']))
    inspection.ai=ai
    old=app.router.lifespan_context
    @asynccontextmanager
    async def lifespan(app):
        async with old(app):
            inspection.start()
            yield
            inspection.close()
    app.router.lifespan_context=lifespan
    @app.post('/__refinement/fixture')
    def fixture(body:dict):
        targets=web.node_inventory(web.pa);target=targets[int(body.get('index',0))]
        provision.monitor.gpus[target['node_id']]=int(body.get('gpus',8))
        provision.monitor.gpu_scenarios[target['node_id']]=body.get('gpu_mode','missing')
        scenario['ai']=body.get('ai','ok')
        if body.get('fault'):
            scenario['journal']=[dict(__CURSOR='event-1',__REALTIME_TIMESTAMP=str(int(time.time()*1e6)),_BOOT_ID='00000000-0000-0000-0000-000000000001',MESSAGE='nvme nvme0: I/O 42 QID 1 timeout, aborting')]
            scenario['raw']={'sensor':'CPU Temp | 95 | degrees C | cr | na\n'}
        system=inspection.resolve('chassis-01')
        inspection.store.configure(system['id'],{'ai_enabled':True,'duration_seconds':0},'offline acceptance')
        return {'node_id':target['node_id'],'system_id':system['id']}
    @app.get('/__refinement/results')
    def results():
        system=inspection.resolve('chassis-01')
        return {'issues':inspection.store.issues(system['id']),'snapshot':inspection.snapshot('chassis-01'),'calls':calls,'telemetry_calls':provision.monitor.calls}
    return app
