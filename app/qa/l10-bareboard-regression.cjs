/* Native Chromium regression for the opt-in bare-board asset. Synthetic only.
 * Observes actual WebGL draws and the unmodified 35.2 s playback clock.
 * PA_PREVIEW_URL=http://127.0.0.1:8774 node app/qa/l10-bareboard-regression.cjs
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Use a local synthetic preview');
const out=path.resolve(__dirname,'../../artifacts/l10-bareboard/evidence');fs.mkdirSync(out,{recursive:true});
const assetFile=path.resolve(__dirname,'../static/models/l10-prototype/bare-compute-boards.glb');
const assetPath='/static/models/l10-prototype/bare-compute-boards.glb';
const url=bare=>base+'/?'+(bare?'l10Bareboard=1':'')+'#/dashboard';
const report={passed:false,viewport:{width:3440,height:1440,deviceScaleFactor:1},authoredDurationMs:35200,checks:[],runs:[],bridge:[],errors:[],external:[],failureScenarioErrors:[],fallbacks:[],method:'Native Chromium/WebGL; three real-clock films. No animation, geometry, camera, lighting or resource timing mocks. Targeted GLB failure fixtures are isolated after normal-operation tests.'};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const near=(a,b,tolerance,label)=>assert.ok(Math.abs(a-b)<=tolerance,label+': '+a+' versus '+b);
const stats=values=>{const sorted=values.slice().sort((a,b)=>a-b);return {min:sorted[0],median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],max:sorted.at(-1),mean:values.reduce((a,b)=>a+b,0)/values.length};};

// Read-only instrumentation adapted from l10-phase5.cjs and l10-cinematic.cjs.
// A signature identifies the actual uploaded chassis buffer, so checking the
// primary pose does not rely only on a second call to assemblySnapshot.
function observeRealGL(){
 const contexts=new WeakMap(),sources=new Set();
 const q={recording:false,trace:[],last:null};
 const hash=data=>{let h=2166136261;const words=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);for(let i=0;i<words.length;i+=Math.max(1,Math.floor(words.length/101)))h=Math.imul(h^words[i],16777619);return data.length+':'+(h>>>0);};
 const state=gl=>{let s=contexts.get(gl);if(!s){s={buffer:null,buffers:new WeakMap(),locations:new WeakMap(),uniforms:{},draws:[],shadowDraws:0};contexts.set(gl,s);}return s;};
 const proto=WebGLRenderingContext.prototype;
 for(const name of ['bindBuffer','bufferData','getUniformLocation','uniform1f','uniform3fv','uniformMatrix4fv','drawArrays','drawElements','shaderSource']){
  const original=proto[name];proto[name]=function(...args){const s=state(this);
   if(name==='bindBuffer'&&args[0]===this.ARRAY_BUFFER)s.buffer=args[1];
   if(name==='bufferData'&&args[0]===this.ARRAY_BUFFER&&s.buffer&&ArrayBuffer.isView(args[1]))s.buffers.set(s.buffer,hash(args[1]));
   if(name==='getUniformLocation'){const result=original.apply(this,args);if(result)s.locations.set(result,args[1]);return result;}
   if(name==='uniform1f'||name==='uniform3fv'||name==='uniformMatrix4fv'){const key=s.locations.get(args[0]);if(key)s.uniforms[key]=name==='uniform1f'?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);}
   if(name==='shaderSource')sources.add(args[1]);
   if(name==='drawArrays'||name==='drawElements'){
    if(s.uniforms.uShadowPass)s.shadowDraws++;
    else s.draws.push({count:args[name==='drawArrays'?2:1],hash:s.buffers.get(s.buffer),part:s.uniforms.uPart?.slice(),model:s.uniforms.uModel?.slice(),opacity:s.uniforms.uOpacity,asset:s.uniforms.uAsset||0});
   }
   return original.apply(this,args);
  };
 }
 window.__bareQA=q;
 q.shaders=()=>Array.from(sources);
 q.start=()=>{q.trace=[];q.recording=true;q.started=performance.now();q.canvas=document.querySelector('#system-core');q.scene=q.canvas.paCoreScene;q.gl=q.canvas.getContext('webgl');q.chassisHash=hash(PAL10Hardware.build(PAL10Hardware.profile).meshes['l10-chassis'].data);};
 window.addEventListener('pa-core-projection',()=>{
  const canvas=document.querySelector('#system-core'),scene=canvas?.paCoreScene;if(!scene)return;
  const gl=canvas.getContext('webgl'),g=state(gl),s=scene.getState(),assembly=PACoreScene.assemblySnapshot(s.progress);
  const chassis=g.draws.filter(draw=>draw.hash===q.chassisHash&&!draw.asset);
  q.last={drawCalls:g.draws.length,submittedVerticesOrIndices:g.draws.reduce((n,d)=>n+d.count,0),shadowDrawCalls:g.shadowDraws,eyeUniform:g.uniforms.uEye,viewProjection:g.uniforms.uViewProjection,lighting:Object.fromEntries(['uKeyPosition','uLightTheme','uHasEnvironment','uReveal','uQuality'].filter(k=>k in g.uniforms).map(k=>[k,g.uniforms[k]])),glError:gl.getError()};
  if(q.recording){
   q.trace.push({ms:performance.now()-q.started,progress:s.progress,playback:document.querySelector('#core-story')?.paHeroPlayback?.getState().mode,camera:s.camera,pose:s.assembly.primaryPose,expectedPose:assembly.primaryPose,insertion:s.assembly.insertion,expectedInsertion:assembly.insertion,targetU:s.assembly.targetU,l10:s.l10,inspection:s.inspection,quality:s.quality,geometryVertices:s.vertices,assetFailed:s.asset.failed,chassisDraws:chassis,sameContext:canvas===q.canvas&&scene===q.scene&&gl===q.gl,...q.last});
   if(q.trace.length>150&&s.progress>=.99999)q.recording=false;
  }
  g.draws=[];g.shadowDraws=0;
 });
}

function analyzeFilm(observed){
 const endpoint=observed.findIndex(r=>r.progress>=.99999);assert.ok(endpoint>=0,'Actual rendered endpoint observed');
 const rows=observed.slice(0,endpoint+1);assert.ok(rows.length>150,'Full film contains rendered frames');assert.ok(rows[0].progress<.025,'Real film starts at beginning');
 let insertion=0,started=0,finished=0;const intervals=[],bridge=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i];assert.equal(row.sameContext,true);assert.equal(row.glError,0);assert.equal(row.assetFailed,false);assert.equal(row.targetU,40);assert.equal(row.pose.scale,1);assert.equal(row.inspection,null);
  assert.deepEqual(row.pose,row.expectedPose,'Rendered state follows retained assemblySnapshot');assert.equal(row.insertion,row.expectedInsertion);
  assert.ok(row.chassisDraws.length>=1,'Original chassis GPU draw remains present');
  for(const draw of row.chassisDraws){near(draw.part[12],row.pose.x,2e-6,'Actual chassis x');near(draw.part[13],row.pose.y,2e-6,'Actual chassis y');near(draw.part[14],row.pose.z,2e-6,'Actual chassis z');near(draw.part[0],1,1e-7,'No tray scale jump');near(draw.part[5],1,1e-7,'No tray scale jump');near(draw.part[10],1,1e-7,'No tray scale jump');}
  assert.deepEqual(row.eyeUniform,row.camera.eye,'Actual shader eye matches rendered camera');
  assert.ok(row.insertion+1e-7>=insertion,'U40 insertion cannot restart');
  if(insertion===0&&row.insertion>0)started++;
  if(insertion<1&&row.insertion===1)finished++;
  insertion=row.insertion;
  if(i){const prev=rows[i-1];assert.ok(row.progress+1e-7>=prev.progress,'No timeline reversal');if(row.ms>prev.ms)intervals.push(row.ms-prev.ms);
   for(const key of ['boardLift','packageLift','ioLift','coolingLift'])assert.ok(row.l10[key]<=prev.l10[key]+1e-7,'No repeated assembly: '+key);
   if(row.progress>=.385&&prev.progress<=.59){const sample={progress:row.progress,deltaMs:row.ms-prev.ms,eyeStep:dist(row.camera.eye,prev.camera.eye),targetStep:dist(row.camera.target,prev.camera.target),trayStep:dist([row.pose.x,row.pose.y,row.pose.z],[prev.pose.x,prev.pose.y,prev.pose.z]),yawStep:Math.abs(row.camera.yaw-prev.camera.yaw),elevationStep:Math.abs(row.camera.elevation-prev.camera.elevation)};
    assert.ok(sample.eyeStep<1.5&&sample.trayStep<.8&&sample.yawStep<.15&&sample.elevationStep<.15,'Observed camera bridge jump guard');assert.equal(row.l10.flow,0);bridge.push(sample);
   }
  }
 }
 assert.equal(started,1,'U40 insertion starts exactly once');assert.equal(finished,1,'U40 insertion completes exactly once');assert.ok(bridge.length>20,'Bridge continuously sampled');
 const elapsed=rows.at(-1).ms-rows[0].ms;assert.ok(rows.at(-1).ms>34000&&rows.at(-1).ms<65000,'Real 35.2 s clock, allowing host draw scheduling overhead');
 return {frames:rows.length,wallDurationMs:rows.at(-1).ms,observedDrawFPS:(rows.length-1)/elapsed*1000,drawIntervalsMs:stats(intervals),drawCalls:stats(rows.map(r=>r.drawCalls)),submittedVerticesOrIndices:stats(rows.map(r=>r.submittedVerticesOrIndices)),pixelCount:stats(rows.map(r=>r.quality.pixelCount)),insertionStarts:started,insertionCompletions:finished,bridge:{frames:bridge.length,eyeStep:stats(bridge.map(r=>r.eyeStep)),trayStep:stats(bridge.map(r=>r.trayStep)),samples:bridge},limitations:'Draw cadence and allocation estimates are measured on this host, not a GPU timer or portable performance certification. Adaptive pixel counts are recorded.'};
}

function malformedOwnership(mode){
 const bytes=fs.readFileSync(assetFile),oldLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+oldLength).toString('utf8'));
 assert.deepEqual(doc.extras.replacesComputeBoards,[0,1],'Fixture must start with the two-board production candidate');
 if(mode==='network-ownership')doc.extras.networkCards=['BF3-L','BF3-R'];
 else doc.extras.replacesComputeBoards=[0];
 const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
 const header=Buffer.from(bytes.subarray(0,20)),tail=bytes.subarray(20+oldLength);header.writeUInt32LE(20+json.length+tail.length,8);header.writeUInt32LE(json.length,12);
 return Buffer.concat([header,json,tail]);
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 let page;
 const check=label=>{report.checks.push(label);console.log('PASS '+label);};
 const createPage=async failure=>{const p=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1});await p.addInitScript(observeRealGL);
  p.on('pageerror',e=>report.errors.push({scenario:failure||'normal',type:'pageerror',error:e.message}));
  p.on('console',m=>{if(m.type()==='error')(failure?report.failureScenarioErrors:report.errors).push({scenario:failure||'normal',type:'console',error:m.text()});});
  p.on('response',r=>{if(r.status()>=400)(failure?report.failureScenarioErrors:report.errors).push({scenario:failure||'normal',type:'http',status:r.status(),url:r.url()});});
  p.on('requestfailed',r=>(failure?report.failureScenarioErrors:report.errors).push({scenario:failure||'normal',type:'requestfailed',url:r.url(),error:r.failure()?.errorText}));
  p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.external.push(r.url());});return p;
 };
 const ready=()=>page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback&&document.querySelector('#system-core').paCoreScene.getState().quality.environmentReady,null,{timeout:120000});
 const settle=async()=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling,null,{timeout:90000});};
 const read=()=>page.evaluate(()=>({scene:document.querySelector('#system-core').paCoreScene.getState(),playback:document.querySelector('#core-story').paHeroPlayback.getState(),observed:__bareQA.last,canvas:{width:document.querySelector('#system-core').width,height:document.querySelector('#system-core').height}}));
 const seek=async progress=>{await page.evaluate(p=>{document.querySelector('#core-story').paHeroPlayback.seek(p);document.querySelector('#system-core').paCoreScene.resetOrbit();},progress);await page.waitForFunction(p=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.00003,progress);await settle();};
 try{
  report.asset={file:path.relative(path.resolve(__dirname,'../..'),assetFile),bytes:fs.statSync(assetFile).size,sha256:sha(fs.readFileSync(assetFile))};
  page=await createPage();await page.goto(url(true),{waitUntil:'domcontentloaded',timeout:120000});await ready();assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true,'Synthetic fixture required');
  await page.waitForFunction(()=>{const a=document.querySelector('#system-core').paCoreScene.getState().asset;return a.enabled&&!a.loading;},null,{timeout:120000});
  const loaded=await read();assert.equal(loaded.scene.asset.failed,false,loaded.scene.asset.error);assert.deepEqual(loaded.scene.asset.metadata.extras.replacesComputeBoards,[0,1]);assert.equal(loaded.scene.asset.metadata.extras.bareBoardOnly,true);report.loadedAsset=loaded.scene.asset;
  report.webgl=await page.evaluate(()=>{const gl=document.querySelector('#system-core').getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR)};});
  report.compiledShaderSHA256=(await page.evaluate(()=>__bareQA.shaders())).map(source=>sha(Buffer.from(source))).sort();
  await page.evaluate(()=>applyTheme('dark'));check('Bare asset loaded in normal dashboard with two-board ownership and no fallback');
  for(let film=1;film<=3;film++){
   await seek(1);await page.evaluate(()=>__bareQA.start());await page.locator('[data-vo-replay]').click();
   // start() precedes the actual Replay click; omit pre-click endpoint draws.
   await page.waitForFunction(()=>__bareQA.trace.some(row=>row.progress<.025),null,{timeout:15000});
   await page.waitForFunction(()=>!__bareQA.recording&&__bareQA.trace.at(-1)?.progress>=.99999&&document.querySelector('#core-story').paHeroPlayback.getState().mode==='stopped',null,{timeout:240000});
   const observed=await page.evaluate(()=>__bareQA.trace),start=observed.findIndex(r=>r.progress<.025),trace=observed.slice(start),offset=trace[0].ms;trace.forEach(r=>r.ms-=offset);
   fs.writeFileSync(path.join(out,'bare-film-'+film+'.json'),JSON.stringify(trace));report.runs.push({film,...analyzeFilm(trace)});check('Film '+film+': real clock, GPU chassis pose, continuous bridge and exactly one U40 insertion');
  }
  for(const progress of [.40,.42,.48,.56]){await seek(progress);const state=await read();assert.equal(state.scene.quality.resolution,1);assert.equal(state.scene.inspection,null);assert.equal(state.observed.glError,0);const filename='3440x1440-bridge-'+progress.toFixed(2)+'.png',file=path.join(out,filename);await page.screenshot({path:file,fullPage:false,animations:'disabled'});const bytes=fs.readFileSync(file);assert.equal(bytes.readUInt32BE(16),3440);assert.equal(bytes.readUInt32BE(20),1440);report.bridge.push({progress,file:filename,sha256:sha(bytes),...state});}
  check('Four native 3440×1440 bridge frames captured using authored cameras');
  await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress>.005);await page.locator('[data-vo-skip]').click();await settle();let s=await read();assert.ok(s.scene.progress>=.99999);assert.equal(s.playback.mode,'stopped');assert.equal(s.scene.asset.failed,false);assert.equal(s.scene.l10.flow,0);assert.equal(s.scene.l10.lid,1);
  await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().mode==='film');await page.locator('#system-core').press('ArrowRight');await settle();assert.equal((await read()).playback.mode,'stopped');
  await seek(1);await page.locator('#system-core').press('ArrowRight');await settle();assert.notEqual((await read()).scene.yaw,0);await page.locator('#system-core').press('Home');await settle();assert.equal((await read()).scene.yaw,0);
  await page.locator('[data-core-view="rear"]').click();await settle();assert.equal((await read()).scene.camera.view,'rear');await page.locator('[data-core-view="reset"]').click();await settle();assert.equal((await read()).scene.camera.view,'authored');
  await page.emulateMedia({reducedMotion:'reduce'});await settle();s=await read();assert.ok(s.scene.progress>=.99999);assert.equal(s.scene.idle.disabled,true);report.reducedMotion=s;await page.emulateMedia({reducedMotion:'no-preference'});check('Skip, Replay, interruption, orbit, Home, rear/reset and reduced motion retain behavior');
  await page.close();page=await createPage();await page.goto(url(false),{waitUntil:'domcontentloaded',timeout:120000});await ready();await seek(.354);const baseline=await read();assert.equal(baseline.scene.asset.enabled,false);assert.equal(baseline.observed.glError,0);report.proceduralBaseline={vertices:baseline.scene.vertices,geometryBuffers:baseline.scene.geometryBuffers,asset:baseline.scene.asset};await page.close();
  for(const mode of ['404','one-board-metadata','network-ownership']){
   page=await createPage(mode);await page.route('**/bare-compute-boards.glb',route=>mode==='404'?route.fulfill({status:404,contentType:'text/plain',body:'Intentional bare-board regression fixture'}):route.fulfill({status:200,contentType:'model/gltf-binary',body:malformedOwnership(mode)}));
   await page.goto(url(true),{waitUntil:'domcontentloaded',timeout:120000});await ready();await page.waitForFunction(()=>document.querySelector('#system-core').paCoreScene.getState().asset.failed&&!document.querySelector('#system-core').paCoreScene.getState().asset.loading,null,{timeout:120000});await seek(.354);const fallback=await read();
   assert.equal(fallback.scene.ready,true);assert.equal(fallback.scene.asset.metadata,null);assert.equal(fallback.scene.vertices,baseline.scene.vertices,'Complete fallback vertex inventory');assert.equal(fallback.scene.geometryBuffers,baseline.scene.geometryBuffers);assert.deepEqual(fallback.scene.assembly,baseline.scene.assembly);assert.ok(fallback.observed.drawCalls>0);assert.equal(fallback.observed.glError,0);
   assert.match(fallback.scene.asset.error,mode==='404'?/404/:mode==='network-ownership'?/all three declared cards/:/two boards/);report.fallbacks.push({mode,passed:true,...fallback});check(mode+': fail-closed complete baseline retained');await page.close();
  }
  assert.deepEqual(report.errors,[],'Normal operation has no shader, resource, or JavaScript errors');assert.deepEqual(report.external,[],'All runtime resources self-hosted');
  const unexpectedFailure=report.failureScenarioErrors.filter(e=>e.type==='http'||e.type==='requestfailed').filter(e=>!e.url.endsWith(assetPath));assert.deepEqual(unexpectedFailure,[],'Only the deliberate GLB failure is allowed');report.passed=true;
 }catch(error){report.failure=error.stack;try{report.lastState=await read();}catch{}throw error;}
 finally{fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({passed:report.passed,films:report.runs.length,checks:report.checks.length,report:path.join(out,'regression.json')},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
