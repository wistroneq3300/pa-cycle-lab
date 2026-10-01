const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const output=path.resolve('docs/screenshots/platform-regression');fs.mkdirSync(output,{recursive:true});
 const report=[];
 try {
  for(const width of [1366,1920])for(const theme of ['light','dark']){
   const page=await browser.newPage({viewport:{width,height:width===1366?768:1080}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(t=>localStorage.setItem('pa_theme',t),theme);
   await page.goto((process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9188')+'/#/projects');
   await page.waitForFunction(()=>machines.length>0);
   for(const view of ['dashboard','projects','rack']){
    await page.evaluate(view=>{
      if(view==='projects')productLevel('rack');
      // Preview-only placement; no inventory write or hardware probe.
      if(view==='rack')machines.forEach((m,i)=>{m.rack_u=48-i;m.rack_size=1;});
      setView(view);
    },view);
    await page.waitForTimeout(700);
    await page.screenshot({path:path.join(output,`${view}-${width}-${theme}.png`)});
    report.push({view,width,theme,actualTheme:await page.evaluate(()=>document.documentElement.dataset.theme),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),errors:[...errors]});
   }
   await page.evaluate(()=>{const m=machines[0];machineDetailCache[m.name]={machine:m,hardware:{},os:{},fw:[],sensors:[]};_activeMachine=m.name;setView('machine');});
   for(const tab of ['overview','hardware','sensors','telemetry','tasks','osslots']){
    await page.locator('#pd-tab-'+tab).click();
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(output,`chassis-${tab}-${width}-${theme}.png`)});
    report.push({view:'chassis-'+tab,width,theme,actualTheme:await page.evaluate(()=>document.documentElement.dataset.theme),
      overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),errors:[...errors]});
   }
   await page.locator('#pd-tab-osslots').click();
   await page.getByRole('button',{name:'編輯連線',exact:true}).first().click();
   await page.screenshot({path:path.join(output,`node-edit-${width}-${theme}.png`)});
   await page.close();
  }
  fs.writeFileSync(path.join(output,'capture-results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  if(report.some(r=>r.overflow||r.errors.length||r.theme!==r.actualTheme))throw new Error('Desktop capture contract failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
