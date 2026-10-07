/* Overview V3 release boundary: the operational Rack page retains its model,
 * CDU, cooling, camera, cabling and lifecycle. Synthetic preview server only.
 * Install playwright or set PLAYWRIGHT_MODULE; CHROME_PATH selects Chromium. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8769';
const out=path.resolve(__dirname,'../../artifacts/hero-cinematic-v3');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'):'/usr/bin/chromium')});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],external=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
 const ready=()=>page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
 const state=()=>page.evaluate(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState());
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 try{
  await page.goto(base+'/#/rack/proj_k');await ready();assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true,'Only isolated fixture preview is accepted');
  const initial=await state();assert.equal(initial.count,36);assert.equal(initial.occupiedU,48);assert.equal(initial.invalid.length,0);
  assert.equal(initial.cooling.mode,'external');assert.deepEqual(initial.placements.find(row=>row.name==='CDU-01'),{name:'CDU-01',type:'cdu',top:0,bottom:0,size:0,external:true});
  const units=new Set();for(const row of initial.placements.filter(row=>!row.external))for(let u=row.bottom;u<=row.top;u++){assert.ok(!units.has(u),'Unique saved U placement');units.add(u);}assert.equal(units.size,48);
  assert.equal(await page.locator('[data-vo-callouts]').count(),0,'Hero identification never mounts into Rack Management');
  checks.push('Original 36 components, 48U placement and external CDU remain intact; Overview callouts are isolated');
  for(const theme of ['dark','light']){
   await page.evaluate(t=>applyTheme(t),theme);
   for(const [label,view]of [['透視','perspective'],['正面','front'],['背面','rear']]){
    await page.getByRole('button',{name:label,exact:true}).click();await settle();
    const s=await state();assert.equal(s.view,view);assert.equal(s.theme,theme);assert.deepEqual(s.placements,initial.placements);
    assert.equal(await page.locator('#ew-rack-canvas').evaluate(el=>el.getContext('webgl').getError()),0);
   }
  }
  checks.push('Perspective/front/rear and both themes preserve exact geometry and compile/render without WebGL errors');
  await page.getByRole('button',{name:'透視',exact:true}).click();await settle();
  await page.locator('#ew-flow-toggle').click();await settle();assert.equal((await state()).cooling.flowEnabled,false);assert.equal((await state()).cooling.animated,false);
  await page.locator('#ew-flow-toggle').click();await settle();assert.equal((await state()).cooling.flowEnabled,true);
  const routes=(await state()).networkCabling.routeCount;await page.locator('#ew-network-toggle').click();await settle();assert.equal((await state()).networkCabling.visible,false);
  await page.locator('#ew-network-toggle').click();await settle();assert.equal((await state()).networkCabling.visible,true);assert.equal((await state()).networkCabling.routeCount,routes);
  await page.getByRole('button',{name:'放大',exact:true}).click();await settle();assert.ok((await state()).zoom>1);
  await page.getByRole('button',{name:'重設視角',exact:true}).click();await settle();assert.equal((await state()).zoom,1);assert.equal((await state()).view,'perspective');
  checks.push('Liquid-flow pause/resume, saved cabling hide/show, zoom and reset retain behavior');
  await page.locator('#ew-rack-component').selectOption('SERVER-04U');await page.getByRole('button',{name:'聚焦 3D 元件',exact:true}).click();await settle();assert.equal((await state()).focus,'SERVER-04U');
  await page.getByRole('button',{name:'重設視角',exact:true}).click();await page.getByRole('button',{name:'放大檢視',exact:true}).click();await page.locator('#ew-rack-canvas').press('Escape');assert.equal(await page.locator('.ew-rack-deck').evaluate(el=>el.classList.contains('is-expanded')),false);
  await page.evaluate(()=>window.__qaRack=document.querySelector('#ew-rack-canvas').paRackScene);
  await page.locator('.nav-btn[data-view="dashboard"]').click();await page.waitForSelector('#system-core');assert.equal(await page.evaluate(()=>__qaRack.getState().disposed),true);assert.equal(await page.evaluate(()=>__qaRack.getState().geometryBuffers),0);
  await page.goto(base+'/#/rack/proj_k');await ready();assert.deepEqual((await state()).placements,initial.placements);
  await page.emulateMedia({reducedMotion:'reduce'});await settle();assert.equal((await state()).cooling.animated,false);
  checks.push('Device focus, expanded Escape, route disposal/re-entry and reduced-motion cooling are unchanged');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(out,'rack-isolation.json'),JSON.stringify({passed:true,checks,errors,external},null,2));console.log(JSON.stringify({passed:true,checks},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
