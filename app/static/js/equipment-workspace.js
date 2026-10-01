/* Additive presentation only. Existing API handlers and multi-OS workflows remain owned by app.js. */
(() => {
  'use strict';
  const q = value => esc(JSON.stringify(String(value ?? '')));
  let cduVisualSequence = 0;
  function externalCduVisual() {
    const id=`ew-tc1288-${++cduVisualSequence}`;
    // Front elevation follows the same TC1288 reference as the rack's 3D shell.
    // The HMI pattern and blue accent lights are appearance, not live telemetry.
    const rails=[60,180].map(x=>`<path d="M${x} 22V306" stroke="#073781" stroke-width="5"/><path d="M${x} 22V306" stroke="#1684ff" stroke-width="2.6"/><path d="M${x} 22V306" stroke="#87deff" stroke-width=".7"/>`).join('');
    const segments=[67,173].map((x,i)=>[50,125,200].map(y=>`<path d="M${x} ${y+i*20}v48" stroke="#0862c5" stroke-width="3.5"/><path d="M${x} ${y+i*20}v48" stroke="#57cfff" stroke-width="1.2"/>`).join('')).join('');
    return `<svg class="pa-hardware-visual ew-cdu-cabinet" data-hardware-type="cdu" data-hardware-view="front" data-hardware-units="0" viewBox="0 0 240 330" role="img" aria-label="TC1288 \u5916\u7f6e CDU \u5916\u89c0\u53c3\u8003" xmlns="http://www.w3.org/2000/svg">
      <title>TC1288 \u5916\u7f6e CDU \u5916\u89c0\u53c3\u8003</title>
      <defs><linearGradient id="${id}-shell" x2="1" y2=".3"><stop stop-color="#343940"/><stop offset=".18" stop-color="#1e2329"/><stop offset=".8" stop-color="#15191f"/><stop offset="1" stop-color="#30353b"/></linearGradient><linearGradient id="${id}-door" x2=".7" y2="1"><stop stop-color="#292e35"/><stop offset=".45" stop-color="#181c22"/><stop offset="1" stop-color="#101419"/></linearGradient><pattern id="${id}-mesh" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".65" fill="#03070c"/></pattern></defs>
      <ellipse cx="120" cy="319" rx="69" ry="5" fill="#000" opacity=".15"/>
      <rect x="56" y="8" width="128" height="307" rx="4" fill="url(#${id}-shell)" stroke="#080d14" stroke-width="1.6"/>
      <path d="M61 11H179M57 15V310" fill="none" stroke="#5b626a" stroke-width=".8"/>
      <rect x="72" y="13" width="96" height="297" rx="2" fill="url(#${id}-door)" stroke="#090e15" stroke-width="1.1"/>
      <path d="M74 15H166M74 16V307" fill="none" stroke="#434b54" stroke-width=".45"/>
      <g stroke-linecap="round">${rails}${segments}</g>
      <text x="120" y="61" text-anchor="middle" fill="#2797b7" font-family="Arial,sans-serif" font-size="12" letter-spacing="-.5">Cooling</text>
      <rect x="103" y="79" width="36" height="29" rx="1.4" fill="#0a0d13" stroke="#3f4850" stroke-width="1.4"/>
      <rect x="107" y="83" width="28" height="21" fill="#203d51" stroke="#617a89" stroke-width=".6"/>
      <path d="M110 86h22M119 88v12M110 94h21M126 88v12" stroke="#45768c" stroke-width=".6"/>
      <g fill="#73949e"><rect x="110" y="89" width="6" height="3"/><rect x="122" y="96" width="9" height="4"/></g>
      <circle cx="87" cy="94" r="6.5" fill="#dab334" stroke="#5d4910" stroke-width="1.2"/><circle cx="87" cy="94" r="4.3" fill="#ac2825" stroke="#e25844" stroke-width=".8"/>
      <rect x="161" y="188" width="3.2" height="17" rx="1.4" fill="#0b0e12" stroke="#5e6870" stroke-width=".5"/><circle cx="163" cy="186" r="1.6" fill="#7b8589"/>
      <rect x="89" y="267" width="62" height="29" rx="1" fill="#14263a" stroke="#080c11" stroke-width="2"/><rect x="90" y="268" width="60" height="27" fill="url(#${id}-mesh)"/>
      <path d="M91 269H149M91 294H149" stroke="#225182" stroke-width=".7"/>
      <rect x="68" y="316" width="15" height="3" fill="#11171c"/><rect x="157" y="316" width="15" height="3" fill="#11171c"/>
    </svg>`;
  }
  const baseMachine = RENDERERS.machine;
  RENDERERS.machine = function() {
    const root = document.createElement('div'); root.innerHTML = baseMachine();
    const machine = machines.find(m => m.name === _activeMachine);
    if (!machine || !root.querySelector('.pd-showcase')) return root.innerHTML;
    const type = PAHardwareVisuals.typeOf(machine);
    const stage = root.querySelector('.pd-hardware-stage');
    if (stage) {
      stage.dataset.componentType = type;
      // Match the saved CDU installation without changing its inventory or U slots.
      const external = rackIsExternal(machine);
      const caption = external ? 'TC1288 \u5916\u7f6e CDU \u5916\u89c0\u53c3\u8003 \u00b7 \u975e\u672c\u6a5f\u5be6\u969b\u5916\u89c0' : PAHardwareVisuals.caption(type);
      stage.innerHTML = (external ? externalCduVisual() : PAHardwareVisuals.render(machine)) + `<span class="pd-stage-caption">${esc(caption)}</span>`;
    }
    root.querySelector('.pd-workspace').dataset.componentType = type;
    const hw = machineDetailCache[_activeMachine]?.os_info?.hw || {};
    if (type !== 'server') {
      const heading = root.querySelector('.pd-identity-heading');
      if (heading && !hw.system?.model && !machine.model) heading.textContent = PAHardwareVisuals.label(type);
      root.querySelectorAll('.pd-summary-tile').forEach(tile => {
        const key = {memory:'dimm',storage:'ssd',network:'nic'}[tile.dataset.inventory] || tile.dataset.inventory;
        if (hw[key] == null) tile.remove();
      });
    }
    // Do not truncate the reported inventory to the legacy first twelve drives.
    const ssd = root.querySelector('.ssd-grid');
    if (ssd && Array.isArray(hw.ssd)) ssd.innerHTML = hw.ssd.map(d => `<div class="ssd-cell"><span class="ssd-name mono">${esc(d.name || '')}</span><span class="ssd-model">${esc(d.model || '')}</span><span class="ssd-size">${esc(d.size || '')}</span></div>`).join('');
    root.querySelectorAll('.hw-item').forEach((section, index) => {
      section.classList.add('ew-inventory-section');
      section.dataset.sectionIndex = String(index + 1).padStart(2,'0');
      const label = section.querySelector('.hw-label');
      if (label) label.setAttribute('role','heading');
      if (label) label.setAttribute('aria-level','3');
    });
    return root.innerHTML;
  };
  // Stable wrapper: asynchronous sensor refreshes use this same rendering function.
  const baseSensors = machineSensorsHtml;
  machineSensorsHtml = function(...args) {
    const root = document.createElement('div'); root.innerHTML = baseSensors(...args);
    const ai = root.querySelector('#sensor-ai');
    if (ai) {
      const panel = document.createElement('section'); panel.className = 'ew-analysis';
      panel.innerHTML = '<header><span>\u8f14\u52a9\u5206\u6790</span><h3>\u611f\u6e2c\u5668 AI \u5206\u6790</h3></header>';
      ai.before(panel); panel.append(ai);
    }
    const table = root.querySelector('.sdr-scroll');
    if (table) table.insertAdjacentHTML('beforebegin','<h3 class="ew-sdr-title">\u611f\u6e2c\u5668\u8b80\u503c <small>SDR \u611f\u6e2c\u5668\u6e05\u55ae</small></h3>');
    return root.innerHTML;
  };

  let scene = null, canvas = null;
  let topologyAbort = null, topologyGeneration = 0;
  let networkVisible = true;
  const pingLabels = {up:'\u53ef\u9054',down:'\u7121\u56de\u61c9',partial:'\u90e8\u5206\u7bc0\u9ede\u7121\u56de\u61c9',unknown:'\u5c1a\u672a\u6aa2\u67e5\uff0f\u672a\u8a2d\u5b9a IP'};
  function pingRecord(item) {
    if (rackView.pingProject !== rackView.project) return null;
    const result = rackView.pinged?.find(record=>record.name===item.name);
    if (!result || (result.os_ip||'') !== (item.os_ip||'') || (result.bmc_ip||'') !== (item.bmc_ip||'')) return null;
    return result;
  }
  function sceneComponents() {
    return PAWorkspaceReliability.validatePlacements(rackMembers()).valid.map(item=>({
      ...item, mgx_type:PAHardwareVisuals.typeOf(item),
      rack_ping_state:pingRecord(item)?.rack_ping_state || 'unknown'
    }));
  }
  function networkSummary(errorMessage='') {
    const label=document.getElementById('ew-network-note');
    if(!label)return;
    if(errorMessage){label.textContent=errorMessage;return;}
    const network=scene?.getState?.().networkCabling;
    if(!network)return;
    const count=network.routes?.length||0,skipped=network.skipped?.length||0;
    label.textContent=(count
      ? '\u5df2\u5132\u5b58\u62d3\u6a38\uff1a'+count+'\u689d\u5be6\u9ad4\u7dda \u00b7 \u5de6\uff1a\u4e3b\u6a5f\uff0f\u96fb\u529b\uff0f\u51b7\u537b \u00b7 \u53f3\uff1aDPU\uff0f\u4ea4\u63db\u5668\u4e92\u806f'
      : '\u5c1a\u7121\u53ef\u986f\u793a\u7684\u5df2\u5132\u5b58\u914d\u7dda\uff0c\u8acb\u5728\u7db2\u8def\u62d3\u6a38\u914d\u5c0d\u5df2\u4e0a\u6ac3\u8a2d\u5099\u3002')
      +(skipped?' \u00b7 '+skipped+'\u689d\u56e0\u672a\u5c0d\u61c9\u5df2\u5b89\u88dd\u8a2d\u5099\u800c\u7565\u904e':'');
  }
  function networkControls() {
    const camera=document.querySelector('.ew-rack-camera');
    if(!camera||document.getElementById('ew-network-toggle'))return;
    camera.insertAdjacentHTML('beforeend','<span class="ew-camera-divider"></span><button type="button" class="btn small" id="ew-network-toggle" aria-pressed="'+networkVisible+'" onclick="equipmentRackNetworkToggle()">'+(networkVisible?'\u96b1\u85cf\u914d\u7dda':'\u986f\u793a\u914d\u7dda')+'</button>');
    camera.insertAdjacentHTML('afterend','<div class="ew-network-status"><p id="ew-network-note" role="status">\u6b63\u5728\u8b80\u53d6\u5df2\u5132\u5b58\u62d3\u6a38\u2026</p><p class="ew-led-legend"><span><i class="ew-led-up"></i>\u7da0\uff1aPing \u53ef\u9054</span><span><i class="ew-led-down"></i>\u7d05\uff1a\u6709 IP \u7121\u56de\u61c9</span><span><i class="ew-led-unknown"></i>\u7070\uff1a\u672a\u6aa2\u67e5\uff0f\u672a\u8a2d IP</span><span>\u71c8\u865f\u8868\u793a Ping \u7d50\u679c</span></p></div>');
  }
  window.equipmentRackNetworkToggle = () => {
    networkVisible=!networkVisible;scene?.setNetworkVisible?.(networkVisible);
    const button=document.getElementById('ew-network-toggle');
    if(button){button.setAttribute('aria-pressed',String(networkVisible));button.textContent=networkVisible?'\u96b1\u85cf\u914d\u7dda':'\u986f\u793a\u914d\u7dda';}
  };
  async function loadRackTopology(project, target) {
    topologyAbort?.abort();
    const generation=++topologyGeneration,controller=new AbortController();
    topologyAbort=controller;
    try {
      const document=await api('/api/projects/'+encodeURIComponent(project)+'/topology',{signal:controller.signal});
      if(generation!==topologyGeneration||canvas!==target||rackView.project!==project||!target.isConnected)return;
      scene?.setTopology?.(document);networkSummary();
    } catch(error) {
      if(error.name==='AbortError'||generation!==topologyGeneration||canvas!==target)return;
      networkSummary('\u914d\u7dda\u8cc7\u6599\u8b80\u53d6\u5931\u6557\uff0c\u8acb\u91cd\u65b0\u8f09\u5165\u6a5f\u6ac3\u3002');
    }
  }
  window.addEventListener('pa-topology-saved',event=>{
    if(event.detail?.project!==rackView.project)return;
    topologyGeneration++;topologyAbort?.abort();
    rackPingRequest++;rackView.pinged=null;rackView.pingProject='';rackView.pingCheckedAt='';
    const pingButton=document.getElementById('rack-ping-btn');
    if(pingButton){pingButton.disabled=false;pingButton.textContent='\ud83d\udce1 Ping Rack';}
    const summary=document.getElementById('rack-ping-summary');
    if(summary)summary.innerHTML=rackStatusCounts(rackMembers(),[]);
    const failures=document.getElementById('rack-ping-failures');
    if(failures)failures.innerHTML='';
    if(!canvas?.isConnected)return;
    scene?.setComponents?.(sceneComponents());
    scene?.setTopology?.(event.detail.document);networkSummary();
    inspector(selectedByProject.get(rackView.project)||'');
  });
  let mode = '3d';
  let expanded = false;
  let flowEnabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.equipmentRackFlowToggle = () => {
    flowEnabled = !flowEnabled;
    scene?.setFlowEnabled?.(flowEnabled);
    const button=document.getElementById('ew-flow-toggle');
    if(button){button.setAttribute('aria-pressed',String(flowEnabled));button.textContent=flowEnabled?'\u66ab\u505c\u6c34\u6d41':'\u986f\u793a\u6c34\u6d41';}
  };
  window.equipmentRackAdd = () => {if(expanded)equipmentRackExpand(false);rackAddEntry();};
  const selectedByProject = new Map();
  const baseLayout = rackLayoutHtml;
  function rackMembers() { return projectMembers(rackView.project).filter(isRackItem); }
  window.equipmentRackMode = value => { mode = value === 'plane' ? 'plane' : '3d'; setView('rack'); };
  window.equipmentRackCamera = value => { if (value === 'reset') scene?.resetOrbit(); else scene?.setView(value); };
  window.equipmentRackZoom = factor => scene?.zoomBy(factor);
  window.equipmentRackFocus = () => scene?.focusSelection?.();
  window.equipmentRackPlacement = name => {if(expanded)equipmentRackExpand(false);rackMoveDialog(name);};
  window.equipmentRackExpand = value => {
    expanded = typeof value === 'boolean' ? value : !expanded;
    const deck = document.querySelector('.ew-rack-deck');
    deck?.classList.toggle('is-expanded',expanded);
    const button = deck?.querySelector('.ew-expand');
    if(button){button.setAttribute('aria-pressed',String(expanded));button.textContent=expanded?'\u96e2\u958b\u653e\u5927\u6aa2\u8996':'\u653e\u5927\u6aa2\u8996';}
    scene?.resize();
  };
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&expanded){equipmentRackExpand(false);document.querySelector('.ew-expand')?.focus();}
    if(event.key==='Tab'&&expanded){
      const deck=document.querySelector('.ew-rack-deck.is-expanded');
      const targets=deck?[...deck.querySelectorAll('button:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length):[];
      if(targets.length&&event.shiftKey&&(document.activeElement===targets[0]||!deck.contains(document.activeElement))){event.preventDefault();targets.at(-1).focus();}
      else if(targets.length&&!event.shiftKey&&(document.activeElement===targets.at(-1)||!deck.contains(document.activeElement))){event.preventDefault();targets[0].focus();}
    }
  });
  function inspector(name) {
    const target = document.getElementById('ew-rack-inspector');
    if (!target) return;
    const m = rackMembers().find(item => item.name === name);
    if (!m) {target.innerHTML = '<div class="ew-inspector-empty">\u9078\u64c7\u5143\u4ef6\uff0c\u67e5\u770b\u5b89\u88dd\u4f4d\u7f6e\u8207\u7ba1\u7406\u4ecb\u9762\u3002</div>';return;}
    const type = PAHardwareVisuals.typeOf(m);
    const external=rackIsExternal(m);
    const top=Number(m.rack_u)||0,size=Number(m.rack_size)||1;
    const sizeLabel=external?'\u5916\u7f6e':`${size}U`;
    const placed=PAWorkspaceReliability.validatePlacements(rackMembers()).valid.some(item=>item.name===m.name);
    const range=external?'\u6a5f\u6ac3\u6b63\u9762\u53f3\u5074':top>0?(size===1?`U${top}`:`U${top} \u2014 U${top-size+1}`):'\u5c1a\u672a\u653e\u7f6e';
    target.innerHTML = `<div class="ew-identity-top"><span class="pd-eyebrow">${esc(PAHardwareVisuals.label(type))}</span><span class="ew-size-badge">${sizeLabel}</span></div><h2>${esc(m.name)}</h2><div class="ew-device-elevation">${external?externalCduVisual():PAHardwareVisuals.render(m,{view:'front'})}<span>\u6b63\u9762\u8996\u5716\uff0f ${sizeLabel}</span></div><button class="btn small ew-focus" onclick="equipmentRackFocus()" ${placed?'':'disabled'}>\u805a\u7126 3D \u5143\u4ef6</button><p class="ew-illustration-note">${esc(external?'TC1288 \u5916\u89c0\u53c3\u8003 \u00b7 \u975e\u672c\u6a5f\u5be6\u969b\u5916\u89c0':PAHardwareVisuals.caption(type))}</p><dl><div><dt>\u5b89\u88dd\u4f4d\u7f6e</dt><dd>${range}<small>${external?'\u4e0d\u5360\u6a5f\u6ac3 U \u4f4d':placed?'\u5df2\u5132\u5b58\u7684\u6a5f\u6ac3\u4f4d\u7f6e':top?'\u8acb\u6aa2\u67e5\u4f4d\u7f6e\u885d\u7a81':'\u5c1a\u672a\u5b89\u88dd\u65bc\u6a5f\u6ac3'}</small></dd></div><div><dt>OS\uff0f\u7ba1\u7406\u4ecb\u9762</dt><dd>${esc(m.os_ip || '\u672a\u8a2d\u5b9a')}</dd></div><div><dt>BMC</dt><dd>${esc(m.bmc_ip || '\u672a\u8a2d\u5b9a')}</dd></div></dl><div class="ew-inspector-actions"><button class="btn primary" onclick="openMachine(${q(m.name)})">\u958b\u555f\u5143\u4ef6\u8a73\u60c5</button><button class="btn" onclick="rackMoveDialog(${q(m.name)})">${type==='cdu'?'CDU \u5b89\u88dd\u8a2d\u5b9a':'\u6a5f\u6ac3\u4f4d\u7f6e'}</button></div>`;
    const status=value=>value===true?'Ping \u53ef\u9054':value===false?'Ping \u672a\u56de\u61c9':'\u5c1a\u672a\u89c0\u6e2c';
    const powerLabel=value=>{const raw=String(value??'').trim();return ({on:'\u5df2\u958b\u6a5f',off:'\u5df2\u95dc\u6a5f',true:'\u5df2\u958b\u6a5f',false:'\u5df2\u95dc\u6a5f','1':'\u5df2\u958b\u6a5f','0':'\u5df2\u95dc\u6a5f',unknown:'\u672a\u77e5',unavailable:'\u7121\u6cd5\u53d6\u5f97','n/a':'\u4e0d\u9069\u7528','not available':'\u7121\u6cd5\u53d6\u5f97',powering_on:'\u958b\u6a5f\u4e2d',powering_off:'\u95dc\u6a5f\u4e2d'})[raw.toLowerCase()]||raw||'\u672a\u77e5';};
    target.querySelector('.ew-inspector-actions .btn:not(.primary)').onclick=()=>equipmentRackPlacement(m.name);
    if(!scene?.supported)target.querySelector('.ew-focus').disabled=true;
    target.querySelector('dl').insertAdjacentHTML('beforeend',`<div><dt>\u9023\u7dda\uff0f\u96fb\u6e90\u72c0\u614b</dt><dd>OS ${m.os_ip?status(m.os_alive):'\u672a\u8a2d\u5b9a'}<br>BMC ${m.bmc_ip?status(m.bmc_alive):'\u672a\u8a2d\u5b9a'}<br>\u96fb\u6e90 ${esc(powerLabel(m.power_state ?? m.power))}</dd></div>`);
    if(type==='cdu')target.querySelector('dl').innerHTML=`<div><dt>\u5b89\u88dd\u4f4d\u7f6e</dt><dd>${range}</dd></div><div><dt>\u7ba1\u7406 IP</dt><dd>${esc(m.os_ip||m.bmc_ip||'\u672a\u8a2d\u5b9a')}</dd></div><div><dt>\u63a1\u96c6\u72c0\u614b</dt><dd>\u5c1a\u672a\u6574\u5408 CDU \u63a1\u96c6\u5668</dd></div>`;
    if(type!=='blanking'){
      const ping=pingRecord(m),counts=ping?.ping_counts;
      const detail=counts?`${counts.alive} / ${counts.configured} \u500b\u5df2\u8a2d\u5b9a IP \u53ef\u9054`:'';
      target.querySelector('dl').insertAdjacentHTML('beforeend',`<div class="ew-ping-detail"><dt>3D Ping \u71c8\u865f</dt><dd>${esc(pingLabels[ping?.rack_ping_state]||pingLabels.unknown)}<small>${esc(detail)}</small>${ping&&rackView.pingCheckedAt?'<small>'+esc(new Date(rackView.pingCheckedAt).toLocaleString())+'</small>':''}</dd></div>`);
    }

  }
  window.equipmentRackSelect = name => {
    selectedByProject.set(rackView.project,name); scene?.select(name); inspector(name);
    const picker = document.getElementById('ew-rack-component'); if (picker) picker.value = name;
  };
  rackLayoutHtml = function(members,pinged) {
    members=rackMembers();
    const placement = PAWorkspaceReliability.validatePlacements(members);
    const hasCdu = placement.valid.some(m=>PAHardwareVisuals.typeOf(m)==='cdu');
    const old = baseLayout(devicesView === 'plane' ? placement.valid.filter(m=>!rackIsExternal(m)) : members,pinged);
    if (devicesView !== 'plane') return old;
    const tabs=document.createElement('div');tabs.innerHTML=rackSubviewTabs();
    tabs.querySelectorAll('button').forEach(button=>{if((button.getAttribute('onclick')||'').includes("'plane'"))button.remove();});
    const controls = `<div class="ew-view-switch"><button aria-pressed="${mode==='3d'}" class="btn ${mode==='3d'?'primary':''}" onclick="equipmentRackMode('3d')">3D \u6a5f\u6ac3</button><button aria-pressed="${mode==='plane'}" class="btn ${mode==='plane'?'primary':''}" onclick="equipmentRackMode('plane')">48U \u914d\u7f6e</button>${tabs.innerHTML}<button class="btn primary" id="ew-rack-add" onclick="equipmentRackAdd()">\uff0b \u65b0\u589e\u81f3\u6a5f\u6ac3</button></div>`;
    const external = placement.valid.find(rackIsExternal);
    const externalCard = external ? `<div class="ew-external-cdu"><div><strong>${esc(external.name)}</strong><span>\u5916\u7f6e CDU / \u6a5f\u6ac3\u6b63\u9762\u53f3\u5074 / \u4e0d\u5360 U \u4f4d</span></div><button class="btn small" onclick="rackCduDialog(${q(rackView.project)})">\u7de8\u8f2f CDU</button></div>` : '';
    if (mode === 'plane') return controls + externalCard + old;
    const warnings = [...placement.issues.map(x=>`${x.name}: ${x.message}`),...placement.pending.map(x=>`${x.name}: \u5c1a\u672a\u653e\u7f6e`)];
    return `${controls}<section class="ew-rack-deck p-surface ${expanded?'is-expanded':''}">
      <div class="ew-rack-stage">
        <header><div><span class="pd-eyebrow">L11\uff0f\u6a5f\u6ac3\u5de5\u7a0b</span><h2>${esc(rackView.project)}</h2></div><button class="btn small ew-expand" aria-pressed="${expanded}" onclick="equipmentRackExpand()">${expanded?'\u96e2\u958b\u653e\u5927\u6aa2\u8996':'\u653e\u5927\u6aa2\u8996'}</button></header>
        <div class="ew-rack-summary"><span><b>${placement.valid.length}</b> \u500b\u5df2\u5b89\u88dd\u5143\u4ef6</span><span><b>${placement.usedU}</b> / 48U \u5df2\u4f7f\u7528</span><span><b>${48-placement.usedU}</b>U \u53ef\u7528\u7a7a\u9593</span></div>
        <div class="ew-rack-viewport"><canvas id="ew-rack-canvas" tabindex="0" aria-label="3D \u6a5f\u6ac3\u3002\u62d6\u66f3\u6216\u4f7f\u7528\u65b9\u5411\u9375\u65cb\u8f49\uff1bHome \u56de\u5230\u5168\u6ac3\u3002\u53ef\u4f7f\u7528\u5143\u4ef6\u9078\u55ae\u4ee5\u9375\u76e4\u9078\u53d6\u3002"></canvas><span class="ew-stage-mark" aria-hidden="true">48U<br><small>\u914d\u7f6e\u6a21\u578b</small></span></div>
        <div class="ew-rack-camera"><button class="btn small" onclick="equipmentRackCamera('perspective')">\u900f\u8996</button><button class="btn small" onclick="equipmentRackCamera('front')">\u6b63\u9762</button><button class="btn small" onclick="equipmentRackCamera('rear')">\u80cc\u9762</button><span class="ew-camera-divider"></span><button class="btn small" onclick="equipmentRackZoom(1.12)" aria-label="\u653e\u5927">+</button><button class="btn small" onclick="equipmentRackZoom(0.893)" aria-label="\u7e2e\u5c0f">−</button><button class="btn small" onclick="equipmentRackCamera('reset')">\u91cd\u8a2d\u8996\u89d2</button><span class="ew-camera-divider"></span><button class="btn small" id="ew-flow-toggle" ${hasCdu?'':'disabled'} aria-pressed="${hasCdu&&flowEnabled}" onclick="equipmentRackFlowToggle()">${!hasCdu?'\u672a\u9023\u63a5 CDU':flowEnabled?'\u66ab\u505c\u6c34\u6d41':'\u986f\u793a\u6c34\u6d41'}</button></div><p class="ew-flow-note">${hasCdu?`<span class="ew-flow-blue">\u85cd\uff1aCDU \u2192 Rack</span><span class="ew-flow-red">\u7d05\uff1aRack \u2192 CDU</span><span>\u6d41\u5411\u793a\u610f\uff0c\u975e\u5373\u6642\u6d41\u91cf</span>`:'<span>\u5c1a\u672a\u5b89\u88dd CDU\uff0c\u7ba1\u8def\u63a5\u982d\u4fdd\u7559\u5c01\u84cb\u3002</span>'}</p><p class="ew-orbit-hint">\u62d6\u66f3\u65cb\u8f49\uff0f\u9ede\u64ca\u9078\u53d6 \u00b7 Home\uff1a\u56de\u5230\u5168\u6ac3 \u00b7 Esc\uff1a\u96e2\u958b\u653e\u5927\u6aa2\u8996</p>
      </div>
      <aside class="ew-rack-aside"><label for="ew-rack-component">\u5143\u4ef6\uff0f\u5df2\u5132\u5b58\u4f4d\u7f6e</label><select id="ew-rack-component" onchange="equipmentRackSelect(this.value)"><option value="">\u9078\u64c7\u5143\u4ef6</option>${[...members].sort((a,b)=>Number(b.rack_u)-Number(a.rack_u)).map(m=>`<option value="${esc(m.name)}">${rackIsExternal(m)?'\u5916\u7f6e':Number(m.rack_u)>0?`U${Number(m.rack_u)}`:'\u5c1a\u672a\u653e\u7f6e'} / ${esc(m.name)} \u00b7 ${esc(PAHardwareVisuals.label(PAHardwareVisuals.typeOf(m)))}</option>`).join('')}</select><div id="ew-rack-inspector"></div></aside>
    </section>${warnings.length?`<div class="ew-placement-warning" role="status"><strong>\u914d\u7f6e\u9700\u8981\u78ba\u8a8d</strong><p>${warnings.map(esc).join('<br>')}</p><button class="btn" onclick="equipmentRackMode('plane')">\u6aa2\u67e5\u914d\u7f6e</button></div>`:''}${rackView.project?`<div class="ew-rack-support ew-rack-support-single">${rackCopilotHtml()}</div>`:''}`;
  };
  const baseRack = RENDERERS.rack;
  RENDERERS.rack = function() {
    const choices=PAWorkspaceReliability.rackProjects();
    const requested=choices.find(p=>p.name===rackView.project);
    if(requested && !projectMembers(requested.name).filter(isRackItem).some(m=>Number(m.rack_u)>0||rackIsExternal(m))) {
      racksProjectDesc=requested.desc||'';
      return `<header class="rack-hero"><div class="rack-hero-left"><div class="rack-hero-title">\u6a5f\u6ac3\u7ba1\u7406</div><div class="rack-hero-sub">${esc(requested.name)} / 48U</div></div><label class="rack-sel">\u5c08\u6848<select class="input" onchange="rackSetProject(this.value)">${choices.map(p=>`<option value="${esc(p.name)}" ${p.name===requested.name?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><button class="btn primary" onclick="rackAddEntry()">\u65b0\u589e\u5143\u4ef6</button></header>${rackLayoutHtml([],[])}`;
    }
    const fragment=document.createElement('div');fragment.innerHTML=baseRack();
    const select=fragment.querySelector('.rack-sel select');
    const existing=new Set([...select?.options||[]].map(x=>x.value));
    choices.filter(p=>!existing.has(p.name)).forEach(p=>select?.insertAdjacentHTML('beforeend',`<option value="${esc(p.name)}">${esc(p.name)} (0)</option>`));
    return fragment.innerHTML;
  };
  function dispose() {topologyGeneration++;topologyAbort?.abort();topologyAbort=null;scene?.destroy(); scene=null; canvas=null;}
  function mount() {
    const next = document.getElementById('ew-rack-canvas');
    if (next === canvas) return;
    dispose(); if (!next) return; canvas = next;
    const valid = PAWorkspaceReliability.validatePlacements(rackMembers()).valid;
    const fallback=()=>{if(!next.parentElement?.querySelector('.ew-gl-fallback'))next.insertAdjacentHTML('afterend','<div class="ew-gl-fallback" role="status">\u76ee\u524d\u7121\u6cd5\u986f\u793a 3D\uff0c\u4ecd\u53ef\u4f7f\u7528\u5168\u90e8\u7ba1\u7406\u529f\u80fd\uff1a<button class="btn" onclick="equipmentRackMode(\'plane\')">48U \u914d\u7f6e</button>.</div>');};
    next.addEventListener('pa-rack-fallback',fallback);
    next.addEventListener('pa-rack-ready',()=>next.parentElement?.querySelector('.ew-gl-fallback')?.remove());
    scene = PARackScene.mount(canvas,{components:sceneComponents(),theme:document.documentElement.dataset.theme,onSelect:window.equipmentRackSelect});
    scene.setFlowEnabled?.(flowEnabled);
    scene.setNetworkVisible?.(networkVisible);
    networkControls();
    loadRackTopology(rackView.project,canvas);
    if (!scene.supported) fallback();
    const remembered=selectedByProject.get(rackView.project);
    equipmentRackSelect(rackMembers().some(m=>m.name===remembered)?remembered:valid.find(m=>PAHardwareVisuals.typeOf(m)==='server')?.name||valid[0]?.name||'');
  }
  const baseRender = _renderMachine;
  _renderMachine = function(...args) {dispose(); const result=baseRender(...args); mount(); return result;};
  window.addEventListener('pa-theme-change',e=>scene?.setTheme(e.detail.theme));
  window.addEventListener('pagehide',dispose);
  const baseDashboard=RENDERERS.dashboard;
  RENDERERS.dashboard=function(){
    const fragment=document.createElement('div');fragment.innerHTML=baseDashboard();
    if(!window.PA_PREVIEW){
      for(const selector of ['.p-page-foot span','.cine-footer>span:nth-child(2)','.cine-fleet-total small','.cine-insights-title>span']){
        const label=fragment.querySelector(selector);if(label)label.textContent='\u5de5\u7a0b\u5de5\u4f5c\u5340';
      }
    }
    return fragment.innerHTML;
  };
  document.addEventListener('DOMContentLoaded',()=>{
    mount();
    // The live application must not inherit the old fixture-preview badges.
    if (!window.PA_PREVIEW) {
      document.querySelector('.p-preview-label')?.remove();
      const badge=document.querySelector('.p-side-preview');
      if(badge)badge.innerHTML='<i class="p-live-dot"></i> \u5de5\u7a0b\u5de5\u4f5c\u5340<small>\u7cfb\u7d71\u7ba1\u7406\u4ecb\u9762</small><span id="mode-label" hidden></span>';
    }
  });
})();
