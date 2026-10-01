/* Isolated browser-only fixtures. No API request or terminal reaches a host.
 * QA query: ?preview=empty (empty workspace), loading (1.6s detail delay),
 * error (detail fails once per machine, then succeeds when retried),
 * scale (10 L10 projects × 5 systems, plus 3 mixed-component 48U racks).
 * Default rack is a custom GB300-inspired layout, not an exact vendor SKU.
 * All mutations reset on reload. No credentials are recorded in diagnostics. */
(() => {
  const nativeFetch = window.fetch.bind(window);
  const scenario = new URLSearchParams(location.search).get('preview') || 'normal';
  const requests = [], failedDetails = new Set();
  const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
  const projects = [
    {name:'fleet_l',desc:'System validation / GPU platforms',level:'system',order:0},
    {name:'node_i',desc:'System integration / compute nodes',level:'system',order:1},
    {name:'host_e',desc:'Firmware qualification',level:'system',order:2},
    {name:'node_h',desc:'Hardware verification',level:'system',order:3},
    {name:'client_c',desc:'System compatibility',level:'system',order:4},
    {name:'proj_k',desc:'Rack integration / compute, network, power & cooling',level:'rack',order:5}
  ];
  const machines = [];
  [4,3,2,2,1].forEach((count,p) => {
    for(let i=0;i<count;i++) {
      const n=machines.length+1;
      machines.push({name:['host_a','host_g','host_f','host_b'][i] && p===0 ? ['host_a','host_g','host_f','host_b'][i] : projects[p].name+'-'+String(i+1).padStart(2,'0'), project:projects[p].name,level:'system',mgx_type:'server',os_ip:'192.0.2.'+(20+n),bmc_ip:'198.51.100.'+(20+n),os_user:'demo',os_pass:'preview-only',bmc_user:'demo',bmc_pass:'preview-only',os_port:22,bmc_port:22,os_alive:n!==4&&n!==9,bmc_alive:n!==9,power:n===9?'OFF':'ON',order:i,rack_u:0,rack_size:1});
    }
  });
  // The U value is the top occupied slot. Physical height always comes from data.
  const rack=[
    ['BLANK-TOP-01','blanking',48,1],['BLANK-TOP-02','blanking',47,1],
    ['SW-01','switch',46,1],['SW-02','switch',45,1],
    ...Array.from({length:4},(_,i)=>['PS-'+String(i+1).padStart(2,'0'),'powershelf',44-i,1]),
    ['SERVER-04U','server',40,4],['SERVER-03U','server',36,3],['SERVER-02U','server',33,2],
    ...Array.from({length:9},(_,i)=>['NVLINK-'+String(i+1).padStart(2,'0'),'nvlink',31-i,1]),
    ...Array.from({length:9},(_,i)=>['SERVER-'+String(i+1).padStart(2,'0'),'server',22-i,1]),
    ...Array.from({length:4},(_,i)=>['PS-'+String(i+5).padStart(2,'0'),'powershelf',13-i,1]),
    ['BLANK-RESERVE-05U','blanking',9,5],['BLANK-BOTTOM-04U','blanking',4,4],['CDU-01','cdu',0,0]
  ];
  rack.forEach(([name,kind,u,size],i)=>machines.push({name,project:'proj_k',level:'rack',mgx_type:kind,rack_mount:kind==='cdu'?'external':'internal',rack_u:u,rack_size:size,order:i,os_ip:kind==='blanking'?'':'192.0.2.'+(100+i),os_user:'demo',os_pass:'preview-only',os_port:22,bmc_ip:kind==='server'?'198.51.100.'+(100+i):'',bmc_user:'demo',bmc_pass:'preview-only',os_alive:kind==='blanking'?null:i!==6,bmc_alive:kind==='server',power:kind==='blanking'?null:'ON',passive:kind==='blanking'}));
  let links=machines.filter(m=>m.project==='proj_k'&&m.mgx_type==='server').slice(0,3).map((m,i)=>({a:m.name,b:'SW-01',type:'eth',a_port:'eth0',b_port:'1/'+(i+1)}));
  if(scenario==='scale'){
    projects.length=0;machines.length=0;links=[];
    for(let p=1;p<=10;p++){
      const project='L10-Project-'+String(p).padStart(2,'0');
      projects.push({name:project,desc:'Scale fixture / 5 systems / synthetic inventory',level:'system',order:p-1});
      for(let i=1;i<=5;i++){
        const id=(p-1)*5+i;
        machines.push({name:project+'-SYS-'+String(i).padStart(2,'0'),project,level:'system',mgx_type:'server',os_ip:'192.0.2.'+(20+id),bmc_ip:'198.51.100.'+(20+id),os_user:'demo',os_pass:'preview-only',bmc_user:'demo',bmc_pass:'preview-only',os_port:22,bmc_port:22,os_alive:id%13!==0,bmc_alive:true,power:id%13===0?'OFF':'ON',order:i-1,rack_u:0,rack_size:1,preview_gpu:id%2===0});
      }
    }
    const composition=[['SW','switch',48,1],['NET','network',47,1],['SYS-A','server',46,2],['SYS-B','server',44,4],['SYS-C','server',40,4],['STORAGE','storage',36,4],['PS','powershelf',32,3],['PDU','pdu',29,2],['CDU','cdu',6,6],['BLANK','blanking',21,2],['SYS-D','server',19,2]];
    for(let p=1;p<=3;p++){
      const project='L11-Rack-'+String(p).padStart(2,'0');
      projects.push({name:project,desc:'Scale fixture / compute, network, storage, power and cooling',level:'rack',order:9+p});
      composition.forEach(([suffix,kind,u,size],i)=>{
        const name=project+'-'+suffix,id=100+(p-1)*20+i,passive=kind==='blanking';
        machines.push({name,project,level:'rack',mgx_type:kind,rack_u:u,rack_size:size,order:i,os_ip:passive?'':'203.0.113.'+id,bmc_ip:kind==='server'?'198.51.100.'+id:'',os_user:'demo',os_pass:'preview-only',bmc_user:'demo',bmc_pass:'preview-only',os_port:22,bmc_port:22,os_alive:passive?null:true,bmc_alive:kind==='server',power:passive?null:'ON',passive,preview_gpu:suffix==='SYS-B'});
        if(kind==='server')links.push({a:name,b:project+'-SW',type:'eth',a_port:'eth0',b_port:'1/'+i});
      });
    }
  }
  if(scenario==='empty'){projects.length=0;machines.length=0;links=[];}
  const now=Math.floor(Date.now()/1000);
  let library,lastScan=now,newMachineSequence=1;
  const response=(data,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}));
  const fail=(detail,status=400)=>response({ok:false,detail},status);
  const projectList=()=>projects.map(p=>({...p,machine_count:machines.filter(m=>m.project===p.name).length})).sort((a,b)=>a.order-b.order);
  const machineList=()=>[...machines].sort((a,b)=>a.order-b.order);
  const powerStatus=m=>'Chassis Power is '+(m.power==='ON'?'on':'off');
  const isCompute=m=>!m.mgx_type||m.mgx_type==='server';
  const gpuCount=m=>isCompute(m)?(m.preview_gpu===false?0:8):0;
  function fixtureDetail(m){
    if(!isCompute(m)){
      const models={nvlink:'NVLink Switch Tray',switch:'網路交換器',network:'網路設備',cdu:'液冷 CDU',pdu:'Rack PDU',powershelf:'Power Shelf',storage:'Storage enclosure',blanking:'Blanking panel'};
      return {machine:m,power:m.power?powerStatus(m):'',fw:[],os_info:{fetched_at:'Design preview',os:{},hw:{system:{model:(models[m.mgx_type]||'Rack component')+' · sample inventory'}}}};
    }
    return {machine:m,power:powerStatus(m),fw:[{key:'Firmware Revision',value:'2.10.0 (sample)'},{key:'IPMI Version',value:'2.0'},{key:'Manufacturer',value:'Wistron'}],os_info:{fetched_at:'Design preview',os:{distro:'Ubuntu 24.04 LTS',uptime:'12 days',cpu:'384',mem:'1536 GB'},hw:{cpu:{model:'AMD EPYC 9654 · sample inventory',sockets:2,cores:96,threads:2},dimm:{count:24,types:['DDR5'],speeds:['4800 MT/s'],parts:['64 GB ECC RDIMM']},ssd:[{name:'nvme0n1',model:'Enterprise NVMe',size:'3.84 TB'},{name:'nvme1n1',model:'Enterprise NVMe',size:'3.84 TB'}],gpu:Array.from({length:gpuCount(m)},(_,i)=>({name:'NVIDIA H100 · GPU '+i,mem:'80 GB',util:'Sample'})),nic:['01:00.0 Ethernet controller: Mellanox Technologies ConnectX-7'],firmware:{bios:{vendor:'AMI',version:'1.20 (sample)'},gpu:gpuCount(m)?[{index:'0–7',fw:'Sample VBIOS'}]:[]}}}};
  }
  function fixtureSensors(m){
    const byKind={server:['CPU1 Temp | 48 degrees C | ok','CPU2 Temp | 46 degrees C | ok','Inlet Temp | 24 degrees C | ok','Fan1 | 8400 RPM | ok','PSU1 | 230 Volts | ok','PSU2 | 230 Volts | ok'],switch:['Inlet Temp | 25 degrees C | ok','ASIC Temp | 51 degrees C | ok','PSU1 | 230 Volts | ok'],network:['Inlet Temp | 25 degrees C | ok'],cdu:['Coolant Inlet | 25 degrees C | ok','Coolant Outlet | 31 degrees C | ok','Flow | 80 L/min | ok'],pdu:['Input Voltage | 230 Volts | ok','Input Current | 12 Amps | ok'],powershelf:['Output Voltage | 54 Volts | ok','Output Current | 80 Amps | ok'],storage:['Enclosure Temp | 29 degrees C | ok'],blanking:[]};
    const entries=byKind[m.mgx_type||'server']||[];
    return {sensors:{total:entries.length,ok:entries.length,critical:0,warning:0,ns:0,entries}};
  }
  function placementError(m){
    const mount=m.rack_mount||'internal',cdu=m.mgx_type==='cdu';
    if(!['internal','external'].includes(mount))return {detail:'rack_mount must be internal or external.',status:400};
    if(mount==='external'&&(m.level!=='rack'||!cdu))return {detail:'\u53ea\u6709 CDU \u53ef\u4ee5\u653e\u5728\u6ac3\u5916\u3002',status:400};
    if(m.level!=='rack')return '';
    if(m.project&&!projects.some(p=>p.name===m.project))return {detail:'\u8acb\u9078\u64c7\u6709\u6548\u7684\u5c08\u6848\u3002',status:400};
    if(m.rack_side&&!['front','rear'].includes(m.rack_side))return {detail:'rack_side must be front or rear.',status:400};
    if(cdu&&m.project&&machines.some(x=>x.name!==m.name&&x.level==='rack'&&x.project===m.project&&x.mgx_type==='cdu'))return {detail:'\u6b64 Rack \u5df2\u6709 CDU\uff0c\u8acb\u7de8\u8f2f\u73fe\u6709 CDU \u7684\u5b89\u88dd\u65b9\u5f0f\u3002',status:409};
    if(mount==='external'){
      if(!m.project)return {detail:'\u5916\u7f6e CDU \u5fc5\u9808\u9078\u64c7\u5c08\u6848\u3002',status:400};
      m.rack_u=0;m.rack_size=0;return '';
    }
    const top=m.rack_u??0,height=m.rack_size??1,bottom=top-height+1;
    if(!Number.isInteger(top)||!Number.isInteger(height)||top<0||top>48||height<1||height>48)return {detail:'\u5143\u4ef6\u4f4d\u7f6e\u5fc5\u9808\u5728 U1\u2013U48 \u7bc4\u570d\u5167\u3002',status:400};
    if(!top)return '';
    if(!m.project||bottom<1)return {detail:'\u5143\u4ef6\u9700\u8981\u5c08\u6848\u8207\u5b8c\u6574\u7684 U \u7bc4\u570d\u3002',status:400};
    if(cdu&&bottom!==1)return {detail:'\u6ac3\u5167 CDU \u5fc5\u9808\u5f9e U1 \u5411\u4e0a\u4f54\u7528\u3002',status:400};
    return machines.some(x=>x.name!==m.name&&x.level==='rack'&&x.project===m.project&&x.rack_mount!=='external'&&x.rack_u>0&&bottom<=x.rack_u&&top>=x.rack_u-(x.rack_size||1)+1)?{detail:'\u76ee\u6a19 U \u69fd\u5df2\u88ab\u5176\u4ed6\u5143\u4ef6\u5360\u7528\u3002',status:409}:null;
  }

  const defs={server:{cpu_used:{label:'CPU',unit:'%',color:'#007b9e'},mem_used_pct:{label:'Memory',unit:'%',color:'#889f30'},gpu_power:{label:'GPU power',unit:'W',color:'#4893ac'}},switch:{port_rx:{label:'Port RX',unit:'MB/s'},port_tx:{label:'Port TX',unit:'MB/s'},temp:{label:'Temperature',unit:'°C'}},powershelf:{power_w:{label:'Power',unit:'W'},voltage:{label:'Voltage',unit:'V'},current_a:{label:'Current',unit:'A'}},pdu:{power_w:{label:'Power',unit:'W'},current_a:{label:'Current',unit:'A'}},cdu:{flow_lpm:{label:'Flow',unit:'L/min'},inlet_temp:{label:'Inlet',unit:'°C'},outlet_temp:{label:'Outlet',unit:'°C'},pressure:{label:'Pressure',unit:'bar'}}};
  const topologyDocs = new Map();
  if(scenario==='rack-network'){
    projects.push({name:'Naboo',desc:'Synthetic 32 tray network fixture',level:'rack',order:6});
    const devices=[],cables=[],nodesFor=(index)=>Array.from({length:4},(_,i)=>({
      id:'n'+i,name:'Node '+(i+1),bf4:'BF4 #'+(i+1),
      host_os:index===4?'':'10.250.'+index+'.'+(i+1),host_bmc:'',dpu_os:'',dpu_bmc:''
    }));
    const add=(name,type,u,size,index)=>{
      const unknown=name==='naboo-04'||name==='power-shelf-3';
      machines.push({name,project:'Naboo',level:'rack',mgx_type:type,rack_u:u,rack_size:size,rack_mount:type==='cdu'?'external':'internal',
        order:index,os_ip:unknown||type==='blanking'?'':'192.0.2.'+(index+1),bmc_ip:type==='server'?'198.51.100.'+(index+1):'',
        os_alive:true,bmc_alive:type==='server',power:type==='blanking'?null:'ON',passive:type==='blanking'});
    };
    for(let i=1;i<=2;i++){
      const name='Switch-2201-'+i;add(name,'switch',48-i,1,40+i);
      devices.push({id:'sw'+i,name,inventory:name,kind:'switch',nodes:[],ports:Array.from({length:48},(_,j)=>({id:'p'+(j+1),name:String(j+1),role:j===47?'uplink':i===1&&j>=32&&j<=34?'power':i===1&&j===35?'cooling':'other',nodes:[]}))});
    }
    for(let i=1;i<=32;i++){
      const name='naboo-'+String(i).padStart(2,'0'),nodes=nodesFor(i);add(name,'server',i+8,1,i);
      devices.push({id:'s'+i,name,inventory:name,kind:'server',nodes,ports:['host','dpu'].map((role,j)=>({id:role,name:'RJ45 #'+(j+1),role,nodes:nodes.map(n=>n.id)}))});
      ['host','dpu'].forEach((network,j)=>cables.push({id:network+i,network,state:'confirmed',note:'',a:{device:'s'+i,port:network},b:{device:'sw'+(j+1),port:'p'+i}}));
    }
    cables.push({id:'uplink',network:'uplink',state:'confirmed',note:'',a:{device:'sw1',port:'p48'},b:{device:'sw2',port:'p48'}});
    [6,7,44].forEach((u,i)=>{
      const name='power-shelf-'+(i+1),id='ps'+(i+1);add(name,'powershelf',u,1,50+i);
      devices.push({id,name,inventory:name,kind:'other',nodes:[],ports:[{id:'management',name:'\u7ba1\u7406\u57e0',role:'power',nodes:[]}]});
      cables.push({id:'power'+(i+1),network:'power',state:'confirmed',note:'',a:{device:id,port:'management'},b:{device:'sw1',port:'p'+(33+i)}});
    });
    add('CDU-1-main','cdu',0,0,55);
    devices.push({id:'cdu',name:'CDU-1-main',inventory:'CDU-1-main',kind:'other',nodes:[],ports:[{id:'management',name:'\u7ba1\u7406\u57e0',role:'cooling',nodes:[]}]});
    cables.push({id:'cooling',network:'cooling',state:'confirmed',note:'',a:{device:'cdu',port:'management'},b:{device:'sw1',port:'p36'}});
    add('BLANK-NABOO','blanking',48,1,56);
    topologyDocs.set('Naboo',{revision:1,racks:[{id:'naboo',name:'Naboo Rack',devices,links:cables}]});
  }
  function rackPingFixture(project){
    const topology=topologyDocs.get(project),devices=(topology?.racks||[]).flatMap(r=>r.devices);
    const nodes=machines.filter(m=>m.project===project&&m.level==='rack'&&(m.rack_u>0||m.rack_mount==='external')&&m.mgx_type!=='blanking').map(m=>{
      const d=devices.find(d=>d.inventory===m.name),hostNodes=(d?.nodes||[]).filter(n=>n.host_os);
      const targets=m.mgx_type==='server'&&hostNodes.length
        ? hostNodes.map(n=>({ip:n.host_os,field:'host_os',node_id:n.id,node_name:n.name,alive:!(m.name==='naboo-03'||m.name==='naboo-02'&&n.id==='n3')}))
        : (m.os_ip||m.mgx_type!=='server'&&m.bmc_ip)
          ? [{ip:m.os_ip||m.bmc_ip,field:m.os_ip?'os_ip':'bmc_ip',alive:!['Switch-2201-2','power-shelf-2'].includes(m.name)&&(m.os_ip?m.os_alive===true:m.bmc_alive===true)}] : [];
      const alive=targets.filter(t=>t.alive).length,configured=targets.length;
      return {name:m.name,level:m.level,os_ip:m.os_ip,bmc_ip:m.bmc_ip,os_alive:m.os_ip?m.os_alive:null,bmc_alive:m.bmc_ip?m.bmc_alive:null,
        rack_ping_state:configured?(alive===configured?'up':alive?'partial':'down'):'unknown',
        rack_ping_source:hostNodes.length?'topology_host_os':m.mgx_type==='server'?'legacy_os':'management',
        ping_counts:{configured,alive,down:configured-alive},ping_targets:targets};
    });
    return {ok:true,nodes,checked_at:new Date().toISOString()};
  }
  window.fetch=async (input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href),path=decodeURIComponent(url.pathname),method=(options.method||'GET').toUpperCase();
    if(!path.startsWith('/api/'))return nativeFetch(input,options);
    requests.push({method,path});if(requests.length>300)requests.shift();
    const minutes=Math.min(1440,Math.max(1,Number(url.searchParams.get('minutes'))||60));
    const sampleNow=Math.floor(Date.now()/1000),ts=Array.from({length:25},(_,i)=>sampleNow-minutes*60+i*minutes*60/24),wave=(base,amp)=>ts.map((_,i)=>Math.round((base+Math.sin(i*.65)*amp+Math.cos(i*.19)*amp*.3)*10)/10);
    let body={};try{body=JSON.parse(options.body||'{}');}catch{}
    const topologyPingMatch=path.match(/^\/api\/projects\/(.+)\/topology\/ping$/);
    if(topologyPingMatch){
      const name=topologyPingMatch[1],current=topologyDocs.get(name)||{revision:0,racks:[]};
      if(!projects.some(p=>p.name===name))return fail('找不到專案',404);
      if(method!=='POST')return fail('不支援的操作',405);
      const rack=current.racks.find(item=>item.id===body.rack_id);if(!rack)return fail('找不到指定的機櫃',404);
      const targets=[];for(const device of rack.devices){
        if(device.kind==='server'){
          for(const node of device.nodes)if(node.host_os)targets.push({device_id:device.id,node_id:node.id,field:'host_os',ip:node.host_os,alive:window.__qaTopologyAllUp||!node.host_os.endsWith('.78')});
          if(targets.some(target=>target.device_id===device.id))continue;
        }
        const machine=machines.find(item=>item.name===device.inventory),ip=machine?.os_ip||machine?.bmc_ip;
        if(ip)targets.push({device_id:device.id,node_id:'',field:'primary_ip',ip,alive:window.__qaTopologyAllUp||machine.os_alive!==false});
      }
      const alive=targets.filter(target=>target.alive).length;
      return response({ok:true,rack_id:rack.id,checked_at:new Date().toISOString(),duration_ms:42,targets,summary:{configured:targets.length,unique_ips:new Set(targets.map(target=>target.ip)).size,alive,down:targets.length-alive}});
    }
    const topologyMatch=path.match(/^\/api\/projects\/(.+)\/topology$/);
    if(topologyMatch){
      const name=topologyMatch[1];if(!projects.some(p=>p.name===name))return fail('找不到專案',404);
      const current=topologyDocs.get(name)||{revision:0,racks:[]};
      if(method==='GET')return response(current);
      if(method==='PUT'){
        if(body.revision!==current.revision)return fail('其他視窗已修改拓樸。請先匯出目前草稿，再重新載入後重試。',409);
        const updated={...body,revision:current.revision+1};topologyDocs.set(name,updated);return response(updated);
      }
      return fail('Method not allowed',405);
    }
    if(path==='/api/machines'&&method==='GET'){if(url.searchParams.has('force_scan')){await pause(350);lastScan=Math.max(lastScan+1,Math.floor(Date.now()/1000));}return response({machines:machineList(),last_scan:lastScan});}
    if(path==='/api/projects'&&method==='GET')return response({projects:projectList()});
    if((path==='/api/projects/reorder'||path==='/api/machines/reorder')&&method==='POST'){
      const items=path.includes('/projects/')?projects:machines,names=body.names;
      if(!Array.isArray(names)||new Set(names).size!==names.length||names.some(name=>!items.some(item=>item.name===name)))return fail('排序項目無效。');
      names.forEach((name,order)=>{items.find(item=>item.name===name).order=order;});return response({ok:true});
    }
    if(path==='/api/links'){if(method==='DELETE')links=links.filter(l=>l.a!==body.a||l.b!==body.b);else if(method!=='GET')return fail('拓樸建立功能尚未開放。',501);return response({links});}
    if(path==='/api/ai/gpu-alerts')return response({alerts:[],count:0});
    if(path==='/api/rack/ping')return response(rackPingFixture(url.searchParams.get('project')));
    if(path==='/api/ping-ip')return response({alive:true,ok:true});
    if(path.includes('/testlibrary')){
      library=library||await nativeFetch('/fixtures/tests.json').then(r=>r.json());
      const sheets=Object.values(library.sheets);
      if(path.endsWith('/meta'))return response({total:library.total,sheets:sheets.map(s=>({sheet:s.name,label:s.label,count:s.items.length,auto:s.items.filter(i=>i.ai_can_execute==='YES').length,partial:s.items.filter(i=>i.ai_can_execute==='PARTIAL').length,no:s.items.filter(i=>i.ai_can_execute==='NO').length}))});
      return response(sheets.find(s=>s.name===url.searchParams.get('sheet'))||{items:[]});
    }
    if(path.endsWith('/analyze')){await pause(180);return response({analysis:'[模擬分析] 範例溫度與電力讀值穩定。請選擇系統及時間範圍檢查指標。此結果未連線至設備。',counts:{total:6,ok:6,ns:0,warning:0,critical:0}});}
    if(path.includes('/copilot'))return response({reply:'[Design preview] L10 System Level and L11 Rack Level are separate project groups. Choose a project to review its systems, telemetry and operations.',answer:'[Design preview] Select a project to inspect its managed systems.'});
    if(path.includes('/rack/')&&path.endsWith('/telemetry')){
      const members=machines.filter(m=>m.project===path.split('/')[3]&&m.mgx_type!=='blanking'),kinds=[...new Set(members.map(m=>m.mgx_type))],data={};
      // Unknown/unimplemented equipment never inherits fabricated compute metrics.
      kinds.forEach(k=>{const d=defs[k]||{};data[k]={defs:d,machines:Object.keys(d).length?members.filter(m=>m.mgx_type===k).map(m=>({name:m.name,...Object.fromEntries(Object.keys(d).map((key,i)=>[key,Math.round(20+i*12)]))})):[],history:Object.fromEntries(Object.entries(d).map(([key,v],i)=>[key,{...v,agg:'avg',ts,values:wave(20+i*12,3)}]))};});
      return response({project:path.split('/')[3],window_min:minutes,kinds,kinds_count:Object.fromEntries(kinds.map(k=>[k,members.filter(m=>m.mgx_type===k).length])),components:members,data});
    }
    if(path.startsWith('/api/machine/')){
      const [, , ,name,action]=path.split('/'),m=machines.find(m=>m.name===name);
      if(!m)return fail('找不到這台系統。',404);
      if(action==='detail'&&scenario==='loading')await pause(1600);
      if(action==='detail'&&scenario==='error'&&!failedDetails.has(name)){failedDetails.add(name);return fail('模擬暫時無法取得資料，請重新載入。',503);}
      if(action==='detail')return response(fixtureDetail(m));
      if(action==='sensors')return response(fixtureSensors(m));
      if(action==='telemetry')return response(!isCompute(m)?{os:{os:[],disk:[],net:[]},gpu:{series:[]}}:{os:{os:ts.map((t,i)=>({ts:t,cpu_used:wave(45,9)[i],cpu_temp_c:wave(48,3)[i],load1:4,load5:3,load15:2,mem_used_pct:38,mem_total_gb:1536,mem_used_gb:583.68,mem_avail_gb:952.32})),disk:[{mount:'/',ts,pct:wave(26,1),used_gb:wave(180,2)}],net:[{iface:'eth0',points:ts.map((t,i)=>({ts:t,rx:wave(20e6,3e6)[i],tx:wave(10e6,2e6)[i]}))}]},gpu:{series:Array.from({length:gpuCount(m)},(_,i)=>({gpu:i,name:'NVIDIA H100',ts,util:wave(45+i*6,6),mem_used:wave(30+i,2),temp:wave(55+i,3),power:wave(310+i*10,15)}))}});
      if(action==='diagnose'){await pause(240);return response({ok:true,report:'[模擬診斷]\nOS：'+(m.os_alive?'可連線':'離線')+'\nBMC：'+(m.bmc_alive?'可連線':'未連線')+'\n電源：'+m.power+'\n此報告使用預覽資料，沒有執行設備指令。',collected_at:new Date().toISOString(),collect:{os:isCompute(m)?'Sample Ubuntu / AMD EPYC / '+gpuCount(m)+' GPUs':'Sample '+(m.mgx_type||'component')+' inventory; no compute data reported',bmc:m.bmc_ip?'Sample SEL: no critical entries':'No BMC inventory',bmc_mode:'preview'}});}
      if(method==='POST'&&['power','reboot','aux'].includes(action)){await pause(150);m.power=action==='power'&&(body.action==='off'||body.on===false)?'OFF':'ON';m.os_alive=Boolean(m.power==='ON'&&m.os_ip);return response({ok:true,output:'Preview only; no command executed.',power:m.power,power_status:powerStatus(m),info:'模擬操作完成'});}
    }
    if(path==='/api/machines/probe-bmc')return response({ok:true,bmc_ip:'198.51.100.250',hostname:'demo-new-system'});
    if(path.includes('/kvm/'))return response({sync_ok:true,ok:true,machines:[],reason:'Preview only'});
    if(path==='/api/projects'&&method==='POST'){
      if(!body.name?.trim())return fail('請填專案名稱。');
      if(projects.some(p=>p.name===body.name))return fail('專案名稱已存在。',409);
      projects.push({...body,name:body.name.trim(),order:projects.length});return response({ok:true,projects:projectList()});
    }
    if(path.startsWith('/api/projects/')){
      const p=projects.find(p=>p.name===path.split('/')[3]);if(!p)return fail('找不到專案。',404);
      if(method==='PATCH'){if(body.name&&projects.some(x=>x!==p&&x.name===body.name))return fail('專案名稱已存在。',409);const oldName=p.name;Object.assign(p,body);machines.filter(m=>m.project===oldName).forEach(m=>{m.project=p.name;});}
      if(method==='DELETE'){if(machines.some(m=>m.project===p.name))return fail('此專案還有機台，無法刪除。',409);projects.splice(projects.indexOf(p),1);}
      return response({ok:true,projects:projectList()});
    }
    if((path==='/api/machines'||path==='/api/rack/passive')&&method==='POST'){
      if(!projects.some(p=>p.name===body.project))return fail('請選擇有效的專案。');
      const passive=path==='/api/rack/passive',name=passive?String(body.name||'').trim():body.name||'demo-system-'+newMachineSequence++;
      if(!name)return fail('請填元件名稱。');if(machines.some(m=>m.name===name))return fail('系統名稱已存在。',409);
      const m={...body,name,mgx_type:body.mgx_type||'server',level:passive?'rack':body.level||'system',passive,os_ip:passive?(body.mgx_type==='cdu'?'':body.manage_ip||''):body.os_ip,bmc_ip:passive&&body.mgx_type==='cdu'?body.manage_ip||'':body.bmc_ip||'',os_alive:passive?(body.mgx_type==='cdu'?null:body.manage_ip?true:null):true,bmc_alive:Boolean(passive&&body.mgx_type==='cdu'?body.manage_ip:body.bmc_ip),power:passive?null:'ON',order:machines.filter(x=>x.project===body.project).length,rack_mount:body.rack_mount||'internal',rack_u:passive?(body.rack_u??1):0,rack_size:body.rack_size??1};
      const error=placementError(m);if(error)return fail(error.detail,error.status);
      machines.push(m);return response({ok:true,machine:m,name:m.name,machines:machineList()});
    }
    if(path.startsWith('/api/machines/')){
      const m=machines.find(m=>m.name===path.split('/')[3]);if(!m)return fail('找不到這台系統。',404);
      if(method==='PATCH'){
        if(path.endsWith('/rack-specification')){
          const fields=['rack_size','project','expected_level','expected_project','expected_size','expected_u'];
          if(Object.keys(body).length!==fields.length||fields.some(k=>!Object.hasOwn(body,k)))return fail('Provide height, project and snapshot',422);
          if(body.expected_level!==(m.level||'system')||body.expected_project!==(m.project||'')||body.expected_size!==(m.rack_size??1)||body.expected_u!==(m.rack_u??0))return fail('Equipment changed; reload',409);
          if((m.level!=='rack'&&(!equipmentIsServer(m)||m.passive))||m.rack_mount==='external')return fail('Unsupported specification correction',400);
          if(typeof body.project!=='string'||(!body.project&&m.level!=='rack')||(body.project&&!projects.some(p=>p.name===body.project&&p.level!=='system')))return fail('Select an L11 project',400);
          if(m.level!=='rack'&&!projectAllowsLevel(body.project,'rack'))return fail('Select an empty or L11 project',400);
          if(m.level==='rack'&&body.project!==(m.project||''))return fail('Keep current project',400);
          if(!Number.isInteger(body.rack_size)||body.rack_size<1||body.rack_size>48)return fail('Height must be 1..48U',400);
          const candidate={...m,level:'rack',project:body.project,rack_size:body.rack_size,rack_u:m.level==='rack'?(m.rack_u||0):0};
          if(m.mgx_type==='cdu'&&candidate.rack_u)candidate.rack_u=body.rack_size;
          const error=placementError(candidate);if(error)return fail(error.detail,error.status);
          Object.assign(m,candidate);return response({ok:true,machine:{...m}});
        }
        if(path.endsWith('/management-ip')){
          if(!['os','bmc'].includes(body.target))return fail('Choose a connection',422);
          if(equipmentIsServer(m)||mgxTypeOf(m)==='blanking')return fail('Not a managed component',400);
          const field=body.target+'_ip';
          if((m[field]||'')!==body.expected_ip)return fail('IP changed; reload equipment',409);
          if(!body.ip)return fail('IP is required',422);
          m[field]=body.ip;return response({ok:true,ip:body.ip,target:body.target});
        }
        if(path.endsWith('/cdu-installation')){
          if(m.level!=='rack'||m.mgx_type!=='cdu'||Object.keys(body).some(k=>!['rack_mount','rack_size','expected_project'].includes(k)))return fail('Invalid CDU installation',400);
          if(body.expected_project!==m.project)return fail('Project changed',409);
          if(!['internal','external'].includes(body.rack_mount))return fail('Invalid mount',400);
          const size=body.rack_mount==='external'?0:body.rack_size;
          if(body.rack_mount==='internal'&&(!Number.isInteger(size)||size<1||size>48||(m.rack_mount!=='external'&&size!==m.rack_size)))return fail('Invalid CDU height',400);
          const candidate={...m,rack_mount:body.rack_mount,rack_size:size,rack_u:size};
          const error=placementError(candidate);if(error)return fail(error.detail,error.status);
          Object.assign(m,candidate);return response({ok:true,machine:m});
        }
        if(path.endsWith('/placement')){
          if(m.level!=='rack'||!Object.hasOwn(body,'rack_u')||Object.keys(body).some(k=>!['rack_u','expected_project'].includes(k)))return fail('Invalid placement payload',400);
          if(body.expected_project!==m.project)return fail('Project changed; reload equipment',409);
        }
        if(m.level==='rack'&&['mgx_type','rack_size','rack_mount'].some(k=>Object.hasOwn(body,k)&&body[k]!== (m[k]??(k==='rack_mount'?'internal':k==='rack_size'?1:'server'))))return fail('Existing L11 specifications are fixed',400);
        const candidate={...m,...(path.endsWith('/placement')?{rack_u:body.rack_u}:body)};const error=placementError(candidate);if(error)return fail(error.detail,error.status);Object.assign(m,candidate);if(body.level==='system')m.rack_u=0;}
      if(method==='DELETE'){machines.splice(machines.indexOf(m),1);links=links.filter(l=>l.a!==m.name&&l.b!==m.name);}
      if(body.new_os_ip)m.os_ip=body.new_os_ip;if(body.new_bmc_ip)m.bmc_ip=body.new_bmc_ip;
      return response({ok:true,machine:m,machines:machineList()});
    }
    return response({ok:false,detail:'This action is not connected in the design preview.'},400);
  };
  class PreviewSocket extends EventTarget{
    static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
    constructor(url){super();this.url=String(url);this.readyState=0;this.targets=[];this.openTimer=setTimeout(()=>{if(this.readyState!==0)return;this.readyState=1;this.onopen?.(new Event('open'));this.dispatchEvent(new Event('open'));if(!this.url.includes('rack-broadcast'))this.emit('\r\nWISTRON PA / DESIGN PREVIEW\r\nNo SSH connection. No commands are executed.\r\n\r\ndemo@preview:~$ ');},120);}
    emit(data){if(this.readyState!==1)return;const e=new MessageEvent('message',{data});this.onmessage?.(e);this.dispatchEvent(e);}
    send(data){
      if(this.readyState!==1)return;let j;try{j=JSON.parse(data);}catch{}
      if(this.url.includes('rack-broadcast')){
        if(Array.isArray(j?.targets)){this.targets=j.targets;setTimeout(()=>{this.emit(JSON.stringify({type:'ready',joined:this.targets,failed:[]}));this.targets.forEach(name=>this.emit(JSON.stringify({type:'out',name,data:'\r\nWISTRON PA / BROADCAST PREVIEW\r\nNo commands are executed.\r\ndemo@preview:~$ '})));},40);}
        else if(j?.type==='broadcast'||j?.type==='sendOne'){const names=j.type==='broadcast'?[...this.targets]:[j.name];setTimeout(()=>names.forEach(name=>this.emit(JSON.stringify({type:'out',name,data:'\r\n[Preview only — no command executed]\r\ndemo@preview:~$ '}))),30);}
        else if(j?.type==='closeOne')this.targets=this.targets.filter(n=>n!==j.name);
      }else if(!j&&typeof data==='string'&&data.includes('\r'))this.emit('\r\n[Preview only]\r\ndemo@preview:~$ ');
    }
    close(){clearTimeout(this.openTimer);if(this.readyState===3)return;this.readyState=3;this.onclose?.(new Event('close'));this.dispatchEvent(new Event('close'));}
  }
  window.WebSocket=PreviewSocket;
  window.PA_PREVIEW={projects,machines,scenario,requests};
})();
