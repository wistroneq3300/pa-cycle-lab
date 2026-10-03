"""Launch a fresh isolated backend, record production UI, stop only our process."""
import os
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path
import httpx

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'artifacts/shared-validation'; out.mkdir(parents=True,exist_ok=True)
env=dict(os.environ,CYCLE_MODE='synthetic',CYCLE_INSTANCE='data/shared-validation-'+uuid.uuid4().hex[:8],PYTHONUTF8='1')
env.pop('PA_DATA_DIR',None)
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
env['PA_CYCLE_BASE_URL']=f'http://127.0.0.1:{port}'
flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
with (out/'preview.log').open('w',encoding='utf-8') as log:
    server=subprocess.Popen([sys.executable,'-m','uvicorn','scripts.shared_validation_preview:create_app','--factory','--host','127.0.0.1','--port',str(port)],cwd=ROOT,env=env,stdout=log,stderr=log,creationflags=flags)
    try:
        for _ in range(100):
            try:
                r=httpx.get(env['PA_CYCLE_BASE_URL']+'/__acceptance/results',trust_env=False,timeout=2)
                if r.status_code==200: break
            except httpx.HTTPError: pass
            time.sleep(.1)
        else: raise RuntimeError('Isolated preview did not start')
        result=subprocess.run(['node','tests/shared-validation-browser.cjs'],cwd=ROOT,env=env,timeout=600)
        (out/'instance.txt').write_text(env['CYCLE_INSTANCE']+'\n'+env['PA_CYCLE_BASE_URL'],encoding='utf-8')
        response=httpx.get(env['PA_CYCLE_BASE_URL']+'/__acceptance/results',trust_env=False,timeout=5)
        (out/'backend-results.json').write_text(response.text,encoding='utf-8')
        sys.exit(result.returncode)
    finally:
        server.terminate()
        try: server.wait(10)
        except subprocess.TimeoutExpired: server.kill(); server.wait()
