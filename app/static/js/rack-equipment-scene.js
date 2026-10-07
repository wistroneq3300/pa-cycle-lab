/* PA Rack Engineering — original procedural equipment illustrations, not vendor CAD.
 * Live placement uses the application's 48U, top-U + occupied-U convention.
 * Compute / NVLink / power front-panel vocabulary: NVIDIA DGX GB300 hardware guide
 * https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html (GB300 tabs).
 * Larger-U enclosures are generic derivatives, not claims of a vendor SKU.
 * Switch vocabulary: NVIDIA SN2000 / SN2700 (32 QSFP28), not an installed-SKU claim.
 * CDU vocabulary: in-rack liquid-to-liquid CDU with HMI / rear fluid connections.
 * Procedural cooling illustration; animated direction is not measured flow.
 * No external model, texture, runtime dependency or network request.
 */
(() => {
  'use strict';
  const U=.30, HALF=48*U/2, FRONT=3.05, TAU=Math.PI*2;
  const TYPES=new Set(['server','switch','nvlink','powershelf','pdu','cdu','storage','network','blanking']);
  // Approved finish: the upper compute service face and NVLink front panels use
  // champagne. Taller compute vent extensions, other device faces, chassis,
  // rack rails and rear fittings remain neutral.
  const C={silver:[.43,.47,.51],lid:[.50,.53,.57],edge:[.66,.69,.71],steel:[.26,.31,.35],dark:[.048,.065,.077],black:[.013,.023,.030],socket:[.026,.038,.044],blue:[0,.28,.39],green:[.40,.62,.16],gold:[.53,.48,.39],goldEdge:[.74,.69,.58],darkGold:[.24,.22,.18],copper:[.38,.23,.13],amber:[.72,.39,.12],unknown:[.24,.30,.34],label:[.54,.59,.61]};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
  function transform(m,v){return [0,1,2,3].map(r=>m[r]*v[0]+m[4+r]*v[1]+m[8+r]*v[2]+m[12+r]*v[3]);}
  function inverse(m){
    const a=Array.from({length:4},(_,r)=>[m[r],m[4+r],m[8+r],m[12+r],...Array.from({length:4},(_,c)=>+(r===c))]);
    for(let i=0;i<4;i++){let p=i;for(let r=i+1;r<4;r++)if(Math.abs(a[r][i])>Math.abs(a[p][i]))p=r;if(Math.abs(a[p][i])<1e-10)return null;[a[i],a[p]]=[a[p],a[i]];const n=a[i][i];for(let c=0;c<8;c++)a[i][c]/=n;for(let r=0;r<4;r++)if(r!==i){const f=a[r][i];for(let c=0;c<8;c++)a[r][c]-=f*a[i][c];}}
    const out=new Float32Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=a[r][c+4];return out;
  }
  function rotation(y,x){const cy=Math.cos(y),sy=Math.sin(y),cx=Math.cos(x),sx=Math.sin(x);return new Float32Array([cy,0,-sy,0,sy*sx,cx,cy*sx,0,sy*cx,-sx,cy*cx,0,0,0,0,1]);}
  function translation(x=0,y=0,z=0){const m=identity();m[12]=x;m[13]=y;m[14]=z;return m;}
  function ortho(w,h){return new Float32Array([1/w,0,0,0,0,1/h,0,0,0,0,-2/100,0,0,0,-1,1]);}
  function perspective(fov,aspect,near=.1,far=120){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function lookAt(eye){let [zx,zy,zz]=eye,l=Math.hypot(...eye);zx/=l;zy/=l;zz/=l;const xl=Math.hypot(zz,zx),xx=zz/xl,xz=-zx/xl,yx=zy*xz,yy=zz*xx-zx*xz,yz=-zy*xx;return new Float32Array([xx,yx,zx,0,0,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-l,1]);}
  function inspectPlacement(components){
    const valid=[],invalid=[],unplaced=[],occupied=new Set(),names=new Set();
    for(const raw of Array.isArray(components)?components:[]){
      if(!raw||typeof raw!=='object'){invalid.push({name:'',reason:'invalid-record'});continue;}
      const name=String(raw.name||'').trim(),top=Number(raw.rack_u),size=raw.rack_size==null?1:Number(raw.rack_size);
      if(!name){invalid.push({name,reason:'missing-name'});continue;}
      if(names.has(name)){invalid.push({name,reason:'duplicate-name'});continue;}names.add(name);
      if(raw.rack_mount==='external'){
        if(raw.mgx_type!=='cdu'||top!==0||size!==0){invalid.push({name,reason:'invalid-external'});continue;}
        valid.push({...raw,name,mgx_type:'cdu',external:true,x:6.35,y:0,top:0,bottom:0,size:0,height:14.58});continue;
      }
      if(raw.rack_u==null||raw.rack_u===''||top===0){unplaced.push(name);continue;}
      if(!Number.isInteger(top)||!Number.isInteger(size)||top<1||top>48||size<1||size>48||top-size+1<1){invalid.push({name,reason:'out-of-range',top,size});continue;}
      const slots=Array.from({length:size},(_,i)=>top-i);
      if(slots.some(n=>occupied.has(n))){invalid.push({name,reason:'overlap',top,size});continue;}
      slots.forEach(n=>occupied.add(n));valid.push({...raw,name,x:0,external:false,mgx_type:TYPES.has(raw.mgx_type)?raw.mgx_type:'server',top,size,bottom:top-size+1,y:(top-size/2)*U-HALF,height:size*U-.026});
    }
    return {valid,invalid,unplaced,occupiedU:occupied.size,count:valid.length};
  }
  function meshBuilder(){
    const data=[];
    const vertex=(p,n,c,metal=.8,emission=0)=>data.push(...p,...n,...c,metal,emission);
    function quad(a,b,c,d,n,color,metal=.8,emission=0){vertex(a,n,color,metal,emission);vertex(b,n,color,metal,emission);vertex(c,n,color,metal,emission);vertex(a,n,color,metal,emission);vertex(c,n,color,metal,emission);vertex(d,n,color,metal,emission);}
    function box(x,y,z,w,h,d,color,metal=.8,emission=0){
      const W=w/2,H=h/2,D=d/2,p=(a,b,c)=>[x+a,y+b,z+c];
      const faces=[[[ -W,-H,D],[W,-H,D],[W,H,D],[-W,H,D],[0,0,1]],[[W,-H,-D],[-W,-H,-D],[-W,H,-D],[W,H,-D],[0,0,-1]],[[W,-H,D],[W,-H,-D],[W,H,-D],[W,H,D],[1,0,0]],[[-W,-H,-D],[-W,-H,D],[-W,H,D],[-W,H,-D],[-1,0,0]],[[-W,H,D],[W,H,D],[W,H,-D],[-W,H,-D],[0,1,0]],[[-W,-H,-D],[W,-H,-D],[W,-H,D],[-W,-H,D],[0,-1,0]]];
      faces.forEach(f=>quad(p(...f[0]),p(...f[1]),p(...f[2]),p(...f[3]),f[4],color,metal,emission));
    }
    function bevel(x,y,z,w,h,d,color,amount=.02,metal=.9){
      const e=[w/2,h/2,d/2],b=Math.min(amount,...e.map(v=>v*.7)),center=[x,y,z],at=v=>v.map((n,i)=>n+center[i]);
      for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const a=(axis+1)%3,c=(axis+2)%3,n=[0,0,0];n[axis]=sign;const p=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sa,sc])=>{const v=[0,0,0];v[axis]=e[axis]*sign;v[a]=(e[a]-b)*sa;v[c]=(e[c]-b)*sc;return at(v);});quad(...p,n,color,metal);}
      for(let a=0;a<3;a++)for(let c=a+1;c<3;c++)for(const sa of [-1,1])for(const sc of [-1,1]){const f=3-a-c,n=[0,0,0];n[a]=sa/Math.SQRT2;n[c]=sc/Math.SQRT2;const p=(face,s)=>{const v=[0,0,0];v[a]=(e[a]-(face===a?0:b))*sa;v[c]=(e[c]-(face===c?0:b))*sc;v[f]=(e[f]-b)*s;return at(v);};quad(p(a,-1),p(c,-1),p(c,1),p(a,1),n,color,metal);}
      for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const signs=[sx,sy,sz],n=signs.map(v=>v/Math.sqrt(3));for(let axis=0;axis<3;axis++)vertex(at(e.map((v,i)=>(v-(i===axis?0:b))*signs[i])),n,color,metal);}
    }
    function tube(a,b,r,color,segments=10,metal=.9){
      const axis=b.map((n,i)=>n-a[i]),length=Math.hypot(...axis);if(length<.00001)return;const n=axis.map(v=>v/length),ref=Math.abs(n[1])<.85?[0,1,0]:[1,0,0];let u=[n[1]*ref[2]-n[2]*ref[1],n[2]*ref[0]-n[0]*ref[2],n[0]*ref[1]-n[1]*ref[0]];const ul=Math.hypot(...u);u=u.map(v=>v/ul);const v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],normal=t=>u.map((q,i)=>q*Math.cos(t)+v[i]*Math.sin(t)),point=(p,d)=>p.map((q,i)=>q+d[i]*r);
      for(let i=0;i<segments;i++){const na=normal(i/segments*TAU),nb=normal((i+1)/segments*TAU),p=point(a,na),q=point(a,nb),s=point(b,na),t=point(b,nb);vertex(p,na,color,metal);vertex(q,nb,color,metal);vertex(t,nb,color,metal);vertex(p,na,color,metal);vertex(t,nb,color,metal);vertex(s,na,color,metal);vertex(a,n.map(v=>-v),color,metal);vertex(q,n.map(v=>-v),color,metal);vertex(p,n.map(v=>-v),color,metal);vertex(b,n,color,metal);vertex(s,n,color,metal);vertex(t,n,color,metal);}
    }
    // Smooth circular grille rings in the face plane. Actual normals, not decals.
    function ring(x,y,z,r,wire,color,segments=18){
      for(let i=0;i<segments;i++)for(let j=0;j<4;j++){
        const at=(a,b)=>{const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);return {p:[x+(r+wire*cb)*ca,y+(r+wire*cb)*sa,z+wire*sb],n:[cb*ca,cb*sa,sb]};},a=i/segments*TAU,b=(i+1)/segments*TAU,c=j/4*TAU,d=(j+1)/4*TAU,q=[at(a,c),at(b,c),at(b,d),at(a,d)];
        for(const k of [0,1,2,0,2,3])vertex(q[k].p,q[k].n,color,.9);
      }
    }
    function disc(x,y,z,r,color,metal=.5,segments=18){
      for(let i=0;i<segments;i++){vertex([x,y,z],[0,0,1],color,metal);for(const a of [i/segments*TAU,(i+1)/segments*TAU])vertex([x+Math.cos(a)*r,y+Math.sin(a)*r,z],[0,0,1],color,metal);}
    }
    // Shallow turned bezel and optical lens. The sleeve starts at the actual
    // device skin; radial normals and graduated glass replace a flat neon disc.
    function statusLens(x,y,z,r,outer,color,trim,active){
      const segments=32;
      const band=(ra,za,rb,zb,tint,metal,profileA=0,profileB=0,na=0,nb=0)=>{
        const point=(radius,depth,a)=>[x+radius*Math.cos(a),y+radius*Math.sin(a),z+depth];
        const normal=(tilt,a)=>[Math.cos(a)*tilt,Math.sin(a)*tilt,Math.sqrt(1-tilt*tilt)];
        for(let i=0;i<segments;i++){
          const a=i/segments*TAU,b=(i+1)/segments*TAU;
          const corners=[[ra,za,a,profileA,na],[ra,za,b,profileA,na],[rb,zb,b,profileB,nb],[rb,zb,a,profileB,nb]];
          for(const k of [0,1,2,0,2,3]){const [radius,depth,angle,profile,tilt]=corners[k];vertex(point(radius,depth,angle),normal(tilt,angle),tint,metal,profile);}
        }
      };
      disc(x,y,z+.001,outer,C.black,.12,segments);
      band(outer,.001,outer-.004,.005,trim,.65,0,0,.45,.20);
      band(outer-.004,.005,r+.004,.005,trim,.55);
      band(r+.004,.005,r,.002,C.socket,.28,0,0,-.25,-.30);
      const material=active?-5:.35;
      band(r,.002,r*.72,.005,color,material,.30,.76,.42,.28);
      band(r*.72,.005,r*.34,.007,color,material,.76,1.0,.28,.13);
      band(r*.34,.007,0,.0075,color,material,1.0,1.0,.13,0);
    }
    function face(x,y,z,w,h,color,metal=.2,front=1,emission=0){quad([x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z],[0,0,front],color,metal,emission);}
    function polygon(points,z,color,metal=.2){for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]])vertex([p[0],p[1],z],[0,0,1],color,metal);}
    return {data,box,bevel,tube,ring,disc,statusLens,face,polygon};
  }
  function createFrame(){
    const m=meshBuilder(),B=m.box,V=m.bevel,T=m.tube;
    for(const side of [-1,1]){
      for(const end of [-1,1])V(side*2.17,0,end*3.15,.21,15.00,.21,C.dark,.035);
      for(const y of [-7.45,7.45])V(side*2.17,y,0,.21,.21,6.48,C.steel,.028);
      B(side*2.085,0,3.14,.075,14.5,.08,C.steel);B(side*2.085,0,-3.11,.075,14.5,.08,C.steel);
      for(let u=1;u<=48;u++){const y=(u-.5)*U-HALF;B(side*2.087,y,3.191,.038,.072,.012,C.black,.1);B(side*2.087,y,-3.16,.038,.072,.012,C.black,.1);}
      // Open side structure: depth is legible and arbitrary hardware stays visible.
      for(const y of [-7.18,-3.6,3.6,7.18]){B(side*2.19,y,0,.075,.095,6.2,C.dark);for(const z of [-2.8,2.8])T([side*2.235,y,z],[side*2.25,y,z],.028,C.edge,8);}
      B(side*2.20,0,-2.72,.10,14.65,.14,C.steel);B(side*2.21,0,2.76,.025,14.64,.15,C.edge);
      // Rear frame cable-management rails. No invented network connections.
      for(let i=0;i<9;i++){const y=-6.45+i*1.62;B(side*1.99,y,-3.29,.12,.055,.29,C.dark);B(side*1.92,y,-3.42,.22,.055,.045,C.steel);}
      for(const z of [-2.64,2.64]){V(side*1.72,-7.65,z,.36,.18,.50,C.black,.04);T([side*1.72,-7.55,z],[side*1.72,-7.78,z],.085,C.steel);}
    }
    V(0,7.50,0,4.56,.20,6.52,C.dark,.03);V(0,-7.48,0,4.56,.19,6.52,C.dark,.03);
    for(const side of [-1,1]){V(side*2.14,7.65,-2.7,.16,.28,.13,C.dark,.045);V(side*2.14,7.65,2.7,.16,.28,.13,C.dark,.045);}
    V(0,7.31,3.22,4.39,.31,.12,C.steel,.025);B(0,7.451,3.287,4.26,.009,.017,C.edge);B(-1.6,7.31,3.29,.37,.028,.008,C.edge,.1);B(1.83,7.31,3.29,.028,.024,.008,C.blue,0,.7);
    V(0,-7.29,3.22,4.38,.32,.12,C.dark,.025);B(0,-7.14,3.29,4.16,.007,.012,C.edge);
    return m;
  }
  function chassis(m,h,depth,color=C.silver,textured=false){
    const z=FRONT-depth/2; m.bevel(0,0,z,3.94,h,depth,color,.023,textured?-.7:.9);m.bevel(0,h/2-.002,z,3.90,.015,Math.max(.05,depth-.04),textured||color===C.dark?color:C.lid,.006,textured?-.7:.9);
    for(const side of [-1,1]){m.box(side*1.988,-h*.30,z,.028,.042,Math.max(.08,depth-.18),C.edge);m.bevel(side*2.002,0,FRONT+.016,.126,h+.008,.105,textured?color:C.steel,.014,textured?-.7:.9);if(!textured)for(const y of [-1,1]){const sy=y*Math.min(h*.35,.30);m.tube([side*2.004,sy,FRONT+.07],[side*2.004,sy,FRONT+.081],.022,C.edge,8);m.box(side*2.004,sy,FRONT+.085,.026,.006,.004,C.black);}
      if(depth>.5){m.box(side*1.976,h/2-.027,z,.008,.009,depth-.07,C.dark);for(let i=0;i<5;i++){const sz=FRONT-.25-(depth-.50)*i/4;m.tube([side*1.977,h*.16,sz],[side*1.984,h*.16,sz],.020,C.steel,8);m.box(side*1.986,h*.16,sz,.003,.006,.021,C.black);m.tube([side*1.78,h/2+.006,sz],[side*1.78,h/2+.012,sz],.019,C.edge,8);}}}
    if(depth>.5){m.box(0,h/2+.010,FRONT-.45,3.69,.003,.012,C.steel);m.bevel(.88,h/2+.004,z,.30,.017,.20,C.steel,.018);m.bevel(.88,h/2+.009,z,.22,.007,.13,C.dark,.012);}
    return z;
  }
  function led(m,item,x,y,z){
    // Original tiny module/service lamp housings stay neutral. Only the shared
    // right-hand rack Ping indicator below communicates reachability.
    m.box(x,y,z,.022,.020,.009,C.unknown,.15,0);
  }
  function pingIndicator(item){
    if(item.mgx_type==='blanking')return null;
    const state=['up','down','partial'].includes(item.rack_ping_state)?item.rack_ping_state:'unknown';
    // Keep the shared Ping lamp on the equipment skin. The prior fixed x=1.995
    // landed on the rack ear/rail for every rackmount device, which made the
    // lamps look attached to the cabinet instead of the systems. Type-specific
    // coordinates keep a consistent right-hand convention without forming an
    // artificial straight line down the rack.
    const h=Math.max(.12,Number(item.height)||U-.026),inside=(y,margin=.062)=>clamp(y,-h/2+margin,h/2-margin);
    const face={
      server:[1.68,inside(h/2-.078)],
      // The two QSFP rows end at x=1.6835. Keep the complete Ping lamp
      // on the narrow service strip to their right,
      // clear of both the sockets and the rack ear/handle.
      switch:[1.75,inside(h/2-.060)],
      nvlink:[1.61,inside(h/2-.080)],
      powershelf:[1.886,inside(h/2-.090)],
      pdu:[1.48,inside(-h*.18)],
      cdu:[1.55,inside(h/2-.102,.070)],
      storage:[1.69,inside(-h/2+.082)],
      network:[1.60,inside(h*.18)]
    }[item.mgx_type]||[1.65,inside(0)];
    // The external CDU lamp sits on the upper-right door skin, clear of its
    // blue decorative rails, screen and emergency stop.
    // Follow each skin's real depth. In particular, the service strip beside
    // Power Shelf fans is behind the cartridges, not on their projecting grips.
    const skinOffset={server:.0855,switch:.078,nvlink:.082,powershelf:.083,pdu:.1325,cdu:.0805,storage:.1345,network:.108}[item.mgx_type]??.083;
    const surfaceZ=item.external?3.2485:FRONT+skinOffset;
    const local=item.external?[2.10,4.05,surfaceZ+.0075]:[face[0],face[1],surfaceZ+.0075];
    const radius=item.mgx_type==='powershelf'?.038:item.mgx_type==='switch'?.030:.028;
    const outerRadius=radius+.010;
    return {name:item.name,type:item.mgx_type,state,color:state==='up'?'green':state==='unknown'?'gray':'red',side:'right',local,radius,outerRadius,surfaceZ,position:[local[0]+(item.x||0),local[1]+item.y,local[2]]};
  }
  function addPingIndicator(mesh,item){
    const indicator=pingIndicator(item);if(!indicator)return;
    const [x,y]=indicator.local,color=indicator.color==='green'?[.12,.86,.32]:indicator.color==='red'?[.94,.07,.04]:[.13,.18,.20];
    const trim=['server','nvlink'].includes(item.mgx_type)?[.38,.35,.29]:[.25,.285,.31];
    mesh.statusLens(x,y,indicator.surfaceZ,indicator.radius,indicator.outerRadius,color,trim,indicator.state!=='unknown');
  }
  function vent(m,x,y,z,w,h,rows=2,cols=10){for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)m.box(x-w/2+w*(c+.5)/cols,y-h/2+h*(r+.5)/rows,z,w/cols*.58,h/rows*.28,.013,C.black,.1);}
  function qsfp(m,x,y,z,w=.18,h=.079,front=1,frameColor=C.edge){m.box(x,y,z,w,h,.030,frameColor);m.box(x,y,z+front*.02,w-.025,h-.018,.020,C.black,.05);m.box(x,y-h*.41,z+front*.037,w*.67,.009,.008,frameColor===C.edge?C.steel:frameColor);}
  function handle(m,x,y,h,z=FRONT+.08){const dy=Math.max(.027,h*.28);m.tube([x,y-dy,z],[x,y-dy,z+.11],.019,C.edge,8);m.tube([x,y-dy,z+.11],[x,y+dy,z+.11],.019,C.edge,8);m.tube([x,y+dy,z+.11],[x,y+dy,z],.019,C.edge,8);}
  function grille(m,x,y,z,w,h,color=C.steel,front=1){
    m.box(x,y,z,w,h,.010,color,.80);const cols=Math.max(2,Math.round(w/.042)),rows=Math.max(2,Math.round(h/.038));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)m.face(x-w/2+(c+.5)*w/cols,y-h/2+(r+.5)*h/rows,z+front*.006,w/cols*.70,h/rows*.73,C.black,.08,front);
  }
  function screw(m,x,y,z,front=1){m.tube([x,y,z],[x,y,z+front*.007],.015,C.edge,8);m.box(x,y,z+front*.012,.018,.004,.004,C.dark);}
  function fan(m,x,y,z,r){
    m.disc(x,y,z,r,C.black,.05);m.ring(x,y,z+.004,r*.94,.005,C.steel,20);m.ring(x,y,z+.008,r*.65,.004,C.steel,18);
    for(let i=0;i<7;i++){const a=i/7*TAU;m.tube([x+Math.cos(a)*r*.23,y+Math.sin(a)*r*.23,z+.010],[x+Math.cos(a+.34)*r*.78,y+Math.sin(a+.34)*r*.78,z+.010],r*.085,C.steel,5,.6);}
    m.disc(x,y,z+.018,r*.24,C.steel,.75);m.ring(x,y,z+.023,r*.23,.004,C.edge,12);
  }
  function fluidPort(m,x,y,z,r,front=-1){
    const Z=d=>z+front*d;m.tube([x,y,z],[x,y,Z(.10)],r,C.steel,12);m.tube([x,y,Z(.07)],[x,y,Z(.15)],r*.83,C.edge,12);m.tube([x,y,Z(.15)],[x,y,Z(.19)],r*.66,C.steel,12);m.tube([x,y,Z(.19)],[x,y,Z(.196)],r*.47,C.black,12);
    for(let i=0;i<3;i++)m.ring(x,y,Z(.08+i*.018),r*.86,.004,C.edge,12);
  }
  function createEquipment(item){
    const m=meshBuilder(),B=m.box,V=m.bevel,T=m.tube,h=item.height,type=item.mgx_type,f=FRONT+.028;
    const depths={server:5.85,switch:4.40,nvlink:5.95,powershelf:3.60,pdu:1.02,cdu:5.95,storage:5.50,network:3.10,blanking:.13},depth=depths[type];
    chassis(m,h,depth,type==='cdu'?[.070,.074,.084]:type==='blanking'?C.dark:C.silver,type==='cdu');
    if(type==='server'){
      V(0,0,f,3.90,h-.008,.115,C.gold,.022);B(0,h/2-.010,f+.066,3.74,.012,.018,C.goldEdge);B(0,-h/2+.010,f+.066,3.74,.012,.018,C.goldEdge);
      // Fixed-pitch GB300-inspired service band. Taller enclosures add vented
      // panels underneath, not vertically stretched RJ45 / OSFP connectors.
      const bandY=h/2-.139,fh=.225;
      grille(m,-1.22,bandY,f+.064,1.04,fh,C.goldEdge);grille(m,1.18,bandY,f+.064,.93,fh,C.goldEdge);
      B(-.05,bandY,f+.069,1.13,fh,.023,C.darkGold);
      for(let i=0;i<8;i++){const x=-.542+i*.141;V(x,bandY,f+.089,.117,.213,.037,C.goldEdge,.010);B(x,bandY,f+.113,.083,.160,.012,C.gold);B(x,bandY+.075,f+.124,.074,.009,.007,C.darkGold);B(x,bandY-.071,f+.125,.059,.015,.014,C.goldEdge);B(x+.045,bandY,f+.123,.008,.149,.006,C.black);}
      // The left/right NIC carrier plates and port frames share the champagne
      // front finish. Only the recessed connector openings remain dark.
      for(const x of [-1.51,-1.12,.96,1.34])qsfp(m,x,bandY-.065,f+.082,.249,.068,1,C.goldEdge);
      qsfp(m,-.78,bandY-.062,f+.086,.098,.075,1,C.goldEdge);qsfp(m,.62,bandY-.014,f+.079,.093,.069,1,C.goldEdge);
      B(.61,bandY-.075,f+.102,.10,.022,.018,C.black);B(.62,bandY+.065,f+.086,.114,.039,.011,C.steel);
      qsfp(m,.94,bandY+.066,f+.086,.10,.064,1,C.goldEdge);qsfp(m,1.21,bandY+.061,f+.086,.19,.043,1,C.goldEdge);qsfp(m,1.44,bandY+.061,f+.086,.19,.043,1,C.goldEdge);
      for(const y of [-.065,0,.065])B(.725,bandY+y,f+.112,.030,.021,.014,C.edge);led(m,item,.726,bandY+.085,f+.121);
      if(item.size>1){
        // Only the upper 1U service face is champagne. Extension panels below
        // that physical boundary are neutral gray; the outer frame stays gold.
        const extensionPanel=[.24,.255,.27],extensionMesh=[.36,.385,.405],extensionSeam=[.12,.14,.15];
        V(0,-U/2,f+.057,3.54,h-U,.015,extensionPanel,.008,.78);
        const extra=h-.285,rows=Math.min(12,item.size-1),rh=extra/rows;
        for(let r=0;r<rows;r++){const y=-h/2+.014+(r+.5)*rh;grille(m,0,y,f+.065,3.34,Math.min(rh-.030,.24),extensionMesh);B(0,y-rh/2+.005,f+.069,3.48,.010,.013,extensionSeam);}
      }
      for(const side of [-1,1]){V(side*1.865,0,f+.055,.20,h-.003,.15,C.gold,.025);T([side*1.848,-h/2+.031,f+.155],[side*1.848,h/2-.031,f+.155],.045,C.goldEdge,16);B(side*1.94,0,f+.14,.019,h*.72,.026,C.edge);for(const y of [-1,1])screw(m,side*1.96,y*Math.min(h*.37,.42),f+.152);}
      const rear=FRONT-depth-.035;V(0,0,rear,3.75,h-.024,.085,C.steel,.015);
      const rearY=item.size===1?0:bandY;for(let i=0;i<4;i++){const x=-1.04+i*.69;B(x,rearY,rear-.058,.60,.205,.059,C.black,.15);B(x,rearY,rear-.092,.51,.13,.031,C.steel);for(let p=0;p<10;p++)B(x-.206+p*.046,rearY,rear-.112,.012,.104,.009,C.copper);B(x,rearY+.099,rear-.091,.57,.017,.038,C.edge);}
      for(const side of [-1,1]){fluidPort(m,side*1.64,rearY,rear,.068);B(side*1.83,rearY,rear-.075,.055,.185,.045,C.copper);}
      if(item.size>1)grille(m,0,-.13,rear-.062,2.85,Math.min(.46,h-.35),C.steel,-1);
    }else if(type==='switch'){
      V(0,0,f,3.90,h-.01,.10,C.dark,.015);const rowH=.073,dy=.052,cy=item.size>1?h/2-.14:0;
      // Mirror both eight-column banks around a dedicated central vent gap.
      // The old offset put the first right port over the grille's edge.
      for(let row=0;row<2;row++)for(let c=0;c<16;c++){const x=c<8?-1.60+c*.20:.20+(c-8)*.20,y=cy+(row?dy:-dy);qsfp(m,x,y,f+.056,.167,rowH);}
      // The shared Ping lens replaces the former service lamp at this spot;
      // retaining that gray housing would obscure the lens's upper-left edge.
      grille(m,0,cy,f+.059,.18,.18,C.steel);handle(m,-1.88,0,Math.min(h*.65,.42));handle(m,1.88,0,Math.min(h*.65,.42));B(0,h/2-.008,f+.060,3.74,.010,.019,C.edge);
      if(item.size>1)grille(m,0,-.12,f+.059,3.32,h-.32,C.steel);
      const rear=FRONT-depth-.04;for(let i=0;i<2;i++){V(-1.36+i*.76,0,rear,.67,h*.86,.09,C.steel,.015);vent(m,-1.36+i*.76,0,rear-.052,.56,h*.66,2,7);B(-1.36+i*.76,-h*.22,rear-.069,.25,.025,.035,C.edge);}
      for(let i=0;i<4;i++){const x=.18+i*.43;B(x,0,rear,.36,h*.85,.09,C.dark);fan(m,x,0,rear-.060,Math.min(.095,h*.34));B(x+.13,0,rear-.082,.03,Math.min(h*.68,.22),.028,C.blue);}
    }else if(type==='nvlink'){
      V(0,0,f,3.9,h-.008,.108,C.gold,.021);B(0,h/2-.012,f+.064,3.73,.012,.018,C.goldEdge);B(0,-h/2+.012,f+.064,3.73,.009,.017,C.goldEdge);
      // The supplied front-on rack reference shows a CLOSED champagne panel.
      // Its top-view pull-handle cutouts do not belong on the front face.
      // Keep the small left service cluster generic: not an installed-port claim.
      const cy=item.size>1?h/2-.146:0;
      V(-1.383,cy,f+.067,.95,.207,.019,C.goldEdge,.009);B(-.891,cy,f+.082,.008,.208,.008,C.darkGold);
      for(let i=0;i<4;i++){const x=-1.718+i*.192;V(x,cy-.017,f+.083,.119,.073,.013,C.steel,.006);B(x,cy-.017,f+.094,.084,.047,.009,C.black,.05);B(x,cy-.046,f+.100,.073,.006,.009,C.goldEdge);}
      qsfp(m,-.947,cy-.014,f+.083,.078,.061);led(m,item,-.947,cy+.069,f+.100);
      // Folded lower lip and sparse fixings preserve the calm, nearly solid
      // face at 1U. A larger-U tray remains one larger closed panel.
      B(.477,-h/2+.037,f+.071,2.70,.011,.018,C.darkGold);B(.477,-h/2+.025,f+.083,2.70,.012,.029,C.goldEdge);
      for(const x of [-.22,.93]){B(x,-h/2+.044,f+.092,.033,.023,.025,C.gold);screw(m,x,-h/2+.044,f+.110);}
      for(const side of [-1,1]){V(side*1.883,0,f+.067,.077,h-.013,.084,C.gold,.013);B(side*1.905,0,f+.115,.012,h*.78,.017,C.goldEdge);for(const sy of [-1,1])screw(m,side*1.865,sy*(h/2-.041),f+.113);}
      const rear=FRONT-depth-.030;V(0,0,rear,3.76,h-.015,.07,C.steel,.014);for(let c=0;c<9;c++){const x=-1.33+c*.333;B(x,cy,rear-.061,.27,.18,.073,C.black);B(x,cy,rear-.102,.22,.12,.023,C.steel);for(let p=0;p<5;p++)B(x-.083+p*.04,cy,rear-.117,.013,.095,.006,C.copper);}
      for(const side of [-1,1])fluidPort(m,side*1.73,cy,rear,.063);
    }else if(type==='cdu'){
      // Photo reference: powder-coated charcoal enclosure, tubular chrome
      // handles, recessed black HMI and circular service collars. No brand mark
      // or fabricated live readings are painted into this physical model.
      const powder=[.085,.090,.102],trim=[.055,.061,.072],chamfer=[.12,.13,.15],glass=[.004,.005,.007];
      V(0,0,f,3.9,h-.008,.105,powder,.019,-.7);B(0,h/2-.015,f+.060,3.76,.009,.012,trim,.25);B(0,-h/2+.014,f+.060,3.76,.007,.010,trim,.25);
      // Three recessed rhombi per cell form the cube-like stamped vent pattern.
      // Face geometry is bounded even for unusually tall configured enclosures.
      const radius=.031,stepX=.081,stepY=.065,bottom=-h/2+Math.min(.062,h*.08),bandH=Math.min(.40,h*.33);
      for(let row=0,y=bottom+radius;y<bottom+bandH;row++,y+=stepY)for(let x=-1.57+(row%2)*stepX/2;x<1.59;x+=stepX){
        const rx=radius*.86,shapes=[[[x,y+radius],[x+rx,y+radius*.5],[x,y],[x-rx,y+radius*.5]],[[x-rx,y+radius*.5],[x,y],[x,y-radius],[x-rx,y-radius*.5]],[[x,y],[x+rx,y+radius*.5],[x+rx,y-radius*.5],[x,y-radius]]];
        for(const pts of shapes){const cx=pts.reduce((sum,p)=>sum+p[0],0)/4,cy=pts.reduce((sum,p)=>sum+p[1],0)/4,scale=k=>pts.map(p=>[cx+(p[0]-cx)*k,cy+(p[1]-cy)*k]);m.polygon(scale(.88),f+.058,chamfer,.22);m.polygon(scale(.70),f+.061,C.black,.03);}
      }
      for(const side of [-1,1]){
        // Curved return ends keep the long bright grips clear of the face.
        const grip=Math.min(.40,Math.max(.027,h*.32)),x=side*1.76,r=Math.min(.032,h*.092);
        for(const sy of [-1,1]){T([x,sy*grip,f+.057],[x,sy*grip,f+.090],r*1.70,C.edge,16);T([x,sy*grip,f+.086],[x,sy*grip,f+.130],r,C.edge,12);
          for(let j=0;j<5;j++){const a=j/5*Math.PI/2,b=(j+1)/5*Math.PI/2;T([x,sy*(grip-r*(1-Math.cos(a))),f+.130+r*Math.sin(a)],[x,sy*(grip-r*(1-Math.cos(b))),f+.130+r*Math.sin(b)],r,C.edge,12);}}
        T([x,-grip+r,f+.130+r],[x,grip-r,f+.130+r],r,C.edge,18);
        // Realistically proportioned oblong mounting slots in the rack ears.
        for(const sy of [-1,1]){const ey=sy*Math.max(.052,h/2-.071),ex=side*2.003,rr=.014,straight=.043,points=[];for(let i=0;i<=8;i++){const a=-Math.PI/2+i/8*Math.PI;points.push([ex+straight/2+Math.cos(a)*rr,ey+Math.sin(a)*rr]);}for(let i=0;i<=8;i++){const a=Math.PI/2+i/8*Math.PI;points.push([ex-straight/2+Math.cos(a)*rr,ey+Math.sin(a)*rr]);}m.polygon(points,FRONT+.071,C.black,.02);}
      }
      // Nested bezel steps and one quiet diagonal reflection, without a chart.
      const bezelH=Math.min(.70,h-.084),screenH=Math.min(.382,bezelH*.54),screenY=Math.min(.073,bezelH*.105);
      V(0,0,f+.083,1.14,bezelH,.064,trim,.025,.58);V(0,0,f+.116,1.10,bezelH-.026,.027,chamfer,.018,.63);V(0,0,f+.132,1.076,bezelH-.044,.018,trim,.012,.4);
      V(0,screenY,f+.146,.889,screenH+.021,.019,chamfer,.010,.65);B(0,screenY,f+.159,.858,screenH,.010,glass,.60);
      m.polygon([[-.424,screenY+screenH/2-.005],[-.12,screenY+screenH/2-.005],[.13,screenY-screenH/2+.005],[-.424,screenY-screenH/2+.005]],f+.165,[.020,.023,.029],.48);
      B(-.429,screenY,f+.166,.004,screenH-.013,.003,C.steel,.5);
      const buttonY=Math.min(.28,h*.30),buttonR=Math.min(.105,h*.18),buttonX=1.32;
      T([buttonX,buttonY,f+.053],[buttonX,buttonY,f+.086],buttonR,C.steel,24);m.ring(buttonX,buttonY,f+.094,buttonR*.88,Math.min(.012,buttonR*.12),C.edge,24);m.disc(buttonX,buttonY,f+.093,buttonR*.76,[.48,.50,.53],.64,24);
      const portY=-Math.min(.118,h*.15),portR=Math.min(.118,h*.19),portH=Math.min(.081,portR*.85);
      for(const x of [.73,1.026,1.322]){T([x,portY,f+.055],[x,portY,f+.084],portR,trim,20,.6);m.ring(x,portY,f+.092,portR*.90,Math.min(.008,portR*.09),C.steel,20);qsfp(m,x,portY,f+.091,Math.min(.119,portR*1.25),portH,1,C.steel);B(x,portY+portR+.029,f+.065,.074,.007,.004,C.label,.1);}
      const rear=FRONT-depth-.035;V(0,0,rear,3.8,h*.90,.08,powder,.02,-.7);
      for(const x of [-1.24,-.48,.48,1.24]){const radius=Math.min(.125,h*.23);T([x,0,rear],[x,0,rear-.21],radius,C.edge,14);T([x,0,rear-.20],[x,0,rear-.27],radius*.84,x<0?C.blue:[.43,.17,.13],14);T([x,0,rear-.27],[x,0,rear-.275],radius*.64,C.black,14);}
      for(const x of [-1.71,1.71])B(x,0,rear-.075,.14,h*.58,.08,C.black);
    }else if(type==='pdu'){
      V(0,0,f,3.91,h-.014,.11,C.dark,.014);const outletH=Math.min(.15,h*.63),rows=item.size>=2?2:1;
      for(let row=0;row<rows;row++)for(let c=0;c<10;c++){const x=-1.58+c*.293,y=(row-(rows-1)/2)*Math.min(.24,h*.45);V(x,y,f+.068,.219,outletH,.050,C.steel,.012);B(x,y,f+.098,.151,outletH*.69,.025,C.black,.1);for(const dx of [-.039,.039])B(x+dx,y,f+.113,.012,outletH*.35,.009,C.copper);}
      V(1.62,0,f+.072,.37,Math.min(.17,h*.72),.050,C.steel,.01);B(1.62,0,f+.10,.29,Math.min(.12,h*.48),.009,C.blue,.1,.2);led(m,item,1.85,h*.27,f+.075);
      T([1.62,0,FRONT-depth],[1.62,0,FRONT-depth-.19],Math.min(.075,h*.23),C.black);B(-1.45,0,FRONT-depth-.018,.51,h*.43,.044,C.steel);
    }else if(type==='powershelf'){
      V(0,0,f,3.91,h-.01,.11,C.dark,.014);B(-1.79,0,f+.068,.19,h-.03,.035,C.black);qsfp(m,-1.79,0,f+.097,.10,.09);led(m,item,-1.79,-Math.min(.09,h*.31),f+.129);
      const rows=Math.max(1,item.size),moduleH=(h-.022)/rows;
      for(let row=0;row<rows;row++)for(let i=0;i<6;i++){
        const x=-1.39+i*.586,y=(row-(rows-1)/2)*moduleH,r=Math.min(.108,moduleH*.40);V(x,y,f+.077,.554,moduleH-.012,.073,C.dark,.012);B(x,y,f+.117,.454,moduleH-.032,.013,C.black,.08);
        fan(m,x-.027,y,f+.132,r);for(let col=0;col<12;col++)B(x-.215+col*.038,y,f+.157,.005,moduleH-.043,.008,C.steel);for(let q=0;q<6;q++)B(x-.009,y-moduleH*.36+q*moduleH*.144,f+.159,.44,.005,.009,C.steel);
        V(x+.25,y,f+.140,.058,moduleH-.015,.073,C.dark,.011);B(x+.255,y,f+.182,.010,moduleH*.70,.014,C.edge);led(m,item,x-.212,y+moduleH*.30,f+.164);
        B(x,y,FRONT-depth-.04,.45,moduleH*.75,.09,C.black);B(x,y,FRONT-depth-.094,.19,moduleH*.42,.026,C.copper);
      }
    }else if(type==='storage'){
      V(0,0,f,3.9,h-.015,.10,C.dark,.015);const rows=Math.max(1,Math.min(4,item.size)),bh=(h-.045)/rows;
      for(let row=0;row<rows;row++)for(let c=0;c<8;c++){const x=-1.56+c*.446,y=(row-(rows-1)/2)*(h-.018)/rows;V(x,y,f+.071,.409,bh*.91,.07,C.silver,.012);B(x,y,f+.111,.334,bh*.68,.027,C.black);B(x,y-bh*.23,f+.128,.259,.025,.021,C.edge);if(row===0&&c===7)led(m,item,x+.155,y+bh*.24,f+.135);}
      const rear=FRONT-depth-.04;for(const x of [-1.38,1.38]){B(x,0,rear,.81,h*.83,.09,C.steel);vent(m,x,0,rear-.055,.65,h*.63,3,7);}for(let i=0;i<4;i++)qsfp(m,-.52+i*.35,0,rear-.07,.26,Math.min(.15,h*.50));
    }else if(type==='network'){
      V(0,0,f,3.90,h-.01,.10,C.steel,.015);const rows=item.size>=2?2:1,ph=Math.min(.10,h*.55/rows);
      for(let row=0;row<rows;row++)for(let c=0;c<12;c++){const x=-1.64+c*.231,y=(row-(rows-1)/2)*Math.min(.21,h*.45);qsfp(m,x,y,f+.059,.185,ph);}qsfp(m,1.45,0,f+.06,.27,ph);led(m,item,1.78,0,f+.073);vent(m,0,0,FRONT-depth-.031,3.10,h*.62,2,18);
    }else{
      V(0,0,f,3.92,h-.012,.066,C.dark,.018);B(0,h/2-.025,f+.038,3.70,.013,.009,C.steel);B(0,-h/2+.023,f+.038,3.70,.010,.009,C.steel);for(const s of [-1,1])for(const sy of [-1,1])screw(m,s*1.88,sy*Math.min(h*.32,.46),f+.04);
      if(item.size>1)for(let i=1;i<item.size;i++)B(0,-h/2+i*U-.013,f+.035,3.68,.005,.007,C.steel,.45);
    }
    return {mesh:m,depth,min:[-2.07,-h/2,FRONT-depth-.33],max:[2.07,h/2,FRONT+.28]};
  }

  // TC1288 reference: https://mg-cooling.com/en/portfolio-item/in-row-cdu_tc1288/
  // H2160 / W900 / D1350 mm. Keep this existing 0U envelope and its rear ports
  // aligned with placement, picking, camera fitting and the secondary loop.
  // This is an exterior illustration, not vendor CAD or a live HMI readout.
  function createExternalCdu(){
    const m=meshBuilder(),B=m.box,V=m.bevel,T=m.tube,front=3.15,rear=-5.96;
    const powder=[.051,.058,.068],panel=[.070,.078,.088],trim=[.024,.030,.040],seam=[.010,.014,.020],edge=[.135,.150,.165];
    V(0,-.42,-1.40,6.08,14.58,9.11,powder,.105,-.7);
    // Folded cabinet skin, recessed solid side service doors and fine panel
    // gaps give the deep enclosure a readable surface from a three-quarter view.
    for(const side of [-1,1]){
      V(side*3.038,-.36,-1.42,.025,13.97,8.85,trim,.010,-.7);
      V(side*3.057,-.36,-1.43,.024,13.78,8.64,panel,.009,-.7);
      B(side*3.074,6.49,-1.43,.008,.018,8.54,edge,.42);
      B(side*3.073,-.34,2.74,.008,13.58,.020,seam,.1);
      for(const y of [-5.50,.07,5.12]){
        V(side*3.083,y,2.80,.046,.30,.095,trim,.012,.4);
        B(side*3.109,y,2.80,.008,.20,.010,edge,.65);
      }
      V(side*3.082,-.55,-5.16,.043,.52,.16,trim,.014,.32);
      B(side*3.110,-.55,-5.16,.008,.30,.045,edge,.52);
      for(const z of [-5.5,2.7]){
        V(side*2.47,-7.72,z,.37,.21,.50,C.black,.035);
        T([side*2.47,-7.52,z],[side*2.47,-7.73,z],.080,C.steel,12);
      }
    }
    V(0,-7.46,-1.41,5.94,.33,8.95,trim,.055,-.7);
    // A single closed charcoal front door, bordered by faceted corner pillars.
    // There is no invented central split through the screen and badge.
    V(0,-.36,front+.011,5.60,14.08,.14,trim,.070,-.7);
    V(0,-.34,front+.063,5.27,13.88,.071,powder,.040,-.7);
    B(0,6.55,front+.105,4.86,.016,.007,edge,.42);
    for(const side of [-1,1]){
      V(side*2.83,-.37,front-.005,.30,14.16,.26,trim,.073,.42);
      B(side*2.984,-.37,front-.008,.017,13.92,.15,edge,.48);
      B(side*2.58,-.38,front+.102,.020,13.73,.014,seam,.08);
      // Black channels, blue diffusers and a thin bright core. The shader moves
      // long tapered light streaks along these rails independently of water.
      const lightStrip=(x,y,h,w,phase)=>{
        V(x,y,front+.124,w+.062,h+.07,.036,seam,.015,.18);
        m.face(x,y,front+.148,w*3.5,h+.016,[.025,.25,.95],-4,1,phase);
        B(x,y,front+.153,w,h,.010,[.016,.28,1.0],-3,phase);
        B(x,y,front+.160,w*.27,h-.024,.004,[.39,.75,1.0],-3,phase);
      };
      lightStrip(side*2.73,-.27,13.46,.078,side<0?0:.44);
      for(const [y,h,phase] of [[-5.55,1.78,.14],[-2.48,2.52,.28],[.96,2.30,.42],[4.30,2.22,.56]]){
        lightStrip(side*2.43,y+(side<0?.18:0),h,.060,phase+(side<0?0:.44));
      }
    }
    // Raised cyan Cooling label rendered as slim vector strokes. It is a
    // reference badge only; inventory classification and model names stay intact.
    const stroke=(points,x,y,w,h)=>{for(let i=1;i<points.length;i++)T([x+points[i-1][0]*w,y+points[i-1][1]*h,front+.119],[x+points[i][0]*w,y+points[i][1]*h,front+.119],.027,[.035,.46,.60],8,.15);};
    const arc=(cx,cy,rx,ry,a,b,n=12)=>Array.from({length:n+1},(_,i)=>[cx+Math.cos(a+(b-a)*i/n)*rx,cy+Math.sin(a+(b-a)*i/n)*ry]);
    const letters=[
      {w:.32,paths:[arc(.5,.5,.5,.5,.22*Math.PI,1.78*Math.PI)]},
      {w:.26,paths:[arc(.5,.35,.5,.35,0,TAU)]},
      {w:.26,paths:[arc(.5,.35,.5,.35,0,TAU)]},
      {w:.075,paths:[[[.5,1],[.5,.03],[1,.03]]]},
      {w:.060,paths:[[[.5,0],[.5,.69]],[[.5,.92],[.5,.98]]]},
      {w:.26,paths:[[[0,0],[0,.69]],arc(.5,.44,.5,.27,Math.PI,0),[[1,.44],[1,0]]]},
      {w:.26,paths:[arc(.5,.37,.5,.32,0,TAU),[[1,.66],[1,-.14]],arc(.5,-.14,.5,.20,0,-Math.PI)]}
    ];
    const wordWidth=letters.reduce((sum,l)=>sum+l.w+.067,0)-.067;let letterX=-wordWidth/2;
    for(const letter of letters){for(const points of letter.paths)stroke(points,letterX,4.97,letter.w,.54);letterX+=letter.w+.067;}
    // Recessed touchscreen with a quiet schematic and glass reflection. No
    // numeric temperature, pressure, health or flow claims are fabricated here.
    V(.12,3.13,front+.155,1.71,1.43,.19,seam,.047,.20);
    V(.12,3.14,front+.250,1.53,1.24,.036,edge,.020,.45);
    B(.12,3.17,front+.275,1.37,1.06,.013,[.12,.20,.24],.15,.45);
    B(.12,3.59,front+.284,1.34,.15,.005,[.028,.068,.098],.1,.55);
    B(-.33,3.59,front+.289,.32,.026,.004,[.36,.57,.64],.1,.70);
    for(const [x,y,w,h] of [[-.26,3.28,.33,.22],[.47,3.28,.33,.22],[-.26,2.98,.33,.19],[.47,2.98,.33,.19]]){
      B(x,y,front+.287,w,h,.006,[.26,.37,.40],.1,.46);
      B(x,y+.034,front+.292,w*.62,.014,.004,[.48,.62,.63],.1,.6);
    }
    B(.12,3.30,front+.292,.029,.34,.005,[.10,.49,.61],.1,.72);
    B(.12,3.43,front+.292,.70,.024,.005,[.10,.49,.61],.1,.72);
    B(.12,3.00,front+.292,.70,.020,.005,[.10,.49,.61],.1,.72);
    m.polygon([[-.56,3.68],[-.22,3.68],[.60,2.66],[.36,2.66]],front+.296,[.21,.30,.34],.3);
    B(.12,2.59,front+.279,.13,.011,.006,[.19,.23,.27],.3);
    // Mushroom emergency stop: square yellow guard, cylindrical red actuator.
    V(-1.40,3.15,front+.156,.48,.48,.16,[.63,.43,.025],.080,.26);
    T([-1.40,3.15,front+.19],[-1.40,3.15,front+.32],.167,[.25,.045,.025],24,.25);
    T([-1.40,3.15,front+.30],[-1.40,3.15,front+.385],.197,[.63,.046,.022],24,.25);
    m.disc(-1.40,3.15,front+.388,.158,[.74,.065,.030],.24,24);
    // Low recessed perforated intake, a folded lower lip and the service latch.
    V(0,-5.92,front+.112,2.52,1.67,.057,trim,.040,-.7);
    B(0,-5.92,front+.145,2.30,1.44,.013,[.031,.046,.070],.22);
    for(let row=0;row<20;row++)for(let col=0;col<33;col++){
      const x=-1.09+col*.067+(row%2)*.024,y=-6.57+row*.068;
      m.face(x,y,front+.154,.042,.029,seam,.05);
    }
    B(0,-6.69,front+.165,2.25,.019,.015,[.030,.11,.21],.22,.3);
    V(2.10,-.77,front+.140,.12,.55,.072,trim,.025,.5);
    T([2.10,-.62,front+.18],[2.10,-.62,front+.194],.043,C.steel,14,.65);
    B(2.10,-.62,front+.200,.006,.039,.003,seam,.1);
    B(0,-7.17,front+.081,5.18,.025,.016,seam,.1);
    // Rear service skin and fluid fittings retain the existing coupling centers.
    V(0,-.18,rear-.03,5.23,12.66,.10,trim,.06,-.7);
    B(0,-.18,rear-.087,.023,12.36,.015,seam,.1);
    for(const side of [-1,1]){
      B(side*2.67,-.32,rear-.035,.095,13.8,.06,C.steel);
      for(let i=0;i<5;i++)B(side*2.58,-5.8+i*2.8,rear-.08,.07,.12,.06,C.edge);
      for(let row=0;row<12;row++)B(side*1.28,3.07+row*.19,rear-.095,1.93,.060,.024,seam,.1);
    }
    const blue=[.025,.36,.69],red=[.68,.08,.035];
    for(const [x,color] of [[-.95,blue],[.95,red]]){
      T([x,-6.50,rear],[x,-6.50,rear-.31],.23,C.edge,18);
      T([x,-6.50,rear-.24],[x,-6.50,rear-.36],.20,color,18);
      T([x,-6.50,rear-.36],[x,-6.50,rear-.39],.14,C.dark,18);
    }
    return {mesh:m,depth:9.11,min:[-3.12,-7.84,-6.38],max:[3.12,6.94,3.55]};
  }
  function smoothPath(anchors){
    const points=[];
    for(let i=0;i<anchors.length-1;i++){
      const a=anchors[Math.max(0,i-1)],b=anchors[i],c=anchors[i+1],d=anchors[Math.min(anchors.length-1,i+2)];
      for(let j=0;j<12;j++){const t=j/12,t2=t*t,t3=t2*t;points.push(b.map((v,k)=>clamp(.5*((2*v)+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t2+(-a[k]+3*v-3*c[k]+d[k])*t3),Math.min(v,c[k]),Math.max(v,c[k]))));}
    }
    points.push(anchors[anchors.length-1]);return points;
  }
  function pipeMesh(mesh,points,r,color,flow=false){
    let distance=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],v=b.map((n,k)=>n-a[k]),length=Math.hypot(...v),offset=mesh.data.length;
      mesh.tube(a,b,r,color,10,flow?-2:.65);
      if(flow&&length>0)for(let j=offset;j<mesh.data.length;j+=11){const t=clamp(v.reduce((n,q,k)=>n+(mesh.data[j+k]-a[k])*q,0)/(length*length),0,1);mesh.data[j+10]=distance+t*length;}
      distance+=length;
    }
  }
  // Saved physical links are the only source of network cables. Four nodes
  // sharing one RJ45 still produce one cable, irrespective of endpoint count.
  function planNetworkCabling(items,document){
    const installed=new Map(items.map(item=>[item.name,item])),routes=[],skipped=[],seen=new Set(),lanes={left:0,right:0};
    const racks=Array.isArray(document?.racks)?document.racks:[];
    for(const rack of racks){
      const devices=new Map((Array.isArray(rack.devices)?rack.devices:[]).map(device=>[device.id,device]));
      for(const link of Array.isArray(rack.links)?rack.links:[]){
        const a=devices.get(link.a?.device),b=devices.get(link.b?.device),ai=installed.get(a?.inventory),bi=installed.get(b?.inventory),id=String(link.id||'');
        const skip=reason=>skipped.push({id,rackId:rack.id,reason});
        if(!a||!b){skip('missing-device');continue;}
        if(!a.inventory||!b.inventory){skip('no-inventory-reference');continue;}
        if(!ai||!bi){skip('not-installed');continue;}
        if(ai.mgx_type==='blanking'||bi.mgx_type==='blanking'){skip('passive-component');continue;}
        if(ai.name===bi.name){skip('same-component');continue;}
        if(!a.ports?.some(port=>port.id===link.a.port)||!b.ports?.some(port=>port.id===link.b.port)){skip('missing-port');continue;}
        const endpoints=[a.inventory+'\u0000'+link.a.port,b.inventory+'\u0000'+link.b.port].sort().join('\u0001');
        if(seen.has(endpoints)){skip('duplicate-link');continue;}seen.add(endpoints);
        // Management roles follow the switch-side cable plan: Host, Power
        // Shelf and CDU management use the left channel; DPU management and
        // the switch uplink use the right. Unknown roles stay on the right.
        const side=['host','power','cooling'].includes(link.network)?'left':'right',sign=side==='left'?-1:1,index=lanes[side]++;
        const laneX=sign*(2.39+(index%16)*.014),laneZ=3.39+Math.floor(index%64/16)*.027;
        const endpoint=(device,item,reference)=>{
          const y=item.external?item.y+3.15:item.y+Math.max(0,item.height/2-.14),x=item.external?(item.x||0)-2.88:sign*1.80;
          return {deviceId:device.id,inventory:item.name,portId:reference.port,point:[x,y,item.external?3.38:3.295]};
        };
        const from=endpoint(a,ai,link.a),to=endpoint(b,bi,link.b);let path=[from.point,[sign*2.30,from.point[1],laneZ],[laneX,from.point[1],laneZ],[laneX,to.point[1],laneZ],[sign*2.30,to.point[1],laneZ],to.point];
        // External branches approach directly through the gap on the rack's
        // right side. A left-channel external CDU reaches that duct over the
        // rack crown, so its cable never cuts across installed equipment.
        if(side==='left'&&(ai.external||bi.external)){
          const bridgeY=7.29;
          path=ai.external
            ?[from.point,[from.point[0],bridgeY,laneZ],[laneX,bridgeY,laneZ],[laneX,to.point[1],laneZ],[sign*2.30,to.point[1],laneZ],to.point]
            :[from.point,[sign*2.30,from.point[1],laneZ],[laneX,from.point[1],laneZ],[laneX,bridgeY,laneZ],[to.point[0],bridgeY,laneZ],to.point];
        }else{
          if(ai.external)path[1]=[laneX,from.point[1],laneZ];
          if(bi.external)path[path.length-2]=[laneX,to.point[1],laneZ];
        }
        routes.push({id,rackId:rack.id,network:link.network,state:link.state,from,to,side,path});
      }
    }
    return {count:routes.length,routeCount:routes.length,routes,skipped,ducts:routes.length?[-1,1].map(sign=>({side:sign<0?'left':'right',x:sign*2.50,minY:-7.10,maxY:7.15})):[]};
  }
  function inspectNetworkCabling(records,document){return planNetworkCabling(inspectPlacement(records).valid,document);}
  function roundedCablePath(anchors){
    const clean=anchors.filter((point,i)=>!i||Math.hypot(...point.map((value,axis)=>value-anchors[i-1][axis]))>.0001),out=[clean[0]];
    for(let i=1;i<clean.length-1;i++){
      const previous=clean[i-1],corner=clean[i],next=clean[i+1],before=previous.map((v,k)=>v-corner[k]),after=next.map((v,k)=>v-corner[k]),a=Math.hypot(...before),b=Math.hypot(...after),radius=Math.min(.055,a*.35,b*.35);
      const start=corner.map((v,k)=>v+before[k]/a*radius),end=corner.map((v,k)=>v+after[k]/b*radius);out.push(start);
      for(let step=1;step<=4;step++){const t=step/4;out.push(corner.map((v,k)=>(1-t)*(1-t)*start[k]+2*(1-t)*t*v+t*t*end[k]));}
    }
    out.push(clean[clean.length-1]);return out;
  }
  function createNetworkCabling(items,document){
    const mesh=meshBuilder(),layout=planNetworkCabling(items,document);
    if(!layout.count)return {mesh,layout};
    for(const duct of layout.ducts){
      const sign=duct.side==='left'?-1:1;
      // Open, slotted cable ducts leave the organized bundles visible. Their
      // mounts sit outside the chassis and do not obscure the service faces.
      mesh.bevel(duct.x,.025,3.22,.43,14.25,.075,C.dark,.022,.60);
      mesh.box(sign*2.735,.025,3.35,.034,14.25,.28,C.steel,.75);
      for(let slot=0;slot<47;slot++){
        const y=-6.95+slot*U;
        mesh.box(sign*2.275,y,3.35,.028,.036,.28,C.steel,.75);
        mesh.box(sign*2.65,y,3.51,.18,.036,.030,C.dark,.35);
        mesh.box(sign*2.34,y,3.51,.095,.036,.030,C.dark,.35);
      }
      for(let y=-6.6;y<=6.7;y+=1.8){mesh.box(duct.x,y,3.475,.39,.045,.030,C.black,.35);}
    }
    const colors={host:[.025,.58,.70],dpu:[.37,.30,.79],power:[.96,.39,.045],cooling:[.02,.66,.52],uplink:[.73,.58,.22],data:[.24,.56,.37],other:[.47,.53,.57]};
    for(const route of layout.routes){
      const color=colors[route.network]||colors.other,finish=route.state==='planned'?color.map(value=>value*.48):color;
      // Each route keeps its own physical endpoint record. Port placement is
      // intentionally grouped at switch edges, rather than invented port CAD.
      pipeMesh(mesh,roundedCablePath(route.path),.014,finish);
      for(const endpoint of [route.from,route.to]){
        const [x,y,z]=endpoint.point;mesh.bevel(x,y,z,.105,.066,.10,C.dark,.009,.4);mesh.box(x,y,z+.054,.072,.043,.012,finish,.20);
      }
    }
    return {mesh,layout};
  }
  function createCooling(items){
    const solid=meshBuilder(),water=meshBuilder(),shell=meshBuilder(),B=solid.box,T=solid.tube,V=solid.bevel;
    const cdu=items.find(i=>i.mgx_type==='cdu'),mode=cdu?(cdu.external?'external':'internal'):'unconnected';
    // Copper DC busbar, its insulating spine, and cable cartridges are distinct
    // from the paired silver coolant distribution rails.
    V(0,0,-3.39,.24,14.05,.19,C.black,.023);
    for(const side of [-1,1])B(side*.065,0,-3.505,.073,13.93,.035,C.copper,.93);
    for(let y=-6.7;y<7;y+=.58){B(0,y,-3.54,.27,.095,.08,C.dark);T([-.11,y,-3.585],[-.11,y,-3.60],.023,C.edge,8);}
    for(const side of [-1,1]){
      const color=side<0?[.025,.38,.78]:[.78,.07,.025],x=side*1.57;
      T([x,-6.50,-3.57],[x,6.57,-3.57],.105,C.edge,14);
      B(side*1.26,0,-3.33,.27,13.3,.11,C.black);
      for(let i=0;i<35;i++){const y=-5.92+i*.35;B(side*1.26,y,-3.42,.35,.14,.06,C.steel);B(side*1.26,y,-3.456,.23,.065,.013,C.black);}
      for(const item of items.filter(i=>!i.external&&(i.mgx_type==='server'||i.mgx_type==='nvlink'))){
        const y=item.y+Math.min(item.height/2-.12,0);
        T([x,y,-3.57],[side*1.80,y,-3.57],.038,C.edge,10);T([side*1.80,y,-3.57],[side*1.80,y,-3.28],.042,C.dark,10);
        T([x,y,-3.57],[x,y,-3.78],.055,C.edge,10);T([x,y,-3.73],[x,y,-3.79],.059,color,10);
      }
      // A silver elbow at the top is connected to the flexible riser when CDU exists.
      T([x,6.35,-3.57],[side*.84,6.35,-3.57],.11,C.edge,14);
      T([side*.84,6.35,-3.57],[side*.84,6.35,-4.03],.14,C.edge,16);
      T([side*.84,6.35,-3.91],[side*.84,6.35,-4.05],.146,color,16);
      if(!cdu){T([side*.84,6.35,-4.04],[side*.84,6.35,-4.10],.118,C.black,16);continue;}
      let anchors;
      const rackEnd=[side*.84,6.35,-4.06];
      if(cdu.external){
        const port=[6.35+side*.95,-6.50,-6.35];
        const laneY=-6.62+side*.20,laneZ=-6.98+side*.25;
        anchors=[port,[port[0],-6.50,-6.72],[port[0]-.3,laneY,laneZ],[3.05,laneY,laneZ],[side*.84,laneY,-6.25+side*.20],[side*.84,-5.9,-4.44],[side*.84,5.70,-4.30],rackEnd];
      }else{
        // The secondary loop uses the inner pair of the rackmount CDU's four ports.
        const port=[side*.48,cdu.y,FRONT-5.95-.310];
        anchors=[port,[side*.48,cdu.y,-3.42],[side*.84,cdu.y+.35,-4.23],[side*.84,5.70,-4.30],rackEnd];
      }
      // Blue runs CDU -> rack; red runs rack -> CDU, regardless of camera angle.
      if(side>0)anchors.reverse();const path=smoothPath(anchors);
      pipeMesh(water,path,cdu.external?.083:Math.min(.083,cdu.height*.14),color,true);pipeMesh(shell,path,cdu.external?.115:Math.min(.115,cdu.height*.22),[.58,.69,.74]);
    }
    return {solid,water,shell,mode,connected:!!cdu,bounds:{min:[-2.49,-7.85,cdu?.external?-7.45:-4.62],max:[cdu?.external?9.50:2.30,7.83,cdu?.external?3.55:3.45]}};
  }
  const VERTEX=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;attribute vec2 aMaterial;uniform mat4 uViewProjection;uniform mat4 uModel;uniform mat4 uPart;varying vec3 vPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec3 vColor;varying vec2 vMaterial;void main(){mat4 m=uModel*uPart;vec4 p=m*vec4(aPosition,1.0);vPosition=p.xyz;vLocal=aPosition;vNormal=mat3(m)*aNormal;vColor=aColor;vMaterial=aMaterial;gl_Position=uViewProjection*p;}`;
  const FRAGMENT=`
    precision highp float;varying vec3 vPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec3 vColor;varying vec2 vMaterial;
    uniform vec3 uEye;uniform float uLight;uniform float uSelected;uniform float uAlpha;uniform float uTime;uniform float uLedTime;uniform float uPingTime;
    void main(){
      float alpha=uAlpha;
      vec3 n=normalize(vNormal),v=normalize(uEye-vPosition),r=reflect(-v,n),key=normalize(vec3(-.58,.88,.72)),fill=normalize(vec3(.74,.40,-.35));
      float metal=max(vMaterial.x,0.0),hemisphere=.22+.17*(n.y*.5+.5),diff=max(dot(n,key),0.0),brush=.992+.008*sin(vLocal.z*440.0+vLocal.x*17.0);
      vec3 c=vColor*(hemisphere+diff*.86+max(dot(n,fill),0.0)*.20)*brush;
      float overhead=pow(max(dot(r,normalize(vec3(-.46,.67,-.59))),0.0),18.0),side=pow(max(dot(r,normalize(vec3(-.83,.30,.42))),0.0),24.0),back=pow(max(dot(r,normalize(vec3(.72,.42,-.65))),0.0),22.0);
      float spec=pow(max(dot(n,normalize(key+v)),0.0),95.0),rim=pow(1.0-max(dot(n,v),0.0),4.0);
      c+=vec3(.88,.92,.94)*(overhead*.42+side*.30+spec*.38)*metal;
      vec3 ceiling=vPosition+r*((16.0-vPosition.y)/max(r.y,.08));float softbox=(1.0-smoothstep(4.0,7.0,abs(ceiling.x+7.0)))*(1.0-smoothstep(9.0,15.0,abs(ceiling.z+19.0)));
      c+=vec3(.83,.89,.92)*softbox*smoothstep(.10,.30,r.y)*metal*.15;c+=vec3(.35,.60,.69)*(back*.30+rim*.055)*metal;
      c+=vColor*uLight*.075;c=mix(c,vColor,clamp(vMaterial.y,0.0,1.0));c+=vec3(.015,.017,.019)*uSelected+vec3(.16,.25,.27)*rim*uSelected*.23;
      if(vMaterial.x<-.5){float grain=fract(sin(dot(floor(vLocal*380.0),vec3(127.1,311.7,74.7)))*43758.5453);c*=.965+grain*.070;}
      if(vMaterial.x<-4.5){
        // Green/red mean Rack Ping reachability, never measured power state.
        // A zero clock (reduced motion or hidden view) leaves a steady lamp.
        float pulse=pow(.5+.5*cos(uPingTime*6.2831853),2.0);
        float lens=clamp(vMaterial.y,0.0,1.0);
        c=vColor*(.20+pulse*.96)*(.36+lens*.64);
        // A small glass highlight remains optical rather than a second status
        // color; it follows the existing light direction as the rack rotates.
        c+=vec3(.48,.55,.59)*spec*.14;
      }else if(vMaterial.x<-2.5){
        // Decorative light travels up the physical rail, with a long soft tail
        // and a compact bright head. It is unrelated to the coolant shader.
        float phase=fract((vLocal.y+7.1)*.215-uLedTime*.45+vMaterial.y);
        float tail=smoothstep(.20,.91,phase)*(1.0-smoothstep(.94,1.0,phase));
        float head=smoothstep(.83,.93,phase)*(1.0-smoothstep(.94,1.0,phase));
        c=vColor*(.76+tail*.80+head*.90);
        if(vMaterial.x<-3.5){
          float outer=step(2.58,abs(vLocal.x)),rail=mix(2.43,2.73,outer),radius=mix(.105,.1365,outer);
          float glow=pow(max(0.0,1.0-abs(abs(vLocal.x)-rail)/radius),2.0);
          c=vColor*(1.0+head*.35);alpha*=glow*.62*(.50+tail*.50+head*.45);
        }
      }else if(vMaterial.x<-1.5){float band=pow(.5+.5*cos(vMaterial.y*4.5-uTime*2.4),8.0);c=vColor*(.40+.40*band)+vec3(.34,.40,.43)*band;}
      gl_FragColor=vec4(pow(max(c,vec3(0.0)),vec3(.84)),alpha);
    }`;
  function mount(canvas,options={}){
    const noop={supported:false,setComponents(){},setTopology(){},setNetworkVisible(){},setTheme(){},select(){},focusSelection(){},setView(){},resetOrbit(){},zoomBy(){},resize(){},getState(){return {supported:false};},destroy(){}};
    if(!canvas||typeof canvas.getContext!=='function')return noop;
    let gl,program,frameMesh,components=[],placement=inspectPlacement(options.components),frame=0,disposed=false,lost=false,ready=false;
    let yaw=-.25,pitch=.025,view='perspective',zoom=1,selected='',focus='',targetY=0,drag=null,light=options.theme==='light'||options.theme===true?1:0,inverseMvp=null,maxSize=4096;
    const shaders=[],attrib={},uniform={},onSelect=typeof options.onSelect==='function'?options.onSelect:()=>{};
    const fail=reason=>{canvas.dataset.rackState='fallback';canvas.dataset.rackError=String(reason||'WebGL unavailable');canvas.dispatchEvent(new CustomEvent('pa-rack-fallback',{bubbles:true,detail:{reason:String(reason||'WebGL unavailable')}}));};
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:false,powerPreference:'low-power'});}catch(error){fail(error.message);return noop;}if(!gl){fail();return noop;}
    function buffer(mesh){const b=gl.createBuffer(),data=new Float32Array(mesh.data);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return {buffer:b,count:data.length/11};}
    function compile(type,source){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('Rack shader compilation failed');return shader;}
    let cooling=null,coolingBuffers=[],network=null,networkBuffer=null,topology=options.topology||null,networkVisible=options.networkVisible!==false,flowEnabled=options.flowEnabled!==false,visible=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    function rebuildNetwork(){if(networkBuffer)gl.deleteBuffer(networkBuffer.buffer);network=createNetworkCabling(placement.valid,topology);networkBuffer=network.layout.count?buffer(network.mesh):null;}
    function rebuild(){coolingBuffers.forEach(p=>gl.deleteBuffer(p.buffer));cooling=createCooling(placement.valid);coolingBuffers=[buffer(cooling.solid),buffer(cooling.water),buffer(cooling.shell)];components.forEach(p=>gl.deleteBuffer(p.buffer));components=placement.valid.map(item=>{const part=item.external?createExternalCdu():createEquipment(item);addPingIndicator(part.mesh,item);return {...buffer(part.mesh),item,min:part.min,max:part.max};});rebuildNetwork();}
    function setup(){
      maxSize=Math.min(4096,Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))||4096);program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Rack shader linking failed');shaders.forEach(s=>gl.deleteShader(s));shaders.length=0;
      ['aPosition','aNormal','aColor','aMaterial'].forEach(n=>attrib[n]=gl.getAttribLocation(program,n));['uViewProjection','uModel','uPart','uEye','uLight','uSelected','uAlpha','uTime','uLedTime','uPingTime'].forEach(n=>uniform[n]=gl.getUniformLocation(program,n));
      frameMesh=buffer(createFrame());components=[];coolingBuffers=[];networkBuffer=null;rebuild();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);ready=false;
    }
    function release(){if(!lost){coolingBuffers.forEach(p=>gl.deleteBuffer(p.buffer));components.forEach(p=>gl.deleteBuffer(p.buffer));if(networkBuffer)gl.deleteBuffer(networkBuffer.buffer);if(frameMesh)gl.deleteBuffer(frameMesh.buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s));}components=[];coolingBuffers=[];networkBuffer=null;frameMesh=null;program=null;shaders.length=0;}
    try{setup();}catch(error){release();fail(error.message);return noop;}
    function sync(){canvas.dataset.rackYaw=yaw.toFixed(4);canvas.dataset.rackPitch=pitch.toFixed(4);canvas.dataset.rackDragging=String(!!drag);canvas.dataset.rackSelected=selected;canvas.dataset.rackCount=String(placement.count);canvas.dataset.rackOccupied=String(placement.occupiedU);canvas.dataset.rackInvalid=String(placement.invalid.length);canvas.dataset.rackView=view;canvas.dataset.rackZoom=zoom.toFixed(3);canvas.dataset.rackFocus=focus;canvas.dataset.rackModel='gb300-inspired';canvas.dataset.rackVertices=String(components.concat(coolingBuffers).reduce((sum,p)=>sum+p.count,(frameMesh?.count||0)+(networkBuffer?.count||0)));canvas.dataset.rackNetworkRoutes=String(network?.layout.count||0);canvas.dataset.rackNetworkVisible=String(networkVisible);}
    function requestDraw(){if(!disposed&&!lost&&program&&!frame)frame=requestAnimationFrame(draw);}
    function motionAllowed(){return !reduced.matches&&visible&&!document.hidden&&!disposed&&!lost;}
    function flowAnimated(){return flowEnabled&&cooling?.connected&&motionAllowed()&&!focus;}
    // The solid cabinet hides its front rails from the rear; avoid redrawing
    // an invisible effect when only the static rear assembly is in view.
    function decorativeAnimated(){return motionAllowed()&&Math.cos(yaw)>0&&components.some(p=>p.item.external&&(!focus||p.item.name===focus));}
    function indicatorAnimated(item){return motionAllowed()&&Math.cos(yaw)>0&&(!focus||item.name===focus)&&item.mgx_type!=='blanking'&&['up','down','partial'].includes(item.rack_ping_state);}
    function pingAnimated(){return components.some(part=>indicatorAnimated(part.item));}
    function draw(now=0){
      frame=0;if(disposed||lost||!program)return;const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const dpr=Math.min(window.devicePixelRatio||1,1.65,maxSize/Math.max(rect.width,rect.height)),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const focused=focus?components.find(p=>p.item.name===focus):null;
      const isolated=!!focused?.item.external;
      // A floor-standing CDU needs its own orbit pivot and inspection scene.
      // Otherwise the adjacent rack rotates across and completely hides it.
      const offset=isolated?focused.min.map((v,i)=>(v+focused.max[i])/2):[0,0,0];
      const centerX=focused?(focused.item.x||0)+offset[0]:(cooling.mode==='external'?3.50:0);
      const rotationMatrix=rotation(yaw,pitch),model=multiply(rotationMatrix,translation(-centerX,-targetY-offset[1],-offset[2])),aspect=w/h,eye=[0,0,34];
      // Fit the projected orbit envelope at every angle. Device inspection uses
      // the selected part's own bounds; selection near U48 is not clipped away.
      const showNetwork=!isolated&&networkVisible&&networkBuffer;
      const bounds=focused?{min:focused.min.map((v,i)=>v-offset[i]),max:focused.max.map((v,i)=>v-offset[i]+(i===2&&!isolated ? .22 : 0))}:{min:[Math.min(cooling.bounds.min[0],showNetwork?-2.78:Infinity)-centerX,cooling.bounds.min[1],cooling.bounds.min[2]],max:[Math.max(cooling.bounds.max[0],showNetwork?2.78:-Infinity)-centerX,cooling.bounds.max[1],Math.max(cooling.bounds.max[2],showNetwork?3.56:-Infinity)]};
      let maxX=0,maxY=0,required=0;const tan=Math.tan(.55/2),marginX=focused?.83:.92,marginY=focused?.78:.94;
      for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]]){const p=transform(rotationMatrix,[x,y,z,1]);maxX=Math.max(maxX,Math.abs(p[0]));maxY=Math.max(maxY,Math.abs(p[1]));required=Math.max(required,p[2]+Math.abs(p[0])/(tan*aspect*marginX),p[2]+Math.abs(p[1])/(tan*marginY));}
      const vertical=Math.max(maxY/marginY,maxX/(aspect*marginX),focused?1.10:0)/zoom,horizontal=vertical*aspect,isPlan=view==='front'||view==='rear';
      if(!isPlan)eye[2]=Math.max(5.1,required/zoom);const vp=multiply(isPlan?ortho(horizontal,vertical):perspective(.55,aspect),lookAt(eye));inverseMvp=inverse(multiply(vp,model));
      canvas.dataset.rackCameraDistance=eye[2].toFixed(3);
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.uniformMatrix4fv(uniform.uViewProjection,false,vp);gl.uniformMatrix4fv(uniform.uModel,false,model);gl.uniform3fv(uniform.uEye,new Float32Array(eye));gl.uniform1f(uniform.uLight,light);gl.uniform1f(uniform.uTime,flowAnimated()?now/1000:0);gl.uniform1f(uniform.uLedTime,decorativeAnimated()?now/1000:0);gl.uniform1f(uniform.uPingTime,pingAnimated()?now/1000:0);gl.uniform1f(uniform.uAlpha,1);
      function part(mesh,matrix,isSelected){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);let offset=0;[['aPosition',3],['aNormal',3],['aColor',3],['aMaterial',2]].forEach(([name,size])=>{gl.enableVertexAttribArray(attrib[name]);gl.vertexAttribPointer(attrib[name],size,gl.FLOAT,false,44,offset);offset+=size*4;});gl.uniformMatrix4fv(uniform.uPart,false,matrix);gl.uniform1f(uniform.uSelected,isSelected?1:0);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
      gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      if(!isolated)part(frameMesh,identity(),false);for(const p of isolated?[focused]:components)part(p,translation(p.item.x||0,p.item.y,p.item.name===selected&&p.item.mgx_type!=='cdu'?.22:0),p.item.name===selected);
      if(showNetwork)part(networkBuffer,identity(),false);
      if(!isolated){
        part(coolingBuffers[0],identity(),false);
        gl.uniform1f(uniform.uAlpha,.88);part(coolingBuffers[1],identity(),false);
        gl.depthMask(false);gl.uniform1f(uniform.uAlpha,.20);part(coolingBuffers[2],identity(),false);gl.depthMask(true);
      }
      gl.disable(gl.BLEND);
      canvas.dataset.coolingMode=cooling.mode;canvas.dataset.flowAnimated=String(flowAnimated());canvas.dataset.decorativeAnimated=String(decorativeAnimated());canvas.dataset.pingAnimated=String(pingAnimated());if(flowAnimated()||decorativeAnimated()||pingAnimated())requestDraw();
      if(!ready){const error=gl.getError();if(error!==gl.NO_ERROR){fail('Rack WebGL render error '+error);return;}ready=true;canvas.dataset.rackState='ready';delete canvas.dataset.rackError;canvas.dispatchEvent(new CustomEvent('pa-rack-ready',{bubbles:true}));}
    }
    function orbit(y,p){yaw=((y+Math.PI)%TAU+TAU)%TAU-Math.PI;pitch=clamp(p,-1.15,1.15);view='custom';sync();requestDraw();}
    function pick(x,y){
      if(!inverseMvp)return null;const rect=canvas.getBoundingClientRect(),nx=(x-rect.left)/rect.width*2-1,ny=1-(y-rect.top)/rect.height*2;
      const points=[-1,1].map(z=>{const p=transform(inverseMvp,[nx,ny,z,1]);return p.slice(0,3).map(v=>v/p[3]);}),origin=points[0],dir=points[1].map((v,i)=>v-origin[i]);let nearest=Infinity,hit=null;
      const isolated=components.find(p=>p.item.name===focus&&p.item.external);
      for(const p of isolated?[isolated]:components){const pull=p.item.name===selected&&p.item.mgx_type!=='cdu'?.22:0,min=[p.min[0]+(p.item.x||0),p.min[1]+p.item.y,p.min[2]+pull],max=[p.max[0]+(p.item.x||0),p.max[1]+p.item.y,p.max[2]+pull];let enter=0,exit=1;for(let axis=0;axis<3;axis++){if(Math.abs(dir[axis])<1e-9){if(origin[axis]<min[axis]||origin[axis]>max[axis]){exit=-1;break;}}else{const t1=(min[axis]-origin[axis])/dir[axis],t2=(max[axis]-origin[axis])/dir[axis];enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));}}if(enter<=exit&&enter<nearest){nearest=enter;hit=p.item.name;}}
      return hit;
    }
    function select(name){const next=String(name??'');selected=placement.valid.some(p=>p.name===next)?next:'';if(focus){const item=placement.valid.find(p=>p.name===selected);focus=item?.name||'';targetY=item?.y||0;}sync();requestDraw();}
    function focusSelection(){const item=placement.valid.find(p=>p.name===selected);if(!item)return;focus=item.name;targetY=item.y;zoom=1;view='inspect';sync();requestDraw();}
    function setView(next){focus='';targetY=0;zoom=1;if(next==='front'){yaw=0;pitch=0;}else if(next==='rear'){yaw=Math.PI;pitch=0;}else{next='perspective';yaw=-.25;pitch=.025;}view=next;sync();requestDraw();}
    function resetOrbit(){zoom=1;setView('perspective');}
    function onDown(event){if(event.button!==0||event.isPrimary===false||!ready)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch,moved:false};try{canvas.setPointerCapture(event.pointerId);}catch{}canvas.focus({preventScroll:true});sync();}
    function onMove(event){if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>4)drag.moved=true;if(drag.moved)orbit(drag.yaw+dx*.008,drag.pitch+dy*.006);}
    function finish(event,cancel=false){if(!drag||event.pointerId!==drag.id)return;const click=!cancel&&!drag.moved;drag=null;try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch{}sync();if(click){const hit=pick(event.clientX,event.clientY);if(hit){select(hit);onSelect(hit);}}}
    const onUp=event=>finish(event),onCancel=event=>finish(event,true);
    function onKey(event){const step=event.shiftKey?.25:.12;if(event.key==='ArrowLeft')orbit(yaw-step,pitch);else if(event.key==='ArrowRight')orbit(yaw+step,pitch);else if(event.key==='ArrowUp')orbit(yaw,pitch-step);else if(event.key==='ArrowDown')orbit(yaw,pitch+step);else if(event.key==='Home')resetOrbit();else if(event.key==='+'||event.key==='=')api.zoomBy(1.12);else if(event.key==='-')api.zoomBy(1/1.12);else return;event.preventDefault();}
    function onLost(event){event.preventDefault();lost=true;ready=false;drag=null;if(frame)cancelAnimationFrame(frame);frame=0;sync();fail('WebGL context was lost');}
    function onRestored(){lost=false;try{setup();requestDraw();}catch(error){release();fail(error.message);}}
    const oldTouchAction=canvas.style.touchAction;canvas.style.touchAction='none';const listeners=[['pointerdown',onDown],['pointermove',onMove],['pointerup',onUp],['pointercancel',onCancel],['lostpointercapture',onCancel],['keydown',onKey],['webglcontextlost',onLost],['webglcontextrestored',onRestored]];listeners.forEach(([name,fn])=>canvas.addEventListener(name,fn));
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(requestDraw):null;if(ro)ro.observe(canvas);else window.addEventListener('resize',requestDraw,{passive:true});
    const onVisibility=()=>requestDraw();document.addEventListener('visibilitychange',onVisibility);reduced.addEventListener('change',onVisibility);
    const visibilityObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;requestDraw();}):null;visibilityObserver?.observe(canvas);
    const api={supported:true,
      setFlowEnabled(value){flowEnabled=!!value;requestDraw();},
      setNetworkVisible(value){if(disposed)return;networkVisible=!!value;sync();requestDraw();},
      setTopology(document){if(disposed)return;topology=document||null;if(!lost)rebuildNetwork();else network={layout:planNetworkCabling(placement.valid,topology)};sync();requestDraw();},
      setComponents(items){if(disposed)return;placement=inspectPlacement(items);if(!placement.valid.some(p=>p.name===selected))selected='';if(focus){const item=placement.valid.find(p=>p.name===focus);focus=item?.name||'';targetY=item?.y||0;}if(!lost)rebuild();else network={layout:planNetworkCabling(placement.valid,topology)};sync();requestDraw();},
      setTheme(value){const next=value==='light'||value===true?1:0;if(light!==next){light=next;requestDraw();}},select,focusSelection,setView,resetOrbit,
      zoomBy(factor){const f=Number(factor);if(!Number.isFinite(f)||f<=0)return;zoom=clamp(zoom*f,.75,2.10);sync();requestDraw();},
      resize:requestDraw,
      getState(){return {supported:true,ready,disposed,contextLost:lost,yaw,pitch,view,zoom,selected,focus,targetY,theme:light?'light':'dark',dragging:!!drag,count:placement.count,occupiedU:placement.occupiedU,invalid:placement.invalid.map(p=>({...p})),unplaced:[...placement.unplaced],placements:placement.valid.map(p=>({name:p.name,type:p.mgx_type,top:p.top,bottom:p.bottom,size:p.size,external:!!p.external})),cooling:{mode:cooling.mode,flowEnabled,animated:flowAnimated()},decorativeLighting:{present:components.some(p=>p.item.external),animated:decorativeAnimated(),style:'tc1288-blue-flow'},networkCabling:{...JSON.parse(JSON.stringify(network.layout)),visible:networkVisible},pingIndicators:placement.valid.map(item=>{const indicator=pingIndicator(item);return indicator?{...indicator,animated:indicatorAnimated(item)}:null;}).filter(Boolean),geometryBuffers:components.length+coolingBuffers.length+(frameMesh?1:0)+(networkBuffer?1:0),vertices:components.concat(coolingBuffers).reduce((sum,p)=>sum+p.count,(frameMesh?.count||0)+(networkBuffer?.count||0)),model:'gb300-inspired'};},
      destroy(){if(disposed)return;disposed=true;visibilityObserver?.disconnect();document.removeEventListener('visibilitychange',onVisibility);reduced.removeEventListener('change',onVisibility);if(frame)cancelAnimationFrame(frame);frame=0;drag=null;ro?.disconnect();window.removeEventListener('resize',requestDraw);listeners.forEach(([name,fn])=>canvas.removeEventListener(name,fn));canvas.style.touchAction=oldTouchAction;release();canvas.dataset.rackState='disposed';canvas.dataset.flowAnimated='false';canvas.dataset.decorativeAnimated='false';canvas.dataset.pingAnimated='false';delete canvas.paRackScene;}
    };canvas.paRackScene=api;sync();requestDraw();return api;
  }
  // Homepage asset: original engineering interpretation of public DGX GB rack
  // exterior references, not a vendor port map, CAD file, or cooling topology.
  // Operational inventory geometry above deliberately retains its own behavior.
  const E={skin:[.235,.265,.285],lid:[.31,.34,.36],fold:[.15,.18,.20],frame:[.082,.105,.12],edge:[.48,.525,.55],port:[.68,.71,.73],portInner:[.31,.34,.35],polymer:[.033,.047,.055],jacket:[.070,.091,.102],rear:[.255,.29,.31],seam:[.012,.021,.026]};
  function editorialPerforation(m,x,y,z,w,h,color=C.gold,front=1,pitch=.028,backing=true){
    // Punched sheet, with real-depth grille bars over a recessed dark plenum.
    // At inspection distance the aperture edges catch a different highlight
    // from the sheet; no emissive pixels or photographic texture is involved.
    const cols=Math.max(2,Math.round(w/pitch)),rows=Math.max(2,Math.round(h/pitch)),dx=w/cols,dy=h/rows;
    if(backing)m.box(x,y,z-front*.010,w,h,.010,E.seam,.06);
    for(let c=0;c<=cols;c++)m.box(x-w/2+c*dx,y,z,dx*.23,h,.010,color,.76);
    for(let r=0;r<=rows;r++)m.box(x,y-h/2+r*dy,z+front*.001,w,dy*.24,.010,color,.76);
  }
  function editorialCage(m,x,y,z,w=.224,h=.067,front=1){
    // Nickel-plated connector cage, independent of the bronze carrier plate.
    // Separate folded walls, spring tabs and an internal tongue preserve a
    // silver port surround and a genuinely recessed dark connector mouth.
    const B=m.box,t=.007,Z=d=>z+front*d;
    B(x,y,Z(-.006),w+.020,h+.014,.012,E.portInner,.79);
    B(x,y,Z(.001),w-.010,h-.006,.009,E.seam,.06);
    for(const s of [-1,1]){
      B(x+s*(w/2-t/2),y,Z(.018),t,h,.039,E.port,.90);
      B(x,y+s*(h/2-t/2),Z(.019),w,t,.041,E.port,.90);
      B(x+s*(w*.42),y,Z(.035),.010,h*.39,.009,E.portInner,.82);
    }
    B(x,y-h*.24,Z(.025),w*.74,.007,.021,E.portInner,.70);
    for(let i=0;i<8;i++)B(x-w*.32+i*w*.091,y-h*.22,Z(.037),.003,.011,.005,[.40,.34,.20],.80);
    for(let i=0;i<4;i++)B(x-w*.31+i*w*.207,y+h*.43,Z(.043),w*.088,.005,.004,E.portInner,.67);
    B(x,y-h*.46,Z(.044),w*.42,.006,.011,E.port,.88);
  }
  function editorialRJ45(m,x,y,z,w=.097,h=.081,front=1,inverted=false){
    // 8P8C stepped throat: silver shield, keyed polymer insert, eight sprung
    // contacts, latch recess and paired tiny light pipes. Not a QSFP rectangle.
    const B=m.box,Z=d=>z+front*d,flip=inverted?-1:1,t=.006;
    B(x,y,Z(-.005),w+.012,h+.010,.012,E.portInner,.79);
    B(x,y,Z(.004),w-.007,h-.007,.012,E.seam,.04);
    for(const s of [-1,1]){B(x+s*(w/2-t/2),y,Z(.023),t,h,.039,E.port,.88);B(x,y+s*(h/2-t/2),Z(.024),w,t,.042,E.port,.88);}
    const keyY=y-flip*h*.29;
    for(const s of [-1,1])B(x+s*w*.29,keyY,Z(.033),w*.22,h*.26,.020,E.polymer,.16);
    B(x,y+flip*h*.20,Z(.025),w*.76,h*.10,.014,E.polymer,.16);
    for(let i=0;i<8;i++)B(x-w*.285+i*w*.0815,y+flip*h*.17,Z(.038),w*.032,h*.17,.007,[.41,.36,.22],.83);
    B(x,y-flip*h*.40,Z(.040),w*.33,h*.11,.010,E.portInner,.75);
    for(const s of [-1,1])B(x+s*w*.37,y+flip*h*.37,Z(.047),w*.13,h*.09,.004,s<0?[.20,.31,.17]:[.34,.29,.17],.22);
  }
  function editorialSweep(mesh,control,r,color,metal=.12,steps=20,sides=8){
    // A continuous cubic sweep with parallel-transported section normals. No
    // per-segment cylinder caps, faceted elbow joints, or runtime allocations.
    const normalize=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],rings=[];
    let previous=null;
    for(let i=0;i<=steps;i++){
      const t=i/steps,q=1-t,p=[0,1,2].map(k=>q*q*q*control[0][k]+3*q*q*t*control[1][k]+3*q*t*t*control[2][k]+t*t*t*control[3][k]);
      const tangent=normalize([0,1,2].map(k=>3*q*q*(control[1][k]-control[0][k])+6*q*t*(control[2][k]-control[1][k])+3*t*t*(control[3][k]-control[2][k])));
      let u=previous?previous.map((v,k)=>v-tangent[k]*previous.reduce((s,x,j)=>s+x*tangent[j],0)):cross(tangent,Math.abs(tangent[1])<.9?[0,1,0]:[1,0,0]);
      u=normalize(u);previous=u;const v=cross(tangent,u);
      rings.push(Array.from({length:sides},(_,j)=>{const a=j/sides*TAU,n=u.map((x,k)=>x*Math.cos(a)+v[k]*Math.sin(a));return {p:p.map((x,k)=>x+r*n[k]),n};}));
    }
    const emit=v=>mesh.data.push(...v.p,...v.n,...color,metal,0);
    for(let i=1;i<rings.length;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides,a=rings[i-1][j],b=rings[i-1][k],c=rings[i][k],d=rings[i][j];[a,b,c,a,c,d].forEach(emit);}
  }
  function editorialPullOpening(mesh,x,y,z,width,depth,band,thickness){
    // A real extruded obround annulus in the horizontal x/z plane. Light can
    // pass through its opening; neither the opening nor its wall is a decal.
    const points=[],radius=depth/2,halfStraight=width/2-radius,innerRadius=radius-band;
    for(const side of [-1,1])for(let i=0;i<=20;i++){const a=(side<0?Math.PI/2:-Math.PI/2)+i/20*Math.PI;points.push({a,center:x+side*halfStraight});}
    const p=(q,r,h)=>[q.center+Math.cos(q.a)*r,y+h,z+Math.sin(q.a)*r],emit=(point,normal)=>mesh.data.push(...point,...normal,...C.goldEdge,.86,0);
    const quad=(a,b,c,d,n)=>[a,b,c,a,c,d].forEach(v=>emit(v,n));
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],top=thickness/2,bottom=-top,mid=(a.a+b.a)/2,n=[Math.cos(mid),0,Math.sin(mid)];
      quad(p(a,radius,top),p(b,radius,top),p(b,innerRadius,top),p(a,innerRadius,top),[0,1,0]);
      quad(p(a,innerRadius,bottom),p(b,innerRadius,bottom),p(b,radius,bottom),p(a,radius,bottom),[0,-1,0]);
      const edgeNormal=a.center!==b.center?[0,0,p(a,radius,0)[2]>z?1:-1]:n;
      quad(p(a,radius,bottom),p(b,radius,bottom),p(b,radius,top),p(a,radius,top),edgeNormal);
      quad(p(a,innerRadius,top),p(b,innerRadius,top),p(b,innerRadius,bottom),p(a,innerRadius,bottom),edgeNormal.map(v=>-v));
    }
  }
  function editorialComputeFront(m,h){
    const B=m.box,V=m.bevel,T=m.tube,z=FRONT+.089;
    V(0,0,z-.018,3.90,h-.014,.097,C.gold,.019,.85);
    B(0,h/2-.014,z+.036,3.67,.013,.020,C.goldEdge,.88);
    for(const [x,w] of [[-1.275,1.07],[1.235,1.005]])editorialPerforation(m,x,.006,z+.036,w,h-.064,C.gold);
    // Fine mesh is interrupted by genuinely recessed service cages, carriers,
    // ejectors and seams. No branding or exact proprietary port names.
    V(-.047,0,z+.042,1.14,h-.049,.035,C.darkGold,.008,.70);
    for(let i=0;i<8;i++){
      const x=-.535+i*.139;
      V(x,0,z+.065,.118,h-.055,.040,C.goldEdge,.006,.87);B(x,0,z+.089,.080,h-.097,.012,C.gold,.80);
      B(x+.044,0,z+.094,.010,h-.071,.009,E.seam,.10);B(x,-h*.28,z+.104,.064,.021,.023,C.goldEdge,.80);B(x,h*.27,z+.102,.072,.008,.008,C.darkGold,.65);
      B(x-.021,-.007,z+.099,.008,.035,.007,E.polymer,.13);B(x-.020,.003,z+.103,.004,.007,.003,[.15,.23,.10],.2);
      // Paired carrier sections sit within four removable storage cages.
      if(i%2===0)B(x-.067,0,z+.096,.009,h-.040,.019,C.darkGold,.67);
    }
    // Supplied reference orientation: left lower dual cage with RJ45 to its
    // right; upper-right DPU is reversed (RJ45 to its left); lower-right pair.
    // The photo does not establish a BF3/BF4 SKU; no speculative label is added.
    for(const [x,y,w,ph] of [[-1.52,-.054,.244,.068],[-1.13,-.054,.244,.068],[.995,-.058,.244,.068],[1.37,-.058,.244,.068],[1.235,.064,.187,.046],[1.466,.064,.187,.046]])editorialCage(m,x,y,z+.054,w,ph);
    editorialRJ45(m,-.778,-.048,z+.052,.101,.078);
    editorialRJ45(m,.960,.062,z+.052,.099,.075,1,true);
    // Silver central management stack, distinct from adjacent storage latches.
    V(.635,0,z+.047,.149,h-.043,.016,C.gold,.006,.77);
    for(const y of [-.051,.042])editorialRJ45(m,.623,y,z+.054,.092,.071);
    for(const y of [-.061,-.013,.049]){B(.737,y,z+.070,.027,.021,.014,E.port,.82);B(.737,y,z+.081,.018,.012,.010,E.seam,.06);}
    m.statusLens(.742,.092,z+.082,.005,.010,[.10,.26,.17],E.fold,false);
    for(const x of [-1.723,-.862,.854,1.606]){B(x,-.099,z+.062,.039,.007,.005,C.darkGold,.43);m.disc(x,-.087,z+.071,.005,E.portInner,.8,8);}
    // Broad front outriggers sit below the service apertures, as load-bearing
    // folded pull handles. Their two long negative spaces remain truly open.
    const handleY=-h/2+.023,handleZ=FRONT+.169;
    for(const x of [-.91,.91])editorialPullOpening(m,x,handleY,handleZ,1.66,.208,.043,.026);
    for(const x of [-1.80,0,1.80])V(x,handleY,handleZ,x===0?.19:.145,.027,.208,C.goldEdge,.010,.85);
    for(const side of [-1,1]){
      V(side*1.875,0,z+.045,.156,h-.006,.177,C.gold,.043,.83);
      T([side*1.858,-h/2+.021,z+.104],[side*1.858,h/2-.021,z+.104],.051,C.goldEdge,24,.87);
      B(side*1.958,0,z+.088,.021,h-.049,.032,E.edge,.84);
      for(const sy of [-1,1])screw(m,side*1.962,sy*(h/2-.048),z+.117);
    }
  }
  function editorialNvlinkFront(m,h){
    const B=m.box,V=m.bevel,z=FRONT+.09;
    // GB rack switch reference: ventilated upper sheet, compact service strip
    // at lower left, and a quiet broad lower panel. Its fabric mates at rear;
    // the front must not look like another bank of compute NICs or drives.
    V(0,0,z-.021,3.90,h-.014,.094,C.gold,.016,.83);
    editorialPerforation(m,0,.055,z+.034,3.42,.091,C.gold,1,.024);
    B(0,h/2-.014,z+.044,3.65,.012,.023,C.goldEdge,.88);
    B(-1.631,-.047,z+.049,.105,.046,.022,E.port,.84);B(-1.631,-.047,z+.065,.087,.025,.015,E.seam,.08);B(-1.631,-.048,z+.073,.070,.005,.016,E.portInner,.67);
    for(let i=0;i<5;i++)editorialRJ45(m,-1.413+i*.187,-.046,z+.040,.095,.073);
    for(let i=0;i<4;i++){const x=.715+i*.132;m.statusLens(x,-.045,z+.057,.0045,.009,[.13,.30,.14],C.darkGold,false);B(x,-.081,z+.048,.036,.004,.004,C.darkGold,.35);}
    for(const x of [-1.76,-.425,1.52])screw(m,x,-.072,z+.056);
    for(const side of [-1,1]){
      V(side*1.868,0,z+.033,.171,h-.014,.145,C.gold,.029,.84);
      m.tube([side*1.854,-h/2+.018,z+.09],[side*1.854,h/2-.018,z+.09],.043,C.goldEdge,20,.88);
      B(side*1.945,0,z+.075,.014,h-.051,.034,E.edge,.83);
      screw(m,side*1.967,0,z+.093);
    }
    for(const x of [-.91,.91])editorialPullOpening(m,x,-h/2+.022,FRONT+.168,1.66,.204,.037,.023);
    for(const x of [-1.80,0,1.80])V(x,-h/2+.021,FRONT+.167,x===0?.15:.12,.023,.204,C.goldEdge,.008,.85);
  }
  function editorialPowerFront(m,h){
    const B=m.box,V=m.bevel,z=FRONT+.085;
    V(0,0,z-.026,3.91,h-.012,.115,E.frame,.012,-.7);
    V(-1.782,0,z+.036,.184,h-.034,.060,E.polymer,.006,-.7);
    editorialRJ45(m,-1.785,.010,z+.064,.090,.092);
    B(-1.785,.097,z+.074,.112,.015,.087,E.fold,.64);
    m.statusLens(-1.785,-.080,z+.075,.006,.010,[.28,.13,.08],E.fold,false);
    for(let i=0;i<6;i++){
      const x=-1.400+i*.582,moduleW=.560,fh=h-.036;
      V(x,0,z+.025,moduleW,h-.020,.075,E.frame,.010,-.7);
      B(x-.018,0,z+.070,.440,fh,.012,E.seam,.07);
      // Fan blades stay behind the punched guard, with a turned hub and a
      // circular inlet shadow visible through the rectangular grille apertures.
      fan(m,x-.015,0,z+.077,.098);
      editorialPerforation(m,x-.015,0,z+.121,.435,fh-.012,[.16,.185,.20],1,.027,false);
      V(x+.240,0,z+.100,.057,h-.020,.091,E.polymer,.007,-.7);
      B(x+.243,0,z+.150,.011,h*.65,.014,E.fold,.75);
      B(x+.240,-h*.32,z+.150,.039,.018,.022,E.edge,.79);
      for(const sy of [-1,1])B(x-.202,sy*.045,z+.139,.015,.014,.010,sy>0?[.22,.32,.17]:[.14,.22,.12],.23);
      B(x-.202,-.088,z+.140,.016,.006,.004,E.edge,.40);
      for(const sy of [-1,1])m.disc(x+.239,sy*.086,z+.154,.006,E.edge,.72,8);
    }
    for(const side of [-1,1]){B(side*1.981,0,z+.007,.125,h-.020,.092,E.frame,-.7);screw(m,side*2.003,0,z+.060);}
  }
  function editorialNetworkFront(m,h){
    const B=m.box,V=m.bevel,z=FRONT+.085;
    // The GB rack's management TOR has three blocks of 16 copper ports and a
    // four-cage uplink block. The operational inventory's SN2700 mesh is intact.
    V(0,0,z-.024,3.90,h-.013,.105,C.gold,.013,.80);
    editorialPerforation(m,-.090,.102,z+.035,3.51,.029,C.gold,1,.030);
    for(let bank=0;bank<3;bank++){
      const center=-1.233+bank*.980;
      V(center,-.005,z+.038,.951,.178,.020,E.portInner,.004,.80);
      for(let col=0;col<8;col++)for(const row of [-1,1])editorialRJ45(m,center-.412+col*.118,-.005+row*.045,z+.054,.108,.071,1,row<0);
    }
    V(1.425,-.005,z+.039,.332,.179,.022,E.portInner,.006,.80);
    for(const x of [1.341,1.509])for(const y of [-.051,.041])editorialCage(m,x,y,z+.052,.152,.067);
    for(const y of [-.054,-.013,.029,.070])m.statusLens(1.644,y,z+.054,.004,.008,[.17,.29,.11],C.darkGold,false);
    for(const y of [-.055,.048])editorialRJ45(m,1.776,y,z+.049,.099,.077);
    for(const side of [-1,1]){V(side*1.948,0,z+.010,.088,h-.020,.095,C.gold,.008,.78);B(side*1.876,0,z+.031,.023,h-.035,.074,E.polymer,.25);screw(m,side*2.004,0,z+.055);}
  }
  function createEditorialEquipment(item){
    const base=createEquipment(item),m=meshBuilder(),B=m.box,V=m.bevel,T=m.tube,h=item.height,type=item.mgx_type;
    const depth=type==='blanking'?(item.size>1?5.94:.18):({server:5.85,nvlink:5.95,switch:4.55,powershelf:4.95}[type]||base.depth),rear=FRONT-depth;
    // Homepage facades are independently authored from the inspected photos;
    // never modify the operational inventory renderer or its port topology.
    if(!['server','nvlink','powershelf','switch'].includes(type))for(let i=0;i<base.mesh.data.length;i+=33)if(base.mesh.data[i+2]>FRONT+.041&&base.mesh.data[i+13]>FRONT+.041&&base.mesh.data[i+24]>FRONT+.041)for(let j=0;j<33;j++)m.data.push(base.mesh.data[i+j]);
    if(type==='server'){
      V(0,0,FRONT-depth/2,3.94,h,depth,E.skin,.019,.82);
      for(const side of [-1,1]){V(side*2.002,0,FRONT+.016,.126,h+.008,.105,E.rear,.014,.84);for(const sy of [-1,1])screw(m,side*2.004,sy*h*.35,FRONT+.073);}
    }else chassis(m,h,depth,type==='blanking'?E.fold:E.skin);
    V(0,0,FRONT+.045,3.93,h-.009,.08,type==='server'||type==='nvlink'?C.gold:E.frame,.014,.78);
    if(type==='server')editorialComputeFront(m,h);
    if(type==='nvlink')editorialNvlinkFront(m,h);
    if(type==='powershelf')editorialPowerFront(m,h);
    if(type==='switch')editorialNetworkFront(m,h);
    if(depth>.5){
      // Folded lids, rolled edges, recessed long panels and supported drawer
      // slides make the enclosure legible from side, top and middle close-ups.
      for(const side of [-1,1]){
        B(side*1.985,0,FRONT-depth/2,.018,Math.max(.065,h-.08),depth-.15,E.fold,.72);
        B(side*1.998,-h*.28,FRONT-depth/2,.022,.024,depth-.13,E.edge,.85);
        B(side*1.999,h*.27,FRONT-depth/2,.012,.011,depth-.18,E.seam,.16);
        for(let i=0;i<5;i++){const z=FRONT-.40-i*(depth-.75)/4;B(side*2.005,0,z,.013,Math.min(.105,h*.43),.030,E.rear,.75);T([side*1.992,h*.12,z],[side*2.013,h*.12,z],.012,E.edge,8,.75);}
        // The folded chassis edge slides on the separate fixed rack support.
        // U40's authored nested rail members are drawn by the story renderer.
      }
      if(type!=='server'){
        const lidY=h/2+.007;
        for(const z of [FRONT-.32,rear+.28])B(0,lidY,z,3.68,.004,.009,E.fold,.65);
        // Plain folded silver lids and small captive fasteners, not ornamental
        // raised ribs. Power cartridge seams follow the six actual front bays.
        const seams=type==='powershelf'?[-1.68,-1.098,-.516,.066,.648,1.23,1.792]:[-1.91,1.91];
        for(const x of seams)B(x,lidY,FRONT-depth/2,.007,.003,depth-.26,E.fold,.56);
        for(const x of [-1.75,1.75])for(let i=0;i<5;i++){
          const z=FRONT-.18-i*(depth-.38)/4;
          T([x,lidY-.003,z],[x,lidY+.003,z],.009,E.edge,10,.81);B(x,lidY+.004,z,.010,.002,.003,E.fold,.51);
        }
        if(type==='nvlink')for(const z of [FRONT-.52,FRONT-.80])for(const x of [-1.45,-.73,0,.73,1.45]){T([x,lidY-.003,z],[x,lidY+.003,z],.008,E.edge,8,.80);B(x,lidY+.004,z,.010,.002,.003,E.fold,.51);}
        if(type==='switch'||type==='powershelf')for(const side of [-1,1])for(let i=0;i<15;i++)B(side*2.003,0,rear+.34+i*.068,.009,h*.39,.023,E.seam,.12);
      }else{
        V(0,h/2+.001,FRONT-depth/2-.015,3.885,.010,depth-.068,[.555,.578,.59],.004,.81);
        const lidY=h/2+.007;
        for(const side of [-1,1]){
          for(let i=0;i<7;i++){const z=rear+.22+i*(depth-.52)/6;T([side*1.804,lidY-.003,z],[side*1.804,lidY+.003,z],.010,E.edge,10,.79);B(side*1.804,lidY+.004,z,.012,.002,.003,E.fold,.55);}
          const latchX=side*1.615,latchZ=rear+depth*.46;
          for(const s of [-1,1]){V(latchX+s*.093,lidY+.001,latchZ,.033,.009,.245,E.fold,.009,.62);V(latchX,lidY+.001,latchZ+s*.111,.155,.009,.023,E.fold,.007,.62);}
          B(latchX,lidY+.001,latchZ,.153,.002,.194,E.polymer,.15);V(latchX,lidY+.003,latchZ-.026,.061,.003,.057,E.edge,.010,.73);B(latchX,lidY+.005,latchZ-.026,.007,.001,.030,E.fold,.35);
        }
        // A denser fastening pattern only near the service end leaves a calm,
        // subtly brushed center panel, matching the reference's engineering.
        for(let row=0;row<3;row++)for(let col=0;col<9;col++){
          if(row===2&&col%2)continue;const x=-1.58+col*.395,z=FRONT-.19-row*.23;
          T([x,lidY-.003,z],[x,lidY+.003,z],.010,E.edge,10,.81);B(x,lidY+.004,z,.012,.002,.003,E.fold,.53);
        }
      }
      // Rear folded perimeter encloses the full depth; every service region is
      // recessed into this bounded tray rather than hovering behind a face.
      V(0,0,rear-.014,3.88,h-.012,.067,E.rear,.012,.79);
      B(0,h/2-.016,rear-.055,3.72,.019,.025,E.edge,.8);B(0,-h/2+.021,rear-.057,3.74,.018,.029,E.fold,.78);
      for(const side of [-1,1]){B(side*1.892,0,rear-.069,.045,h-.028,.054,E.fold,.75);screw(m,side*1.887,0,rear-.105,-1);}
    }
    if(type==='server'||type==='nvlink'){
      const count=type==='server'?4:8,pitch=type==='server'?.54:.31,start=type==='server'?-1.08:-1.085;
      for(let i=0;i<count;i++){
        const x=type==='server'?(i<2?start+i*pitch:.54+(i-2)*pitch):start+i*pitch,w=type==='server'?.40:.258;
        V(x,0,rear-.072,w,.193,.067,E.edge,.009,.82);
        V(x,-.026,rear-.119,w-.024,.108,.051,E.polymer,.005,.17);
        B(x,-.021,rear-.149,w-.057,.046,.013,E.seam,.05);
        for(const sy of [-1,1])B(x,-.021+sy*.034,rear-.156,w-.070,.009,.019,E.fold,.73);
        // The official rear photograph shows four broad black blind-mate
        // blocks with paired guides above, not exposed copper Ethernet cages.
        for(const s of [-1,1]){
          const px=x+s*w*.29;
          T([px,.064,rear-.108],[px,.064,rear-.144],.036,E.polymer,14,.20);
          T([px,.064,rear-.145],[px,.064,rear-.151],.025,E.portInner,14,.73);
          T([px,.064,rear-.151],[px,.064,rear-.153],.014,E.seam,12,.08);
        }
        for(let p=0;p<12;p++)B(x-w*.32+p*w*.0582,-.031,rear-.158,.003,.011,.004,[.33,.28,.18],.72);
        for(const s of [-1,1])B(x+s*(w/2-.020),-.011,rear-.151,.011,.058,.011,E.port,.83);
      }
      for(const side of [-1,1]){
        V(side*1.69,0,rear-.062,.191,.224,.044,E.edge,.008,.81);
        fluidPort(m,side*1.69,0,rear-.046,.050,-1);
        T([side*1.69,0,rear-.150],[side*1.69,0,rear-.179],.064,E.port,18,.86);
        for(const sy of [-1,1])screw(m,side*1.753,sy*.078,rear-.093,-1);
        B(side*1.841,0,rear-.091,.053,.122,.067,E.fold,.72);
      }
      V(.122,0,rear-.077,.347,.222,.070,E.edge,.009,.82);
      V(.155,0,rear-.132,.233,.187,.066,E.polymer,.007,.16);
      B(.180,-.008,rear-.171,.115,.100,.018,E.seam,.05);
      for(const x of [.127,.227])B(x,-.011,rear-.184,.013,.070,.011,E.fold,.77);
    }else if(type==='powershelf'){
      for(let i=0;i<6;i++){
        const x=-1.405+i*.582;
        V(x,0,rear-.068,.552,h-.038,.097,E.rear,.009,.79);
        V(x+.057,0,rear-.121,.205,.147,.073,E.polymer,.009,.18);
        B(x+.057,0,rear-.163,.145,.104,.020,E.seam,.05);
        for(const sy of [-1,1])B(x+.057,sy*.065,rear-.174,.151,.009,.016,E.portInner,.79);
        for(const [dx,dy] of [[-.037,-.018],[.037,-.018],[0,.029]])B(x+.057+dx,dy,rear-.178,.008,.039,.012,E.port,.82);
        editorialPerforation(m,x-.172,0,rear-.127,.108,h-.075,E.rear,-1,.027);
        B(x+.249,0,rear-.135,.013,h-.071,.029,E.port,.81);
        B(x+.215,-.078,rear-.163,.038,.013,.022,E.polymer,.28);
      }
      for(const y of [-.051,.047])editorialRJ45(m,-1.782,y,rear-.095,.091,.073,-1);
    }else if(type==='switch'){
      // Replaceable rear fan cassettes and two power bays are distinct from
      // the dense silver network connectors on the cold-aisle service face.
      for(let i=0;i<4;i++){
        const x=-.448+i*.412;
        V(x,0,rear-.074,.389,h-.039,.104,E.fold,.010,.74);
        editorialPerforation(m,x-.010,0,rear-.136,.282,h-.073,E.rear,-1,.025);
        B(x+.153,0,rear-.162,.021,h-.083,.045,E.polymer,.20);B(x+.153,0,rear-.188,.009,h*.45,.008,E.edge,.8);
      }
      for(const x of [-1.396,1.456]){
        V(x,0,rear-.074,.691,h-.035,.106,E.rear,.010,.78);
        editorialPerforation(m,x-.137,0,rear-.136,.239,h-.077,E.rear,-1,.026);
        V(x+.126,0,rear-.133,.167,.145,.046,E.polymer,.007,.15);B(x+.126,0,rear-.162,.120,.102,.018,E.seam,.05);
        for(const dx of [-.031,.031])B(x+.126+dx,-.007,rear-.178,.008,.037,.011,E.port,.82);
        B(x+.126,.033,rear-.178,.009,.028,.011,E.port,.82);B(x+.294,0,rear-.144,.015,h-.085,.050,E.edge,.80);
      }
    }else if(type==='blanking'&&item.size>1){
      // Neutral utility / structural bay. No CDU, HMI, fluid ports or pump body.
      V(0,0,rear-.059,3.72,h-.055,.10,E.frame,.022,-.7);
      for(const x of [-1.20,0,1.20]){B(x,0,rear-.116,.016,h-.17,.020,E.seam,.1);for(const sy of [-1,1])screw(m,x+.34,sy*(h/2-.095),rear-.12,-1);}
      for(const side of [-1,1]){B(side*1.72,0,rear-.127,.075,Math.min(.45,h*.55),.040,E.fold,.7);B(side*1.72,0,rear-.151,.026,Math.min(.30,h*.38),.022,E.edge,.8);}
    }
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<m.data.length;i+=11)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],m.data[i+axis]);max[axis]=Math.max(max[axis],m.data[i+axis]);}
    return {mesh:m,depth,rear,min,max};
  }
  function createEditorialStructure(items){
    const frame=createFrame(),infrastructure=meshBuilder(),connections=meshBuilder(),routes=[],sockets=[],F=frame.box,FV=frame.bevel,B=infrastructure.box,V=infrastructure.bevel,T=infrastructure.tube;
    // Removable roof service skin: the thin shadow joint and captive fixings
    // distinguish a fabricated closure from an undetailed solid slab. Its top
    // stays below the existing corner lugs; no envelope or rack U changes.
    FV(0,7.601,0,4.19,.010,6.13,E.seam,.005,.16);
    FV(0,7.608,0,4.145,.012,6.085,[.067,.084,.096],.009,-.7);
    for(const side of [-1,1])for(const z of [-2.79,-.94,.94,2.79]){
      const x=side*1.937;
      frame.tube([x,7.612,z],[x,7.617,z],.032,E.fold,14,.57);
      frame.tube([x,7.616,z],[x,7.621,z],.022,E.edge,14,.71);
      F(x,7.621,z,.025,.0015,.005,E.seam,.12);
    }
    // Partial removable side covers retain the weight of a cabinet while the
    // inspection aperture exposes actual chassis and supported drawer depth.
    for(const side of [-1,1]){
      for(const [y,h] of [[-4.82,4.33],[.03,5.27],[4.91,4.30]])for(const [z,d] of [[1.90,2.18],[-2.44,1.16]]){
        FV(side*2.205,y,z,.055,h,d,E.frame,.020,-.7);
        F(side*2.238,y+h/2-.028,z,.011,.019,d-.05,E.fold,.55);
        F(side*2.243,y-h/2+.019,z,.011,.012,d-.05,E.seam,.15);
        for(const end of [-1,1])F(side*2.244,y,z+end*(d/2-.039),.010,h-.075,.016,E.fold,.58);
        for(const sy of [-1,1])for(const sz of [-1,1])frame.tube([side*2.228,y+sy*(h/2-.15),z+sz*(d/2-.11)],[side*2.255,y+sy*(h/2-.15),z+sz*(d/2-.11)],.018,E.edge,8,.70);
      }
      // Folded aperture returns, chassis supports and structural cross-members.
      for(const z of [-1.84,.78])FV(side*2.203,0,z,.115,14.20,.085,E.fold,.014,.80);
      for(const item of items){if(item.mgx_type==='blanking')continue;const y=item.y-item.height/2+.028;F(side*2.055,y,.035,.072,.033,6.00,E.fold,.8);F(side*2.083,y-.011,.035,.015,.009,5.97,E.edge,.85);}
      for(const y of [-6.95,-2.70,2.80,7.00]){F(side*2.225,y,-.56,.045,.072,2.48,E.fold,.75);F(side*2.252,y,-.56,.013,.027,2.31,E.edge,.75);}
      // Rear service frame extends behind the rear posts; all guides attach to
      // these members and never hover unattached in the rear camera view.
      V(side*2.02,0,-3.47,.13,14.26,.18,E.frame,.024,-.7);
      for(const y of [-6.94,-3.30,.30,3.90,6.99]){V(side*2.02,y,-3.24,.17,.16,.58,E.fold,.019,.80);T([side*2.02,y,-3.57],[side*2.02,y,-3.585],.027,E.edge,8,.80);}
      // Paired outer metal manifolds: capped external building-loop interfaces
      // with no CDU inside or beside this conceptual compute rack.
      const x=side*1.78;
      T([x,-6.72,-3.54],[x,6.69,-3.54],.085,E.rear,16,.82);
      for(const y of [-6.45,-4.18,-1.78,.62,3.02,5.42,6.47]){V(x,y,-3.46,.245,.085,.29,E.fold,.015,.72);T([x,y,-3.60],[x,y,-3.642],.108,E.edge,16,.80);}
      for(const y of [-6.72,6.70]){T([x,y,-3.54],[x,y+side*.025,-3.83],.103,E.edge,16,.84);T([x,y+side*.025,-3.82],[x,y+side*.025,-3.875],.074,E.polymer,16,.12);}
      // Shrouded cartridge carriers and ladder combs organize rear interconnect
      // without portraying generic Ethernet patch leads as NVIDIA's topology.
      V(side*.99,0,-3.455,.88,13.52,.12,E.frame,.018,-.7);
      for(const offset of [-1,0,1])B(side*.99+offset*.427,0,-3.515,.025,13.43,.075,E.edge,.80);
      for(let i=0;i<45;i++){const y=-6.6+i*.30;B(side*.99,y,-3.570,.38,.045,.095,E.fold,.68);B(side*1.315,y,-3.615,.14,.047,.25,E.fold,.69);B(side*1.35,y,-3.75,.21,.047,.022,E.edge,.73);}
    }
    // Public NVIDIA backplane photograph: four densely populated cartridge
    // columns, punched silver carrier flanges and black blind-mate blocks.
    // Both faces are modeled so empty-rack depth and rear inspection carry
    // actual infrastructure. These are bounded supports, never loose cables.
    for(const item of items.filter(p=>p.mgx_type==='server'||p.mgx_type==='nvlink')){
      const y=item.y;
      for(const side of [-1,1])for(const col of [0,1]){
        const x=side*(.77+col*.43),w=.393;
        for(const front of [-1,1]){
          const z=front>0?-3.356:-3.566,Z=d=>z+front*d;
          V(x,y,z,w,.252,.033,E.rear,.006,.80);
          B(x,y,Z(.022),w-.065,.148,.016,E.seam,.08);
          for(const sy of [-1,1]){
            B(x,y+sy*.097,Z(.023),w-.018,.037,.018,E.edge,.82);
            for(let i=0;i<10;i++)B(x-.165+i*.0366,y+sy*.097,Z(.035),.015,.019,.007,E.seam,.09);
            V(x,y+sy*.051,Z(.041),w-.094,.028,.031,E.fold,.004,.78);
          }
          for(const sx of [-1,1]){
            B(x+sx*.176,y,Z(.027),.023,.180,.025,E.edge,.82);
            infrastructure.tube([x+sx*.157,y+(.072),Z(.034)],[x+sx*.157,y+.072,Z(.041)],.010,E.port,10,.80);
          }
          for(let row=0;row<2;row++)for(let pin=0;pin<12;pin++)B(x-.125+pin*.0227,y+(row-.5)*.021,Z(.035),.006,.008,.006,[.35,.31,.22],.70);
        }
      }
    }
    for(const y of [-7.02,7.02])V(0,y,-3.50,4.10,.16,.22,E.frame,.018,-.7);
    // A narrow insulating shroud, isolated copper strips and regular protective
    // bridges suggest high-current distribution; no household PDU sockets.
    V(0,0,-3.47,.30,13.75,.17,E.polymer,.022,.18);
    for(const s of [-1,1])B(s*.057,0,-3.57,.066,13.61,.033,[.29,.235,.155],.82);
    for(let i=0;i<24;i++){const y=-6.6+i*.57;V(0,y,-3.61,.34,.080,.13,E.frame,.012,-.7);for(const s of [-1,1])T([s*.13,y,-3.673],[s*.13,y,-3.686],.017,E.edge,8,.75);}
    // The two top service U retain a bounded rear header instead of exposing a
    // void above the management trays. Lower bay remains a neutral enclosure.
    V(0,6.90,-3.19,3.91,.45,.17,E.fold,.023,.70);
    for(let i=0;i<19;i++)B(-1.70+i*.19,6.90,-3.285,.071,.28,.020,E.seam,.10);
    const route=(family,item,from,to,control,radius,color,metal=.12)=>{
      // An entry bend followed by a proper semicircular service loop avoids a
      // cubic spline's tight teardrop apex. The two arc cubics use the standard
      // circle factor; all joints share position and tangent direction.
      const side=from[0]<0?-1:1,arcX=family==='cooling'?side*1.34:family==='power'?.38:family==='management'?side*1.52:from[0];
      const z=Math.min(from[2],to[2])-.08,a=[arcX,from[1],z],b=[to[0],to[1],z],direction=Math.sign(b[0]-a[0]),bendRadius=Math.abs(b[0]-a[0])/2,k=.5522847498;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2,z-bendRadius],dz=z-from[2],ez=to[2]-z;
      const segments=[
        [from,[from[0],from[1],from[2]+dz*.36],[a[0],a[1],z-dz*.36],a],
        [a,[a[0],a[1],z-k*bendRadius],[mid[0]-direction*k*bendRadius,mid[1],mid[2]],mid],
        [mid,[mid[0]+direction*k*bendRadius,mid[1],mid[2]],[b[0],b[1],z-k*bendRadius],b],
        [b,[b[0],b[1],z+ez/3],[b[0],b[1],z+ez*2/3],to]
      ];
      segments.forEach((segment,index)=>editorialSweep(connections,segment,radius,color,metal,index===3?2:8));
      const id=item.name+'-'+family+'-'+routes.length,fromSocket=id+'-tray',toSocket=id+'-rack';
      // The same points construct the physical end collars and the verification
      // anchors. The sweep centerline ends inside each connector's solid shell.
      for(const [socketId,position,owner] of [[fromSocket,from,item.name],[toSocket,to,'rack-service-structure']])sockets.push(Object.freeze({id:socketId,position:Object.freeze([...position]),owner}));
      // `control` remains the coarse routing envelope for existing inspectors;
      // `segments` is the exact continuously joined rendered centerline.
      routes.push(Object.freeze({family,component:item.name,from:Object.freeze(from),to:Object.freeze(to),fromSocket,toSocket,control:Object.freeze(control.map(p=>Object.freeze(p))),segments:Object.freeze(segments.map(segment=>Object.freeze(segment.map(p=>Object.freeze(p))))),radius,bendRadius,bendRatio:bendRadius/radius,terminated:true}));
    };
    const connector=(x,y,z,w=.15,h=.095)=>{connections.bevel(x,y,z,w,h,.14,E.polymer,.016,.16);connections.box(x,y+h*.55,z-.022,w*.62,.015,.061,E.edge,.65);connections.box(x,y,z-.080,w*.70,h*.69,.034,E.jacket,.14);};
    for(const item of items){
      const {mgx_type:type,y}=item,depth={server:5.85,nvlink:5.95,powershelf:4.95,switch:4.55}[type];if(!depth)continue;const rear=FRONT-depth;
      if(type==='server'||type==='nvlink')for(const side of [-1,1]){
        // Short service loops terminate at the rear tray and the rack's fixed
        // cartridge lane. Cubic tangent continuity gives a consistent bend.
        for(let pair=0;pair<2;pair++){
          const x=side*(.56+pair*.14),dy=(pair-.5)*.060,from=[x,y+dy,rear-.20],to=[side*(.935+pair*.105),y+dy-.015,-3.64];
          connector(x,y+dy,rear-.166,.105,.059);connector(to[0],to[1],-3.595,.09,.062);
          route('interconnect',item,from,to,[from,[x,y+dy,rear-.66],[side*(.91+pair*.11),y+dy-.15,-4.00-pair*.055],to],.019,pair?E.jacket:[.10,.126,.137]);
        }
        const from=[side*1.69,y,rear-.245],to=[side*1.78,y-.040,-3.69];
        T([side*1.78,y-.040,-3.54],to,.044,E.edge,12,.83);
        route('cooling',item,from,to,[from,[side*1.45,y,rear-.74],[side*1.46,y-.040,-4.04],to],.034,E.jacket,.14);
        // Small retained collars visually separate elastomer from turned metal.
        connections.tube([side*1.69,y,rear-.210],from,.045,E.edge,12,.83);
      }
      if(type==='server'||type==='nvlink'||type==='powershelf'){
        const from=[.22,y,rear-.184],to=[.115,y,-3.635];connector(from[0],y,from[2]+.023,.125,.095);
        V(to[0],y,-3.60,.132,.105,.11,E.polymer,.010,.18);B(to[0],y,-3.660,.083,.065,.025,E.fold,.55);
        route('power',item,from,to,[from,[.42,y,rear-.67],[.45,y-.035,-3.92],to],.031,[.08,.073,.065],.11);
      }
      if(type==='switch'){
        for(const side of [-1,1]){const from=[side*1.39,y,rear-.17],to=[side*1.35,y-.04,-3.68];connector(from[0],y,from[2]+.030);B(to[0],to[1],to[2]+.035,.17,.15,.14,E.polymer,.18);route('management',item,from,to,[from,[side*1.39,y,rear-.90],[side*1.48,y-.04,-3.94],to],.020,E.jacket);}
      }
    }
    return {frame,infrastructure,connections,routes,sockets};
  }
  // CPU-only geometry sharing for the homepage editorial scene. This factory
  // does not mount a canvas, read application state or mutate a live placement.
  // Identical type/size meshes are built once so an editorial rack can reuse
  // the operational model quality without duplicating all of its geometry.
  function buildEditorialParts(records){
    const inspected=inspectPlacement(records.filter(i=>i.rack_mount!=='external'&&i.mgx_type!=='cdu'));
    if(inspected.invalid.length||inspected.unplaced.length)throw new Error('Editorial rack requires valid, non-overlapping placed components');
    const equipment={},placements=inspected.valid.map(item=>{
      const meshKey=item.mgx_type+':'+item.size;
      if(!equipment[meshKey]){
        const built=createEditorialEquipment(item);
        equipment[meshKey]=Object.freeze({data:new Float32Array(built.mesh.data),depth:built.depth,min:Object.freeze([...built.min]),max:Object.freeze([...built.max])});
      }
      return Object.freeze({name:item.name,type:item.mgx_type,top:item.top,bottom:item.bottom,size:item.size,y:item.y,height:item.height,meshKey});
    });
    const structure=createEditorialStructure(inspected.valid),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    const include=(data,y=0)=>{for(let i=0;i<data.length;i+=11)for(let axis=0;axis<3;axis++){const v=data[i+axis]+(axis===1?y:0);min[axis]=Math.min(min[axis],v);max[axis]=Math.max(max[axis],v);}};
    for(const key of ['frame','infrastructure','connections'])include(structure[key].data);
    for(const item of placements)include(equipment[item.meshKey].data,item.y);
    const vertices=Object.freeze({frame:structure.frame.data.length/11,infrastructure:structure.infrastructure.data.length/11,connections:structure.connections.data.length/11,equipment:Object.freeze(Object.fromEntries(Object.entries(equipment).map(([key,value])=>[key,value.data.length/11])))});
    const routeFamilies=Object.freeze(structure.routes.reduce((counts,route)=>(counts[route.family]=(counts[route.family]||0)+1,counts),{}));
    const quality=Object.freeze({front:true,side:true,rear:true,fullDepth:true,noCDU:true,railPairs:inspected.valid.filter(i=>i.mgx_type!=='blanking').length,routeCount:structure.routes.length,routeFamilies,vertices,materialFamilies:Object.freeze(['brushed-anodized-metal','powder-coated-steel','chassis-metal','matte-polymer','cable-jacket','recessed-grille','status-lens']),conceptual:true});
    return Object.freeze({stride:11,unit:U,front:FRONT,
      frame:Object.freeze({data:new Float32Array(structure.frame.data)}),infrastructure:Object.freeze({data:new Float32Array(structure.infrastructure.data)}),connections:Object.freeze({data:new Float32Array(structure.connections.data)}),equipment:Object.freeze(equipment),placements:Object.freeze(placements),occupiedU:inspected.occupiedU,quality,metadata:quality,routes:Object.freeze(structure.routes),sockets:Object.freeze(structure.sockets),
      bounds:Object.freeze({min:Object.freeze(min),max:Object.freeze(max)})});
  }
  window.PARackScene=Object.freeze({mount,inspectPlacement,inspectNetworkCabling,buildEditorialParts});
})();
