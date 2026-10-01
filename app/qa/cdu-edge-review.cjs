/* Fixture-only CDU project/placement edge cases; never contact production. */
const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1600,height:1050}}),errors=[],dialogs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 try{
  await page.goto((process.env.PA_PREVIEW_URL||'http://127.0.0.1:8887')+'/#/rack/proj_k');await page.waitForSelector('#ew-rack-add');
  assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true);
  await page.evaluate(()=>{rackView.project='';rackAddEntry();});
  assert.ok(await page.locator('#rcp-proj').count());
  await page.locator('#rcp-proj').selectOption('proj_k');await page.locator('#rm-dialog-foot button').last().click();await page.locator('#rp-type').selectOption('cdu');
  assert.equal(await page.locator('#cdu-name').inputValue(),'CDU-01');assert.equal(await page.locator('#cdu-mount').inputValue(),'external');
  await page.evaluate(()=>closeDialog());
  await page.evaluate(async()=>{
   await api('/api/projects/edge-empty',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'unused'})}).catch(()=>{});
   await api('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'edge-empty',level:'rack'})});
   await loadProjects();await moveMachineTo('CDU-01','edge-empty');
   rackView.project='edge-empty';setView('rack');
  });
  assert.equal(await page.locator('#ew-rack-add').count(),1);
  await page.locator('#ew-rack-component').selectOption('CDU-01');
  assert.match(await page.locator('#ew-rack-inspector').innerText(),/CDU-01/);
  await page.evaluate(async()=>{
   await api('/api/projects/edge-empty',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'edge-renamed'})});
   await loadMachines(false);await loadProjects();rackView.project='edge-renamed';setView('rack');
  });
  assert.equal(await page.evaluate(()=>rackProjectCdu('edge-renamed').rack_mount),'external');
  await page.evaluate(()=>rackMoveDialog('CDU-01'));assert.equal(await page.locator('#cdu-mount').inputValue(),'external');
  await page.evaluate(async()=>{closeDialog();await api('/api/machines/CDU-01',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({rack_mount:'internal',rack_u:0,rack_size:4})});await loadMachines(false);setView('rack');});
  assert.equal(await page.locator('#ew-rack-add').count(),1);await page.locator('#ew-rack-add').click();await page.locator('#rm-dialog-foot .primary').click();
  assert.equal(await page.locator('#cdu-name').inputValue(),'CDU-01');assert.equal(await page.locator('#cdu-size').inputValue(),'4');assert.equal(await page.locator('#rm-dialog-foot .primary').isEnabled(),true);
  await page.evaluate(()=>closeDialog());
  await page.screenshot({path:'qa/artifacts/cdu-edge-empty.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
  console.log(JSON.stringify({errors,dialogs,result:'external-only, no-project chooser, generic type CDU, project move/rename, pending CDU workflows passed'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
