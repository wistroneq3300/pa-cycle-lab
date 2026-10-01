/* Original, dependency-free equipment illustrations, not vendor CAD or inventory.
 * Visual references: NVIDIA DGX GB300 compute / NVLink tray / power shelf and
 * SN2000-family switching; generic rack-mounted CDU and horizontal PDU.
 * Front proportions follow rack_size. I/O and fasteners retain their dimensions
 * when the enclosure grows; no guessed GPU, port count or live state is reported.
 * Compute and NVLink front panels are champagne gold by product direction;
 * NVLink enclosure, lid, side rails and rear fittings remain neutral metal.
 * No vendor photograph, texture, trademark or model file is redistributed. */
(() => {
  'use strict';
  const UNIT_HEIGHT = 41;
  const TYPES = {
    server: {label:'\u4f3a\u670d\u5668',en:'COMPUTE SYSTEM',units:1,depth:176,reference:'GB300 \u5916\u89c0\u8a9e\u5f59\u53c3\u8003\uff0c\u975e\u6a5f\u578b\u8fa8\u8b58'},
    switch: {label:'\u7db2\u8def\u4ea4\u63db\u5668',en:'NETWORK SWITCH',units:1,depth:132,reference:'SN2000 \u7cfb\u5217\u5916\u89c0\u53c3\u8003\uff0c\u975e\u6a5f\u578b\u8fa8\u8b58'},
    nvlink: {label:'NVLink Switch Tray',en:'NVLINK SWITCH TRAY',units:1,depth:169,reference:'NVLink Switch Tray \u5916\u89c0\u793a\u610f\uff0c\u975e\u6a5f\u578b\u8fa8\u8b58'},
    cdu: {label:'\u51b7\u537b\u5206\u914d\u55ae\u5143',en:'COOLANT DISTRIBUTION',units:4,depth:138,reference:'\u901a\u7528\u6a5f\u67b6\u5f0f CDU \u793a\u610f\uff0c\u975e\u7279\u5b9a\u6a5f\u578b'},
    pdu: {label:'\u96fb\u6e90\u5206\u914d\u5668',en:'POWER DISTRIBUTION',units:1,depth:64,reference:'\u901a\u7528\u6c34\u5e73\u5f0f PDU \u793a\u610f\uff0c\u975e\u7279\u5b9a\u6a5f\u578b'},
    powershelf: {label:'\u96fb\u6e90\u6a21\u7d44\u5c64',en:'POWER SHELF',units:1,depth:145,reference:'\u516d\u6a21\u7d44 Power Shelf \u5916\u89c0\u793a\u610f\uff0c\u975e\u6a5f\u578b\u8fa8\u8b58'},
    storage: {label:'\u5132\u5b58\u8a2d\u5099',en:'STORAGE ARRAY',units:2,depth:175,reference:'\u901a\u7528\u78c1\u789f\u9663\u5217\u793a\u610f\uff0c\u975e\u7279\u5b9a\u6a5f\u578b'},
    network: {label:'\u7db2\u8def\u8a2d\u5099',en:'NETWORK APPLIANCE',units:1,depth:108,reference:'\u901a\u7528\u7db2\u8def\u8a2d\u5099\u793a\u610f\uff0c\u975e\u7279\u5b9a\u6a5f\u578b'},
    blanking: {label:'\u64cb\u677f',en:'BLANKING PANEL',units:1,depth:10,reference:'\u6a5f\u6ac3\u64cb\u677f\u793a\u610f\uff0c\u4e0d\u4ee3\u8868\u8a2d\u5099'}
  };
  let sequence = 0;
  const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function typeOf(machine) {
    if (typeof machine === 'string') return Object.hasOwn(TYPES,machine) ? machine : 'server';
    if (machine && Object.hasOwn(TYPES,machine.mgx_type)) return machine.mgx_type;
    if (typeof mgxTypeOf === 'function') {
      const result = mgxTypeOf(machine);
      if (Object.hasOwn(TYPES,result)) return result;
    }
    return 'server';
  }
  const label = type => TYPES[typeOf(type)].label;
  const caption = type => TYPES[typeOf(type)].reference + ' \u00b7 \u975e\u672c\u6a5f\u5be6\u969b\u5916\u89c0';
  function sizeOf(machine, spec) {
    const value = machine && typeof machine === 'object' ? Number(machine.rack_size) : NaN;
    return Number.isInteger(value) && value >= 1 && value <= 48 ? value : spec.units;
  }
  function rect(x,y,w,h,fill,stroke='',rx=0,extra='') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width=".6"`:''}${extra?` ${extra}`:''}/>`;
  }
  const circle = (x,y,r,fill,extra='') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  const line = (x1,y1,x2,y2,stroke,width=1,opacity=1) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;
  function front(type,id,h,units) {
    const material = ['server','nvlink'].includes(type) ? 'champagne' : type==='cdu'?'cdu-metal':['switch','powershelf','pdu','network','blanking'].includes(type) ? 'dark' : 'front';
    const metal=`url(#${id}-${material})`, dark=`url(#${id}-dark)`, edge=`url(#${id}-edge)`;
    const mesh=`url(#${id}-mesh)`, grain=`url(#${id}-grain)`;
    const screw = (x,y,r=1.5) => circle(x,y,r,'#111c23') + circle(x,y,r*.69,'#77878c') + line(x-r*.45,y,x+r*.45,y,'#24323a',.55);
    const status = (x,y) => circle(x,y,1.35,'#556f55') + circle(x,y+4,1.15,'#324b54');
    const handle = (x,y,height) => rect(x-1,y,13,height,'#161c1e','',4)+rect(x,y-.3,11,height,type==='nvlink'?`url(#${id}-champagne)`:edge,type==='nvlink'?'#e6d9b4':'#d3d9d5',4)+rect(x+1.7,y+3,2,height-6,type==='nvlink'?'#f0e4c3':'#e0e2d8','',1)+line(x+9,y+4,x+9,y+height-4,type==='nvlink'?'#746647':'#414b4b',.9);
    const grille = (x,y,w,gh,gold=false) => rect(x,y,w,gh,'#071015',gold?'#c2ad7d':'#535f62',1) + rect(x+.7,y+.7,w-1.4,gh-1.4,gold?`url(#${id}-mesh-champagne)`:mesh);
    const cage = type==='server'?`url(#${id}-champagne)`:edge;
    const port = (x,y,w=18,ph=8) => rect(x-.8,y-.8,w+1.6,ph+1.6,cage,'#222f37',.4)+rect(x,y,w,ph,'#060d12','',.4)+rect(x+1,y+ph-2,w-2,.75,'#626e64')+line(x+1,y+1,x+w-1,y+1,'#6e777b',.5);
    const rj45 = (x,y,w=13,ph=10) => rect(x-.8,y-.8,w+1.6,ph+1.6,cage,'#26343a',.7)+`<path d="M${x+2} ${y}H${x+w-2}V${y+2}H${x+w}V${y+ph}H${x}V${y+2}H${x+2}Z" fill="#071117"/>`+line(x+3,y+ph-2,x+w-3,y+ph-2,'#939976',.6);
    const fan = (x,y,r) => {
      let f=circle(x,y,r,'#060c11',`stroke="#647077" stroke-width=".7"`)+circle(x,y,r*.76,'#121c22',`stroke="#3c4b53" stroke-width=".65"`);
      for(let a=0;a<6;a++) f+=`<path d="M${x+2} ${y-1}C${x+r*.87} ${y-r*.66},${x+r*.72} ${y+r*.2},${x+r*.55} ${y+r*.38}L${x+1} ${y+2}Z" fill="#536166" transform="rotate(${a*60} ${x} ${y})" opacity=".64"/>`;
      return f+circle(x,y,r*.18,'#6a777c');
    };
    let content=rect(0,0,440,h,metal,'#5c6c73',2)+rect(1,1,438,h-2,grain,'',1);
    content+=line(3,1.4,437,1.4,['server','nvlink'].includes(type)?'#eee5c9':'#ced7d7',.8,.82)+line(3,h-1.5,437,h-1.5,'#030a0e',1,.92);
    for(const x of [6,434]) for(const y of [8,h-8]) content+=screw(x,y);
    content+=line(13,3,13,h-3,'#091218',.8,.65)+line(427,3,427,h-3,'#cad3d0',.6,.5);

    if(type==='server') {
      content+=handle(16,4,h-8)+handle(413,4,h-8);
      // Fixed-size GB300-inspired upper I/O deck, independent of chassis height.
      content+=grille(33,4,111,31,true)+grille(301,4,106,31,true);
      content+=port(42,26,21,7)+port(86,26,21,7)+rj45(122,24,14,10);
      content+=rect(150,3,113,33,`url(#${id}-champagne-shadow)`,'#e1d6b4',1);
      for(let col=0;col<8;col++) {
        const x=154+col*13.2;
        content+=rect(x,5,11.4,29,'#312f29','#a89e82',.6)+rect(x+1,6,8.3,25,metal,'#d2c5a6',.4);
        content+=line(x+1,12,x+8.7,12,'#574f3d',.55)+rect(x+8.9,7,1.6,7,'#131b1d')+rect(x+8.9,16,1.6,8,'#131b1d');
        content+=circle(x+3,24,.55,'#667957')+circle(x+5.3,24,.55,'#6a725d');
      }
      content+=rect(267,4,29,32,metal,'#b1a383',.7)+rj45(270,13,12,10)+port(270,27,12,4)+port(287,26,5,7);
      content+=circle(273,7,1.45,'#8b8e72',`stroke="#534c3e" stroke-width=".5"`)+circle(289,7,1.45,'#868d73')+status(289,14);
      content+=rj45(310,7,15,10)+port(343,8,24,8)+port(372,8,24,8)+port(310,26,22,7)+port(357,26,22,7);
      content+=rect(214,35,8,3,edge,'#7b7b6d',.6);
      if(units>1) {
        const rows=Math.min(12,units-1), rowHeight=(h-UNIT_HEIGHT)/rows;
        content+='<g data-hardware-zone="server-extension" data-hardware-material="gray">';
        content+=rect(30,UNIT_HEIGHT,380,h-UNIT_HEIGHT-2,`url(#${id}-server-extension)`,'#475962',.5);
        content+=line(31,40,409,40,'#e0d4b4',.75);
        for(let row=0;row<rows;row++) {
          const y=UNIT_HEIGHT+(row+.5)*rowHeight, ventHeight=Math.min(31,rowHeight-5);
          content+=grille(35,y-ventHeight/2,370,ventHeight);
          content+=line(32,y+rowHeight/2-2,408,y+rowHeight/2-2,'#394952',.8);
          content+=screw(31,y,1.15)+screw(409,y,1.15);
        }
        content+='</g>';
      }
    } else if(type==='switch') {
      const cy=h/2-15;
      content+=rect(16,cy,407,30,'#111b20','#4a575d',1);
      // Two separated 16-port banks; a face illustration, not inventory.
      for(let bank=0;bank<2;bank++) for(let row=0;row<2;row++) for(let col=0;col<8;col++) {
        const x=23+bank*211+col*22.7,y=cy+5+row*12;
        content+=port(x,y,19,8)+circle(x+17,y+2,.52,'#74865d');
      }
      content+=grille(208,cy+3,19,24)+screw(217.5,cy+15)+status(416,cy+12);
      if(units>1) {content+=grille(25,5,391,Math.max(9,cy-10));content+=grille(25,cy+35,391,Math.max(9,h-cy-40));}
    } else if(type==='nvlink') {
      // Installed front reference: a closed face, not the top-view pull handle.
      // Small left I/O openings and a pressed-metal lower lip are the signature.
      content+=rect(20,3,400,h-6,`url(#${id}-champagne)`,'#d3c49c',.7)+rect(21,4,398,h-8,grain);
      const cy=UNIT_HEIGHT/2;
      content+=rect(25,cy-10,106,20,`url(#${id}-champagne-shadow)`,'#c2b58d',.8);
      for(let i=0;i<5;i++) content+=port(31+i*19,cy-5,i===4?10:13,8);
      content+=circle(127,cy-6,.75,'#73785a')+circle(127,cy-2,.6,'#6a705b');
      content+=line(134,h-7,416,h-7,'#625a43',1.5,.88)+line(134,h-8.3,416,h-8.3,'#ebddba',.8,.85);
      content+=rect(203,h-8,7,4.2,`url(#${id}-champagne)`,'#78694a',.45)+line(205,h-7,208,h-7,'#eee1bd',.6);
      for(const x of [15,420]) {
        content+=rect(x,3,5,h-6,`url(#${id}-champagne)`,'#a18f65',.8)+line(x+1.3,5,x+1.3,h-5,'#f0e4c3',.7,.8);
      }
      for(const x of [23,417]) for(const y of [7,h-7]) content+=screw(x,y,1.0);
    } else if(type==='powershelf') {
      // Match the Rack 3D face: a shared left controller and six fan modules per U.
      const cy=h/2-16;
      content+=rect(16,3,23,h-6,dark,'#667478',.5)+rj45(21,cy+8,12,13)+circle(27,cy+26,1.3,'#755a50');
      for(let row=0;row<units;row++) {
        const y=row*UNIT_HEIGHT+(UNIT_HEIGHT-32)/2;
        content+=`<g data-hardware-zone="powershelf-fan-row" data-row="${row+1}">`;
        for(let i=0;i<6;i++) {
          const x=42+i*63;
          content+=rect(x,y,61,32,'#10171c','#727d7f',.6)+fan(x+25,y+16,13)+rect(x+2,y+2,43,28,`url(#${id}-fan-grid)`);
          content+=rect(x+48,y-.7,10,33.4,dark,'#8b9698',1.1)+line(x+49,y+1,x+49,y+30,'#b0b8b4',.8,.65)+circle(x+5,y+5,.8,'#6d8256')+circle(x+5,y+8,.8,'#6d8256');
        }
        content+='</g>';
      }
    } else if(type==='cdu') {
      // Charcoal powder-coated cooling appliance. The black HMI is unlit:
      // reflections are material detail, never invented telemetry or readings.
      const powder=`url(#${id}-cdu-powder)`, shell=`url(#${id}-cdu-metal)`;
      content+=rect(0,0,22,h,shell,'#15191e',1)+rect(418,0,22,h,shell,'#15191e',1);
      for(const x of [6,424]) for(const y of [h*.14,h*.82]) content+=rect(x,y,10,5,'#020508','#454b51',2.5);
      content+=rect(24,1,392,h-2,shell,'#171c22',1.3)+rect(24.8,1.8,390.4,h-3.6,powder,'',1);
      content+=line(25,2,414,2,'#767c83',.75,.6)+line(25,h-2,414,h-2,'#05090d',1.2,.9);
      content+=line(24,3,24,h-3,'#747c82',.55,.65)+line(415,3,415,h-3,'#0b1117',1.3,.9);
      const ventY=h*.60, ventHeight=h-ventY-8;
      content+=rect(60,ventY,320,ventHeight,`url(#${id}-cdu-honeycomb)`);
      const handleTop=Math.max(8,h*.22), handleBottom=h-Math.max(8,h*.17);
      for(const [x,side] of [[40,1],[400,-1]]) {
        for(const y of [handleTop,handleBottom]) content+=circle(x,y,5.3,'#10161b')+circle(x,y,4.5,edge,`stroke="#8b959a" stroke-width=".55"`)+circle(x,y,2.3,'#bac2c5');
        const hx=x-3*side;
        const curve=`M${x} ${handleTop}Q${hx} ${handleTop} ${hx} ${handleTop+5}V${handleBottom-5}Q${hx} ${handleBottom} ${x} ${handleBottom}`;
        content+=`<path d="${curve}" fill="none" stroke="#080d12" stroke-width="8.4" stroke-linecap="round"/><path d="${curve}" fill="none" stroke="${edge}" stroke-width="5.8" stroke-linecap="round"/>`;
        content+=line(hx-.9,handleTop+5,hx-.9,handleBottom-5,'#eef1eb',.85,.85);
      }
      const bezelW=114, bezelH=Math.min(98,h-15), bezelX=163, bezelY=h*.51-bezelH/2;
      content+=rect(bezelX-1.5,bezelY-1.5,bezelW+3,bezelH+3,'#080c10','#373e44',3);
      content+=rect(bezelX,bezelY,bezelW,bezelH,`url(#${id}-cdu-bezel)`,'#797f83',2.2)+rect(bezelX+2,bezelY+2,bezelW-4,bezelH-4,'#252a31','#0d1116',1.4);
      content+=line(bezelX+3,bezelY+3,bezelX+bezelW-3,bezelY+3,'#a0a5a7',.5,.6)+line(bezelX+3,bezelY+4,bezelX+3,bezelY+bezelH-4,'#747d83',.65,.65);
      const padY=Math.min(13,bezelH*.16), screenX=bezelX+13, screenY=bezelY+padY, screenW=88, screenH=Math.min(53,bezelH*.56);
      content+=rect(screenX-.7,screenY-.7,screenW+1.4,screenH+1.4,'#080c10','#91999c',.7)+rect(screenX,screenY,screenW,screenH,`url(#${id}-cdu-screen)`,'#1d242a',.3);
      content+=`<path d="M${screenX+.5} ${screenY+.5}H${screenX+32}L${screenX+59} ${screenY+screenH-.5}H${screenX+.5}Z" fill="url(#${id}-cdu-glass)"/>`;
      content+=line(screenX+1,screenY+1,screenX+screenW-1,screenY+1,'#aeb7bb',.4,.5)+line(screenX+1,screenY+1,screenX+1,screenY+screenH-1,'#747e84',.45,.7);
      for(const x of [bezelX+3,bezelX+bezelW-3]) content+=circle(x,bezelY+bezelH-3,.7,'#4e565d');
      const buttonY=h*.26, buttonR=Math.min(10,h*.17);
      content+=circle(354,buttonY,buttonR+1.5,'#0b1015')+circle(354,buttonY,buttonR,edge,`stroke="#cbd2d4" stroke-width=".7"`)+circle(354,buttonY,buttonR-2.2,'#a5adb1',`stroke="#e6ecea" stroke-width=".8"`);
      content+=`<path d="M${354-buttonR*.67} ${buttonY}A${buttonR*.67} ${buttonR*.67} 0 0 1 ${354+buttonR*.67} ${buttonY}" fill="none" stroke="#f0f3ee" stroke-width=".6" opacity=".75"/>`;
      const portY=h*.67, portR=Math.min(11,h*.17);
      for(const x of [295,324,353]) {
        content+=circle(x,portY,portR+1,'#080e13')+circle(x,portY,portR,`url(#${id}-cdu-bezel)`,`stroke="#636d75" stroke-width=".5"`)+circle(x,portY,portR-2.2,'#1b2229',`stroke="#464f56" stroke-width=".45"`);
        const pw=Math.min(12,portR*1.2),ph=Math.min(9,portR*.9);
        content+=rj45(x-pw/2,portY-ph/2,pw,ph);
        if(units>1) content+=line(x-3.4,portY-portR-4,x+3.4,portY-portR-4,'#7e8990',1.2,.7);
      }
    } else if(type==='pdu') {
      const cy=h/2-13;
      content+=rect(17,cy-2,312,30,dark,'#526169',1);
      for(let i=0;i<8;i++) {
        const x=22+i*38;
        content+=rect(x,cy,31,25,'#222c33','#637078',2);
        content+=`<path d="M${x+8} ${cy+4}h15l3 4v13H${x+5}V${cy+8}Z" fill="#030a0f" stroke="#536269" stroke-width=".5"/>`;
        content+=rect(x+10,cy+9,2.3,6,'#84918e')+rect(x+20,cy+9,2.3,6,'#84918e')+rect(x+15.3,cy+17,2.3,4,'#84918e');
      }
      content+=rect(340,cy-2,63,28,'#11252f','#72868d',2)+rect(345,cy+2,52,14,'#081820','',1)+line(351,cy+9,389,cy+9,'#759299',1.3);
      for(const x of [351,365,379]) content+=circle(x,cy+21,1.3,'#658177');
      content+=status(416,cy+9);
    } else if(type==='storage') {
      content+=handle(16,6,h-12)+handle(413,6,h-12);
      const rows=Math.max(1,Math.floor((h-12)/21)), yStart=(h-rows*21)/2;
      for(let row=0;row<rows;row++) for(let col=0;col<8;col++) {
        const x=33+col*47,y=yStart+row*21;
        content+=rect(x,y,44,19,dark,'#849297',1)+grille(x+2,y+2,28,15)+rect(x+32,y+2,9,14,edge,'#a9b3b3',1)+rect(x+35,y+4,3,8,'#23333a','',.6)+circle(x+38,y+16,.9,'#6b8154');
      }
    } else if(type==='network') {
      const cy=h/2-13;
      content+=rect(17,cy,122,27,dark,'#5d727b',1)+rect(23,cy+6,51,12,'#071e2a','',1)+line(29,cy+12,65,cy+12,'#6a939e',1)+status(86,cy+8)+rj45(106,cy+7,18,13);
      for(let i=0;i<8;i++) content+=rj45(154+i*25,cy+7,19,13);
      content+=port(363,cy+8,20,11)+port(391,cy+8,20,11);
    } else {
      content+=line(19,6,421,6,'#8b999e',.65,.6)+line(19,h-6,421,h-6,'#02090e',1,.9);
      for(let y=UNIT_HEIGHT;y<h;y+=UNIT_HEIGHT) content+=line(18,y,422,y,'#95a2a7',.6,.12);
      content+=rect(204,h/2-1,32,2,'#60737b','',1);
    }
    return content;
  }
  function definitions(id) {
    return `<defs>
      <linearGradient id="${id}-top" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#d2d8d8"/><stop offset=".28" stop-color="#afb7b8"/><stop offset=".61" stop-color="#7e8c95"/><stop offset="1" stop-color="#b9c5c9"/></linearGradient>
      <linearGradient id="${id}-front" x2=".12" y2="1"><stop stop-color="#d0d8d7"/><stop offset=".08" stop-color="#919f9f"/><stop offset=".42" stop-color="#abb7b8"/><stop offset=".87" stop-color="#73858d"/><stop offset="1" stop-color="#3a4a54"/></linearGradient>
      <linearGradient id="${id}-champagne" x2=".08" y2="1"><stop stop-color="#f2e8ca"/><stop offset=".1" stop-color="#c9ba8f"/><stop offset=".48" stop-color="#ab9a70"/><stop offset=".78" stop-color="#d5c69d"/><stop offset="1" stop-color="#6c6249"/></linearGradient>
      <linearGradient id="${id}-champagne-shadow" x2="0" y2="1"><stop stop-color="#706850"/><stop offset=".36" stop-color="#b1a480"/><stop offset="1" stop-color="#595641"/></linearGradient>
      <linearGradient id="${id}-side" x2="1" y2="1"><stop stop-color="#75888f"/><stop offset=".53" stop-color="#41515c"/><stop offset="1" stop-color="#162931"/></linearGradient>
      <linearGradient id="${id}-dark" x2=".12" y2="1"><stop stop-color="#43505a"/><stop offset=".11" stop-color="#242e36"/><stop offset=".72" stop-color="#1b252d"/><stop offset="1" stop-color="#071017"/></linearGradient>
      <linearGradient id="${id}-server-extension" x2=".12" y2="1"><stop stop-color="#7b898f"/><stop offset=".18" stop-color="#62727a"/><stop offset=".8" stop-color="#53636b"/><stop offset="1" stop-color="#394952"/></linearGradient>
      <linearGradient id="${id}-edge" x2="1"><stop stop-color="#6d7678"/><stop offset=".21" stop-color="#dbe1da"/><stop offset=".4" stop-color="#a8b2af"/><stop offset=".69" stop-color="#dce1d9"/><stop offset="1" stop-color="#56646a"/></linearGradient>
      <linearGradient id="${id}-satin" x2="1" y2=".15"><stop stop-color="#a4b1b5"/><stop offset=".37" stop-color="#d5ddd9"/><stop offset=".67" stop-color="#b6c1c1"/><stop offset="1" stop-color="#8a9ca4"/></linearGradient>
      <linearGradient id="${id}-cdu-metal" x2=".25" y2="1"><stop stop-color="#383c43"/><stop offset=".26" stop-color="#282d34"/><stop offset=".7" stop-color="#22272e"/><stop offset="1" stop-color="#131a21"/></linearGradient>
      <linearGradient id="${id}-cdu-top" x2=".4" y2="1"><stop stop-color="#565a61"/><stop offset=".34" stop-color="#41464e"/><stop offset="1" stop-color="#292f37"/></linearGradient>
      <linearGradient id="${id}-cdu-bezel" x2=".2" y2="1"><stop stop-color="#535a61"/><stop offset=".18" stop-color="#333940"/><stop offset=".8" stop-color="#222830"/><stop offset="1" stop-color="#454d54"/></linearGradient>
      <linearGradient id="${id}-cdu-screen" x2=".5" y2="1"><stop stop-color="#020406"/><stop offset=".7" stop-color="#060a0e"/><stop offset="1" stop-color="#151b22"/></linearGradient>
      <linearGradient id="${id}-cdu-glass" x2=".2" y2="1"><stop stop-color="#ccd3da" stop-opacity=".19"/><stop offset=".55" stop-color="#b9c4d0" stop-opacity=".08"/><stop offset="1" stop-color="#d9e1e5" stop-opacity=".03"/></linearGradient>
      <pattern id="${id}-cdu-powder" width="6" height="5" patternUnits="userSpaceOnUse"><circle cx=".6" cy=".7" r=".18" fill="#c0c7ce" opacity=".15"/><circle cx="3.7" cy="1.5" r=".22" fill="#080d13" opacity=".5"/><circle cx="2" cy="3.5" r=".2" fill="#87939c" opacity=".17"/><circle cx="5.2" cy="4.5" r=".16" fill="#070c12" opacity=".5"/></pattern>
      <pattern id="${id}-cdu-honeycomb" width="8" height="7" patternUnits="userSpaceOnUse"><path d="M4 .3L6.7 1.9 4 3.4 1.3 1.9Z M.6 2.8L3.4 4.3V6.8L.6 5.2Z M7.4 2.8L4.6 4.3V6.8L7.4 5.2Z" fill="#03090e"/><path d="M1.3 1.9L4 .3 6.7 1.9 M.6 2.8V5.2 M7.4 2.8V5.2" fill="none" stroke="#626c74" stroke-width=".22" opacity=".65"/></pattern>
      <pattern id="${id}-grain" width="11" height="3" patternUnits="userSpaceOnUse"><path d="M0 .4H11M3 2H9" stroke="#e8ece3" stroke-width=".25" opacity=".16"/><path d="M0 1.4H11" stroke="#172b34" stroke-width=".25" opacity=".14"/></pattern>
      <pattern id="${id}-mesh" width="3.4" height="3.4" patternUnits="userSpaceOnUse"><rect width="3.4" height="3.4" fill="#63716c"/><rect x=".65" y=".65" width="2.3" height="2.3" rx=".35" fill="#081117"/><path d="M.65 3H3" stroke="#a0aaa0" stroke-width=".23"/></pattern>
      <pattern id="${id}-mesh-champagne" width="3.4" height="3.4" patternUnits="userSpaceOnUse"><rect width="3.4" height="3.4" fill="#c4b182"/><rect x=".65" y=".65" width="2.3" height="2.3" rx=".35" fill="#081117"/><path d="M.65 3H3" stroke="#eee0b7" stroke-width=".23"/></pattern>
      <pattern id="${id}-fan-grid" width="3.3" height="3.3" patternUnits="userSpaceOnUse"><path d="M0 .5H3.3M.5 0V3.3" stroke="#070d11" stroke-width="1.1"/><path d="M0 1H3.3M1 0V3.3" stroke="#85918c" stroke-width=".25" opacity=".5"/></pattern>
    </defs>`;
  }
  function render(machineOrType, options = {}) {
    const type=typeOf(machineOrType), spec=TYPES[type], units=sizeOf(machineOrType,spec);
    const h=UNIT_HEIGHT*units, d=spec.depth;
    // Counter suffix avoids collisions even when callers reuse idPrefix.
    const id=`pa-hw-${String(options.idPrefix || type).replace(/[^a-zA-Z0-9_-]/g,'')}-${++sequence}`;
    const view=options.view==='front'?'front':'perspective', face=front(type,id,h,units);
    const y=Math.max(175,d+28), dy=30.8, dx=d*.52, right=500, viewHeight=y+h+70;
    let drawing;
    if(view==='front') drawing=`<g transform="translate(14,8)">${face}</g>`;
    else {
      const top=type==='cdu'?'cdu-top':type==='blanking'||type==='pdu'||type==='switch'?'dark':'top';
      const side=type==='cdu'?'cdu-metal':'side';
      drawing=`<ellipse cx="310" cy="${y+h+42}" rx="224" ry="12" fill="#071c26" opacity=".18"/><path d="M60 ${y}L${60+dx} ${y-d}L${right+dx} ${y-d+dy}L${right} ${y+dy}Z" fill="url(#${id}-${top})" stroke="#a0b0b5" stroke-width=".7"/><path d="M${right} ${y+dy}L${right+dx} ${y-d+dy}V${y-d+dy+h}L${right} ${y+dy+h}Z" fill="url(#${id}-${side})" stroke="#536770" stroke-width=".7"/>`;
      if(type!=='blanking') {
        drawing+=`<path d="M76 ${y-8}L${70+dx} ${y-d+7}L${right+dx-13} ${y-d+dy+7}" fill="none" stroke="#e5eae4" stroke-width=".7" opacity=".7"/>`;
        for(const p of [.15,.72]) {
          drawing+=line(73+dx*p,y-d*p,right-13+dx*p,y-d*p+dy,'#d8dfdc',.65,.7);
          drawing+=line(73+dx*p,y-d*p+1.3,right-13+dx*p,y-d*p+dy+1.3,'#435a66',.6,.55);
          for(let col=0;col<5;col++) {
            const sx=81+col*96+dx*p,sy=y-d*p+col*6.72+4;
            drawing+=circle(sx,sy,1.55,'#3a4a51')+circle(sx,sy-.6,.8,'#dfe5e0');
          }
        }
        for(const tx of [110,425]) {
          const ty=y-d*.47+(tx-60)*.07;
          drawing+=`<path d="M${tx+dx*.47} ${ty}l8-14h18l-8 14Z" fill="#647880" stroke="#d0d9d8" stroke-width=".7"/>`;
        }
        // Longitudinal rail and its fixed-size fasteners stay visible in profile.
        for(let i=0;i<5;i++) {
          const p=(i+.5)/5,sx=right+dx*p,sy=y+dy-d*p+Math.min(h*.5,15);
          drawing+=circle(sx,sy,1.3,'#111e26')+circle(sx-.3,sy-.4,.55,'#b6c4c5');
        }
        drawing+=line(right+4,y+dy+h-6,right+dx-4,y-d+dy+h-6,'#93a6ac',.9,.74);
      }
      drawing+=`<g transform="matrix(1 .07 0 1 60 ${y})">${face}</g>`;
      if(type==='cdu') {
        // Rear quick-connect fittings are illustrative; their state is not live.
        for(let i=0;i<Math.min(4,Math.max(2,units));i++) {
          const cy=y-d+dy+Math.min(h-7,12+i*(h-20)/4),cx=right+dx-5;
          drawing+=`<ellipse cx="${cx}" cy="${cy}" rx="6" ry="8" fill="url(#${id}-edge)" stroke="#3c565f" stroke-width=".8"/><ellipse cx="${cx+2}" cy="${cy}" rx="3" ry="5" fill="#142c35" stroke="${i%2?'#a35d54':'#4e90a7'}" stroke-width="1.6"/>`;
        }
      }
    }
    const description=caption(type)+'\u3002\u9762\u677f\u914d\u7f6e\u70ba\u5916\u89c0\u793a\u610f\uff0c\u4e0d\u4ee3\u8868\u5373\u6642\u72c0\u614b\u3001\u9023\u63a5\u57e0\u6578\u91cf\u6216\u786c\u9ad4\u898f\u683c\u3002';
    return `<svg class="pa-hardware-visual ${safe(options.className || '')}" data-hardware-type="${type}" data-hardware-view="${view}" data-hardware-units="${units}" data-hardware-material="${['server','nvlink'].includes(type)?'champagne':'neutral'}" viewBox="${view==='front'?`0 0 468 ${h+16}`:`0 0 630 ${viewHeight}`}" role="img" aria-label="${safe(label(type)+'\uff1a'+caption(type))}" xmlns="http://www.w3.org/2000/svg"><title>${safe(label(type))}</title><desc>${safe(description)}</desc>${definitions(id)}${drawing}</svg>`;
  }
  window.PAHardwareVisuals=Object.freeze({typeOf,label,caption,render,types:Object.freeze(Object.keys(TYPES))});
})();
