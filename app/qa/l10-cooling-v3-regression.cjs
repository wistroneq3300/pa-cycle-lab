'use strict';
// Execute the original suites without changing assertions; relocate outputs only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/cooling-v3/evidence');
fs.mkdirSync(out,{recursive:true});
const suites={
 runtime:['l10-cooling-v2-runtime.cjs','docs/screenshots/l10-cinematic/cooling-v2/evidence','docs/screenshots/l10-cinematic/cooling-v3/evidence/runtime'],
 bareboard:['l10-bareboard-regression.cjs','../../artifacts/l10-bareboard/evidence','../../artifacts/l10-cooling-v3/evidence/bareboard'],
 cinematic:['l10-cinematic.cjs','../../artifacts/l10-cinematic/evidence','../../artifacts/l10-cooling-v3/evidence/cinematic'],
 rack:['hero-rack-isolation.cjs','../../artifacts/hero-cinematic-v3','../../artifacts/l10-cooling-v3/evidence/rack']
};
const mode=process.argv[2]||'cpu';
if(mode==='wrapped'){
 const entry=suites[process.argv[3]];if(!entry)throw new Error('Unknown suite');
 const file=path.join(__dirname,entry[0]),source=fs.readFileSync(file,'utf8');
 if(source.split(entry[1]).length!==2)throw new Error('Expected exactly one output directory');
 const compiled=new Module(file,module);compiled.filename=file;compiled.paths=Module._nodeModulePaths(__dirname);
 compiled._compile(source.replace(entry[1],entry[2]),file);
}else{
 const python=process.env.PA_QA_PYTHON||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const tasks=mode==='cpu'?[
  ['parser-bare',process.execPath,['app/qa/l10-gltf.cjs','--asset','app/static/models/l10-prototype/bare-compute-boards.glb']],
  ['parser-companion',process.execPath,['app/qa/l10-gltf.cjs','--asset','app/static/models/l10-cooling-v1/cooling-assembly.glb']],
  ['storage-layout',process.execPath,['app/qa/l10-storage-layout.cjs']],
  ['network-asset',process.execPath,['app/qa/l10-network-asset.cjs']],
  ['hardware',process.execPath,['app/qa/l10-hardware.cjs']],
  ['runtime-manifest',python,['scripts/check_runtime_manifest.py']],
  ['engine-hash',python,['-c','from integration.store import engine_hash; print("engine_hash:", engine_hash())']]
 ]:Object.keys(suites).filter(s=>mode==='browser'||mode===s).map(s=>[s,process.execPath,[__filename,'wrapped',s]]);
 if(!tasks.length)throw new Error('Choose cpu, browser, runtime, bareboard, cinematic, rack');
 const report={mode,started:new Date().toISOString(),assertions:'Original assertions unchanged; only report destinations relocated',results:[]};
 for(const [name,command,args]of tasks){
  const started=Date.now(),result=cp.spawnSync(command,args,{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PA_PREVIEW_URL:process.env.PA_PREVIEW_URL||'http://127.0.0.1:8775',PA_L10_HARDWARE_GL:'1',PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'},maxBuffer:96*1024*1024});
  fs.writeFileSync(path.join(out,name+'.log'),Buffer.concat([result.stdout||Buffer.alloc(0),result.stderr||Buffer.alloc(0)]));
  report.results.push({name,exit:result.status,pass:result.status===0,elapsedMs:Date.now()-started,error:result.error?.message});
  console.log((result.status===0?'PASS ':'FAIL ')+name+' '+(Date.now()-started)+'ms');
  if(result.status!==0)process.exitCode=1;
  fs.writeFileSync(path.join(out,'regression-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
 }
}
