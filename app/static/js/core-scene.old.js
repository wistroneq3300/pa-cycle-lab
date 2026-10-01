/* PA System Core — original procedural, fully modelled hardware study.
 * Vera Rubin compute-tray / NVL72 visual references, not NVIDIA CAD or a Wistron SKU.
 * Tray reference: developer-blogs.nvidia.com/wp-content/uploads/2026/01/Figure-18.png
 * Native WebGL; no external models, textures, dependencies or network requests.
 * One closed compute tray remains the same object as it slides into the rack.
 * Editorial geometry does not represent live equipment or operational rack U positions.
 */
(() => {
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  const C={silver:[.43,.47,.51],lid:[.50,.53,.57],edge:[.66,.69,.71],steel:[.26,.31,.35],champagne:[.47,.40,.29],goldEdge:[.67,.59,.43],darkGold:[.23,.20,.145],graphite:[.048,.065,.077],black:[.013,.023,.030],socket:[.028,.040,.046],copper:[.38,.23,.13],blue:[0,.28,.39],green:[.40,.62,.16],label:[.54,.59,.61]};
  const COMPUTE_Y=[...Array.from({length:9},(_,i)=>-5.76+i*.49),...Array.from({length:9},(_,i)=>1.84+i*.49)];
  const SWITCH_Y=Array.from({length:9},(_,i)=>-1.47+i*.365),PRIMARY_INDEX=9;
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
      float metal=vMaterial.x,lambert=max(dot(N,key),0.0),hemisphere=.22+.17*(N.y*.5+.5);
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
  function meshBuilder(){
    const data=[],vertex=(v,n,c,a=1,m=.8,e=0)=>data.push(...v,...n,...c,a,m,e);
    function quad(a,b,c,d,n,color,alpha=1,metal=.8,emit=0){vertex(a,n,color,alpha,metal,emit);vertex(b,n,color,alpha,metal,emit);vertex(c,n,color,alpha,metal,emit);vertex(a,n,color,alpha,metal,emit);vertex(c,n,color,alpha,metal,emit);vertex(d,n,color,alpha,metal,emit);}
    function box(x,y,z,w,h,d,color,alpha=1,metal=.8,emit=0){
      const W=w/2,H=h/2,D=d/2,p=(a,b,c)=>[x+a,y+b,z+c];
      const faces=[[[ -W,-H,D],[W,-H,D],[W,H,D],[-W,H,D],[0,0,1]],[[W,-H,-D],[-W,-H,-D],[-W,H,-D],[W,H,-D],[0,0,-1]],[[W,-H,D],[W,-H,-D],[W,H,-D],[W,H,D],[1,0,0]],[[-W,-H,-D],[-W,-H,D],[-W,H,D],[-W,H,-D],[-1,0,0]],[[-W,H,D],[W,H,D],[W,H,-D],[-W,H,-D],[0,1,0]],[[-W,-H,-D],[W,-H,-D],[W,-H,D],[-W,-H,D],[0,-1,0]]];
      faces.forEach(f=>quad(p(...f[0]),p(...f[1]),p(...f[2]),p(...f[3]),f[4],color,alpha,metal,emit));
    }
    function bevel(x,y,z,w,h,d,color,alpha=1,metal=.9,amount=.02){
      const e=[w/2,h/2,d/2],b=Math.min(amount,...e.map(v=>v*.75)),center=[x,y,z],at=v=>v.map((n,i)=>n+center[i]);
      for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const a=(axis+1)%3,c=(axis+2)%3,n=[0,0,0];n[axis]=sign;const p=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sa,sc])=>{const v=[0,0,0];v[axis]=e[axis]*sign;v[a]=(e[a]-b)*sa;v[c]=(e[c]-b)*sc;return at(v);});quad(...p,n,color,alpha,metal);}
      for(let a=0;a<3;a++)for(let c=a+1;c<3;c++)for(const sa of [-1,1])for(const sc of [-1,1]){const f=3-a-c,n=[0,0,0];n[a]=sa/Math.SQRT2;n[c]=sc/Math.SQRT2;const p=(face,s)=>{const v=[0,0,0];v[a]=(e[a]-(face===a?0:b))*sa;v[c]=(e[c]-(face===c?0:b))*sc;v[f]=(e[f]-b)*s;return at(v);};quad(p(a,-1),p(c,-1),p(c,1),p(a,1),n,color,alpha,metal);}
      for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const signs=[sx,sy,sz],n=signs.map(v=>v/Math.sqrt(3));for(let axis=0;axis<3;axis++)vertex(at(e.map((v,i)=>(v-(i===axis?0:b))*signs[i])),n,color,alpha,metal);}
    }
    // Closed cylindrical segments: genuine side normals and explicit end caps.
    function tube(a,b,r,color,segments=12,metal=.9,alpha=1){
      const axis=b.map((n,i)=>n-a[i]),length=Math.hypot(...axis);if(length<.00001)return;
      const n=axis.map(v=>v/length),ref=Math.abs(n[1])<.85?[0,1,0]:[1,0,0];let u=[n[1]*ref[2]-n[2]*ref[1],n[2]*ref[0]-n[0]*ref[2],n[0]*ref[1]-n[1]*ref[0]];
      const ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]];
      const normal=t=>u.map((q,i)=>q*Math.cos(t)+v[i]*Math.sin(t)),point=(p,d)=>p.map((q,i)=>q+d[i]*r);
      for(let i=0;i<segments;i++){const na=normal(i/segments*TAU),nb=normal((i+1)/segments*TAU),p=point(a,na),q=point(a,nb),s=point(b,na),t=point(b,nb);vertex(p,na,color,alpha,metal);vertex(q,nb,color,alpha,metal);vertex(t,nb,color,alpha,metal);vertex(p,na,color,alpha,metal);vertex(t,nb,color,alpha,metal);vertex(s,na,color,alpha,metal);vertex(a,n.map(v=>-v),color,alpha,metal);vertex(q,n.map(v=>-v),color,alpha,metal);vertex(p,n.map(v=>-v),color,alpha,metal);vertex(b,n,color,alpha,metal);vertex(s,n,color,alpha,metal);vertex(t,n,color,alpha,metal);}
    }
    function shadow(y,rx,rz,alpha){for(let i=0;i<64;i++){const a=i/64*TAU,b=(i+1)/64*TAU;vertex([0,y,0],[0,1,0],[0,0,0],alpha,0,-1);vertex([Math.cos(a)*rx,y,Math.sin(a)*rz],[0,1,0],[0,0,0],0,0,-1);vertex([Math.cos(b)*rx,y,Math.sin(b)*rz],[0,1,0],[0,0,0],0,0,-1);}}
    return {data,box,bevel,tube,shadow};
  }
  function addCompute(m,detailed){
    const {box:B,bevel:V,tube:T}=m;
    // Closed, slim, long chassis: no invented fans, radiators or floating GPU lid.
    V(0,0,0,3.80,.415,6.20,C.silver,1,.94,.035);V(0,.222,-.02,3.81,.041,6.17,C.lid,1,.98,.012);V(0,-.215,0,3.71,.035,6.05,C.steel,1,.91,.010);
    B(0,.246,2.25,3.64,.005,.014,C.graphite);B(0,.25,2.67,3.65,.011,.71,C.silver,1,.95);
    for(const side of [-1,1]){
      B(side*1.905,-.07,-.15,.036,.103,5.64,C.steel);B(side*1.927,-.087,-.17,.028,.027,5.34,C.edge,1,.98);B(side*1.894,.175,-.01,.016,.009,6.04,C.graphite);B(side*1.882,-.175,-.16,.025,.014,5.80,C.edge,1,.96);
      for(let i=0;i<(detailed?8:4);i++){const z=-2.77+i*(detailed?.79:1.80);if(detailed){T([side*1.907,.086,z],[side*1.92,.086,z],.023,C.steel,10);B(side*1.93,.086,z,.003,.006,.026,C.black);}T([side*1.76,.245,z],[side*1.76,.251,z],.023,C.edge,detailed?10:6);B(side*1.76,.255,z,.026,.003,.005,C.graphite);}
    }
    V(.86,.25,.80,.31,.024,.22,C.steel,1,.7,.025);V(.86,.262,.80,.22,.008,.145,C.graphite,1,.5,.018);B(.86,.268,.855,.21,.009,.027,C.edge);B(0,.249,-2.67,2.90,.004,.014,C.steel);
    if(detailed){
      for(const x of [-1.55,-.8,0,.8,1.55]){T([x,.255,2.46],[x,.263,2.46],.023,C.edge,10);B(x,.266,2.46,.025,.003,.005,C.graphite);}
      // Stamped underside channels and fixings remain visible from below.
      for(const x of [-1.4,-.67,.67,1.4])B(x,-.238,-.10,.045,.014,5.38,C.silver,1,.92);
      for(const z of [-2.52,0,2.42]){B(0,-.240,z,3.38,.016,.072,C.silver,1,.94);for(const x of [-1.6,1.6])T([x,-.249,z],[x,-.24,z],.023,C.edge,8);}
    }
    // Champagne front shell, service modules and two open sculpted pull handles.
    V(0,0,3.16,3.85,.445,.145,C.champagne,1,.93,.028);B(0,.204,3.24,3.67,.019,.028,C.goldEdge,1,.98);B(0,-.207,3.24,3.67,.013,.033,C.goldEdge,1,.94);B(0,.025,3.245,1.0,.244,.016,C.darkGold,1,.6);
    for(let i=0;i<8;i++){const x=-.441+i*.126;V(x,.033,3.266,.097,.206,.040,C.goldEdge,1,.95,.008);B(x,.032,3.292,.058,.141,.011,C.champagne);B(x,.121,3.299,.055,.012,.006,C.steel);}
    for(const side of [-1,1]){
      V(side*.94,-.142,3.250,1.50,.089,.021,C.darkGold,1,.5,.021);V(side*.94,-.144,3.265,1.39,.055,.017,C.black,1,.05,.021);B(side*.97,-.094,3.300,1.52,.025,.049,C.goldEdge,1,.97);
      V(side*1.926,-.006,3.225,.181,.460,.245,C.silver,1,.97,.040);B(side*1.981,.026,3.36,.025,.326,.029,C.edge,1,1);
      T([side*1.75,-.086,3.255],[side*1.67,-.086,3.407],.027,C.goldEdge,10);T([side*1.67,-.086,3.407],[side*.66,-.086,3.407],.027,C.goldEdge,10);T([side*.66,-.086,3.407],[side*.57,-.086,3.255],.027,C.goldEdge,10);
      for(const y of [-.19,.19])T([side*1.928,y,3.347],[side*1.928,y,3.353],.021,C.steel,8);
    }
    [[-1.58,.075,.104,.068],[-1.36,.075,.126,.066],[-1.05,.070,.248,.068],[1.17,.055,.117,.063],[1.40,.055,.12,.063],[1.63,.055,.095,.062]].forEach(([x,y,w,h])=>{B(x,y,3.247,w+.019,h+.018,.02,C.steel,1,.95);B(x,y,3.261,w,h,.017,C.black,1,.08);if(detailed)B(x,y-h*.3,3.275,w*.72,.009,.005,C.copper,1,.85);});
    B(-1.74,.078,3.25,.022,.022,.014,C.green,1,0,1.15);B(1.74,.059,3.25,.019,.019,.014,C.blue,1,0,.9);
    if(detailed){B(-.79,.128,3.25,.144,.007,.010,C.label,1,.15);B(-.815,.109,3.25,.094,.006,.010,C.label,1,.15);B(.79,.11,3.25,.15,.01,.010,C.steel,1,.25);}
    // Rear NVLink banks, bus contacts and liquid-cooling blind-mate couplings.
    V(0,0,-3.119,3.65,.348,.071,C.steel,1,.86,.019);
    for(let i=0;i<4;i++){const x=-1.05+i*.70;B(x,.02,-3.168,.60,.225,.056,C.black,1,.35);B(x,.02,-3.20,.52,.154,.045,C.darkGold,1,.86);for(let pin=0;pin<(detailed?12:6);pin++)B(x-.222+pin*(detailed?.04:.088),.02,-3.229,.014,.118,.010,C.goldEdge,1,.96);B(x,.147,-3.198,.59,.022,.065,C.edge);}
    for(const side of [-1,1]){T([side*1.57,.005,-3.10],[side*1.57,.005,-3.275],.086,C.edge,12);T([side*1.57,.005,-3.26],[side*1.57,.005,-3.30],.062,C.champagne,12);T([side*1.57,.005,-3.30],[side*1.57,.005,-3.306],.038,C.black,12,.1);B(side*1.79,.014,-3.18,.064,.208,.059,C.copper,1,.92);B(side*1.80,.014,-3.215,.025,.160,.018,C.edge);}
  }
  function addSwitch(m){
    const {box:B,bevel:V,tube:T}=m;
    V(0,0,0,3.80,.278,6.18,C.steel,1,.86,.025);B(0,.143,0,3.75,.018,6.04,C.silver,1,.92);V(0,0,3.159,3.86,.300,.121,C.darkGold,1,.9,.018);B(0,.129,3.23,3.71,.012,.029,C.goldEdge);
    for(let i=0;i<12;i++){const x=-1.65+i*.30;B(x,0,3.232,.242,.176,.025,C.champagne);B(x,.005,3.251,.193,.107,.018,C.black,1,.15);B(x,-.066,3.267,.174,.015,.025,C.edge);if(i%3===0)B(x+.079,.078,3.262,.015,.011,.006,C.green,1,0,1.15);B(x,0,-3.146,.19,.164,.097,C.black);B(x,.01,-3.202,.145,.11,.025,C.champagne);}
    for(const s of [-1,1]){V(s*1.94,0,3.19,.16,.32,.20,C.steel,1,.9,.018);T([s*1.82,-.071,3.25],[s*1.64,-.071,3.38],.021,C.goldEdge,8);T([s*1.64,-.071,3.38],[s*1.28,-.071,3.38],.021,C.goldEdge,8);T([s*1.28,-.071,3.38],[s*1.16,-.071,3.25],.021,C.goldEdge,8);B(s*1.915,0,0,.025,.066,5.98,C.edge);}
  }
  function addPower(m){
    const {box:B,bevel:V}=m;V(0,0,.7,3.85,.43,4.91,C.graphite,1,.8,.025);
    for(let i=0;i<6;i++){const x=-1.59+i*.637;V(x,0,3.20,.602,.392,.16,C.steel,1,.91,.018);B(x,-.012,3.29,.456,.239,.034,C.black,1,.1);for(let row=0;row<3;row++)for(let col=0;col<6;col++)B(x-.177+col*.071,-.077+row*.067,3.314,.039,.020,.008,C.steel,1,.7);B(x,.154,3.30,.292,.022,.036,C.edge);B(x+.235,.136,3.301,.021,.021,.018,C.green,1,0,1.05);B(x,.015,-1.78,.43,.24,.13,C.black);B(x,.015,-1.85,.21,.14,.025,C.copper);}
  }
  function createParts(){
    const floor=meshBuilder(),primary=meshBuilder(),compute=meshBuilder(),switches=meshBuilder(),power=meshBuilder(),rack=meshBuilder(),spine=meshBuilder();
    floor.shadow(0,3.35,4.80,.31);addCompute(primary,true);addCompute(compute,false);addSwitch(switches);addPower(power);
    const B=rack.box,V=rack.bevel,T=rack.tube;
    for(const side of [-1,1]){
      for(const end of [-1,1])V(side*2.105,0,end*3.43,.195,14.98,.205,C.graphite,1,.93,.032);
      B(side*2.055,0,3.338,.095,14.58,.091,C.steel);B(side*2.02,0,-3.29,.091,14.52,.090,C.steel);
      for(const y of [-7.42,7.42])V(side*2.10,y,0,.19,.21,6.90,C.steel,1,.92,.030);
      // Open side wall reveals tray chassis and rear infrastructure during orbit.
      for(const y of [-6.28,-1.75,1.77,6.24])B(side*2.12,y,0,.072,.088,6.66,C.graphite,1,.82);
      B(side*2.16,0,-2.82,.084,14.64,.18,C.graphite);B(side*2.17,0,2.78,.071,14.64,.133,C.steel);B(side*2.21,0,-3.25,.024,14.63,.11,C.edge,1,.96);
      for(let i=0;i<48;i++){const y=-7.08+i*.297;B(side*2.05,y,3.392,.043,.062,.009,C.black,1,.05);if(i%3===0)B(side*2.003,y,3.392,.030,.009,.008,C.label,1,.1);}
      for(const z of [-2.71,2.72]){V(side*1.76,-7.61,z,.36,.16,.46,C.black,1,.68,.04);T([side*1.76,-7.60,z],[side*1.76,-7.72,z],.082,C.steel,12);}
      // Rack-level side manifold, not hoses inside the fanless compute tray.
      spine.tube([side*1.82,-6.12,-3.47],[side*1.82,6.18,-3.47],.070,C.steel,12);spine.tube([side*1.82,6.18,-3.47],[side*1.82,6.62,-3.18],.070,C.steel,12);spine.tube([side*1.82,6.62,-3.18],[side*1.82,6.62,-2.82],.070,C.steel,12);spine.box(side*1.82,6.20,-3.47,.16,.075,.16,side<0?C.blue:C.green,1,.35);
      for(const y of COMPUTE_Y){spine.tube([side*1.82,y,-3.47],[side*1.57,y,-3.30],.031,C.steel,8);spine.box(side*1.82,y,-3.47,.145,.11,.14,C.graphite,1,.8);}
    }
    V(0,7.51,0,4.42,.19,7.04,C.graphite,1,.90,.030);V(0,-7.46,0,4.43,.17,7.04,C.graphite,1,.87,.030);V(0,7.28,3.47,4.30,.35,.10,C.steel,1,.93,.025);B(0,7.437,3.532,4.19,.012,.016,C.edge);B(-1.53,7.28,3.538,.53,.037,.006,C.label,1,.2);B(1.72,7.28,3.538,.036,.025,.006,C.green,1,0,1.1);V(0,-7.21,3.47,4.30,.35,.10,C.graphite,1,.9,.025);
    B(0,7.03,3.36,3.88,.130,.15,C.black);for(let i=0;i<16;i++){B(-1.72+i*.229,7.03,3.45,.172,.086,.028,C.steel);B(-1.72+i*.229,7.035,3.47,.124,.051,.013,C.black);}
    // Rear spine: physical bus columns and blind-mate banks, not a flat back wall.
    for(const x of [-1.15,-.73,-.31,.31,.73,1.15]){
      spine.bevel(x,0,-3.50,.18,12.35,.12,C.graphite,1,.80,.012);spine.box(x+.053,0,-3.576,.018,12.20,.030,C.copper,1,.95);
      for(const y of COMPUTE_Y){spine.box(x,y,-3.38,.204,.252,.25,C.black,1,.4);spine.box(x,y,-3.524,.172,.162,.035,C.darkGold,1,.88);spine.box(x,y+.075,-3.55,.17,.018,.015,C.goldEdge);}
      for(const y of SWITCH_Y)spine.box(x,y,-3.46,.23,.15,.13,C.steel,1,.90);
    }
    for(const y of [-6.37,-1.71,1.73,6.31]){spine.bevel(0,y,-3.67,3.46,.09,.16,C.steel,1,.9,.018);for(let i=0;i<8;i++)spine.box(-1.5+i*.43,y,-3.76,.12,.036,.022,C.edge);}
    for(const s of [-1,1]){spine.box(s*1.98,0,-3.50,.10,13.47,.13,C.black);for(let i=0;i<14;i++)spine.box(s*1.98,-6.13+i*.94,-3.58,.056,.12,.032,C.champagne);}
    return {floor,primary,compute,switches,power,rack,spine};
  }
  function mount(canvas){
    const noop={supported:false,setProgress(){},setPointer(){},setOrbit(){},resetOrbit(){},setTheme(){},getState(){return {supported:false};},resize(){},destroy(){}};
    if(!canvas||typeof canvas.getContext!=='function')return noop;
    let gl,program,parts=null,frame=0,disposed=false,contextLost=false,ready=false,maxBufferSize=4096;
    let progress=0,pointerX=0,pointerY=0,yaw=0,pitch=0,manual=false,settling=null,drag=null,light=0;
    const shaders=[],attributes={},uniforms={},reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const fail=(reason='WebGL is unavailable')=>{canvas.dataset.coreState='fallback';canvas.dataset.coreError=String(reason);canvas.dispatchEvent(new CustomEvent('pa-core-fallback',{bubbles:true,detail:{reason:String(reason)}}));};
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power',preserveDrawingBuffer:false});}catch(error){fail(error.message);return noop;}if(!gl){fail();return noop;}
    function compile(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Core scene shader compilation failed: '+gl.getShaderInfoLog(s));return s;}
    function setup(){
      maxBufferSize=Math.min(4096,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||4096);program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Core scene shader linking failed: '+gl.getProgramInfoLog(program));shaders.forEach(s=>gl.deleteShader(s));shaders.length=0;parts={};
      Object.entries(createParts()).forEach(([name,mesh])=>{const data=new Float32Array(mesh.data),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);parts[name]={buffer,count:data.length/12};});
      ['aPosition','aNormal','aColor','aMaterial'].forEach(n=>attributes[n]=gl.getAttribLocation(program,n));['uViewProjection','uModel','uPart','uOpacity','uEye','uLightTheme'].forEach(n=>uniforms[n]=gl.getUniformLocation(program,n));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);ready=false;
      canvas.dataset.coreModel='vera-rubin-inspired';canvas.dataset.coreComputeTrays='18';canvas.dataset.coreSwitchTrays='9';canvas.dataset.coreGeometryBuffers=String(Object.keys(parts).length);canvas.dataset.coreVertices=String(Object.values(parts).reduce((sum,p)=>sum+p.count,0));
    }
    function release(){if(gl&&!contextLost){if(parts)Object.values(parts).forEach(p=>gl.deleteBuffer(p.buffer));if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}parts=null;program=null;shaders.length=0;}
    try{setup();}catch(error){release();fail(error.message);return noop;}
    function requestDraw(){if(!disposed&&!contextLost&&program&&parts&&!frame)frame=requestAnimationFrame(draw);}
    function syncOrbit(){canvas.dataset.coreYaw=yaw.toFixed(4);canvas.dataset.corePitch=pitch.toFixed(4);canvas.dataset.coreDragging=String(!!drag);}
    function draw(now){
      frame=0;if(disposed||contextLost||!program||!parts)return;
      if(settling){const t=clamp((now-settling.start)/settling.duration),blend=1-ease(0,1,t);yaw=settling.yaw*blend;pitch=settling.pitch*blend;if(t>=1){settling=null;yaw=0;pitch=0;manual=false;}syncOrbit();}
      const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
      const dpr=Math.min(window.devicePixelRatio||1,1.7,maxBufferSize/Math.max(rect.width,rect.height)),width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      const assembly=ease(.10,.91,progress),aspect=width/height;
      // The entire orbit envelope stays inside the canvas, including rack top/bottom.
      const distance=mix(12.65,32.3,ease(.05,.64,progress))*Math.max(1,1.04/aspect);
      let eye=[distance*.28,distance*mix(.49,.14,assembly),distance*.88];
      const authoredYaw=mix(-.49,-.10,assembly),hover=manual||reduced.matches?0:1,model=rotation(authoredYaw+yaw+pointerX*.035*hover,pitch+pointerY*.014*hover);
      // Fit projected 3D bounds rather than reducing all views to the same small
      // sphere. A flat tray stays large; rotating it vertically smoothly reveals
      // its complete length. The rack has a narrower horizontal safe area so an
      // extreme orbit cannot cover the adjacent engineering copy.
      const half=[mix(2.04,2.23,assembly),mix(.275,7.73,assembly),mix(3.45,3.80,assembly)];
      const view=lookAt(eye,[0,0,0]),tan=Math.tan(.545/2),marginX=mix(.91,.68,assembly),marginY=mix(.88,.98,assembly);
      let required=0;
      for(const x of [-half[0],half[0]])for(const y of [-half[1],half[1]])for(const z of [-half[2],half[2]]){
        const w=[model[0]*x+model[4]*y+model[8]*z,model[1]*x+model[5]*y+model[9]*z,model[2]*x+model[6]*y+model[10]*z];
        const cx=view[0]*w[0]+view[4]*w[1]+view[8]*w[2],cy=view[1]*w[0]+view[5]*w[1]+view[9]*w[2],cz=view[2]*w[0]+view[6]*w[1]+view[10]*w[2];
        required=Math.max(required,cz+Math.abs(cx)/(tan*aspect*marginX),cz+Math.abs(cy)/(tan*marginY));
      }
      const fit=Math.max(1,required/Math.hypot(...eye));eye=eye.map(v=>v*fit);
      canvas.dataset.coreCameraDistance=Math.hypot(...eye).toFixed(4);
      gl.viewport(0,0,width,height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(uniforms.uViewProjection,false,multiply(perspective(.545,aspect,.1,100),lookAt(eye,[0,0,0])));gl.uniform3fv(uniforms.uEye,new Float32Array(eye));gl.uniform1f(uniforms.uLightTheme,light);
      function part(name,transform,opacity=1,writeDepth=true){if(opacity<=.003)return;const mesh=parts[name];gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);let offset=0;[['aPosition',3],['aNormal',3],['aColor',4],['aMaterial',2]].forEach(([attribute,size])=>{gl.enableVertexAttribArray(attributes[attribute]);gl.vertexAttribPointer(attributes[attribute],size,gl.FLOAT,false,48,offset);offset+=size*4;});gl.uniformMatrix4fv(uniforms.uPart,false,transform);gl.uniform1f(uniforms.uOpacity,opacity);gl.depthMask(writeDepth);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
      gl.uniformMatrix4fv(uniforms.uModel,false,translation());part('floor',translation(0,mix(-.54,-7.8,assembly),0),mix(.65,1,assembly),false);gl.uniformMatrix4fv(uniforms.uModel,false,model);
      const rackAlpha=ease(.12,.43,progress),primaryY=mix(0,COMPUTE_Y[PRIMARY_INDEX],ease(.13,.55,progress)),primaryZ=Math.sin(ease(.05,.71,progress)*Math.PI)*1.5;
      part('primary',translation(0,primaryY,primaryZ));
      COMPUTE_Y.forEach((y,i)=>{if(i===PRIMARY_INDEX)return;const phase=ease(.27+Math.abs(i-PRIMARY_INDEX)*.006,.79+Math.abs(i-PRIMARY_INDEX)*.006,progress);part('compute',translation(0,y,(1-phase)*1.85),phase,phase>.998);});
      SWITCH_Y.forEach((y,i)=>{const phase=ease(.38+i*.009,.79+i*.009,progress);part('switches',translation(0,y,(1-phase)*1.3),phase,phase>.998);});
      [-6.73,-6.24,6.24,6.73].forEach((y,i)=>{const phase=ease(.22+i*.018,.65+i*.018,progress);part('power',translation(0,y,(1-phase)*.70),phase,phase>.998);});
      part('spine',translation(),rackAlpha,rackAlpha>.998);part('rack',translation(),rackAlpha,rackAlpha>.998);gl.depthMask(true);canvas.dataset.coreProgress=progress.toFixed(4);
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
      getState(){return {supported:true,progress,yaw,pitch,dragging:!!drag,settling:!!settling,theme:light?'light':'dark',computeTrays:18,switchTrays:9,geometryBuffers:parts?Object.keys(parts).length:0,disposed};},resize:requestDraw,
      destroy(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;settling=null;drag=null;ro?.disconnect();window.removeEventListener('resize',requestDraw);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onUp);canvas.removeEventListener('lostpointercapture',onUp);canvas.removeEventListener('keydown',onKey);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);canvas.style.touchAction=originalTouchAction;release();canvas.dataset.coreState='disposed';delete canvas.paCoreScene;}
    };canvas.paCoreScene=api;return api;
  }
  window.PACoreScene=Object.freeze({mount});
})();
