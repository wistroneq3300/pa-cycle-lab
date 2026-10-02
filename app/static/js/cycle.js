/* Cycle Test: fixed selections and persisted jobs. No browser supplied commands. */
(() => {
  'use strict';
  const terminal = new Set(['COMPLETE','INCOMPLETE','CANCELLED','BLOCKED','ERROR']);
  const labels = {CREATED:'等待 runner',PRE_RUNNING:'PRE 檢查中',AWAITING_CONFIRMATION:'等待確認',RUNNING:'執行中',STOP_REQUESTED:'本輪完成後停止',COMPLETE:'已完成',INCOMPLETE:'未完成',CANCELLED:'已取消',BLOCKED:'無法執行',ERROR:'執行錯誤'};
  let consoleView;
  let project='', targets=[], selected=new Set(), current=null, timer=null, requestKey=null, opener=null, generation=0;
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = value => value ? new Date(value*1000).toLocaleString('zh-TW',{hour12:false}) : '—';
  const base = () => `/api/projects/${encodeURIComponent(project)}/cycle`;
  async function api(url,body) {
    const response=await fetch(url,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();
    if(!response.ok) throw new Error(typeof data.detail==='string'?data.detail:'請求失敗，請重新整理後再試');
    return data;
  }
  function error(message='') { el('cycle-error').textContent=message; el('cycle-error').hidden=!message; }
  function selectionChanged() {
    requestKey=null;
    el('cycle-count').textContent=`已選 ${selected.size} 台`;
    el('cycle-create').disabled=!selected.size;
  }
  function renderTargets() {
    const query=el('cycle-search').value.trim().toLowerCase();
    const visible=targets.filter(t=>[t.name,t.tray,t.node,t.os_ip,t.bmc_ip].join(' ').toLowerCase().includes(query));
    el('cycle-targets').innerHTML=visible.map(t=>`<tr>
      <td><input type="checkbox" aria-label="選取 ${escape(t.name)}" data-machine="${escape(t.name)}" ${selected.has(t.name)?'checked':''} ${t.reasons.length?'disabled':''}></td>
      <th scope="row">${escape(t.name)}<small>${escape(t.tray)} / ${escape(t.node)}</small></th>
      <td><span>${escape(t.os_status)}</span><small>OS ${escape(t.os_ip)}<br>BMC ${escape(t.bmc_ip)}</small></td>
      <td>${t.reasons.length?`<span class="cycle-blocked">${escape(t.reasons.join('；'))}</span>`:'可執行'}</td>
    </tr>`).join('') || '<tr><td colspan="4">沒有符合的機台</td></tr>';
    el('cycle-targets').querySelectorAll('[data-machine]').forEach(box=>box.addEventListener('change',()=>{
      if(box.checked) selected.add(box.dataset.machine); else selected.delete(box.dataset.machine);
      selectionChanged();
    }));
  }
  function semantics() {
    const mode=el('cycle-mode').value, channel=el('cycle-channel').value;
    el('cycle-semantics').textContent=mode==='aux_cycle'?'AUX 透過 BMC standby controller 執行。必須包含已確認的完整影響範圍；共享 AUX domain 尚未驗證，會阻擋啟動。':mode==='reboot'?(channel==='outband'?'Outband Reboot：BMC power reset。':'Inband Reboot：OS reboot。'):(channel==='outband'?'Outband DC：BMC power cycle。':'Inband DC：OS 內 ipmitool power cycle。');
    requestKey=null;
  }
  function renderJob(job) {
    if(current?.id!==job.id) el('cycle-file-list').textContent='';
    current=job;
    consoleView.setJob(job,`${base()}/jobs/${job.id}`);
    el('cycle-detail').hidden=false;
    const main=el('cycle-detail').parentElement;
    if(main.firstElementChild!==el('cycle-detail')) main.prepend(el('cycle-detail'));
    el('cycle-job-state').textContent=labels[job.state] || job.state;
    el('cycle-job-id').textContent=job.id;
    el('cycle-job-meta').textContent=`${job.config.cycle_mode} · ${job.config.channel} · ${job.targets.length} 台 · 建立 ${date(job.created_at)} · ${job.synthetic?'SYNTHETIC':'LIVE'}`;
    el('cycle-health').textContent=`健康結果：${job.health} · ${job.stop_reason || '執行完成與硬體健康分別判定'}`;
    el('cycle-progress').innerHTML=job.nodes.map(n=>`<tr><th scope="row">${escape(n.machine_id)}</th><td>${n.loop}</td><td>${n.completed}</td><td>${n.attempts}</td><td>${escape(n.stage)}</td><td>${escape(n.health)}</td><td>${n.first_this_round===null?'待定':n.first_this_round}</td><td>${n.unique_issues}</td><td>${escape(date(n.updated_at))}<small>${escape(n.stop_reason || n.blocked.join('；'))}</small></td></tr>`).join('') || '<tr><td colspan="9">Runner 尚未回報，任務已保存。</td></tr>';
    const pre=job.pre;
    el('cycle-pre').hidden=!pre;
    if(pre) {
      el('cycle-approved-targets').textContent=pre.runnable_ids.join('、');
      const findings=pre.findings.flatMap(f=>f.issues.map(i=>`<li><strong>${escape(f.machine_id)} · ${escape(i.severity)}</strong> ${escape(i.component)} — ${escape(i.detail)}</li>`));
      const exclusions=pre.excluded.map(x=>`<li>${escape(x.machine_id)}：${escape(x.reasons.join('；'))}</li>`);
      el('cycle-findings').innerHTML=findings.join('') || '<li>PRE 沒有發現問題。</li>';
      el('cycle-excluded').innerHTML=exclusions.join('') || '<li>沒有排除節點。</li>';
      el('cycle-pre-version').textContent=pre.version.slice(0,16);
    }
    el('cycle-confirm').hidden=job.state!=='AWAITING_CONFIRMATION';
    el('cycle-confirm').disabled=job.stop_requested;
    el('cycle-stop').hidden=terminal.has(job.state);
    el('cycle-stop').disabled=job.stop_requested;
    el('cycle-stop').textContent=['CREATED','PRE_RUNNING','AWAITING_CONFIRMATION'].includes(job.state)?(job.stop_requested?'取消處理中':'取消此任務'):(job.stop_requested?'已受理，正在完成本輪':'本輪完成後停止');
    el('cycle-report').href=`${base()}/jobs/${job.id}/files/CYCLE_REVIEW_REPORT.html`;
    el('cycle-report').hidden=!job.pre && !terminal.has(job.state);
  }
  async function refresh() {
    const serial=generation, url=base();
    try {
      const [data,status]=await Promise.all([api(`${url}/jobs`),api('/api/cycle/status')]);
      if(serial!==generation) return;
      el('cycle-runner').textContent=status.runner_available?'Runner 已連線':'Runner 尚未連線，任務會保留等待';
      const focusedJob=el('cycle-history').contains(document.activeElement)?document.activeElement.dataset.job:null;
      const markup=data.jobs.map(j=>`<button type="button" class="cycle-history-item ${current?.id===j.id?'selected':''}" data-job="${j.id}" aria-pressed="${current?.id===j.id}"><strong>${escape(labels[j.state] || j.state)}</strong><span>${escape(j.config.cycle_mode)} · ${j.targets.length} 台 · ${escape(date(j.created_at))}</span><small>${escape(j.id.slice(0,12))}</small></button>`).join('') || '<p class="cycle-muted">此專案尚無 Cycle 任務。</p>';
      if(el('cycle-history').dataset.markup!==markup) {
        el('cycle-history').innerHTML=markup;el('cycle-history').dataset.markup=markup;
        if(focusedJob) el('cycle-history').querySelector(`[data-job="${focusedJob}"]`)?.focus({preventScroll:true});
      }
      el('cycle-history').querySelectorAll('[data-job]').forEach(button=>{button.onclick=()=>{renderJob(data.jobs.find(j=>j.id===button.dataset.job));refresh().catch(e=>error(e.message));};});
      if(current) {
        const latest=data.jobs.find(j=>j.id===current.id);
        if(latest) renderJob(latest);
      }
    } catch(e) { if(serial===generation) error(e.message); }
  }
  async function reloadTargets() {
    const serial=generation, data=await api(`${base()}/targets`);
    if(serial!==generation)return;
    targets=data.targets;
    el('cycle-environment').textContent=data.mode==='synthetic'?'SYNTHETIC · 離線模擬，沒有操作實際機台':'LIVE · 操作已登錄的實際機台';
    renderTargets();
  }
  window.openCycleTest=async name=>{
    consoleView.reset(); generation++; project=name; selected=new Set(); current=null; requestKey=null;
    const serial=generation;
    opener=document.activeElement;
    el('cycle-title').textContent=`${name} · Cycle Test`;
    el('cycle-detail').hidden=true; el('cycle-search').value='';el('cycle-file-list').textContent='';
    el('cycle-panel').showModal(); error(); selectionChanged();
    el('cycle-close').focus();
    try { await reloadTargets(); if(serial!==generation)return; await refresh(); } catch(e) { if(serial===generation)error(e.message); }
    if(serial!==generation)return;
    clearInterval(timer); timer=setInterval(refresh,1500);
  };
  function close() { consoleView.close(); generation++; clearInterval(timer); el('cycle-panel').close(); opener?.focus(); }
  function initialize() {
    const dialog=document.createElement('dialog'); dialog.id='cycle-panel';
    dialog.setAttribute('aria-labelledby','cycle-title');
    dialog.innerHTML=`<div class="cycle-shell">
      <header class="cycle-header"><div><h1 id="cycle-title">Cycle Test</h1><p id="cycle-environment"></p></div><button type="button" class="btn" id="cycle-close">返回專案</button></header>
      <div class="cycle-service"><span id="cycle-runner" role="status">正在連線…</span><span>關閉頁面不會取消任務</span></div>
      <p id="cycle-error" class="cycle-error" role="alert" hidden></p>
      <div class="cycle-layout"><main class="cycle-main">
        <section aria-labelledby="cycle-select-title"><h2 id="cycle-select-title">選取專案機台</h2>
          <div class="cycle-toolbar"><label class="cycle-search">搜尋機台<input id="cycle-search" type="search" placeholder="名稱、Tray / Node、IP"></label><button class="btn" id="cycle-all" type="button">全選可執行</button><button class="btn" id="cycle-none" type="button">取消選取</button><strong id="cycle-count" aria-live="polite">已選 0 台</strong></div>
          <div class="cycle-table"><table><thead><tr><th scope="col">選取</th><th scope="col">機台 / 節點</th><th scope="col">OS / BMC</th><th scope="col">可執行狀態</th></tr></thead><tbody id="cycle-targets"></tbody></table></div>
        </section>
        <section aria-labelledby="cycle-config-title"><h2 id="cycle-config-title">執行條件</h2>
          <form id="cycle-form"><div class="cycle-fields">
            <label>Cycle 模式<select id="cycle-mode"><option value="reboot">Reboot</option><option value="power_cycle">DC · Power cycle</option><option value="aux_cycle">AUX cycle</option></select></label>
            <label>通道<select id="cycle-channel"><option value="inband">Inband</option><option value="outband">Outband</option></select></label>
            <label>次數限制<input id="cycle-loops" type="number" min="1" max="1000000" step="1" value="3" placeholder="不限制"></label>
            <label>時間限制（小時）<input id="cycle-hours" type="number" min="0.001" max="8760" step="any" placeholder="不限制"></label>
            <label>Boot timeout（秒）<input id="cycle-timeout" type="number" min="1" max="86400" step="1" value="900" required></label>
          </div><p id="cycle-semantics" class="cycle-muted"></p><p class="cycle-muted">至少設定一項限制；任一限制達到後，完成當前輪 POST 再結束。Boot timeout 僅限制等待開機。</p>
          <div class="cycle-pre-notice"><strong>PRE 準備行為</strong><p>PRE 會檢查身分、收集 baseline，可能安裝缺少的 OS 工具與 ipmitool、上傳檢查腳本。正式 cycle 與 START 清除 SEL / dmesg 需在檢查結果出來後再次確認。</p></div>
          <button class="btn primary" id="cycle-create" type="submit" disabled>建立任務並執行 PRE</button></form>
        </section>
        <section id="cycle-detail" hidden aria-labelledby="cycle-job-state"><div class="cycle-job-heading"><h2 id="cycle-job-state"></h2><button type="button" class="btn" id="cycle-console-toggle" aria-expanded="false" aria-controls="cycle-console">Live Console</button><a class="btn" id="cycle-report" target="_blank" rel="noopener">開啟 HTML 報告</a><button type="button" class="btn" id="cycle-artifacts">報告與證據</button></div>
          <p id="cycle-job-meta"></p><p class="cycle-muted">Job <code id="cycle-job-id"></code></p><p id="cycle-health" role="status"></p>
          <div id="cycle-pre" hidden><h3>PRE 檢查結果</h3><p>本次可執行目標：<strong id="cycle-approved-targets"></strong></p><details open><summary>PRE findings</summary><ul id="cycle-findings"></ul></details><details><summary>被排除的節點</summary><ul id="cycle-excluded"></ul></details><p class="cycle-muted">確認版本 <code id="cycle-pre-version"></code></p></div>
          <div class="cycle-actions"><button type="button" class="btn primary" id="cycle-confirm" hidden>接受此份 PRE 與目標，開始 Cycle</button><button type="button" class="btn" id="cycle-stop" hidden>本輪完成後停止</button></div>
          <div id="cycle-console" class="cycle-console" hidden></div><h3>每台進度</h3><div class="cycle-table"><table><thead><tr><th scope="col">機台</th><th scope="col">目前輪次</th><th scope="col">完成輪數</th><th scope="col">Attempts</th><th scope="col">階段</th><th scope="col">健康</th><th scope="col">本輪首次 issue</th><th scope="col">累積 unique</th><th scope="col">最後更新 / 原因</th></tr></thead><tbody id="cycle-progress"></tbody></table></div>
          <p class="cycle-muted">等待開機是 cycle 的預期階段。NEW relative to PRE 與「本輪首次 issue」的定義不同；完整分類請查看報告。</p><ul id="cycle-file-list"></ul>
        </section>
      </main><aside class="cycle-history" aria-labelledby="cycle-history-title"><h2 id="cycle-history-title">專案任務</h2><div id="cycle-history"></div></aside></div>
    </div>`;
    document.body.append(dialog);
    consoleView=new window.CycleConsole(el("cycle-console"),el("cycle-console-toggle"));
    el('cycle-close').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    el('cycle-search').addEventListener('input',renderTargets);
    el('cycle-all').addEventListener('click',()=>{targets.filter(t=>!t.reasons.length).forEach(t=>selected.add(t.name));renderTargets();selectionChanged();});
    el('cycle-none').addEventListener('click',()=>{selected.clear();renderTargets();selectionChanged();});
    el('cycle-form').addEventListener('input',()=>{requestKey=null;});
    ['cycle-mode','cycle-channel'].forEach(id=>el(id).addEventListener('change',semantics)); semantics();
    el('cycle-form').addEventListener('submit',async event=>{
      event.preventDefault();error();const button=el('cycle-create');button.disabled=true;
      const serial=generation,url=base();
      const loops=Number(el('cycle-loops').value || 0),hours=Number(el('cycle-hours').value || 0);
      try {
        if(!selected.size || !(loops || hours)) throw new Error('請選取機台，並設定次數或時間限制');
        requestKey ||= crypto.randomUUID();
        const job=await api(`${url}/jobs`,{machine_ids:[...selected],cycle_profile:'neutrino',cycle_mode:el('cycle-mode').value,channel:el('cycle-channel').value,limits:{loops,hours},boot_timeout:Number(el('cycle-timeout').value),idempotency_key:requestKey});
        if(serial!==generation)return;
        renderJob(job); await refresh(); await reloadTargets();
        el('cycle-detail').scrollIntoView({block:'start'});
      } catch(e) { if(serial===generation)error(e.message); } finally {if(serial===generation)button.disabled=!selected.size;}
    });
    el('cycle-confirm').addEventListener('click',async()=>{
      const snapshot=current,serial=generation;error();el('cycle-confirm').disabled=true;
      try {const result=await api(`${base()}/jobs/${snapshot.id}/confirm`,{version:snapshot.pre.version,machine_ids:snapshot.pre.runnable_ids});
        if(serial!==generation || current?.id!==snapshot.id)return;
        renderJob(result);await refresh();}
      catch(e){if(serial===generation && current?.id===snapshot.id){error(e.message);el('cycle-confirm').disabled=false;}}
    });
    el('cycle-stop').addEventListener('click',async()=>{
      const jobId=current.id,serial=generation;error();el('cycle-stop').disabled=true;
      try{const result=await api(`${base()}/jobs/${jobId}/stop`,{});
        if(serial!==generation || current?.id!==jobId)return;
        renderJob(result);await refresh();}
      catch(e){if(serial===generation && current?.id===jobId){error(e.message);el('cycle-stop').disabled=false;}}
    });
    el('cycle-artifacts').addEventListener('click',async()=>{
      const jobId=current.id,serial=generation,url=`${base()}/jobs/${jobId}`;
      try{const result=await api(`${url}/artifacts`);
        if(serial!==generation || current?.id!==jobId)return;
        el('cycle-file-list').innerHTML=result.files.map(path=>`<li><a target="_blank" rel="noopener" href="${url}/files/${path.split('/').map(encodeURIComponent).join('/')}">${escape(path)}</a></li>`).join('') || '<li>Runner 尚未產生報告。</li>';}
      catch(e){if(serial===generation && current?.id===jobId)error(e.message);}
    });
    document.addEventListener('click',event=>{const button=event.target.closest('[data-cycle-project]');if(button)window.openCycleTest(decodeURIComponent(button.dataset.cycleProject));});
  }
  initialize();
})();
