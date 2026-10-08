/* Independent presentation layer. Data, endpoints and operations stay in app.js. */
(() => {
  'use strict';
  const originalMachine = RENDERERS.machine;
  const originalSensorAnalyze = sensorAnalyze;
  const selectedTabs = new Map();
  const diagnosticCollapsed = new Map();
  let taskMetaPromise;
  const quote = value => esc(JSON.stringify(String(value ?? '')));
  const title = (eyebrow, label, trailing = '') => `<div class="pd-section-heading"><div><span class="pd-eyebrow">${eyebrow}</span><h2>${label}</h2></div>${trailing}</div>`;
  const glyph = (name, fallback) => window.productIcon ? window.productIcon(name) : `<span aria-hidden="true">${fallback}</span>`;
  function chassis() {
    // Generic closed chassis: an illustration must not imply a GPU or real SKU.
    return `<div class="pd-hardware-stage pd-neutral-chassis"><span class="pd-hardware-horizon"></span><svg viewBox="0 0 440 280" role="img" aria-label="設備視圖"><defs><linearGradient id="pd-metal-top" x2=".8" y2="1"><stop stop-color="#82939b"/><stop offset=".42" stop-color="#566974"/><stop offset="1" stop-color="#263e4d"/></linearGradient><linearGradient id="pd-metal-front" x2="0" y2="1"><stop stop-color="#9caeb4"/><stop offset=".1" stop-color="#5b727e"/><stop offset=".54" stop-color="#263e4c"/><stop offset="1" stop-color="#142b3a"/></linearGradient><linearGradient id="pd-metal-side" x2="1" y2="1"><stop stop-color="#49616e"/><stop offset="1" stop-color="#122732"/></linearGradient><pattern id="pd-vent" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#071b27"/></pattern></defs><ellipse cx="239" cy="232" rx="149" ry="17" fill="#071b27" opacity=".19"/><path d="M49 92 256 54 390 158 170 205Z" fill="url(#pd-metal-top)" stroke="#a5b9c2" stroke-width=".7"/><path d="M49 92 170 205 170 235 49 119Z" fill="url(#pd-metal-side)" stroke="#627e8d" stroke-width=".6"/><path d="M170 205 390 158 390 188 170 235Z" fill="url(#pd-metal-front)" stroke="#8aa5b3" stroke-width=".8"/><path d="M70 96 255 62 374 155M173 195 363 155" fill="none" stroke="#bbccd1" stroke-width=".5" opacity=".5"/><path d="M88 119 271 83M94 125 277 89" stroke="#182f3c" stroke-width=".6" opacity=".5"/><g fill="#bdcbd0"><circle cx="66" cy="96" r="1.6"/><circle cx="255" cy="61" r="1.6"/><circle cx="177" cy="198" r="1.6"/><circle cx="377" cy="157" r="1.6"/><circle cx="130" cy="155" r="1.4"/><circle cx="319" cy="116" r="1.4"/></g><path d="M191 206 279 187 279 207 191 226Z" fill="url(#pd-vent)" stroke="#152b37"/><path d="M285 186 367 168 367 188 285 207Z" fill="url(#pd-vent)" stroke="#152b37"/><g fill="none" stroke="#8299a4" stroke-width="2"><path d="M193 211 269 195M193 218 269 202M287 191 361 175M287 198 361 182"/></g><path d="M172 206 182 204 182 231 172 233ZM375 161 389 158 389 187 375 190Z" fill="#8ca0a9" stroke="#cbdbdf" stroke-width=".6"/><path d="M178 211 178 226M382 165 382 183" stroke="#1b3442" stroke-width="3" stroke-linecap="round"/><circle cx="372" cy="182" r="1.4" fill="#A1CC56"/><path d="M53 113 163 217" stroke="#122633" stroke-width="2"/><path d="M176 237 391 190" stroke="#071b27" stroke-width="2"/></svg><span class="pd-stage-caption">設備視圖用於位置與類型辨識；實際配置與狀態以系統回報資料為準。</span></div>`;
  }
  const reportedText = value => typeof value === 'string' ? value.trim() : '';
  const reportedCount = value => value !== '' && value != null && Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const quantity = (count, unit) => `${count} ${count === 1 ? unit : unit === 'entry' ? 'entries' : unit + 's'}`;
  function inventorySummary(hw, os) {
    const cpuCount = reportedCount(hw.cpu?.sockets);
    const dimmCount = reportedCount(hw.dimm?.count);
    const list = (key, label, noun, caption) => {
      const items = hw[key];
      if (!Array.isArray(items)) return [label, '尚未取得', `來源未回報 ${label} 清單`];
      return [label, quantity(items.length, noun), items.length ? caption(items) : `本次回報未列出 ${label} 裝置`];
    };
    return [
      ['CPU', cpuCount != null ? quantity(cpuCount, 'socket') : '尚未取得', reportedText(hw.cpu?.model) || '來源未回報 CPU 型號'],
      ['MEMORY', reportedText(os.mem) || (dimmCount != null ? quantity(dimmCount, 'DIMM') : '尚未取得'), [dimmCount != null ? quantity(dimmCount, 'DIMM') : '', ...(Array.isArray(hw.dimm?.types) ? hw.dimm.types : []), ...(Array.isArray(hw.dimm?.manufacturers) ? hw.dimm.manufacturers : [])].filter(Boolean).join(' · ') || '來源未回報 DIMM 配置'],
      list('ssd', 'STORAGE', 'drive', items => [...new Set(items.map(item => reportedText(item.model)).filter(Boolean))].join(' / ') || '已回報儲存裝置，型號未提供'),
      list('nic', 'NETWORK', 'entry', items => String(items[0] || '').replace(/^[\da-f:.]+\s+/i, '') || '已回報網路裝置'),
      list('gpu', 'GPU', 'GPU', items => [...new Set(items.map(item => reportedText(item.name)).filter(Boolean))].join(' / ') || '已回報 GPU，型號未提供')
    ];
  }
  function systemIdentity(machine, hw) {
    // Never use BMC firmware's Manufacturer as the chassis manufacturer.
    const system = hw.system && typeof hw.system === 'object' ? hw.system : {};
    const manufacturer = reportedText(system.manufacturer) || reportedText(machine.manufacturer);
    const model = reportedText(system.model) || reportedText(system.product_name) || reportedText(machine.model);
    return {model, label:[manufacturer, model].filter(Boolean).join(' · ')};
  }
  function cleanSection(node, heading, cls = '') {
    if (!node) return '';
    node.classList.remove('card');
    node.classList.add('pd-original-section');
    if (cls) node.classList.add(cls);
    node.removeAttribute('style');
    const headingNode = node.querySelector(':scope > .card-title');
    if (headingNode) {
      if (headingNode.classList.contains('tel-card-title')) {
        headingNode.querySelector('span').innerHTML = `效能遙測 <span class="hint" id="tel-window"></span>`;
      } else headingNode.textContent = heading;
    }
    return node.outerHTML;
  }
  function operationButton(source, label, icon, primary = false) {
    if (!source) return '';
    const b = source.cloneNode(true);
    b.className = `pd-operation${primary ? ' pd-operation-primary' : ''}`;
    b.innerHTML = `${glyph(icon, '↗')}<span>${label}</span><b aria-hidden="true">↗</b>`;
    return b.outerHTML;
  }
  function kv(label, value, cls = '') { const shown=value === '' || value == null ? '未取得' : value; return `<div class="pd-key-value ${cls}"><span>${label}</span><strong>${esc(shown)}</strong></div>`; }
  function stateDot(online, label) { return `<span class="pd-state ${online === true ? 'pd-state-online' : online === false ? 'pd-state-offline' : ''}"><i></i>${online===true?'Ping \u53ef\u9054':online===false?'Ping \u672a\u56de\u61c9':'\u5c1a\u672a\u89c0\u6e2c'}</span>`; }
  let tabs = [['overview','Overview','概覽'],['hardware','Inventory','硬體'],['osslots','Nodes','節點'],['sensors','Health','健康狀態'],['telemetry','Telemetry','遙測'],['tasks','Validation','驗證']];
  // Keep the asynchronously produced report attached to its new workspace panel.
  sensorAnalyze = async function(name) {
    await originalSensorAnalyze(name);
    if (_activeMachine === name && sensorAiResult[name] != null) {
      const target = document.getElementById('sensor-ai');
      if (target) target.innerHTML = sensorAiResult[name];
    }
  };
  RENDERERS.machine = function productMachine() {
    const oldMarkup = originalMachine();
    const name = _activeMachine;
    const m = machines.find(x => x.name === name);
    const d = machineDetailCache[name];
    if (!m || !d || d.error) {
      const holder = document.createElement('div');
      holder.innerHTML = oldMarkup;
      return `<div class="pd-workspace"><button class="pd-back" onclick="machineBack()">← 返回專案</button><div class="pd-system-title"><span class="pd-eyebrow">系統工作區</span><h1>${esc(name || '系統詳細資料')}</h1></div><div class="pd-wait p-surface">${!d && m ? '<span class="pd-loader"></span>' : glyph('server', '◇')}<h2>${!m ? '找不到這台系統' : d?.error ? '暫時無法取得系統資料' : '正在準備系統工作區'}</h2><p>${esc(holder.querySelector('.empty')?.textContent || '')}</p>${d?.error ? '<button class="btn" onclick="machineRefresh()">重新載入</button>' : ''}</div></div>`;
    }
    const b = {...m, ...(d.machine || {}), ...{
      // 用 machines 陣列內的最新值覆寫 detail 快取，讓新增/移除後不需要重新整理就能看到結果
      os: m.os, active_os: m.active_os, os_ip: m.os_ip, os_user: m.os_user,
      os_pass: m.os_pass, os_port: m.os_port, bmc_ip: m.bmc_ip, bmc_user: m.bmc_user,
      bmc_alive: m.bmc_alive, level: m.level, project: m.project, mgx_type: m.mgx_type,
      rack_mount: m.rack_mount, rack_u: m.rack_u, rack_size: m.rack_size, passive: m.passive,
    }};
    const hw = d.os_info?.hw || {};
    const os = d.os_info?.os || {};
    const identity = systemIdentity(b, hw);
    const rack = b.level === 'rack';
    const level = rack ? 'L11' : 'L10';
    const rackSpecificationAction = equipmentIsServer(m) && !m.passive
      ? `<button class="pd-operation pd-rack-specification" onclick="window.uxRackSpecification && window.uxRackSpecification(${quote(name)})">${glyph('rack','▥')}<span>${rack ? '修正設備高度' : '升級至 L11／設定高度'}</span><b>${rack ? esc(String(b.rack_size || 1)) + 'U' : '↗'}</b></button>`
      : '';
    // Every server, including L10 and a single 已安裝節點, retains Nodes management.
    const viewTabs = mgxTypeOf(m)==='cdu' ? tabs.filter(t=>t[0]==='overview') : mgxTypeOf(m)==='server' ? tabs : tabs.filter(t => t[0] !== 'osslots');
    let selected = selectedTabs.get(name) || 'overview';
    if (!viewTabs.some(t => t[0] === selected)) selected = 'overview';
    const holder = document.createElement('div');
    holder.innerHTML = oldMarkup;
    const toolbar = holder.querySelector('.mach-toolbar');
    const buttons = [...(toolbar?.querySelectorAll('button') || [])];
    const findAction = fn => buttons.find(button => (button.getAttribute('onclick') || '').includes(fn));
    const cards = [...holder.querySelectorAll('.card')];
    const basic = cards.find(c => c.querySelector('.mach-info'));
    const hardware = cards.find(c => c.querySelector('.os-scroll'));
    const sensors = cards.find(c => c.querySelector('#sensor-body'));
    const firmware = cards.find(c => c.querySelector('.card-title')?.textContent.includes('BMC Firmware'));
    const diagnostic = cards.find(c => c.querySelector('#diag-body'));
    const telemetry = cards.find(c => c.querySelector('#tel-grid'));
    const powerActions = basic?.querySelector('.mach-power-actions');
    powerActions?.remove();
    if (diagnostic) {
      const body = diagnostic.querySelector('#diag-body');
      body.innerHTML = diagBodyFill(name);
      [...diagnostic.children].filter(c => c !== body && !c.classList.contains('card-title')).forEach(c => c.remove());
    }
    if (telemetry) {
      telemetry.querySelectorAll('.tel-block').forEach((block, index) => {
        block.dataset.key = ['cpu','mem','disk','net','gpu'][index];
        const head = block.querySelector('.tel-block-head');
        head.setAttribute('onclick', `toggleTel('${block.dataset.key}')`);
        head.setAttribute('role','button');
        head.setAttribute('tabindex','0');
        head.setAttribute('onkeydown',"if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}");
        head.innerHTML += '<span class="tel-arrow" aria-hidden="true">−</span>';
      });
    }
    const hardwareSummary = inventorySummary(hw, os);
    // 多 OS 機框：OS 下拉選單（選定後終端/OS 連線針對該 OS；BMC 電源維持機框級）
    let osList = Array.isArray(b.os) ? b.os : [];
    // 沒有獨立 OS 陣列時，把主 OS 的頂層欄位（os_ip/os_user/...）當作節點 1 顯示，
    // 讓「獨立 OS 管理」永遠看得到節點 1（一開頭新增的主 OS）
    if (!Array.isArray(b.os) && b.os_ip) {
      osList = [{ slot: 1, ip: b.os_ip, user: b.os_user, pass: b.os_pass || '', port: b.os_port || 22,
                  label: b.os_label || (m.name ? m.name : 'OS 1'), bmc_ip: b.bmc_ip, bmc_user: b.bmc_user, bmc_pass: b.bmc_pass || '' }];
    }
    const multiOs = osList.length > 1;
    const requestedOs = b.active_os == null ? null : Number(b.active_os);
    const activeOs = osList.some(e=>e.slot===requestedOs) ? requestedOs : null;
    const osAliveMap = b.os_alive_map || {};
    // 主 OS（slot 1）若標籤是佔位「OS 1」或空，則以機台名稱（= 主 OS 的 hostname）顯示
    const dispLabel = (e) => (e && e.slot === 1 && (!e.label || e.label === 'OS 1') && name) ? name : ((e && e.label) || ('OS ' + (e ? e.slot : 1)));
    const osDropdown = (osList.length > 0) ? `<div class="pd-os-select" title="此機框含 ${osList.length} 個獨立 OS，選定要操作/連終端的 OS">
      <span class="pd-os-select-label">目前 OS</span>
      <select class="pd-os-select-box" onchange="pdSelectOs(${quote(name)}, parseInt(this.value,10))" aria-label="選定 OS">
        <option value="" disabled ${activeOs===null?'selected':''}>尚未選取節點</option>
        ${osList.map(e => {
          const alive = osAliveMap[String(e.slot)];
          return `<option value="${e.slot}" ${e.slot === activeOs ? 'selected' : ''}>${esc(dispLabel(e))} · ${esc(e.ip)}${alive === true ? ' ●' : alive === false ? ' ○' : ''}</option>`;
        }).join('')}
      </select>
    </div>` : '';
    const osHn = b.os_hostname_raw || b.os_hostname || '';
    const bmcHn = b.bmc_hostname_raw || b.bmc_hostname || '';
    const hnTag = (value, expect) => {
      if (!value) return '';
      const mismatch = expect && value.trim().toLowerCase() !== expect.trim().toLowerCase();
      return `<small class="pd-hostname${mismatch ? ' is-warn' : ''}" title="${mismatch ? '偵測到的 hostname 與目前系統名稱不一致，請確認目標' : '節點回報的 hostname'}">Hostname: ${esc(value)}${mismatch ? ' ⚠' : ''}</small>`;
    };
    const connection = `<div class="pd-connectivity"><div class="pd-connection"><div class="pd-connection-icon">OS</div><div><span>作業系統${multiOs ? ` <small class="pd-os-slot-tag">${esc(dispLabel(osList.find(e=>e.slot===activeOs)))}</small>` : ''}</span><strong>${esc(b.os_ip || '未設定 OS IP')}</strong><small class="pd-mac">MAC: ${esc((d.network_identity?.os?.ip === b.os_ip && d.network_identity?.os?.mac) || "\u672a\u53d6\u5f97")}</small>${hnTag(osHn, name)}<small>${esc(b.os_user || '—')}</small></div>${stateDot(b.os_alive, b.os_alive ? 'Online' : 'Offline')}</div><div class="pd-connection"><div class="pd-connection-icon">BMC</div><div><span>管理控制器</span><strong>${esc(b.bmc_ip || '未設定 BMC IP')}</strong><small class="pd-mac">MAC: ${esc((d.network_identity?.bmc?.ip === b.bmc_ip && d.network_identity?.bmc?.mac) || "\u672a\u53d6\u5f97")}</small>${hnTag(bmcHn)}<small>${esc(b.bmc_user || '—')} · IPMI</small></div>${stateDot(b.bmc_alive, !b.bmc_ip ? 'Not set' : b.bmc_alive ? 'Online' : 'Offline')}</div></div>`;
    const healthSummary = equipmentIsServer(m) && !m.passive ? `<section class="pd-health-summary p-surface"><div><span class="pd-eyebrow">HEALTH</span><h3>健康狀態</h3><strong data-health-summary>正在取得巡檢狀態…</strong></div><button class="pd-text-action" onclick="productDetailTab('sensors',true)">查看健康狀態 ${glyph('arrow-up-right','↗')}</button></section>` : '';
    const overview = `<div class="pd-overview-top"><section class="pd-showcase p-surface"><div class="pd-showcase-copy"><span class="pd-eyebrow">${level} / ${rack ? 'RACK COMPONENT' : 'SYSTEM LEVEL'}</span><h2 class="pd-identity-heading" title="${esc(identity.label || '系統配置')}">${esc(identity.model || '系統配置')}</h2><p>${esc(identity.label || hw.cpu?.model || os.distro || '硬體、連線與測試作業')}</p><button class="pd-text-action" onclick="productDetailTab('hardware')">檢視硬體配置 ${glyph('arrow-up-right','↗')}</button></div>${chassis()}<div class="pd-showcase-foot"><span>${esc(b.project || '未分類專案')}</span><span>${esc(rack && b.rack_u ? `U${b.rack_u} · ${b.rack_size || 1}U` : os.distro || '系統配置')}</span></div></section><section class="pd-connect-panel p-surface">${title('管理介面','連線狀態',stateDot(b.os_alive && (!b.bmc_ip || b.bmc_alive), b.os_alive && (!b.bmc_ip || b.bmc_alive) ? 'Connected' : 'Attention'))}${connection}<div class="pd-connection-foot"><span>Chassis power</span>${b.bmc_alive ? powerBadge(d.power) : '<span class="pd-dim">Unavailable</span>'}</div></section></div><div class="pd-inventory-summary pd-inventory-reported">${hardwareSummary.map(([label,value,caption],i) => `<button class="pd-summary-tile p-surface p-tilt" data-inventory="${label.toLowerCase()}" onclick="productDetailTab('hardware')"><span class="pd-eyebrow">${label}</span><strong>${esc(value)}</strong><small title="${esc(caption)}">${esc(caption)}</small><span class="pd-tile-index">0${i+1} ↗</span></button>`).join('')}</div><p class="pd-inventory-note">${d.os_info?.fetched_at ? `資料時間：${esc(d.os_info.fetched_at)} · ` : ''}依目前回報資料顯示；未回報不代表未安裝。</p>${healthSummary}`;
    const firmwareSummary = `<section class="pd-firmware-summary"><span class="pd-eyebrow">FIRMWARE</span><h3>平台韌體</h3><p>BIOS · ${esc(hw.firmware?.bios?.vendor || '—')} ${esc(hw.firmware?.bios?.version || '')}</p><p>BMC · ${esc((d.fw || []).find(item => item.key === 'Firmware Revision')?.value || '—')}</p><button class="pd-text-action" onclick="productDetailTab('sensors',true)">開啟韌體清單 ↗</button></section>`;
    const hardwarePanel = `${title('COMPONENT INVENTORY','硬體配置',`<span class="pd-section-note">${esc(d.os_info?.fetched_at || '最近一次設備資料')}</span>`)}<div class="pd-hardware-layout"><div class="pd-hardware-body p-surface">${cleanSection(hardware,'硬體配置')}</div><div class="pd-identity-card p-surface">${cleanSection(basic,'系統識別資訊')}${firmwareSummary}</div></div>`;
    const sensorsPanel = `${title('PLATFORM HEALTH','健康狀態',`<span class="pd-section-note">巡檢 / 診斷 / 感測器 / 韌體</span>`)}${equipmentIsServer(m) && !m.passive ? (window.SystemInspection?.card(name) || '') : ''}${diagnostic ? `<section class="pd-diagnostic p-surface${diagnosticCollapsed.get(name)?' pd-diagnostic-collapsed':''}"><div class="pd-section-heading"><h2><button type="button" class="pd-diagnostic-collapse" data-diag-collapse aria-expanded="${diagnosticCollapsed.get(name)?'false':'true'}" title="收合快速診斷"><span class="pd-diagnostic-caret" aria-hidden="true">▾</span>快速診斷</button></h2><button class="pd-text-action" onclick="runDiagnose(${quote(name)})">執行快速診斷 ${glyph('arrow-up-right','↗')}</button></div><div class="pd-diagnostic-body" data-diag-body${diagnosticCollapsed.get(name)?' hidden':''}>${cleanSection(diagnostic,'診斷結果','pd-diagnostic-content')}</div></section>` : ''}${b.bmc_alive ? `<div class="pd-sensors-layout"><div class="p-surface pd-sensor-card" id="pd-sensor-live">${cleanSection(sensors,'感測器讀值')}</div><div class="p-surface pd-firmware-card">${cleanSection(firmware,'韌體清單')}</div></div>` : `<div class="pd-unavailable p-surface"><h3>${!b.bmc_ip ? 'BMC 尚未設定' : b.bmc_alive===false ? 'BMC 目前無法連線' : 'BMC 狀態掃描中…'}</h3><p>${esc(b.bmc_ip || '未設定 BMC IP')} · ${!b.bmc_ip ? '請先於機台設定填入 BMC IP／帳密。' : b.bmc_alive===false ? 'BMC 無回應，請檢查網路或電源。' : '背景正在採集感測器與韌體資訊，請稍候或按「重新整理」。'}</p><button class="btn" onclick="machineRefresh()">重新整理</button></div>`}`;
    const cycleTaskCard = `<section class="pd-task-intro p-surface"><div><h3>Cycle 驗證</h3><p>進入後勾選單一、多個或全部節點，再執行 PRE 與確認。</p><button class="btn" onclick="openChassisCycle(${quote(b.project||'')},${quote(name)})">Cycle 驗證</button><a class="btn" href="#/cycle">近期 Cycle 任務</a></div></section>`;
    const tasksPanel = `${title('VALIDATION WORKFLOW','驗證',`<span class="pd-section-note">Cycle Validation / Test Library / Recent Runs</span>`)}${cycleTaskCard}<div class="pd-task-intro p-surface"><span class="pd-task-number">TEST LIBRARY</span><div><span class="pd-eyebrow">TARGET / ${esc(name)}</span><h3>從測試案例庫指派驗證項目</h3><p>為 ${esc(name)} 選擇測項與執行範圍；單選可交給 PA Agent，多選只產生 Batch Instructions。</p><button class="pd-primary-btn" onclick="openAssignTask(${quote(name)})">開啟 Test Library ${glyph('arrow-up-right','↗')}</button></div><div class="pd-task-process"><span><b>01</b>選擇測試類別</span><span><b>02</b>確認案例與範圍</span><span><b>03</b>選擇後續工作方式</span></div></div><div class="pd-library-heading"><h3>Test Library <span>可用測項</span></h3><span id="pd-library-total" class="pd-section-note" aria-live="polite">載入中</span></div><div id="pd-library" class="pd-library-grid"><div class="pd-library-loading" role="status">正在取得案例庫…</div></div>`;
    const physicalRows=[...osList,...(b.physical_slots||[]).filter(s=>!osList.some(n=>n.slot===s.slot)).map(s=>({...s,empty:true}))].sort((a,b)=>a.slot-b.slot);
    const osRows = physicalRows.map(e => {
      if(e.empty)return `<tr><td><span class="pd-os-slot-num">${e.slot}</span></td><td colspan="9" class="pd-dim">空槽 · 尚未安裝節點。新增實體節點會建立新的資產身分；既有退役歷史保留。</td></tr>`;
      const alive = (b.os_alive_map && b.os_alive_map.hasOwnProperty(e.slot)) ? b.os_alive_map[e.slot] : (osList.length === 1 && activeOs === e.slot ? b.os_alive : null);
      const isActive = e.slot === activeOs;
      // 主 OS（slot 1）若標籤是通用「OS 1」或空，則以機台名稱（即 hostname）顯示
      const dispLabel = (e.slot === 1 && (!e.label || e.label === 'OS 1') && name) ? name : (e.label || ('OS ' + e.slot));
      return `<tr class="${isActive ? 'pd-os-row-active' : ''}">
        <td><span class="pd-os-slot-num">${e.slot}</span>${isActive ? '<span class="pd-os-active-tag">ACTIVE</span>' : ''}</td>
        <td><input class="pd-os-input pd-os-ro" value="${esc(dispLabel)}" placeholder="OS ${e.slot}" readonly title="使用編輯連線修改；保留節點身分"></td>
        <td><input class="pd-os-input pd-os-ro mono" value="${esc(e.ip || '')}" readonly></td>
        <td><input class="pd-os-input pd-os-ro" value="${esc(e.user || '')}" readonly></td>
        <td>${e.pass||e.credential_ref?'已設定':'未設定'}</td>
        <td><input class="pd-os-input pd-os-ro mono" value="${esc(e.bmc_ip || '')}" placeholder="BMC IP" readonly></td>
        <td><input class="pd-os-input pd-os-ro" value="${esc(e.bmc_user || '')}" placeholder="BMC 帳號" readonly></td>
        <td>${e.bmc_pass||e.credential_ref?'已設定':'未設定'}</td>
        <td>${stateDot(alive, alive === true ? 'Online' : alive === false ? 'Offline' : '—')}</td>
        <td class="pd-os-actions">
          <button class="btn small" onclick="pdOsEdit(${quote(name)}, ${e.slot}, this)">編輯連線</button>
          <button class="btn small danger" onclick="pdOsDelete(${quote(name)}, ${e.slot})">退役節點</button>
        </td>
      </tr>`;
    }).join('');
    const osSlotsPanel = `${title('MULTI-NODE CHASSIS','節點管理',`<span class="pd-section-note">1 機框 = ${osList.length} 個已安裝節點 · 控制器依硬體拓樸綁定</span>`)}
      <div class="pd-os-manage p-surface">
        <div class="pd-os-intro"><p>每個實體槽位維持獨立節點身分。切換目前節點只會改變操作目標，不會修改既有 Cycle 任務。</p><p class="pd-dim">BMC、KVM 與電源控制依實際硬體拓樸綁定。節點退役後保留歷史紀錄；更換實體節點時會建立新的資產身分。</p></div>
        <div class="pd-os-table-wrap">
        <table class="pd-os-table"><colgroup><col style="width:60px"><col style="width:198px"><col style="width:160px"><col style="width:90px"><col style="width:124px"><col style="width:160px"><col style="width:90px"><col style="width:120px"><col style="width:74px"><col style="width:128px"></colgroup><thead><tr><th>槽位</th><th>標籤</th><th>OS IP</th><th>OS 帳號</th><th>OS 憑證</th><th>BMC IP</th><th>BMC 帳號</th><th>BMC 憑證</th><th>OS 狀態</th><th>操作</th></tr></thead><tbody>${osRows || '<tr><td colspan="10" class="pd-dim">尚未安裝節點；可新增節點。</td></tr>'}</tbody></table>
        </div>
        <div class="pd-os-add">
          <span class="pd-eyebrow">新增節點</span><p class="pd-dim">系統會使用最低可用槽位並建立新的節點身分。可先建立資料，或完成連線確認後再新增。</p>
          <div class="pd-os-add-row">
            <input class="pd-os-input" id="pd-os-new-label" placeholder="顯示標籤">
            <input class="pd-os-input" id="pd-os-new-ip" placeholder="OS IP">
            <input class="pd-os-input" id="pd-os-new-user" placeholder="OS 帳號">
            <input class="pd-os-input" id="pd-os-new-pass" type="password" placeholder="OS 密碼">
            <input class="pd-os-input" id="pd-os-new-bmc-ip" placeholder="BMC IP（可稍後設定）">
            <input class="pd-os-input" id="pd-os-new-bmc-user" placeholder="BMC 帳號">
            <input class="pd-os-input" id="pd-os-new-bmc-pass" type="password" placeholder="BMC 密碼">
            <button class="btn primary" onclick="pdOsPlan(${quote(name)})">新增節點（不連線）</button>
            <button class="btn" onclick="pdOsAddAndProbe(${quote(name)})">連線確認後新增</button>
          </div>
        </div>
      </div>`;
    const panels = {overview,hardware:hardwarePanel,osslots:osSlotsPanel,sensors:sensorsPanel,telemetry:`${title('系統效能','遙測','<span class="pd-section-note">CPU / DIMM / SSD / NIC / GPU</span>')}${equipmentIsServer(m) && !m.passive ? (window.TelemetryProvision?.card(name,activeOs) || '') : ''}`,tasks:tasksPanel};
    return `<div class="pd-workspace" data-system="${esc(name)}"><div class="pd-breadcrumb"><button onclick="machineBack()">系統與專案</button><span>/</span><button onclick="machineBack()">${esc(b.project || '未分類')}</button><span>/</span><strong>${esc(name)}</strong></div><header class="pd-system-header"><div class="pd-system-title"><span class="pd-eyebrow">${level} ${rack ? 'RACK LEVEL' : 'SYSTEM LEVEL'} / 系統工作區</span><h1>${esc(name)}<span class="pd-level-pill">${level}</span></h1><p>${esc(identity.label || os.distro || '系統平台')} <span>·</span> ${esc(hw.cpu?.model || b.mgx_type || '受管系統')}</p></div>${osDropdown}<div class="pd-header-status">${stateDot(b.os_alive,b.os_alive ? 'System online' : 'System offline')}<div><span>專案</span><b>${esc(b.project || '未分類')}</b></div></div></header><div class="pd-workspace-grid"><div class="pd-main"><nav class="pd-tabs" role="tablist" aria-label="系統工作區">${viewTabs.map(([key,label,zh]) => `<button id="pd-tab-${key}" role="tab" aria-selected="${selected===key}" aria-controls="pd-panel-${key}" tabindex="${selected===key?'0':'-1'}" class="${selected===key?'is-active':''}" data-pd-tab="${key}" onclick="productDetailTab('${key}')"><span>${label}</span><small>${zh}</small></button>`).join('')}</nav>${viewTabs.map(([key]) => `<section id="pd-panel-${key}" role="tabpanel" aria-labelledby="pd-tab-${key}" class="pd-tab-panel${selected===key?' is-active':''}"${selected!==key?' hidden':''}>${panels[key]}</section>`).join('')}</div><aside class="pd-operations p-surface"><div class="pd-ops-heading"><span class="pd-eyebrow">操作</span><h2>系統操作</h2><span class="pd-command-line"></span></div><div class="pd-operation-group">${operationButton(findAction('openTermDialog'),'Terminal','terminal',true)}${b.bmc_ip ? `<button class="pd-operation" onclick="window.openKvmSolo && window.openKvmSolo(${quote(name)})">${glyph('monitor','▣')}<span>KVM</span><b>↗</b></button>`:''}</div>${rackSpecificationAction ? `<details class="pd-ops-disclosure pd-settings"><summary><span>設備設定</span><b aria-hidden="true">⌄</b></summary><div>${rackSpecificationAction}</div></details>` : ''}${powerActions ? `<details class="pd-ops-disclosure pd-power-group"><summary><span>電源控制</span><b aria-hidden="true">⌄</b></summary><div class="pd-power-content">${powerActions.outerHTML}</div></details>`:''}<div class="pd-ops-context">${kv('專案層級',rack?'L11 / Rack Level':'L10 / System Level')}${kv('設備類型',b.mgx_type || 'server')}${rack && b.rack_u ? kv('機櫃位置',`U${b.rack_u} · ${b.rack_size || 1}U`) : kv('運作時間',os.uptime)}</div><div class="pd-refresh-action">${operationButton(findAction('machineRefresh'),'重新整理','refresh')}</div></aside></div></div>`;
  };
  window.productDetailTab = function(key, focusTab = false) {
    if (!tabs.some(t => t[0] === key)) return;
    selectedTabs.set(_activeMachine,key);
    document.querySelectorAll('[data-pd-tab]').forEach(button => {
      const active = button.dataset.pdTab === key;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focusTab) button.focus();
    });
    document.querySelectorAll('.pd-tab-panel').forEach(panel => {
      const active = panel.id === `pd-panel-${key}`;
      panel.hidden = !active;
      panel.classList.toggle('is-active',active);
    });
    if (key === 'telemetry') requestAnimationFrame(() => {
      Object.values(telCharts).forEach(chart => { try { chart.resize(); chart.update('none'); } catch (_) {} });
    });
    window.TelemetryProvision?.mount();
    if (key === 'tasks') loadTaskLibrary();
    window.productAfterRender?.();
    window.cinematicWorkspaceAfterRender?.();
  };
  // 多 OS 機框：切換「目前選定 OS」。後端會把該 slot 帳密同步到 os_ip/...（成為終端/SSH 目標），
  // 前端更新本地 machine 資料後重繪詳情頁。BMC 電源維持機框級不受影響。
  const selectingOs = new Set();
  window.pdSelectOs = async function(name, slot) {
    if (!name || !(slot >= 1) || selectingOs.has(name)) return;
    selectingOs.add(name);
    const picker=document.querySelector('.pd-os-select-box');if(picker)picker.disabled=true;
    try {
      const res = await fetch(`/api/machines/${encodeURIComponent(name)}/select-os`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      const data = await res.json();
      if (!data.ok) { alert(`切換 OS 失敗：${data.detail || ''}`); return; }
      const nm = data.machine;
      // 更新本地 machines 資料（詳情頁讀 m，列表也讀它）
      const m = machines.find(x => x.name === name);
      if (m && nm) {
        m.os_ip = nm.os_ip; m.os_user = nm.os_user; m.os_pass = nm.os_pass;
        m.os_port = nm.os_port; m.active_os = nm.active_os;
        m.os = nm.os; m.os_alive_map = nm.os_alive_map;
        m.bmc_ip = nm.bmc_ip; m.bmc_user = nm.bmc_user; m.bmc_pass = nm.bmc_pass; m.bmc_alive = nm.bmc_alive;
        m.os_alive = nm.os_alive; m.connectivity = nm.connectivity;
      }
      // 切換 OS 時，整套配置跟著換成新選定 OS 的（硬體/OS 資訊 + BMC fw/power + 感測器）。
      // 後端 select-os 已把該 slot 的 os_ip/os_user/bmc_ip...同步到機台層級，所以清快取後
      // 重新載入 detail/sensors 會用「新 OS」的 IP 抓資料。
      if (_activeMachine === name && state.view === 'machine') {
        // 先立即重繪，讓上方連線資訊（OS IP / BMC IP / 目前 OS）馬上切到新 OS
        setView('machine');
        // 強制重抓該 OS 的 os_info(hw) + BMC fw/power
        delete machineDetailCache[name];
        await machineLoadDetail(name, true);
        // 強制重抓該 OS 配對 BMC 的感測器（sdr list），並讓 Sensor AI 用新資料重跑
        if (_activeMachine === name && state.view === 'machine') {
          sensorAiDone.delete(name);
          delete sensorAiResult[name];
          await machineLoadSensors(name, true);
          if (_activeMachine === name) setView('machine');
        }
      }
    } catch (e) { alert(`切換 OS 失敗：${e.message}`); } finally { selectingOs.delete(name);const current=document.querySelector('.pd-os-select-box');if(current)current.disabled=false; }
  };

  // 多 OS 管理：新增一個節點（OS + 配對 BMC）。opts 可帶預先探測好的 label/bmc_ip（避免新增後再抓、失敗殘留）
  window.pdOsAdd = async function(name, opts = {}) {
    const label = opts.label ?? (document.getElementById('pd-os-new-label')?.value.trim() || '');
    const ip = opts.ip ?? (document.getElementById('pd-os-new-ip')?.value.trim() || '');
    const user = opts.user ?? (document.getElementById('pd-os-new-user')?.value.trim() || '');
    const pass = opts.pass ?? (document.getElementById('pd-os-new-pass')?.value || '');
    const bmcIp = opts.bmc_ip ?? (document.getElementById('pd-os-new-bmc-ip')?.value.trim() || '');
    const bmcUser = opts.bmc_user ?? (document.getElementById('pd-os-new-bmc-user')?.value.trim() || '');
    const bmcPass = opts.bmc_pass ?? (document.getElementById('pd-os-new-bmc-pass')?.value || '');
    const port=22;
    const bmcPort=22,ipmiPort=623;
    if (!ip || !user) { alert('OS 的 IP 與帳號為必填'); return; }
    try {
      const res = await fetch(`/api/machines/${encodeURIComponent(name)}/os`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, user, pass, label, port, bmc_ssh_port:bmcPort, ipmi_port:ipmiPort, bmc_ip: bmcIp, bmc_user: bmcUser, bmc_pass: bmcPass }),
      });
      const data = await res.json();
      if (!data.ok) { window.pdOsToast(`新增節點失敗：${data.detail || ''}`, false); return; }
      const nm = data.machine;
      const m = machines.find(x => x.name === name);
      if (m && nm) { m.os = nm.os; m.active_os = nm.active_os; m.os_ip = nm.os_ip; m.os_user = nm.os_user; m.os_pass = nm.os_pass; m.os_port = nm.os_port; m.bmc_ip = nm.bmc_ip; m.bmc_user = nm.bmc_user; m.bmc_pass = nm.bmc_pass; m.bmc_alive = nm.bmc_alive;
        m.os_alive = nm.os_alive; m.connectivity = nm.connectivity; }
      return nm;
    } catch (e) { window.pdOsToast(`新增失敗：${e.message}`, false); }
  };

  // 多 OS 管理：先驗證 OS 連線並探測（hostname + BMC IP），成功後才真正新增節點。
  // 這樣「新增失敗」不會殘留一個半成品 OS，也不會每次重試就跳下一個 slot。
  window.pdOsPlan = async function(name){
    const result=await window.pdOsAdd(name);if(!result)return;
    const m=machines.find(x=>x.name===name);if(m)Object.assign(m,result);
    if(machineDetailCache[name]?.machine)Object.assign(machineDetailCache[name].machine,result);
    if(state.view==='machine')setView('machine');
    window.pdOsToast('已建立計畫節點；硬體對應與健康狀態尚未驗證','ok');
  };
  window.pdOsAddAndProbe = async function(name) {
    const ip = document.getElementById('pd-os-new-ip')?.value.trim() || '';
    const user = document.getElementById('pd-os-new-user')?.value.trim() || '';
    const pass = document.getElementById('pd-os-new-pass')?.value || '';
    const bmcUser = document.getElementById('pd-os-new-bmc-user')?.value.trim() || '';
    const bmcPass = document.getElementById('pd-os-new-bmc-pass')?.value || '';
    const port = 22;
    if (!ip || !user) { window.pdOsToast('請先填 OS IP 與 OS 帳號', 'err'); return; }
    if (!pass) { window.pdOsToast('請填 OS 密碼（需連線驗證並自動帶入 主機名稱 / BMC IP）', 'err'); return; }

    window.pdOsToast('正在驗證 OS 連線並自動帶入 主機名稱 / BMC IP…', 'load');
    let probe;
    try {
      const pr = await fetch('/api/machines/probe-bmc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project:machines.find(m=>m.name===name)?.project, os_ip: ip, os_user: user, os_pass: pass, os_port: port }),
      });
      probe = await pr.json();
    } catch (e) { window.pdOsToast(`連線驗證失敗：${e.message}`, 'err'); return; }

    if (!probe || !probe.ok) {
      window.pdOsToast(`新增失敗（OS 連線無法驗證）：${probe?.error || '無法連線'}`, 'err');
      return;   // 不殘留、slot 不推進，重試仍是同一個 slot
    }

    const label = probe.hostname || '';
    const bmcIp = probe.bmc_ip || '';
    window.pdOsToast(`OS 連線正常（hostname=${label}、BMC IP=${bmcIp || '—'}），建立節點…`, 'load');

    const nm = await window.pdOsAdd(name, { ip, user, pass, port, bmc_user: bmcUser, bmc_pass: bmcPass, label, bmc_ip: bmcIp });
    if (!nm || !Array.isArray(nm.os)) return;
    const slot = nm.os[nm.os.length - 1].slot;
    const m = machines.find(x => x.name === name);
    if (m && nm) m.os = nm.os;
    // 同步快取 + 立即重繪（不重抓 detail，避免 6 秒鐘才刷新）
    if (machineDetailCache[name] && machineDetailCache[name].machine) { machineDetailCache[name].machine.os = nm.os; machineDetailCache[name].machine.active_os = nm.active_os; }
    if (state.view === 'machine') setView('machine');
    // 清空新增列，方便連續新增
    ['pd-os-new-ip','pd-os-new-user','pd-os-new-pass','pd-os-new-bmc-user','pd-os-new-bmc-pass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (!probe.bmc_ip) window.pdOsToast(`已新增 OS ${slot}（標籤=${label}），但抓不到 BMC IP，請手動填 BMC IP`, 'ok');
    else window.pdOsToast(`已新增 OS ${slot}（標籤=${label}、BMC IP=${bmcIp}）`, 'ok');
  };

  // 網頁中央的輕量提示（取代 alert）：loading=轉圈；ok=成功(✓)；false=錯誤(✕)
  window.pdOsToast = function(msg, state = 'ok') {
    let t = document.getElementById('pd-os-toast');
    if (!t) { t = document.createElement('div'); t.id = 'pd-os-toast'; document.body.appendChild(t); }
    const icon = state === 'load' ? '<span class="pd-os-toast-spin"></span>'
               : state === 'err'  ? '<span class="pd-os-toast-ico err">✕</span>'
                                  : '<span class="pd-os-toast-ico ok">✓</span>';
    t.innerHTML = `${icon}<span class="pd-os-toast-msg">${esc(msg)}</span>`;
    t.className = `pd-os-toast pd-os-toast-${state}`;
    if (state !== 'load') {
      clearTimeout(t._tm);
      t._tm = setTimeout(() => { t.className = 'pd-os-toast pd-os-toast-hide'; }, 4500);
    }
  };

  // Edit the exact 已安裝節點 captured when opening the form.
  window.pdOsEdit = function(name, slot, button) {
    const node = machines.find(m => m.name === name)?.os?.find(n => n.slot === slot);
    if (!node?.node_id || !node.expected_binding_revision) {
      window.pdOsToast('缺少節點版本，請重新載入', 'err'); return;
    }
    const tr = button.closest('tr');
    const panel=tr.closest('.pd-os-manage');
    if (panel.querySelector('[data-node-editor]')) return;
    const editor = document.createElement('section');editor.dataset.nodeEditor = node.node_id;
    const cell = document.createElement('div');
    const heading=document.createElement('h3');heading.textContent='編輯 N'+slot+' 連線';cell.append(heading);
    const form = document.createElement('form');form.className = 'pd-node-edit';
    const fields = [['label','標籤'],['ip','OS IP'],['user','OS 帳號'],
      ['pass','新 OS 密碼（留空保留）'],['bmc_ip','BMC IP'],['bmc_user','BMC 帳號'],
      ['bmc_pass','新 BMC 密碼（留空保留）']];
    for (const [key,title] of fields) {
      const label = document.createElement('label');label.textContent = title;
      const input = document.createElement('input');input.name = key;input.className = 'pd-os-input';
      input.type = key.includes('pass') ? 'password' : key.includes('port') ? 'number' : 'text';
      input.autocomplete = key.includes('pass') ? 'new-password' : 'off';
      input.value = key.includes('pass') ? '' : String(node[key] ?? '');
      if (input.type === 'number') {input.min = '1';input.max = '65535';}
      label.append(input);form.append(label);
    }
    const status = document.createElement('p');status.setAttribute('role','status');
    const save = document.createElement('button');save.type='submit';save.className='btn';save.textContent='儲存連線';
    const cancel = document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='取消';
    cancel.onclick=()=>{editor.remove();button.focus();};
    form.append(save,cancel,status);cell.append(form);editor.append(cell);tr.closest('.pd-os-table-wrap').before(editor);
    form.onsubmit = async event => {
      event.preventDefault();save.disabled = true;
      const body = {expected_node_id:node.node_id,expected_binding_revision:node.expected_binding_revision,
        port:22,bmc_ssh_port:22,ipmi_port:623};
      for (const [key] of fields) {
        const input=form.elements.namedItem(key);const value=input.type==='number'?Number(input.value):input.value;
        if (key.includes('pass')) {if(value) body[key]=value;}
        else if (String(value)!==String(node[key]??'')) body[key]=value;
      }
      try {
        const response=await fetch(`/api/machines/${encodeURIComponent(name)}/os/${slot}`,{
          method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const data=await response.json();
        if(!response.ok || !data.ok) throw new Error(typeof data.detail==='string'?data.detail:'無法儲存，請核對欄位與權限');
        const m=machines.find(m=>m.name===name);if(m) Object.assign(m,data.machine);
        if(_activeMachine===name && state.view==='machine') setView('machine');
      } catch(error) {status.textContent=error.message;save.disabled=false;}
    };
    form.elements.namedItem('label').focus();
  };

  // Retire the 已安裝節點; backend keeps its identity and 實體槽位 history.
  window.pdOsDelete = async function(name, slot) {
    if (!await confirmUser(`確定移除 OS ${slot}？此操作無法復原。`)) return;
    try {
      const res = await fetch(`/api/machines/${encodeURIComponent(name)}/os/${slot}`, { method: 'DELETE' });
      const data = await res.json();
      let nm = data.machine;
      if (!data.ok) {
        // 後端說該 slot 已不存在（stale 前端資料）→ 視為已移除，本地清掉即可
        const isGone = /不存在|not found|404/i.test((data.detail || '') + (res.status || ''));
        if (!isGone) { window.pdOsToast(`移除節點失敗：${data.detail || ''}`, 'err'); return; }
        nm = null;
      }
      const m = machines.find(x => x.name === name);
      if (m) {
        const fresh = (nm && Array.isArray(nm.os)) ? nm.os : (m.os || []).filter(e => e.slot !== slot);
        m.os = fresh;
        if (nm) { m.active_os = nm.active_os; m.os_ip = nm.os_ip; m.os_user = nm.os_user; m.os_port = nm.os_port; m.bmc_ip = nm.bmc_ip; }
        // 同步快取 + 立即重繪（不重抓 detail，避免 6 秒鐘才刷新）
        if (machineDetailCache[name] && machineDetailCache[name].machine) { machineDetailCache[name].machine.os = fresh; }
        if (state.view === 'machine') setView('machine');
      }
      // 主 OS 若沒被選中則維持 active_os=1
      window.pdOsToast(`已移除 OS ${slot}`, 'ok');
    } catch (e) { window.pdOsToast(`移除節點失敗：${e.message}`, 'err'); }
  };

  // 多 OS 管理：自動抓取（label=抓 hostname 填標籤 / bmc=抓 BMC IP 填 BMC IP）
  window.pdOsProbe = async function(name, slot, kind, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '讀取中…'; }
    try {
      const res = await fetch(`/api/machines/${encodeURIComponent(name)}/os/${slot}/probe`, { method: 'POST' });
      const data = await res.json();
      const tr = document.querySelector(`.pd-os-table tr [data-slot="${slot}"]`)?.closest('tr');
      if (!tr) return;
      if (!data.ok) {
        alert(`抓取失敗：${data.error || ''}`);
        if (btn) { btn.disabled = false; btn.textContent = '讀取'; }
        return;
      }
      // hostname → 標籤欄位
      if (data.hostname) {
        const labelInp = tr.querySelector(`[data-slot="${slot}"][data-field="label"]`);
        if (labelInp) labelInp.value = data.hostname;
      }
      // BMC IP → bmc_ip 欄位
      if (data.bmc_ip) {
        const bmcInp = tr.querySelector(`[data-slot="${slot}"][data-field="bmc_ip"]`);
        if (bmcInp) bmcInp.value = data.bmc_ip;
      }
      if (data.error) {
        // 部分成功（有 warning）
        alert(data.error);
      } else {
        alert(`已抓取 OS ${slot}：${data.hostname ? '標籤=' + data.hostname : ''}${data.bmc_ip ? ' · BMC IP=' + data.bmc_ip : ''}`);
      }
    } catch (e) {
      alert(`抓取失敗：${e.message}`);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '讀取'; }
    }
  };
  async function loadTaskLibrary() {
    const target = document.getElementById('pd-library');
    if (!target || target.dataset.loaded) return;
    target.dataset.loaded = 'pending';
    try {
      taskMetaPromise ||= api('/api/testlibrary/meta');
      const meta = await taskMetaPromise;
      if (!target.isConnected) return;
      const sheets = meta.sheets || [];
      const count=value=>reportedCount(value) ?? '未取得';
      target.innerHTML = sheets.length ? sheets.map((sheet,index) => `<button class="pd-library-card p-surface p-tilt" onclick="productDetailAssignSheet(${quote(sheet.sheet)})"><div><span class="pd-library-icon">${String(index+1).padStart(2,'0')}</span><b>↗</b></div><h4>${esc(sheet.label || sheet.sheet)}</h4><p><strong>${count(sheet.count)}</strong> 筆測試案例</p><small>${count(sheet.auto)} 可自動執行 · ${count(sheet.partial)} 部分自動</small></button>`).join('') : '<div class="pd-library-loading">目前沒有可用的測試案例。</div>';
      const total = document.getElementById('pd-library-total');
      const explicitTotal=reportedCount(meta.total),reportedSheetCounts=sheets.map(sheet=>reportedCount(sheet.count));
      const totalCount=explicitTotal ?? (reportedSheetCounts.every(value=>value != null)?reportedSheetCounts.reduce((sum,value)=>sum+value,0):null);
      if (total) total.textContent = `${sheets.length} CATEGORIES / ${totalCount == null?'未取得':totalCount} CASES`;
      target.dataset.loaded = 'true';
      bindDetailDepth(target);
      window.productAfterRender?.();
    } catch (error) {
      taskMetaPromise = null;
      target.innerHTML = `<div class="pd-library-loading">${esc(error.message)} <button class="btn" onclick="productDetailRetryLibrary()">重試</button></div>`;
      delete target.dataset.loaded;
    }
  }
  window.productDetailRetryLibrary = () => loadTaskLibrary();
  window.productDetailAssignSheet = async sheet => {
    await openAssignTask(_activeMachine);
    if (typeof assignTaskOpenSheet === 'function') assignTaskOpenSheet(sheet);
  };
  function bindDetailDepth(target) {
    target.querySelectorAll('.p-tilt').forEach(surface => {
      if (surface.dataset.pdDepth) return;
      surface.dataset.pdDepth = 'true';
      surface.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const box = surface.getBoundingClientRect();
        const x = (event.clientX-box.left)/box.width;
        const y = (event.clientY-box.top)/box.height;
        surface.style.setProperty('--pd-rx',`${((.5-y)*4).toFixed(2)}deg`);
        surface.style.setProperty('--pd-ry',`${((x-.5)*5).toFixed(2)}deg`);
        surface.style.setProperty('--pd-mx',`${(x*100).toFixed(1)}%`);
        surface.style.setProperty('--pd-my',`${(y*100).toFixed(1)}%`);
      });
      surface.addEventListener('pointerleave', () => {
        surface.style.setProperty('--pd-rx','0deg');
        surface.style.setProperty('--pd-ry','0deg');
      });
    });
  }
  // 感測器即時載入：面板渲染當下若 #pd-sensor-live 仍是「抓取中」，持續輪詢
  // /sensors 直到有資料（或逾時），即時更新該卡片，避免停在「抓取中」。
  const pdSensorPolling = {};   // name -> true（進行中，避免重複啟動）
  function pdLoadSensorsLive(name) {
    if (!name || pdSensorPolling[name]) return;
    const el = () => document.getElementById('pd-sensor-live');
    // 已有實際資料（非「抓取中」）就不用輪詢
    const cur = el();
    if (!cur) return;
    // 只有還停在「抓取中」才輪詢（BMC 可連的感受器卡）
    if (!/感測器抓取中|掃描中/.test(cur.textContent || '')) return;
    pdSensorPolling[name] = true;
    const started = Date.now();
    const MAX_WAIT = 60000, MAX_TRIES = 25;
    let tries = 0;
    // 「抓取中」的等待文字：只在首次寫入，之後只換這一段（不整塊重繪），避免閃爍。
    const WAIT_HTML = '<div class="pd-original-section"><div class="empty">正在讀取感測器資料，請稍候…</div></div>';
    const ERROR_HTML = (msg) => `<div class="pd-original-section"><div class="empty">感測器暫時讀取失敗：${esc(msg)}<br><small>可稍後按「重新整理」重試。</small></div></div>`;
    const showWait = () => {
      const box = el();
      if (box && !box.dataset.pdWait) { box.innerHTML = WAIT_HTML; box.dataset.pdWait = '1'; }
    };
    const finish = (html) => {
      const box = el();
      if (box) { box.innerHTML = html; delete box.dataset.pdWait; }
      delete pdSensorPolling[name];
    };
    showWait();
    const tick = async () => {
      const box = el();
      if (!box || _activeMachine !== name || state.view !== 'machine') { delete pdSensorPolling[name]; return; }
      let d;
      try { d = await api(`/api/machine/${encodeURIComponent(name)}/sensors`); }
      catch (e) { d = { error: e.message }; }
      const box2 = el();
      if (!box2 || _activeMachine !== name || state.view !== 'machine') { delete pdSensorPolling[name]; return; }
      if (d && !d.error && d.sensors && !d.sensors.error && !d.loading) {
        // 抓取完成：用 app.js 的感測器渲染器即時替換卡片內容（資料到達時才換一次）。
        const scroll = box2.querySelector('.sdr-scroll');
        const keepTop = scroll ? scroll.scrollTop : 0;
        box2.innerHTML = `<div class="pd-original-section">${machineSensorsHtml(d, { bmc_alive: true }, name)}</div>`;
        delete box2.dataset.pdWait;
        const ns = box2.querySelector('.sdr-scroll');
        if (ns && keepTop) ns.scrollTop = keepTop;
        delete pdSensorPolling[name];
        return;
      }
      if (d && d.sensors && d.sensors.error) { finish(ERROR_HTML(d.sensors.error)); return; }
      if (d && d.error) { finish(ERROR_HTML(d.error)); return; }         // 出錯就停，顯示明確錯誤
      tries++;
      if (tries >= MAX_TRIES || Date.now() - started > MAX_WAIT) {
        finish('<div class="pd-original-section"><div class="empty">感測器讀取逾時（BMC 忙碌或無回應）。<br><small>可稍後按「重新整理」重試；其餘資訊不受影響。</small></div></div>');
        return;
      }
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 800);
  }
  window.productDetailAfterRender = function() {
    const workspace = document.querySelector('.pd-workspace');
    if (!workspace) return;
    // 感測器是背景非同步抓取的（sdr list 慢）：面板渲染當下可能還停在
    // 「抓取中」。這裡對 #pd-sensor-live 持續輪詢，資料一到就即時更新，
    // 否則面板會永遠停在渲染當下複製的那份「抓取中」字串。
    if (workspace.querySelector('#pd-sensor-live')) pdLoadSensorsLive(workspace.dataset.system);
    if (workspace.dataset.bound) return;
    workspace.dataset.bound = 'true';
    bindDetailDepth(workspace);
    workspace.querySelectorAll('.pd-ops-disclosure').forEach(menu => menu.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); event.preventDefault(); }
    }));
    workspace.querySelector('[data-diag-collapse]')?.addEventListener('click', event => {
      const button=event.currentTarget,body=workspace.querySelector('[data-diag-body]');
      const collapsed=button.getAttribute('aria-expanded')==='true';
      diagnosticCollapsed.set(workspace.dataset.system,collapsed);
      button.setAttribute('aria-expanded',String(!collapsed));
      workspace.querySelector('.pd-diagnostic')?.classList.toggle('pd-diagnostic-collapsed',collapsed);
      if(body)body.hidden=collapsed;
    });
    workspace.querySelector('.pd-tabs')?.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const visibleTabs=[...workspace.querySelectorAll('.pd-tabs [data-pd-tab]')].filter(t=>!t.hidden);
      const index = visibleTabs.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? visibleTabs.length-1 : (index+(event.key==='ArrowRight'?1:-1)+visibleTabs.length)%visibleTabs.length;
      window.productDetailTab(visibleTabs[next].dataset.pdTab,true);
    });
    if ((selectedTabs.get(_activeMachine) || 'overview') === 'tasks') loadTaskLibrary();
  };
  document.addEventListener('DOMContentLoaded', () => {
    const content = document.getElementById('content');
    if (content) new MutationObserver(() => window.productDetailAfterRender()).observe(content,{childList:true});
    window.productDetailAfterRender();
  });
})();
