/* Presentation layer for the isolated preview. Original app.js remains intact. */
(() => {
  const oldDashboard=RENDERERS.dashboard;
  const oldProjects=RENDERERS.projects;
  const oldRack=RENDERERS.rack;
  const oldMachine=RENDERERS.machine;
  const oldRender=_renderMachine;
  const quote=v=>JSON.stringify(v).replace(/"/g,'&quot;');
  const number=n=>String(n).padStart(2,'0');
  function chassis(){return `<div class="at-server-art" aria-hidden="true"><div class="at-server-shadow"></div>${[0,1,2].map(i=>`<div class="at-server-unit at-unit-${i}"><div class="at-server-top"><span>WISTRON / SYSTEM</span><div class="at-vent-grid"></div></div><div class="at-server-front"><span class="at-server-handle"></span><span class="at-drive-bays">${'<i></i>'.repeat(8)}</span><span class="at-server-lights"><i></i><i></i></span><span class="at-server-handle"></span></div></div>`).join('')}<div class="at-art-caption">SYSTEM LEVEL / L10</div></div>`;}
  function cabinet(){return `<div class="at-rack-art" aria-hidden="true"><div class="at-rack-shadow"></div><div class="at-cabinet"><div class="at-cabinet-cap">wistron <span>48U</span></div><div class="at-cabinet-slots">${Array.from({length:12},(_,i)=>`<div class="at-cabinet-slot ${i===0||i===1?'at-network':i>9?'at-power':''}"><i></i><span></span><b></b></div>`).join('')}</div></div><div class="at-art-caption">RACK LEVEL / L11</div></div>`;}
  function heading(kicker,title,description,action=''){return `<div class="at-heading"><div><div class="at-eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;}
  function projectCard(p,level){const members=projectMembers(p.name).filter(m=>inLevelFilter(m,level)),on=members.filter(m=>m.os_alive===true).length,bad=members.filter(m=>(m.os_ip||m.bmc_ip)&&m.os_alive!==true).length;return `<button type="button" class="at-project" onclick="atelierProject(${quote(p.name)},'${level}')"><div class="at-project-top"><span class="at-project-icon">${level==='rack'?'L11':'L10'}</span><span class="at-project-health ${bad?'at-attention':''}">${bad?bad+' attention':'Healthy'}</span><span class="at-project-arrow">↗</span></div><h3>${esc(p.name)}</h3><p>${esc(p.desc||'Project workspace')}</p><div class="at-project-bottom"><span><b>${number(members.length)}</b> ${level==='rack'?'components':'systems'}</span><span><i class="at-dot"></i>${on} online</span></div></button>`;}
  window.atelierProject=(name,level)=>{projectLevelFilter.val=level;_activeProject=name;_flashActiveProject=true;projects.forEach(p=>projectCollapsed[p.name]=p.name!==name);setView('projects');};
  window.atelierLevel=level=>{projectLevelFilter.val=level;_activeProject='';projects.forEach(p=>projectCollapsed[p.name]=false);setView('projects');};
  window.atelierRack=name=>{rackView.project=name;devicesView='plane';setView('rack');};
  RENDERERS.dashboard=()=>{
    const original=document.createElement('div');original.innerHTML=oldDashboard();
    const levels=level=>projects.filter(p=>projectMembers(p.name).some(m=>inLevelFilter(m,level)));
    const l10=levels('system'),l11=levels('rack');
    const rackProject=l11[0],rm=rackProject?projectMembers(rackProject.name):[];
    const health=original.querySelector('.dash-mid')?.outerHTML||'';
    const copilot=original.querySelector('.rack-cop-panel')?.outerHTML||'';
    return heading('WISTRON PA / PROJECT WORKSPACE','專案總覽','L10 System Level 與 L11 Rack Level。專案分開，管理一致。',`<button class="btn at-main-action" onclick="openProjectModal()">專案管理 <span>↗</span></button>`)+
    `<div class="at-statusline">${[['受管系統',machines.length],['L10 系統',machines.filter(m=>!isRackItem(m)).length],['L11 元件',machines.filter(isRackItem).length],['在線率',Math.round(machines.filter(m=>m.os_alive===true).length/machines.length*100)+'%'],['電源 ON / OFF',machines.filter(m=>m.power==='ON').length+' / '+machines.filter(m=>m.power==='OFF').length],['離線',machines.filter(m=>m.os_alive===false).length]].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    <div class="at-portfolios">
      <section class="at-portfolio at-l10-portfolio"><div class="at-portfolio-cover"><div class="at-cover-copy"><span class="at-level-tag">L10 / SYSTEM LEVEL</span><h2>System<br>projects<span>.</span></h2><p>單機專案管理</p><button type="button" class="at-cover-link" onclick="atelierLevel('system')">進入 System Manager <span>→</span></button></div>${chassis()}<div class="at-cover-grid"></div></div><div class="at-section-caption"><span>單機專案</span><span>${number(l10.length)} PROJECTS</span></div><div class="at-project-grid">${l10.map(p=>projectCard(p,'system')).join('')}<button type="button" class="at-manage-tile" onclick="openProjectModal()"><span>＋</span><b>專案管理</b><small>新增、編輯與整理</small></button></div></section>
      <section class="at-portfolio at-l11-portfolio"><div class="at-portfolio-cover"><div class="at-cover-copy"><span class="at-level-tag">L11 / RACK LEVEL</span><h2>Rack<br>projects<span>.</span></h2><p>整櫃專案管理</p><button type="button" class="at-cover-link" onclick="atelierLevel('rack')">檢視 L11 專案 <span>→</span></button></div>${cabinet()}<div class="at-cover-grid"></div></div><div class="at-section-caption"><span>整櫃專案</span><span>${number(l11.length)} PROJECT</span></div><div class="at-rack-project-body">${l11.map(p=>projectCard(p,'rack')).join('')}<div class="at-component-list">${[['server','Servers'],['switch','Switches'],['powershelf','Power shelves'],['pdu','PDU'],['cdu','CDU'],['blanking','Blanking']].map(([k,label])=>`<div><span>${label}</span><b>${rm.filter(m=>mgxTypeOf(m)===k).length}</b></div>`).join('')}</div>${rackProject?`<button class="btn at-rack-entry" onclick="atelierRack(${quote(rackProject.name)})">開啟 Rack Manager <span>48U / 平面圖・拓樸・Telemetry →</span></button>`:''}</div></section>
    </div><div class="at-insights">${health}${copilot}</div><div class="at-page-foot">WISTRON PA / ENGINEERING WORKSPACE <span>獨立設計預覽 · 示意資料</span></div>`;
  };
  RENDERERS.projects=()=>heading('PROJECT OPERATIONS','System Manager','依專案管理機台。L10 單機與 L11 整櫃各自分組。')+oldProjects();
  RENDERERS.rack=()=>{
    const html=oldRack(),p=rackView.project,ms=machines.filter(m=>m.project===p&&isRackItem(m));
    return heading('L11 / RACK LEVEL','Rack Manager','專案內的機櫃配置、元件管理與整櫃遥測。')+`<div class="at-rack-banner"><div><span class="at-level-tag">L11 PROJECT</span><h2>${esc(p||'選擇專案')}</h2><p>${esc(projects.find(x=>x.name===p)?.desc||'Rack-level project')}</p><div class="at-rack-banner-stats"><span><b>48U</b> Rack capacity</span><span><b>${ms.length}</b> Components</span><span><b>${ms.filter(m=>m.mgx_type==='server').length}</b> Servers</span></div></div>${cabinet()}</div>`+html;
  };
  RENDERERS.machine=()=>{const m=machines.find(m=>m.name===_activeMachine);return heading((m?.level==='rack'?'L11 / RACK LEVEL':'L10 / SYSTEM LEVEL')+' / '+(m?.project||''),_activeMachine||'System details','系統資訊、感測器、測試任務與 Telemetry。')+oldMachine();};
  const originalRow=machineRowSortable;
  machineRowSortable=(...args)=>{
    const wrap=document.createElement('table');wrap.innerHTML='<tbody>'+originalRow(...args)+'</tbody>';
    const row=wrap.rows[0],cell=row.lastElementChild,buttons=[...cell.querySelectorAll('button')];
    const primary=buttons.find(b=>b.textContent.includes('Terminal'));
    const details=document.createElement('details');details.className='at-row-menu';
    const summary=document.createElement('summary');summary.textContent='•••';summary.setAttribute('aria-label','More system actions');details.append(summary);
    const menu=document.createElement('div');buttons.filter(b=>b!==primary).forEach(b=>menu.append(b));details.append(menu);
    cell.innerHTML='';if(primary)cell.append(primary);cell.append(details);return row.outerHTML;
  };
  function decorate(){
    document.body.dataset.atView=state.view;
    document.querySelectorAll('.nav-btn').forEach(b=>{const label={dashboard:['01','專案總覽','Dashboard'],projects:['02','系統與專案','System Manager'],rack:['03','整櫃管理','Rack Manager']}[b.dataset.view];if(label)b.innerHTML=`<span class="at-nav-index">${label[0]}</span><span class="at-nav-copy"><b>${label[1]}</b><small>${label[2]}</small></span><span class="at-nav-arrow">↗</span>`;});
    document.querySelectorAll('.lvl-tab').forEach(b=>{const lv=b.dataset.lvl;b.innerHTML=`<span class="at-tab-code">${lv==='system'?'L10':'L11'}</span><span>${lv==='system'?'System Level':'Rack Level'}<small>${lv==='system'?'單機專案':'整櫃專案'}</small></span><b>${machines.filter(m=>inLevelFilter(m,lv)).length}</b>`;});
  }
  _renderMachine=function(view){oldRender(view);decorate();};
  const oldLevel=setProjectLevelFilter;setProjectLevelFilter=function(v){oldLevel(v);decorate();};
  window.openKvmBroadcast=project=>{
    const ms=projectMembers(project).filter(m=>m.bmc_ip);
    showDialog('KVM / '+project,`<div class="at-kvm-toolbar"><span>MASTER / ${esc(ms[0]?.name||'')}</span><label><input type="checkbox"> Keyboard sync</label><label><input type="checkbox"> Mouse sync</label></div><div class="at-kvm-grid">${ms.map((m,i)=>`<div class="at-kvm-screen"><div>${esc(m.name)} <span>${i?'SLAVE':'MASTER'}</span></div><pre>WISTRON PA / KVM PREVIEW\n\n${esc(m.name)}\n\nNo live BMC session.\nDesign preview only.</pre></div>`).join('')}</div>`,[{txt:'Close',cls:'primary',fn:closeDialog}]);
    document.querySelector('#rm-dialog .modal').style.width='1000px';
  };
  document.addEventListener('DOMContentLoaded',()=>{
    applyTheme('light');
    const brand=document.querySelector('.brand');brand.innerHTML='<div class="at-brand-plate"><img src="/static/img/wistronlogo.png" alt="Wistron"></div><div class="at-brand-divider"></div><div class="at-brand-product">PA Server<br>Manager<span>.</span></div><div class="at-brand-caption">ENGINEERING WORKSPACE</div>';
    document.querySelector('.sidebar-foot').innerHTML='<div class="at-side-projects"><span>PROJECT LEVELS</span><button onclick="atelierLevel(\'system\')">L10 <b>System Level</b> ↗</button><button onclick="atelierLevel(\'rack\')">L11 <b>Rack Level</b> ↗</button></div><div class="at-side-bottom"><span class="at-dot"></span>DESIGN PREVIEW<br><small>Original workflows. New perspective.</small><span id="mode-label" hidden></span></div>';
    const top=document.querySelector('.topbar');const crumb=document.createElement('span');crumb.className='at-top-crumb';crumb.innerHTML='WORKSPACE <span>/</span>';top.prepend(crumb);
    const preview=document.createElement('span');preview.className='at-preview-badge';preview.textContent='PREVIEW / 示意資料';top.insertBefore(preview,top.querySelector('.user'));
    decorate();
  });
})();
