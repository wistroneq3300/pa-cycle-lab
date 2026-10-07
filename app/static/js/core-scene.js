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
  // Neutral service/blanking regions. The compute rack contains no CDU.
  record('editorial-reserve-blank','blanking',9,5);
  record('editorial-infrastructure-blank','blanking',4,4);
  const PLAN=Object.freeze(records);
  const PLACEMENTS=Object.freeze(PLAN.map(item=>Object.freeze({name:item.name,type:item.mgx_type,top:item.rack_u,bottom:item.rack_u-item.rack_size+1,size:item.rack_size,y:(item.rack_u-item.rack_size/2)*U-HALF,height:item.rack_size*U-.026,meshKey:item.mgx_type+':'+item.rack_size})));
  const TARGET_Y=PLACEMENTS.find(item=>item.name===PRIMARY).y;
  const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
  const interval=(a,b,p)=>smooth((p-a)/(b-a));
  const groupTravel={server:.46,nvlink:.75,powershelf:.28,switch:.58,blanking:0};
  function motion(progress,out={}){
    out.progress=progress;out.alignment=interval(.09,.22,progress);out.insertion=interval(.26,.46,progress);
    out.pullback=interval(.48,.56,progress);out.rackOpacity=interval(.075,.20,progress);
    out.explode=interval(.805,.85,progress)*(1-interval(.865,.902,progress));
    out.scan=interval(.908,.92,progress)*(1-interval(.958,.976,progress));
    out.scanY=mix(-7.6,7.7,clamp((progress-.912)/.057));
    out.phase=progress<.09?'system':progress<.22?'align':progress<.26?'engage':progress<.46?'insert':progress<.49?'seat':progress<.56?'pullback':progress<.605?'rack':progress<.715?'orbit':progress<.765?'rear':progress<.805?'return':progress<.905?'exploded':progress<.977?'scan':'hero';
    return out;
  }
  function assemblySnapshot(value){
    const progress=clamp(Number(value)||0),sample=motion(progress),{alignment,insertion,pullback,rackOpacity,explode}=sample;
    const primaryPose={x:0,y:TARGET_Y*alignment,z:PARK_Z*(1-insertion),scale:1};
    const placements=PLACEMENTS.map(item=>({...item,x:0,y:item.name===PRIMARY?primaryPose.y:item.y,z:(item.name===PRIMARY?primaryPose.z:0)+groupTravel[item.type]*explode,opacity:item.name===PRIMARY?1:rackOpacity,primary:item.name===PRIMARY}));
    return {...sample,model:'gb200-gb300-inspired-concept',
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
    uniform vec3 uEye;uniform float uLightTheme;uniform float uTime;uniform float uScan;uniform float uScanY;
    uniform float uRack;uniform float uQuality;
    float boxLight(vec3 R,vec3 direction,float power){return pow(max(dot(R,normalize(direction)),0.0),power);}
    void main(){
      if(vMaterial.y<-.5){gl_FragColor=vColor;return;}
      vec3 N=normalize(vNormal),V=normalize(uEye-vPosition),R=reflect(-V,N);
      float metal=clamp(vMaterial.x,0.0,1.0),polymer=1.0-metal;
      float grain=fract(sin(dot(floor(vLocal*310.0),vec3(127.1,311.7,74.7)))*43758.5453);
      float rough=.31+polymer*.37+(grain-.5)*.018;
      if(vMaterial.x<-.5)rough=.72;
      vec3 key=normalize(vec3(-8.0+sin(uTime*.13)*1.4,13.0,12.0)-vPosition*.26);
      vec3 fill=normalize(vec3(.65,.35,-.72));
      float lambert=max(dot(N,key),0.0),backFill=max(dot(N,fill),0.0);
      float brush=1.0+(sin(vLocal.z*640.0+vLocal.x*13.0)*.007+(grain-.5)*.012)*metal;
      float hemisphere=.23+.12*(N.y*.5+.5);
      // Local contact shading separates individual trays without a shadow-map
      // context, texture, or an expensive screen-space postprocessing pass.
      float slot=fract((vPosition.y+7.2)/.30);
      float seam=smoothstep(.01,.115,slot)*(1.0-smoothstep(.88,.99,slot));
      float contact=mix(1.0,.76+.24*seam,uRack*.62);
      vec3 base=vColor.rgb*(hemisphere+lambert*.66+backFill*.48)*brush*contact*mix(1.0,.69,metal);
      float exponent=mix(115.0,24.0,rough);
      float spec=pow(max(dot(N,normalize(key+V)),0.0),exponent);
      float fresnel=pow(1.0-max(dot(N,V),0.0),4.0);
      float overhead=boxLight(R,vec3(-.38,.81,-.43),13.0);
      float side=boxLight(R,vec3(-.83,.22,.45),20.0);
      float rear=boxLight(R,vec3(.55,.44,-.70),16.0);
      float serviceBox=boxLight(R,vec3(.04,.17,-1.0),7.0);
      float flankBox=boxLight(R,vec3(.98,.16,.03),9.0);
      vec3 ceiling=vPosition+R*((18.0-vPosition.y)/max(R.y,.10));
      float softbox=(1.0-smoothstep(2.5,12.0,abs(ceiling.x-29.0+sin(uTime*.11)*4.0)))*
        (1.0-smoothstep(12.0,26.0,abs(ceiling.z+16.0)))*smoothstep(.10,.35,R.y);
      base+=vec3(.88,.91,.94)*(overhead*.25+side*.22+spec*.29+softbox*.35)*metal;
      base+=vec3(.48,.60,.68)*(rear*.25+fresnel*.09)*(.35+metal*.65);
      base+=vec3(.78,.84,.87)*(serviceBox*.19+flankBox*.14)*(.22+metal*.78);
      base+=vec3(.84,.87,.88)*polymer*(spec*.035+flankBox*.026);
      base+=vColor.rgb*uLightTheme*.08;
      if(vMaterial.x<-.5)base*=.965+grain*.070;
      base=mix(base,vColor.rgb,clamp(vMaterial.y,0.0,1.0)*.72);
      base+=vColor.rgb*max(vMaterial.y-1.0,0.0)*.35;
      // A narrow inspection band, restrained contours and technical hatching.
      // The solid body keeps its depth: scan shading never exposes an empty shell.
      float band=exp(-pow((vPosition.y-uScanY)*5.8,2.0))*uScan;
      float line=1.0-smoothstep(.009,.022,abs(vPosition.y-uScanY));
      float hatch=step(.94,fract(vLocal.x*20.0+vLocal.z*8.0));
      base=mix(base,base*.76+vec3(.25,.39,.42)*(fresnel*.75+hatch*.15),band*.55);
      base+=vec3(.34,.47,.46)*(line*.68+fresnel*band*.28)*uScan;
      // Smooth highlight shoulder retains brushed metal detail at grazing angles.
      base=base/(vec3(1.0)+max(base-vec3(.62),vec3(0.0))*.55);
      gl_FragColor=vec4(pow(max(base,vec3(0.0)),vec3(.88)),vColor.a);
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
    for(const key of ['infrastructure','connections'])if(shared[key])meshes[key]={data:addAlpha(shared[key].data)};
    const floor=auxiliaryMesh(),slotRails=auxiliaryMesh(),middleRail=auxiliaryMesh(),runner=auxiliaryMesh(),scan=auxiliaryMesh();floor.shadow(3.3,4.5,.32);
    for(const x of [-2.50,2.50])scan.box(x,0,-.45,.018,.014,8.00,[.34,.47,.46],0);
    for(const z of [-4.45,3.55])scan.box(0,0,z,5.00,.014,.018,[.34,.47,.46],0);
    for(let i=11;i<scan.data.length;i+=12)scan.data[i]=1.1;
    meshes.scanPlane={data:new Float32Array(scan.data)};
    for(const side of [-1,1]){
      // Nested linear rails flank the tray body. The moving member shares
      // precisely the tray's insertion translation, clear of neighboring slots.
      slotRails.box(side*2.044,-.095,.04,.020,.057,5.95,[.17,.22,.25],.94);
      slotRails.box(side*2.039,-.122,.04,.030,.010,5.95,[.48,.54,.56],.95);
      middleRail.box(side*2.024,-.092,.06,.016,.038,5.85,[.33,.38,.41],.94);
      middleRail.box(side*2.025,-.112,.06,.024,.007,5.85,[.54,.58,.60],.95);
      runner.box(side*2.007,-.086,.08,.012,.021,5.75,[.57,.62,.65],.96);
      runner.box(side*2.008,-.097,.08,.017,.007,5.75,[.30,.37,.41],.94);
    }
    meshes.floor={data:new Float32Array(floor.data)};meshes.slotRails={data:new Float32Array(slotRails.data)};meshes.middleRail={data:new Float32Array(middleRail.data)};meshes.runner={data:new Float32Array(runner.data)};
    return {meshes,shared};
  }
  // Camera keys are independent from physical placement. Equipment stays on
  // its rails while the lens tracks, seats, reveals and circles the structure.
  const CAMERA_KEYS=[
    [0,-.64,.52,0,0,0],[.09,-.59,.46,0,0,0],
    [.18,-.30,.18,0,0,.25],[.23,-.74,.13,0,0,.20],[.26,-.74,.13,0,0,.20],
    [.40,-.78,.14,0,0,.08],[.48,-.60,.15,0,0,.02],
    [.56,-.64,.105,1,0,0],[.605,-.68,.105,1,0,0],
    [.66,-1.57,.08,1,0,0],[.712,-2.62,.105,1,0,0],
    [.742,-Math.PI,.06,1,0,0],[.762,-Math.PI,.06,1,0,0],
    [.805,-.57,.14,1,0,0],[.85,-.79,.18,1,0,0],
    [.875,-.99,.19,1,0,0],[.905,-.64,.105,1,0,0],
    [1,-.64,.105,1,0,0]
  ];
  function cameraKey(p,out){
    let i=1;while(i<CAMERA_KEYS.length-1&&p>CAMERA_KEYS[i][0])i++;
    const a=CAMERA_KEYS[i-1],b=CAMERA_KEYS[i],t=smooth((p-a[0])/(b[0]-a[0]));
    for(let k=1;k<6;k++)out[k-1]=mix(a[k],b[k],t);
    return out;
  }
  function fittedDistance(min,max,target,yaw,elevation,aspect,marginY=.78,marginX=.88){
    const sx=Math.sin(yaw),cx=Math.cos(yaw),sy=Math.sin(elevation),cy=Math.cos(elevation),tan=Math.tan(.50/2);
    let distance=4;
    for(let i=0;i<8;i++){
      const x=(i&1?max[0]:min[0])-target[0],y=(i&2?max[1]:min[1])-target[1],z=(i&4?max[2]:min[2])-target[2];
      const vx=cx*x-sx*z,vy=-sx*sy*x+cy*y-cx*sy*z,vz=sx*cy*x+sy*y+cx*cy*z;
      distance=Math.max(distance,vz+Math.abs(vx)/(tan*aspect*marginX),vz+Math.abs(vy)/(tan*marginY));
    }
    return distance;
  }
  function mount(canvas){
    const noop={supported:false,setProgress(){},setPointer(){},setOrbit(){},setView(){},resetOrbit(){},setTheme(){},getState(){return {supported:false};},resize(){},destroy(){}};
    if(!canvas||typeof canvas.getContext!=='function')return noop;
    let gl,program,parts=null,shared=null,frame=0,disposed=false,contextLost=false,ready=false,maxBufferSize=4096;
    let progress=0,pointerX=0,pointerY=0,yaw=0,pitch=0,manual=false,drag=null,light=0,view='authored';
    let visible=true,intersecting=true,lastTime=0,lightTime=0,drawCalls=0,vertices=0,slowFrames=0,resolution=1,frameMs=16.7;
    let idleTimer=0,idleStart=0,idleWeight=0,idleExit=0,idleYaw=0,idlePitch=0,idleTravel=0;
    let cameraReady=false,cameraSettling=false,lastActivity=performance.now();
    const shaders=[],attributes={},uniforms={},reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const sample={},key=new Float32Array(5),eye=new Float32Array(3),target=new Float32Array(3),wanted=new Float32Array(6),camera=new Float32Array(6);
    const identity=translation(),moving=translation(),railMatrix=translation(0,TARGET_Y,0),floorMatrix=translation(0,-7.82,0);
    const matrices=PLACEMENTS.map(item=>translation(0,item.y,0));
    const fail=(reason='WebGL is unavailable')=>{canvas.dataset.coreState='fallback';canvas.dataset.coreError=String(reason);canvas.dispatchEvent(new CustomEvent('pa-core-fallback',{bubbles:true,detail:{reason:String(reason)}}));};
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});}catch(error){fail(error.message);return noop;}if(!gl){fail();return noop;}
    function compile(type,source){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Core scene shader compilation failed: '+gl.getShaderInfoLog(shader));return shader;}
    function setup(){
      maxBufferSize=Math.min(4096,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||4096);
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Core scene shader linking failed: '+gl.getProgramInfoLog(program));
      shaders.forEach(shader=>gl.deleteShader(shader));shaders.length=0;parts={};
      const built=createParts();shared=built.shared;vertices=0;
      Object.entries(built.meshes).forEach(([name,mesh])=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data,gl.STATIC_DRAW);parts[name]={buffer,count:mesh.data.length/12};vertices+=mesh.data.length/12;});
      ['aPosition','aNormal','aColor','aMaterial'].forEach(name=>attributes[name]=gl.getAttribLocation(program,name));
      ['uViewProjection','uModel','uPart','uOpacity','uEye','uLightTheme','uTime','uScan','uScanY','uRack','uQuality'].forEach(name=>uniforms[name]=gl.getUniformLocation(program,name));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);ready=false;
      canvas.dataset.coreModel='gb200-gb300-inspired-concept';canvas.dataset.coreComputeTrays='18';canvas.dataset.coreSwitchTrays='9';
      canvas.dataset.coreGeometryBuffers=String(Object.keys(parts).length);canvas.dataset.coreVertices=String(vertices);
    }
    function release(){if(gl&&!contextLost){if(parts)Object.values(parts).forEach(part=>gl.deleteBuffer(part.buffer));if(program)gl.deleteProgram(program);shaders.forEach(shader=>gl.deleteShader(shader));}parts=null;program=null;shared=null;shaders.length=0;}
    try{setup();}catch(error){release();fail(error.message);return noop;}
    function requestDraw(){if(!disposed&&!contextLost&&program&&parts&&!frame&&visible)frame=requestAnimationFrame(draw);}
    function syncOrbit(){canvas.dataset.coreYaw=yaw.toFixed(4);canvas.dataset.corePitch=pitch.toFixed(4);canvas.dataset.coreDragging=String(!!drag);}
    function armIdle(){
      clearTimeout(idleTimer);idleTimer=0;
      if(disposed||reduced.matches||!visible||progress<.999||drag||manual)return;
      idleTimer=setTimeout(()=>{idleTimer=0;if(cameraSettling){armIdle();return;}if(!disposed&&!reduced.matches&&visible&&progress>=.999&&!manual){idleStart=performance.now();idleExit=0;requestDraw();}},6500);
    }
    function activity(){
      lastActivity=performance.now();
      if(idleStart&&!idleExit)idleExit=lastActivity;
      armIdle();requestDraw();
    }
    function updateCamera(now,aspect,dt){
      cameraKey(progress,key);
      let azimuth=key[0]+yaw,elevation=clamp(key[1]+pitch,-1.35,1.35),reveal=key[2];
      if(idleStart){
        const t=((now-idleStart)/42000)%1;
        const orbit=t<.50?interval(0,.50,t):1-interval(.65,1,t);
        if(!idleExit){idleYaw=-orbit*2.65;idlePitch=Math.sin(t*TAU)*.025;idleTravel=interval(.76,.82,t)*(1-interval(.84,.9,t))*.12;}
        idleWeight=idleExit?Math.max(0,idleWeight-dt/950):Math.min(1,(now-idleStart)/1200);
        azimuth+=idleYaw*idleWeight;elevation+=idlePitch*idleWeight;
        if(idleExit&&idleWeight<=0){idleStart=0;idleExit=0;idleTravel=0;armIdle();}
      }
      if(!manual&&!reduced.matches){azimuth+=pointerX*.022;elevation+=pointerY*.009;}
      const y=TARGET_Y*sample.alignment,z=PARK_Z*(1-sample.insertion);
      target[0]=0;target[1]=mix(y,0,reveal);target[2]=mix(z,0,interval(.09,.22,progress));
      const tray=shared.equipment['server:1'];
      const trayMin=[tray.min[0],tray.min[1]+y,tray.min[2]+z],trayMax=[tray.max[0],tray.max[1]+y,tray.max[2]+z];
      const closeDistance=fittedDistance(trayMin,trayMax,target,azimuth,elevation,aspect,.83,.90);
      const rackDistance=fittedDistance(shared.bounds.min,shared.bounds.max,[0,0,0],azimuth,elevation,aspect,.79,.88);
      const trackDistance=mix(closeDistance,Math.max(closeDistance,17.5),interval(.09,.22,progress));
      let distance=mix(trackDistance,rackDistance,reveal);
      if(view==='middle'){target[1]=.35;target[2]=.35;distance=Math.max(12,10/aspect);}
      wanted[0]=azimuth;wanted[1]=elevation;wanted[2]=distance;wanted[3]=target[0];wanted[4]=target[1];wanted[5]=target[2];
      // Fixed damping preserves a weighted camera on replay, input and scroll.
      const blend=!cameraReady||reduced.matches?1:1-Math.exp(-dt/150);
      const wasSettling=cameraSettling;cameraSettling=false;
      for(let i=0;i<6;i++){const difference=wanted[i]-camera[i],delta=i===0?Math.atan2(Math.sin(difference),Math.cos(difference)):difference;camera[i]+=delta*blend;if(Math.abs(delta)>.0004)cameraSettling=true;}
      // The final hero must finish arriving before its inactivity hold begins,
      // including on slow devices where convergence takes longer than 6.5s.
      if(wasSettling&&!cameraSettling&&!idleStart&&progress>=.999)armIdle();
      cameraReady=true;
      const sy=Math.sin(camera[0]),cy=Math.cos(camera[0]),se=Math.sin(camera[1]),ce=Math.cos(camera[1]);
      target[0]=camera[3];target[1]=camera[4];target[2]=camera[5];
      eye[0]=target[0]+sy*ce*camera[2];eye[1]=target[1]+se*camera[2];eye[2]=target[2]+cy*ce*camera[2];
    }
    function part(name,matrix,opacity=1,writeDepth=true){
      const mesh=parts[name];if(!mesh||opacity<=.003)return;
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      gl.enableVertexAttribArray(attributes.aPosition);gl.vertexAttribPointer(attributes.aPosition,3,gl.FLOAT,false,48,0);
      gl.enableVertexAttribArray(attributes.aNormal);gl.vertexAttribPointer(attributes.aNormal,3,gl.FLOAT,false,48,12);
      gl.enableVertexAttribArray(attributes.aColor);gl.vertexAttribPointer(attributes.aColor,4,gl.FLOAT,false,48,24);
      gl.enableVertexAttribArray(attributes.aMaterial);gl.vertexAttribPointer(attributes.aMaterial,2,gl.FLOAT,false,48,40);
      gl.uniformMatrix4fv(uniforms.uPart,false,matrix);gl.uniform1f(uniforms.uOpacity,opacity);gl.depthMask(writeDepth);gl.drawArrays(gl.TRIANGLES,0,mesh.count);drawCalls++;
    }
    function draw(now){
      frame=0;if(disposed||contextLost||!program||!parts||!visible)return;
      const elapsed=lastTime?now-lastTime:16.7,dt=Math.min(250,elapsed);lastTime=now;
      if(elapsed<2000&&elapsed>3){frameMs=frameMs*.96+elapsed*.04;if(frameMs>29)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);}
      if(slowFrames>24&&resolution>.7){resolution=Math.max(.7,resolution-.1);slowFrames=0;}
      if(!reduced.matches)lightTime+=dt/1000;
      const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
      const pixelBudget=2600000,desiredDpr=Math.min(window.devicePixelRatio||1,1.65,Math.sqrt(pixelBudget/(rect.width*rect.height)));
      const dpr=Math.min(desiredDpr*resolution,maxBufferSize/Math.max(rect.width,rect.height));
      const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      motion(progress,sample);updateCamera(now,width/height,dt);
      const explode=sample.explode+idleTravel*idleWeight;
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.uViewProjection,false,multiply(perspective(.50,width/height,.15,180),lookAt(eye,target)));
      gl.uniform3fv(uniforms.uEye,eye);gl.uniformMatrix4fv(uniforms.uModel,false,identity);
      gl.uniform1f(uniforms.uLightTheme,light);gl.uniform1f(uniforms.uTime,reduced.matches?0:lightTime);
      gl.uniform1f(uniforms.uScan,reduced.matches?0:sample.scan);gl.uniform1f(uniforms.uScanY,sample.scanY);
      gl.uniform1f(uniforms.uRack,sample.rackOpacity);gl.uniform1f(uniforms.uQuality,resolution);drawCalls=0;
      part('floor',floorMatrix,sample.rackOpacity,false);
      for(let i=0;i<PLACEMENTS.length;i++){
        const item=PLACEMENTS[i];if(item.name===PRIMARY)continue;
        matrices[i][14]=groupTravel[item.type]*explode;
        part(item.meshKey,matrices[i],sample.rackOpacity);
      }
      part('rack',identity,sample.rackOpacity);part('infrastructure',identity,sample.rackOpacity);
      const railsOpacity=interval(.18,.23,progress);part('slotRails',railMatrix,railsOpacity);
      moving[13]=TARGET_Y;moving[14]=PARK_Z*(1-sample.insertion)*.5+groupTravel.server*explode*.5;part('middleRail',moving,railsOpacity);
      moving[13]=TARGET_Y*sample.alignment;moving[14]=PARK_Z*(1-sample.insertion)+groupTravel.server*explode;
      part('runner',moving,railsOpacity);part('server:1',moving);
      const connected=interval(.47,.515,progress)*(1-interval(0,.035,explode));
      part('connections',identity,connected);
      if(sample.scan>.001&&!reduced.matches){moving[13]=sample.scanY;moving[14]=0;part('scanPlane',moving,sample.scan*.55,false);}
      gl.depthMask(true);
      canvas.dataset.coreProgress=progress.toFixed(4);canvas.dataset.coreCameraDistance=camera[2].toFixed(4);
      canvas.dataset.corePrimaryY=(TARGET_Y*sample.alignment).toFixed(5);canvas.dataset.corePrimaryZ=(PARK_Z*(1-sample.insertion)).toFixed(5);
      canvas.dataset.coreTargetU=String(TARGET_U);canvas.dataset.coreAssemblyPhase=sample.phase;canvas.dataset.coreInsertion=sample.insertion.toFixed(5);
      canvas.dataset.coreIdle=idleStart?'showcase':'waiting';canvas.dataset.coreScan=sample.scan.toFixed(3);
      if(!ready){const error=gl.getError();if(error!==gl.NO_ERROR){fail('WebGL render error '+error);return;}ready=true;canvas.dataset.coreState='ready';delete canvas.dataset.coreError;canvas.dispatchEvent(new CustomEvent('pa-core-ready',{bubbles:true}));}
      if(cameraSettling||idleStart||(!reduced.matches&&progress<.999))requestDraw();else lastTime=0;
    }
    function setOrbit(nextYaw,nextPitch){
      activity();manual=true;view='authored';pointerX=0;pointerY=0;
      const y=Number(nextYaw),p=Number(nextPitch);yaw=Number.isFinite(y)?y:0;pitch=clamp(Number.isFinite(p)?p:0,-1.2,1.2);
      syncOrbit();requestDraw();
    }
    function setView(name){
      const poses={front:[0,.035],side:[Math.PI/2,.07],rear:[Math.PI,.065],'three-quarter':[-.64,.105],top:[-.65,.68],middle:[-.65,.14]};
      const pose=poses[name];if(!pose)return;
      activity();cameraKey(progress,key);manual=true;view=name;yaw=pose[0]-key[0];pitch=pose[1]-key[1];pointerX=0;pointerY=0;
      syncOrbit();requestDraw();
    }
    function resetOrbit(){activity();drag=null;manual=false;view='authored';yaw=0;pitch=0;syncOrbit();armIdle();requestDraw();}
    function onDown(event){if(event.button!==0||event.isPrimary===false||!ready)return;activity();drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch};manual=true;try{canvas.setPointerCapture(event.pointerId);}catch{}canvas.focus({preventScroll:true});syncOrbit();}
    function onMove(event){if(!drag||event.pointerId!==drag.id)return;setOrbit(drag.yaw+(event.clientX-drag.x)*.006,drag.pitch+(event.clientY-drag.y)*.005);}
    function onUp(event){if(!drag||event.pointerId!==drag.id)return;try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}drag=null;syncOrbit();}
    function onKey(event){const step=event.shiftKey?.24:.12;if(event.key==='ArrowLeft')setOrbit(yaw-step,pitch);else if(event.key==='ArrowRight')setOrbit(yaw+step,pitch);else if(event.key==='ArrowUp')setOrbit(yaw,pitch-step);else if(event.key==='ArrowDown')setOrbit(yaw,pitch+step);else if(event.key==='Home'||event.key.toLowerCase()==='r')resetOrbit();else return;event.preventDefault();}
    function onLost(event){event.preventDefault();contextLost=true;ready=false;if(frame)cancelAnimationFrame(frame);frame=0;clearTimeout(idleTimer);drag=null;syncOrbit();fail('WebGL context was lost');}
    function onRestored(){contextLost=false;try{setup();lastTime=0;requestDraw();armIdle();}catch(error){release();fail(error.message);}}
    function onVisibility(){visible=intersecting&&(typeof document==='undefined'||!document.hidden);lastTime=0;if(visible){requestDraw();armIdle();}else{clearTimeout(idleTimer);if(frame)cancelAnimationFrame(frame);frame=0;idleStart=0;idleWeight=0;}}
    function onReduced(){if(reduced.matches){clearTimeout(idleTimer);idleStart=0;idleWeight=0;progress=1;manual=false;view='authored';yaw=0;pitch=0;}else armIdle();requestDraw();}
    const originalTouchAction=canvas.style.touchAction;canvas.style.touchAction='pan-y';
    const events={pointerdown:onDown,pointermove:onMove,pointerup:onUp,pointercancel:onUp,lostpointercapture:onUp,keydown:onKey,webglcontextlost:onLost,webglcontextrestored:onRestored};
    Object.entries(events).forEach(([name,handler])=>canvas.addEventListener(name,handler));
    const activityEvents=['pointermove','pointerdown','keydown','wheel','scroll','touchstart','hashchange'];
    activityEvents.forEach(name=>window.addEventListener(name,activity,{passive:true}));
    if(typeof document!=='undefined')document.addEventListener('visibilitychange',onVisibility);
    reduced.addEventListener?.('change',onReduced);
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(requestDraw):null;if(ro)ro.observe(canvas);else window.addEventListener('resize',requestDraw,{passive:true});
    const io=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting!==false;onVisibility();}):null;io?.observe(canvas);
    if(reduced.matches)progress=1;syncOrbit();requestDraw();armIdle();
    function projectionBounds(){
      if(!shared||!cameraReady)return null;
      const matrix=multiply(perspective(.50,canvas.width/canvas.height,.15,180),lookAt(eye,target));
      let left=1,right=-1,bottom=1,top=-1,nearest=Infinity;
      for(let i=0;i<8;i++){
        const p=[i&1?shared.bounds.max[0]:shared.bounds.min[0],i&2?shared.bounds.max[1]:shared.bounds.min[1],i&4?shared.bounds.max[2]:shared.bounds.min[2]];
        const w=matrix[3]*p[0]+matrix[7]*p[1]+matrix[11]*p[2]+matrix[15],q=transform(matrix,p);
        left=Math.min(left,q[0]/w);right=Math.max(right,q[0]/w);bottom=Math.min(bottom,q[1]/w);top=Math.max(top,q[1]/w);nearest=Math.min(nearest,w);
      }
      return {left,right,bottom,top,heightFraction:(top-bottom)/2,widthFraction:(right-left)/2,nearest,clipped:left< -1||right>1||bottom< -1||top>1||nearest<.15};
    }
    const api={supported:true,
      setProgress(value){const next=reduced.matches?1:clamp(Number(value)||0);if(Math.abs(next-progress)<.00001)return;activity();progress=next;if(manual&&!drag){manual=false;view='authored';yaw=0;pitch=0;syncOrbit();}armIdle();requestDraw();},
      setPointer(x,y){if(manual||drag||reduced.matches)return;pointerX=clamp(Number(x)||0,-1,1);pointerY=clamp(Number(y)||0,-1,1);requestDraw();},
      setOrbit,setView,resetOrbit,setTheme(value){const next=value===true||value==='light'?1:0;if(next===light)return;light=next;requestDraw();},
      getState(){return {supported:true,ready,contextLost,progress,yaw,pitch,dragging:!!drag,settling:cameraSettling,theme:light?'light':'dark',model:'gb200-gb300-inspired-concept',computeTrays:18,switchTrays:9,networkSwitches:2,powerShelves:8,occupiedU:48,componentCount:PLACEMENTS.length,geometryBuffers:parts?Object.keys(parts).length:0,vertices,drawCalls,
        camera:{yaw:camera[0],elevation:camera[1],distance:camera[2],target:Array.from(target),eye:Array.from(eye),fov:.50,view},bounds:projectionBounds(),geometry:shared?.quality||shared?.metadata||null,
        quality:{resolution,frameMs,pixelCount:canvas.width*canvas.height,adaptive:true},idle:{active:!!idleStart,exiting:!!idleExit,weight:idleWeight,delay:6500,lastActivity,disabled:reduced.matches},assembly:assemblySnapshot(progress),disposed};},resize:requestDraw,
      destroy(){if(disposed)return;disposed=true;clearTimeout(idleTimer);if(frame)cancelAnimationFrame(frame);frame=0;drag=null;ro?.disconnect();io?.disconnect();window.removeEventListener('resize',requestDraw);Object.entries(events).forEach(([name,handler])=>canvas.removeEventListener(name,handler));activityEvents.forEach(name=>window.removeEventListener(name,activity));if(typeof document!=='undefined')document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener?.('change',onReduced);canvas.style.touchAction=originalTouchAction;release();canvas.dataset.coreState='disposed';delete canvas.paCoreScene;}
    };canvas.paCoreScene=api;return api;
  }
  window.PACoreScene=Object.freeze({mount,assemblySnapshot});
})();
