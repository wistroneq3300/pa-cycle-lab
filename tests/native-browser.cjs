/* Actual native Next routes against an isolated 32 chassis x 4 node service. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187';
 const output=path.resolve('data/native-desktop');fs.mkdirSync(output,{recursive:true});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 try {
  await page.goto(base+'/#/cycle/new');await page.locator('.cw-node').first().waitFor();
  assert.equal(await page.locator('.cw-node').count(),128);
  await page.locator('#cw-all').click();assert.match(await page.locator('#cw-count').innerText(),/32 chassis \/ 128 nodes/);
  await page.locator('#cw-search').fill('chassis-01');assert.equal(await page.locator('.cw-node').count(),4);
  assert.match(await page.locator('#cw-count').innerText(),/128 nodes/);
  await page.locator('#cw-none').click();await page.locator('#cw-visible').click();
  assert.match(await page.locator('#cw-count').innerText(),/1 chassis \/ 4 nodes/);
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:width===1366?768:1080});
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   await page.screenshot({path:path.join(output,`wizard-${width}-${theme}.png`),fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.locator('#cw-create').click();await page.locator('#cw-confirm').waitFor({timeout:60000});
  const id=await page.locator('#cw-run-id').innerText();
  assert.match(id,/^[a-f0-9]{32}$/);await page.locator('#cw-confirm').click();
  await page.waitForFunction(()=>document.querySelector('#cw-run-title')?.textContent.includes('COMPLETE'),{},{timeout:60000});
  const url=base+'/api/projects/Neutrino%20Demo/cycle/jobs/'+id;
  const job=await(await page.request.get(url)).json();assert.equal(job.state,'COMPLETE');
  assert.equal(new Set(job.targets.map(t=>t.chassis_id)).size,1);assert.equal(job.targets.length,4);
  assert.equal(job.nodes.reduce((a,n)=>a+n.valid_cycles,0),8);
  await page.locator('#cw-console-toggle').click();await page.locator('.cycle-console-row').first().waitFor();
  const firstNode=job.targets[0].name;
  await page.locator(`[data-machine="${firstNode}"][aria-pressed]`).click();
  assert.equal(await page.locator(`.cycle-console-row:not([data-machine="${firstNode}"])`).count(),0);
  await page.locator('[data-machine=""][aria-pressed]').click();
  await page.locator('[data-part=errors]').check();
  assert.equal(await page.locator('.cycle-console-row:not([data-level=ERROR]):not([data-level=FAIL])').count(),0);
  await page.locator('[data-part=errors]').uncheck();
  await page.locator('[data-part=search]').fill('command');await page.waitForTimeout(200);
  const all=await page.locator('.cycle-console-row').allTextContents();assert(all.every(t=>t.toLowerCase().includes('command')));
  await page.locator('[data-part=search]').fill('');await page.waitForTimeout(200);
  await page.locator('[data-part=pause]').click();const before=requests.length;await page.waitForTimeout(1700);
  assert(!requests.slice(before).some(u=>u.includes('/events?')));
  await page.locator('[data-part=pause]').click();
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:width===1366?768:1080});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);
   await page.screenshot({path:path.join(output,`run-${width}-${theme}.png`),fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  const download=await(await page.request.get(url+'/events/download')).text();assert(download.includes('COMPLETE'));assert(!download.includes('SYNTHETIC-OS-'));
  await page.reload();await page.locator('#cw-console-toggle').click();await page.locator('.cycle-console-row').first().waitFor();
  assert.equal(await page.locator('#cw-run-id').innerText(),id);
  await page.locator('#cw-console-toggle').click();await page.locator('a[href="#/cycle"]').first().click();
  await page.locator('#cw-next').waitFor();await page.goBack();await page.locator('#cw-run-id').waitFor();
  assert.equal(await page.locator('#cw-run-id').innerText(),id);
  await page.goto(base+'/#/cycle');await page.locator('#cw-next').waitFor();const afterLeave=requests.length;await page.waitForTimeout(1800);
  assert(!requests.slice(afterLeave).some(u=>u.includes('/jobs/'+id)));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({passed:true,job_id:id,targets:128,completed_nodes:4,valid_cycles:8,viewports:[1366,1920],themes:['light','dark'],page_errors:errors},null,2));
  console.log('PASS: native routes, 128-node selection, one chassis/four nodes, PRE, eight valid cycles, console filters/pause/refresh/download, navigation/dispose, desktop themes');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
