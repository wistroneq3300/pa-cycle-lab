/* Engineering information design. No endpoint, inventory or command mutation. */
(() => {
  'use strict';
  const list = v => Array.isArray(v) ? v : [];
  const missing = '\u672a\u53d6\u5f97';
  const display = v => v == null || v === '' ? missing : String(v);
  const finite = v => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));
  function connectivity(items, side) {
    const eligible = items.filter(m => m.mgx_type !== 'blanking' && m[side + '_ip']);
    const online = eligible.filter(m => m[side + '_alive'] === true).length;
    const offline = eligible.filter(m => m[side + '_alive'] === false).length;
    return {total:eligible.length,online,offline,unknown:eligible.length-online-offline,rate:eligible.length?Math.round(online/eligible.length*100):null};
  }
  function sensorRow(raw) {
    const cells = String(raw).split('|').map(v => v.trim());
    const status = cells.length > 2 ? cells[2].toLowerCase() : 'unknown';
    const state = /^(ok|normal)$/.test(status) ? 'ok' : /^(ns|na|n\/a|nr|no reading)$/.test(status) ? 'unknown' : /cr|nr|critical/.test(status) ? 'critical' : /nc|warn/.test(status) ? 'warning' : 'unknown';
    return {name:cells[0],value:cells[1] || missing,status,state,raw:String(raw)};
  }
  const helpers = window.PAEngineering = {connectivity,sensorRow,finite};
  if (typeof RENDERERS === 'undefined') return;
  const q = v => esc(JSON.stringify(String(v)));
  const table = (head, rows) => `<div class="eng-table-scroll"><table class="eng-table"><thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${esc(display(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const section = (id, label, note, body) => `<section class="eng-section hw-item" id="eng-hw-${id}"><header><h3>${label}</h3><span>${esc(note)}</span></header><div class="eng-hw-controls"><button class="btn small" aria-expanded="true" onclick="engToggleHardware('${id}',this)">\u6536\u5408</button><input class="input" type="search" aria-label="${label} \u641c\u5c0b" placeholder="\u641c\u5c0b\u6b64\u985e\u786c\u9ad4" oninput="engSearchHardware('${id}',this.value)"><button class="btn small" onclick="engCopyHardware('${id}')">\u8907\u88fd\u53ef\u898b\u8cc7\u6599</button><span class="eng-hw-feedback" role="status"></span></div><div class="eng-hw-content">${body}</div></section>`;
  const empty = label => `<p class="eng-empty">${label}</p>`;
  const rowsOrEmpty = (value, head, rows) => !Array.isArray(value) ? empty('\u4f86\u6e90\u672a\u56de\u5831\u6b64\u985e\u578b\u6e05\u55ae') : value.length ? table(head, rows) : empty('\u672c\u6b21\u56de\u5831\u672a\u5217\u51fa\u88dd\u7f6e');
  const baseHardware = hwHtml;
  hwHtml = function(oi) {
    if (!oi?.hw || typeof oi.hw !== 'object') return baseHardware(oi);
    const _memMain = d => d && d.count != null ? `${d.count} \u689d DIMM` : '';
    const _memNote = d => [list(d?.types).join(' / '), list(d?.speeds).join(' / '), list(d?.manufacturers||[]).join(' / ')].filter(Boolean).join(' \u00b7 ');
    const hw=oi.hw,cpu=hw.cpu||{},mem=hw.dimm||{},s=Number(cpu.sockets),c=Number(cpu.cores),t=Number(cpu.threads);
    const totals=s>0&&c>0 ? `${s*c} \u6838\u5fc3${t>0?` / ${s*c*t} \u57f7\u884c\u7dd2`:''}` : missing;
    const stamp=oi.hw_fetched_at||oi.fetched_at;
    const summaries=[['cpu','CPU',cpu.model||missing,totals],['memory','\u8a18\u61b6\u9ad4',_memMain(mem)||missing,_memNote(mem)||missing],['storage','\u5132\u5b58',Array.isArray(hw.ssd)?`${hw.ssd.length} \u500b\u88dd\u7f6e`:missing,'SSD / NVMe'],['gpu','\u52a0\u901f\u5668',Array.isArray(hw.gpu)?`${hw.gpu.length} GPU`:missing,'GPU'],['network','\u7db2\u8def',Array.isArray(hw.nic)?`${hw.nic.length} PCI \u7d00\u9304`:missing,'Ethernet / InfiniBand']];
    let html=`<div class="eng-inventory"><div class="eng-provenance"><span>\u786c\u9ad4\u63a1\u96c6\u5feb\u7167</span><span>${esc(stamp||'\u4f86\u6e90\u672a\u63d0\u4f9b\u63a1\u96c6\u6642\u9593')}${oi.cached_note?` \u00b7 ${esc(oi.cached_note)}`:''}</span></div><nav class="eng-inventory-nav" aria-label="\u786c\u9ad4\u5206\u985e">${summaries.map(([id,label,value,note])=>`<button type="button" onclick="engFocusHardware('${id}')"><small>${label}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></button>`).join('')}</nav>`;
    html+=section('cpu','CPU','\u4f9d\u56de\u5831\u8cc7\u6599\u8a08\u7b97\uff0c\u4e0d\u63a8\u6e2c\u63d2\u69fd\u914d\u7f6e',hw.cpu?table(['\u578b\u865f','Socket','\u6bcf Socket \u6838\u5fc3','\u6bcf\u6838\u57f7\u884c\u7dd2','\u7e3d\u8a08'],[[cpu.model,cpu.sockets,cpu.cores,cpu.threads,totals]]):empty(missing));
    html+=section('memory','DIMM','\u76ee\u524d API \u56de\u5831\u532f\u7e3d\uff0c\u672a\u63d0\u4f9b\u9010\u63d2\u69fd\u8cc7\u6599',hw.dimm?table(['\u6578\u91cf','\u985e\u578b','\u901f\u5ea6','\u5ee0\u5546'],[[mem.count,list(mem.types).join(' / '),list(mem.speeds).join(' / '),list(mem.manufacturers||[]).join(' / ')]]):empty(missing));
    html+=section('storage','\u5132\u5b58\u88dd\u7f6e','\u4fdd\u7559\u5168\u90e8\u56de\u5831\u88dd\u7f6e',rowsOrEmpty(hw.ssd,['\u88dd\u7f6e','\u578b\u865f','\u5bb9\u91cf'],list(hw.ssd).map(d=>[d.name,d.model,d.size])));
    html+=section('gpu','GPU / \u52a0\u901f\u5668','\u6e05\u55ae\u6b21\u5e8f\u4e0d\u4ee3\u8868\u5be6\u9ad4\u63d2\u69fd\u4f4d\u7f6e',rowsOrEmpty(hw.gpu,['\u7d00\u9304','\u578b\u865f','\u8a18\u61b6\u9ad4','\u56de\u5831\u4f7f\u7528\u7387'],list(hw.gpu).map((g,i)=>[g.index??i,g.name,g.mem,g.util])));
    const nics=list(hw.nic).map(n=>{const raw=typeof n==='string'?n:display(n.model);const match=raw.match(/^([\da-f:.]+)\s+(.+?)\s+controller:\s*(.*)$/i);return match?[match[1],match[2],match[3]]:[missing,'PCI',raw];});
    html+=section('network','NIC / \u7db2\u8def','PCI \u529f\u80fd\u7d00\u9304\u6578\u4e0d\u7b49\u65bc\u5be6\u9ad4\u57e0\u6578\uff1bLink \u8207\u57e0\u901f\u7387\u672a\u56de\u5831',rowsOrEmpty(hw.nic,['PCI \u4f4d\u5740','\u985e\u578b','\u578b\u865f'],nics));
    html+=oi.raw?`<details class="hw-raw"><summary>\u539f\u59cb\u63a1\u96c6\u8f38\u51fa</summary><pre>${esc(oi.raw)}</pre></details>`:'';
    return html+'</div>';
  };

  window.engToggleHardware=(id,button)=>{const body=document.querySelector('#eng-hw-'+id+' .eng-hw-content');body.hidden=!body.hidden;button.setAttribute('aria-expanded',String(!body.hidden));button.textContent=body.hidden?'\u5c55\u958b':'\u6536\u5408';};
  window.engSearchHardware=(id,value)=>{const section=document.getElementById('eng-hw-'+id),rows=[...section.querySelectorAll('tbody tr')],term=value.trim().toLocaleLowerCase();rows.forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase().includes(term));section.querySelector('.eng-hw-feedback').textContent=`${rows.filter(r=>!r.hidden).length} / ${rows.length}`;};
  window.engCopyHardware=async id=>{const section=document.getElementById('eng-hw-'+id),rows=[...section.querySelectorAll('tr')].filter(r=>!r.hidden);const text=rows.map(row=>[...row.cells].map(c=>c.textContent.trim()).join('\t')).join('\n');const status=section.querySelector('.eng-hw-feedback');try{await navigator.clipboard.writeText(text);status.textContent='\u5df2\u8907\u88fd';}catch(error){status.textContent='\u7121\u6cd5\u5b58\u53d6\u526a\u8cbc\u7c3f\uff0c\u8acb\u624b\u52d5\u8907\u88fd';}};
  window.engFocusHardware=id=>{const node=document.getElementById('eng-hw-'+id);if(!node)return;const body=node.querySelector('.eng-hw-content');if(body?.hidden)engToggleHardware(id,node.querySelector('[aria-expanded]'));node.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});node.setAttribute('tabindex','-1');node.focus({preventScroll:true});node.classList.remove('eng-highlight');void node.offsetWidth;node.classList.add('eng-highlight');};

  const baseSensors=machineSensorsHtml;
  machineSensorsHtml=function(d,base,name){
    const root=document.createElement('div');root.innerHTML=baseSensors(d,base,name);
    const box=root.querySelector('.sdr-scroll'),entries=list(d?.sensors?.entries);
    if(box){
      box.innerHTML=table(['\u611f\u6e2c\u5668','\u8b80\u503c\uff0f\u55ae\u4f4d','\u56de\u5831\u72c0\u614b'],entries.map(raw=>{const row=sensorRow(raw);return[row.name,row.value,row.status];}));
      box.querySelectorAll('tbody tr').forEach((row,i)=>{row.dataset.sensorState=sensorRow(entries[i]).state;row.title=entries[i];});
      box.insertAdjacentHTML('beforebegin',`<div class="eng-sensor-tools"><label>\u641c\u5c0b\u611f\u6e2c\u5668<input type="search" oninput="engFilterSensors()" id="eng-sensor-search"></label><label>\u72c0\u614b<select id="eng-sensor-state" onchange="engFilterSensors()"><option value="all">\u5168\u90e8</option><option value="attention">\u9700\u78ba\u8a8d</option><option value="ok">\u6b63\u5e38</option></select></label><span id="eng-sensor-count" role="status">${entries.length} / ${entries.length}</span></div>`);
      const ai=root.querySelector('.ew-analysis');if(ai)root.append(ai);
      root.querySelector('#sensor-ai .hint')?.remove();
    }
    return root.innerHTML;
  };
  sensorAiHtml=function(text){return `<p class="eng-ai-copy">${esc(text||'\u66ab\u7121\u5206\u6790')}</p><small>\u8f14\u52a9\u5224\u8b80\uff1b\u8acb\u4ee5\u4e0a\u65b9\u539f\u59cb\u8b80\u503c\u8207\u8a2d\u5099\u898f\u683c\u70ba\u6e96\u3002</small>`;};
  window.engFilterSensors=()=>{const query=(document.getElementById('eng-sensor-search')?.value||'').toLowerCase(),mode=document.getElementById('eng-sensor-state')?.value,rows=[...document.querySelectorAll('.sdr-scroll tbody tr')];let visible=0;rows.forEach(row=>{row.hidden=!row.textContent.toLowerCase().includes(query)||(mode==='ok'&&row.dataset.sensorState!=='ok')||(mode==='attention'&&row.dataset.sensorState==='ok');if(!row.hidden)visible++;});const count=document.getElementById('eng-sensor-count');if(count)count.textContent=`${visible} / ${rows.length}`;};

  const baseDashboard=RENDERERS.dashboard;
  RENDERERS.dashboard=function(){
    const root=document.createElement('div');root.innerHTML=baseDashboard();
    const os=connectivity(machines,'os'),bmc=connectivity(machines,'bmc');
    const overview=root.querySelector('.dash-mid');
    if(overview)overview.innerHTML=`<section class="eng-health"><header><h3>\u9023\u7dda\u72c0\u614b</h3><span>\u5206\u958b\u8a08\u7b97\u5404\u7ba1\u7406\u4ecb\u9762\uff1b\u88ab\u52d5\u5143\u4ef6\u4e0d\u7d0d\u5165</span></header>${[['OS',os],['BMC',bmc]].map(([label,v])=>`<div class="eng-health-row"><b>${label}</b><strong>${v.rate==null?'\u2014':v.rate+'%'}</strong><span>${v.online} / ${v.total} \u5df2\u9023\u7dda</span><span>${v.offline} \u96e2\u7dda</span><span>${v.unknown} \u672a\u77e5</span></div>`).join('')}<p>\u9023\u7dda\u4e0d\u7b49\u65bc\u786c\u9ad4\u5065\u5eb7\uff1b\u8acb\u642d\u914d\u611f\u6e2c\u5668\u8207\u8a3a\u65b7\u5224\u8b80\u3002</p></section>`;
    const note=overview?.querySelector('.eng-health header span');if(note)note.textContent='\u5404\u4ecb\u9762\u5206\u958b\u8a08\u7b97\uff1b\u6392\u9664\u672a\u8a2d\u5b9a\u8a72 IP \u7684\u5143\u4ef6\u8207\u64cb\u677f';
    const intro=root.querySelector('#cop-box .cop-bubble');if(intro&&intro.textContent.includes('\u76ee\u524d\u5df2\u76e3\u63a7'))intro.textContent=`\u5de5\u7a0b\u52a9\u7406\uff1a${machines.length} \u500b\u8a2d\u5099\uff0f\u5143\u4ef6\u7d00\u9304\u3002OS ${os.online}/${os.total} \u5df2\u9023\u7dda\uff0cBMC ${bmc.online}/${bmc.total} \u5df2\u9023\u7dda\u3002\u53ef\u67e5\u8a62\u5c08\u6848\u8207\u8a2d\u5099\u72c0\u614b\u3002`;
    const health=root.querySelector('.cine-fleet-health');if(health)health.innerHTML=`<span class="cine-kicker">OS \u9023\u7dda</span><div class="cine-connectivity">${machines.filter(m=>m.mgx_type!=='blanking'&&m.os_ip).map(m=>`<i class="${m.os_alive===true?'on':m.os_alive===false?'off':'unknown'}" title="${esc(m.name)}"></i>`).join('')}</div><p><b>${os.online}</b> \u5df2\u9023\u7dda / ${os.total} \u5df2\u8a2d\u5b9a OS \u4ecb\u9762</p>`;
    const attention=root.querySelector('.cine-attention strong');if(attention)attention.innerHTML=`${os.offline}<small>OS \u96e2\u7dda</small>`;
    const preview=!!window.PA_PREVIEW;
    const flag=root.querySelector('.cine-fleet-total small');if(flag)flag.textContent=preview?'Fixture / \u6a21\u64ec\u8cc7\u6599':'API / \u8a2d\u5099\u72c0\u614b\u5feb\u7167';
    const footer=root.querySelector('.cine-footer span:nth-child(2)');if(footer)footer.textContent=preview?'\u7368\u7acb UI \u9810\u89bd \u00b7 \u672a\u9023\u63a5\u6b63\u5f0f FastAPI':'\u8cc7\u6599\u4f86\u6e90\uff1a\u76ee\u524d FastAPI \u670d\u52d9';
    const snapshot=root.querySelector('.cine-insights-title>span');if(snapshot)snapshot.textContent=preview?'Fixture \u72c0\u614b\u5feb\u7167':'API \u72c0\u614b\u5feb\u7167';
    return root.innerHTML;
  };

  let density='comfortable';try{density=localStorage.getItem('pa_density')==='compact'?'compact':'comfortable';}catch{}
  let statusFilter='all';
  document.documentElement.dataset.density=density;
  const baseProjects=RENDERERS.projects;
  RENDERERS.projects=function(){const root=document.createElement('div');root.innerHTML=baseProjects();const toolbar=root.querySelector('.p-operations');toolbar?.insertAdjacentHTML('beforeend',`<div class="eng-list-tools"><label>\u72c0\u614b<select aria-label="\u7be9\u9078\u9023\u7dda\u72c0\u614b" onchange="engStatusFilter(this.value)">${[['all','\u5168\u90e8'],['os-offline','OS \u96e2\u7dda'],['bmc-offline','BMC \u96e2\u7dda'],['unknown','\u672a\u77e5']].map(([v,t])=>`<option value="${v}" ${statusFilter===v?'selected':''}>${t}</option>`).join('')}</select></label><button class="btn" onclick="engDensity()" aria-pressed="${density==='compact'}">\u7dca\u6e4a\u986f\u793a</button><span id="eng-filter-count" role="status"></span></div>`);return root.innerHTML;};
  window.engDensity=()=>{density=density==='compact'?'comfortable':'compact';document.documentElement.dataset.density=density;try{localStorage.setItem('pa_density',density);}catch{}document.querySelector('[onclick="engDensity()"]')?.setAttribute('aria-pressed',String(density==='compact'));};
  function filterRows(){let shown=0;document.querySelectorAll('#proj-sort-list tbody tr').forEach(row=>{const name=row.querySelector('.mach-link b')?.textContent,m=machines.find(m=>m.name===name);if(!m)return;const hide=statusFilter==='os-offline'?(!m.os_ip||m.os_alive!==false):statusFilter==='bmc-offline'?(!m.bmc_ip||m.bmc_alive!==false):statusFilter==='unknown'?!((m.os_ip&&m.os_alive==null)||(m.bmc_ip&&m.bmc_alive==null)):false;row.classList.toggle('eng-filtered',hide);if(!hide&&!row.hidden&&row.style.display!=='none'&&!row.closest('.proj-card')?.hidden)shown++;});const count=document.getElementById('eng-filter-count');if(count)count.textContent=`${shown} \u7b46\u7b26\u5408\u72c0\u614b`;}
  window.engStatusFilter=value=>{statusFilter=value;filterRows();};
  const baseFilter=window.productFilter;window.productFilter=function(...args){const result=baseFilter(...args);filterRows();return result;};
  const baseRender=_renderMachine;_renderMachine=function(...args){const result=baseRender(...args);filterRows();return result;};

  const baseDevices=devicesHtml;
  devicesHtml=function(members,pinged){const root=document.createElement('div');root.innerHTML=baseDevices(members,pinged);root.querySelectorAll('tbody tr').forEach(row=>{const name=row.querySelector('a')?.textContent,m=members.find(m=>m.name===name);if(!m)return;const u=Number(m.rack_u),height=Number(m.rack_size)||1;row.cells[0].textContent=rackIsExternal(m)?'\u5916\u7f6e CDU / 0U':u?`${height>1?`U${u}\u2013U${u-height+1}`:`U${u}`} \u00b7 ${height}U`:'\u5c1a\u672a\u653e\u7f6e';row.querySelectorAll('button').forEach(b=>{if(b.textContent==='\u522a\u9664')b.textContent='\u79fb\u51fa\u6a5f\u6ac3';});});return root.innerHTML;};

  // Readout text next to charts is disabled (empty anchor only) by user request.
  if(window.Chart)Chart.register({id:'paEngineeringReadout',afterUpdate(chart){
    const canvas=chart.canvas;if(!canvas?.isConnected||!canvas.closest('.chart-box'))return;
    let panel=canvas.parentElement.querySelector('.eng-chart-readout');if(!panel){panel=document.createElement('div');panel.className='eng-chart-readout';canvas.before(panel);}
    // 讀數敘述文字（例如「CPU 使用率: 0.03 %」）已停用：保留空 anchor，讓
    // workspace-ux.js 的「最後樣本」(.ux-chart-time) 仍能接在它後面顯示。
    panel.textContent='';panel.title='';panel.dataset.value='';
  }});

  // Read-only library detail panel. Original selection/copy semantics are preserved.
  let inspectedCase=null;
  const verdict = r => String(r.ai_can_execute||'UNRESOLVED').toUpperCase();
  function caseDetails(r){
    if(!r)return '<p class="eng-empty">\u9ede\u9078\u6e2c\u9805\u67e5\u770b\u5b8c\u6574\u5167\u5bb9\u3002</p>';
    return `<header><span>${esc(r.code)}</span><h3>${esc(r.items)}</h3><b>${esc(verdict(r))}</b><p>\u6b64\u8655\u50c5\u7522\u751f\u6d3e\u5de5\u6307\u4ee4\uff0c\u4e0d\u6703\u57f7\u884c\u6e2c\u8a66\u3002</p></header>${[['\u98a8\u96aa\u8207\u6ce8\u610f\u4e8b\u9805',r.risk],['\u5957\u4ef6\u8207\u524d\u7f6e',r.ai_packages_needed],['\u6307\u4ee4\uff0f\u57f7\u884c\u8aaa\u660e',r.ai_commands],['\u8b49\u64da\u8207\u8f38\u51fa',r.ai_logs_output],['\u5224\u5b9a\u6a19\u6e96',r.criteria],['\u539f\u59cb\u624b\u4f5c\u696d\u55ae\uff08\u53c3\u8003\uff09',r.procedure]].map(([label,value])=>`<section><h4>${label}</h4><pre>${esc(value||'\u672a\u63d0\u4f9b')}</pre></section>`).join('')}`;
  }
  assignTaskRow=function(r,dup){const index=_assignTask.items.indexOf(r);return `<div class="assign-row eng-case-row"><label><input type="checkbox" data-variant="${esc(assignTaskKey(r))}" aria-label="${esc(r.code)}" ${_assignTask.sel.has(assignTaskKey(r))?'checked':''} onchange="assignTaskToggle(${q(assignTaskKey(r))},this.checked)"></label><button type="button" class="eng-case-open" onclick="engInspectCase(${index})"><span><b>${esc(verdict(r))}</b> <code>${esc(r.code)}</code></span><strong>${esc(r.items)}</strong><small>${esc(r.test_set||'')}${dup?.has(r.code)?' \u00b7 \u540c\u78bc\u591a\u7b46':''}</small></button></div>`;};
  const baseTaskList=assignTaskListHtml;
  assignTaskListHtml=function(){const root=document.createElement('div');root.innerHTML=baseTaskList();const rows=root.querySelector('.assign-rows');if(!rows)return root.innerHTML;const layout=document.createElement('div');layout.className='eng-case-layout';rows.before(layout);layout.append(rows);const row=(_assignTask.items||[]).find(r=>r===inspectedCase);layout.insertAdjacentHTML('beforeend',`<aside class="eng-case-detail" id="eng-case-detail" aria-label="\u6e2c\u9805\u5167\u5bb9">${caseDetails(row)}</aside>`);root.querySelector('#assign-q')?.setAttribute('aria-label','\u641c\u5c0b\u6e2c\u8a66\u6848\u4f8b');return root.innerHTML;};
  window.engInspectCase=index=>{inspectedCase=_assignTask.items[index];const panel=document.getElementById('eng-case-detail');if(panel){panel.innerHTML=caseDetails(inspectedCase);panel.scrollTop=0;}document.querySelectorAll('.eng-case-open').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')===`engInspectCase(${index})`));};
  const baseToggle=assignTaskToggle;
  assignTaskToggle=function(...args){baseToggle(...args);syncCaseSelection();};
  function syncCaseSelection(){const body=document.getElementById('assign-task-body');if(!body)return;const footer=document.getElementById('rm-dialog-foot');const button=footer?.querySelector('.primary');if(button){button.textContent=`\u7522\u751f\u6307\u4ee4 (${_assignTask.sel.size})`;button.disabled=!_assignTask.sel.size;}body.querySelectorAll('.eng-case-row input').forEach(input=>{input.checked=_assignTask.sel.has(input.getAttribute('data-variant'));});}
  const baseDialog=showDialog;showDialog=function(...args){const result=baseDialog(...args);syncCaseSelection();return result;};
  document.addEventListener('DOMContentLoaded',()=>{
    if(window.PA_PREVIEW)return;
    const side=document.querySelector('.p-side-preview');
    if(side){const mode=document.getElementById('mode-label');side.innerHTML='<i class="p-live-dot"></i> API WORKSPACE<small>\u9023\u63a5\u76ee\u524d FastAPI \u670d\u52d9</small>';if(mode)side.append(mode);}
    const flag=document.querySelector('.p-preview-label');if(flag)flag.textContent='API \u00b7 \u8a2d\u5099\u8cc7\u6599';
  });
})();
