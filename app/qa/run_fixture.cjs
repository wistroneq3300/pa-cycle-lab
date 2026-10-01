// Run an existing browser suite against an ephemeral local fixture server.
const cp=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const python=process.env.PA_TEST_PYTHON || 'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
(async()=>{
  if(!process.argv[2])throw Error('Usage: node qa/run_fixture.cjs qa/suite.cjs');
  const server=cp.spawn(python,['-B','-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});
  try{
    const port=await new Promise((resolve,reject)=>{server.stdout.once('data',d=>resolve(Number(d.toString().trim())));server.once('error',reject);server.once('exit',()=>reject(Error('Fixture server exited')));});
    const child=cp.spawn(process.execPath,process.argv.slice(2),{cwd:root,windowsHide:true,stdio:'inherit',env:{...process.env,PA_PREVIEW_URL:`http://127.0.0.1:${port}`}});
    process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
  }finally{server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
