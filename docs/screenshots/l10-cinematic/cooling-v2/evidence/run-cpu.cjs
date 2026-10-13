'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
let root=__dirname;while(!fs.existsSync(path.join(root,'app/qa/l10-cooling-v2.cjs'))){const parent=path.dirname(root);if(parent===root)throw new Error('Repository root not found');root=parent;}
const out=path.join(root,'docs/screenshots/l10-cinematic/cooling-v2/evidence');fs.mkdirSync(out,{recursive:true});
const python=process.env.PA_QA_PYTHON||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const tasks=[
 ['parser-bare.log',process.execPath,['app/qa/l10-gltf.cjs','--asset','app/static/models/l10-prototype/bare-compute-boards.glb']],
 ['parser-companion.log',process.execPath,['app/qa/l10-gltf.cjs','--asset','app/static/models/l10-cooling-v1/cooling-assembly.glb']],
 ['storage-layout.json',process.execPath,['app/qa/l10-storage-layout.cjs']],
 ['network-asset.json',process.execPath,['app/qa/l10-network-asset.cjs']],
 ['hardware.log',process.execPath,['app/qa/l10-hardware.cjs']],
 ['cooling-geometry.log',process.execPath,['app/qa/l10-cooling-v2.cjs','cooling-geometry']],
 ['runtime-manifest.log',python,['scripts/check_runtime_manifest.py']],
 ['engine-hash.log',python,['-c','from integration.store import engine_hash; print("engine_hash:", engine_hash())']]
];
for(const [name,command,args]of tasks){const result=cp.spawnSync(command,args,{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PA_L10_COOLING_EVIDENCE_DIR:'docs/screenshots/l10-cinematic/cooling-v2/evidence'},maxBuffer:32*1024*1024});fs.writeFileSync(path.join(out,name),Buffer.concat([result.stdout||Buffer.alloc(0),result.stderr||Buffer.alloc(0)]));console.log((result.status===0?'PASS ':'FAIL ')+name);if(result.status!==0){process.exitCode=1;break;}}
