/* Product Assurance overview. Durable validation data comes from one read-only endpoint. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const replayKey='pa_dashboard_cinematic_v3_played';
  const REFRESH_MS=30000;
  let overview=null,selectedProject='',loading=null,teardown=()=>{};
  const quote=value=>esc(JSON.stringify(String(value)));
  const fmt=value=>value?new Date(value*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚無紀錄';
  const projectByName=name=>overview?.projects?.find(project=>project.name===name);

  RENDERERS.dashboard=()=>`<main class="vo-overview" aria-label="Product Assurance Overview">
    <section class="vo-hero" id="core-story" aria-label="專案驗證總覽與 AI infrastructure 整櫃組裝展示">
      <div class="vo-hero-copy">
        <span class="vo-kicker">PRODUCT ASSURANCE OVERVIEW</span>
        <label class="vo-project-select">專案範圍<select data-vo-select aria-label="Dashboard 專案範圍"><option value="">所有專案</option></select></label>
        <div class="vo-hero-heading"><span data-vo-level>全域驗證狀態</span><h1 data-vo-title>正在取得驗證狀態…</h1></div>
        <div class="vo-hero-summary">
        <div class="vo-hero-counts"><span><b data-vo-hero-projects>—</b> Projects</span><span><b data-vo-systems>—</b> Systems</span><span><b data-vo-nodes>—</b> Nodes</span></div>
        <p class="vo-hero-issues"><strong data-vo-fail>— FAIL</strong><span data-vo-warn>— WARN</span></p>
        <p class="vo-hero-note" data-vo-summary>巡檢、Cycle 與監控狀態載入中。</p>
        </div>
        <button class="btn primary" type="button" data-vo-enter>進入系統與專案</button>
      </div>
      <div class="cine-stage vo-scene" id="core-stage" data-phase="system">
        <div class="cine-core" id="core-visual"><img class="cine-fallback" src="/static/img/server-hero.png" alt="伺服器設備視圖"><canvas id="system-core" tabindex="0" role="img" aria-label="AI infrastructure 整櫃組裝：空機櫃、設備辨識、多組同步進場、實體導軌特寫、工程展開與完整機櫃" aria-describedby="core-interaction-help"></canvas><svg class="vo-device-callouts" data-vo-callouts aria-hidden="true"></svg></div>
        <div class="vo-phase"><span data-vo-phase-number>01</span><div><b data-vo-phase-title>L10 SYSTEM</b><small data-vo-phase-detail>SERVER FOCUS</small></div></div>
        <div class="vo-cinematic-progress" aria-hidden="true"><i data-vo-progress></i></div>
        <button class="vo-replay" type="button" data-vo-replay aria-label="重播機櫃電影展示">↻ 重播</button>
        <div class="cine-core-tools" id="core-tools"><span id="core-interaction-help">按住拖曳旋轉 · 方向鍵查看 · Home 重設</span><div><button type="button" data-core-view="rear" aria-label="3D 模型背面視角">背面</button><button type="button" data-core-view="reset" aria-label="重設 3D 模型視角">重設視角</button></div></div>
        <div id="core-system-copy" class="vo-a11y-state" aria-hidden="false">L10 System</div><div id="core-rack-copy" class="vo-a11y-state" inert aria-hidden="true">L11 Rack</div>
      </div>
    </section>
    <section class="vo-key-status" aria-labelledby="vo-key-title"><header><span class="vo-kicker">KEY STATUS</span><h2 id="vo-key-title">驗證狀態</h2></header><div data-vo-status><p class="vo-loading">正在取得狀態…</p></div></section>
    <section class="vo-attention" aria-labelledby="vo-attention-title"><header><div><span class="vo-kicker">ATTENTION REQUIRED</span><h2 id="vo-attention-title">需要處理</h2></div><span data-vo-attention-count>—</span></header><div data-vo-attention><p class="vo-loading">正在取得巡檢問題…</p></div></section>
    <section class="vo-projects" aria-labelledby="vo-projects-title"><header><div><span class="vo-kicker">INSPECTION HEALTH</span><h2 id="vo-projects-title">Project Inspection Health — Top 5</h2></div><span data-vo-project-count>—</span></header><div class="vo-project-health" data-vo-projects><p class="vo-loading">正在取得專案巡檢狀態…</p></div></section>
  </main>`;

  function selectedSummary(){return selectedProject?projectByName(selectedProject):overview?.totals;}
  function renderData(){
    const root=document.querySelector('.vo-overview');if(!root||!overview)return;
    if(selectedProject&&!projectByName(selectedProject))selectedProject='';
    const select=root.querySelector('[data-vo-select]'),names=overview.projects.map(project=>project.name),existing=[...select.options].slice(1).map(option=>option.value);
    if(names.length!==existing.length||names.some((name,index)=>name!==existing[index])){
      select.replaceChildren(new Option('所有專案',''));for(const name of names)select.add(new Option(name,name));
    }
    select.value=selectedProject;
    const item=selectedSummary(),isProject=!!selectedProject;
    root.querySelector('[data-vo-level]').textContent=isProject?(item.level==='L11'?'L11 Validation':'L10 Validation'):'全域驗證狀態';
    root.querySelector('[data-vo-title]').textContent=isProject?item.name:'所有專案';
    root.querySelector('[data-vo-hero-projects]').textContent=isProject?1:overview.projects.length;
    root.querySelector('[data-vo-systems]').textContent=item.systems;root.querySelector('[data-vo-nodes]').textContent=item.nodes;
    root.querySelector('[data-vo-fail]').textContent=`${item.issues.fail} FAIL`;root.querySelector('[data-vo-warn]').textContent=`${item.issues.warning} WARN`;
    root.querySelector('[data-vo-summary]').textContent=`Cycle ${item.cycle.running} Running · Telemetry ${item.monitoring.reporting} / ${item.monitoring.total}`;
    root.querySelector('[data-vo-enter]').textContent=isProject?'進入專案':'進入系統與專案';
    const cards=[
      ['Active Issues',`${item.issues.fail} FAIL · ${item.issues.warning} WARN`,'需要檢視的巡檢問題',item.issues.fail?'fail':item.issues.warning?'warn':'ok'],
      ['Validation',`${item.validation.checked} / ${item.validation.total}`,'Nodes checked',item.validation.checked<item.validation.total?'warn':'ok'],
      ['Cycle',`${item.cycle.running} Running · ${item.cycle.completed} Completed`,'Cycle validation runs',item.cycle.running?'active':'ok'],
      ['Telemetry',`${item.monitoring.reporting} / ${item.monitoring.total}`,'Nodes reporting',item.monitoring.reporting<item.monitoring.total?'warn':'ok']
    ];
    root.querySelector('[data-vo-status]').innerHTML=cards.map(([label,value,detail,state])=>`<article data-state="${state}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
    const issues=overview.issues.filter(issue=>!selectedProject||issue.project===selectedProject).slice(0,6);
    root.querySelector('[data-vo-attention-count]').textContent=`${issues.length} 項`;
    root.querySelector('[data-vo-attention]').innerHTML=issues.length?issues.map(issue=>`<button type="button" class="vo-issue" data-severity="${issue.severity}" onclick="openMachine(${quote(issue.system)})"><span>${issue.severity}</span><div><b>${esc(issue.system)}${issue.node?' / '+esc(issue.node):''}</b><strong>${esc(issue.component||issue.rule||'巡檢問題')}</strong><small>${esc(issue.facts||'請查看巡檢證據與分析依據')}</small></div><i aria-hidden="true">查看 →</i></button>`).join(''):'<div class="vo-empty"><strong>目前沒有待處理的巡檢問題</strong><span>仍請連同資料涵蓋率與最近巡檢時間判讀。</span></div>';
    const healthProjects=overview.projects.slice(0,5);root.querySelector('[data-vo-project-count]').textContent=`Top ${healthProjects.length} / ${overview.projects.length} Projects`;
    root.querySelector('[data-vo-projects]').innerHTML=healthProjects.length?`<div class="vo-health-table" role="table" aria-label="Project Inspection Health"><div class="vo-health-row vo-health-head" role="row"><span>Project Name</span><span>Affected Nodes</span><span>FAIL Count</span><span>FAIL Rate</span><span>Inspection Coverage</span><span>Last Inspection</span><span>Health Status</span></div>${healthProjects.map(project=>{const inspection=project.inspection||{},rate=inspection.fail_rate==null?'NO DATA':inspection.fail_rate.toFixed(1)+'%',coverage=(inspection.coverage??0).toFixed(1)+'%';return `<button type="button" class="vo-health-row" role="row" onclick="openProjectInspection(${quote(project.name)})"><b>${esc(project.name)}</b><span>${inspection.affected_nodes??0} / ${project.nodes}</span><strong>${inspection.fail_count??0}</strong><span>${rate}</span><span>${coverage}</span><span>${fmt(inspection.last_inspection)}</span><em data-health="${esc(inspection.health_status||'UNKNOWN')}">${esc(inspection.health_status||'UNKNOWN')}</em></button>`;}).join('')}</div>`:'<div class="vo-empty"><strong>尚無可顯示的專案</strong><span>新增專案與系統後，Inspection Health 會顯示在這裡。</span></div>';
  }

  async function loadOverview(force=false,silent=false){
    if(overview&&!force){renderData();return;}if(loading)return loading;
    loading=fetch('/api/validation/overview',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('驗證總覽暫時無法取得');overview=await response.json();renderData();}).catch(error=>{
      if(silent&&overview)return;
      const root=document.querySelector('.vo-overview');if(root)root.querySelectorAll('.vo-loading').forEach(node=>node.textContent=error.message+'，請稍後重新整理。');
    }).finally(()=>{loading=null;});return loading;
  }

  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  const ease=t=>t*t*(3-2*t);
  // The scene owns geometry and camera interpolation. This is the single owner
  // of cinematic time; cinematic.js only mounts/themes the compact scene.
  const FILM_MS=24000;
  const filmKeys=[[0,0],[1.8,.10],[3.6,.19],[4.25,.225],[5.45,.28],[6.45,.34],[9.8,.48],[12.6,.60],[15,.70],[16,.76],[18.5,.84],[19.5,.86],[22,.94],[24,1]];
  const shots=[
    [0,'reveal','01','AI INFRASTRUCTURE','REVEAL / 48U ARCHITECTURE'],
    [.10,'constellation','02','DEVICE CONSTELLATION','COMPUTE / FABRIC / POWER'],
    [.19,'identify','03','SYSTEM ARCHITECTURE','IDENTIFY / INFRASTRUCTURE COMPONENTS'],
    [.34,'convergence','04','FULL-RACK ASSEMBLY','COORDINATED EQUIPMENT CONVERGENCE'],
    [.48,'insertion','05','PRECISION IN MOTION','U40 / TELESCOPING RAIL ENGAGEMENT'],
    [.60,'pullback','06','RACK-SCALE INTEGRATION','SYNCHRONIZED ASSEMBLY'],
    [.70,'complete','07','SYSTEM ASSEMBLED','COMPUTE / INTERCONNECT / POWER'],
    [.76,'exploded','08','ENGINEERING STUDY','ARCHITECTURE LAYERS'],
    [.86,'return','09','PRECISION ENGINEERING','RETURN / EXACT SEATING'],
    [.94,'final','10','AI INFRASTRUCTURE','RACK-SCALE COMPUTING']
  ];
  function applyProgress(value){
    const stage=document.getElementById('core-stage'),canvas=document.getElementById('system-core');if(!stage||!canvas)return;
    const progress=clamp(value);canvas.paCoreScene?.setProgress(progress);
    stage.dataset.phase=progress<.10?'system':progress<.70?'integration':'rack';
    let shot=shots[0];for(const candidate of shots){if(progress<candidate[0])break;shot=candidate;}
    if(stage.dataset.shot!==shot[1]){
      stage.dataset.shot=shot[1];
      stage.querySelector('[data-vo-phase-number]').textContent=shot[2];
      stage.querySelector('[data-vo-phase-title]').textContent=shot[3];
      stage.querySelector('[data-vo-phase-detail]').textContent=shot[4];
      const system=stage.querySelector('#core-system-copy'),rack=stage.querySelector('#core-rack-copy'),showRack=progress>=.70;
      system.inert=showRack;system.setAttribute('aria-hidden',String(showRack));
      rack.inert=!showRack;rack.setAttribute('aria-hidden',String(!showRack));
    }
    stage.querySelector('[data-vo-progress]').style.transform=`scaleX(${progress.toFixed(4)})`;
  }
  function timedProgress(milliseconds){
    const seconds=milliseconds/1000;
    for(let i=1;i<filmKeys.length;i++){
      const [end,p1]=filmKeys[i], [start,p0]=filmKeys[i-1];
      if(seconds<=end)return p0+(p1-p0)*ease(clamp((seconds-start)/(end-start)));
    }
    return 1;
  }
  function mountOverview(){
    teardown();teardown=()=>{};const root=document.querySelector('.vo-overview'),story=document.getElementById('core-story'),canvas=document.getElementById('system-core');if(!root||!story||!canvas)return;
    const callouts=window.PAHeroCallouts?.mount(story.querySelector('[data-vo-callouts]'),canvas);
    const select=root.querySelector('[data-vo-select]'),replay=root.querySelector('[data-vo-replay]');select.onchange=()=>{selectedProject=select.value;renderData();};root.querySelector('[data-vo-enter]').onclick=()=>window.cineEnterSelected();replay.onclick=()=>play(true);
    const refreshExisting=!!overview;void loadOverview(refreshExisting,refreshExisting);
    let frame=0,timer=0,refreshTimer=0,disposed=false,mode='stopped',elapsed=0,lastTime=0,lastScroll=scrollY,progress=1,target=1;
    const write=value=>{progress=clamp(value);applyProgress(progress);};
    const cancel=()=>{mode='stopped';clearTimeout(timer);cancelAnimationFrame(frame);frame=0;lastTime=0;};
    const schedule=()=>{if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(tick);};
    function tick(now){
      frame=0;if(disposed||document.hidden||mode==='stopped')return;
      const dt=lastTime?Math.min(80,now-lastTime):0;lastTime=now;
      if(mode==='film'){
        elapsed=Math.min(FILM_MS,elapsed+dt);write(timedProgress(elapsed));
        if(elapsed===FILM_MS){mode='stopped';lastTime=0;return;}
      }else{
        const next=progress+(target-progress)*(1-Math.exp(-dt/90));
        write(Math.abs(target-next)<.00015?target:next);
        if(progress===target){mode='stopped';lastTime=0;return;}
      }
      schedule();
    }
    function seek(value){cancel();target=reduced.matches?1:clamp(value);write(target);lastScroll=scrollY;}
    const manualScroll=()=>{
      const nextScroll=scrollY,delta=nextScroll-lastScroll;lastScroll=nextScroll;
      if(disposed||Math.abs(delta)<.5)return;
      if(reduced.matches){seek(1);return;}
      // Take over at the current cinematic position. Using absolute document Y
      // here used to snap a completed rack back into a server on first scroll.
      if(mode!=='scroll'){
        const actual=canvas.paCoreScene?.getState?.().progress;
        cancel();if(Number.isFinite(actual))progress=actual;target=progress;
      }
      target=clamp(target+delta/Math.max(540,story.offsetHeight*.85));mode='scroll';schedule();
    };
    const input=()=>{cancel();};
    const wheel=()=>{if(mode==='film')cancel();};
    const tools=story.querySelector('#core-tools');
    function play(force=false){
      if(reduced.matches){seek(1);return;}
      cancel();elapsed=0;target=0;write(0);lastScroll=scrollY;
      try{sessionStorage.setItem(replayKey,'1');}catch{}
      mode='film';timer=setTimeout(schedule,force?80:800);
    }
    const motionChange=()=>{
      replay.disabled=reduced.matches;replay.setAttribute('aria-disabled',String(reduced.matches));
      replay.title=reduced.matches?'已依減少動態效果偏好停用重播':'重播機櫃電影展示';
      if(reduced.matches)seek(1);
    };
    const visibilityChange=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;lastTime=0;}else if(mode!=='stopped')schedule();};
    const ready=()=>applyProgress(progress);
    let played=false;try{played=sessionStorage.getItem(replayKey)==='1';}catch{}
    motionChange();if(reduced.matches||played)seek(1);else play();
    // Deterministic public playback control also lets QA exercise the real
    // phase labels, scan overlay and progress ownership when seeking a shot.
    story.paHeroPlayback={seek,replay:()=>play(true),getState:()=>({progress,target,mode,duration:FILM_MS,reducedMotion:reduced.matches})};
    refreshTimer=setInterval(()=>{if(!document.hidden&&root.isConnected)void loadOverview(true,true);},REFRESH_MS);
    window.addEventListener('scroll',manualScroll,{passive:true});canvas.addEventListener('pointerdown',input,{passive:true});canvas.addEventListener('touchstart',input,{passive:true});canvas.addEventListener('keydown',input);story.addEventListener('wheel',wheel,{passive:true});tools?.addEventListener('click',input);canvas.addEventListener('pa-core-ready',ready);document.addEventListener('visibilitychange',visibilityChange);reduced.addEventListener('change',motionChange);
    teardown=()=>{disposed=true;cancel();callouts?.destroy();clearInterval(refreshTimer);delete story.paHeroPlayback;window.removeEventListener('scroll',manualScroll);canvas.removeEventListener('pointerdown',input);canvas.removeEventListener('touchstart',input);canvas.removeEventListener('keydown',input);story.removeEventListener('wheel',wheel);tools?.removeEventListener('click',input);canvas.removeEventListener('pa-core-ready',ready);document.removeEventListener('visibilitychange',visibilityChange);reduced.removeEventListener('change',motionChange);};
  }
  window.cineOpenProject=name=>{const project=projectByName(name);productProject(name,project?.level==='L11'?'rack':'system');};
  window.openProjectInspection=name=>{const machine=machines.find(item=>item.project===name&&item.mgx_type!=='blanking'&&!item.passive);if(!machine){window.cineOpenProject(name);return;}openMachine(machine.name);setTimeout(()=>window.productDetailTab?.('sensors',true),0);};
  window.cineEnterSelected=()=>selectedProject?window.cineOpenProject(selectedProject):productLevel('system');
  const render=_renderMachine;
  _renderMachine=function(...args){const result=render(...args);if(state.view==='dashboard')requestAnimationFrame(mountOverview);else teardown();return result;};
})();
