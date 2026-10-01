// Browser request-contract test using the repository fixture server only.
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const python = 'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
(async () => {
  const server = cp.spawn(python, ['-B', '-u', '-c', "from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"], {cwd: root, windowsHide: true});
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      server.stdout.once('data', d => resolve(Number(d.toString().trim())));
      server.once('error', reject); server.once('exit', () => reject(Error('Preview exited')));
    });
    browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${port}/#/rack/proj_k`);
    await page.waitForSelector('#ew-rack-add');
    const name = await page.evaluate(() => {
      const machine = machines.find(m => equipmentIsServer(m) && m.os_ip);
      window.testOriginalIp = machine.os_ip;
      window.testCalls = [];
      window.api = async (url, options) => {
        testCalls.push({url, body: JSON.parse(options.body)});
        return {ok: true, hostname: machine.name, bmc_ip: '192.0.2.20', changed: true};
      };
      changeOsIp(machine.name);
      return machine.name;
    });
    assert.equal(await page.locator('#new-os-pass-input').inputValue(), '');
    await page.locator('#osip-probe-btn').click();
    await page.waitForFunction(() => testCalls.length === 1);
    assert.equal((await page.evaluate(() => testCalls[0].body)).machine_name, name);
    await page.locator('#new-os-ip-input').fill('192.0.2.10');
    await page.locator('#new-os-user-input').fill('manual-user');
    await page.locator('#new-os-pass-input').fill('explicit-fixture');
    await page.locator('#new-os-port-input').fill('2222');
    await page.locator('#osip-probe-btn').click();
    await page.waitForFunction(() => testCalls.length === 2);
    const manual = (await page.evaluate(() => testCalls[1].body));
    assert.deepEqual(manual, {os_ip: '192.0.2.10', expected_hostname: name, os_user: 'manual-user', os_pass: 'explicit-fixture', os_port: 2222});
    await page.locator('#new-bmc-ip-input').fill('');
    await page.locator('#ip-submit-btn').click();
    await page.waitForFunction(() => testCalls.length === 3);
    assert.deepEqual((await page.evaluate(() => testCalls[2].body)), {new_os_ip: '192.0.2.10', os_user: 'manual-user', os_pass: 'explicit-fixture', os_port: 2222});
    await page.evaluate(name => {closeDialog(); changeOsIp(name);}, name);
    assert.equal(await page.locator('#new-os-pass-input').inputValue(), '');
    await page.setViewportSize({width: 390, height: 844});
    assert.ok(await page.locator('#new-os-pass-input').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: Chrome saved-target probe, explicit new-IP probe/change request, password reset and mobile form; fixture only');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
