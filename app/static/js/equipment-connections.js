/* Equipment IP edits preserve the chosen legacy connection and its credentials. */
function equipmentTargets(m) {
  const targets=['os','bmc'].filter(k=>m[k+'_ip']);
  return targets.length?targets:['os'];
}
function equipmentTargetSelect(m) {
  return `<label>\u7ba1\u7406\u9023\u7dda</label><select class="input" id="equipment-target">${equipmentTargets(m).map((k,i)=>`<option value="${k}">\u9023\u7dda ${i+1}: ${esc(m[k+'_ip']||'\u672a\u8a2d\u5b9a')} (${k.toUpperCase()})</option>`).join('')}</select>`;
}
function equipmentIpDialog(name) {
  const m=machines.find(x=>x.name===name);
  if(!m||!equipmentCanConnect(m))return;
  const snapshot={os:m.os_ip||'',bmc:m.bmc_ip||''};
  showDialog(`\u4fee\u6539\u7ba1\u7406 IP \u2014 ${name}`,`<div class="rm-modal-body">${equipmentTargetSelect(m)}<label>IP</label><input class="input" id="equipment-ip" value="${esc(snapshot[equipmentTargets(m)[0]])}" required><p class="hint">\u53ea\u66f4\u65b0\u672c\u7cfb\u7d71\u8a18\u9304\u7684 IP\uff1b\u4e0d\u4fee\u6539\u8a2d\u5099\u7db2\u5361\uff0c\u4e0d\u8981\u6c42 Ping \u6216 hostname \u9a57\u8b49\u3002\u5e33\u5bc6\u4fdd\u6301\u4e0d\u8b8a\u3002</p></div>`,[
    {txt:'\u53d6\u6d88',fn:()=>closeDialog()},
    {txt:'\u5132\u5b58',cls:'primary',fn:async()=>{
      const target=$('equipment-target').value,ip=$('equipment-ip').value.trim();
      await api(`/api/machines/${encodeURIComponent(name)}/management-ip`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({target,ip,expected_ip:snapshot[target]})});
      await loadMachines(false);closeDialog();setView(state.view);
    }}]);
  $('equipment-target').onchange=()=>{$('equipment-ip').value=snapshot[$('equipment-target').value];};
}
function equipmentSshDialog(name) {
  const m=machines.find(x=>x.name===name);
  if(!m||!equipmentCanConnect(m))return;
  showDialog(`SSH Terminal \u2014 ${name}`,`<div class="rm-modal-body">${equipmentTargetSelect(m)}<div id="equipment-ssh-fields"></div><p class="hint">SSH \u9700\u8981\u8a2d\u5099\u958b\u555f SSH \u670d\u52d9\u53ca\u6709\u6548\u5e33\u5bc6\u3002</p></div>`,[
    {txt:'\u53d6\u6d88',fn:()=>closeDialog()},
    {txt:'\u9023\u7dda',cls:'primary',fn:()=>{
      const k=$('equipment-target').value;
      const host=($('equipment-ssh-host')?.value||m[k+'_ip']||'').trim();
      const user=($('equipment-ssh-user')?.value||m[k+'_user']||'').trim();
      const pass=$('equipment-ssh-pass')?.value||m[k+'_pass']||'';
      if(!host||!user||!pass)throw new Error('IP, SSH username and password are required');
      const port=Number(m[k+'_port'])||22;
      const creds={host,user,pass,port:k==='bmc'&&port===623?22:port};
      closeDialog();openTermAt(name,k==='os'?creds:null,k==='bmc'?creds:null);
    }}]);
  const render=()=>{
    const k=$('equipment-target').value;
    $('equipment-ssh-fields').innerHTML=`<p class="mono">${esc(m[k+'_ip']||'')}</p>${m[k+'_ip']?'':'<label>IP<input class="input" id="equipment-ssh-host" required></label>'}${m[k+'_user']?'':'<label>SSH \u5e33\u865f<input class="input" id="equipment-ssh-user" autocomplete="username" required></label>'}${m[k+'_pass']?'':'<label>SSH \u5bc6\u78bc<input class="input" id="equipment-ssh-pass" type="password" autocomplete="current-password" required></label>'}<p class="hint">\u5df2\u5132\u5b58\u7684\u5e33\u5bc6\u6703\u81ea\u52d5\u4f7f\u7528\u3002</p>`;
  };
  $('equipment-target').onchange=render;render();
}
function equipmentActionsHtml(m) {
  if(!equipmentCanConnect(m))return '';
  return `<div class="equipment-actions"><button class="btn small" onclick="changeOsIp('${esc(m.name)}')">\u4fee\u6539\u7ba1\u7406 IP</button> <button class="btn small" onclick="openTerm('${esc(m.name)}')">SSH Terminal</button></div>`;
}

function equipmentPowerDialog(m) {
  const buttons=[true,false].filter(on=>equipmentCanPower(m,on)).map(on=>({txt:on?'\u958b\u6a5f':'\u95dc\u6a5f',fn:()=>singlePower(m.name,on)}));
  buttons.push({txt:'\u95dc\u9589',fn:()=>closeDialog()});
  showDialog(`\u81ea\u8a02\u96fb\u6e90\u6307\u4ee4 \u2014 ${m.name}`,'<p>\u53ea\u63d0\u4f9b\u6b64\u8a2d\u5099\u5df2\u8a2d\u5b9a\u7684\u6307\u4ee4\u3002</p>',buttons);
}
