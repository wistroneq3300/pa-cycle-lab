/* Focused presentation regression. Mutates only browser memory, never fixtures/API contracts. */
const assert = require('node:assert/strict');
const BASE = process.env.PA_PREVIEW_URL || 'http://127.0.0.1:8769';
// The pure data mapping is independently testable when browser launch is unavailable.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../static/js/product-detail.js'),'utf8');
const mapping = source.slice(source.indexOf('  const reportedText ='),source.indexOf('  function cleanSection('));
const {inventorySummary,systemIdentity} = vm.runInNewContext(mapping + ';({inventorySummary,systemIdentity})');
const fixture = {cpu:{model:'CPU fixture',sockets:2},dimm:{count:8,types:['DDR5']},ssd:[{model:'Drive fixture'}],nic:['01:00.0 Ethernet controller: NIC fixture'],gpu:[{name:'GPU fixture'}]};
const summarize = (hardware,os={}) => Object.fromEntries(inventorySummary(hardware,os).map(row=>[row[0],row.slice(1).join(' · ')]));
const populated = summarize(fixture,{mem:'256 GB'});
assert.match(populated.CPU,/2 sockets.*CPU fixture/);
assert.match(populated.MEMORY,/256 GB.*8 DIMMs.*DDR5/);
assert.match(populated.STORAGE,/1 drive.*Drive fixture/);
assert.match(populated.NETWORK,/1 entry.*NIC fixture/);
assert.match(populated.GPU,/1 GPU.*GPU fixture/);
assert.match(summarize({...fixture,gpu:[]}).GPU,/0 GPUs.*本次回報未列出 GPU/);
assert.match(summarize({...fixture,gpu:undefined}).GPU,/尚未取得.*來源未回報 GPU 清單/);
assert.match(summarize({...fixture,gpu:null}).GPU,/尚未取得/);
assert.match(summarize({...fixture,gpu:{count:8}}).GPU,/尚未取得/);
assert.match(summarize({...fixture,gpu:'8 GPUs'}).GPU,/尚未取得/);
for (const value of Object.values(summarize({}))) assert.match(value,/尚未取得/);
assert.equal(systemIdentity({},{firmware:{bios:{vendor:'Not a chassis brand'}}}).label,'');
assert.equal(systemIdentity({manufacturer:'Chassis maker',model:'Model A'},{}).label,'Chassis maker · Model A');
assert.equal(systemIdentity({},{system:{manufacturer:'Actual vendor',product_name:'Actual model'}}).label,'Actual vendor · Actual model');
assert.equal(systemIdentity({manufacturer:'Fallback vendor',model:'Fallback model'},{system:{manufacturer:{unusable:true},model:null}}).label,'Fallback vendor · Fallback model');
console.log('PASS pure inventory mapping: populated / empty / missing / null / malformed / unavailable, explicit chassis identity, safe metadata fallback, no inferred chassis branding.');
(async () => {
  if (process.argv.includes('--unit')) return;
  let playwright;
  try { playwright = require('playwright'); }
  catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
  const browser = await playwright.chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport:{width:1600,height:1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(BASE + '/#/machine/host_a');
    await page.waitForSelector('.pd-inventory-reported');
    const scenarios = await page.evaluate(() => {
      const original = machineDetailCache.host_a;
      const results = {};
      const render = detail => {
        machineDetailCache.host_a = detail;
        const holder = document.createElement('div');
        holder.innerHTML = RENDERERS.machine();
        return {
          text: holder.textContent,
          heading: holder.querySelector('.pd-showcase-copy h2').textContent,
          header: holder.querySelector('.pd-system-header').textContent,
          gpu: holder.querySelector('[data-inventory="gpu"]').textContent,
          storage: holder.querySelector('[data-inventory="storage"]').textContent,
          network: holder.querySelector('[data-inventory="network"]').textContent,
          memory: holder.querySelector('[data-inventory="memory"]').textContent,
          cpu: holder.querySelector('[data-inventory="cpu"]').textContent,
          tabs: holder.querySelectorAll('[role="tab"]').length,
          canvases: holder.querySelectorAll('#tel-grid canvas').length,
          illustration: holder.querySelector('.pd-neutral-chassis svg').getAttribute('aria-label'),
          unsafeMarkup: !!holder.querySelector('img[src="x"]')
        };
      };
      try {
        results.gpu = render(structuredClone(original));
        const empty = structuredClone(original);
        empty.os_info.hw.gpu = [];
        results.empty = render(empty);
        const missing = structuredClone(original);
        delete missing.os_info.hw.gpu;
        results.missing = render(missing);
        const unavailable = structuredClone(original);
        delete unavailable.os_info;
        results.unavailable = render(unavailable);
        const different = structuredClone(original);
        different.machine.level = 'rack';
        different.os_info.os.mem = '256 GB';
        different.os_info.hw = {system:{manufacturer:'Example Systems',model:'CPU node <img src="x">'},cpu:{model:'CPU model fixture',sockets:1},dimm:{count:8,types:['DDR5']},ssd:[{name:'sda',model:'Drive fixture'}],nic:['Ethernet controller: NIC fixture'],gpu:[]};
        results.different = render(different);
      } finally { machineDetailCache.host_a = original; }
      return results;
    });
    assert.equal(scenarios.gpu.heading, '系統配置');
    assert.match(scenarios.gpu.gpu, /8 GPUs/);
    assert.doesNotMatch(scenarios.gpu.text, /GPU 加速系統/);
    assert.match(scenarios.empty.gpu, /0 GPUs.*本次回報未列出 GPU/);
    assert.match(scenarios.missing.gpu, /尚未取得.*來源未回報 GPU 清單/);
    assert.doesNotMatch(scenarios.missing.gpu, /0 GPUs/);
    for (const key of ['cpu','memory','storage','network','gpu']) assert.match(scenarios.unavailable[key], /尚未取得/);
    assert.match(scenarios.different.header, /L11/);
    assert.match(scenarios.different.header, /Example Systems/);
    assert.equal(scenarios.different.heading, 'CPU node <img src="x">');
    assert.equal(scenarios.different.unsafeMarkup, false);
    assert.match(scenarios.different.cpu, /1 socket.*CPU model fixture/);
    assert.match(scenarios.different.memory, /256 GB.*8 DIMMs/);
    assert.match(scenarios.different.network, /1 entry.*NIC fixture/);
    assert.match(scenarios.different.storage, /1 drive.*Drive fixture/);
    for (const state of Object.values(scenarios)) {
      assert.equal(state.tabs, 5);
      assert.equal(state.canvases, 13);
      assert.match(state.illustration, /非本機實際外觀/);
    }
    for (const width of [1440,1600,1920]) {
      await page.setViewportSize({width,height:1000});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      assert.equal(overflow, false, 'Unexpected horizontal scroll at '+width);
    }
    assert.deepEqual(errors, []);
    console.log('PASS hardware identity: reported GPU / explicit empty / missing / unavailable / alternative inventory; 5 tabs, 13 canvases; 1440/1600/1920 layouts; zero JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
