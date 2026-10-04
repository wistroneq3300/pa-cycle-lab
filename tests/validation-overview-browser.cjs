/* Deterministic Dashboard IA, cinematic, responsiveness, and theme review. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:19486';
const out=path.resolve('artifacts/validation-overview');fs.mkdirSync(out,{recursive:true});
const fixture={generated_at:1791096000,totals:{projects:2,systems:34,nodes:132,issues:{fail:2,warning:5},validation:{checked:129,pass:122,total:132},cycle:{running:1,completed:18},monitoring:{reporting:130,total:132}},projects:[
 {name:'Vera CPU Rack',level:'L11',systems:32,nodes:128,issues:{fail:2,warning:4},validation:{checked:126,pass:120,total:128},cycle:{running:1,completed:16},monitoring:{reporting:126,total:128},last_validation:1791095280},
 {name:'EQ3300',level:'L10',systems:2,nodes:4,issues:{fail:0,warning:1},validation:{checked:3,pass:2,total:4},cycle:{running:0,completed:2},monitoring:{reporting:4,total:4},last_validation:1791094200}
],issues:[
 {severity:'FAIL',project:'Vera CPU Rack',system:'chassis-01',node:'N3',component:'GPU inventory mismatch',facts:'Expected 8 · Detected 7'},
 {severity:'FAIL',project:'Vera CPU Rack',system:'chassis-01',node:'N2',component:'PCIe link degraded',facts:'0000:03:00.0 · x16 → x8'},
 {severity:'WARNING',project:'EQ3300',system:'chassis-01',node:'N1',component:'Telemetry stale',facts:'Last sample 18 min ago'}
],recent_runs:[{id:'cycle-001',project:'Vera CPU Rack',state:'RUNNING',updated_at:1791095700},{id:'cycle-002',project:'EQ3300',state:'COMPLETED',updated_at:1791093900}]};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];const ctx=await browser.newContext({viewport:{width:1366,height:768}});const page=await ctx.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/validation/overview',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
 try{
  await page.addInitScript(()=>{localStorage.setItem('pa_theme','light');sessionStorage.removeItem('pa_dashboard_cinematic_played');});
  await page.goto(base+'/#/dashboard');await page.locator('.vo-overview').waitFor();await page.waitForFunction(()=>document.querySelectorAll('.vo-project-card').length===2);
  assert.equal(await page.locator('.ux-overview').count(),0);assert.equal(await page.locator('.vo-overview>section').count(),5);assert.equal(await page.locator('.vo-issue').count(),3);
  assert.equal(await page.locator('[data-vo-status]').getByText('Telemetry',{exact:true}).count(),1);assert.equal(await page.getByText('Monitoring',{exact:true}).count(),0);assert((await page.locator('[data-vo-summary]').innerText()).includes('Telemetry 130 / 132'));
  await page.waitForFunction(()=>Number(document.querySelector('#system-core')?.dataset.coreProgress||0)>.98,{},{timeout:9000});
  await page.locator('[data-vo-replay]').click();await page.waitForTimeout(500);const canvas=page.locator('#system-core');await canvas.dispatchEvent('pointerdown',{pointerId:1,pointerType:'mouse',clientX:700,clientY:300,button:0});const stopped=Number(await canvas.getAttribute('data-core-progress'));await page.waitForTimeout(900);const after=Number(await canvas.getAttribute('data-core-progress'));assert(Math.abs(after-stopped)<.025,`${stopped} -> ${after}`);await canvas.dispatchEvent('pointerup',{pointerId:1,pointerType:'mouse',clientX:700,clientY:300,button:0});
  await page.goto(base+'/#/projects');await page.goto(base+'/#/dashboard');await page.waitForFunction(()=>Number(document.querySelector('#system-core')?.dataset.coreProgress||0)>.98);
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:width===1366?768:1080});await page.evaluate(value=>applyTheme(value),theme);await page.waitForTimeout(250);assert.equal(await canvas.evaluate(node=>node.paCoreScene?.getState().assembly.phase),'rack');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=1,`horizontal overflow ${width}/${theme}: ${overflow}px`);
   await page.screenshot({path:path.join(out,`dashboard-${width}-${theme}.png`),fullPage:true});
  }
  assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({result:'PASS',checks:['five-section information architecture','single dashboard renderer','decision-ready issue and project states','one-shot cinematic','manual input cancels autoplay','returning to Dashboard shows full rack','1366/1920 light/dark without horizontal overflow']},null,2));
  console.log('PASS: validation overview / cinematic takeover / 1366+1920 light+dark');
 }finally{await ctx.close();await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
