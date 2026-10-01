"""Real ASGI Terminal admission and hard Web death, with a fake bridge only."""
import asyncio
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import unittest
from types import SimpleNamespace


def serve():
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    from integration import web
    from integration.sessions import SessionReservations
    import uvicorn
    web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda request:'synthetic-engineer',authorize=lambda *a:True)
    for middleware in web.app.user_middleware:
        if middleware.cls is SessionReservations:middleware.kwargs['mode']='live'
    async def fake_bridge(ws,path):
        await ws.accept();await ws.send_text('FAKE BRIDGE READY')
        while True:await ws.receive_text()
    if '--serve-proxy' not in sys.argv:
        web.pa._proxy_ws=fake_bridge
        web.pa.kvm_bridge.kvm_proxy=fake_bridge
    uvicorn.run(web.app,host='127.0.0.1',port=int(sys.argv[-1]),log_level='error')


if __name__=='__main__' and '--bridge' in sys.argv:
    async def bridge():
        import websockets
        async def connection(ws):
            if ws.request.headers.get('X-Cycle-Gateway')!='synthetic-gateway-token-01234567890123456789':
                await ws.close(code=1008);return
            await ws.send('FAKE BRIDGE READY')
            async for message in ws:await ws.send(message)
        async with websockets.serve(connection,'127.0.0.1',int(sys.argv[-1])):
            await asyncio.Future()
    asyncio.run(bridge());raise SystemExit

if __name__=='__main__' and ('--serve' in sys.argv or '--serve-proxy' in sys.argv):
    serve();raise SystemExit

import test_integration as base
from integration import web
from integration.settings import ROOT,DATA
from integration.store import Store
from scripts.native_demo import fixture


class PlatformSessions(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def test_bridge_hard_death_closes_actual_proxy_and_releases_finished_session(self):
        instance=DATA/'bridge-child';instance.mkdir(exist_ok=True)
        (instance/'data.json').write_text(json.dumps(fixture()),encoding='utf-8')
        token=instance/'gateway-token';token.write_text('synthetic-gateway-token-01234567890123456789',encoding='utf-8')
        def free_port():
            with socket.socket() as sock:sock.bind(('127.0.0.1',0));return sock.getsockname()[1]
        bridge_port,web_port=free_port(),free_port()
        env={**os.environ,'CYCLE_INSTANCE':str(instance.relative_to(ROOT)),'CYCLE_MODE':'synthetic','PYTHONUTF8':'1',
             'TERM_BRIDGE_PORT':str(bridge_port),'CYCLE_BRIDGE_TOKEN_FILE':str(token),
             'PYTHONPATH':str(ROOT/'.venv/Lib/site-packages')+os.pathsep+str(ROOT)}
        env.pop('PA_DATA_DIR',None)
        runtime=getattr(sys,'_base_executable',sys.executable)
        def start(option,port):
            process=subprocess.Popen([runtime,str(Path(__file__).resolve()),option,str(port)],env=env,cwd=ROOT,
                                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            def cleanup():
                if process.poll() is None:process.kill()
                process.wait(timeout=5)
            self.addCleanup(cleanup)
            return process
        bridge=start('--bridge',bridge_port);web_process=start('--serve-proxy',web_port)
        import httpx
        for _ in range(100):
            try:
                if httpx.get(f'http://127.0.0.1:{web_port}/api/cycle/status').status_code==200:break
            except httpx.TransportError:pass
            time.sleep(.05)
        else:self.fail('Synthetic Web proxy did not start')
        session_store=Store(instance/'jobs.sqlite3')
        async def connect():
            import websockets
            async with websockets.connect(f'ws://127.0.0.1:{web_port}/ws/terminal/chassis-01/os?slot=3') as ws:
                self.assertEqual(await asyncio.wait_for(ws.recv(),5),'FAKE BRIDGE READY')
                self.assertTrue(session_store.lock_owners())
                await ws.send('synthetic echo');self.assertEqual(await ws.recv(),'synthetic echo')
                bridge.kill();bridge.wait(timeout=5)
                with self.assertRaises(websockets.exceptions.ConnectionClosed):await asyncio.wait_for(ws.recv(),5)
        asyncio.run(connect())
        for _ in range(50):
            if not session_store.lock_owners():break
            time.sleep(.05)
        self.assertEqual(session_store.lock_owners(),{})
        self.assertIsNone(web_process.poll())
        self.assertEqual(httpx.get(f'http://127.0.0.1:{web_port}/api/cycle/status').status_code,200)

    def test_web_hard_death_retains_queryable_session_until_verified_reconciliation(self):
        self.exercise('terminal/chassis-01/os')

    def test_kvm_web_hard_death_retains_the_same_controller_scope(self):
        self.exercise('kvm/chassis-01')

    def exercise(self,path):
        instance=DATA/'session-child';instance.mkdir(exist_ok=True)
        doc=fixture();(instance/'data.json').write_text(json.dumps(doc),encoding='utf-8')
        with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        env={**os.environ,'CYCLE_INSTANCE':str(instance.relative_to(ROOT)),'CYCLE_MODE':'synthetic','PYTHONUTF8':'1'}
        env.pop('PA_DATA_DIR',None)
        # Use the actual runtime binary so terminating it kills the Web owner,
        # not a Windows venv launcher that leaves its child behind.
        runtime=getattr(sys,'_base_executable',sys.executable)
        env['PYTHONPATH']=str(ROOT/'.venv/Lib/site-packages')+os.pathsep+str(ROOT)
        process=subprocess.Popen([runtime,str(Path(__file__).resolve()),'--serve',str(port)],env=env,cwd=ROOT,
                                 stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        self.addCleanup(lambda:process.poll() is None and process.kill())
        import httpx
        for _ in range(100):
            try:
                if httpx.get(f'http://127.0.0.1:{port}/api/cycle/status').status_code==200:break
            except httpx.TransportError:pass
            time.sleep(.05)
        else:self.fail('Synthetic Web child did not start')
        self.store=Store(instance/'jobs.sqlite3');web.store=self.store
        web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        verified=[]
        web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda r:'reviewer',authorize=lambda *a:True,
            verify_session_reconciliation=lambda record:verified.append(record['id']) or True)
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        async def hold():
            import websockets
            async with websockets.connect(f'ws://127.0.0.1:{port}/ws/{path}?slot=3') as connection:
                self.assertEqual(await connection.recv(),'FAKE BRIDGE READY')
                response=self.client.get('/api/cycle/sessions')
                self.assertEqual(response.status_code,200,response.text)
                records=response.json()['sessions'];self.assertEqual(len(records),1)
                record=records[0]
                response=self.client.post('/api/cycle/sessions/'+record['id']+'/reconcile',json={
                    'reviewed_hash':record['reviewed_hash'],'reason':'Reviewed fake bridge and no remaining IO'})
                self.assertEqual(response.status_code,409,response.text)
                self.assertEqual(verified,[])
                process.kill();process.wait(timeout=5)
        asyncio.run(hold())
        self.assertTrue(self.store.lock_owners())
        response=self.client.get('/api/cycle/sessions')
        record=response.json()['sessions'][0]
        self.assertFalse(record['owner_alive'])
        response=self.client.post('/api/cycle/sessions/'+record['id']+'/reconcile',json={
            'reviewed_hash':record['reviewed_hash'],'reason':'Reviewed fake bridge and no remaining IO'})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(verified,[record['id']]);self.assertEqual(self.store.lock_owners(),{})
