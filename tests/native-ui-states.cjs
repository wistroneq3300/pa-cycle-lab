const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187';
  const out=path.resolve('data/native-desktop');const id=JSON.parse(fs.readFileSync(path.join(out,'browser-result.json'))).job_id;
  for(const surface of ['wizard','run'])for(const width of [1366,1920])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:width===1366?768:1080});
   await page.goto(base+'/#/cycle/'+(surface==='wizard'?'new':'runs/'+id));
   if(surface==='wizard'){
    await page.locator('.cw-node').first().waitFor();await page.locator('#cw-search').fill('chassis-01');await page.locator('#cw-visible').click();
   }else{
    await page.locator('#cw-run-id').waitFor();if(await page.locator('#cw-console').isHidden())await page.locator('#cw-console-toggle').click();await page.locator('.cycle-console-row').first().waitFor();
   }
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.scrollTo(0,0);},theme);await page.waitForTimeout(200);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,`${surface}-${width}-${theme}.png`),fullPage:true,animations:'disabled'});
  }
  await page.setViewportSize({width:1366,height:768});
  await page.route('**/api/cycle/inventory',async route=>{
   const r=await route.fetch(),data=await r.json();
   data.projects[0].targets.forEach(t=>{t.display_name+=' · Long engineering asset identity / hardware serial pending';t.reasons=['Physical slot mapping requires confirmation'];});
   await route.fulfill({json:data});
  });
  await page.goto(base+'/#/cycle/new');await page.locator('.cw-node').first().waitFor();
  await page.locator('#cw-visible').click();assert.match(await page.locator('#cw-count').innerText(),/128 個目標有缺失/);
  await page.screenshot({path:path.join(out,'blocked-long-names.png'),fullPage:true,animations:'disabled'});
  await page.locator('#cw-search').fill('no-matching-target');assert.equal(await page.locator('.cw-node').count(),0);
  assert.match(await page.locator('#cw-count').innerText(),/128 個節點/);
  await page.screenshot({path:path.join(out,'empty-filter.png'),fullPage:true,animations:'disabled'});
  await page.unroute('**/api/cycle/inventory');
  await page.route('**/api/cycle/runs?*',route=>route.fulfill({status:503,json:{detail:'SYNTHETIC error-state fixture: service unavailable'}}));
  await page.goto(base+'/#/cycle');await page.locator('#cw-error').waitFor({state:'visible'});
  assert(!await page.getByText('載入 Cycle 工作區…',{exact:true}).count());await page.locator('#cw-retry').waitFor();
  await page.screenshot({path:path.join(out,'service-error.png'),fullPage:true,animations:'disabled'});
  await page.unroute('**/api/cycle/runs?*');await page.locator('#cw-retry').click();await page.locator('#cw-next').waitFor();assert(await page.locator('#cw-error').isHidden());
  await page.goto(base+'/#/cycle/runs/'+id);await page.locator('#cw-progress summary').first().waitFor();
  const summary=page.locator('#cw-progress summary').first();await summary.focus();const identity=await summary.evaluate(e=>e.parentElement.dataset.node);await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>document.activeElement.parentElement.dataset.node),identity);
  console.log('PASS: desktop captures, long names, blocked/empty/error states, no horizontal overflow');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
