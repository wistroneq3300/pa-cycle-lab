/* Preserve the incumbent film while replacing opt-in reference-study assets.
 * Run from any directory: node app/qa/l10-reference-invariants.cjs
 * Requires the recorded Git baseline; missing history fails rather than skips.
 * This checks bytes and deterministic poses, not browser pixels/photorealism.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const baseline='3ce4b9c6e5467abe9d27050e5af0240b07fff3dc';
const output=path.join(root,'artifacts/l10-reference-review/evidence/default-invariants.json');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalize=value=>value.replace(/\r\n/g,'\n');
const sources={};
for(const name of ['l10-hardware.js','core-scene.js','validation-overview.js']){
  const file='app/static/js/'+name;
  sources[name]={before:normalize(cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024})),after:normalize(fs.readFileSync(path.join(root,file),'utf8'))};
}
const plain=value=>JSON.parse(JSON.stringify(value));
function hardware(source){const s={window:{},Float32Array,Math};vm.runInNewContext(source,s);return s.window.PAL10Hardware;}
function core(source,hardwareApi){
  const s={window:{PAL10Hardware:hardwareApi},Float32Array,Math};
  const anchor='window.PACoreScene=Object.freeze({mount,assemblySnapshot});';
  assert.equal(source.split(anchor).length,2,'Core export anchor must be unique');
  source=source.replace(anchor,anchor+'window.__invariants={VERTEX,FRAGMENT,CAMERA_KEYS,cameraKey,l10State,rackProgress,rackMotion,motion,rackPlacementPose,placementPose,assemblySnapshot,PLAN,PLACEMENTS};');
  vm.runInNewContext(source,s);return s.window.__invariants;
}
const before=hardware(sources['l10-hardware.js'].before),after=hardware(sources['l10-hardware.js'].after);
const report={baseline,generatedAt:new Date().toISOString(),passed:false,scope:'CPU byte/pose invariants; no photorealism or browser-performance assertion',defaultMeshes:[],serviceOption:{},shaders:{},timeline:{},errors:[]};
function bytes(data){return Buffer.from(data.buffer,data.byteOffset,data.byteLength);}
function compareMeshes(a,b,label,expectedChanged=[]){
  assert.deepEqual(Object.keys(a.meshes),Object.keys(b.meshes),label+' mesh names');
  const changed=[];
  for(const name of Object.keys(a.meshes)){
    if(!bytes(a.meshes[name].data).equals(bytes(b.meshes[name].data)))changed.push(name);
  }
  assert.deepEqual(changed,expectedChanged,label+' changed buffers');return changed;
}
try{
  const oldDefault=before.build(),newDefault=after.build();
  assert.equal(Object.keys(oldDefault.meshes).length,9);
  compareMeshes(oldDefault,newDefault,'Default');
  for(const name of Object.keys(oldDefault.meshes)){
    const a=bytes(oldDefault.meshes[name].data),b=bytes(newDefault.meshes[name].data);
    report.defaultMeshes.push({name,bytes:b.length,baselineSHA256:hash(a),currentSHA256:hash(b),byteIdentical:a.equals(b)});
  }
  assert.deepEqual(plain(newDefault.profile),plain(oldDefault.profile),'All hardware profile anchors preserved');
  assert.deepEqual(plain(newDefault.bounds),plain(oldDefault.bounds),'Incumbent bounds preserved');
  const baseOmitted=after.build(after.profile,{omitBoard:0});
  const service=after.build(after.profile,{omitBoard:0,replaceServiceGeometry:true});
  report.serviceOption.changedMeshes=compareMeshes(baseOmitted,service,'Explicit opt-in service replacement',['l10-io']);
  assert.ok(service.meshes['l10-io'].data.length<baseOmitted.meshes['l10-io'].data.length,'Replacement removes procedural service geometry');
  compareMeshes(newDefault,after.build(after.profile,{replaceServiceGeometry:true}),'Service option without board ownership');
  compareMeshes(after.build(after.profile,{omitBoard:1}),after.build(after.profile,{omitBoard:1,replaceServiceGeometry:true}),'Service option on non-owned board');
  compareMeshes(newDefault,after.build(),'No build mutates default');
  report.serviceOption={...report.serviceOption,flagAloneLeavesDefaultIdentical:true,wrongBoardLeavesGeometryIdentical:true,defaultAfterPrototypeBuildIdentical:true,ioVerticesBefore:baseOmitted.meshes['l10-io'].data.length/12,ioVerticesAfter:service.meshes['l10-io'].data.length/12};
  const oldCore=core(sources['core-scene.js'].before,before),newCore=core(sources['core-scene.js'].after,after);
  for(const name of ['VERTEX','FRAGMENT']){
    report.shaders[name]={baselineSHA256:hash(oldCore[name]),currentSHA256:hash(newCore[name]),sourceIdentical:oldCore[name]===newCore[name]};
    assert.equal(newCore[name],oldCore[name],name+' shader source unchanged');
  }
  assert.equal(sources['validation-overview.js'].after,sources['validation-overview.js'].before,'Entire 35.2 second playback controller unchanged (LF normalized)');
  const duration=Number(sources['validation-overview.js'].after.match(/const FILM_MS=(\d+);/)[1]);assert.equal(duration,35200);
  assert.deepEqual(plain(newCore.CAMERA_KEYS),plain(oldCore.CAMERA_KEYS),'Authored film camera keys unchanged');
  assert.deepEqual(plain(newCore.PLAN),plain(oldCore.PLAN),'Rack plan unchanged');
  assert.deepEqual(plain(newCore.PLACEMENTS),plain(oldCore.PLACEMENTS),'Rack placement anchors unchanged');
  const functions=['cameraKey','l10State','rackProgress','rackMotion','motion','rackPlacementPose','placementPose','assemblySnapshot'];
  const functionHashes={};
  for(const name of functions){assert.equal(newCore[name].toString(),oldCore[name].toString(),name+' source unchanged');functionHashes[name]=hash(newCore[name].toString());}
  for(let i=0;i<=1000;i++){
    const progress=i/1000;
    assert.deepEqual(plain(newCore.assemblySnapshot(progress)),plain(oldCore.assemblySnapshot(progress)),'Rack/U40 pose '+progress);
    assert.deepEqual(plain(newCore.l10State(progress)),plain(oldCore.l10State(progress)),'L10 layer pose '+progress);
    const a=new Float32Array(6),b=new Float32Array(6);oldCore.cameraKey(progress,a);newCore.cameraKey(progress,b);assert.deepEqual(a,b,'Authored camera '+progress);
    assert.deepEqual(plain(after.sample(progress)),plain(before.sample(progress)),'Hardware sample '+progress);
  }
  report.timeline={durationMs:duration,controllerSHA256:hash(sources['validation-overview.js'].after),entireControllerIdentical:true,cameraKeysIdentical:true,profileAndRackAnchorsIdentical:true,functions:functionHashes,poseSamples:1001,posesIdentical:true};
  report.passed=true;
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,baseline,defaultMeshes:report.defaultMeshes.length,serviceOption:report.serviceOption,shaders:report.shaders,timeline:report.timeline,errors:report.errors,output},null,2));
