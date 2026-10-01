/* Project-local physical wiring and logical node mappings. Never operates devices. */
(() => {
  'use strict';
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
    else {
      const seed = Date.now() ^ Math.floor(Math.random() * 0x7fffffff);
      for (let i=0;i<bytes.length;i++) bytes[i] = (seed >>> (i % 4) * 8) ^ Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2,'0'));
    return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10).join('')}`;
  };
  const roles = {host:'主機管理網路',dpu:'DPU 管理網路',power:'\u96fb\u529b\u8a2d\u5099\u7ba1\u7406',cooling:'\u51b7\u537b\u8a2d\u5099\u7ba1\u7406',data:'資料網路',uplink:'交換器互連',other:'其他'};
  const kinds = {server:'伺服器',switch:'交換器',other:'其他設備'};
  let state = null, root;
  const rack = () => state.doc.racks.find(r => r.id === state.rack);
  const device = key => rack().devices.find(d => d.id === key);
  const val = key => root.querySelector('#nt-'+key)?.value || '';
  const options = (entries, selected) => entries.map(([value,label]) => `<option value="${h(value)}" ${value === selected ? 'selected' : ''}>${h(label)}</option>`).join('');
  const field = (key, label, value='', type='text') => `<label>${h(label)}<input id="nt-${key}" type="${type}" value="${h(value)}" maxlength="160" ${type==='number'?'min="1" max="256"':''}></label>`;
  const select = (key, label, entries, value='') => `<label>${h(label)}<select id="nt-${key}">${options(entries,value)}</select></label>`;
  const button = (action,label,key='',cls='') => `<button type="button" class="btn ${cls}" data-action="${action}" data-key="${h(key)}">${h(label)}</button>`;
  function error(e) { const box=root.querySelector('#nt-message');box.textContent=e.message || String(e);box.className='nt-message nt-error'; }
  function changed() { state.dirty=true;state.editor=null;state.ping=null;state.pingFilter='all';render(); }
  function occupied(d,p,exclude='') { return rack().links.some(l=>l.id!==exclude&&[l.a,l.b].some(e=>e.device===d&&e.port===p)); }
  function endpoint(e) { const d=device(e.device);return `${d?.name || '?'} / ${d?.ports.find(p=>p.id===e.port)?.name || '?'}`; }
  async function confirmDraft(message) {
    const pending=confirmUser(message), dialog=document.getElementById('rm-dialog');
    const previous=dialog?.style.zIndex;
    if(dialog)dialog.style.zIndex='16000';
    root.inert=true;dialog?.querySelector('button')?.focus();
    try{return await pending;}finally{if(dialog)dialog.style.zIndex=previous;root.inert=false;root.querySelector('[data-action="close"]')?.focus();}
  }
  async function open(project) {
    if(!project) return notifyUser('\u8acb\u5148\u9078\u64c7\u5c08\u6848');
    if(root) return;
    root=document.createElement('div');root.className='nt-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','網路拓樸');
    root.innerHTML='<section class="nt-window"><p role="status">正在載入網路拓樸…</p></section>';document.body.append(root);
    state={project,doc:null,rack:'',dirty:false,editor:null,filter:'all',pingFilter:'all',ping:null,pinging:false,search:'',focus:'',busy:false,opener:document.activeElement};
    root.addEventListener('click',async event=>{const b=event.target.closest('[data-action]');if(!b||state.busy)return;try{await action(b.dataset.action,b.dataset.key);}catch(e){error(e);}});
    root.addEventListener('submit',async event=>{event.preventDefault();if(state.busy)return;try{await submit();}catch(e){error(e);}});
    root.addEventListener('change',event=>{
      if(state.busy)return;
      if(state.editor && ['nt-rack','nt-filter'].includes(event.target.id)){event.target.value=event.target.id==='nt-rack'?state.rack:state.filter;error(Error('請先套用或取消目前的編輯表單。'));return;}
      if(event.target.id==='nt-rack'){state.rack=event.target.value;state.focus='';state.editor=null;state.ping=null;render();}
      if(event.target.id==='nt-template'){const preset=event.target.value==='vera';root.querySelector('#nt-nodes').value=preset?'4':'1';root.querySelector('#nt-paired').value=preset?'yes':'no';}
      if(event.target.id==='nt-filter'){state.filter=event.target.value;render();}
      if(event.target.id==='nt-ping-filter'){state.pingFilter=event.target.value;render();}
      if(['nt-a-device','nt-b-device'].includes(event.target.id)){
        const side=event.target.id==='nt-a-device'?'a':'b'; const d=device(event.target.value);
        root.querySelector('#nt-'+side+'-port').innerHTML=options(d.ports.map(p=>[p.id,p.name+(occupied(d.id,p.id,state.editor.key)?'（使用中）':'')]),'');
      }
    });
    root.addEventListener('keydown',event=>{
      const target=event.target.closest('g[data-action]');
      if(target&&['Enter',' '].includes(event.key)){event.preventDefault();action(target.dataset.action,target.dataset.key).catch(error);return;}
      if(event.key==='Escape'){event.stopImmediatePropagation();event.preventDefault();if(state.editor){action('cancel');}else close();}
      if(event.key==='Tab'){const list=[...root.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(e=>!e.disabled&&e.offsetParent!==null);const first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    });
    try { state.doc=await api('/api/projects/'+encodeURIComponent(project)+'/topology');state.rack=state.doc.racks[0]?.id || '';render(); }
    catch(e){root.innerHTML=`<section class="nt-window"><h2>網路拓樸</h2><div id="nt-message" role="alert"></div>${button('close','關閉')}</section>`;error(e);}
  }
  async function close() {
    if(state.busy)return;
    if((state.dirty||state.editor)&&!await confirmDraft('\u6709\u672a\u5132\u5b58\u7684\u62d3\u64b2\u7de8\u8f2f\uff0c\u78ba\u5b9a\u653e\u68c4\u4e26\u95dc\u9589\uff1f'))return;
    const opener=state.opener;root.remove();root=null;state=null;opener?.focus();
  }
  const pingFields={host:['host_os'],dpu:[],power:['primary_ip'],cooling:['primary_ip'],data:['host_os'],uplink:['primary_ip'],other:['primary_ip']};
  const pingLabels={unchecked:'尚未檢查',up:'全部可達',partial:'部分可達',down:'無回應',unconfigured:'未設定 IP'};
  const pingFieldLabels={host_os:'Host OS',host_bmc:'Host BMC',dpu_os:'DPU OS',dpu_bmc:'DPU BMC',primary_ip:'\u4e3b\u8981 IP',management:'\u7ba1\u7406 IP',os:'OS IP',bmc:'BMC IP'};
  function pingTarget(deviceId,nodeId,field){if(!state.ping)return null;state.ping._index ||= new Map(state.ping.targets.map(target=>[[target.device_id,target.node_id,target.field].join('|'),target]));return state.ping._index.get([deviceId,nodeId,field].join('|'));}
  function pingStatus(targets,configured=false){if(!state.ping)return 'unchecked';if(!targets.length)return configured?'down':'unconfigured';const alive=targets.filter(t=>t.alive).length;return alive===targets.length?'up':alive?'partial':'down';}
  function portStatus(d,p){const fields=pingFields[p.role]||[],targets=[];let configured=false;p.nodes.forEach(nodeId=>fields.forEach(field=>{const node=d.nodes.find(n=>n.id===nodeId);if(node?.[field])configured=true;const target=pingTarget(d.id,nodeId,field);if(target)targets.push(target);}));if(!targets.length&&state.ping&&d.kind==='server'&&fields.includes('host_os')){targets.push(...state.ping.targets.filter(target=>target.device_id===d.id&&['host_os','primary_ip'].includes(target.field)));configured=targets.length>0;}if(!p.nodes.length&&state.ping&&d.kind!=='server'){targets.push(...state.ping.targets.filter(target=>target.device_id===d.id&&target.field==='primary_ip'));configured=targets.length>0;}return pingStatus(targets,configured);}
  function endpointStatus(e){const d=device(e.device),p=d?.ports.find(port=>port.id===e.port);return d&&p?portStatus(d,p):'unconfigured';}
  function linkStatus(link){if(!state.ping)return 'unchecked';const states=[endpointStatus(link.a),endpointStatus(link.b)].filter(value=>value!=='unconfigured');if(!states.length)return 'unconfigured';if(states.includes('down'))return states.some(value=>value==='up'||value==='partial')?'partial':'down';return states.includes('partial')?'partial':'up';}
  function deviceStatus(d){if(!state.ping)return 'unchecked';const targets=state.ping.targets.filter(target=>target.device_id===d.id),configured=d.kind==='server'?d.nodes.some(node=>node.host_os):targets.length>0;return pingStatus(targets,configured);}
  const pingVisible=status=>state.pingFilter==='all'||status===state.pingFilter;
  function pingBadge(status){return `<span class="nt-ping nt-ping-${status}">${h(pingLabels[status])}</span>`;}
  function targetBadge(d,n,field){const target=pingTarget(d.id,n.id,field);return target?pingBadge(target.alive?'up':'down'):!n[field]?pingBadge('unconfigured'):pingBadge('unchecked');}
  function pingResultSummary() {
    if(!state.ping)return `<section class="nt-ping-summary nt-ping-idle" role="status" aria-live="polite"><strong>\u5c1a\u672a\u6aa2\u67e5 IP</strong><span>\u5132\u5b58\u62d3\u64b2\u5f8c\uff0c\u53ef\u5728\u9019\u88e1\u6aa2\u67e5\u9023\u7dda\u8a2d\u5099\u7684 IP \u662f\u5426\u53ef\u9054\u3002</span></section>`;
    const configured=Number(state.ping.summary?.configured)||0,alive=Number(state.ping.summary?.alive)||0,down=Number(state.ping.summary?.down)||0,unique=Number(state.ping.summary?.unique_ips)||0;
    const meta=`<span>${configured} \u500b IP \u00b7 \u53ef\u9054 ${alive} \u00b7 \u7121\u56de\u61c9 ${down} \u00b7 \u4e0d\u91cd\u8907 IP ${unique} \u00b7 ${Number(state.ping.duration_ms)||0} ms</span>`;
    if(!configured)return `<section class="nt-ping-summary nt-ping-empty" role="status" aria-live="polite"><strong>\u6c92\u6709\u53ef\u6aa2\u67e5\u7684 IP</strong><span>\u8acb\u5148\u70ba\u9019\u500b\u6a5f\u6ac3\u7684\u8a2d\u5099\u8a2d\u5b9a IP\u3002</span>${meta}</section>`;
    if(!down)return `<section class="nt-ping-summary nt-ping-success" role="status" aria-live="polite"><strong>\u5168\u90e8 ${configured} \u500b IP \u7686\u53ef\u9054</strong>${meta}</section>`;
    const devices=rack()?.devices||[],failures=(state.ping.targets||[]).filter(target=>target.alive===false).map(target=>{
      const d=devices.find(item=>item.id===target.device_id),n=d?.nodes?.find(item=>item.id===target.node_id);
      const deviceName=target.device_name||d?.name||'\u672a\u77e5\u8a2d\u5099',nodeName=target.node_name||n?.name||'',field=pingFieldLabels[target.field]||'IP',ip=target.ip||'\u672a\u63d0\u4f9b';
      return `<li><strong>${h(deviceName)}</strong>${nodeName?`<span>${h(nodeName)}</span>`:''}<span>${h(field)}\uff1a<code>${h(ip)}</code></span></li>`;
    }).join('');
    return `<section class="nt-ping-summary nt-ping-failed" role="status" aria-live="polite"><div class="nt-ping-summary-head"><strong>${down} \u500b IP \u7121\u56de\u61c9</strong>${meta}</div><p>\u4ee5\u4e0b\u8a2d\u5099\u9700\u8981\u6aa2\u67e5\uff1a</p><ul class="nt-ping-failures">${failures||'<li><span>\u56de\u61c9\u672a\u5305\u542b\u5931\u6557\u8a2d\u5099\u660e\u7d30\u3002</span></li>'}</ul></section>`;
  }
  function render() {
    const r=rack(),devices=r?.devices || [],connections=r?.links || [];
    root.innerHTML=`<section class="nt-window">
      <header class="nt-header"><div><small>${h(state.project)}／網路配線工作區</small><h2>網路拓樸</h2><p>\u5be6\u9ad4\u63a5\u7dda\u8207\u7bc0\u9ede\u5c0d\u61c9\u3002\u9023\u7dda\u72c0\u614b\u70ba\u624b\u52d5\u78ba\u8a8d\uff0c\u975e\u5373\u6642\u5075\u6e2c\u3002</p></div><div class="nt-actions">${button('export','匯出 JSON')}${button('close','\u95dc\u9589')}</div></header>
      <div class="nt-toolbar">${select('rack','機櫃',state.doc.racks.map(r=>[r.id,r.name]),state.rack)}${button('rack','＋新增機櫃')}${r?button('rename-rack','\u91cd\u65b0\u547d\u540d')+button('delete-rack','\u522a\u9664\u6a5f\u6ac3'):''}<span class="nt-save-state">${state.dirty?'\u672a\u5132\u5b58':'\u5df2\u5132\u5b58'} · 版本 ${state.doc.revision}</span>${button('reload','\u91cd\u65b0\u8f09\u5165')}${button('save','\u5132\u5b58\u62d3\u64b2','','primary')}</div>
      <div id="nt-message" class="nt-message" role="status" aria-live="polite"></div>
      ${r?`<div class="nt-toolbar">${button('import','\u5f9e\u5c08\u6848\u52a0\u5165\u8a2d\u5099')}${button('device','＋\u81ea\u8a02\u8a2d\u5099')}${button('link','＋\u914d\u5c0d\u9023\u7dda')}${button('batch','\u6279\u6b21\u63a5\u7dda')}${select('filter','\u986f\u793a\u7db2\u8def',[['all','全部網路'],...Object.entries(roles)],state.filter)}${button('ping',state.pinging?'\u6aa2\u67e5\u4e2d\u2026':'\u6aa2\u67e5 IP','','primary')}${select('ping-filter','Ping \u72c0\u614b',[['all','全部狀態'],['down','只看失敗'],['partial','只看部分可達'],['unconfigured','只看未設定 IP']],state.pingFilter)}<span>${devices.length} 台設備 · ${devices.reduce((n,d)=>n+d.nodes.length,0)} 個節點 · ${connections.length} 條線路</span></div>
      ${pingResultSummary()}
      <div class="nt-body"><main><div class="nt-map">${map(r)}</div><div class="nt-device-grid">${devices.map(d=>card(d)).join('') || '<p class="nt-empty">\u5f9e\u5c08\u6848\u52a0\u5165\u4f3a\u670d\u5668／\u4ea4\u63db\u5668\uff0c\u6216\u65b0\u589e\u81ea\u8a02\u8a2d\u5099\u958b\u59cb\u914d\u7dda\u3002</p>'}</div><h3>\u9023\u7dda\u6e05\u55ae</h3><div class="nt-links">${connections.filter(l=>(state.filter==='all'||l.network===state.filter)&&pingVisible(linkStatus(l))).map(l=>`<article class="nt-link"><span class="nt-tag nt-${l.network}">${h(roles[l.network])}</span><strong>${h(endpoint(l.a))} ↔ ${h(endpoint(l.b))}</strong><span>${l.state==='confirmed'?'\u5df2\u78ba\u8a8d\u63a5\u7dda':'\u898f\u5283\u4e2d'} · Ping：${pingBadge(linkStatus(l))}</span><small>${h(l.note)}</small><div>${button('link','\u7de8\u8f2f',l.id)} ${button('delete-link','\u522a\u9664',l.id)}</div></article>`).join('')||'<p>目前篩選條件下沒有線路。</p>'}</div></main><aside id="nt-editor">${editor()}</aside></div>`:'<div class="nt-empty"><h3>\u5efa\u7acb\u9019\u500b\u5c08\u6848\u7684\u7b2c\u4e00\u500b\u6a5f\u6ac3</h3><p>\u5404\u5c08\u6848\u7368\u7acb\u5132\u5b58\uff0c\u53ef\u81ea\u8a02\u591a\u500b\u6a5f\u6ac3\u3001\u7bc0\u9ede\u8207\u9023\u63a5\u57e0\u3002</p></div>'+`<aside id="nt-editor">${editor()}</aside>`}
    </section>`;
    root.querySelector(state.editor?'#nt-editor input, #nt-editor select':'[data-action="close"]')?.focus();
  }
  function map(r) {
    if(!r.devices.length)return '';
    const switches=r.devices.filter(d=>d.kind==='switch'),others=r.devices.filter(d=>d.kind!=='switch');
    const positions=new Map();let width=Math.max(700,switches.length*190+40,Math.min(others.length,4)*190+40);
    switches.forEach((d,i)=>positions.set(d.id,{x:40+i*190,y:25}));others.forEach((d,i)=>positions.set(d.id,{x:40+(i%4)*190,y:160+Math.floor(i/4)*100}));
    const height=Math.max(260,230+Math.ceil(others.length/4)*100);
    return `<p class="nt-map-hint">\u9ede\u9078\u8a2d\u5099\u7a81\u51fa\u9023\u7dda\uff1b\u5be6\u7dda\uff1d\u5df2\u78ba\u8a8d\uff0c\u865b\u7dda\uff1d\u898f\u5283\u4e2d\u3002 ${state.focus?button('focus','\u986f\u793a\u5168\u90e8'):''}</p><div class="nt-svg-scroll"><svg role="img" aria-label="實體配線圖" viewBox="0 0 ${width} ${height}" style="min-width:${width}px">${r.links.filter(l=>(state.filter==='all'||l.network===state.filter)&&pingVisible(linkStatus(l))).map(l=>{const a=positions.get(l.a.device),b=positions.get(l.b.device);if(!a||!b)return '';const dim=state.focus&&![l.a.device,l.b.device].includes(state.focus),status=linkStatus(l);return `<path class="nt-wire nt-${l.network} nt-wire-${status} ${dim?'nt-dim':''}" d="M${a.x+70},${a.y+30} C${a.x+70},${a.y+100} ${b.x+70},${b.y-60} ${b.x+70},${b.y+30}" ${l.state==='planned'?'stroke-dasharray="6 5"':''}><title>${h(endpoint(l.a)+' ↔ '+endpoint(l.b)+' · Ping：'+pingLabels[status])}</title></path>`;}).join('')}${r.devices.map(d=>{const p=positions.get(d.id),status=deviceStatus(d);return `<g class="nt-map-device nt-map-${status} ${pingVisible(status)?'':'nt-dim'}" role="button" tabindex="0" aria-label="${h(d.name)}" data-action="focus" data-key="${h(d.id)}"><rect x="${p.x}" y="${p.y}" width="150" height="58" rx="8"/><text x="${p.x+10}" y="${p.y+24}">${h(d.name.length>19?d.name.slice(0,18)+'…':d.name)}</text><text class="nt-svg-small" x="${p.x+10}" y="${p.y+44}">${h(kinds[d.kind])} · ${d.nodes.length} 個節點</text></g>`;}).join('')}</svg></div>`;
  }
  function card(d) {
    const focused=state.focus===d.id;
    const status=deviceStatus(d);
    return `<article class="nt-device ${focused?'nt-focused':''} ${pingVisible(status)?'':'nt-filtered'}"><div class="nt-card-head"><strong>${h(d.name)}</strong><small>${h(kinds[d.kind])}</small></div><small>${d.nodes.length} 個節點 · ${d.ports.length} 個連接埠 ${d.inventory?'· 專案設備':''} · ${pingBadge(status)}</small><div class="nt-actions">${button('focus',focused?'\u6536\u5408':'\u5c55\u958b',focused?'':d.id)}${button('device','\u7de8\u8f2f',d.id)}${button('delete-device','\u522a\u9664',d.id)}</div>${focused?`<div class="nt-actions">${button('node','＋新增節點',d.id)}${button('port','＋新增連接埠',d.id)}</div>${d.nodes.map(n=>`<div class="nt-node"><strong>${h(n.name)} ↔ ${h(n.bf4||'未配置 DPU')}</strong><dl>${[['host_os','主機 OS'],['host_bmc','主機 BMC'],['dpu_os','DPU OS'],['dpu_bmc','DPU BMC']].map(([k,l])=>`<dt>${l}</dt><dd>${h(n[k]||'—')} ${targetBadge(d,n,k)}</dd>`).join('')}</dl>${button('edit-node','\u7de8\u8f2f',n.id)} ${button('delete-node','\u522a\u9664',n.id)}</div>`).join('')}${d.ports.map(p=>`<div class="nt-port"><strong>${h(p.name)} ${pingBadge(portStatus(d,p))}</strong><small>${h(roles[p.role])} · ${occupied(d.id,p.id)?'已連接':'尚未配對'}</small><small>節點：${h(p.nodes.map(n=>d.nodes.find(x=>x.id===n)?.name).join('、')||'—')}</small>${button('edit-port','\u7de8\u8f2f',p.id)} ${button('delete-port','\u522a\u9664',p.id)}</div>`).join('')}`:''}</article>`;
  }
  function templateFields() {
    return select('template','伺服器範本',[['custom','自訂節點數'],['vera','Vera 預設值（可修改）'],['blank','空白／稍後設定']])+
      field('nodes','每台伺服器的節點數（1～64）',1,'number')+
      select('paired','每個節點建立一張 DPU',[['no','不配置 DPU'],['yes','每個節點一張 DPU']])+
      field('dpu-label','DPU 型號／標籤','BF4');
  }
  function inventoryOsSlots(machine) {
    if(!Array.isArray(machine?.os))return [];
    return machine.os.filter(slot=>slot&&typeof slot==='object').slice(0,64);
  }
  function editor() {
    const e=state.editor;if(!e)return '<div class="nt-help"><h3>\u914d\u7dda\u5de5\u4f5c\u5340</h3><p>1. \u52a0\u5165\u5c08\u6848\u8a2d\u5099\u6216\u81ea\u8a02\u8a2d\u5099\u3002</p><p>2. \u8a2d\u5b9a\u7bc0\u9ede\u3001DPU \u8207\u7ba1\u7406\u57e0\u3002</p><p>3. \u9078\u64c7\u5169\u7aef\u8a2d\u5099\u548c\u57e0\u865f\u914d\u5c0d\u3002</p><p>4. \u5132\u5b58\u62d3\u64b2\u3002</p><p>\u7bc0\u9ede IP \u70ba\u62d3\u64b2\u8a3b\u8a18\uff0c\u4e0d\u6703\u66f4\u6539\u8a2d\u5099\u7db2\u8def\u6216\u767b\u5165\u8cc7\u6599\u3002</p></div>';
    let body='';const d=e.device?device(e.device):null;
    if(e.type==='rack'||e.type==='rename-rack')body=field('name','機櫃名稱',e.type==='rename-rack'?rack().name:'');
    if(e.type==='device') {const x=e.key?device(e.key):null;body=field('name','設備名稱',x?.name)+select('kind','設備類型',[['server','伺服器'],['switch','交換器'],['other','其他設備']],x?.kind||'server');if(!x)body+=templateFields()+field('count','交換器連接埠數量',32,'number');}
    if(e.type==='import')body=`<p>\u52a0\u5165\u8a2d\u5099\u7684\u62d3\u64b2\u526f\u672c\uff0c\u4e0d\u8b8a\u66f4\u5eab\u5b58\u3002</p><div class="nt-checks">${machines.filter(m=>m.project===state.project&&!rack().devices.some(d=>d.inventory===m.name)).map(m=>`<label><input type="checkbox" name="inventory" value="${h(m.name)}">${h(m.name)}</label>`).join('')}</div>${select('node-source','\u4f3a\u670d\u5668\u7bc0\u9ede\u6578\u4f86\u6e90',[['auto','\u4f9d\u5404\u8a2d\u5099 OS Slot \u81ea\u52d5\u5224\u65b7'],['manual','\u6240\u6709\u4f3a\u670d\u5668\u4f7f\u7528\u624b\u52d5\u6578\u91cf']],'auto')}${templateFields()}<p class="nt-form-note">\u81ea\u52d5\u5224\u65b7\u6642\uff0c\u6703\u5e36\u5165\u5404 OS Slot \u7684 OS IP \u8207 BMC IP\uff1b\u6c92\u6709 Slot \u8cc7\u6599\u6642\u4f7f\u7528\u4e0a\u65b9\u624b\u52d5\u7bc0\u9ede\u6578\u3002\u532f\u5165\u5f8c\u4ecd\u53ef\u55ae\u7368\u7de8\u8f2f\u3002</p>${field('count','交換器連接埠數量',48,'number')}`;
    if(e.type==='node'){const n=d.nodes.find(n=>n.id===e.key)||{};body=field('name','節點名稱',n.name)+field('bf4','配對的 DPU 標籤',n.bf4)+[['host_os','主機 OS IP'],['host_bmc','主機 BMC IP'],['dpu_os','DPU OS IP'],['dpu_bmc','DPU BMC IP']].map(([k,label])=>field(k,label,n[k])).join('');}
    if(e.type==='port'){const p=d.ports.find(p=>p.id===e.key)||{};body=field('name','實體連接埠名稱',p.name)+select('role','用途',Object.entries(roles),p.role||'host')+`<p>\u6b64\u57e0\u7ba1\u7406\u7684\u7bc0\u9ede\uff08\u53ef\u591a\u9078\uff09</p><div class="nt-checks">${d.nodes.map(n=>`<label><input type="checkbox" name="node" value="${h(n.id)}" ${p.nodes?.includes(n.id)?'checked':''}>${h(n.name)}</label>`).join('')}</div>`;}
    if(e.type==='link'){const l=rack().links.find(l=>l.id===e.key)||{};body=['a','b'].map((side,i)=>{const dev=device(l[side]?.device)||rack().devices[i]||rack().devices[0];return select(side+'-device','設備 '+side.toUpperCase(),rack().devices.map(d=>[d.id,d.name]),dev?.id)+select(side+'-port','連接埠 '+side.toUpperCase(),(dev?.ports||[]).map(p=>[p.id,p.name+(occupied(dev.id,p.id,e.key)?'（使用中）':'')]),l[side]?.port);}).join('')+select('network','網路類型',Object.entries(roles),l.network||'host')+select('state','配線確認狀態',[['planned','規劃中／尚未確認'],['confirmed','已確認接線']],l.state||'planned')+field('note','備註／VLAN／線材標籤',l.note);}
    if(e.type==='batch')body=`<p>\u4f9d\u52fe\u9078\u8a2d\u5099\u9806\u5e8f\u914d\u5c0d\u4ea4\u63db\u5668\u9023\u7e8c\u57e0\u865f\u3002\u5148\u7522\u751f\u898f\u5283\u7dda\uff0c\u5132\u5b58\u524d\u53ef\u6aa2\u67e5\u3002</p>${select('switch','目標交換器',rack().devices.filter(d=>d.kind==='switch').map(d=>[d.id,d.name]))}${select('role','伺服器連接埠用途',Object.entries(roles),'host')}${field('start','交換器起始埠（依清單位置）',1,'number')}<div class="nt-checks">${rack().devices.filter(d=>d.kind==='server').map(d=>`<label><input type="checkbox" name="servers" value="${h(d.id)}" checked>${h(d.name)}</label>`).join('')}</div>`;
    return `<form class="nt-form"><h3>${h({rack:'新增機櫃','rename-rack':'重新命名機櫃',device:'設備設定',import:'加入專案設備',node:'節點／DPU 對應',port:'實體連接埠',link:'配對連接埠',batch:'批次接線'}[e.type])}</h3>${body}<div class="nt-actions"><button class="btn primary" type="submit">\u5957\u7528\u81f3\u8349\u7a3f</button>${button('cancel','\u53d6\u6d88')}</div></form>`;
  }
  function makeDevice(name,kind,template,count,inventory='',nodeCount=1,paired=false,dpuLabel='DPU',inventorySlots=[]) {
    const d={id:id(),name,kind,inventory,nodes:[],ports:[]};
    if(template!=='blank'&&kind==='server'){
      d.nodes=Array.from({length:nodeCount},(_,i)=>{const slot=inventorySlots[i]||{};return {id:id(),name:'節點 '+(i+1),bf4:paired?dpuLabel+' #'+(i+1):'',host_os:String(slot.ip||'').trim(),host_bmc:String(slot.bmc_ip||'').trim(),dpu_os:'',dpu_bmc:''};});
      d.ports=(paired?['host','dpu']:['host']).map((role,i)=>({id:id(),name:'RJ45 #'+(i+1),role,nodes:d.nodes.map(n=>n.id)}));
    }
    if(kind==='switch')d.ports=Array.from({length:count},(_,i)=>({id:id(),name:String(i+1),role:'other',nodes:[]}));
    return d;
  }
  function number(key,max=256){const n=Number(val(key));if(!Number.isInteger(n)||n<1||n>max)throw Error(`請輸入 1～${max} 的整數。`);return n;}
  function required(key){const value=val(key).trim();if(!value)throw Error('此欄位為必填。');return value;}
  const checked=name=>[...root.querySelectorAll(`input[name="${name}"]:checked`)].map(e=>e.value);
  async function submit() {
    const e=state.editor,r=rack();if(!e)return;
    if(e.type==='rack'){const x={id:id(),name:required('name'),devices:[],links:[]};state.doc.racks.push(x);state.rack=x.id;}
    if(e.type==='rename-rack')r.name=required('name');
    if(e.type==='device') {const name=required('name'),kind=val('kind');if(e.key)Object.assign(device(e.key),{name,kind});else r.devices.push(makeDevice(name,kind,val('template'),kind==='switch'?number('count'):0,'',kind==='server'&&val('template')!=='blank'?number('nodes',64):1,val('paired')==='yes',val('dpu-label').trim()||'DPU'));}
    if(e.type==='import') {const count=number('count'),names=checked('inventory'),template=val('template'),fallbackNodeCount=template==='blank'?1:number('nodes',64),paired=val('paired')==='yes',dpuLabel=val('dpu-label').trim()||'DPU',autoSlots=val('node-source')!=='manual';if(!names.length)throw Error('請至少選擇一台設備。');names.forEach(name=>{const m=machines.find(m=>m.name===name),type=mgxTypeOf(m),kind=['server','switch'].includes(type)?type:'other',slots=kind==='server'&&autoSlots&&template!=='blank'?inventoryOsSlots(m):[],nodeCount=slots.length||fallbackNodeCount;r.devices.push(makeDevice(name,kind,template,count,name,nodeCount,paired,dpuLabel,slots));});}
    if(e.type==='node'){const d=device(e.device),n={id:e.key||id(),name:required('name'),bf4:val('bf4').trim()};for(const k of ['host_os','host_bmc','dpu_os','dpu_bmc'])n[k]=val(k).trim();const index=d.nodes.findIndex(x=>x.id===e.key);if(index<0)d.nodes.push(n);else d.nodes[index]=n;}
    if(e.type==='port'){const d=device(e.device),name=required('name');if(d.ports.some(p=>p.id!==e.key&&p.name===name))throw Error('這個連接埠名稱已經存在。');const p={id:e.key||id(),name,role:val('role'),nodes:checked('node')};const index=d.ports.findIndex(x=>x.id===e.key);if(index<0)d.ports.push(p);else d.ports[index]=p;}
    if(e.type==='link') {const l={id:e.key||id(),a:{device:required('a-device'),port:required('a-port')},b:{device:required('b-device'),port:required('b-port')},network:val('network'),state:val('state'),note:val('note').trim()};if(l.a.device===l.b.device)throw Error('請選擇兩台不同的設備。');if([l.a,l.b].some(x=>occupied(x.device,x.port,e.key)))throw Error('這個實體連接埠已經接線，請先編輯或刪除既有線路。');const index=r.links.findIndex(x=>x.id===e.key);if(index<0)r.links.push(l);else r.links[index]=l;}
    if(e.type==='batch') {const sw=device(required('switch')),start=number('start')-1,role=val('role'),servers=checked('servers');if(!servers.length)throw Error('請選擇伺服器。');const additions=servers.map((key,i)=>{const d=device(key),ports=d.ports.filter(p=>p.role===role),sp=sw.ports[start+i];if(ports.length!==1)throw Error(`${d.name}：需要正好一個「${roles[role]}」連接埠；若有多個連接埠，請改用手動配對。`);if(!sp)throw Error('交換器沒有足夠的連接埠。');if(occupied(d.id,ports[0].id)||occupied(sw.id,sp.id))throw Error(`${d.name}／交換器 ${sp.name}：連接埠已經接線。`);return {id:id(),a:{device:d.id,port:ports[0].id},b:{device:sw.id,port:sp.id},network:role,state:'planned',note:''};});r.links.push(...additions);}
    changed();
  }
  async function action(name,key) {
    if(name==='close')return close();
    if(name==='ping'){
      if(state.dirty||state.editor)throw Error('\u8acb\u5148\u5132\u5b58\u62d3\u64b2\uff0c\u518d\u6aa2\u67e5 IP\u3002');
      state.busy=true;state.pinging=true;render();
      try{state.ping=await api('/api/projects/'+encodeURIComponent(state.project)+'/topology/ping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rack_id:state.rack})});}
      finally{state.busy=false;state.pinging=false;render();}
      return;
    }
    if(name==='save'){
      if(state.editor)throw Error('儲存前請先套用或取消目前的編輯表單。');
      state.busy=true;root.querySelector('[data-action="save"]').disabled=true;
      try{state.doc=await api('/api/projects/'+encodeURIComponent(state.project)+'/topology',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state.doc)});state.dirty=false;window.dispatchEvent(new CustomEvent('pa-topology-saved',{detail:{project:state.project,document:state.doc}}));render();}finally{state.busy=false;const b=root?.querySelector('[data-action="save"]');if(b)b.disabled=false;}return;
    }
    if(name==='reload'){if((state.dirty||state.editor)&&!await confirmDraft('要放棄目前草稿並載入最新儲存的拓樸嗎？'))return;state.busy=true;try{state.doc=await api('/api/projects/'+encodeURIComponent(state.project)+'/topology');state.rack=state.doc.racks[0]?.id||'';state.dirty=false;state.editor=null;state.focus='';state.ping=null;render();}finally{state.busy=false;}return;}
    if(name==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(state.doc,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='topology.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(name==='cancel'){if(!await confirmDraft('要放棄尚未套用的表單內容嗎？'))return;state.editor=null;render();return;}
    if(name==='focus'){if(state.editor)throw Error('請先套用或取消目前的編輯表單。');state.focus=key;render();return;}
    if(name.startsWith('delete-')){
      if(!await confirmDraft('要從草稿刪除此項目及其相關線路／對應關係嗎？'))return;
      const r=rack();
      if(name==='delete-rack'){state.doc.racks=state.doc.racks.filter(x=>x.id!==r.id);state.rack=state.doc.racks[0]?.id||'';state.focus='';}
      if(name==='delete-device'){r.devices=r.devices.filter(d=>d.id!==key);r.links=r.links.filter(l=>![l.a.device,l.b.device].includes(key));if(state.focus===key)state.focus='';}
      if(name==='delete-link')r.links=r.links.filter(l=>l.id!==key);
      if(name==='delete-node'){const d=device(state.focus);d.nodes=d.nodes.filter(n=>n.id!==key);d.ports.forEach(p=>p.nodes=p.nodes.filter(n=>n!==key));}
      if(name==='delete-port'){const d=device(state.focus);d.ports=d.ports.filter(p=>p.id!==key);r.links=r.links.filter(l=>![l.a,l.b].some(x=>x.device===d.id&&x.port===key));}
      changed();return;
    }
    if(state.editor&&!await confirmDraft('要放棄尚未套用的表單內容嗎？'))return;
    if(['node','port'].includes(name)){state.focus=key;state.editor={type:name,device:key,key:''};}
    else if(['edit-node','edit-port'].includes(name))state.editor={type:name.slice(5),device:state.focus,key};
    else state.editor={type:name,key};
    render();
  }
  window.addEventListener('beforeunload',event=>{if(state?.dirty||state?.editor){event.preventDefault();event.returnValue='';}});
  window.PATopology={open};
})();
