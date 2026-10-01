const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=require('node:path').resolve(__dirname,'..');
const py='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
(async()=>{
 const server=cp.spawn(py,['-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});
 let browser;
 try{
  const port=await new Promise((resolve,reject)=>{server.stdout.once('data',d=>resolve(Number(d.toString().trim())));server.once('error',reject);server.once('exit',()=>reject(Error('Preview exited')));});
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/#/rack/proj_k`);await page.waitForSelector('#ew-rack-add');
  assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true);
  await page.evaluate(()=>changeOsIp('CDU-01'));
  await page.locator('#equipment-ip').fill('192.0.2.77');
  await page.locator('#rm-dialog-foot .primary').click();
  await page.waitForFunction(()=>machines.find(m=>m.name==='CDU-01').os_ip==='192.0.2.77');
  await page.evaluate(()=>openTerm('CDU-01'));
  assert.match(await page.locator('#rm-dialog-body').innerText(),/192.0.2.77/);
  await page.screenshot({path:root+'/qa/artifacts/equipment-ssh.png'});
  await page.evaluate(()=>closeDialog());
  await page.evaluate(()=>openMachine('CDU-01'));
  await page.waitForFunction(()=>document.querySelector('.equipment-actions'));
  assert.ok(await page.locator('.equipment-actions').getByText('SSH Terminal',{exact:true}).count());
  assert.equal(await page.locator('.pd-power-group').count(),0);
  await page.screenshot({path:root+'/qa/artifacts/equipment-detail.png'});
  const list=await page.evaluate(()=>devicesHtml(machines.filter(m=>m.name==='CDU-01'),[]));
  assert.ok(list.includes('equipment-actions'));assert.ok(!list.includes('machControlDialog'));
  assert.deepEqual(errors,[]);
  console.log('PASS: Chrome fixture IP save/reload, SSH target, CDU detail/list capability, zero page errors');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
