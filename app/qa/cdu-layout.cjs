/* Local fixtures only: CDU placement, conflict handling and real WebGL pixels. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8879';
const out=path.join(__dirname,'artifacts');
const {PNG}=require(process.env.PNGJS_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
function pixelChanges(a,b){const x=PNG.sync.read(a),y=PNG.sync.read(b);assert.equal(x.width,y.width);assert.equal(x.height,y.height);let changed=0;for(let i=0;i<x.data.length;i+=4)if([0,1,2,3].some(c=>Math.abs(x.data[i+c]-y.data[i+c])>2))changed++;return changed;}
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1600,height:1100}});
 const page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(base))external.push(request.url());});
 const ready=()=>page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
 const state=()=>page.evaluate(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState());
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const api=(url,method='GET',body)=>page.evaluate(async({url,method,body})=>{const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};},{url,method,body});
 const close=()=>page.locator('#rm-dialog .modal-head button').click();
 const save=()=>page.locator('#rm-dialog-foot .primary').click();
 const inventory=async()=> (await api('/api/machines')).data.machines;
 const sync=()=>page.evaluate(async()=>{await loadProjects();await loadMachines(false);setView('rack');});
 try{
  await page.goto(base+'/#/rack/proj_k');await ready();await settle();
  assert.equal(await page.evaluate(()=>Boolean(window.PA_PREVIEW)),true,'Never run against live backend');
  const initial=await state(),cdu=initial.placements.find(p=>p.name==='CDU-01'),blank=initial.placements.find(p=>p.name==='BLANK-BOTTOM-04U');
  assert.deepEqual(cdu,{name:'CDU-01',type:'cdu',top:0,bottom:0,size:0,external:true});
  assert.equal(blank.type,'blanking');assert.equal(blank.top,4);assert.equal(blank.bottom,1);assert.equal(initial.occupiedU,48);assert.equal(initial.cooling.mode,'external');
  await page.locator('#ew-rack-add').click();
  assert.equal(await page.locator('#rm-dialog-foot').getByRole('button',{name:'\u7de8\u8f2f CDU',exact:true}).count(),1);
  assert.equal(await page.locator('#rm-dialog-foot').getByRole('button',{name:'\u65b0\u589e CDU',exact:true}).count(),0);
  await page.locator('#rm-dialog-foot').getByRole('button',{name:'\u7de8\u8f2f CDU',exact:true}).click();
  assert.equal(await page.locator('#cdu-mount').inputValue(),'external');assert.equal(await page.locator('#cdu-size').count(),0);assert.equal(await page.locator('#cdu-name').getAttribute('readonly'),'');
  assert.equal(await page.locator('#cdu-placement select,#cdu-placement input').count(),0,'External CDU never asks for a U size or slot');
  await page.locator('#cdu-mount').selectOption('internal');
  assert.equal(await page.locator('#cdu-size').inputValue(),'4');assert.equal(await page.locator('#rm-dialog-foot .primary').isDisabled(),true);
  assert.match(await page.locator('#cdu-message').innerText(),/BLANK-BOTTOM-04U/);
  assert.equal(await page.locator('#rm-move-u,#rp-u').count(),0,'Internal CDU has no arbitrary position selector');
  await page.locator('#cdu-mount').selectOption('external');assert.equal(await page.locator('#cdu-size').count(),0);assert.equal(await page.locator('#rm-dialog-foot .primary').isEnabled(),true);
  await save();await page.waitForSelector('#rm-dialog',{state:'hidden'});await ready();
  assert.equal((await inventory()).filter(m=>m.project==='proj_k'&&m.mgx_type==='cdu').length,1);
  const duplicate=await api('/api/rack/passive','POST',{name:'QA-DUPLICATE-CDU',project:'proj_k',mgx_type:'cdu',rack_mount:'external'});
  assert.equal(duplicate.status,409);assert.equal((await inventory()).some(m=>m.name==='QA-DUPLICATE-CDU'),false);
  results.push('Full 48U rack supports one external CDU without a U field; duplicate add rejected and internal collision names the blocking blank');

  // Deliberately free only this fixture panel, then verify the actual edit flow.
  assert.equal((await api('/api/machines/BLANK-BOTTOM-04U','PATCH',{rack_u:0})).status,200);await sync();await ready();
  await page.locator('#ew-rack-add').click();await page.locator('#rm-dialog-foot').getByRole('button',{name:'\u7de8\u8f2f CDU',exact:true}).click();
  await page.locator('#cdu-mount').selectOption('internal');await page.locator('#cdu-size').selectOption('4');assert.equal(await page.locator('#rm-dialog-foot .primary').isEnabled(),true);
  await save();await page.waitForSelector('#rm-dialog',{state:'hidden'});await ready();
  const internal=(await inventory()).find(m=>m.name==='CDU-01');assert.equal(internal.rack_mount,'internal');assert.equal(internal.rack_u,4);assert.equal(internal.rack_size,4);assert.equal((await state()).cooling.mode,'internal');
  const floating=await api('/api/machines/CDU-01','PATCH',{rack_u:8});assert.equal(floating.status,400);assert.equal((await inventory()).find(m=>m.name==='CDU-01').rack_u,4);
  await page.getByRole('button',{name:'\u80cc\u9762',exact:true}).click();await settle();await page.locator('#ew-rack-canvas').screenshot({path:path.join(out,'cdu-internal-rear.png')});
  results.push('Internal CDU occupies exactly U1-U4, floating placement rejected, pipes reconnect to internal CDU');

  // New external CDU from the real plus chooser, in a separate empty project.
  assert.equal((await api('/api/projects','POST',{name:'qa-cdu-empty',level:'rack'})).status,200);await sync();
  await page.evaluate(()=>{rackView.project='qa-cdu-empty';rackAddEntry(32);});
  await page.locator('#rm-dialog-foot').getByRole('button',{name:'\u65b0\u589e CDU',exact:true}).click();
  await page.locator('#cdu-name').fill('ANY-VENDOR-CDU');await page.locator('#cdu-mount').selectOption('external');assert.equal(await page.locator('#cdu-size').count(),0);
  await save();await page.waitForSelector('#rm-dialog',{state:'hidden'});await ready();
  const created=(await inventory()).find(m=>m.name==='ANY-VENDOR-CDU');assert.equal(created.rack_mount,'external');assert.equal(created.rack_u,0);assert.equal(created.rack_size,0);assert.equal(created.project,'qa-cdu-empty');
  assert.equal((await state()).occupiedU,0);assert.equal((await state()).cooling.mode,'external');
  results.push('Generic external CDU creates from Rack plus in an empty project, with zero U occupancy and no model restriction');

  await page.goto(base+'/#/rack/proj_k');await page.reload();await ready();await page.getByRole('button',{name:'\u80cc\u9762',exact:true}).click();await settle();
  const canvas=page.locator('#ew-rack-canvas');
  assert.equal((await state()).cooling.flowEnabled,true);
  const moving1=await canvas.screenshot();await page.waitForTimeout(240);const moving2=await canvas.screenshot();
  assert.ok(pixelChanges(moving1,moving2)>100,'Water-flow animation must visibly change actual rear-view pixels');
  await page.locator('#ew-flow-toggle').click();await settle();assert.equal((await state()).cooling.flowEnabled,false);
  const still1=await canvas.screenshot();await page.waitForTimeout(240);const still2=await canvas.screenshot();assert.ok(pixelChanges(still1,still2)<=10,'Paused flow must render stable geometry (allow at most 10 antialias pixels)');
  await page.locator('#ew-flow-toggle').click();await settle();assert.equal((await state()).cooling.flowEnabled,true);
  await page.emulateMedia({reducedMotion:'reduce'});await settle();assert.equal((await state()).cooling.animated,false);await page.emulateMedia({reducedMotion:'no-preference'});
  results.push('Actual pixels show moving flow, paused flow stays still, and reduced motion disables animation');

  for(const width of [1600,1024,390,320]){
   await page.setViewportSize({width,height:width<500?900:1100});await settle();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow at ${width}`);
   for(const view of ['front','rear']){
    await page.evaluate(view=>document.querySelector('#ew-rack-canvas').paRackScene.setView(view),view);await settle();
    const s=await state();assert.equal(s.invalid.length,0);assert.equal(s.cooling.mode,'external');
    const bounds=await canvas.boundingBox();assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,`Canvas inside ${width}px viewport`);
    await canvas.screenshot({path:path.join(out,`cdu-external-${view}-${width}.png`)});
   }
  }
  results.push('External assembly front/rear fits 1600/1024/390/320px canvases with no document overflow');

  await page.setViewportSize({width:1600,height:1100});
  assert.equal((await api('/api/machines/CDU-01','DELETE')).status,200);await sync();await ready();
  assert.equal((await state()).cooling.mode,'unconnected');assert.equal((await state()).cooling.animated,false);assert.equal(await page.locator('#ew-flow-toggle').isDisabled(),true);
  await page.getByRole('button',{name:'\u80cc\u9762',exact:true}).click();await settle();await canvas.screenshot({path:path.join(out,'cdu-unconnected-rear.png')});
  results.push('No CDU preserves capped rear manifolds with no connection hoses or moving flow');
  for(const size of [1,4,8,16,24,48])for(const top of new Set([size,48])){
   const sample=await page.evaluate(({size,top})=>{
    const records=[{name:'QA-LARGE',mgx_type:'server',rack_u:top,rack_size:size}];
    const shared=PARackScene.buildEditorialParts(records),mesh=shared.equipment['server:'+size];
    let finite=true,minY=Infinity,maxY=-Infinity;for(let i=0;i<mesh.data.length;i++){if(!Number.isFinite(mesh.data[i]))finite=false;if(i%shared.stride===1){minY=Math.min(minY,mesh.data[i]);maxY=Math.max(maxY,mesh.data[i]);}}
    const scene=document.querySelector('#ew-rack-canvas').paRackScene;scene.setComponents(records);scene.setView('rear');return {state:scene.getState(),finite,minY,maxY,unit:shared.unit};
   },{size,top});
   assert.equal(sample.state.invalid.length,0);assert.equal(sample.state.occupiedU,size);assert.equal(sample.state.placements[0].bottom,top-size+1);assert.equal(sample.finite,true);
   assert.ok(sample.minY>=-size*sample.unit/2-1e-5&&sample.maxY<=size*sample.unit/2+1e-5,`${size}U device stays in allocated height`);await settle();
   if([8,24,48].includes(size)&&top===48)await canvas.screenshot({path:path.join(out,`cdu-large-${size}u-rear.png`)});
  }
  const invalid=await page.evaluate(()=>PARackScene.inspectPlacement([{name:'oversize',mgx_type:'server',rack_u:48,rack_size:49},{name:'underflow',mgx_type:'server',rack_u:3,rack_size:4}]).invalid);assert.equal(invalid.length,2);
  results.push('1/4/8/16/24/48U devices have finite bounded geometry at both rack edges; >48U and underflow are rejected');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'cdu-layout.json'),JSON.stringify({passed:true,results,errors,external},null,2));console.log(JSON.stringify({passed:true,results},null,2));
 }catch(error){console.error(JSON.stringify({completed:results},null,2));await page.screenshot({path:path.join(out,'cdu-layout-failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
