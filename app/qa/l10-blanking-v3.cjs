/* CPU proof of the V3 rendering-only 1U blanking correction.
 * Historical V2 source-isolation assertions are deliberately left intact.
 * Run: node app/qa/l10-blanking-v3.cjs
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),baseline=process.env.L10_BLANKING_BASE||'5f8e059c6e0c1a614fe412b990a463d643fc0a32';
const output=path.join(root,'docs/screenshots/l10-cinematic/cooling-v3/evidence/rack-geometry.json');
const paths={rack:'app/static/js/rack-equipment-scene.js',core:'app/static/js/core-scene.js'};
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const historical=file=>cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const oldSources=Object.fromEntries(Object.entries(paths).map(([key,file])=>[key,historical(file)]));
const newSources=Object.fromEntries(Object.entries(paths).map(([key,file])=>[key,read(file)]));
function load(sources){const scope={window:{},Float32Array};vm.createContext(scope);for(const key of ['rack','core'])vm.runInContext(sources[key],scope,{filename:paths[key]});return scope.window;}
const beforeAPI=load(oldSources),afterAPI=load(newSources),plain=value=>JSON.parse(JSON.stringify(value));
const records=api=>api.PACoreScene.assemblySnapshot(1).placements.map(row=>({name:row.name,mgx_type:row.type,rack_u:row.top,rack_size:row.size}));
const beforeRecords=records(beforeAPI),afterRecords=records(afterAPI),savedRecords=JSON.stringify(afterRecords);
const before=beforeAPI.PARackScene.buildEditorialParts(beforeRecords),after=afterAPI.PARackScene.buildEditorialParts(afterRecords);
const hash=data=>crypto.createHash('sha256').update(typeof data==='string'?data:Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
const checks=[],check=(name,fn)=>{fn();checks.push(name);console.log('PASS '+name);};
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-6,message+' ('+a+' vs '+b+')');
const meshHashes={},changedMeshes=[],physicalPanels=[];

check('Inventory identities, 41 logical components and complete 48U occupancy unchanged',()=>{
  assert.equal(JSON.stringify(afterRecords),savedRecords,'Geometry construction may not mutate inventory');
  assert.deepEqual(plain(afterRecords),plain(beforeRecords));
  assert.equal(after.placements.length,41);assert.equal(after.occupiedU,48);
  const occupied=[];
  for(const row of after.placements)for(let unit=row.bottom;unit<=row.top;unit++)occupied.push(unit);
  assert.deepEqual(occupied.sort((a,b)=>a-b),Array.from({length:48},(_,i)=>i+1));
  for(const [name,top,bottom,size] of [['editorial-infrastructure-blank',4,1,4],['editorial-reserve-blank',9,5,5]]){
    const row=after.placements.find(p=>p.name===name);
    assert.deepEqual({type:row.type,top:row.top,bottom:row.bottom,size:row.size},{type:'blanking',top,bottom,size});
  }
});

check('Only blanking:4 and blanking:5 geometry change; all other mesh bytes preserved',()=>{
  assert.deepEqual(Object.keys(after.equipment),Object.keys(before.equipment));
  for(const [key,mesh] of Object.entries(after.equipment)){
    const old=before.equipment[key];meshHashes[key]={before:hash(old.data),after:hash(mesh.data),beforeVertices:old.data.length/11,afterVertices:mesh.data.length/11};
    if(meshHashes[key].before!==meshHashes[key].after)changedMeshes.push(key);
    if(!['blanking:4','blanking:5'].includes(key))assert.equal(meshHashes[key].after,meshHashes[key].before,key+' is protected');
  }
  assert.deepEqual(changedMeshes.sort(),['blanking:4','blanking:5']);
  for(const key of ['frame','infrastructure','connections']){
    meshHashes[key]={before:hash(before[key].data),after:hash(after[key].data)};
    assert.equal(meshHashes[key].before,meshHashes[key].after,key+' mesh must remain byte-identical');
  }
});

check('Eleven physical 1U panels share every upper-panel vertex attribute except translated Y',()=>{
  const panel=after.equipment['blanking:1'];near(panel.depth,.18,'Existing shallow-panel depth');
  assert.ok(panel.max[1]-panel.min[1]<=after.unit,'1U height envelope');
  assert.ok(panel.max[2]-panel.min[2]<.40,'No full-depth enclosure');
  for(const row of after.placements.filter(p=>p.type==='blanking')){
    const mesh=after.equipment[row.meshKey];
    assert.equal(mesh.data.length,panel.data.length*row.size,'Only repeated panels; no additional server parts');
    assert.equal(mesh.depth,panel.depth);
    for(const axis of [0,2]){assert.equal(mesh.min[axis],panel.min[axis]);assert.equal(mesh.max[axis],panel.max[axis]);}
    for(let unit=0;unit<row.size;unit++){
      const offset=(unit-(row.size-1)/2)*after.unit,u=row.bottom+unit;
      near(row.y+offset,(u-.5)*after.unit-48*after.unit/2,'Unchanged rack U center');
      for(let i=0;i<panel.data.length;i++){
        const actual=mesh.data[unit*panel.data.length+i];
        if(i%11===1)near(actual,panel.data[i]+offset,'Only Y translates');
        else assert.equal(actual,panel.data[i],'Exact X/Z, normals, RGB, material and emission reuse');
      }
      physicalPanels.push({logicalName:row.name,u,physicalSizeU:1,worldY:row.y+offset,depth:mesh.depth,meshFamily:'blanking:1'});
    }
    for(let i=0;i<mesh.data.length;i+=11){assert.ok(mesh.data.slice(i,i+11).every(Number.isFinite));near(Math.hypot(...mesh.data.slice(i+3,i+6)),1,'Blanking normals normalized');}
  }
  assert.deepEqual(physicalPanels.map(p=>p.u).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9,47,48]);
});

check('Rack bounds, placements, routing and every sampled animation pose remain unchanged',()=>{
  for(const key of ['bounds','placements','routes','sockets'])assert.deepEqual(plain(after[key]),plain(before[key]),key+' is unchanged');
  const cameraFitBounds=(shared,rows)=>{
    const wideMin=shared.bounds.min.slice(),wideMax=shared.bounds.max.slice(),currentMin=wideMin.slice(),currentMax=wideMax.slice();
    for(const row of rows){
      const mesh=shared.equipment[row.meshKey],offset=[row.x,row.y,row.z];
      for(let axis=0;axis<3;axis++){
        wideMin[axis]=Math.min(wideMin[axis],mesh.min[axis]+row.constellation[axis]);wideMax[axis]=Math.max(wideMax[axis],mesh.max[axis]+row.constellation[axis]);
        if(row.opacity>.003){currentMin[axis]=Math.min(currentMin[axis],mesh.min[axis]+offset[axis]);currentMax[axis]=Math.max(currentMax[axis],mesh.max[axis]+offset[axis]);}
      }
    }
    return {wideMin,wideMax,currentMin,currentMax};
  };
  for(let i=0;i<=200;i++){
    // assemblySnapshot computes the authored separation state internally.
    const old=beforeAPI.PACoreScene.assemblySnapshot(i/200),current=afterAPI.PACoreScene.assemblySnapshot(i/200);
    assert.deepEqual(plain(current),plain(old),'Rack choreography at '+i/200);
    assert.deepEqual(plain(cameraFitBounds(after,current.placements)),plain(cameraFitBounds(before,old.placements)),'Dynamic Rack camera-fit bounds at '+i/200);
  }
  assert.equal(after.quality.railPairs,before.quality.railPairs);
  const blankNames=new Set(after.placements.filter(p=>p.type==='blanking').map(p=>p.name));
  assert.ok(after.routes.every(route=>!blankNames.has(route.component)),'Blanking has no compute cooling, power or network route');
  for(let i=0;i<=200;i++)assert.ok(afterAPI.PACoreScene.assemblySnapshot(i/200).placements.filter(p=>p.type==='blanking').every(p=>!p.primary),'Blanking never becomes the animated L10 primary');
});

const report={passed:true,baseline,checks,sourceHashes:Object.fromEntries(Object.keys(paths).map(key=>[paths[key],{before:hash(oldSources[key]),after:hash(newSources[key])}])),logicalComponentCount:after.placements.length,occupiedU:after.occupiedU,physicalPanelCount:physicalPanels.length,physicalPanels,changedMeshes,meshHashes,bounds:plain(after.bounds),animationSamples:201,dynamicCameraFitSamples:201,visualAcceptance:'Pending actual Chromium/WebGL captures; this file proves geometry and choreography only.'};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:checks.length,output:path.relative(root,output)},null,2));
