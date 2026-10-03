"""Isolated acceptance application. Production routes/static + fake device IO.

Only executable with CYCLE_MODE=synthetic and a fresh data/shared-validation-* instance.
The __acceptance endpoints exist only in this harness, never in production.
"""
import copy
import json
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
if os.environ.get('CYCLE_MODE')!='synthetic' or not os.environ.get('CYCLE_INSTANCE','').startswith('data/shared-validation-'):
    raise RuntimeError('An isolated synthetic instance is required')
from integration.settings import DATA
from integration.inspection_fixture import FixtureTransport,outputs
from integration.synthetic import SyntheticTransport
from validation_checker import run_checker
from validation_collectors import HARDWARE_INPUTS
from cycle_transport import Command


def scenario():
    path=DATA/'acceptance-fixture.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


class CycleFixture(SyntheticTransport):
    # Cycle and inspection execute the same actual Bash checker against raw
    # acquisition fixtures. Power dispatch remains the existing synthetic action.
    def ssh(self,t,role,cmd,timeout=60,sudo=False):
        if cmd=='lspci -Dvv -nn':
            self.calls.append((t.key,role,cmd)); return Command(0,outputs()['pci'])
        if cmd.startswith('MEMORY_MIN_RATIO='):
            raw=outputs(); raw.update(scenario().get('raw',{}))
            inputs={k:dict(raw=raw[k],code=0,collection_status='SUCCESS') for k in (*HARDWARE_INPUTS,'pci')}
            return run_checker(self.uploaded[t.key].decode(),inputs)
        return super().ssh(t,role,cmd,timeout,sudo)
    def redfish_login(self,t): return 'offline'
    def redfish_get(self,t,path,token):
        return FixtureTransport({'node_id':t.node}).redfish_get(t,path,token)
    def redfish_clear(self,t,path,token): return Command(0,'Fixture log boundary')


def create_app():
    from scripts.native_demo import fixture
    from scripts.bootstrap import bootstrap
    if not (DATA/'data.json').exists():
        doc=fixture(); project=doc['projects'].pop('Neutrino Demo'); project.update(name='Neutrino',desc='')
        doc['projects']['Neutrino']=project
        for machine in doc['machines'].values(): machine.update(project='Neutrino',os_alive=False,bmc_alive=False)
        (DATA/'data.json').write_text(json.dumps(doc),encoding='utf-8')
    bootstrap()
    from integration import web,profiles,runner
    from integration.store import fingerprint
    from fastapi import HTTPException
    app=web.app; svc=web.inspection_service(); offset=[0.]
    web.pa.ping_check=lambda *a,**k:False
    import paramiko
    def no_dut_connection(*a,**k): raise OSError('Offline acceptance transport only')
    paramiko.SSHClient.connect=no_dut_connection
    clock=lambda:time.time()+offset[0]
    svc.clock=clock; svc.source.clock=clock
    calls=[]
    svc.source.transport=lambda target:FixtureTransport(target,scenario(),calls)
    def unavailable(data): raise TimeoutError('Isolated AI unavailable fixture')
    svc.ai=unavailable
    original_freeze=profiles.freeze
    def freeze(*a,**k):
        result=original_freeze(*a,**k); expected=scenario().get('dimm_expected')
        if expected is not None:
            result['checker']=result['checker'].replace('DIMM_EXPECTED=16','DIMM_EXPECTED='+str(int(expected)))
            result['content_hash']=fingerprint({k:v for k,v in result.items() if k!='content_hash'})
        return result
    profiles.freeze=freeze
    # Suppress inherited startup probes. Inspection itself uses real service
    # scheduling and real collectors; only the transport implementation is fake.
    workers={}; stop=threading.Event()
    def cycle_scheduler():
        while not stop.wait(.2):
            for job in web.store.jobs('Neutrino'):
                if job['state']=='CREATED' and job['id'] not in workers:
                    thread=threading.Thread(target=runner.run_job,args=(web.store,job['id'],CycleFixture),daemon=True)
                    workers[job['id']]=thread; thread.start()
    @asynccontextmanager
    async def lifespan(app):
        svc.start(); scheduler=threading.Thread(target=cycle_scheduler,daemon=True); scheduler.start()
        yield
        stop.set(); svc.close(); scheduler.join(2)
    app.router.lifespan_context=lifespan
    @app.post('/__acceptance/fixture')
    def update(body:dict):
        from cycle_core import atomic_write
        atomic_write(DATA/'acceptance-fixture.json',json.dumps(body))
        return {'updated':True}
    @app.post('/__acceptance/clock')
    def advance(body:dict):
        offset[0]+=float(body.get('seconds',0)); return {'now':clock(),'accelerated_seconds':offset[0]}
    @app.post('/__acceptance/sample')
    def sample(body:dict):
        import sqlite3
        # Real telemetry DB rows, keyed by canonical node; no API interception.
        with sqlite3.connect(web.pa.telemetry_core.DB_FILE) as db:
            db.execute('CREATE TABLE IF NOT EXISTS os_metrics(id INTEGER PRIMARY KEY,machine TEXT,ts REAL,cpu_used REAL,mem_used_pct REAL)')
            db.execute('CREATE TABLE IF NOT EXISTS gpu_metrics(id INTEGER PRIMARY KEY,machine TEXT,ts REAL,gpu INTEGER,util REAL,mem_total REAL,mem_used REAL)')
            for target in svc.source.targets(svc.resolve('chassis-01')):
                db.execute('INSERT INTO os_metrics(machine,ts,cpu_used,mem_used_pct) VALUES(?,?,?,?)',(target['node_id'],clock(),body.get('cpu',99),40))
        return {'stored':True}
    @app.get('/__acceptance/results')
    def results():
        return {'calls':calls,'cycle_runs':web.store.jobs('Neutrino'),'inspection':svc.snapshot('chassis-01'),
                'issues':svc.store.issues(svc.resolve('chassis-01')['id'],1000),'instance':str(DATA),'offline':True}
    return app
