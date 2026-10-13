/* CPU geometry audit of the opt-in networking asset, not a visual acceptance.
 * Uses actual GLB triangles and actual emitted procedural cage/cover triangles.
 * No renderer, animation, slot dimensions or production files are modified.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),baseline='1611dd2c31c48b880ca100141e0b723e126bef93';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const history=file=>cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:32*1024*1024}).toString();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const raw=data=>Buffer.from(data.buffer,data.byteOffset,data.byteLength);
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
const equalJSON=(a,b,label)=>assert.equal(JSON.stringify(a),JSON.stringify(b),label);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const report={pass:false,baseline,checks:[],limits:['Geometry tests do not prove photorealism, vendor dimensions, solder attachment or unseen electrical routing.','GLB image decoding here reads PNG dimensions only; actual texture/shader rendering is covered by l10-final-polish.cjs.','Mesh seating/component identity still requires Blender and screenshot inspection because delivery meshes are joined.','Cover audit checks triangle intersections with spatial broad phase; it is not a general watertight-solid containment or manufacturing tolerance certification.']};
const thermalSeats=[{board:'BF3-L',x:-1.29,z:1.44,y:-.0339,width:.265,depth:.276,thickness:.002,roof:.0225},{board:'BF3-R',x:1.29,z:1.44,y:-.0339,width:.265,depth:.276,thickness:.002,roof:.0225},{board:'CX7-R',x:1.3505,z:2.435,y:.0806,width:.134,depth:.138,thickness:.0015,roof:.106}];
function build(rackSource,hardwareSource,options){
 const s={window:{},Float32Array,Math,__primitives:[]};vm.runInNewContext(rackSource,s);
 const marker='return {data,box,bevel,cylinder,ring,screw,tube,line,tri,quad};';assert.ok(hardwareSource.includes(marker),'Instrument actual mesh builder without replacing geometry');
 const instrumented=hardwareSource.replace(marker,`return {data,box:(...a)=>{const start=data.length;const result=box(...a);__primitives.push({type:'box',a,vertices:data.slice(start)});return result;},bevel:(...a)=>{const start=data.length;const result=bevel(...a);__primitives.push({type:'bevel',a,vertices:data.slice(start)});return result;},cylinder,ring,screw,tube,line,tri,quad};`);
 vm.runInNewContext(instrumented,s);return {api:s.window.PAL10Hardware,rack:s.window.PARackScene,result:s.window.PAL10Hardware.build(s.window.PAL10Hardware.profile,options),primitives:s.__primitives};
}
function triangleBounds(v){return {min:[0,1,2].map(k=>Math.min(...v.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...v.map(p=>p[k])))};}
function triangles(data,label){const result=[];assert.equal(data.length%36,0);for(let i=0;i<data.length;i+=36){const v=[0,12,24].map(off=>Array.from(data.slice(i+off,i+off+3)));result.push({v,...triangleBounds(v),label,index:i/36,packedColor:Array.from(data.slice(i+6,i+9)),packedMetal:data[i+10]});}return result;}
const overlap=(a,b,eps=0)=>a.min.every((v,i)=>a.max[i]>=b.min[i]+eps&&b.max[i]>=v+eps);
function separated(axis,a,b,eps=1e-8){const length=Math.hypot(...axis);if(length<1e-12)return false;const pa=a.map(p=>dot(p,axis)),pb=b.map(p=>dot(p,axis));return Math.max(...pa)<Math.min(...pb)-eps*length||Math.max(...pb)<Math.min(...pa)-eps*length;}
function triangleTriangle(a,b){
 if(!overlap(a,b,-1e-8))return false;
 const ea=[sub(a.v[1],a.v[0]),sub(a.v[2],a.v[1]),sub(a.v[0],a.v[2])],eb=[sub(b.v[1],b.v[0]),sub(b.v[2],b.v[1]),sub(b.v[0],b.v[2])];
 const na=cross(ea[0],ea[1]),nb=cross(eb[0],eb[1]);
 // Plane normals + all edge cross-products; in-plane edge normals handle
 // coplanar triangles without falsely treating separated patches as touching.
 const axes=[na,nb,...ea.flatMap(x=>eb.map(y=>cross(x,y))),...ea.map(e=>cross(na,e)),...eb.map(e=>cross(nb,e))];
 return !axes.some(axis=>separated(axis,a.v,b.v));
}
function triangleBox(t,b){
 if(!overlap(t,b))return false;
 const c=b.min.map((v,i)=>(v+b.max[i])/2),h=b.min.map((v,i)=>(b.max[i]-v)/2),v=t.v.map(p=>sub(p,c));
 const edge=[sub(v[1],v[0]),sub(v[2],v[1]),sub(v[0],v[2])],basis=[[1,0,0],[0,1,0],[0,0,1]],axes=[...basis,cross(edge[0],edge[1]),...edge.flatMap(e=>basis.map(b=>cross(e,b)))];
 return !axes.some(axis=>{if(Math.hypot(...axis)<1e-12)return false;const projected=v.map(p=>dot(axis,p)),radius=h.reduce((n,x,i)=>n+x*Math.abs(axis[i]),0);return Math.min(...projected)>radius+1e-8||Math.max(...projected)<-radius-1e-8;});
}
function pcbSeatingContact(network,cover){
 // The only allowed contacts are cover feet/wall bottoms meeting the known
 // PCB top from above. Both meshes must stay on opposite sides of that plane
 // within FLOAT roundoff; intersections in any component above it still fail.
 const top={'BF3-L':-.092,'BF3-R':-.092,'CX7-R':.0275}[network.board],epsilon=1e-6;
 if(top===undefined||!['Black solder mask','Laminate cut edge'].includes(network.material))return null;
 if(network.max[1]>top+epsilon||cover.min[1]<top-epsilon)return null;
 if(Math.abs(network.max[1]-top)>epsilon||Math.abs(cover.min[1]-top)>epsilon)return null;
 return {board:network.board,planeY:top,tolerance:epsilon,networkMaterial:network.material};
}
function dieThermalContact(network,cover){
 const seat=thermalSeats.find(s=>s.board===network.board),epsilon=1e-6;
 if(!seat||network.material!=='NETWORK exposed optical face')return null;
 if(!cover.packedColor.every((v,i)=>near(v,[.29,.30,.29][i]))||!near(cover.packedMetal,.08))return null;
 if(Math.abs(network.min[1]-seat.y)>epsilon||Math.abs(network.max[1]-seat.y)>epsilon||Math.abs(cover.min[1]-seat.y)>epsilon||cover.max[1]>seat.y+seat.thickness+epsilon)return null;
 if(cover.min[0]<seat.x-seat.width/2-epsilon||cover.max[0]>seat.x+seat.width/2+epsilon||cover.min[2]<seat.z-seat.depth/2-epsilon||cover.max[2]>seat.z+seat.depth/2+epsilon)return null;
 return {board:seat.board,planeY:seat.y,tolerance:epsilon,networkMaterial:network.material,footprint:[seat.width,seat.depth]};
}
function rayHits(tris,x,y,zlo,zhi){let hits=0;for(const t of tris){if(x<t.min[0]||x>t.max[0]||y<t.min[1]||y>t.max[1]||t.max[2]<=zlo||t.min[2]>=zhi)continue;
 const [a,b,c]=t.v,d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)continue;
 const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/d,w=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/d,q=1-u-w;
 if(Math.min(u,w,q)<-1e-7)continue;const z=u*a[2]+w*b[2]+q*c[2];if(z>zlo&&z<zhi)hits++;
 }return hits;}
const color=(p,c)=>p.a[6].every((v,i)=>near(v,c[i]));
const isCage=p=>p.type==='box'&&color(p,[.52,.57,.59])&&near(p.a[7],.81)&&p.a[2]>2.8&&p.a[5]>.3;
const isSSD=p=>color(p,[.040,.045,.049])&&near(p.a[7],.32);
const isBoard=p=>color(p,[.028,.041,.034]);
const verticesHash=items=>sha(raw(new Float32Array(items.flatMap(p=>p.vertices))));
function testSAT(){
 const t=v=>({v,...triangleBounds(v)}),a=t([[0,0,0],[1,0,0],[0,1,0]]);
 assert.ok(triangleTriangle(a,t([[.2,.2,-1],[.2,.2,1],[.3,.3,0]])),'SAT detects piercing');
 assert.ok(triangleTriangle(a,t([[.1,.1,0],[.5,.1,0],[.1,.5,0]])),'SAT detects coplanar overlap');
 assert.ok(!triangleTriangle(a,t([[.8,.8,0],[1.2,.8,0],[.8,1.2,0]])),'SAT rejects coplanar separated triangles with overlapping AABBs');
 assert.ok(!triangleTriangle(a,t([[0,0,.001],[1,0,.001],[0,1,.001]])),'SAT distinguishes clearance');
 assert.ok(triangleBox(a,{min:[.1,.1,-.1],max:[.3,.3,.1]}));assert.ok(!triangleBox(a,{min:[.8,.8,-.1],max:[1.2,1.2,.1]}));
 const board={board:'CX7-R',material:'Black solder mask',min:[1.1,.0185,2.15],max:[1.6,.0275,3.05]},cover={min:[1.2,.0275,2.24],max:[1.5,.1,2.65]};
 assert.ok(pcbSeatingContact(board,cover),'Known PCB top can support the cover');
 assert.equal(pcbSeatingContact({...board,material:'Molded IC body'},cover),null,'Component bottoms are not PCB seating exceptions');
 assert.equal(pcbSeatingContact({...board,max:[1.6,.027502,3.05]},cover),null,'No enlarged epsilon hides geometry above PCB');
 assert.equal(pcbSeatingContact(board,{...cover,min:[1.2,.027498,2.24]}),null,'Penetrating cover is not accepted as contact');
 const die={board:'CX7-R',material:'NETWORK exposed optical face',min:[1.2785,.0806,2.361],max:[1.4225,.0806,2.509]},tim={min:[1.2835,.0806,2.366],max:[1.4175,.0821,2.504],packedColor:[.29,.30,.29],packedMetal:.08};
 assert.ok(dieThermalContact(die,tim),'Known die / TIM contact accepted');
 assert.equal(dieThermalContact({...die,material:'Molded IC body'},tim),null,'No generic component TIM exception');
 assert.equal(dieThermalContact(die,{...tim,max:[1.42,.0821,2.504]}),null,'Oversized TIM does not qualify');
 assert.equal(dieThermalContact(die,{...tim,min:[1.2835,.080598,2.366]}),null,'Penetrating TIM does not qualify');
}
(async()=>{
 testSAT();
 const rack=read('app/static/js/rack-equipment-scene.js'),hw=read('app/static/js/l10-hardware.js');
 const options={omitBareBoards:true,replaceServiceGeometry:true},before=build(rack,hw,options),after=build(rack,hw,{...options,replaceNetworking:true});
 const old=build(history('app/static/js/rack-equipment-scene.js'),history('app/static/js/l10-hardware.js'),options);
 const layout=after.rack.storageLayout;equalJSON(layout,old.rack.storageLayout,'Validated slotLayout must remain exactly unchanged');
 assert.equal(layout.slots.length,8);assert.equal(new Set(layout.slots.map(s=>s.id)).size,8);
 for(const name of Object.keys(before.result.meshes))if(!['l10-io','l10-network-cover'].includes(name))assert.equal(sha(raw(before.result.meshes[name].data)),sha(raw(after.result.meshes[name].data)),'Networking ownership does not change '+name);
 const oldCages=old.primitives.filter(isCage),beforeCages=before.primitives.filter(isCage),afterCages=after.primitives.filter(isCage);
 for(const list of [oldCages,beforeCages,afterCages])assert.equal(list.length,24,'Exactly six cages with four walls');
 assert.equal(verticesHash(afterCages),verticesHash(oldCages),'All six cage vertex / normal / material streams remain byte-identical to baseline');
 assert.equal(verticesHash(beforeCages),verticesHash(afterCages),'GLB networking ownership never removes port cages');
 const oldSSD=old.primitives.filter(isSSD),newSSD=after.primitives.filter(isSSD);assert.equal(oldSSD.length,8);assert.equal(newSSD.length,8);
 assert.equal(verticesHash(oldSSD),verticesHash(newSSD),'All eight SSD body vertex streams remain byte-identical');
 assert.equal(before.primitives.filter(isBoard).length,3,'Baseline procedure owns three network PCBs');assert.equal(after.primitives.filter(isBoard).length,0,'Opt-in asset must remove all three duplicated procedural network PCBs');
 const connectors=state=>state.primitives.filter(p=>p.type==='box'&&color(p,[.105,.13,.082])&&layout.slots.some(s=>Math.abs(p.a[0]-s.x)<.01&&Math.abs(p.a[2]-s.rearZ)<.04));
 assert.equal(connectors(after).length,8);assert.equal(verticesHash(connectors(after)),verticesHash(connectors(old)),'All eight rear connector positions and geometry remain unchanged');
 report.checks.push('Exact baseline slotLayout and 8 SSD / 8 rear contacts','Six unchanged dual-port cage triangle streams','No duplicated procedural network PCBs','No changes to other procedural layers from network ownership');
 report.cageSHA256=verticesHash(afterCages);report.ssdSHA256=verticesHash(newSSD);
 const portSpecs=[[-1.52,-.054,.244,.068],[-1.13,-.054,.244,.068],[.995,-.058,.244,.068],[1.37,-.058,.244,.068],[1.235,.064,.187,.046],[1.466,.064,.187,.046]];
 const cageTriangles=triangles(new Float32Array(afterCages.flatMap(p=>p.vertices)),'cage');
 for(const [x,y,w,h] of portSpecs)for(const dx of [-.36,0,.36])for(const dy of [-.36,0,.36])assert.equal(rayHits(cageTriangles,x+dx*w,y+dy*h,2.82,3.175),0,'Network cage retains a real hollow opening');
 report.checks.push('54 actual-triangle rays through six hollow cage mouths');
 const s={window:{},ArrayBuffer,Uint8Array,Float32Array,Float64Array,DataView,TextDecoder,URL,Blob,Math,Number,Set,Map};vm.runInNewContext(read('app/static/js/l10-gltf.js'),s);
 const bytes=fs.readFileSync(path.join(root,'app/static/models/l10-prototype/bare-compute-boards.glb'));
 const asset=await s.window.PAL10GLTF.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{decodeImage:async (data,mime)=>{assert.equal(mime,'image/png','This audit requires PNGs; browser tests decode actual pixels');const b=Buffer.from(data);return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};}});
 try{
  assert.equal(asset.metadata.extras.id,'dual-bare-compute-boards-r2');assert.equal(asset.metadata.extras.replacesNetworking,true);equalJSON(asset.metadata.extras.replacesComputeBoards,[0,1]);assert.equal(asset.metadata.extras.cpuCount,2);assert.equal(asset.metadata.extras.gpuCount,4);
  assert.deepEqual(Array.from(asset.metadata.layers).sort(),['board','io','network','packages']);
  report.asset={id:asset.metadata.extras.id,sha256:sha(bytes),bytes:bytes.length,layers:asset.metadata.layers};
  const networks=asset.primitives.filter(p=>p.layer==='network');assert.ok(networks.length>0);
  const allTriangles=networks.flatMap(p=>triangles(p.data,p.name).map(t=>({...t,material:p.material.name})));
  // Fixed board envelopes include the unchanged PCB outline and component
  // clearances. They do not grant permission to increase chassis or SSD size.
  const envelopes=[{id:'BF3-L',min:[-1.74001,-.10401,.56999],max:[-.83999,.0225,3.08001]},{id:'BF3-R',min:[.83999,-.10401,.56999],max:[1.74001,.0225,3.08001]},{id:'CX7-R',min:[1.10049,.01849,2.14999],max:[1.60051,.106,3.05001]}];
  const counts=Object.fromEntries(envelopes.map(e=>[e.id,0])),bounds=Object.fromEntries(envelopes.map(e=>[e.id,{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}]));
  for(const t of allTriangles){
   const envelope=envelopes.find(e=>t.label.includes('/ '+e.id+'#'));
   assert.ok(envelope,'Each networking primitive must retain its BF3-L / BF3-R / CX7-R node identity: '+t.label);
   assert.ok(t.min.every((v,i)=>v>=envelope.min[i]-1e-6&&t.max[i]<=envelope.max[i]+1e-6),`Network triangle exceeds fixed board / component envelope: ${t.label} #${t.index} ${JSON.stringify({min:t.min,max:t.max})}`);
   t.board=envelope.id;
   counts[envelope.id]++;for(let i=0;i<3;i++){bounds[envelope.id].min[i]=Math.min(bounds[envelope.id].min[i],t.min[i]);bounds[envelope.id].max[i]=Math.max(bounds[envelope.id].max[i],t.max[i]);}
   assert.ok(t.min[1]>layout.floorY&&t.max[1]<layout.lidBottomY,'Network geometry remains inside original floor and closed lid');
  }
  for(const [id,count] of Object.entries(counts))assert.ok(count>100,id+' must have a populated 3D board, not an empty metadata label');
  report.network={triangles:allTriangles.length,primitives:networks.length,boardTriangleCounts:counts,bounds,envelopes};
  report.checks.push('All new network triangles stay in the three fixed board envelopes and below original lid');
  let bodyTests=0;for(const slot of layout.slots){
   const mm=layout.mmPerUnit,b={min:[slot.x-15.35/mm.x/2+1e-7,slot.y-34/mm.y/2+1e-7,slot.frontZ-119.30/mm.z+1e-7],max:[slot.x+15.35/mm.x/2-1e-7,slot.y+34/mm.y/2-1e-7,slot.frontZ-1e-7]};
   for(const t of allTriangles)if(overlap(t,b)){bodyTests++;assert.ok(!triangleBox(t,b),`Network triangle intersects ${slot.id} maximum published SSD body: ${t.label} #${t.index}`);}
  }
  report.ssdTriangleNarrowPhaseTests=bodyTests;report.checks.push('No network triangle enters any maximum-tolerance SSD body (triangle / box SAT)');
  const ioTris=triangles(after.result.meshes['l10-io'].data,'retained procedural io');
  const frontNetwork=allTriangles.filter(t=>t.max[2]>2.82);
  for(const [x,y,w,h] of portSpecs)for(const dx of [-.36,0,.36])for(const dy of [-.36,0,.36])assert.equal(rayHits([...ioTris,...frontNetwork],x+dx*w,y+dy*h,2.82,3.175),0,'Seated boards/components do not seal the six port paths');
  report.checks.push('54 complete seated-network / IO port-path rays remain open');
  const covers=triangles(after.result.meshes['l10-network-cover'].data,'network cover');assert.ok(covers.length>0,'Actual removable cover geometry required');
  for(const t of covers)assert.ok(t.max[1]<layout.lidBottomY+1e-6,'Network covers fit below original lid');
  for(const seat of thermalSeats){
   const pads=after.primitives.filter(p=>p.type==='box'&&near(p.a[0],seat.x)&&near(p.a[2],seat.z)&&color(p,[.29,.30,.29])&&near(p.a[7],.08));assert.equal(pads.length,1,seat.board+' has exactly one authored TIM pad');
   const pad=pads[0].a;assert.ok(near(pad[3],seat.width)&&near(pad[5],seat.depth)&&near(pad[4],seat.thickness)&&near(pad[1]-pad[4]/2,seat.y),'TIM footprint/thickness/contact plane is exactly the approved seat');
   const pillars=after.primitives.filter(p=>p.type==='box'&&near(p.a[0],seat.x)&&near(p.a[2],seat.z)&&color(p,[.52,.57,.59])&&near(p.a[7],.82)&&near(p.a[3],seat.width)&&near(p.a[5],seat.depth));assert.equal(pillars.length,1,seat.board+' has exactly one cover pedestal');
   const pillar=pillars[0].a;assert.ok(near(pillar[1]-pillar[4]/2,seat.y+seat.thickness)&&near(pillar[1]+pillar[4]/2,seat.roof),'Metal pedestal joins TIM and cover underside without air gap');
   const die=allTriangles.filter(t=>t.board===seat.board&&t.material==='NETWORK exposed optical face');assert.ok(die.length>0);
   const dmin=[0,1,2].map(i=>Math.min(...die.map(t=>t.min[i]))),dmax=[0,1,2].map(i=>Math.max(...die.map(t=>t.max[i])));
   assert.ok(near(dmin[1],seat.y)&&near(dmax[1],seat.y)&&dmin[0]<=seat.x-seat.width/2&&dmax[0]>=seat.x+seat.width/2&&dmin[2]<=seat.z-seat.depth/2&&dmax[2]>=seat.z+seat.depth/2,'TIM footprint fits within actual die face');
  }
  report.thermalSeats=thermalSeats;report.checks.push('Three die / TIM / metal pedestal / cover stacks have exact contact heights and approved footprints');
  // Grid broad phase makes the surface collision test bounded without pairing
  // every network triangle with every cover triangle.
  const pitch=[.05,.035,.075],grid=new Map(),cells=t=>{const lo=t.min.map((v,i)=>Math.floor(v/pitch[i])),hi=t.max.map((v,i)=>Math.floor(v/pitch[i])),result=[];for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)result.push(x+','+y+','+z);return result;};
  covers.forEach((t,index)=>{for(const key of cells(t)){if(!grid.has(key))grid.set(key,[]);grid.get(key).push(index);}});
  let narrowTests=0,seatingContactPairs=0,thermalContactPairs=0,collisionPairs=0;const collisions=[],collisionGroups=new Map(),seatingSamples=[],thermalSamples=[],thermalByBoard=Object.fromEntries(thermalSeats.map(s=>[s.board,0]));
  for(const t of allTriangles){const candidates=new Set(cells(t).flatMap(key=>grid.get(key)||[]));for(const index of candidates){const c=covers[index];if(!overlap(t,c,-1e-8))continue;narrowTests++;if(triangleTriangle(t,c)){
   const seating=pcbSeatingContact(t,c);
   if(seating){seatingContactPairs++;if(seatingSamples.length<12)seatingSamples.push({...seating,network:t.label,index:t.index,cover:index});}
   else{const thermal=dieThermalContact(t,c);if(thermal){thermalContactPairs++;thermalByBoard[thermal.board]++;if(thermalSamples.length<12)thermalSamples.push({...thermal,network:t.label,index:t.index,cover:index});}
    else{collisionPairs++;if(collisions.length<12)collisions.push({network:t.label,index:t.index,material:t.material,cover:index,bounds:{min:t.min,max:t.max},coverBounds:{min:c.min,max:c.max},networkVertices:t.v,coverVertices:c.v});
     const planarAxis=[0,1,2].find(i=>Math.abs(c.max[i]-c.min[i])<1e-7),key=t.label+'|'+(planarAxis===undefined?'bevel':planarAxis+':'+c.min[planarAxis].toFixed(6));
     if(!collisionGroups.has(key))collisionGroups.set(key,{network:t.label,material:t.material,coverPlane:planarAxis===undefined?'bevel':{axis:planarAxis,coordinate:c.min[planarAxis]},pairs:0,networkMin:[Infinity,Infinity,Infinity],networkMax:[-Infinity,-Infinity,-Infinity],sampleCoverIndices:[]});
     const group=collisionGroups.get(key);group.pairs++;for(let i=0;i<3;i++){group.networkMin[i]=Math.min(group.networkMin[i],t.min[i]);group.networkMax[i]=Math.max(group.networkMax[i],t.max[i]);}if(group.sampleCoverIndices.length<4&&!group.sampleCoverIndices.includes(index))group.sampleCoverIndices.push(index);
    }}
  }}}
  report.coverAudit={coverTriangles:covers.length,narrowPhaseTests:narrowTests,seatingContactPairs,seatingSamples,thermalContactPairs,thermalByBoard,thermalSamples,contactRule:'Only known PCB top-plane seating and the three named silicon / TIM planes within their checked pad footprints; tolerance 1e-6 raw units. No other component-surface exception.',collisionPairs,collisionGroups:[...collisionGroups.values()],collisions};assert.equal(collisionPairs,0,'Network components cannot intersect restored inspection-cover triangles; full groups and first 12 samples retained');
  for(const [board,count] of Object.entries(thermalByBoard))assert.ok(count>0,board+' actual silicon and TIM surfaces must make contact');
  report.checks.push('No restored-cover surface penetration; exact PCB seating contacts recorded separately (spatial grid + triangle SAT)');
  const optical=asset.primitives.filter(p=>p.material.thinFilmStrength>0);assert.ok(optical.length>=3,'CPU / GPU / network optical materials exist');
  for(const p of optical){assert.ok(['packages','network'].includes(p.layer),'Thin-film response only on chip/package layers');assert.ok(p.material.thinFilmStrength<=.25&&p.material.thinFilmThickness>=250&&p.material.thinFilmThickness<=650);assert.ok(p.material.baseColorTexture&&p.material.normalTexture&&p.material.metallicRoughnessTexture,'Optical face needs authored color / normal / MR maps');}
  report.opticalMaterials=[...new Map(optical.map(p=>[p.material.name,{name:p.material.name,strength:p.material.thinFilmStrength,thickness:p.material.thinFilmThickness}])).values()];
  report.checks.push('Bounded silicon-only optical finish; no full-board iridescence');report.pass=true;
 }finally{asset.disposeImages();}
 console.log(JSON.stringify(report,null,2));
})().catch(error=>{report.failure=error.stack||error.message;console.error(JSON.stringify(report,null,2));process.exitCode=1;});
