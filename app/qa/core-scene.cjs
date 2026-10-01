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
  const frames=new Map(),events=new Map(),uploads=[],captured=new Set(),dispatched=[],drawRecords=[],uploadedByBuffer=new Map(),uniformValues={};
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
    window:{devicePixelRatio:1,addEventListener(){},removeEventListener(){}},
    Float32Array,Math,Number,String,Object,Array,
    performance:{now:()=>clock},matchMedia:()=>({matches:reduced}),
    ResizeObserver:class{constructor(fn){resizeCallback=fn;}observe(){}disconnect(){observerDisconnected=true;}},
    CustomEvent:class{constructor(type){this.type=type;}},
    requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},
    cancelAnimationFrame:id=>frames.delete(id)
  };
  const context=vm.createContext(sandbox);
  vm.runInContext(sharedSource,context,{filename:'rack-equipment-scene.js'});
  vm.runInContext(source,context,{filename:'core-scene.js'});
  const scene=sandbox.window.PACoreScene.mount(canvas);
  function frame(){const pending=[...frames.values()];frames.clear();clock+=17;pending.forEach(fn=>fn(clock));}
  function flush(n=40){for(let i=0;i<n;i++)frame();}
  return {
    scene,canvas,uploads,events,frames,dispatched,frame,flush,scope:sandbox.window,drawRecords,uploadedByBuffer,
    event:(name,event={})=>events.get(name)?.(event),
    resize:(width,height)=>{if(width!==undefined)canvasSize={width,height};resizeCallback();},failCompilation:()=>{compileFailure=true;},
    stats:()=>({draws,deletedBuffers,deletedPrograms,observerDisconnected})
  };
}
function check(name,fn){fn();results.push(name);console.log('PASS '+name);}
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,message+' ('+actual+' vs '+expected+')');

check('Complete finite geometry; stable shared uploads; no idle rendering',()=>{
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
      assert.ok(Math.abs(data[offset])<10&&Math.abs(data[offset+1])<10&&Math.abs(data[offset+2])<10,'invalid mesh bounds');
    }
  }
  assert.ok(vertices>0&&vertices<2000000,'Geometry must be substantial and bounded');
  assert.equal(Number(h.canvas.dataset.coreVertices),vertices);
  assert.ok(h.stats().draws>=1);assert.equal(h.frames.size,0);
  const idleDraws=h.stats().draws;h.flush();assert.equal(h.stats().draws,idleDraws,'Idle time must not redraw');
  const initialDistance=Number(h.canvas.dataset.coreCameraDistance);
  h.scene.setOrbit(-1.4,-1.134);h.frame();assert.ok(Number.isFinite(Number(h.canvas.dataset.coreCameraDistance))&&Number(h.canvas.dataset.coreCameraDistance)>0,'Orbit requires a finite camera distance');
  h.scene.setOrbit(0,0);h.frame();assert.ok(Math.abs(Number(h.canvas.dataset.coreCameraDistance)-initialDistance)<.0001,'authored L10 framing must be preserved');
  const priorDraws=h.stats().draws;
  h.scene.setProgress(1);h.frame();assert.ok(h.stats().draws>priorDraws,'Assembly must render hardware');
  assert.equal(h.uploads.length,buffers,'scroll must not rebuild geometry');
  assert.equal(h.scene.getState().computeTrays,18);assert.equal(h.scene.getState().switchTrays,9);h.scene.destroy();
});

check('Editorial 48U plan: 41 components / 48U, 18 real 1U slots, reserved 5U blanking panel',()=>{
  const h=harness(),snapshot=h.scope.PACoreScene.assemblySnapshot(1),rows=plain(snapshot.placements);
  assert.equal(rows.length,41);
  const counts={},occupied=new Map();
  for(const row of rows){
    counts[row.type]=(counts[row.type]||0)+1;
    assert.equal(row.bottom,row.top-row.size+1);
    assert.ok(row.top<=48&&row.bottom>=1);
    for(let u=row.bottom;u<=row.top;u++){assert.equal(occupied.has(u),false,'Overlapping editorial slot U'+u);occupied.set(u,row.name);}
  }
  assert.deepEqual(counts,{blanking:3,switch:2,powershelf:8,server:18,nvlink:9,cdu:1});
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
  for(const p of [0,.20,.36,.40,.58,.76,1]){
    h.drawRecords.length=0;h.scene.setProgress(p);h.scene.resize();h.frame();
    const current=h.scope.PACoreScene.assemblySnapshot(p),pose=current.primaryPose;
    const primaryDraws=h.drawRecords.filter(draw=>computeBuffers.has(draw.buffer)&&Math.abs(draw.part[12]-pose.x)<1e-5&&Math.abs(draw.part[13]-pose.y)<1e-5&&Math.abs(draw.part[14]-pose.z)<1e-5);
    assert.equal(primaryDraws.length,1,'Exactly one rendered primary at progress '+p);
    near(primaryDraws[0].opacity,1,'Primary must not fade away');
    if(p===1){assert.equal(h.drawRecords.filter(draw=>computeBuffers.has(draw.buffer)).length,18);assert.equal(h.drawRecords.filter(draw=>equipmentBuffers.has(draw.buffer)).length,snapshot.placements.length,'Exactly 41 actual devices, not a duplicate target tray');assert.equal(h.drawRecords.filter(draw=>frameBuffers.has(draw.buffer)).length,1,'Exactly one shared rack frame');}
  }
  h.scene.destroy();
});

check('Forward/reverse insertion: fixed-size primary aligns first, enters once, and holds its slot',()=>{
  const h=harness(),snapshot=h.scope.PACoreScene.assemblySnapshot,forward=[];
  let previousY=-Infinity,previousZ=Infinity;
  for(let i=0;i<=100;i++){
    const p=i/100,current=plain(snapshot(p));forward.push(current);
    near(current.progress,p,'Snapshot progress');near(current.primaryPose.scale,1,'Do not morph or stretch the hero tray');
    assert.ok(current.primaryPose.y>=previousY-1e-6,'Vertical alignment is monotonic');
    assert.ok(current.primaryPose.z<=previousZ+1e-6,'Insertion is monotonic');
    if(p<=.36)near(current.primaryPose.z,6.60,'Tray stays in front of the rack while aligning');
    if(p>=.40)near(current.primaryPose.y,current.targetPose.y,'Tray must align with U40 before insertion');
    if(p>=.76){near(current.primaryPose.z,current.targetPose.z,'Inserted tray stays at rack depth');near(current.primaryPose.y,current.targetPose.y,'Inserted tray stays at target U');}
    previousY=current.primaryPose.y;previousZ=current.primaryPose.z;
  }
  for(let i=100;i>=0;i--)assert.deepEqual(plain(snapshot(i/100)),forward[i],'Reverse scroll must restore identical geometry at '+i/100);
  const before=h.uploads.length;
  for(const p of [0,.2,.4,.76,1,.76,.4,.2,0]){h.scene.setProgress(p);h.frame();near(h.scene.getState().progress,p,'Live scene accepts reversed progress');}
  assert.equal(h.uploads.length,before,'Animation does not allocate new geometry');assert.equal(h.frames.size,0);
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
  for(const progress of [0,1]){h.scene.setProgress(progress);h.flush();
  for(const [width,height] of [[810,610],[450,850],[1320,900]])for(const [yaw,pitch] of [[0,0],[Math.PI,0],[Math.PI/2,1.2],[-1.4,-1.13]]){
    h.drawRecords.length=0;h.scene.setOrbit(yaw,pitch);h.resize(width,height);h.frame();
    assert.equal(h.canvas.width,width);assert.equal(h.canvas.height,height);
    for(const draw of h.drawRecords){const box=bounds.get(draw.buffer);if(!box||draw.opacity<.99)continue;
      for(const x of [box.min[0],box.max[0]])for(const y of [box.min[1],box.max[1]])for(const z of [box.min[2],box.max[2]]){
        const clip=transform(draw.projection,transform(draw.model,transform(draw.part,[x,y,z,1])));
        assert.ok(clip.every(Number.isFinite)&&clip[3]>0,'Visible hardware must be in front of the camera');
        for(let axis=0;axis<3;axis++)assert.ok(Math.abs(clip[axis]/clip[3])<=1.0001,'Hardware clipping at '+JSON.stringify({progress,width,height,yaw,pitch,axis,value:clip[axis]/clip[3]}));
      }
    }
    assert.equal(h.frames.size,0,'Resize and deliberate orbit must not create an idle render loop');
  }
  }
  h.scene.destroy();
});

check('Four horizontal quadrants, rear view, top/bottom and release persistence',()=>{
  const h=harness();h.frame();
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    h.scene.setOrbit(yaw,.7);h.frame();
    const expected=yaw===Math.PI?-Math.PI:yaw;
    assert.ok(Math.abs(h.scene.getState().yaw-expected)<.00001);
    h.scene.setPointer(.9,-.8);h.scene.setProgress(0);
    assert.equal(h.scene.getState().yaw,expected);assert.equal(h.frames.size,0);
  }
  h.scene.setOrbit(7*Math.PI,2);h.frame();assert.equal(h.scene.getState().pitch,1.55);
  h.scene.setOrbit(0,-2);h.frame();assert.equal(h.scene.getState().pitch,-1.55);
  h.event('pointerdown',{button:0,pointerId:1,clientX:200,clientY:100});
  h.event('pointermove',{pointerId:1,clientX:420,clientY:320});h.frame();
  assert.equal(h.scene.getState().dragging,true);
  h.event('pointerup',{pointerId:1});const held=h.scene.getState();h.flush();
  assert.equal(held.dragging,false);assert.equal(h.scene.getState().yaw,held.yaw);assert.equal(h.scene.getState().pitch,held.pitch);assert.equal(h.frames.size,0);
  h.scene.destroy();
});

check('Reversible scroll settles into authored angle and stops scheduling frames',()=>{
  const h=harness();h.frame();h.scene.setOrbit(1.3,-.8);h.frame();h.scene.setProgress(.5);
  assert.equal(h.scene.getState().settling,true);h.frame();
  assert.ok(h.scene.getState().yaw>0&&h.scene.getState().yaw<1.3);h.flush();
  assert.equal(h.scene.getState().yaw,0);assert.equal(h.scene.getState().pitch,0);assert.equal(h.frames.size,0);
  h.scene.setProgress(1);h.frame();h.scene.setProgress(0);h.frame();assert.equal(h.scene.getState().progress,0);
  h.scene.setOrbit(Math.PI,.5);h.frame();h.scene.resetOrbit();h.flush();assert.equal(h.scene.getState().yaw,0);assert.equal(h.frames.size,0);h.scene.destroy();
});

check('Keyboard orbit and reset; Reduced Motion still permits deliberate inspection',()=>{
  const h=harness({reduced:true});h.frame();let prevented=0;
  h.event('keydown',{key:'ArrowRight',preventDefault:()=>prevented++});h.frame();assert.equal(h.scene.getState().yaw,.1200000000000001);
  h.event('keydown',{key:'ArrowDown',shiftKey:true,preventDefault:()=>prevented++});h.frame();assert.equal(h.scene.getState().pitch,.24);
  h.event('keydown',{key:'Home',preventDefault:()=>prevented++});h.frame();assert.equal(h.scene.getState().yaw,0);assert.equal(h.scene.getState().pitch,0);
  assert.equal(prevented,3);assert.equal(h.scene.getState().settling,false);assert.equal(h.frames.size,0);h.scene.destroy();
});

check('Theme, resize and complete idempotent disposal',()=>{
  const h=harness();h.frame();const buffers=h.scene.getState().geometryBuffers;h.scene.setTheme('light');h.frame();assert.equal(h.scene.getState().theme,'light');
  h.scene.setTheme(false);h.frame();assert.equal(h.scene.getState().theme,'dark');h.resize();h.frame();
  assert.equal(h.canvas.width,810);assert.equal(h.canvas.height,610);
  h.scene.setOrbit(1,.3);h.scene.resetOrbit();h.scene.destroy();h.scene.destroy();
  assert.equal(h.frames.size,0);assert.equal(h.events.size,0);assert.equal(h.stats().deletedBuffers,buffers);assert.equal(h.stats().deletedPrograms,1);
  assert.equal(h.scene.getState().geometryBuffers,0);
  assert.equal(h.stats().observerDisconnected,true);assert.equal(h.canvas.style.touchAction,'pan-y');assert.equal(h.canvas.dataset.coreState,'disposed');assert.equal(h.canvas.paCoreScene,undefined);
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
