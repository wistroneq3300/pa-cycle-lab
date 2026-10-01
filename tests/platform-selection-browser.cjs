const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await page.goto((process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9188')+'/#/projects');
  await page.waitForFunction(()=>machines.length>0);
  await page.evaluate(()=>{const m=machines[0];machineDetailCache[m.name]={machine:m,hardware:{},os:{},fw:[],sensors:[]};_activeMachine=m.name;setView('machine');});
  await page.locator('#pd-tab-tasks').click();
  const entry=page.locator('#pd-panel-tasks').getByRole('button',{name:'Cycle 驗證',exact:true});
  assert.equal(await entry.count(),1);
  assert.equal(await page.locator('#pd-panel-tasks button[onclick^="openChassisCycle"]').count(),1);
  await entry.click();await page.locator('.cw-node').first().waitFor();
  assert.equal(await page.locator('.cw-node').count(),4);
  assert.equal(await page.locator('.cw-node input:checked').count(),0);
  assert(await page.locator('#cw-create').isDisabled());
  await page.locator('.cw-node input').nth(3).check();
  assert.equal(await page.locator('.cw-node input:checked').count(),1);
  assert.match(await page.locator('#cw-count').textContent(),/1 nodes/);
  await page.locator('#cw-visible').click();
  assert.equal(await page.locator('.cw-node input:checked').count(),4);
  await page.locator('.cw-node input').nth(1).uncheck();
  await page.locator('.cw-node input').nth(2).uncheck();
  assert.equal(await page.locator('.cw-node input:checked').count(),2);
  await page.locator('#cw-search').fill('not-in-this-rack');
  await page.locator('#cw-search').fill('chassis-01');
  assert.equal(await page.locator('.cw-node input:checked').count(),2);
  console.log('PASS: one chassis entry; no default selection; single/all/subset and search preserve explicit selection; no job dispatched');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
