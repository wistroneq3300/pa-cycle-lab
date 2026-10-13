/* Cooling Assembly V3: independent CPU geometry and immutable-baseline audit.
 * Reads actual frozen GLB surfaces and generated companion triangles.
 * Does not certify manufacturing tolerances or OEM concealed-channel design.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const baseline='5f8e059c6e0c1a614fe412b990a463d643fc0a32';
const legacyBaseline='445bd9c6287cbe7f69d6cbc1ffc9dd1c43c1905b';
const EPS=1e-6;
const read=p=>fs.readFileSync(path.join(root,p));
const history=p=>cp.execFileSync('git',['show',baseline+':'+p],{cwd:root,maxBuffer:64*1024*1024});
const text=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,e=EPS)=>Math.abs(a-b)<=e;
const vectorNear=(a,b,e=EPS)=>a.length===b.length&&a.every((v,i)=>near(v,b[i],e));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const bounds=v=>({min:[0,1,2].map(i=>Math.min(...v.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...v.map(p=>p[i])))});
const overlap=(a,b,eps=0)=>a.min.every((v,i)=>a.max[i]>=b.min[i]+eps&&b.max[i]>=v+eps);
function triangles(data,label,stride=12){
 assert.equal(data.length%(stride*3),0,label+' complete triangles');
 const out=[];
 for(let i=0;i<data.length;i+=stride*3){
  const v=[0,stride,stride*2].map(k=>Array.from(data.slice(i+k,i+k+3)));
  assert.ok(v.flat().every(Number.isFinite),label+' finite positions');
  out.push({v,...bounds(v),label,index:i/(stride*3),normal:Array.from(data.slice(i+3,i+6))});
 }
 return out;
}
function separated(axis,a,b,eps=1e-8){
 const length=Math.hypot(...axis);if(length<1e-12)return false;
 const pa=a.map(p=>dot(p,axis)),pb=b.map(p=>dot(p,axis));
 return Math.max(...pa)<Math.min(...pb)-eps*length||Math.max(...pb)<Math.min(...pa)-eps*length;
}
function triangleTriangle(a,b){
 if(!overlap(a,b,-1e-8))return false;
 const ea=[sub(a.v[1],a.v[0]),sub(a.v[2],a.v[1]),sub(a.v[0],a.v[2])],eb=[sub(b.v[1],b.v[0]),sub(b.v[2],b.v[1]),sub(b.v[0],b.v[2])];
 const na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
 const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y))),...ea.map(e=>cross(na,e)),...eb.map(e=>cross(nb,e))];
 return !axes.some(axis=>separated(axis,a.v,b.v));
}
function hasHorizontalTriangle(tris,x,z,y,ny){
 return tris.some(t=>{
  if(!t.v.every(v=>near(v[1],y))||!near(t.normal[1],ny))return false;
  const [a,b,c]=t.v,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(d)<1e-12)return false;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
  return Math.min(u,w,1-u-w)>=-1e-7;
 });
}
function spatialIndex(tris,pitch=[.06,.035,.08]){
 const grid=new Map();
 const cells=t=>{const lo=t.min.map((v,i)=>Math.floor(v/pitch[i])),hi=t.max.map((v,i)=>Math.floor(v/pitch[i])),out=[];
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)out.push(x+','+y+','+z);return out;};
 tris.forEach((t,i)=>{for(const key of cells(t)){if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}});
 return t=>[...new Set(cells(t).flatMap(key=>grid.get(key)||[]))].map(i=>tris[i]);
}
function pointSegmentDistance(p,a,b){
 const d=sub(b,a),length=dot(d,d);if(length<1e-16)return Math.hypot(...sub(p,a));
 const t=Math.max(0,Math.min(1,dot(sub(p,a),d)/length));
 return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));
}
function pathDistance(p,points){return Math.min(...points.slice(1).map((b,i)=>pointSegmentDistance(p,points[i],b)));}
function pathLength(points){return points.slice(1).reduce((n,p,i)=>n+Math.hypot(...sub(p,points[i])),0);}
function insideClosedSurface(point,tris){
 // Deduplicate shared triangle-edge hits. Three non-axis-aligned rays avoid
 // treating a ray along a face edge as evidence of solid containment.
 const dirs=[[1,.371,.529],[.413,1,.293],[.217,.419,1]];
 const votes=dirs.map(dir=>{
  const hits=[];
  for(const t of tris){
   const [a,b,c]=t.v,e1=sub(b,a),e2=sub(c,a),h=cross(dir,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)continue;
   const s=sub(point,a),u=dot(s,h)/det;if(u<-1e-9||u>1+1e-9)continue;
   const q=cross(s,e1),v=dot(dir,q)/det;if(v<-1e-9||u+v>1+1e-9)continue;
   const distance=dot(e2,q)/det;if(distance>EPS)hits.push(distance);
  }
  hits.sort((a,b)=>a-b);const unique=hits.filter((v,i)=>!i||Math.abs(v-hits[i-1])>EPS);
  return unique.length%2===1;
 });
 return votes.filter(Boolean).length>=2;
}
function helperFixtures(){
 const tri=v=>({v,...bounds(v)}),a=tri([[0,0,0],[1,0,0],[0,1,0]]);
 assert.ok(triangleTriangle(a,tri([[.2,.2,-1],[.2,.2,1],[.3,.3,0]])),'SAT catches piercing');
 assert.ok(triangleTriangle(a,tri([[.1,.1,0],[.5,.1,0],[.1,.5,0]])),'SAT catches coplanar overlap');
 assert.ok(!triangleTriangle(a,tri([[.8,.8,0],[1.2,.8,0],[.8,1.2,0]])),'SAT rejects separated coplanar patches');
 assert.ok(!triangleTriangle(a,tri([[0,0,.001],[1,0,.001],[0,1,.001]])),'SAT preserves real clearance');
 assert.ok(near(pointSegmentDistance([.5,1,0],[0,0,0],[1,0,0]),1));
 assert.ok(near(pathLength([[0,0,0],[0,1,0],[0,1,2]]),3));
 const cube=[];for(const [axis,other]of [[0,[1,2]],[1,[2,0]],[2,[0,1]]])for(const side of [-1,1]){
  const v=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{const p=[0,0,0];p[axis]=side;p[other[0]]=q[0];p[other[1]]=q[1];return p;});
  cube.push(tri([v[0],v[1],v[2]]),tri([v[0],v[2],v[3]]));
 }
 assert.ok(insideClosedSurface([0,0,0],cube),'Containment catches fully enclosed solid without a surface crossing');
 assert.ok(!insideClosedSurface([2,0,0],cube),'Containment does not classify an exterior point as inside');
}
async function loadGLB(file='app/static/models/l10-prototype/bare-compute-boards.glb',frozenBytes=null){
 const scope={window:{},ArrayBuffer,Uint8Array,Float32Array,Float64Array,DataView,TextDecoder,URL,Blob,Math,Number,Set,Map};
 vm.runInNewContext(text(read('app/static/js/l10-gltf.js')),scope);
 const bytes=frozenBytes||read(file);
 const asset=await scope.window.PAL10GLTF.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{decodeImage:async(data,mime)=>{
  assert.equal(mime,'image/png');const b=Buffer.from(data);return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};
 }});
 return {bytes,asset};
}
function extractSeats(asset){
 const faces=asset.primitives.filter(p=>p.layer==='packages'&&/^(CPU|GPU) exposed optical face$/.test(p.material.name));
 assert.equal(faces.length,6,'Exactly six actual CPU/GPU optical surfaces');
 assert.equal(faces.filter(p=>p.material.name.startsWith('CPU')).length,2);
 assert.equal(faces.filter(p=>p.material.name.startsWith('GPU')).length,4);
 return faces.map(p=>{
  const tr=triangles(p.data,p.name),b=bounds(tr.flatMap(t=>t.v)),center=b.min.map((v,i)=>(v+b.max[i])/2);
  assert.ok(near(b.min[1],b.max[1]),p.name+' planar optical surface');
  assert.ok(near(center[1],.0056),p.name+' frozen bare face height');
  return {name:p.name,id:p.name.replace(/^.*packages \/ /,'').replace(/#\d+$/,''),kind:p.material.name.startsWith('CPU')?'CPU':'GPU',center,bounds:b,triangles:tr};
 });
}
function coreAudit(source,extras={}){
 const scope={window:{PAL10Hardware:{},...extras},Float32Array,Math};
 const matches=source.match(/window\.PACoreScene=Object\.freeze\(\{[^;]+\}\);/g);
 assert.equal(matches?.length,1,'Known core export for read-only CPU instrumentation');
 const anchor=matches[0];
 vm.runInNewContext(source.replace(anchor,anchor+'window.__coolingAudit={CAMERA_KEYS,cameraKey,l10State,rackProgress,motion,placementPose,assemblySnapshot,PLAN,PLACEMENTS};'),scope);
 return {...scope.window.__coolingAudit,public:scope.window.PACoreScene};
}
function procedural(rackSource,hardwareSource){
 const scope={window:{},Float32Array,Math};
 vm.runInNewContext(rackSource,scope);vm.runInNewContext(hardwareSource,scope);
 return {hardware:scope.window.PAL10Hardware,rack:scope.window.PARackScene,built:scope.window.PAL10Hardware.build()};
}
function centralTimeline(report){
 const scope={window:{},Math,Object};vm.runInNewContext(text(read('app/static/js/l10-timeline.js')),scope);
 const api=scope.window.PAL10Timeline;assert.ok(api,'Central authored timeline is available');
 const oldController=text(cp.execFileSync('git',['show',legacyBaseline+':app/static/js/validation-overview.js'],{cwd:root,maxBuffer:64*1024*1024}));
 const legacy=plain(vm.runInNewContext(oldController.match(/const filmKeys=(\[.*?\]);/)[1]));
 const expected=[[0,0],[1.7,.065],[3.3,.135],[5.4,.202],[7.5,.248],[9.3,.276],[9.6,.278],[9.9,.284],[10.5,.292],[11,.300],[13.9,.325],[14.3,.333],[15.1,.345],[16.5,.376],[17.5,.407],[22,.56],[25.5,.653333],[28.3,.733333],[30.7,.80],[31.7,.84],[34.2,.893333],[35.2,.906667],[37.7,.96],[39.7,1]];
 assert.equal(api.definitions.legacy.durationMs,35200);assert.equal(api.definitions.coolingV2.durationMs,39700);
 assert.deepEqual(plain(api.definitions.legacy.keys),legacy,'Legacy timing keys remain exactly the V1 baseline');
 assert.deepEqual(plain(api.definitions.coolingV2.keys),expected,'V2 timing keys match the explicit approved 39.7-second schedule');
 const authored=(ms,keys)=>{const seconds=Math.max(0,ms)/1000;for(let i=1;i<keys.length;i++){const [end,b]=keys[i],[start,a]=keys[i-1];if(seconds<=end){const t=Math.min(1,(seconds-start)/(end-start));return a+(b-a)*t*t*(3-2*t);}}return 1;};
 for(const [mode,keys]of [['legacy',legacy],['coolingV2',expected]]){
  const end=keys.at(-1)[0]*1000;let previous=-1;
  for(let i=0;i<=1600;i++){
   const ms=end*i/1600,p=api.progressAt(ms,mode),sample=plain(api.sample(p,mode));
   assert.ok(near(p,authored(ms,keys),1e-10),mode+' independently computed smoothstep mapping');
   assert.ok(p>=previous,mode+' monotonic timeline');previous=p;
   assert.ok(near(api.timeAt(p,mode),ms,.03),mode+' inverse time round-trip');
   assert.ok(near(sample.timeMs,ms,.03));assert.equal(sample.durationMs,end);assert.ok(near(sample.timeProgress,ms/end,1e-6));
   assert.ok(sample.stageProgress>=0&&sample.stageProgress<=1&&typeof sample.stage==='string');
   assert.equal(api.progressAt(ms,mode),p,'Timeline is deterministic');
  }
 }
 const lidStart=legacy.find(x=>x[1]===.376)[0]*1000;
 for(let i=0;i<=1000;i++){
  const ms=lidStart+(35200-lidStart)*i/1000;
  assert.ok(near(api.progressAt(ms+4500,'coolingV2'),authored(ms,legacy),1e-10),'Original lid/Rack curve is preserved with exactly +4500ms');
 }
 const oldRack=legacy.filter(x=>x[1]>=.376),newRack=expected.filter(x=>x[1]>=.376);
 assert.equal(newRack.length,oldRack.length);
 for(let i=0;i<oldRack.length;i++){assert.equal(newRack[i][1],oldRack[i][1]);assert.ok(near(newRack[i][0]-oldRack[i][0],4.5,1e-9));}
 assert.ok(near(api.timeAt(.292,'coolingV2')-api.timeAt(.248,'coolingV2'),3000,.03));
 assert.ok(near(api.timeAt(.325,'coolingV2')-api.timeAt(.292,'coolingV2'),3400,.03));
 assert.ok(near(api.timeAt(.333,'coolingV2')-api.timeAt(.292,'coolingV2'),3800,.03));
 report.timeline={legacyDurationMs:35200,coolingDurationMs:39700,legacyKeys:legacy,coolingKeys:expected,lidAndRackOffsetMs:4500,independentClockSamplesPerMode:1601,lidAndRackSamples:1001};
 report.checks.push('Central legacy 35.2s and approved cooling 39.7s mappings/inverses; all original lid/Rack intervals and smoothstep curves retain exact +4.5s offset');
 return api;
}
function immutableBaseline(report,bareBytes){
 const assetPath='app/static/models/l10-prototype/bare-compute-boards.glb';
 assert.equal(sha(bareBytes),sha(history(assetPath)),'Frozen bareboard GLB remains byte-identical');
 report.bareAsset={sha256:sha(bareBytes),bytes:bareBytes.length};
 assert.equal(text(read('app/static/js/l10-bareboard-review.js')),text(history('app/static/js/l10-bareboard-review.js')),'Frozen bareboard review unchanged');
 const old=procedural(text(history('app/static/js/rack-equipment-scene.js')),text(history('app/static/js/l10-hardware.js')));
 const now=procedural(text(read('app/static/js/rack-equipment-scene.js')),text(read('app/static/js/l10-hardware.js')));
 assert.deepEqual(plain(now.hardware.profile),plain(old.hardware.profile),'Default hardware anchors/counts/envelope/profile unchanged');
 assert.deepEqual(plain(now.rack.storageLayout),plain(old.rack.storageLayout),'Eight SSD slots, carrier and contact planes unchanged');
 assert.deepEqual(Object.keys(now.built.meshes),Object.keys(old.built.meshes),'Default fallback layer set unchanged');
 for(const [name,m]of Object.entries(old.built.meshes))assert.equal(sha(Buffer.from(now.built.meshes[name].data.buffer)),sha(Buffer.from(m.data.buffer)),name+' default fallback geometry/material bytes unchanged');
 const timeline=centralTimeline(report);
 const oldCore=coreAudit(text(history('app/static/js/core-scene.js'))),newCore=coreAudit(text(read('app/static/js/core-scene.js')),{PAL10Timeline:timeline});
 assert.deepEqual(plain(newCore.PLAN),plain(oldCore.PLAN),'Rack population unchanged');
 assert.deepEqual(plain(newCore.PLACEMENTS),plain(oldCore.PLACEMENTS),'Rack positions and occupied U unchanged');
 const oldRack=old.rack.buildEditorialParts(plain(oldCore.PLAN)),newRack=now.rack.buildEditorialParts(plain(newCore.PLAN));
 assert.deepEqual(plain(newRack.placements),plain(oldRack.placements));
 assert.deepEqual(plain(newRack.routes),plain(oldRack.routes));assert.deepEqual(plain(newRack.sockets),plain(oldRack.sockets));
 for(const key of ['frame','infrastructure','connections'])assert.equal(sha(Buffer.from(newRack[key].data.buffer)),sha(Buffer.from(oldRack[key].data.buffer)),key+' Rack geometry frozen');
 for(const [key,value] of Object.entries(oldRack.equipment))if(!key.startsWith('blanking:'))assert.equal(sha(Buffer.from(newRack.equipment[key].data.buffer)),sha(Buffer.from(value.data.buffer)),key+' Rack equipment frozen');
 assert.equal(newRack.equipment['blanking:1'].depth,oldRack.equipment['blanking:1'].depth,'Existing 1U panel depth retained');
 assert.equal(sha(Buffer.from(newRack.equipment['blanking:1'].data.buffer)),sha(Buffer.from(oldRack.equipment['blanking:1'].data.buffer)),'Existing 1U panel geometry/material retained');
 for(const [key,value] of Object.entries(newRack.equipment))if(key.startsWith('blanking:')){const count=Number(key.split(':')[1]),single=newRack.equipment['blanking:1'].data;assert.equal(value.depth,newRack.equipment['blanking:1'].depth);assert.equal(value.data.length,single.length*count,'One identical physical mesh per occupied U');for(let panel=0;panel<count;panel++)for(let i=0;i<single.length;i++){const actual=value.data[panel*single.length+i],expected=single[i]+(i%11===1?(panel-(count-1)/2)*newRack.unit:0);assert.ok(near(actual,expected,EPS),'Every panel is the existing 1U mesh with Y translation only');}}
 report.checks.push('Authorized Rack exception: only multi-U blanking batches change; existing 1U mesh/material repeated per U; all structure, other devices, routes, sockets, records and poses frozen');
 for(let i=0;i<=1000;i++){
  const p=i/1000;
  assert.deepEqual(plain(newCore.assemblySnapshot(p)),plain(oldCore.assemblySnapshot(p)),'Default controller snapshot unchanged at '+p);
  const a=new Float32Array(5),b=new Float32Array(5);oldCore.cameraKey(p,a);newCore.cameraKey(p,b);assert.deepEqual(a,b,'Default camera unchanged at '+p);
 }
 const changed=cp.execFileSync('git',['diff','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 assert.deepEqual(changed.filter(p=>/^(integration\/|engine\/|app\/.*(?:cycle|telemetry|agent))/i.test(p)),[],'Cycle / Telemetry / Agent / engine untouched');
 report.checks.push('Frozen bare GLB, default procedural fallback, profile, SSD/ports/gold/Rack and 1001 default poses/cameras retained');
 return {old,now,oldCore,newCore,timeline};
}
function coolingTimeline(report,oldCore,newCore,timeline){
 const sample=newCore.public.coolingAssemblyState;
 assert.equal(typeof sample,'function','Cooling state is a pure, testable public sampler');
 let previous=null;
 for(let i=0;i<=1000;i++){
  const p=i/1000,s=plain(sample(p)),original=plain(oldCore.l10State(p));
  for(const key of ['board','packages','io'])assert.equal(s[key],1,'Accepted bare hardware remains seated: '+key);
  for(const key of ['boardLift','packageLift','ioLift'])assert.equal(s[key],0,'No repeat assembly of accepted bare hardware: '+key);
  assert.equal(s.lid,original.lid,'Original lid progress curve retained');
  const ms=timeline.timeAt(p,'coolingV2'),smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10);};
  assert.ok(near(s.coolingLift,1-smooth((ms-7500)/2100),1e-9),'Plate travel follows elapsed seconds with stationary arrival');
  assert.ok(near(s.plumbingLift,.60*(1-smooth((ms-9300)/600)),1e-9));
  assert.ok(near(s.plumbingZ,.10*(1-smooth((ms-9900)/600)),1e-9));
  assert.ok(near(s.flow,smooth((ms-10500)/500)*(1-smooth((ms-14300)/800)),1e-9),'Flow reveal/restore follows the explicit V2 second boundaries');
  assert.ok(near(s.flowTravel,Math.max(0,ms/1000-10.5)*.85,1e-9),'Fluid distance moves at constant authored .85 units/s');
  assert.ok(Number.isFinite(s.coolingLift)&&s.coolingLift>=0&&Number.isFinite(s.plumbingLift)&&s.plumbingLift>=0);
  assert.ok(s.coolingVisibility>=0&&s.coolingVisibility<=1&&s.plumbingVisibility>=0&&s.plumbingVisibility<=1);
  if(previous){assert.ok(s.coolingLift<=previous.coolingLift+EPS,'Plate descent never reverses');assert.ok(s.plumbingLift<=previous.plumbingLift+EPS,'Plumbing descent never reverses');}
  if(s.flow>0){assert.equal(s.coolingLift,0,'Flow only after coldplates seat');assert.equal(s.plumbingLift,0,'Flow only after plumbing seats');}
  if(p>=.345){assert.equal(s.flow,0,'Flow removed before opaque hero and lid');assert.equal(s.coolingLift,0);assert.equal(s.plumbingLift,0);}
  assert.deepEqual(s,plain(sample(p)),'Seek is deterministic without a wall clock');
  const actual=plain(newCore.assemblySnapshot(p,{coolingV1:true})),expected=plain(oldCore.assemblySnapshot(p));
  assert.deepEqual(actual.l10,s,'Rendered cooling snapshot uses the same pure state');
  delete actual.l10;delete expected.l10;
  if(p<.40){delete actual.phase;delete expected.phase;}
  assert.deepEqual(actual,expected,'Rack geometry, motion and handoff are unchanged at '+p);
  previous=s;
 }
 assert.ok(near(sample(timeline.progressAt(7150,'coolingV2')).coolingVisibility,0,1e-12));assert.equal(sample(.248).coolingVisibility,1);
 assert.equal(sample(.278).coolingLift,0);assert.equal(sample(.292).plumbingLift,0);assert.equal(sample(.292).plumbingZ,0);
 assert.ok(sample(.310).flow>0&&sample(.325).flow>0,'Authored flowing interval exists');
 assert.ok(sample(.324).flowTravel>sample(.304).flowTravel,'Authored fluid travel advances along path');
 assert.equal(sample(.376).flow,0,'Solid-metal interval precedes lid descent');
 report.checks.push('1001 deterministic cooling states: seated bare board, second-based plate/plumbing descent and constant fluid speed, explicit reveal/restore, solid before lid, unchanged Rack from .40');
}
function allTriangles(asset){return asset.primitives.flatMap(p=>triangles(p.data,p.name).map(t=>({...t,layer:p.layer,material:p.material.name,component:p.name.replace(/^Cooling V1 \/ [^/]+ \/ /,'').replace(/#\d+$/,'')})));}
function frozenCoolingGeometry(report,previous,current,oldContract,contract){
 for(const key of ['id','sourceBareGLBSHA256','seats','mounts','flowRoutes','layers','envelope'])assert.deepEqual(contract[key],oldContract[key],'Frozen V2 contact/route contract: '+key);
 const domains=[];
 for(const [component,y,z] of [['supply',.066,-.43],['return',.100,-.33]])domains.push({id:component+'-header',contains:t=>t.layer==='cooling-plumbing'&&t.component===component&&t.material==='Brushed nickel'&&t.v.every(v=>v[0]>=-1.792-EPS&&v[0]<=1.792+EPS&&Math.hypot(v[1]-y,v[2]-z)<=.017+EPS)});
 for(const seat of contract.seats){
  const [x,,z]=seat.center,w=seat.plateWidth,d=seat.plateDepth;
  domains.push({id:seat.id+'-cover-edge',contains:t=>t.layer==='cooling'&&t.component===seat.id&&t.material===(seat.kind==='CPU'?'CPU satin nickel cover':'GPU machined nickel cover')&&t.v.every(v=>Math.abs(v[0]-x)<=w/2+EPS&&Math.abs(v[2]-z)<=d/2+EPS&&v[1]>=seat.coverBottom-EPS&&v[1]<=seat.coverTop+EPS)});
  for(const port of ['inlet','outlet']){
   const p=seat[port],start=z+d/2-.012,end=p[2]+.008;
   domains.push({id:seat.id+'-'+port+'-ferrule',contains:t=>t.layer==='cooling-frame'&&t.component===seat.id&&['Machined nickel fittings','Gasket'].includes(t.material)&&t.v.every(v=>v[2]>=start-EPS&&v[2]<=end+EPS&&Math.hypot(v[0]-p[0],v[1]-p[1])<=.020+EPS&&Math.hypot(v[0]-p[0],v[1]-p[1])>=.0145-EPS)});
  }
 }
 const oldTris=allTriangles(previous),newTris=allTriangles(current),allowed=t=>domains.some(d=>d.contains(t));
 const shape=t=>JSON.stringify([t.layer,t.component,t.material,...t.v.map(v=>v.map(n=>+n.toFixed(7))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
 const frozen=tris=>tris.filter(t=>!allowed(t)).map(shape).sort(),counts=values=>{const m=new Map();for(const v of values)m.set(v,(m.get(v)||0)+1);return m;};
 const original=frozen(oldTris),candidate=frozen(newTris),oldCounts=counts(original),newCounts=counts(candidate);
 const missing=[...oldCounts].flatMap(([t,n])=>Array(Math.max(0,n-(newCounts.get(t)||0))).fill(t)),added=[...newCounts].flatMap(([t,n])=>Array(Math.max(0,n-(oldCounts.get(t)||0))).fill(t));
 report.localizedGeometry={baseline,domains:domains.map(d=>({id:d.id,oldTriangles:oldTris.filter(d.contains).length,newTriangles:newTris.filter(d.contains).length})),frozenTrianglesBefore:original.length,frozenTrianglesAfter:candidate.length,missingCount:missing.length,addedCount:added.length,missingSamples:missing.slice(0,12).map(JSON.parse),addedSamples:added.slice(0,12).map(JSON.parse)};
 assert.equal(missing.length+added.length,0,'Every position/material triangle outside exact two header / six cover / twelve ferrule envelopes remains frozen');
 for(const domain of domains){const old=oldTris.filter(domain.contains),now=newTris.filter(domain.contains);assert.ok(old.length&&now.length,domain.id+' exists before/after');const ob=bounds(old.flatMap(t=>t.v)),nb=bounds(now.flatMap(t=>t.v));for(let axis=0;axis<3;axis++)assert.ok(nb.min[axis]>=ob.min[axis]-EPS&&nb.max[axis]<=ob.max[axis]+EPS,domain.id+' does not expand its original bounding box');}
 for(const layer of ['cooling-fluid','cooling-channels','cooling-mounts'])assert.deepEqual(plain(newTris.filter(t=>t.layer===layer).map(shape).sort()),plain(oldTris.filter(t=>t.layer===layer).map(shape).sort()),layer+' complete geometry/material is frozen');
 for(const p of current.primitives)for(let i=0;i<p.data.length;i+=12){const normal=Array.from(p.data.slice(i+3,i+6));assert.ok(normal.every(Number.isFinite)&&near(Math.hypot(...normal),1,.002),p.name+' finite unit split normals');assert.ok(Number.isFinite(p.data[i+6])&&Number.isFinite(p.data[i+7]),p.name+' finite UV');}
 report.checks.push('V3 authorized geometry ledger: two unchanged-radius headers, six cover edge envelopes and twelve unchanged-bore ferrules only; all other position/material triangles and complete route/contact contracts frozen');
}
function fluidJunctions(report,core,contract){
 const bind=core.public.coolingFlowBindings;assert.equal(typeof bind,'function');
 const routes=Object.fromEntries(contract.flowRoutes.map(r=>[r.id,r])),bindings=plain(bind(contract.flowRoutes)),period=.38;
 assert.deepEqual(Object.keys(bindings).sort(),Object.keys(routes).sort(),'Exactly 22 route bindings');
 const smoother=t=>t*t*t*(t*(t*6-15)+10),modDiff=(a,b)=>{const d=a-b;return d-Math.round(d/period)*period;};
 const phase=(r,s)=>{const b=bindings[r.id],q=Math.max(0,Math.min(1,(r.uvOffset+s-b.route[3])/b.phase[0]));return r.uvOffset+s+b.phase[1]*smoother(q);};
 for(const r of contract.flowRoutes){const b=bindings[r.id];assert.equal(b.period,period);assert.equal(b.route.length,4);assert.equal(b.phase.length,2);assert.ok([...b.route,...b.phase].every(Number.isFinite));assert.equal(b.route[0],r.semantic==='supply'?-1:r.semantic==='return'?1:0);assert.equal(b.route[1],r.uvOffset);assert.equal(b.route[2],r.length);}
 const rows=[];
 for(const seat of contract.seats){
  const inlet=routes[seat.id+'/inlet'],channel=routes[seat.id+'/channels'],outlet=routes[seat.id+'/outlet'],b=bindings[inlet.id],length=inlet.length+channel.length+outlet.length;
  for(const r of [inlet,channel,outlet]){assert.equal(bindings[r.id].route[3],inlet.uvOffset);assert.ok(near(bindings[r.id].phase[0],length,1e-10));assert.equal(bindings[r.id].phase[1],b.phase[1]);}
  assert.ok(Math.abs(b.phase[1])<=period/2+1e-10,'Bounded correction is at most half a packet');
  const joins=[['supply/inlet',routes['supply-header'].uvOffset+inlet.points[0][0]-routes['supply-header'].points[0][0],phase(inlet,0)],['inlet/channel',phase(inlet,inlet.length),phase(channel,0)],['channel/outlet',phase(channel,channel.length),phase(outlet,0)],['outlet/return',phase(outlet,outlet.length),routes['return-header'].uvOffset+outlet.points.at(-1)[0]-routes['return-header'].points[0][0]]];
  for(const [label,a,c]of joins)for(const travel of [0,.17,.85,1.733,3.655])assert.ok(near(modDiff(a-travel,c-travel),0,EPS),seat.id+' '+label+' periodic packet phase is continuous within actual Float32 route-coordinate precision');
  let minDerivative=Infinity,maxDerivative=-Infinity;
  for(let i=0;i<=1000;i++){const q=i/1000,derivative=1+b.phase[1]/length*30*q*q*(q-1)*(q-1);assert.ok(derivative>0,'No reverse transport or packet folding');minDerivative=Math.min(minDerivative,derivative);maxDerivative=Math.max(maxDerivative,derivative);}
  for(const q of [0,1])assert.equal(1+b.phase[1]/length*30*q*q*(q-1)*(q-1),1,'Exact unit phase derivative at both physical manifold joins');
  rows.push({seat:seat.id,length,correction:b.phase[1],joins:joins.map(([id,a,c])=>({id,phaseMismatch:modDiff(a,c)})),minPhaseDerivative:minDerivative,maxPhaseDerivative:maxDerivative,manifoldEndpointSpeed:.85});
 }
 for(const [a,b]of [['supply-trunk','supply-header'],['return-header','return-trunk']])assert.ok(near(modDiff(phase(routes[a],routes[a].length),phase(routes[b],0)),0,EPS),a+' joins '+b+' within actual Float32 route-coordinate precision');
 report.fluidJunctionAudit={period,globalPhaseSpeed:.85,rows,method:'Actual unchanged route lengths and UV offsets; modulo phase checked at all six supply/inlet/channel/outlet/return joins and both trunks, with positive interior derivative and exact endpoint speed match.'};
 report.checks.push('All 22 UV route bindings: continuous packet phase at six full circuits and trunks, forward local phase, matched manifold endpoint speed');
}
function coolingGeometry(report,bare,companion,contract){
 const actualSeats=extractSeats(bare),tris=allTriangles(companion),bareTris=allTriangles(bare);
 const pick=(layer,id,material)=>tris.filter(t=>t.layer===layer&&t.component===id&&(!material||t.material===material));
 assert.equal(contract.seats.length,6);assert.equal(new Set(contract.seats.map(s=>s.id)).size,6);assert.equal(contract.mounts.length,24);
 assert.deepEqual(contract.seats.map(s=>s.id).sort(),['CPU-L','CPU-R','GPU-L-INNER','GPU-L-OUTER','GPU-R-INNER','GPU-R-OUTER']);
 assert.deepEqual(Array.from(companion.metadata.layers).sort(),['cooling','cooling-channels','cooling-fluid','cooling-frame','cooling-mounts','cooling-plumbing']);
 const sampleRectangle=(b,callback)=>{for(const fx of [.02,.5,.98])for(const fz of [.02,.5,.98])callback(b.min[0]+(b.max[0]-b.min[0])*fx,b.min[2]+(b.max[2]-b.min[2])*fz);};
 const contactRows=[];
 for(const seat of contract.seats){
  const actual=actualSeats.find(s=>s.id===seat.sourceComponent);assert.ok(actual,seat.id+' maps to a frozen package');
  assert.ok(vectorNear(actual.center,seat.center)&&vectorNear(actual.bounds.min,seat.opticalMin)&&vectorNear(actual.bounds.max,seat.opticalMax),seat.id+' uses actual frozen die bounds');
  assert.ok(near(seat.timBottom,actual.center[1])&&near(seat.timTop-seat.timBottom,.0008));
  assert.ok(near(seat.timTop,seat.copperContactBottom)&&near(seat.copperContactTop,seat.bodyBottom));
  const tim=pick('cooling-frame',seat.id,'TIM'),copper=pick('cooling-frame',seat.id,'Machined copper'),cover=pick('cooling',seat.id,seat.kind==='CPU'?'CPU satin nickel cover':'GPU machined nickel cover');
  assert.ok(tim.length&&copper.length&&cover.length,seat.id+' emits TIM, copper and metal cover');
  const tb=bounds(tim.flatMap(t=>t.v));assert.ok(vectorNear(tb.min,[...actual.bounds.min.slice(0,1),seat.timBottom,actual.bounds.min[2]])&&vectorNear(tb.max,[actual.bounds.max[0],seat.timTop,actual.bounds.max[2]]),seat.id+' actual TIM footprint and thickness match the die');
  sampleRectangle(tb,(x,z)=>{
   assert.ok(hasHorizontalTriangle(actual.triangles,x,z,seat.timBottom,1),seat.id+' actual die supports TIM');
   assert.ok(hasHorizontalTriangle(tim,x,z,seat.timBottom,-1)&&hasHorizontalTriangle(tim,x,z,seat.timTop,1),seat.id+' actual TIM bottom/top planes');
   assert.ok(hasHorizontalTriangle(copper,x,z,seat.copperContactBottom,-1)&&hasHorizontalTriangle(copper,x,z,seat.copperContactTop,1),seat.id+' actual stepped copper contacts TIM and body');
  });
  assert.ok(hasHorizontalTriangle(cover,seat.center[0],seat.center[2],seat.coverBottom,-1)&&hasHorizontalTriangle(cover,seat.center[0],seat.center[2],seat.coverTop,1),seat.id+' true sealed cover planes');
  const feet=contract.mounts.filter(m=>m.seatId===seat.id),ft=pick('cooling-mounts',seat.id);assert.equal(feet.length,4);assert.equal(ft.length,48,'Four actual six-sided feet per plate');
  for(const foot of feet){
   const support=bareTris.filter(t=>t.label.includes('/ '+seat.sourceComponent+'#')&&t.material===foot.contactMaterial);
   assert.ok(near(foot.min[1],.004)&&near(foot.max[1],seat.bodyBottom),'Foot seats frame and reaches plate body');
   sampleRectangle(foot,(x,z)=>{assert.ok(hasHorizontalTriangle(ft,x,z,foot.min[1],-1)&&hasHorizontalTriangle(ft,x,z,foot.max[1],1),foot.id+' actual contact foot');assert.ok(hasHorizontalTriangle(support,x,z,foot.min[1],1),foot.id+' supported by actual existing frame');});
  }
  for(const t of ft)assert.ok(feet.some(f=>t.min.every((v,i)=>v>=f.min[i]-EPS&&t.max[i]<=f.max[i]+EPS)),'No undeclared support foot geometry');
  contactRows.push({id:seat.id,sourceComponent:actual.id,actualDieY:actual.center[1],timBounds:tb,feet:feet.length});
 }
 let maxY=-Infinity,minY=Infinity;
 for(const t of tris){maxY=Math.max(maxY,t.max[1]);minY=Math.min(minY,t.min[1]);assert.ok(t.max[1]<.125-EPS,'Every cooling vertex clears original closed-lid underside');assert.ok(t.min[1]>-.113&&t.min[0]>=-1.98&&t.max[0]<=1.98&&t.min[2]>=-3.14&&t.max[2]<=-.18,'Cooling stays within original compute/cooling bay');}
 report.contacts=contactRows;report.envelope={minY,maxY,lidBottomY:.125,minimumVerticalLidClearance:.125-maxY};
 report.checks.push('Six actual GLB die/TIM/copper stacks, 24 frame-supported feet, exact covers and unchanged lid clearance');
 return {tris,bareTris};
}
function coolingPaths(report,companion,contract,profile){
 const routes=contract.flowRoutes,map=new Map(routes.map(r=>[r.id,r]));assert.equal(map.size,routes.length);assert.equal(routes.length,22,'Two trunks, two headers and six inlet/channel/outlet triples');
 const rows=[];
 for(const r of routes){
  assert.ok(Array.isArray(r.points)&&r.points.length>=2&&r.points.every(p=>p.length===3&&p.every(Number.isFinite)));assert.equal(r.arcLengths.length,r.points.length);assert.equal(r.arcLengths[0],0);assert.ok(near(pathLength(r.points),r.length,1e-5));
  for(let i=1;i<r.points.length;i++){assert.ok(r.arcLengths[i]>r.arcLengths[i-1],'Positive directed path segment');assert.ok(near(r.arcLengths[i]-r.arcLengths[i-1],Math.hypot(...sub(r.points[i],r.points[i-1])),2e-6));}
  const ps=companion.primitives.filter(p=>p.layer==='cooling-fluid'&&p.name.startsWith('Cooling V1 / cooling-fluid / '+r.id+'#'));assert.ok(ps.length,r.id+' has actual fluid geometry');
  let minU=Infinity,maxU=-Infinity,vertices=0;
  for(const p of ps)for(let i=0;i<p.data.length;i+=12){
   const u=p.data[i+6],arc=u-r.uvOffset;minU=Math.min(minU,u);maxU=Math.max(maxU,u);vertices++;
   let k=r.arcLengths.findIndex(v=>near(v,arc,3e-5));assert.ok(k>=0,r.id+' UV is authored directed arc distance');
   const radius=Math.hypot(...[0,1,2].map(d=>p.data[i+d]-r.points[k][d]));assert.ok(near(radius,r.radius,3e-6),r.id+' actual fluid ring lies on its declared path');
  }
  assert.ok(near(minU,r.uvOffset,3e-5)&&near(maxU,r.uvOffset+r.length,3e-5),r.id+' UVs advance from inlet to outlet');
  rows.push({id:r.id,length:r.length,vertices,minU,maxU});
 }
 const supply=map.get('supply-trunk'),ret=map.get('return-trunk'),sh=map.get('supply-header'),rh=map.get('return-header');
 assert.ok(vectorNear(supply.points[0],profile.coolant.supply),'Supply starts at retained rear coupling axis');
 assert.ok(vectorNear(ret.points.at(-1),profile.coolant.return),'Return ends at retained rear coupling axis');
 assert.ok(vectorNear(supply.points.at(-1),sh.points[0])&&vectorNear(rh.points.at(-1),ret.points[0]),'Trunks connect to header ends');
 for(const s of contract.seats){const [a,b,c]=s.routeIds.map(id=>map.get(id));assert.ok(a&&b&&c);assert.equal(a.semantic,'supply');assert.equal(b.semantic,'plate-channel');assert.equal(c.semantic,'return');assert.equal(a.to,b.id);assert.equal(b.from,a.id);assert.equal(b.to,c.id);assert.equal(c.from,b.id);assert.equal(a.from,'supply-header');assert.equal(c.to,'return-header');
  assert.ok(vectorNear(a.points.at(-1),s.inlet)&&vectorNear(b.points[0],s.inlet)&&vectorNear(b.points.at(-1),s.outlet)&&vectorNear(c.points[0],s.outlet),'Branch/plate fittings meet without gaps');
  assert.ok(pathDistance(a.points[0],sh.points)<EPS&&pathDistance(c.points.at(-1),rh.points)<EPS,'Each branch meets its correct manifold');
  assert.ok(near(b.uvOffset,a.uvOffset+a.length,3e-5)&&near(c.uvOffset,b.uvOffset+b.length,3e-5),'Fluid travel phase is continuous through every plate');
 }
 report.flowRoutes=rows;report.checks.push('22 actual fluid meshes follow directed arc-length UVs; six parallel circuits join supply/header/plate/return without gaps');
}

function sealedManifolds(report,tris,contract){
 const hits=(faces,x,y,zlo,zhi)=>{
  const zs=[];
  for(const t of faces){if(x<t.min[0]||x>t.max[0]||y<t.min[1]||y>t.max[1]||t.max[2]<zlo||t.min[2]>zhi)continue;
   const [a,b,c]=t.v,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)continue;
   const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d;
   if(Math.min(u,v,1-u-v)<-1e-7)continue;
   const z=u*a[2]+v*b[2]+(1-u-v)*c[2];if(z>zlo&&z<zhi)zs.push(z);
  }
  zs.sort((a,b)=>a-b);return zs.filter((v,i)=>!i||!near(v,zs[i-1]));
 };
 const rows=[],endCaps=[];let leaks=0;
 for(const semantic of ['supply','return']){
  const header=contract.flowRoutes.find(r=>r.id===semantic+'-header'),faces=tris.filter(t=>t.layer==='cooling-plumbing'&&t.component===semantic&&t.material==='Brushed nickel');
  assert.ok(faces.length);const y=header.points[0][1],z=header.points[0][2];
  for(const seat of contract.seats){const route=contract.flowRoutes.find(r=>r.id===seat.id+(semantic==='supply'?'/inlet':'/outlet')),joint=semantic==='supply'?route.points[0]:route.points.at(-1);
   for(const dx of [-.002,0,.002])for(const dy of [-.002,0,.002]){
    const crossings=hits(faces,joint[0]+dx,y+dy,z+.009,z+.019);
    const sealed=crossings.length>=2&&crossings.at(-1)-crossings[0]>.002;
    if(!sealed)leaks++;rows.push({header:semantic,seat:seat.id,dx,dy,crossings,sealed});
   }
  }
  const end=semantic==='supply'?header.points.at(-1)[0]:header.points[0][0];
  const swapped=faces.map(t=>({v:t.v.map(p=>[p[2],p[1],p[0]]),min:[t.min[2],t.min[1],t.min[0]],max:[t.max[2],t.max[1],t.max[0]]}));
  for(const dz of [-.002,0,.002])for(const dy of [-.002,0,.002]){
   const crossings=hits(swapped,z+dz,y+dy,semantic==='supply'?end+EPS:end-.025,semantic==='supply'?end+.025:end-EPS);
   const sealed=crossings.length>=2&&crossings.at(-1)-crossings[0]>.002;
   if(!sealed)leaks++;endCaps.push({header:semantic,endX:end,dz,dy,crossings,sealed});
  }
 }
 report.manifoldSealAudit={rays:rows.length+endCaps.length,unsealedRays:leaks,samples:rows,endCaps,method:'108 rays through actual opposite (+Z/front) walls at the 12 branch axes plus 18 rays through the two unused header ends; requires distinct inner/outer metal surfaces and positive wall thickness.'};
 assert.equal(leaks,0,'Branch bores must not puncture the unconnected opposite manifold wall');
 report.checks.push('126 actual-triangle rays verify sealed opposite header walls and both unused header ends');
}
function coolingCollisions(report,tris,bareTris,contract){
 const index=spatialIndex(bareTris),contacts=[],collisions=[],groups=new Map();let pairs=0,tested=0;
 const allowedContact=(t,b)=>{
  const seat=contract.seats.find(s=>s.id===t.component);
  if(!seat||!b.label.includes('/ '+seat.sourceComponent+'#'))return false;
  if(t.layer==='cooling-frame'&&t.material==='TIM'&&b.material===seat.kind+' exposed optical face')return near(b.min[1],seat.timBottom)&&near(b.max[1],seat.timBottom)&&t.min[1]>=seat.timBottom-EPS&&t.max[1]<=seat.timTop+EPS&&t.min[0]>=seat.opticalMin[0]-EPS&&t.max[0]<=seat.opticalMax[0]+EPS&&t.min[2]>=seat.opticalMin[2]-EPS&&t.max[2]<=seat.opticalMax[2]+EPS;
  if(t.layer==='cooling-mounts')return contract.mounts.some(m=>m.seatId===seat.id&&b.material===m.contactMaterial&&near(b.max[1],m.min[1])&&near(t.min[1],m.min[1])&&t.min.every((v,i)=>v>=m.min[i]-EPS&&t.max[i]<=m.max[i]+EPS));
  return false;
 };
 for(const t of tris)for(const b of index(t)){if(!overlap(t,b,-1e-8))continue;tested++;if(!triangleTriangle(t,b))continue;
  if(allowedContact(t,b)){if(contacts.length<24)contacts.push({cooling:t.label,bare:b.label,plane:t.min[1]});continue;}
  pairs++;const key=t.label+' | '+b.label;groups.set(key,(groups.get(key)||0)+1);
  if(collisions.length<24)collisions.push({cooling:t.label,coolingMaterial:t.material,bare:b.label,bareMaterial:b.material,coolingVertices:t.v,bareVertices:b.v});
 }
 report.bareCollisionAudit={testedPairs:tested,collisionPairs:pairs,groups:[...groups].map(([pair,count])=>({pair,count})),samples:collisions,approvedContactSamples:contacts,contactTolerance:EPS};
 assert.equal(pairs,0,'Cooling cannot penetrate immutable bareboard, network or service hardware');
 const walls=tris.filter(t=>t.layer!=='cooling-fluid');
 const wallIndex=spatialIndex(walls),fluid=tris.filter(t=>t.layer==='cooling-fluid'),fluidHits=[],fluidGroups=new Map();let fluidPairs=0;
 for(const t of fluid)for(const wall of wallIndex(t)){if(triangleTriangle(t,wall)){fluidPairs++;const key=t.label+' | '+wall.label;fluidGroups.set(key,(fluidGroups.get(key)||0)+1);if(fluidHits.length<24)fluidHits.push({fluid:t.label,wall:wall.label,wallMaterial:wall.material,fluidVertices:t.v,wallVertices:wall.v});}}
 report.fluidWallAudit={collisionPairs:fluidPairs,groups:[...fluidGroups].map(([pair,count])=>({pair,count})),samples:fluidHits,scope:'Actual fluid stream surfaces vs every companion solid surface, including annular hose/port bores, headers, copper floors/walls/dividers and nickel covers.'};
 assert.equal(fluidPairs,0,'Fluid remains inside open passages and cannot cross a divider, floor or closed cover');
 // A whole closed fluid ring could otherwise be contained inside a copper
 // block without crossing its surface. The channel center must remain outside
 // the closed divider solids; sample each authored point and segment midpoint.
 const dividerGroups=new Map();for(const t of walls.filter(t=>t.layer==='cooling-channels')){if(!dividerGroups.has(t.component))dividerGroups.set(t.component,[]);dividerGroups.get(t.component).push(t);}
 for(const s of contract.seats){const route=contract.flowRoutes.find(r=>r.id===s.id+'/channels'),dividers=dividerGroups.get(s.id);assert.ok(dividers?.length);
  const samples=[...route.points,...route.points.slice(1).map((p,i)=>p.map((v,k)=>(v+route.points[i][k])/2))];
  for(const p of samples)assert.ok(!insideClosedSurface(p,dividers),s.id+' channel center is not enclosed inside a divider');
 }
 report.checks.push('Actual triangle SAT detects no unapproved bareboard intersections or fluid-wall crossings; named TIM/frame contacts only and divider-containment checks');
}
function coolingMotion(report,tris,bareTris,sample,timeline){
 const plumbing=tris.filter(t=>t.layer==='cooling-plumbing'),plates=tris.filter(t=>!['cooling-plumbing','cooling-fluid','cooling-mounts'].includes(t.layer));
 const bareIndex=spatialIndex(bareTris),plateIndex=spatialIndex(plates),mountIndex=spatialIndex(tris.filter(t=>t.layer==='cooling-mounts')),rows=[],hits=[];let pairs=0;
 const moved=(t,y,z)=>({...t,v:t.v.map(p=>[p[0],p[1]+y,p[2]+z]),min:[t.min[0],t.min[1]+y,t.min[2]+z],max:[t.max[0],t.max[1]+y,t.max[2]+z]});
 for(let i=0;i<20;i++){
  const timeMs=9300+1200*i/19,p=timeline.progressAt(timeMs,'coolingV2'),s=sample(p);let count=0;
  for(const t of plumbing){
   const actual=moved(t,s.plumbingLift,s.plumbingZ||0),relative=moved(t,s.plumbingLift-s.coolingLift,s.plumbingZ||0);
   for(const [type,check,index]of [['bare',actual,bareIndex],['mount',actual,mountIndex],['plate',relative,plateIndex]])for(const b of index(check))if(triangleTriangle(check,b)){
    count++;pairs++;if(hits.length<30)hits.push({progress:p,type,plumbing:t.label,obstacle:b.label,plumbingVertices:check.v,obstacleVertices:b.v});
   }
  }
  rows.push({timeMs,progress:p,plumbingLift:s.plumbingLift,plumbingZ:s.plumbingZ||0,coolingLift:s.coolingLift,collisionPairs:count});
 }
 report.plumbingMotionAudit={samples:rows,collisionPairs:pairs,firstCollisions:hits,tolerance:EPS,method:'20 actual triangle samples of full plumbing transform against immutable bare hardware and same-time plate/frame/mount transforms; no AABB-only clearance claim.'};
 assert.equal(pairs,0,'Visible plumbing approach may not cross seated plates or immutable bare hardware');
 report.checks.push('20 actual-triangle plumbing installation poses clear bare hardware and moving plate/frame assemblies');
}
async function main(){
 const outputDir=path.resolve(root,process.env.PA_L10_COOLING_EVIDENCE_DIR||'docs/screenshots/l10-cinematic/cooling-v3/evidence'),relative=path.relative(root,outputDir);
 assert.ok(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'Evidence stays in repository');
 const report={baseline,passed:false,checks:[],errors:[],limits:['Independent geometric validation of a conceptual assembly, not manufacturing CAD, a verified OEM retention design or CFD.','Visual opacity/flow animation, real-clock playback, late loading failures and WebGL context lifecycle require the separate browser suite.','Triangle SAT plus named contact rules is complemented by channel containment sampling; arbitrary watertight solid topology is not certified.']};
 let bare,companion,previous;
 try{
  const originalSource=text(read('app/qa/l10-cooling-v2.cjs')),candidateSource=text(read('app/qa/l10-cooling-v3.cjs'));
  const safetyFunctions=['triangles','separated','triangleTriangle','hasHorizontalTriangle','spatialIndex','pointSegmentDistance','pathDistance','pathLength','insideClosedSurface','helperFixtures','extractSeats','coolingTimeline','fluidJunctions','coolingGeometry','coolingPaths','sealedManifolds','coolingCollisions','coolingMotion'];
  const body=(source,name)=>{const begin=source.indexOf('function '+name+'(');assert.ok(begin>=0);const end=source.indexOf('\nfunction ',begin+1);const asyncEnd=source.indexOf('\nasync function ',begin+1);return source.slice(begin,Math.min(...[end,asyncEnd].filter(n=>n>0))).trim();};
  for(const name of safetyFunctions)assert.equal(body(candidateSource,name),body(originalSource,name),'Original engineering safety assertions are unchanged: '+name);
  report.safetyAssertionReuse={source:'app/qa/l10-cooling-v2.cjs',functions:safetyFunctions,byteIdentical:true};
  helperFixtures();report.checks.push('Independent collision/path helpers retain piercing, coplanar, clearance and full-containment negative fixtures');
  bare=await loadGLB();const preserved=immutableBaseline(report,bare.bytes);
  companion=await loadGLB('app/static/models/l10-cooling-v1/cooling-assembly.glb');
  const contract=JSON.parse(text(read('app/static/models/l10-cooling-v1/assembly.json')));
  assert.equal(contract.id,'l10-cooling-assembly-v1');assert.equal(contract.sourceBareGLBSHA256,sha(bare.bytes));assert.equal(contract.sha256,sha(companion.bytes));
  for(const key of ['id','sourceBareGLBSHA256','seats','mounts','flowRoutes','layers','envelope'])assert.deepEqual(plain(companion.asset.metadata.extras[key]),contract[key],'Embedded contract matches external '+key);
  report.companion={sha256:sha(companion.bytes),bytes:companion.bytes.length,primitives:companion.asset.primitives.length,layers:companion.asset.metadata.layers};
  previous=await loadGLB('app/static/models/l10-cooling-v1/cooling-assembly.glb',history('app/static/models/l10-cooling-v1/cooling-assembly.glb'));
  frozenCoolingGeometry(report,previous.asset,companion.asset,JSON.parse(text(history('app/static/models/l10-cooling-v1/assembly.json'))),contract);
  const geometry=coolingGeometry(report,bare.asset,companion.asset,contract);
  coolingPaths(report,companion.asset,contract,preserved.now.hardware.profile);
  const collect=fn=>{try{fn();}catch(error){report.errors.push(error.stack);}};
  collect(()=>fluidJunctions(report,preserved.newCore,contract));
  collect(()=>sealedManifolds(report,geometry.tris,contract));
  collect(()=>coolingCollisions(report,geometry.tris,geometry.bareTris,contract));
  collect(()=>coolingTimeline(report,preserved.oldCore,preserved.newCore,preserved.timeline));
  collect(()=>coolingMotion(report,geometry.tris,geometry.bareTris,preserved.newCore.public.coolingAssemblyState,preserved.timeline));
  const camera=preserved.newCore.public.coolingAssemblyCamera;assert.equal(typeof camera,'function');
  for(let i=400;i<=1000;i++){const s=plain(camera(i/1000));assert.equal(s.bare,0);assert.equal(s.detail,0);assert.equal(s.cooling,0);assert.equal(s.reveal,0);}
  report.checks.push('Companion camera influence is zero for every Rack/bridge sample from .40 to 1');
  report.passed=report.errors.length===0;if(!report.passed)process.exitCode=1;
 }catch(error){report.errors.push(error.stack);process.exitCode=1;}
 finally{bare?.asset.disposeImages();companion?.asset.disposeImages();previous?.asset.disposeImages();}
 fs.mkdirSync(outputDir,{recursive:true});const output=path.join(outputDir,(process.argv[2]||'cooling-geometry')+'.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,checks:report.checks,companion:report.companion,errors:report.errors,output},null,2));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
