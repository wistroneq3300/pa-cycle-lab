'use strict';
// Execute the original suites without changing assertions; relocate outputs only.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/final-rc/evidence');
fs.mkdirSync(out,{recursive:true});
const suites={
 runtime:['l10-cooling-v2-runtime.cjs','docs/screenshots/l10-cinematic/cooling-v2/evidence','docs/screenshots/l10-cinematic/final-rc/evidence/runtime'],
 bareboard:['l10-bareboard-regression.cjs','../../artifacts/l10-bareboard/evidence','../../artifacts/l10-final-rc/evidence/bareboard'],
 cinematic:['l10-cinematic.cjs','../../artifacts/l10-cinematic/evidence','../../artifacts/l10-final-rc/evidence/cinematic'],
 environment:['l10-cooling-v3-environment.cjs','docs/screenshots/l10-cinematic/cooling-v3/evidence/environment','docs/screenshots/l10-cinematic/final-rc/evidence/environment'],
 rack:['hero-rack-isolation.cjs','../../artifacts/hero-cinematic-v3','../../artifacts/l10-final-rc/evidence/rack']
};
const mode=process.argv[2]||'cpu';
if(mode==='baseline-child'){
 const baseline='108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c',name=process.argv[3];
 const entry=name==='old-v2'?'l10-cooling-v2.cjs':name==='old-core'?'core-scene.cjs':null;if(!entry)throw Error('Unknown baseline suite');
 const file=path.join(__dirname,entry);let source=fs.readFileSync(file,'utf8');
 if(name==='old-v2'){
  const before='const read=p=>fs.readFileSync(path.join(root,p));';
  if(!source.includes(before))throw Error('Expected one read-only source hook');
  source=source.replace(before,"const read=p=>cp.execFileSync('git',['show','"+baseline+":'+p],{cwd:root,maxBuffer:96*1024*1024});");
  process.env.PA_L10_COOLING_EVIDENCE_DIR=path.join(out,'baseline');
 }else{
  source=source.replace("const source=fs.readFileSync(path.join(__dirname,'../static/js/core-scene.js'),'utf8');","const source=require('node:child_process').execFileSync('git',['show','"+baseline+":app/static/js/core-scene.js'],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});");
  source=source.replace("const sharedSource=fs.readFileSync(path.join(__dirname,'../static/js/rack-equipment-scene.js'),'utf8');","const sharedSource=require('node:child_process').execFileSync('git',['show','"+baseline+":app/static/js/rack-equipment-scene.js'],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});");
 }
 const compiled=new Module(file,module);compiled.filename=file;compiled.paths=Module._nodeModulePaths(__dirname);require.main=compiled;process.mainModule=compiled;compiled._compile(source,file);
}else if(mode==='wrapped'){
 const entry=suites[process.argv[3]];if(!entry)throw new Error('Unknown suite');
 const file=path.join(__dirname,entry[0]),source=fs.readFileSync(file,'utf8');
 if(source.split(entry[1]).length!==2)throw new Error('Expected exactly one output directory');
 const compiled=new Module(file,module);compiled.filename=file;compiled.paths=Module._nodeModulePaths(__dirname);
 compiled._compile(source.replace(entry[1],entry[2]),file);
}else{
 const python=process.env.PA_QA_PYTHON||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
 const tasks=mode==='baseline'?['old-v2','old-core'].map(s=>[s,process.execPath,[__filename,'baseline-child',s]]):mode==='cpu'?[
  ['core-scene',process.execPath,['app/qa/core-scene.cjs']],
  ['parser-bare',process.execPath,['app/qa/l10-gltf.cjs','--asset','app/static/models/l10-prototype/bare-compute-boards.glb']],
  ['parser-companion',process.execPath,['app/qa/l10-gltf.cjs','--asset','app/static/models/l10-cooling-v1/cooling-assembly.glb']],
  ['storage-layout',process.execPath,['app/qa/l10-storage-layout.cjs']],
  ['network-asset',process.execPath,['app/qa/l10-network-asset.cjs']],
  ['hardware',process.execPath,['app/qa/l10-hardware.cjs']],
  ['runtime-manifest',python,['scripts/check_runtime_manifest.py']],
  ['engine-hash',python,['-c','from integration.store import engine_hash; print("engine_hash:", engine_hash())']]
 ]:Object.keys(suites).filter(s=>mode==='browser'||mode===s).map(s=>[s,process.execPath,[__filename,'wrapped',s]]);
 if(!tasks.length)throw new Error('Choose baseline, cpu, browser, runtime, bareboard, cinematic, rack, environment');
 const report={mode,started:new Date().toISOString(),assertions:'Original assertions unchanged; only report destinations relocated',results:[],baseline:mode==='baseline'?'108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c':null,historicalReadRoutingOnly:mode==='baseline'};
 for(const [name,command,args]of tasks){
  const started=Date.now(),result=cp.spawnSync(command,args,{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PA_PREVIEW_URL:process.env.PA_PREVIEW_URL||'http://127.0.0.1:8775',PA_L10_HARDWARE_GL:'1',PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'},maxBuffer:96*1024*1024});
  fs.writeFileSync(path.join(out,name+'.log'),Buffer.concat([result.stdout||Buffer.alloc(0),result.stderr||Buffer.alloc(0)]));
  report.results.push({name,exit:result.status,pass:result.status===0,elapsedMs:Date.now()-started,error:result.error?.message});
  console.log((result.status===0?'PASS ':'FAIL ')+name+' '+(Date.now()-started)+'ms');
  if(result.status!==0)process.exitCode=1;
  fs.writeFileSync(path.join(out,'regression-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
 }
}
