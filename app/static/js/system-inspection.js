/* One mounted detail surface; polling only reads persisted inspection results. */
(() => {
  'use strict';
  let mounted=null,lastView=null,closeViewerTimer;
  const identityLabels={SUCCESS:'讀取成功',AUTH_FAILED:'登入驗證失敗',MISSING_DATA:'身分資料不完整',IDENTITY_REQUIRES_CONFIRMATION:'Identity 需確認'};
  const stamp=v=>v?new Date(v*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得';
  const valueOrMissing=v=>v != null && v !== '' && Number.isFinite(Number(v))?String(Number(v)):'未取得';
  const labels={EXPECTED_OFFLINE:'Cycle 預期恢復中',FRESH:'資料有效',MISSING:'尚無節點資料',STALE:'資料過舊',UNAVAILABLE:'來源無法使用',NOT_COVERED:'尚未涵蓋',BACKLOG:'事件補讀中',TIMED_OUT:'採集逾時',INVALID:'觀測欄位不完整',FAILED:'採集失敗',PARTIAL:'部分資料／觀測缺口',NOT_READY:'尚未就緒',NOT_CONFIGURED:'尚未設定',NOT_SUPPORTED:'來源不支援',WAITING_READY:'開機恢復中 · 等待檢查',INTERRUPTED:'開機世代改變 · 本批不完整',SHARED:'共用控制器資料',IDENTITY_MISMATCH:'節點身分與設定不符',TRUNCATED:'資料超過採集上限'};
  Object.assign(labels,identityLabels);
  // A capped Redfish LogService is PARTIAL for a specific, actionable reason:
  // the source is healthy but only the newest N entries were kept. Call that out
  // instead of the generic "部分資料／觀測缺口" so operators know nothing is wrong.
  const redfishCap=/kept newest (\d+) entries per service/;
  const coverageLabel=entry=>{
    const detail=String(entry.detail||'');
    const cap=entry.source==='Redfish'&&entry.state==='PARTIAL'&&redfishCap.exec(detail);
    return cap?`已達 ${cap[1]} 筆上限（保留最新）`:labels[entry.state]||entry.state;
  };
  // Render the source more specifically: Redfish covers several LogServices
  // (EventLog/SEL/Journal). Show the ones actually read, collapsing to the
  // first three with a total when there are more than three.
  const sourceLabel=entry=>{
    const services=entry.services||[];
    if(!services.length)return entry.source;
    const shown=services.length>3?`${services.slice(0,3).join('／')}… (共${services.length})`:services.join('／');
    return `${entry.source}（${shown}）`;
  };
  const card=()=>`<section class="pd-inspection p-surface" id="pd-inspection" aria-label="系統巡檢">
    <div class="pd-section-heading"><h2><button type="button" class="pd-inspection-collapse" data-collapse aria-expanded="true" aria-controls="pd-inspection-body" title="收闔系統巡檢"><span class="pd-inspection-caret" aria-hidden="true">▾</span>系統巡檢</button></h2><span data-status role="status">讀取中…</span></div>
    <div class="pd-inspection-body" id="pd-inspection-body">
    <p class="pd-inspection-copy">依專案規格檢查節點硬體、事件與遙測資料，持續追蹤異常與恢復狀態。巡檢僅執行唯讀觀測，不會變更設備電源狀態。</p>
    <div class="pd-inspection-counts"><span data-severity="FAIL">FAIL <strong data-fail>—</strong> 項</span><span data-severity="WARN">WARN <strong data-warning>—</strong> 項</span></div>
    <p class="pd-inspection-meta" data-time>最近完成：尚未取得 · 台灣時間 UTC+8</p>
    <p class="pd-inspection-meta" data-version></p><p class="pd-inspection-meta" data-completeness></p>
    <p class="pd-inspection-meta" data-progress aria-live="polite"></p>
    <p class="pd-inspection-error" data-error role="alert"></p>
    <div class="pd-inspection-actions"><button class="btn" type="button" data-view>查看問題</button><button class="btn" type="button" data-run>立即巡檢</button><button class="pd-text-action" type="button" data-settings>巡檢設定</button></div>
    <details class="pd-inspection-coverage"><summary>資料來源與涵蓋範圍</summary><div data-coverage></div></details>
    <details class="pd-inspection-coverage"><summary>節點名稱與身分紀錄</summary><div data-identity></div><div data-identity-history></div></details>
    <section data-issues hidden aria-label="巡檢問題與恢復歷史"><div class="pd-inspection-filters"><label>節點 <select data-node><option value="">全部節點</option></select></label><label>狀態 <select data-filter><option value="current">目前問題與最近恢復</option><option value="ACTIVE">目前問題</option><option value="RECOVERED">最近恢復</option><option value="ARCHIVED">歷史問題</option><option value="all">全部紀錄</option></select></label><label>搜尋全部符合範圍 <input data-issue-search type="search" placeholder="規則、元件或問題摘要"></label></div><button type="button" class="btn small" data-reload>更新問題</button><span data-history-count></span><div data-list></div><div class="pd-inspection-paging"><button class="btn small" data-prev>上一頁</button><span data-page></span><button class="btn small" data-next>下一頁</button></div></section>
    <form data-config hidden><h3>此系統巡檢設定</h3><p>設定只影響巡檢規則，不會變更 Telemetry 收集頻率。</p><div class="pd-inspection-fields">
      <label><input type="checkbox" name="enabled"> 啟用排程</label><label><input type="checkbox" name="ai_enabled"> 活躍警告與 FAIL 使用 AI 分析</label>
      <label>事件巡檢間隔（秒）<input type="number" name="interval_seconds" min="30" max="3600" required></label>
      <label>完整硬體巡檢間隔（秒）<input type="number" name="deep_seconds" min="60" max="86400" required></label>
      <label>Sensor 採集（秒）<input type="number" name="sensor_seconds" min="30" max="86400" required></label>
      <label>韌體資訊採集（秒）<input type="number" name="firmware_seconds" min="60" max="604800" required></label>
      <label>高使用率持續（秒）<input type="number" name="duration_seconds" min="0" max="3600" required></label>
      <label>恢復所需新樣本<input type="number" name="recovery_samples" min="1" max="20" required></label>
      <label>遙測資料有效期限（秒）<input type="number" name="stale_seconds" min="30" max="3600" required></label>
      <label>恢復遲滯（百分點）<input type="number" name="hysteresis" min="1" max="30" required></label>
      ${['cpu','memory','gpu','vram'].map((key,i)=>`<label>${['CPU','記憶體','GPU','VRAM'][i]} 警告門檻（%）<input type="number" name="${key}" min="1" max="100" required></label>`).join('')}
    </div><p>高使用率僅列警告；請依專案負載設定。AI 內容為輔助判讀，不改變規則判定。</p><button type="submit" class="btn primary">儲存巡檢設定</button></form>
    </div>
  </section>`;
  function dispose(){if(!mounted)return;const ctx=mounted,r=ctx.root;
    lastView={name:ctx.name,offset:ctx.offset,rows:ctx.rows,snapshot:ctx.snapshot,show:!r.querySelector('[data-issues]').hidden,collapsed:r.querySelector('[data-collapse]').getAttribute('aria-expanded')==='false',filter:r.querySelector('[data-filter]').value,search:r.querySelector('[data-issue-search]').value,node:r.querySelector('[data-node]').value,opened:[...r.querySelectorAll('details[data-issue-id][open]')].map(e=>e.dataset.issueId)};
    clearTimeout(ctx.timer);clearTimeout(ctx.aiTimer);clearTimeout(ctx.searchTimer);ctx.abort.abort();mounted=null;
    closeViewerTimer=setTimeout(()=>window.InspectionEvidence?.close(),0);
  }
  function mount(name){
    dispose();const root=document.getElementById('pd-inspection');if(!root)return;
    const ctx={root,name,base:'/api/machine/'+encodeURIComponent(name)+'/inspection',abort:new AbortController(),offset:0,rows:[],snapshot:null,timer:null};mounted=ctx;
    const find=s=>root.querySelector(s);
    if(lastView?.name===name){clearTimeout(closeViewerTimer);ctx.offset=lastView.offset;ctx.rows=lastView.rows;ctx.snapshot=lastView.snapshot;ctx.restoreOpen=lastView.opened;
      find('[data-issues]').hidden=!lastView.show;find('[data-filter]').value=lastView.filter;find('[data-issue-search]').value=lastView.search;
      if(lastView.collapsed){find('[data-collapse]').setAttribute('aria-expanded','false');find('#pd-inspection-body').hidden=true;root.classList.add('pd-inspection-collapsed');}
      if(ctx.snapshot){for(const node of ctx.snapshot.nodes){const o=document.createElement('option');o.value=node.node_id;o.textContent=node.label;find('[data-node]').append(o);}find('[data-node]').value=lastView.node;if(lastView.show)renderIssues(ctx);}
      if(ctx.rows.some(i=>['QUEUED','RUNNING'].includes(i.analysis?.state)))trackAI(ctx);
    }
    find('[data-collapse]').onclick=()=>{
      const body=find('[data-inspection-body]')||document.getElementById('pd-inspection-body');
      const button=find('[data-collapse]');const open=button.getAttribute('aria-expanded')!=='false';
      button.setAttribute('aria-expanded',open?'false':'true');
      if(body)body.hidden=open;
      root.classList.toggle('pd-inspection-collapsed',open);
    };
    find('[data-view]').onclick=async()=>{find('[data-issues]').hidden=!find('[data-issues]').hidden;if(!find('[data-issues]').hidden)await loadIssues(ctx);};
    find('[data-settings]').onclick=()=>{const form=find('[data-config]');form.hidden=!form.hidden;};
    find('[data-run]').onclick=async()=>{try{await request(ctx,'/run',{method:'POST'});find('[data-status]').textContent='巡檢中…';await refresh(ctx);}catch(e){error(ctx,e);}};
    find('[data-config]').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,body={thresholds:{}};
      for(const name of ['enabled','ai_enabled'])body[name]=form.elements[name].checked;
      for(const name of ['interval_seconds','deep_seconds','sensor_seconds','firmware_seconds','duration_seconds','recovery_samples','stale_seconds','hysteresis'])body[name]=Number(form.elements[name].value);
      for(const name of ['cpu','memory','gpu','vram'])body.thresholds[name]=Number(form.elements[name].value);
      const button=form.querySelector('[type=submit]');button.disabled=true;
      try{await request(ctx,'/settings',{method:'PATCH',body:JSON.stringify(body)});form.hidden=true;await refresh(ctx);}catch(e){error(ctx,e);}finally{button.disabled=false;}
    };
    find('[data-reload]').onclick=()=>loadIssues(ctx);
    const filter=()=>{ctx.offset=0;void loadIssues(ctx);};
    find('[data-node]').onchange=filter;find('[data-filter]').onchange=filter;
    find('[data-issue-search]').oninput=()=>{clearTimeout(ctx.searchTimer);ctx.searchTimer=setTimeout(filter,300);};
    find('[data-prev]').onclick=()=>{ctx.offset=Math.max(0,ctx.offset-50);void loadIssues(ctx);};
    find('[data-next]').onclick=()=>{ctx.offset+=50;void loadIssues(ctx);};
    void refresh(ctx);
  }
  async function request(ctx,path,options={}){
    const response=await fetch(ctx.base+path,{...options,headers:{'Content-Type':'application/json'},signal:ctx.abort.signal,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'巡檢請求無法完成');return data;
  }
  function error(ctx,e){if(e.name!=='AbortError'&&ctx.root.isConnected){ctx.root.dataset.sourceState='error';ctx.root.querySelector('[data-error]').textContent=e.message;ctx.root.querySelector('[data-status]').textContent=ctx.snapshot?'更新失敗 · 顯示先前已載入資料':'巡檢資料未載入';}}
  async function refresh(ctx){
    if(mounted!==ctx)return;clearTimeout(ctx.timer);
    try{
      const data=await request(ctx,'');if(mounted!==ctx)return;const changed=ctx.snapshot&&ctx.snapshot.last_completed_at!==data.last_completed_at;ctx.snapshot=data;const r=ctx.root;
      const identitySignature=JSON.stringify([data.nodes,data.identity,data.identity_history]);
      if(ctx.identitySignature!==identitySignature){ctx.identitySignature=identitySignature;
        const hn=(node,role)=>node[role+'_hostname_raw']||node[role+'_hostname']||'';
        const box=r.querySelector('[data-identity]');box.replaceChildren();
        for(const node of data.nodes){const observed=data.identity?.[node.node_id];const p=document.createElement('p');
          p.textContent=`${node.label} · OS ${hn(node,'os')||'尚未取得'} · BMC ${hn(node,'bmc')||'尚未取得'}`;
          if(observed?.sync?.status==='IDENTITY_REQUIRES_CONFIRMATION')p.textContent+=` · Identity 需確認 · ${observed.os_ip||''} / ${observed.bmc_ip||''} · 觀測 OS ${observed.os_hostname_raw||observed.os_hostname||'無資料'} / BMC ${observed.bmc_hostname_raw||observed.bmc_hostname||'無資料'} · ${observed.sync.reason} · ${stamp(observed.collected_at)}`;
          else if(observed)p.textContent+=` · OS ${identityLabels[observed.os_status]||labels[observed.os_status]||observed.os_status} · BMC ${identityLabels[observed.bmc_status]||labels[observed.bmc_status]||observed.bmc_status} · ${stamp(observed.collected_at)}`;
          box.append(p);}
        const history=r.querySelector('[data-identity-history]');history.replaceChildren();
        for(const event of [...(data.identity_history||[])].reverse()){const p=document.createElement('p');const node=data.nodes.find(n=>n.node_id===event.node_id);
          // Older events only stored the normalised value; current rows use the raw case.
          const current=event.current||'';
          const prev=event.previous||'';
          const kindLabel={OS_HOSTNAME_CHANGED:'OS Hostname',BMC_HOSTNAME_CHANGED:'BMC Hostname',BOOT_GENERATION_CHANGED:'開機世代'}[event.kind]||event.kind;
          if(!prev)p.textContent=`${stamp(event.observed_at)} · ${node?.label||event.node_id} · ${kindLabel} 初次讀取 · ${current}`;
          else p.textContent=`${stamp(event.observed_at)} · ${node?.label||event.node_id} · ${kindLabel} 已變更 · ${prev} → ${current}`;
          history.append(p);}
        if(!history.childNodes.length)history.textContent='尚無名稱或開機世代變更紀錄。';
      }
      if(changed&&!r.querySelector('[data-issues]').hidden)r.querySelector('[data-reload]').textContent='有新結果 · 更新問題';
      r.dataset.sourceState=data.error?'error':'ready';r.querySelector('[data-error]').textContent=data.error||'';
      r.querySelector('[data-status]').textContent=data.delayed?'採集時間較長 · 仍在處理':data.running?'採集中…':data.config.enabled?`已啟用 · Fast ${data.config.interval_seconds}s / Deep ${data.config.deep_seconds||600}s`:'排程未啟用';
      r.querySelector('[data-run]').disabled=!!data.running;
      r.querySelector('[data-fail]').textContent=valueOrMissing(data.summary?.fail);r.querySelector('[data-warning]').textContent=valueOrMissing(data.summary?.warning);
      const summary=r.closest('.pd-workspace')?.querySelector('[data-health-summary]');
      if(summary)summary.textContent=`${valueOrMissing(data.summary?.fail)} FAIL · ${valueOrMissing(data.summary?.warning)} Warning`;
      r.querySelector('[data-history-count]').textContent=`最近恢復 ${valueOrMissing(data.lifecycle_counts?.recovered)} · 歷史問題 ${valueOrMissing(data.lifecycle_counts?.archived)}`;
      r.querySelector('[data-time]').textContent='最近 Fast：'+stamp(data.last_fast_at||data.last_completed_at)+' · Deep：'+stamp(data.last_deep_at)+' · UTC+8';
      r.querySelector('[data-version]').textContent='Project Checker：'+(data.checker_hash?data.checker_hash.slice(0,12):'未設定')+' · 共用核心：'+(data.shared_core_version?data.shared_core_version.slice(0,12):'尚未採集');
      r.querySelector('[data-progress]').textContent=data.running?(data.progress||[]).map(p=>(data.nodes.find(n=>n.node_id===p.node_id)?.label||p.node_id)+' · '+p.source+' · '+(p.state==='COLLECTING'?'採集中':labels[p.state]||p.state)).join(' ／ '):'';
      const required=(data.coverage||[]).filter(c=>!c.source.startsWith('Input '));
      const fresh=required.filter(c=>c.state==='FRESH'||c.state==='SHARED');
      r.querySelector('[data-completeness]').textContent=`${data.nodes.length} 個節點 · ${fresh.length} / ${required.length} 項來源資料有效。請連同涵蓋狀態判讀異常數量。`;
      const coverage=r.querySelector('[data-coverage]');
      const signature=JSON.stringify(data.coverage||[]);
      if(ctx.coverageSignature!==signature){ctx.coverageSignature=signature;coverage.replaceChildren();
      for(const entry of required){const line=document.createElement('p');const node=data.nodes.find(n=>n.node_id===entry.node_id);line.textContent=[node?.label,sourceLabel(entry),coverageLabel(entry),entry.collected_at?'採集 '+stamp(entry.collected_at):'',entry.duration!=null?entry.duration.toFixed(1)+' 秒':'',entry.detail].filter(Boolean).join(' · ');if(entry.evidence_ref?.snapshot_id){const link=document.createElement('button');link.type='button';link.className='pd-text-action';link.textContent=' 原始證據';link.onclick=()=>window.InspectionEvidence.open(ctx.base,entry.evidence_ref.snapshot_id,node?.label||entry.source);line.append(link);}coverage.append(line);}}
      if(!coverage.childNodes.length)coverage.textContent='尚未巡檢。零項異常不代表所有節點均已完成檢查。';
      const select=r.querySelector('[data-node]');if(select.options.length===1)for(const node of data.nodes){const option=document.createElement('option');option.value=node.node_id;option.textContent=node.label;select.append(option);}
      const form=r.querySelector('[data-config]');if(form.hidden){for(const [name,value] of Object.entries(data.config)){if(name==='thresholds'){for(const [metric,threshold] of Object.entries(value))form.elements[metric].value=threshold;}else if(form.elements[name]){if(typeof value==='boolean')form.elements[name].checked=value;else form.elements[name].value=value;}}}
      // Preserve expanded evidence, keyboard focus and text selection during periodic refresh.
      if(!r.querySelector('[data-issues]').hidden&&!r.querySelector('[data-list]').childNodes.length)await loadIssues(ctx);
    }catch(e){error(ctx,e);}finally{if(mounted===ctx)ctx.timer=setTimeout(()=>refresh(ctx),5000);}
  }
  function issueQuery(ctx){const r=ctx.root;return '/issues?'+new URLSearchParams({offset:ctx.offset,limit:50,status:r.querySelector('[data-filter]').value,node_id:r.querySelector('[data-node]').value,search:r.querySelector('[data-issue-search]').value});}
  async function loadIssues(ctx){try{const data=await request(ctx,issueQuery(ctx));if(mounted!==ctx)return;ctx.rows=data.issues;ctx.root.querySelector('[data-reload]').textContent='更新問題';renderIssues(ctx);if(ctx.rows.some(i=>['QUEUED','RUNNING'].includes(i.analysis?.state)))trackAI(ctx);}catch(e){error(ctx,e);}}
  function trackAI(ctx){
    if(ctx.aiTimer)return;ctx.aiUntil=Date.now()+180000;ctx.aiDelay=1500;
    const poll=async()=>{ctx.aiTimer=null;if(mounted!==ctx)return;if(Date.now()>ctx.aiUntil){ctx.root.querySelector('[data-reload]').textContent='分析仍在處理 · 更新問題';return;}let pending=true;
      try{const data=await request(ctx,issueQuery(ctx));if(mounted!==ctx)return;pending=data.issues.some(i=>['QUEUED','RUNNING'].includes(i.analysis?.state));
        for(const issue of data.issues){const saved=ctx.rows.find(i=>i.id===issue.id);if(saved)saved.analysis=issue.analysis;const card=[...ctx.root.querySelectorAll('[data-issue-id]')].find(c=>c.dataset.issueId===issue.id);if(card)renderAI(card.querySelector('.pd-ai'),issue.analysis);}
      }catch(e){error(ctx,e);}if(pending&&mounted===ctx){ctx.aiDelay=Math.min(10000,ctx.aiDelay*1.4);ctx.aiTimer=setTimeout(poll,ctx.aiDelay);}};
    ctx.aiTimer=setTimeout(poll,ctx.aiDelay);
  }
  function renderAI(root,analysis){
    const signature=JSON.stringify(analysis||{});if(root.dataset.signature===signature)return;root.dataset.signature=signature;root.replaceChildren();
    const state=analysis?.state||'NOT_REQUESTED',header=document.createElement('header'),title=document.createElement('h4'),status=document.createElement('span');title.textContent='AI 輔助判讀';status.dataset.aiState='';status.dataset.state=state;
    status.textContent={NOT_REQUESTED:'尚未分析',QUEUED:'等待分析',RUNNING:'分析中…',COMPLETE:'完成 '+stamp(analysis?.completed_at),UNAVAILABLE:'服務暫時無法使用',ERROR:'分析失敗'}[state]||state;header.append(title,status);root.append(header);
    const result=analysis?.result,text=v=>typeof v==='string'?v.trim():'',list=v=>Array.isArray(v)?v.map(text).filter(Boolean):[];
    if(result&&typeof result==='object'){const sections=document.createElement('div');sections.className='pd-ai-sections';
      for(const [label,values] of [['可能原因',list(result.possible_causes)],['建議檢查',list(result.recommended_checks)]]){if(!values.length)continue;const section=document.createElement('section'),h=document.createElement('h5'),items=document.createElement('ol');h.textContent=label;for(const value of values){const li=document.createElement('li');li.textContent=value;items.append(li);}section.append(h,items);sections.append(section);}
      const conclusion=document.createElement('p');conclusion.className='pd-ai-conclusion';conclusion.textContent='判讀：'+(text(result.conclusion)||'未提供');sections.append(conclusion);
      for(const [label,value,cls] of [['判讀限制 / 確認程度',text(result.confidence_note),'pd-ai-basis'],['分析依據',list(result.based_on).join(' · '),'pd-ai-basis']]){if(!value)continue;const p=document.createElement('p');p.className=cls;p.textContent=label+'：'+value;sections.append(p);}root.append(sections);
    }else if(text(analysis?.text)){const p=document.createElement('p');p.textContent=text(analysis.text);root.append(p);}
    else if(state==='COMPLETE'){const p=document.createElement('p');p.textContent='未提供分析內容。';root.append(p);}
    if(text(analysis?.error)){const p=document.createElement('p'),category=text(analysis.error_category);p.textContent=category?text(analysis.error)+' · '+category:text(analysis.error);root.append(p);}
    if(analysis?.based_on&&typeof analysis.based_on==='object'){const p=document.createElement('p');p.className='pd-ai-basis';p.textContent='依據觀測：'+stamp(analysis.based_on.last_seen_at)+' · '+(text(analysis.based_on.source)||'已保存證據')+'。AI 建議不改變規則判定。';root.append(p);}
  }
  function renderIssues(ctx){
    const r=ctx.root,list=r.querySelector('[data-list]'),opened=new Set([...(ctx.restoreOpen||[]),...[...list.querySelectorAll('details[open]')].map(e=>e.dataset.issueId)]);ctx.restoreOpen=null;list.replaceChildren();
    const rows=ctx.rows;
    if(!rows.length){const p=document.createElement('p');p.textContent='此頁沒有符合條件的問題。請同時查看資料涵蓋狀態。';list.append(p);}
    for(const issue of rows){
      const detail=document.createElement('details');detail.className='pd-inspection-issue';detail.dataset.issueId=issue.id;detail.open=opened.has(issue.id);const summary=document.createElement('summary');summary.className='pd-issue-summary';
      const label=ctx.snapshot.nodes.find(n=>n.node_id===issue.node_id)?.label||((issue.affected_nodes||[]).length?'共用控制器 · '+issue.affected_nodes.map(id=>ctx.snapshot.nodes.find(n=>n.node_id===id)?.label||id).join('、'):issue.node_id);
      detail.dataset.severity=issue.status!=='ACTIVE'?issue.status:issue.severity;
      const ruleLabel={'cpu.utilization.high':'CPU 持續高使用率','memory.utilization.high':'記憶體持續高使用率','gpu.utilization.high':'GPU 持續高使用率','vram.utilization.high':'VRAM 持續高使用率'}[issue.rule]||(issue.rule.startsWith('DMESG_')?'核心日誌硬體錯誤':issue.rule);
      const stateText=issue.status==='ARCHIVED'?'已封存':issue.status==='RECOVERED'?'已恢復':issue.severity==='FAIL'?'FAIL':'WARN';
      const state=document.createElement('strong'),identity=document.createElement('span'),rule=document.createElement('span');state.className='pd-issue-state';state.textContent=stateText;identity.className='pd-issue-identity';identity.textContent=label+' · '+issue.component;rule.className='pd-issue-rule';rule.textContent=ruleLabel;rule.title=issue.rule;summary.append(state,identity,rule);detail.append(summary);
      const facts=document.createElement('section'),factsTitle=document.createElement('h4'),factsBody=document.createElement('p');facts.className='pd-issue-facts';factsTitle.textContent='觀測事實';factsBody.textContent=issue.facts||'未提供';facts.append(factsTitle,factsBody);detail.append(facts);
      const timing=document.createElement('p');timing.className='pd-issue-timing';timing.textContent=`首次 ${stamp(issue.first_seen_at)} · 最後觀測 ${stamp(issue.last_seen_at)} · 恢復 ${issue.resolved_at?stamp(issue.resolved_at):'尚未恢復'} · 發生 ${valueOrMissing(issue.occurrences)} 次 · 觀測 ${valueOrMissing(issue.observations)} 次 · 復發 ${valueOrMissing(issue.recurrences)} 次${issue.occurrence_precision==='uncertain'?' · 來源切換，事件次數未能精確確認':issue.occurrence_precision==='lower_bound'?' · ring buffer 次數為可確認下限':''}`;detail.append(timing);
      const evidence=document.createElement('pre');evidence.className='pd-issue-evidence';evidence.textContent='證據來源：'+(issue.evidence||'未提供');detail.append(evidence);
      if(issue.evidence_ref?.snapshot_id){const button=document.createElement('button');button.type='button';button.className='btn small';button.dataset.evidenceOpen='';button.textContent='查看原始證據';button.onclick=()=>window.InspectionEvidence.open(ctx.base,issue.evidence_ref.snapshot_id,label+' · '+issue.component);detail.append(button);}
      if(issue.evidence_ref?.run_id){const link=document.createElement('a');link.href='#/cycle/runs/'+encodeURIComponent(issue.evidence_ref.run_id);link.textContent='開啟來源任務與證據';detail.append(link);}
      const analysis=document.createElement('section');analysis.className='pd-ai';renderAI(analysis,issue.analysis);detail.append(analysis);
      const actions=document.createElement('div');actions.className='pd-inspection-actions';
      const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){error(ctx,e);}finally{b.disabled=false;}};actions.append(b);};
      const handle=async body=>{await request(ctx,'/issues/'+issue.id,{method:'PATCH',body:JSON.stringify(body)});await loadIssues(ctx);};
      button(issue.acknowledged?'取消知悉':'已知悉',()=>handle({acknowledged:!issue.acknowledged}));
      button(issue.known_issue?'取消已知問題':'標記已知問題',()=>handle({known_issue:!issue.known_issue}));
      button(issue.mute_until>Date.now()/1000?'恢復通知標記':'暫停通知 24 小時',()=>handle({mute_until:issue.mute_until>Date.now()/1000?0:Math.floor(Date.now()/1000)+86400}));
      button('AI 重新分析',async()=>{
        const previous=issue.analysis;issue.analysis={...previous,state:'QUEUED'};renderAI(analysis,issue.analysis);
        try{const result=await request(ctx,'/issues/'+issue.id+'/analyze',{method:'POST'});issue.analysis={...previous,state:result.state};}
        catch(e){if(e.name!=='AbortError')issue.analysis=previous;throw e;}
        finally{const active=mounted;if(active?.name===ctx.name){const saved=active.rows.find(i=>i.id===issue.id);if(saved)saved.analysis=issue.analysis;const card=[...active.root.querySelectorAll('[data-issue-id]')].find(c=>c.dataset.issueId===issue.id);if(card)renderAI(card.querySelector('.pd-ai'),issue.analysis);trackAI(active);}}
      });
      button('查看變更紀錄',async()=>{const data=await request(ctx,'/issues/'+issue.id+'/history');const history=detail.querySelector('[data-history]')||document.createElement('pre');history.dataset.history='';history.textContent=data.history.map(h=>`${stamp(h.at)} · ${{OPENED:'發現問題',OCCURRED:'新增原始事件',RECOVERED:'已恢復',REOPENED:'再次發生',ESCALATED:'嚴重程度升高',HANDLED:'更新處理標記',EVIDENCE_UPDATED:'證據更新'}[h.kind]||h.kind} · ${h.data?.facts||''} ${h.data?.evidence||''}`).join('\n')||'尚無紀錄';detail.append(history);});
      detail.append(actions);list.append(detail);
    }
    r.querySelector('[data-page]').textContent=`第 ${ctx.offset/50+1} 頁 · 搜尋與篩選套用全部符合範圍紀錄`;
    r.querySelector('[data-prev]').disabled=ctx.offset===0;r.querySelector('[data-next]').disabled=ctx.rows.length<50;
  }
  window.SystemInspection={card,mount,dispose};
})();
