/* Director S09/S10 rendering and state-contract review; loopback synthetic UI only. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.PA_CYCLE_BASE_URL || 'http://127.0.0.1:9196';
const round = process.env.DIRECTOR_CAPTURE_ROUND || 'round1';
const out = path.resolve(`docs/ui-premium/screens/director-telemetry-inspection-${round}`);
fs.mkdirSync(out, { recursive: true });

const now = 1791440000;
const points = (offset = 0) => Array.from({ length: 14 }, (_, index) => [
  (now - (13 - index) * 300) * 1000,
  Math.round((36 + offset + Math.sin(index / 2) * 8 + index / 3) * 10) / 10,
]);

const nodeBase = (id, slot, state = 'READY') => ({
  node_id: id,
  slot,
  hostname: `${slot.toLowerCase()}-director-long-hostname.validation.example`,
  os_ip: slot === 'N5' ? '2001:db8:85a3::8a2e:370:7334' : `192.0.2.${20 + Number(slot.slice(1))}`,
  binding_revision: `binding-${id}`,
  configured: true,
  state,
  detail: state === 'READY' ? '中央監控已取得有效樣本。' : '請根據下方元件狀態處理。',
  checked_at: now,
  stale: state === 'STALE',
  dashboard_url: 'https://grafana.example.test/d/node',
  components: {
    host: state === 'ERROR' ? 'ERROR' : 'READY',
    gpu: { state: slot === 'N5' ? 'NOT_APPLICABLE' : 'READY', gpus: slot === 'N5' ? [] : [
      { model: 'NVIDIA H100 NVL Extremely Long Engineering Fixture', driver: '550.90.07' },
      { model: 'NVIDIA H100 NVL Extremely Long Engineering Fixture', driver: '550.90.07' },
    ] },
    prometheus: state === 'ERROR' ? 'QUERY_ERROR' : 'READY',
  },
  host_setup: {}, gpu_setup: {},
  job: {
    job_id: `job-${id}-director`, scope: 'all', state: state === 'ERROR' ? 'ERROR' : 'READY',
    current_step: state === 'ERROR' ? 'VERIFY' : 'READY', created_at: now - 600,
    error: state === 'ERROR' ? 'Prometheus query gateway unavailable (fixture)' : '',
  },
});

const telemetryNodes = [
  nodeBase('node-ready', 'N1', 'READY'),
  nodeBase('node-stale', 'N2', 'STALE'),
  nodeBase('node-nodata', 'N3', 'READY'),
  nodeBase('node-query', 'N4', 'ERROR'),
  nodeBase('node-na', 'N5', 'READY'),
];

function panel(id, title, state, unit, series = [], error = '') {
  return { id, title, state, unit, series, error };
}

function telemetryPayload(id) {
  const ready = [
    { label: 'CPU total / socket 0', latest: 48.2, points: points(0) },
    { label: 'CPU total / socket 1', latest: 55.1, points: points(9) },
  ];
  const gpu = Array.from({ length: 8 }, (_, index) => ({
    label: `GPU ${index} / H100 NVL temperature`, latest: 48 + index,
    points: points(index * 2),
  }));
  const payload = {
    state: 'READY', last_sample: { host: now - 20 },
    stats: { uptime: [{ value: 912345 }], load: [{ value: 3.42 }], filesystem: [{ value: 61.4 }] },
    panels: [panel('cpu', 'CPU utilization', 'READY', '%', ready), panel('gpu', 'GPU temperature', 'READY', '°C', gpu)],
  };
  if (id === 'node-stale') {
    payload.state = 'STALE'; payload.last_sample.host = now - 3600;
    payload.panels = [panel('cpu', 'CPU utilization', 'STALE', '%'), panel('gpu', 'GPU temperature', 'STALE', '°C')];
  } else if (id === 'node-nodata') {
    payload.state = 'NO_DATA'; payload.last_sample.host = null;
    payload.panels = [panel('cpu', 'CPU utilization', 'NO_DATA', '%'), panel('gpu', 'GPU temperature', 'NO_DATA', '°C')];
  } else if (id === 'node-query') {
    payload.state = 'QUERY_ERROR'; payload.last_sample.host = null;
    payload.panels = [panel('cpu', 'CPU utilization', 'QUERY_ERROR', '%', [], 'upstream Prometheus timeout after 10s'), panel('gpu', 'GPU temperature', 'QUERY_ERROR', '°C', [], 'upstream Prometheus timeout after 10s')];
  } else if (id === 'node-na') {
    payload.panels = [panel('cpu', 'CPU utilization', 'READY', '%', ready), panel('gpu', 'GPU temperature', 'NOT_APPLICABLE', '°C')];
  }
  return payload;
}

function inspectionSnapshot(mode) {
  if (mode === 'error') return null;
  const disabled = mode === 'disabled';
  const matrix = [
    { node_id:'node-ready',node_label:'N1',check_name:'Kernel / dmesg',status:'FAIL',health_status:'FAIL',required:true,expected:'0 critical events',observed:'1',last_checked:now-30,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'Synthetic N1 failure 1.' },
    { node_id:'node-ready',node_label:'N1',check_name:'PCIe Inventory',status:'FAIL',health_status:'FAIL',required:true,expected:'8',observed:'7',last_checked:now-30,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'Expected 8 / Observed 7' },
    { node_id:'node-ready',node_label:'N1',check_name:'SSD Inventory',status:'FAIL',health_status:'FAIL',required:true,expected:'2',observed:'1',last_checked:now-30,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'Synthetic N1 failure 3.' },
    { node_id:'node-ready',node_label:'N1',check_name:'GPU / NVLink',status:'NOT_APPLICABLE',health_status:'UNKNOWN',required:false,expected:null,observed:null,last_checked:now-30,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'此 Project 不適用。' },
    { node_id:'node-stale',node_label:'N2',check_name:'Kernel / dmesg',status:'PASS',health_status:'PASS',required:true,expected:'No matching rule',observed:'0',last_checked:now-40,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'N2 completed without findings.' },
    { node_id:'node-stale',node_label:'N2',check_name:'PCIe Inventory',status:'PASS',health_status:'PASS',required:true,expected:'8',observed:'8',last_checked:now-40,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'N2 inventory matches.' },
    { node_id:'node-nodata',node_label:'N3',check_name:'SEL / Event Log',status:'WARN',health_status:'WARN',required:true,expected:null,observed:'1 warning',last_checked:now-50,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'Synthetic N3 warning 1.' },
    { node_id:'node-nodata',node_label:'N3',check_name:'Sensors',status:'WARN',health_status:'WARN',required:true,expected:'Nominal',observed:'Review',last_checked:now-50,evidence_available:true,evidence_ref:{snapshot_id:'snapshot-director'},detail:'Synthetic N3 warning 2.' },
  ].map(row=>disabled&&row.required?{...row,status:'NOT_MONITORED'}:row);
  return {
    error: '', running: false, delayed: false,
    config: { enabled: !disabled, node_overrides: {}, ai_enabled: true, thresholds: {}, interval_seconds: 120, deep_seconds: 600, sensor_seconds: 120, firmware_seconds: 3600, duration_seconds: 120, recovery_samples: 2, stale_seconds: 300, hysteresis: 5 },
    summary: { fail: 3, warning: 2 },
    lifecycle_counts: { recovered: mode === 'recovered' ? 1 : 0, archived: 3 },
    nodes: [{ node_id: 'node-ready', label: 'N1 / n1-director-long-hostname.validation.example' },{ node_id: 'node-stale', label: 'N2' },{ node_id: 'node-nodata', label: 'N3' }],
    identity: {}, identity_history: [],
    coverage: [{ node_id: 'node-ready', source: 'Redfish', state: mode === 'recovered' ? 'PARTIAL' : 'FRESH', collected_at: now - 30, duration: 1.7, detail: mode === 'recovered' ? 'One source unavailable; retained prior observation.' : 'EventLog and sensor observations collected.', services: ['EventLog', 'SEL', 'Journal', 'LifecycleLog'] }],
    coverage_summary: { completed: 3, required: 4, coverage: 75, pass: 1, warn: 1, fail: 1, not_monitored: 0 },
    check_matrix: matrix,
    progress: [], last_fast_at: now - 30, last_completed_at: now - 30, last_deep_at: now - 120,
  };
}

function inspectionIssues(mode) {
  const baseIssue = {
    id: `issue-${mode}`, node_id: 'node-ready', component: 'GPU / PCIe fabric controller with a deliberately long component name',
    rule: 'hardware.telemetry.pcie_aer_uncorrected_long_rule_identifier', severity: mode === 'current' ? 'FAIL' : 'WARNING',
    status: mode === 'recovered' ? 'RECOVERED' : 'ACTIVE', first_seen_at: now - 7200, last_seen_at: now - 30,
    resolved_at: mode === 'recovered' ? now - 10 : null, recurrences: 2, occurrences: 4, observations: 12,
    facts: '觀測事實：PCIe AER Uncorrected 事件於已保存日誌中重複出現；這是非常長的工程摘要，用於驗證長內容、hostname 與 rule ID 不會撐破佈局。',
    evidence: 'cycle-run-director / loop-000128 / evidence/report-with-long-name.json', acknowledged: false, known_issue: false, mute_until: 0,
    evidence_ref: { snapshot_id: 'snapshot-director', run_id: 'cycle-director-run' },
  };
  if (mode === 'recovered') return [{ ...baseIssue, analysis: { state: 'COMPLETE', completed_at: now - 60, result: { conclusion: '已恢復；建議核對後續事件是否持續。', possible_causes: ['短暫連線或裝置重新列舉'], recommended_checks: ['比對恢復前後的原始證據'], confidence_note: '僅依已保存觀測', based_on: ['Redfish EventLog'] } } }];
  if (mode === 'ai-missing') return [{ ...baseIssue, analysis: { state: 'COMPLETE', completed_at: now - 60, result: { possible_causes: null, recommended_checks: ['核對原始證據', ''], conclusion: null, confidence_note: null, based_on: null } } }];
  return [{ ...baseIssue, analysis: { state: 'ERROR', error: 'AI provider unavailable (fixture)', error_category: 'UPSTREAM_UNAVAILABLE', based_on: { last_seen_at: now - 30, source: 'saved inspection evidence' } } }];
}

async function json(route, body, status = 200) {
  await route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('pa_theme', 'light'));
  const page = await context.newPage();
  const errors = [], ownerRequests = [];
  let inspectionMode = 'current';
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    if (url.origin !== base) return route.continue();
    if (url.pathname.startsWith('/api/telemetry/') || url.pathname.includes('/telemetry/analyze') || url.pathname.includes('/inspection')) ownerRequests.push(`${method} ${url.pathname}${url.search}`);
    if (method === 'GET' && url.pathname === '/api/telemetry/systems/host_a/nodes') return json(route, { nodes: telemetryNodes });
    if (method === 'GET' && /^\/api\/telemetry\/nodes\/[^/]+$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split('/').at(-1));
      const node = telemetryNodes.find(candidate => candidate.node_id === id);
      assert(node, `unknown telemetry node ${id}`); return json(route, node);
    }
    if (method === 'GET' && /^\/api\/telemetry\/nodes\/[^/]+\/charts$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split('/').at(-2)); return json(route, telemetryPayload(id));
    }
    if (method === 'GET' && url.pathname === '/api/machine/host_a/telemetry/analyze') {
      const id = url.searchParams.get('node_id');
      if (id === 'node-ready' || id === 'node-na') return json(route, { ok: true, analysis: '已取得有效趨勢摘要。此內容為 AI 輔助判讀，不改變硬體驗證判定。' });
      if (id === 'node-query') return json(route, { ok: false, error: 'AI analysis backend unavailable (fixture)' });
      return json(route, { ok: true });
    }
    if (method === 'GET' && url.pathname === '/api/machine/host_a/inspection') {
      if (inspectionMode === 'error') return json(route, { detail: 'Inspection source unavailable (fixture)' }, 503);
      return json(route, inspectionSnapshot(inspectionMode));
    }
    if (method === 'GET' && url.pathname === '/api/machine/host_a/inspection/issues') return json(route, { issues: inspectionIssues(inspectionMode) });
    if (url.pathname.includes('/api/machine/host_a/inspection')) throw new Error(`STRICT INSPECTION MOCK: unexpected ${method} ${url.pathname}`);
    return route.continue();
  });

  async function setViewport(width, theme) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    await page.evaluate(value => applyTheme(value), theme);
    await page.waitForTimeout(80);
  }
  async function shot(name, locator) {
    await locator.scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal page overflow`);
  }
  async function selectTelemetry(id) {
    await page.locator('.tp-workspace [data-node]').selectOption(id);
    await page.waitForFunction(nodeId => document.querySelector('.tp-workspace [data-node]')?.value === nodeId && document.querySelector('.tn-grid .tn-panel'), id);
    await page.waitForTimeout(120);
  }
  async function mountInspection(mode) {
    inspectionMode = mode;
    await page.evaluate(() => { window.SystemInspection.dispose(); window.SystemInspection.mount('host_a'); });
    if (mode === 'error') await page.waitForFunction(() => document.querySelector('#pd-inspection [data-error]')?.textContent.includes('Inspection source unavailable'));
    else await page.waitForFunction(() => document.querySelector('#pd-inspection [data-status]')?.textContent && !document.querySelector('#pd-inspection [data-status]').textContent.includes('讀取中'));
  }

  try {
    await page.goto(`${base}/?preview=normal#/dashboard`);
    await page.waitForFunction(() => window.PA_PREVIEW?.scenario === 'normal' && typeof openMachine === 'function');
    await page.waitForTimeout(250);
    await page.evaluate(() => openMachine('host_a'));
    await page.locator('.pd-system-header').waitFor();
    await page.locator('#pd-tab-telemetry').click();
    await page.locator('.tp-workspace [data-node]').waitFor();
    await selectTelemetry('node-ready');
    await setViewport(1920, 'light');
    await shot('telemetry-ready-1920-light', page.locator('.tp-workspace'));
    assert.equal(await page.locator('.tn-ai [data-ai-state]').innerText(), '分析完成');
    assert.match(await page.locator('[data-health-scope]').innerText(), /Node Scope · N1/);
    assert.equal(await page.locator('[data-health-counts]').innerText(), '3 FAIL / 0 WARN');

    await selectTelemetry('node-stale');
    await page.waitForFunction(() => document.querySelector('[data-health-scope]')?.textContent.includes('N2'));
    assert.equal(await page.locator('[data-health-counts]').innerText(), '0 FAIL / 0 WARN', 'N2 must not inherit N1/N3 findings');
    await shot('telemetry-node-scope-n2-1920-light', page.locator('.tn-health'));
    await selectTelemetry('node-nodata');
    await page.waitForFunction(() => document.querySelector('[data-health-scope]')?.textContent.includes('N3'));
    assert.equal(await page.locator('[data-health-counts]').innerText(), '0 FAIL / 2 WARN');
    inspectionMode='disabled';await selectTelemetry('node-ready');
    await page.waitForFunction(() => document.querySelector('[data-health-state]')?.textContent==='NOT MONITORED');
    assert.equal(await page.locator('[data-health-counts]').innerText(), '3 FAIL / 0 WARN', 'disabled Inspection must retain historical Node findings');
    assert.equal(await page.locator('.tn-ai [data-ai-state]').innerText(), '分析完成', 'Inspection disablement must not block Telemetry AI');
    inspectionMode='current';

    await setViewport(1366, 'dark');
    for (const [id, label] of [['node-stale', 'stale'], ['node-nodata', 'no-data'], ['node-query', 'query-error'], ['node-na', 'not-applicable']]) {
      await selectTelemetry(id); await shot(`telemetry-${label}-1366-dark`, page.locator('.tp-workspace'));
      if (id === 'node-query') {
        const errors = await page.locator('.tn-panel [data-empty]').allInnerTexts();
        assert(errors.every(text => text.includes('upstream Prometheus timeout after 10s')), 'QUERY_ERROR must retain the backend reason in each affected panel');
        await page.waitForTimeout(80);
        assert.match(await page.locator('.tn-panel[data-panel="cpu"] [data-empty]').innerText(), /upstream Prometheus timeout after 10s/);
      }
    }
    assert.equal(await page.locator('.tn-panel[data-panel="gpu"] [data-health]').innerText(), '不適用');
    assert.match(await page.locator('.tn-panel[data-panel="gpu"] [data-empty]').innerText(), /未配置 NVIDIA GPU/);

    await selectTelemetry('node-ready');
    const firstLegend = page.locator('.tn-panel[data-panel="cpu"] .tn-legend button').first();
    await firstLegend.click(); assert.equal(await firstLegend.getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => applyTheme('light')); await page.waitForTimeout(80);
    assert.equal(await page.locator('.tn-panel[data-panel="cpu"] .tn-legend button').first().getAttribute('aria-pressed'), 'false');
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/api/telemetry/nodes/node-ready/charts?period=6h')),
      page.locator('.tp-workspace select[aria-label="Telemetry 時間範圍"]').selectOption('6h'),
    ]);
    await page.waitForTimeout(80);
    assert.equal(await page.locator('.tn-panel[data-panel="cpu"] .tn-legend button').first().getAttribute('aria-pressed'), 'false');
    await selectTelemetry('node-na');
    assert.equal(await page.locator('.tn-panel[data-panel="cpu"] .tn-legend button').first().getAttribute('aria-pressed'), 'true', 'hidden series state must not leak to another node');
    await selectTelemetry('node-ready');
    assert.equal(await page.locator('.tn-panel[data-panel="cpu"] .tn-legend button').first().getAttribute('aria-pressed'), 'false', 'hidden series state must survive returning to its node');
    await selectTelemetry('node-stale');
    assert.equal(await page.locator('.tn-legend button').count(), 0, 'visibility state must not leak across nodes');

    await page.locator('#pd-tab-sensors').click();
    await page.locator('#pd-inspection').waitFor();
    await setViewport(1920, 'light');
    for (const mode of ['current', 'recovered', 'ai-missing']) {
      await mountInspection(mode);
      if (await page.locator('#pd-inspection [data-issues]').isHidden()) await page.locator('#pd-inspection [data-view]').click();
      else await page.locator('#pd-inspection [data-reload]').click();
      await page.locator(`#pd-inspection [data-issue-id="issue-${mode}"]`).waitFor();
      await page.locator('#pd-inspection [data-issue-id]').first().evaluate(element => { element.open = true; });
      await shot(`inspection-${mode}-1920-light`, page.locator('#pd-inspection'));
      assert.equal(await page.locator('#pd-inspection [data-matrix] tr').count(),8);
      assert.match(await page.locator('#pd-inspection [data-matrix]').innerText(),/Expected 8 \/ Observed 7[\s\S]*NOT APPLICABLE/);
      const text = await page.locator('#pd-inspection [data-issue-id]').first().innerText();
      assert.doesNotMatch(text, /undefined|null|NaN/);
    }
    await setViewport(1366, 'dark');
    await mountInspection('error');
    await shot('inspection-error-1366-dark', page.locator('#pd-inspection'));
    assert.match(await page.locator('#pd-inspection [data-error]').innerText(), /Inspection source unavailable/);

    assert.deepEqual(errors, []);
    const childProcess = require('node:child_process');
    const testedSha = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const workingTreeModified = Boolean(childProcess.execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
    const metadata = {
      tested_sha: testedSha,
      program_ref: testedSha + (workingTreeModified ? '+working-tree' : ''),
      working_tree_modified: workingTreeModified,
      base, mode: 'loopback synthetic fixtures; no hardware requests', round,
      viewports: ['1920x1080 light', '1366x768 dark'],
      states: { telemetry: ['READY', 'STALE', 'NO_DATA', 'QUERY_ERROR', 'NOT_APPLICABLE'], inspection: ['current', 'recovered', 'AI missing fields', 'source error'] },
      owner_requests: ownerRequests, browser_errors: errors,
    };
    fs.writeFileSync(path.join(out, 'metadata.json'), JSON.stringify(metadata, null, 2));
    console.log(`PASS director Telemetry/Inspection ${round}: state truth, legend visibility, defensive AI, screenshots`);
  } finally {
    await context.close(); await browser.close();
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
