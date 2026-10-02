/* Native Next route owner. Only this view owns its timer, requests and console. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const end=new Set(['COMPLETE','INCOMPLETE','CANCELLED','BLOCKED','ERROR','RECONCILIATION_REQUIRED']);
  // Title-case status labels (RECONCILIATION_REQUIRED -> Reconciliation Required); the raw
  // state string is still used for logic, this is display only.
  const stateLabel=state=>String(state??'').split('_').map(w=>w?w[0].toUpperCase()+w.slice(1).toLowerCase():w).join(' ');
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
      error(e);$('cw-body').innerHTML='<p>Cycle 工作區目前無法載入。既有 Worker 不受此畫面影響。</p><button class="btn" id="cw-retry">重新載入</button>';
      $('cw-retry').onclick=mount;
    }}
  }
  async function history(){
    const g=generation;const data=await api('/api/cycle/runs?offset='+offset);if(g!==generation)return;
    const done=new Set(['COMPLETE','INCOMPLETE','CANCELLED','BLOCKED','ERROR','RECONCILIATION_REQUIRED']);
    $('cw-body').innerHTML=`<h2>持久化任務紀錄</h2><p>COMPLETE 表示流程達到限制，硬體健康另列。停止與中斷的任務仍保留證據。</p><div class="cw-scroll"><table><thead><tr><th>Run / 專案</th><th>執行狀態</th><th>累積健康</th><th>環境</th><th>建立時間</th><th></th></tr></thead><tbody>${data.runs.map(j=>`<tr><td><a href="#/cycle/runs/${j.id}">${esc(j.project)} · ${j.id.slice(0,10)}</a></td><td>${esc(stateLabel(j.state))}</td><td>${esc(stateLabel(j.health))}</td><td>${j.synthetic?'SYNTHETIC':'LIVE'}</td><td>${new Date(j.created_at*1000).toLocaleString()}</td><td><button class="btn cw-del" data-id="${esc(j.id)}" data-project="${esc(j.project)}" ${done.has(j.state)?'':'disabled title="執行中或等待確認的任務無法刪除"'}>刪除</button></td></tr>`).join('')||'<tr><td colspan="6">尚無任務。從 Rack 或此頁建立 Cycle。</td></tr>'}</tbody></table></div><div class="cw-actions"><button class="btn" id="cw-prev" ${offset?'':'disabled'}>上一頁</button><button class="btn" id="cw-next" ${data.has_more?'':'disabled'}>下一頁</button></div>`;
    $('cw-prev').onclick=()=>{offset=Math.max(0,offset-25);history().catch(error);};$('cw-next').onclick=()=>{offset+=25;history().catch(error);};
    $('cw-body').querySelectorAll('.cw-del').forEach(b=>b.onclick=()=>deleteRun(b.dataset.id,b.dataset.project,b));
  }
  async function deleteRun(id,project,button){
    if(!confirm(`確定刪除任務 ${project} · ${id.slice(0,10)}？\n此動作會一併刪除該任務的證據與 log 資料夾，無法復原。`))return;
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
      if(!project)throw Error('Project unavailable or access denied');
      preselect={project:project.name,chassis:route[1],node:route[2]};
    }
    $('cw-body').innerHTML=`<p class="cw-environment">${data.mode==='synthetic'?'SYNTHETIC · fake transport，不連接硬體':'LIVE · PRE 可能安裝依賴與上傳 script'}</p><form id="cw-form"><input type="hidden" id="cw-profile"><div class="cw-form-grid"><label>專案 / Rack<select id="cw-project">${inventory.map(p=>`<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('')}</select></label><label>模式<select id="cw-mode"><option value="reboot">Reboot</option><option value="power_cycle">DC Power Cycle</option><option value="aux_cycle">AUX Cycle（需已確認範圍）</option></select></label><label>通道<select id="cw-channel"><option value="inband">Inband</option><option value="outband">Outband</option></select></label><label>執行方式<select id="cw-limit-kind"><option value="" selected>請選擇…</option><option value="loops">loop 幾 run</option><option value="hours">hr 幾小時</option></select></label><label>次數 / 時數<input id="cw-limit-value" type="number" min="0" step="any" placeholder="例如 10 = 執行 10 個 run，或 2 = 執行 2 小時後停止"></label></div><p id="cw-project-error" class="cw-project-error" role="alert" hidden></p><p>執行前系統會先連線檢查每台主機的 OS / BMC hostname。</p><div class="cw-actions"><label class="cw-search">搜尋 chassis / node / endpoint<input id="cw-search" type="search"></label><button class="btn" type="button" id="cw-visible">全選搜尋結果</button><button class="btn" type="button" id="cw-none">取消選取</button></div><p id="cw-count" role="status"></p><div id="cw-matrix" class="cw-matrix"></div><div class="cw-actions"><button class="btn primary" id="cw-create">建立持久任務並執行 PRE</button><span>有 blocker 的選取不會被靜默略過。</span></div></form>`;
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
      $('cw-matrix').innerHTML=[...groups].map(([chassis,ts])=>`<section class="cw-chassis"><h3>${esc(chassis)}</h3><div class="cw-nodes">${ts.map(t=>`<label class="cw-node ${t.reasons.length?'has-blocker':''}"><input type="checkbox" value="${esc(t.name)}" ${selected.has(t.name)?'checked':''}><strong>${esc(t.os_hostname||t.node||t.name)}</strong><span>${esc(t.os_ip)}:${esc(t.os_port||22)}</span><small>${esc(t.reasons.join('；')||'可進入 PRE；硬體尚未驗證')}</small></label>`).join('')}</div></section>`).join('')||'<p>沒有符合搜尋條件的節點。選取仍保留。</p>';
      $('cw-matrix').querySelectorAll('input').forEach(e=>e.onchange=()=>{e.checked?selected.add(e.value):selected.delete(e.value);key=null;count();});count();
    }
    function count(){const ts=targets().filter(t=>selected.has(t.name));$('cw-count').textContent=`已選 ${new Set(ts.map(t=>t.parent_name||t.name)).size} chassis / ${ts.length} nodes · ${ts.filter(t=>t.reasons.length).length} 個目標有缺失`;$('cw-create').disabled=!ts.length;}
    if(preselect.chassis)$('cw-search').value=preselect.chassis;
    for(const t of targets())if(preselect.node&&t.name===preselect.node&&(!preselect.chassis||t.parent_name===preselect.chassis))selected.add(t.name);
    preselect={};profileInfo();draw();$('cw-search').oninput=draw;$('cw-project').onchange=()=>{selected.clear();key=null;const p=inventory.find(p=>p.name===$('cw-project').value);if(p?.project_id)window.history.replaceState(null,'','#/cycle/new/'+encodeURIComponent(p.project_id));profileInfo();draw();};
    $('cw-visible').onclick=()=>{visible().forEach(t=>selected.add(t.name));key=null;draw();};$('cw-none').onclick=()=>{selected.clear();key=null;draw();};
    $('cw-form').oninput=()=>{key=null;};
    $('cw-form').onsubmit=async e=>{e.preventDefault();error();
      const kind=$('cw-limit-kind').value, raw=$('cw-limit-value').value;
      if(!kind){error(new Error('請選擇執行方式（loop 幾 run 或 hr 幾小時）'));return;}
      const num=Number(raw);
      if(!raw || !isFinite(num) || num<=0 || (kind==='loops'&&!Number.isInteger(num))){error(new Error('請輸入有效的'+(kind==='loops'?'run 數（正整數）':'小時數（正數）')));return;}
      const limits=kind==='loops'?{loops:num,hours:0}:{loops:0,hours:num};
      $('cw-create').disabled=true;try{key||=newKey();const j=await api('/api/cycle/runs',{project:$('cw-project').value,machine_ids:[...selected],cycle_profile:$('cw-profile').value,cycle_mode:$('cw-mode').value,channel:$('cw-channel').value,limits,idempotency_key:key});if(g===generation)link('runs/'+j.id);}catch(e){if(g===generation){error(e);count();}}};
  }
  async function run(id){
    const g=generation;current=await api('/api/cycle/runs/'+encodeURIComponent(id));if(g!==generation)return;
    $('cw-body').innerHTML=`<p id="cw-environment" class="cw-environment"></p><div class="cw-run-head"><div><h2 id="cw-run-title"></h2><code id="cw-run-id"></code></div><div class="cw-actions"><button class="btn" id="cw-stop">停止：不再派送新動作</button><button class="btn" id="cw-console-toggle" aria-expanded="false">Live Console</button></div></div><p id="cw-freshness" role="status"></p><div id="cw-summary" class="cw-summary"></div><section id="cw-reconciliation" hidden><h2>結果未知／待核對／相關資源仍占用</h2><p>核對動作 journal、殘存程序與實際影響範圍後，才能釋放資源。不會重新送出電源命令。</p><button class="btn" id="cw-review-action">檢視待核對動作</button><div id="cw-review-body"></div></section><details id="cw-pre-shell"><summary>PRE / reviewed findings and scope</summary><section id="cw-pre"></section></details><div id="cw-console" class="cycle-console" hidden></div><h2>Chassis / Node 執行進度</h2><div id="cw-progress" class="cw-scroll"></div><details><summary>test report</summary><button class="btn" id="cw-evidence">test report</button><ul id="cw-files"></ul></details>`;
    consoleView=new CycleConsole($('cw-console'),$('cw-console-toggle'));const url=`/api/projects/${encodeURIComponent(current.project)}/cycle/jobs/${id}`;
    $('cw-stop').onclick=async()=>{try{current=await api(url+'/stop',{});if(g===generation)paint(url);}catch(e){if(g===generation)error(e);}};
    $('cw-evidence').onclick=async()=>{try{const result=await api(url+'/artifacts');if(g!==generation)return;$('cw-files').replaceChildren();for(const path of result.files){const li=document.createElement('li'),a=document.createElement('a');a.textContent=path;a.href=url+'/files/'+path.split('/').map(encodeURIComponent).join('/');a.target='_blank';a.rel='noopener';li.append(a);$('cw-files').append(li);}}catch(e){if(g===generation)error(e);}};
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
    async function poll(){try{const j=await api(url);if(g!==generation)return;current=j;paint(url);error();}catch(e){if(g===generation)error(new Error('瀏覽器連線中斷；將自動重連。Worker 狀態尚未知。'));}finally{if(g===generation&&!end.has(current.state))timer=setTimeout(poll,1500);}}
    if(!end.has(current.state))timer=setTimeout(poll,1500);
  }
  function paint(url){
    const j=current;$('cw-run-title').textContent=j.project+' · '+stateLabel(j.state);$('cw-run-id').textContent=j.id;
    $('cw-environment').textContent=j.synthetic?'SYNTHETIC · 未操作真實硬體':'LIVE';
    $('cw-stop').disabled=end.has(j.state)||j.stop_requested;$('cw-stop').textContent=j.stop_requested&&!end.has(j.state)?'Stop requested · 已派送者正在收尾':'停止：不再派送新動作';
    const age=j.heartbeat?Math.max(0,Math.round(Date.now()/1000-j.heartbeat)):null;
    $('cw-freshness').textContent=`畫面更新 ${new Date().toLocaleTimeString()} · Worker ${end.has(j.state)?'任務已終止':age===null?'尚未取得 heartbeat':age>10?'資料過期，不能據此判斷 Worker 死亡':age+' 秒前'} · ${j.stop_reason||''}`;
    $('cw-summary').textContent=`Lifecycle ${stateLabel(j.state)} · 累積健康 ${stateLabel(j.health)} · 覆蓋 ${j.nodes.filter(n=>n.coverage==='EXERCISED'||(n.coverage===undefined&&n.attempts>0)).length} / ${j.targets.length} nodes · COMPLETE 不等於 PASS`;
    if(j.pre&&$('cw-pre').dataset.version!==j.pre.version){$('cw-pre').dataset.version=j.pre.version;
      const nameOf=id=>j.targets.find(t=>t.name===id)?.display_name||id;
      const findingCards=j.pre.findings.filter(f=>f.issues.length).map(f=>`<article class="cw-finding"><h4>${esc(nameOf(f.machine_id))}</h4><ul>${f.issues.map(i=>`<li class="cw-issue cw-issue-${esc(String(i.severity).toLowerCase())}"><span class="cw-sev">${esc(i.severity)}</span><span class="cw-code">${esc(i.code)}</span><span class="cw-detail">${esc(i.detail)}</span></li>`).join('')}</ul></article>`).join('')||'<p>無 finding。</p>';
      const excludedCards=j.pre.excluded.map(e=>`<article class="cw-finding cw-finding-blocked"><h4>${esc(nameOf(e.machine_id))} <span class="cw-sev cw-sev-fail">BLOCKED</span></h4><ul>${e.reasons.map(r=>`<li class="cw-issue cw-issue-fail"><span class="cw-detail">${esc(r)}</span></li>`).join('')}</ul></article>`).join('');
      $('cw-pre').innerHTML=`<h2>不可變 PRE</h2><p>版本 <code>${esc(j.pre.version)}</code></p><p>本次確認的目標 ${j.pre.runnable_ids.length} / ${j.targets.length}。PRE 在 live 可能上傳 script / 安裝依賴。</p><details open><summary>Findings / 排除原因 / 影響範圍</summary><div class="cw-findings">${findingCards}${excludedCards}</div><p class="cw-pre-nodes">已納入範圍：${j.targets.map(t=>esc(t.display_name||t.name)).join('、')}</p></details><button class="btn primary" id="cw-confirm">確認這份 PRE 與完整影響範圍，開始執行</button>`;
      $('cw-confirm').onclick=async()=>{const version=j.pre.version,ids=j.pre.runnable_ids,g=generation;try{$('cw-confirm').disabled=true;const next=await api(url+'/confirm',{version,machine_ids:ids});if(g===generation){current=next;paint(url);}}catch(e){if(g===generation){error(e);$('cw-confirm').disabled=false;}}};}
    if($('cw-confirm'))$('cw-confirm').hidden=j.state!=='AWAITING_CONFIRMATION';
    const preShell=$('cw-pre-shell');if(preShell.dataset.state!==j.state){preShell.open=j.state==='AWAITING_CONFIRMATION';preShell.dataset.state=j.state;}
    if(j.state==='RECONCILIATION_REQUIRED')$('cw-freshness').textContent+=' · 結果未知／待核對／相關資源仍占用';
    $('cw-reconciliation').hidden=j.state!=='RECONCILIATION_REQUIRED';
    paintProgress(j);
    consoleView.setJob(j,url);
  }
  function paintProgress(j){
    const signature=j.targets.map(t=>t.name).join('|');
    if(progressSignature!==signature){
      progressSignature=signature;progressRows.clear();
      const table=document.createElement('table');
      table.innerHTML='<thead><tr><th>Chassis</th><th>Node / phase</th><th>Loop</th><th>Attempts</th><th>POST</th><th>Boot</th><th>Valid</th><th>Current / cumulative health</th><th>First / unique issues</th><th>Coverage</th></tr></thead><tbody></tbody>';
      const body=table.lastElementChild;
      const groups=new Map();for(const t of j.targets){const key=t.parent_name||t.name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
      for(const group of groups.values())for(const [index,t] of group.entries()){
        const row=document.createElement('tr'),chassis=document.createElement('th'),cell=document.createElement('td');
        chassis.scope='rowgroup';chassis.rowSpan=group.length;chassis.textContent=t.parent_name||t.name;if(index===0)row.append(chassis);row.append(cell);
        const detail=document.createElement('details'),summary=document.createElement('summary'),endpoint=document.createElement('p'),identity=document.createElement('code'),reason=document.createElement('p');
        detail.dataset.node=t.name;endpoint.textContent=(t.os_hostname||'')+' · '+t.os_ip+':'+(t.os_port||22);identity.textContent=t.node_id||t.name;
        detail.append(summary,endpoint,identity,reason);cell.append(detail);
        const cells=Array.from({length:8},()=>{const td=document.createElement('td');row.append(td);return td;});
        body.append(row);progressRows.set(t.name,{summary,reason,cells});
      }
      $('cw-progress').replaceChildren(table);
    }
    const nodes=new Map(j.nodes.map(n=>[n.machine_id,n]));
    const text=(element,value)=>{value=String(value);if(element.textContent!==value)element.textContent=value;};
    for(const t of j.targets){
      const n=nodes.get(t.name)||{},row=progressRows.get(t.name);
      text(row.summary,(t.node||t.slot_key)+' · '+stateLabel(n.stage||j.state));text(row.reason,n.stop_reason||'');
      const values=[n.loop||0,n.attempts||0,n.completed||0,n.boot_confirmed||0,n.valid_cycles||0,
        stateLabel(n.health||'UNKNOWN')+' / '+stateLabel(n.cumulative_health||'UNKNOWN'),(n.first_this_round??'—')+' / '+(n.unique_issues||0),
        stateLabel(n.coverage||(n.attempts?'EXERCISED':'NOT_EXERCISED'))+(n.coverage_reason?' · '+n.coverage_reason:'')];
      values.forEach((value,i)=>text(row.cells[i],value));
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
