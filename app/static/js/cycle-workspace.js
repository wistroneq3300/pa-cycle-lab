/* Native Next route owner. Only this view owns its timer, requests and console. */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const end=new Set(['COMPLETE','INCOMPLETE','CANCELLED','BLOCKED','ERROR','RECONCILIATION_REQUIRED']);
  let root, generation=0, controller, timer, consoleView, selected=new Set(), inventory=[], current, preselect={}, offset=0, key, progressRows=new Map(), progressSignature="";
  const $=id=>root?.querySelector('#'+id);
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
    $('cw-body').innerHTML=`<h2>持久化任務紀錄</h2><p>COMPLETE 表示流程達到限制，硬體健康另列。停止與中斷的任務仍保留證據。</p><div class="cw-scroll"><table><thead><tr><th>Run / 專案</th><th>執行狀態</th><th>累積健康</th><th>環境</th><th>建立時間</th></tr></thead><tbody>${data.runs.map(j=>`<tr><td><a href="#/cycle/runs/${j.id}">${esc(j.project)} · ${j.id.slice(0,10)}</a></td><td>${esc(j.state)}</td><td>${esc(j.health)}</td><td>${j.synthetic?'SYNTHETIC':'LIVE'}</td><td>${new Date(j.created_at*1000).toLocaleString()}</td></tr>`).join('')||'<tr><td colspan="5">尚無任務。從 Rack 或此頁建立 Cycle。</td></tr>'}</tbody></table></div><div class="cw-actions"><button class="btn" id="cw-prev" ${offset?'':'disabled'}>上一頁</button><button class="btn" id="cw-next" ${data.has_more?'':'disabled'}>下一頁</button></div>`;
    $('cw-prev').onclick=()=>{offset=Math.max(0,offset-25);history().catch(error);};$('cw-next').onclick=()=>{offset+=25;history().catch(error);};
  }
  async function wizard(route=[]){
    const g=generation,data=await api('/api/cycle/inventory');if(g!==generation)return;
    inventory=data.projects;selected=new Set();key=null;
    if(route[0]){
      const project=inventory.find(p=>p.project_id===route[0]);
      if(!project)throw Error('Project unavailable or access denied');
      preselect={project:project.name,chassis:route[1],node:route[2]};
    }
    $('cw-body').innerHTML=`<p class="cw-environment" data-cw-region="environment">${data.mode==='synthetic'?'SYNTHETIC · fake transport，不連接硬體':'LIVE · PRE 可能安裝依賴與上傳 script'}</p><form id="cw-form"><section class="cw-config-section" data-cw-section="settings" aria-labelledby="cw-settings-title"><h2 id="cw-settings-title">Cycle 設定</h2><p class="cw-section-intro">先確認執行模式與限制，再決定這次 Cycle 的目標範圍。</p><div class="cw-form-grid"><label>專案 / Rack<select id="cw-project">${inventory.map(p=>`<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('')}</select></label><label>Profile<input id="cw-profile" readonly aria-label="Activated Project Profile"></label><label>模式<select id="cw-mode"><option value="reboot">OS / BMC Reboot</option><option value="power_cycle">DC Power Cycle</option><option value="aux_cycle">AUX Cycle（需已確認範圍）</option></select></label><label>通道<select id="cw-channel"><option value="inband">Inband</option><option value="outband">Outband</option></select></label><label>Loop 上限<input id="cw-loops" type="number" min="0" max="1000000" value="2"></label><label>小時上限<input id="cw-hours" type="number" min="0" step="0.1" value="0"></label><label>並行 domain 上限<input id="cw-parallel" type="number" min="1" max="32" value="4"></label></div><details id="cw-profile-detail"><summary>Profile 版本、數量與 action（唯讀）</summary><pre id="cw-profile-content"></pre></details><p class="cw-section-note">Inband 仍需 BMC 採集與身分驗證。Power / AUX 的共享範圍必須完整選取；未確認的 live selector 不可執行。</p></section><section class="cw-scope-section" data-cw-section="scope" aria-labelledby="cw-scope-title"><h2 id="cw-scope-title">目標範圍</h2><p class="cw-section-intro">先選 Rack scope，再用搜尋或全選動作確認實際會進入 PRE 的 chassis / node。</p><div class="cw-actions cw-scope-actions"><label>Rack<select id="cw-rack" aria-label="Rack scope"></select></label><label class="cw-search">搜尋 chassis / node / endpoint<input id="cw-search" type="search"></label><button class="btn" type="button" id="cw-visible">全選搜尋結果</button><button class="btn" type="button" id="cw-all">全選 Rack</button><button class="btn" type="button" id="cw-none">取消選取</button></div><div class="cw-scope-summary" aria-live="polite"><span class="cw-scope-summary-label">已選目標</span><p id="cw-count" class="cw-scope-summary-value" role="status"></p></div><div id="cw-matrix" class="cw-matrix"></div></section><div class="cw-actions cw-submit-actions"><button class="btn primary" id="cw-create">建立持久任務並執行 PRE</button><span>有 blocker 的選取不會被靜默略過。</span></div></form>`;
    if(preselect.project&&inventory.some(p=>p.name===preselect.project))$('cw-project').value=preselect.project;
    const targets=()=>inventory.find(p=>p.name===$('cw-project').value)?.targets||[];
    const isRack=t=>(t.level||machines.find(m=>m.name===(t.parent_name||t.name))?.level)==='rack';
    function profileInfo(){
      const p=inventory.find(p=>p.name===$('cw-project').value);
      $('cw-profile').value=p?.profile||'';
      $('cw-profile-content').textContent=p?.profile_detail?JSON.stringify(p.profile_detail,null,2):'尚未設定 Cycle Profile；一般 PA 管理功能仍可使用。';
    }
    function rackLabel(id){
      const project=inventory.find(p=>p.name===$('cw-project').value),projectRacks=project?.topology?.racks||project?.racks||[],target=targets().find(t=>t.rack_id===id&&(t.rack_name||t.rack_label)),machineList=typeof machines!=='undefined'&&Array.isArray(machines)?machines:[],machine=machineList.find(m=>m.id===id||m.rack_id===id||m.name===id),rack=projectRacks.find(r=>r.id===id||r.rack_id===id),name=target?.rack_name||target?.rack_label||rack?.name||rack?.rack_name||machine?.rack_name||machine?.rack_label||'';
      const count=targets().filter(t=>t.rack_id===id).length;
      return name?`${name} · ${count} nodes`:`機櫃 · ${String(id).slice(0,8)} · ${count} nodes`;
    }
    function racks(){
      profileInfo();
      const ids=[...new Set(targets().filter(isRack).map(t=>t.rack_id).filter(Boolean))];
      $('cw-rack').replaceChildren(new Option('Choose rack scope',''),...ids.map(id=>new Option(rackLabel(id),id)));
      if(ids.length===1)$('cw-rack').value=ids[0];
      $('cw-all').disabled=!$('cw-rack').value;
    }
    const rackTargets=()=>targets().filter(t=>isRack(t)&&t.rack_id===$('cw-rack').value);
    const visible=()=>targets().filter(t=>[t.display_name,t.name,t.parent_name,t.os_ip,t.slot_key].join(' ').toLowerCase().includes($('cw-search').value.toLowerCase()));
    function draw(){
      const groups=new Map();for(const t of visible()){const chassis=t.parent_name||t.name;if(!groups.has(chassis))groups.set(chassis,[]);groups.get(chassis).push(t);}
      $('cw-matrix').innerHTML=[...groups].map(([chassis,ts])=>`<section class="cw-chassis"><h3>${esc(chassis)}</h3><div class="cw-nodes">${ts.map(t=>`<label class="cw-node ${t.reasons.length?'has-blocker':''}"><input type="checkbox" value="${esc(t.name)}" ${selected.has(t.name)?'checked':''}><strong>${esc(t.slot_key||t.node)} · ${esc(t.display_name||t.name)}</strong><span>${esc(t.os_hostname||'身分未設定')} · ${esc(t.os_ip)}:${esc(t.os_port||22)}</span><small>${esc(t.reasons.join('；')||'可進入 PRE；硬體尚未驗證')}</small></label>`).join('')}</div></section>`).join('')||'<p>沒有符合搜尋條件的節點。選取仍保留。</p>';
      $('cw-matrix').querySelectorAll('input').forEach(e=>e.onchange=()=>{e.checked?selected.add(e.value):selected.delete(e.value);key=null;count();});count();
    }
    function count(){const ts=targets().filter(t=>selected.has(t.name));$('cw-count').textContent=`已選 ${new Set(ts.map(t=>t.parent_name||t.name)).size} chassis / ${ts.length} nodes · ${ts.filter(t=>t.reasons.length).length} 個目標有缺失`;$('cw-create').disabled=!ts.length;}
    if(preselect.chassis)$('cw-search').value=preselect.chassis;
    for(const t of targets())if(preselect.node&&t.name===preselect.node&&(!preselect.chassis||t.parent_name===preselect.chassis))selected.add(t.name);
    preselect={};racks();draw();$('cw-rack').onchange=()=>{$('cw-all').disabled=!$('cw-rack').value;};$('cw-search').oninput=draw;$('cw-project').onchange=()=>{selected.clear();key=null;const p=inventory.find(p=>p.name===$('cw-project').value);if(p?.project_id)window.history.replaceState(null,'','#/cycle/new/'+encodeURIComponent(p.project_id));racks();draw();};
    $('cw-visible').onclick=()=>{visible().forEach(t=>selected.add(t.name));key=null;draw();};$('cw-all').onclick=()=>{rackTargets().forEach(t=>selected.add(t.name));key=null;draw();};$('cw-none').onclick=()=>{selected.clear();key=null;draw();};
    $('cw-form').oninput=()=>{key=null;};
    $('cw-form').onsubmit=async e=>{e.preventDefault();error();$('cw-create').disabled=true;try{key||=crypto.randomUUID();const j=await api('/api/cycle/runs',{project:$('cw-project').value,machine_ids:[...selected],cycle_profile:$('cw-profile').value,cycle_mode:$('cw-mode').value,channel:$('cw-channel').value,limits:{loops:Number($('cw-loops').value),hours:Number($('cw-hours').value)},parallelism:Number($('cw-parallel').value),idempotency_key:key});if(g===generation)link('runs/'+j.id);}catch(e){if(g===generation){error(e);count();}}};
  }
  async function run(id){
    const g=generation;current=await api('/api/cycle/runs/'+encodeURIComponent(id));if(g!==generation)return;
    $('cw-body').innerHTML=`<p id="cw-environment" class="cw-environment" data-cw-region="environment"></p><div class="cw-run-head"><div><h2 id="cw-run-title"></h2><code id="cw-run-id"></code></div><div class="cw-actions"><button class="btn" id="cw-stop">停止：不再派送新動作</button><button class="btn" id="cw-console-toggle" aria-expanded="false">Live Console</button></div></div><p id="cw-freshness" role="status"></p><div id="cw-summary" class="cw-summary" aria-label="執行摘要"><div class="cw-summary-grid" role="list"><div class="cw-summary-group" data-summary-key="lifecycle" role="listitem"><span class="cw-summary-label">執行狀態</span><strong class="cw-summary-value" data-summary-value="lifecycle"></strong></div><div class="cw-summary-group" data-summary-key="health" role="listitem"><span class="cw-summary-label">累積健康</span><strong class="cw-summary-value" data-summary-value="health"></strong></div><div class="cw-summary-group" data-summary-key="coverage" role="listitem"><span class="cw-summary-label">執行覆蓋</span><strong class="cw-summary-value" data-summary-value="coverage"></strong></div><div class="cw-summary-group" data-summary-key="environment" role="listitem"><span class="cw-summary-label">環境</span><strong class="cw-summary-value" data-summary-value="environment"></strong></div><div class="cw-summary-group" data-summary-key="worker" role="listitem"><span class="cw-summary-label">Worker 狀態</span><strong class="cw-summary-value" data-summary-value="worker"></strong></div></div><p class="cw-summary-note">COMPLETE 不等於 PASS</p></div><section id="cw-reconciliation" hidden><h2>結果未知／待核對／相關資源仍占用</h2><p>核對動作 journal、殘存程序與實際影響範圍後，才能釋放資源。不會重新送出電源命令。</p><button class="btn" id="cw-review-action">檢視待核對動作</button><div id="cw-review-body"></div></section><details id="cw-pre-shell"><summary>PRE／檢視結果與目標範圍</summary><section id="cw-pre"></section></details><div id="cw-console" class="cycle-console" hidden></div><h2 class="cw-progress-title">Chassis / Node 執行進度</h2><p class="cw-progress-glossary">有效輪數：完成必要 boot、POST、身分與 script 驗證的循環；本輪首次：本輪新出現的問題數；健康欄依序顯示本輪／累積。</p><div id="cw-progress" class="cw-scroll"></div><details class="cw-artifacts" data-cw-section="evidence"><summary>證據與報告</summary><button class="btn" id="cw-evidence">載入證據清單</button><ul id="cw-files"></ul></details>`;
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
    async function poll(){try{const j=await api(url);if(g!==generation)return;current=j;paint(url);error();}catch(e){if(g===generation)error(new Error('瀏覽器連線中斷；將自動重連。Worker 狀態尚未知。'));}finally{if(g===generation&&!end.has(current.state))timer=setTimeout(poll,1500);}}
    if(!end.has(current.state))timer=setTimeout(poll,1500);
  }
  function paint(url){
    const j=current;$('cw-run-title').textContent=j.project+' · '+j.state;$('cw-run-id').textContent=j.id;
    $('cw-environment').textContent=j.synthetic?'SYNTHETIC · 未操作真實硬體':'LIVE';
    $('cw-stop').disabled=end.has(j.state)||j.stop_requested;$('cw-stop').textContent=j.stop_requested&&!end.has(j.state)?'STOP_REQUESTED · 已派送者正在收尾':'停止：不再派送新動作';
    const age=j.heartbeat?Math.max(0,Math.round(Date.now()/1000-j.heartbeat)):null;
    const workerStatus=j.state==='RECONCILIATION_REQUIRED'?'待核對；資源仍保留':end.has(j.state)?'已結束':age===null?'尚未取得 heartbeat':age>10?'資料過期，不能據此判斷 Worker 死亡':age+' 秒前';
    $('cw-freshness').textContent=`畫面更新 ${new Date().toLocaleTimeString()} · Worker ${workerStatus} · ${j.stop_reason||''}`;
    const coverageCount=j.nodes.filter(n=>n.coverage==='EXERCISED'||(n.coverage===undefined&&n.attempts>0)).length;
    const summaryValue=(name,value,state)=>{const element=$('cw-summary').querySelector(`[data-summary-value="${name}"]`);if(element){element.textContent=String(value??'');if(state)element.dataset.state=state;}};
    summaryValue('lifecycle',j.state,j.state);summaryValue('health',j.health||'UNKNOWN',j.health||'UNKNOWN');summaryValue('coverage',`${coverageCount} / ${j.targets.length} nodes`);summaryValue('environment',j.synthetic?'SYNTHETIC':'LIVE');summaryValue('worker',workerStatus);
    if(j.pre&&$('cw-pre').dataset.version!==j.pre.version){$('cw-pre').dataset.version=j.pre.version;$('cw-pre').innerHTML=`<h2>不可變 PRE</h2><p>版本 <code>${esc(j.pre.version)}</code></p><p>本次確認的目標 ${j.pre.runnable_ids.length} / ${j.targets.length}。PRE 在 live 可能上傳 script / 安裝依賴。</p><details open><summary>檢查結果／排除原因／影響範圍</summary><ul>${j.pre.findings.filter(f=>f.issues.length).map(f=>`<li>${esc(j.targets.find(t=>t.name===f.machine_id)?.display_name||f.machine_id)}：${f.issues.map(i=>esc(i.severity+' '+i.code+' '+i.detail)).join('；')||'無 finding'}</li>`).join('')}${j.pre.excluded.map(e=>`<li>BLOCKED ${esc(e.machine_id)}：${esc(e.reasons.join('；'))}</li>`).join('')}</ul><p>${j.targets.map(t=>esc((t.display_name||t.name)+' / power='+t.power_domain+' / AUX='+(t.aux_domain||'未設定'))).join('<br>')}</p></details><button class="btn primary" id="cw-confirm">確認這份 PRE 與完整影響範圍，開始執行</button>`;
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
      const table=document.createElement('table');table.className='cw-progress-table';
      table.innerHTML='<thead><tr><th>Chassis</th><th>節點 / 階段</th><th>目前輪次</th><th>有效輪數</th><th>健康（本輪 / 累積）</th></tr></thead><tbody></tbody>';
      const body=table.lastElementChild;
      const groups=new Map();for(const t of j.targets){const key=t.parent_name||t.name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
      for(const group of groups.values())for(const [index,t] of group.entries()){
        const row=document.createElement('tr'),chassis=document.createElement('th'),cell=document.createElement('td');
        row.className='cw-progress-row';chassis.className='cw-progress-chassis';cell.className='cw-progress-node-cell';
        chassis.scope='rowgroup';chassis.rowSpan=group.length;chassis.textContent=t.parent_name||t.name;if(index===0)row.append(chassis);row.append(cell);
        const detail=document.createElement('details'),summary=document.createElement('summary'),endpoint=document.createElement('p'),identity=document.createElement('code'),reason=document.createElement('p');
        detail.className='cw-progress-node';summary.className='cw-progress-node-summary';endpoint.className='cw-progress-endpoint';identity.className='cw-progress-identity';reason.className='cw-progress-reason';detail.dataset.node=t.name;endpoint.textContent=(t.os_hostname||'')+' · '+t.os_ip+':'+(t.os_port||22);identity.textContent=t.node_id||t.name;
        const detailGrid=document.createElement('dl');detailGrid.className='cw-progress-detail-grid';const details={};
        [['attempts','嘗試次數'],['post','POST'],['boot','Boot 確認'],['issues','問題（本輪首次 / 累積不同）'],['coverage','執行覆蓋']].forEach(([key,label])=>{const item=document.createElement('div'),labelElement=document.createElement('dt'),value=document.createElement('dd');item.className='cw-progress-detail-item';item.dataset.detail=key;labelElement.className='cw-progress-detail-label';labelElement.textContent=label;value.className='cw-progress-detail-value';value.dataset.progressDetail=key;item.append(labelElement,value);detailGrid.append(item);details[key]=value;});
        detail.append(summary,endpoint,identity,reason,detailGrid);cell.append(detail);
        const cells=Array.from(['loop','valid-cycles','health'],key=>{const td=document.createElement('td');td.className=`cw-progress-main cw-progress-${key}`;td.dataset.progressMain=key;row.append(td);return td;});
        body.append(row);progressRows.set(t.name,{summary,reason,cells,details});
      }
      $('cw-progress').replaceChildren(table);
    }
    const nodes=new Map(j.nodes.map(n=>[n.machine_id,n]));
    const text=(element,value)=>{value=String(value);if(element.textContent!==value)element.textContent=value;};
    const limits=j.limits||j.config?.limits||{},loopLimit=Number(limits.loops||0),hourLimit=Number(limits.hours||0);
    const stageLabel=stage=>({PRE:'前置檢查 PRE',PRECHECK:'前置檢查 PRECHECK',PRE_RUNNING:'PRE 執行中 PRE_RUNNING',CYCLE:'循環執行 CYCLE',POST:'POST 驗證 POST',POSTCHECK:'POST 檢查 POSTCHECK',RECOVERY:'恢復 RECOVERY',RECOVERING:'恢復中 RECOVERING',DONE:'完成 DONE',QUEUED:'排隊 QUEUED',RUNNING:'執行中 RUNNING',AWAITING_CONFIRMATION:'等待確認 AWAITING_CONFIRMATION',STOP_REQUESTED:'停止請求 STOP_REQUESTED',STOPPING_AFTER_ROUND:'本輪後停止 STOPPING_AFTER_ROUND',WORKER_LOST:'Worker 中斷 WORKER_LOST',BLOCKED:'已阻擋 BLOCKED',INCOMPLETE:'未完成 INCOMPLETE',COMPLETE:'完成 COMPLETE',CANCELLED:'已取消 CANCELLED',ERROR:'錯誤 ERROR',RECONCILIATION_REQUIRED:'待核對 RECONCILIATION_REQUIRED'}[stage]||stage);
    for(const t of j.targets){
      const n=nodes.get(t.name)||{},row=progressRows.get(t.name);
      const stage=n.stage||j.state;text(row.summary,(t.slot_key||t.node)+' · '+stageLabel(stage));text(row.reason,n.stop_reason||'');
      const coverage=(n.coverage||(n.attempts?'EXERCISED':'NOT_EXERCISED'))+(n.coverage_reason?' · '+n.coverage_reason:'');
      const loop=n.loop??0,loopDisplay=loopLimit>0?`${loop} / ${loopLimit}`:hourLimit>0?`${loop} · 時間上限 ${hourLimit} h`:`${loop} · 時間限制`;
      [loopDisplay,n.valid_cycles??0,(n.health||'UNKNOWN')+' / '+(n.cumulative_health||'UNKNOWN')].forEach((value,i)=>text(row.cells[i],value));
      text(row.details.attempts,n.attempts??0);text(row.details.post,n.completed??0);text(row.details.boot,n.boot_confirmed??0);text(row.details.issues,(n.first_this_round??'—')+' / '+(n.unique_issues??0));text(row.details.coverage,coverage);
    }
  }
  window.CycleWorkspace={shell,mount,dispose};
  window.openCycleTest=project=>{preselect={project};const p=projects.find(p=>p.name===project);link('new'+(p?.project_id?'/'+encodeURIComponent(p.project_id):''));};
  window.openChassisCycle=(project,chassis,node)=>{preselect={project,chassis,node};const p=projects.find(p=>p.name===project);link('new'+(p?.project_id?'/'+encodeURIComponent(p.project_id)+'/'+encodeURIComponent(chassis)+(node?'/'+encodeURIComponent(node):''):''));};
})();
