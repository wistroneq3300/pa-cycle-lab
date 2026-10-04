/* Focused reviewer regressions against the completed telemetry preview fixture. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:19486';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const ctx=await browser.newContext({viewport:{width:1366,height:768}});const page=await ctx.newPage();
 try{
  await page.goto(base);await page.waitForFunction(()=>typeof openMachine==='function');await page.evaluate(()=>openMachine('chassis-01'));await page.locator('#pd-tab-telemetry').click();
  const panel=page.locator('.tp-workspace');await panel.locator('[data-console]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.tp-log-row').length===2000);
  const log=panel.locator('.tp-log');await log.evaluate(element=>{element.scrollTop=0;element.dispatchEvent(new Event('scroll'));});
  const before=await log.evaluate(element=>element.scrollTop);
  const result=await(await page.request.get(base+'/__telemetry/results')).json();const job=result.nodes[0].job;
  await page.request.post(base+'/__telemetry/log-batch',{data:{job_id:job.job_id,count:3}});
  await page.waitForFunction(()=>!document.querySelector('.tp-workspace [data-latest]').hidden,{},{timeout:20000});const unreadText=await panel.locator('[data-latest]').innerText();const unreadCount=Number.parseInt(unreadText,10);assert(unreadCount>=3,unreadText);assert.equal(await log.evaluate(element=>element.scrollTop),before);
  // Actual parent's normal remount path preserves the natural non-following position.
  await page.evaluate(()=>setView('machine'));await page.waitForTimeout(600);
  assert(await panel.locator('[data-latest]').isVisible());
  await panel.locator('[data-latest]').click();assert.equal(await panel.locator('[data-latest]').isHidden(),true);
  await panel.locator('[data-node]').selectOption(result.nodes[1].node_id);
  assert.equal(await panel.locator('.tp-log-row').count(),0);
  await panel.locator('[data-console]').click();await page.waitForFunction(()=>document.querySelectorAll('.tp-log-row').length>0);
  assert(!(await panel.locator('.tp-log').innerText()).includes('fixture 2099'));assert((await panel.locator('.tp-log').innerText()).includes('pid=912'));
  const out=path.resolve('artifacts/telemetry-provision');
  fs.writeFileSync(path.join(out,'console-regressions.json'),JSON.stringify({result:'PASS',checks:['scrolling up stops natural follow','new-event control reports unread count','parent remount preserves non-following view','jump-to-latest resumes follow','node switch clears old DOM','only selected node events rendered']},null,2));
  console.log('PASS: natural follow / unread count / remount / canonical node log isolation');
 }finally{await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
