/* Read-only view of the persistent event stream. Never dispatches job actions. */
(() => {
  'use strict';
  const BUFFER=3000, RENDER=2000, LEVELS=new Set(['INFO','CMD','WAIT','PASS','WARN','FAIL','ERROR','PRE','POST']);
  const TERMINAL=new Set(['COMPLETE','INCOMPLETE','ERROR','BLOCKED','CANCELLED','RECONCILIATION_REQUIRED']);
  const line=e=>String(e.timestamp)+' #'+String(e.sequence)+' '+(e.machine_id || 'JOB')+' ['+(e.level)+'] '+e.phase+' loop='+(e.loop ?? 0)+' '+e.message+(e.detail?' — '+e.detail:'');
  window.CycleConsole=class {
    constructor(root,button) {
      this.root=root;this.button=button;this.revision=0;this.buffer=[];this.history=null;this.cursor=0;this.auto=true;this.unread=0;this.paused=false;this.disconnected=false;
      root.innerHTML='<div class="cycle-console-heading"><div><h3>Live Console</h3><p data-part="meta"></p></div><span data-part="runtime"></span></div>'+
        '<div class="cycle-console-tools cycle-console-toolbar cycle-console-toolbar--main" data-part="main-group" role="group" aria-label="檢視與輸出"><div class="cycle-console-toolbar-group cycle-console-toolbar--follow" data-part="follow-group"><span class="cycle-console-toolbar-label">檢視控制</span><button class="btn" data-part="auto" aria-pressed="true" title="跟隨新事件並跳到最新一筆">跟隨最新：開</button><button class="btn" data-part="pause" aria-pressed="false" title="暫停畫面更新；不會停止 Job">暫停檢視</button></div><div class="cycle-console-toolbar-group cycle-console-toolbar--output" data-part="output-group"><span class="cycle-console-toolbar-label">輸出</span><button class="btn" data-part="copy" title="複製目前篩選後的可見紀錄">複製目前顯示</button><a class="btn" data-part="download" title="下載完整事件紀錄">下載完整紀錄</a></div></div>'+
        '<div class="cycle-console-tools cycle-console-toolbar cycle-console-toolbar--filters" data-part="filter-group" role="group" aria-label="事件篩選" title="節點、等級與關鍵字會篩選目前視窗；查詢已保存紀錄請按「查詢歷史紀錄」。"><span class="cycle-console-toolbar-label">事件篩選</span><div data-part="nodes" class="cycle-console-nodes cycle-console-node-filter" aria-label="節點篩選"></div><label data-part="errors-label" class="cycle-console-check cycle-console-filter-option"><input type="checkbox" data-part="errors" aria-label="只看 FAIL 或 ERROR 事件"><span>只看 FAIL / ERROR</span></label><label data-part="search-label" class="cycle-console-search cycle-console-filter-option"><span>搜尋事件</span><input type="search" data-part="search" aria-label="搜尋事件文字" placeholder="搜尋目前顯示；查歷史請按「查詢歷史紀錄」" maxlength="200" title="只會篩選目前視窗；查歷史請按查詢歷史紀錄"></label><p class="cycle-console-filter-summary" data-part="filter-summary" role="status" hidden></p></div>'+
        '<div class="cycle-console-tools cycle-console-toolbar cycle-console-toolbar--history" data-part="history-group" role="group" aria-label="歷史紀錄"><span class="cycle-console-toolbar-label">歷史紀錄</span><button class="btn" data-part="history" title="以目前節點、錯誤與搜尋條件查詢已保存紀錄">查詢歷史紀錄</button><button class="btn" data-part="older" title="向更早的事件頁面查詢">載入更早歷史</button><button class="btn" data-part="live" hidden title="返回目前即時事件">返回即時</button></div>'+
        '<p class="cycle-console-status cycle-console-state" data-part="status" role="status" aria-live="polite"></p><p data-part="error" role="alert" hidden></p>'+
        '<div class="cycle-console-columns" data-part="columns" aria-hidden="true"><span>時間</span><span>節點</span><span>等級</span><span>事件與證據</span></div><div class="cycle-console-log" data-part="log" role="log" aria-live="off" tabindex="0" aria-label="Cycle operational events"><p class="cycle-console-empty" data-part="empty" role="status" aria-live="polite" hidden></p></div>'+
        '<p class="cycle-console-note">時間 UTC。檢視最多 2,000 行，記憶體保留最新 3,000 筆。跟隨、暫停與返回歷史只改變畫面，不影響 Job。完整紀錄可下載；原始證據仍在報告與證據。</p>';
      this.part=name=>root.querySelector('[data-part="'+name+'"]');
      const clear=document.createElement('button');clear.type='button';clear.className='btn';clear.dataset.part='clear-filters';clear.textContent='清除篩選';clear.hidden=true;
      clear.onclick=()=>{clearTimeout(this.searchTimer);this.node='';this.part('errors').checked=false;this.part('search').value='';this.syncFilterState();this.part('search').focus();if(this.history)this.loadHistory();else this.render(true);};
      this.part('filter-group').append(clear);
      this.part('log').addEventListener('scroll',()=>{const log=this.part('log');if(this.auto&&log.scrollHeight-log.scrollTop-log.clientHeight>30){this.auto=false;this.setFollowState();this.status();}});
      button.onclick=()=>this.toggle();
      this.part('auto').onclick=()=>{this.auto=!this.auto;this.setFollowState();if(this.auto)this.bottom();this.status();};
      this.part('pause').onclick=()=>{this.paused=!this.paused;this.cancel();this.setPauseState();this.updateEmptyState(this.visible());this.status();if(!this.paused&&!this.history)this.poll();};
      this.part('errors').onchange=()=>{this.syncFilterState();this.render(true);};
      this.part('search').oninput=()=>{this.syncFilterState();clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.render(true),150);};
      this.part('history').onclick=()=>this.loadHistory();
      this.part('older').onclick=()=>this.loadHistory(this.visible()[0]?.sequence || (this.history || this.buffer)[0]?.sequence);
      this.part('live').onclick=()=>{this.cancel();this.history=null;this.setHistoryState();this.error('',false);this.render(true);if(!this.paused)this.poll();};
      this.part('copy').onclick=async()=>{try{await navigator.clipboard.writeText(this.visible().map(line).join('\n'));this.error('',false);this.status('已複製目前顯示的紀錄。');}catch(_){this.error('無法複製；可使用下載完整紀錄。');}};
      this.setFollowState();this.setPauseState();this.setHistoryState();this.syncFilterState();this.syncViewState();
    }
    part(name){return this.root.querySelector('[data-part="'+name+'"]');}
    clearRows(){for(const row of this.part('log').querySelectorAll('.cycle-console-row'))row.remove();}
    setFollowState(){const button=this.part('auto');button.textContent='跟隨最新：'+(this.auto?'開':'關');button.title=this.auto?'跟隨新事件並跳到最新一筆':'保留目前閱讀位置；按此返回最新一筆';button.setAttribute('aria-pressed',String(this.auto));button.dataset.state=this.auto?'following':'manual';button.classList.toggle('is-selected',this.auto);}
    setPauseState(){const button=this.part('pause');button.textContent=this.paused?'繼續檢視':'暫停檢視';button.title=this.paused?'恢復畫面更新；不會停止 Job':'暫停畫面更新；不會停止 Job';button.setAttribute('aria-pressed',String(this.paused));button.dataset.state=this.paused?'paused':'updating';button.classList.toggle('is-selected',this.paused);}
    setHistoryState(){const active=!!this.history;this.part('live').hidden=!active;this.part('history-group').dataset.active=String(active);this.part('history').classList.toggle('is-selected',active);}
    syncFilterState(){
      const nodeRoot=this.part('nodes'),node=this.node || '',errors=this.part('errors'),query=this.part('search').value.trim();
      nodeRoot.querySelectorAll('button').forEach(button=>{const active=(button.dataset.machine || '')===node;button.setAttribute('aria-pressed',String(active));button.dataset.selected=String(active);button.classList.toggle('is-selected',active);});
      const errorLabel=this.part('errors-label'),searchLabel=this.part('search-label');
      errorLabel.classList.toggle('is-selected',errors.checked);errorLabel.dataset.selected=String(errors.checked);errors.dataset.selected=String(errors.checked);
      searchLabel.classList.toggle('is-selected',!!query);searchLabel.dataset.selected=String(!!query);this.part('search').dataset.selected=String(!!query);
      const filters=[node?'指定節點':'全部節點',errors.checked?'等級 FAIL / ERROR':'所有等級'];if(query)filters.push('關鍵字「'+query+'」');const summary=this.part('filter-summary'),active=!!node||errors.checked||!!query;summary.textContent=active?'目前篩選：'+filters.join(' · '):'';summary.hidden=!active;summary.dataset.active=String(active);
      this.part('clear-filters').hidden=!active;
    }
    currentView(){if(this.history)return 'history';if(this.paused)return 'paused';if(this.disconnected)return 'disconnected';if(this.job&&TERMINAL.has(this.job.state))return 'complete';return 'live';}
    syncViewState(){const view=this.currentView();this.root.dataset.view=view;this.root.dataset.jobState=this.job?.state || '';this.part('status').dataset.view=view;return view;}
    updateEmptyState(events){
      const empty=this.part('empty'),source=this.history || this.buffer;
      if(events.length){empty.hidden=true;empty.removeAttribute('data-state');empty.textContent='';return;}
      let state='waiting',message='等待最新事件輸出…';
      if(source.length){state='no-match';message='沒有事件符合目前篩選。請清除節點、錯誤或搜尋條件。';}
      else if(this.history){state='history-empty';message='這一頁歷史沒有事件；可載入更早歷史或返回即時。';}
      else if(this.paused){state='paused-empty';message='檢視已暫停，尚未載入事件。恢復檢視後會繼續更新。';}
      empty.dataset.state=state;empty.textContent=message;empty.hidden=false;
    }
    cancel(){this.revision++;clearTimeout(this.timer);this.controller?.abort();this.controller=null;}
    close(){this.cancel();clearTimeout(this.searchTimer);this.root.hidden=true;this.button.setAttribute('aria-expanded','false');}
    reset(){this.close();this.job=null;this.buffer=[];this.history=null;this.cursor=0;this.unread=0;this.disconnected=false;this.clearRows();this.part('empty').hidden=true;this.part('empty').textContent='';this.setHistoryState();this.syncViewState();}
    setJob(job,url){
      if(this.job?.id!==job.id){
        this.cancel();this.buffer=[];this.history=null;this.cursor=0;this.node='';this.auto=true;this.unread=0;this.paused=false;this.disconnected=false;this.loaded=false;this.trimmed=false;this.url=url;
        this.setFollowState();this.setPauseState();this.setHistoryState();this.part('search').value='';this.part('errors').checked=false;this.part('nodes').replaceChildren();
        for(const target of [{name:'',node:'ALL'},...job.targets]){
          const b=document.createElement('button');b.type='button';b.className='btn';b.dataset.machine=target.name;b.textContent=target.name?(target.tray || '')+'/'+(target.node || target.name):'全部節點';b.title=target.name || '全部節點';b.setAttribute('aria-label',target.name?'篩選節點 '+b.textContent:'顯示全部節點');
          b.onclick=()=>{this.node=target.name;this.syncFilterState();this.render(true);};
          this.part('nodes').append(b);
        }
        this.syncFilterState();this.part('download').href=url+'/events/download';this.part('meta').textContent='Job: '+job.id+' · '+(job.synthetic?'SYNTHETIC · 無實機驗收':'LIVE');
        this.clearRows();this.part('empty').hidden=true;this.error('',false);this.job=job;if(!this.root.hidden)this.poll();
      }
      this.job=job;
      const end=TERMINAL.has(job.state)?job.updated_at:Date.now()/1000;
      const sec=Math.max(0,Math.floor(end-job.created_at));
      this.part('runtime').textContent='Runtime: '+[Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':');
      this.syncViewState();
    }
    toggle(){if(!this.root.hidden){this.close();return;}this.root.hidden=false;this.button.setAttribute('aria-expanded','true');this.render(true);if(!this.paused&&!this.history)this.poll();}
    error(message,disconnected=false){this.part('error').textContent=message;this.part('error').hidden=!message;this.disconnected=Boolean(message&&disconnected);this.syncViewState();}
    async request(params){
      const revision=this.revision;const controller=new AbortController();this.controller=controller;
      const timeout=setTimeout(()=>controller.abort(),15000);
      try{const response=await fetch(this.url+'/events?'+new URLSearchParams({limit:500,...params}),{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new Error('Event request failed');
        const data=await response.json();return revision===this.revision&&!this.root.hidden?data:null;
      }finally{clearTimeout(timeout);if(this.controller===controller)this.controller=null;}
    }
    async poll(){
      if(this.root.hidden||this.paused||this.history||this.controller||!this.job)return;
      clearTimeout(this.timer);const revision=this.revision;let delay=1500;
      try{const data=await this.request(this.cursor?{after:this.cursor}:{tail:true});if(!data)return;
        if(data.cursor_reset){this.buffer=[];this.cursor=0;this.clearRows();this.error('事件 cursor 已過期；重新取得 snapshot 與保留歷史。');this.job=await (await fetch(this.url,{cache:'no-store'})).json();this.render(true);return;}
        for(const e of data.events){if(e.sequence>this.cursor){this.buffer.push(e);this.cursor=e.sequence;if(!this.auto)this.unread++;}}
        if(this.buffer.length>BUFFER)this.buffer.splice(0,this.buffer.length-BUFFER);
        this.error('',false);this.render();if(data.has_more&&data.events.length&&data.events[0].sequence>0&&this.loaded)delay=250;this.loaded=true;
      }catch(e){if(revision===this.revision){this.error('Console 連線中斷，將自動重試。Job 狀態仍由原有 polling 更新。',true);this.status();}}
      finally{if(revision===this.revision&&!this.root.hidden&&!this.paused&&!this.history)this.timer=setTimeout(()=>this.poll(),delay);}
    }
    async loadHistory(before){
      this.cancel();const revision=this.revision;
      try{const data=await this.request(Object.assign({limit:500},before?{before:before}:{tail:true},this.node?{machine_id:this.node}:{}, {errors_only:this.part('errors').checked,search:this.part('search').value}));
        if(!data)return;this.history=data.events;this.setHistoryState();this.error('',false);this.render(true);this.part('older').disabled=!data.has_more;
      }catch(e){if(revision===this.revision){this.error('歷史載入失敗，請重試。',true);this.status();if(!this.history&&!this.paused)this.timer=setTimeout(()=>this.poll(),1500);}}
    }
    visible(){const query=this.part('search').value.toLowerCase();return(this.history || this.buffer).filter(e=>(!this.node||e.machine_id===this.node)&&(!this.part('errors').checked||['FAIL','ERROR'].includes(e.level))&&(!query||(String(e.message)+' '+(e.detail || '')).toLowerCase().includes(query))).slice(-RENDER);}
    status(note=''){
      const view=this.syncViewState();this.syncFilterState();
      const parts=view==='history'?['歷史視窗','不影響 Job 執行']:view==='paused'?['檢視已暫停','不影響 Job 執行']:view==='disconnected'?['連線中斷','將自動重試']:view==='complete'?[this.job?.state==='RECONCILIATION_REQUIRED'?'結果未知，待核對；相關資源仍占用':'已結束 '+(this.job?.state || 'Job')]:['即時',this.auto?'跟隨最新':'手動閱讀','每 1.5 秒更新'];
      parts.push('顯示 '+this.visible().length+' 筆');if(this.unread)parts.push('未讀 '+this.unread+' 筆；按「跟隨最新」跳到最新');if(this.history)parts.push('每頁最多 500 筆');if(this.trimmed)parts.push('目前視窗已移出閱讀位置；請按「載入更早歷史」(Earlier history)');if(note)parts.push(note);this.part('status').textContent=parts.join(' · ');
    }
    bottom(){this.unread=0;const log=this.part('log');log.scrollTop=log.scrollHeight;}
    render(force=false){
      const log=this.part('log'),events=this.visible();
      const anchor=!this.auto&&!force?[...log.querySelectorAll('.cycle-console-row')].find(row=>row.getBoundingClientRect().bottom>log.getBoundingClientRect().top+log.clientTop):null;
      const anchorTop=anchor?.getBoundingClientRect().top;
      if(force)this.trimmed=false;
      if(force)this.clearRows();
      const wanted=new Set(events.map(e=>String(e.sequence)));
      for(const row of [...log.querySelectorAll('.cycle-console-row')])if(!wanted.has(row.dataset.sequence))row.remove();
      const existing=new Set([...log.querySelectorAll('.cycle-console-row')].map(r=>r.dataset.sequence));const fragment=document.createDocumentFragment();
      for(const e of events){if(existing.has(String(e.sequence)))continue;
        const row=document.createElement('div');row.className='cycle-console-row';row.dataset.sequence=e.sequence;row.dataset.machine=e.machine_id || '';row.dataset.level=LEVELS.has(e.level)?e.level:'INFO';
        row.setAttribute('role','group');row.setAttribute('aria-label','事件 '+e.sequence);
        for(const [cls,value] of [['time',e.timestamp?.slice(11,19) || '—'],['node',e.machine_id?(e.node || e.machine_id):'JOB'],['level',row.dataset.level]]){const cell=document.createElement('span');cell.className='cycle-console-'+cls;cell.textContent=value;cell.title=cls==='node'?(e.machine_id || 'Job')+' · '+(e.tray || '')+'/'+(e.node || ''):e.timestamp || '';row.append(cell);}
        for(const [index,label] of ['UTC 時間：','節點：','等級：'].entries()){const hint=document.createElement('span');hint.className='cw-sr-only';hint.textContent=label;row.children[index].prepend(hint);}
        const content=document.createElement('span');content.className='cycle-console-message';content.textContent=e.message;
        const context=document.createElement('small');context.textContent=e.phase+' · Loop '+(e.loop ?? 0)+(e.detail?' · '+e.detail:'');content.append(context);
        if(e.evidence&&!/[:\\%?#]/.test(e.evidence)&&!e.evidence.split('/').some(p=>!p||p.startsWith('.'))){const link=document.createElement('a');link.textContent='查看證據';link.href=this.url+'/files/'+e.evidence.split('/').map(encodeURIComponent).join('/');link.target='_blank';link.rel='noopener';content.append(link);}
        row.append(content);fragment.append(row);
      }
      log.append(fragment);log.dataset.bufferCount=this.buffer.length;if(!this.history)this.part('older').disabled=!this.buffer.length;
      this.updateEmptyState(events);
      if(this.auto&&!this.history)this.bottom();
      else if(anchor?.isConnected)log.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;
      else if(anchor){log.scrollTop=0;this.trimmed=true;}
      else if(force)log.scrollTop=0;
      this.status();
    }
  };
})();
