/* Read-only browser acceptance. Existing synthetic inventory and completed run only. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const out='docs/screenshots/cycle-premium';fs.mkdirSync(out,{recursive:true});
 try{
  const p=await browser.newPage(),base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9188',errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const runs=await(await p.request.get(base+'/api/cycle/runs')).json();
  const run=runs.runs.find(r=>r.state==='COMPLETE');assert(run);
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:width===1366?768:1080});
   await p.goto(base+'/#/cycle/new');await p.locator('.cw-node').first().waitFor();await p.evaluate(t=>applyTheme(t),theme);
   assert.equal(await p.locator('.cw-submit-actions').evaluate(e=>getComputedStyle(e).position),'static','Submit must never cover nodes');
   await p.locator('#cw-search').fill('chassis-01');await p.locator('.cw-node input').first().check();
   assert.match(await p.locator('#cw-review-selection').textContent(),/1 node/);
   await p.locator('#cw-loops').fill('7');assert.match(await p.locator('#cw-review-limits').textContent(),/7/);
   await p.locator('#cw-search').fill('no-such-node');assert.match(await p.locator('#cw-visible-count').textContent(),/0/);
   assert.match(await p.locator('#cw-review-selection').textContent(),/1 node/,'Search must retain selection');
   await p.locator('#cw-search').fill('chassis-01');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await p.screenshot({path:`${out}/create-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
   await p.goto(base+'/#/cycle');await p.locator('#cw-next').waitFor();
   assert(await p.locator('.cw-history-state').count()>0);
   await p.screenshot({path:`${out}/history-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
  }
  await p.goto(base+'/#/cycle/runs/'+run.id);await p.locator('#cw-evidence').waitFor({state:'attached'});
  await p.locator('.cw-artifacts>summary').click();await p.locator('#cw-evidence').click();await p.locator('#cw-files a').first().waitFor();
  const total=await p.locator('#cw-files a').count();assert(total>0);
  await p.locator('#cw-evidence-search').fill('no-such-evidence');assert.equal(await p.locator('#cw-files .cw-artifact-item:visible').count(),0);
  assert.match(await p.locator('#cw-evidence-count').textContent(),/^0/);
  await p.locator('#cw-evidence-search').fill('');assert.equal(await p.locator('#cw-files a').count(),total);
  const node=await p.locator('#cw-evidence-node option').nth(1).getAttribute('value');
  await p.locator('#cw-evidence-node').selectOption(node);
  assert(await p.locator('#cw-files .cw-artifact-group:not([hidden])').count()>0);
  assert(await p.locator('#cw-files .cw-artifact-item:not([hidden])').evaluateAll((items,node)=>items.every(i=>i.querySelector('a').title.startsWith(node+'/')||(node==='Run 報告'&&!i.querySelector('a').title.includes('/'))),node));
  await p.locator('#cw-evidence-search').fill('report');
  await p.locator('.cw-artifacts').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/evidence-filter-dark.png`,animations:'disabled'});
  await p.reload();await p.locator('#cw-run-id').waitFor();
  assert.equal(await p.evaluate(()=>document.documentElement.dataset.theme),'dark','Saved theme must survive reload');
  // Real history route and paging controls, with deterministic read-only page responses.
  const offsets=[];
  await p.route('**/api/cycle/runs?*',r=>{const offset=Number(new URL(r.request().url()).searchParams.get('offset'));offsets.push(offset);return r.fulfill({json:{runs:[{...run,project:offset?'Page two':'Page one'}],has_more:offset===0}});});
  await p.goto(base+'/#/cycle');await p.locator('.cw-history-project').waitFor();
  await p.locator('#cw-next').click();await p.getByRole('link',{name:'Page two'}).waitFor();assert(await p.locator('#cw-next').isDisabled());
  await p.locator('#cw-prev').click();await p.getByRole('link',{name:'Page one'}).waitFor();assert.deepEqual(offsets,[0,25,0]);
  assert.deepEqual(errors,[]);console.log('PASS: desktop/theme wizard, no occlusion, live review, preserved selection, history and evidence filtering; zero dispatch');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
