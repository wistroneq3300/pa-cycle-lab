/* Actual homepage renderer/scroll acceptance, against app/serve.py only.
 * PA_HERO_PASS=first|final keeps review evidence separate. Optional
 * PA_HERO_WIDTHS=3440 PA_HERO_THEMES=dark PA_HERO_CAPTURE_ONLY=1 captures a pass.
 * PA_HERO_STAGES=1,8,10,14 limits review shots; regression still runs unless
 * explicitly disabled. PA_HERO_REGRESSION_ONLY=1 runs behavioral QA separately.
 * Install playwright locally or set PLAYWRIGHT_MODULE to its installed module;
 * CHROME_PATH selects the browser and PA_HERO_HARDWARE_GL=1 permits native GL.
 * Chromium software rendering validates pixels/GL, not physical desktop FPS.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8769';
const pass=process.env.PA_HERO_PASS||'final';
if(!/^[a-z0-9_-]+$/i.test(pass))throw Error('Invalid PA_HERO_PASS');
const output=path.resolve(__dirname,'../../artifacts/hero-cinematic-v3',pass);
fs.mkdirSync(output,{recursive:true});
const sizes=[[1366,768],[1600,900],[1920,1080],[2560,1440],[3440,1440]];
const widths=process.env.PA_HERO_WIDTHS?.split(',').map(Number);
const themes=(process.env.PA_HERO_THEMES||'dark,light').split(',');
const stages=[['01-empty-rack',.07],['02-device-constellation',.20],['03-identification',.27],['04-early-convergence',.38],['05-mid-convergence',.46],['06-compute-insertion',.55],['07-near-complete',.68],['08-complete-rack',.74],['09-engineering-exploded',.84],['10-returned-assembly',.94],['11-final-hero',1],['12-rear-inspection',1,'rear'],['13-side-inspection',1,'side'],['14-mid-rack',1,'middle'],['15-top-three-quarter',1,'top']];
const requestedStages=process.env.PA_HERO_STAGES?.split(',').map(value=>value.trim());
if(requestedStages)for(const requested of requestedStages)assert.ok(stages.some(([name])=>requested===name||Number(requested)===Number(name.slice(0,2))),'Unknown cinematic stage: '+requested);
const selectedStages=stages.filter(([name])=>!requestedStages||requestedStages.some(requested=>requested===name||Number(requested)===Number(name.slice(0,2))));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'):'/usr/bin/chromium'),args:process.env.PA_HERO_HARDWARE_GL?['--no-sandbox']:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
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
 const calloutCheck=async(s,width)=>{
   const overlay=await page.locator('[data-vo-callouts]').evaluate(el=>el.paHeroCallouts?.getState());
   assert.ok(overlay,'Overview callout projection adapter is mounted');
   if(s.progress<.18||s.progress>=.327){
     assert.equal(overlay.visible,false,'Captions leave before hardware starts moving');
     const visibility=await page.locator('[data-vo-callouts]').evaluate(el=>({display:getComputedStyle(el).display,textRects:[...el.querySelectorAll('text')].map(text=>text.getClientRects().length)}));
     assert.equal(visibility.display,'none','Hidden overlay removes SVG descendants from actual rendering');
     assert.ok(visibility.textRects.every(count=>count===0),'Hidden caption text has no rendered rectangles');
     assert.equal(await page.locator('[data-vo-callouts]').isVisible(),false,'Rendered captions cannot leak into final/assembly shots');
     return overlay;
   }
   if(s.progress<.245||s.progress>.28)return overlay;
   assert.equal(overlay.visible,true);assert.equal(overlay.labels.length,4,`${width}: identify four representative classes`);
   const counts={};for(const row of s.assembly.placements)counts[row.type]=(counts[row.type]||0)+1;
   const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   const crosses=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-.01&&cross(c,d,a)*cross(c,d,b)<-.01;
   const project=box=>({left:box.left*overlay.width,right:box.right*overlay.width,top:box.top*overlay.height,bottom:box.bottom*overlay.height});
   const obstacles=[s.projection.rackBounds,...s.projection.equipmentBounds.filter(b=>b.opacity>.003)].map(project);
   for(const label of overlay.labels){
     assert.equal(label.count,counts[label.type],'Class count comes from actual 48U model');
     assert.equal(s.assembly.placements.find(row=>row.name===label.name)?.type,label.type,'Representative belongs to its class');
     const projected=s.callouts.find(item=>item.name===label.name);assert.ok(projected.anchors.some(a=>Math.hypot(a.x*overlay.width-label.anchor.x,a.y*overlay.height-label.anchor.y)<.1),'Callout anchor is an actual projected hardware corner');
     assert.ok(label.primaryOpacity>.95,'Identification primary label has settled');
     assert.equal(label.leaderVisible,true,`${width}: ${label.type} has a clear physical leader`);
     const b=label.labelBounds;assert.ok(b.left>=0&&b.right<=overlay.width&&b.top>=0&&b.bottom<=overlay.height,'Caption is contained in cinematic viewport');
     assert.ok(!obstacles.some(box=>overlap(b,box)),`${width}: ${label.type} caption does not cover hardware`);
     for(const other of overlay.labels)if(other!==label){
       assert.ok(!overlap(b,other.labelBounds),'Primary captions do not overlap');
       for(let i=1;i<label.leader.length;i++)for(let j=1;j<other.leader.length;j++)assert.ok(!crosses(label.leader[i-1],label.leader[i],other.leader[j-1],other.leader[j]),`${width}: ${label.type}/${other.type} leaders do not cross`);
     }
   }
   return overlay;
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
         const callouts=await calloutCheck(s,width);
         assert.equal(await canvas.evaluate(el=>el===document.querySelector('#system-core')),true,'Same WebGL canvas throughout');
         assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
         const rendered=await page.locator('#system-core').evaluate(el=>({error:el.getContext('webgl').getError(),y:Number(el.dataset.corePrimaryY),z:Number(el.dataset.corePrimaryZ)}));
         assert.equal(rendered.error,0,'Zero WebGL errors');
         assert.ok(Math.abs(rendered.y-s.assembly.primaryPose.y)<.00001&&Math.abs(rendered.z-s.assembly.primaryPose.z)<.00001,'Rendered primary placement diagnostics stay consistent through scan/orbit');
         if((p<.48||p>=.70)&&view!=='middle')assert.equal(s.bounds.clipped,false,`${width} ${label}: cinematic hardware stays inside viewport`);
         if(label==='11-final-hero')assert.ok(s.bounds.heightFraction>=.70&&s.bounds.heightFraction<=.78,`${width}: final rack occupies 70–78% of 3D viewport (actual ${s.bounds.heightFraction})`);
         const boxes=await page.evaluate(()=>{const a=document.querySelector('.vo-hero-copy').getBoundingClientRect(),b=document.querySelector('#system-core').getBoundingClientRect();return {copyRight:a.right,canvasLeft:b.left};});
         assert.ok(boxes.canvasLeft>=boxes.copyRight-1,'Hero canvas does not cover overview copy');
         const filename=`${width}x${height}-${theme}-${label}.png`;
         await page.screenshot({path:path.join(output,filename),animations:'disabled'});
         const capture={file:filename,progress:p,view:view||'authored',camera:s.camera,bounds:s.bounds,quality:s.quality,vertices:s.vertices,drawCalls:s.drawCalls,callouts};
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
     for(const p of [0,.07,.20,.27,.34,.38,.46,.55,.68,.74,.84,.94,1])forward.set(p,(await seek(p)).assembly);
     for(const p of [...forward.keys()].reverse())assert.deepEqual((await seek(p)).assembly,forward.get(p),'Exact reversible placement');
     assert.deepEqual((await seek(.94)).assembly.placements,(await seek(.74)).assembly.placements,'Exploded presentation returns to exact seated transforms');
     results.push('Same canvas, full-rack class assembly, U40 rail insertion, forward/reverse and exact exploded return');
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
   fs.writeFileSync(path.join(output,'hero-assembly.json'),JSON.stringify({passed:true,pass,results,errors,external,captures,renderer:process.env.PA_HERO_HARDWARE_GL?'Chromium native GL; physical GPU FPS not measured':'Chromium SwiftShader (software); physical GPU FPS not measured'},null,2));
   console.log(JSON.stringify({passed:true,pass,results,captures:captures.length},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
