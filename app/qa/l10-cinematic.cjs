/* Actual browser/WebGL regression for the L10 prefix and retained rack film.
 * Run against app/serve.py (synthetic preview only):
 * PA_PREVIEW_URL=http://127.0.0.1:8774 node app/qa/l10-cinematic.cjs
 * PLAYWRIGHT_MODULE / NODE_PATH and CHROME_PATH may select installed tooling.
 * No product code is replaced. Test-only GL instrumentation observes uploads,
 * actual draw transforms and opacity; software GL does not measure GPU FPS.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
const output=path.resolve(__dirname,'../../artifacts/l10-cinematic/evidence');
fs.mkdirSync(output,{recursive:true});
const report={passed:false,checks:[],stages:[],errors:[],external:[],renderer:process.env.PA_L10_HARDWARE_GL?'Chromium native GL; no physical GPU frame-rate claim':'Chromium SwiftShader; no physical GPU frame-rate claim'};
const near=(a,b,tolerance,message)=>assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} vs ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

// Observe real WebGL commands rather than mocking the renderer or its shaders.
function observeGL(){
 const proto=WebGLRenderingContext.prototype,original={},contexts=new WeakMap();
 const hash=data=>{let h=2166136261;const words=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);for(let i=0;i<words.length;i+=Math.max(1,Math.floor(words.length/101)))h=Math.imul(h^words[i],16777619);return `${data.length}:${h>>>0}`;};
 const state=gl=>{let s=contexts.get(gl);if(!s){s={buffer:null,buffers:new WeakMap(),locations:new WeakMap(),uniforms:{},draws:[],frame:0};contexts.set(gl,s);}return s;};
 for(const name of ['bindBuffer','bufferData','getUniformLocation','uniformMatrix4fv','uniform1f','clear','drawArrays'])original[name]=proto[name];
 proto.bindBuffer=function(target,buffer){state(this).buffer=buffer;return original.bindBuffer.apply(this,arguments);};
 proto.bufferData=function(target,data){const s=state(this);if(s.buffer&&ArrayBuffer.isView(data))s.buffers.set(s.buffer,hash(data));return original.bufferData.apply(this,arguments);};
 proto.getUniformLocation=function(program,name){const location=original.getUniformLocation.apply(this,arguments);if(location)state(this).locations.set(location,name);return location;};
 proto.uniformMatrix4fv=function(location,transpose,value){const s=state(this);s.uniforms[s.locations.get(location)]=Array.from(value);return original.uniformMatrix4fv.apply(this,arguments);};
 proto.uniform1f=function(location,value){const s=state(this);s.uniforms[s.locations.get(location)]=value;return original.uniform1f.apply(this,arguments);};
 proto.clear=function(){const s=state(this);s.draws=[];s.frame++;return original.clear.apply(this,arguments);};
 proto.drawArrays=function(mode,first,count){const s=state(this);s.draws.push({hash:s.buffers.get(s.buffer),count,part:s.uniforms.uPart?.slice(),model:s.uniforms.uModel?.slice(),opacity:s.uniforms.uOpacity,shadowPass:s.uniforms.uShadowPass||0});return original.drawArrays.apply(this,arguments);};
 window.__l10QA={hash,read:canvas=>{const s=state(canvas.getContext('webgl'));return {frame:s.frame,draws:s.draws.filter(draw=>!draw.shadowPass)};}};
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?path.join(process.env.ProgramFiles||'C:/Program Files','Google/Chrome/Application/chrome.exe'):'/usr/bin/chromium'),args:process.env.PA_L10_HARDWARE_GL?['--no-sandbox']:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.addInitScript(observeGL);
 page.on('pageerror',error=>report.errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
 page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)report.external.push(request.url());});
 const ready=()=>page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback);
 const read=()=>page.evaluate(()=>({scene:document.querySelector('#system-core').paCoreScene.getState(),gl:__l10QA.read(document.querySelector('#system-core')),playback:document.querySelector('#core-story').paHeroPlayback.getState()}));
 const settle=async()=>{
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling,null,{timeout:60000});
 };
 const seek=async p=>{
   const old=await page.evaluate(()=>__l10QA.read(document.querySelector('#system-core')).frame);
   await page.evaluate(p=>{document.querySelector('#core-story').paHeroPlayback.seek(p);document.querySelector('#system-core').paCoreScene.resetOrbit();},p);
   await page.waitForFunction(({p,old})=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.00006&&__l10QA.read(document.querySelector('#system-core')).frame>old,{p,old});
   await settle();return read();
 };
 const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
 try{
   await page.goto(base+'/#/dashboard');await ready();await seek(0);
   const canvas=await page.locator('#system-core').elementHandle();
   await page.evaluate(()=>{window.__l10QAScene=document.querySelector('#system-core').paCoreScene;window.__l10QAGL=document.querySelector('#system-core').getContext('webgl');});
   const hardware=await page.evaluate(()=>{const built=PAL10Hardware.build();return {profile:built.profile,meshes:Object.fromEntries(Object.entries(built.meshes).map(([name,mesh])=>[name,{hash:__l10QA.hash(mesh.data),vertices:mesh.data.length/12}]))};});
   const draw=(state,name)=>state.gl.draws.filter(item=>item.hash===hardware.meshes[name].hash);
   const one=(state,name)=>{const items=draw(state,name);assert.equal(items.length,1,`${name} rendered exactly once`);return items[0];};
   const stages=[['exploded',0],['board-seated',.132],['cpu-gpu',.166],['packages-seated',.200],['io-seated',.246],['cooling-install',.266],['cooling-reveal',.312],['l10-hero',.354],['closure',.400],['bridge',.48],['rack-handoff',.56],['rack-insertion',.69],['complete',.82],['rack-exploded',.89],['final',1]];
   const samples=new Map();
   await check('Public hardware profile: two boards, 2 CPU / 4 GPU, package ownership and honest conceptual overlay',()=>{
     const p=hardware.profile;assert.equal(p.counts.computeBoards,2);assert.equal(p.packages.filter(p=>p.type==='CPU').length,2);assert.equal(p.packages.filter(p=>p.type==='GPU').length,4);
     for(let i=0;i<2;i++){assert.equal(p.packages.filter(p=>p.board===i&&p.type==='CPU').length,1);assert.equal(p.packages.filter(p=>p.board===i&&p.type==='GPU').length,2);}
     assert.match(p.motion.packageMode,/board-integrated/);assert.match(p.coolant.overlay,/conceptual/i);assert.ok(p.approximations.length>=3);
     const sx=p.editorialSceneScale.x,sz=p.editorialSceneScale.z;
     near(p.width*sx/p.height,p.referenceDimensionsMM.width/p.referenceDimensionsMM.height,.08,'Published width / height ratio');
     near(p.depth*sz/p.height,p.referenceDimensionsMM.depth/p.referenceDimensionsMM.height,.08,'Published depth / height ratio');
   });
   await check('All authored stages compile and render in the same canvas, scene and GL context',async()=>{
     for(const [label,p] of stages){
       const state=await seek(p);samples.set(p,state);
       assert.equal(await canvas.evaluate(el=>el===document.querySelector('#system-core')&&el.paCoreScene===__l10QAScene&&el.getContext('webgl')===__l10QAGL),true);
       assert.equal(state.scene.ready,true);assert.equal(await page.evaluate(()=>__l10QAGL.getError()),0);assert.ok(state.gl.draws.length>0);
       assert.equal(state.scene.quality.contactShadows,true,'Real depth-map shadows are available');
       if(p<.407){const captions=await page.locator('[data-vo-callouts]').evaluate(el=>({display:getComputedStyle(el).display,visible:el.paHeroCallouts?.getState()?.visible}));assert.equal(captions.display,'none','Legacy rack labels stay hidden throughout L10');assert.equal(captions.visible,false);}
       assert.equal(state.scene.assembly.primaryPose.scale,1);assert.equal(state.scene.assembly.placements.filter(p=>p.primary).length,1);
       assert.equal(state.scene.assembly.targetU,40);assert.equal(state.scene.occupiedU,48);assert.equal(state.scene.componentCount,41);
       assert.ok(state.scene.vertices>100000&&state.scene.vertices<2000000);assert.ok(state.scene.drawCalls<100);assert.ok(state.scene.quality.pixelCount<=5005000);
       one(state,'l10-chassis');one(state,'l10-packages');
       report.stages.push({label,progress:p,phase:state.scene.assembly.phase,l10:state.scene.l10,camera:state.scene.camera,drawCalls:state.scene.drawCalls,vertices:state.scene.vertices});
     }
   });
   await check('Rendered assembly seats board, CPU/GPU, I/O, then cold plates; restrained reveal restores opaque metal',()=>{
     const at=p=>samples.get(p),lift=(p,name)=>one(at(p),name).part[13]-one(at(p),'l10-chassis').part[13];
     assert.ok(lift(0,'l10-board')>.5&&lift(0,'l10-packages')>1&&lift(0,'l10-cooling')>2);
     near(lift(.132,'l10-board'),0,1e-6,'Board seated');assert.ok(lift(.132,'l10-packages')>1&&lift(.132,'l10-cooling')>2);
     near(lift(.200,'l10-packages'),0,1e-6,'Packages seated');assert.ok(lift(.200,'l10-io')>.7&&lift(.200,'l10-cooling')>2);
     near(lift(.246,'l10-io'),0,1e-6,'I/O seated');assert.ok(lift(.246,'l10-cooling')>2);
     assert.ok(lift(.266,'l10-cooling')>0&&lift(.266,'l10-cooling')<2);near(lift(.312,'l10-cooling'),0,1e-6,'Cold plates seated');
     const ghost=one(at(.312),'l10-cooling');assert.ok(ghost.opacity>=.65&&ghost.opacity<=.8,'Metal retains most opacity');
     assert.equal(one(at(.312),'l10-cooling-frame').opacity,1,'Fittings and perimeter remain solid');
     assert.ok(one(at(.312),'l10-flow-supply').opacity>0&&one(at(.312),'l10-flow-return').opacity>0);
     for(const p of [.354,.48,1]){assert.equal(one(at(p),'l10-cooling').opacity,1);assert.equal(draw(at(p),'l10-flow-supply').length,0);assert.equal(draw(at(p),'l10-flow-return').length,0);}
   });
   await check('Same L10 remains U40 primary; no duplicate legacy tray or second insertion at handoff',()=>{
     const final=samples.get(1),primary=one(final,'l10-chassis');
     const otherServer=final.scene.assembly.placements.find(p=>p.type==='server'&&!p.primary);
     const serverDraw=final.gl.draws.find(d=>d.part&&Math.abs(d.part[12]-otherServer.x)<1e-6&&Math.abs(d.part[13]-otherServer.y)<1e-6&&Math.abs(d.part[14]-otherServer.z)<1e-6);
     assert.ok(serverDraw,'Retained rack still draws its other compute trays');
     const legacyServers=final.gl.draws.filter(d=>d.hash===serverDraw.hash);
     assert.equal(legacyServers.length,final.scene.computeTrays-1,'Exactly the other 17 legacy trays are drawn');
     assert.equal(legacyServers.filter(d=>d.part.every((n,i)=>Math.abs(n-primary.part[i])<1e-6)).length,0,'Legacy primary geometry must not overlap the retained L10');
     const finalPose=final.scene.assembly.primaryPose;near(primary.part[12],finalPose.x,1e-6,'Primary X');near(primary.part[13],finalPose.y,1e-6,'Primary Y');near(primary.part[14],finalPose.z,1e-6,'Primary Z');
     const snaps=Array.from({length:101},(_,i)=>i/100).map(p=>p);return page.evaluate(values=>values.map(p=>PACoreScene.assemblySnapshot(p)),snaps).then(rows=>{
       const active=rows.filter(s=>s.rackProgress>=.34&&s.rackProgress<=.70);for(let i=1;i<active.length;i++)assert.ok(active[i].insertion>=active[i-1].insertion,'Primary insertion must be monotonic before intentional rack exploded view');
       for(const row of rows){assert.equal(row.primaryOpacity,1);assert.equal(row.primaryPose.scale,1);}
     });
   });
   await check('Pure snapshots and rendered layer transforms are exactly reversible',async()=>{
     const forward=await page.evaluate(()=>Array.from({length:201},(_,i)=>PACoreScene.assemblySnapshot(i/200)));
     const reverse=await page.evaluate(()=>Array.from({length:201},(_,i)=>PACoreScene.assemblySnapshot((200-i)/200)).reverse());assert.deepEqual(reverse,forward);
     for(const p of [.312,.166,0]){const again=await seek(p),before=samples.get(p);assert.deepEqual(again.scene.assembly,before.scene.assembly);assert.deepEqual(again.gl.draws.map(d=>({hash:d.hash,part:d.part,opacity:d.opacity})),before.gl.draws.map(d=>({hash:d.hash,part:d.part,opacity:d.opacity})));}
   });
   await check('Camera transition boundaries preserve pose, scale and camera continuity',async()=>{
     for(const boundary of [.407,.56]){
       const a=await seek(boundary-.00005),b=await seek(boundary+.00005);
       near(a.scene.camera.distance,b.scene.camera.distance,.08,'Boundary camera distance');near(a.scene.camera.yaw,b.scene.camera.yaw,.003,'Boundary yaw');near(a.scene.camera.elevation,b.scene.camera.elevation,.003,'Boundary elevation');
       assert.ok(distance(a.scene.camera.target,b.scene.camera.target)<.03,'Boundary camera target');assert.ok(distance(a.scene.camera.eye,b.scene.camera.eye)<.1,'Boundary camera eye');
       assert.ok(distance(Object.values(a.scene.assembly.primaryPose),Object.values(b.scene.assembly.primaryPose))<.03,'Primary does not teleport');
     }
   });
   await check('1366 and 1920, dark and light: final framing, L10 visibility, labels and no horizontal overflow',async()=>{
     for(const width of [1366,1920]){await page.setViewportSize({width,height:width===1366?768:1080});for(const theme of ['dark','light']){
       await page.evaluate(theme=>applyTheme(theme),theme);
       for(const p of [.166,.312,1]){const s=await seek(p);assert.equal(s.scene.theme,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('#system-core').isVisible(),true);if(p===1)assert.equal(s.scene.bounds.clipped,false,'Final rack stays in frame');}
       await seek(.312);const note=await page.locator('[data-vo-l10-note]').innerText();assert.match(note,/Supply \/ Inlet/);assert.match(note,/Return \/ Outlet/);assert.match(note,/Conceptual/);
       const copy=await page.locator('#core-stage').innerText();assert.doesNotMatch(copy,/GB200|GB300|Vera Rubin|Blackwell|Grace|cup processer/i);
     }}
     await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>applyTheme('dark'));
   });
   await check('Real forward/reverse scroll, keyboard and pointer orbit, replay cancellation',async()=>{
     await seek(.56);await page.evaluate(()=>scrollBy(0,100));await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress>.57);
     const progressed=(await read()).scene.progress;await page.evaluate(()=>scrollBy(0,-100));await page.waitForFunction(p=>document.querySelector('#core-story').paHeroPlayback.getState().progress<p-.01,progressed);
     await page.evaluate(()=>scrollTo(0,0));await seek(1);await page.locator('#system-core').press('ArrowRight');await settle();assert.notEqual((await read()).scene.yaw,0);
     await page.locator('#system-core').press('Home');await settle();assert.equal((await read()).scene.yaw,0);
     const box=await page.locator('#system-core').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5,{steps:4});await page.mouse.up();await settle();assert.ok(Math.abs((await read()).scene.yaw)>.05);assert.equal((await read()).scene.dragging,false);
     await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().mode==='film');await page.waitForTimeout(250);assert.ok((await read()).scene.progress<.1);
     await page.locator('#system-core').press('ArrowRight');assert.equal((await read()).playback.mode,'stopped');await seek(1);
   });
   await check('WebGL context loss restores actual geometry and final pose',async()=>{
     const before=await read();await page.evaluate(()=>{window.__l10Loss=__l10QAGL.getExtension('WEBGL_lose_context');if(!__l10Loss)throw Error('WEBGL_lose_context unavailable');__l10Loss.loseContext();});
     await page.waitForFunction(()=>document.querySelector('#system-core').dataset.coreState==='fallback');await page.evaluate(()=>__l10Loss.restoreContext());await ready();const after=await seek(1);
     assert.equal(after.scene.vertices,before.scene.vertices);assert.deepEqual(after.scene.assembly,before.scene.assembly);one(after,'l10-chassis');assert.equal(await page.evaluate(()=>__l10QAGL.getError()),0);
   });
   await check('Reduced motion lands fully assembled, disables replay and disposes scene/playback on route change',async()=>{
     await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await ready();const s=await read();assert.equal(s.scene.progress,1);assert.equal(s.scene.idle.disabled,true);assert.equal(s.scene.l10.flow,0);assert.equal(s.scene.l10.lid,1);assert.equal(s.scene.l10.coolingLift,0);
     assert.equal(await page.locator('[data-vo-replay]').isDisabled(),true);await page.evaluate(()=>{window.__l10OldScene=document.querySelector('#system-core').paCoreScene;window.__l10OldStory=document.querySelector('#core-story');});
     await page.locator('.nav-btn[data-view="projects"]').click();await page.waitForSelector('#proj-sort-list');
     assert.equal(await page.evaluate(()=>__l10OldScene.getState().disposed),true);assert.equal(await page.evaluate(()=>__l10OldScene.getState().geometryBuffers),0);assert.equal(await page.evaluate(()=>!!__l10OldStory.paHeroPlayback),false);
   });
   assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.passed=true;
 }catch(error){report.failure=error.stack;try{report.lastState=await read();}catch{}throw error;}
 finally{fs.writeFileSync(path.join(output,'l10-regression.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,stages:report.stages.length,report:path.join(output,'l10-regression.json')},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
