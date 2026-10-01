const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto((process.env.PA_PREVIEW_URL||'http://127.0.0.1:18769')+'/#/machine/host_a');await page.waitForSelector('[data-pd-tab]');
  await page.evaluate(()=>{window.originalFetch=window.fetch;window.calls=[];window.failureMode='delete';window.fetch=async(url,options={})=>{
   const path=String(url);
   if((path.endsWith('/power')&&options.method==='POST')||(path.includes('/api/machines/')&&options.method==='DELETE')){
    calls.push({url:path,body:options.body&&JSON.parse(options.body),method:options.method});
    if(failureMode==='delete'||failureMode==='power')return new Response(JSON.stringify({detail:'synthetic request rejected'}),{status:503});
   }
   return originalFetch(url,options);
  };void deleteMachine('host_a');});
  await page.locator('#rm-dialog-foot .primary').click();await page.waitForFunction(()=>document.getElementById('ux-notifications')?.textContent.includes('synthetic'));
  assert.equal(await page.evaluate(()=>machines.some(m=>m.name==='host_a')),true);
  await page.evaluate(()=>{window.failureMode='ok';window.calls=[];void machinePower('host_a',false);void machinePower('host_a',false);});
  await page.waitForSelector('.ux-confirm-copy');await page.locator('#rm-dialog-foot .primary').click();
  await page.waitForFunction(()=>calls.length===1);
  const request=await page.evaluate(()=>calls[0]);assert.equal(request.body.on,false);assert.deepEqual(request.body.expected_target,{active_os:1,os_ip:'192.0.2.21',bmc_ip:'198.51.100.21'});
  await page.waitForFunction(()=>document.getElementById('ux-notifications').textContent.includes('\u6307\u4ee4\u5df2\u63a5\u53d7'));
  await page.evaluate(()=>{window.calls=[];void machinePower('CDU-01',false);});
  assert.equal(await page.evaluate(()=>calls.length),0);
  await page.evaluate(()=>{window.failureMode='power';return runPowerBatch('on',['host_a']);});
  assert.equal(await page.locator('.batch-row[data-state="failed"]').count(),1);
  await page.locator('#batch-retry').click();await page.waitForSelector('.ux-confirm-copy');
  await page.evaluate(()=>window.failureMode='ok');await page.locator('#rm-dialog-foot .primary').click();
  await page.waitForSelector('.batch-row[data-state="success"]');
  assert.equal(await page.locator('#batch-close').isEnabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: failed delete preserves item; duplicate power confirmation sends once; expected target preserved; CDU power blocked; batch retry reopens progress and reports success');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
