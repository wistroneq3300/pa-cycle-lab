/* Native Next route owner. Only this view owns its timer, requests and console. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const end=new Set(['COMPLETE','INCOMPLETE','CANCELLED','BLOCKED','ERROR','RECONCILIATION_REQUIRED']);
  // Title-case status labels (RECONCILIATION_REQUIRED -> Reconciliation Required); the raw
  // state string is still used for logic, this is display only.
  const stateLabel=state=>String(state??'').split('_').map(w=>w?w[0].toUpperCase()+w.slice(1).toLowerCase():w).join(' ');
  // Readable run ids look like "<project>_<mode>_<channel>_<date>_<time>_<hex>"; the
  // project is shown in its own column, so the list shows the id with that prefix
  // stripped (older hex-only ids have no prefix and are shown as-is).
  const runSuffix=j=>{const id=String(j.id||'');const p=String(j.project||'').toLowerCase();const slug=p.replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');return slug&&id.startsWith(slug+'_')?id.slice(slug.length+1):id;};
  // Colour a value by its meaning: PASS/OK green, WARN/amber, FAIL/BLOCKED red,
  // anything in-flight/neutral muted. Used for the progress table badges.
  const HEALTH_CLASS=v=>{const s=String(v??'').toUpperCase();return s==='PASS'||s==='OK'||s==='EXERCISED'?'cw-ok':s==='WARN'?'cw-warn':s==='FAIL'||s==='BLOCKED'||s==='ERROR'?'cw-fail':s==='DONE'||s==='COMPLETE'?'cw-done':'cw-idle';};
  let root, generation=0, controller, timer, consoleView, selected=new Set(), inventory=[], current, preselect={}, offset=0, key, progressRows=new Map(), progressSignature="";
  const $=id=>root?.querySelector('#'+id);
  // crypto.randomUUID is only defined in secure contexts (HTTPS / localhost); fall back
  // for plain http://<ip>:6969 so job creation never dies on idempotency-key generation.
  function newKey(){
    if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
    const b=new Uint8Array(16);
    if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(b);
    else for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256);
    b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
    const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
    return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  async function api(url,body){
    const r=await fetch(url,{signal:controller?.signal,cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
    const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail));return data;
  }
  function error(e){if($('cw-error')){$('cw-error').textContent=e?.message||'';$('cw-error').hidden=!e;}}
  function link(route){location.hash='#/cycle'+(route?'/'+route:'');}
  function dispose(){generation++;clearTimeout(timer);controller?.abort();consoleView?.close();consoleView=null;root=null;progressRows.clear();progressSignature="";}
  function shell(){return `<section id="cycle-workspace" class="cycle-workspace"><header class="cw-head"><div><h1>Cycle 驗證</h1><p>Rack / Chassis / Node · PRE → 確認 → 執行 → 證據</p></div><nav><a class="btn" href="#/cycle">任務紀錄</a><a class="btn primary" href="#/cycle/new">建立 Cycle</a></nav></header><p id="cw-error" role="alert" hidden></p><main id="cw-body"><p role="status">載入 Cycle 工作區…</p></main></section>`;}
  async function mount(){
    dispose();root=document.getElementById('cycle-workspace');if(!root)return;
    controller=new AbortController();const g=generation;error(null);
    try{
      const route=location.hash.replace(/^#\/cycle\/?/,'').split('/');
      if(route[0]==='new'){await wizard(route.slice(1).map(decodeURIComponent));}
      else if(route[0]==='runs'&&route[1]){await run(route[1]);}
      else{offset=0;await history();}
    }catch(e){if(g===generation&&e.name!=='AbortError'){
      error(e);$('cw-body').innerHTML='<p>Cycle 工作區目前無法載入。執行中的任務不受此畫面影響。</p><button class="btn" id="cw-retry">重新載入</button>';
      $('cw-retry').onclick=mount;
    }}
  }
  async function history(){
    const g=generation;const data=await api('/api/cycle/runs?offset='+offset);if(g!==generation)return;
    const done=new Set(['COMPLETE','INCOMPLETE','CANCELLED','BLOCKED','ERROR','RECONCILIATION_REQUIRED']);
    $('cw-body').innerHTML=`<h2>任務紀錄</h2><p>執行狀態與硬體驗證結果分開判定。停止與中斷的任務仍保留證據。</p><div class="cw-scroll cw-history-table"><table><thead><tr><th>任務 / 專案</th><th>執行狀態</th><th>累積健康</th><th>環境</th><th>建立時間</th><th></th></tr></thead><tbody>${data.runs.map(j=>`<tr><td><a class="cw-history-project" href="#/cycle/runs/${esc(j.id)}">${esc(j.project)}</a><code>${esc(runSuffix(j))}</code></td><td><span class="cw-history-state">${esc(stateLabel(j.state))}</span></td><td>${esc(stateLabel(j.health))}</td><td>${j.synthetic?'測試模式':'LIVE'}</td><td>${new Date(j.created_at*1000).toLocaleString()}</td><td><button class="btn cw-del" data-id="${esc(j.id)}" data-project="${esc(j.project)}" ${done.has(j.state)?'':'disabled title="執行中或等待確認的任務無法刪除"'}>刪除</button></td></tr>`).join('')||'<tr><td colspan="6">尚無任務。從 Rack 或此頁建立 Cycle。</td></tr>'}</tbody></table></div><div class="cw-actions"><button class="btn" id="cw-prev" ${offset?'':'disabled'}>上一頁</button><button class="btn" id="cw-next" ${data.has_more?'':'disabled'}>下一頁</button></div>`;
    $('cw-prev').onclick=()=>{offset=Math.max(0,offset-25);history().catch(error);};$('cw-next').onclick=()=>{offset+=25;history().catch(error);};
    $('cw-body').querySelectorAll('.cw-del').forEach(b=>b.onclick=()=>deleteRun(b.dataset.id,b.dataset.project,b));
  }
  async function deleteRun(id,project,button){
    if(!await window.uxConfirm(`Project：${project}\nRun：${runSuffix({id,project})}\n\n此動作會一併刪除該任務的 Evidence 與 log 資料夾，而且無法復原。`))return;
    button.disabled=true;
    try{
      const r=await fetch('/api/cycle/runs/'+encodeURIComponent(id),{method:'DELETE',cache:'no-store',signal:controller?.signal});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail||r.status));
      await history();
    }catch(e){error(e);button.disabled=false;}
  }
  async function wizard(route=[]){
    const g=generation,data=await api('/api/cycle/inventory');if(g!==generation)return;
    inventory=data.projects;selected=new Set();key=null;
    if(route[0]){
      // route[0] is a project_id from the URL, but many projects have no project_id.
      // Fall back to matching the project NAME so a stale/empty id never blocks entry.
      const project=inventory.find(p=>p.project_id===route[0])||inventory.find(p=>p.name===route[0]);
      if(!project)throw Error('專案不存在或無存取權限');
      preselect={project:project.name,chassis:route[1],node:route[2]};
    }
    $('cw-body').innerHTML=`<div class="cw-create-intro"><div><span class="cw-eyebrow">專案驗證</span><h2>建立 Cycle 任務</h2><p>選擇節點、建立 PRE，再確認完整影響範圍。</p></div><p class="cw-environment" data-cw-region="environment">${data.mode==='synthetic'?'測試模式 · 不操作實體設備':'LIVE · 會連接硬體'}</p></div><ol class="cw-workflow" aria-label="Cycle 建立流程"><li aria-current="step"><span>01</span><div><strong>設定與選擇</strong><small>目前步驟</small></div></li><li><span>02</span><div><strong>執行 PRE</strong><small>保存檢查與影響範圍</small></div></li><li><span>03</span><div><strong>審閱後啟動</strong><small>確認同一份 PRE</small></div></li></ol><form id="cw-form"><div class="cw-setup-layout"><section class="cw-config-section" data-cw-section="settings" aria-labelledby="cw-settings-title"><div class="cw-section-heading"><span class="cw-section-number">01</span><div><h2 id="cw-settings-title">執行設定</h2><p class="cw-section-intro">確認專案、模式與通道，再設定本次執行的輪次或時數。</p></div></div><input type="hidden" id="cw-profile"><div class="cw-form-grid"><label>專案<select id="cw-project">${inventory.map(p=>`<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('')}</select></label><label>驗證模式<select id="cw-mode"><option value="reboot">Reboot</option><option value="power_cycle">DC Power Cycle</option><option value="aux_cycle">AUX Cycle（需已確認範圍）</option></select></label><label>執行通道<select id="cw-channel"><option value="inband">Inband</option><option value="outband">Outband</option></select></label></div><div class="cw-limits-heading">執行限制 <span>輪次與時數擇一，請依本次驗證需求設定</span></div><div class="cw-form-grid"><label>執行方式<select id="cw-limit-kind"><option value="" selected>請選擇…</option><option value="loops">依輪次執行</option><option value="hours">依時數執行</option></select></label><label>次數 / 時數<input id="cw-limit-value" type="number" min="0" step="any" placeholder="請輸入輪次或小時數"><small>輪次為正整數；時數可使用小數</small></label></div><p id="cw-project-error" class="cw-project-error" role="alert" hidden></p><p class="cw-section-note">執行前系統會先連線檢查每台主機的 OS / BMC 主機名稱。</p></section><aside class="cw-review" aria-label="本次設定摘要"><span class="cw-eyebrow">任務摘要</span><h3>本次驗證</h3><dl><div><dt>選取範圍</dt><dd id="cw-review-selection">尚未選擇節點</dd></div><div><dt>模式與通道</dt><dd id="cw-review-mode"></dd></div><div><dt>執行限制</dt><dd id="cw-review-limits"></dd></div></dl><p class="cw-review-guidance" id="cw-review-guidance">在下方勾選這次要驗證的節點。</p><div class="cw-review-safety"><strong>先檢查，再確認啟動</strong><p>PRE 會保存檢查結果。Live PRE 可能安裝依賴、上傳驗證腳本；不代表硬體已通過。</p><p>Inband 仍需 BMC 採集。Power / AUX 必須包含完整共享範圍，未確認控制目標對應時不可執行。</p></div></aside></div><section class="cw-scope-section" data-cw-section="scope" aria-labelledby="cw-scope-title"><div class="cw-section-heading"><span class="cw-section-number">02</span><div><h2 id="cw-scope-title">選擇測試節點</h2><p class="cw-section-intro">勾選單一或多個節點；搜尋只改變畫面，不會清除已選目標。</p></div></div><div class="cw-actions cw-scope-actions"><label class="cw-search">搜尋機框、節點或連線位址<input id="cw-search" type="search" placeholder="輸入名稱或 IP，快速找到節點"></label><button class="btn" type="button" id="cw-visible">全選搜尋結果</button><button class="btn" type="button" id="cw-none">取消選取</button></div><div class="cw-scope-summary" aria-live="polite"><div><span class="cw-scope-summary-label">本次選取</span><p id="cw-count" class="cw-scope-summary-value" role="status"></p></div><span id="cw-visible-count"></span></div><div id="cw-matrix" class="cw-matrix" tabindex="0" role="region" aria-label="可選節點，捲動查看其他機框"></div></section><div class="cw-actions cw-submit-actions"><div><strong>下一步：保存並執行 PRE</strong><p>檢查完成後仍需審閱與確認。無法執行的節點會列出原因，不會自動略過。</p></div><button class="btn primary" id="cw-create">建立任務並執行 PRE →</button></div></form>`;
    if(preselect.project&&inventory.some(p=>p.name===preselect.project))$('cw-project').value=preselect.project;
    const targets=()=>inventory.find(p=>p.name===$('cw-project').value)?.targets||[];
    function profileInfo(){
      const p=inventory.find(p=>p.name===$('cw-project').value);
      // Profile 欄位已從 UI 移除；仍以 hidden input 帶後端解析出的 profile_id，
      // 讓 create_job 的 profile 一致性檢查照常運作。
      const pv=$('cw-profile'); if(pv) pv.value=p?.profile||'neutrino';
      // Surface a per-project error (e.g. missing <project>_config.sh -> explicit 404 msg)
      // so a project with no checker is visible rather than silently empty.
      const errEl=$('cw-project-error');
      if(errEl){errEl.textContent=p?.error||'';errEl.hidden=!p?.error;}
    }
    const visible=()=>targets().filter(t=>[t.display_name,t.name,t.parent_name,t.os_ip,t.slot_key].join(' ').toLowerCase().includes($('cw-search').value.toLowerCase()));
    function draw(){
      const groups=new Map();for(const t of visible()){const chassis=t.parent_name||t.name;if(!groups.has(chassis))groups.set(chassis,[]);groups.get(chassis).push(t);}
      $('cw-matrix').innerHTML=[...groups].map(([chassis,ts])=>`<section class="cw-chassis"><div class="cw-chassis-heading"><span>機框</span><h3>${esc(chassis)}</h3><small>${ts.length} 個搜尋結果</small></div><div class="cw-nodes">${ts.map(t=>`<label class="cw-node ${t.reasons.length?'has-blocker':''}"><input type="checkbox" value="${esc(t.name)}" ${selected.has(t.name)?'checked':''}><strong>${esc(t.os_hostname||t.node||t.name)}</strong><span>${esc(t.os_ip)}:${esc(t.os_port||22)}</span><small>${esc(t.reasons.join('；')||'可進入 PRE；硬體尚未驗證')}</small></label>`).join('')}</div></section>`).join('')||'<p>沒有符合搜尋條件的節點。選取仍保留。</p>';
      $('cw-matrix').querySelectorAll('input').forEach(e=>e.onchange=()=>{e.checked?selected.add(e.value):selected.delete(e.value);key=null;count();});count();
    }
    function count(){const ts=targets().filter(t=>selected.has(t.name));$('cw-count').textContent=`已選 ${new Set(ts.map(t=>t.parent_name||t.name)).size} 個機框 / ${ts.length} 個節點 · ${ts.filter(t=>t.reasons.length).length} 個目標有缺失`;$('cw-create').disabled=!ts.length;
      $('cw-review-selection').textContent=ts.length?`${new Set(ts.map(t=>t.parent_name||t.name)).size} 個機框 / ${ts.length} 個節點`:'尚未選擇節點';
      $('cw-review-mode').textContent=$('cw-mode').selectedOptions[0].textContent+' · '+$('cw-channel').value;
      const kind=$('cw-limit-kind').value,value=$('cw-limit-value').value;
      $('cw-review-limits').textContent=kind&&value?`${value} ${kind==='loops'?'輪':'小時'}`:'尚未設定';
      const missing=ts.filter(t=>t.reasons.length).length;
      $('cw-review-guidance').textContent=missing?`${missing} 個目標有缺失，請於 PRE 審閱原因。`:ts.length?'已選目標將進入 PRE；仍需審閱確認後才會啟動。':'在下方勾選這次要驗證的節點。';
      $('cw-visible-count').textContent=`顯示 ${visible().length} / ${targets().length} 個節點`;
    }
    if(preselect.chassis)$('cw-search').value=preselect.chassis;
    for(const t of targets())if(preselect.node&&t.name===preselect.node&&(!preselect.chassis||t.parent_name===preselect.chassis))selected.add(t.name);
    preselect={};profileInfo();draw();$('cw-search').oninput=draw;$('cw-project').onchange=()=>{selected.clear();key=null;const p=inventory.find(p=>p.name===$('cw-project').value);if(p?.project_id)window.history.replaceState(null,'','#/cycle/new/'+encodeURIComponent(p.project_id));profileInfo();draw();};
    $('cw-visible').onclick=()=>{visible().forEach(t=>selected.add(t.name));key=null;draw();};$('cw-none').onclick=()=>{selected.clear();key=null;draw();};
    $('cw-form').oninput=()=>{key=null;count();};
    $('cw-form').onsubmit=async e=>{e.preventDefault();error();
      const kind=$('cw-limit-kind').value, raw=$('cw-limit-value').value;
      if(!kind){error(new Error('請選擇執行方式（依輪次執行 或 依時數執行）'));return;}
      const num=Number(raw);
      if(!raw || !isFinite(num) || num<=0 || (kind==='loops'&&!Number.isInteger(num))){error(new Error('請輸入有效的'+(kind==='loops'?'輪次（正整數）':'小時數（正數）')));return;}
      const limits=kind==='loops'?{loops:num,hours:0}:{loops:0,hours:num};
      $('cw-create').disabled=true;try{key||=newKey();const j=await api('/api/cycle/runs',{project:$('cw-project').value,machine_ids:[...selected],cycle_profile:$('cw-profile').value,cycle_mode:$('cw-mode').value,channel:$('cw-channel').value,limits,idempotency_key:key});if(g===generation)link('runs/'+j.id);}catch(e){if(g===generation){error(e);count();}}};
  }
  async function run(id){
    const g=generation;current=await api('/api/cycle/runs/'+encodeURIComponent(id));if(g!==generation)return;
    $('cw-body').innerHTML=`<p id="cw-environment" class="cw-environment"></p><div class="cw-run-head"><div><h2 id="cw-run-title"></h2><code id="cw-run-id"></code></div><div class="cw-actions"><button class="btn" id="cw-stop">停止：不再派送新動作</button><button class="btn" id="cw-console-toggle" aria-expanded="false">Live Console</button></div></div><p id="cw-freshness" role="status"></p><div id="cw-summary" class="cw-summary"></div><section id="cw-reconciliation" hidden><h2>結果未知／待核對／相關資源仍占用</h2><p>核對操作紀錄、殘存程序與實際影響範圍後，才能釋放資源。不會重新送出電源命令。</p><button class="btn" id="cw-review-action">檢視待核對動作</button><div id="cw-review-body"></div></section><details id="cw-pre-shell"><summary>PRE 結果與影響範圍</summary><section id="cw-pre"></section></details><div id="cw-console" class="cycle-console" hidden></div><h2>機框與節點執行進度</h2><p class="cw-progress-glossary">目前輪次、有效輪數與硬體健康分開呈現。展開節點可查看嘗試、POST、Boot、問題數與覆蓋。執行狀態與硬體驗證結果分開判定。</p><div id="cw-progress" class="cw-scroll"></div><details class="cw-artifacts"><summary>證據與報告</summary><button class="btn" id="cw-evidence">載入證據清單</button><ul id="cw-files"></ul></details>`;
    consoleView=new CycleConsole($('cw-console'),$('cw-console-toggle'));const url=`/api/projects/${encodeURIComponent(current.project)}/cycle/jobs/${id}`;
    $('cw-stop').onclick=async()=>{try{current=await api(url+'/stop',{});if(g===generation)paint(url);}catch(e){if(g===generation)error(e);}};
    $('cw-evidence').onclick=async()=>{try{const result=await api(url+'/artifacts');if(g!==generation)return;
      const reportPattern=/(^|\/)(CYCLE_REVIEW_REPORT|cycle_summary|job_final|known_issues|new_issues|worsened_issues|report|summary)(?:[._-]|\/|$)/i;
      const manifest=new Map((Array.isArray(result.manifest)?result.manifest:[]).map(item=>[String(item.path||''),item]));
      const friendlyName=file=>({
        'CYCLE_REVIEW_REPORT.html':'Cycle Review 報告 · HTML','CYCLE_REVIEW_REPORT.md':'Cycle Review 報告 · Markdown',
        'cycle_summary.json':'Cycle 摘要 · JSON','cycle_summary.txt':'Cycle 摘要 · 文字','job_final.json':'最終執行結果 · JSON',
        'known_issues.md':'已知問題 · Markdown','new_issues.md':'新增問題 · Markdown','worsened_issues.md':'惡化問題 · Markdown',
        'report.json':'輪次結果 · JSON','node_summary.txt':'節點摘要 · 文字'
      }[file]||file);
      const artifactStage=parts=>{const part=parts[1]||'';if(/^loop\d+$/i.test(part))return part.toUpperCase();if(/^start$/i.test(part))return 'START';if(/^pre(?:[_\-.]|$)/i.test(part))return 'PRE';if(/^node_summary/i.test(part))return 'SUMMARY';return parts.length>2?'EVIDENCE':'';};
      const groups=new Map(),files=Array.isArray(result.files)?result.files:[];
      files.forEach((rawPath,index)=>{
        const path=String(rawPath??''),parts=path.split('/').filter(Boolean),file=parts.at(-1)||path,entry=manifest.get(path),isReport=parts.length===1&&(entry?.kind==='html-report'||reportPattern.test(file)),isTarget=parts.length>1&&/^(tray|chassis|rack|node|machine)(?:[-_]|\d)/i.test(parts[0]),stage=isTarget?artifactStage(parts):'';
        const key=isReport?'reports':parts.length<2?'run':isTarget?`target:${parts[0]}:${stage||'root'}`:`evidence:${parts[0]}`;
        const title=isReport?'報告與摘要':parts.length<2?'執行紀錄':isTarget?`目標 / ${parts[0]}${stage?' · '+stage:''}`:`證據 / ${parts[0]}`;
        if(!groups.has(key))groups.set(key,{key,title,order:isReport?0:parts.length<2?1:2,first:index,files:[]});
        groups.get(key).files.push({path,file,isReport});
      });
      const list=$('cw-files');list.replaceChildren();
      [...groups.values()].sort((a,b)=>a.order-b.order||a.first-b.first).forEach(group=>{
        const groupItem=document.createElement('li'),disclosure=document.createElement('details'),summary=document.createElement('summary'),groupList=document.createElement('ul');
        groupItem.className='cw-artifact-group';disclosure.className='cw-artifact-group-details';disclosure.open=group.order===0;summary.className='cw-artifact-group-summary';summary.textContent=`${group.title} · ${group.files.length}`;groupList.className='cw-artifact-group-list';
        group.files.forEach(({path,file,isReport})=>{const item=document.createElement('li'),a=document.createElement('a'),name=document.createElement('span'),pathLabel=document.createElement('small');item.className='cw-artifact-item';a.className=isReport?'cw-artifact-report':'cw-artifact-link';name.className='cw-artifact-title';pathLabel.className='cw-artifact-path';name.textContent=friendlyName(file);pathLabel.textContent=path;a.title=path;a.href=url+'/files/'+path.split('/').map(encodeURIComponent).join('/');a.target='_blank';a.rel='noopener';a.append(name,pathLabel);item.append(a);groupList.append(item);});
        disclosure.append(summary,groupList);groupItem.append(disclosure);list.append(groupItem);
      });
      // Filters use manifest paths, never construct a new download target.
      $('cw-evidence-filters')?.remove();
      const filters=document.createElement('div');filters.id='cw-evidence-filters';filters.className='cw-evidence-filters';
      filters.innerHTML='<label>目標<select id="cw-evidence-node"><option value="">全部目標與任務報告</option></select></label><label>階段 / 輪次<select id="cw-evidence-phase"><option value="">全部階段</option></select></label><label class="cw-search">搜尋檔名或路徑<input id="cw-evidence-search" type="search" placeholder="例如 dmesg、sensor、report"></label><p id="cw-evidence-count" role="status" aria-live="polite"></p>';
      list.before(filters);
      const items=[...list.querySelectorAll('.cw-artifact-item')].map(item=>{const path=item.querySelector('a').title,parts=path.split('/');return {item,path,node:parts.length>1?parts[0]:'任務報告',phase:artifactStage(parts)||'執行摘要'};});
      const nodeSelect=$('cw-evidence-node'),phaseSelect=$('cw-evidence-phase');
      [...new Set(items.map(i=>i.node))].sort().forEach(v=>nodeSelect.add(new Option(v,v)));
      const filterFiles=()=>{
        const node=nodeSelect.value,phase=phaseSelect.value,q=$('cw-evidence-search').value.toLowerCase();let count=0;
        items.forEach(i=>{i.item.hidden=!!((node&&node!==i.node)||(phase&&phase!==i.phase)||(q&&!i.path.toLowerCase().includes(q)));if(!i.item.hidden)count++;});
        list.querySelectorAll('.cw-artifact-group').forEach(group=>{group.hidden=![...group.querySelectorAll('.cw-artifact-item')].some(i=>!i.hidden);if(node||phase||q)group.querySelector('details').open=!group.hidden;});
        $('cw-evidence-count').textContent=`${count} / ${items.length} 份證據${count?'':' · 沒有符合的檔案，請調整篩選'}`;
      };
      const phases=()=>{const old=phaseSelect.value;phaseSelect.replaceChildren(new Option('全部階段',''),...[...new Set(items.filter(i=>!nodeSelect.value||i.node===nodeSelect.value).map(i=>i.phase))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(v=>new Option(v,v)));if([...phaseSelect.options].some(o=>o.value===old))phaseSelect.value=old;};
      nodeSelect.onchange=()=>{phases();filterFiles();};phaseSelect.onchange=filterFiles;$('cw-evidence-search').oninput=filterFiles;phases();filterFiles();
    }catch(e){if(g===generation)error(e);}};
    $('cw-review-action').onclick=async()=>{
      try{
        const review=await api(url+'/reconciliation');if(g!==generation)return;
        const area=$('cw-review-body'),pre=document.createElement('pre'),form=document.createElement('form');
        pre.textContent=JSON.stringify(review.actions,null,2);
        const label=document.createElement('label'),reason=document.createElement('textarea'),button=document.createElement('button');
        label.textContent='核對依據與處理原因（至少 10 字）';reason.required=true;reason.minLength=10;reason.maxLength=500;label.append(reason);
        button.className='btn';button.textContent='提交核對並請求釋放已確認範圍（需權限）';button.type='submit';form.append(label,button);area.replaceChildren(pre,form);
        form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{
          const result=await api(url+'/reconcile',{reason:reason.value,reviewed_actions_hash:review.reviewed_actions_hash});
          if(g===generation){current=result;paint(url);error();}
        }catch(e){if(g===generation){error(e);button.disabled=false;}}};
      }catch(e){if(g===generation)error(e);}
    };
    paint(url);
    async function poll(){try{const j=await api(url);if(g!==generation)return;current=j;paint(url);error();}catch(e){if(g===generation)error(new Error('瀏覽器連線中斷；將自動重連。執行服務狀態尚未知。'));}finally{if(g===generation&&!end.has(current.state))timer=setTimeout(poll,1500);}}
    if(!end.has(current.state))timer=setTimeout(poll,1500);
  }
  function paint(url){
    const j=current;$('cw-run-title').textContent=j.project+' · '+stateLabel(j.state);$('cw-run-id').textContent=j.id;
    $('cw-environment').textContent=j.synthetic?'測試模式 · 不操作實體設備':'LIVE';
    $('cw-stop').disabled=end.has(j.state)||j.stop_requested;$('cw-stop').textContent=j.stop_requested&&!end.has(j.state)?'停止處理中 · 已派送的動作正在收尾':'停止：不再派送新動作';
    const age=j.heartbeat?Math.max(0,Math.round(Date.now()/1000-j.heartbeat)):null;
    $('cw-freshness').textContent=`畫面更新 ${new Date().toLocaleTimeString()} · 執行服務 ${end.has(j.state)?'任務已終止':age===null?'尚未取得服務更新資訊':age>10?'資料已過期，尚無法確認服務狀態':age+' 秒前'} · ${j.stop_reason||''}`;
    $('cw-summary').textContent=`執行狀態 ${stateLabel(j.state)} · 累積健康 ${stateLabel(j.health)} · 覆蓋 ${j.nodes.filter(n=>n.coverage==='EXERCISED'||(n.coverage===undefined&&n.attempts>0)).length} / ${j.targets.length} 個節點 · 執行狀態與硬體驗證結果分開判定`;
    if(j.pre&&$('cw-pre').dataset.version!==j.pre.version){$('cw-pre').dataset.version=j.pre.version;
      const nameOf=id=>j.targets.find(t=>t.name===id)?.display_name||id;
      const findingCards=j.pre.findings.filter(f=>f.issues.length).map(f=>`<article class="cw-finding"><h4>${esc(nameOf(f.machine_id))}</h4><ul>${f.issues.map(i=>`<li class="cw-issue cw-issue-${esc(String(i.severity).toLowerCase())}"><span class="cw-sev">${esc(i.severity)}</span><span class="cw-code">${esc(i.code)}</span><span class="cw-detail">${esc(i.detail)}</span></li>`).join('')}</ul></article>`).join('')||'<p>未列出異常項目。</p>';
      const excludedCards=j.pre.excluded.map(e=>`<article class="cw-finding cw-finding-blocked"><h4>${esc(nameOf(e.machine_id))} <span class="cw-sev cw-sev-fail">無法執行</span></h4><ul>${e.reasons.map(r=>`<li class="cw-issue cw-issue-fail"><span class="cw-detail">${esc(r)}</span></li>`).join('')}</ul></article>`).join('');
      $('cw-pre').innerHTML=`<h2>PRE 檢查結果</h2><p>版本 <code>${esc(j.pre.version)}</code></p><p>本次確認的目標 ${j.pre.runnable_ids.length} / ${j.targets.length}。</p><details open><summary>檢查結果 / 排除原因 / 影響範圍</summary><div class="cw-findings">${findingCards}${excludedCards}</div><p class="cw-pre-nodes">已納入範圍：${j.targets.map(t=>esc(t.display_name||t.name)).join('、')}</p></details><div class="cw-confirm-bar"><span class="cw-confirm-dot" aria-hidden="true"></span><span class="cw-confirm-hint">PRE 已完成，等待確認後才會開始執行</span><button class="btn primary" id="cw-confirm">確認這份 PRE 與完整影響範圍，開始執行</button></div>`;
      $('cw-confirm').onclick=async()=>{const version=j.pre.version,ids=j.pre.runnable_ids,g=generation;try{$('cw-confirm').disabled=true;const next=await api(url+'/confirm',{version,machine_ids:ids});if(g===generation){current=next;paint(url);}}catch(e){if(g===generation){error(e);$('cw-confirm').disabled=false;}}};}
    if($('cw-confirm'))$('cw-confirm').hidden=j.state!=='AWAITING_CONFIRMATION';
    const confirmBar=$('cw-pre').querySelector('.cw-confirm-bar');if(confirmBar)confirmBar.hidden=j.state!=='AWAITING_CONFIRMATION';
    const preShell=$('cw-pre-shell');if(preShell.dataset.state!==j.state){preShell.open=j.state==='AWAITING_CONFIRMATION';preShell.dataset.state=j.state;}
    $('cw-pre-shell').classList.toggle('cw-awaiting',j.state==='AWAITING_CONFIRMATION');
    if(j.state==='RECONCILIATION_REQUIRED')$('cw-freshness').textContent+=' · 結果未知／待核對／相關資源仍占用';
    $('cw-reconciliation').hidden=j.state!=='RECONCILIATION_REQUIRED';
    paintProgress(j);
    consoleView.setJob(j,url);
  }
  function paintProgress(j){
    const signature=j.targets.map(t=>t.name).join('|');
    if(progressSignature!==signature){
      progressSignature=signature;progressRows.clear();
      const table=document.createElement('table');table.className='cw-progress-table';
      table.innerHTML='<thead><tr><th>機框</th><th>節點 / 階段</th><th>目前輪次</th><th>有效輪數</th><th>本輪 / 累積健康</th></tr></thead><tbody></tbody>';
      const body=table.lastElementChild;
      const groups=new Map();for(const t of j.targets){const key=t.parent_name||t.name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
      for(const group of groups.values())for(const [index,t] of group.entries()){
        const row=document.createElement('tr'),chassis=document.createElement('th'),cell=document.createElement('td');
        chassis.scope='rowgroup';chassis.rowSpan=group.length;chassis.textContent=t.parent_name||t.name;if(index===0)row.append(chassis);row.append(cell);
        const detail=document.createElement('details'),summary=document.createElement('summary'),endpoint=document.createElement('p'),identity=document.createElement('code'),reason=document.createElement('p');
        detail.dataset.node=t.name;endpoint.textContent=(t.os_hostname||'')+' · '+t.os_ip+':'+(t.os_port||22);identity.textContent=t.node_id||t.name;
        const stage=document.createElement('span');stage.className='cw-rowstage cw-idle';stage.setAttribute('aria-hidden','true');
        const label=document.createElement('span');label.className='cw-rowlabel';
        summary.append(stage,label);
        detail.append(summary,endpoint,identity,reason);cell.append(detail);
        const detailGrid=document.createElement('dl');detailGrid.className='cw-progress-detail-grid';detail.append(detailGrid);
        const detailLabels={1:'嘗試次數',2:'POST · 完成採集',3:'Boot · 開機確認',6:'本輪首次 / 累積問題',7:'執行覆蓋'};
        const cells=Array.from({length:8},(_,i)=>{if([0,4,5].includes(i)){const td=document.createElement('td');row.append(td);return td;}const group=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');label.textContent=detailLabels[i];group.append(label,value);detailGrid.append(group);return value;});
        body.append(row);progressRows.set(t.name,{summary,label,reason,cells,stage});
      }
      $('cw-progress').replaceChildren(table);
    }
    const nodes=new Map(j.nodes.map(n=>[n.machine_id,n]));
    const text=(element,value)=>{value=String(value);if(element.textContent!==value)element.textContent=value;};
    const badge=(element,value,cls)=>{value=String(value);if(element.textContent!==value)element.textContent=value;
      // Table verdict cells vs. the expanded <dd> detail cells need different
      // styling hooks; the javascript logic is otherwise the same.
      const base=element.tagName==='DD'?'cw-detail-cell':'cw-cell';const c=base+' '+cls;if(element.className!==c)element.className=c;};
    for(const t of j.targets){
      const n=nodes.get(t.name)||{},row=progressRows.get(t.name);
      row.label.textContent=(t.node||t.slot_key)+' · '+stateLabel(n.stage||j.state);
      text(row.reason,n.stop_reason||'');
      const count=value=>value == null || value === '' || !Number.isFinite(Number(value)) ? '未取得' : Number(value);
      const coverage=n.coverage || (n.attempts != null ? (Number(n.attempts)>0?'EXERCISED':'NOT_EXERCISED') : 'UNKNOWN');
      const values=[count(n.loop),count(n.attempts),count(n.completed),count(n.boot_confirmed),count(n.valid_cycles),
        stateLabel(n.health||'UNKNOWN')+' / '+stateLabel(n.cumulative_health||'UNKNOWN'),count(n.first_this_round)+' / '+count(n.unique_issues),
        stateLabel(coverage)+(n.coverage_reason?' · '+n.coverage_reason:'')];
      values.forEach((value,i)=>text(row.cells[i],value));
      // Health (idx 5), issues (idx 6) and coverage (idx 7) carry a verdict, so
      // colour them; loop counters stay plain numbers.
      badge(row.cells[5],values[5],HEALTH_CLASS(n.cumulative_health||n.health));
      badge(row.cells[6],values[6],n.unique_issues == null && n.first_this_round == null ? 'cw-idle' : (Number(n.unique_issues)>0||Number(n.first_this_round)>0)?'cw-fail':'cw-ok');
      badge(row.cells[7],values[7],HEALTH_CLASS(coverage));
      row.stage.textContent='';row.stage.className='cw-rowstage '+HEALTH_CLASS(n.cumulative_health||n.health);
    }
  }
  window.CycleWorkspace={shell,mount,dispose};
  window.openCycleTest=project=>{
    preselect={project};
    const p=projects.find(x=>x.name===project);
    const target='new'+(p?.project_id?'/'+encodeURIComponent(p.project_id):'/'+encodeURIComponent(project));
    // If the hash is unchanged, the router will not fire hashchange, so force a
    // re-mount; otherwise a stale project_id in the URL would show the wrong project.
    if(location.hash==='#/cycle/'+target){mount();}
    else{link(target);}
  };
  window.openChassisCycle=(project,chassis,node)=>{preselect={project,chassis,node};const p=projects.find(x=>x.name===project);const seg=p?.project_id?encodeURIComponent(p.project_id):encodeURIComponent(project);const target='new/'+seg+'/'+encodeURIComponent(chassis)+(node?'/'+encodeURIComponent(node):'');if(location.hash==='#/cycle/'+target){mount();}else{link(target);}};
})();
