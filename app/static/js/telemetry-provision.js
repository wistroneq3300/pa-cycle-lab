/* Optional per-node telemetry. This view owns no SSH connection or Cycle job. */
(() => {
  'use strict';
  const time = value => value ? new Date(value * 1000).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false}) : '尚未確認';
  const clock = value => new Date(value * 1000).toLocaleTimeString('en-GB',{timeZone:'Asia/Taipei',hour12:false});
  const stage = value => ({QUEUED:'Queue',IDENTITY:'Identity',DETECT:'Exporter',INSTALL:'Install',START:'Service',EXPORTER:'Metrics',REGISTER:'Target',VERIFY:'Verify',READY:'Ready',ERROR:'Error',INTERRUPTED:'Interrupted',DEGRADED:'Degraded',UNREACHABLE:'Connection'}[value] || value || 'System');
  const active = job => job && ['QUEUED','PROVISIONING'].includes(job.state);
  const key = () => globalThis.crypto?.randomUUID?.() || `telemetry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let current,lastView;
  const choices=new Map();
  class View {
    constructor(root) {
      this.root=root; this.abort=new AbortController(); this.cursor=0; this.rows=[]; this.follow=true; this.paused=false;
      this.closed=false; this.consoleOpen=false; this.name=root.dataset.system; this.node=null; this.job=null;
      root.innerHTML=`<header class="tp-heading"><div><h3>Node Telemetry <span data-state class="tp-state">載入中</span></h3><p data-detail aria-live="polite">正在取得節點設定…</p></div><label class="tp-node">監控節點<select aria-label="Telemetry 節點" data-node><option value="">選擇節點</option></select></label></header>
        <div class="tp-context"><span data-target></span><span data-time></span></div>
        <div class="tp-actions"><button class="btn primary" data-enable disabled>啟用 Telemetry</button><button class="btn" data-console hidden>查看啟用紀錄</button><a class="btn" data-grafana hidden target="_blank" rel="noopener" title="開啟此節點的 Grafana 監控圖表，不執行安裝">開啟監控圖表 ↗</a></div>
        <p class="tp-note" data-notice>啟用只針對所選節點。原有效能資料與管理功能可繼續使用。</p>
        <section class="tp-console" hidden aria-label="Telemetry 啟用程序"><header><div class="tp-console-title"><h4>Telemetry 啟用程序</h4><p data-console-target>Read-only execution log</p></div><span class="tp-session" data-session>IDLE</span><span data-job></span><button class="btn" data-close>關閉紀錄</button></header>
          <div class="tp-runline"><span>Current stage <strong data-stage>Queue</strong></span><span data-log-date></span><span>TAIPEI / UTC+8</span></div>
          <div class="tp-tools"><button class="btn" data-follow aria-pressed="true">自動跟隨：開</button><button class="btn" data-pause aria-pressed="false">暫停顯示</button><label>搜尋已載入紀錄<input type="search" data-search placeholder="輸入關鍵字"></label><button class="btn" data-copy>複製可見紀錄</button><a class="btn" data-download>下載完整紀錄</a></div>
          <div class="tp-log-columns" aria-hidden="true"><span>SEQ</span><span>TIME</span><span>STATUS</span><span>STAGE</span><span>EVENT</span></div>
          <div class="tp-log" role="region" tabindex="0" aria-label="唯讀啟用紀錄，台灣時間 UTC+8"></div><footer><span data-connection>正在連線</span><button class="btn" data-latest hidden>跳至最新輸出</button><span>UTC+8 · 僅顯示最近 2,000 筆</span></footer>
        </section><div class="tp-dashboard" hidden><p>若無法顯示，請使用「在 Grafana 開啟」確認登入及嵌入設定。</p></div>`;
      this.$=selector=>root.querySelector(selector);
      this.$('[data-node]').onchange=()=>this.select(this.$('[data-node]').value);
      this.$('[data-enable]').onclick=()=>this.enable();
      this.$('[data-console]').onclick=()=>{this.consoleOpen=true;this.$('.tp-console').hidden=false;this.pollEvents();};
      this.$('[data-close]').onclick=()=>{this.consoleOpen=false;this.$('.tp-console').hidden=true;};
      this.$('[data-follow]').onclick=()=>{this.follow=!this.follow;this.followState();if(this.follow)this.bottom();};
      this.$('[data-pause]').onclick=()=>{this.paused=!this.paused;if(this.paused)this.pauseRows=this.rows.slice();this.pauseState();if(!this.paused)this.renderLog();};
      this.$('[data-search]').oninput=()=>this.renderLog();
      this.$('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText((this.viewLines||[]).join('\n'));this.$('[data-connection]').textContent='已複製可見紀錄';}catch(_){this.$('[data-connection]').textContent='無法存取剪貼簿，請選取文字複製或下載紀錄。';}};
      this.$('[data-latest]').onclick=()=>{this.follow=true;this.followState();this.bottom();};
      this.$('.tp-log').onscroll=()=>{const el=this.$('.tp-log');if(el.scrollHeight-el.scrollTop-el.clientHeight>30){this.follow=false;this.followState();}};
      this.load();
    }
    async request(path,options={}) {
      const response=await fetch('/api/telemetry'+path,{...options,signal:this.abort.signal});
      const body=await response.json();if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'無法取得 Telemetry 資料');return body;
    }
    async load() {
      try {
        const {nodes}=await this.request('/systems/'+encodeURIComponent(this.name)+'/nodes');if(this.closed)return;
        this.nodes=nodes;
        for(const node of nodes){const option=document.createElement('option');option.value=node.node_id;option.textContent=`${node.slot} · ${node.hostname||node.os_ip}`;this.$('[data-node]').append(option);}
        const saved=choices.get(this.name);
        const selected=saved?.activeSlot===this.root.dataset.slot ? nodes.find(n=>n.node_id===saved.nodeId) : nodes.find(n=>n.slot===this.root.dataset.slot);
        if(selected){this.$('[data-node]').value=selected.node_id;this.select(selected.node_id);}
        else{this.$('[data-state]').textContent='選擇節點';this.$('[data-detail]').textContent='請選擇要查看或啟用 Telemetry 的節點。';}
      }catch(error){this.error(error);}
    }
    select(nodeId) {
      clearTimeout(this.timer);this.generation=(this.generation||0)+1;this.node=this.nodes.find(n=>n.node_id===nodeId);
      choices.set(this.name,{nodeId,activeSlot:this.root.dataset.slot});
      this.job=null;this.resetLog();this.requestKey=null;this.eventsBusy=false;this.consoleOpen=false;this.$('.tp-console').hidden=true;
      this.$('.tp-dashboard').replaceChildren();this.$('.tp-dashboard').hidden=true;
      if(this.node){
        this.update(this.node);
        if(lastView?.name===this.name&&lastView.nodeId===nodeId&&lastView.jobId===this.job?.job_id){
          this.rows=lastView.rows;this.cursor=lastView.cursor;this.consoleOpen=lastView.open;this.follow=lastView.follow;this.paused=lastView.paused;this.pauseRows=lastView.pauseRows;this.pauseState();
          this.$('.tp-console').hidden=!this.consoleOpen;this.$('[data-search]').value=lastView.search;this.followState();this.renderLog();
          if(!this.follow)this.$('.tp-log').scrollTop=lastView.top;
        }
        this.poll(this.generation);
      }else this.$('[data-enable]').disabled=true;
    }
    async poll(generation) {
      if(this.closed||generation!==this.generation)return;
      try{const node=await this.request('/nodes/'+encodeURIComponent(this.node.node_id));if(generation!==this.generation||this.closed)return;this.update(node);await this.pollEvents();}
      catch(error){this.error(error);}
      if(!this.closed&&generation===this.generation)this.timer=setTimeout(()=>this.poll(generation),active(this.job)?1500:15000);
    }
    update(node) {
      this.node=node;this.$('[data-state]').textContent=node.state;this.$('[data-state]').dataset.state=node.state;
      this.$('[data-detail]').textContent=node.detail;this.$('[data-target]').textContent=`${node.slot} · ${node.hostname||'尚未取得 hostname'} · ${node.os_ip}`;
      this.$('[data-time]').textContent='最後確認 '+time(node.checked_at);
      this.$('[data-enable]').disabled=active(node.job)||!node.configured;
      this.$('[data-enable]').textContent=active(node.job)?'啟用處理中…':'啟用 Telemetry';
      this.$('[data-enable]').hidden=node.state==='READY';
      this.$('[data-notice]').textContent=node.configured?'啟用只針對所選節點。關閉紀錄或離開頁面不會停止作業。':'中央監控連線尚未設定；原有效能資料仍可使用。';
      if(node.job?.job_id!==this.job?.job_id){this.resetLog();this.requestKey=null;}
      this.job=node.job;this.$('[data-console]').hidden=!this.job;
      if(this.job){this.$('[data-job]').textContent='JOB / '+this.job.job_id.slice(0,8);this.$('[data-download]').href='/api/telemetry/jobs/'+encodeURIComponent(this.job.job_id)+'/log';
        this.$('[data-console-target]').textContent=`${node.slot} · ${node.hostname||node.os_ip} · Read-only`;
        this.$('[data-session]').textContent=this.job.state==='PROVISIONING'?'RUNNING':this.job.state;
        this.$('[data-session]').dataset.state=this.job.state;
        this.$('[data-stage]').textContent=stage(this.job.current_step);
        this.$('[data-log-date]').textContent=time(this.job.created_at).split(' ')[0];}
      this.dashboard(node);
    }
    dashboard(node) {
      const container=this.$('.tp-dashboard'),link=this.$('[data-grafana]');
      if(node.state!=='READY'||!node.dashboard_url){container.hidden=true;link.hidden=true;return;}
      const url=new URL(node.dashboard_url,location.origin);if(!['http:','https:'].includes(url.protocol))return;
      const theme=document.documentElement.dataset.theme||'light';url.searchParams.set('theme',theme);
      link.href=url.href;link.hidden=false;container.hidden=false;
      let frame=container.querySelector('iframe');
      if(!frame){const hint=document.createElement('p');hint.textContent='圖表由 Grafana 提供。若未顯示，請使用「開啟監控圖表」確認登入狀態。';frame=document.createElement('iframe');frame.title='所選節點的 Grafana Telemetry';frame.loading='lazy';container.replaceChildren(hint,frame);}
      if(frame.src!==url.href)frame.src=url.href;
    }
    async enable() {
      if(!this.node||active(this.job))return;
      const node=this.node,generation=++this.generation;clearTimeout(this.timer);this.$('[data-enable]').disabled=true;this.requestKey ||= key();
      try {
        const job=await this.request('/nodes/'+encodeURIComponent(node.node_id)+'/enable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:this.requestKey,expected_binding_revision:node.binding_revision})});
        if(this.closed||generation!==this.generation)return;
        this.update({...node,state:'PROVISIONING',detail:'啟用作業已排入背景執行。',job});
        this.consoleOpen=true;this.$('.tp-console').hidden=false;clearTimeout(this.timer);this.poll(generation);
      }catch(error){if(generation===this.generation){this.error(error);this.$('[data-enable]').disabled=false;}}
    }
    async pollEvents() {
      if(!this.consoleOpen||!this.job||this.eventsBusy||this.closed)return;
      const id=this.job.job_id,generation=this.generation;this.eventsBusy=true;
      try {
        // A bounded batch per tick; continued backlog reads do not redownload history.
        const data=await this.request('/jobs/'+encodeURIComponent(id)+'/events?after_seq='+this.cursor+'&limit=500');
        if(this.closed||generation!==this.generation||this.job?.job_id!==id)return;
        for(const row of data.events){if(row.sequence<=this.cursor)continue;if(row.sequence!==this.cursor+1){this.cursor=0;this.rows=[];this.$('[data-connection]').textContent='紀錄序號中斷，正在重新取得。';return;}this.rows.push(row);this.cursor=row.sequence;}
        this.rows=this.rows.slice(-2000);this.$('[data-connection]').textContent=data.has_more?'正在補讀較早紀錄…':active(data.job)?'已連線 · 唯讀':'紀錄已更新 · '+data.job.state;
        if(!this.paused)this.renderLog();
        if(data.has_more)setTimeout(()=>this.pollEvents(),50);
      }catch(error){if(!this.closed)this.$('[data-connection]').textContent='連線中斷，將從最後序號重新連線。';}
      finally{if(generation===this.generation)this.eventsBusy=false;}
    }
    resetLog(){
      this.cursor=0;this.rows=[];this.viewLines=[];this.pauseRows=[];this.paused=false;this.follow=true;
      this.$('.tp-log').replaceChildren();this.$('[data-search]').value='';this.$('[data-latest]').hidden=true;this.pauseState();this.followState();
    }
    pauseState(){this.$('[data-pause]').textContent=this.paused?'繼續顯示':'暫停顯示';this.$('[data-pause]').setAttribute('aria-pressed',String(this.paused));}
    visible(){const query=this.$('[data-search]').value.toLocaleLowerCase();return (this.paused?this.pauseRows:this.rows).filter(row=>this.line(row).toLocaleLowerCase().includes(query));}
    line(row){return `${time(row.timestamp)} [${row.level}] [${stage(row.step)}] ${row.message}`;}
    renderLog() {
      const log=this.$('.tp-log'),top=log.scrollTop;const fragment=document.createDocumentFragment(),visible=this.visible();
      for(const row of visible){const line=document.createElement('div');line.className='tp-log-row';line.dataset.level=row.level;
        const seq=document.createElement('span'),stamp=document.createElement('time'),level=document.createElement('b'),phase=document.createElement('span'),text=document.createElement('span');
        seq.className='tp-seq';seq.textContent=String(row.sequence).padStart(3,'0');stamp.textContent=clock(row.timestamp);stamp.title=time(row.timestamp)+' UTC+8';stamp.dateTime=new Date(row.timestamp*1000).toISOString();
        level.textContent=row.level;phase.className='tp-phase';phase.textContent=stage(row.step);text.className='tp-message';text.textContent=row.message;line.append(seq,stamp,level,phase,text);fragment.append(line);}
      // Selection must remain intact while a user copies the current log.
      const selection=getSelection();if(selection?.anchorNode&&log.contains(selection.anchorNode)&&!selection.isCollapsed)return;
      log.replaceChildren(fragment);this.viewLines=visible.map(row=>this.line(row));if(this.follow)this.bottom();else{log.scrollTop=top;this.$('[data-latest]').hidden=false;}
    }
    bottom(){const log=this.$('.tp-log');log.scrollTop=log.scrollHeight;this.$('[data-latest]').hidden=true;}
    followState(){this.$('[data-follow]').textContent='自動跟隨：'+(this.follow?'開':'關');this.$('[data-follow]').setAttribute('aria-pressed',String(this.follow));}
    error(error){if(error.name==='AbortError'||this.closed)return;this.$('[data-detail]').textContent=error.message;this.$('[data-state]').textContent='連線未完成';}
    dispose(){
      if(this.node)lastView={name:this.name,nodeId:this.node.node_id,jobId:this.job?.job_id,rows:this.rows,cursor:this.cursor,open:this.consoleOpen,follow:this.follow,paused:this.paused,pauseRows:this.pauseRows,search:this.$('[data-search]').value,top:this.$('.tp-log').scrollTop};
      this.closed=true;clearTimeout(this.timer);this.abort.abort();
    }
  }
  window.TelemetryProvision={
    card:(name,slot)=>`<section class="tp-workspace p-surface" data-system="${esc(name)}" data-slot="${slot==null?'':'N'+Number(slot)}" aria-label="Node Telemetry"></section>`,
    mount(){const root=document.querySelector('#pd-panel-telemetry:not([hidden]) .tp-workspace');if(current?.root===root)return;current?.dispose();current=root?new View(root):null;},
    dispose(){current?.dispose();current=null;}
  };
})();
