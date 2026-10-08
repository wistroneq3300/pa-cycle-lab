/* Production UI -> isolated real ASGI/SQLite; only hardware/monitor IO is fake. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:19487';
const out=path.resolve('artifacts/validation-console');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:path.join(out,'videos'),size:{width:1920,height:1080}},permissions:['clipboard-read','clipboard-write']});
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});const page=await ctx.newPage(),errors=[],results=[],performance=[];
 page.on('pageerror',e=>errors.push(e.message));
 const post=async(url,data)=>{const r=await page.request.post(base+url,{data});assert(r.ok(),await r.text());return r.json();};
 const capture=async(name)=>{await page.screenshot({path:path.join(out,name+'.png')});};
 async function themes(prefix){for(const [w,h] of [[1920,1080],[1366,768]])for(const theme of ['light','dark']){await page.setViewportSize({width:w,height:h});await page.evaluate(t=>applyTheme(t),theme);await page.waitForTimeout(180);await capture(`${prefix}-${w}-${theme}`);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow');}}
 const tp=page.locator('.tp-workspace'),dialog=page.locator('dialog.tp-console');
 async function openSystem(){await page.goto(base);await page.waitForFunction(()=>typeof openMachine==='function');await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-tab-telemetry').click();await tp.locator('[data-enable]').waitFor({state:'visible'});}
 async function state(s){await page.waitForFunction(s=>document.querySelector('.tp-workspace [data-state]')?.textContent===s,s,{timeout:25000});}
 try{
  await openSystem();await state('NOT_CONFIGURED');await capture('telemetry-not-configured');
  await tp.locator('[data-enable]').click();await dialog.waitFor({state:'visible'});assert(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
  await page.keyboard.press('Escape');assert(!(await dialog.isVisible()));assert.equal(await tp.locator('[data-node]').evaluate(e=>e===document.activeElement),true);
  await state('READY');let initial=await(await page.request.get(base+'/__telemetry/results')).json();const job=initial.nodes[0].job.job_id;
  await tp.locator('[data-console]').click();await page.waitForFunction(()=>document.querySelector('.tp-log').textContent.includes('Telemetry READY'));
  assert.equal(await dialog.locator('.tp-pipeline [data-state=PASS]').count(),6);
  await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
  await themes('telemetry-ready');
  assert(await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  await dialog.locator('[data-view]').click();assert(!(await dialog.isVisible()));assert.equal(await page.locator('.tp-legacy').getAttribute('open'),null);assert(await tp.locator('iframe').isVisible());
  assert((await tp.locator('.tp-dashboard').innerText()).includes('Data Pipeline READY'));assert.equal(initial.nodes[0].job.job_id,job);
  results.push('Telemetry modal focus/ESC/viewer close/reopen continuity, six-stage READY, legacy disclosure, iframe separate from data READY');
  // Existing exporter is preserved, independent per-node target.
  const n2=await post('/__telemetry/fixture',{index:1,mode:'healthy'});await tp.locator('[data-node]').selectOption(n2.node_id);await tp.locator('[data-enable]').click();await state('READY');await dialog.locator('[data-close]').click();
  // Prometheus failure: retry sees the already-installed exporter.
  const n3=await post('/__telemetry/fixture',{index:2,mode:'degraded'});await tp.locator('[data-node]').selectOption(n3.node_id);await tp.locator('[data-enable]').click();await state('DEGRADED');
  assert.equal(await dialog.locator('.tp-pipeline [data-state=FAIL]').innerText(),'Prometheus');await capture('telemetry-prometheus-failure');
  await post('/__telemetry/fixture',{index:2,mode:'healthy'});await dialog.locator('[data-retry]').click();await page.evaluate(()=>openMachine('chassis-01'));await state('READY');await dialog.waitFor({state:'visible'});await dialog.locator('[data-close]').click();
  let backend=await(await page.request.get(base+'/__telemetry/results')).json();
  assert.equal(backend.calls.filter(c=>c[0]==='ssh'&&c[1]===n2.node_id&&c[2].includes('apt-get')).length,0);
  assert.equal(backend.calls.filter(c=>c[0]==='ssh'&&c[1]===n3.node_id&&c[2].includes('apt-get')).length,1);
  results.push('Existing exporter no install; Prometheus failure pipeline; retry no reinstall');
  const n4=await post('/__telemetry/fixture',{index:3,mode:'identity_mismatch'});await tp.locator('[data-node]').selectOption(n4.node_id);await tp.locator('[data-enable]').click();await page.waitForFunction(()=>document.querySelector('.tp-outcome')?.textContent.includes('IDENTITY_REQUIRES_CONFIRMATION'));
  assert((await dialog.innerText()).includes('IDENTITY_REQUIRES_CONFIRMATION'));await capture('telemetry-identity-mismatch');await dialog.locator('[data-close]').click();
  backend=await(await page.request.get(base+'/__telemetry/results')).json();assert.equal(backend.calls.filter(c=>c[0]==='ssh'&&c[1]===n4.node_id&&c[2].includes('apt-get')).length,0);
  results.push('Canonical binding changed during identity read: stopped before installation');
  // Cycle fleet scenarios backed by the actual event DB and read-only summary.
  const campaigns=[];
  for(const count of [1,4,32,128]){
   const campaign=await post('/__validation/campaign',{count});campaigns.push(campaign);await page.goto(base+'/#/cycle/runs/'+campaign.id);await page.locator('#cw-console-toggle').click();
   await page.waitForFunction(()=>document.querySelectorAll('.cycle-console-row').length>0);const console=page.locator('.live-console');await console.scrollIntoViewIfNeeded();
   assert.equal(await console.locator('.lc-fleet-counts strong').innerText(),`${count} ${count===1?'NODE':'NODES'}`);
   if(count===1){assert.equal(await console.locator('.lc-fleet-controls').count(),0);assert.equal(await console.locator('.lc-matrix').count(),0);}
   if(count===4){await console.locator('.lc-fleet-controls [data-machine]').first().click();assert.equal(await console.locator('.cycle-console-row').evaluateAll(rows=>new Set(rows.map(r=>r.dataset.machine)).size),1);await console.getByRole('button',{name:'Clear node filter',exact:true}).click();}
   if(count>8){assert.equal(await console.locator('.lc-matrix [data-machine]').count(),0);assert((await console.locator('.lc-attention summary').innerText()).includes('4'));
    const before=Date.now();await console.locator('.lc-fleet-controls').getByRole('button',{name:'FAIL 2',exact:true}).click();await page.waitForTimeout(80);performance.push({nodes:count,filter_ms:Date.now()-before});
    assert(await console.locator('.cycle-console-row').count()>0);assert.equal(await console.locator('.cycle-console-row').evaluateAll(rows=>new Set(rows.map(r=>r.dataset.machine)).size),2);
    await console.locator('.lc-matrix>summary').click();await console.locator('.lc-matrix>div>details>summary').first().click();assert(await console.locator('.lc-matrix [data-machine]').count()<=4);
    await console.locator('.lc-fleet-controls').getByRole('button',{name:`ALL ${count}`,exact:true}).click();
    await console.locator('[data-fleet-focus=search]').fill(campaign.targets[0].node_id);assert((await console.locator('.lc-matrix>summary').innerText()).includes('1 targets'));
    await console.locator('[data-fleet-focus=search]').fill('');
    await console.locator('.lc-matrix>summary').click();
   }
   if(count===128){assert((await console.locator('.lc-fleet-counts').innerText()).includes('Health PASS 124'));assert((await console.locator('.lc-fleet-counts').innerText()).includes('Recovery 10'));}
   if(count===128||count===1)await themes('cycle-'+count);else await capture('cycle-'+count);
   const summary=await(await page.request.get(base+'/api/projects/'+encodeURIComponent(campaign.project)+'/cycle/jobs/'+campaign.id+'/console-summary')).json();assert.equal(summary.nodes.length,count);
   assert.equal(summary.nodes.filter(n=>n.completed.includes('RECOVERY')).length,count===1?1:count===4?3:count-10);
  }
  const large=campaigns.at(-1),console=page.locator('.live-console');
  await post('/__validation/events',{job_id:large.id,count:2400});await console.locator('[data-part=full]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.cycle-console-row').length===2000,null,{timeout:30000});
  await console.locator('[data-part=log]').evaluate(e=>e.scrollTop=0);await page.waitForTimeout(150);
  const oldTop=await console.locator('[data-part=log]').evaluate(e=>e.scrollTop);await post('/__validation/events',{job_id:large.id,count:30});await page.waitForTimeout(1800);
  assert(await console.locator('[data-part=latest]').isVisible());assert(await console.locator('[data-part=log]').evaluate(e=>e.scrollTop)<100);
  await console.locator('[data-part=pause]').click();const frozen=await console.locator('[data-part=log]').innerText();await post('/__validation/events',{job_id:large.id,count:10});await page.waitForTimeout(1800);assert.equal(await console.locator('[data-part=log]').innerText(),frozen);
  await console.locator('[data-part=pause]').click();await console.locator('[data-part=latest]').click();
  await console.locator('[data-part=density]').click();assert.equal(await console.locator('[data-part=density]').getAttribute('aria-pressed'),'true');await console.locator('[data-part=full]').click();
  await console.locator('[data-part=history]').click();await page.waitForFunction(()=>document.querySelector('[data-part=status]').textContent.includes('歷史視窗'));await console.locator('[data-part=older]').click();await console.locator('[data-part=live]').click();
  const log=await page.request.get(base+await console.locator('[data-part=download]').getAttribute('href'));assert(log.ok());assert((await log.text()).includes('Synthetic throughput'));
  results.push('Cycle 1/4/32/128 canonical fleet, typed summary, attention filters, lazy matrix, 2000 rows, pause/resume/follow/history/download');
  const healthy=await post('/__validation/campaign',{count:128,healthy:true});await page.goto(base+'/#/cycle/runs/'+healthy.id);await page.locator('#cw-console-toggle').click();
  await page.waitForFunction(()=>document.querySelector('.lc-fleet-counts')?.textContent.includes('Health PASS 128'));assert((await page.locator('.lc-attention summary').innerText()).includes('0'));await capture('cycle-128-healthy');
  results.push('128 all-healthy nodes: completion/health distinct from active recovery, no attention findings');
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({result:'PASS',results,performance,campaigns:campaigns.map(j=>j.id),errors},null,2));
 }catch(error){await capture('failure');throw error;}
 finally{await ctx.tracing.stop({path:path.join(out,'trace.zip')});const video=page.video();await ctx.close();await video.saveAs(path.join(out,'acceptance.webm'));await browser.close();}
 console.log(JSON.stringify({result:'PASS',results,performance}));
})().catch(e=>{console.error(e);process.exit(1);});
