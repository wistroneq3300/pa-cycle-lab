/* Desktop acceptance for the isolated fixture-backed application.
 * Run the loopback preview, then: node qa/acceptance.cjs
 * Set PA_PREVIEW_URL / PLAYWRIGHT_MODULE / CHROME_PATH to override local paths.
 * Artifacts are regenerated in qa/artifacts; screenshots never contain real data.
 * This is workflow/UI acceptance, not a production-backend integration test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright;
try { playwright=require('playwright'); }
catch { playwright=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const BASE=process.env.PA_PREVIEW_URL || 'http://127.0.0.1:8769';
const OUT=path.join(__dirname,'artifacts');
fs.mkdirSync(OUT,{recursive:true});
const results=[], pageErrors=[],consoleErrors=[],externalRequests=[];
let browser,context,page;
const detailTab=key=>page.locator('[data-pd-tab="'+key+'"]');
const action=(fragment,scope=page)=>scope.locator('button[onclick*="'+fragment+'"]');
const visibleRows=()=>page.locator('#proj-sort-list tbody tr:visible');
async function check(name,fn){
  const started=Date.now();
  try {const details=await fn();results.push({name,status:'passed',durationMs:Date.now()-started,...(details?{details}: {})});console.log('PASS '+name);}
  catch(error){results.push({name,status:'failed',durationMs:Date.now()-started,error:error.stack||String(error)});console.error('FAIL '+name+' — '+error.message);try{await page.screenshot({path:path.join(OUT,'failure-'+String(results.length).padStart(2,'0')+'.png')});}catch{}}
}
async function ready(){await page.waitForSelector('.nav-btn');await page.waitForFunction(()=>document.body.dataset.productView&&document.querySelector('#content').textContent.trim().length>50);}
async function go(hash='dashboard',query=''){
  // Hash-only navigation does not reset the in-memory service; each go starts a
  // clean sample so a previous workflow's successful mutations cannot leak.
  if(page.url().startsWith(BASE))await page.evaluate(()=>sessionStorage.clear());
  const response=await page.goto(BASE+'/'+query+'#/'+hash);
  if(!response)await page.reload();
  await ready();
}
async function detail(){await go('machine/host_a');await detailTab('overview').waitFor();}
async function projects(level='system'){
  await page.locator('.nav-btn[data-view="projects"]').click();
  await page.locator('.p-workspace-tabs button[onclick*="\''+level+'\'"]').click();
  await page.getByRole('textbox',{name:'搜尋專案與系統'}).fill('');
  await page.waitForSelector('#proj-sort-list');
}
async function closeDialog(){const close=page.locator('#rm-dialog .modal-head button').first();if(await close.isVisible())await close.click();}
async function noOverflow(label){
  const v=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(v.scroll<=v.client+1,label+' has horizontal overflow '+JSON.stringify(v));return v;
}
async function screenshot(name){await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true,animations:'disabled'});}
async function api(url,method='GET',body){return page.evaluate(async({url,method,body})=>{const r=await fetch(url,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};},{url,method,body});}
(async()=>{
  browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  page=await context.newPage();page.setDefaultTimeout(12000);
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text()+' @ '+msg.location().url);});
  page.on('request',req=>{if(/^https?:/.test(req.url())&&!req.url().startsWith(BASE))externalRequests.push(req.url());});
  page.on('dialog',dialog=>dialog.accept());
  await check('01 Dashboard desktop and fixture identity',async()=>{
    await go();assert.equal(await page.locator('.p-brand-logo').count(),1);
    await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready');
    const fixture=await page.evaluate(()=>({machines:PA_PREVIEW.machines.length,projects:PA_PREVIEW.projects.length}));
    assert.deepEqual(fixture,{machines:48,projects:6});assert.match(await page.locator('#content').innerText(),/L10/);assert.match(await page.locator('#content').innerText(),/L11/);await noOverflow('Dashboard');await page.screenshot({path:path.join(OUT,'dashboard-desktop-1600.png'),animations:'disabled'});
    const core=await page.locator('#system-core').elementHandle();
    for(const progress of [.45,.535]){
      await page.evaluate(p=>{const story=document.getElementById('core-story'),stage=document.getElementById('core-stage');window.scrollTo({top:story.getBoundingClientRect().top+scrollY-76+p*(story.offsetHeight-stage.offsetHeight),behavior:'instant'});},progress);
      await page.waitForFunction(p=>Math.abs(parseFloat(document.querySelector('#core-stage').style.getPropertyValue('--story-progress'))-p)<.002,progress);
      for(const id of ['core-system-copy','core-rack-copy']){const copy=page.locator('#'+id);assert.equal(await copy.evaluate(e=>e.inert),true,'Invisible '+id+' must be inert at '+progress);assert.equal(await copy.getAttribute('aria-hidden'),'true');assert.equal(await copy.locator('button').first().evaluate(e=>{e.focus();return document.activeElement===e;}),false);}
    }
    await page.evaluate(()=>{const story=document.getElementById('core-story'),stage=document.getElementById('core-stage');window.scrollTo({top:story.getBoundingClientRect().top+scrollY+story.offsetHeight-stage.offsetHeight-76,behavior:'instant'});});
    await page.waitForFunction(()=>parseFloat(document.querySelector('#core-stage').style.getPropertyValue('--story-progress'))>=.99);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await core.evaluate(e=>e===document.querySelector('#system-core')),true);await page.screenshot({path:path.join(OUT,'dashboard-rack-stage-1600.png'),animations:'disabled'});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>document.querySelector('#core-stage')?.dataset.phase==='system');assert.equal(await core.evaluate(e=>e===document.querySelector('#system-core')),true);await screenshot('dashboard-1600');return {...fixture,webgl:'ready',scrollTransition:'system → rack → system, same canvas'};
  });
  await check('02 L10 / L11 separation and OS/BMC columns',async()=>{
    await projects('system');assert.equal(await visibleRows().count(),12);
    assert.match(await page.locator('#proj-sort-list').innerText(),/192\.0\.2\.21/);assert.match(await page.locator('#proj-sort-list').innerText(),/198\.51\.100\.21/);
    await projects('rack');assert.equal(await visibleRows().count(),36);assert.equal(await page.locator('#sys-btn-addcomp').isVisible(),true);
    await projects('system');assert.equal(await page.locator('#sys-btn-broadcast').isVisible(),true);
  });
  await check('03 System/project search and no-results recovery',async()=>{
    const search=page.getByRole('textbox',{name:'搜尋專案與系統'});await search.fill('host_a');assert.equal(await visibleRows().count(),1);
    await search.fill('no-such-device');assert.equal(await visibleRows().count(),0);await search.fill('');assert.equal(await visibleRows().count(),12);
    try{await search.fill('fleet_l');assert.equal(await visibleRows().count(),4);}finally{await search.fill('');}
  });
  await check('04 Project collapse, expand and drag order',async()=>{
    await action('collapseAllProjects(true)').click();assert.equal(await visibleRows().count(),0);
    await action('collapseAllProjects(false)').click();assert.equal(await visibleRows().count(),12);
    const data=await page.evaluateHandle(()=>new DataTransfer());
    await page.locator('[data-pname="fleet_l"] .proj-card-head').dispatchEvent('dragstart',{dataTransfer:data});
    await page.locator('[data-pname="node_i"]').dispatchEvent('dragover',{dataTransfer:data});
    await page.locator('[data-pname="node_i"]').dispatchEvent('drop',{dataTransfer:data});
    await page.waitForFunction(()=>document.querySelector('#proj-sort-list .proj-card')?.dataset.pname==='node_i');
    const a=page.locator('[data-pname="fleet_l"] tbody tr').filter({hasText:'host_a'}),b=page.locator('[data-pname="fleet_l"] tbody tr').filter({hasText:'host_g'});
    await a.locator('.mach-drag').dispatchEvent('dragstart',{dataTransfer:data});
    const box=await b.boundingBox();await b.dispatchEvent('drop',{dataTransfer:data,clientY:box.y+box.height-1});
    await page.waitForFunction(()=>document.querySelector('[data-pname="fleet_l"] .mach-link')?.textContent.trim()==='host_g');
  });
  await check('05 Project create, rename and empty-project delete',async()=>{
    await action('openProjectModal').first().click();await page.locator('#new-project-name').fill('qa-project');await page.locator('#new-project-desc').fill('Local QA fixture');await page.locator('#project-add-btn').click();
    const row=page.locator('#project-list-body tr').filter({hasText:'qa-project'});await row.waitFor();assert.match(await row.innerText(),/0（R0\/S0）/);
    await row.locator('button[onclick*="editProjectStart"]').click();await page.locator('#new-project-name').fill('qa-project-renamed');await page.locator('#project-add-btn').click();
    await page.locator('#project-list-body tr').filter({hasText:'qa-project-renamed'}).getByRole('button',{name:'刪除',exact:true}).click();
    await page.locator('#rm-dialog-foot .primary').click();
    await page.waitForFunction(()=>!document.querySelector('#project-list-body').textContent.includes('qa-project-renamed'));
    await page.locator('#project-modal button[onclick="closeProjectModal()"]').click();
  });
  await check('06 Add system, scan, settings and delete',async()=>{
    await action('openAdd()').first().click();await page.locator('#save-btn').click();assert.equal(await page.locator('#add-err').isVisible(),true);
    await page.locator('#f-os-ip').fill('192.0.2.250');await page.locator('#f-os-user').fill('demo');await page.locator('#f-os-pass').fill('preview-only');await page.locator('#f-bmc-user').fill('demo');await page.locator('#f-bmc-pass').fill('preview-only');await page.locator('#f-project').selectOption('fleet_l');
    await page.locator('#probe-bmc-btn').click();await page.waitForFunction(()=>document.querySelector('#f-bmc-ip').value==='198.51.100.250');await page.locator('#save-btn').click();await page.locator('#add-modal').waitFor({state:'hidden'});
    assert.equal(await page.locator('.mach-link').filter({hasText:'demo-system-1'}).count(),1);
    await page.locator('#refresh-btn').click();await page.waitForFunction(()=>!document.querySelector('#refresh-btn').disabled);
    const row=page.locator('[data-pname="fleet_l"] tbody tr').filter({hasText:'demo-system-1'});await row.locator('summary').click();await row.locator('button[onclick*="changeOsIp"]').click();await page.locator('#new-os-ip-input').fill('192.0.2.251');await page.locator('#new-bmc-ip-input').fill('198.51.100.251');await page.locator('#ip-submit-btn').click();await page.locator('#rm-dialog-foot').getByRole('button',{name:'知道了'}).click();await page.waitForFunction(()=>document.querySelector('#proj-sort-list').textContent.includes('192.0.2.251'));
    await row.locator('summary').click();await row.locator('button[onclick*="deleteMachine"]').click();await page.locator('#rm-dialog-foot .primary').click();await page.waitForFunction(()=>!document.querySelector('#proj-sort-list').textContent.includes('demo-system-1'));
  });
  await check('07 Single-system five tabs, hardware and operations',async()=>{
    await detail();assert.equal(await page.locator('[data-pd-tab]').count(),5);
    for(const key of ['overview','hardware','sensors','telemetry','tasks']){await detailTab(key).click();assert.equal(await page.locator('#pd-panel-'+key).isVisible(),true);assert.equal(await detailTab(key).getAttribute('aria-selected'),'true');}
    await detailTab('hardware').click();const hardware=await page.locator('#pd-panel-hardware').innerText();for(const name of ['CPU','DIMM','SSD','GPU','NIC','Firmware'])assert.match(hardware,new RegExp(name,'i'));assert.match(hardware,/384/);
    const ops=await page.locator('.pd-operations').innerText();for(const label of ['Terminal','KVM','測試','診斷','Reboot'])assert.ok(ops.includes(label),label+' missing');
    await detailTab('overview').click();await screenshot('system-detail-1600');
  });
  await check('08 Sensors and diagnosis produce reports',async()=>{
    await detailTab('sensors').click();await page.waitForFunction(()=>document.querySelector('#sensor-body')?.textContent.includes('CPU1'));
    const analyze=action('sensorAnalyze');if(await analyze.count())await analyze.first().click();
    await page.waitForFunction(()=>document.querySelector('#sensor-ai')?.textContent.includes('模擬'));
    await detailTab('overview').click();await action('runDiagnose',page.locator('.pd-operations')).click();await page.waitForFunction(()=>document.querySelector('#diag-body')?.textContent.includes('模擬診斷'));
  });
  await check('09 All thirteen telemetry canvases and eight GPU series',async()=>{
    await detailTab('telemetry').click();await page.waitForFunction(()=>document.querySelectorAll('#tel-grid canvas').length===13&&[...document.querySelectorAll('#tel-grid canvas')].every(c=>c.clientWidth>0&&c.clientHeight>0));
    const charts=await page.evaluate(()=>[...document.querySelectorAll('#tel-grid canvas')].map(c=>({id:c.id,width:c.clientWidth,height:c.clientHeight,series:Chart.getChart(c)?.data.datasets.length,points:Chart.getChart(c)?.data.datasets[0]?.data.length})));
    assert.equal(charts.length,13);assert.ok(charts.every(c=>c.series>0&&c.points>0));assert.equal(charts.find(c=>c.id==='tel-gpu').series,8);
    await page.locator('#tel-select').selectOption('360');await page.waitForFunction(()=>document.querySelector('#tel-window')?.textContent.includes('6'));
    await detailTab('hardware').click();await detailTab('telemetry').click();assert.ok(await page.locator('#tel-cpu').evaluate(c=>c.clientWidth>0));return charts;
  });
  await check('10 Test library six categories and 3112 cases',async()=>{
    await detailTab('tasks').click();await page.waitForSelector('.pd-library-card');assert.equal(await page.locator('.pd-library-card').count(),6);
    assert.match(await page.locator('#pd-library-total').innerText(),/3112/);
    const meta=(await api('/api/testlibrary/meta')).data;assert.equal(meta.total,3112);assert.equal(meta.sheets.length,6);assert.equal(meta.sheets.reduce((s,x)=>s+x.count,0),3112);
    for(let i=0;i<6;i++){await page.locator('.pd-library-card').nth(i).click();await page.waitForSelector('#assign-q');const count=await page.evaluate(()=>_assignTask.items.length);assert.equal(count,meta.sheets[i].count);await closeDialog();}
    return meta.sheets.map(s=>({sheet:s.sheet,count:s.count}));
  });
  await check('11 48U rack placement, multi-U and topology',async()=>{
    await go('rack/proj_k');await page.getByRole('button',{name:'48U \u914d\u7f6e',exact:true}).click();await page.waitForSelector('.rm-rack');const units=await page.locator('.rm-u .mono').allTextContents();assert.equal(units.length,48);assert.equal(units[0],'U48');assert.equal(units.at(-1),'U1');assert.match(await page.locator('.rm-head-stat').innerText(),/48\/48/);
    assert.equal(await page.locator('.rm-row[data-u]').count(),35);assert.equal(await page.locator('.rm-empty-slot').count(),0);
    for(const [top,height]of [[40,4],[36,3],[33,2],[9,5],[4,4]])assert.equal(await page.locator('.rm-row[data-u="'+top+'"]').evaluate(e=>{const s=getComputedStyle(e);return Number(s.gridRowEnd)-Number(s.gridRowStart);}),height);
    await page.waitForSelector('.topo-svg');assert.equal(await page.locator('.topo-svg .topo-edge-group').count(),3);assert.equal(await page.locator('.topo-svg .topo-svg-node').count(),4);
    await screenshot('rack-workspace-1600');
  });
  await check('12 Rack component move, unmount, remount and add passive',async()=>{
    await page.locator('.rm-row[data-u="9"] button[title="從機櫃移除"]').click();await page.locator('#rm-dialog-foot .primary').click();await page.waitForFunction(()=>document.querySelector('.rm-head-stat')?.textContent.includes('43/48'));
    for(const [from,to]of [[48,9],[9,48]]){
      await page.locator('.rm-row[data-u="'+from+'"] button[title="機櫃位置"]').click();await page.locator('#rm-move-u').selectOption(String(to));await page.locator('#rm-dialog-foot').getByRole('button',{name:'儲存位置'}).click();await page.waitForSelector('.rm-row[data-u="'+to+'"] .rm-name');
      assert.equal((await api('/api/machines')).data.machines.find(m=>m.name==='BLANK-TOP-01').rack_u,to);
    }
    // Unmount only releases the position; its actual device height must survive.
    assert.equal((await api('/api/machines')).data.machines.find(m=>m.name==='BLANK-RESERVE-05U').rack_size,5);
    await page.locator('.rm-empty-slot[onclick="rackEmptyClick(9)"]').click();await page.locator('#rm-dialog-foot').getByRole('button',{name:'\u52a0\u5165\u65e2\u6709 L11',exact:true}).click();await page.locator('#rm-add-m').selectOption('BLANK-RESERVE-05U');assert.equal(await page.locator('#rm-add-size').inputValue(),'5');await page.locator('#rm-add-u').selectOption('9');await page.locator('#rm-dialog-foot').getByRole('button',{name:'加入',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.rm-head-stat')?.textContent.includes('48/48'));
    const restored=(await api('/api/machines')).data.machines.find(m=>m.name==='BLANK-RESERVE-05U');assert.equal(restored.rack_size,5);assert.equal(restored.rack_u,9);
    assert.equal((await api('/api/projects','POST',{name:'qa-components',desc:'Isolated component creation QA',level:'rack'})).status,200);await page.evaluate(()=>loadProjects());
    for(const [name,type,top,size]of [['QA-STORAGE','storage',48,1],['QA-NVLINK','nvlink',47,1],['QA-BLANK','blanking',46,5]]){
      await projects('rack');await page.locator('#sys-btn-addcomp').click();await page.locator('#rcp-proj').selectOption('qa-components');await page.locator('#rm-dialog-foot').getByRole('button',{name:/SW \/ PDU \/ CDU/}).click();await page.locator('#rp-name').fill(name);await page.locator('#rp-type').selectOption(type);assert.equal(await page.locator('#rp-size option').count(),48);assert.equal(await page.locator('#rp-type option[value="nvlink"]').textContent(),'\u21c4 NVLink Switch Tray');await page.locator('#rp-size').selectOption(String(size));await page.locator('#rp-u').selectOption(String(top));await page.locator('#rm-dialog-foot').getByRole('button',{name:'建立並加入'}).click();await page.waitForFunction(n=>machines.some(m=>m.name===n),name);
      const created=(await api('/api/machines')).data.machines.find(m=>m.name===name);assert.equal(created.mgx_type,type);assert.equal(created.rack_size,size);assert.equal(created.rack_u,top);assert.equal(created.project,'qa-components');
    }
  });
  await check('13 Rack list, telemetry kinds and time range',async()=>{
    await go('rack/proj_k');await action("devicesSetView('list')").first().click();assert.match(await page.locator('#content').innerText(),/SERVER-04U/);assert.match(await page.locator('#content').innerText(),/BLANK-RESERVE-05U/);assert.match(await page.locator('#content').innerText(),/NVLINK-01/);
    await action("devicesSetView('telemetry')").first().click();await page.waitForSelector('#racktel-grid canvas');assert.equal(await page.locator('#racktel-grid .rt-kind').count(),5);
    assert.ok(await page.locator('#racktel-grid canvas').count()>5);await page.locator('#racktel-select').selectOption('360');await page.waitForFunction(()=>document.querySelector('#racktel-window')?.textContent.includes('6'));
    assert.deepEqual((await page.locator('#racktel-grid .rt-kind').evaluateAll(es=>es.map(e=>e.dataset.kind))).sort(),['cdu','nvlink','powershelf','server','switch']);
    assert.equal(await page.locator('.rt-kind[data-kind="nvlink"] canvas').count(),0);assert.equal(await page.locator('.rt-kind[data-kind="nvlink"] .rt-kind-empty').isVisible(),true);
  });
  await check('14 Terminal preview modes and close',async()=>{
    await detail();await action('openTermDialog',page.locator('.pd-operations')).click();await page.locator('#rm-dialog-foot').getByRole('button',{name:'連接終端'}).click();await page.locator('#term-modal').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#term-os-status')?.textContent.includes('已連線'));
    assert.equal(await page.locator('#term-modal .xterm').count(),2);await page.locator('#term-mode-os').click();assert.ok((await page.locator('#term-modal-box').getAttribute('class')).includes('term-state-os'));await page.locator('#term-mode-both').click();await page.locator('#term-modal button[onclick="closeTerm()"]').click();
  });
  await check('15 Live KVM shell with isolated RFB stub and Broadcast preview',async()=>{
    // Exercise the real module's UI without connecting to equipment or fabricating a live framebuffer.
    await page.route('**/static/vendor/novnc/core/rfb.js',route=>route.fulfill({contentType:'text/javascript',body:'export default class RFB extends EventTarget { constructor(target){super();this._canvas=document.createElement("canvas");target.append(this._canvas);this._rfbConnectionState="disconnected";} disconnect(){} focus(){} sendKey(){} sendCtrlAltDel(){} _updateScale(){} }'}));
    await go('projects/fleet_l');await action('openKvmBroadcast').first().click();await page.locator('#kvm-overlay').waitFor();assert.equal(await page.locator('#kvm-grid .kvm-box').count(),4);
    for(const theme of ['light','dark']){await page.evaluate(t=>applyTheme(t),theme);assert.equal(await page.locator('#kvm-head').evaluate(e=>getComputedStyle(e).backgroundColor),theme==='light'?'rgb(229, 236, 238)':'rgb(27, 48, 59)');await screenshot('kvm-'+theme);}
    await page.locator('#kvm-overlay button[onclick="closeKvmBroadcast()"] ').click();await page.unroute('**/static/vendor/novnc/core/rfb.js');
    await projects('system');await page.locator('#sys-btn-broadcast').click();await page.locator('#rm-dialog-foot .primary').click();await page.locator('#bc-modal').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#bc-status-txt')?.textContent.includes('已就緒'));
    await page.locator('#bc-input').fill('echo preview');await page.locator('#bc-input').press('Enter');await page.waitForFunction(()=>[...document.querySelectorAll('[id^="bc-ack-"]')].some(e=>e.textContent==='✓'));await page.locator('#bc-modal button[onclick="closeBroadcast()"]').click();
  });
  await check('16 Fixture mutations respect API contracts',async()=>{
    const detailResponse=(await api('/api/machine/host_a/detail')).data;assert.equal(detailResponse.os_info.os.cpu,'384');assert.equal(detailResponse.os_info.os.mem,'1536 GB');
    const off=await api('/api/machine/host_a/power','POST',{on:false});assert.equal(off.data.power,'OFF');assert.equal(off.data.power_status,'Chassis Power is off');assert.equal((await api('/api/machine/host_a/detail')).data.machine.os_alive,false);
    await api('/api/machine/host_a/power','POST',{on:true});
    assert.equal((await api('/api/projects/fleet_l','DELETE')).status,409);
    const rename=await api('/api/projects/fleet_l','PATCH',{name:'fleet-renamed'});assert.equal(rename.status,200);assert.equal((await api('/api/machine/host_a/detail')).data.machine.project,'fleet-renamed');await api('/api/projects/fleet-renamed','PATCH',{name:'fleet_l'});
    assert.equal((await api('/api/machines/BLANK-RESERVE-05U','PATCH',{rack_u:44,rack_size:2})).status,400);
    assert.equal((await api('/api/machines/BLANK-RESERVE-05U/placement','PATCH',{rack_u:44,expected_project:'proj_k'})).status,409);
    assert.equal((await api('/api/links','POST',{a:'SERVER-04U',b:'SW-01'})).status,501);
    const tel=(await api('/api/machine/host_a/telemetry?minutes=360')).data;assert.equal(tel.gpu.series.length,8);assert.equal(tel.os.os.at(-1).ts-tel.os.os[0].ts,21600);
  });
  await check('17 Empty, loading and recoverable error states',async()=>{
    await go('projects','?preview=empty');assert.equal(await page.locator('.mach-link').count(),0);assert.match(await page.locator('#content').innerText(),/沒有|新增|尚無/);await screenshot('empty-state');
    await go('machine/host_a','?preview=loading');await page.waitForSelector('.pd-wait');assert.match(await page.locator('.pd-wait').innerText(),/準備|載入/);await detailTab('overview').waitFor();
    await go('machine/host_a','?preview=error');await page.waitForSelector('.pd-wait');await page.waitForFunction(()=>document.querySelector('.pd-wait')?.textContent.includes('暫時無法'));
    await screenshot('error-state');await page.locator('.pd-wait').getByRole('button',{name:'重新載入'}).click();await detailTab('overview').waitFor();
  });
  await check('18 Deep links and reload',async()=>{
    for(const hash of ['dashboard','projects/fleet_l','rack/proj_k','machine/host_a']){await go(hash);if(hash.startsWith('machine/'))await detailTab('overview').waitFor();await page.reload();await ready();assert.ok(page.url().includes('#/'+hash));if(hash.startsWith('machine/'))await detailTab('overview').waitFor();}
  });
  await check('19 Desktop 1440 / 1600 / 1920 widths',async()=>{
    const measurements=[];
    for(const width of [1440,1600,1920]){
      await page.setViewportSize({width,height:1000});
      for(const [hash,name]of [['dashboard','dashboard'],['projects/fleet_l','projects'],['machine/host_a','system-detail'],['rack/proj_k','rack-workspace']]){
        await go(hash);if(hash.startsWith('machine/'))await detailTab('overview').waitFor();if(hash.startsWith('rack/'))await page.waitForSelector('#ew-rack-canvas');
        measurements.push({width,view:name,...await noOverflow(name+' '+width)});if(name!=='projects')await screenshot(name+'-'+width);
      }
    }return measurements;
  });
  await check('20 Reduced-motion style and stable tables',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await go();assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    for(const id of ['core-system-copy','core-rack-copy']){const copy=page.locator('#'+id);assert.equal(await copy.getAttribute('aria-hidden'),'false');assert.equal(await copy.evaluate(e=>e.inert),false);assert.equal(await copy.locator('button').first().isVisible(),true);assert.equal(await copy.evaluate(e=>Number(getComputedStyle(e).opacity)),1);}
    const moving=await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().duration>1).map(a=>({duration:a.effect.getComputedTiming().duration,target:a.effect.target?.className})));
    assert.deepEqual(moving,[],'Long animations remain running under reduced-motion');
    await projects('system');const table=page.locator('#proj-sort-list table').first();await table.hover();assert.equal(await table.evaluate(e=>getComputedStyle(e).transform),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  });
  await check('21 WebGL unavailable: static fallback remains usable',async()=>{
    const fallback=await context.newPage(),errors=[];fallback.on('pageerror',e=>errors.push(e.message));
    try{
      await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl|experimental-webgl/.test(type)?null:original.call(this,type,...args);};});
      await fallback.goto(BASE+'/#/dashboard');await fallback.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='fallback');
      assert.equal(await fallback.locator('#core-visual').evaluate(e=>e.classList.contains('is-rendered')),false);assert.equal(await fallback.locator('.cine-fallback').isVisible(),true);
      await fallback.locator('#core-system-copy .primary').click();await fallback.waitForSelector('#proj-sort-list');assert.equal(await fallback.locator('#proj-sort-list tbody tr:visible').count(),12);assert.deepEqual(errors,[]);
    }finally{await fallback.close();}
  });
  await check('22 Failed WebGL restoration stays in fallback without draw errors',async()=>{
    const restoration=await context.newPage(),errors=[];restoration.on('pageerror',e=>errors.push(e.message));
    try{
      await restoration.goto(BASE+'/#/dashboard');await restoration.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready');
      const supported=await restoration.evaluate(()=>{const c=document.getElementById('system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;window.__qaContextExtension=ext;gl.createProgram=()=>{throw new Error('Injected restore failure');};ext.loseContext();return true;});
      assert.equal(supported,true,'Test browser must expose WEBGL_lose_context');
      await restoration.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='fallback');
      await restoration.evaluate(()=>window.__qaContextExtension.restoreContext());
      await restoration.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreError?.includes('Injected restore failure'));
      await restoration.setViewportSize({width:1440,height:1000});await restoration.mouse.wheel(0,350);await restoration.mouse.move(850,400);await restoration.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await restoration.locator('#core-visual').evaluate(e=>e.classList.contains('is-rendered')),false);assert.deepEqual(errors,[]);
      await restoration.locator('.nav-btn[data-view="projects"]').click();await restoration.waitForSelector('#proj-sort-list');assert.equal(await restoration.locator('#proj-sort-list tbody tr:visible').count(),12);
    }finally{await restoration.close();}
  });
  await check('23 Browser errors and external requests',async()=>{assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);return {pageErrors,consoleErrors,externalRequests};});
  await go();
  const report={generatedAt:new Date().toISOString(),baseURL:BASE,browser:await browser.version(),results,pageErrors,consoleErrors,externalRequests};
  fs.writeFileSync(path.join(OUT,'acceptance.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(OUT,'acceptance.md'),'# Desktop acceptance\n\n'+results.map(r=>'- '+(r.status==='passed'?'PASS':'FAIL')+' — '+r.name+(r.error?'\n  '+r.error.split('\n')[0]:'')).join('\n')+'\n\nFixture-only acceptance. No production equipment or original repository was used.\n');
  await browser.close();console.log('\n'+results.filter(r=>r.status==='passed').length+'/'+results.length+' groups passed. '+OUT);process.exitCode=results.some(r=>r.status==='failed')?1:0;
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exitCode=1;});
