const cp=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),py='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const artifact=path.join(root,'qa/artifacts/topology');fs.mkdirSync(artifact,{recursive:true});
(async()=>{
 const server=cp.spawn(py,['-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});let browser;
 try{
  const port=await new Promise((res,rej)=>{server.stdout.once('data',d=>res(Number(d.toString().trim())));server.once('error',rej);});
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  await page.addInitScript(() => {
    if (globalThis.Crypto?.prototype) Object.defineProperty(Crypto.prototype,'randomUUID',{value:undefined,configurable:true});
  });
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/#/rack/proj_k`);await page.waitForSelector('#ew-rack-add');
  const act=(name)=>page.locator(`.nt-overlay [data-action="${name}"]`).first().click();
  const apply=()=>page.locator('.nt-form button[type="submit"]').click();
  const confirm=()=>page.locator('#rm-dialog-foot .primary').click();
  await page.getByRole('tablist').getByRole('button',{name:'網路拓樸',exact:true}).click();
  assert.equal(await page.locator('.nt-header h2').innerText(),'網路拓樸');
  assert.doesNotMatch(await page.locator('.nt-overlay').innerText(),/Networking Topology|Add Rack|Rack name|Export JSON|Loading topology/);
  await act('rack');await page.locator('#nt-name').fill('Rack Alpha');await apply();
  await act('import');
  for(const name of ['SW-01','SW-02','SERVER-04U','SERVER-03U'])await page.locator(`input[name="inventory"][value="${name}"]`).check();
  await page.locator('#nt-template').selectOption('vera');await apply();
  assert.equal(await page.locator('.nt-device').count(),4);
  assert.match(await page.locator('.nt-toolbar').last().innerText(),/8 個節點/);
  await act('batch');await page.locator('#nt-role').selectOption('host');await apply();
  assert.equal(await page.locator('.nt-link').count(),2);
  await act('batch');await page.locator('#nt-role').selectOption('host');await apply();
  assert.match(await page.locator('#nt-message').innerText(),/已經接線/);
  await act('cancel');await confirm();
  await act('batch');await page.locator('#nt-switch').selectOption({label:'SW-02'});await page.locator('#nt-role').selectOption('dpu');await apply();
  assert.equal(await page.locator('.nt-link').count(),4);
  const serverCard=page.locator('.nt-device').filter({has:page.locator('.nt-card-head strong',{hasText:'SERVER-04U'})});
  await serverCard.locator('[data-action="focus"]').click();assert.equal(await page.locator('.nt-node').count(),4);
  assert.match(await page.locator('.nt-port').first().innerText(),/節點 1、節點 2、節點 3、節點 4/);
  await page.locator('.nt-node [data-action="edit-node"]').first().click();await page.locator('#nt-host_os').fill('192.0.2.77');await apply();
  await page.locator('.nt-node [data-action="edit-node"]').nth(1).click();await page.locator('#nt-host_os').fill('192.0.2.78');await apply();
  await act('link');
  await page.locator('#nt-a-device').selectOption({label:'SW-01'});await page.locator('#nt-a-port').selectOption({label:'48'});
  await page.locator('#nt-b-device').selectOption({label:'SW-02'});await page.locator('#nt-b-port').selectOption({label:'48'});
  await page.locator('#nt-network').selectOption('uplink');await page.locator('#nt-note').fill('Pending cabling confirmation');await apply();
  assert.equal(await page.locator('.nt-link').count(),5);
  await page.evaluate(()=>{const original=window.fetch;window.fetch=async (url,opts={})=>{if(String(url).endsWith('/topology')&&opts.method==='PUT'){window.fetch=original;return new Response(JSON.stringify({detail:'資料無法儲存'}),{status:503,headers:{'Content-Type':'application/json'}});}return original(url,opts);};});
  await act('save');await page.waitForFunction(()=>document.querySelector('#nt-message').textContent.includes('無法儲存'));
  assert.equal(await page.locator('.nt-link').count(),5);
  await act('save');await page.waitForFunction(()=>document.querySelector('.nt-save-state')?.textContent.includes('版本 1'));
  assert.equal(await page.locator('[data-action="ping"]').innerText(),'檢查 IP');
  await act('ping');await page.waitForFunction(()=>document.querySelector('.nt-ping-failed')?.textContent.includes('1 個 IP 無回應'));
  assert.match(await page.locator('.nt-ping-summary').innerText(),/5 個 IP[\s\S]*可達 4[\s\S]*無回應 1[\s\S]*不重複 IP 5/);
  assert.match(await serverCard.innerText(),/全部可達|部分可達/);
  assert.match(await serverCard.innerText(),/192\.0\.2\.77\s+全部可達[\s\S]*192\.0\.2\.78\s+無回應/);
  assert.match(await page.locator('.nt-ping-failures').innerText(),/SERVER-04U[\s\S]*節點 2[\s\S]*Host OS[\s\S]*192\.0\.2\.78/);
  await page.screenshot({path:path.join(artifact,'ping-partial.png')});
  await page.evaluate(()=>window.__qaTopologyAllUp=true);await act('ping');await page.waitForSelector('.nt-ping-success');
  assert.match(await page.locator('.nt-ping-success').innerText(),/全部 5 個 IP 皆可達/);
  await page.screenshot({path:path.join(artifact,'ping-all-reachable.png')});
  await page.evaluate(()=>window.__qaTopologyAllUp=false);await act('ping');await page.waitForSelector('.nt-ping-failed');
  await page.locator('#nt-ping-filter').selectOption('down');assert.ok(await page.locator('.nt-link').count()<5);
  await page.locator('#nt-ping-filter').selectOption('all');assert.equal(await page.locator('.nt-link').count(),5);
  await act('close');await page.evaluate(()=>PATopology.open('proj_k'));await page.waitForSelector('.nt-link');
  assert.equal(await page.locator('.nt-link').count(),5);
  await act('rack');await page.locator('#nt-name').fill('Rack Beta');await apply();assert.equal(await page.locator('.nt-device').count(),0);
  await act('device');await page.locator('#nt-name').fill('<img src=x onerror=alert(1)>');await page.locator('#nt-kind').selectOption('other');await apply();assert.equal(await page.locator('.nt-device img').count(),0);
  for(const [count,paired] of [[1,false],[2,true],[8,false]]){
   await act('device');await page.locator('#nt-name').fill('Custom-'+count);await page.locator('#nt-nodes').fill(String(count));await page.locator('#nt-paired').selectOption(paired?'yes':'no');await page.locator('#nt-dpu-label').fill('Custom DPU');await apply();
   const card=page.locator('.nt-device').filter({has:page.locator('.nt-card-head strong',{hasText:'Custom-'+count})});await card.locator('[data-action="focus"]').click();assert.equal(await page.locator('.nt-node').count(),count);assert.equal(await page.locator('.nt-port').count(),paired?2:1);
   assert.match(await page.locator('.nt-node').first().innerText(),paired?/Custom DPU #1/:/未配置 DPU/);
  }
  await act('device');await page.locator('#nt-name').fill('Vera-modified');await page.locator('#nt-template').selectOption('vera');await page.locator('#nt-nodes').fill('6');await apply();
  const modified=page.locator('.nt-device').filter({hasText:'Vera-modified'});assert.match(await modified.innerText(),/6 個節點/);
  await act('save');await page.waitForFunction(()=>document.querySelector('.nt-save-state')?.textContent.includes('版本 2'));
  await page.locator('#nt-rack').selectOption({label:'Rack Alpha'});assert.equal(await page.locator('.nt-link').count(),5);
  // A second writer advances the revision. The UI must retain its draft on 409.
  await page.evaluate(async()=>{const d=await api('/api/projects/proj_k/topology');await api('/api/projects/proj_k/topology',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});});
  await act('rename-rack');await page.locator('#nt-name').fill('Local draft');await apply();await act('save');
  await page.waitForFunction(()=>document.querySelector('#nt-message').textContent.includes('其他視窗'));
  assert.equal(await page.locator('#nt-rack option:checked').innerText(),'Local draft');
  await act('reload');await confirm();await page.waitForFunction(()=>document.querySelector('.nt-save-state')?.textContent.includes('版本 3'));
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.locator('.nt-window').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    await page.screenshot({path:path.join(artifact,`${theme}-${width}.png`)});
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  // Port deletion removes only its dependent cable and can be persisted.
  await page.locator('.nt-device').filter({hasText:'SERVER-04U'}).locator('[data-action="focus"]').click();
  await page.locator('.nt-port [data-action="delete-port"]').first().click();await confirm();assert.equal(await page.locator('.nt-link').count(),4);
  await act('save');await page.waitForFunction(()=>document.querySelector('.nt-save-state')?.textContent.includes('版本 4'));
  await act('close');await page.evaluate(()=>PATopology.open('fleet_l'));await page.waitForSelector('.nt-empty');assert.equal(await page.locator('.nt-device').count(),0);
  // The user's full rack size: 32 trays, 128 node/DPU pairs, 64 management cables.
  await page.evaluate(()=>{for(let i=1;i<=32;i++)machines.push({name:'TOPO-S'+i,project:'fleet_l',level:'rack',mgx_type:'server'});for(let i=1;i<=2;i++)machines.push({name:'TOPO-SW'+i,project:'fleet_l',level:'rack',mgx_type:'switch'});});
  await act('rack');await page.locator('#nt-name').fill('32-tray fixture');await apply();
  await act('import');await page.locator('#nt-template').selectOption('vera');
  for(const input of await page.locator('input[name="inventory"][value^="TOPO-"]').all())await input.check();
  await apply();assert.match(await page.locator('.nt-toolbar').last().innerText(),/128 個節點/);
  for(const [role,sw] of [['host','TOPO-SW1'],['dpu','TOPO-SW2']]){await act('batch');await page.locator('#nt-switch').selectOption({label:sw});await page.locator('#nt-role').selectOption(role);await apply();}
  assert.equal(await page.locator('.nt-link').count(),64);
  await page.locator('.nt-map g[role="button"]').filter({hasText:'TOPO-S1'}).first().click();assert.equal(await page.locator('.nt-node').count(),4);
  await page.screenshot({path:path.join(artifact,'32-tray-rack.png')});
  await act('save');await page.waitForFunction(()=>document.querySelector('.nt-save-state')?.textContent.includes('版本 1'));
  await act('close');assert.deepEqual(errors,[]);
  console.log('PASS topology browser: inventory/template, nodes, batch/manual wiring, IP check success/failure summary and filter, occupied ports, persistence, multi-rack/project isolation, stale-save draft, deletion, XSS escaping, responsive/theme screenshots; zero page errors');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
