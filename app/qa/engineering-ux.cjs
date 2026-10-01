// Fixture-only regression; no real equipment or test commands are executed.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const scope={window:{}};vm.createContext(scope);vm.runInContext(fs.readFileSync('static/js/engineering-ux.js','utf8'),scope);
 const h=scope.window.PAEngineering;
 assert.equal(h.connectivity([{os_ip:'sample',os_alive:true},{os_ip:'sample',os_alive:null},{mgx_type:'blanking',os_ip:'sample'}],'os').rate,50);
 assert.equal(h.connectivity([],'bmc').rate,null);
 assert.equal(h.sensorRow('CPU Temp | 43 degrees C | ok').state,'ok');
 assert.equal(h.sensorRow('CPU Temp | 93 degrees C | ucr').state,'critical');
 assert.equal(h.sensorRow('Fan | na | ns').state,'unknown');
 assert.equal(h.finite(null),false);assert.equal(h.finite(0),true);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const results=['Pure helpers: independent denominators, unknown values, sensor severity'];
 try{
  await page.goto((process.env.PA_PREVIEW_URL||'http://127.0.0.1:8769')+'/#/machine/host_a');
  await page.locator('[data-pd-tab="hardware"]').click();
  assert.equal(await page.locator('.eng-inventory-nav button').count(),5);
  assert.equal(await page.locator('.eng-section').count(),5);
  for(const theme of ['light','dark']){
   await page.evaluate(t=>applyTheme(t),theme);
   assert.ok(await page.locator('#eng-hw-network').innerText());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`qa/artifacts/engineering-hardware-${theme}.png`,fullPage:true});
  }
  results.push('Hardware: five categories, both themes, no document overflow');
  await page.locator('[data-pd-tab="sensors"]').click();
  await page.locator('#eng-sensor-search').fill('no-such-sensor');
  assert.equal(await page.locator('.sdr-scroll tbody tr:visible').count(),0);
  await page.locator('#eng-sensor-search').fill('');
  assert.ok(await page.locator('.sdr-scroll tbody tr:visible').count()>0);
  assert.equal(await page.locator('.ew-analysis #sensor-ai').count(),1);
  results.push('Sensors: structured rows, filtering, separate analysis');
  await page.evaluate(()=>openAssignTask('host_a'));
  await page.locator('.assign-sheet-card').first().click();
  const submit=page.locator('#rm-dialog-foot .primary');assert.equal(await submit.isDisabled(),true);
  await page.locator('.eng-case-open').first().click();
  assert.ok(await page.locator('#eng-case-detail pre').count()>=5);
  await page.locator('.eng-case-row input').first().check();assert.equal(await submit.isEnabled(),true);
  await page.screenshot({path:'qa/artifacts/engineering-case-library.png'});
  results.push('Case inspector: original commands visible, zero selection disabled, selection enables generation');
  await page.evaluate(()=>{closeDialog();productLevel('system');});
  await page.locator('[onclick="engDensity()"]').click();
  assert.equal(await page.locator('html').getAttribute('data-density'),'compact');
  await page.locator('.eng-list-tools select').selectOption('os-offline');
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#proj-sort-list tbody tr')].filter(r=>r.offsetHeight).every(r=>{const m=machines.find(m=>m.name===r.querySelector('.mach-link b')?.textContent);return m&&m.os_alive===false;})));
  results.push('L10 compact density and offline filter');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>{const n=document.createElement('div');n.className='eng-highlight';document.body.append(n);const a=getComputedStyle(n).animationName;n.remove();return a;}),'none');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('qa/artifacts/engineering-ux.json',JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
