/* Read-only view of the persistent event stream. Never dispatches job actions. */
(() => {
  'use strict';
  const BUFFER=3000, RENDER=2000, LEVELS=new Set(['INFO','CMD','WAIT','PASS','WARN','FAIL','ERROR','PRE','POST']);
  const line=e=>`${e.timestamp} #${e.sequence} ${e.machine_id || 'JOB'} [${e.level}] ${e.phase} loop=${e.loop ?? 0} ${e.message}${e.detail?' — '+e.detail:''}`;
  window.CycleConsole=class {
    constructor(root,button) {
      this.root=root;this.button=button;this.revision=0;this.buffer=[];this.history=null;this.cursor=0;this.auto=true;
      root.innerHTML=`<div class="cycle-console-heading"><div><h3>Live Console</h3><p data-part="meta"></p></div><span data-part="runtime"></span></div>
        <div class="cycle-console-tools"><button class="btn" data-part="auto" aria-pressed="true">Auto Scroll ON</button><button class="btn" data-part="pause">Pause View</button><button class="btn" data-part="copy">Copy visible log</button><a class="btn" data-part="download">Download Log</a></div>
        <div class="cycle-console-tools"><div data-part="nodes" class="cycle-console-nodes" aria-label="Console node filter"></div><label class="cycle-console-check"><input type="checkbox" data-part="errors">ERROR ONLY</label><label class="cycle-console-search">Search<input type="search" data-part="search" placeholder="搜尋目前視窗；歷史請按 Search history" maxlength="200"></label></div>
        <div class="cycle-console-tools"><button class="btn" data-part="history">Search history</button><button class="btn" data-part="older">Earlier history</button><button class="btn" data-part="live" hidden>Return to live</button></div>
        <p class="cycle-console-status" data-part="status" role="status"></p><p data-part="error" role="alert" hidden></p>
        <div class="cycle-console-log" data-part="log" role="log" aria-live="off" tabindex="0" aria-label="Cycle operational events"></div>
        <p class="cycle-console-note">時間 UTC。檢視最多 2,000 行，記憶體保留最新 3,000 筆。Pause / 關閉不會停止 Job。完整保留紀錄可下載；原始證據仍在報告與證據。</p>`;
      this.part=name=>root.querySelector(`[data-part="${name}"]`);
      button.onclick=()=>this.toggle();
      this.part('auto').onclick=()=>{this.auto=!this.auto;this.part('auto').textContent=`Auto Scroll ${this.auto?'ON':'OFF'}`;this.part('auto').setAttribute('aria-pressed',this.auto);if(this.auto)this.bottom();};
      this.part('pause').onclick=()=>{this.paused=!this.paused;this.cancel();this.part('pause').textContent=this.paused?'Resume View':'Pause View';this.status();if(!this.paused&&!this.history)this.poll();};
      this.part('errors').onchange=()=>this.render(true);
      this.part('search').oninput=()=>{clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.render(true),150);};
      this.part('history').onclick=()=>this.loadHistory();
      this.part('older').onclick=()=>this.loadHistory(this.visible()[0]?.sequence || (this.history || this.buffer)[0]?.sequence);
      this.part('live').onclick=()=>{this.cancel();this.history=null;this.part('live').hidden=true;this.render(true);if(!this.paused)this.poll();};
      this.part('copy').onclick=async()=>{try{await navigator.clipboard.writeText(this.visible().map(line).join('\n'));this.error('');this.part('status').textContent='Visible log copied.';}catch(_){this.error('無法複製；可使用 Download Log。');}};
    }
    cancel(){this.revision++;clearTimeout(this.timer);this.controller?.abort();this.controller=null;}
    close(){this.cancel();clearTimeout(this.searchTimer);this.root.hidden=true;this.button.setAttribute('aria-expanded','false');}
    reset(){this.close();this.job=null;this.buffer=[];this.history=null;this.cursor=0;this.part('log').replaceChildren();}
    setJob(job,url){
      if(this.job?.id!==job.id){
        this.cancel();this.buffer=[];this.history=null;this.cursor=0;this.node='';this.paused=false;this.loaded=false;this.url=url;
        this.part('pause').textContent='Pause View';this.part('live').hidden=true;this.part('search').value='';this.part('errors').checked=false;
        this.part('nodes').replaceChildren();
        for(const target of [{name:'',node:'ALL'},...job.targets]){
          const b=document.createElement('button');b.type='button';b.className='btn';b.dataset.machine=target.name;
          b.textContent=target.name?`${target.tray || ''}/${target.node || target.name}`:'ALL';b.title=target.name || 'All nodes';b.setAttribute('aria-pressed',!target.name);
          b.onclick=()=>{this.node=target.name;this.part('nodes').querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',n.dataset.machine===this.node));this.render(true);};
          this.part('nodes').append(b);
        }
        this.part('download').href=`${url}/events/download`;this.part('meta').textContent=`Job: ${job.id} · ${job.synthetic?'SYNTHETIC · 無實機驗收':'LIVE'}`;
        this.part('log').replaceChildren();this.error('');
        this.job=job;if(!this.root.hidden)this.poll();
      }
      this.job=job;
      const end=['COMPLETE','INCOMPLETE','ERROR','BLOCKED','CANCELLED'].includes(job.state)?job.updated_at:Date.now()/1000;
      const sec=Math.max(0,Math.floor(end-job.created_at));
      this.part('runtime').textContent=`Runtime: ${[Math.floor(sec/3600),Math.floor(sec/60)%60,sec%60].map(n=>String(n).padStart(2,'0')).join(':')}`;
    }
    toggle(){if(!this.root.hidden){this.close();return;}this.root.hidden=false;this.button.setAttribute('aria-expanded','true');this.render(true);if(!this.paused&&!this.history)this.poll();}
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
      if(this.root.hidden||this.paused||this.history||this.controller||!this.job)return;
      clearTimeout(this.timer);const revision=this.revision;let delay=1500;
      try{const data=await this.request(this.cursor?{after:this.cursor}:{tail:true});if(!data)return;
        for(const e of data.events){if(e.sequence>this.cursor){this.buffer.push(e);this.cursor=e.sequence;}}
        if(this.buffer.length>BUFFER)this.buffer.splice(0,this.buffer.length-BUFFER);
        this.error('');this.render();if(data.has_more&&data.events.length&&data.events[0].sequence>0&&this.loaded)delay=250;this.loaded=true;
      }catch(e){if(revision===this.revision)this.error('Console 連線中斷，將自動重試。Job 狀態仍由原有 polling 更新。');}
      finally{if(revision===this.revision&&!this.root.hidden&&!this.paused&&!this.history)this.timer=setTimeout(()=>this.poll(),delay);}
    }
    async loadHistory(before){
      this.cancel();const revision=this.revision;
      try{const data=await this.request({...(before?{before}:{tail:true}),...(this.node?{machine_id:this.node}:{}),errors_only:this.part('errors').checked,search:this.part('search').value});
        if(!data)return;this.history=data.events;this.part('live').hidden=false;this.error('');this.render(true);this.part('older').disabled=!data.has_more;
      }catch(e){if(revision===this.revision){this.error('歷史載入失敗，請重試。');if(!this.history&&!this.paused)this.timer=setTimeout(()=>this.poll(),1500);}}
    }
    visible(){const query=this.part('search').value.toLowerCase();return(this.history || this.buffer).filter(e=>(!this.node||e.machine_id===this.node)&&(!this.part('errors').checked||['FAIL','ERROR'].includes(e.level))&&(!query||`${e.message} ${e.detail || ''}`.toLowerCase().includes(query))).slice(-RENDER);}
    status(){this.part('status').textContent=`${this.history?'歷史視窗':this.paused?'View paused':'Live · 每 1.5 秒更新'}${this.paused||this.history?' · 不影響 Job 執行':''} · 顯示 ${this.visible().length} 筆${this.history?' · 每頁最多 500 筆':''}${this.trimmed?' · 閱讀位置已移出視窗，請用 Earlier history 查看':''}`;}
    bottom(){const log=this.part('log');log.scrollTop=log.scrollHeight;}
    render(force=false){
      const log=this.part('log'),events=this.visible();
      const anchor=!this.auto&&!force?[...log.children].find(row=>row.getBoundingClientRect().bottom>log.getBoundingClientRect().top+log.clientTop):null;
      const anchorTop=anchor?.getBoundingClientRect().top;
      if(force)this.trimmed=false;
      if(force)log.replaceChildren();
      const wanted=new Set(events.map(e=>String(e.sequence)));
      for(const row of [...log.children])if(!wanted.has(row.dataset.sequence))row.remove();
      const existing=new Set([...log.children].map(r=>r.dataset.sequence));const fragment=document.createDocumentFragment();
      for(const e of events){if(existing.has(String(e.sequence)))continue;
        const row=document.createElement('div');row.className='cycle-console-row';row.dataset.sequence=e.sequence;row.dataset.machine=e.machine_id || '';row.dataset.level=LEVELS.has(e.level)?e.level:'INFO';
        for(const [cls,value] of [['time',e.timestamp?.slice(11,19) || '—'],['node',e.machine_id?(e.node || e.machine_id):'JOB'],['level',row.dataset.level]]){const cell=document.createElement('span');cell.className=`cycle-console-${cls}`;cell.textContent=value;cell.title=cls==='node'?`${e.machine_id || 'Job'} · ${e.tray || ''}/${e.node || ''}`:e.timestamp || '';row.append(cell);}
        const content=document.createElement('span');content.className='cycle-console-message';content.textContent=e.message;
        const context=document.createElement('small');context.textContent=`${e.phase} · Loop ${e.loop ?? 0}${e.detail?' · '+e.detail:''}`;content.append(context);
        if(e.evidence&&!/[:\\%?#]/.test(e.evidence)&&!e.evidence.split('/').some(p=>!p||p.startsWith('.'))){const link=document.createElement('a');link.textContent='View Evidence';link.href=`${this.url}/files/${e.evidence.split('/').map(encodeURIComponent).join('/')}`;link.target='_blank';link.rel='noopener';content.append(link);}
        row.append(content);fragment.append(row);
      }
      log.append(fragment);log.dataset.bufferCount=this.buffer.length;if(!this.history)this.part('older').disabled=!this.buffer.length;
      if(this.auto&&!this.history)this.bottom();
      else if(anchor?.isConnected)log.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;
      else if(anchor){log.scrollTop=0;this.trimmed=true;}
      else if(force)log.scrollTop=0;
      this.status();
    }
  };
})();
