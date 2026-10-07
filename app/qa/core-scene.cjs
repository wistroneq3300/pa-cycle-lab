/* Deterministic unit checks for the native WebGL model and lifecycle.
 * Run: node qa/core-scene.cjs
 * No browser or dependencies. The WebGL double verifies geometry/uploads,
 * state and lifecycle; real shader compilation and pixels require browser QA.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../static/js/core-scene.js'),'utf8');
const sharedSource=fs.readFileSync(path.join(__dirname,'../static/js/rack-equipment-scene.js'),'utf8');
const results=[];

function harness({reduced=false,unavailable=false}={}){
  let clock=0,nextFrame=0,draws=0,deletedBuffers=0,deletedPrograms=0,compileFailure=false,nextBuffer=0,activeBuffer=null;
  const frames=new Map(),events=new Map(),globalEvents=new Map(),timers=new Map(),uploads=[],captured=new Set(),dispatched=[],drawRecords=[],uploadedByBuffer=new Map(),uniformValues={};
  let canvasSize={width:810,height:610};
  let resizeCallback=()=>{},observerDisconnected=false;
  const gl=new Proxy({
    NO_ERROR:0,getParameter:()=>4096,getShaderParameter:()=>!compileFailure,
    getProgramParameter:()=>true,getShaderInfoLog:()=> 'Injected shader compile failure',
    getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,getError:()=>0,
    createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({id:++nextBuffer}),
    bindBuffer:(_,buffer)=>{activeBuffer=buffer;},
    bufferData:(_,data)=>{uploads.push(data);uploadedByBuffer.set(activeBuffer,data);},
    uniformMatrix4fv:(name,_transpose,value)=>{uniformValues[name]=Array.from(value);},
    uniform1f:(name,value)=>{uniformValues[name]=value;},
    drawArrays:()=>{draws++;drawRecords.push({buffer:activeBuffer,opacity:uniformValues.uOpacity??1,part:[...(uniformValues.uPart||[])],model:[...(uniformValues.uModel||[])],projection:[...(uniformValues.uViewProjection||[])]});},
    deleteBuffer:()=>deletedBuffers++,deleteProgram:()=>deletedPrograms++
  },{get:(target,key)=>key in target?target[key]:(/^[A-Z_]+$/.test(key)?1:()=>{})});
  const canvas={
    style:{touchAction:'pan-y'},dataset:{},width:0,height:0,
    getContext:()=>unavailable?null:gl,getBoundingClientRect:()=>({...canvasSize}),
    addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),
    dispatchEvent:event=>dispatched.push(event.type),focus(){},
    setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),
    releasePointerCapture:id=>{captured.delete(id);events.get('lostpointercapture')?.({pointerId:id});}
  };
  const sandbox={
    window:{devicePixelRatio:1,addEventListener(name,fn){globalEvents.set(name,fn);},removeEventListener(name){globalEvents.delete(name);}},
    Float32Array,Math,Number,String,Object,Array,
    performance:{now:()=>clock},matchMedia:()=>({matches:reduced}),
    ResizeObserver:class{constructor(fn){resizeCallback=fn;}observe(){}disconnect(){observerDisconnected=true;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},
    cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,delay)=>{const id=++nextFrame;timers.set(id,{fn,at:clock+delay});return id;},
    clearTimeout:id=>timers.delete(id)
  };
  const context=vm.createContext(sandbox);
  vm.runInContext(sharedSource,context,{filename:'rack-equipment-scene.js'});
  vm.runInContext(source,context,{filename:'core-scene.js'});
  const scene=sandbox.window.PACoreScene.mount(canvas);
  function frame(step=17){const pending=[...frames.values()];frames.clear();clock+=step;for(const [id,timer]of timers)if(timer.at<=clock){timers.delete(id);timer.fn();}pending.forEach(fn=>fn(clock));}
  function flush(n=160){for(let i=0;i<n;i++)frame();}
  return {
    scene,canvas,uploads,events,globalEvents,timers,frames,dispatched,frame,flush,scope:sandbox.window,drawRecords,uploadedByBuffer,uniformValues,
    event:(name,event={})=>events.get(name)?.(event),
    resize:(width,height)=>{if(width!==undefined)canvasSize={width,height};resizeCallback();},failCompilation:()=>{compileFailure=true;},
    stats:()=>({draws,deletedBuffers,deletedPrograms,observerDisconnected})
  };
}
function check(name,fn){fn();results.push(name);console.log('PASS '+name);}
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,message+' ('+actual+' vs '+expected+')');

check('Complete finite geometry; stable shared uploads; settled hero waits for idle timer',()=>{
  const h=harness();h.frame();
  assert.equal(h.canvas.dataset.coreState,'ready');
  const buffers=h.scene.getState().geometryBuffers;
  assert.ok(buffers>=2,'At least the hero hardware and its scene must be uploaded');
  assert.equal(h.uploads.length,buffers);let vertices=0;
  for(const data of h.uploads){
    assert.equal(data.length%12,0);vertices+=data.length/12;
    for(let offset=0;offset<data.length;offset+=12){
      for(let n=0;n<12;n++)assert.ok(Number.isFinite(data[offset+n]),'non-finite geometry');
      const normal=Math.hypot(data[offset+3],data[offset+4],data[offset+5]);
      assert.ok(Math.abs(normal-1)<.00001,'surface normal must be normalized');
      const limit=data[offset+11]<-.5?25:10; // Stage atmosphere is wider than the physical rack.
      assert.ok(Math.abs(data[offset])<limit&&Math.abs(data[offset+1])<limit&&Math.abs(data[offset+2])<limit,'invalid mesh bounds');
    }
  }
  assert.ok(vertices>0&&vertices<2000000,'Geometry must be substantial and bounded');
  assert.equal(Number(h.canvas.dataset.coreVertices),vertices);
  assert.ok(h.stats().draws>=1);
  h.scene.setProgress(1);h.flush();assert.equal(h.frames.size,0);
  const idleDraws=h.stats().draws;h.flush(10);assert.equal(h.stats().draws,idleDraws,'Settled hero waits for the idle timer');
  const initialDistance=Number(h.canvas.dataset.coreCameraDistance);
  h.scene.setOrbit(-1.4,-1.134);h.flush();assert.ok(Number.isFinite(Number(h.canvas.dataset.coreCameraDistance))&&Number(h.canvas.dataset.coreCameraDistance)>0,'Orbit requires a finite camera distance');
  h.scene.setOrbit(0,0);h.flush();assert.ok(Math.abs(Number(h.canvas.dataset.coreCameraDistance)-initialDistance)<.001,'Authored hero framing must be preserved within camera settling tolerance');
  const priorDraws=h.stats().draws;
  h.scene.resize();h.frame();assert.ok(h.stats().draws>priorDraws,'Assembly must render hardware');
  assert.equal(h.uploads.length,buffers,'scroll must not rebuild geometry');
  assert.equal(h.scene.getState().computeTrays,18);assert.equal(h.scene.getState().switchTrays,9);h.scene.destroy();
});

check('Editorial 48U plan: 41 components, no CDU, exact neutral lower infrastructure',()=>{
  const h=harness(),snapshot=h.scope.PACoreScene.assemblySnapshot(1),rows=plain(snapshot.placements);
  assert.equal(rows.length,41);
  const counts={},occupied=new Map();
  for(const row of rows){
    counts[row.type]=(counts[row.type]||0)+1;
    assert.equal(row.bottom,row.top-row.size+1);
    assert.ok(row.top<=48&&row.bottom>=1);
    for(let u=row.bottom;u<=row.top;u++){assert.equal(occupied.has(u),false,'Overlapping editorial slot U'+u);occupied.set(u,row.name);}
  }
  assert.deepEqual(counts,{blanking:4,switch:2,powershelf:8,server:18,nvlink:9});
  const lower=rows.find(row=>row.name==='editorial-infrastructure-blank');
  assert.deepEqual({type:lower.type,top:lower.top,bottom:lower.bottom,size:lower.size},{type:'blanking',top:4,bottom:1,size:4});
  assert.equal(occupied.size,48);assert.equal(snapshot.occupiedU,48);
  assert.deepEqual(Array.from({length:48},(_,i)=>i+1).filter(u=>!occupied.has(u)),[]);
  assert.deepEqual(plain(snapshot.emptyU),[]);
  const reserved=rows.find(row=>row.name==='editorial-reserve-blank');
  assert.ok(reserved,'One reserved blanking panel must occupy the gap above the CDU');
  assert.deepEqual({type:reserved.type,top:reserved.top,bottom:reserved.bottom,size:reserved.size},{type:'blanking',top:9,bottom:5,size:5});
  for(let u=5;u<=9;u++)assert.equal(occupied.get(u),reserved.name,'The same 5U panel must cover U'+u);
  assert.deepEqual(rows.filter(r=>r.type==='server').map(r=>r.top).sort((a,b)=>b-a),[40,39,38,37,36,35,34,33,32,22,21,20,19,18,17,16,15,14]);
  assert.ok(rows.filter(r=>r.type==='server'||r.type==='nvlink').every(r=>r.size===1));
  const primary=rows.find(r=>r.name===snapshot.primaryName);
  assert.equal(primary.type,'server');assert.equal(primary.top,40);assert.equal(primary.size,1);
  assert.equal(snapshot.targetU,40);near(snapshot.targetPose.y,primary.y,'Primary target must come from its own placement');
  assert.equal(snapshot.staticPlacements.length,40);
  assert.equal(snapshot.staticPlacements.some(r=>r.name===snapshot.primaryName),false,'Primary must not be duplicated in the static rack');
  h.scene.destroy();
});

check('Shared canonical geometry, no left number gutter, and one actual primary draw at its target',()=>{
  const h=harness();h.frame();const snapshot=h.scope.PACoreScene.assemblySnapshot(1);
  const records=snapshot.placements.map(p=>({name:p.name,mgx_type:p.type,rack_u:p.top,rack_size:p.size}));
  const originalRecords=JSON.stringify(records);
  const shared=h.scope.PARackScene.buildEditorialParts(records);
  assert.equal(JSON.stringify(records),originalRecords,'Geometry construction must not mutate caller inventory');
  assert.equal(shared.stride,11);near(shared.unit,.30,'Shared physical U pitch');
  const frameData=shared.frame.data;let left=Infinity,right=-Infinity;
  for(let i=0;i<frameData.length;i+=shared.stride){left=Math.min(left,frameData[i]);right=Math.max(right,frameData[i]);}
  assert.ok(left>=-2.30&&right<=2.30,'Frame must not include the removed number/measurement gutter');
  const sameGeometry=(upload,canonical)=>{
    if(upload.length/12!==canonical.length/11)return false;
    for(let v=0;v<canonical.length/11;v++)for(let n=0;n<6;n++)if(Math.abs(upload[v*12+n]-canonical[v*11+n])>1e-6)return false;
    return true;
  };
  for(const [key,equipment] of Object.entries(shared.equipment)){
    assert.ok(h.uploads.some(upload=>sameGeometry(upload,equipment.data)),'Homepage must upload canonical '+key+' geometry');
    const size=Number(key.split(':')[1]);
    for(let i=0;i<equipment.data.length;i+=shared.stride)assert.ok(Math.abs(equipment.data[i+1])<=size*shared.unit/2+1e-5,'Physical '+key+' mesh must fit inside its claimed U occupancy');
  }
  assert.ok(h.uploads.some(upload=>sameGeometry(upload,shared.frame.data)),'Homepage must reuse the operational frame geometry');
  const computeBuffers=new Set([...h.uploadedByBuffer].filter(([,data])=>sameGeometry(data,shared.equipment['server:1'].data)).map(([buffer])=>buffer));
  const equipmentBuffers=new Set([...h.uploadedByBuffer].filter(([,data])=>Object.values(shared.equipment).some(mesh=>sameGeometry(data,mesh.data))).map(([buffer])=>buffer));
  const frameBuffers=new Set([...h.uploadedByBuffer].filter(([,data])=>sameGeometry(data,shared.frame.data)).map(([buffer])=>buffer));
  assert.ok(computeBuffers.size>0);
  for(const p of [0,.14,.20,.38,.46,.55,.74,.84,.94,1]){
    h.drawRecords.length=0;h.scene.setProgress(p);h.scene.resize();h.frame();
    const current=h.scope.PACoreScene.assemblySnapshot(p),pose=current.placements.find(row=>row.primary);
    const primaryDraws=h.drawRecords.filter(draw=>computeBuffers.has(draw.buffer)&&Math.abs(draw.part[12]-pose.x)<1e-5&&Math.abs(draw.part[13]-pose.y)<1e-5&&Math.abs(draw.part[14]-pose.z)<1e-5);
    assert.equal(primaryDraws.length,pose.opacity<=.003?0:1,'Primary is revealed once and never duplicated at progress '+p);
    if(primaryDraws.length)near(primaryDraws[0].opacity,pose.opacity,'Drawn primary matches authored reveal');
    if(p===0)assert.equal(h.drawRecords.filter(draw=>equipmentBuffers.has(draw.buffer)).length,0,'Opening shot is a real empty rack');
    if(p===.84||p===.94)for(const row of current.placements){
      const mesh=shared.equipment[row.meshKey];
      const buffers=new Set([...h.uploadedByBuffer].filter(([,data])=>sameGeometry(data,mesh.data)).map(([buffer])=>buffer));
      assert.equal(h.drawRecords.filter(draw=>buffers.has(draw.buffer)&&Math.abs(draw.part[13]-row.y)<1e-5&&Math.abs(draw.part[14]-row.z)<1e-5).length,1,'Actual draw must match exact exploded/returned '+row.name);
    }
    if(p===1){assert.equal(h.drawRecords.filter(draw=>computeBuffers.has(draw.buffer)).length,18);assert.equal(h.drawRecords.filter(draw=>equipmentBuffers.has(draw.buffer)).length,snapshot.placements.length,'Exactly 41 actual devices, not a duplicate target tray');assert.equal(h.drawRecords.filter(draw=>frameBuffers.has(draw.buffer)).length,1,'Exactly one shared rack frame');}
  }
  h.scene.destroy();
});

check('Full-rack assembly is exactly reversible and every device aligns before physical insertion',()=>{
  const h=harness(),snapshot=h.scope.PACoreScene.assemblySnapshot,forward=[];
  const final=plain(snapshot(1)),targets=new Map(final.placements.map(row=>[row.name,row]));
  const visited=new Map(final.placements.map(row=>[row.name,[]]));
  for(let i=0;i<=100;i++){
    const p=i/100,current=plain(snapshot(p));forward.push(current);
    near(current.progress,p,'Snapshot progress');near(current.primaryPose.scale,1,'Do not morph or stretch the hero tray');
    assert.equal(new Set(current.placements.map(row=>row.name)).size,41,'Unique hardware identities at every stage');
    for(const row of current.placements){
      const target=targets.get(row.name);assert.ok(target,'No floating extra component');
      assert.equal(row.top,target.top);assert.equal(row.bottom,target.bottom);assert.equal(row.size,target.size);
      for(const axis of ['x','y','z'])assert.ok(Number.isFinite(row[axis]),'Finite physical pose');
      if(p<=.74&&row.z<6.60-1e-5){near(row.x,target.x,'Lateral alignment precedes rack entry '+row.name);near(row.y,target.y,'U alignment precedes rack entry '+row.name);}
      visited.get(row.name).push(row);
    }
    if(p>=.60&&p<=.74){near(current.primaryPose.z,current.targetPose.z,'Inserted hero tray seats during the full-rack assembly');near(current.primaryPose.y,current.targetPose.y,'Hero tray seats at actual U40');}
  }
  for(let i=100;i>=0;i--)assert.deepEqual(plain(snapshot(i/100)),forward[i],'Reverse scroll must restore identical geometry at '+i/100);
  let simultaneous=0,movingClasses=new Set();
  for(let i=35;i<68;i++){
    const moving=[];
    for(const [name,poses]of visited){const a=poses[i],b=poses[i+1];if(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)>.015)moving.push(targets.get(name));}
    simultaneous=Math.max(simultaneous,moving.length);
    if(moving.length>=4)for(const row of moving)movingClasses.add(row.type);
  }
  assert.ok(simultaneous>=6,'Several devices visibly move together in overlapping waves');
  for(const type of ['server','nvlink','switch','powershelf'])assert.ok(movingClasses.has(type),'Simultaneous motion includes '+type);
  for(const poses of visited.values())for(let i=35;i<70;i++)assert.ok(poses[i+1].z<=poses[i].z+1e-5,'Assembly depth has controlled forward insertion without overshoot');
  const before=h.uploads.length;
  for(const p of [0,.2,.4,.55,.74,.84,1,.84,.74,.55,.4,.2,0]){h.scene.setProgress(p);h.frame();near(h.scene.getState().progress,p,'Live scene accepts reversed progress');}
  assert.equal(h.uploads.length,before,'Animation does not allocate new geometry');
  assert.deepEqual(plain(snapshot(.94).placements),plain(snapshot(.74).placements),'Exploded groups return to exact seated positions');
  h.scene.destroy();
});

check('Actual uploaded telescoping rail meshes overlap throughout physical insertion',()=>{
  const h=harness(),rails=[];
  for(const [buffer,data]of h.uploadedByBuffer){
    let rail=data.length/12===144,minZ=Infinity,maxZ=-Infinity,outerX=0;
    for(let i=0;i<data.length&&rail;i+=12){rail=Math.abs(data[i])>1.98&&Math.abs(data[i])<2.10&&data[i+1]<-.05;minZ=Math.min(minZ,data[i+2]);maxZ=Math.max(maxZ,data[i+2]);outerX=Math.max(outerX,Math.abs(data[i]));}
    if(rail)rails.push({buffer,minZ,maxZ,outerX});
  }
  assert.equal(rails.length,3,'Fixed, middle and moving rail members are real separate meshes');rails.sort((a,b)=>b.outerX-a.outerX);
  for(let step=0;step<=20;step++){
    h.drawRecords.length=0;h.scene.setProgress(.49+step*.0055);h.frame();
    const pose=h.scene.getState().assembly.primaryPose;
    const intervals=rails.map((rail,index)=>{const draws=h.drawRecords.filter(draw=>draw.buffer===rail.buffer);assert.equal(draws.length,1);near(draws[0].part[14],pose.z*index/2,'Rail stages share the physical insertion axis');return [rail.minZ+draws[0].part[14],rail.maxZ+draws[0].part[14]];});
    assert.ok(intervals[1][0]<=intervals[0][1]&&intervals[1][1]>=intervals[2][0],'Rendered nested rail members remain engaged at step '+step);
  }
  h.scene.destroy();
});

check('Actual equipment enclosures never collide during convergence or engineering separation',()=>{
  const h=harness(),snapshot=h.scope.PACoreScene.assemblySnapshot,rows=snapshot(1).placements;
  const shared=h.scope.PARackScene.buildEditorialParts(rows.map(row=>({name:row.name,mgx_type:row.type,rack_u:row.top,rack_size:row.size})));
  for(let step=38;step<=200;step++){
    const progress=step/200,poses=snapshot(progress).placements;
    const boxes=poses.map(row=>{const mesh=shared.equipment[row.meshKey];return {name:row.name,min:mesh.min.map((n,i)=>n+[row.x,row.y,row.z][i]),max:mesh.max.map((n,i)=>n+[row.x,row.y,row.z][i])};});
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){
      const x=boxes[a],y=boxes[b],overlap=[0,1,2].map(axis=>Math.min(x.max[axis],y.max[axis])-Math.max(x.min[axis],y.min[axis]));
      assert.ok(!overlap.every(size=>size>.02),`Hardware collision at ${progress}: ${x.name} / ${y.name} (${overlap})`);
    }
  }
  h.scene.destroy();
});

check('Four engineering callouts derive counts, representatives and anchors from the projected physical model',()=>{
  const h=harness();h.scene.setProgress(.27);h.flush();
  const initial=h.scene.getState(),callouts=initial.callouts;
  assert.equal(callouts.length,4);assert.equal(new Set(callouts.map(item=>item.type)).size,4);
  const counts={};for(const row of initial.assembly.placements)counts[row.type]=(counts[row.type]||0)+1;
  for(const callout of callouts){
    assert.equal(callout.count,counts[callout.type]);assert.equal(initial.assembly.placements.find(row=>row.name===callout.name)?.type,callout.type);
    assert.ok(callout.anchor.visible,'Authored identification anchor is in frame');
    assert.ok(callout.anchors.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.depth>0));
  }
  h.scene.setOrbit(.3,.1);h.flush();
  const changed=h.scene.getState().callouts;
  assert.ok(changed.some((item,index)=>Math.hypot(item.anchor.x-callouts[index].anchor.x,item.anchor.y-callouts[index].anchor.y)>.01),'Actual camera projection updates anchors');
  h.scene.destroy();
});

check('Resized and rotated standalone / assembled hardware stays inside the actual camera frustum',()=>{
  const h=harness();h.frame();h.scene.setProgress(1);h.frame();
  const bounds=new Map();
  for(const [buffer,data] of h.uploadedByBuffer){
    // Floor shadow has negative emission; it is not a physical fit constraint.
    if(data[11]<-.5)continue;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let offset=0;offset<data.length;offset+=12)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],data[offset+axis]);max[axis]=Math.max(max[axis],data[offset+axis]);}
    bounds.set(buffer,{min,max});
  }
  const transform=(matrix,p)=>[0,1,2,3].map(row=>matrix[row]*p[0]+matrix[row+4]*p[1]+matrix[row+8]*p[2]+matrix[row+12]*p[3]);
  for(const progress of [.07,.20,.27,.38,.46,.55,.68,.74,.84,.94,1]){h.scene.setProgress(progress);h.flush();
  for(const [width,height] of [[810,610],[450,850],[1320,900]])for(const [yaw,pitch] of [[0,0],[Math.PI,0],[Math.PI/2,1.2],[-1.4,-1.13]]){
    h.scene.setOrbit(yaw,pitch);h.resize(width,height);h.flush();h.drawRecords.length=0;h.scene.resize();h.frame();
    assert.equal(h.canvas.width,width);assert.equal(h.canvas.height,height);
    for(const draw of h.drawRecords){const box=bounds.get(draw.buffer);if(!box||draw.opacity<.99)continue;
      // Close-up camera deliberately crops the background rack; the moving
      // compute chassis itself must remain whole at every insertion position.
      if(progress>=.48&&progress<.68&&(Math.abs(draw.part[13]-h.scene.getState().assembly.primaryPose.y)>1e-5||Math.abs(draw.part[14]-h.scene.getState().assembly.primaryPose.z)>1e-5))continue;
      for(const x of [box.min[0],box.max[0]])for(const y of [box.min[1],box.max[1]])for(const z of [box.min[2],box.max[2]]){
        const clip=transform(draw.projection,transform(draw.model,transform(draw.part,[x,y,z,1])));
        assert.ok(clip.every(Number.isFinite)&&clip[3]>0,'Visible hardware must be in front of the camera');
        for(let axis=0;axis<3;axis++)assert.ok(Math.abs(clip[axis]/clip[3])<=1.0001,'Hardware clipping at '+JSON.stringify({progress,width,height,yaw,pitch,axis,value:clip[axis]/clip[3]}));
      }
    }
    if(progress===1)assert.equal(h.frames.size,0,'Settled deliberate orbit waits without drawing');
  }
  }
  h.scene.destroy();
});

check('Four horizontal quadrants, rear view, top/bottom and release persistence',()=>{
  const h=harness();h.scene.setProgress(1);h.flush();
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    h.scene.setOrbit(yaw,.7);h.flush();
    const expected=yaw;
    assert.ok(Math.abs(h.scene.getState().yaw-expected)<.00001);
    h.scene.setPointer(.9,-.8);h.scene.setProgress(1);
    assert.equal(h.scene.getState().yaw,expected);assert.equal(h.frames.size,0);
  }
  h.scene.setOrbit(7*Math.PI,2);h.frame();assert.equal(h.scene.getState().pitch,1.2);
  h.scene.setOrbit(0,-2);h.frame();assert.equal(h.scene.getState().pitch,-1.2);
  h.event('pointerdown',{button:0,pointerId:1,clientX:200,clientY:100});
  h.event('pointermove',{pointerId:1,clientX:420,clientY:320});h.frame();
  assert.equal(h.scene.getState().dragging,true);
  h.event('pointerup',{pointerId:1});const held=h.scene.getState();h.flush();
  assert.equal(held.dragging,false);assert.equal(h.scene.getState().yaw,held.yaw);assert.equal(h.scene.getState().pitch,held.pitch);assert.equal(h.frames.size,0);
  h.scene.destroy();
});

check('Reversible scroll/reset eases camera, uses shortest arc, and settles final hero',()=>{
  const h=harness();h.frame();h.scene.setOrbit(1.3,-.8);h.flush();const before=h.scene.getState().camera.yaw;h.scene.setProgress(1);h.frame();
  assert.equal(h.scene.getState().settling,true);
  assert.ok(Math.abs(h.scene.getState().camera.yaw-before)<.5,'Camera transition has no angle jump');h.flush();
  assert.equal(h.scene.getState().yaw,0);assert.equal(h.scene.getState().pitch,0);assert.equal(h.frames.size,0);
  h.scene.setProgress(1);h.frame();h.scene.setProgress(0);h.frame();assert.equal(h.scene.getState().progress,0);
  h.scene.setProgress(1);h.scene.setOrbit(10*Math.PI+.1,.5);h.flush();const spun=h.scene.getState().camera.yaw;h.scene.resetOrbit();h.frame();
  assert.ok(Math.abs(h.scene.getState().camera.yaw-spun)<.2,'Reset never rapidly unwinds accumulated turns');
  h.flush();assert.equal(h.scene.getState().yaw,0);assert.equal(h.frames.size,0);h.scene.destroy();
});

check('Keyboard orbit and reset; Reduced Motion still permits deliberate inspection',()=>{
  const h=harness({reduced:true});h.frame();let prevented=0;
  h.event('keydown',{key:'ArrowRight',preventDefault:()=>prevented++});h.frame();near(h.scene.getState().yaw,.12,'Keyboard yaw increment');
  h.event('keydown',{key:'ArrowDown',shiftKey:true,preventDefault:()=>prevented++});h.frame();assert.equal(h.scene.getState().pitch,.24);
  h.event('keydown',{key:'Home',preventDefault:()=>prevented++});h.frame();assert.equal(h.scene.getState().yaw,0);assert.equal(h.scene.getState().pitch,0);
  h.flush(2);assert.equal(prevented,3);assert.equal(h.scene.getState().settling,false);assert.equal(h.frames.size,0);assert.equal(h.timers.size,0,'Reduced motion never arms idle animation');h.scene.destroy();
});

check('Theme, resize and complete idempotent disposal',()=>{
  const h=harness();h.frame();const buffers=h.scene.getState().geometryBuffers;h.scene.setTheme('light');h.frame();assert.equal(h.scene.getState().theme,'light');
  h.scene.setTheme(false);h.frame();assert.equal(h.scene.getState().theme,'dark');h.resize();h.frame();
  assert.equal(h.canvas.width,810);assert.equal(h.canvas.height,610);
  h.scene.setOrbit(1,.3);h.scene.resetOrbit();h.scene.destroy();h.scene.destroy();
  assert.equal(h.frames.size,0);assert.equal(h.events.size,0);assert.equal(h.globalEvents.size,0);assert.equal(h.timers.size,0);assert.equal(h.stats().deletedBuffers,buffers);assert.equal(h.stats().deletedPrograms,1);
  assert.equal(h.scene.getState().geometryBuffers,0);
  assert.equal(h.stats().observerDisconnected,true);assert.equal(h.canvas.style.touchAction,'pan-y');assert.equal(h.canvas.dataset.coreState,'disposed');assert.equal(h.canvas.paCoreScene,undefined);
});

check('Idle showcase enters after 6.5 seconds and every input family eases out',()=>{
  for(const input of ['pointermove','pointerdown','keydown','wheel','scroll','touchstart','hashchange']){
    const h=harness();h.scene.setProgress(1);h.flush(380);
    assert.equal(h.scene.getState().idle.active,false,'No idle motion before requested delay');
    h.flush(80);assert.equal(h.scene.getState().idle.active,true);assert.ok(h.scene.getState().idle.weight>.5);
    const before=h.scene.getState();h.globalEvents.get(input)();h.frame();const exiting=h.scene.getState();
    assert.equal(exiting.idle.exiting,true);assert.ok(exiting.idle.weight>0,'Activity never snaps idle influence to zero');
    assert.ok(Math.abs(exiting.camera.yaw-before.camera.yaw)<.1,'Activity cannot teleport the camera');
    h.flush(120);assert.equal(h.scene.getState().idle.active,false);assert.equal(h.scene.getState().idle.weight,0);h.scene.destroy();
  }
});

check('Restrained lighting avoids scanning HUD effects and reduced motion freezes animated shader light',()=>{
  const h=harness();h.scene.setProgress(.93);h.frame();assert.equal(h.uniformValues.uScan,0);assert.ok(Number.isFinite(h.uniformValues.uScanY));
  near(Number(h.canvas.dataset.corePrimaryY),h.scene.getState().assembly.primaryPose.y,'Scan must not overwrite U40 primary pose diagnostics');
  h.scene.setProgress(1);h.frame();assert.equal(h.uniformValues.uScan,0);h.scene.destroy();
  const reduced=harness({reduced:true});reduced.scene.setProgress(.93);reduced.frame();assert.equal(reduced.uniformValues.uScan,0);assert.equal(reduced.uniformValues.uTime,0);reduced.scene.destroy();
});

check('Slow-frame capability reduction, camera convergence and settled final-pose idle hold',()=>{
  const h=harness();h.frame();const pixels=h.scene.getState().quality.pixelCount,buffers=h.uploads.length;
  h.scene.setProgress(.4);
  for(let i=0;i<110;i++)h.frame(100);
  assert.ok(h.scene.getState().quality.resolution<=.701,'Sustained slow rendering reaches the documented quality floor');
  assert.ok(h.scene.getState().quality.pixelCount<pixels*.51,'Lower capability reduces framebuffer work');
  assert.equal(h.uploads.length,buffers,'Adaptive rendering never rebuilds geometry');
  h.scene.setProgress(1);h.scene.setView('middle');
  let frames=0;do{h.frame(1000);frames++;}while(h.scene.getState().settling&&frames<40);
  assert.ok(frames<40,'Manual close-up converges even when frames take a second');
  assert.equal(h.scene.getState().camera.view,'middle');assert.equal(h.scene.getState().idle.active,false,'Manual inspection cannot start idle orbit');
  h.scene.setProgress(.55);h.flush();assert.equal(h.scene.getState().settling,false);
  h.scene.setProgress(1);let arrivalElapsed=0;
  do{
    h.frame(2000);arrivalElapsed+=2000;
    assert.equal(h.scene.getState().idle.active,false,'Idle cannot start while the slow camera is still arriving');
    assert.ok(arrivalElapsed<40000,'The final camera must still converge under slow frames');
  }while(h.scene.getState().settling);
  assert.ok(arrivalElapsed>6500,'Exercise arrival slower than the original idle deadline');
  h.frame(6499);assert.equal(h.scene.getState().idle.active,false,'A complete inactivity hold starts after camera convergence');
  h.frame(1);assert.equal(h.scene.getState().idle.active,true,'Idle starts only after the settled hero has held for 6.5 seconds');
  h.scene.destroy();
});

check('360-degree original equipment, enclosed depth, attached service routing and material families',()=>{
  const h=harness(),rows=h.scope.PACoreScene.assemblySnapshot(1).placements;
  const shared=h.scope.PARackScene.buildEditorialParts(rows.map(row=>({name:row.name,mgx_type:row.type,rack_u:row.top,rack_size:row.size})));
  const quality=shared.quality;
  assert.ok(quality.front&&quality.side&&quality.rear&&quality.fullDepth&&quality.noCDU&&quality.conceptual);
  assert.equal(quality.railPairs,37);assert.equal(quality.materialFamilies.length,7);
  for(const type of ['server:1','nvlink:1','switch:1','powershelf:1']){
    const mesh=shared.equipment[type],facings={front:0,rear:0,side:0,top:0};
    assert.ok(mesh.max[2]-mesh.min[2]>4.5,type+' has actual equipment enclosure depth');
    for(let i=0;i<mesh.data.length;i+=11){if(mesh.data[i+5]>.8)facings.front++;if(mesh.data[i+5]<-.8)facings.rear++;if(Math.abs(mesh.data[i+3])>.8)facings.side++;if(mesh.data[i+4]>.8)facings.top++;}
    for(const [facing,count]of Object.entries(facings))assert.ok(count>100,type+' has substantial '+facing+' geometry');
  }
  assert.ok(shared.infrastructure.data.length>10000&&shared.connections.data.length>10000,'Rear service geometry has dedicated batched meshes');
  assert.equal(shared.routes.length,quality.routeCount);assert.deepEqual(Object.keys(quality.routeFamilies).sort(),['cooling','interconnect','management','power']);
  const byName=new Map(rows.map(row=>[row.name,row])),sockets=new Map(shared.sockets.map(socket=>[socket.id,socket]));
  const derivative=(points,t)=>[0,1,2].map(axis=>3*(1-t)*(1-t)*(points[1][axis]-points[0][axis])+6*(1-t)*t*(points[2][axis]-points[1][axis])+3*t*t*(points[3][axis]-points[2][axis]));
  const second=(points,t)=>[0,1,2].map(axis=>6*(1-t)*(points[2][axis]-2*points[1][axis]+points[0][axis])+6*t*(points[3][axis]-2*points[2][axis]+points[1][axis]));
  assert.equal(sockets.size,shared.routes.length*2,'Every cable has two distinct physical service anchors');
  for(const route of shared.routes){
    const row=byName.get(route.component);assert.ok(row,'Every cable belongs to a placed component');
    assert.equal(route.control.length,4,'Routing uses smooth cubic curves');
    assert.deepEqual(plain(route.control[0]),plain(route.from));assert.deepEqual(plain(route.control[3]),plain(route.to));
    assert.deepEqual(plain(sockets.get(route.fromSocket)?.position),plain(route.from),'Tray endpoint lands at its connector anchor');
    assert.deepEqual(plain(sockets.get(route.toSocket)?.position),plain(route.to),'Rack endpoint lands at its service anchor');
    assert.equal(sockets.get(route.fromSocket).owner,row.name);assert.equal(sockets.get(route.toSocket).owner,'rack-service-structure');
    assert.ok(Math.abs(route.from[1]-row.y)<.14,'Cable tray endpoint shares its real equipment height');
    assert.ok(route.radius>.01&&route.radius<.06,'Restrained jacket diameter');
    const enclosureRear=shared.front-shared.equipment[row.meshKey].depth;
    for(const point of route.control){for(const coordinate of point)assert.ok(Number.isFinite(coordinate));assert.ok(point[2]+route.radius<enclosureRear,'Entire cubic control hull remains outside the equipment rear enclosure');}
    assert.ok(route.segments.length>=3,'Service loops use continuously joined arc sections');
    assert.deepEqual(plain(route.segments[0][0]),plain(route.from));assert.deepEqual(plain(route.segments.at(-1)[3]),plain(route.to));
    for(let index=0;index<route.segments.length;index++){
      const segment=route.segments[index];assert.equal(segment.length,4);
      for(const point of segment)assert.ok(point[2]+route.radius<enclosureRear,'Actual cable sweep remains behind the equipment body');
      if(index){const prior=route.segments[index-1];assert.deepEqual(plain(prior[3]),plain(segment[0]),'No gap between rendered curve sections');const a=derivative(prior,1),b=derivative(segment,0);assert.ok(a.reduce((sum,value,axis)=>sum+value*b[axis],0)/(Math.hypot(...a)*Math.hypot(...b))>.9999,'No sharp tangent break between rendered cable sections');}
      for(let sample=0;sample<=24;sample++){
        const d=derivative(segment,sample/24),dd=second(segment,sample/24),speed=Math.hypot(...d),cross=Math.hypot(d[1]*dd[2]-d[2]*dd[1],d[2]*dd[0]-d[0]*dd[2],d[0]*dd[1]-d[1]*dd[0]);
        assert.ok(speed>1e-7,'Cable curves never form a cusp');
        if(cross>1e-9)assert.ok(speed**3/cross>=route.radius*3,`${route.family} bend radius ${speed**3/cross/route.radius}r at segment ${index}, t=${sample/24}; minimum is 3r`);
      }
    }
    for(const endpoint of [route.from,route.to])for(let axis=0;axis<3;axis++)assert.ok(endpoint[axis]>=shared.bounds.min[axis]&&endpoint[axis]<=shared.bounds.max[axis],'Endpoints remain within actual structure bounds');
  }
  h.scene.destroy();
});

check('WebGL unavailable fallback does not install interactive listeners',()=>{
  const h=harness({unavailable:true});assert.equal(h.scene.supported,false);assert.equal(h.canvas.dataset.coreState,'fallback');assert.equal(h.events.size,0);assert.equal(h.frames.size,0);
  h.scene.setOrbit(1,1);h.scene.setProgress(1);h.scene.setTheme('light');h.scene.destroy();
});

check('Context loss, successful restoration, failed restoration and cleanup',()=>{
  const h=harness();h.frame();const buffers=h.scene.getState().geometryBuffers;let prevented=false;
  h.event('webglcontextlost',{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(h.canvas.dataset.coreState,'fallback');
  h.scene.setOrbit(1,.4);h.scene.setProgress(.5);assert.equal(h.frames.size,0);
  h.event('webglcontextrestored');h.flush();assert.equal(h.canvas.dataset.coreState,'ready');assert.equal(h.uploads.length,buffers*2);
  h.event('webglcontextlost',{preventDefault(){}});h.failCompilation();h.event('webglcontextrestored');
  assert.equal(h.canvas.dataset.coreState,'fallback');assert.match(h.canvas.dataset.coreError,/compilation failed/);
  h.scene.setOrbit(-1,.5);h.scene.setProgress(1);h.scene.setTheme('light');h.resize();h.flush();assert.equal(h.frames.size,0);
  h.scene.destroy();assert.equal(h.events.size,0);assert.equal(h.canvas.dataset.coreState,'disposed');
});

console.log('\n'+results.length+'/'+results.length+' core-scene checks passed. Browser visual/GL validation is still required.');
