/* Production frontend -> real isolated ASGI/store/worker -> fake device IO. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:19486';
const out=path.resolve('artifacts/telemetry-provision');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const ctx=await browser.newContext({viewport:{width:1920,height:1080},recordVideo:{dir:path.join(out,'videos'),size:{width:1920,height:1080}},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 const errors=[],results=[],requests=[];const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/telemetry'))requests.push({url:r.url(),body:r.postDataJSON()});});
 await ctx.addInitScript(()=>localStorage.setItem('pa_theme','light'));
 const panel=page.locator('.tp-workspace');
 async function open(){await page.goto(base+'/#/dashboard');await page.waitForFunction(()=>typeof openMachine==='function');await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-tab-telemetry').waitFor();await page.locator('#pd-tab-telemetry').click();await panel.locator('[data-enable]').waitFor({state:'attached'});await page.waitForFunction(()=>document.querySelector('.tp-workspace [data-node]')?.options.length===5);}
 async function waitState(state){await page.waitForFunction(s=>document.querySelector('.tp-workspace [data-state]')?.textContent===s,state,{timeout:20000});}
 async function shot(name){await panel.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});}
 async function fixture(index,mode){const r=await page.request.post(base+'/__telemetry/fixture',{data:{index,mode}});assert(r.ok(),await r.text());return (await r.json()).node_id;}
 try{
  await open();await waitState('NOT_CONFIGURED');await shot('before-enable-1920-light');
  const n1=await panel.locator('[data-node]').inputValue();await panel.locator('[data-enable]').click();
  await panel.locator('.tp-console:not([hidden])').waitFor();await page.waitForTimeout(600);await shot('provisioning-1920-light');
  // Leaving UI cannot cancel install. Reopen via production route and recover history.
  await page.goto(base+'/#/projects');await page.waitForTimeout(1200);await open();await waitState('READY');
  assert.equal(requests.length,1);assert.equal(requests[0].body.expected_binding_revision.length,64);
  await panel.locator('[data-console]').click();await page.waitForFunction(()=>document.querySelectorAll('.tp-log-row').length>5);
  const log=await panel.locator('.tp-log').innerText();assert(log.includes('PASS'));assert(log.includes('Node Exporter'));
  const href=await panel.locator('[data-download]').getAttribute('href');const download=await page.request.get(base+href);assert((await download.text()).includes('+08:00'));
  await panel.locator('[data-search]').fill('identity');assert(await panel.locator('.tp-log-row').count()>0);
  await panel.locator('[data-copy]').click();assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('identity'));
  await panel.locator('[data-search]').fill('');await panel.locator('[data-follow]').click();await panel.locator('[data-pause]').click();assert.equal(await panel.locator('[data-pause]').getAttribute('aria-pressed'),'true');await panel.locator('[data-pause]').click();
  assert((await panel.locator('iframe').getAttribute('src')).includes('var-node_id='+n1));
  results.push('enable / browser navigation / resume / Taiwan time / copy / pause / scoped iframe');
  for(const width of [1920,1366])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:width===1920?1080:768});await page.evaluate(t=>applyTheme(t),theme);await page.waitForTimeout(200);
   await shot(`ready-${width}-${theme}`);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow');
  }
  const n2=await fixture(1,'occupied');await panel.locator('[data-node]').selectOption(n2);await waitState('NOT_CONFIGURED');await panel.locator('[data-enable]').click();await waitState('ERROR');await shot('occupied-1366-dark');assert((await panel.locator('[data-detail]').innerText()).includes('in use'));
  const n3=await fixture(2,'unreachable');await panel.locator('[data-node]').selectOption(n3);await waitState('NOT_CONFIGURED');await panel.locator('[data-enable]').click();await waitState('UNREACHABLE');
  const n4=await fixture(3,'degraded');await panel.locator('[data-node]').selectOption(n4);await waitState('NOT_CONFIGURED');await panel.locator('[data-enable]').click();await waitState('DEGRADED');await shot('degraded-1366-dark');
  results.push('four independent nodes / occupied / unreachable / degraded / desktop themes');
  await panel.locator('[data-node]').selectOption(n1);await waitState('READY');await panel.locator('[data-console]').click();
  const first=await(await page.request.get(base+'/__telemetry/results')).json();const jid=first.nodes[0].job.job_id;
  await page.request.post(base+'/__telemetry/log-batch',{data:{job_id:jid,count:2100}});
  await page.waitForFunction(()=>document.querySelectorAll('.tp-log-row').length===2000,null,{timeout:25000});
  assert.equal(await page.locator('.tp-log img').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);
  assert(!(await panel.locator('.tp-log').innerText()).includes('SYNTHETIC-OS-1'));
  await panel.locator('[data-search]').fill('fixture 2099');assert.equal(await panel.locator('.tp-log-row').count(),1);
  const full=await page.request.get(base+'/api/telemetry/jobs/'+jid+'/log');assert((await full.text()).includes('fixture 0 '));assert((await full.text()).includes('fixture 2099 '));
  results.push('2000-line bounded DOM / full download / literal HTML / redacted secret');
  await page.locator('#pd-tab-overview').click();assert(await page.locator('.pd-operations').getByText('開啟 Terminal',{exact:true}).isVisible());assert(await page.locator('.pd-operations').getByText('KVM',{exact:true}).isVisible());assert(await page.locator('.pd-operations').getByText('指派測試任務',{exact:true}).isVisible());assert.equal(await page.locator('[data-pd-tab]').count(),6);
  const backend=await(await page.request.get(base+'/__telemetry/results')).json();assert.equal(backend.cycle_jobs,0);
  const installs=backend.calls.filter(c=>c[0]==='ssh'&&c[2].includes('apt-get'));assert.equal(installs.length,2);assert.equal(new Set(installs.map(c=>c[1])).size,2);
  fs.writeFileSync(path.join(out,'backend.json'),JSON.stringify(backend,null,2));
  assert.equal(errors.length,0,errors.join('\n'));results.push('Terminal / KVM / test assignment / six tabs / no Cycle job / no real hardware');
 }catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error;}
 finally{await ctx.tracing.stop({path:path.join(out,'trace.zip')});const video=page.video();await ctx.close();await video.saveAs(path.join(out,'telemetry-acceptance.webm'));await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors,requests},null,2));}
 console.log(JSON.stringify({result:'PASS',results}));
})().catch(e=>{console.error(e);process.exit(1);});
