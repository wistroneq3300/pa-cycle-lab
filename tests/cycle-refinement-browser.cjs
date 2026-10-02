/* Presentation regression against an isolated synthetic web instance. No dispatch. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 const output=path.resolve('docs/screenshots/cycle-refinement');fs.mkdirSync(output,{recursive:true});
 try{
  const p=await b.newPage(),base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9188';
  assert.equal((await(await p.request.get(base+'/api/cycle/capabilities')).json()).mode,'synthetic');
  const runs=await(await p.request.get(base+'/api/cycle/runs')).json();
  const run=runs.runs.find(r=>r.state==='COMPLETE');assert(run,'Needs a completed synthetic run');
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:width===1366?768:1080});
   await p.goto(base+'/#/cycle/new');await p.locator('.cw-node').first().waitFor();
   await p.evaluate(t=>applyTheme(t),theme);
   await p.locator('#cw-search').fill('chassis-01');await p.locator('#cw-visible').click();
   await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(300);
   assert.equal(await p.locator('.cw-node input:checked').count(),4);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:path.join(output,`wizard-${width}-${theme}.png`),fullPage:true,animations:'disabled'});
   await p.goto(base+'/#/cycle/runs/'+run.id);await p.locator('#cw-progress summary').first().waitFor();
   await p.evaluate(t=>applyTheme(t),theme);
   await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(300);
   await p.screenshot({path:path.join(output,`run-${width}-${theme}.png`),fullPage:true,animations:'disabled'});
   await p.locator('#cw-console-toggle').click();await p.locator('.cycle-console-row').first().waitFor();
   await p.locator('#cw-console').scrollIntoViewIfNeeded();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:path.join(output,`console-${width}-${theme}.png`),animations:'disabled'});
  }
  await p.locator('[data-part=search]').fill('no-such-event-refinement-fixture');await p.waitForTimeout(200);
  assert.equal(await p.locator('.cycle-console-row').count(),0);
  assert((await p.locator('#cw-console').innerText()).includes('沒有'));
  await p.locator('[data-part=clear-filters]').click();
  assert.equal(await p.locator('[data-part=search]').inputValue(),'');
  assert(await p.locator('.cycle-console-row').count()>0);
  assert.equal(await p.locator('.cycle-console-row').first().getAttribute('role'),'group');
  assert.equal(await p.locator('.cycle-console-row').first().locator('.cw-sr-only').count(),3);
  await p.locator('.cw-artifacts>summary').click();await p.locator('#cw-evidence').click();await p.locator('#cw-files a').first().waitFor();
  const job=await(await p.request.get(base+'/api/cycle/runs/'+run.id)).json();
  const api=base+'/api/projects/'+encodeURIComponent(job.project)+'/cycle/jobs/'+run.id;
  const manifest=await(await p.request.get(api+'/artifacts')).json();
  assert.equal(await p.locator('#cw-files a').count(),manifest.files.length,'Grouping must retain every artifact');
  assert(await p.locator('#cw-files details').count()>0,'Evidence should have disclosure groups');
  await p.locator('#cw-files').scrollIntoViewIfNeeded();
  await p.screenshot({path:path.join(output,'evidence-1920-dark.png'),animations:'disabled'});
  const fixture=structuredClone(job);fixture.state='RUNNING';fixture.heartbeat=Date.now()/1000;fixture.stop_requested=false;
  for(const node of fixture.nodes)node.stage='WAIT_RECOVERY';
  await p.route('**/api/cycle/runs/'+run.id,r=>r.fulfill({json:fixture}));
  await p.route('**/api/projects/*/cycle/jobs/'+run.id,r=>r.fulfill({json:fixture}));
  await p.reload();await p.locator('#cw-progress summary').first().waitFor();
  await p.locator('#cw-console-toggle').click();await p.locator('.cycle-console-row').first().waitFor();
  assert.equal(await p.locator('#cw-console').getAttribute('data-view'),'live');
  assert(await p.locator('#cycle-workspace').evaluate(e=>e.getAnimations({subtree:true}).some(a=>a.playState==='running')),'Active state should expose authored motion');
  await p.locator('#cw-console').scrollIntoViewIfNeeded();
  await p.screenshot({path:path.join(output,'running-console-synthetic-fixture.png'),animations:'disabled'});
  await p.emulateMedia({reducedMotion:'reduce'});
  const animations=await p.locator('#cycle-workspace').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length);
  assert.equal(animations,0,'Reduced motion must stop status animation');
  assert.deepEqual(errors,[]);
  console.log('PASS: four desktop/theme combinations, readable no-match state, all artifact links retained, reduced motion, zero JS errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

