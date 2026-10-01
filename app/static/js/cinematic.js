/* Cinematic presentation layer. app.js continues to own routes, data and operations. */
(() => {
  'use strict';
  const previous = { dashboard: RENDERERS.dashboard, projects: RENDERERS.projects, render: _renderMachine };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const savedTheme = localStorage.getItem('pa_theme');
  // Keep the original persisted theme/API; only adapt presentation consumers.
  const originalTheme = applyTheme;
  function chartPalette(chart) {
    const light = document.documentElement.dataset.theme === 'light';
    const ink = light ? '#46616e' : '#a3b3c1';
    const grid = light ? 'rgba(37,73,89,.12)' : 'rgba(154,183,203,.13)';
    const options = chart.config.options;
    options.color = ink;
    options.plugins ||= {};
    if (options.plugins.legend !== false) {
      options.plugins.legend ||= {};
      options.plugins.legend.labels ||= {};
      options.plugins.legend.labels.color = ink;
    }
    if (options.plugins.title && options.plugins.title !== false) options.plugins.title.color = ink;
    for (const axis of Object.values(options.scales || {})) {
      axis.ticks ||= {}; axis.ticks.color = ink;
      axis.grid ||= {}; axis.grid.color = grid;
      axis.border ||= {}; axis.border.color = grid;
      if (axis.title) axis.title.color = ink;
    }
  }
  if (window.Chart) Chart.register({id:'paWistronPalette',beforeUpdate:chartPalette});
  applyTheme = function(theme) {
    originalTheme(theme);
    const light = theme === 'light', button = document.getElementById('theme-toggle');
    if (button) {
      button.innerHTML = `<span aria-hidden="true">${light ? '☀' : '◐'}</span><span>${light ? 'Light' : 'Dark'}</span>`;
      button.title = light ? '目前為 Pearl Light，切換至 Graphite Dark' : '目前為 Graphite Dark，切換至 Pearl Light';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(light));
    }
    if (window.Chart) {
      Chart.defaults.color = light ? '#46616e' : '#a3b3c1';
      Chart.defaults.borderColor = light ? 'rgba(37,73,89,.12)' : 'rgba(154,183,203,.13)';
      Object.values(Chart.instances).forEach(chart => { if (chart.canvas?.isConnected) chart.update('none'); });
    }
    window.dispatchEvent(new CustomEvent('pa-theme-change',{detail:{theme}}));
  };
  const two = n => String(n).padStart(2, '0');
  let teardown = () => {};
  let search = '';
  let lastView = '';
  const previousLevel = window.productLevel, previousProject = window.productProject;
  window.productLevel = level => { if (level !== projectLevelFilter.val) search = ''; previousLevel(level); };
  window.productProject = (name,level) => { search = ''; previousProject(name,level); };

  RENDERERS.dashboard = () => {
    const prior = document.createElement('div');
    prior.innerHTML = previous.dashboard();
    const system = machines.filter(m => !isRackItem(m));
    const rack = machines.filter(isRackItem);
    const connected = machines.filter(m => m.os_ip || m.bmc_ip);
    const offline = machines.filter(m => m.os_alive === false);
    const l10 = projects.filter(p => system.some(m => m.project === p.name));
    const l11 = projects.filter(p => rack.some(m => m.project === p.name));
    const online = connected.filter(m => m.os_alive === true).length;
    return `<header class="cine-page-intro"><div><span class="cine-kicker">PA SERVER MANAGER</span><h1>工程總覽</h1></div><div class="cine-intro-actions"><button class="cine-link" onclick="cineProjects()">跳到專案 <span>↓</span></button><button class="btn" onclick="openProjectModal()">＋ 專案管理</button></div></header>
      <section class="cine-story" id="core-story" aria-label="L10 System 到 L11 Rack 工程層級介紹">
        <div class="cine-stage" id="core-stage" data-phase="system">
          <div class="cine-stage-top"><span><i class="p-live-dot"></i> WISTRON <b>/</b> DATACENTER ENGINEERING</span><span class="cine-edition">SYSTEM CORE <b>01—02</b></span></div>
          <div class="cine-floor" aria-hidden="true"></div>
          <div class="cine-core" id="core-visual"><img class="cine-fallback" src="/static/img/server-hero.png" alt="靜態概念伺服器示意"><canvas id="system-core" tabindex="0" role="img" aria-label="Compute Tray 與 Rack 互動 3D 模型" aria-describedby="core-interaction-help"></canvas></div>
          <div class="cine-copy cine-copy-system" id="core-system-copy">
            <div class="cine-chapter"><span>01</span><b>L10 / SYSTEM LEVEL</b></div>
            <h2>System.<br><span>To rack.</span></h2>
            <p class="cine-lead">單機驗證，整櫃整合。</p><p class="cine-description">專案、硬體與操作，在同一個工作空間。<br>從系統狀態，直接進入工程現場。</p>
            <div class="cine-hero-actions"><button class="btn primary" onclick="productLevel('system')">進入 System 工作區 <span>↗</span></button><button class="cine-link" onclick="productLevel('rack')">L11 Rack <span>→</span></button></div>
            <div class="cine-live-summary"><span><b>${two(l10.length)}</b> L10 專案</span><i></i><span><b>${two(system.length)}</b> 系統</span></div>
          </div>
          <div class="cine-copy cine-copy-rack" id="core-rack-copy" inert aria-hidden="true">
            <div class="cine-chapter"><span>02</span><b>L11 / RACK LEVEL</b></div><h2>One rack.<br><span>Every layer.</span></h2>
            <p class="cine-lead">從元件位置，到整櫃操作。</p><p class="cine-description">48U 實體配置、Topology 與 Telemetry。<br>運算、網路、電力與冷卻，清楚分層。</p>
            <div class="cine-hero-actions"><button class="btn primary" onclick="${l11[0] ? `productRack(${esc(JSON.stringify(l11[0].name))})` : `productLevel('rack')`}">進入 Rack 工作區 <span>↗</span></button></div>
            <div class="cine-live-summary"><span><b>${two(l11.length)}</b> L11 專案</span><i></i><span><b>${two(rack.length)}</b> 元件</span></div>
          </div>
          <div class="cine-object-label"><span class="cine-label-system">L10 / \u904b\u7b97\u7bc0\u9ede</span><span class="cine-label-rack">L11 / GB300 \u6a5f\u6ac3\u793a\u610f</span><small>GB300 \u5916\u89c0\u53c3\u8003 \u00b7 \u975e\u5b98\u65b9 3D \u793a\u610f</small></div>
          <div class="cine-core-tools" id="core-tools"><span id="core-interaction-help">按住拖曳旋轉 · 方向鍵查看 · Home 重設</span><div><button type="button" data-core-view="rear" aria-label="3D 模型背面視角">背面</button><button type="button" data-core-view="reset" aria-label="重設 3D 模型視角">↺ 重設視角</button></div></div>
          <div class="cine-stage-bottom"><div class="cine-scroll-cue"><span>↓</span> 捲動查看 System → Rack <div class="cine-progress"><i></i></div></div><span>結構示意 · 非官方 CAD／即時設備</span><button class="cine-link" onclick="cineProjects()">專案一覽 ↘</button></div>
        </div>
      </section>
      <section class="cine-fleet" aria-label="工程狀態摘要"><div class="cine-fleet-total"><span class="cine-kicker">WORKSPACE SNAPSHOT</span><div><strong>${two(machines.length)}</strong><span>受管設備<small>Fixture / 模擬資料</small></span></div></div><div class="cine-fleet-levels"><button onclick="productLevel('system')"><span>L10 <small>System</small></span><b>${two(system.length)}</b></button><button onclick="productLevel('rack')"><span>L11 <small>Rack components</small></span><b>${two(rack.length)}</b></button></div><div class="cine-fleet-health"><span class="cine-kicker">OS CONNECTIVITY</span><div class="cine-connectivity">${connected.map(m=>`<i class="${m.os_alive===true?'on':m.os_alive===false?'off':'unknown'}" title="${esc(m.name)} · ${m.os_alive===true?'OS 在線':m.os_alive===false?'OS 離線':'未知'}"></i>`).join('')||'<span>尚無管理介面</span>'}</div><p><b>${online}</b> 在線 <span>／ ${connected.length} 有管理介面</span></p></div><div class="cine-attention"><span class="cine-kicker">ATTENTION</span><strong>${two(offline.length)}<small>OS 離線</small></strong><span>確認連線與電源狀態</span></div></section>
      <section class="cine-portfolio" id="project-portfolio"><header class="cine-section-head"><div><span class="cine-kicker">02 / PROJECT PORTFOLIO</span><h2>兩個層級。獨立管理。</h2></div><span>${two(projects.length)} 專案 <b>·</b> L10 System / L11 Rack</span></header>${prior.querySelector('.p-portfolios')?.outerHTML||''}</section>
      <header class="cine-section-head cine-insights-title"><div><span class="cine-kicker">03 / OPERATIONS SIGNAL</span><h2>系統健康與工程助理</h2></div><span>Fixture 狀態快照</span></header>${prior.querySelector('.p-insights')?.outerHTML||''}
      <footer class="cine-footer"><span>WISTRON <b>/</b> PA SERVER MANAGER</span><span>獨立 UI 預覽 · 未連接正式 FastAPI</span><span>L10 SYSTEM <b>—</b> L11 RACK</span></footer>`;
  };

  RENDERERS.projects = () => {
    const fragment = document.createElement('div');
    fragment.innerHTML = previous.projects();
    fragment.querySelector('.p-heading h1').textContent = projectLevelFilter.val === 'system' ? 'System workspace' : 'Rack project workspace';
    fragment.querySelector('.p-heading p').textContent = projectLevelFilter.val === 'system' ? '以專案管理單機系統，快速檢查連線、硬體與電源。' : '以整櫃專案管理元件；實體配置與拓樸請進入 Rack workspace。';
    const input = fragment.querySelector('.p-search input');
    input.value = search;
    input.setAttribute('value', search);
    input.setAttribute('placeholder', '搜尋專案、系統名稱或 IP');
    input.setAttribute('aria-label', '搜尋專案與系統');
    fragment.insertAdjacentHTML('beforeend', '<div id="cine-search-empty" class="cine-empty" hidden><span>⌕</span><h3>沒有符合的專案或系統</h3><p>試試專案名稱、系統名稱或 OS / BMC IP。</p><button class="btn" onclick="cineClearSearch()">清除搜尋</button></div>');
    return fragment.innerHTML;
  };
  window.cineClearSearch = () => { search = ''; const input = document.querySelector('.p-search input'); if (input) input.value = ''; productFilter(''); };
  window.productFilter = value => {
    search = value;
    const term = value.trim().toLocaleLowerCase();
    let found = 0;
    document.querySelectorAll('#proj-sort-list .proj-card').forEach(card => {
      const name = `${card.dataset.pname || ''} ${card.querySelector('.proj-card-desc')?.textContent || ''}`.toLocaleLowerCase();
      let matches = 0;
      card.querySelectorAll('tbody tr').forEach(row => {
        const fields = [row.querySelector('.mach-link')?.textContent || '', ...[...row.querySelectorAll('.p-ip')].map(el => el.textContent)].join(' ').toLocaleLowerCase();
        const visible = !term || name.includes(term) || fields.includes(term);
        row.hidden = !visible;
        if (visible) matches++;
      });
      const visible = !term || name.includes(term) || matches > 0;
      card.hidden = !visible;
      if (visible) found++;
    });
    const empty = document.getElementById('cine-search-empty');
    if (empty) empty.hidden = !term || found > 0;
  };
  window.cineProjects = () => document.getElementById('project-portfolio')?.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});

  // Original rack actions render before re-fetching machine state. Preserve their
  // confirmations and API calls, then refresh the displayed power indicators.
  const originalBulk = rackBulkRun, originalRackPower = rackDoPower, originalAllPower = rackPowerAllNames;
  const refreshRackState = async () => {
    try { await loadMachines(false); if (state.view === 'rack') setView('rack'); }
    catch (error) { showDialog('狀態更新失敗', `<p>操作已結束，但無法更新清單：${esc(error.message)}</p><p>請重新掃描確認最新狀態。</p>`, [{txt:'關閉',fn:closeDialog}]); }
  };
  rackBulkRun = async function(kind,names) { await originalBulk(kind,names); if (kind === 'on' || kind === 'off') await refreshRackState(); };
  rackDoPower = async function(...args) { await originalRackPower(...args); await refreshRackState(); };
  rackPowerAllNames = async function(...args) { await originalAllPower(...args); await refreshRackState(); };

  function mountStory() {
    teardown(); teardown = () => {};
    const story = document.getElementById('core-story');
    if (!story) return;
    const stage = document.getElementById('core-stage');
    const canvas = document.getElementById('system-core');
    const visual = document.getElementById('core-visual');
    const systemCopy = document.getElementById('core-system-copy');
    const rackCopy = document.getElementById('core-rack-copy');
    let scene;
    const lowResource = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    try { if (!lowResource) scene = window.PACoreScene?.mount(canvas); } catch (_) { canvas.dataset.coreState = 'fallback'; }
    if (lowResource) { canvas.dataset.coreState = 'fallback'; canvas.dataset.coreError = 'Static preview on low-resource device'; }
    let raf = 0;
    const toolButtons = [...stage.querySelectorAll('[data-core-view]')];
    const help = document.getElementById('core-interaction-help');
    const onReady = () => {
      visual.classList.add('is-rendered'); stage.dataset.scene = 'interactive'; canvas.tabIndex = 0;
      toolButtons.forEach(button => button.disabled = false);
      help.textContent = '按住拖曳旋轉 · 方向鍵查看 · Home 重設';
    };
    const onFallback = () => {
      visual.classList.remove('is-rendered'); stage.dataset.scene = 'fallback'; canvas.tabIndex = -1;
      toolButtons.forEach(button => button.disabled = true);
      help.textContent = '靜態預覽 · 3D 暫不可用，管理功能不受影響';
    };
    canvas.addEventListener('pa-core-ready', onReady);
    canvas.addEventListener('pa-core-fallback', onFallback);
    if (canvas.dataset.coreState === 'ready') onReady();
    if (!scene?.supported) onFallback();
    scene?.setTheme?.(document.documentElement.dataset.theme);
    const onTheme = event => scene?.setTheme?.(event.detail.theme);
    const onTool = event => {
      const button = event.target.closest('[data-core-view]');
      if (!button || button.disabled) return;
      if (button.dataset.coreView === 'rear') scene?.setOrbit?.(Math.PI,0);
      else scene?.resetOrbit?.();
    };
    document.getElementById('core-tools').addEventListener('click', onTool);
    window.addEventListener('pa-theme-change', onTheme);
    function update() {
      raf = 0;
      const bounds = story.getBoundingClientRect();
      const progress = reduced.matches ? 0 : Math.max(0, Math.min(1, (76 - bounds.top) / Math.max(1, story.offsetHeight - stage.offsetHeight)));
      const crossed = progress > .53;
      const out = Math.max(0, Math.min(1, 1 - progress * 2.5));
      const entering = Math.max(0, Math.min(1, (progress - .54) / .37));
      stage.style.setProperty('--story-progress', progress.toFixed(4));
      stage.style.setProperty('--system-opacity', out.toFixed(4));
      stage.style.setProperty('--rack-opacity', entering.toFixed(4));
      stage.style.setProperty('--system-y', `${progress * -36}px`);
      stage.style.setProperty('--rack-y', `${(1 - entering) * 32}px`);
      const travel = Math.min(1, progress / .62);
      const composition = travel * travel * (3 - 2 * travel);
      stage.style.setProperty('--core-x', `${composition * -60}%`);
      // Reserve a quiet footer beneath the tall rack for its identity and controls.
      stage.style.setProperty('--core-height', `${90 - composition * 14}%`);
      // Feather only the cropped close-up, never the standalone or full-rack view.
      const smooth = (a, b) => { const t = Math.max(0, Math.min(1, (progress - a) / (b - a))); return t * t * (3 - 2 * t); };
      stage.style.setProperty('--core-edge-alpha', (1 - smooth(.14, .32) * (1 - smooth(.78, .94))).toFixed(4));
      stage.dataset.phase = crossed ? 'rack' : 'system';
      const systemVisible = reduced.matches || out > .05;
      const rackVisible = reduced.matches || entering > .05;
      systemCopy.inert = !systemVisible;
      systemCopy.setAttribute('aria-hidden', String(!systemVisible));
      rackCopy.inert = !rackVisible;
      rackCopy.setAttribute('aria-hidden', String(!rackVisible));
      scene?.setProgress(progress);
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule, {passive:true});
    reduced.addEventListener('change', schedule);
    update();
    teardown = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduced.removeEventListener('change', schedule);
      document.getElementById('core-tools')?.removeEventListener('click', onTool);
      window.removeEventListener('pa-theme-change', onTheme);
      canvas.removeEventListener('pa-core-ready', onReady);
      canvas.removeEventListener('pa-core-fallback', onFallback);
      scene?.destroy();
    };
  }

  function polishRack() {
    const occupancy = document.querySelector('.p-rack-kpis>div:nth-child(3)');
    if (occupancy && !occupancy.querySelector('.cine-u-meter')) {
      const occupied = new Set();
      machines.filter(m => m.project === rackView.project && isRackItem(m) && m.rack_u > 0).forEach(m => {
        for (let n=0; n<(m.rack_size||1); n++) if (m.rack_u-n>0 && m.rack_u-n<=48) occupied.add(m.rack_u-n);
      });
      occupancy.insertAdjacentHTML('beforeend', `<div class="cine-u-meter" aria-label="${occupied.size} / 48U 已占用">${Array.from({length:48},(_,i)=>`<i class="${occupied.has(i+1)?'used':''}"></i>`).join('')}</div>`);
    }
  }
  function afterRender() {
    if (state.view === 'dashboard') mountStory();
    if (state.view === 'projects') productFilter(search);
    if (state.view === 'rack') polishRack();
    window.cinematicWorkspaceAfterRender?.();
  }
  _renderMachine = function(view) {
    teardown(); teardown = () => {};
    const changed = lastView !== view;
    previous.render(view);
    afterRender();
    if (changed) window.scrollTo({top:0, behavior:'instant'});
    lastView = view;
  };
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(savedTheme === 'light' ? 'light' : 'dark');
    document.querySelector('.p-brand-product').innerHTML = 'PA Server<span>Manager<span class="cine-version"> / NEXT</span></span>';
    document.querySelector('.p-brand-caption').textContent = 'DATACENTER ENGINEERING';
    document.querySelector('.p-top-label').innerHTML = 'ENGINEERING <i>/</i>';
    afterRender();
  });
})();
