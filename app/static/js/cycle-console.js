/* Read-only view of the persistent event stream. Never dispatches job actions. */
(() => {
  'use strict';
    const BUFFER=3000, RENDER=2000, LEVELS=new Set(['INFO','CMD','WAIT','PASS','WARN','FAIL','ERROR','PRE','POST']);
    const PHASE_LABELS={
      RESPONSE_RETURNED:'command returned; verifying boot',
      WAIT_OFFLINE:'waiting OS boot', OS_UNREACHABLE:'waiting OS boot', WAIT_RECOVERY:'waiting OS boot',
      BOOT_ID_CHANGED:'OS boot identity changed; verifying remaining endpoints', RECOVERY_DETECTED:'OS up, system check running',
      POST_STARTED:'system check running', POST_COMPLETED:'system check done'
    };
    // Event timestamps are stored as UTC ISO values. The Console is an
    // operator-facing view, so render them in the PA team's Taiwan timezone
    // without changing the persisted event, cursor ordering, or downloads.
    const taipeiTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const displayTime=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?String(value||'—').slice(11,19):taipeiTime.format(date);};
    // Short label for the active cycle mode, used for the "<label> sent" stage
    // line. Unknown -> neutral "cycle", never AUX. Taken from the job's
    // structured config, never guessed from the run id or log text.
    const MODE_LABELS={reboot:'reboot',power_cycle:'DC Power Cycle',aux_cycle:'aux cycle'};
    const modeLabel=mode=>MODE_LABELS[String(mode??'').trim().toLowerCase()]||'cycle';
    const CONTROLLER_EVENTS={
      CREATED:'Job created; targets and configuration reserved',
      PRE_STARTED:'PRE started; every target is probed for identity and baseline',
      AWAITING_CONFIRMATION:'PRE finished; waiting for operator confirmation',
      CONFIRMED:'Operator confirmed; campaign is now RUNNING',
      STOP_REQUESTED:'Stop requested; no new action will be dispatched',
      STOPPING_AFTER_ROUND:'Stopping after the current round'
    };
    const FOLDED=new Set(['COLLECTION_STARTED','COLLECTION_FINISHED','IDENTITY_CHECK','IDENTITY_VERIFIED','PCI_COMPARISON','SENSOR_COMPARISON','ACTION_PREPARING','DEPENDENCY_CHECK','DEPENDENCY_CHECK_COMPLETE','BASELINE_COLLECTION']);
  window.CycleConsole=class {
    constructor(root,button) {
      this.root=root;this.button=button;this.revision=0;this.buffer=[];this.history=null;this.cursor=0;this.auto=true;this.unread=0;this.summary=true;
      root.classList.add('live-console','pa-validation-console');
      root.innerHTML=`<div class="live-console-head"><span class="lc-dot" aria-hidden="true"></span><h3>CYCLE EXECUTION</h3><span class="lc-job" data-part="job"></span></div>
        <div data-part="fleet" class="lc-fleet"></div><div class="live-console-bar">

          <button class="btn" data-part="auto" aria-pressed="true" title="自動捲到最新">自動跟隨</button>
          <span class="lc-seg" role="group" aria-label="View"><button class="btn" data-part="density" aria-pressed="true">Summary</button><button class="btn" data-part="full" aria-pressed="false">Full</button></span>
          <button class="btn" data-part="pause" title="暫停檢視（不影響任務）">暫停檢視</button>
          <input class="lc-search" type="search" data-part="search" placeholder="搜尋日誌…" maxlength="200" aria-label="搜尋目前視窗">
          <button class="lc-icon" data-part="errors" aria-pressed="false" title="只顯示錯誤" aria-label="只顯示錯誤">Errors</button>
          <button class="lc-icon" data-part="history" title="搜尋歷史" aria-label="搜尋歷史">History</button>
          <button class="lc-icon" data-part="older" title="更早的歷史" aria-label="更早的歷史" hidden>Older</button>
          <button class="lc-icon" data-part="live" title="回到即時" aria-label="回到即時" hidden>Live</button>
          <a class="lc-icon" data-part="download" title="下載完整日誌" aria-label="下載完整日誌">Download</a>
        </div>
        <div class="lc-columns" aria-hidden="true"><span>SEQ</span><span>TIME</span><span>NODE</span><span>STATE</span><span>STAGE</span><span>EVENT</span></div><p hidden data-part="error" role="alert"></p>
        <div class="live-console-view" data-part="log" role="log" aria-live="off" tabindex="0" aria-label="Cycle 執行紀錄"></div>
        <div class="live-console-foot"><span class="lc-mode" data-part="status" role="status"></span><button class="btn" data-part="latest" hidden>跳至最新</button><span class="lc-count" data-part="count"></span></div>
        <p class="live-console-note">時間以台灣時間（UTC+8）顯示。畫面最多顯示 2,000 行。Summary 顯示重點摘要；Full 顯示原始事件。暫停檢視或關閉 Console 不會停止任務。完整紀錄可下載，原始證據保存在「證據與報告」。</p>`;
      this.part=name=>root.querySelector(`[data-part="${name}"]`);
      this.fleet=new CycleFleet(this.part('fleet'),()=>{this.node=this.fleet.node;this.render(true);});
      this.part('latest').onclick=()=>{this.auto=true;this.paused=false;this.part('auto').textContent='自動跟隨';this.part('auto').setAttribute('aria-pressed','true');this.part('pause').setAttribute('aria-pressed','false');this.part('pause').textContent='暫停檢視';this.render(true);this.bottom();this.status();};
      this.part('log').addEventListener('scroll',()=>{const log=this.part('log');if(log.scrollHeight-log.scrollTop-log.clientHeight>30){this.auto=false;this.part('auto').classList.remove('on');this.part('auto').textContent='自動跟隨：關';this.part('auto').setAttribute('aria-pressed','false');}});
      button.onclick=()=>this.toggle();
      this.part('auto').onclick=()=>{this.auto=!this.auto;this.part('auto').textContent=this.auto?'自動跟隨':'自動跟隨：關';this.part('auto').classList.toggle('on',this.auto);this.part('auto').setAttribute('aria-pressed',this.auto);if(this.auto)this.bottom();};
      this.part('pause').onclick=()=>{this.paused=!this.paused;if(this.paused)this.pausedRows=this.buffer.slice();this.part('pause').textContent=this.paused?'繼續檢視':'暫停檢視';this.part('pause').setAttribute('aria-pressed',this.paused);if(!this.paused)this.render();this.status();};
      const density=value=>{this.summary=value;this.part('density').setAttribute('aria-pressed',value);this.part('full').setAttribute('aria-pressed',!value);this.render(true);};
      this.part('density').onclick=()=>density(true);this.part('full').onclick=()=>density(false);
      this.part('errors').onclick=()=>{this.part('errors').setAttribute('aria-pressed',this.part('errors').getAttribute('aria-pressed')!=='true');this.render(true);};
      this.part('search').oninput=()=>{clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.render(true),150);};
      this.part('history').onclick=()=>this.loadHistory();
      this.part('older').onclick=()=>this.loadHistory(this.visible()[0]?.sequence || (this.history || this.buffer)[0]?.sequence);
      this.part('live').onclick=()=>{this.cancel();this.history=null;this.part('live').hidden=true;this.part('older').hidden=true;this.render(true);this.poll();};
    }
    cancel(){this.revision++;clearTimeout(this.timer);this.controller?.abort();this.controller=null;}
    close(){this.cancel();clearTimeout(this.searchTimer);this.root.hidden=true;this.button.setAttribute('aria-expanded','false');}
    reset(){this.close();this.job=null;this.buffer=[];this.history=null;this.cursor=0;this.part('log').replaceChildren();}
    setJob(job,url){
      if(this.job?.id!==job.id){
        this.cancel();this.buffer=[];this.history=null;this.cursor=0;this.node='';this.paused=false;this.loaded=false;this.url=url;
        this.part('pause').textContent='暫停檢視';this.part('pause').classList.remove('on');this.part('pause').setAttribute('aria-pressed','false');
        this.summary=true;this.part('density').textContent='Summary';this.part('density').setAttribute('aria-pressed','true');this.part('density').classList.remove('on');this.part('full').setAttribute('aria-pressed','false');
        this.part('live').hidden=true;this.part('older').hidden=true;this.part('search').value='';
        this.part('errors').setAttribute('aria-pressed','false');
        this.fleet.reset();
        this.part('download').href=`${url}/events/download`;
        this.job=job;if(!this.root.hidden)this.poll();
      }
      this.job=job;
      const end=['COMPLETE','INCOMPLETE','ERROR','BLOCKED','CANCELLED','RECONCILIATION_REQUIRED'].includes(job.state)?job.updated_at:Date.now()/1000;
      const sec=Math.max(0,Math.floor(end-job.created_at));
      const runtime=[Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');
      this.settled=['COMPLETE','INCOMPLETE','ERROR','BLOCKED','CANCELLED','RECONCILIATION_REQUIRED'].includes(job.state);
      this.part('job').textContent=`${job.project} · ${modeLabel(job.config?.cycle_mode)} · JOB ${String(job.id).slice(-8)} · ${runtime} · ${job.state}${job.synthetic?' · SYNTHETIC':''}`;
      this.fleet.update(job);
      const dot=this.root.querySelector('.lc-dot');if(dot)dot.classList.toggle('lc-idle',!!this.settled);
    }
    toggle(){if(!this.root.hidden){this.close();return;}this.root.hidden=false;this.button.setAttribute('aria-expanded','true');this.loadFleet();this.render(true);if(!this.history)this.poll();}
    async loadFleet(){const id=this.job?.id;if(!id)return;try{const response=await fetch(this.url+'/console-summary',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(this.job?.id!==id||this.root.hidden)return;for(const row of data.nodes){const old=this.fleet.observed.get(row.machine_id);if(old&&old.loop>row.loop)continue;this.fleet.observe(row.markers);const item=this.fleet.observed.get(row.machine_id)||{loop:row.loop,done:new Set()};for(const phase of row.completed)item.done.add(phase);this.fleet.observed.set(row.machine_id,item);}this.fleet.update(this.job);}catch(_){/* Tail remains usable; missing markers are unconfirmed. */}}
    error(message){this.part('error').textContent=message;this.part('error').hidden=!message;}
    async request(params){
      const revision=this.revision;const controller=new AbortController();this.controller=controller;
      const timeout=setTimeout(()=>controller.abort(),15000);
      try{const response=await fetch(`${this.url}/events?${new URLSearchParams({limit:500,...params})}`,{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new Error('Event request failed');
        const data=await response.json();return revision===this.revision&&!this.root.hidden?data:null;
      }finally{clearTimeout(timeout);if(this.controller===controller)this.controller=null;}
    }
    async poll(){
      if(this.root.hidden||this.history||this.controller||!this.job)return;
      clearTimeout(this.timer);const revision=this.revision;let delay=1500;
      try{const data=await this.request(this.cursor?{after:this.cursor}:{tail:true});if(!data)return;
        if(data.cursor_reset){this.buffer=[];this.cursor=0;this.part('log').replaceChildren();this.error('歷史更新位置已過期，正在重新載入任務狀態與保留紀錄。');this.job=await (await fetch(this.url,{cache:'no-store'})).json();return;}
        for(const e of data.events){if(e.sequence>this.cursor){this.buffer.push(e);this.cursor=e.sequence;if(!this.auto||this.paused)this.unread++;}}
        if(this.buffer.length>BUFFER)this.buffer.splice(0,this.buffer.length-BUFFER);
        this.fleet.observe(data.events);this.fleet.update(this.job);this.error('');if(!this.paused)this.render();else this.status();if(data.has_more&&data.events.length&&data.events[0].sequence>0&&this.loaded)delay=250;this.loaded=true;
      }catch(e){if(revision===this.revision)this.error('Console 連線中斷，將自動重連。任務狀態仍會自動更新。');}
      finally{if(revision===this.revision&&!this.root.hidden&&!this.history)this.timer=setTimeout(()=>this.poll(),delay);}
    }
    async loadHistory(before){
      this.cancel();const revision=this.revision;
      try{const data=await this.request({...(before?{before}:{tail:true}),...(this.node?{machine_id:this.node}:{}),errors_only:this.errorsOnly(),search:this.part('search').value});
        if(!data)return;this.history=data.events;this.part('live').hidden=false;this.part('older').hidden=false;this.error('');this.render(true);this.part('older').disabled=!data.has_more;
      }catch(e){if(revision===this.revision){this.error('歷史載入失敗，請重試。');if(!this.history)this.timer=setTimeout(()=>this.poll(),1500);}}
    }
    errorsOnly(){return this.part('errors').getAttribute('aria-pressed')==='true';}
    fold(events){
      // Summary view: mirror the console.log transcript. Derive (never mutate) the
      // shown rows so switching back to Full is lossless. Dropped noise is the
      // "Collecting X / Collection returned: X" pairing; phase repeats collapse to
      // one line per node; issues and FAIL/WARN always survive.
      const out=[];const seenStage=new Map();const seenLoop=new Set();
      const mode=modeLabel(this.job?.config?.cycle_mode);
      for(const e of events){
        const type=e.event_type||'';const level=e.level;
        const controller=CONTROLLER_EVENTS[type];
        if(controller){out.push({...e,message:controller});continue;}
        if(type==='LOOP_STARTED'){const loop=e.loop;if(seenLoop.has(loop))continue;seenLoop.add(loop);out.push({...e,message:e.message||`Loop ${loop} started`});continue;}
        // One line per node, matching vera's "<mode> sent". Both the dispatch
        // intent and the submitted command collapse to the same string so the
        // operator sees a single line; a sent command is still not a confirmed
        // reboot (recovery is proven later by the boot-ID change).
        if(type==='COMMAND_DISPATCHING'||type==='COMMAND_DISPATCHED'){
          const stage=`${mode} sent`;
          if(seenStage.get(e.machine_id)===stage)continue;seenStage.set(e.machine_id,stage);out.push({...e,message:stage,detail:''});continue;
        }
        const stage=PHASE_LABELS[type];
        if(stage){if(seenStage.get(e.machine_id)===stage)continue;seenStage.set(e.machine_id,stage);out.push({...e,message:stage,detail:''});continue;}
        if(FOLDED.has(type)&&!['WARN','FAIL','ERROR'].includes(level))continue;
        if(type.startsWith('ISSUE_')||level==='FAIL'||level==='WARN'||level==='ERROR'||['PASS','CMD','WAIT'].includes(level)){out.push(e);continue;}
        out.push(e);
      }
      return out;
    }
    visible(){const query=this.part('search').value.toLowerCase(),source=this.history||(this.paused?this.pausedRows:this.buffer),base=this.summary?this.fold(source):source;return base.filter(e=>this.fleet.accepts(e.machine_id)&&(!this.errorsOnly()||['FAIL','ERROR'].includes(e.level))&&(!query||`${e.message} ${e.detail || ''}`.toLowerCase().includes(query))).slice(-RENDER);}
    status(){const mode=this.history?'歷史視窗':this.paused?'已暫停檢視 · 不影響任務':'LIVE · 每 1.5 秒更新';this.part('status').textContent=`${mode}${this.unread?' · '+this.unread+' 筆新輸出，按 自動跟隨 跳到最新':''}${this.history?' · 每頁最多 500 筆':''}${this.trimmed?' · 閱讀位置已移出視窗，請用 History 查看':''}`;this.part('latest').hidden=!this.unread;this.part('latest').textContent=this.unread+' new events · 跳至最新';this.part('count').textContent=`顯示 ${this.visible().length} / ${(this.history || this.buffer).length} 筆`;}
    bottom(){this.unread=0;const log=this.part('log');log.scrollTop=log.scrollHeight;}
    render(force=false){
      const log=this.part('log'),events=this.visible();
      const anchor=!this.auto&&!force?[...log.children].find(row=>row.getBoundingClientRect().bottom>log.getBoundingClientRect().top+log.clientTop):null;
      const anchorTop=anchor?.getBoundingClientRect().top;
      if(force)this.trimmed=false;
      if(force)log.replaceChildren();
      const wanted=new Set(events.map(e=>String(e.sequence)));
      for(const row of [...log.children])if(!wanted.has(row.dataset.sequence))row.remove();
      const existing=new Set([...log.children].map(r=>r.dataset.sequence));const fragment=document.createDocumentFragment();
      let newest=null;
      for(const e of events){if(existing.has(String(e.sequence)))continue;
        const row=document.createElement('div');row.className='cycle-console-row';if(!force&&this.loaded)row.classList.add('pav-new-row');row.dataset.sequence=e.sequence;row.dataset.machine=e.machine_id || '';row.dataset.level=LEVELS.has(e.level)?e.level:'INFO';
        for(const [cls,value] of [['seq',String(e.sequence).padStart(3,'0')],['time',displayTime(e.timestamp)],['node',e.machine_id?(this.job.targets.find(t=>t.name===e.machine_id)?.slot_key || e.node || e.machine_id):'JOB'],['level',row.dataset.level],['stage',e.phase||'—']]){const cell=document.createElement('span');cell.className=`cycle-console-${cls}`;cell.textContent=value;cell.title=cls==='time'?`${e.timestamp || '—'} · 台灣時間 UTC+8`:cls==='node'?`${e.machine_id || 'Job'} · ${e.tray || ''}/${e.node || ''}`:e.timestamp || '';row.append(cell);}
        const content=document.createElement('span');content.className='cycle-console-message';content.textContent=e.message;
        const context=document.createElement('small');context.textContent=[e.loop!=null?`輪次 ${e.loop}`:null,e.detail].filter(Boolean).join(' · ');if(!context.textContent)context.hidden=true;content.append(context);
        if(e.evidence&&!/[:\\%?#]/.test(e.evidence)&&!e.evidence.split('/').some(p=>!p||p.startsWith('.'))){const link=document.createElement('a');link.textContent='查看證據';link.href=`${this.url}/files/${e.evidence.split('/').map(encodeURIComponent).join('/')}`;link.target='_blank';link.rel='noopener';content.append(link);}
        row.append(content);fragment.append(row);newest=row;
      }
      log.append(fragment);log.dataset.bufferCount=this.buffer.length;if(!this.history)this.part('older').disabled=!this.buffer.length;
      if(this.auto&&!this.history&&!this.paused)this.bottom();
      else if(anchor?.isConnected)log.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;
      else if(anchor){log.scrollTop=0;this.trimmed=true;}
      else if(force)log.scrollTop=0;
      this.status();
    }
  };
})();
