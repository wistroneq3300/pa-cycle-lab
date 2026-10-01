/* Operation feedback and target identity. No device commands run on rendering. */
function showInventoryLoadError(error) {
  document.getElementById('content').innerHTML=`<section class="operation-target" role="alert"><h2>\u8cc7\u6599\u8f09\u5165\u5931\u6557</h2><p>${esc(error.message)}</p><p>\u8acb\u78ba\u8a8d\u5f8c\u7aef\u9023\u7dda\u8207\u670d\u52d9\u65e5\u8a8c\u3002\u82e5\u65e5\u8a8c\u56de\u5831 data.json \u8b80\u53d6\u5931\u6557\uff0c\u8acb\u4fdd\u7559\u539f\u6a94\u4e26\u7531\u7ba1\u7406\u8005\u9084\u539f\u5df2\u9a57\u8b49\u7684\u5099\u4efd\u5f8c\u91cd\u555f\u3002</p><button class="btn primary" onclick="retryInventoryLoad(this)">\u91cd\u8a66\u8f09\u5165</button></section>`;
}
async function retryInventoryLoad(button) {
  button.disabled=true;
  try {await Promise.all([loadMachines(false),loadProjects()]);setView(state.view);}
  catch(error){showInventoryLoadError(error);}
}
function operationTarget(name) {
  const m = machines.find(x => x.name === name) || {};
  return {active_os: Number(m.active_os) || 1, os_ip: m.os_ip || '', bmc_ip: m.bmc_ip || ''};
}
function operationTargetText(name) {
  const t = operationTarget(name);
  return `${name} / OS ${t.active_os}\nOS: ${t.os_ip || '\u672a\u8a2d\u5b9a'}\nBMC: ${t.bmc_ip || '\u672a\u914d\u5c0d'}`;
}
function operationTargetHtml(name) {
  return `<section class="operation-target" aria-label="\u76ee\u524d\u64cd\u4f5c\u76ee\u6a19"><strong>\u76ee\u524d\u64cd\u4f5c\u76ee\u6a19</strong><pre>${esc(operationTargetText(name))}</pre></section>`;
}
let powerBatch = null;
async function runPowerBatch(kind, names) {
  if (powerBatch?.running) { showPowerBatch(); return; }
  powerBatch = {kind, running:true, cancel:false, rows:[...new Set(names)].filter(name=>equipmentCanPower(machines.find(m=>m.name===name)||{},kind==='on')).map(name => ({name,target:operationTarget(name),state:'waiting',info:''}))};
  showPowerBatch();
  await executePowerBatch(powerBatch);
}
function showPowerBatch() {
  const job = powerBatch;
  if (!job) return;
  showDialog(`\u6279\u6b21${job.kind === 'on' ? '\u958b\u6a5f' : '\u95dc\u6a5f'}`, '<div id="power-batch-progress" role="status" aria-live="polite"></div>', [
    {txt:'\u53d6\u6d88\u5c1a\u672a\u9001\u51fa', id:'batch-cancel', fn:()=>{job.cancel=true; renderPowerBatch();}},
    {txt:'\u91cd\u8a66\u5931\u6557\u9805\u76ee', id:'batch-retry', fn:async()=>{
      const failed=job.rows.filter(r=>r.state==='failed');
      if (!failed.length || !await confirmUser(failed.map(r=>operationTargetText(r.name)).join('\n\n'))) return;
      job.rows.forEach(r=>{if(r.state==='failed'){r.state='waiting';r.target=operationTarget(r.name);}});
      job.cancel=false; job.running=true; showPowerBatch(); void executePowerBatch(job);
    }},
    {txt:'\u95dc\u9589', id:'batch-close', fn:closeDialog}
  ]);
  renderPowerBatch();
}
function renderPowerBatch() {
  const job=powerBatch, panel=document.getElementById('power-batch-progress');
  if (!panel || !job) return;
  const labels={waiting:'\u7b49\u5f85',sending:'\u9001\u51fa\u4e2d',success:'\u6307\u4ee4\u5df2\u63a5\u53d7',failed:'\u5931\u6557\uff0f\u672a\u78ba\u8a8d',cancelled:'\u672a\u9001\u51fa'};
  const completed=job.rows.filter(r=>!['waiting','sending'].includes(r.state)).length;
  panel.innerHTML=`<p>${completed} / ${job.rows.length} \u5df2\u8655\u7406${job.cancel?' \u00b7 \u505c\u6b62\u5f8c\u7e8c\u9001\u51fa':''}</p><progress value="${completed}" max="${job.rows.length||1}"></progress><p class="hint">\u6307\u4ee4\u63a5\u53d7\u4e0d\u4ee3\u8868\u958b\u95dc\u6a5f\u5df2\u5b8c\u6210\u3002</p>${job.rows.map(r=>`<div class="batch-row" data-state="${r.state}"><strong>${esc(r.name)}</strong><span>${labels[r.state]}</span><small>OS ${r.target.active_os} \u00b7 ${esc(r.target.os_ip)} \u00b7 BMC ${esc(r.target.bmc_ip)}</small><small>${esc(r.info)}</small></div>`).join('')}`;
  document.getElementById('batch-cancel').disabled=!job.running||job.cancel;
  document.getElementById('batch-retry').disabled=job.running||!job.rows.some(r=>r.state==='failed');
  document.getElementById('batch-close').disabled=job.running;
}
async function executePowerBatch(job) {
  for (const row of job.rows) {
    if (row.state!=='waiting') continue;
    if (job.cancel) {row.state='cancelled';continue;}
    row.state='sending';renderPowerBatch();
    try {
      const result=await api(`/api/machine/${encodeURIComponent(row.name)}/power`,{method:'POST',body:JSON.stringify({on:job.kind==='on',expected_target:row.target})});
      row.state=result.ok?'success':'failed';row.info=result.info||'';
    } catch(error) {row.state='failed';row.info=error.message;}
    renderPowerBatch();
  }
  job.running=false;renderPowerBatch();
}

function placementPreview(project, name, top, size, external=false) {
  const members=machines.filter(m=>m.project===project&&m.level==='rack'&&m.name!==name&&!rackIsExternal(m)&&Number(m.rack_u)>0);
  const low=top-size+1, valid=Number.isInteger(top)&&Number.isInteger(size)&&size>0&&low>=1&&top<=RACK_U;
  const conflicts=external?[]:members.filter(m=>Number(m.rack_u)>=low&&Number(m.rack_u)-Number(m.rack_size||1)+1<=top);
  const cells=Array.from({length:RACK_U},(_,i)=>RACK_U-i).map(u=>{
    const occupied=members.find(m=>Number(m.rack_u)>=u&&Number(m.rack_u)-Number(m.rack_size||1)+1<=u);
    const selected=!external&&u>=low&&u<=top;
    return `<span class="${selected?'placement-selected ':''}${selected&&occupied?'placement-conflict':''}" title="U${u}${occupied?' '+esc(occupied.name):''}">${u}</span>`;
  }).join('');
  return {valid:external||valid&&!conflicts.length,html:`<div class="placement-preview"><strong>${external?'\u5916\u7f6e\uff0c\u4e0d\u5360 U':`\u9810\u89bd U${top}\u2013U${low}`}</strong>${!external?`<div class="placement-grid">${cells}</div>`:''}${!external&&!valid?'<p role="alert">\u8d85\u51fa\u6a5f\u6ac3\u7bc4\u570d</p>':''}${conflicts.map(m=>`<button type="button" class="btn small" data-placement-focus="${esc(m.name)}">\u885d\u7a81\uff1a${esc(m.name)} / U${m.rack_u}</button>`).join('')}</div>`};
}
function refreshMovePreview() {
  const select=document.getElementById('rm-move-u'), size=document.getElementById('rm-move-size');
  if(!select||!size)return;
  const m=machines.find(m=>m.name===window.placementMachineName);if(!m)return;
  let panel=document.getElementById('move-preview');
  if(!panel){panel=document.createElement('div');panel.id='move-preview';size.after(panel);}
  const preview=placementPreview(m.project,m.name,Number(select.value),Number(size.value));
  panel.innerHTML=preview.html;
  const save=document.querySelector('#rm-dialog-foot .primary');if(save)save.disabled=!preview.valid;
}
function refreshAddPreview() {
  const select=document.getElementById('rm-add-u')||document.getElementById('rp-u');
  const size=document.getElementById('rm-add-size')||document.getElementById('rp-size');
  if(!select||!size)return;
  let panel=document.getElementById('add-preview');
  if(!panel){panel=document.createElement('div');panel.id='add-preview';select.after(panel);}
  const name=document.getElementById('rm-add-m')?.value||'';
  const preview=placementPreview(_rackAddProj,name,Number(select.value),Number(size.value));
  panel.innerHTML=preview.html;
  const save=document.querySelector('#rm-dialog-foot .primary');if(save)save.disabled=!preview.valid;
}
document.addEventListener('change',e=>{if(['rm-move-u','rm-move-size'].includes(e.target.id))refreshMovePreview();if(['rm-add-u','rm-add-size','rm-add-m','rp-u','rp-size'].includes(e.target.id))refreshAddPreview();});
document.addEventListener('click',e=>{
  const focus=e.target.closest('[data-placement-focus]');
  if(focus){closeDialog();openMachine(focus.dataset.placementFocus);}
});

(function(){
  const original=RENDERERS.machine;
  RENDERERS.machine=function(){
    const html=original();const m=machines.find(x=>x.name===_activeMachine);if(!m)return html;
    const root=document.createElement('div');root.innerHTML=html;
    const ops=root.querySelector('.pd-operations');
    if(ops)ops.insertAdjacentHTML('afterbegin',operationTargetHtml(m.name));
    const detail=machineDetailCache[m.name], base=detail?.machine||m;
    const info=root.querySelector('.pd-header-status');
    if(info){
      const stamp=v=>v?new Date(v*1000).toLocaleString():'\u4f86\u6e90\u672a\u63d0\u4f9b\u6642\u9593';
      info.innerHTML=['os','bmc'].map(kind=>{
        const obs=base.connectivity?.[kind],value=base[kind+'_alive'];
        const label=!base[kind+'_ip']?'\u672a\u8a2d\u5b9a':value===true?'Ping \u53ef\u9054':value===false?'Ping \u672a\u56de\u61c9':'\u5c1a\u672a\u89c0\u6e2c';
        const stale=obs?.observed_at&&Date.now()/1000-obs.observed_at>60;
        return `<div class="observation"><b>${kind.toUpperCase()} ${label}</b><small>ICMP \u00b7 ${esc(stamp(obs?.observed_at))}${stale?' \u00b7 \u820a\u8cc7\u6599':''}</small></div>`;
      }).join('')+'<small>Ping \u53ef\u9054\u4e0d\u4ee3\u8868 SSH \u6216 BMC \u8a8d\u8b49\u6210\u529f</small>';
    }
    if(info && detail?.ssh_observation){
      const ssh=detail.ssh_observation,labels={success:'\u8a8d\u8b49\u6210\u529f',authentication_failed:'\u8a8d\u8b49\u5931\u6557',connection_failed:'\u9023\u7dda\u5931\u6557'};
      info.insertAdjacentHTML('beforeend',`<div class="observation"><b>SSH ${labels[ssh.state]||'\u672a\u77e5'}</b><small>${esc(new Date(ssh.observed_at*1000).toLocaleString())}</small></div>`);
    }
    if(mgxTypeOf(m)==='cdu'){
      root.querySelectorAll('.pd-operation-group,.pd-power-group,.operation-target').forEach(n=>n.remove());
      const placement=rackIsExternal(m)?'\u6a5f\u6ac3\u53f3\u5074\uff08\u5916\u7f6e\uff09':Number(m.rack_u)>0?`U${m.rack_u}\u2013U1 / ${m.rack_size}U`:'\u5c1a\u672a\u653e\u7f6e';
      if(ops)ops.insertAdjacentHTML('afterbegin',`<section class="operation-target"><strong>CDU</strong><p>\u7ba1\u7406 IP\uff1a${esc(m.bmc_ip||m.os_ip||'\u672a\u8a2d\u5b9a')}</p><p>${placement}</p><p>\u6c34\u6eab\u3001\u6d41\u91cf\u3001\u6c34\u58d3\uff1a\u5c1a\u672a\u6574\u5408\u63a1\u96c6\u5668</p></section>`);
      const connections=root.querySelector('.pd-connect-panel');
      if(connections)connections.innerHTML=`<div class="operation-target"><strong>\u7ba1\u7406 IP</strong><p>${esc(m.bmc_ip||m.os_ip||'\u672a\u8a2d\u5b9a')}</p><p>\u5b89\u88dd\u4f4d\u7f6e\uff1a${placement}</p><p>\u5c1a\u672a\u6574\u5408 CDU \u63a1\u96c6\u5668</p></div>`;
      root.querySelectorAll('.pd-diagnostic,.pd-showcase-copy button').forEach(n=>n.remove());
      const telemetry=root.querySelector('#pd-panel-telemetry');
      if(telemetry)telemetry.innerHTML='<section class="operation-target"><h2>CDU \u76e3\u63a7</h2><p>\u6d41\u91cf (L/min) / \u9032\u51fa\u6c34\u6eab / \u6c34\u58d3</p><p>\u5c1a\u672a\u6574\u5408\u63a1\u96c6\u5668\uff0c\u76ee\u524d\u7121\u5373\u6642\u91cf\u6e2c\u503c\u3002</p></section>';
      const caption=root.querySelector('.pd-stage-caption');if(caption)caption.textContent=rackIsExternal(m)?'TC1288 \u5916\u7f6e CDU \u5916\u89c0\u53c3\u8003 \u00b7 \u975e\u672c\u6a5f\u5be6\u969b\u5916\u89c0':'\u6ac3\u5167\u6a6b\u5f0f CDU \u5916\u89c0\u793a\u610f \u00b7 \u975e\u672c\u6a5f\u5be6\u969b\u5916\u89c0';
      const heading=root.querySelector('.pd-ops-heading h2');if(heading)heading.textContent='\u8a2d\u5099\u8cc7\u8a0a';
      const context=root.querySelector('.pd-ops-context');if(context)context.textContent=`${m.project||''} / CDU / ${placement}`;
      if(info)info.textContent=`\u7ba1\u7406 IP: ${m.bmc_ip||m.os_ip||'\u672a\u8a2d\u5b9a'} / \u76e3\u63a7\u5c1a\u672a\u6574\u5408`;
    }
    if(!equipmentIsServer(m)){
      root.querySelectorAll('.pd-operation-group,.pd-power-group,.equipment-actions').forEach(n=>n.remove());
      if(ops)ops.insertAdjacentHTML('afterbegin',equipmentActionsHtml(m)+(equipmentCanPower(m)?`<button class="btn small" onclick="machControlDialog('${esc(m.name)}')">\u81ea\u8a02\u96fb\u6e90\u6307\u4ee4</button>`:''));
    }
    if(equipmentClass(m).status==='needs_confirmation'){
      root.insertAdjacentHTML('afterbegin','<p role="status">\u8a2d\u5099\u985e\u578b\u5f85\u78ba\u8a8d\uff1a\u8acb\u78ba\u8a8d mgx_type\uff0c\u76ee\u524d\u4e0d\u63d0\u4f9b Server \u96fb\u6e90\u64cd\u4f5c\u3002</p>');
    }
    return root.innerHTML;
  };
  const dialog=showDialog;
  showDialog=function(...args){const result=dialog(...args);refreshMovePreview();return result;};
  const close=closeDialog;
  closeDialog=function(){
    if(powerBatch?.running && document.getElementById('power-batch-progress')){
      powerBatch.cancel=true;renderPowerBatch();return;
    }
    return close();
  };
  const addRefresh=rackAddRefreshU;
  rackAddRefreshU=function(...args){const result=addRefresh(...args);refreshAddPreview();return result;};
  const term=openTermDialog;
  openTermDialog=function(name){const result=term(name);if(equipmentIsServer(machines.find(m=>m.name===name)))document.getElementById('rm-dialog-body')?.insertAdjacentHTML('afterbegin',operationTargetHtml(name));return result;};
})();
