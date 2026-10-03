/* Supplemental real-browser assertions against the preview's persisted jobs. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:19487',out='artifacts/validation-console';
 const saved=JSON.parse(fs.readFileSync(out+'/results.json')),browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1920,height:1080},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage();
 try{
  await page.goto(base+'/#/cycle/runs/'+saved.campaigns.at(-1));await page.locator('#cw-console-toggle').click();
  await page.waitForFunction(()=>document.querySelector('.lc-fleet-counts')?.textContent.includes('128 NODES'));
  const semantics=await page.evaluate(()=>{
   const c=Object.create(CycleConsole.prototype);c.job={config:{cycle_mode:'power_cycle'}};
   const input=[{sequence:1,machine_id:'n1',event_type:'COMMAND_DISPATCHING',level:'CMD'},
    {sequence:2,machine_id:'n1',event_type:'RESPONSE_LOST',level:'WARN',message:'Response unknown'},
    {sequence:3,machine_id:'n1',event_type:'COLLECTION_FINISHED',level:'FAIL',message:'Collection failed'}];
   const before=JSON.stringify(input),output=c.fold(input);return {before,after:JSON.stringify(input),output};
  });
  assert.equal(semantics.before,semantics.after);assert(semantics.output[0].message.startsWith('Preparing'));
  assert.equal(semantics.output[1].level,'WARN');assert.equal(semantics.output[2].level,'FAIL');
  assert(await page.evaluate(()=>{const f=new CycleFleet(document.createElement('div'),()=>{});f.observe([{machine_id:'n1',loop:1,sequence:1,event_type:'BOOT_ID_CHANGED'}]);return !f.observed.get('n1').done.has('RECOVERY');}));
  const fleet=page.locator('.lc-fleet'),search=fleet.locator('[data-fleet-focus=search]');
  await search.fill('N3');await page.waitForTimeout(1800);assert(await search.evaluate(e=>e===document.activeElement));await search.fill('');
  const log=page.locator('[data-part=log]');await log.evaluate(e=>e.scrollTop=0);
  const job=await(await page.request.get(base+'/api/projects/Neutrino%20Demo/cycle/jobs/'+saved.campaigns.at(-1))).json();
  const evidence=await page.request.get(base+'/api/projects/'+encodeURIComponent(job.project)+'/cycle/jobs/'+job.id+'/files/node/evidence.log');assert(evidence.ok());
  await page.route('**/cycle/jobs/*/events?*',route=>route.abort());
  await page.waitForFunction(()=>document.querySelector('[data-part=error]')?.textContent.includes('連線中斷'));
  await page.unroute('**/cycle/jobs/*/events?*');await page.waitForFunction(()=>document.querySelector('[data-part=error]')?.hidden);
  await page.locator('[data-part=full]').click();await page.locator('[data-part=pause]').click();
  const frozen=await log.innerText();await page.locator('#cw-console-toggle').click();await page.locator('#cw-console-toggle').click();
  await page.request.post(base+'/__validation/events',{data:{job_id:job.id,count:1}});
  await page.waitForFunction(()=>!document.querySelector('[data-part=latest]').hidden);
  assert.equal(await log.innerText(),frozen);await page.locator('[data-part=pause]').click();await page.locator('[data-part=density]').click();
  await fleet.locator('.lc-matrix>summary').click();await fleet.locator('.lc-matrix>div>details>summary').first().click();
  await page.locator('.live-console').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/cycle-128-matrix.png'});
  await page.goto(base);await page.waitForFunction(()=>typeof openMachine==='function');await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-tab-telemetry').click();await page.locator('.tp-workspace [data-console]').click();
  const dialog=page.locator('dialog.tp-console');await page.waitForFunction(()=>document.querySelector('.tp-log')?.textContent.includes('Telemetry READY'));
  await dialog.locator('[data-search]').fill('Identity');await dialog.locator('[data-copy]').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert(copied.includes('Identity'));assert(!copied.includes('apt-get'));
  await dialog.locator('[data-search]').fill('');await dialog.locator('[data-pause]').click();assert.equal(await dialog.locator('[data-pause]').getAttribute('aria-pressed'),'true');await dialog.locator('[data-pause]').click();
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await dialog.evaluate(e=>getComputedStyle(e).animationName),'none');
  fs.writeFileSync(out+'/contracts.json',JSON.stringify({result:'PASS',checks:['Summary keeps severity/ambiguity and leaves original events immutable','Boot ID alone does not complete recovery','Fleet search focus survives polling','Evidence path downloads','Event connection loss reconnects automatically','Paused viewer close/reopen continues fetching without unfreezing rows','Lazy matrix expanded capture','Telemetry filtered copy and pause','Reduced motion modal']},null,2));
 }finally{await context.close();await browser.close();}
 console.log('Validation Console contracts PASS');
})().catch(e=>{console.error(e);process.exit(1)});
