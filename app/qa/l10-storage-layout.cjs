/* Physical E1.S fit and shared rack/L10 facade contract. No browser mocks. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={window:{},Float32Array,Math};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/rack-equipment-scene.js'),'utf8'),sandbox);
const api=sandbox.window.PARackScene,l=api.storageLayout,front=api.createComputeFront();
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<eps;
assert.equal(l.slots.length,8);assert.equal(new Set(l.slots.map(s=>s.id)).size,8);
assert.ok(Object.isFrozen(l)&&Object.isFrozen(l.slots)&&Object.isFrozen(l.slots[0].body.min));
assert.equal(front.slotLayoutId,l.id);assert.equal(front.storageLayout,l);assert.equal(front.finish,api.computeFinish);
for(const s of l.slots){
  assert.ok(near(s.body.width*l.mmPerUnit.x,15)&&near(s.body.height*l.mmPerUnit.y,33.75)&&near(s.body.depth*l.mmPerUnit.z,118.75));
  assert.ok(near(s.frontZ-s.rearZ,s.body.depth));
  assert.deepEqual(Array.from(s.axis),[0,0,-1]);
  assert.ok(near((s.body.min[0]+s.body.max[0])/2,s.x)&&near((s.body.min[1]+s.body.max[1])/2,s.y));
  assert.ok(near(s.y,s.aperture.y)&&near(s.y,s.carrier.y),'Body, carrier and aperture share one insertion axis');
  assert.ok(s.y-s.carrier.height/2>l.floorY&&s.y+s.carrier.height/2<l.lidBottomY,'Complete carrier clears bottom and lid');
  assert.ok(s.y-s.aperture.height/2>l.floorY&&s.y+s.aperture.height/2<l.lidBottomY,'Aperture does not cut through floor or lid');
  assert.ok(s.aperture.width>s.carrier.width&&s.carrier.width>s.body.width);
  assert.ok(s.aperture.height>s.carrier.height&&s.carrier.height>s.body.height);
}
for(let i=1;i<8;i++){
  assert.ok(near((l.slots[i].x-l.slots[i-1].x)*l.mmPerUnit.x,17));
  assert.ok(near((l.slots[i].x-l.slots[i-1].x-l.slots[i].carrier.width)*l.mmPerUnit.x,.6));
}
assert.ok(near(l.clearancesMM.bodyToFloor,1.2));assert.ok(near(l.clearancesMM.bodyToLid,2.8419708029));
assert.ok(near(l.clearancesMM.carrierToFloor,.275));assert.ok(near(l.clearancesMM.carrierToLid,1.9169708029));
assert.ok(l.bodyRearZ>2.035+.10,'Rear mating face stays clear of the existing management board');
assert.ok(l.slots[0].x-l.slots[0].carrier.width/2>-.7275,'First carrier clears adjacent left RJ45');
assert.ok(l.slots[7].x+l.slots[7].carrier.width/2<.5605,'Eighth carrier clears central management plate');

// Ray against actual triangle surfaces, through the fascia only. Carriers are
// allowed to occupy their front mouths; no backing plate may seal their path.
function intersections(x,y,zlo,zhi){
  let hits=0;const a=front.data;
  for(let i=0;i<a.length;i+=33){
    const ax=a[i],ay=a[i+1],bx=a[i+11],by=a[i+12],cx=a[i+22],cy=a[i+23];
    const d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(d)<1e-12)continue;
    const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d,w=1-u-v;
    if(Math.min(u,v,w)<-1e-7)continue;
    const z=u*a[i+2]+v*a[i+13]+w*a[i+24];if(z>zlo&&z<zhi)hits++;
  }return hits;
}
for(const s of l.slots)for(const dx of [-.44,0,.44])for(const dy of [-.40,0,.40])
  assert.equal(intersections(s.x+dx*s.body.width,s.y+dy*s.body.height,3.07,3.175),0,`${s.id} insertion path is not sealed by fascia`);
for(let i=1;i<8;i++)assert.ok(intersections((l.slots[i-1].x+l.slots[i].x)/2,l.bodyY,3.07,3.175)>0,'Physical divider remains between slots');
const ports=[[-1.52,-.054,.244,.068],[-1.13,-.054,.244,.068],[.995,-.058,.244,.068],[1.37,-.058,.244,.068],[1.235,.064,.187,.046],[1.466,.064,.187,.046],[-.778,-.048,.101,.078],[.960,.062,.099,.075],[.623,-.051,.092,.071],[.623,.042,.092,.071],...[-.061,-.013,.049].map(y=>[.737,y,.018,.012])];
for(const [x,y,w,h] of ports)for(const dx of [-.4,0,.4])for(const dy of [-.4,0,.4])
  assert.equal(intersections(x+dx*w,y+dy*h,3.07,3.179),0,'Required network/RJ45/USB path must pass through fascia, carrier and grille backing');
assert.equal(front.data.length%33,0);assert.ok(Array.from(front.data).every(Number.isFinite));

// The surrounding rack calls the same builder. Exact packed geometry/material
// bytes must be present, not a separately drawn approximation with equal RGB.
const rack=api.buildEditorialParts([{name:'same-compute-tray',mgx_type:'server',rack_u:40,rack_size:1}]);
const data=rack.equipment['server:1'].data,matching=api.createComputeFront(.30-.026).data;
const bytes=Buffer.from(data.buffer,data.byteOffset,data.byteLength),needle=Buffer.from(matching.buffer,matching.byteOffset,matching.byteLength);
assert.ok(bytes.indexOf(needle)>=0,'Rack contains the identical facade vertex and material stream');

// Record actual box/bevel bounds emitted by the hardware generator, while still
// building and testing its real vertex data. This catches an implementation
// disagreeing with correct layout metadata (rails, connector plane, and cages).
const hardware=fs.readFileSync(path.join(__dirname,'../static/js/l10-hardware.js'),'utf8');
const marker='return {data,box,bevel,cylinder,ring,screw,tube,line,tri,quad};';
assert.ok(hardware.includes(marker),'Geometry audit must instrument the real mesh builder');
sandbox.__primitives=[];
const instrumented=hardware.replace(marker,`return {data,box:(...a)=>{__primitives.push({type:'box',a});return box(...a);},bevel:(...a)=>{__primitives.push({type:'bevel',a});return bevel(...a);},cylinder,ring,screw,tube,line,tri,quad};`);
vm.runInNewContext(instrumented,sandbox);
const actual=sandbox.window.PAL10Hardware.build();
const color=(p,c)=>p.a[6].every((v,i)=>near(v,c[i]));
const bounds=p=>({min:p.a.slice(0,3).map((v,i)=>v-p.a[3+i]/2),max:p.a.slice(0,3).map((v,i)=>v+p.a[3+i]/2)});
const overlap=(a,b)=>a.min.every((v,i)=>Math.min(a.max[i],b.max[i])-Math.max(v,b.min[i])>1e-7);
const bodies=sandbox.__primitives.filter(p=>color(p,[.040,.045,.049])&&near(p.a[7],.32));
assert.equal(bodies.length,8,'Exactly eight actual 3D SSD bodies');
function hasHorizontalSurface(data,x,z,y,normal){
  for(let i=0;i<data.length;i+=36){
    if(!near(data[i+4],normal)||!near(data[i+1],y))continue;
    const ax=data[i],az=data[i+2],bx=data[i+12],bz=data[i+14],cx=data[i+24],cz=data[i+26];
    const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;
    const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
    if(Math.min(u,v,1-u-v)>=-1e-7)return true;
  }return false;
}
const actualClearances=[];
for(const s of l.slots){
  const p=bodies.find(p=>near(p.a[0],s.x));assert.ok(p,`${s.id} body exists on its declared slot axis`);
  const b=bounds(p);for(let i=0;i<3;i++){assert.ok(near(b.min[i],s.body.min[i]));assert.ok(near(b.max[i],s.body.max[i]));}
  // Kioxia XD8 published maximum: 15.35 thickness, 34.00 height,119.30 length.
  // Hold the front stop fixed and grow rearward; expand X/Y about the same axis.
  const max={min:[s.x-15.35/l.mmPerUnit.x/2,s.y-34/l.mmPerUnit.y/2,s.frontZ-119.30/l.mmPerUnit.z],max:[s.x+15.35/l.mmPerUnit.x/2,s.y+34/l.mmPerUnit.y/2,s.frontZ]};
  assert.ok(max.min[1]>l.floorY&&max.max[1]<l.lidBottomY,'Maximum SSD envelope clears existing 1U chassis');
  const rails=sandbox.__primitives.filter(q=>q.type==='box'&&Math.abs(q.a[2]-p.a[2])<q.a[5]/2&&color(q,[.40,.44,.46])&&q.a[3]<.01&&Math.abs(q.a[0]-s.x)<l.pitchMM/l.mmPerUnit.x/2);
  assert.equal(rails.length,2,`${s.id} actual pair of lower guides exists`);
  const guideClearances=[];
  for(const r of rails){
    const rb=bounds(r);assert.ok(!overlap(max,rb),`${s.id} maximum thickness must not intersect lower guide`);
    guideClearances.push((r.a[0]<s.x?max.min[0]-rb.max[0]:rb.min[0]-max.max[0])*l.mmPerUnit.x);
  }
  const tongues=sandbox.__primitives.filter(q=>q.type==='box'&&color(q,[.105,.13,.082])&&Math.abs(q.a[0]-s.x)<.01&&Math.abs(q.a[2]-s.rearZ)<.04);
  assert.equal(tongues.length,1,`${s.id} one actual rear PCB edge`);
  assert.ok(tongues[0].a[3]*l.mmPerUnit.x<tongues[0].a[4]*l.mmPerUnit.y/3,`${s.id} rear tongue must share the side-standing YZ board plane`);
  for(const z of [s.rearZ+.02,2.96,3.04,3.08]){
    assert.ok(hasHorizontalSurface(actual.meshes['l10-lid'].data,s.x,z,l.lidBottomY,-1),`${s.id} physical closed lid covers the full drive, including its service nose`);
    assert.ok(hasHorizontalSurface(actual.meshes['l10-chassis'].data,s.x,z,l.floorY,1),`${s.id} physical floor supports the full service nose`);
  }
  actualClearances.push({id:s.id,maximumBodyToLidMM:(l.lidBottomY-max.max[1])*l.mmPerUnit.y,maximumBodyToFloorMM:(max.min[1]-l.floorY)*l.mmPerUnit.y,minimumSideGuideClearanceMM:Math.min(...guideClearances)});
}
const frontBoards=sandbox.__primitives.filter(p=>color(p,[.028,.041,.034]));
const oldBoards=sandbox.__primitives.filter(p=>color(p,[.038,.095,.067])&&p.a[3]>.2&&p.a[5]>.2);
assert.equal(frontBoards.length,3,'Two BF3 and one CX7 concept board');
for(const a of frontBoards)for(const b of oldBoards)assert.ok(!overlap(bounds(a),bounds(b)),'New network PCB must not intersect an existing I/O PCB');
const cageWalls=sandbox.__primitives.filter(p=>p.type==='box'&&color(p,[.52,.57,.59])&&near(p.a[7],.81)&&p.a[2]>2.8&&p.a[5]>.3);
assert.equal(cageWalls.length,24,'Six actual four-wall network cages');
for(const wall of cageWalls){const b=bounds(wall);assert.ok(near(b.min[2],2.7915)&&near(b.max[2],3.181),'Internal network cage meets shared front cage without a gap');}
// Match core addAlpha exactly, including the pre-existing dark-metal lift.
const adapted=new Float32Array(front.data.length/11*12);
for(let s=0,d=0;s<front.data.length;s+=11,d+=12){
  for(let i=0;i<9;i++)adapted[d+i]=front.data[s+i];
  const metal=front.data[s+9];adapted[d+9]=metal===-3?.20:1;adapted[d+10]=metal===-3?.65:metal;adapted[d+11]=front.data[s+10];
  if(metal>.5&&front.data[s+6]*.2126+front.data[s+7]*.7152+front.data[s+8]*.0722<.14)for(let i=6;i<9;i++)adapted[d+i]*=1.25;
}
const chassis=actual.meshes['l10-chassis'].data;
assert.ok(Buffer.from(chassis.buffer,chassis.byteOffset,chassis.byteLength).indexOf(Buffer.from(adapted.buffer))>=0,'L10 contains exactly the same adapted facade as the surrounding rack');
console.log(JSON.stringify({pass:true,checks:['8 unique drive axes and dimensions','Complete carrier and aperture clearance','17 mm pitch / .6 mm inter-carrier gap','Management board and connector separation','72 actual triangle storage aperture rays and 7 physical dividers','117 network/RJ45/USB aperture rays','Byte-identical shared rack and L10 facade','Actual SSD meshes and maximum tolerance vs guides','32 actual floor and closed-lid coverage samples','Side-standing rear connector plane','Network PCB collision audit','Six network cages meet their facade'],layout:l.id,bodyMM:l.bodyMM,clearancesMM:l.clearancesMM,actualClearances,facadeTriangles:front.data.length/33},null,2));
