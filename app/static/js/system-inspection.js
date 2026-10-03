/* One mounted detail surface; polling only reads persisted inspection results. */
(() => {
  'use strict';
  let mounted=null;
  const stamp=v=>v?new Date(v*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得';
  const labels={FRESH:'資料有效',MISSING:'尚無節點資料',STALE:'資料過舊',UNAVAILABLE:'來源無法使用',NOT_COVERED:'尚未涵蓋',BACKLOG:'歷史證據讀取中',TIMED_OUT:'本輪讀取逾時',INVALID:'觀測欄位不完整'};
  const card=()=>`<section class="pd-inspection p-surface" id="pd-inspection" aria-label="系統巡檢">
    <div class="pd-section-heading"><h2>系統巡檢</h2><span data-status role="status">讀取中…</span></div>
    <p class="pd-inspection-copy">評估此系統所有節點的既有觀測資料。立即巡檢不會執行完整系統診斷。</p>
    <div class="pd-inspection-counts"><span>FAIL <strong data-fail>—</strong> 項</span><span>警告 <strong data-warning>—</strong> 項</span></div>
    <p class="pd-inspection-meta" data-time>最近完成：尚未取得 · 台灣時間 UTC+8</p>
    <p class="pd-inspection-error" data-error role="alert"></p>
    <div class="pd-inspection-actions"><button class="btn" type="button" data-view>查看問題</button><button class="btn" type="button" data-run>立即巡檢</button><button class="pd-text-action" type="button" data-settings>巡檢設定</button></div>
    <details class="pd-inspection-coverage"><summary>資料來源與涵蓋範圍</summary><div data-coverage></div></details>
    <section data-issues hidden aria-label="巡檢問題與恢復歷史"><div class="pd-inspection-filters"><label>節點 <select data-node><option value="">全部節點</option></select></label><label>狀態 <select data-filter><option value="all">活躍與恢復</option><option value="ACTIVE">活躍</option><option value="RECOVERED">已恢復</option></select></label></div><button type="button" class="btn small" data-reload>更新問題</button><div data-list></div><div class="pd-inspection-paging"><button class="btn small" data-prev>上一頁</button><span data-page></span><button class="btn small" data-next>下一頁</button></div></section>
    <form data-config hidden><h3>此系統巡檢設定</h3><p>設定只影響巡檢規則，不會變更 Telemetry 收集頻率。</p><div class="pd-inspection-fields">
      <label><input type="checkbox" name="enabled"> 啟用排程</label><label><input type="checkbox" name="ai_enabled"> 新 FAIL 使用 AI 分析</label>
      <label>間隔（秒）<input type="number" name="interval_seconds" min="30" max="3600" required></label>
      <label>高使用率持續（秒）<input type="number" name="duration_seconds" min="0" max="3600" required></label>
      <label>恢復所需新樣本<input type="number" name="recovery_samples" min="1" max="20" required></label>
      <label>資料有效期限（秒）<input type="number" name="stale_seconds" min="30" max="3600" required></label>
      <label>恢復遲滯（百分點）<input type="number" name="hysteresis" min="1" max="30" required></label>
      ${['cpu','memory','gpu','vram'].map((key,i)=>`<label>${['CPU','記憶體','GPU','VRAM'][i]} 警告門檻（%）<input type="number" name="${key}" min="1" max="100" required></label>`).join('')}
    </div><p>高使用率僅列警告；請依專案負載設定。AI 內容為可能原因，不改變規則判定。第一版不推送外部通知。</p><button type="submit" class="btn primary">儲存巡檢設定</button></form>
  </section>`;
  function dispose(){if(!mounted)return;clearTimeout(mounted.timer);mounted.abort.abort();mounted=null;}
  function mount(name){
    dispose();const root=document.getElementById('pd-inspection');if(!root)return;
    const ctx={root,name,base:'/api/machine/'+encodeURIComponent(name)+'/inspection',abort:new AbortController(),offset:0,rows:[],snapshot:null,timer:null};mounted=ctx;
    const find=s=>root.querySelector(s);
    find('[data-view]').onclick=async()=>{find('[data-issues]').hidden=!find('[data-issues]').hidden;if(!find('[data-issues]').hidden)await loadIssues(ctx);};
    find('[data-settings]').onclick=()=>{const form=find('[data-config]');form.hidden=!form.hidden;};
    find('[data-run]').onclick=async()=>{try{await request(ctx,'/run',{method:'POST'});find('[data-status]').textContent='巡檢中…';await refresh(ctx);}catch(e){error(ctx,e);}};
    find('[data-config]').onsubmit=async e=>{
      e.preventDefault();const form=e.currentTarget,body={thresholds:{}};
      for(const name of ['enabled','ai_enabled'])body[name]=form.elements[name].checked;
      for(const name of ['interval_seconds','duration_seconds','recovery_samples','stale_seconds','hysteresis'])body[name]=Number(form.elements[name].value);
      for(const name of ['cpu','memory','gpu','vram'])body.thresholds[name]=Number(form.elements[name].value);
      const button=form.querySelector('[type=submit]');button.disabled=true;
      try{await request(ctx,'/settings',{method:'PATCH',body:JSON.stringify(body)});form.hidden=true;await refresh(ctx);}catch(e){error(ctx,e);}finally{button.disabled=false;}
    };
    find('[data-reload]').onclick=()=>loadIssues(ctx);
    find('[data-node]').onchange=()=>renderIssues(ctx);find('[data-filter]').onchange=()=>renderIssues(ctx);
    find('[data-prev]').onclick=()=>{ctx.offset=Math.max(0,ctx.offset-50);void loadIssues(ctx);};
    find('[data-next]').onclick=()=>{ctx.offset+=50;void loadIssues(ctx);};
    void refresh(ctx);
  }
  async function request(ctx,path,options={}){
    const response=await fetch(ctx.base+path,{...options,headers:{'Content-Type':'application/json'},signal:ctx.abort.signal,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'巡檢請求無法完成');return data;
  }
  function error(ctx,e){if(e.name!=='AbortError'&&ctx.root.isConnected)ctx.root.querySelector('[data-error]').textContent=e.message;}
  async function refresh(ctx){
    if(mounted!==ctx)return;clearTimeout(ctx.timer);
    try{
      const data=await request(ctx,'');if(mounted!==ctx)return;const changed=ctx.snapshot&&ctx.snapshot.last_completed_at!==data.last_completed_at;ctx.snapshot=data;const r=ctx.root;
      if(changed&&!r.querySelector('[data-issues]').hidden)r.querySelector('[data-reload]').textContent='有新結果 · 更新問題';
      r.querySelector('[data-error]').textContent=data.error||'';
      r.querySelector('[data-status]').textContent=data.delayed?'巡檢延遲 · 前一輪尚未完成':data.running?'巡檢中…':data.config.enabled?`已啟用 · 每 ${data.config.interval_seconds} 秒`:'排程未啟用';
      r.querySelector('[data-run]').disabled=!!data.running;
      r.querySelector('[data-fail]').textContent=data.summary.fail;r.querySelector('[data-warning]').textContent=data.summary.warning;
      r.querySelector('[data-time]').textContent='最近完成：'+stamp(data.last_completed_at)+' · 台灣時間 UTC+8';
      const coverage=r.querySelector('[data-coverage]');coverage.replaceChildren();
      for(const entry of data.coverage||[]){const line=document.createElement('p');const node=data.nodes.find(n=>n.node_id===entry.node_id);line.textContent=[node?.label,entry.source,labels[entry.state]||entry.state,entry.collected_at?'採集 '+stamp(entry.collected_at):'',entry.detail].filter(Boolean).join(' · ');coverage.append(line);}
      if(!coverage.childNodes.length)coverage.textContent='尚未巡檢。零項異常不代表所有節點均已完成檢查。';
      const select=r.querySelector('[data-node]');if(select.options.length===1)for(const node of data.nodes){const option=document.createElement('option');option.value=node.node_id;option.textContent=node.label;select.append(option);}
      const form=r.querySelector('[data-config]');if(form.hidden){for(const [name,value] of Object.entries(data.config)){if(name==='thresholds'){for(const [metric,threshold] of Object.entries(value))form.elements[metric].value=threshold;}else if(form.elements[name]){if(typeof value==='boolean')form.elements[name].checked=value;else form.elements[name].value=value;}}}
      // Preserve expanded evidence, keyboard focus and text selection during periodic refresh.
      if(!r.querySelector('[data-issues]').hidden&&!r.querySelector('[data-list]').childNodes.length)await loadIssues(ctx);
    }catch(e){error(ctx,e);}finally{if(mounted===ctx)ctx.timer=setTimeout(()=>refresh(ctx),5000);}
  }
  async function loadIssues(ctx){try{const data=await request(ctx,`/issues?offset=${ctx.offset}&limit=50`);if(mounted!==ctx)return;ctx.rows=data.issues;ctx.root.querySelector('[data-reload]').textContent='更新問題';renderIssues(ctx);}catch(e){error(ctx,e);}}
  function renderIssues(ctx){
    const r=ctx.root,list=r.querySelector('[data-list]'),node=r.querySelector('[data-node]').value,status=r.querySelector('[data-filter]').value;list.replaceChildren();
    const rows=ctx.rows.filter(i=>(!node||i.node_id===node)&&(status==='all'||i.status===status));
    if(!rows.length){const p=document.createElement('p');p.textContent='此頁沒有符合條件的問題。請同時查看資料涵蓋狀態。';list.append(p);}
    for(const issue of rows){
      const detail=document.createElement('details');detail.className='pd-inspection-issue';const summary=document.createElement('summary');
      const label=ctx.snapshot.nodes.find(n=>n.node_id===issue.node_id)?.label||issue.node_id;
      detail.dataset.severity=issue.status==='RECOVERED'?'RECOVERED':issue.severity;
      const ruleLabel={'cpu.utilization.high':'CPU 持續高使用率','memory.utilization.high':'記憶體持續高使用率','gpu.utilization.high':'GPU 持續高使用率','vram.utilization.high':'VRAM 持續高使用率'}[issue.rule]||(issue.rule.startsWith('DMESG_')?'核心日誌硬體錯誤':issue.rule);
      summary.textContent=`${issue.status==='RECOVERED'?'已恢復':issue.severity==='FAIL'?'FAIL':'警告'} · ${label} · ${issue.component} · ${ruleLabel}`;detail.append(summary);
      const facts=document.createElement('p');facts.textContent=issue.facts;detail.append(facts);
      const timing=document.createElement('p');timing.textContent=`首次 ${stamp(issue.first_seen_at)} · 最後觀測 ${stamp(issue.last_seen_at)} · 恢復 ${issue.resolved_at?stamp(issue.resolved_at):'尚未恢復'} · 復發 ${issue.recurrences} 次`;detail.append(timing);
      const evidence=document.createElement('pre');evidence.textContent='證據來源：'+(issue.evidence||'未提供');detail.append(evidence);
      if(issue.evidence_ref?.run_id){const link=document.createElement('a');link.href='#/cycle/runs/'+encodeURIComponent(issue.evidence_ref.run_id);link.textContent='開啟來源任務與證據';detail.append(link);}
      const analysis=document.createElement('p');analysis.textContent=issue.analysis?`可能原因／待確認：${issue.analysis.text}`:'檢查建議：核對節點、採集時間及原始證據；高使用率請先確認目前測試負載。';detail.append(analysis);
      if(issue.analysis?.based_on){const basis=document.createElement('p');basis.textContent='分析依據：'+issue.analysis.based_on.evidence+' · 完成 '+stamp(issue.analysis.completed_at);detail.append(basis);}
      const actions=document.createElement('div');actions.className='pd-inspection-actions';
      const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn small';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){error(ctx,e);}finally{b.disabled=false;}};actions.append(b);};
      const handle=async body=>{await request(ctx,'/issues/'+issue.id,{method:'PATCH',body:JSON.stringify(body)});await loadIssues(ctx);};
      button(issue.acknowledged?'取消知悉':'已知悉',()=>handle({acknowledged:!issue.acknowledged}));
      button(issue.known_issue?'取消已知問題':'標記已知問題',()=>handle({known_issue:!issue.known_issue}));
      button(issue.mute_until>Date.now()/1000?'恢復通知標記':'暫停通知 24 小時',()=>handle({mute_until:issue.mute_until>Date.now()/1000?0:Math.floor(Date.now()/1000)+86400}));
      button('重新分析',async()=>{await request(ctx,'/issues/'+issue.id+'/analyze',{method:'POST'});analysis.textContent='分析已排入佇列；規則判定與證據不變。';});
      button('查看變更紀錄',async()=>{const data=await request(ctx,'/issues/'+issue.id+'/history');const history=detail.querySelector('[data-history]')||document.createElement('pre');history.dataset.history='';history.textContent=data.history.map(h=>`${stamp(h.at)} · ${{OPENED:'發現問題',RECOVERED:'已恢復',REOPENED:'再次發生',ESCALATED:'嚴重程度升高',HANDLED:'更新處理標記',EVIDENCE_UPDATED:'證據更新'}[h.kind]||h.kind} · ${h.data?.facts||''} ${h.data?.evidence||''}`).join('\n')||'尚無紀錄';detail.append(history);});
      detail.append(actions);list.append(detail);
    }
    r.querySelector('[data-page]').textContent=`第 ${ctx.offset/50+1} 頁 · 篩選目前 50 筆內結果`;
    r.querySelector('[data-prev]').disabled=ctx.offset===0;r.querySelector('[data-next]').disabled=ctx.rows.length<50;
  }
  window.SystemInspection={card,mount,dispose};
})();
