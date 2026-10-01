/* PA System Core - shared GB300-inspired procedural equipment study.
 * Geometry is the same original CPU geometry used by PARackScene. No vendor
 * CAD, downloaded texture, external dependency or live equipment data is used.
 * One 1U compute tray aligns with vacant U40, then travels only along its rails.
 * Scroll position fully determines every authored transform, in both directions.
 */
(() => {
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  const U=.30,HALF=48*U/2,PRIMARY='editorial-compute-01',TARGET_U=40,PARK_Z=6.60;
  const records=[];
  function record(name,type,top,size=1){records.push(Object.freeze({name,mgx_type:type,rack_u:top,rack_size:size}));}
  for(let i=0;i<2;i++)record('editorial-blank-'+(i+1),'blanking',48-i);
  for(let i=0;i<2;i++)record('editorial-switch-'+(i+1),'switch',46-i);
  for(let i=0;i<4;i++)record('editorial-power-'+(i+1),'powershelf',44-i);
  for(let i=0;i<9;i++)record('editorial-compute-'+String(i+1).padStart(2,'0'),'server',40-i);
  for(let i=0;i<9;i++)record('editorial-nvlink-'+String(i+1).padStart(2,'0'),'nvlink',31-i);
  for(let i=0;i<9;i++)record('editorial-compute-'+String(i+10).padStart(2,'0'),'server',22-i);
  for(let i=0;i<4;i++)record('editorial-power-'+(i+5),'powershelf',13-i);
  // One 5U blanking panel covers U9-U5. The bottom CDU occupies U4-U1.
  record('editorial-reserve-blank','blanking',9,5);
  record('editorial-cdu-01','cdu',4,4);
  const PLAN=Object.freeze(records);
  const PLACEMENTS=Object.freeze(PLAN.map(item=>Object.freeze({name:item.name,type:item.mgx_type,top:item.rack_u,bottom:item.rack_u-item.rack_size+1,size:item.rack_size,y:(item.rack_u-item.rack_size/2)*U-HALF,height:item.rack_size*U-.026,meshKey:item.mgx_type+':'+item.rack_size})));
  const TARGET_Y=PLACEMENTS.find(item=>item.name===PRIMARY).y;
  function assemblySnapshot(value){
    const progress=clamp(Number(value)||0),alignment=ease(.12,.36,progress),insertion=ease(.40,.76,progress),pullback=ease(.78,1,progress),rackOpacity=ease(.10,.28,progress);
    const primaryPose={x:0,y:TARGET_Y*alignment,z:PARK_Z*(1-insertion),scale:1};
    const placements=PLACEMENTS.map(item=>({...item,x:0,y:item.name===PRIMARY?primaryPose.y:item.y,z:item.name===PRIMARY?primaryPose.z:0,opacity:item.name===PRIMARY?1:rackOpacity,primary:item.name===PRIMARY}));
    return {progress,model:'gb300-inspired',phase:progress<.12?'system':progress<.40?'align':progress<.76?'insert':progress<1?'pullback':'rack',
      primaryName:PRIMARY,targetU:TARGET_U,primaryPose,targetPose:{x:0,y:TARGET_Y,z:0,scale:1},alignment,insertion,pullback,rackOpacity,
      primaryOpacity:1,primarySize:1,occupiedU:48,emptyU:[],placements,staticPlacements:placements.filter(item=>!item.primary)};
  }
  const VERTEX=`
    attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;attribute vec2 aMaterial;
    uniform mat4 uViewProjection;uniform mat4 uModel;uniform mat4 uPart;uniform float uOpacity;
    varying vec3 vPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec4 vColor;varying vec2 vMaterial;
    void main(){mat4 model=uModel*uPart;vec4 world=model*vec4(aPosition,1.0);vPosition=world.xyz;vLocal=aPosition;vNormal=mat3(model)*aNormal;vColor=vec4(aColor.rgb,aColor.a*uOpacity);vMaterial=aMaterial;gl_Position=uViewProjection*world;}`;
  const FRAGMENT=`
    precision highp float;
    varying vec3 vPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec4 vColor;varying vec2 vMaterial;
    uniform vec3 uEye;uniform float uLightTheme;
    void main(){
      if(vMaterial.y<-.5){gl_FragColor=vColor;return;}
      vec3 N=normalize(vNormal),V=normalize(uEye-vPosition),R=reflect(-V,N);
      vec3 key=normalize(vec3(-.58,.88,.72)),fill=normalize(vec3(.74,.40,-.35));
      float metal=max(vMaterial.x,0.0),lambert=max(dot(N,key),0.0),hemisphere=.22+.17*(N.y*.5+.5);
      float brush=.992+.008*sin(vLocal.z*440.0+vLocal.x*17.0);
      vec3 base=vColor.rgb*(hemisphere+lambert*.86+max(dot(N,fill),0.0)*.20)*brush;
      float overhead=pow(max(dot(R,normalize(vec3(-.46,.67,-.59))),0.0),18.0);
      float side=pow(max(dot(R,normalize(vec3(-.83,.30,.42))),0.0),24.0);
      float back=pow(max(dot(R,normalize(vec3(.72,.42,-.65))),0.0),22.0);
      float spec=pow(max(dot(N,normalize(key+V)),0.0),95.0),fresnel=pow(1.0-max(dot(N,V),0.0),4.0);
      base+=vec3(.88,.92,.94)*(overhead*.42+side*.30+spec*.38)*metal;
      // An analytic ceiling softbox: its reflected rectangle moves across the lid
      // with the viewpoint, like a product studio, without a texture download.
      vec3 ceiling=vPosition+R*((16.0-vPosition.y)/max(R.y,.08));
      float softbox=(1.0-smoothstep(4.0,7.0,abs(ceiling.x+7.0)))*(1.0-smoothstep(9.0,15.0,abs(ceiling.z+19.0)));
      base+=vec3(.83,.89,.92)*softbox*smoothstep(.10,.30,R.y)*metal*.15;
      base+=vec3(.35,.60,.69)*(back*.30+fresnel*.055)*metal;
      base+=vColor.rgb*uLightTheme*.075;
      base=mix(base,vColor.rgb,clamp(vMaterial.y,0.0,1.0));base+=vColor.rgb*max(vMaterial.y-1.0,0.0);
      if(vMaterial.x<-.5){float grain=fract(sin(dot(floor(vLocal*380.0),vec3(127.1,311.7,74.7)))*43758.5453);base*=.965+grain*.070;}
      gl_FragColor=vec4(pow(max(base,vec3(0.0)),vec3(.84)),vColor.a);
    }`;
  function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
  function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function lookAt(eye,target){
    let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];const l=Math.hypot(zx,zy,zz);zx/=l;zy/=l;zz/=l;
    const xl=Math.hypot(zz,zx),xx=zz/xl,xz=-zx/xl,yx=zy*xz,yy=zz*xx-zx*xz,yz=-zy*xx;
    return new Float32Array([xx,yx,zx,0,0,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
  }
  function rotation(y,x){const cy=Math.cos(y),sy=Math.sin(y),cx=Math.cos(x),sx=Math.sin(x);return new Float32Array([cy,0,-sy,0,sy*sx,cx,cy*sx,0,sy*cx,-sx,cy*cx,0,0,0,0,1]);}
  function translation(x=0,y=0,z=0){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]);}
  function transform(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
  function addAlpha(data){
    const out=new Float32Array(data.length/11*12);
    for(let s=0,d=0;s<data.length;s+=11,d+=12){for(let i=0;i<9;i++)out[d+i]=data[s+i];out[d+9]=data[s+9]===-3?.20:1;out[d+10]=data[s+9]===-3?.65:data[s+9];out[d+11]=data[s+10];}
    return out;
  }
  function auxiliaryMesh(){
    const data=[],vertex=(p,n,c,a=1,m=.8,e=0)=>data.push(...p,...n,...c,a,m,e);
    function quad(a,b,c,d,n,color,metal=.8){for(const p of [a,b,c,a,c,d])vertex(p,n,color,1,metal);}
    function box(x,y,z,w,h,d,color,metal=.8){const W=w/2,H=h/2,D=d/2,p=(a,b,c)=>[x+a,y+b,z+c],f=[[[ -W,-H,D],[W,-H,D],[W,H,D],[-W,H,D],[0,0,1]],[[W,-H,-D],[-W,-H,-D],[-W,H,-D],[W,H,-D],[0,0,-1]],[[W,-H,D],[W,-H,-D],[W,H,-D],[W,H,D],[1,0,0]],[[-W,-H,-D],[-W,-H,D],[-W,H,D],[-W,H,-D],[-1,0,0]],[[-W,H,D],[W,H,D],[W,H,-D],[-W,H,-D],[0,1,0]],[[-W,-H,-D],[W,-H,-D],[W,-H,D],[-W,-H,D],[0,-1,0]]];f.forEach(v=>quad(p(...v[0]),p(...v[1]),p(...v[2]),p(...v[3]),v[4],color,metal));}
    function shadow(rx,rz,alpha){for(let i=0;i<64;i++){const a=i/64*TAU,b=(i+1)/64*TAU;vertex([0,0,0],[0,1,0],[0,0,0],alpha,0,-1);vertex([Math.cos(a)*rx,0,Math.sin(a)*rz],[0,1,0],[0,0,0],0,0,-1);vertex([Math.cos(b)*rx,0,Math.sin(b)*rz],[0,1,0],[0,0,0],0,0,-1);}}
    return {data,box,shadow};
  }
  function createParts(){
    const factory=window.PARackScene?.buildEditorialParts;
    if(typeof factory!=='function')throw new Error('Shared rack geometry is unavailable');
    const shared=factory(PLAN),meshes={rack:{data:addAlpha(shared.frame.data)}};
    Object.entries(shared.equipment).forEach(([name,mesh])=>meshes[name]={data:addAlpha(mesh.data)});
    const floor=auxiliaryMesh(),slotRails=auxiliaryMesh(),runner=auxiliaryMesh();floor.shadow(3.5,4.8,.32);
    for(const side of [-1,1]){
      // Nested linear rails flank the tray body. The moving member shares
      // precisely the tray's insertion translation, clear of neighboring slots.
      slotRails.box(side*2.018,-.095,.04,.018,.057,5.95,[.17,.22,.25],.94);
      slotRails.box(side*2.016,-.122,.04,.030,.010,5.95,[.48,.54,.56],.95);
      runner.box(side*2.010,-.086,.08,.012,.021,5.75,[.57,.62,.65],.96);
      runner.box(side*2.010,-.097,.08,.021,.007,5.75,[.30,.37,.41],.94);
    }
    meshes.floor={data:new Float32Array(floor.data)};meshes.slotRails={data:new Float32Array(slotRails.data)};meshes.runner={data:new Float32Array(runner.data)};
    return {meshes,shared};
  }
  function mount(canvas){
    const noop={supported:false,setProgress(){},setPointer(){},setOrbit(){},resetOrbit(){},setTheme(){},getState(){return {supported:false};},resize(){},destroy(){}};
    if(!canvas||typeof canvas.getContext!=='function')return noop;
    let gl,program,parts=null,shared=null,frame=0,disposed=false,contextLost=false,ready=false,maxBufferSize=4096;
    let progress=0,pointerX=0,pointerY=0,yaw=0,pitch=0,manual=false,settling=null,drag=null,light=0;
    const shaders=[],attributes={},uniforms={},reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const fail=(reason='WebGL is unavailable')=>{canvas.dataset.coreState='fallback';canvas.dataset.coreError=String(reason);canvas.dispatchEvent(new CustomEvent('pa-core-fallback',{bubbles:true,detail:{reason:String(reason)}}));};
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power',preserveDrawingBuffer:false});}catch(error){fail(error.message);return noop;}if(!gl){fail();return noop;}
    function compile(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Core scene shader compilation failed: '+gl.getShaderInfoLog(s));return s;}
    function setup(){
      maxBufferSize=Math.min(4096,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||4096);program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Core scene shader linking failed: '+gl.getProgramInfoLog(program));shaders.forEach(s=>gl.deleteShader(s));shaders.length=0;parts={};
      const built=createParts();shared=built.shared;
      Object.entries(built.meshes).forEach(([name,mesh])=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data,gl.STATIC_DRAW);parts[name]={buffer,count:mesh.data.length/12};});
      ['aPosition','aNormal','aColor','aMaterial'].forEach(n=>attributes[n]=gl.getAttribLocation(program,n));['uViewProjection','uModel','uPart','uOpacity','uEye','uLightTheme'].forEach(n=>uniforms[n]=gl.getUniformLocation(program,n));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);ready=false;
      canvas.dataset.coreModel='gb300-inspired';canvas.dataset.coreComputeTrays='18';canvas.dataset.coreSwitchTrays='9';canvas.dataset.coreGeometryBuffers=String(Object.keys(parts).length);canvas.dataset.coreVertices=String(Object.values(parts).reduce((sum,p)=>sum+p.count,0));
    }
    function release(){if(gl&&!contextLost){if(parts)Object.values(parts).forEach(p=>gl.deleteBuffer(p.buffer));if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}parts=null;program=null;shared=null;shaders.length=0;}
    try{setup();}catch(error){release();fail(error.message);return noop;}
    function requestDraw(){if(!disposed&&!contextLost&&program&&parts&&!frame)frame=requestAnimationFrame(draw);}
    function syncOrbit(){canvas.dataset.coreYaw=yaw.toFixed(4);canvas.dataset.corePitch=pitch.toFixed(4);canvas.dataset.coreDragging=String(!!drag);}
    function draw(now){
      frame=0;if(disposed||contextLost||!program||!parts)return;
      if(settling){const t=clamp((now-settling.start)/settling.duration),blend=1-ease(0,1,t);yaw=settling.yaw*blend;pitch=settling.pitch*blend;if(t>=1){settling=null;yaw=0;pitch=0;manual=false;}syncOrbit();}
      const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
      const dpr=Math.min(window.devicePixelRatio||1,1.7,maxBufferSize/Math.max(rect.width,rect.height)),width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      const state=assemblySnapshot(progress),{primaryPose,alignment,insertion,pullback,rackOpacity}=state,aspect=width/height;
      // Track the physical tray through alignment/insertion, then reveal the
      // complete rack. This pivot frames the camera; it never teleports a part.
      const pivot=[0,mix(primaryPose.y,0,pullback),mix(primaryPose.z,0,ease(.10,.36,progress))];
      const authoredYaw=mix(mix(-.53,-.17,alignment),-.10,pullback),hover=manual||reduced.matches?0:1;
      const rotationMatrix=rotation(authoredYaw+yaw+pointerX*.035*hover,pitch+pointerY*.014*hover),model=multiply(rotationMatrix,translation(-pivot[0],-pivot[1],-pivot[2]));
      const eyeDirection=[.28,mix(mix(.49,.19,alignment),.11,pullback),.88],unit=eyeDirection.map(v=>v/Math.hypot(...eyeDirection));
      const viewRotation=lookAt(unit,[0,0,0]),tan=Math.tan(.545/2),marginX=mix(.91,.71,pullback),marginY=.90;
      const tray=shared.equipment['server:1'],trayMin=tray.min.map((v,i)=>v+[0,primaryPose.y,primaryPose.z][i]),trayMax=tray.max.map((v,i)=>v+[0,primaryPose.y,primaryPose.z][i]);
      // An upper-rack close-up makes the empty slot and linear insertion legible.
      // After seating, pull back to include every U, the frame and its feet.
      const reveal=ease(.075,.27,progress),rackMin=[-2.30,mix(2.22,-7.85,pullback),-4.62],rackMax=[2.30,7.83,3.39];
      const bounds={min:trayMin.map((v,i)=>mix(v,Math.min(v,rackMin[i]),reveal)),max:trayMax.map((v,i)=>mix(v,Math.max(v,rackMax[i]),reveal))};
      let required=0;
      for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){
        const p=transform(model,[x,y,z]),cx=viewRotation[0]*p[0]+viewRotation[4]*p[1]+viewRotation[8]*p[2],cy=viewRotation[1]*p[0]+viewRotation[5]*p[1]+viewRotation[9]*p[2],cz=viewRotation[2]*p[0]+viewRotation[6]*p[1]+viewRotation[10]*p[2];
        required=Math.max(required,cz+Math.abs(cx)/(tan*aspect*marginX),cz+Math.abs(cy)/(tan*marginY));
      }
      const distance=Math.max(9.5,required),eye=unit.map(v=>v*distance);
      canvas.dataset.coreCameraDistance=distance.toFixed(4);canvas.dataset.corePrimaryY=primaryPose.y.toFixed(5);canvas.dataset.corePrimaryZ=primaryPose.z.toFixed(5);canvas.dataset.coreTargetU=String(TARGET_U);canvas.dataset.coreAssemblyPhase=state.phase;canvas.dataset.coreInsertion=insertion.toFixed(5);
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.uViewProjection,false,multiply(perspective(.545,aspect,.1,140),lookAt(eye,[0,0,0])));gl.uniform3fv(uniforms.uEye,new Float32Array(eye));gl.uniform1f(uniforms.uLightTheme,light);gl.uniformMatrix4fv(uniforms.uModel,false,model);
      function part(name,matrix,opacity=1,writeDepth=true){if(opacity<=.003)return;const mesh=parts[name];gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);let offset=0;[['aPosition',3],['aNormal',3],['aColor',4],['aMaterial',2]].forEach(([attribute,size])=>{gl.enableVertexAttribArray(attributes[attribute]);gl.vertexAttribPointer(attributes[attribute],size,gl.FLOAT,false,48,offset);offset+=size*4;});gl.uniformMatrix4fv(uniforms.uPart,false,matrix);gl.uniform1f(uniforms.uOpacity,opacity);gl.depthMask(writeDepth);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
      part('floor',translation(0,-7.83,0),rackOpacity,false);
      // U40 is absent from this pass. Exactly one instance of server:1 is the
      // primary throughout the animation, never a substitute or crossfade.
      for(const item of state.staticPlacements)part(item.meshKey,translation(0,item.y,0),rackOpacity,rackOpacity>.998);
      part('rack',translation(),rackOpacity,rackOpacity>.998);
      const railsOpacity=ease(.33,.39,progress);
      part('slotRails',translation(0,TARGET_Y,0),railsOpacity,railsOpacity>.998);
      part('runner',translation(0,TARGET_Y,primaryPose.z),railsOpacity,railsOpacity>.998);
      part('server:1',translation(0,primaryPose.y,primaryPose.z));
      gl.depthMask(true);canvas.dataset.coreProgress=progress.toFixed(4);
      if(!ready){const error=gl.getError();if(error!==gl.NO_ERROR){fail('WebGL render error '+error);return;}ready=true;canvas.dataset.coreState='ready';delete canvas.dataset.coreError;canvas.dispatchEvent(new CustomEvent('pa-core-ready',{bubbles:true}));}if(settling)requestDraw();
    }
    function setOrbit(nextYaw,nextPitch){settling=null;manual=true;pointerX=0;pointerY=0;const y=Number(nextYaw),p=Number(nextPitch);yaw=((Number.isFinite(y)?y:0)+Math.PI)%TAU;if(yaw<0)yaw+=TAU;yaw-=Math.PI;pitch=clamp(Number.isFinite(p)?p:0,-1.55,1.55);syncOrbit();requestDraw();}
    function startSettle(){if(settling||(!yaw&&!pitch))return;if(reduced.matches){yaw=0;pitch=0;manual=false;syncOrbit();return;}settling={yaw,pitch,start:performance.now(),duration:460};requestDraw();}
    function resetOrbit(){settling=null;drag=null;canvas.dataset.coreDragging='false';startSettle();if(!yaw&&!pitch){manual=false;requestDraw();}}
    function onDown(event){if(event.button!==0||event.isPrimary===false||!ready)return;settling=null;drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch};manual=true;try{canvas.setPointerCapture(event.pointerId);}catch{}canvas.focus({preventScroll:true});syncOrbit();}
    function onMove(event){if(!drag||event.pointerId!==drag.id)return;setOrbit(drag.yaw+(event.clientX-drag.x)*.008,drag.pitch+(event.clientY-drag.y)*.007);}
    function onUp(event){if(!drag||event.pointerId!==drag.id)return;try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}drag=null;syncOrbit();}
    function onKey(event){const step=event.shiftKey?.24:.12;if(event.key==='ArrowLeft')setOrbit(yaw-step,pitch);else if(event.key==='ArrowRight')setOrbit(yaw+step,pitch);else if(event.key==='ArrowUp')setOrbit(yaw,pitch-step);else if(event.key==='ArrowDown')setOrbit(yaw,pitch+step);else if(event.key==='Home'||event.key.toLowerCase()==='r')resetOrbit();else return;event.preventDefault();}
    function onLost(event){event.preventDefault();contextLost=true;ready=false;if(frame)cancelAnimationFrame(frame);frame=0;drag=null;syncOrbit();fail('WebGL context was lost');}
    function onRestored(){contextLost=false;try{setup();requestDraw();}catch(error){release();fail(error.message);}}
    const originalTouchAction=canvas.style.touchAction;canvas.style.touchAction='none';canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);canvas.addEventListener('lostpointercapture',onUp);canvas.addEventListener('keydown',onKey);canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(requestDraw):null;if(ro)ro.observe(canvas);else window.addEventListener('resize',requestDraw,{passive:true});syncOrbit();requestDraw();
    const api={supported:true,
      setProgress(value){const next=clamp(Number(value)||0);if(Math.abs(next-progress)<.0005)return;progress=next;if(manual&&!drag)startSettle();requestDraw();},
      setPointer(x,y){if(manual||drag)return;const nx=clamp(Number(x)||0,-1,1),ny=clamp(Number(y)||0,-1,1);if(Math.abs(nx-pointerX)+Math.abs(ny-pointerY)<.001)return;pointerX=nx;pointerY=ny;requestDraw();},
      setOrbit,resetOrbit,setTheme(value){const next=value===true||value==='light'?1:0;if(next===light)return;light=next;requestDraw();},
      getState(){return {supported:true,ready,contextLost,progress,yaw,pitch,dragging:!!drag,settling:!!settling,theme:light?'light':'dark',model:'gb300-inspired',computeTrays:18,switchTrays:9,networkSwitches:2,powerShelves:8,occupiedU:48,componentCount:41,geometryBuffers:parts?Object.keys(parts).length:0,assembly:assemblySnapshot(progress),disposed};},resize:requestDraw,
      destroy(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;settling=null;drag=null;ro?.disconnect();window.removeEventListener('resize',requestDraw);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onUp);canvas.removeEventListener('lostpointercapture',onUp);canvas.removeEventListener('keydown',onKey);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);canvas.style.touchAction=originalTouchAction;release();canvas.dataset.coreState='disposed';delete canvas.paCoreScene;}
    };canvas.paCoreScene=api;return api;
  }
  window.PACoreScene=Object.freeze({mount,assemblySnapshot});
})();
