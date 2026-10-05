/* Per-node Node Exporter / DCGM Exporter provisioning and read-only job log. */
(() => {
  'use strict';
  const time = value => value ? new Date(value * 1000).toLocaleString('zh-TW', {timeZone:'Asia/Taipei',hour12:false}) : '尚未確認';
  const clock = value => new Date(value * 1000).toLocaleTimeString('en-GB',{timeZone:'Asia/Taipei',hour12:false});
  const stage = value => ({QUEUED:'排程',IDENTITY:'身分確認',DETECT:'Exporter',INSTALL:'安裝',START:'服務',EXPORTER:'指標',REGISTER:'監控註冊',VERIFY:'驗證',READY:'就緒',ERROR:'錯誤',INTERRUPTED:'中斷',DEGRADED:'需要處理',UNREACHABLE:'連線'}[value] || value || '系統');
  const active = job => job && ['QUEUED','PROVISIONING'].includes(job.state);
  const key = () => globalThis.crypto?.randomUUID?.() || `telemetry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const scopeName = scope => ({host:'Node Exporter',gpu:'DCGM Exporter',all:'Telemetry'}[scope] || 'Telemetry');
  const scopeTitle = scope => `${scopeName(scope)} 啟用紀錄`;
  const stateLabel = value => ({READY:'已就緒',NOT_CONFIGURED:'尚未啟用',PROVISIONING:'啟用中',DEGRADED:'需要處理',ERROR:'啟用失敗',UNREACHABLE:'無法連線',INTERRUPTED:'作業中斷',NOT_APPLICABLE:'不適用',VERIFYING:'驗證中'}[value] || value || '尚未檢查');
  let current,lastView;
  const choices=new Map();

  class View {
    constructor(root) {
      this.root=root;this.abort=new AbortController();this.cursor=0;this.rows=[];this.follow=true;this.pipeline={};this.unread=0;
      this.closed=false;this.consoleOpen=false;this.name=root.dataset.system;this.node=null;this.job=null;
      root.innerHTML=`<header class="tp-heading"><div><h3>節點遙測 <span data-state class="tp-state">載入中</span></h3><p data-detail aria-live="polite">正在取得節點設定…</p></div><label class="tp-node">監控節點<select aria-label="Telemetry 節點" data-node><option value="">選擇節點</option></select></label></header>
        <div class="tp-context"><span data-target></span><span data-time></span></div>
        <div class="tp-components">
          <section class="tp-component" data-component="host"><div><span class="tp-kicker">HOST</span><h4>主機監控 · Node Exporter</h4><p>CPU / Memory / Disk / Network</p></div><strong data-component-state>尚未檢查</strong><div class="tp-component-actions"><button class="btn primary" data-enable-scope="host" disabled>安裝 / 啟用</button><details><summary>手動安裝說明</summary><div class="tp-manual" data-host-manual><p>請先選擇節點以取得此節點的安裝與連線資訊。</p></div></details></div></section>
          <section class="tp-component" data-component="gpu"><div><span class="tp-kicker">GPU</span><h4>GPU 監控 · DCGM Exporter</h4><p>GPU / HBM / Temperature / Power / NVLink</p></div><strong data-component-state>尚未檢查</strong><div class="tp-component-actions"><button class="btn primary" data-enable-scope="gpu" disabled>安裝 / 啟用</button><details><summary>手動安裝說明</summary><div class="tp-manual" data-gpu-manual><p>請先選擇節點以取得相容的 DCGM Exporter 設定。</p></div></details></div></section>
        </div>
        <div class="tp-actions"><button class="btn" data-console hidden>查看安裝紀錄</button><a class="btn" data-grafana hidden target="_blank" rel="noopener" title="開啟此節點的 Grafana 進階分析">Grafana 進階分析 ↗</a></div>
        <p class="tp-note" data-notice>安裝與啟用只針對所選節點；Host 與 GPU 監控可獨立處理。</p>
        <dialog class="tp-console pa-validation-console" aria-label="Telemetry 啟用紀錄" aria-modal="true"><header><div class="tp-console-title"><h4 data-console-title>Telemetry 啟用紀錄</h4><p data-console-target>唯讀啟用紀錄</p></div><span class="tp-session" data-session>IDLE</span><span data-job></span><button class="tp-close" data-close type="button" aria-label="關閉啟用紀錄">×</button></header>
          <div class="tp-pipeline" aria-label="啟用階段"></div><div class="tp-runline"><span>目前階段 <strong data-stage>排程</strong></span><span data-log-date></span><span>台北 / UTC+8</span></div>
          <div class="tp-tools"><a class="btn" data-download>下載完整紀錄</a></div>
          <div class="tp-log-columns" aria-hidden="true"><span>TIME</span><span>STATE</span><span>STAGE</span><span>EVENT</span></div>
          <div class="tp-log" role="log" tabindex="0" aria-live="off" aria-label="唯讀啟用紀錄，台灣時間 UTC+8"></div><footer><span data-connection>正在連線</span><button class="btn" data-latest hidden>跳至最新</button><span>UTC+8 · 最近 2,000 筆</span></footer>
          <div class="tp-outcome" hidden><strong data-outcome-title></strong><p data-outcome-detail></p><div class="tp-outcome-actions"><button class="btn primary" data-view>查看 Telemetry</button><button class="btn" data-retry>重新嘗試</button></div></div>
        </dialog><div class="tp-dashboard" hidden></div>`;
      this.$=selector=>root.querySelector(selector);
      this.$('[data-node]').onchange=()=>this.select(this.$('[data-node]').value);
      root.querySelectorAll('[data-enable-scope]').forEach(button=>button.onclick=()=>this.enable(button.dataset.enableScope));
      this.$('[data-console]').onclick=()=>this.openConsole();
      this.$('[data-close]').onclick=()=>this.closeConsole();
      this.$('[data-view]').onclick=()=>{this.closeConsole();this.$('.tp-dashboard').scrollIntoView({block:'start',behavior:'smooth'});};
      this.$('[data-retry]').onclick=()=>{this.requestKey=null;this.enable(this.job?.scope||'all');};
      this.$('[data-latest]').onclick=()=>{this.follow=true;this.renderLog();this.bottom();};
      this.$('.tp-log').onscroll=()=>this.onScroll();
      this.$('.tp-console').addEventListener('cancel',event=>{event.preventDefault();this.closeConsole();});
      this.$('.tp-console').addEventListener('keydown',event=>{
        if(event.key!=='Tab')return;
        const controls=[...this.$('.tp-console').querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      });
      this.load();
    }
    openConsole(){
      if(!this.$('.tp-console').open){this.restoreFocus=document.activeElement;this.$('.tp-console').showModal();this.$('[data-close]').focus();}
      this.consoleOpen=true;this.renderPipeline(this.job);this.pollEvents();
    }
    closeConsole(){
      this.consoleOpen=false;
      if(this.$('.tp-console').open)this.$('.tp-console').close();
      if(this.restoreFocus?.isConnected&&!this.restoreFocus.disabled&&!this.restoreFocus.hidden)this.restoreFocus.focus();
      else this.$('[data-node]').focus();
    }
    onScroll(){
      const log=this.$('.tp-log'),atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<=30;
      this.follow=atBottom;
      if(atBottom){this.unread=0;this.$('[data-latest]').hidden=true;}
    }
    observeStage(row){
      const phase=row.step.startsWith('GPU_')?'GPU':{IDENTITY:'Identity',DETECT:'Exporter',INSTALL:'Service',START:'Service',EXPORTER:'Metrics',REGISTER:'Prometheus',VERIFY:'Prometheus',READY:'Ready'}[row.step];
      if(!phase)return;
      if(phase==='Service')this.pipeline.Exporter='PASS';
      this.pipeline[phase]=row.level==='PASS'&&row.step!=='REGISTER'?'PASS':['FAIL','ERROR'].includes(row.level)?'FAIL':row.level==='WARN'?'WARN':this.pipeline[phase]==='PASS'?'PASS':'ACTIVE';
    }
    renderPipeline(job){
      const scope=job?.scope||'all';
      const phases=scope==='gpu'?['Identity','GPU','Ready']:scope==='host'?['Identity','Exporter','Service','Metrics','Prometheus','Ready']:['Identity','Exporter','Service','Metrics','Prometheus','GPU','Ready'];
      const failed=job&&!active(job)&&job.state!=='READY';
      const current=job?.current_step?.startsWith('GPU_')?'GPU':{IDENTITY:'Identity',DETECT:'Exporter',INSTALL:'Service',START:'Service',EXPORTER:'Metrics',REGISTER:'Prometheus',VERIFY:'Prometheus'}[job?.current_step];
      const fragment=document.createDocumentFragment();
      for(const phase of phases){
        const el=document.createElement('span'),na=phase==='GPU'&&this.node?.components?.gpu?.state==='NOT_APPLICABLE';
        const state=na?'NOT_APPLICABLE':job?.state==='READY'?'PASS':failed&&phase===current?'FAIL':this.pipeline[phase]||'PENDING';
        el.dataset.state=state;el.textContent=phase+(na?' · N/A':'');el.title=state;el.setAttribute('aria-label',phase+': '+state);fragment.append(el);
      }
      this.$('.tp-pipeline').replaceChildren(fragment);
      const completed=job&&!active(job),name=scopeName(scope),gpuState=this.node?.components?.gpu?.state;
      this.$('.tp-outcome').hidden=!completed;this.$('[data-view]').hidden=job?.state!=='READY';this.$('[data-retry]').hidden=!failed;
      if(completed&&job.state==='READY'){
        this.$('[data-outcome-title]').textContent=`✓ ${name} 已就緒`;
        this.$('[data-outcome-detail]').textContent=scope==='gpu'&&gpuState==='NOT_APPLICABLE'?'此節點未偵測到適用的 GPU；主機監控不受影響。':'Prometheus 已開始接收此節點指標。';
      }else if(completed){
        this.$('[data-outcome-title]').textContent=`✕ ${name} 啟用未完成`;
        this.$('[data-outcome-detail]').textContent=job?.error||this.node?.detail||'請查看完整紀錄後重新嘗試。';
      }
    }
    async request(path,options={}){
      const response=await fetch('/api/telemetry'+path,{...options,signal:this.abort.signal});
      const body=await response.json();if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'無法取得 Telemetry 資料');return body;
    }
    async load(){
      try{
        const {nodes}=await this.request('/systems/'+encodeURIComponent(this.name)+'/nodes');if(this.closed)return;
        this.nodes=nodes;
        for(const node of nodes){const option=document.createElement('option');option.value=node.node_id;option.textContent=`${node.slot} · ${node.hostname||node.os_ip}`;this.$('[data-node]').append(option);}
        const saved=choices.get(this.name);
        const selected=saved?.activeSlot===this.root.dataset.slot?nodes.find(n=>n.node_id===saved.nodeId):nodes.find(n=>n.slot===this.root.dataset.slot);
        if(selected){this.$('[data-node]').value=selected.node_id;this.select(selected.node_id);}
        else{this.$('[data-state]').textContent='選擇節點';this.$('[data-detail]').textContent='請選擇要查看或啟用 Telemetry 的節點。';}
      }catch(error){this.error(error);}
    }
    select(nodeId){
      clearTimeout(this.timer);this.generation=(this.generation||0)+1;this.node=this.nodes.find(n=>n.node_id===nodeId);
      choices.set(this.name,{nodeId,activeSlot:this.root.dataset.slot});this.job=null;this.resetLog();this.requestKey=null;this.eventsBusy=false;this.closeConsole();
      this.$('.tp-dashboard').replaceChildren();this.$('.tp-dashboard').hidden=true;this.native?.dispose();this.native=null;
      if(this.node){
        this.update(this.node);
        if(lastView?.name===this.name&&lastView.nodeId===nodeId){
          if(lastView.jobId===this.job?.job_id){this.pipeline=lastView.pipeline||{};this.rows=lastView.rows;this.cursor=lastView.cursor;this.follow=lastView.follow;this.unread=lastView.unread||0;this.renderLog();if(!this.follow)this.$('.tp-log').scrollTop=lastView.top;}
          if(lastView.open)this.openConsole();
        }
        this.poll(this.generation);
      }else this.setButtons(true);
    }
    async poll(generation){
      if(this.closed||generation!==this.generation)return;
      try{const node=await this.request('/nodes/'+encodeURIComponent(this.node.node_id));if(generation!==this.generation||this.closed)return;this.update(node);await this.pollEvents();}
      catch(error){this.error(error);}
      if(!this.closed&&generation===this.generation)this.timer=setTimeout(()=>this.poll(generation),active(this.job)?1500:15000);
    }
    setButtons(disabled=false){
      const busy=active(this.job),configured=this.node?.configured;
      const host=this.root.querySelector('[data-enable-scope="host"]'),gpu=this.root.querySelector('[data-enable-scope="gpu"]');
      host.disabled=disabled||busy||!configured;gpu.disabled=disabled||busy||!configured;
      host.textContent=busy&&this.job?.scope==='host'?'啟用中…':this.node?.components?.host==='READY'?'重新檢查':'安裝 / 啟用';
      const gpuState=this.node?.components?.gpu?.state;
      gpu.textContent=busy&&this.job?.scope==='gpu'?'啟用中…':gpuState==='READY'?'重新檢查':gpuState==='NOT_APPLICABLE'?'不適用':'安裝 / 啟用';gpu.hidden=gpuState==='NOT_APPLICABLE';
    }
    manualHelp(node){
      const p=t=>{const el=document.createElement('p');el.textContent=t;return el;};
      const pre=t=>{const el=document.createElement('pre');el.textContent=t;return el;};
      const link=(t,h)=>{const a=document.createElement('a');a.href=h;a.target='_blank';a.rel='noopener';a.textContent=t;return a;};
      const hostBox=this.$('[data-host-manual]'),gpuBox=this.$('[data-gpu-manual]');
      const host=node?.host_setup||{},gpu=node?.gpu_setup||{};
      if(hostBox){
        const rows=[];
        if(!node){rows.push(p('請先選擇節點以取得此節點的安裝與連線資訊。'));}
        else{
          rows.push(p('1. 於節點確認作業系統與 systemd 版本：'),pre(host.detection||''));
          rows.push(p('2. 若尚未安裝，使用系統套件安裝並啟用 Node Exporter。既有安裝請沿用，不需重複建立：'),pre(host.installation||''));
          rows.push(p('3. 於節點本機確認 /metrics 可讀取：'),pre(host.check_on_node||''));
          rows.push(p('4. 於 PA Manager（中央 Prometheus 主機：'+(host.prometheus_url||'尚未設定')+'）確認可讀取採集端點 '+(host.exporter_url||'')+'：'),pre(host.check_on_manager||''));
          rows.push(p('5. 回到本頁按上方「安裝 / 啟用」。PA 會沿用健康的 Exporter，將此節點登記至中央 Prometheus，再確認指標。'));
          rows.push(p('注意：平台不會停止未知服務、不會自動取代既有的健康安裝，也不會更動其他監控設定。'));
        }
        hostBox.replaceChildren(...rows);
      }
      if(gpuBox){
        const rows=[];
        if(!node){rows.push(p('請先選擇節點以取得相容的 DCGM Exporter 設定。'));}
        else{
          rows.push(pre('先確認 NVIDIA Driver 與 Docker 已就緒，再依平台相容版本以容器方式啟用 DCGM Exporter。既有服務請沿用，勿重複建立或停止占用連接埠的其他程式。'));
          rows.push(p('1. 於 GPU 節點確認 NVIDIA 驅動與 Docker 是否就緒（CPU-only 節點無須安裝）：'),pre(gpu.detection||''));
          rows.push(p('2. 確認 NVIDIA Container Toolkit 是否已安裝，並檢查 Docker 是否已載入 nvidia runtime（第 1 步 docker info 輸出若未列出 "nvidia"，表示尚未載入）：'),pre(gpu.runtime_check||'nvidia-ctk --version'));
          if(!gpu.image)rows.push(p('尚未指定固定版本映像，請先選擇與 GPU／驅動相容的版本並替換映像欄位。'));
          rows.push(p('3. 若 Docker 尚未載入 nvidia runtime，先安裝 Toolkit 並重新載入 Docker daemon。注意：重新啟動 Docker 會暫時中斷所有執行中的容器，請於維護時段執行：'),pre(gpu.runtime_prepare||''));
          rows.push(p('4. 確認 docker info 已列出 nvidia runtime 後，以容器方式啟動 DCGM Exporter。此步驟不會替換驅動，亦不會停止占用連接埠的其他服務：'),pre(gpu.installation||''));
          if(gpu.toolkit_documentation)rows.push(link('NVIDIA Container Toolkit 安裝說明 ↗',gpu.toolkit_documentation));
          if(gpu.documentation)rows.push(link('NVIDIA DCGM Exporter 安裝說明 ↗',gpu.documentation));
          rows.push(p('5. 於 PA Manager（中央 Prometheus 主機：'+(gpu.prometheus_url||'尚未設定')+'）確認可讀取採集端點 '+(gpu.exporter_url||'')+'：'),pre(gpu.check_on_manager||''));
          rows.push(p('6. 回到本頁按上方「安裝 / 啟用」。PA 會沿用健康的 Exporter，將此節點登記至中央 Prometheus，再確認指標。'));
        }
        gpuBox.replaceChildren(...rows);
      }
    }
    update(node){
      this.node=node;this.$('[data-state]').textContent=stateLabel(node.state);this.$('[data-state]').dataset.state=node.state;
      this.$('[data-detail]').textContent=node.state==='NOT_CONFIGURED'?'此節點尚未連接中央效能監控。Host 與 GPU 監控可分別啟用。':node.detail;
      this.$('[data-target]').textContent=`${node.slot} · ${node.hostname||'尚未取得 hostname'} · ${node.os_ip}`;this.$('[data-time]').textContent='最後確認 '+time(node.checked_at);
      const host=node.components?.host||'NOT_CONFIGURED',gpu=node.components?.gpu||{state:'NOT_CONFIGURED'};
      const hostCard=this.root.querySelector('[data-component="host"]'),gpuCard=this.root.querySelector('[data-component="gpu"]');
      hostCard.querySelector('[data-component-state]').textContent=stateLabel(host);hostCard.dataset.state=host;
      gpuCard.querySelector('[data-component-state]').textContent=stateLabel(gpu.state);gpuCard.dataset.state=gpu.state;
      this.manualHelp(node);
      this.$('[data-notice]').textContent=node.configured?'安裝與啟用只針對所選節點。關閉紀錄或離開頁面不會停止作業。':'中央監控連線尚未設定；既有效能資料仍可使用。';
      if(node.job?.job_id!==this.job?.job_id){this.resetLog();this.requestKey=null;}
      this.job=node.job;this.$('[data-console]').hidden=!this.job;
      if(this.job){
        this.$('[data-job]').textContent='JOB / '+this.job.job_id.slice(0,8);this.$('[data-download]').href='/api/telemetry/jobs/'+encodeURIComponent(this.job.job_id)+'/log';
        this.$('[data-console-title]').textContent=scopeTitle(this.job.scope||'all');
        this.$('[data-console-target]').textContent=`${this.name} / ${node.slot} · ${node.hostname||'—'} · ${node.os_ip} · 唯讀紀錄`;
        this.$('[data-session]').textContent=this.job.state==='PROVISIONING'?'RUNNING':this.job.state;this.$('[data-session]').dataset.state=this.job.state;
        this.$('[data-stage]').textContent=stage(this.job.state==='READY'?'READY':this.job.current_step);this.$('[data-log-date]').textContent=time(this.job.created_at).split(' ')[0];
      }
      this.renderPipeline(this.job);this.dashboard(node);this.setButtons();
    }
    dashboard(node){
      const container=this.$('.tp-dashboard'),link=this.$('[data-grafana]');link.hidden=true;
      if(node.dashboard_url){const url=new URL(node.dashboard_url,location.origin);if(['http:','https:'].includes(url.protocol)){url.searchParams.set('theme',document.documentElement.dataset.theme||'light');link.href=url.href;link.hidden=false;}}
      container.hidden=false;
      if(!this.native&&window.PANativeTelemetry)this.native=new PANativeTelemetry.Dashboard(container,node,this.name);else this.native?.update(node);
    }
    async enable(scope){
      if(!this.node||active(this.job))return;
      this.$('[data-console-title]').textContent=scopeTitle(scope);this.openConsole();this.$('[data-session]').textContent='CONNECTING';
      const node=this.node,generation=++this.generation;clearTimeout(this.timer);this.setButtons(true);this.requestKey ||= key();
      try{
        const job=await this.request('/nodes/'+encodeURIComponent(node.node_id)+'/enable',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:this.requestKey,expected_binding_revision:node.binding_revision,scope})});
        if(this.closed||generation!==this.generation)return;
        this.update({...node,state:'PROVISIONING',detail:'啟用作業已排入背景執行。',job});clearTimeout(this.timer);this.poll(generation);
      }catch(error){if(generation===this.generation){this.error(error);this.setButtons();}}
    }
    async pollEvents(){
      if(!this.consoleOpen||!this.job||this.eventsBusy||this.closed)return;
      const id=this.job.job_id,generation=this.generation;this.eventsBusy=true;
      try{
        const data=await this.request('/jobs/'+encodeURIComponent(id)+'/events?after_seq='+this.cursor+'&limit=500');
        if(this.closed||generation!==this.generation||this.job?.job_id!==id)return;
        for(const row of data.events){
          if(row.sequence<=this.cursor)continue;
          if(row.sequence!==this.cursor+1){this.cursor=0;this.rows=[];this.$('[data-connection]').textContent='紀錄序號中斷，正在重新取得。';return;}
          this.rows.push(row);this.cursor=row.sequence;if(!this.follow)this.unread++;this.observeStage(row);
        }
        this.rows=this.rows.slice(-2000);this.$('[data-connection]').textContent=data.has_more?'正在補讀較早紀錄…':active(data.job)?'已連線 · 唯讀':'紀錄已更新 · '+data.job.state;
        this.renderPipeline(data.job);this.renderLog();if(data.has_more)setTimeout(()=>this.pollEvents(),50);
      }catch(error){if(!this.closed)this.$('[data-connection]').textContent='連線中斷，將從最後序號重新連線。';}
      finally{if(generation===this.generation)this.eventsBusy=false;}
    }
    resetLog(){this.pipeline={};this.unread=0;this.cursor=0;this.rows=[];this.follow=true;this.$('.tp-log').replaceChildren();this.$('[data-latest]').hidden=true;}
    line(row){return `${time(row.timestamp)} [${row.level}] [${stage(row.step)}] ${row.message}`;}
    renderLog(){
      const log=this.$('.tp-log'),top=log.scrollTop,fragment=document.createDocumentFragment();
      for(const row of this.rows){
        const line=document.createElement('div');line.className='tp-log-row';line.dataset.level=row.level;
        const stamp=document.createElement('time'),level=document.createElement('b'),phase=document.createElement('span'),message=document.createElement('span');
        stamp.textContent=clock(row.timestamp);stamp.title=time(row.timestamp)+' UTC+8';stamp.dateTime=new Date(row.timestamp*1000).toISOString();level.textContent=row.level;phase.className='tp-phase';phase.textContent=stage(row.step);message.className='tp-message';message.textContent=row.message;line.append(stamp,level,phase,message);fragment.append(line);
      }
      const selection=getSelection();if(selection?.anchorNode&&log.contains(selection.anchorNode)&&!selection.isCollapsed)return;
      log.replaceChildren(fragment);
      if(this.follow)this.bottom();else{log.scrollTop=top;this.$('[data-latest]').hidden=!this.unread;this.$('[data-latest]').textContent=`${this.unread} 筆新紀錄 · 跳至最新`;}
    }
    bottom(){this.unread=0;const log=this.$('.tp-log');log.scrollTop=log.scrollHeight;this.$('[data-latest]').hidden=true;}
    error(error){if(error.name==='AbortError'||this.closed)return;this.$('[data-detail]').textContent=error.message;this.$('[data-state]').textContent='連線未完成';}
    dispose(){
      if(this.node)lastView={name:this.name,nodeId:this.node.node_id,jobId:this.job?.job_id,pipeline:this.pipeline,rows:this.rows,cursor:this.cursor,open:this.consoleOpen,follow:this.follow,unread:this.unread,top:this.$('.tp-log').scrollTop};
      if(this.$('.tp-console').open)this.$('.tp-console').close();this.closed=true;clearTimeout(this.timer);this.abort.abort();this.native?.dispose();
    }
  }
  window.TelemetryProvision={
    card:(name,slot)=>`<section class="tp-workspace p-surface" data-system="${esc(name)}" data-slot="${slot==null?'':'N'+Number(slot)}" aria-label="節點遙測"></section>`,
    mount(){const root=document.querySelector('#pd-panel-telemetry:not([hidden]) .tp-workspace');if(current?.root===root)return;current?.dispose();current=root?new View(root):null;},
    dispose(){current?.dispose();current=null;}
  };
})();
