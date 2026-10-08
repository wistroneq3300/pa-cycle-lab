/* Director S08 acceptance. Loopback synthetic fixtures only; every UI mutation is intercepted. */
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.PA_PREVIEW_URL || 'http://127.0.0.1:19487';
const captureDir = process.env.PA_CYCLE_CAPTURE_DIR ? path.resolve(process.env.PA_CYCLE_CAPTURE_DIR) : null;
const assetFiles = [
  'app/static/js/cycle-workspace.js',
  'app/static/js/cycle-console.js',
  'app/static/js/cycle-fleet.js',
  'app/static/css/cycle-workspace.css',
  'app/static/css/validation-console.css'
];
const clone = value => JSON.parse(JSON.stringify(value));

(async () => {
  if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
  const seed = await request.newContext({ baseURL: base });
  const capabilities = await (await seed.get('/api/cycle/capabilities')).json();
  assert.equal(capabilities.mode, 'synthetic', 'Cycle acceptance must stay synthetic');
  const jobs = new Map();
  for (const count of [1, 4, 32, 128]) {
    const response = await seed.post('/__validation/campaign', { data: { count } });
    assert(response.ok(), await response.text());
    jobs.set(count, await response.json());
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();
  const pageErrors = [], unknown = [], calls = [], captures = [];
  let failArtifacts = false;
  page.on('pageerror', error => pageErrors.push(error.message));

  const run4 = jobs.get(4);
  const current = new Map([...jobs].map(([count, job]) => [job.id, clone(job)]));
  const historyJob = { ...clone(run4), state: 'COMPLETE', stop_requested: false, updated_at: run4.updated_at + 30 };
  const inventory = {
    mode: 'synthetic',
    projects: [{
      name: run4.project,
      project_id: run4.targets[0].project_id,
      profile: run4.targets[0].cycle_profile,
      targets: run4.targets.map(target => ({ ...target, reasons: [] }))
    }]
  };
  const artifactFixture = {
    files: [
      'CYCLE_REVIEW_REPORT.html',
      'cycle_summary.json',
      'node/loop4/dmesg.txt'
    ],
    manifest: [
      { path: 'CYCLE_REVIEW_REPORT.html', kind: 'html-report' },
      { path: 'cycle_summary.json', kind: 'summary' },
      { path: 'node/loop4/dmesg.txt', kind: 'raw-evidence' }
    ]
  };

  await page.route('**/api/**', async route => {
    const req = route.request(), method = req.method(), url = new URL(req.url());
    if (url.origin !== base) return route.abort();
    const pathname = url.pathname;
    if (method === 'GET' && pathname === '/api/cycle/inventory') return route.fulfill({ json: inventory });
    if (method === 'GET' && pathname === '/api/cycle/runs') return route.fulfill({ json: { runs: [historyJob], has_more: false } });
    const direct = pathname.match(/^\/api\/cycle\/runs\/([^/]+)$/);
    if (method === 'GET' && direct) {
      const job = current.get(decodeURIComponent(direct[1]));
      return job ? route.fulfill({ json: job }) : route.fulfill({ status: 404, json: { detail: 'Synthetic job not found' } });
    }
    if (method === 'POST' && pathname === '/api/cycle/runs') {
      const body = req.postDataJSON();calls.push({ action: 'create', method, path: pathname, body });
      assert.deepEqual(Object.keys(body).sort(), ['channel', 'cycle_mode', 'cycle_profile', 'idempotency_key', 'limits', 'machine_ids', 'project'].sort());
      assert.equal(body.project, run4.project);assert.equal(body.machine_ids.length, 4);
      const job = current.get(run4.id);job.state = 'AWAITING_CONFIRMATION';job.stop_requested = false;
      job.pre = { version: 'director-pre-v1', runnable_ids: job.targets.map(target => target.name), excluded: [], findings: [] };
      return route.fulfill({ json: job });
    }
    if (method === 'DELETE' && direct) {
      calls.push({ action: 'delete', method, path: pathname, body: null });
      return route.fulfill({ json: { ok: true } });
    }
    const projectJob = pathname.match(/^\/api\/projects\/[^/]+\/cycle\/jobs\/([^/]+)$/);
    if (method === 'GET' && projectJob) {
      const job = current.get(decodeURIComponent(projectJob[1]));
      return job ? route.fulfill({ json: job }) : route.fulfill({ status: 404, json: { detail: 'Synthetic job not found' } });
    }
    const jobAction = pathname.match(/^\/api\/projects\/[^/]+\/cycle\/jobs\/([^/]+)\/(confirm|stop|reconcile)$/);
    if (method === 'POST' && jobAction) {
      const [, id, action] = jobAction, job = current.get(decodeURIComponent(id)), body = req.postDataJSON();
      assert(job);calls.push({ action, method, path: pathname, body });
      if (action === 'confirm') { assert.deepEqual(body, { version: job.pre.version, machine_ids: job.pre.runnable_ids });job.state = 'RUNNING'; }
      if (action === 'stop') { assert.deepEqual(body, {});job.state = 'STOP_REQUESTED';job.stop_requested = true; }
      if (action === 'reconcile') { assert.equal(typeof body.reason, 'string');assert.equal(body.reviewed_actions_hash, 'director-hash');job.state = 'INCOMPLETE'; }
      return route.fulfill({ json: job });
    }
    const reconcile = pathname.match(/^\/api\/projects\/[^/]+\/cycle\/jobs\/([^/]+)\/reconciliation$/);
    if (method === 'GET' && reconcile) return route.fulfill({ json: { actions: [{ operation: 'power_cycle', result: 'unknown' }], reviewed_actions_hash: 'director-hash' } });
    if (method === 'GET' && /\/artifacts$/.test(pathname)) {
      if (failArtifacts) return route.fulfill({ status: 503, json: { detail: 'Synthetic evidence source unavailable' } });
      return route.fulfill({ json: artifactFixture });
    }
    if (method === 'GET' && ['/api/machines', '/api/projects', '/api/ai/gpu-alerts'].includes(pathname)) return route.continue();
    if (method === 'GET' && /^\/api\/projects\/[^/]+\/cycle\/jobs\//.test(pathname)) return route.continue();
    unknown.push({ method, path: pathname });
    return route.fulfill({ status: 501, json: { detail: `Strict synthetic harness rejected ${method} ${pathname}` } });
  });

  const noOverflow = async label => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: body overflow`);
  const capture = async (name, width, height, theme) => {
    if (!captureDir) return;
    await page.setViewportSize({ width, height });
    await page.evaluate(value => applyTheme(value), theme);
    await page.waitForTimeout(120);
    await noOverflow(name);
    const file = path.join(captureDir, `${name}-${width}-${theme}.png`);
    // Viewport capture avoids Playwright stitching fixed shell elements into false
    // duplicate headers/sidebars. Scrolling to the reviewed region is explicit at
    // each call site, so the image reflects the actual operator viewport.
    const image = await page.screenshot({ path: file, fullPage: false, animations: 'disabled' });
    captures.push({ file: path.basename(file), viewport: { width, height }, screenshot_pixels: { width: image.readUInt32BE(16), height: image.readUInt32BE(20) }, theme, browser_zoom: '100%', device_scale_factor: 1 });
  };

  try {
    await page.goto(`${base}/#/cycle/new`);
    await page.locator('.cw-node').first().waitFor();
    await page.locator('#cw-visible').click();
    await page.locator('#cw-limit-kind').selectOption('loops');
    await page.locator('#cw-limit-value').fill('2');
    assert.match(await page.locator('#cw-count').innerText(), /4 個節點/);
    await page.evaluate(() => scrollTo(0, 0));
    for (const [width, height] of [[1366, 768], [1920, 1080]]) for (const theme of ['light', 'dark']) await capture('create', width, height, theme);

    await page.locator('#cw-create').click();
    await page.locator('#cw-confirm').waitFor({ state: 'visible' });
    assert.equal(calls.filter(call => call.action === 'create').length, 1);
    await page.locator('#cw-pre-shell').scrollIntoViewIfNeeded();
    await capture('pre-confirm', 1366, 768, 'dark');
    await page.locator('#cw-confirm').click();
    await page.locator('#cw-console-toggle').waitFor();
    await page.waitForFunction(() => document.querySelector('#cw-summary')?.textContent.includes('Running'));
    assert.equal(calls.filter(call => call.action === 'confirm').length, 1);
    assert.match(await page.locator('#cw-summary').innerText(), /執行狀態[\s\S]*Running[\s\S]*累積驗證健康[\s\S]*Fail/);
    assert.match(await page.locator('#cw-summary').innerText(), /執行完成不等於硬體 PASS/);

    await page.locator('#cw-console-toggle').click();
    await page.waitForFunction(() => document.querySelectorAll('.cycle-console-row').length > 0);
    const cycleConsole = page.locator('.live-console');
    assert.equal(await cycleConsole.locator('[data-part=density]').getAttribute('aria-pressed'), 'true');
    await cycleConsole.locator('[data-part=full]').click();
    assert.equal(await cycleConsole.locator('[data-part=full]').getAttribute('aria-pressed'), 'true');
    await cycleConsole.locator('[data-part=density]').click();
    await cycleConsole.locator('[data-part=warnings]').click();
    assert(await cycleConsole.locator('.cycle-console-row').count() > 0);
    assert(await cycleConsole.locator('.cycle-console-row').evaluateAll(rows => rows.every(row => ['WARN', 'FAIL', 'ERROR'].includes(row.dataset.level))));
    await cycleConsole.locator('[data-part=errors]').click();
    assert(await cycleConsole.locator('.cycle-console-row').evaluateAll(rows => rows.every(row => ['FAIL', 'ERROR'].includes(row.dataset.level))));
    await cycleConsole.locator('[data-part=severity-all]').click();
    await cycleConsole.locator('[data-part=search]').fill('PCI_DRIFT');
    await page.waitForTimeout(220);
    assert.equal(await cycleConsole.locator('.cycle-console-row').count(), 1);
    await cycleConsole.locator('[data-part=search]').fill('');
    await page.waitForTimeout(220);
    await cycleConsole.locator('[data-part=copy]').click();
    await cycleConsole.locator('[data-part=feedback]').waitFor({ state: 'visible' });
    assert.match(await cycleConsole.locator('[data-part=feedback]').innerText(), /已複製/);
    assert((await page.evaluate(() => navigator.clipboard.readText())).includes('Synthetic'));
    const downloadHref = await cycleConsole.locator('[data-part=download]').getAttribute('href');
    const download = await page.request.get(base + downloadHref);assert(download.ok());assert((await download.text()).includes('Synthetic'));
    await cycleConsole.locator('[data-part=history]').click();
    await page.waitForFunction(() => document.querySelector('[data-part=status]').textContent.includes('歷史視窗'));
    await cycleConsole.locator('[data-part=live]').click();
    assert.match(await cycleConsole.locator('[data-part=status]').innerText(), /LIVE/);

    await page.locator('.cw-artifacts>summary').click();
    await page.locator('#cw-evidence').click();
    await page.locator('#cw-evidence-count').waitFor();
    assert.match(await page.locator('#cw-evidence-state').innerText(), /已載入/);
    assert.equal(await page.locator('.cw-artifact-report').count(), 2);
    assert.equal(await page.locator('.cw-artifact-link').count(), 1);
    await page.locator('.cw-artifacts').scrollIntoViewIfNeeded();
    await capture('run-evidence', 1920, 1080, 'light');
    for (const [width, height] of [[1366, 768], [1920, 1080]]) for (const theme of ['light', 'dark']) {
      await page.locator('#cw-console').scrollIntoViewIfNeeded();
      await capture('run-console', width, height, theme);
    }

    // A source failure must remain visible in the workspace while the already
    // loaded evidence links stay available for manual inspection.
    failArtifacts = true;
    await page.locator('#cw-evidence').click();
    await page.waitForFunction(() => document.querySelector('#cw-evidence-state')?.dataset.state === 'error');
    assert.match(await page.locator('#cw-evidence-state').innerText(), /Synthetic evidence source unavailable/);
    assert(await page.locator('#cw-files a').count() > 0, 'Evidence failure must not erase already loaded links');
    await page.locator('.cw-artifacts').scrollIntoViewIfNeeded();
    await capture('evidence-error', 1920, 1080, 'light');
    failArtifacts = false;

    // Clipboard denial must not claim success or remove the visible transcript.
    const rowsBeforeCopyFailure = await cycleConsole.locator('.cycle-console-row').count();
    await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: async () => { throw new Error('Synthetic clipboard denial'); }
    }));
    await cycleConsole.locator('[data-part=copy]').click();
    assert.match(await cycleConsole.locator('[data-part=feedback]').innerText(), /複製未完成/);
    assert.match(await cycleConsole.locator('[data-part=error]').innerText(), /無法寫入剪貼簿/);
    assert.equal(await cycleConsole.locator('.cycle-console-row').count(), rowsBeforeCopyFailure);
    await cycleConsole.scrollIntoViewIfNeeded();
    await capture('copy-failure', 1366, 768, 'dark');

    const stateBeforeClose = current.get(run4.id).state;
    await page.locator('#cw-console-toggle').click();
    assert(await page.locator('#cw-console').isHidden());
    assert.equal(current.get(run4.id).state, stateBeforeClose, 'Closing Console must not stop/cancel the job');
    assert.equal(calls.filter(call => call.action === 'stop').length, 0);
    await page.locator('#cw-stop').click();
    assert.equal(calls.filter(call => call.action === 'stop').length, 1);

    for (const count of [1, 4, 32, 128]) {
      const job = jobs.get(count);current.set(job.id, clone(job));
      await page.goto(`${base}/#/cycle/runs/${job.id}`);
      await page.locator('#cw-console-toggle').click();
      await page.waitForFunction(expected => document.querySelector('.lc-fleet-counts strong')?.textContent === expected, `${count} ${count === 1 ? 'NODE' : 'NODES'}`);
      const live = page.locator('.live-console');
      if (count === 1) assert.equal(await live.locator('.lc-fleet-controls').count(), 0);
      if (count === 4) {
        await live.locator('[data-machine]').first().click();
        assert.equal(await live.locator('.cycle-console-row').evaluateAll(rows => new Set(rows.map(row => row.dataset.machine)).size), 1);
        await live.getByRole('button', { name: 'Clear node filter', exact: true }).click();
      }
      if (count > 8) {
        assert.match(await live.locator('.lc-fleet-counts').innerText(), /Health PASS/);
        assert.match(await live.locator('.lc-fleet-counts').innerText(), /Recovery/);
        await live.locator('.lc-matrix>summary').click();
        await live.locator('.lc-matrix>div>details>summary').first().click();
        assert(await live.locator('.lc-matrix [data-machine]').count() <= 4);
      }
      if (count === 128) {
        await live.scrollIntoViewIfNeeded();
        await capture('fleet-128', 1920, 1080, 'dark');
      }
    }

    const large = jobs.get(128);await seed.post('/__validation/events', { data: { job_id: large.id, count: 2400 } });
    await page.locator('[data-part=full]').click();
    await page.waitForFunction(() => document.querySelectorAll('.cycle-console-row').length === 2000, null, { timeout: 30000 });
    await page.locator('[data-part=pause]').click();
    assert.equal(await page.locator('[data-part=pause]').getAttribute('aria-pressed'), 'true');
    const frozen = await page.locator('[data-part=log]').innerText();
    await seed.post('/__validation/events', { data: { job_id: large.id, count: 10 } });
    await page.waitForTimeout(1700);assert.equal(await page.locator('[data-part=log]').innerText(), frozen);
    await page.locator('[data-part=pause]').click();
    assert.equal(await page.locator('[data-part=pause]').getAttribute('aria-pressed'), 'false');

    const reconcileJob = current.get(run4.id);
    reconcileJob.state = 'RECONCILIATION_REQUIRED';
    reconcileJob.stop_requested = true;
    await page.goto(`${base}/#/cycle/runs/${run4.id}`);
    await page.locator('#cw-reconciliation').waitFor({ state: 'visible' });
    await page.locator('#cw-review-action').click();
    const reconciliationForm = page.locator('#cw-review-body form');
    await reconciliationForm.locator('textarea').fill('已核對 synthetic 動作與保留範圍');
    await page.locator('#cw-reconciliation').scrollIntoViewIfNeeded();
    await capture('reconcile', 1366, 768, 'dark');
    await reconciliationForm.locator('button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#cw-summary')?.textContent.includes('Incomplete'));
    assert.equal(calls.filter(call => call.action === 'reconcile').length, 1);

    await page.goto(`${base}/#/cycle`);await page.locator('.cw-del').waitFor();
    await page.evaluate(() => scrollTo(0, 0));
    await capture('history', 1366, 768, 'light');
    await page.locator('.cw-del').click();
    const dialog = page.locator('#rm-dialog');await dialog.waitFor({ state: 'visible' });
    const confirmText = await dialog.innerText();
    for (const required of ['Project', 'Run', 'Evidence', 'log', '無法復原']) assert(confirmText.includes(required), `delete confirm missing ${required}`);
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(calls.filter(call => call.action === 'delete').length, 0);
    await page.locator('.cw-del').click();await dialog.getByRole('button', { name: '確認送出', exact: true }).click();
    await page.waitForTimeout(80);assert.equal(calls.filter(call => call.action === 'delete').length, 1);

    assert.deepEqual(pageErrors, []);
    assert.deepEqual(unknown, []);
    assert.equal(calls.filter(call => call.action === 'create').length, 1);
    assert.equal(calls.filter(call => call.action === 'confirm').length, 1);
    assert.equal(calls.filter(call => call.action === 'stop').length, 1);
    assert.equal(calls.filter(call => call.action === 'reconcile').length, 1);
    assert.equal(calls.filter(call => call.action === 'delete').length, 1);
    if (captureDir) {
      const metadata = {
        result: 'PASS',
        mode: 'loopback synthetic fixture; no hardware transport',
        base_sha: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        working_tree: true,
        assets: Object.fromEntries(assetFiles.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
        browser: 'Microsoft Edge / Playwright',
        os: 'Windows',
        browser_zoom: '100%',
        device_scale_factor: 1,
        screenshot_capture: 'viewport; fixed shell elements are not stitched',
        css_viewports: ['1366x768', '1920x1080'],
        themes: ['light', 'dark'],
        real_125_percent_zoom: 'NOT_TESTED_IN_THIS_HARNESS',
        fixtures: [1, 4, 32, 128],
        actions: calls,
        captures,
        unknown_requests: unknown,
        page_errors: pageErrors
      };
      fs.writeFileSync(path.join(captureDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    }
    console.log(JSON.stringify({ result: 'PASS', calls: calls.map(call => call.action), captures: captures.length, fixtures: [1, 4, 32, 128] }));
  } finally {
    await context.close();await browser.close();await seed.dispose();
  }
})().catch(error => { console.error(error);process.exit(1); });
