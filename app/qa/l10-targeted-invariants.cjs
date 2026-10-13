/* Read-only P0 audit against the requested immutable polish baseline.
 * node app/qa/l10-targeted-invariants.cjs [report-basename]
 * Material batching may change; physical triangles, normals and poses may not.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),baseline='08dbc28af276c6b62e30f9502d6befe4aa4ce145';
const outputDir=path.join(root,'artifacts/l10-targeted-polish/evidence');
const before=file=>cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:64*1024*1024});
const after=file=>fs.readFileSync(path.join(root,file));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const plain=x=>JSON.parse(JSON.stringify(x));
const report={baseline,passed:false,checks:[],protectedFiles:[],glb:{},errors:[],limits:['Verifies physical geometry and source/pose invariants; screenshot review and real WebGL regression remain required.','Triangle signatures ignore material batching and cyclic corner order but preserve exact Float32 position/normal bytes, winding, duplicate counts and mesh ownership.']};
function same(a,b,label){assert.deepEqual(plain(a),plain(b),label);report.checks.push(label);}
function glb(bytes){
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jsonLength));
  return {j,bin:bytes.subarray(20+jsonLength+8)};
}
function accessor(g,index){
  const a=g.j.accessors[index],v=g.j.bufferViews[a.bufferView];
  const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const size=sizes[a.componentType]*components[a.type],stride=v.byteStride||size,start=(v.byteOffset||0)+(a.byteOffset||0),bytes=Buffer.alloc(a.count*size);
  for(let i=0;i<a.count;i++)g.bin.copy(bytes,i*size,start+i*stride,start+i*stride+size);
  return {bytes,count:a.count,type:a.type,componentType:a.componentType};
}
function meshSignature(g,mesh){
  const triangles=[];
  for(const p of mesh.primitives){
    assert.equal(p.mode??4,4);const pos=accessor(g,p.attributes.POSITION),normal=accessor(g,p.attributes.NORMAL),indices=accessor(g,p.indices);
    assert.equal(pos.type,'VEC3');assert.equal(normal.type,'VEC3');assert.equal(pos.componentType,5126);assert.equal(normal.componentType,5126);assert.equal(indices.count%3,0);
    const index=i=>indices.componentType===5123?indices.bytes.readUInt16LE(i*2):indices.componentType===5125?indices.bytes.readUInt32LE(i*4):indices.bytes.readUInt8(i);
    for(let i=0;i<indices.count;i+=3){
      const corners=[0,1,2].map(k=>{const j=index(i+k);return pos.bytes.subarray(j*12,j*12+12).toString('hex')+normal.bytes.subarray(j*12,j*12+12).toString('hex');});
      triangles.push([corners.join(''),corners[1]+corners[2]+corners[0],corners[2]+corners[0]+corners[1]].sort()[0]);
    }
  }
  const hash=crypto.createHash('sha256');triangles.sort().forEach(t=>hash.update(t));
  return {name:mesh.name,triangles:triangles.length,sha256:hash.digest('hex')};
}
function physical(g){
  return {scene:g.j.scene,scenes:g.j.scenes,nodes:g.j.nodes.map(n=>Object.fromEntries(Object.entries(n).filter(([k])=>k!=='extras'))),meshes:g.j.meshes.map(m=>meshSignature(g,m))};
}
function core(bytes){
  const s={window:{PAL10Hardware:{}},Float32Array,Math},source=text(bytes),anchor='window.PACoreScene=Object.freeze({mount,assemblySnapshot});';assert.equal(source.split(anchor).length,2);
  vm.runInNewContext(source.replace(anchor,anchor+'window.__audit={CAMERA_KEYS,cameraKey,l10State,rackProgress,rackMotion,motion,rackPlacementPose,placementPose,assemblySnapshot,PLAN,PLACEMENTS};'),s);return s.window.__audit;
}
try{
  for(const file of ['app/static/js/l10-hardware.js','app/static/js/rack-equipment-scene.js','app/static/js/validation-overview.js','app/static/js/l10-asset-runtime.js','app/static/js/l10-gltf.js','app/static/js/l10-bareboard-review.js','RUNTIME_ENGINE_FILES.json']){
    const a=before(file),b=after(file);assert.equal(text(a),text(b),file+' protected contents');report.protectedFiles.push({file,baselineSHA256:sha(a),currentSHA256:sha(b),LFNormalizedIdentical:true});
  }
  report.checks.push('Chassis, board/package anchors, eight SSDs, slotLayout, gold front, ports, covers, fasteners and GLB opt-in/fallback/parser/manifest sources unchanged');
  const file='app/static/models/l10-prototype/bare-compute-boards.glb',oldBytes=before(file),newBytes=after(file),a=glb(oldBytes),b=glb(newBytes),pa=physical(a),pb=physical(b);
  same(pa,pb,'Every physical triangle position/normal/winding/count, node transform and scene hierarchy unchanged');
  for(const key of ['replacesComputeBoards','replacesServiceGeometry','replacesNetworking','networkCards','bareBoardOnly','packageCount','cpuCount','gpuCount','coordinateUnits'])same(a.j.extras[key],b.j.extras[key],'GLB ownership/count invariant '+key);
  report.glb={baselineSHA256:sha(oldBytes),currentSHA256:sha(newBytes),geometrySHA256:sha(JSON.stringify(pb)),primitives:b.j.meshes.reduce((n,m)=>n+m.primitives.length,0),triangles:pb.meshes.reduce((n,m)=>n+m.triangles,0),meshSignatures:pb.meshes};
  const ca=core(before('app/static/js/core-scene.js')),cb=core(after('app/static/js/core-scene.js'));
  for(const key of ['CAMERA_KEYS','PLAN','PLACEMENTS'])same(ca[key],cb[key],'Unchanged '+key);
  for(const name of ['cameraKey','l10State','rackProgress','rackMotion','motion','rackPlacementPose','placementPose','assemblySnapshot'])assert.equal(cb[name].toString(),ca[name].toString(),name+' source');
  for(let i=0;i<=1000;i++){
    assert.deepEqual(plain(ca.assemblySnapshot(i/1000)),plain(cb.assemblySnapshot(i/1000)));
    const aa=new Float32Array(6),bb=new Float32Array(6);ca.cameraKey(i/1000,aa);cb.cameraKey(i/1000,bb);assert.deepEqual(aa,bb);
  }
  assert.match(text(after('app/static/js/validation-overview.js')),/const FILM_MS=35200;/);report.checks.push('35.2-second controller unchanged; 1001 identical assembly and camera samples; Rack placement and transitions unchanged');
  const changed=cp.execFileSync('git',['diff','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  const forbidden=changed.filter(p=>/^(integration\/|engine\/|app\/.*(?:cycle|telemetry|agent))/i.test(p));assert.deepEqual(forbidden,[]);report.checks.push('No Cycle, Telemetry, Agent, integration or engine files changed');
  report.passed=true;
}catch(e){report.errors.push(e.stack);process.exitCode=1;}
fs.mkdirSync(outputDir,{recursive:true});const output=path.join(outputDir,(process.argv[2]||'p0-invariants')+'.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,glb:report.glb,errors:report.errors,output},null,2));
