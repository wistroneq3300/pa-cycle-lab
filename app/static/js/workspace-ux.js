/* Shared workspace presentation and explicit inventory corrections. */
(() => {
  'use strict';
  const q=v=>esc(JSON.stringify(String(v)));
  const read=(key,fallback)=>{try{return JSON.parse(sessionStorage.getItem(key))??fallback;}catch{return fallback;}};
  const save=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
  const icon=kind=>'<svg class="ux-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+({config:'<path d="M5 5h14v5H5zm0 9h14v5H5zM8 7.5h1m-1 9h1"/>',connect:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8m-4-5v5"/>',power:'<path d="M12 2v10m-5-7a9 9 0 1 0 10 0"/>'}[kind]||'')+'</svg>';
  window.uxNotify=(message,error=false)=>{
    let host=document.getElementById('ux-notifications');
    if(!host){host=document.createElement('div');host.id='ux-notifications';host.setAttribute('aria-live','polite');document.body.append(host);}
    const item=document.createElement('div');item.className='ux-notice'+(error?' is-error':'');item.setAttribute('role',error?'alert':'status');
    const text=document.createElement('span');text.textContent=message;item.append(text);
    const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='\u95dc\u9589';dismiss.onclick=()=>item.remove();item.append(dismiss);host.append(item);
    if(!error)setTimeout(()=>item.remove(),8000);
    return item;
  };
  window.uxConfirm=(message)=>new Promise(resolve=>{
    let settled=false;const done=value=>{if(settled)return;settled=true;window.uxPendingConfirm=null;closeDialog();resolve(value);};
    showDialog('\u78ba\u8a8d\u64cd\u4f5c','<pre class="ux-confirm-copy">'+esc(message)+'</pre><p>\u8acb\u78ba\u8a8d\u4e0a\u65b9\u76ee\u6a19\u8207\u64cd\u4f5c\u5167\u5bb9\u3002</p>',[
      {txt:'\u53d6\u6d88',fn:()=>done(false)},{txt:'\u78ba\u8a8d\u9001\u51fa',cls:'primary',fn:()=>done(true)}
    ]);
    window.uxPendingConfirm=()=>done(false);
  });
  const originalClose=closeDialog;
  closeDialog=function(){if(window.uxPendingConfirm){const cancel=window.uxPendingConfirm;window.uxPendingConfirm=null;cancel();return;}return originalClose();};
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.defaultPrevented||e.isComposing)return;
    const backdrop=document.getElementById('rm-dialog');
    if(!backdrop||getComputedStyle(backdrop).display==='none')return;
    if(backdrop.getAttribute('aria-busy')==='true'||backdrop.querySelector('.xterm,canvas,#power-batch-progress'))return;
    e.preventDefault();closeDialog();
  });

  function heightOptions(size){return Array.from({length:48},(_,i)=>'<option value="'+(i+1)+'"'+(i+1===size?' selected':'')+'>'+(i+1)+'U</option>').join('');}
  window.uxRackSpecification=name=>{
    const m=machines.find(x=>x.name===name);if(!m)return;
    if(m.rack_mount==='external'){rackMoveDialog(name);return;}
    const promotion=m.level!=='rack',size=Number(m.rack_size)||1;
    const candidates=projectsForLevel('rack');
    const target=promotion?(candidates[0]?.name||''):(m.project||'');
    if(promotion&&!target){uxNotify('\u8acb\u5148\u65b0\u589e L11 \u5c08\u6848',true);return;}
    const snapshot={expected_level:m.level||'system',expected_project:m.project||'',expected_size:m.rack_size??1,expected_u:m.rack_u??0};
    const body='<p><strong>'+esc(name)+'</strong> \u00b7 '+(promotion?'L10 \u2192 L11':'\u4fee\u6b63\u6a5f\u6ac3\u5360\u7528\u9ad8\u5ea6')+'</p>'+
      '<label class="ux-field">\u76ee\u6a19\u5c08\u6848<select id="ux-spec-project" '+(promotion?'':'disabled')+'>'+ (promotion?candidates.map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>').join(''):'<option value="'+esc(target)+'">'+esc(target||'\u672a\u6307\u6d3e')+'</option>')+'</select></label>'+
      '<label class="ux-field">\u5be6\u969b\u8a2d\u5099\u9ad8\u5ea6<select id="ux-spec-size">'+heightOptions(size)+'</select></label>'+
      '<p>'+(promotion?'\u8f49\u63db\u5f8c\u5148\u4fdd\u6301\u672a\u4e0a\u6ac3\uff0c\u518d\u81f3\u300c\u6a5f\u6ac3\u7ba1\u7406\u300d\u9078\u64c7\u4f4d\u7f6e\u3002':'\u4fdd\u7559\u76ee\u524d\u4e0a\u7de3 U \u4f4d\uff1bCDU \u56fa\u5b9a\u5f9e U1 \u5411\u4e0a\u3002\u5982\u6709\u91cd\u758a\uff0c\u8acb\u5148\u79fb\u4f4d\u6216\u79fb\u51fa\u6a5f\u6ac3\u3002')+'</p><div id="ux-spec-preview"></div>';
    showDialog(promotion?'\u5347\u70ba L11':'\u4fee\u6b63\u8a2d\u5099\u9ad8\u5ea6',body,[
      {txt:'\u53d6\u6d88',fn:closeDialog},
      {txt:'\u5132\u5b58\u898f\u683c',cls:'primary',fn:async()=>{
        const project=document.getElementById('ux-spec-project').value,rack_size=Number(document.getElementById('ux-spec-size').value);
        await api('/api/machines/'+encodeURIComponent(name)+'/rack-specification',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...snapshot,project,rack_size})});
        delete machineDetailCache[name];
        try{await Promise.all([loadMachines(false),loadProjects()]);}catch(error){closeDialog();uxNotify(name+' \u898f\u683c\u5df2\u5132\u5b58\uff0c\u4f46\u6e05\u55ae\u66f4\u65b0\u5931\u6557\uff0c\u8acb\u91cd\u65b0\u8f09\u5165\uff1a'+error.message,true);return;}
        closeDialog();setView(state.view);uxNotify(name+' \u5df2\u5132\u5b58\u70ba '+rack_size+'U'+(promotion?' \u00b7 \u5f85\u4e0a\u6ac3':''));
      }}
    ]);
    const preview=()=>{
      const h=Number(document.getElementById('ux-spec-size').value),top=m.mgx_type==='cdu'&&m.rack_u?h:Number(m.rack_u)||0;
      const result=!promotion&&top?placementPreview(target,name,top,h):{valid:true,html:'<p>\u672a\u4e0a\u6ac3 \u00b7 '+h+'U</p>'};
      document.getElementById('ux-spec-preview').innerHTML=result.html;
      document.querySelector('#rm-dialog-foot .primary').disabled=!result.valid;
    };
    document.getElementById('ux-spec-size').addEventListener('change',preview);preview();
  };
  rackPromote=name=>uxRackSpecification(name);
  const moveDialog=rackMoveDialog;
  rackMoveDialog=function(name){const result=moveDialog(name);const m=machines.find(x=>x.name===name);if(m?.rack_mount!=='external'){
    const b=document.createElement('button');b.className='btn';b.textContent='\u4fee\u6b63\u9ad8\u5ea6';b.onclick=()=>uxRackSpecification(name);document.getElementById('rm-dialog-foot')?.prepend(b);
  }return result;};

  // Dashboard information architecture is owned by validation-overview.js.

  const rack=RENDERERS.rack;
  RENDERERS.rack=function(){
    const root=document.createElement('div');root.innerHTML=rack();const hero=root.querySelector('.rack-hero');if(!hero)return root.innerHTML;
    const cycleButton=document.createElement('button');cycleButton.className='btn';cycleButton.dataset.actionGroup='validation';cycleButton.setAttribute('onclick','openCycleTest('+JSON.stringify(rackView.project)+')');cycleButton.textContent='Cycle 驗證';hero.append(cycleButton);
    const groups=[['\u914d\u7f6e','config'],['\u9023\u7dda\u8207\u8a3a\u65b7','connect'],['\u96fb\u6e90\u64cd\u4f5c','power'],['Cycle 驗證','validation']];
    const containers={};const toolbar=document.createElement('div');toolbar.className='ux-rack-toolbar';
    for(const [title,key] of groups){const group=document.createElement(key==='power'?'details':'section');group.className='ux-action-group';group.innerHTML=(key==='power'?'<summary>':'<h3>')+title+(key==='power'?'</summary>':'</h3>')+'<div></div>';containers[key]=group.lastElementChild;toolbar.append(group);}
    hero.querySelectorAll(':scope > button').forEach(b=>{
      const action=b.getAttribute('onclick')||'',key=b.dataset.actionGroup||(/Power|Reboot|Aux/.test(action)?'power':/Ping|Broadcast/.test(action)?'connect':'config');
      b.textContent=b.textContent.replace(/^[^\p{L}\p{N}]+/u,'').trim();
      b.insertAdjacentHTML('afterbegin',icon(key));
      if(/topoTodo|rackBulkReboot|rackBulkAux/.test(action)){b.remove();return;}
      containers[key].append(b);
    });
    const title=hero.querySelector('.rack-hero-title');if(title)title.textContent='機櫃管理';
    hero.append(toolbar);return root.innerHTML;
  };

  const projectList=renderProjectsList;
  renderProjectsList=function(){
    const root=document.createElement('div');root.innerHTML=projectList();
    root.querySelectorAll('button[onclick*="rackPromote"]').forEach(b=>b.title='\u9078\u64c7\u76ee\u6a19\u5c08\u6848\u8207\u5be6\u969b U \u9ad8\u5ea6\uff0c\u8f49\u63db\u5f8c\u518d\u4e0a\u6ac3');
    root.querySelectorAll('.proj-table-scroll').forEach(box=>box.insertAdjacentHTML('beforebegin','<p class="ux-table-hint">\u5de6\u53f3\u6ed1\u52d5\u67e5\u770b\u5b8c\u6574\u6b04\u4f4d\u8207\u64cd\u4f5c</p>'));
    root.querySelectorAll('tbody tr').forEach(row=>{
      const name=row.querySelector('.mach-link b')?.textContent,m=machines.find(x=>x.name===name),menu=row.querySelector('.p-row-menu>div'),select=row.querySelector('.move-sel');
      if(!m||!menu)return;
      if(select){const cell=select.closest('td'),label=document.createElement('label');label.className='ux-menu-label';label.textContent='\u79fb\u52d5\u81f3\u5c08\u6848';label.append(select);menu.append(label);if(cell)cell.textContent=m.project||'\u672a\u5206\u985e';}
      if(m.level==='rack'&&m.rack_mount!=='external'){const button=document.createElement('button');button.className='btn small';button.textContent='\u4fee\u6b63\u9ad8\u5ea6 \u00b7 '+(m.rack_size||1)+'U';button.setAttribute('onclick','uxRackSpecification('+JSON.stringify(m.name)+')');menu.append(button);}
    });
    return root.innerHTML;
  };

  const detail=RENDERERS.machine;
  RENDERERS.machine=function(){
    const root=document.createElement('div');root.innerHTML=detail();const m=machines.find(x=>x.name===_activeMachine);if(!m)return root.innerHTML;
    const overview=root.querySelector('#pd-panel-overview'),connection=overview?.querySelector('.pd-connect-panel'),showcase=overview?.querySelector('.pd-showcase');
    if(connection&&showcase&&equipmentIsServer(m)){showcase.before(connection);showcase.classList.add('ux-compact-showcase');}
    const main=root.querySelector('.pd-system-title');
    if(main)main.insertAdjacentHTML('beforeend','<p class="ux-identity">'+esc(m.project||'\u672a\u6307\u6d3e')+' \u00b7 '+(m.level==='rack'?(m.rack_size||0)+'U \u00b7 '+(m.rack_u?'U'+m.rack_u:'\u5f85\u4e0a\u6ac3'):'L10')+'</p>');
    return root.innerHTML;
  };

  const originalOpen=openMachine;
  openMachine=function(name){const recent=read('pa_recent_devices',[]).filter(x=>x!==name);save('pa_recent_devices',[name,...recent].slice(0,8));return originalOpen(name);};
  function snapshot(){
    return {search:document.querySelector('.p-search input')?.value||'',filter:document.querySelector('.eng-list-tools select')?.value||'all',level:projectLevelFilter.val,collapsed:{...projectCollapsed},scroll:window.scrollY};
  }
  window.uxRememberRoute=()=>{
    if(document.body.dataset.productView==='projects'){const value=snapshot();history.replaceState({...history.state,workspace:value},'',location.href);save('pa_list_workspace',value);}
    else history.replaceState({...history.state,scroll:window.scrollY},'',location.href);
  };
  document.addEventListener('click',()=>uxRememberRoute(),true);
  let scrollTimer;window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>uxRememberRoute(),120);},{passive:true});
  const stored=read('pa_list_workspace',null);if(stored){Object.assign(projectCollapsed,stored.collapsed);projectLevelFilter.val=stored.level==='rack'?'rack':'system';}
  window.addEventListener('popstate',()=>{
    clearTimeout(scrollTimer);
    const value=history.state?.workspace;if(value){projectLevelFilter.val=value.level;for(const key of Object.keys(projectCollapsed))delete projectCollapsed[key];Object.assign(projectCollapsed,value.collapsed);}
    window.uxRestoring=true;
  });
  const render=_renderMachine;
  _renderMachine=function(...args){
    const value=history.state?.workspace||read('pa_list_workspace',null);
    const project=projects.find(p=>p.name===_activeProject);
    if(args[0]==='projects'&&['rack','system'].includes(project?.level))projectLevelFilter.val=project.level;
    const result=render(...args);
    if(state.view==='projects'&&value){
      const input=document.querySelector('.p-search input');if(input){input.value=value.search||'';productFilter(input.value);}
      const filter=document.querySelector('.eng-list-tools select');if(filter){filter.value=value.filter||'all';engStatusFilter(filter.value);}
    }
    if(window.uxRestoring){const y=history.state?.workspace?.scroll??history.state?.scroll??0;requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'})));window.uxRestoring=false;}
    return result;
  };
  const collapse=renderCollapsed;renderCollapsed=function(){const r=collapse();save('pa_list_workspace',snapshot());const value=read('pa_list_workspace',{});productFilter(value.search||'');engStatusFilter(value.filter||'all');return r;};
  const filter=productFilter;productFilter=function(value){const r=filter(value);if(state.view==='projects')save('pa_list_workspace',snapshot());return r;};
  const statusFilter=engStatusFilter;engStatusFilter=function(value){const r=statusFilter(value);if(state.view==='projects')save('pa_list_workspace',snapshot());return r;};

  // Selection survives search/pagination; review the same snapshot before generating text.
  const list=assignTaskListHtml;
  assignTaskListHtml=function(){return '<ol class="ux-steps"><li>\u9078\u64c7\u5206\u985e</li><li aria-current="step">\u9078\u64c7\u6e2c\u9805</li><li>\u78ba\u8a8d\u76ee\u6a19</li><li>\u4e0b\u4e00\u6b65</li></ol><p class="ux-selection-note">\u641c\u5c0b\u8207\u63db\u9801\u6703\u4fdd\u7559\u5df2\u9078\u6e2c\u9805\u3002\u55ae\u9078\u53ef\u4ea4\u7d66 PA Agent\uff1b\u591a\u9078\u53ea\u7522\u751f\u6279\u6b21\u6307\u4ee4\uff0c\u4e0d\u6703\u555f\u52d5 Agent\u3002</p>'+list();};
  const copy=assignTaskCopy;
  assignTaskCopy=function(){
    const chosen=_assignTask.items.filter(r=>_assignTask.sel.has(assignTaskKey(r)));if(!chosen.length){uxNotify('\u8acb\u5148\u9078\u64c7\u6e2c\u9805',true);return;}
    const target=machines.find(m=>m.name===_assignTask.name),expected=JSON.stringify(operationTarget(_assignTask.name)),selection=JSON.stringify([..._assignTask.sel].sort()),counts={auto:0,confirm:0,manual:0};chosen.forEach(r=>{const cls=String(r.ai_review?.automation_classification||'').toUpperCase(),legacy=String(r.ai_can_execute||'').toUpperCase();if(cls==='FULLY AUTOMATABLE'||(!cls&&legacy==='YES'))counts.auto++;else if(cls.includes('CONFIRMATION')||(!cls&&legacy==='PARTIAL'))counts.confirm++;else counts.manual++;});
    const action=typeof assignTaskActionMeta==='function'?assignTaskActionMeta(chosen.length):{kind:chosen.length===1?'agent':'batch',label:chosen.length===1?'\u4ea4\u7d66 PA Agent':`\u7522\u751f\u6279\u6b21\u6307\u4ee4 (${chosen.length})`,note:''};
    const explanation=action.kind==='agent'?'PA Agent \u6703\u5148\u8aaa\u660e\u57f7\u884c\u8a08\u756b\u4e26\u7b49\u5f85\u4f60\u540c\u610f\uff1b\u56de\u8986 OK \u6216 GO \u5f8c\u624d\u6703\u5be6\u969b\u57f7\u884c\u3002':'\u9019\u4e9b\u6e2c\u9805\u5c07\u7522\u751f\u4e00\u4efd\u53ef\u8907\u88fd\u7684\u6279\u6b21\u6307\u4ee4\uff1b\u76ee\u524d\u672a\u555f\u52d5 Agent\uff0c\u4e5f\u4e0d\u6703\u53ea\u9001\u51fa\u7b2c\u4e00\u7b46\u3002';
    showDialog(action.kind==='agent'?'\u78ba\u8a8d\u6e2c\u9805\u8207\u76ee\u6a19':'\u78ba\u8a8d\u6279\u6b21\u6307\u4ee4\u7bc4\u570d',operationTargetHtml(target?.name||_assignTask.name||'')+
      '<p>'+chosen.length+' \u7b46 \u00b7 \u5168\u81ea\u52d5 '+counts.auto+' / \u9700\u78ba\u8a8d '+counts.confirm+' / \u4eba\u5de5\u6216\u963b\u64cb '+counts.manual+'</p><ul class="ux-chosen">'+chosen.map(r=>'<li>'+esc(r.code)+' \u00b7 '+esc(r.items)+'</li>').join('')+'</ul><p>'+explanation+'</p>',[
      {txt:'\u8fd4\u56de\u9078\u64c7',fn:()=>assignTaskReRender()},{txt:action.label,cls:'primary',fn:()=>{if(!target||JSON.stringify(operationTarget(target.name))!==expected||JSON.stringify([..._assignTask.sel].sort())!==selection)throw new Error('\u76ee\u6a19\u6216\u6e2c\u9805\u5df2\u6539\u8b8a\uff0c\u8acb\u8fd4\u56de\u91cd\u65b0\u78ba\u8a8d');_assignTask.machine={...target};return copy();}}
    ]);
  };

  // Capture the exact target before confirmation; accepted is distinct from completed.
  const pendingRequests=new Set();
  async function deviceRequest(name,kind,on){
    const key=name+':'+kind,m=machines.find(m=>m.name===name);
    if(!m||(kind==='power'?!equipmentCanPower(m,on):!equipmentIsServer(m)))return uxNotify('\u6b64\u8a2d\u5099\u4e0d\u652f\u63f4\u8a72\u64cd\u4f5c',true);
    if(pendingRequests.has(key))return;
    pendingRequests.add(key);
    try{
    const target=operationTarget(name),label=kind==='power'?(on?'\u958b\u6a5f':'\u95dc\u6a5f'):kind==='aux'?'AUX cycle':'Reboot';
    if(!await uxConfirm(operationTargetText(name)+'\n\n'+label+' \u00b7 \u6307\u4ee4\u5c07\u9001\u81f3\u6b64\u76ee\u6a19'))return;
    const progress=uxNotify(name+' \u00b7 '+label+' \u9001\u51fa\u4e2d');
    try{
      const result=await api('/api/machine/'+encodeURIComponent(name)+'/'+kind,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...(kind==='power'?{on}:{}),expected_target:target})});
      if(!result.ok)throw new Error(result.info||'\u6307\u4ee4\u672a\u78ba\u8a8d');
      uxNotify(name+' \u00b7 '+label+' \u6307\u4ee4\u5df2\u63a5\u53d7\uff1b\u8acb\u66f4\u65b0\u8cc7\u6599\u78ba\u8a8d\u5b8c\u6210');
      try{if(state.view==='machine'&&_activeMachine===name)await machineLoadDetail(name);else {await loadMachines(false);setView(state.view);}}
      catch(error){uxNotify(name+' \u6307\u4ee4\u5df2\u63a5\u53d7\uff0c\u4f46\u72c0\u614b\u66f4\u65b0\u5931\u6557\uff1a'+error.message,true);}
    }catch(error){uxNotify(name+' \u00b7 '+label+' \u5931\u6557\uff1a'+error.message,true);}finally{progress.remove();}
    }finally{pendingRequests.delete(key);}
  }
  machinePower=(name,on)=>deviceRequest(name,'power',on);
  machineRebootDetail=name=>deviceRequest(name,'reboot');
  machineAuxDetail=name=>deviceRequest(name,'aux');
  singlePower=(name,on)=>deviceRequest(name,'power',on);
  auxCycle=name=>deviceRequest(name,'aux');
  machineReboot=name=>deviceRequest(name,'reboot');
  const originalBulk=rackBulkRun;
  rackBulkRun=async function(kind,names){
    const targets=JSON.stringify(names.map(operationTarget));
    if(['on','off'].includes(kind)){
      if(!await uxConfirm((kind==='on'?'\u958b\u6a5f':'\u95dc\u6a5f')+' '+names.length+' \u500b\u76ee\u6a19\n\n'+names.map(operationTargetText).join('\n\n')))return;
    }
    if(targets!==JSON.stringify(names.map(operationTarget)))return uxNotify('\u76ee\u6a19\u5df2\u6539\u8b8a\uff0c\u8acb\u91cd\u65b0\u78ba\u8a8d',true);
    return originalBulk(kind,names);
  };
  window.uxTelemetryFilter=value=>{
    save('pa_telemetry_focus',value);
    document.querySelectorAll('#tel-grid .chart-box').forEach(box=>{
      const chart=window.Chart?.getChart(box.querySelector('canvas')),id=chart?.canvas.id;
      const needs=!chart?.$paLatest||Date.now()/1000-chart.$paLatest>120||!chart.data.datasets.some(ds=>ds.data.some(PAEngineering.finite));
      box.hidden=value==='common'?!['tel-cpu','tel-cputemp','tel-mem','tel-gpu','tel-gputemp','tel-gpupow'].includes(id):value==='attention'?!needs:false;
    });
    const count=document.getElementById('ux-telemetry-count');if(count)count.textContent=document.querySelectorAll('#tel-grid .chart-box:not([hidden])').length+' \u5f35\u5716';
  };
  window.uxTelemetryState=data=>{
    const os=data.os||{},gpu=data.gpu||{};
    const max=values=>values.reduce((v,n)=>Number.isFinite(n)?Math.max(v,n):v,0);
    const times={os:max((os.os||[]).map(r=>r.ts)),disk:max((os.disk||[]).flatMap(r=>r.ts||[])),net:max((os.net||[]).flatMap(r=>(r.points||[]).map(p=>p.ts))),gpu:max((gpu.series||[]).flatMap(r=>r.ts||[]))};
    for(const [id,chart] of Object.entries(telCharts)){chart.$paLatest=times[id.startsWith('tel-gpu')?'gpu':id.startsWith('tel-disk')?'disk':id==='tel-net'?'net':'os'];chart.update('none');}
    const grid=document.getElementById('tel-grid');if(!grid)return;
    let tools=document.getElementById('ux-telemetry-tools');
    if(!tools){tools=document.createElement('div');tools.id='ux-telemetry-tools';tools.className='ux-telemetry-tools';tools.innerHTML='<label>\u986f\u793a\u6307\u6a19 <select onchange="uxTelemetryFilter(this.value)"><option value="all">\u5168\u90e8</option><option value="common">\u5e38\u7528</option><option value="attention">\u8cc7\u6599\u9700\u78ba\u8a8d</option></select></label><span id="ux-telemetry-count" role="status"></span><p>\u8d85\u904e 2 \u5206\u9418\u7684\u6a23\u672c\u6a19\u793a\u70ba\u820a\u8cc7\u6599\uff1b\u4e0d\u4ee3\u8868\u8a2d\u5099\u6545\u969c\u3002</p>';grid.before(tools);}
    tools.querySelector('select').value=read('pa_telemetry_focus','all');uxTelemetryFilter(tools.querySelector('select').value);
  };
  if(window.Chart)Chart.register({id:'paWorkspaceFreshness',afterUpdate(chart){
    const panel=chart.canvas?.parentElement?.querySelector('.eng-chart-readout');if(!panel)return;
    let note=panel.nextElementSibling;if(!note?.classList.contains('ux-chart-time')){note=document.createElement('small');note.className='ux-chart-time';panel.after(note);}
    const stamp=chart.$paLatest;
    note.textContent=stamp?'\u6700\u5f8c\u6a23\u672c\uff1a'+new Date(stamp*1000).toLocaleString()+(Date.now()/1000-stamp>120?' \u00b7 \u820a\u8cc7\u6599':''):'\u4f86\u6e90\u672a\u63d0\u4f9b\u6a23\u672c\u6642\u9593';
  }});

})();
