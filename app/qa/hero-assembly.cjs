/* Actual homepage renderer/scroll acceptance, against app/serve.py only.
 * PA_HERO_PASS=first|final keeps review evidence separate. Optional
 * PA_HERO_WIDTHS=3440 PA_HERO_THEMES=dark PA_HERO_CAPTURE_ONLY=1 captures a pass.
 * PA_HERO_STAGES=1,8,10,14 limits review shots; regression still runs unless
 * explicitly disabled. PA_HERO_REGRESSION_ONLY=1 runs behavioral QA separately.
 * Chromium software rendering validates pixels/GL, not physical desktop FPS.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8769';
const pass=process.env.PA_HERO_PASS||'final';
if(!/^[a-z0-9_-]+$/i.test(pass))throw Error('Invalid PA_HERO_PASS');
const output=path.resolve(__dirname,'../../artifacts/hero-cinematic-v2',pass);
fs.mkdirSync(output,{recursive:true});
const sizes=[[1366,768],[1440,900],[1600,900],[1920,1080],[2560,1440],[3440,1440]];
const widths=process.env.PA_HERO_WIDTHS?.split(',').map(Number);
const themes=(process.env.PA_HERO_THEMES||'dark,light').split(',');
const stages=[['01-server-close-up',0],['02-alignment',.18],['03-rail-engagement',.25],['04-insertion',.40],['05-mechanical-seat',.48],['06-full-front',.56,'front'],['07-front-three-quarter',.56],['08-side',.66],['09-rear-three-quarter',.712],['10-rear-hero',.742],['11-exploded',.86],['12-engineering-scan',.93],['13-final-hero',1],['14-mid-rack',1,'middle'],['15-top-three-quarter',1,'top']];
const requestedStages=process.env.PA_HERO_STAGES?.split(',').map(value=>value.trim());
if(requestedStages)for(const requested of requestedStages)assert.ok(stages.some(([name])=>requested===name||Number(requested)===Number(name.slice(0,2))),'Unknown cinematic stage: '+requested);
const selectedStages=stages.filter(([name])=>!requestedStages||requestedStages.some(requested=>requested===name||Number(requested)===Number(name.slice(0,2))));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:3440,height:1440}}),errors=[],external=[],results=[],captures=[];
 const captureIndex=new Map();
 const manifestPath=path.join(output,'captures.json');
 if(fs.existsSync(manifestPath))for(const capture of JSON.parse(fs.readFileSync(manifestPath,'utf8')))captureIndex.set(capture.file,capture);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)external.push(r.url());});
 const ready=()=>page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback);
 const state=()=>page.evaluate(()=>document.querySelector('#system-core').paCoreScene.getState());
 const settle=async()=>{
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   try{
     // SwiftShader can take >1s per full-screen close-up frame. The physical
     // camera's capped dt still requires about 22 frames to converge. Give it
     // time without changing the renderer, its damping or convergence test.
     await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling,{},{timeout:60000});
   }catch(error){
     const diagnostics=await state();
     fs.writeFileSync(path.join(output,'settle-failure.json'),JSON.stringify(diagnostics,null,2));
     throw new Error('Camera did not converge within60s: '+JSON.stringify({progress:diagnostics.progress,camera:diagnostics.camera,idle:diagnostics.idle,quality:diagnostics.quality}),{cause:error});
   }
 };
 const seek=async(progress,view)=>{
   await page.evaluate(p=>{document.querySelector('#core-story').paHeroPlayback.seek(p);document.querySelector('#system-core').paCoreScene.resetOrbit();},progress);
   // Progress is requested before a rendered frame: !settling alone races the old camera.
   await page.waitForFunction(p=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.0002,progress);
   if(view)await page.evaluate(v=>document.querySelector('#system-core').paCoreScene.setView(v),view);
   await settle();return state();
 };
 const geometryCheck=s=>{
   assert.equal(s.assembly.targetU,40);assert.equal(s.assembly.primaryPose.scale,1);
   assert.equal(s.assembly.placements.length,41);assert.equal(s.assembly.occupiedU,48);
   assert.ok(!s.assembly.placements.some(row=>row.type==='cdu'||/cdu/i.test(row.name)),'No CDU in the hero');
   const lower=s.assembly.placements.find(row=>row.name==='editorial-infrastructure-blank');
   assert.ok(lower&&lower.type==='blanking'&&lower.top===4&&lower.bottom===1&&lower.size===4,'Neutral infrastructure occupies U1–U4');
   assert.ok(s.vertices>10000&&s.vertices<2000000,'Bounded substantial procedural geometry');
   assert.ok(s.drawCalls<80,'Shared geometry keeps frame submission bounded');
   assert.ok(s.quality.pixelCount<=2605000,'Adaptive framebuffer pixel budget');
 };
 try{
   await page.goto(base+'/#/dashboard');await ready();
   await page.waitForFunction(()=>document.querySelector('[data-vo-systems]')?.textContent==='37');
   const canvas=await page.locator('#system-core').elementHandle();
   for(const [width,height]of sizes.filter(([width])=>!process.env.PA_HERO_REGRESSION_ONLY&&(!widths||widths.includes(width)))){
     await page.setViewportSize({width,height});
     for(const theme of themes){
       await page.evaluate(t=>applyTheme(t),theme);
       for(const [label,p,view]of selectedStages){
         const s=await seek(p,view);geometryCheck(s);assert.equal(s.theme,theme);
         assert.equal(await canvas.evaluate(el=>el===document.querySelector('#system-core')),true,'Same WebGL canvas throughout');
         assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
         const rendered=await page.locator('#system-core').evaluate(el=>({error:el.getContext('webgl').getError(),y:Number(el.dataset.corePrimaryY),z:Number(el.dataset.corePrimaryZ)}));
         assert.equal(rendered.error,0,'Zero WebGL errors');
         assert.ok(Math.abs(rendered.y-s.assembly.primaryPose.y)<.00001&&Math.abs(rendered.z-s.assembly.primaryPose.z)<.00001,'Rendered primary placement diagnostics stay consistent through scan/orbit');
         if(p>=.56&&view!=='middle')assert.equal(s.bounds.clipped,false,`${width} ${label}: complete rack stays inside viewport`);
         if(label==='13-final-hero')assert.ok(s.bounds.heightFraction>=.70&&s.bounds.heightFraction<=.82,`${width}: final rack occupies 70–82% of 3D viewport (actual ${s.bounds.heightFraction})`);
         const boxes=await page.evaluate(()=>{const a=document.querySelector('.vo-hero-copy').getBoundingClientRect(),b=document.querySelector('#system-core').getBoundingClientRect();return {copyRight:a.right,canvasLeft:b.left};});
         assert.ok(boxes.canvasLeft>=boxes.copyRight-1,'Hero canvas does not cover overview copy');
         const filename=`${width}x${height}-${theme}-${label}.png`;
         await page.screenshot({path:path.join(output,filename),animations:'disabled'});
         const capture={file:filename,progress:p,view:view||'authored',camera:s.camera,bounds:s.bounds,quality:s.quality,vertices:s.vertices,drawCalls:s.drawCalls};
         captures.push(capture);captureIndex.set(filename,capture);
         fs.writeFileSync(manifestPath,JSON.stringify([...captureIndex.values()].sort((a,b)=>a.file.localeCompare(b.file)),null,2));
         console.log(`CAPTURE ${pass}/${filename}`);
       }
     }
   }
   if(captures.length)results.push('Selected viewport/theme/stage captures, UI separation, framing and zero GL errors');
   if(!process.env.PA_HERO_CAPTURE_ONLY){
     await page.setViewportSize({width:1600,height:900});
     const forward=new Map();
     for(const p of [0,.12,.22,.26,.40,.46,.56,.66,.742,.86,.905,1])forward.set(p,(await seek(p)).assembly);
     for(const p of [...forward.keys()].reverse())assert.deepEqual((await seek(p)).assembly,forward.get(p),'Exact reversible placement');
     assert.deepEqual((await seek(.905)).assembly.placements,(await seek(.56)).assembly.placements,'Exploded presentation returns to exact seated transforms');
     results.push('Same canvas, U40 alignment/insertion, forward/reverse and exact exploded return');
     await seek(.56);await page.evaluate(()=>window.scrollBy(0,100));
     await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress>.57);
     const advanced=await state();await page.evaluate(()=>window.scrollBy(0,-100));
     await page.waitForFunction(p=>document.querySelector('#core-story').paHeroPlayback.getState().progress<p-.01,advanced.progress);
     await page.evaluate(()=>window.scrollTo(0,0));await seek(1);
     await page.locator('#system-core').press('ArrowRight');await settle();assert.notEqual((await state()).yaw,0);
     await page.locator('#system-core').press('Home');await settle();assert.equal((await state()).yaw,0);
     await page.waitForFunction(()=>document.querySelector('#system-core').paCoreScene.getState().idle.active,{},{timeout:12000});
     await page.waitForTimeout(400);assert.ok((await state()).idle.weight>0);
     await page.mouse.move(20,20);
     await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().idle.active,{},{timeout:5000});
     await settle();assert.equal((await state()).idle.weight,0);
     results.push('Real forward/reverse scroll, keyboard orbit, idle entry and smooth activity exit');
     await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.replay());
     await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().mode==='film');
     await page.waitForTimeout(350);assert.ok((await state()).progress<.10);await seek(1);
     await page.evaluate(()=>{const gl=document.querySelector('#system-core').getContext('webgl');window.__qaLoss=gl.getExtension('WEBGL_lose_context');__qaLoss.loseContext();});
     await page.waitForFunction(()=>document.querySelector('#system-core').dataset.coreState==='fallback');
     await page.evaluate(()=>__qaLoss.restoreContext());await ready();geometryCheck(await seek(1));
     results.push('Replay and WebGL context loss/restoration');
     await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await ready();
     assert.equal((await state()).progress,1);assert.equal((await state()).idle.disabled,true);
     assert.equal(await page.locator('[data-vo-replay]').isDisabled(),true);
     assert.deepEqual(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().duration>1).map(a=>a.effect.getComputedTiming().duration)),[]);
     await page.evaluate(()=>window.__qaOldHero=document.querySelector('#system-core').paCoreScene);
     await page.locator('.nav-btn[data-view="projects"]').click();await page.waitForSelector('#proj-sort-list');
     assert.equal(await page.evaluate(()=>__qaOldHero.getState().disposed),true);assert.equal(await page.evaluate(()=>__qaOldHero.getState().geometryBuffers),0);
     results.push('Reduced-motion final pose/replay disabled and complete route cleanup');
   }
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   fs.writeFileSync(path.join(output,'hero-assembly.json'),JSON.stringify({passed:true,pass,results,errors,external,captures,renderer:'Chromium SwiftShader (software); physical GPU FPS not measured'},null,2));
   console.log(JSON.stringify({passed:true,pass,results,captures:captures.length},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
