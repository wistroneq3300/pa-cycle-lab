/* Real production frontend + ASGI + SQLite. Harness substitutes bottom IO only. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:19489';
const out=path.resolve('artifacts/native-refinement');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:path.join(out,'video'),size:{width:1920,height:1080}},permissions:['clipboard-read','clipboard-write']});
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 const page=await ctx.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(url,data)=>{const r=await page.request.post(base+url,{data});assert(r.ok(),await r.text());return r.json();};
 const capture=async name=>page.screenshot({path:path.join(out,name+'.png')});
 async function themes(prefix,locator){for(const [w,h] of [[1920,1080],[1366,768]])for(const theme of ['light','dark']){await page.setViewportSize({width:w,height:h});await page.evaluate(t=>applyTheme(t),theme);if(locator)await locator.evaluate(e=>e.scrollIntoView({block:'start'}));await page.waitForTimeout(250);await capture(prefix+'-'+w+'-'+theme);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');}}
 try{
  await page.goto(base);await page.waitForFunction(()=>typeof openMachine==='function');await page.evaluate(()=>openMachine('chassis-01'));
  await page.locator('#pd-inspection').waitFor();await capture('before-enabling-inspection');
  await page.locator('#pd-inspection [data-collapse]').click();assert(await page.locator('#pd-inspection-body').isHidden());await page.locator('#pd-inspection [data-collapse]').click();
  assert(await page.locator('.pd-operations [onclick*="openTermDialog"]').isVisible());assert(await page.locator('.pd-operations [onclick*="openKvmSolo"]').isVisible());assert(await page.locator('.pd-operations [onclick*="openAssignTask"]').isVisible());
  const fixture=await post('/__refinement/fixture',{gpus:8,fault:true});
  await page.locator('#pd-tab-telemetry').click();const tp=page.locator('.tp-workspace');await tp.locator('.tp-state').waitFor();
  await page.waitForFunction(()=>['READY','DEGRADED','NOT_CONFIGURED'].includes(document.querySelector('.tp-workspace .tp-state')?.textContent));
  if(await tp.locator('[data-enable]').isVisible())await tp.locator('[data-enable]').click();else await tp.locator('[data-console]').click();
  const dialog=page.locator('dialog.tp-console');await dialog.waitFor({state:'visible'});await page.keyboard.press('Escape');assert(!(await dialog.isVisible()));
  await page.waitForFunction(()=>document.querySelector('.tp-workspace [data-state]')?.textContent==='READY',null,{timeout:35000});
  await tp.locator('[data-console]').click();await page.waitForFunction(()=>document.querySelector('.tp-log')?.textContent.includes('GPU target')||document.querySelector('.tp-log')?.textContent.includes('DCGM metrics'));await capture('gpu-provision-console');await dialog.locator('[data-view]').click();
  await page.waitForFunction(()=>document.querySelector('[data-panel=gpu] .tn-legend')?.children.length===8,null,{timeout:20000});
  assert.equal(await tp.locator('iframe').count(),0);assert.equal(await tp.locator('.tn-panel').count(),8);
  await themes('native-telemetry',tp.locator('.tn-toolbar'));
  await tp.locator('.tn-toolbar select').selectOption('7d');await page.waitForTimeout(1200);assert.equal(await tp.locator('[data-panel=gpu] .tn-legend button').count(),8);
  const legend=tp.locator('[data-panel=gpu] .tn-legend button').first();await legend.click();assert.equal(await legend.getAttribute('aria-pressed'),'false');await legend.click();
  results.push('Native 8-panel dashboard, eight distinct GPU series, 7d query, legend control, no Grafana iframe, host/GPU provision continuity');
  // Return to original system overview; only fixture transport can acquire evidence.
  await page.locator('#pd-tab-overview').click();const inspect=page.locator('#pd-inspection');await inspect.locator('[data-run]').click();
  await page.waitForFunction(()=>Number(document.querySelector('#pd-inspection [data-fail]')?.textContent)>0,null,{timeout:30000});
  await inspect.locator('[data-view]').click();await inspect.locator('.pd-inspection-issue').first().waitFor();
  await inspect.locator('.pd-inspection-issue summary').first().click();await page.waitForFunction(()=>document.querySelector('.pd-ai [data-ai-state]')?.dataset.state==='COMPLETE',null,{timeout:20000});
  const first=inspect.locator('.pd-inspection-issue').filter({has:page.locator('button').filter({hasText:'查看原始證據'})}).first();
  if(!(await first.evaluate(e=>e.open)))await first.locator('summary').click();await themes('inspection-ai',first);
  const evidenceButton=first.getByRole('button',{name:'查看原始證據',exact:true});await evidenceButton.click();const evidence=page.locator('.pa-evidence-modal');await evidence.waitFor();await page.waitForFunction(()=>document.querySelector('.pa-evidence-modal pre')?.textContent.length>0);
  await themes('raw-evidence',evidence);await evidence.locator('input').fill('nvme');await evidence.locator('[data-copy]').click();assert((await evidence.locator('[data-status]').innerText()).includes('已複製'));await page.keyboard.press('Escape');assert(!(await evidence.isVisible()));assert(await evidenceButton.evaluate(e=>document.activeElement===e));
  await post('/__refinement/fixture',{gpus:8,ai:'timeout'});await first.getByRole('button',{name:'AI 重新分析',exact:true}).click();
  await first.locator('[data-ai-state][data-state=ERROR]').waitFor({timeout:25000});assert((await first.innerText()).includes('TIMEOUT'));await capture('ai-timeout-visible');
  await post('/__refinement/fixture',{gpus:8,ai:'ok'});await first.getByRole('button',{name:'AI 重新分析',exact:true}).click();await first.locator('[data-ai-state][data-state=COMPLETE]').waitFor({timeout:25000});
  assert(await first.evaluate(e=>e.open));results.push('Existing selected-node/collapse/Terminal/KVM/Test entries preserved; transport-driven findings, raw evidence modal focus/search/copy; AI timeout and retry auto-refresh without F5');
  // Host charts remain useful when GPU provisioning cannot finish.
  const partial=await post('/__refinement/fixture',{index:1,gpus:1,gpu_mode:'occupied'});
  await page.locator('#pd-tab-telemetry').click();await tp.locator('[data-node]').selectOption(partial.node_id);
  await tp.locator('[data-enable]').click();await page.waitForFunction(()=>document.querySelector('.tp-workspace .tp-state')?.textContent==='DEGRADED',null,{timeout:35000});await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('[data-panel=cpu] [data-health]')?.dataset.state==='READY');
  const help=tp.locator('.tn-gpu-help');await help.locator('summary').click();assert((await help.innerText()).includes(base));assert((await help.innerText()).includes('Prometheus 主動讀取'));
  await themes('gpu-manual-help',help);results.push('DCGM conflict preserves Host charts; manual setup identifies current PA, Prometheus and canonical GPU endpoint');
  const cpu=await post('/__refinement/fixture',{index:2,gpus:0});await tp.locator('[data-node]').selectOption(cpu.node_id);await tp.locator('[data-enable]').click();
  await page.waitForFunction(()=>document.querySelector('.tp-workspace .tp-state')?.textContent==='READY',null,{timeout:35000});await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.querySelector('[data-panel=gpu] [data-health]')?.dataset.state==='NOT_APPLICABLE');assert.equal(await help.isVisible(),false);await capture('cpu-only-host-ready');
  results.push('CPU-only Host charts READY, GPU NOT_APPLICABLE, no DCGM requirement');
  // Existing Cycle viewer remains its own inline surface, unchanged by new UI.
  const campaign=await post('/__validation/campaign',{count:4});await page.goto(base+'/#/cycle/runs/'+campaign.id);await page.locator('#cw-console-toggle').click();await page.waitForFunction(()=>document.querySelectorAll('.cycle-console-row').length>0);await page.locator('.live-console').scrollIntoViewIfNeeded();await capture('cycle-preserved');
  assert.equal(await page.locator('.lc-fleet-controls [data-machine]').count(),4);results.push('Cycle inline console and four-node controls retained');
  const backend=await(await page.request.get(base+'/__refinement/results')).json();fs.writeFileSync(path.join(out,'backend.json'),JSON.stringify(backend,null,2));
  assert(backend.issues.some(i=>i.severity==='WARNING'));assert(backend.issues.some(i=>i.severity==='FAIL'));assert.equal(new Set(backend.calls.map(c=>c[0])).size,1);
  assert(!backend.telemetry_calls.some(c=>c[0]==='ssh'&&/reboot|kill |apt-get upgrade/.test(c[2])));
  assert.deepEqual(errors,[]);
 }catch(e){await capture('failure');throw e;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));await ctx.tracing.stop({path:path.join(out,'trace.zip')});await ctx.close();await browser.close();}
 console.log(JSON.stringify({results,errors,artifacts:out},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
