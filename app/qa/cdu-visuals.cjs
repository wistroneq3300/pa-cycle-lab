/* Fixture-only CDU rendering checks. Starts its own loopback server; no live backend. */
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const runtime=process.env.CODEX_DEPENDENCIES||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(runtime,'node/node_modules/playwright'));
const {PNG}=require(process.env.PNGJS_MODULE||path.join(runtime,'node/node_modules/pngjs'));
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'artifacts');

function pixelChanges(before,after,{blueOnly=false,rightHalf=false}={}){
 const a=PNG.sync.read(before),b=PNG.sync.read(after);
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let changed=0;
 const blue=(data,i)=>data[i+2]>75&&data[i+2]>data[i]+35&&data[i+2]>data[i+1]*.85;
 for(let y=0;y<a.height;y++)for(let x=rightHalf?Math.floor(a.width/2):0;x<a.width;x++){
  const i=(y*a.width+x)*4;
  if(blueOnly&&!blue(a.data,i)&&!blue(b.data,i))continue;
  if([0,1,2].some(c=>Math.abs(a.data[i+c]-b.data[i+c])>3))changed++;
 }
 return changed;
}

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=cp.spawn(process.env.PYTHON_PATH||path.join(runtime,'python/python.exe'),['-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});
 let browser,page;
 const results=[],errors=[],external=[];
 try{
  const port=await new Promise((resolve,reject)=>{
   let output='',errorText='';
   const timeout=setTimeout(()=>reject(Error('Fixture preview startup timed out')),10000);
   server.stderr.on('data',d=>{errorText=(errorText+d).slice(-2000);});
   server.stdout.on('data',d=>{output+=d;const match=output.match(/^([0-9]+)\r?\n/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});
   server.once('error',error=>{clearTimeout(timeout);reject(error);});
   server.once('exit',code=>{clearTimeout(timeout);reject(Error(`Fixture preview exited (${code}): ${errorText}`));});
  });
  const base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'no-preference'});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(base+'/'))external.push(request.url());});
  const ready=()=>page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
  const state=()=>page.evaluate(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState());
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const canvas=page.locator('#ew-rack-canvas');
  const api=(url,method='GET',body)=>page.evaluate(async({url,method,body})=>{
   if(!window.PA_PREVIEW)throw Error('Fixture mode required');
   const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   return {status:response.status,data:await response.json()};
  },{url,method,body});
  const storedPlacement=async()=>{
   const record=(await api('/api/machines')).data.machines.find(m=>m.name==='CDU-01');
   return {rack_mount:record.rack_mount,rack_u:record.rack_u,rack_size:record.rack_size,project:record.project};
  };
  const assertViewport=async label=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${label}: horizontal overflow`);

  await page.goto(base+'/#/rack/proj_k');await ready();await settle();
  assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true);
  const originalPlacement=await storedPlacement();
  assert.deepEqual(originalPlacement,{rack_mount:'external',rack_u:0,rack_size:0,project:'proj_k'});
  assert.equal((await state()).cooling.mode,'external');
  await page.locator('#ew-rack-component').selectOption('CDU-01');
  assert.deepEqual(await page.locator('#ew-rack-inspector .ew-cdu-cabinet text').allTextContents(),['Cooling'],'Rack inspector must retain Cooling without the MGC branding');
  await page.evaluate(()=>applyTheme('dark'));await settle();
  await page.locator('.ew-rack-deck').screenshot({path:path.join(out,'cdu-tc1288-perspective.png')});

  // Front-view blue changes cannot come from the water shader: the flow control is paused.
  await page.getByRole('button',{name:'\u6b63\u9762',exact:true}).click();
  await page.locator('#ew-flow-toggle').click();await settle();
  assert.equal((await state()).cooling.flowEnabled,false);
  assert.equal((await state()).cooling.animated,false);
  assert.equal((await state()).decorativeLighting.animated,true);
  const frontBefore=await canvas.screenshot();await page.waitForTimeout(370);const frontAfter=await canvas.screenshot();
  const frontBlueChanges=pixelChanges(frontBefore,frontAfter,{blueOnly:true,rightHalf:true});
  assert.ok(frontBlueChanges>20,`Front CDU blue light must visibly flow with water paused (${frontBlueChanges} changed blue pixels)`);
  await page.locator('.ew-rack-deck').screenshot({path:path.join(out,'cdu-tc1288-front.png')});

  await page.getByRole('button',{name:'\u805a\u7126 3D \u5143\u4ef6',exact:true}).click();await settle();
  assert.equal((await state()).focus,'CDU-01');assert.equal((await state()).decorativeLighting.animated,true);
  const focusBefore=await canvas.screenshot();await page.waitForTimeout(370);const focusAfter=await canvas.screenshot();
  const focusBlueChanges=pixelChanges(focusBefore,focusAfter,{blueOnly:true});
  assert.ok(focusBlueChanges>20,`Focused CDU blue light must visibly flow (${focusBlueChanges} changed blue pixels)`);
  await page.locator('.ew-rack-deck').screenshot({path:path.join(out,'cdu-tc1288-focused.png')});
  results.push({check:'Blue light flows in front and focused views while water is paused',frontBlueChanges,focusBlueChanges});

  await page.emulateMedia({reducedMotion:'reduce'});await settle();
  assert.equal((await state()).decorativeLighting.animated,false);
  const reducedBefore=await canvas.screenshot();await page.waitForTimeout(370);const reducedAfter=await canvas.screenshot();
  assert.ok(pixelChanges(reducedBefore,reducedAfter)<=10,'Reduced motion must render stable CDU pixels');
  await page.emulateMedia({reducedMotion:'no-preference'});await settle();
  assert.equal((await state()).decorativeLighting.animated,true);
  results.push('Reduced motion stops the moving light; normal preference restores it');

  // Intersection and actual WebGL lifecycle events must suspend decorative animation.
  await canvas.evaluate(el=>{el.style.transform='translateY(3000px)';});
  await page.waitForFunction(()=>!document.querySelector('#ew-rack-canvas').paRackScene.getState().decorativeLighting.animated);
  await canvas.evaluate(el=>{el.style.removeProperty('transform');});
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState().decorativeLighting.animated);
  await page.evaluate(()=>{
   const gl=document.querySelector('#ew-rack-canvas').getContext('webgl');
   window.__qaCduContext=gl.getExtension('WEBGL_lose_context');
   if(!window.__qaCduContext)throw Error('Chrome must support the WebGL context lifecycle test');
   window.__qaCduContext.loseContext();
  });
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState().contextLost);
  assert.equal((await state()).decorativeLighting.animated,false);
  await page.evaluate(()=>__qaCduContext.restoreContext());await ready();await settle();
  assert.equal((await state()).decorativeLighting.animated,true);
  results.push('Offscreen and lost WebGL context stop animation; visibility and context restoration resume it');

  await page.getByRole('button',{name:'\u900f\u8996',exact:true}).click();
  await page.evaluate(()=>applyTheme('light'));await settle();
  await page.locator('.ew-rack-deck').screenshot({path:path.join(out,'cdu-tc1288-light.png')});
  await page.evaluate(()=>applyTheme('dark'));
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});await settle();await assertViewport(`Rack at ${width}px`);
   const bounds=await canvas.boundingBox();
   assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,`Rack canvas must fit ${width}px viewport`);
   await canvas.screenshot({path:path.join(out,`cdu-tc1288-mobile-${width}.png`)});
  }
  results.push('External CDU renders in dark/light themes and fits 390/320px mobile viewports');

  await page.setViewportSize({width:1600,height:1100});
  await page.evaluate(()=>{window.__qaCduOldScene=document.querySelector('#ew-rack-canvas').paRackScene;openMachine('CDU-01');});
  await page.waitForSelector('.pd-hardware-stage svg');await settle();
  assert.equal(await page.evaluate(()=>__qaCduOldScene.getState().disposed),true);
  assert.equal(await page.evaluate(()=>__qaCduOldScene.getState().decorativeLighting.animated),false);
  const detailUrl=page.url();

  async function detailCheck(installation){
   const externalInstallation=installation==='external';
   const visual=page.locator('.pd-hardware-stage svg');
   assert.equal(await visual.getAttribute('data-hardware-type'),'cdu');
   assert.equal(await visual.getAttribute('data-hardware-view'),externalInstallation?'front':'perspective');
   assert.equal(await visual.getAttribute('data-hardware-units'),externalInstallation?'0':'4');
   assert.equal(await page.locator('.pd-hardware-stage .ew-cdu-cabinet').count(),externalInstallation?1:0,'CDU detail appearance must follow its stored installation');
   const viewBox=(await visual.getAttribute('viewBox')).split(/\s+/).map(Number);
   assert.ok(externalInstallation?viewBox[3]>viewBox[2]:viewBox[2]>viewBox[3],`${installation} CDU detail must use the correct portrait or horizontal proportions`);
   if(externalInstallation)assert.deepEqual(await visual.locator('text').allTextContents(),['Cooling'],'External detail must retain Cooling without the MGC branding');
   const caption=await page.locator('.pd-stage-caption').innerText();
   assert.match(caption,externalInstallation?/\u5916\u7f6e/:/\u6ac3\u5167/,'Illustration caption must describe the current installation');
   assert.doesNotMatch(caption,externalInstallation?/\u6ac3\u5167/:/\u5916\u7f6e/,'Illustration caption must not retain the previous installation');
   const placementLabel=externalInstallation?/\u5916\u7f6e/:/U4\u2013U1\s*\/\s*4U/;
   assert.match(await page.locator('.pd-connect-panel').innerText(),placementLabel,'Connection panel must agree with the stored installation');
   assert.match(await page.locator('.pd-operations .operation-target').innerText(),placementLabel,'Equipment information must agree with the stored installation');
   for(const width of [1600,390,320]){
    await page.setViewportSize({width,height:width<500?900:1100});await settle();await assertViewport(`${installation} detail at ${width}px`);
    const bounded=await page.evaluate(()=>{
     const panel=document.querySelector('.pd-showcase').getBoundingClientRect(),image=document.querySelector('.pd-hardware-stage svg').getBoundingClientRect(),caption=document.querySelector('.pd-stage-caption').getBoundingClientRect();
     return image.left>=panel.left-1&&image.right<=panel.right+1&&image.top>=panel.top-1&&image.bottom<=panel.bottom+1&&caption.right<=panel.right+1&&caption.bottom<=panel.bottom+1;
    });
    assert.equal(bounded,true,`${installation} detail drawing and caption must fit ${width}px panel`);
    if(width!==320)await page.screenshot({path:path.join(out,`cdu-tc1288-detail-${installation}-${width}.png`),fullPage:true});
   }
  }
  await detailCheck('external');
  assert.deepEqual(await storedPlacement(),originalPlacement,'Viewing the cabinet illustration must preserve external installation and zero U occupancy');
  results.push('External CDU detail shows the Cooling cabinet with matching caption and installation, preserves 0U, and stops the disposed rack animation');

  // Convert only the preview fixture, then refresh inventory on this same detail page.
  // Reopening or reloading the page would conceal stale presentation after a saved change.
  async function changeInstallation(installation){
   assert.equal((await api('/api/machines/CDU-01/cdu-installation','PATCH',{rack_mount:installation,rack_size:installation==='external'?0:4,expected_project:'proj_k'})).status,200);
   await page.evaluate(async()=>{await loadMachines(false);setView(state.view);});
   await page.waitForFunction(installation=>document.querySelector('.pd-hardware-stage svg')?.dataset.hardwareUnits===(installation==='external'?'0':'4'),installation);
   await settle();
   assert.equal(page.url(),detailUrl,'Saved installation refresh must remain on the same device detail page');
   assert.equal(await page.locator('.pd-workspace').getAttribute('data-system'),'CDU-01');
  }
  assert.equal((await api('/api/machines/BLANK-BOTTOM-04U','PATCH',{rack_u:0})).status,200);
  await changeInstallation('internal');
  await detailCheck('internal');
  assert.deepEqual(await storedPlacement(),{rack_mount:'internal',rack_u:4,rack_size:4,project:'proj_k'});
  await changeInstallation('external');
  await detailCheck('external');
  assert.deepEqual(await storedPlacement(),originalPlacement);
  results.push('External to internal to external saved fixture changes immediately refresh drawing, caption, installation information and 0U/U1-U4 placement on the same detail page');
  assert.deepEqual(errors,[],'No browser script or console errors');
  assert.deepEqual(external,[],'No request leaves the isolated fixture preview');
  fs.writeFileSync(path.join(out,'cdu-tc1288-visuals.json'),JSON.stringify({passed:true,results,errors,external},null,2));
  console.log(JSON.stringify({passed:true,results},null,2));
 }catch(error){
  console.error(JSON.stringify({completed:results,errors},null,2));
  if(page)await page.screenshot({path:path.join(out,'cdu-tc1288-failure.png'),fullPage:true}).catch(()=>{});
  throw error;
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
