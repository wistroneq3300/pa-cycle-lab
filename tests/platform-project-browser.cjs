const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(2000);
  await page.goto((process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187')+'/#/projects');
  await page.waitForFunction(()=>typeof productLevel==='function' && machines.length>0);
  await page.evaluate(()=>productLevel('rack'));
  const failures=[];
  try{assert.notEqual(await page.locator('#nav .nav-btn').first().getAttribute('data-view'),'cycle');}
  catch(e){failures.push('Navigation: '+e.message);}
  try{
   const link=page.locator('.proj-card-head a[data-cycle-project-id]').first();
   assert.equal(await link.count(),1,'Project header needs a secondary Cycle entry');
   const id=await link.getAttribute('data-cycle-project-id');
   await link.click();await page.locator('#cw-project').waitFor();
   assert.equal(await page.locator('#cw-profile').inputValue(),'neutrino');
   assert.equal(await page.locator('#cw-profile').getAttribute('readonly'),'');
   assert.match(await page.locator('#cw-profile-content').textContent(),/mst_vera_unique_bdf/);
   assert((new URL(page.url())).hash.includes(encodeURIComponent(id)));
   const selected=await page.locator('#cw-project').inputValue();
   await page.reload();await page.locator('#cw-project').waitFor();
   assert.equal(await page.locator('#cw-project').inputValue(),selected);
   await page.route('**/api/cycle/inventory',async r=>{
    const data=await(await r.fetch()).json();
    data.projects[0].targets=data.projects[0].targets.slice(0,4).map((t,i)=>({...t,rack_id:i===1?'rack-b':'rack-a',level:i===2?'system':'rack'}));
    await r.fulfill({json:data});
   });
   await page.reload();await page.locator('#cw-project').waitFor();
   await page.locator('#cw-rack').selectOption('rack-a');
   await page.locator('#cw-none').click();await page.locator('#cw-all').click();
   assert.equal(await page.locator('.cw-node input:checked').count(),2,'Rack selection included another rack or L10');
   await page.goBack();await page.goForward();await page.locator('#cw-project').waitFor();
   assert.equal(await page.locator('#cw-project').inputValue(),selected);
  }catch(e){failures.push('Project route: '+e.message);}
  assert.deepEqual(failures,[]);
  console.log('PASS: secondary project entry, stable project URL, reload and browser history');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
