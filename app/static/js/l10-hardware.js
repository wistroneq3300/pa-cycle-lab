/* Original procedural 1U liquid-cooled compute tray. No vendor CAD or assets.
 * Main topology: public Lenovo compute-tray top/front/rear diagrams. Dimensions
 * are normalized to the existing PA rack; unpublished dimensions, package
 * placement and concealed passages are explicitly visual approximations.
 * Packages are soldered board assemblies. Their animation is a visual section,
 * NOT a representation of socket insertion or a factory assembly instruction.
 */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const profile = Object.freeze({
    id: 'liquid-compute-1u-v1', label: 'Liquid-cooled Compute Tray', revision: 2,
    basis: 'Lenovo public compute tray top, front and rear diagrams',
    referenceMatrix: 'docs/L10_HARDWARE_REFERENCE_MATRIX.md',
    units: 'PA rack scene units; physical dimensions are not manufacturing CAD',
    width: 4, depth: 6, height: .274, front: '+Z', rear: '-Z',
    referenceDimensionsMM: Object.freeze({ width: 438, depth: 766, height: 43.6 }),
    editorialSceneScale: Object.freeze({ x: .688, y: 1, z: .802 }),
    counts: Object.freeze({ computeBoards: 2, cpu: 2, gpu: 4, fans: 8, storageBays: 8, networkCards: 2, dpu: 1 }),
    boards: Object.freeze([
      Object.freeze({ x: -.965, z: -1.68, width: 1.73, depth: 2.32 }),
      Object.freeze({ x: .965, z: -1.68, width: 1.73, depth: 2.32 })
    ]),
    packages: Object.freeze([
      Object.freeze({ type: 'CPU', board: 0, x: -.965, z: -1.10, width: .64, depth: .64 }),
      Object.freeze({ type: 'GPU', board: 0, x: -1.39, z: -2.18, width: .61, depth: .66 }),
      Object.freeze({ type: 'GPU', board: 0, x: -.55, z: -2.18, width: .61, depth: .66 }),
      Object.freeze({ type: 'CPU', board: 1, x: .965, z: -1.10, width: .64, depth: .64 }),
      Object.freeze({ type: 'GPU', board: 1, x: .55, z: -2.18, width: .61, depth: .66 }),
      Object.freeze({ type: 'GPU', board: 1, x: 1.39, z: -2.18, width: .61, depth: .66 })
    ]),
    coolant: Object.freeze({ supply: [-1.84, .036, -3.055], return: [1.84, .036, -3.055], overlay: 'Conceptual thermal flow overlay; not a published internal microchannel map' }),
    approximations: Object.freeze([
      'Normalized envelope uses the existing rack coordinates; common editorial X/Z scaling restores published width/depth/height ratios.',
      'CPU/GPU package footprints and placement under the published cold plate are visual approximations.',
      'PCB routing, passive layout, plate machining, fasteners and tube bend radii are original visual approximations.',
      'Package laminate, solder terminations, cold-plate mounting ears and preload collars describe generic construction, not a verified OEM retention design.',
      'Red and blue describe conceptual thermal flow, not coolant color or verified internal channels.'
    ]),
    motion: Object.freeze({ packageMode: 'visual-section-of-board-integrated-packages', coolingLast: true })
  });
  const C = {
    steel: [.40,.44,.46], bright: [.62,.66,.68], nickel: [.52,.57,.59], darkSteel: [.16,.19,.21],
    black: [.026,.032,.038], rubber: [.018,.023,.026], pcb: [.038,.095,.067], pcbEdge: [.105,.13,.082],
    trace: [.094,.145,.093], silk: [.38,.45,.37], chip: [.029,.034,.038], substrate: [.083,.115,.074],
    copper: [.38,.255,.135], gold: [.49,.38,.17], ceramic: [.29,.24,.17], white: [.57,.59,.55],
    inlet: [.15,.40,.56], outlet: [.58,.24,.17]
  };
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  function mesh() {
    const data=[];
    function vertex(p,n,c,m=.82,e=0,a=1){data.push(...p,...n,...c,a,m,e);}
    function tri(a,b,c,n,color,m=.82){vertex(a,n,color,m);vertex(b,n,color,m);vertex(c,n,color,m);}
    function quad(a,b,c,d,n,color,m=.82){tri(a,b,c,n,color,m);tri(a,c,d,n,color,m);}
    function box(x,y,z,w,h,d,color,m=.82) {
      const X=w/2,Y=h/2,Z=d/2,p=(a,b,c)=>[x+a,y+b,z+c];
      const faces=[
        [[-X,-Y,Z],[X,-Y,Z],[X,Y,Z],[-X,Y,Z],[0,0,1]],
        [[X,-Y,-Z],[-X,-Y,-Z],[-X,Y,-Z],[X,Y,-Z],[0,0,-1]],
        [[X,-Y,Z],[X,-Y,-Z],[X,Y,-Z],[X,Y,Z],[1,0,0]],
        [[-X,-Y,-Z],[-X,-Y,Z],[-X,Y,Z],[-X,Y,-Z],[-1,0,0]],
        [[-X,Y,Z],[X,Y,Z],[X,Y,-Z],[-X,Y,-Z],[0,1,0]],
        [[-X,-Y,-Z],[X,-Y,-Z],[X,-Y,Z],[-X,-Y,Z],[0,-1,0]]
      ];
      faces.forEach(f=>quad(p(...f[0]),p(...f[1]),p(...f[2]),p(...f[3]),f[4],color,m));
    }
    // Machined edge breaks catch studio reflections without exaggerated radii.
    function bevel(x,y,z,w,h,d,color,m=.82,r=.012) {
      r=Math.min(r,w*.15,d*.15,h*.30); const rings=[];
      for(const [dy,inset] of [[-h/2,r],[-h/2+r,0],[h/2-r,0],[h/2,r]]) {
        const X=w/2-inset,Z=d/2-inset,b=Math.max(.002,r-inset*.55);
        rings.push([[-X+b,dy,-Z],[X-b,dy,-Z],[X,dy,-Z+b],[X,dy,Z-b],[X-b,dy,Z],[-X+b,dy,Z],[-X,dy,Z-b],[-X,dy,-Z+b]].map(p=>[p[0]+x,p[1]+y,p[2]+z]));
      }
      for(let j=0;j<3;j++)for(let i=0;i<8;i++){
        const k=(i+1)%8,a=rings[j][i],b=rings[j+1][i],c=rings[j+1][k],d0=rings[j][k];
        quad(a,b,c,d0,unit(cross(sub(b,a),sub(c,a))),color,m);
      }
      for(let i=0;i<8;i++){const k=(i+1)%8;tri([x,y+h/2,z],rings[3][k],rings[3][i],[0,1,0],color,m);tri([x,y-h/2,z],rings[0][i],rings[0][k],[0,-1,0],color,m);}
    }
    function cylinder(a,b,r,color,m=.9,segments=16,r2=r,caps=true) {
      const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),v=cross(axis,u);
      const p=(t,base,radius)=>base.map((n,i)=>n+radius*(u[i]*Math.cos(t)+v[i]*Math.sin(t)));
      for(let i=0;i<segments;i++){
        const t=i/segments*TAU,t1=(i+1)/segments*TAU,p0=p(t,a,r),p1=p(t1,a,r),p2=p(t1,b,r2),p3=p(t,b,r2);
        const n=unit(u.map((n,j)=>n*Math.cos((t+t1)/2)+v[j]*Math.sin((t+t1)/2)));
        quad(p0,p1,p2,p3,n,color,m);
        if(caps){tri(a,p1,p0,axis.map(n=>-n),color,m);tri(b,p3,p2,axis,color,m);}
      }
    }
    function ring(x,y,z,outer,inner,h,color,m=.9,segments=16) {
      for(let i=0;i<segments;i++){
        const a=i/segments*TAU,b=(i+1)/segments*TAU,p=(r,t,dy)=>[x+r*Math.cos(t),y+dy,z+r*Math.sin(t)];
        quad(p(inner,a,h/2),p(inner,b,h/2),p(outer,b,h/2),p(outer,a,h/2),[0,1,0],color,m);
        quad(p(outer,a,-h/2),p(outer,a,h/2),p(outer,b,h/2),p(outer,b,-h/2),[Math.cos((a+b)/2),0,Math.sin((a+b)/2)],color,m);
      }
    }
    function screw(x,y,z,r=.023) {
      cylinder([x,y-.005,z],[x,y+.004,z],r,C.darkSteel,.88,12);
      ring(x,y+.005,z,r*.83,r*.43,.002,C.bright,.92,12);
      box(x,y+.006,z,r*.95,.0014,r*.16,C.black,.25);
      box(x,y+.0062,z,r*.16,.0014,r*.95,C.black,.25);
    }
    function tube(points,r,color,m=.9,segments=12) {
      // Rounded corners use a quadratic fillet, not intersecting cylinders.
      const path=[points[0]];
      for(let i=1;i<points.length-1;i++){
        const a=points[i-1],b=points[i],c=points[i+1],l1=Math.hypot(...sub(a,b)),l2=Math.hypot(...sub(c,b)),bend=Math.min(.12,l1*.3,l2*.3);
        const v1=unit(sub(a,b)),v2=unit(sub(c,b)),p=b.map((n,j)=>n+v1[j]*bend),q=b.map((n,j)=>n+v2[j]*bend);
        path.push(p);for(let k=1;k<=6;k++){const t=k/6;path.push(b.map((n,j)=>(1-t)*(1-t)*p[j]+2*(1-t)*t*n+t*t*q[j]));}
      }
      path.push(points[points.length-1]);
      const rings=path.map((p,i)=>{
        const axis=unit(sub(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)])),u=unit(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),v=cross(axis,u);
        return Array.from({length:segments},(_,j)=>{const t=j/segments*TAU,n=u.map((n,k)=>n*Math.cos(t)+v[k]*Math.sin(t));return {p:p.map((value,k)=>value+r*n[k]),n};});
      });
      for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){
        const k=(j+1)%segments,a=rings[i][j],b=rings[i][k],c=rings[i+1][k],d=rings[i+1][j];
        for(const v of [a,b,c,a,c,d])vertex(v.p,v.n,color,m);
      }
    }
    function line(x1,z1,x2,z2,y,width,color,m=.15) {
      const l=Math.hypot(x2-x1,z2-z1)||1,dx=(z2-z1)/l*width/2,dz=-(x2-x1)/l*width/2;
      quad([x1-dx,y,z1-dz],[x1+dx,y,z1+dz],[x2+dx,y,z2+dz],[x2-dx,y,z2-dz],[0,1,0],color,m);
    }
    return {data,box,bevel,cylinder,ring,screw,tube,line,tri,quad};
  }
  function build(modelProfile=profile,options={}) {
    const profile=modelProfile;
    const parts={}; for(const id of ['chassis','board','packages','io','cooling-frame','cooling','flow-supply','flow-return','lid'])parts[id]=mesh();
    const ch=parts.chassis,board=parts.board,pkg=parts.packages,io=parts.io,cf=parts['cooling-frame'],cp=parts.cooling,lid=parts.lid;
    // Folded sheet chassis: thin base, upright walls, hemmed flanges and runners.
    ch.bevel(0,-.124,0,3.98,.023,5.98,C.steel,.84,.004);
    for(const side of [-1,1]){
      ch.bevel(side*1.978,.003,0,.034,.244,5.98,C.darkSteel,.88,.005);
      ch.box(side*1.945,.118,0,.083,.016,5.89,C.steel,.9);
      ch.box(side*1.992,-.071,0,.017,.033,5.72,C.bright,.92);
      ch.box(side*1.965,-.108,0,.071,.018,5.90,C.bright,.91);
      for(let i=0;i<10;i++)ch.screw(side*1.937,.127,-2.72+i*.59,.015);
      for(let i=0;i<5;i++)ch.bevel(side*1.909,-.093,-2.6+i*1.1,.052,.036,.15,C.steel,.8,.005);
      // Chassis handles are folded pull tabs, not floating ornamental rails.
      ch.bevel(side*1.906,.018,3.017,.142,.204,.034,C.darkSteel,.85,.008);
      ch.box(side*1.907,.018,3.038,.085,.142,.013,C.black,.1);
      ch.bevel(side*1.907,.013,3.054,.033,.118,.024,C.bright,.9,.005);
      ch.screw(side*1.879,.119,2.89,.02);
    }
    ch.box(0,-.008,-2.966,3.93,.22,.034,C.steel,.88);
    // Front fascia is assembled around apertures rather than a blank solid slab.
    ch.bevel(0,.118,2.982,3.91,.025,.05,C.darkSteel,.83,.004);
    ch.bevel(0,-.109,2.982,3.91,.030,.05,C.steel,.84,.004);
    for(const x of [-1.78,-.86,.87,1.78])ch.box(x,.004,2.979,.032,.208,.048,C.steel,.88);

    // Board-mounted parts share a real seating plane. The terminations and pads
    // are original representative geometry; no OEM netlist or BOM is asserted.
    const pcbTop=-.0715;
    function smd(b,x,z,w=.035,d=.022,h=.012,ceramic=true) {
      // Retention hardware has a component keep-out, not a post passing through
      // a decorative passive row. Include the larger solder-pad footprint.
      if(b===board&&profile.packages.some(p=>[-1,1].some(sx=>[-1,1].some(sz=>
        Math.abs(x-p.x-sx*(p.width/2+.077))<w/2+.026&&
        Math.abs(z-p.z-sz*(p.depth/2+.077))<d/2+.026))))return;
      const terminal=Math.min(d*.23,.011),base=pcbTop+.001;
      for(const side of [-1,1]){
        b.box(x,pcbTop+.0007,z+side*(d/2-terminal*.4),w+.008,.0014,terminal+.009,C.bright,.72);
        b.box(x,base+h*.47,z+side*(d/2-terminal*.5),w,h*.94,terminal,C.nickel,.82);
      }
      b.box(x,base+h/2,z,w,h,d-terminal*1.4,ceramic?C.ceramic:C.chip,.065);
    }
    function mountingPoints(cx,cz,w,d) {
      return [-1,1].flatMap(sx=>[-1,1].map(sz=>[cx+sx*(w/2-.058),cz+sz*(d/2-.062)]));
    }

    function pcbDetail(b,cx,cz,w,d,seed) {
      b.bevel(cx,-.084,cz,w,.025,d,C.pcb,.06,.005);
      b.box(cx,-.097,cz,w-.006,.002,d-.006,C.pcbEdge,.14);
      const left=cx-w/2,right=cx+w/2,front=cz+d/2,rear=cz-d/2;
      for(const [x,z] of mountingPoints(cx,cz,w,d)){
        // Derived from the PCB holes: no displaced generic chassis pillars.
        ch.cylinder([x,-.1125,z],[x,-.098,z],.026,C.gold,.78,16);
        ch.ring(x,-.099,z,.033,.014,.002,C.nickel,.84,16);
        b.ring(x,-.070,z,.032,.014,.002,C.gold,.8,16);b.screw(x,-.064,z,.012);
      }
      // PCB fan-out remains subdued under the solder mask.
      for(let i=0;i<34;i++){
        const x=left+.11+(i%17)*(w-.22)/16,z=rear+.14+Math.floor(i/17)*(d-.28);
        const end=cz+(i<17?-.18:.18),offset=((i+seed)%5-2)*.018;
        b.line(x,z,x,end+offset,-.0708,.005,C.trace,.14);
        b.line(x,end+offset,x+.09,end+offset+.09,-.0707,.005,C.trace,.14);
      }
      for(let i=0;i<25;i++){
        const z=rear+.17+i*(d-.34)/24;
        for(const side of [-1,1]){
          const x=cx+side*(w/2-.105),h=.010+((i+seed)%3)*.003;
          smd(b,x,z,.030+(i%3)*.005,.035,h,i%4!==0);
          if(i%3===0)b.line(x-.03,z-.043,x+.03,z-.043,-.069,.003,C.silk,.05);
        }
      }
      for(let i=0;i<12;i++){
        const x=left+.19+i*(w-.38)/11;
        smd(b,x,front-.12,.047,.044,.021,i%3===0);
        smd(b,x,rear+.13,.041,.040,.015,false);
        smd(b,x,front-.068,.024,.021,.012,true);
      }
      // Connectors and retention clips along the board edge.
      for(const side of [-1,1]){
        const x=cx+side*(w/2-.053),headerZ=front-.32;
        // Keyed low-profile housing: recessed contact bed, perimeter walls and
        // exposed solder tails instead of a monolithic black connector block.
        b.bevel(x,-.063,headerZ,.061,.017,.44,C.black,.09,.002);
        for(const sx of [-1,1])b.box(x+sx*.025,-.046,headerZ,.012,.032,.44,C.black,.08);
        for(const sz of [-1,1])b.box(x,-.046,headerZ+sz*.208,.044,.032,.022,C.black,.08);
        b.box(x,-.046,headerZ-.058,.046,.032,.023,C.black,.08);
        for(let i=0;i<12;i++){
          const z=headerZ-.174+i*.031;
          b.box(x,-.052,z,.031,.006,.007,C.gold,.78);
          b.box(x-side*.038,pcbTop+.002,z,.018,.004,.010,C.bright,.78);
        }
      }
    }
    // Asset prototype can replace one semantic board without spatially clipping
    // triangles or removing the shared chassis, piping and flow overlays.
    const omitted=Number.isInteger(options.omitBoard)?options.omitBoard:-1;
    const replaceLeftPlumbing=omitted===0&&options.replaceLeftPlumbing===true;
    if(replaceLeftPlumbing&&(!Array.isArray(options.supplyOverlayPath)||options.supplyOverlayPath.length<2||options.supplyOverlayPath.length>512||options.supplyOverlayPath.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>4))))throw new Error('Invalid prototype supply path');
    const discard=mesh();
    profile.boards.forEach((p,i)=>pcbDetail(i===omitted?discard:board,p.x,p.z,p.width,p.depth,i*11));
    // Low-profile components are intentionally part of the board, not exploded chips.
    for(const b of profile.boards){
      if(profile.boards.indexOf(b)===omitted)continue;
      for(let i=0;i<8;i++){
        const x=b.x-.60+i*.172;
        // A repeated power phase has a molded inductor, two terminated power
        // devices and decoupling, rather than ten undifferentiated cubes.
        board.bevel(x,pcbTop+.025,-1.65,.101,.048,.095,[.115,.126,.127],.13,.005);
        for(const side of [-1,1])board.box(x,pcbTop+.006,-1.65+side*.046,.088,.012,.015,C.nickel,.73);
        board.line(x-.032,-1.663,x+.024,-1.663,pcbTop+.0493,.003,[.25,.27,.26],.12);
        smd(board,x-.037,-1.741,.047,.045,.015,false);
        smd(board,x+.037,-1.741,.047,.045,.015,false);
        smd(board,x,-1.56,.041,.027,.016,true);
      }
      for(let i=0;i<20;i++){
        const z=-2.58+(i%10)*.195,x=b.x+(i<10?-.355:.355);
        if(z< -1.77 || z> -1.4)continue;
        smd(board,x,z,.030,.050,.014,true);
      }
      // Dense local power delivery and decoupling around the package perimeter.
      // Rows vary by purpose instead of repeating identical decorative cubes.
      for(const side of [-1,1])for(let i=0;i<8;i++){
        const x=b.x+side*.43,z=-1.37+i*.087;
        smd(board,x,z,.058,.034,.018,false);
        smd(board,x-side*.047,z,.017,.028,.010,true);
        board.ring(x+side*.049,pcbTop+.001,z,.008,.004,.001,C.gold,.72,10);
      }
      for(let i=0;i<17;i++){
        const x=b.x-.64+i*.079;
        smd(board,x,-.635,.038,.021,.012,true);
        smd(board,x,-.678,.034,.026,.012,false);
        if(i%2===0){
          board.line(x,-.70,x+.042,-.75,-.0703,.004,C.trace,.13);
          board.line(x+.042,-.75,x+.042,-.88,-.0703,.004,C.trace,.13);
        }
      }
      for(let i=0;i<7;i++){
        const x=b.x-.59+i*.197;
        board.line(x,-1.74,x+.071,-1.81,-.0702,.0025,C.silk,.06);
        board.line(x,-1.73,x+.082,-1.73,-.0702,.0025,C.silk,.06);
        board.ring(x,-.070,-1.77,.009,.005,.001,C.gold,.7,8);
      }
    }
    profile.packages.forEach((p,index)=>{
      const omit=p.board===omitted;
      const pkg=omit?discard:parts.packages,board=omit?discard:parts.board;
      const cf=omit?discard:parts['cooling-frame'],cp=omit?discard:parts.cooling;
      // Bonded board-integrated package: underfill meets the board, followed by
      // layered laminate, the bonded spreader flange and its contact cap. Do not
      // invent exposed silicon/HBM topology from a cold-plate-covered diagram.
      pkg.bevel(p.x,-.06375,p.z,p.width+.028,.0155,p.depth+.028,C.black,.06,.003);
      pkg.bevel(p.x,-.047,p.z,p.width+.100,.018,p.depth+.100,[.040,.064,.050],.06,.004);
      for(const side of [-1,1]){
        pkg.box(p.x+side*(p.width/2+.046),-.047,p.z,.006,.007,p.depth+.082,C.pcbEdge,.12);
        pkg.box(p.x,-.047,p.z+side*(p.depth/2+.046),p.width+.082,.007,.006,C.pcbEdge,.12);
        // Thin adhesive meniscus under the metal flange, not a removable socket.
        pkg.box(p.x+side*(p.width/2-.004),-.0378,p.z,.006,.0014,p.depth-.015,C.black,.05);
        pkg.box(p.x,-.0378,p.z+side*(p.depth/2-.004),p.width-.015,.0014,.006,C.black,.05);
      }
      pkg.bevel(p.x,-.020,p.z,p.width,.035,p.depth,C.nickel,.83,.009);
      pkg.bevel(p.x,.001,p.z,p.width-.055,.010,p.depth-.055,p.type==='CPU'?[.66,.655,.63]:[.235,.285,.315],.85,.003);
      pkg.line(p.x-p.width*.38,p.z-p.depth*.37,p.x+p.width*.38,p.z-p.depth*.37,.0063,.0038,[.40,.45,.47],.86);
      const pad=p.type==='GPU'?.024:.020;
      for(let i=0;i<7;i++)for(const side of [-1,1]){
        const x=p.x-p.width*.40+i*p.width*.80/6,z=p.z+side*(p.depth/2+.029);
        pkg.box(x,-.032,z,pad,.010,.017,C.ceramic,.08);
        for(const sz of [-1,1])pkg.box(x,-.033,z+sz*.007,pad+.003,.008,.005,C.nickel,.72);
      }
      // Sparse substrate test pads and a pin-one witness mark make the package
      // edge legible without attributing an unpublished pinout to the hardware.
      for(const side of [-1,1])for(let i=0;i<5;i++){
        pkg.box(p.x+side*(p.width/2+.029),-.0374,p.z-.16+i*.077,.016,.0012,.022,C.gold,.78);
      }
      pkg.tri([p.x-p.width/2-.040,-.0371,p.z-p.depth/2-.039],[p.x-p.width/2-.011,-.0371,p.z-p.depth/2-.039],[p.x-p.width/2-.040,-.0371,p.z-p.depth/2-.011],[0,1,0],C.silk,.07);
      // Fine laser marking is represented by subdued etched strokes, not labels.
      for(let i=0;i<4;i++)pkg.line(p.x-.11,p.z+.10+i*.025,p.x+.10-(i%2)*.045,p.z+.10+i*.025,.0062,.0028,[.32,.36,.37],.6);
      // Nickel-plated copper cold plate: opaque rim/base, ghostable central cover.
      const w=p.width+.125,d=p.depth+.126;
      // Thin compliant interface closes the package-to-plate contact. The
      // original public source does not disclose TIM thickness or composition.
      cf.box(p.x,.0064,p.z,p.width*.92,.0008,p.depth*.92,[.19,.20,.20],.12);
      cf.bevel(p.x,.02115,p.z,w,.0287,d,C.copper,.89,.005);
      cf.bevel(p.x,.043,p.z,w+.012,.015,d+.012,C.nickel,.89,.005);
      // Frame remains solid during the engineering overlay.
      for(const s of [-1,1]){
        cf.bevel(p.x+s*(w/2-.026),.065,p.z,.051,.028,d,C.nickel,.9,.004);
        cf.bevel(p.x,.065,p.z+s*(d/2-.026),w-.055,.028,.051,C.nickel,.9,.004);
      }
      cp.bevel(p.x,.063,p.z,w-.09,.028,d-.09,C.nickel,.92,.006);
      cp.bevel(p.x,.078,p.z,w-.17,.004,d-.17,[.43,.48,.50],.95,.001);
      // A milled perimeter and a small stamped service recess give the broad
      // cover a believable manufacturing scale without imitation microchannels.
      for(const s of [-1,1]){
        cp.line(p.x-w*.31,p.z+s*d*.30,p.x+w*.31,p.z+s*d*.30,.0803,.003,[.33,.38,.40],.84);
        cp.line(p.x+s*w*.31,p.z-d*.30,p.x+s*w*.31,p.z+d*.30,.0803,.003,[.33,.38,.40],.84);
      }
      cp.bevel(p.x,.081,p.z+d*.22,w*.28,.002,.063,[.40,.45,.47],.83,.0005);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const x=p.x+sx*(p.width/2+.077),z=p.z+sz*(p.depth/2+.077);
        // Outboard retention ears keep the fastener axis outside the package
        // laminate. Stand-off collars meet the board washer; the plated base
        // still contacts the existing thin TIM at the six verified surfaces.
        board.ring(x,-.070,z,.026,.013,.002,C.bright,.85,16);
        cf.cylinder([x,-.069,z],[x,.044,z],.015,C.darkSteel,.78,16);
        cf.ring(x,-.065,z,.022,.011,.007,C.nickel,.86,16);
        cf.bevel(p.x+sx*(p.width/2+.050),.061,p.z+sz*(p.depth/2+.050),.112,.034,.112,C.nickel,.89,.005);
        cf.ring(x,.079,z,.024,.013,.003,C.darkSteel,.78,16);
        cf.screw(x,.0855,z,.017);
      }
      // A continuous sealed cover joint remains visible with the face ghosted.
      for(const side of [-1,1]){
        cf.box(p.x+side*(w/2-.044),.079,p.z,.003,.0015,d-.09,C.darkSteel,.54);
        cf.box(p.x,.079,p.z+side*(d/2-.044),w-.09,.0015,.003,C.darkSteel,.54);
      }
      for(const s of [-1,1]){
        const x=p.x+s*(p.type==='CPU'?.28:.12),z=p.type==='CPU'?p.z:p.z+d/2-.03;
        cf.cylinder([x,.066,z],[x,.10,z],.031,C.nickel,.94,16);
      }
      // Conceptual two-lane overlay. It deliberately does not assert microchannels.
      const supply=parts['flow-supply'],ret=parts['flow-return'];
      if(p.type==='CPU'){
        supply.tube([[p.x+.28,.083,p.z],[p.x+.08,.083,p.z-.06],[p.x,.083,p.z-.06]],.012,C.inlet,.26,10);
        ret.tube([[p.x,.083,p.z-.06],[p.x-.08,.083,p.z+.06],[p.x-.28,.083,p.z]],.012,C.outlet,.26,10);
      }else{
        supply.tube([[p.x-.12,.083,p.z+d/2],[p.x-.12,.083,p.z-.13],[p.x,.083,p.z-.21]],.012,C.inlet,.26,10);
        ret.tube([[p.x,.083,p.z-.21],[p.x+.12,.083,p.z-.13],[p.x+.12,.083,p.z+d/2]],.012,C.outlet,.26,10);
      }
      const arrow=(m,x,z,dir,col)=>m.tri([x,.098,z+dir*.04],[x-.026,.098,z-dir*.018],[x+.026,.098,z-dir*.018],[0,1,0],col,.18);
      if(p.type==='GPU'){arrow(supply,p.x-.12,p.z+.01,-1,C.inlet);arrow(ret,p.x+.12,p.z+.01,1,C.outlet);}
    });

    // Eight compact fan cartridges leave a central power-cable corridor.
    for(const x of [-1.69,-1.27,-.85,-.43,.43,.85,1.27,1.69]){
      io.bevel(x,-.012,.055,.365,.198,.48,C.black,.10,.008);
      io.box(x,.091,.055,.278,.011,.386,C.darkSteel,.42);
      for(const z of [-.192,.302]){
        io.cylinder([x,-.013,z],[x,-.013,z+(z<0?-.004:.004)],.091,C.rubber,.1,20);
        io.cylinder([x,-.013,z-.008],[x,-.013,z+.008],.032,C.darkSteel,.55,16);
        for(let k=0;k<24;k++){
          const a=k/24*TAU,b=(k+1)/24*TAU;
          const p=(r,t)=>[x+r*Math.cos(t),-.013+r*Math.sin(t),z+.012];
          io.quad(p(.086,a),p(.086,b),p(.100,b),p(.100,a),[0,0,1],[.17,.19,.20],.68);
        }
        // Radial guard spokes in the actual fan plane.
        for(let k=0;k<7;k++){
          const a=k/7*TAU,b=a+.21;
          const p=(r,t)=>[x+r*Math.cos(t),-.013+r*Math.sin(t),z+.009];
          io.tri(p(.028,a),p(.080,b),p(.079,b+.43),[0,0,1],[.11,.135,.14],.24);
        }
      }
      io.bevel(x,.105,.12,.115,.025,.16,C.darkSteel,.40,.003);
      io.line(x-.048,.15,x+.048,.15,.119,.013,C.white,.1);
      io.box(x-.068,.098,-.069,.12,.005,.10,[.34,.36,.34],.08);
      for(let i=0;i<5;i++)io.line(x-.118,-.105+i*.016,x-.022-(i%2)*.018,-.105+i*.016,.101,.003,C.darkSteel,.1);
      for(const side of [-1,1])io.bevel(x+side*.16,.020,.037,.013,.11,.29,[.067,.076,.080],.22,.002);
      io.tube([[x+.13,.070,.26],[x+.15,.062,.4],[x+.13,-.041,.49]],.010,C.black,.06,8);
      for(const sx of [-1,1])io.screw(x+sx*.138,.100,-.106,.010);
    }
    // Front I/O boards; their large shield cans match the published zoning.
    for(const x of [-1.29,1.29]){
      pcbDetail(io,x,1.48,.90,1.82,2);
      io.bevel(x,-.017,1.47,.80,.080,1.36,C.nickel,.78,.009);
      io.bevel(x,.029,1.47,.74,.013,1.28,[.47,.51,.52],.76,.003);
      for(const side of [-1,1]){
        io.line(x-.32,1.47+side*.54,x+.32,1.47+side*.54,.036,.005,C.darkSteel,.65);
        for(let i=0;i<10;i++)io.box(x+side*.332,.039,1.09+i*.08,.021,.004,.041,C.darkSteel,.5);
      }
      io.bevel(x,.038,1.77,.39,.004,.16,[.33,.37,.38],.63,.001);
      for(let i=0;i<6;i++)io.line(x-.16,1.714+i*.020,x+.13-(i%3)*.040,1.714+i*.020,.041,.0025,C.steel,.72);
      for(const sx of [-1,1])for(const z of [.89,2.07])io.screw(x+sx*.32,.040,z,.018);
      for(let i=0;i<11;i++)io.box(x-.30+i*.06,.044,.99,.017,.021,.36,C.steel,.82);
    }
    pcbDetail(io,-.34,1.49,.58,1.09,8); // Management controller card.
    io.bevel(-.34,-.022,1.52,.27,.086,.31,C.chip,.08,.006);
    for(let i=0;i<9;i++)io.box(-.46+i*.031,.028,1.52,.012,.029,.28,C.darkSteel,.71);
    io.bevel(.33,-.041,.93,.56,.071,.73,C.pcb,.08,.005);
    for(let i=0;i<7;i++)io.bevel(.14+i*.061,.006,.89,.043,.025,.36,C.chip,.10,.003);
    io.cylinder([-.30,-.050,.97],[-.30,-.028,.97],.071,C.bright,.8,24); // CMOS coin cell.
    io.box(-.30,-.015,.97,.027,.012,.17,C.steel,.7);
    io.bevel(.37,-.037,1.74,.21,.063,.56,C.pcb,.07,.004); // M.2 assembly.
    io.box(.37,.001,1.74,.17,.015,.42,C.chip,.06);io.screw(.37,.015,1.985,.015);
    io.box(.37,-.002,1.45,.20,.041,.055,C.black,.08);
    // Flat, insulated laminated busbar through the central corridor.
    io.bevel(0,-.035,-.73,.16,.063,3.75,C.black,.10,.006);
    io.box(-.033,-.001,-.73,.025,.009,3.63,[.11,.115,.11],.35);
    io.box(.033,-.001,-.73,.025,.009,3.63,[.09,.092,.09],.30);
    io.bevel(0,-.034,1.10,.72,.076,.46,C.darkSteel,.53,.008);
    for(let i=0;i<8;i++)io.box(-.29+i*.083,.020,1.09,.035,.022,.27,C.steel,.74);

    // Front: eight individually framed E1.S carriers with captive latches.
    // Their rear sockets now meet one shared vertical backplane. The public
    // image establishes the relationship; exact connector internals are authored.
    io.bevel(0,-.013,2.520,1.74,.176,.025,C.pcb,.06,.003);
    for(const x of [-.842,.842]){
      io.box(x,-.013,2.496,.032,.176,.024,C.nickel,.79);
      io.box(x,-.102,2.530,.048,.021,.09,C.nickel,.80);
    }
    for(let i=0;i<8;i++){
      const x=-.735+i*.21;
      io.box(x,-.015,2.549,.156,.147,.033,C.black,.08);
      for(let j=0;j<8;j++)io.box(x-.057+j*.0163,-.071,2.569,.007,.014,.010,C.gold,.81);
      io.box(x,.073,2.505,.087,.028,.012,C.chip,.07);
      io.box(x,-.007,2.762,.197,.207,.421,C.black,.12);
      io.bevel(x,-.005,2.983,.178,.19,.045,C.darkSteel,.77,.008);
      io.bevel(x+.048,-.006,3.012,.046,.167,.016,C.steel,.88,.003);
      io.box(x-.034,-.023,3.014,.071,.099,.006,C.black,.08);
      for(let k=0;k<4;k++)io.box(x-.034,-.060+k*.027,3.019,.057,.008,.005,C.darkSteel,.62);
      io.box(x-.052,.066,3.018,.014,.025,.007,[.12,.30,.18],.12);
      io.box(x-.018,.066,3.018,.011,.017,.007,C.black,.08);
      io.box(x,.105,2.76,.125,.012,.23,C.nickel,.64);
    }
    const port=(x,y,w,h,type)=>{
      io.bevel(x,y,2.976,w,h,.073,C.bright,.87,.003);
      io.box(x,y,3.016,w-.016,h-.014,.010,C.black,.05);
      io.box(x,y-h*.30,3.024,w-.037,.005,.007,C.gold,.81);
      if(type==='osfp'){
        io.box(x,y,2.759,w+.024,h+.018,.348,C.nickel,.89);
        for(let i=0;i<6;i++)io.box(x-w*.35+i*w*.14,y+h*.62,2.757,w*.037,.019,.29,C.steel,.85);
        io.box(x,y+h*.32,3.020,w*.52,.004,.008,C.steel,.81);
      }else for(let i=0;i<8;i++)io.box(x-w*.31+i*w*.088,y-h*.25,3.024,.006,.008,.006,C.gold,.86);
    };
    port(-1.60,-.015,.225,.130,'osfp');port(-1.325,-.015,.225,.130,'osfp');port(-1.056,-.024,.178,.135,'rj45');
    port(1.12,-.038,.225,.12,'osfp');port(1.40,-.038,.225,.12,'osfp');
    port(.965,.049,.126,.093,'rj45');
    io.bevel(1.37,.075,2.958,.49,.050,.068,C.darkSteel,.79,.003); // DPU mezzanine fascia.
    for(let i=0;i<9;i++)io.box(1.19+i*.043,.075,2.995,.019,.029,.007,C.black,.1);
    for(const x of [1.695,1.737])io.cylinder([x,.042,3.0],[x,.042,3.019],.014,x<1.72?[.15,.33,.22]:[.24,.26,.25],.15,12);
    io.cylinder([1.71,-.042,3.004],[1.71,-.042,3.024],.025,C.darkSteel,.61,16);
    // Perforated front zones carry real geometry so grazing light reads depth.
    for(const x0 of [-1.72,1.59])for(let j=0;j<3;j++)for(let i=0;i<3;i++)io.box(x0+i*.035,-.074+j*.053,3.005,.013,.026,.012,C.black,.1);

    // Rear: coolant fittings, independent data cartridges and central busbar.
    for(const side of [-1,1]){
      const x=side*1.84;
      cf.cylinder([x,.026,-2.78],[x,.026,-3.041],.057,C.nickel,.91,24);
      cf.cylinder([x,.026,-2.92],[x,.026,-2.995],.076,C.steel,.92,6);
      cf.cylinder([x,.026,-3.036],[x,.026,-3.075],.049,C.nickel,.94,24);
      cf.cylinder([x,.026,-3.063],[x,.026,-3.087],.035,C.black,.10,24);
      cf.cylinder([x,.026,-2.845],[x,.026,-2.877],.059,side<0?C.inlet:C.outlet,.25,24);
      for(let i=0;i<4;i++)cf.cylinder([x,.026,-2.89-i*.025],[x,.026,-2.896-i*.025],.059,C.bright,.96,24);
    }
    for(const x of [-1.33,-.54,.54,1.33]){
      io.bevel(x,-.011,-2.995,.60,.186,.08,C.nickel,.86,.008);
      for(const dx of [-.149,.149]){
        io.box(x+dx,-.009,-3.041,.267,.133,.016,C.black,.10);
        io.box(x+dx,-.055,-3.052,.237,.025,.004,C.gold,.86);
        for(let i=0;i<13;i++)io.box(x+dx-.11+i*.0183,-.023,-3.054,.008,.034,.005,C.gold,.86);
      }
      io.box(x,.090,-3.02,.13,.027,.027,C.darkSteel,.75);
    }
    io.bevel(0,-.016,-3.009,.235,.213,.12,C.black,.12,.008);
    for(const x of [-.051,.051])io.bevel(x,-.018,-3.101,.037,.102,.124,C.gold,.9,.004);
    // A single continuous conceptual circuit avoids intersecting supply/return
    // branches. The exact OEM internal circuit is unpublished; these external
    // paths are an original mechanically plausible visual approximation.
    // Plate ports all meet the tube center at y=.100; no blind/floating joins.
    const y=.100,gpuPortZ=-2.18+(.66+.126)/2-.03;
    const supplyPath=[[-1.84,.026,-2.79],[-1.84,y,-2.63],[-1.84,y,-1.63],[-1.51,y,-1.63],[-1.51,y,gpuPortZ]];
    const returnPath=[[1.51,y,gpuPortZ],[1.51,y,-1.63],[1.84,y,-1.63],[1.84,y,-2.63],[1.84,.026,-2.79]];
    const connections=[
      [[-1.27,y,gpuPortZ],[-.67,y,gpuPortZ]],
      [[-.43,y,gpuPortZ],[-.43,y,-1.10],[-.685,y,-1.10]],
      [[-1.245,y,-1.10],[-1.76,y,-1.10],[-1.76,y,-.47],[1.76,y,-.47],[1.76,y,-1.10],[1.245,y,-1.10]],
      [[.685,y,-1.10],[.43,y,-1.10],[.43,y,gpuPortZ]],
      [[.67,y,gpuPortZ],[1.27,y,gpuPortZ]]
    ];
    // A revision-2 single-board GLB owns these three left-side hoses. Revision
    // 1 and the default scene retain every original tube. The rest of the tray
    // stays procedural; replacing a board never silently removes shared pipes.
    if(!replaceLeftPlumbing)cf.tube(supplyPath,.021,C.nickel,.92,16);
    cf.tube(returnPath,.021,C.nickel,.92,16);
    connections.forEach((path,i)=>{if(!replaceLeftPlumbing||i>=2)cf.tube(path,.018,C.nickel,.92,16);});
    // Only the known supply/return endpoints are colored outside the plates;
    // arrows over the covers describe heat exchange, not unpublished channels.
    parts['flow-supply'].tube((replaceLeftPlumbing?options.supplyOverlayPath:supplyPath).map(p=>[p[0],p[1]+.023,p[2]]),.010,C.inlet,.18,10);
    parts['flow-return'].tube(returnPath.map(p=>[p[0],p[1]+.023,p[2]]),.010,C.outlet,.18,10);
    for(const side of [-1,1])for(const z of [-2.48,-1.89]){
      cf.box(side*1.84,.078,z,.071,.014,.087,C.darkSteel,.65);
      cf.screw(side*1.878,.087,z,.010);
    }
    // A brushed removable sheet lid closes after the cooling section is shown.
    lid.bevel(0,.131,0,3.858,.012,5.83,C.steel,.86,.003);
    for(const side of [-1,1])lid.box(side*1.89,.137,.04,.012,.002,5.58,C.bright,.89);
    for(const z of [-2.63,2.63])for(const x of [-1.80,0,1.80])lid.screw(x,.136,z,.017);
    lid.bevel(0,.138,2.47,.58,.002,.27,C.darkSteel,.52,.0005);
    for(let i=0;i<12;i++)lid.line(-.235,2.39+i*.012,.14-(i%3)*.07,2.39+i*.012,.1395,.003,C.steel,.5);
    const meshes=Object.fromEntries(Object.entries(parts).map(([id,m])=>['l10-'+id,{data:new Float32Array(m.data)}]));
    return {meshes,bounds:{min:[-2,-.137,-3.17],max:[2,.143,3.075]},profile};
  }
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
  function sample(progress) {
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    const at=(a,b)=>smooth((p-a)/(b-a));
    const cooling=at(.42,.62),ghost=at(.64,.67)*(1-at(.735,.765));
    return {progress:p,boardOffset:(1-at(.10,.23))*.38,packageOffset:(1-at(.22,.34))*.76,
      ioOffset:(1-at(.31,.45))*.51,coolingOffset:(1-cooling)*1.25,
      lidOffset:(1-at(.79,.88))*1.70,lidOpacity:at(.765,.785),
      coolingOpacity:1-ghost*.27,flowOpacity:ghost,bridge:at(.88,1),
      phase:p<.10?'exploded':p<.31?'compute':p<.45?'io':p<.64?'cooling':p<.77?'flow':p<.88?'hero':'integration'};
  }
  window.PAL10Hardware=Object.freeze({profile,build,sample});
})();
