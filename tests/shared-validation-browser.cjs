/* Production frontend -> isolated real ASGI/service/DB -> fake device transport. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:19483';
const out=path.resolve('artifacts/shared-validation/acceptance');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let ctx,page;const results=[],errors=[];
 async function begin(name){
  ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:path.join(out,'videos'),size:{width:1920,height:1080}},reducedMotion:'reduce'});
  await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
  await ctx.addInitScript(()=>localStorage.setItem('pa_theme','light'));
  page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#/dashboard');await page.waitForFunction(()=>typeof openMachine==='function');
  await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-inspection [data-status]').waitFor();
  await page.locator('#pd-inspection').scrollIntoViewIfNeeded();await page.waitForTimeout(800);
 }
 async function end(name){
  await ctx.tracing.stop({path:path.join(out,name+'.zip')});const video=page.video();await ctx.close();await video.saveAs(path.join(out,name+'.webm'));
 }
 async function post(url,body={}){const r=await page.request.post(base+url,{data:body});assert(r.ok(),await r.text());return r.json();}
 async function state(){return (await page.request.get(base+'/__acceptance/results')).json();}
 async function waitState(predicate,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){const data=await state();if(predicate(data))return data;await page.waitForTimeout(300);}throw new Error('Backend wait timed out: '+JSON.stringify((await state()).inspection));}
 async function refresh(){await page.evaluate(()=>SystemInspection.mount('chassis-01'));await page.waitForTimeout(400);}
 async function run(){
  await waitState(s=>!s.inspection.running);
  const before=(await state()).inspection.last_completed_at;
  await refresh();const request=page.waitForResponse(r=>r.url().endsWith('/inspection/run')&&r.request().method()==='POST');
  await page.locator('[data-run]').click();const accepted=await(await request).json();assert.equal(accepted.state,'ACCEPTED');
  await waitState(s=>!s.inspection.running&&s.inspection.last_completed_at&&s.inspection.last_completed_at!==before);
  await refresh();await page.waitForTimeout(800);
 }
 async function showIssues(){if(await page.locator('[data-issues]').isHidden())await page.locator('#pd-inspection [data-view]').click();else await page.locator('#pd-inspection [data-reload]').click();}
 async function cycleRun(capture){
  await page.goto(base+'/#/cycle/new');await page.locator('.cw-node').first().waitFor({timeout:20000});
  await page.locator('#cw-visible').click();await page.locator('#cw-limit-kind').selectOption('loops');await page.locator('#cw-limit-value').fill('1');
  if(capture)await page.screenshot({path:path.join(out,'cycle-create.png'),fullPage:false});
  await page.locator('#cw-create').click();await page.locator('#cw-confirm').waitFor({timeout:90000});
  const id=page.url().split('/').at(-1);
  if(capture)await page.screenshot({path:path.join(out,'cycle-pre.png'),fullPage:false});await page.waitForTimeout(1200);
  await page.locator('#cw-confirm').click();
  const result=await waitState(s=>s.cycle_runs.some(j=>j.id===id&&j.state==='COMPLETE'),120000);
  return result.cycle_runs.find(j=>j.id===id);
 }
 const event=(id)=>({__CURSOR:'cursor-'+id,__REALTIME_TIMESTAMP:String(1700000000000000+id*1000000),_BOOT_ID:'00000000-0000-0000-0000-000000000001',MESSAGE:'NVRM: Xid (PCI:0000:01:00): 79, GPU has fallen off the bus.'});
 try{
  await begin('A');
  assert.equal((await state()).cycle_runs.length,0);
  await page.locator('[data-settings]').click();await page.locator('[name=enabled]').check();await page.locator('[name=duration_seconds]').fill('0');await page.locator('[name=ai_enabled]').check();
  await page.waitForTimeout(1200);await page.locator('[data-config] [type=submit]').click();
  await post('/__acceptance/sample',{cpu:99});await run();await showIssues();
  let data=await state();assert.equal(data.inspection.summary.fail,0);assert(data.inspection.summary.warning>0);
  await page.screenshot({path:path.join(out,'warning-1920-light.png'),fullPage:false});await page.waitForTimeout(1500);
  await post('/__acceptance/fixture',{journal:[event(1)],raw:{sensor:'CPU Temp | 99 | degrees C | cr\n'}});
  await run();await showIssues();data=await state();assert(data.inspection.summary.fail>=8);
  const kernel=data.issues.filter(i=>i.source==='Kernel');assert.equal(kernel.length,4);assert(kernel.every(i=>i.occurrences===1));
  await page.locator('.pd-inspection-issue').filter({hasText:'核心日誌硬體錯誤'}).first().locator('summary').click();
  await page.getByRole('button',{name:'查看原始證據',exact:true}).first().click();await page.waitForTimeout(1500);
  await page.screenshot({path:path.join(out,'fail-evidence-1920-light.png'),fullPage:false});
  await run();data=await state();assert(data.issues.filter(i=>i.source==='Kernel').every(i=>i.occurrences===1));
  await post('/__acceptance/fixture',{journal:[event(1),event(2)],raw:{sensor:'CPU Temp | 99 | degrees C | cr\n'}});
  await run();await showIssues();data=await state();assert(data.issues.filter(i=>i.source==='Kernel').every(i=>i.occurrences===2));
  const problem=page.locator('.pd-inspection-issue').first();await problem.locator('summary').click();await problem.getByRole('button',{name:'已知悉',exact:true}).click();
  await page.locator('.pd-inspection-issue').first().locator('summary').click();await page.getByRole('button',{name:'標記已知問題',exact:true}).first().click();
  await page.waitForTimeout(1800);await showIssues();assert((await state()).issues.some(i=>i.analysis?.state==='UNAVAILABLE'));
  results.push({case:'A',passed:true,independent:true,no_cycle_runs:true});await end('A-independent-inspection');

  await begin('B');
  await post('/__acceptance/fixture',{boot_id:'00000000-0000-0000-0000-000000000002',failed:['MST','sensor'],journal:[event(1),event(2)]});
  await run();let s=await state();assert(s.inspection.coverage.some(c=>c.state==='WAITING_READY'));
  await page.locator('.pd-inspection-coverage summary').first().click();await page.waitForTimeout(1800);await page.screenshot({path:path.join(out,'waiting-ready.png'),fullPage:false});
  await run();s=await state();assert(s.inspection.coverage.some(c=>c.source==='Sensor'&&c.state==='FAILED'));
  await post('/__acceptance/fixture',{boot_id:'00000000-0000-0000-0000-000000000002',journal:[event(1),event(2)]});
  await run();await run();s=await state();assert(s.issues.some(i=>i.source==='Sensor'&&i.status==='RECOVERED'));
  await showIssues();await page.screenshot({path:path.join(out,'recovered.png'),fullPage:false});await page.waitForTimeout(1500);
  await page.locator('[data-settings]').click();await page.locator('[name=enabled]').uncheck();await page.locator('[data-config] [type=submit]').click();
  await post('/__acceptance/clock',{seconds:4000});await refresh();
  assert((await state()).inspection.coverage.some(c=>c.state==='STALE'));await page.screenshot({path:path.join(out,'stale.png'),fullPage:false});
  results.push({case:'B',passed:true,time_acceleration_seconds:4000});await end('B-boot-recovery');

  await begin('C');
  await post('/__acceptance/fixture',{});await run();const old=(await state()).inspection.checker_hash;
  const oldJob=await cycleRun(false);assert(oldJob.profile_snapshot.checker.includes('DIMM_EXPECTED=16'));
  await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-inspection').waitFor();
  await post('/__acceptance/fixture',{dimm_expected:20});await run();const latest=(await state());assert.notEqual(latest.inspection.checker_hash,old);assert(latest.issues.some(i=>i.rule==='DIMM_COUNT'));
  const job=await cycleRun(true);
  await page.locator('#cw-console-toggle').click();await page.locator('.cycle-console-row').first().waitFor();
  await page.screenshot({path:path.join(out,'cycle-console.png'),fullPage:false});await page.waitForTimeout(1800);
  data=await state();assert.equal(job.state,'COMPLETE');assert(job.profile_snapshot.checker.includes('DIMM_EXPECTED=20'));
  assert.equal(require('node:crypto').createHash('sha256').update(job.profile_snapshot.checker).digest('hex'),latest.inspection.checker_hash);
  assert.deepEqual(data.cycle_runs.find(j=>j.id===oldJob.id).profile_snapshot,oldJob.profile_snapshot);
  await page.locator('.cw-artifacts > summary').click();await page.locator('#cw-evidence').click();
  const report=page.locator('#cw-files a[href$=".html"]').first();await report.waitFor();await page.goto(new URL(await report.getAttribute('href'),base).href);await page.waitForTimeout(1800);
  await page.screenshot({path:path.join(out,'cycle-report.png'),fullPage:false});
  results.push({case:'C',passed:true,old_run_id:oldJob.id,old_checker_preserved:true,run_id:job.id,checker_hash:latest.inspection.checker_hash});await end('C-shared-rules-cycle');
  await begin('D');
  const beforeIdentity=await state();const savedRuns=JSON.stringify(beforeIdentity.cycle_runs);
  await post('/__acceptance/fixture',{hostname:'renamed.lab.example',bmc_hostname:'controller.lab.example'});
  await run();await refresh();
  await page.getByText('節點名稱與身分紀錄',{exact:true}).click();
  await page.locator('[data-identity]').evaluate(el=>el.closest('details').scrollIntoView({block:'start'}));await page.waitForTimeout(1800);
  let identityState=await state();assert(identityState.inspection.nodes.every(n=>n.os_hostname==='renamed.lab.example'));
  const nameChanges=identityState.inspection.identity_history.filter(e=>e.kind.endsWith('HOSTNAME_CHANGED'));
  assert.equal(nameChanges.length,8);assert(nameChanges.every(e=>e.severity==='INFO'));
  await page.screenshot({path:path.join(out,'identity-auto-sync.png'),fullPage:false});
  await run();identityState=await state();assert.equal(identityState.inspection.identity_history.filter(e=>e.kind.endsWith('HOSTNAME_CHANGED')).length,8);
  assert.equal(JSON.stringify(identityState.cycle_runs),savedRuns);
  await post('/__acceptance/fixture',{failed:['identity','redfish']});await run();await refresh();
  assert((await state()).inspection.nodes.every(n=>n.os_hostname==='renamed.lab.example'));
  results.push({case:'D',passed:true,stable_node_identity:true,history_deduplicated:true,old_cycle_unchanged:true});await end('D-identity-auto-sync');
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   ctx=await browser.newContext({viewport:{width,height:width===1366?768:1080}});page=await ctx.newPage();
   await page.addInitScript(t=>localStorage.setItem('pa_theme',t),theme);await page.goto(base+'/#/dashboard');await page.waitForFunction(()=>typeof openMachine==='function');await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-inspection').waitFor();await page.locator('#pd-inspection').scrollIntoViewIfNeeded();await page.waitForTimeout(1000);
   await page.screenshot({path:path.join(out,`inspection-${width}-${theme}.png`),fullPage:false});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await ctx.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,offline:true,backend:base},null,2));assert.deepEqual(errors,[]);
 }catch(e){if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png'),fullPage:false}).catch(()=>{});throw e;
 }finally{if(ctx)await ctx.close().catch(()=>{});await browser.close();fs.writeFileSync(path.join(out,'partial-results.json'),JSON.stringify({results,errors},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
