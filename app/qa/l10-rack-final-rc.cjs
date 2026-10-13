/* Final RC Rack contract: capture historical failures before fixing the source,
 * then prove only the two explicitly versioned rendering exceptions.
 * No original test file or assertion is changed by this independent audit.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/final-rc/evidence');
const beforeCommit='108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c',v2Commit='5f8e059c6e0c1a614fe412b990a463d643fc0a32';
const paths={rack:'app/static/js/rack-equipment-scene.js',core:'app/static/js/core-scene.js'};
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
const git=(commit,file)=>cp.execFileSync('git',['show',commit+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).replace(/\r\n/g,'\n');
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:Buffer.from(value.buffer,value.byteOffset,value.byteLength)).digest('hex');
fs.mkdirSync(out,{recursive:true});
function runRawTest(file,label){
  const result=cp.spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  fs.writeFileSync(path.join(out,label+'.stdout.log'),result.stdout||'');
  fs.writeFileSync(path.join(out,label+'.stderr.log'),result.stderr||'');
  return {command:'node '+file,exitCode:result.status,signal:result.signal,error:result.error?.message||null,stdout:label+'.stdout.log',stderr:label+'.stderr.log',testSHA256:hash(read(file))};
}
if(process.argv.includes('--capture-before')){
  const file=path.join(out,'rack-before.json');assert.ok(!fs.existsSync(file),'Preserve the first pre-fix failure evidence');
  assert.equal(read(paths.rack),git(beforeCommit,paths.rack),'Capture before changing the Rack source');
  const core=runRawTest('app/qa/core-scene.cjs','core-scene-before'),legacy=runRawTest('app/qa/l10-cooling-v2.cjs','cooling-v2-historical-before');
  assert.notEqual(core.exitCode,0,'Expected original source defect reproduced');
  assert.match(fs.readFileSync(path.join(out,core.stderr),'utf8'),/surface normal must be normalized/);
  assert.notEqual(legacy.exitCode,0,'Keep the historical V2 whole-source isolation failure visible');
  const record={beforeCommit,recordedAt:new Date().toISOString(),sourceSHA256:hash(read(paths.rack)),core,legacy};
  fs.writeFileSync(file,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));
  process.exit(0);
}

const contract=JSON.parse(read('app/qa/l10-rack-final-rc.contract.json'));
assert.equal(contract.version,1);assert.equal(contract.preFixBaseline,beforeCommit);assert.equal(contract.v2Baseline,v2Commit);
const source={v2:{rack:git(v2Commit,paths.rack),core:git(v2Commit,paths.core)},before:{rack:git(beforeCommit,paths.rack),core:git(beforeCommit,paths.core)},final:{rack:read(paths.rack),core:read(paths.core)}};
const checks=[],check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
const plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value)),near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} differs from ${b}`);
const originalRim='          const e=.0011;\n          quad([pa,a,front+.00015],[pa+side*e,a,front],[pb+side*e,b,front],[pb,b,front+.00015],[nx*.24,ny*.24,.97],C.goldEdge,.84);';
const normalizedRim='          const e=.0011,rim=[nx*.24,ny*.24,.97],rimLength=Math.hypot(...rim);\n          quad([pa,a,front+.00015],[pa+side*e,a,front],[pb+side*e,b,front],[pb,b,front+.00015],rim.map(v=>v/rimLength),C.goldEdge,.84);';
check('Actual Rack source differs from the pre-fix commit only by carrier rim normalization',()=>{
  assert.equal(source.before.rack.split(originalRim).length,2,'Exactly one documented source site');
  assert.equal(source.final.rack,source.before.rack.replace(originalRim,normalizedRim));
  assert.ok(source.before.rack.indexOf(originalRim)>source.before.rack.indexOf('function editorialCarrierStamp('));
  assert.ok(source.before.rack.indexOf(originalRim)<source.before.rack.indexOf('function editorialComputeFront('));
});
function load(s){
  const context={window:{},Float32Array};vm.createContext(context);vm.runInContext(s.rack,context,{filename:paths.rack});
  const marker='  window.PACoreScene=Object.freeze';assert.equal(s.core.split(marker).length,2);
  vm.runInContext(s.core.replace(marker,'  window.__rackCameraQA={cameraKey,fittedDistance};\n'+marker),context,{filename:paths.core});
  const api=context.window,records=plain(api.PACoreScene.assemblySnapshot(1).placements.map(row=>({name:row.name,mgx_type:row.type,rack_u:row.top,rack_size:row.size}))),snapshot=JSON.stringify(records);
  const parts=api.PARackScene.buildEditorialParts(records);assert.equal(JSON.stringify(records),snapshot,'Building meshes cannot mutate supplied records');
  return {api,records,parts};
}
const versions=Object.fromEntries(Object.entries(source).map(([name,s])=>[name,load(s)])),old=versions.v2.parts,before=versions.before.parts,final=versions.final.parts;
const allMeshes=parts=>({...parts.equipment,frame:parts.frame,infrastructure:parts.infrastructure,connections:parts.connections});
const oldMeshes=allMeshes(old),beforeMeshes=allMeshes(before),finalMeshes=allMeshes(final),meshProof={},changedFromPreFix=[],changedFromV2=[];
let correctedVertices=0,maxUnitError=0,maxDirectionError=0;
check('Every non-normal attribute is bit-exact; changed normals preserve direction and become unit length',()=>{
  assert.deepEqual(Object.keys(finalMeshes),Object.keys(beforeMeshes));
  for(const [key,mesh] of Object.entries(finalMeshes)){
    const prior=beforeMeshes[key],data=mesh.data,priorData=prior.data;assert.equal(data.length,priorData.length,key+' topology/count');
    assert.deepEqual(plain(mesh.min),plain(prior.min));assert.deepEqual(plain(mesh.max),plain(prior.max));
    let changed=0;
    for(let i=0;i<data.length;i+=11){
      for(const j of [0,1,2,6,7,8,9,10])assert.equal(data[i+j],priorData[i+j],key+' position/color/material/emission @'+i+'/'+j);
      const a=Array.from(priorData.slice(i+3,i+6)),b=Array.from(data.slice(i+3,i+6)),length=Math.hypot(...a),unitError=Math.abs(Math.hypot(...b)-1);
      maxUnitError=Math.max(maxUnitError,unitError);assert.ok(unitError<contract.normalTolerance,key+' unit normal');
      if(a.some((v,j)=>!Object.is(v,b[j]))){
        changed++;correctedVertices++;
        assert.ok(Math.abs(length-Math.hypot(.24,.97))<1e-7,'Only known undersized rolled-rim normals change');
        const error=Math.max(...b.map((v,j)=>Math.abs(v-a[j]/length)));maxDirectionError=Math.max(maxDirectionError,error);
        assert.ok(error<contract.normalTolerance,'Direction preserved, with only Float32 rounding');
      }
    }
    const evidence={v2:hash(oldMeshes[key].data),before:hash(priorData),final:hash(data),vertices:data.length/11,correctedNormalVertices:changed};meshProof[key]=evidence;
    if(evidence.before!==evidence.final)changedFromPreFix.push(key);
    if(evidence.v2!==evidence.final)changedFromV2.push(key);
    if(!['blanking:4','blanking:5'].includes(key))assert.equal(evidence.v2,evidence.before,key+' V3 had no other historical mesh exception');
  }
  assert.ok(correctedVertices>0,'Correction must affect real generated geometry');
  assert.deepEqual(changedFromPreFix,['server:1'],'Only the compute front carrier uses this rim');
  assert.deepEqual(changedFromV2.sort(),['blanking:4','blanking:5','server:1']);
});
const physicalPanels=[];
check('U1–9 and U47–48 are eleven exact 1U panel instances, matching the original upper panel',()=>{
  const panel=final.equipment['blanking:1'];assert.equal(hash(panel.data),hash(old.equipment['blanking:1'].data));
  near(panel.depth,.18);assert.ok(panel.max[1]-panel.min[1]<=final.unit);assert.ok(panel.max[2]-panel.min[2]<.4);
  for(const row of final.placements.filter(p=>p.type==='blanking')){
    const mesh=final.equipment[row.meshKey];assert.equal(mesh.data.length,panel.data.length*row.size);assert.equal(mesh.depth,panel.depth);
    for(const axis of [0,2]){assert.equal(mesh.min[axis],panel.min[axis]);assert.equal(mesh.max[axis],panel.max[axis]);}
    for(let j=0;j<row.size;j++){
      const offset=(j-(row.size-1)/2)*final.unit,u=row.bottom+j;
      near(row.y+offset,(u-.5)*final.unit-48*final.unit/2);
      for(let i=0;i<panel.data.length;i++){
        const actual=mesh.data[j*panel.data.length+i];
        if(i%11===1)near(actual,panel.data[i]+offset);
        else assert.equal(actual,panel.data[i],'Exact original upper panel attributes except translated Y');
      }
      physicalPanels.push({logicalName:row.name,u,sizeU:1,worldY:row.y+offset,depth:mesh.depth,meshFamily:'blanking:1'});
    }
  }
  assert.deepEqual(physicalPanels.map(p=>p.u).sort((a,b)=>a-b),contract.physicalBlankingUnits);
});
check('Official inventory is not rewritten; editorial identities, 41 placements and all 48 U centers remain unchanged',()=>{
  assert.deepEqual(versions.final.records,versions.before.records);assert.deepEqual(versions.final.records,versions.v2.records);
  assert.equal(final.placements.length,contract.logicalComponentCount);assert.equal(final.occupiedU,contract.occupiedU);
  for(const key of ['bounds','placements','routes','sockets']){assert.deepEqual(plain(final[key]),plain(before[key]),key);assert.deepEqual(plain(final[key]),plain(old[key]),key);}
  const occupied=[];for(const p of final.placements)for(let u=p.bottom;u<=p.top;u++)occupied.push(u);
  assert.deepEqual(occupied.sort((a,b)=>a-b),Array.from({length:48},(_,i)=>i+1));
  const blankNames=new Set(final.placements.filter(p=>p.type==='blanking').map(p=>p.name));
  assert.ok(final.routes.every(route=>!blankNames.has(route.component)),'No compute/cooling/network routes assigned to panels');
});
function fitBounds(shared,rows){
  const wideMin=shared.bounds.min.slice(),wideMax=shared.bounds.max.slice(),currentMin=wideMin.slice(),currentMax=wideMax.slice();
  for(const row of rows){const mesh=shared.equipment[row.meshKey],offset=[row.x,row.y,row.z];for(let axis=0;axis<3;axis++){
    wideMin[axis]=Math.min(wideMin[axis],mesh.min[axis]+row.constellation[axis]);wideMax[axis]=Math.max(wideMax[axis],mesh.max[axis]+row.constellation[axis]);
    if(row.opacity>.003){currentMin[axis]=Math.min(currentMin[axis],mesh.min[axis]+offset[axis]);currentMax[axis]=Math.max(currentMax[axis],mesh.max[axis]+offset[axis]);}
  }}return {wideMin,wideMax,currentMin,currentMax};
}
check('201 unique animation poses, Rack camera keys and fit bounds match V2 and pre-fix RC',()=>{
  const cameraBlock=s=>s.slice(s.indexOf('  const CAMERA_KEYS=['),s.indexOf('  function mount(canvas)'));
  assert.equal(cameraBlock(source.final.core),cameraBlock(source.before.core));assert.equal(cameraBlock(source.final.core),cameraBlock(source.v2.core));
  for(let i=0;i<contract.uniqueAnimationSamples;i++){
    const progress=i/(contract.uniqueAnimationSamples-1),samples=Object.fromEntries(Object.entries(versions).map(([name,v])=>[name,plain(v.api.PACoreScene.assemblySnapshot(progress))]));
    for(const name of ['v2','before']){
      assert.deepEqual(samples.final,samples[name],'Rack authored pose '+progress);
      assert.deepEqual(plain(fitBounds(final,samples.final.placements)),plain(fitBounds(versions[name].parts,samples[name].placements)),'Rack camera fit bounds '+progress);
      const a=new Float32Array(5),b=new Float32Array(5);versions.final.api.__rackCameraQA.cameraKey(progress,a);versions[name].api.__rackCameraQA.cameraKey(progress,b);assert.deepEqual(a,b,'Rack camera key '+progress);
    }
    assert.ok(samples.final.placements.filter(p=>p.type==='blanking').every(p=>!p.primary),'Panel never becomes L10 primary');
  }
});
const priorReport=JSON.parse(fs.readFileSync(path.join(out,'rack-before.json'),'utf8'));
check('All original assertions remain intact; original core-scene now passes without filtering',()=>{
  assert.equal(hash(read('app/qa/core-scene.cjs')),priorReport.core.testSHA256);
  assert.equal(hash(read('app/qa/l10-cooling-v2.cjs')),priorReport.legacy.testSHA256);
  const core=runRawTest('app/qa/core-scene.cjs','core-scene-final');assert.equal(core.exitCode,0,fs.readFileSync(path.join(out,core.stderr),'utf8'));
  priorReport.finalCore=core;
});
const report={passed:true,contract,recordedAt:new Date().toISOString(),checks,sourceHashes:Object.fromEntries(Object.entries(source).map(([key,files])=>[key,Object.fromEntries(Object.entries(files).map(([file,s])=>[file,hash(s)]))])),changedFromPreFix,changedFromV2,meshProof,correctedVertices,maxUnitError,maxDirectionError,physicalPanels,logicalComponentCount:final.placements.length,occupiedU:final.occupiedU,animationSamples:201,dynamicCameraFitSamples:201,originalTests:{beforeCore:priorReport.core,finalCore:priorReport.finalCore,historicalCoolingV2:priorReport.legacy},limits:'CPU geometry and source contract only; original browser interaction tests and actual pixels are separate acceptance evidence.'};
fs.writeFileSync(path.join(out,'rack-final-contract.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,correctedVertices,changedFromPreFix,changedFromV2,output:path.relative(root,path.join(out,'rack-final-contract.json'))},null,2));
