/* Narrow presentation/lifecycle adapters. The original API contract is unchanged. */
(() => {
  'use strict';
  const text = value => String(value ?? '').trim().toLocaleLowerCase();
  function projectVisible(project, members, level) {
    if (project.level === 'rack' || project.level === 'system') return project.level === level;
    return members.some(machine => (machine.level === 'rack' ? 'rack' : 'system') === level);
  }
  function matchesProject(project, members, query) {
    const needle = text(query), projectMatch = !needle || text(`${project.name || ''} ${project.desc || ''}`).includes(needle);
    return {projectMatch, names:members.filter(machine => projectMatch || text(`${machine.name || ''} ${machine.os_ip || ''} ${machine.bmc_ip || ''}`).includes(needle)).map(machine => machine.name)};
  }
  function validatePlacements(members, capacity = 48) {
    const pending = [], spans = [], external = [], issues = [], cells = new Map();
    for (const machine of members) {
      const cdu = machine.mgx_type === 'cdu' || (!machine.mgx_type && /cdu/i.test(machine.name||''));
      if (machine.rack_mount === 'external') {
        if (!cdu || Number(machine.rack_u||0)!==0 || Number(machine.rack_size||0)!==0) issues.push({name:machine.name,code:'external',message:'\u5916\u7f6e\u50c5\u652f\u63f4 CDU\uff0c\u4e14\u4e0d\u5360 U \u4f4d\u3002',conflicts:[]});
        else external.push(machine);
        continue;
      }
      if (machine.rack_u == null || machine.rack_u === '' || Number(machine.rack_u) === 0) { pending.push(machine); continue; }
      const top = Number(machine.rack_u), height = machine.rack_size == null ? 1 : Number(machine.rack_size), bottom = top - height + 1;
      if (!Number.isInteger(height) || height < 1 || height > capacity) {
        issues.push({name:machine.name,code:'height',message:'元件 U 高度無效，請確認配置。',conflicts:[]}); continue;
      }
      if (!Number.isInteger(top) || top > capacity || bottom < 1) {
        issues.push({name:machine.name,code:'range',message:`位置超出 U1–U${capacity}，請確認配置。`,conflicts:[]}); continue;
      }
      if (cdu && bottom !== 1) {
        issues.push({name:machine.name,code:'cdu-bottom',message:'\u6ac3\u5167 CDU \u5fc5\u9808\u5b89\u88dd\u5728 U1 \u8d77\u7684\u5e95\u90e8\u3002',conflicts:[]}); continue;
      }
      spans.push({machine,top,bottom});
      for (let u=bottom;u<=top;u++) { if (!cells.has(u)) cells.set(u,[]); cells.get(u).push(machine.name); }
    }
    for (const span of spans) {
      const conflicts = new Set();
      for (let u=span.bottom;u<=span.top;u++) for (const name of cells.get(u)) if (name !== span.machine.name) conflicts.add(name);
      if (conflicts.size) issues.push({name:span.machine.name,code:'overlap',message:'U 位置與其他元件重疊，請確認配置。',conflicts:[...conflicts]});
    }
    const invalid = new Set(issues.map(issue => issue.name)), valid = spans.filter(span => !invalid.has(span.machine.name)).map(span => span.machine), occupied = new Set();
    spans.filter(span => !invalid.has(span.machine.name)).forEach(span => { for(let u=span.bottom;u<=span.top;u++) occupied.add(u); });
    valid.push(...external);
    return {valid,pending,issues,occupied:[...occupied].sort((a,b)=>b-a),usedU:occupied.size};
  }
  const helpers = window.PAWorkspaceReliability = {projectVisible,matchesProject,validatePlacements};
  // Pure helpers can also run in the portable Node regression harness.
  if (typeof RENDERERS === 'undefined') return;
  helpers.rackProjects = () => projects.filter(project => projectVisible(project,projectMembers(project.name),'rack'));
  const membersFor = (project,level) => projectMembers(project.name).filter(machine => inLevelFilter(machine,level));
  // Keep empty-project creation on the existing, supported add-system workflow.
  window.openMachineModal = window.openMachineModal || ((_unused, level) => openAdd(level));
  const visibleProjects = level => projects.filter(project => projectVisible(project,projectMembers(project.name),level));
  const emptyProjects = level => visibleProjects(level).filter(project => !projectMembers(project.name).length);
  const argument = value => esc(JSON.stringify(value));
  const originalLoad = loadMachines;
  loadMachines = async function() {
    // Missing positions stay unplaced. A GET must never write guessed U positions.
    await originalLoad(false);
    helpers.placementByProject = Object.fromEntries(helpers.rackProjects().map(project => [project.name,validatePlacements(projectMembers(project.name).filter(isRackItem))]));
  };

  let search = '';
  const baseList = renderProjectsList, baseFilter = window.productFilter;
  function emptyProjectCard(project,level) {
    const collapsed = !!projectCollapsed[project.name], label = level === 'rack' ? 'L11' : 'L10';
    return `<div class="proj-card card wr-empty-project ${collapsed?'collapsed':''}" data-pname="${esc(project.name)}"><div class="proj-card-head" draggable="true" title="拖動以調整專案順序"><div class="proj-card-grip">⠿</div><div class="proj-card-info"><span class="proj-card-name">${esc(project.name)}</span><span class="proj-card-count">0 台 · ${label}</span><span class="proj-card-desc">${esc(project.desc||'')}</span></div><span class="spacer"></span><button class="btn small proj-collapse-btn" onclick="toggleProject(${argument(project.name)})">${collapsed?'▼ 展開':'▲ 收合'}</button></div>${collapsed?'':`<div class="wr-empty-body"><span>${label} 專案已建立，尚未加入${level==='rack'?'元件':'系統'}。</span><button class="btn small" onclick="${level==='rack'?`productRack(${argument(project.name)})`:`openMachineModal(null,'system')`}">${level==='rack'?'開啟機櫃配置':'新增系統'} ↗</button></div>`}</div>`;
  }
  renderProjectsList = function() {
    const saved = new Map(), level = projectLevelFilter.val;
    // Expansion is a render-only projection, never a change to user collapse intent.
    if (text(search)) for (const project of visibleProjects(level)) {
      const match = matchesProject(project,membersFor(project,level),search);
      if (match.projectMatch || match.names.length) { saved.set(project.name,projectCollapsed[project.name]); projectCollapsed[project.name]=false; }
    }
    let html;
    try { html=baseList(); }
    finally { saved.forEach((value,name)=>{if(value===undefined)delete projectCollapsed[name];else projectCollapsed[name]=value;}); }
    const fragment=document.createElement('div');fragment.innerHTML=html;
    const holder=fragment.querySelector('#proj-sort-list');
    if (holder) {
      const empty=emptyProjects(level);
      if(empty.length)holder.querySelectorAll(':scope > .card:not(.proj-card)').forEach(node=>node.remove());
      empty.forEach(project=>holder.insertAdjacentHTML('beforeend',emptyProjectCard(project,level)));
      const order=new Map(projects.map((project,index)=>[project.name,index]));
      [...holder.querySelectorAll(':scope > .proj-card')].sort((a,b)=>(order.get(a.dataset.pname)??1e9)-(order.get(b.dataset.pname)??1e9)).forEach(card=>holder.appendChild(card));
    }
    return fragment.innerHTML;
  };
  window.productFilter = function(value) {
    search=String(value??'');
    const holder=document.getElementById('proj-sort-list');
    if(holder){holder.outerHTML=renderProjectsList();initProjectDrag();}
    baseFilter(search);
  };
  const originalCollapsed=renderCollapsed;
  renderCollapsed=function(){originalCollapsed();baseFilter(search);};
  const originalLevel=window.productLevel,originalProject=window.productProject;
  window.productLevel=function(level){if(level!==projectLevelFilter.val)search='';return originalLevel(level);};
  window.productProject=function(name,level){search='';return originalProject(name,level);};
  window.cineClearSearch=function(){search='';const input=document.querySelector('.p-search input');if(input)input.value='';productFilter('');};

  const baseProjects=RENDERERS.projects,baseDashboard=RENDERERS.dashboard;
  RENDERERS.projects=function(){
    const fragment=document.createElement('div');fragment.innerHTML=baseProjects();
    const level=projectLevelFilter.val,strip=fragment.querySelector('.p-project-strip'),all=strip?.querySelector('button b');
    if(all)all.textContent=visibleProjects(level).length;
    emptyProjects(level).forEach(project=>strip?.insertAdjacentHTML('beforeend',`<button class="${_activeProject===project.name?'active':''}" onclick="productProject(${argument(project.name)},'${level}')">${esc(project.name)} <b>0</b></button>`));
    const untyped=projects.filter(project=>!['rack','system'].includes(project.level)&&!projectMembers(project.name).length);
    if(untyped.length)fragment.insertAdjacentHTML('beforeend',`<div class="wr-note"><span>${untyped.length} 個空專案尚未設定工程層級：${untyped.map(project=>esc(project.name)).join('、')}。加入第一台系統後將依其層級歸類。</span><button class="btn small" onclick="openProjectModal()">專案管理</button></div>`);
    return fragment.innerHTML;
  };
  RENDERERS.dashboard=function(){
    const fragment=document.createElement('div');fragment.innerHTML=baseDashboard();
    for(const level of ['system','rack']){
      const rack=level==='rack',section=fragment.querySelector(rack?'.p-l11':'.p-l10'),grid=rack?section:section?.querySelector('.p-project-grid');
      emptyProjects(level).forEach(project=>grid?.insertAdjacentHTML('beforeend',`<button class="p-project wr-empty-portfolio" onclick="productProject(${argument(project.name)},'${level}')"><div class="p-card-top"><span class="p-code">${rack?'L11 / RACK':'L10 / SYSTEM'}</span><span class="p-card-arrow">↗</span></div><div class="wr-empty-mark" aria-hidden="true">${rack?'▥':'▰'}</div><div class="p-card-title"><h3>${esc(project.name)}</h3><span class="p-status">尚無${rack?'元件':'系統'}</span></div><p>${esc(project.desc||'專案已建立，等待加入設備。')}</p><footer><span><b>00</b> ${rack?'元件':'系統'}</span><span>READY TO CONFIGURE ↗</span></footer></button>`));
      const count=fragment.querySelector(rack?'#core-rack-copy .cine-live-summary b':'#core-system-copy .cine-live-summary b');
      if(count)count.textContent=String(visibleProjects(level).length).padStart(2,'0');
      const link=section?.querySelector('.p-level-heading button');
      if(link&&!rack)link.textContent=`查看全部 ${String(visibleProjects(level).length).padStart(2,'0')} ↗`;
    }
    return fragment.innerHTML;
  };

  function destroyRackCharts(){
    Object.values(rackTelCharts).forEach(chart=>{try{chart.destroy();}catch{}});
    rackTelCharts={};
  }
  helpers.destroyRackCharts=destroyRackCharts;
  const baseApi=api;
  api=async function(path,options){
    const isRackTelemetry=/^\/api\/rack\/[^/]+\/telemetry(?:\?|$)/.test(String(path));
    if(!isRackTelemetry)return baseApi(path,options);
    const grid=document.getElementById('racktel-grid'),project=rackView.project,minutes=_rackTelMinutes;
    const data=await baseApi(path,options);
    if(grid!==document.getElementById('racktel-grid')||project!==rackView.project||minutes!==_rackTelMinutes||state.view!=='rack'||devicesView!=='telemetry'){
      const stale=new Error('監控檢視已切換，略過舊回應。');stale.name='StaleViewError';throw stale;
    }
    return data;
  };
  // Only one original renderer runs at once; latest project/range is queued.
  // This prevents the original global loading flag from swallowing fast changes.
  const baseTelemetry=loadRackTelemetry;
  let telemetryPromise=null,telemetryQueued=false;
  loadRackTelemetry=function(){
    if(telemetryPromise){telemetryQueued=true;return telemetryPromise;}
    if(state.view!=='rack'||devicesView!=='telemetry'||!document.getElementById('racktel-grid'))return Promise.resolve();
    destroyRackCharts();
    telemetryPromise=Promise.resolve().then(()=>baseTelemetry()).finally(()=>{
      telemetryPromise=null;
      if(telemetryQueued){telemetryQueued=false;loadRackTelemetry();}
    });
    return telemetryPromise;
  };
  const baseRender=_renderMachine;
  _renderMachine=function(view){
    if(state.view==='rack')destroyRackCharts();
    return baseRender(view);
  };
})();
