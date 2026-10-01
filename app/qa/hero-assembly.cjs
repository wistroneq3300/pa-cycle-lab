/* Actual homepage scroll/renderer integration. Isolated local preview only. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8769';
const output=path.join(__dirname,'artifacts');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],external=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());});
 // Retain the real mount result without modifying product source or WebGL.
 await page.addInitScript(()=>Object.defineProperty(window,'PACoreScene',{configurable:true,set(api){
  Object.defineProperty(window,'PACoreScene',{configurable:true,writable:true,value:{...api,mount(...args){const scene=api.mount(...args);window.__qaHero=scene;return scene;}}});
 }}));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&window.__qaHero?.getState().supported);
 const scroll=async progress=>{
  await page.evaluate(p=>{const story=document.querySelector('#core-story'),stage=document.querySelector('#core-stage');window.scrollTo({top:story.getBoundingClientRect().top+scrollY-76+p*(story.offsetHeight-stage.offsetHeight),behavior:'instant'});},progress);
  await page.waitForFunction(p=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.002,progress);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  return page.evaluate(()=>__qaHero.getState());
 };
 try{
  await page.goto(base+'/#/dashboard');await ready();
  const first=await page.locator('#system-core').elementHandle();
  const phases=[];
  for(const p of [0,.12,.36,.40,.58,.76,1,.76,.58,.40,.36,.12,0]){
   const state=await scroll(p);
   assert.equal(await first.evaluate(el=>el===document.querySelector('#system-core')),true,'One canvas across the entire forward/reverse story');
   const expected=await page.evaluate(progress=>PACoreScene.assemblySnapshot(progress),state.progress);
   assert.deepEqual(state.assembly.primaryPose,expected.primaryPose);
   assert.equal(state.assembly.targetU,40);assert.equal(state.assembly.primaryPose.scale,1);
   assert.equal(state.assembly.placements.length,41);assert.equal(state.assembly.occupiedU,48);
   const cover=state.assembly.placements.find(item=>item.name==='editorial-reserve-blank');
   assert.ok(cover&&cover.type==='blanking'&&cover.top===9&&cover.bottom===5&&cover.size===5,'Reserved 5U cover between the power shelves and CDU');
   phases.push({progress:state.progress,phase:state.assembly.phase,pose:state.assembly.primaryPose});
  }
  results.push({reversibleInsertion:phases});
  for(const width of [1440,1600,1920]){
   await page.setViewportSize({width,height:1000});
   for(const theme of ['dark','light']){
    await page.evaluate(t=>applyTheme(t),theme);
    for(const [label,p]of [['system',0],['inserting',.58],['seated',.76],['rack',1]]){
     const state=await scroll(p);assert.equal(state.theme,theme);
     const feather=await page.locator('#system-core').evaluate(el=>({alpha:Number(getComputedStyle(el).getPropertyValue('--core-edge-alpha')),mask:getComputedStyle(el).maskImage}));
     assert.equal(feather.alpha,p===0||p===1?1:0,'Feather only the close-up bottom; endpoints stay opaque');
     assert.ok(feather.mask.includes('linear-gradient'),'Canvas feather CSS is supported');
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
     assert.equal(await page.locator('#system-core').evaluate(el=>el.getContext('webgl').getError()),0,'No WebGL error');
     if(width===1600)await page.screenshot({path:path.join(output,`hero-gb300-${theme}-${label}.png`),animations:'disabled'});
    }
   }
  }
  results.push('1440/1600/1920 widths, both themes, real system/insertion/rack stages and zero WebGL errors');
  await scroll(0);
  const priorYaw=await page.evaluate(()=>__qaHero.getState().yaw);
  await page.locator('#system-core').press('ArrowRight');
  assert.notEqual(await page.evaluate(()=>__qaHero.getState().yaw),priorYaw);
  await page.locator('#system-core').press('Home');
  await page.waitForFunction(()=>!__qaHero.getState().settling&&Math.abs(__qaHero.getState().yaw)<.001);
  await page.evaluate(()=>{const gl=document.querySelector('#system-core').getContext('webgl');window.__qaLoss=gl.getExtension('WEBGL_lose_context');__qaLoss.loseContext();});
  await page.waitForFunction(()=>document.querySelector('#system-core').dataset.coreState==='fallback');
  await page.evaluate(()=>__qaLoss.restoreContext());await ready();await scroll(1);
  results.push('Keyboard orbit/reset and successful WebGL restoration preserve the assembled rack');
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await ready();
  assert.deepEqual(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().duration>1).map(a=>a.effect.getComputedTiming().duration)),[]);
  await page.evaluate(()=>{window.__qaOldHero=__qaHero;});
  await page.locator('.nav-btn[data-view="projects"]').click();await page.waitForSelector('#proj-sort-list');
  assert.equal(await page.evaluate(()=>__qaOldHero.getState().disposed),true);
  assert.equal(await page.evaluate(()=>__qaOldHero.getState().geometryBuffers),0);
  results.push('Reduced motion and route cleanup remain functional');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(output,'hero-assembly.json'),JSON.stringify({passed:true,results,errors,external},null,2));
  console.log(JSON.stringify({passed:true,results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
