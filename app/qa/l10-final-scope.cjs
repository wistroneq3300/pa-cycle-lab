/* Final RC source/provenance guard. No screenshot score is inferred here. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),baseline='108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c';
const output=path.join(root,'docs/screenshots/l10-cinematic/final-rc/evidence/scope.json');
const read=p=>fs.readFileSync(path.join(root,p));
const history=p=>cp.execFileSync('git',['show',baseline+':'+p],{cwd:root,maxBuffer:128*1024*1024});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const sourceHash=(file,b)=>sha(!b.includes(0)?Buffer.from(text(b)):b);
const report={baseline,pass:false,checks:[],protectedFiles:[],streamChanges:[],limitations:['Model coordinates are normalized visualization units, not millimetres.','Source invariance and projected width are engineering evidence, not proof of photorealism.']};
function check(name,fn){fn();report.checks.push(name);console.log('PASS '+name);}
try{
 const tracked=cp.execFileSync('git',['ls-tree','-r','--name-only',baseline,'app/static/models/l10-prototype','assets/l10-prototype','engine','integration','app/static/css'],{cwd:root}).toString().trim().split(/\r?\n/).filter(Boolean);
 check('Every tracked bare asset, engine and integration file remains identical (canonical LF for text)',()=>{
  for(const file of tracked){const expected=sourceHash(file,history(file)),actual=sourceHash(file,read(file));assert.equal(actual,expected,file);report.protectedFiles.push({file,sha256:actual});}
 });
 check('Existing untracked prototype files are preserved without modification',()=>{
  for(const [file,expected]of Object.entries({'assets/l10-prototype/compute-board-prototype.blend1':'01b5856ab7261a1ca0a8b9904ec8e82bccd611cfd3cbb687235e99b55b563e85','assets/l10-prototype/textures/surface-normal.png':'6309b50efb72caed7d2c651cef994b57946026879d54fcc611fab351b22994d5'})){
   // This workspace-only check is explicitly NOT a requirement on fresh clones.
   if(fs.existsSync(path.join(root,file))){assert.equal(sha(read(file)),expected,file);report.protectedFiles.push({file,sha256:expected,untrackedWorkspaceGuard:true});}
  }
 });
 check('Timeline, controls, networking, storage, Cycle, Telemetry and Agent sources are unchanged',()=>{
  const files=cp.execFileSync('git',['ls-tree','-r','--name-only',baseline,'app/static/js'],{cwd:root}).toString().trim().split(/\r?\n/).filter(p=>/\/(?:l10-(?:timeline|hardware|gltf|asset-runtime)|hero-cinematic|cycle[^/]*|telemetry[^/]*|pa-agent[^/]*)\.js$/.test(p));
  assert.ok(files.some(f=>f.endsWith('/l10-timeline.js')));
  for(const file of files)assert.equal(sourceHash(file,read(file)),sourceHash(file,history(file)),file);
  report.unchangedRuntimeSources=files;
 });
 check('Both HTML shells differ only by the two explicit script cache keys; all historical tests remain intact',()=>{
  for(const file of ['app/static/index.html','app/static/l10-cooling-v2-review.html']){
   const final=text(read(file)).replace('core-scene.js?v=20261014-final-rc','core-scene.js?v=20261014-cooling-v3').replace('rack-equipment-scene.js?v=20261014-final-rc','rack-equipment-scene.js?v=20261014-blanking-1u');
   assert.equal(final,text(history(file)),file);
  }
  // New versioned test files are additions; no baseline assertion is edited.
  const originalTests=cp.execFileSync('git',['ls-tree','-r','--name-only',baseline,'app/qa'],{cwd:root}).toString().trim().split(/\r?\n/).filter(Boolean);
  const diff=cp.spawnSync('git',['diff','--exit-code',baseline,'--',...originalTests],{cwd:root,encoding:'utf8'});
  assert.equal(diff.status,0,diff.stdout||diff.stderr);report.originalTestFiles=originalTests.length;
 });
 const file='app/static/js/core-scene.js',before=text(history(file)),current=text(read(file));
 // An explicit asset cache-key exception, not a general source scrubber.
 const finalURL="cooling-assembly.glb?v=20261014-final-rc",oldURL="cooling-assembly.glb?v=20261014-v3";
 assert.equal(current.split(finalURL).length,2,'Exactly one final companion URL');
 const finalFinish='sheetAnisotropy=mix(.14,.28,step(1.5,uCoolingFinish));';
 const oldFinish='sheetAnisotropy=mix(.07,.16,step(1.5,uCoolingFinish));';
 assert.equal(current.split(finalFinish).length,2,'Exactly one scoped cover-finish correction');
 const after=current.replace(finalURL,oldURL).replace(finalFinish,oldFinish);
 report.assetCacheKey={before:oldURL,after:finalURL};
 report.coverFinishException={before:oldFinish,after:finalFinish,scope:'CPU/GPU cover-only directional specular approximation; same PBR factors, textures, light and exposure'};
 const slice=(s,a,b)=>{assert.equal(s.split(a).length,2);assert.equal(s.split(b).length,2);return s.split(a)[1].split(b)[0];};
 check('All production cameras, Rack animation, draw ordering and material routing are byte-identical outside the named cover-finish scalar',()=>{
  const start='    function updateCamera(now,aspect,dt){';
  assert.equal(after.slice(after.indexOf(start)),before.slice(before.indexOf(start)));
  assert.equal(slice(after,'    function requestDraw(){',start),slice(before,'    function requestDraw(){',start));
  assert.equal(slice(after,'      if(vLocal.x>uSectionX)discard;','      if(uCoolingFlow>.5){'),slice(before,'      if(vLocal.x>uSectionX)discard;','      if(uCoolingFlow>.5){'));
 });
 check('Fluid phase, distance, wavelength and thermal interpretation remain unchanged',()=>{
  const flow=s=>slice(s,'      if(uCoolingFlow>.5){','      float metal=clamp(vMaterial.x,0.0,1.0),polymer=1.0-metal;');
  const b=flow(before),a=flow(after);
  for(const pattern of [/float branchT=.*;/,/float warp=.*;/,/float travel=.*;/,/float packet=.*;/,/float heat=.*;/,/vec3 body=.*;/,/gl_FragColor=.*;/])assert.equal(a.match(pattern)?.[0],b.match(pattern)?.[0],String(pattern));
  assert.ok(!/emissi|bloom|glow/i.test(a.replace(/\/\/[^\n]*/g,'')));
  assert.equal(after.slice(after.indexOf('      float metal=clamp(vMaterial.x,0.0,1.0),polymer=1.0-metal;'),after.indexOf('    function updateCamera(now,aspect,dt){')),before.slice(before.indexOf('      float metal=clamp(vMaterial.x,0.0,1.0),polymer=1.0-metal;'),before.indexOf('    function updateCamera(now,aspect,dt){')));
 });
 const meta='app/static/models/l10-cooling-v1/assembly.json',old=JSON.parse(history(meta)),now=JSON.parse(read(meta));
 check('Six seats, TIM, mounts, envelope and all route centerlines/endpoints/directions are exact',()=>{
  for(const key of ['id','sourceBareGLBSHA256','seats','mounts','envelope','layers','coordinateUnits','fastenerRecesses'])assert.deepEqual(now[key],old[key],key);
  assert.equal(now.flowRoutes.length,22);
  now.flowRoutes.forEach((route,i)=>{
   const original=old.flowRoutes[i],{radius:r,...contract}=route,{radius:b,...frozen}=original;assert.deepEqual(contract,frozen,route.id);
   if(r!==b){assert.match(route.id,/\/(?:inlet|outlet)$/);assert.equal(b,.0068);assert.equal(r,.009);report.streamChanges.push({id:route.id,beforeRadius:b,afterRadius:r,boreRadius:.0105,radialMargin:.0105-r});}
  });
  assert.ok(report.streamChanges.length===0||report.streamChanges.length===12,'Only twelve branch stream cores may change');
 });
 report.pass=true;
}catch(error){report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
finally{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
