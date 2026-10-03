/* Production DOM owners; all data/requests are intercepted, no Web service startup. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const out=path.resolve('docs/screenshots/system-inspection');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const server=http.createServer((q,r)=>{r.writeHead(404);r.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,results=[],errors=[];
 const fixture=fs.readFileSync('app/static/js/preview-fixtures.js','utf8')
 .replace("if(!path.startsWith('/api/'))","if(!path.startsWith('/api/')||path.includes('/inspection'))")
 .replace('window.PA_PREVIEW=','window.__INSPECTION_FIXTURE=');
 try{
  for(const theme of ['light','dark'])for(const width of [1366,1920]){
   const context=await browser.newContext({viewport:{width,height:width===1366?768:1080},reducedMotion:'reduce'});
   await context.addInitScript({content:`localStorage.setItem('pa_theme',${JSON.stringify(theme)});`+fixture+`
const m=window.__INSPECTION_FIXTURE.machines.find(m=>m.name==='host_a');m.id='chassis-a';m.os=[1,2,3,4].map(i=>({slot:i,node_id:'n'+i,label:'N'+i,ip:'192.0.2.'+(20+i),user:'fixture'+i,port:2200+i,bmc_ip:'198.51.100.'+(20+i),bmc_user:'fixture',bmc_port:22,binding_revision:1}));m.active_os=1;`});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   let before=true,state='disabled',writes=[],malicious=false;
   const now=1791000000,config={enabled:false,ai_enabled:false,interval_seconds:120,duration_seconds:120,recovery_samples:2,stale_seconds:300,hysteresis:5,thresholds:{cpu:90,memory:95,gpu:95,vram:95}};
   const nodes=[1,2,3,4].map(i=>({node_id:'n'+i,slot:i,label:'N'+i}));
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
    if(u.pathname==='/'||u.pathname.startsWith('/static/')||u.pathname==='/fixtures/tests.json'){
     const file=u.pathname==='/'?'app/static/index.html':u.pathname==='/fixtures/tests.json'?'app/data/tests.json':'app'+decodeURIComponent(u.pathname);
     if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
     const old=before&&['app/static/index.html','app/static/js/app.js','app/static/js/product-detail.js','app/static/css/product-detail.css'].includes(file);
     const body=old?execFileSync('git',['show','6eba3a2a:'+file]):fs.readFileSync(file);
     return route.fulfill({body,contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream'});
    }
    if(u.pathname.includes('/inspection')){
     const method=route.request().method();if(method!=='GET')writes.push({method,path:u.pathname,body:route.request().postDataJSON()});
     if(method==='PATCH'&&u.pathname.endsWith('/settings'))Object.assign(config,route.request().postDataJSON());
     const issue={id:'issue1',node_id:'n3',component:state==='fail'?'PCIe':'cpu',rule:state==='fail'?'DMESG_PCIE':'cpu.utilization.high',severity:state==='fail'?'FAIL':'WARNING',status:'ACTIVE',first_seen_at:now-7200,last_seen_at:state==='stale'?now-3600:now,resolved_at:null,recurrences:0,facts:malicious?'<img src=x onerror="window.unsafe=true">':state==='fail'?'PCIe AER Uncorrected · 原生核心日誌判定，待確認受影響裝置':'CPU 98% · 持續高使用率，請核對目前測試負載',evidence:state==='fail'?'fixture-run / N3 / loop0002 / report.json':'os_metrics row 14',acknowledged:false,known_issue:false,mute_until:0};
     if(u.pathname.endsWith('/issues'))return route.fulfill({json:{issues:state==='disabled'?[]:[issue]}});
     if(u.pathname.endsWith('/history'))return route.fulfill({json:{history:[{at:now,kind:'OPENED'}]}});
     if(u.pathname.endsWith('/run'))return route.fulfill({status:202,json:{state:'ACCEPTED'}});
     return route.fulfill({json:{config,nodes,summary:{fail:state==='fail'?1:0,warning:['warning','stale'].includes(state)?1:0},last_completed_at:state==='disabled'?null:now,running:false,coverage:state==='disabled'?[]:nodes.map(n=>({...n,source:'Telemetry',state:state==='stale'?'STALE':'FRESH',collected_at:state==='stale'?now-3600:now,detail:'僅使用已保存、可歸屬節點的資料。'}))}});
    }
    return route.fulfill({status:404,json:{detail:'No isolated fixture'}});
   });
   async function open(){await page.goto(base+'/#/dashboard');await page.locator('.cine-story').waitFor();await page.evaluate(()=>openMachine('host_a'));await page.locator('.pd-system-header').waitFor();}
   await open();await page.screenshot({path:path.join(out,`before-${width}-${theme}.png`)});
   const oldPower=await page.locator('.mach-power-actions [onclick]').evaluateAll(es=>es.map(e=>e.getAttribute('onclick')));
   before=false;await page.goto(base+"/?inspection=after#/dashboard");await open();await page.locator('#pd-inspection [data-status]').filter({hasText:'未啟用'}).waitFor();
   assert.equal(await page.locator('[onclick*="runDiagnose("]').count(),1);
   assert(await page.locator('.pd-operations [onclick*="openTermDialog"]').isVisible());
   assert(await page.locator('.pd-operations [onclick*="openKvmSolo"]').isVisible());
   assert(await page.locator('.pd-operations [onclick*="openAssignTask"]').isVisible());
   assert.deepEqual(await page.locator('.mach-power-actions [onclick]').evaluateAll(es=>es.map(e=>e.getAttribute('onclick'))),oldPower);
   await page.locator('.pd-power-group summary').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('.pd-power-group').getAttribute('open'),'');assert.equal(writes.length,0);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.pd-power-group').getAttribute('open'),null);
   await page.screenshot({path:path.join(out,`after-${width}-${theme}.png`)});
   for(state of ['disabled','warning','fail','stale']){
    config.enabled=state!=='disabled';await page.evaluate(()=>{document.querySelector('#pd-inspection [data-issues]').hidden=true;SystemInspection.mount('host_a');});
    await page.waitForTimeout(150);await page.locator('#pd-inspection').scrollIntoViewIfNeeded();
    if(state!=='disabled'){await page.locator('#pd-inspection [data-view]').click();await page.locator('.pd-inspection-issue').first().waitFor();await page.locator('.pd-inspection-issue summary').click();}
    if(state==='stale')await page.locator('.pd-inspection-coverage summary').click();
    assert.equal(await page.evaluate(()=>!!window.unsafe),false);
    await page.screenshot({path:path.join(out,`${state}-${width}-${theme}.png`)});
    results.push({theme,width,state,passed:true});
   }
   malicious=true;await page.locator('[data-reload]').click();await page.waitForTimeout(100);assert.equal(await page.locator('.pd-inspection-issue img').count(),0);assert.equal(await page.evaluate(()=>!!window.unsafe),false);
   await page.locator('[data-settings]').click();await page.locator('[name=interval_seconds]').fill('180');
   await page.locator('[data-config] [type=submit]').click();await page.waitForTimeout(100);
   assert.equal(writes[0].body.interval_seconds,180);
   await page.locator('[data-run]').click();await page.waitForTimeout(100);
   assert(writes.every(w=>w.path.includes('/inspection/')));
   for(const tab of ['hardware','osslots','sensors','telemetry','tasks','overview']){await page.evaluate(t=>productDetailTab(t),tab);assert(await page.locator('#pd-panel-'+tab).isVisible());}
   await page.evaluate(()=>SystemInspection.dispose());
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
   await context.close();
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({results,errors,hardware_dispatches:0,baseline:'6eba3a2a',note:'Production DOM with intercepted browser data; not hardware acceptance.'},null,2));
  console.log(`PASS ${results.length} state/viewport/theme cases; preserved power handlers; no hardware dispatch`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
