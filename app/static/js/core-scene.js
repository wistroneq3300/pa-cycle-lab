/* PA System Core - shared GB300-inspired procedural equipment study.
 * Geometry is the same original CPU geometry used by PARackScene. No vendor
 * CAD, downloaded texture, external dependency or live equipment data is used.
 * A complete 48U system resolves into a coordinated equipment constellation,
 * assembles in overlapping waves, and reveals the U40 rail mechanism in detail.
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
  const PRIMARY_INDEX=PLACEMENTS.findIndex(item=>item.name===PRIMARY),TARGET_Y=PLACEMENTS[PRIMARY_INDEX].y;
  const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
  const interval=(a,b,p)=>smooth((p-a)/(b-a));
  const hasL10=()=>!!window.PAL10Hardware;
  // A prefix joins the existing film before convergence. The original primary
  // tray is replaced by the SAME articulated asset for its entire lifetime.
  function rackProgress(p){return !hasL10()?p:p<=.40?0:p<.56?.34*interval(.40,.56,p):.34+(p-.56)*1.5;}
  function l10State(p){
    const board=interval(.065,.125,p),packages=interval(.135,.195,p),io=interval(.202,.242,p),cooling=interval(.248,.288,p);
    const flow=interval(.292,.300,p)*(1-interval(.325,.333,p));
    return {board,packages,io,cooling,flow,lid:interval(.376,.407,p),
      boardLift:.66*(1-board),packageLift:1.25*(1-packages),ioLift:.82*(1-io),coolingLift:2.05*(1-cooling),
      phase:p<.065?'l10-exploded':p<.135?'compute-board':p<.202?'cpu-gpu-assembly':p<.248?'network-storage':p<.292?'cooling-install':p<.333?'cooling-reveal':p<.376?'l10-hero':p<.407?'chassis-close':p<.56?'camera-bridge':'rack-integration',
      packageSeparation:'visual-only / board-integrated packages',flowMeaning:'conceptual thermal-flow overlay',profile:window.PAL10Hardware?.profile?.id||null};
  }
  const groupTravel={server:1.52,nvlink:2.68,powershelf:.78,switch:1.94,blanking:.14};
  const groupLateral={server:0,nvlink:.60,powershelf:.30,switch:-.38,blanking:0};
  const classInfo={server:['COMPUTE TRAY','AI COMPUTE NODE'],nvlink:['NVLINK SWITCH TRAY','HIGH-SPEED GPU FABRIC'],switch:['NETWORK SWITCH','RACK NETWORK FABRIC'],powershelf:['POWER SHELF','RACK POWER DELIVERY']};
  const classCounts=Object.freeze(Object.fromEntries(Object.keys(classInfo).map(type=>[type,PLACEMENTS.filter(item=>item.type===type).length])));
  const familyIndex={};
  const choreography=PLACEMENTS.map(item=>{
    const index=familyIndex[item.type]||0;familyIndex[item.type]=index+1;
    const lower=item.y<0;
    // All lateral motion happens in front of the rack face. Once the rear of
    // the chassis reaches the rail mouth, x/y are exactly their seated values.
    const constellation=item.type==='server'?[-5.3-(index%3)*.10,item.y+(4-index%9)*.095,7.0+(index%3)*.16]:
      item.type==='nvlink'?[5.15+(index%3)*.11,item.y+(4-index)*.095,7.9+(index%3)*.14]:
      item.type==='powershelf'?[lower?4.65:4.70,item.y+(lower?-.45:.45)+(1.5-index%4)*.09,9.35+(index%2)*.16]:
      item.type==='switch'?[-5.30,item.y+.64,9.65+index*.18]:[.18,item.y,7.0];
    const start=item.type==='server'?.337+(index%9)*.012+(lower?.030:0):
      item.type==='nvlink'?.387+index*.012:item.type==='powershelf'?.405+(index%4)*.014+(lower?.070:0):
      item.type==='switch'?.375+index*.014:.445+index*.013;
    // Upper service hardware clears the detail shot before U40 engages. The
    // lower compute bank, GPU fabric and lower power bank keep assembling.
    const upperCompute=item.type==='server'&&!lower&&item.name!==PRIMARY;
    const upperService=item.type==='switch'||(item.type==='powershelf'&&!lower)||(item.type==='blanking'&&item.top>46);
    const cueStart=upperService?.330+index*.010:upperCompute?.337+(index-1)*.010:start;
    const seatEnd=item.name===PRIMARY?.600:upperService?cueStart+.120:upperCompute?cueStart+.114:item.type==='powershelf'?Math.min(.690,cueStart+.180):cueStart+.205;
    return Object.freeze({index,constellation:Object.freeze(constellation),start:cueStart,alignEnd:cueStart+.052,seatStart:item.name===PRIMARY?.49:cueStart+.052,seatEnd});
  });
  function rackMotion(progress,out={}){
    out.progress=progress;out.alignment=interval(choreography[PRIMARY_INDEX].start+.014,choreography[PRIMARY_INDEX].alignEnd,progress);out.insertion=interval(.49,.60,progress);
    out.pullback=interval(.595,.695,progress);out.rackOpacity=1;out.reveal=interval(0,.125,progress);
    out.deviceReveal=interval(.10,.19,progress);
    out.explode=interval(.765,.817,progress)*(1-interval(.863,.935,progress));
    out.scan=0;out.scanY=0;
    out.calloutVisibility=interval(.19,.216,progress)*(1-interval(.289,.326,progress));
    out.phase=progress<.10?'empty-rack':progress<.19?'constellation':progress<.29?'identify':progress<.34?'prepare':progress<.48?'convergence':progress<.60?'insert':progress<.70?'pullback':progress<.765?'complete':progress<.863?'exploded':progress<.94?'return':'hero';
    return out;
  }
  function motion(progress,out={}){
    rackMotion(rackProgress(progress),out);out.progress=progress;out.rackProgress=rackProgress(progress);
    if(hasL10()){
      out.l10=l10State(progress);out.rackOpacity=interval(.405,.54,progress);
      out.reveal=1;out.deviceReveal=interval(.44,.49,progress);
      if(progress<.56){out.phase=out.l10.phase;out.calloutVisibility=0;}
    }
    return out;
  }
  function rackPlacementPose(item,index,progress,explode=0,out={}){
    const cue=choreography[index],alignment=interval(cue.start+.014,cue.alignEnd,progress),heightAlignment=interval(.327,.344,progress),insertion=interval(cue.seatStart,cue.seatEnd,progress);
    const arrive=interval(.10+(cue.index%3)*.006,.18+(cue.index%3)*.006,progress);
    out.x=cue.constellation[0]*(1-alignment)+groupLateral[item.type]*explode;
    out.y=mix(cue.constellation[1],item.y,heightAlignment);
    out.z=mix(cue.constellation[2]+(1-arrive)*.65,PARK_Z,alignment)*(1-insertion)+groupTravel[item.type]*explode;
    out.opacity=arrive;out.alignment=alignment;out.insertion=insertion;out.seating=insertion;out.scale=1;
    return out;
  }
  function placementPose(item,index,progress,explode=0,out={}){
    const p=rackProgress(progress);rackPlacementPose(item,index,p,explode,out);
    if(hasL10()&&item.name===PRIMARY){
      out.opacity=1;out.y=item.y;
      out.z=mix(choreography[index].constellation[2],PARK_Z,out.alignment)*(1-out.insertion)+groupTravel.server*explode;
    }
    return out;
  }
  function assemblySnapshot(value){
    const progress=clamp(Number(value)||0),sample=motion(progress),{alignment,insertion,pullback,rackOpacity,explode}=sample;
    const placements=PLACEMENTS.map((item,index)=>({...item,...placementPose(item,index,progress,explode),constellation:choreography[index].constellation.slice(),seatStart:choreography[index].seatStart,seatEnd:choreography[index].seatEnd,primary:item.name===PRIMARY}));
    const primary=placements.find(item=>item.primary),primaryPose={x:primary.x,y:primary.y,z:primary.z,scale:1};
    return {...sample,model:'generic-liquid-cooled-compute',
      primaryName:PRIMARY,targetU:TARGET_U,primaryPose,targetPose:{x:0,y:TARGET_Y,z:0,scale:1},alignment,insertion,pullback,rackOpacity,
      primaryOpacity:primary.opacity,primarySize:1,occupiedU:48,emptyU:[],classCounts,seatedCount:placements.filter(item=>item.insertion===1).length,movingCount:placements.filter(item=>item.alignment>0&&item.insertion<1).length,placements,staticPlacements:placements.filter(item=>!item.primary)};
  }
  const VERTEX=`
    attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;attribute vec2 aMaterial;
    uniform mat4 uViewProjection;uniform mat4 uLightViewProjection;uniform mat4 uModel;uniform mat4 uPart;uniform float uOpacity;
    varying vec4 vShadow;
    varying vec3 vPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec4 vColor;varying vec2 vMaterial;
    void main(){mat4 model=uModel*uPart;vec4 world=model*vec4(aPosition,1.0);vPosition=world.xyz;vLocal=aPosition;vShadow=uLightViewProjection*world;vNormal=(mat3(uPart)*aNormal)/vec3(length(uModel[0].xyz),length(uModel[1].xyz),length(uModel[2].xyz));vColor=vec4(aColor.rgb,aColor.a*uOpacity);vMaterial=aMaterial;gl_Position=uViewProjection*world;}`;
  const FRAGMENT=`
    precision highp float;
    varying vec3 vPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec4 vColor;varying vec2 vMaterial;
    uniform vec3 uEye;uniform vec3 uKeyPosition;uniform float uLightTheme;uniform float uTime;uniform float uScan;uniform float uScanY;
    uniform float uRack;uniform float uQuality;uniform float uReveal;uniform float uDetail;
    uniform sampler2D uShadowMap;uniform float uShadowPass;uniform float uHasShadow;uniform float uShadowTexel;
    uniform sampler2D uEnvironment;uniform float uHasEnvironment;
    varying vec4 vShadow;
    vec4 packedDepth(float value){vec4 result=vec4(fract(value*vec3(16777216.0,65536.0,256.0)),value);result.yzw-=result.xyz/256.0;return result;}
    float shadowDepth(vec2 uv){return dot(texture2D(uShadowMap,uv),vec4(1.0/16777216.0,1.0/65536.0,1.0/256.0,1.0));}
    float visibility(vec3 normal,vec3 light){
      if(uHasShadow<.5)return 1.0;
      vec3 q=vShadow.xyz/vShadow.w*.5+.5;
      if(q.x<.002||q.x>.998||q.y<.002||q.y>.998||q.z>1.0)return 1.0;
      float bias=max(.00010,.00048*(1.0-max(dot(normal,light),0.0))),visible=0.0;
      for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)visible+=step(q.z-bias,shadowDepth(q.xy+vec2(float(x),float(y))*uShadowTexel));
      return visible/9.0;
    }
    float boxLight(vec3 R,vec3 direction,float power){return pow(max(dot(R,normalize(direction)),0.0),power);}
    vec3 environmentStrip(vec3 direction,float level){
      // Offline-filtered HDR strips. Half texels isolate roughness
      // levels. This texture is self-hosted; no runtime CDN or float extension.
      vec3 d=vec3(direction.z,direction.y,-direction.x);
      d=vec3(d.x*.796084-d.y*.605186,d.y*.796084+d.x*.605186,d.z);
      vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,acos(clamp(d.y,-1.0,1.0))/3.14159265);
      uv=vec2((uv.x*511.0+.5)/512.0,(uv.y*255.0+.5+level*256.0)/1792.0);
      return (exp2(texture2D(uEnvironment,uv).rgb*9.002815)-1.0)/16.0;
    }
    vec3 environmentSpecular(vec3 R,float rough){
      float level=clamp(rough,0.0,1.0)*5.0,lo=floor(level);
      return mix(environmentStrip(R,lo),environmentStrip(R,min(lo+1.0,5.0)),fract(level));
    }
    float finishNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
      vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*43758.5453);
      return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
    }
    vec3 displayTransform(vec3 linear){
      vec3 x=max(linear,vec3(0));
      return pow(clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0),vec3(1.0/2.2));
    }
    vec3 conductorLight(vec3 N,vec3 V,vec3 L,vec3 albedo,float metal,float rough){
      vec3 H=normalize(V+L);float nl=max(dot(N,L),0.0),nv=max(dot(N,V),.01),nh=max(dot(N,H),0.0),vh=max(dot(V,H),0.0);
      float a=rough*rough,a2=a*a,d=nh*nh*(a2-1.0)+1.0;
      float D=a2/(3.14159265*d*d+.0001),k=(rough+1.0)*(rough+1.0)/8.0;
      float G=(nv/(nv*(1.0-k)+k))*(nl/(nl*(1.0-k)+k));
      vec3 F=mix(vec3(.04),albedo,metal);F+=(1.0-F)*pow(1.0-vh,5.0);
      return F*D*G*nl/(4.0*nv*max(nl,.01)+.001);
    }
    void main(){
      if(uShadowPass>.5){gl_FragColor=packedDepth(gl_FragCoord.z);return;}
      if(vMaterial.y<-.5){gl_FragColor=vColor;return;}
      vec3 N=normalize(vNormal),V=normalize(uEye-vPosition),R=reflect(-V,N);
      float metal=clamp(vMaterial.x,0.0,1.0),polymer=1.0-metal;
      float grain=fract(sin(dot(floor(vLocal*310.0),vec3(127.1,311.7,74.7)))*43758.5453);
      float rough=.24+polymer*.44+(grain-.5)*.032;
      if(vMaterial.x<-.5)rough=.72;
      vec3 key=uHasShadow>.5?normalize(uKeyPosition-vPosition):normalize(vec3(-8.0+uDetail*4.0,13.0,12.0)-vPosition*.26);
      vec3 fill=normalize(vec3(.65,.35,-.72));
      float lambert=max(dot(N,key),0.0),backFill=max(dot(N,fill),0.0);
      float lit=visibility(N,key);lambert*=mix(.14,1.0,lit);
      if(uHasEnvironment>.5){
        // Real studio radiance carries the form. Authored finish variation is
        // deliberately subtle and is not represented as a scanned OEM finish.
        vec3 an=abs(N);vec2 surface=an.y>an.x&&an.y>an.z?vLocal.xz:an.x>an.z?vLocal.zy:vLocal.xy;
        float fine=finishNoise(surface*vec2(9.0,73.0)),broad=finishNoise(surface*5.0);
        float luminance=dot(vColor.rgb,vec3(.2126,.7152,.0722));
        float coating=(1.0-smoothstep(.07,.21,luminance))*metal;
        metal*=1.0-coating*.88;
        rough=clamp(.29+(1.0-metal)*.32+coating*.08+(fine-.5)*.008+(broad-.5)*.020,.24,.78);
        if(vMaterial.x<-.5)rough=.64;
        vec3 tangent=normalize(abs(N.y)<.95?cross(vec3(0,1,0),N):cross(vec3(0,0,1),N));
        N=normalize(N+tangent*(fine-.5)*metal*.002);R=reflect(-V,N);
        // Legacy mesh colors are artist values, not measured maps. Calibrate
        // diffuse reflectance separately from conductor F0; retain dark paint.
        vec3 albedo=pow(max(vColor.rgb,vec3(0)),vec3(1.65));
        vec3 f0=mix(vec3(.04),vColor.rgb,metal);
        float nv=max(dot(N,V),.001);
        vec3 fresnelRough=f0+(max(vec3(1.0-rough),f0)-f0)*pow(1.0-nv,5.0);
        vec4 fit=rough*vec4(-1.0,-.0275,-.572,.022)+vec4(1.0,.0425,1.04,-.04);
        float a004=min(fit.x*fit.x,exp2(-9.28*nv))*fit.x+fit.y;
        vec2 brdf=vec2(-1.04,1.04)*a004+fit.zw;
        vec3 radiance=environmentSpecular(R,rough),irradiance=environmentStrip(N,6.0);
        vec3 physical=irradiance*albedo*(1.0-metal)*(1.0-fresnelRough)*mix(.42,1.0,lit);
        physical+=radiance*(f0*brdf.x+brdf.y)*mix(.58,1.0,lit);
        physical+=albedo*(1.0-metal)*max(dot(N,key),0.0)*lit*.82;
        physical+=conductorLight(N,V,key,vColor.rgb,metal,rough)*vec3(.95,.94,.92)*.48*lit;
        // Neutral front fill separates black rack rails from internal cavities.
        physical+=albedo*(1.0-metal)*max(dot(N,normalize(vec3(-.5,.45,1.0))),0.0)*.22;
        // The photographed studio's rear sector is dark. A fixed broad service
        // softbox lights rear manifolds through every view, without a view-mode
        // toggle, glow, or lifting the opaque hoses to the same value as metal.
        vec3 serviceLight=normalize(vec3(-.15,.24,-1.0));
        physical+=f0*boxLight(R,serviceLight,6.0)*.42;
        physical+=albedo*(1.0-metal)*max(dot(N,serviceLight),0.0)*.35;
        physical*=.91+(broad-.5)*.025*metal;
        if(vMaterial.x<-.5)physical*=.97+(fine-.5)*.045;
        physical=mix(physical,albedo,clamp(vMaterial.y,0.0,1.0)*.72);
        float scanBand=exp(-pow((vPosition.y-uScanY)*5.8,2.0))*uScan;
        physical+=vec3(.025,.038,.040)*scanBand;
        gl_FragColor=vec4(displayTransform(physical),vColor.a);return;
      }
      float brush=1.0+(sin(vLocal.z*640.0+vLocal.x*13.0)*.007+(grain-.5)*.012)*metal;
      float hemisphere=mix(.045,.23,uReveal)+mix(.025,.12,uReveal)*(N.y*.5+.5);
      // Slot occlusion supplements the real depth shadows at sub-pixel seams.
      float slot=fract((vPosition.y+7.2)/.30);
      float seam=smoothstep(.01,.115,slot)*(1.0-smoothstep(.88,.99,slot));
      float contact=mix(1.0,.76+.24*seam,uRack*.62);
      // Conductors reflect the studio. Excess diffuse made every silver cover
      // look chalk-painted; keep diffuse energy on PCB and polymer instead.
      vec3 base=vColor.rgb*(hemisphere+lambert*mix(.055,.70,uReveal)+backFill*mix(.12,.42,uReveal))*brush*contact*mix(1.0,.28,metal);
      float exponent=mix(115.0,24.0,rough);
      float spec=pow(max(dot(N,normalize(key+V)),0.0),exponent);
      float fresnel=pow(1.0-max(dot(N,V),0.0),4.0);
      float overhead=boxLight(R,vec3(-.38,.81,-.43),13.0);
      float side=boxLight(R,vec3(-.83,.22,.45),20.0);
      float rear=boxLight(R,vec3(.55,.44,-.70),16.0);
      float serviceBox=boxLight(R,vec3(.04,.17,-1.0),7.0);
      float flankBox=boxLight(R,vec3(.98,.16,.03),9.0);
      vec3 ceiling=vPosition+R*((18.0-vPosition.y)/max(R.y,.10));
      float softbox=(1.0-smoothstep(1.5,7.0,abs(ceiling.x-3.0)))*
        (1.0-smoothstep(3.0,12.0,abs(ceiling.z+10.0)))*smoothstep(.10,.35,R.y);
      vec3 conductor=mix(vec3(.04),vColor.rgb,metal);
      base+=conductor*(overhead*.72+side*.52+spec*.16+softbox*1.25)*metal*mix(.20,1.0,uReveal)*brush;
      base+=vec3(.58,.68,.73)*(rear*.32+fresnel*mix(.25,.14,uReveal))*(.35+metal*.65);
      base+=vec3(.78,.84,.87)*(serviceBox*.19+flankBox*.14)*(.22+metal*.78)*mix(.30,1.0,uReveal);
      base+=vColor.rgb*max(-N.z,0.0)*metal*.24+conductor*serviceBox*.18;
      float rearPanel=max(dot(N,normalize(vec3(.25,.42,-1.0))),0.0)*smoothstep(.1,.5,-N.z);
      base+=vColor.rgb*rearPanel*.55+vec3(.24,.28,.30)*metal*rearPanel*.24;
      base+=vec3(.84,.87,.88)*polymer*(spec*.035+flankBox*.026);
      base+=conductorLight(N,V,key,vColor.rgb,metal,rough)*vec3(.95,.92,.86)*.64*lit;
      base+=conductorLight(N,V,normalize(vec3(.9,.8,-.7)),vColor.rgb,metal,rough+.08)*vec3(.74,.81,.86)*.26;
      base+=vColor.rgb*uLightTheme*.08;
      base*=mix(.74,1.0,lit);
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
    for(let s=0,d=0;s<data.length;s+=11,d+=12){
      for(let i=0;i<9;i++)out[d+i]=data[s+i];out[d+9]=data[s+9]===-3?.20:1;out[d+10]=data[s+9]===-3?.65:data[s+9];out[d+11]=data[s+10];
      // Lift only dark structural metals for the film's edge light. Equipment
      // faces retain the bronze/silver finishes from the shared hardware study.
      const r=data[s+6],g=data[s+7],b=data[s+8],metal=data[s+9],luma=r*.2126+g*.7152+b*.0722;
      if(metal>.5&&luma<.14){out[d+6]*=1.25;out[d+7]*=1.25;out[d+8]*=1.25;}
    }
    return out;
  }
  function auxiliaryMesh(){
    const data=[],vertex=(p,n,c,a=1,m=.8,e=0)=>data.push(...p,...n,...c,a,m,e);
    function quad(a,b,c,d,n,color,metal=.8){for(const p of [a,b,c,a,c,d])vertex(p,n,color,1,metal);}
    function box(x,y,z,w,h,d,color,metal=.8){const W=w/2,H=h/2,D=d/2,p=(a,b,c)=>[x+a,y+b,z+c],f=[[[ -W,-H,D],[W,-H,D],[W,H,D],[-W,H,D],[0,0,1]],[[W,-H,-D],[-W,-H,-D],[-W,H,-D],[W,H,-D],[0,0,-1]],[[W,-H,D],[W,-H,-D],[W,H,-D],[W,H,D],[1,0,0]],[[-W,-H,-D],[-W,-H,D],[-W,H,D],[-W,H,-D],[-1,0,0]],[[-W,H,D],[W,H,D],[W,H,-D],[-W,H,-D],[0,1,0]],[[-W,-H,-D],[W,-H,-D],[W,-H,D],[-W,-H,D],[0,-1,0]]];f.forEach(v=>quad(p(...v[0]),p(...v[1]),p(...v[2]),p(...v[3]),v[4],color,metal));}
    function shadow(rx,rz,alpha,color=[0,0,0],offset=0){for(let i=0;i<64;i++){const a=i/64*TAU,b=(i+1)/64*TAU;vertex([0,offset,0],[0,1,0],color,alpha,0,-1);vertex([Math.cos(a)*rx,offset,Math.sin(a)*rz],[0,1,0],color,0,0,-1);vertex([Math.cos(b)*rx,offset,Math.sin(b)*rz],[0,1,0],color,0,0,-1);}}
    return {data,box,shadow};
  }
  function createParts(){
    const factory=window.PARackScene?.buildEditorialParts;
    if(typeof factory!=='function')throw new Error('Shared rack geometry is unavailable');
    const shared=factory(PLAN),meshes={rack:{data:addAlpha(shared.frame.data)}};
    if(hasL10())Object.assign(meshes,window.PAL10Hardware.build().meshes);
    Object.entries(shared.equipment).forEach(([name,mesh])=>meshes[name]={data:addAlpha(mesh.data)});
    for(const key of ['infrastructure','connections'])if(shared[key])meshes[key]={data:addAlpha(shared[key].data)};
    const floor=auxiliaryMesh(),slotRails=auxiliaryMesh(),middleRail=auxiliaryMesh(),runner=auxiliaryMesh(),scan=auxiliaryMesh();
    floor.shadow(15,20,.38,[.15,.19,.22]);floor.shadow(3.6,5.3,.56,[0,0,0],.012);
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
  // [progress, azimuth, elevation, detail shot weight, constellation weight,
  // opening distance]. Smooth lens changes never alter the physical poses.
  const CAMERA_KEYS=[
    [0,-.47,.13,0,0,3.8],[.095,-.40,.10,0,0,.8],
    [.19,-.32,.13,0,1,0],[.29,-.32,.13,0,1,0],
    [.38,-.36,.14,0,1,0],[.48,-.42,.16,0,.85,0],
    [.52,-.72,.27,1,0,0],[.567,-.70,.25,1,0,0],
    [.61,-.59,.17,.65,0,0],[.695,-.49,.085,0,0,0],
    [.765,-.49,.085,0,0,0],[.818,-.60,.13,0,0,0],
    [.862,-.60,.13,0,0,0],[.94,-.48,.085,0,0,0],
    [1,-.48,.085,0,0,0]
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
    let shadowFramebuffer=null,shadowTexture=null,shadowDepthBuffer=null,shadowPass=false,shadowSize=2048;
    let shadowProgress=-1,shadowExplode=-1;
    let environmentTexture=null,environmentImage=null,environmentReady=false,environmentFailed=false,environmentGeneration=0;
    let progress=0,pointerX=0,pointerY=0,yaw=0,pitch=0,manual=false,drag=null,light=0,view='authored';
    let visible=true,intersecting=true,lastTime=0,lightTime=0,drawCalls=0,vertices=0,slowFrames=0,resolution=1,frameMs=16.7;
    let idleTimer=0,idleStart=0,idleWeight=0,idleExit=0,idleYaw=0,idlePitch=0,idleTravel=0;
    let cameraReady=false,cameraSettling=false,lastActivity=performance.now();
    const shaders=[],attributes={},uniforms={},reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const sample={},key=new Float32Array(5),eye=new Float32Array(3),target=new Float32Array(3),wanted=new Float32Array(6),camera=new Float32Array(6);
    const identity=translation(),modelMatrix=translation(),moving=translation(),railMatrix=translation(0,TARGET_Y,0),floorMatrix=translation(0,-7.82,0);
    // A common aspect correction preserves every connector/rail alignment while
    // bringing the tray envelope to the public 438 × 766 × 43.6 mm proportions.
    if(hasL10()){modelMatrix[0]=.688;modelMatrix[10]=.802;}
    const matrices=PLACEMENTS.map(item=>translation(0,item.y,0)),poses=PLACEMENTS.map(()=>({}));
    let projected=null;
    const fail=(reason='WebGL is unavailable')=>{canvas.dataset.coreState='fallback';canvas.dataset.coreError=String(reason);canvas.dispatchEvent(new CustomEvent('pa-core-fallback',{bubbles:true,detail:{reason:String(reason)}}));};
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'high-performance',preserveDrawingBuffer:false});}catch(error){fail(error.message);return noop;}if(!gl){fail();return noop;}
    function compile(type,source){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Core scene shader compilation failed: '+gl.getShaderInfoLog(shader));return shader;}
    function setup(){
      shadowProgress=-1;shadowExplode=-1;
      maxBufferSize=Math.min(4096,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||4096);
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Core scene shader linking failed: '+gl.getProgramInfoLog(program));
      shaders.forEach(shader=>gl.deleteShader(shader));shaders.length=0;parts={};
      const built=createParts();shared=built.shared;vertices=0;
      Object.entries(built.meshes).forEach(([name,mesh])=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data,gl.STATIC_DRAW);parts[name]={buffer,count:mesh.data.length/12};vertices+=mesh.data.length/12;});
      ['aPosition','aNormal','aColor','aMaterial'].forEach(name=>attributes[name]=gl.getAttribLocation(program,name));
      ['uViewProjection','uLightViewProjection','uModel','uPart','uOpacity','uEye','uKeyPosition','uLightTheme','uTime','uScan','uScanY','uRack','uQuality','uReveal','uDetail','uShadowMap','uShadowPass','uHasShadow','uShadowTexel','uEnvironment','uHasEnvironment'].forEach(name=>uniforms[name]=gl.getUniformLocation(program,name));
      if(hasL10()){
        environmentReady=false;environmentFailed=false;canvas.dataset.coreEnvironment='loading';const generation=++environmentGeneration;
        environmentTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,environmentTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
        for(const parameter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.LINEAR);
        for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.CLAMP_TO_EDGE);
        gl.activeTexture(gl.TEXTURE0);
        environmentImage=new Image();
        environmentImage.onload=()=>{
          if(disposed||contextLost||generation!==environmentGeneration)return;
          gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,environmentTexture);
          gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,environmentImage);
          gl.activeTexture(gl.TEXTURE0);environmentReady=true;canvas.dataset.coreEnvironment='ready';requestDraw();
        };
        environmentImage.onerror=()=>{if(disposed||generation!==environmentGeneration)return;environmentFailed=true;canvas.dataset.coreEnvironment='failed';requestDraw();};
        environmentImage.src='/static/img/l10/studio-small-09-radiance.png';
      }
      // Local RGBA depth target works on WebGL 1 without an extension or a
      // second renderer/context. Shadow resources share context-loss lifecycle.
      if(hasL10()){
        shadowSize=Math.min(2048,maxBufferSize);shadowTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,shadowSize,shadowSize,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        for(const parameter of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.NEAREST);
        for(const parameter of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,parameter,gl.CLAMP_TO_EDGE);
        shadowFramebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadowTexture,0);
        shadowDepthBuffer=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,shadowDepthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,shadowDepthBuffer);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.deleteFramebuffer(shadowFramebuffer);gl.deleteTexture(shadowTexture);gl.deleteRenderbuffer(shadowDepthBuffer);shadowFramebuffer=null;shadowTexture=null;shadowDepthBuffer=null;}
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);
      }
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);ready=false;
      canvas.dataset.coreModel='generic-liquid-cooled-compute';canvas.dataset.coreComputeTrays=String(classCounts.server);canvas.dataset.coreSwitchTrays=String(classCounts.nvlink);
      canvas.dataset.coreGeometryBuffers=String(Object.keys(parts).length);canvas.dataset.coreVertices=String(vertices);
    }
    function release(){environmentGeneration++;if(environmentImage){environmentImage.onload=null;environmentImage.onerror=null;}environmentImage=null;if(gl&&!contextLost){if(parts)Object.values(parts).forEach(part=>gl.deleteBuffer(part.buffer));if(program)gl.deleteProgram(program);shaders.forEach(shader=>gl.deleteShader(shader));if(shadowFramebuffer)gl.deleteFramebuffer(shadowFramebuffer);if(shadowTexture)gl.deleteTexture(shadowTexture);if(shadowDepthBuffer)gl.deleteRenderbuffer(shadowDepthBuffer);if(environmentTexture)gl.deleteTexture(environmentTexture);}environmentTexture=null;environmentReady=false;shadowFramebuffer=null;shadowTexture=null;shadowDepthBuffer=null;parts=null;program=null;shared=null;shaders.length=0;}
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
      cameraKey(rackProgress(progress),key);
      let azimuth=key[0]+yaw,elevation=clamp(key[1]+pitch,-1.35,1.35),detail=key[2];
      if(idleStart){
        const t=((now-idleStart)/92000)%1;
        const orbit=t<.50?interval(0,.50,t):1-interval(.65,1,t);
        if(!idleExit){idleYaw=-orbit*2.65;idlePitch=Math.sin(t*TAU)*.025;idleTravel=interval(.76,.82,t)*(1-interval(.84,.9,t))*.12;}
        idleWeight=idleExit?Math.max(0,idleWeight-dt/950):Math.min(1,(now-idleStart)/1200);
        azimuth+=idleYaw*idleWeight;elevation+=idlePitch*idleWeight;
        if(idleExit&&idleWeight<=0){idleStart=0;idleExit=0;idleTravel=0;armIdle();}
      }
      if(!manual&&!reduced.matches){azimuth+=pointerX*.022;elevation+=pointerY*.009;}
      const y=TARGET_Y,z=PARK_Z*(1-sample.insertion);
      target[0]=0;target[1]=y*detail;target[2]=(z+.2)*detail;
      const tray=shared.equipment['server:1'];
      const trayMin=[tray.min[0],tray.min[1]+y,tray.min[2]+z],trayMax=[tray.max[0],tray.max[1]+y,tray.max[2]+z];
      const closeDistance=Math.max(15.8,fittedDistance(trayMin,trayMax,[0,y,z+.2],azimuth,elevation,aspect,.69,.76));
      const rackDistance=fittedDistance(shared.bounds.min,shared.bounds.max,[0,0,0],azimuth,elevation,aspect,.79,.84);
      const wideMin=shared.bounds.min.slice(),wideMax=shared.bounds.max.slice(),currentMin=shared.bounds.min.slice(),currentMax=shared.bounds.max.slice();
      PLACEMENTS.forEach((item,index)=>{const mesh=shared.equipment[item.meshKey],pose=choreography[index].constellation,current=placementPose(item,index,progress,sample.explode),offset=[current.x,current.y,current.z];for(let axis=0;axis<3;axis++){wideMin[axis]=Math.min(wideMin[axis],mesh.min[axis]+pose[axis]);wideMax[axis]=Math.max(wideMax[axis],mesh.max[axis]+pose[axis]);if(current.opacity>.003){currentMin[axis]=Math.min(currentMin[axis],mesh.min[axis]+offset[axis]);currentMax[axis]=Math.max(currentMax[axis],mesh.max[axis]+offset[axis]);}}});
      const wideDistance=fittedDistance(wideMin,wideMax,[0,0,0],azimuth,elevation,aspect,.83,.88);
      const explodedDistance=fittedDistance(shared.bounds.min,[shared.bounds.max[0]+.60,shared.bounds.max[1],shared.bounds.max[2]+2.68],[0,0,0],azimuth,elevation,aspect,.79,.84);
      const wide=mix(rackDistance,wideDistance,key[3]);
      let distance=mix(wide+key[4],closeDistance,detail)+Math.max(0,explodedDistance-rackDistance)*sample.explode;
      if(detail===0)distance=Math.max(distance,fittedDistance(currentMin,currentMax,[0,0,0],azimuth,elevation,aspect,.83,.88));
      if(view==='middle'){target[1]=.35;target[2]=.35;distance=Math.max(12,10/aspect);}
      if(hasL10()){
        target[0]*=modelMatrix[0];target[2]*=modelMatrix[10];
        const l10=sample.l10,pose=placementPose(PLACEMENTS[PRIMARY_INDEX],PRIMARY_INDEX,progress,0),bridge=interval(.407,.56,progress);
        const closeYaw=mix(-.52,-.25,interval(0,.38,progress)),closeElevation=mix(.67,.86,interval(.245,.30,progress))-.16*interval(.333,.39,progress);
        const closeTarget=[pose.x*modelMatrix[0],pose.y+mix(.80,.10,interval(.05,.29,progress)),pose.z*modelMatrix[10]-.12];
        const lo=[closeTarget[0]-1.47,pose.y-.14,(pose.z-3.1)*modelMatrix[10]],hi=[closeTarget[0]+1.47,pose.y+.22+l10.coolingLift,(pose.z+3.1)*modelMatrix[10]];
        const closeFit=fittedDistance(lo,hi,closeTarget,closeYaw+yaw,closeElevation+pitch,aspect,.79,.89);
        azimuth=mix(closeYaw+yaw,azimuth,bridge);elevation=mix(closeElevation+pitch,elevation,bridge);
        distance=mix(closeFit,distance,bridge);
        for(let axis=0;axis<3;axis++)target[axis]=mix(closeTarget[axis],target[axis],bridge);
      }
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
      if(shadowPass&&(opacity<.96||!writeDepth||name==='floor'||name.includes('flow')))return;
      const mesh=parts[name];if(!mesh||opacity<=.003)return;
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      gl.enableVertexAttribArray(attributes.aPosition);gl.vertexAttribPointer(attributes.aPosition,3,gl.FLOAT,false,48,0);
      gl.enableVertexAttribArray(attributes.aNormal);gl.vertexAttribPointer(attributes.aNormal,3,gl.FLOAT,false,48,12);
      gl.enableVertexAttribArray(attributes.aColor);gl.vertexAttribPointer(attributes.aColor,4,gl.FLOAT,false,48,24);
      gl.enableVertexAttribArray(attributes.aMaterial);gl.vertexAttribPointer(attributes.aMaterial,2,gl.FLOAT,false,48,40);
      gl.uniformMatrix4fv(uniforms.uPart,false,matrix);gl.uniform1f(uniforms.uOpacity,opacity);gl.depthMask(writeDepth);gl.drawArrays(gl.TRIANGLES,0,mesh.count);drawCalls++;
    }
    function projectPoint(matrix,p){
      const w=matrix[3]*p[0]+matrix[7]*p[1]+matrix[11]*p[2]+matrix[15],q=transform(matrix,p);
      return {x:(q[0]/w+1)/2,y:(1-q[1]/w)/2,visible:w>.15&&Math.abs(q[0]/w)<1&&Math.abs(q[1]/w)<1,depth:w};
    }
    function projectBox(matrix,min,max,pose={x:0,y:0,z:0}){
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,nearest=Infinity;
      for(let corner=0;corner<8;corner++){
        const point=projectPoint(matrix,[(corner&1?max[0]:min[0])+pose.x,(corner&2?max[1]:min[1])+pose.y,(corner&4?max[2]:min[2])+pose.z]);
        left=Math.min(left,point.x);right=Math.max(right,point.x);top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);nearest=Math.min(nearest,point.depth);
      }
      return {left,right,top,bottom,nearest,visible:nearest>.15&&right>0&&left<1&&bottom>0&&top<1,clipped:nearest<.15||left<0||right>1||top<0||bottom>1};
    }
    function projectEquipment(matrix,rect){
      const equipmentBounds=PLACEMENTS.map((item,index)=>({name:item.name,type:item.type,opacity:poses[index].opacity,...projectBox(matrix,shared.equipment[item.meshKey].min,shared.equipment[item.meshKey].max,poses[index])}));
      const callouts=Object.entries(classInfo).map(([type,info])=>{
        const candidates=PLACEMENTS.map((item,index)=>({item,index})).filter(({item})=>item.type===type),representative=type==='powershelf'?candidates[candidates.length-1]:candidates[0];
        const {item,index}=representative,mesh=shared.equipment[item.meshKey],pose=poses[index];
        // Perspective makes a near tray's lid overlap another front face in
        // screen space. Eight true surface corners let the callout compositor
        // choose the bank silhouette instead of inventing a detached anchor.
        const anchors=Array.from({length:8},(_,corner)=>({...projectPoint(matrix,[(corner&1?mesh.max[0]:mesh.min[0])+pose.x,(corner&2?mesh.max[1]:mesh.min[1])+pose.y,(corner&4?mesh.max[2]:mesh.min[2])+pose.z]),side:corner&1?'right':'left',surface:corner&4?'front':'rear',height:corner&2?'top':'bottom'}));
        return {type,name:item.name,count:classCounts[type],label:info[0],description:info[1],anchor:anchors[type==='server'?2:7],anchors,bounds:equipmentBounds[index],opacity:pose.opacity};
      });
      return {progress,rackProgress:sample.rackProgress,phase:sample.phase,calloutVisibility:sample.calloutVisibility,callouts,equipmentBounds,rackBounds:projectBox(matrix,shared.bounds.min,shared.bounds.max),width:rect.width,height:rect.height};
    }
    function draw(now){
      frame=0;if(disposed||contextLost||!program||!parts||!visible)return;
      const elapsed=lastTime?now-lastTime:16.7,dt=Math.min(250,elapsed);lastTime=now;
      if(elapsed<2000&&elapsed>3){frameMs=frameMs*.96+elapsed*.04;if(frameMs>29)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);}
      if(slowFrames>24&&resolution>.7){resolution=Math.max(.7,resolution-.1);slowFrames=0;}
      if(!reduced.matches)lightTime+=dt/1000;
      const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
      const pixelBudget=hasL10()?5000000:2600000,desiredDpr=Math.min(window.devicePixelRatio||1,1.65,Math.sqrt(pixelBudget/(rect.width*rect.height)));
      const dpr=Math.min(desiredDpr*resolution,maxBufferSize/Math.max(rect.width,rect.height));
      const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      motion(progress,sample);updateCamera(now,width/height,dt);
      const explode=sample.explode+idleTravel*idleWeight;
      PLACEMENTS.forEach((item,index)=>placementPose(item,index,progress,explode,poses[index]));
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      const viewProjection=multiply(perspective(.50,width/height,.15,180),lookAt(eye,target));
      gl.uniformMatrix4fv(uniforms.uViewProjection,false,viewProjection);
      gl.uniform3fv(uniforms.uEye,eye);gl.uniformMatrix4fv(uniforms.uModel,false,modelMatrix);
      gl.uniform1f(uniforms.uLightTheme,light);gl.uniform1f(uniforms.uTime,reduced.matches?0:lightTime);
      gl.uniform1f(uniforms.uScan,reduced.matches?0:sample.scan);gl.uniform1f(uniforms.uScanY,sample.scanY);
      gl.uniform1f(uniforms.uRack,sample.rackOpacity);gl.uniform1f(uniforms.uQuality,resolution);drawCalls=0;
      gl.uniform1f(uniforms.uReveal,sample.reveal);gl.uniform1f(uniforms.uDetail,key[2]);
      gl.uniform1f(uniforms.uHasEnvironment,environmentReady?1:0);
      if(environmentTexture){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,environmentTexture);gl.uniform1i(uniforms.uEnvironment,1);gl.activeTexture(gl.TEXTURE0);}
      const drawScene=()=>{
      gl.uniform1f(uniforms.uRack,sample.rackOpacity);
      part('floor',floorMatrix,sample.rackOpacity,false);
      for(let i=0;i<PLACEMENTS.length;i++){
        const item=PLACEMENTS[i],pose=poses[i];
        matrices[i][12]=pose.x;matrices[i][13]=pose.y;matrices[i][14]=pose.z;
        if(!(hasL10()&&item.name===PRIMARY))part(item.meshKey,matrices[i],pose.opacity);
      }
      part('rack',identity,sample.rackOpacity);part('infrastructure',identity,sample.rackOpacity);
      const railsOpacity=interval(.389,.412,rackProgress(progress));part('slotRails',railMatrix,railsOpacity);
      moving[13]=TARGET_Y;moving[14]=PARK_Z*(1-sample.insertion)*.5+groupTravel.server*explode*.5;part('middleRail',moving,railsOpacity);
      moving[13]=TARGET_Y;moving[14]=PARK_Z*(1-sample.insertion)+groupTravel.server*explode;
      part('runner',moving,railsOpacity);
      const connected=interval(.69,.718,rackProgress(progress))*(1-interval(0,.035,explode));
      part('connections',identity,connected);
      if(hasL10()){
        const l10=sample.l10,base=matrices[PRIMARY_INDEX],m=new Float32Array(base);
        gl.uniform1f(uniforms.uRack,0);
        const layer=(name,lift=0,opacity=1,depth=true)=>{m[13]=base[13]+lift;part(name,m,opacity,depth);};
        layer('l10-chassis');layer('l10-board',l10.boardLift);layer('l10-packages',l10.packageLift);layer('l10-io',l10.ioLift);
        layer('l10-cooling-frame',l10.coolingLift);
        layer('l10-cooling',l10.coolingLift,1-l10.flow*.28,l10.flow<.01);
        // Conceptual directional overlays sit on the disclosed cold-plate
        // envelope; they are not invented proprietary internal microchannels.
        layer('l10-flow-supply',0,l10.flow*.88,false);layer('l10-flow-return',0,l10.flow*.88,false);
        if(progress>=.37)layer('l10-lid',.50*(1-l10.lid),interval(.37,.376,progress));
      }
      if(sample.scan>.001&&!reduced.matches){moving[13]=sample.scanY;moving[14]=0;part('scanPlane',moving,sample.scan*.55,false);}
      };
      if(shadowFramebuffer){
        const bridge=interval(.405,.56,progress),pose=poses[PRIMARY_INDEX],focus=[pose.x*.688*(1-bridge),(pose.y+.5)*(1-bridge),pose.z*.802*(1-bridge)];
        const lightEye=[focus[0]-10,focus[1]+18,focus[2]+14],extent=mix(5.2,15,bridge);
        const ortho=new Float32Array([1/extent,0,0,0,0,1/extent,0,0,0,0,-2/64,0,0,0,-66/64,1]);
        const lightVP=multiply(ortho,lookAt(lightEye,focus));
        gl.uniform3fv(uniforms.uKeyPosition,new Float32Array(lightEye));gl.uniformMatrix4fv(uniforms.uLightViewProjection,false,lightVP);
        gl.uniform1f(uniforms.uHasShadow,1);gl.uniform1f(uniforms.uShadowTexel,1/shadowSize);gl.uniform1i(uniforms.uShadowMap,0);
        gl.activeTexture(gl.TEXTURE0);
        if(shadowProgress!==progress||shadowExplode!==explode){
        gl.bindTexture(gl.TEXTURE_2D,null);gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFramebuffer);
        gl.viewport(0,0,shadowSize,shadowSize);gl.clearColor(1,1,1,1);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.BLEND);
        shadowPass=true;gl.uniform1f(uniforms.uShadowPass,1);gl.uniformMatrix4fv(uniforms.uViewProjection,false,lightVP);drawScene();
        shadowPass=false;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.enable(gl.BLEND);
        gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawCalls=0;
        shadowProgress=progress;shadowExplode=explode;
        }
        gl.bindTexture(gl.TEXTURE_2D,shadowTexture);
      }else gl.uniform1f(uniforms.uHasShadow,0);
      gl.uniform1f(uniforms.uShadowPass,0);gl.uniformMatrix4fv(uniforms.uViewProjection,false,viewProjection);drawScene();
      gl.depthMask(true);
      canvas.dataset.coreProgress=progress.toFixed(4);canvas.dataset.coreCameraDistance=camera[2].toFixed(4);
      canvas.dataset.corePrimaryY=poses[PRIMARY_INDEX].y.toFixed(5);canvas.dataset.corePrimaryZ=poses[PRIMARY_INDEX].z.toFixed(5);
      canvas.dataset.coreTargetU=String(TARGET_U);canvas.dataset.coreAssemblyPhase=sample.phase;canvas.dataset.coreInsertion=sample.insertion.toFixed(5);
      canvas.dataset.coreIdle=idleStart?'showcase':'waiting';canvas.dataset.coreScan=sample.scan.toFixed(3);
      projected=projectEquipment(multiply(viewProjection,modelMatrix),rect);
      canvas.dispatchEvent(new CustomEvent('pa-core-projection',{bubbles:true,detail:projected}));
      if(!ready&&(!hasL10()||environmentReady||environmentFailed)){const error=gl.getError();if(error!==gl.NO_ERROR){fail('WebGL render error '+error);return;}ready=true;canvas.dataset.coreState='ready';delete canvas.dataset.coreError;canvas.dispatchEvent(new CustomEvent('pa-core-ready',{bubbles:true}));}
      // Settled inspection frames return to native display resolution. Playback
      // owns time and requests its next frame; a paused tray need not burn GPU.
      if(hasL10()&&!cameraSettling&&resolution<1){resolution=1;slowFrames=0;cameraSettling=true;}
      if(cameraSettling||idleStart||(!hasL10()&&!reduced.matches&&progress<.999))requestDraw();else lastTime=0;
    }
    function setOrbit(nextYaw,nextPitch){
      activity();manual=true;view='authored';pointerX=0;pointerY=0;
      const y=Number(nextYaw),p=Number(nextPitch);yaw=Number.isFinite(y)?y:0;pitch=clamp(Number.isFinite(p)?p:0,-1.2,1.2);
      syncOrbit();requestDraw();
    }
    function setView(name){
      const poses={front:[0,.035],side:[Math.PI/2,.07],rear:[Math.PI,.065],'three-quarter':[-.64,.105],top:[-.65,.68],middle:[-.65,.14]};
      const pose=poses[name];if(!pose)return;
      activity();cameraKey(rackProgress(progress),key);manual=true;view=name;yaw=pose[0]-key[0];pitch=pose[1]-key[1];pointerX=0;pointerY=0;
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
      const matrix=multiply(multiply(perspective(.50,canvas.width/canvas.height,.15,180),lookAt(eye,target)),modelMatrix);
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
      getState(){return {supported:true,ready,contextLost,progress,yaw,pitch,dragging:!!drag,settling:cameraSettling,theme:light?'light':'dark',model:'generic-liquid-cooled-compute',l10:hasL10()?l10State(progress):null,rackProgress:rackProgress(progress),computeTrays:classCounts.server,switchTrays:classCounts.nvlink,networkSwitches:classCounts.switch,powerShelves:classCounts.powershelf,occupiedU:48,componentCount:PLACEMENTS.length,geometryBuffers:parts?Object.keys(parts).length:0,vertices,drawCalls,
        camera:{yaw:camera[0],elevation:camera[1],distance:camera[2],target:Array.from(target),eye:Array.from(eye),fov:.50,view},bounds:projectionBounds(),callouts:projected?.callouts||[],projection:projected,geometry:shared?.quality||shared?.metadata||null,
        quality:{resolution,frameMs,pixelCount:canvas.width*canvas.height,adaptive:true,contactShadows:!!shadowFramebuffer,shadowMapSize:shadowFramebuffer?shadowSize:0,environmentReady,environmentFailed,environment:'CC0 photographic studio / GGX log radiance'},idle:{active:!!idleStart,exiting:!!idleExit,weight:idleWeight,delay:6500,lastActivity,disabled:reduced.matches},assembly:assemblySnapshot(progress),disposed};},resize:requestDraw,
      destroy(){if(disposed)return;disposed=true;clearTimeout(idleTimer);if(frame)cancelAnimationFrame(frame);frame=0;drag=null;ro?.disconnect();io?.disconnect();window.removeEventListener('resize',requestDraw);Object.entries(events).forEach(([name,handler])=>canvas.removeEventListener(name,handler));activityEvents.forEach(name=>window.removeEventListener(name,activity));if(typeof document!=='undefined')document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener?.('change',onReduced);canvas.style.touchAction=originalTouchAction;release();canvas.dataset.coreState='disposed';delete canvas.paCoreScene;}
    };canvas.paCoreScene=api;return api;
  }
  window.PACoreScene=Object.freeze({mount,assemblySnapshot});
})();
