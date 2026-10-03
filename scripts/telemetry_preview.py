"""Isolated production UI/API acceptance; fake SSH and monitoring only."""
import json
import os
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path

if os.environ.get('CYCLE_MODE')!='synthetic' or not os.environ.get('CYCLE_INSTANCE','').startswith('data/telemetry-preview-'):
    raise RuntimeError('Use an isolated data/telemetry-preview-* synthetic instance')


def create_app():
    from integration.settings import DATA
    from scripts.native_demo import fixture
    if not (DATA/'data.json').exists():
        doc=fixture()
        for machine in doc['machines'].values(): machine.update(os_alive=False,bmc_alive=False)
        (DATA/'data.json').write_text(json.dumps(doc),encoding='utf-8')
    import paramiko
    def forbidden(*args,**kwargs): raise AssertionError('Hardware IO forbidden in telemetry acceptance')
    paramiko.SSHClient.connect=forbidden
    from integration import web
    web.pa.ping_check=lambda *a,**k:False
    web.pa._kick_status_scan=lambda *a,**k:None
    app=web.app;svc=web.telemetry_provision_service()
    # Synthetic dashboard stand-in is harness only. Production endpoint comes from config.
    svc.config=replace(svc.config,grafana_url=os.environ['PA_PREVIEW_URL'],verify_seconds=.2,poll_seconds=.05)
    svc.monitor.config=svc.config
    original=svc.transport
    def transport(target):
        wire=original(target);ssh=wire.ssh
        def call(*args,**kwargs):
            time.sleep(.3)
            if svc.monitor.scenarios.get(target['node_id'])=='slow' and 'apt-get' in args[2]: time.sleep(30)
            return ssh(*args,**kwargs)
        wire.ssh=call;return wire
    svc.transport=transport
    @asynccontextmanager
    async def lifespan(app):
        svc.start()
        yield
        svc.close()
    app.router.lifespan_context=lifespan
    @app.post('/__telemetry/fixture')
    def scenario(body:dict):
        nodes=[t for t in web.node_inventory(web.pa)]
        target=nodes[int(body.get('index',0))]
        svc.monitor.scenarios[target['node_id']]=body.get('mode','missing')
        return {'node_id':target['node_id']}
    @app.get('/__telemetry/results')
    def results():
        return {'calls':svc.monitor.calls,'cycle_jobs':len(web.store.jobs()),
                'nodes':[svc.snapshot(t['node_id']) for t in web.node_inventory(web.pa)]}
    @app.post('/__telemetry/log-batch')
    def log_batch(body:dict):
        job=svc.store.get(body['job_id'])
        with svc.store.tx() as db:
            for i in range(min(int(body.get('count',2100)),3000)):
                svc.store._event(db,job['job_id'],'INFO','CHECK','fixture '+str(i)+' <img src=x onerror="window.BAD=true"> SYNTHETIC-OS-1')
        return {'ok':True}
    @app.get('/d/{uid}/{slug}')
    def dashboard(uid:str,slug:str):
        from fastapi.responses import HTMLResponse
        return HTMLResponse('<html><body style="font:16px system-ui;padding:32px"><h2>Offline Grafana endpoint fixture</h2><p>Production iframe URL / node variable acceptance. No live metrics.</p></body></html>')
    return app
