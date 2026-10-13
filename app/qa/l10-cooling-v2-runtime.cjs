/* Companion lifecycle and actual GPU flow checks. Synthetic local preview only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/cooling-v2/evidence');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const url=base+'/static/l10-cooling-review.html?l10Bareboard=1&l10AssetLab=1&stage=flow';
const companion='**/l10-cooling-v1/cooling-assembly.glb*',bytes=fs.readFileSync(path.join(root,'app/static/models/l10-cooling-v1/cooling-assembly.glb'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={pass:false,companionSHA256:sha(bytes),checks:[],errors:[],expectedFixtureErrors:[],external:[]};
fs.mkdirSync(out,{recursive:true});
function observe(){
 const q={frames:0,draws:[],uniforms:{},material:[0,0],liveBuffers:0,liveTextures:0,buffers:{}},locations=new WeakMap(),ids=new WeakMap(),attrs={},p=WebGLRenderingContext.prototype;let id=0,bound=null;
 for(const name of ['getUniformLocation','getAttribLocation','uniform1f','uniformMatrix4fv','uniform2fv','uniform3fv','uniform4fv','vertexAttrib2f','clear','drawArrays','createBuffer','deleteBuffer','bindBuffer','bufferData','createTexture','deleteTexture']){
  const original=p[name];p[name]=function(...args){const result=original.apply(this,args);
   if(name==='getUniformLocation'&&result)locations.set(result,args[1]);
   if(name==='getAttribLocation')attrs[args[1]]=result;
   if(name==='uniform1f')q.uniforms[locations.get(args[0])]=args[1];
   if(name==='uniformMatrix4fv')q.uniforms[locations.get(args[0])]=Array.from(args[2]);
   if(['uniform2fv','uniform3fv','uniform4fv'].includes(name))q.uniforms[locations.get(args[0])]=Array.from(args[1]);
   if(name==='vertexAttrib2f'&&args[0]===attrs.aMaterial)q.material=args.slice(1);
   if(name==='clear'){q.frames++;q.draws=[];}
   if(name==='drawArrays')q.draws.push({flow:q.uniforms.uCoolingFlow||0,travel:q.uniforms.uCoolingTravel||0,route:q.uniforms.uCoolingRoute,phase:q.uniforms.uCoolingPhase,opacity:q.uniforms.uOpacity,emission:q.material[1],count:args[2],camera:q.uniforms.uViewProjection,light:q.uniforms.uLightViewProjection,shadow:q.uniforms.uShadowPass});
   if(name==='createBuffer'){q.liveBuffers++;ids.set(result,++id);}
   if(name==='bindBuffer')bound=args[1];
   if(name==='bufferData'&&bound&&ArrayBuffer.isView(args[1])){const words=new Uint32Array(args[1].buffer,args[1].byteOffset,args[1].byteLength/4);let h=2166136261;for(const w of words)h=Math.imul(h^w,16777619);q.buffers[ids.get(bound)]=words.length+':'+(h>>>0);}
   if(name==='deleteBuffer'&&args[0]){q.liveBuffers--;delete q.buffers[ids.get(args[0])];}
   if(name==='createTexture')q.liveTextures++;if(name==='deleteTexture'&&args[0])q.liveTextures--;
   return result;
  };
 }
 window.__coolingRuntimeQA=q;
}
function invalidContract(){
 const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n));doc.extras.seats.pop();
 const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
 const header=Buffer.from(bytes.subarray(0,20)),tail=bytes.subarray(20+n);header.writeUInt32LE(20+json.length+tail.length,8);header.writeUInt32LE(json.length,12);return Buffer.concat([header,json,tail]);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  async function pageFor(fixture=null,options={}){
   const page=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1,...options});await page.addInitScript(observe);
   page.on('pageerror',e=>report.errors.push({fixture,error:e.message}));
   page.on('console',m=>{if(m.type()==='error')(fixture?report.expectedFixtureErrors:report.errors).push({fixture,error:m.text()});});
   page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.external.push(r.url());});
   if(fixture==='404')await page.route(companion,r=>r.fulfill({status:404,body:'Intentional cooling companion fixture'}));
   if(fixture==='ownership')await page.route(companion,r=>r.fulfill({status:200,contentType:'model/gltf-binary',body:invalidContract()}));
   if(fixture==='late-environment')await page.route('**/studio-small-09-radiance.png',async r=>{await new Promise(resolve=>setTimeout(resolve,1800));await r.fulfill({status:404,body:'Intentional delayed environment failure'});});
   return page;
  }
  const state=page=>page.evaluate(()=>({s:PAL10CoolingReview.scene.getState(),q:__coolingRuntimeQA}));
  async function settled(page,p=.310){await page.evaluate(p=>{PAL10CoolingReview.scene.setProgress(p);PAL10CoolingReview.scene.setInspection('cooling');},p);await page.waitForFunction(()=>{const s=PAL10CoolingReview.scene.getState();return s.ready&&!s.settling&&!s.cooling.loading;});await page.waitForTimeout(160);}
  let page=await pageFor();await page.goto(url);
  const semantic=await page.evaluate(()=>({a:PAL10Timeline.stageProgress('flow',.40),b:PAL10Timeline.stageProgress('flow',.60),solid:PAL10Timeline.stageProgress('solid')}));
  await settled(page,semantic.a);
  let a=await state(page);assert.equal(a.s.cooling.ready,true,a.s.cooling.error);assert.equal(a.s.asset.failed,false);
  let fluid=a.q.draws.filter(d=>d.flow===1&&d.shadow===0);assert.ok(fluid.length>=6,'Actual shader draws connected fluid geometry');assert.ok(fluid.every(d=>d.emission===0&&d.travel>0&&d.opacity>0));
  assert.equal(fluid.length,22);assert.equal(fluid.filter(d=>d.route[0]===0).length,6,'All six actual plate channels carry the thermal gradient');
  assert.equal(fluid.filter(d=>d.route[0]===-1).length,8,'Blue supply including trunk/header');assert.equal(fluid.filter(d=>d.route[0]===1).length,8,'Red return including header/trunk');
  const before=await page.screenshot(),frames=a.q.frames;await page.waitForTimeout(450);const paused=await state(page);
  assert.equal(paused.q.frames,frames,'Paused flow requests no animation frames');assert.equal(sha(await page.screenshot()),sha(before),'Paused flow is visually stable');
  await settled(page,semantic.b);const b=await state(page),next=b.q.draws.filter(d=>d.flow===1&&d.shadow===0);assert.ok(next[0].travel>fluid[0].travel);assert.deepEqual(next[0].camera,fluid[0].camera);assert.deepEqual(next[0].light,fluid[0].light);assert.equal(next[0].opacity,fluid[0].opacity);assert.notEqual(sha(await page.screenshot()),sha(before),'Advected flow changes actual pixels at fixed camera/light/opacity');
  assert.ok(Math.abs((next[0].travel-fluid[0].travel)-.85*.20*3.8)<1e-5,'Travel is constant physical distance per second across nonlinear choreography keys');
  report.flow={a:{progress:semantic.a,travel:fluid[0].travel,pngSHA256:sha(before)},b:{progress:semantic.b,travel:next[0].travel},fluidDraws:fluid.length,emission:0,routes:fluid.map(d=>({route:d.route,phase:d.phase}))};report.checks.push('Actual UV-distance advection; 22 routes / six thermal gradients / blue supply / red return, constant speed, fixed camera/light, zero emission; paused state is stable');
  await settled(page,semantic.solid);a=await state(page);assert.equal(a.s.l10.flow,0);assert.equal(a.q.draws.some(d=>d.flow===1),false);assert.equal(a.s.l10.lid,0);report.checks.push('Fluid disappears and solid metal returns before lid closure');
  // Context loss is an intentional browser event; all resources must reload.
  await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw new Error('Context-loss test extension unavailable');window.__restoreCooling=()=>ext.restoreContext();ext.loseContext();});
  await page.waitForFunction(()=>PAL10CoolingReview.scene.getState().contextLost);await page.waitForTimeout(100);await page.evaluate(()=>__restoreCooling());await page.waitForFunction(()=>PAL10CoolingReview.scene.getState().cooling.ready&&PAL10CoolingReview.scene.getState().ready,{timeout:60000});
  await settled(page,.310);assert.equal((await state(page)).s.cooling.failed,false);report.checks.push('Context loss/restoration reloads both bare and cooling assets');await page.close();
  page=await pageFor(null,{reducedMotion:'reduce'});await page.goto(url);await settled(page);a=await state(page);assert.equal(a.s.progress,1);assert.equal(a.s.l10.flow,0);assert.equal(a.s.l10.lid,1);assert.equal(a.q.draws.some(d=>d.flow===1),false);report.checks.push('Reduced Motion seats the assembly with zero fluid animation');await page.close();
  page=await pageFor();await page.goto(base+'/static/l10-bareboard-review.html?l10AssetLab=1&view=bare-hero');
  await page.waitForFunction(()=>window.PAL10Review?.scene.getState().ready,{timeout:60000});
  await page.evaluate(()=>{window.PAL10CoolingReview=PAL10Review;});await settled(page,.350);const procedural=await state(page);assert.equal(procedural.s.asset.enabled,false);await page.close();
  const fallbacks=[];
  for(const fixture of ['404','ownership','late-environment']){
   page=await pageFor(fixture);await page.goto(url);await settled(page,.350);a=await state(page);
   assert.equal(a.s.cooling.ready,false);assert.equal(a.s.cooling.failed,true);assert.equal(a.s.cooling.metadata,null);assert.equal(a.q.draws.some(d=>d.flow===1),false);
   if(fixture==='late-environment'){
    assert.equal(a.s.asset.failed,true);assert.equal(a.s.asset.metadata,null);
    assert.equal(a.s.vertices,procedural.s.vertices);assert.deepEqual(a.s.assembly,procedural.s.assembly);
    assert.deepEqual(Object.values(a.q.buffers).sort(),Object.values(procedural.q.buffers).sort(),'Every restored GPU buffer equals the complete procedural fallback');
    assert.equal(a.q.liveBuffers,procedural.q.liveBuffers);assert.equal(a.q.liveTextures,procedural.q.liveTextures);
   }else assert.equal(a.s.asset.failed,false,'Companion failure preserves the accepted bare asset');
   fallbacks.push({fixture,cooling:a.s.cooling,assetFailed:a.s.asset.failed,vertices:a.s.vertices,liveBuffers:a.q.liveBuffers,liveTextures:a.q.liveTextures});await page.close();
  }
  report.fallbacks=fallbacks;report.checks.push('Missing or incomplete cooling companion fails closed; delayed environment failure restores the full procedural scene');
  page=await pageFor();let releaseCompanion;
  const hold=new Promise(resolve=>{releaseCompanion=resolve;});
  await page.route(companion,async route=>{await hold;await route.continue();});
  await page.goto(base+'/?l10Bareboard=1#/dashboard',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreCooling==='loading',{timeout:60000});
  const clock=()=>page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.getState());
  const held=await clock();await page.waitForTimeout(450);const stillHeld=await clock();assert.equal(stillHeld.progress,held.progress,'Cinematic clock waits for the complete cooling companion');
  releaseCompanion();await page.waitForFunction(()=>document.querySelector('#system-core')?.paCoreScene?.getState().cooling.ready,{timeout:60000});
  report.loadingGate={heldProgress:held.progress,after450ms:stillHeld.progress};report.checks.push('Delayed companion loading holds the real dashboard cinematic clock');
  await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.seekTime(12000));
  await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling);
  let playback=await clock();assert.equal(playback.duration,39700);assert.equal(playback.timelineMode,'coolingV2');assert.ok(Math.abs(playback.elapsedMs-12000)<.001);
  const bar=await page.locator('[data-vo-progress]').evaluate(e=>e.style.transform);assert.equal(bar,'scaleX('+Number((12000/39700).toFixed(4))+')');
  const motionState=()=>page.evaluate(()=>({clock:document.querySelector('#core-story').paHeroPlayback.getState(),scene:document.querySelector('#system-core').paCoreScene.getState(),q:__coolingRuntimeQA}));
  const stopA=await motionState();await page.waitForTimeout(400);const stopB=await motionState();assert.equal(stopB.scene.l10.flowTravel,stopA.scene.l10.flowTravel);assert.equal(stopB.q.frames,stopA.q.frames);
  await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.resume());await page.waitForTimeout(400);await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.pause());
  const resumed=await motionState();assert.ok(resumed.clock.elapsedMs>12000);assert.ok(Math.abs(resumed.scene.l10.flowTravel-(resumed.clock.elapsedMs/1000-10.5)*.85)<1e-5);
  await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.skip());await page.waitForTimeout(200);playback=await clock();assert.equal(playback.progress,1);assert.equal(playback.elapsedMs,39700);
  await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.replay());await page.waitForTimeout(200);playback=await clock();assert.ok(playback.progress<.1);assert.ok(playback.elapsedMs<1000);assert.equal(playback.duration,39700);
  report.clock={seekMs:12000,resumedMs:resumed.clock.elapsedMs,durationMs:39700,progressBar:bar};report.checks.push('39.7-second central clock: seekTime, progress bar, pause/resume, Replay and Skip share the same state');await page.close();
  page=await pageFor('404');await page.goto(base+'/?l10Bareboard=1#/dashboard');await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreCooling==='fallback');playback=await clock();assert.equal(playback.duration,35200);assert.equal(playback.timelineMode,'legacy');report.checks.push('Failed companion retains the exact 35.2-second legacy timeline');await page.close();
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.pass=true;
 }catch(error){report.failure=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'cooling-runtime.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({pass:report.pass,checks:report.checks},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
