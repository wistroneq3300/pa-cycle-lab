/* Product Assurance overview. Durable validation data comes from one read-only endpoint. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const replayKey='pa_dashboard_cinematic_played';
  let overview=null,selectedProject='',loading=null,teardown=()=>{};
  const quote=value=>esc(JSON.stringify(String(value)));
  const readRecent=()=>{try{return JSON.parse(sessionStorage.getItem('pa_recent_devices')||'[]');}catch{return [];}};
  const fmt=value=>value?new Date(value*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚無紀錄';
  const projectByName=name=>overview?.projects?.find(project=>project.name===name);

  RENDERERS.dashboard=()=>`<main class="vo-overview" aria-label="Product Assurance Overview">
    <section class="vo-hero" id="core-story" aria-label="專案驗證總覽與 L10 System 到 L11 Rack 展示">
      <div class="vo-hero-copy">
        <span class="vo-kicker">PRODUCT ASSURANCE OVERVIEW</span>
        <label class="vo-project-select">專案範圍<select data-vo-select aria-label="Dashboard 專案範圍"><option value="">所有專案</option></select></label>
        <div class="vo-hero-heading"><span data-vo-level>全域驗證狀態</span><h1 data-vo-title>正在取得驗證狀態…</h1></div>
        <div class="vo-hero-counts"><span><b data-vo-systems>—</b> Systems</span><span><b data-vo-nodes>—</b> Nodes</span></div>
        <p class="vo-hero-issues"><strong data-vo-fail>— FAIL</strong><span data-vo-warn>— WARN</span></p>
        <p class="vo-hero-note" data-vo-summary>巡檢、Cycle 與監控狀態載入中。</p>
        <button class="btn primary" type="button" data-vo-enter>進入系統與專案</button>
      </div>
      <div class="cine-stage vo-scene" id="core-stage" data-phase="system">
        <div class="cine-core" id="core-visual"><img class="cine-fallback" src="/static/img/server-hero.png" alt="伺服器設備視圖"><canvas id="system-core" tabindex="0" role="img" aria-label="伺服器對準 U40、插入並拉遠顯示完整機櫃的 3D 動畫" aria-describedby="core-interaction-help"></canvas></div>
        <div class="vo-phase"><span data-vo-phase-number>01</span><div><b data-vo-phase-title>L10 SYSTEM</b><small data-vo-phase-detail>SERVER FOCUS</small></div></div>
        <div class="vo-cinematic-progress" aria-hidden="true"><i data-vo-progress></i></div>
        <button class="vo-replay" type="button" data-vo-replay aria-label="重播 Server 到 Rack 動畫">↻ 重播</button>
        <div class="cine-core-tools" id="core-tools"><span id="core-interaction-help">按住拖曳旋轉 · 方向鍵查看 · Home 重設</span><div><button type="button" data-core-view="rear" aria-label="3D 模型背面視角">背面</button><button type="button" data-core-view="reset" aria-label="重設 3D 模型視角">重設視角</button></div></div>
        <div id="core-system-copy" class="vo-a11y-state" aria-hidden="false">L10 System</div><div id="core-rack-copy" class="vo-a11y-state" inert aria-hidden="true">L11 Rack</div>
      </div>
    </section>
    <section class="vo-key-status" aria-labelledby="vo-key-title"><header><span class="vo-kicker">KEY STATUS</span><h2 id="vo-key-title">驗證狀態</h2></header><div data-vo-status><p class="vo-loading">正在取得狀態…</p></div></section>
    <section class="vo-attention" aria-labelledby="vo-attention-title"><header><div><span class="vo-kicker">ATTENTION REQUIRED</span><h2 id="vo-attention-title">需要處理</h2></div><span data-vo-attention-count>—</span></header><div data-vo-attention><p class="vo-loading">正在取得巡檢問題…</p></div></section>
    <section class="vo-projects" aria-labelledby="vo-projects-title"><header><div><span class="vo-kicker">PROJECTS</span><h2 id="vo-projects-title">專案驗證摘要</h2></div><span data-vo-project-count>—</span></header><div class="vo-project-grid" data-vo-projects><p class="vo-loading">正在取得專案…</p></div></section>
    <section class="vo-recent" aria-labelledby="vo-recent-title"><header><span class="vo-kicker">RECENT ACTIVITY</span><h2 id="vo-recent-title">最近使用與執行</h2></header><div data-vo-recent><p class="vo-loading">正在取得最近活動…</p></div></section>
  </main>`;

  function selectedSummary(){return selectedProject?projectByName(selectedProject):overview?.totals;}
  function renderData(){
    const root=document.querySelector('.vo-overview');if(!root||!overview)return;
    if(selectedProject&&!projectByName(selectedProject))selectedProject='';
    const select=root.querySelector('[data-vo-select]');select.replaceChildren(new Option('所有專案',''));
    for(const project of overview.projects){select.add(new Option(project.name,project.name));}select.value=selectedProject;
    const item=selectedSummary(),isProject=!!selectedProject;
    root.querySelector('[data-vo-level]').textContent=isProject?(item.level==='L11'?'L11 Validation':'L10 Validation'):'全域驗證狀態';
    root.querySelector('[data-vo-title]').textContent=isProject?item.name:'所有專案';
    root.querySelector('[data-vo-systems]').textContent=item.systems;root.querySelector('[data-vo-nodes]').textContent=item.nodes;
    root.querySelector('[data-vo-fail]').textContent=`${item.issues.fail} FAIL`;root.querySelector('[data-vo-warn]').textContent=`${item.issues.warning} WARN`;
    root.querySelector('[data-vo-summary]').textContent=`Cycle ${item.cycle.running} Running · Monitoring ${item.monitoring.reporting} / ${item.monitoring.total}`;
    root.querySelector('[data-vo-enter]').textContent=isProject?'進入專案':'進入系統與專案';
    const cards=[
      ['Active Issues',`${item.issues.fail} FAIL · ${item.issues.warning} WARN`,'需要檢視的巡檢問題',item.issues.fail?'fail':item.issues.warning?'warn':'ok'],
      ['Validation',`${item.validation.checked} / ${item.validation.total}`,'Nodes checked',item.validation.checked<item.validation.total?'warn':'ok'],
      ['Cycle',`${item.cycle.running} Running · ${item.cycle.completed} Completed`,'Cycle validation runs',item.cycle.running?'active':'ok'],
      ['Monitoring',`${item.monitoring.reporting} / ${item.monitoring.total}`,'Nodes reporting',item.monitoring.reporting<item.monitoring.total?'warn':'ok']
    ];
    root.querySelector('[data-vo-status]').innerHTML=cards.map(([label,value,detail,state])=>`<article data-state="${state}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
    const issues=overview.issues.filter(issue=>!selectedProject||issue.project===selectedProject).slice(0,6);
    root.querySelector('[data-vo-attention-count]').textContent=`${issues.length} 項`;
    root.querySelector('[data-vo-attention]').innerHTML=issues.length?issues.map(issue=>`<button type="button" class="vo-issue" data-severity="${issue.severity}" onclick="openMachine(${quote(issue.system)})"><span>${issue.severity}</span><div><b>${esc(issue.system)}${issue.node?' / '+esc(issue.node):''}</b><strong>${esc(issue.component||issue.rule||'巡檢問題')}</strong><small>${esc(issue.facts||'請查看巡檢證據與分析依據')}</small></div><i aria-hidden="true">查看 →</i></button>`).join(''):'<div class="vo-empty"><strong>目前沒有待處理的巡檢問題</strong><span>仍請連同資料涵蓋率與最近巡檢時間判讀。</span></div>';
    root.querySelector('[data-vo-project-count]').textContent=`${overview.projects.length} Projects`;
    root.querySelector('[data-vo-projects]').innerHTML=overview.projects.length?overview.projects.map(project=>`<button type="button" class="vo-project-card" onclick="cineOpenProject(${quote(project.name)})"><header><span>${project.level}</span><b>${esc(project.name)}</b><i>↗</i></header><p>${project.systems} Chassis · ${project.nodes} Nodes</p><div class="vo-project-results"><strong>${project.issues.fail} FAIL</strong><span>${project.issues.warning} WARN</span><em>${project.validation.pass} PASS</em></div><dl><div><dt>Cycle</dt><dd>${project.cycle.running} Running</dd></div><div><dt>Telemetry</dt><dd>${project.monitoring.reporting} / ${project.monitoring.total}</dd></div><div><dt>Inspection</dt><dd>${project.validation.checked} / ${project.validation.total}</dd></div></dl><small>最近驗證 ${fmt(project.last_validation)}</small></button>`).join(''):'<div class="vo-empty"><strong>尚無可顯示的專案</strong><span>新增專案與系統後，驗證摘要會顯示在這裡。</span></div>';
    const recentDevices=readRecent().filter(name=>machines.some(machine=>machine.name===name)).slice(0,4);
    const runs=overview.recent_runs.filter(run=>!selectedProject||run.project===selectedProject).slice(0,4);
    root.querySelector('[data-vo-recent]').innerHTML=`<div><h3>最近使用</h3>${recentDevices.length?recentDevices.map(name=>`<button type="button" onclick="openMachine(${quote(name)})"><b>${esc(name)}</b><span>開啟 →</span></button>`).join(''):'<p>尚無最近使用的系統。</p>'}</div><div><h3>最近 Cycle</h3>${runs.length?runs.map(run=>`<a href="#/cycle/runs/${encodeURIComponent(run.id)}"><b>${esc(run.project)}</b><span>${esc(run.state)} · ${fmt(run.updated_at||run.created_at)}</span></a>`).join(''):'<p>尚無 Cycle 執行紀錄。</p>'}</div>`;
  }

  async function loadOverview(){
    if(overview){renderData();return;}if(loading)return loading;
    loading=fetch('/api/validation/overview',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('驗證總覽暫時無法取得');overview=await response.json();renderData();}).catch(error=>{
      const root=document.querySelector('.vo-overview');if(root)root.querySelectorAll('.vo-loading').forEach(node=>node.textContent=error.message+'，請稍後重新整理。');
    }).finally(()=>{loading=null;});return loading;
  }

  function applyProgress(value){
    const stage=document.getElementById('core-stage'),canvas=document.getElementById('system-core');if(!stage||!canvas)return;
    const progress=Math.max(0,Math.min(1,value));canvas.paCoreScene?.setProgress(progress);stage.dataset.phase=progress<.12?'system':progress<.78?'integration':'rack';
    stage.querySelector('[data-vo-progress]')?.style.setProperty('width',`${Math.round(progress*100)}%`);
    const number=stage.querySelector('[data-vo-phase-number]'),title=stage.querySelector('[data-vo-phase-title]'),detail=stage.querySelector('[data-vo-phase-detail]');
    if(progress<.12){number.textContent='01';title.textContent='L10 SYSTEM';detail.textContent='SERVER FOCUS';}
    else if(progress<.78){number.textContent='01 → 02';title.textContent='INTEGRATION';detail.textContent=progress<.4?'ALIGN TO U40':'SYSTEM → RACK';}
    else{number.textContent='02';title.textContent='L11 RACK';detail.textContent='FULL RACK';}
  }
  const ease=t=>t*t*(3-2*t);
  function timedProgress(t){
    if(t<.15)return 0;
    if(t<.38)return ease((t-.15)/.23)*.38;
    if(t<.72)return .38+ease((t-.38)/.34)*.38;
    if(t<.82)return .76;
    return .76+ease((t-.82)/.18)*.24;
  }
  function mountOverview(){
    teardown();teardown=()=>{};const root=document.querySelector('.vo-overview'),story=document.getElementById('core-story'),canvas=document.getElementById('system-core');if(!root||!story||!canvas)return;
    const select=root.querySelector('[data-vo-select]');select.onchange=()=>{selectedProject=select.value;renderData();};root.querySelector('[data-vo-enter]').onclick=()=>window.cineEnterSelected();root.querySelector('[data-vo-replay]').onclick=()=>play(true);
    void loadOverview();
    let frame=0,timer=0,cancelled=false,start=0;
    const cancel=()=>{cancelled=true;clearTimeout(timer);cancelAnimationFrame(frame);};
    const manualScroll=()=>{cancel();const top=story.getBoundingClientRect().top,progress=Math.max(0,Math.min(1,(80-top)/Math.max(420,story.offsetHeight*.75)));applyProgress(progress);};
    const input=()=>cancel();
    const tick=now=>{if(cancelled)return;if(!start)start=now;const t=Math.min(1,(now-start)/5600);applyProgress(timedProgress(t));if(t<1)frame=requestAnimationFrame(tick);};
    function play(force=false){cancel();cancelled=false;start=0;applyProgress(0);try{sessionStorage.setItem(replayKey,'1');}catch{}timer=setTimeout(()=>{if(!cancelled)frame=requestAnimationFrame(tick);},force?80:800);}
    let played=false;try{played=sessionStorage.getItem(replayKey)==='1';}catch{}
    if(reduced.matches||played)applyProgress(1);else play();
    window.addEventListener('scroll',manualScroll,{passive:true});canvas.addEventListener('pointerdown',input,{passive:true});canvas.addEventListener('touchstart',input,{passive:true});canvas.addEventListener('keydown',input);story.addEventListener('wheel',input,{passive:true});
    teardown=()=>{cancel();window.removeEventListener('scroll',manualScroll);canvas.removeEventListener('pointerdown',input);canvas.removeEventListener('touchstart',input);canvas.removeEventListener('keydown',input);story.removeEventListener('wheel',input);};
  }
  window.cineOpenProject=name=>{const project=projectByName(name);productProject(name,project?.level==='L11'?'rack':'system');};
  window.cineEnterSelected=()=>selectedProject?window.cineOpenProject(selectedProject):productLevel('system');
  const render=_renderMachine;
  _renderMachine=function(...args){const result=render(...args);if(state.view==='dashboard')requestAnimationFrame(mountOverview);else teardown();return result;};
})();
