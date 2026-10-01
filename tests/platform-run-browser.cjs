const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187';
  const history=await(await page.request.get(base+'/api/cycle/runs')).json();
  const id=history.runs[0].id;
  const job=await(await page.request.get(base+'/api/cycle/runs/'+id)).json();
  job.state='RUNNING';job.stop_requested=false;job.heartbeat=Date.now()/1000;
  let reads=0;
  await page.route('**/api/cycle/runs/'+id,r=>r.fulfill({json:job}));
  await page.route('**/api/projects/*/cycle/jobs/'+id,r=>{reads++;return r.fulfill({json:job});});
  await page.goto(base+'/#/cycle/runs/'+id);
  await page.locator('#cw-progress summary').first().waitFor();
  await page.evaluate(()=>{
   window.savedSummary=document.querySelector('#cw-progress summary');
   window.savedSummary.parentElement.open=true;window.savedSummary.focus();
  });
  await page.waitForTimeout(1800);
  assert(await page.evaluate(()=>window.savedSummary===document.querySelector('#cw-progress summary')),'Polling replaced the keyed node element');
  assert(await page.evaluate(()=>document.activeElement===window.savedSummary),'Polling lost focus');
  assert.equal(await page.locator('#cw-pre-shell').getAttribute('open'),null,'PRE should collapse after start');
  job.state='COMPLETE';await page.waitForTimeout(1800);const finalReads=reads;
  await page.waitForTimeout(1800);assert.equal(reads,finalReads,'Terminal run keeps polling');
  job.state='RECONCILIATION_REQUIRED';
  await page.route('**/reconciliation',r=>r.fulfill({json:{actions:[{action_id:'unknown-action',outcome:'DISPATCH_INTENT'}],reviewed_actions_hash:'review-hash'}}));
  let submitted;
  await page.route('**/reconcile',r=>{submitted=r.request().postDataJSON();return r.fulfill({status:403,json:{detail:'Reconciliation permission required'}});});
  await page.reload();await page.locator('#cw-review-action').click();
  await page.locator('#cw-review-body textarea').fill('Reviewed synthetic evidence only');
  await page.locator('#cw-review-body button').click();
  await page.getByText('Reconciliation permission required',{exact:false}).waitFor();
  assert.equal(submitted.reviewed_actions_hash,'review-hash');
  assert(await page.locator('#cw-reconciliation').isVisible(),'Denied reconciliation hid reserved scope');
  console.log('PASS: stable keyed node DOM, focus, collapsed reviewed PRE and stopped terminal polling');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
