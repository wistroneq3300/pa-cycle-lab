/* Product Assurance overview. Durable validation data comes from one read-only endpoint. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const replayKey='pa_dashboard_cinematic_l10_v1_played';
  const REFRESH_MS=30000;
  let overview=null,selectedProject='',loading=null,overviewError='',teardown=()=>{};
  const quote=value=>esc(JSON.stringify(String(value)));
  const fmt=value=>value?new Date(value*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚無資料';
  const projectByName=name=>overview?.projects?.find(project=>project.name===name);

  RENDERERS.dashboard=()=>`<main class="vo-overview" aria-label="Product Assurance Overview">
    <section class="vo-hero" id="core-story" aria-label="專案驗證總覽與 AI infrastructure 整櫃組裝展示">
      <div class="vo-hero-copy">
        <span class="vo-kicker">PRODUCT ASSURANCE</span>
        <label class="vo-project-select">Project Scope<select data-vo-select aria-label="Dashboard 專案範圍"><option value="">所有專案</option></select></label>
        <div class="vo-hero-heading"><span data-vo-level>Validation Overview</span><h1 data-vo-title>正在載入資料…</h1></div>
        <div class="vo-hero-summary">
        <div class="vo-hero-counts"><span><b data-vo-hero-projects>—</b> Projects</span><span><b data-vo-systems>—</b> Systems</span><span><b data-vo-nodes>—</b> Nodes</span></div>
        <p class="vo-hero-issues"><strong data-vo-fail>— FAIL</strong><span data-vo-warn>— WARN</span></p>
        <p class="vo-hero-note" data-vo-summary>正在載入資料…</p>
        </div>
        <button class="btn primary" type="button" data-vo-enter>進入系統與專案</button>
      </div>
      <div class="cine-stage vo-scene" id="core-stage" data-phase="system">
        <div class="cine-core" id="core-visual"><img class="cine-fallback" src="/static/img/server-hero.png" alt="伺服器設備視圖"><canvas id="system-core" data-core-profile="coolingV2" tabindex="0" role="img" aria-label="L10 分解與組裝、CPU 與 GPU 封裝、液冷示意、連續機櫃整合與 System Overview" aria-describedby="core-interaction-help"></canvas><svg class="vo-device-callouts" data-vo-callouts aria-hidden="true"></svg></div>
        <div class="vo-phase"><span data-vo-phase-number>01</span><div><b data-vo-phase-title>L10 System Assembly</b><small data-vo-phase-detail>SERVER FOCUS</small></div></div>
        <div class="vo-l10-note" data-vo-l10-note></div>
        <div class="vo-cinematic-progress" aria-hidden="true"><i data-vo-progress></i></div>
        <div class="vo-playback-controls"><button class="vo-skip" type="button" data-vo-skip aria-label="略過開場，進入 System Overview">略過開場</button><button class="vo-replay" type="button" data-vo-replay aria-label="重播 L10 與 Rack 展示">↻ 重播</button></div>
        <div class="cine-core-tools" id="core-tools"><span id="core-interaction-help">按住拖曳旋轉 · 方向鍵查看 · Home 重設</span><div><button type="button" data-core-view="rear" aria-label="3D 模型背面視角">背面</button><button type="button" data-core-view="reset" aria-label="重設 3D 模型視角">重設視角</button></div></div>
        <div id="core-system-copy" class="vo-a11y-state" aria-hidden="false">L10 System</div><div id="core-rack-copy" class="vo-a11y-state" inert aria-hidden="true">L11 Rack</div>
      </div>
    </section>
    <section class="vo-key-status" aria-labelledby="vo-key-title"><header><div><span class="vo-kicker">KEY STATUS</span><h2 id="vo-key-title">Validation Overview</h2></div><span data-vo-freshness>正在載入資料…</span></header><div data-vo-status><p class="vo-loading">正在載入資料…</p></div></section>
    <section class="vo-attention" aria-labelledby="vo-attention-title"><header><div><span class="vo-kicker">ATTENTION REQUIRED</span><h2 id="vo-attention-title">Active Issues</h2></div><span data-vo-attention-count>—</span></header><div data-vo-attention><p class="vo-loading">正在載入資料…</p></div></section>
    <section class="vo-projects" aria-labelledby="vo-projects-title"><header><div><span class="vo-kicker">INSPECTION HEALTH</span><h2 id="vo-projects-title">Project Inspection Health — Top 5</h2><p class="vo-sort-note">依 FAIL 數、受影響 Node、FAIL Rate、Coverage 依序排序</p></div><span data-vo-project-count>—</span></header><div class="vo-project-health" data-vo-projects><p class="vo-loading">正在載入資料…</p></div></section>
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
    root.querySelector('[data-vo-level]').textContent='Validation Overview';
    root.querySelector('[data-vo-title]').textContent=isProject?item.name:'所有專案';
    root.querySelector('[data-vo-hero-projects]').textContent=isProject?1:overview.projects.length;
    root.querySelector('[data-vo-systems]').textContent=item.systems;root.querySelector('[data-vo-nodes]').textContent=item.nodes;
    root.querySelector('[data-vo-fail]').textContent=`${item.issues.fail} FAIL`;root.querySelector('[data-vo-warn]').textContent=`${item.issues.warning} WARN`;
    root.querySelector('[data-vo-summary]').textContent=`Cycle ${item.cycle.running} Running · Telemetry ${item.monitoring.reporting} / ${item.monitoring.total}`;
    root.querySelector('[data-vo-freshness]').textContent=overviewError
      ? `更新失敗 · 保留舊資料 · 最後更新 ${fmt(overview.generated_at)}`
      : `最後更新 ${fmt(overview.generated_at)}`;
    root.querySelector('[data-vo-enter]').textContent=isProject?'進入專案':'進入系統與專案';
    const cards=[
      ['Active Issues',`${item.issues.fail} FAIL · ${item.issues.warning} WARN`,'需要檢視的巡檢異常',item.issues.fail?'fail':item.issues.warning?'warn':'ok'],
      ['Validation',`${item.validation.checked} / ${item.validation.total}`,'已完成檢查的 Node',item.validation.checked<item.validation.total?'warn':'ok'],
      ['Cycle',`${item.cycle.running} Running · ${item.cycle.completed} Completed`,'執行中與已完成的 Cycle',item.cycle.running?'active':'ok'],
      ['Telemetry',`${item.monitoring.reporting} / ${item.monitoring.total}`,'持續回報資料的 Node',item.monitoring.reporting<item.monitoring.total?'warn':'ok']
    ];
    root.querySelector('[data-vo-status]').innerHTML=cards.map(([label,value,detail,state])=>`<article data-state="${state}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`).join('');
    const issues=overview.issues.filter(issue=>!selectedProject||issue.project===selectedProject).slice(0,6);
    root.querySelector('[data-vo-attention-count]').textContent=`${issues.length} 項`;
    const hasInspectionData=Number(item.validation.checked||0)>0;
    root.querySelector('[data-vo-attention]').innerHTML=issues.length?issues.map(issue=>`<button type="button" class="vo-issue" data-severity="${issue.severity}" onclick="openMachine(${quote(issue.system)})"><span>${issue.severity}</span><div><b>${esc(issue.system)}${issue.node?' / '+esc(issue.node):''}</b><strong>${esc(issue.component||issue.rule||'巡檢問題')}</strong><small>${esc(issue.facts||'請查看巡檢證據與分析依據')}</small></div><i aria-hidden="true">查看詳情 →</i></button>`).join(''):hasInspectionData?'<div class="vo-empty"><strong>目前無異常</strong><span>最近一次有效巡檢沒有待處理項目；仍請核對資料涵蓋率與更新時間。</span></div>':'<div class="vo-empty"><strong>尚無資料</strong><span>尚未取得有效巡檢結果，不能判定為無異常。</span></div>';
    const healthProjects=overview.projects.slice(0,5);root.querySelector('[data-vo-project-count]').textContent=`Top ${healthProjects.length} / ${overview.projects.length} Projects`;
    root.querySelector('[data-vo-projects]').innerHTML=healthProjects.length?`<div class="vo-health-table" role="table" aria-label="Project Inspection Health"><div class="vo-health-row vo-health-head" role="row"><span>Project Name</span><span>Affected Nodes</span><span>FAIL Count</span><span>FAIL Rate</span><span>Inspection Coverage</span><span>Last Inspection</span><span>Health Status</span></div>${healthProjects.map(project=>{const inspection=project.inspection||{},rate=inspection.fail_rate==null?'NO DATA':inspection.fail_rate.toFixed(1)+'%',coverage=(inspection.coverage??0).toFixed(1)+'%';return `<button type="button" class="vo-health-row" role="row" onclick="openProjectInspection(${quote(project.name)})"><b>${esc(project.name)}</b><span>${inspection.affected_nodes??0} / ${project.nodes}</span><strong>${inspection.fail_count??0}</strong><span>${rate}</span><span>${coverage}</span><span>${fmt(inspection.last_inspection)}</span><em data-health="${esc(inspection.health_status||'UNKNOWN')}">${esc(inspection.health_status||'UNKNOWN')}</em></button>`;}).join('')}</div>`:'<div class="vo-empty"><strong>尚無資料</strong><span>新增專案與系統後，Inspection Health 會顯示在這裡。</span></div>';
  }

  async function loadOverview(force=false,silent=false){
    if(overview&&!force){renderData();return;}if(loading)return loading;
    loading=fetch('/api/validation/overview',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('資料載入失敗');overview=await response.json();overviewError='';renderData();}).catch(error=>{
      overviewError=error.message||'資料載入失敗';
      if(silent&&overview){renderData();return;}
      const root=document.querySelector('.vo-overview');if(root)root.querySelectorAll('.vo-loading').forEach(node=>node.textContent='資料載入失敗，請稍後重新整理。');
    }).finally(()=>{loading=null;});return loading;
  }

  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  // The scene owns geometry and camera interpolation. This is the single owner
  // of cinematic time; cinematic.js only mounts/themes the compact scene.
  const timeline=window.PAL10Timeline;
  // A requested shipping profile is stable while loading and after failure.
  // Resource readiness must never silently select the legacy movie instead.
  const timelineMode=canvas=>canvas.dataset.coreProfile==='coolingV2'||canvas.dataset.coreCooling==='ready'?'coolingV2':'legacy';
  const shots=[
    [0,'l10-exploded','01','L10 Exploded View','COMPUTE / COOLING / ENCLOSURE'],
    [.065,'compute-board','02','L10 System Assembly','COMPUTE BOARD'],
    [.135,'cpu-gpu-assembly','03','CPU / GPU Assembly','BOARD-INTEGRATED PACKAGES'],
    [.202,'network-storage','04','L10 System Assembly','NETWORKING / STORAGE / MANAGEMENT'],
    [.248,'cooling-install','05','Cooling Assembly','COLD PLATES / FITTINGS'],
    [.292,'cooling-reveal','06','Cooling Flow Reveal','CONCEPTUAL THERMAL FLOW OVERLAY'],
    [.333,'l10-hero','07','L10 System Assembly','LIQUID-COOLED COMPUTE TRAY'],
    [.376,'chassis-close','08','L10 System Assembly','ENCLOSURE CLOSURE'],
    [.407,'camera-bridge','09','L11 Rack Integration','CONTINUOUS CAMERA TRANSITION'],
    [.56,'convergence','10','L11 Rack Integration','COORDINATED EQUIPMENT ASSEMBLY'],
    [.653333,'insertion','11','L11 Rack Integration','U40 / RAIL ENGAGEMENT'],
    [.733333,'pullback','12','L10 System Overview','COMPUTE / INTERCONNECT / POWER'],
    [.84,'exploded','13','L10 System Overview','ARCHITECTURE LAYERS'],
    [.906667,'return','14','L10 System Overview','RETURN / EXACT SEATING'],
    [.96,'final','15','L10 System Overview','RACK-SCALE COMPUTING']
  ];
  function applyProgress(value){
    const stage=document.getElementById('core-stage'),canvas=document.getElementById('system-core');if(!stage||!canvas)return;
    const progress=clamp(value);canvas.paCoreScene?.setProgress(progress);
    stage.dataset.phase=progress<.407?'system':progress<.80?'integration':'rack';
    let shot=shots[0];for(const candidate of shots){if(progress<candidate[0])break;shot=candidate;}
    const coolingV1=timelineMode(canvas)==='coolingV2',clock=timeline.sample(progress,timelineMode(canvas));
    if(coolingV1){
      const coolingShots={bare:['bare-board','01','L10 Bare-board View','2 CPU / 4 GPU / TWO COMPUTE BOARDS'],silicon:['silicon-detail','03','CPU / GPU Detail','SILICON / PACKAGE / HBM'],
        'plate-install':['cooling-install','05','Cold Plate Installation','SIX CONTACT SURFACES / TIM / RETENTION'],plumbing:['manifold-connect','05','Manifold Connection','SUPPLY / RETURN / SEALED FITTINGS'],
        flow:['cooling-reveal','06','Cooling Flow Reveal','BLUE INLET / RED OUTLET / CONTINUOUS FLOW'],restore:['cooling-restore','07','Metal Finish Returns','SEALED COLD PLATES / PLUMBING'],solid:['l10-hero','07','Cooling Assembly','COPPER / NICKEL / ELASTOMER']};
      if(coolingShots[clock.stage])shot=[progress,...coolingShots[clock.stage]];
    }
    if(stage.dataset.shot!==shot[1]){
      stage.dataset.shot=shot[1];
      stage.querySelector('[data-vo-phase-number]').textContent=shot[2];
      stage.querySelector('[data-vo-phase-title]').textContent=shot[3];
      stage.querySelector('[data-vo-phase-detail]').textContent=shot[4];
      const note=stage.querySelector('[data-vo-l10-note]');
      note.replaceChildren();
      if(progress<.202)note.textContent=coolingV1?'Board-integrated packages · cooling installs on six seated contact surfaces':'Visual separation · CPU / GPU packages are integrated with the compute boards';
      else if(coolingV1?['flow','restore'].includes(clock.stage):progress>=.292&&progress<.333){
        for(const [label,cls]of [['Supply / Inlet','supply'],['Return / Outlet','return']]){const item=document.createElement('span');item.className=cls;item.textContent=label;note.append(item);}
        const detail=document.createElement('small');detail.textContent=coolingV1?'Blue / red show heat exchange, not two coolant colors · illustrative flow, not CFD':'Conceptual thermal flow · colors indicate direction, not coolant color';note.append(detail);
      }
      const system=stage.querySelector('#core-system-copy'),rack=stage.querySelector('#core-rack-copy'),showRack=progress>=.80;
      system.inert=showRack;system.setAttribute('aria-hidden',String(showRack));
      rack.inert=!showRack;rack.setAttribute('aria-hidden',String(!showRack));
    }
    stage.querySelector('[data-vo-progress]').style.transform=`scaleX(${clock.timeProgress.toFixed(4)})`;
    stage.querySelector('[data-vo-skip]').hidden=progress>=.999;
  }
  function mountOverview(){
    teardown();teardown=()=>{};const root=document.querySelector('.vo-overview'),story=document.getElementById('core-story'),canvas=document.getElementById('system-core');if(!root||!story||!canvas)return;
    const callouts=window.PAHeroCallouts?.mount(story.querySelector('[data-vo-callouts]'),canvas);
    const select=root.querySelector('[data-vo-select]'),replay=root.querySelector('[data-vo-replay]'),skip=root.querySelector('[data-vo-skip]');select.onchange=()=>{selectedProject=select.value;renderData();};root.querySelector('[data-vo-enter]').onclick=()=>window.cineEnterSelected();replay.onclick=()=>play(true);skip.onclick=()=>{if(document.activeElement===skip)replay.focus({preventScroll:true});seek(1);canvas.paCoreScene?.resetOrbit();};
    const refreshExisting=!!overview;void loadOverview(refreshExisting,refreshExisting);
    let frame=0,timer=0,refreshTimer=0,disposed=false,mode='stopped',elapsed=0,lastTime=0,lastScroll=scrollY,progress=0,target=0,pendingSeek=null,activeTimeline=timelineMode(canvas);
    const sceneReady=()=>canvas.dataset.coreState==='ready';
    const sceneFailed=()=>canvas.dataset.coreState==='fallback'||document.getElementById('core-stage')?.dataset.scene==='fallback';
    const syncTimeline=()=>{const next=timelineMode(canvas);if(next!==activeTimeline){activeTimeline=next;elapsed=timeline.timeAt(progress,next);}return timeline.definitions[activeTimeline];};
    const write=value=>{progress=clamp(value);applyProgress(progress);};
    const cancel=()=>{mode='stopped';clearTimeout(timer);cancelAnimationFrame(frame);frame=0;lastTime=0;};
    const schedule=()=>{if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(tick);};
    const syncControls=()=>{
      const available=sceneReady(),failed=sceneFailed();
      replay.disabled=!available||reduced.matches;replay.setAttribute('aria-disabled',String(replay.disabled));
      skip.disabled=!available;skip.setAttribute('aria-disabled',String(skip.disabled));
      replay.title=!available?(failed?'資料載入失敗，請重新整理頁面':'正在載入資料…'):reduced.matches?'已依減少動態效果偏好停用重播':'重播 L10 與 Rack 展示';
      story.querySelectorAll('[data-core-view]').forEach(button=>button.disabled=!available);
      const help=document.getElementById('core-interaction-help');
      if(help){help.setAttribute('role','status');help.textContent=available?'按住拖曳旋轉 · 方向鍵查看 · Home 重設':failed?'L10 展示載入失敗，請重新整理頁面；管理功能不受影響。':'正在載入 L10 展示…';}
    };
    const failed=()=>{cancel();pendingSeek=null;syncControls();};
    function tick(now){
      frame=0;if(disposed||document.hidden||mode==='stopped')return;
      if(sceneFailed()){failed();return;}
      if(!sceneReady()){lastTime=0;schedule();return;}
      if(canvas.dataset.coreEnvironment==='loading'||canvas.dataset.coreAsset==='loading'||canvas.dataset.coreCooling==='loading'){lastTime=0;schedule();return;}
      const dt=lastTime?Math.min(80,now-lastTime):0;lastTime=now;
      const film=syncTimeline();
      if(mode==='film'){
        if(elapsed===0)try{sessionStorage.setItem(replayKey,'1');}catch{}
        elapsed=Math.min(film.durationMs,elapsed+dt);write(timeline.progressAt(elapsed,activeTimeline));
        if(elapsed===film.durationMs){mode='stopped';lastTime=0;return;}
      }else{
        const next=progress+(target-progress)*(1-Math.exp(-dt/90));
        write(Math.abs(target-next)<.00015?target:next);
        if(progress===target){mode='stopped';lastTime=0;return;}
      }
      schedule();
    }
    function seek(value){
      cancel();if(sceneFailed()){failed();return;}syncTimeline();target=reduced.matches?1:clamp(value);lastScroll=scrollY;
      if(!sceneReady()){pendingSeek=target;return;}
      pendingSeek=null;write(target);elapsed=timeline.timeAt(target,activeTimeline);
    }
    const manualScroll=()=>{
      const nextScroll=scrollY,delta=nextScroll-lastScroll;lastScroll=nextScroll;
      if(disposed||!sceneReady()||Math.abs(delta)<.5)return;
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
      if(sceneFailed()){failed();return;}
      if(reduced.matches){seek(1);return;}
      cancel();pendingSeek=null;elapsed=0;target=0;write(0);lastScroll=scrollY;
      mode='film';timer=setTimeout(schedule,force?80:800);
    }
    const motionChange=()=>{
      syncControls();
      if(reduced.matches)seek(1);
    };
    const visibilityChange=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;lastTime=0;}else if(mode!=='stopped')schedule();};
    const ready=()=>{
      if(!sceneReady())return;
      syncTimeline();syncControls();
      if(pendingSeek!==null){write(pendingSeek);pendingSeek=null;elapsed=timeline.timeAt(progress,activeTimeline);}else applyProgress(progress);
      lastTime=0;if(mode!=='stopped')schedule();
    };
    let played=false;try{played=sessionStorage.getItem(replayKey)==='1';}catch{}
    motionChange();if(reduced.matches||played)seek(1);else play();
    // Deterministic public playback control also lets QA exercise the real
    // phase labels, scan overlay and progress ownership when seeking a shot.
    story.paHeroPlayback={seek,seekTime:ms=>seek(timeline.progressAt(ms,timelineMode(canvas))),pause:cancel,
      resume:()=>{if(sceneFailed()){failed();return;}if(reduced.matches||progress>=1)return;syncTimeline();elapsed=timeline.timeAt(progress,activeTimeline);mode='film';lastTime=0;schedule();},
      skip:()=>skip.click(),replay:()=>play(true),getState:()=>({progress,target,mode,duration:timeline.definitions[timelineMode(canvas)].durationMs,elapsedMs:timeline.timeAt(progress,timelineMode(canvas)),timelineMode:timelineMode(canvas),reducedMotion:reduced.matches})};
    refreshTimer=setInterval(()=>{if(!document.hidden&&root.isConnected)void loadOverview(true,true);},REFRESH_MS);
    window.addEventListener('scroll',manualScroll,{passive:true});canvas.addEventListener('pointerdown',input,{passive:true});canvas.addEventListener('touchstart',input,{passive:true});canvas.addEventListener('keydown',input);story.addEventListener('wheel',wheel,{passive:true});tools?.addEventListener('click',input);canvas.addEventListener('pa-core-ready',ready);canvas.addEventListener('pa-core-fallback',failed);document.addEventListener('visibilitychange',visibilityChange);reduced.addEventListener('change',motionChange);
    teardown=()=>{disposed=true;cancel();callouts?.destroy();clearInterval(refreshTimer);delete story.paHeroPlayback;window.removeEventListener('scroll',manualScroll);canvas.removeEventListener('pointerdown',input);canvas.removeEventListener('touchstart',input);canvas.removeEventListener('keydown',input);story.removeEventListener('wheel',wheel);tools?.removeEventListener('click',input);canvas.removeEventListener('pa-core-ready',ready);canvas.removeEventListener('pa-core-fallback',failed);document.removeEventListener('visibilitychange',visibilityChange);reduced.removeEventListener('change',motionChange);};
  }
  window.cineOpenProject=name=>{const project=projectByName(name);productProject(name,project?.level==='L11'?'rack':'system');};
  window.openProjectInspection=name=>{const machine=machines.find(item=>item.project===name&&item.mgx_type!=='blanking'&&!item.passive);if(!machine){window.cineOpenProject(name);return;}openMachine(machine.name);setTimeout(()=>window.productDetailTab?.('sensors',true),0);};
  window.cineEnterSelected=()=>selectedProject?window.cineOpenProject(selectedProject):productLevel('system');
  const render=_renderMachine;
  _renderMachine=function(...args){const result=render(...args);if(state.view==='dashboard')requestAnimationFrame(mountOverview);else teardown();return result;};
})();
