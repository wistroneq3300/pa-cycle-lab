/* Saved topology -> 3D side ducts and Rack Ping LEDs. Synthetic loopback fixture only. */
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const runtime=process.env.CODEX_DEPENDENCIES||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(runtime,'node/node_modules/playwright'));
const {PNG}=require(process.env.PNGJS_MODULE||path.join(runtime,'node/node_modules/pngjs'));
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'artifacts/rack-network-led');

function changingStatusPixels(before,after){
 const a=PNG.sync.read(before),b=PNG.sync.read(after);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 const isStatus=(d,i)=>(d[i+1]>55&&d[i+1]>d[i]*1.25&&d[i+1]>d[i+2]*1.20)||(d[i]>75&&d[i]>d[i+1]*1.50&&d[i]>d[i+2]*1.25);
 let changes=0;
 for(let i=0;i<a.data.length;i+=4)if((isStatus(a.data,i)||isStatus(b.data,i))&&[0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>3))changes++;
 return changes;
}

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=cp.spawn(process.env.PYTHON_PATH||path.join(runtime,'python/python.exe'),['-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});
 let browser,page;const checks=[],errors=[],external=[];
 try{
  const port=await new Promise((resolve,reject)=>{
   let stdout='',stderr='';const timeout=setTimeout(()=>reject(Error('Fixture preview startup timed out')),10000);
   server.stderr.on('data',data=>stderr=(stderr+data).slice(-2000));
   server.stdout.on('data',data=>{stdout+=data;const match=stdout.match(/^([0-9]+)\r?\n/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});
   server.once('error',error=>{clearTimeout(timeout);reject(error);});
   server.once('exit',code=>{clearTimeout(timeout);reject(Error(`Fixture preview exited (${code}): ${stderr}`));});
  });
  const base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'no-preference'});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(base+'/'))external.push(request.url());});
  const state=()=>page.evaluate(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState());
  const ready=()=>page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
  const routeCount=count=>page.waitForFunction(count=>document.querySelector('#ew-rack-canvas')?.paRackScene?.getState().networkCabling?.routeCount===count,count);
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const canvas=page.locator('#ew-rack-canvas');
  const api=(url,method='GET',body)=>page.evaluate(async({url,method,body})=>{
   if(!window.PA_PREVIEW)throw Error('Fixture mode required');
   const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,data:await response.json()};
  },{url,method,body});

  await page.goto(base+'/?preview=rack-network#/rack/Naboo');await ready();await routeCount(69);await settle();
  assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true);
  const saved=(await api('/api/projects/Naboo/topology')).data;
  const devices=saved.racks.flatMap(r=>r.devices),servers=devices.filter(d=>d.kind==='server');
  assert.equal(servers.length,32);assert.ok(servers.every(d=>d.nodes.length===4),'Every server retains four nodes');
  assert.ok(servers.every(d=>d.ports.length===2&&d.ports.every(p=>p.nodes.length===4)),'Both shared RJ45 ports must map all four nodes');
  let scene=await state();
  assert.equal(scene.networkCabling.routeCount,69);assert.equal(scene.networkCabling.skipped.length,0);
  assert.deepEqual(scene.networkCabling.ducts.map(d=>d.side).sort(),['left','right']);
  assert.equal(scene.networkCabling.routes.filter(r=>r.network==='host').length,32);
  assert.equal(scene.networkCabling.routes.filter(r=>r.network==='dpu').length,32);
  assert.equal(scene.networkCabling.routes.filter(r=>r.network==='uplink').length,1);
  assert.equal(scene.networkCabling.routes.filter(r=>r.network==='power').length,3);
  assert.equal(scene.networkCabling.routes.filter(r=>r.network==='cooling').length,1);
  assert.ok(scene.networkCabling.routes.filter(r=>['power','cooling'].includes(r.network)).every(r=>r.side==='left'));
  for(const server of servers){
   const inventory=server.inventory_name||server.inventory;
   assert.equal(scene.networkCabling.routes.filter(r=>r.from.inventory===inventory||r.to.inventory===inventory).length,2,`${inventory}: two physical cables, independent of four logical nodes`);
  }
  for(const route of scene.networkCabling.routes){
   assert.ok(route.path.length>=4,`${route.id}: should bend into the side duct`);
   assert.ok(route.path.flat().every(Number.isFinite),`${route.id}: all route coordinates finite`);
   const duct=scene.networkCabling.ducts.find(d=>d.side===route.side);assert.ok(duct,`${route.id}: valid side duct`);
   for(let i=1;i<route.path.length;i++){
    const a=route.path[i-1],b=route.path[i];
    if(Math.abs(a[1]-b[1])>.2)assert.ok(Math.min(Math.abs(a[0]),Math.abs(b[0]))>=1.9,`${route.id}: vertical cable must remain beside equipment faces`);
   }
  }
  const powered=scene.placements.filter(p=>p.type!=='blanking');
  assert.equal(scene.pingIndicators.length,powered.length);
  assert.ok(scene.pingIndicators.every(p=>p.side==='right'&&p.position[0]>0));
  const switchIndicators=scene.pingIndicators.filter(p=>p.type==='switch');
  assert.ok(switchIndicators.length>0&&switchIndicators.every(p=>p.local[0]-p.outerRadius>1.6835),'Switch Ping LEDs must sit on the right service strip without covering the QSFP port matrix');
  assert.ok(switchIndicators.every(p=>p.local[0]===1.75&&p.local[1]>.06),'Switch Ping LEDs preserve the approved upper-right position, clear of the cable endpoint');
  const shelfIndicators=scene.pingIndicators.filter(p=>p.type==='powershelf');
  assert.equal(shelfIndicators.length,3,'Every installed Power Shelf needs its own Ping LED');
  assert.ok(shelfIndicators.every(p=>p.local[0]===1.886&&p.radius>=.035),'Power Shelf LEDs retain their approved right-side location and a readable optical aperture');
  assert.ok(scene.pingIndicators.every(p=>Number.isFinite(p.surfaceZ)&&p.local[2]>p.surfaceZ&&p.local[2]-p.surfaceZ<=.01),'Every lens must sit within .01 of its own equipment skin instead of floating on a raised pod');
  for(const indicator of [...switchIndicators,...shelfIndicators]){
   const placed=scene.placements.find(p=>p.name===indicator.name),h=placed.size*.30-.026;
   const expectedY=Math.max(-h/2+.062,Math.min(h/2-.062,h/2-(indicator.type==='switch'?.060:.090)));
   assert.ok(Math.abs(indicator.local[1]-expectedY)<1e-10,`${indicator.name}: approved vertical LED position stays unchanged`);
  }
  assert.ok(shelfIndicators.every(p=>p.local[0]-p.outerRadius>1.817&&p.local[0]+p.outerRadius<1.955),'The complete Power Shelf LED bezel must fit between the last fan cartridge and chassis edge');
  assert.ok(scene.pingIndicators.every(p=>p.state==='unknown'&&p.color==='gray'&&!p.animated),'Inventory os_alive/power alone must not fabricate a Rack Ping result');
  assert.ok(scene.pingIndicators.some(p=>p.name==='CDU-1-main'),'External CDU needs a status LED');
  assert.ok(!scene.pingIndicators.some(p=>/blank/i.test(p.name)),'Passive blank panels must never receive LEDs');
  checks.push('Saved topology becomes 69 physical cables: 64 shared server RJ45, one switch interconnect, three Power Shelf and one CDU management cable; power/cooling use the left duct and passive panels have no LED');

  await page.locator('#ew-network-toggle').click();await settle();assert.equal((await state()).networkCabling.visible,false);
  assert.equal((await state()).networkCabling.routeCount,69,'Hiding cable geometry must not change saved connections');
  await page.locator('#ew-network-toggle').click();await settle();assert.equal((await state()).networkCabling.visible,true);
  await page.locator('#rack-ping-btn').click();
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.paRackScene.getState().pingIndicators.some(p=>p.name==='naboo-01'&&p.state==='up'));
  await ready();await routeCount(69);await settle();scene=await state();
  const expected={'naboo-01':['up','green'],'naboo-02':['partial','red'],'naboo-03':['down','red'],'naboo-04':['unknown','gray'],'Switch-2201-1':['up','green'],'Switch-2201-2':['down','red'],'power-shelf-1':['up','green'],'power-shelf-2':['down','red'],'power-shelf-3':['unknown','gray'],'CDU-1-main':['up','green']};
  for(const [name,pair] of Object.entries(expected)){
   const led=scene.pingIndicators.find(p=>p.name===name);assert.ok(led,`${name}: LED exists`);assert.deepEqual([led.state,led.color],pair,`${name}: Rack Ping maps to the expected LED`);
  }
  assert.match(await page.locator('#rack-ping-summary').innerText(),/\u53ef\u9054 32[\s\S]*\u6709 IP \u7121\u56de\u61c9 4[\s\S]*\u672a\u6aa2\u67e5\uff0f\u672a\u8a2d IP 2/,'Summary agrees with the four-node LEDs and excludes passive panels');
  assert.match(await page.locator('#rack-ping-failures').innerText(),/naboo-02[\s\S]*Node 4[\s\S]*10\.250\.2\.4/);
  assert.match(await page.locator('#rack-ping-failures').innerText(),/Switch-2201-2[\s\S]*192\.0\.2\.43/);
  assert.match(await page.locator('#rack-ping-failures').innerText(),/power-shelf-2[\s\S]*192\.0\.2\.52/);
  await page.locator('.rack-ping-result').screenshot({path:path.join(out,'rack-ping-failures.png')});
  const summaryBounds=await page.locator('.rack-ping-result').boundingBox(),canvasBounds=await canvas.boundingBox();
  assert.ok(summaryBounds.y+summaryBounds.height<=canvasBounds.y,'Rack Ping failures must remain above the 3D canvas');
  await page.screenshot({path:path.join(out,'rack-ping-layout-1600.png')});
  checks.push('Real Rack Ping button uses synthetic response: all four OS targets up -> green, any failed node -> red, no IP -> gray; switch/CDU/power-shelf management IPs are represented');

  await page.evaluate(()=>equipmentRackCamera('front'));await page.locator('#ew-rack-component').selectOption('naboo-01');await page.evaluate(()=>equipmentRackFocus());await settle();
  const before=await canvas.screenshot();await page.waitForTimeout(410);const after=await canvas.screenshot();
  const changes=changingStatusPixels(before,after);assert.ok(changes>2,`Green status LED should visibly pulse (${changes} changing red/green pixels)`);
  await page.emulateMedia({reducedMotion:'reduce'});await settle();scene=await state();assert.ok(scene.pingIndicators.every(p=>!p.animated));
  const stillBefore=await canvas.screenshot();await page.waitForTimeout(410);const stillAfter=await canvas.screenshot();assert.ok(changingStatusPixels(stillBefore,stillAfter)<=2,'Reduced motion holds LED color without blinking');
  await page.emulateMedia({reducedMotion:'no-preference'});await settle();assert.ok((await state()).pingIndicators.some(p=>p.name==='naboo-01'&&p.animated));
  await canvas.evaluate(el=>el.style.transform='translateY(3000px)');
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState().pingIndicators.every(p=>!p.animated));
  await canvas.evaluate(el=>el.style.removeProperty('transform'));
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState().pingIndicators.some(p=>p.animated));
  await page.evaluate(()=>equipmentRackCamera('rear'));await settle();assert.ok((await state()).pingIndicators.every(p=>!p.animated),'Invisible front LEDs must not animate in rear view');
  checks.push({check:'LED pixels blink; reduced motion, offscreen and rear view stop the animation',changingStatusPixels:changes});

  await page.evaluate(()=>{
   const gl=document.querySelector('#ew-rack-canvas').getContext('webgl');window.__qaNetworkContext=gl.getExtension('WEBGL_lose_context');
   if(!window.__qaNetworkContext)throw Error('Chrome must support WebGL context lifecycle checks');window.__qaNetworkContext.loseContext();
  });
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState().contextLost);
  assert.ok((await state()).pingIndicators.every(p=>!p.animated));
  await page.evaluate(()=>__qaNetworkContext.restoreContext());await ready();await routeCount(69);await page.evaluate(()=>equipmentRackCamera('front'));await settle();
  assert.equal((await state()).pingIndicators.find(p=>p.name==='naboo-02').color,'red','Restoration preserves the last real Ping result');
  checks.push('WebGL context loss stops LED animation; restoration rebuilds saved cables and Ping colors');

  for(const theme of ['light','dark']){
   await page.evaluate(t=>applyTheme(t),theme);
   for(const view of ['front','rear','perspective']){
    await page.evaluate(v=>equipmentRackCamera(v),view);await settle();
    await page.locator('.ew-rack-deck').screenshot({path:path.join(out,`${theme}-${view}-1600.png`)});
   }
   for(const width of [390,320]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>equipmentRackCamera('front'));await settle();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${theme} ${width}px page fits`);
    const bounds=await canvas.boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,`${width}px canvas fits`);
    await canvas.screenshot({path:path.join(out,`${theme}-front-${width}.png`)});
   }
   await page.setViewportSize({width:1600,height:1100});
  }
  checks.push('3D cables and LEDs fit desktop/front/rear/perspective and 390/320px light/dark layouts');


  // Freeze the pulse for repeatable close-ups, keeping the saved routes visible.
  // setView resets the previous focus before selecting each device, and a final
  // reset prevents focused camera state from leaking into lifecycle checks.
  await page.emulateMedia({reducedMotion:'reduce'});
  const finishes=[['Switch-2201-1','switch-green'],['Switch-2201-2','switch-red'],['power-shelf-1','power-shelf-green'],['power-shelf-2','power-shelf-red'],['power-shelf-3','power-shelf-gray'],['naboo-01','server-green']];
  for(const theme of ['light','dark']){
   await page.evaluate(t=>applyTheme(t),theme);
   for(const [name,label] of finishes)for(const view of theme==='light'?['front','perspective']:['front']){
    await page.evaluate(v=>equipmentRackCamera(v),view);
    await page.locator('#ew-rack-component').selectOption(name);
    await page.evaluate(()=>equipmentRackFocus());await settle();
    const focused=await state();assert.equal(focused.focus,name);
    assert.equal(focused.networkCabling.visible,true,'Focused finish review must include the saved cable geometry');
    await canvas.screenshot({path:path.join(out,`finish-${theme}-${label}-${view}.png`)});
   }
  }
  await page.evaluate(()=>equipmentRackCamera('front'));await page.locator('#ew-rack-component').selectOption('naboo-01');
  await page.emulateMedia({reducedMotion:'no-preference'});await settle();
  assert.equal((await state()).focus,'','Finish close-ups must not leave the next lifecycle checks focused');
  checks.push('Integrated lens finish close-ups cover Switch green/red, Power Shelf green/red/gray and Server in light/dark; shallow contact geometry retains approved centers and clears ports/fans');

  // A saved topology notification should update this exact scene without reopening it.
  const changed=structuredClone(saved);changed.racks[0].links.pop();
  const updated=await api('/api/projects/Naboo/topology','PUT',changed);assert.equal(updated.status,200);
  await page.evaluate(document=>{window.__qaSceneBeforeSave=window.document.querySelector('#ew-rack-canvas').paRackScene;dispatchEvent(new CustomEvent('pa-topology-saved',{detail:{project:'Naboo',document}}));},updated.data);
  await routeCount(68);assert.equal(await page.evaluate(()=>__qaSceneBeforeSave===document.querySelector('#ew-rack-canvas').paRackScene),true);
  assert.ok((await state()).pingIndicators.every(p=>p.state==='unknown'),'Saved topology invalidates the previous Rack Ping results');
  checks.push('Successful topology save immediately refreshes cables and clears outdated Ping LEDs without remounting the scene');

  await page.evaluate(()=>{window.__qaOldScene=document.querySelector('#ew-rack-canvas').paRackScene;rackSetProject('proj_k');});await ready();await routeCount(0);
  assert.equal(await page.evaluate(()=>__qaOldScene.getState().disposed),true);
  assert.equal((await state()).networkCabling.ducts.length,0,'A rack without saved cables must not render empty cable ducts');
  assert.ok((await state()).pingIndicators.every(p=>p.state==='unknown'),'Other project cannot inherit Naboo Ping');
  await page.evaluate(()=>rackSetProject('Naboo'));await ready();await routeCount(68);
  checks.push('Switching projects disposes old scene and keeps saved cable/Ping state scoped to its project');

  // Simulate a transport which resolves despite abort. A late answer from the
  // previous project must never write cable geometry or green LEDs into another.
  async function holdResponse(kind){
   await page.evaluate(kind=>{
    const original=window.fetch;window.__qaHeld=false;window.__qaReleased=false;
    window.__qaRestoreFetch=()=>{window.fetch=original;};
    window.fetch=async(input,options)=>{
     const response=await original(input,options),url=String(input);
     if(!window.__qaHeld&&(kind==='topology'?url.endsWith('/projects/Naboo/topology'):url.includes('/api/rack/ping?project=Naboo'))){
      window.__qaHeld=true;await new Promise(resolve=>window.__qaRelease=resolve);window.__qaReleased=true;
     }
     return response;
    };
   },kind);
  }
  await holdResponse('topology');await page.evaluate(()=>rackSetProject('Naboo'));await page.waitForFunction(()=>window.__qaHeld);
  await page.evaluate(()=>rackSetProject('proj_k'));await ready();await routeCount(0);await page.evaluate(()=>__qaRelease());await page.waitForFunction(()=>window.__qaReleased);await settle();
  assert.equal((await state()).networkCabling.routeCount,0,'Late topology response must not populate another project');await page.evaluate(()=>__qaRestoreFetch());
  await page.evaluate(()=>rackSetProject('Naboo'));await ready();await routeCount(68);await holdResponse('ping');
  await page.evaluate(()=>{void rackPing('Naboo');});await page.waitForFunction(()=>window.__qaHeld);
  await page.evaluate(()=>rackSetProject('proj_k'));await ready();await routeCount(0);await page.evaluate(()=>__qaRelease());await page.waitForFunction(()=>window.__qaReleased);await settle();
  assert.ok((await state()).pingIndicators.every(p=>p.state==='unknown'),'Late Rack Ping result must not illuminate another project');await page.evaluate(()=>__qaRestoreFetch());
  checks.push('Delayed topology and Rack Ping responses are ignored after changing project, even when the transport ignores abort');

  await page.evaluate(()=>rackSetProject('Naboo'));await ready();await routeCount(68);await holdResponse('ping');
  await page.locator('#rack-ping-btn').click();await page.waitForFunction(()=>window.__qaHeld);assert.equal(await page.locator('#rack-ping-btn').isDisabled(),true);
  const latest=(await api('/api/projects/Naboo/topology')).data;
  const savedDuringPing=await api('/api/projects/Naboo/topology','PUT',latest);assert.equal(savedDuringPing.status,200);
  await page.evaluate(document=>dispatchEvent(new CustomEvent('pa-topology-saved',{detail:{project:'Naboo',document}})),savedDuringPing.data);
  assert.equal(await page.locator('#rack-ping-btn').isDisabled(),false,'Saving topology during Ping must restore the button immediately');
  await page.evaluate(()=>__qaRelease());await page.waitForFunction(()=>window.__qaReleased);await settle();
  assert.ok((await state()).pingIndicators.every(p=>p.state==='unknown'),'A pre-save Ping response cannot overwrite saved topology invalidation');
  assert.match(await page.locator('#rack-ping-summary').innerText(),/\u53ef\u9054 0[\s\S]*\u6709 IP \u7121\u56de\u61c9 0[\s\S]*\u672a\u6aa2\u67e5\uff0f\u672a\u8a2d IP 38/);
  await page.evaluate(()=>__qaRestoreFetch());checks.push('Saving topology while Ping is running resets the button, clears the summary/LEDs and ignores the superseded response');
  assert.deepEqual(errors,[],'No browser script/console errors');assert.deepEqual(external,[],'No request leaves isolated loopback fixture');
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks,errors,external},null,2));
  console.log(JSON.stringify({passed:true,checks},null,2));
 }catch(error){
  console.error(JSON.stringify({completed:checks,errors},null,2));
  if(page){console.error(JSON.stringify(await page.evaluate(()=>document.querySelector('#ew-rack-canvas')?.paRackScene?.getState()).catch(()=>null),null,2));await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}
  throw error;
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
