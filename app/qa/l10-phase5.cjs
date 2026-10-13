/* Phase 5: Phase 4 asset versus reconstructed asset in actual native Chrome, paired asset inspection and retained film.
 * Synthetic localhost preview only. No mocked geometry, material or clock.
 * Run with NODE_PATH / PLAYWRIGHT_MODULE and optional CHROME_PATH configured:
 * PA_PREVIEW_URL=http://127.0.0.1:8774 node app/qa/l10-phase5.cjs
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname),'Run against a local synthetic preview');
const referenceReview=process.argv.includes('--reference-review');
const out=path.resolve(__dirname,'../../artifacts/'+(referenceReview?'l10-reference-review':'l10-phase5'));
const baseline=path.join(out,'baseline',referenceReview?'phase5-compute-board.glb':'phase4-compute-board.glb');
const baselineCommit=referenceReview?'3ce4b9c6e5467abe9d27050e5af0240b07fff3dc':'031830a1c7faf5484b358e0964551e8656e1d852';
const baselineHash=referenceReview?'fe898a419c0f613bd003ef964e921dcc7c43771c4ed841bdbcd92da695857bc7':'c8467c0ac186b34ee95e549fc27f5da47ad3de4b8d09b72b68d6070e774985cc';
const current=path.resolve(__dirname,'../static/models/l10-prototype/compute-board.glb');
// Reproduce the historical comparison from Git without checking out or mutating
// either branch. The frozen fixture is deliberately outside runtime assets.
if(!fs.existsSync(baseline)){
  const bytes=require('node:child_process').execFileSync('git',['show',baselineCommit+':app/static/models/l10-prototype/compute-board.glb'],{cwd:path.resolve(__dirname,'../..'),maxBuffer:24*1024*1024});
  fs.mkdirSync(path.dirname(baseline),{recursive:true});fs.writeFileSync(baseline,bytes);
}
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'),baselineHash,'Before must be the verified historical GLB');
const stages=[{id:'01-packages',inspection:'packages',progress:.21},{id:'02-board',inspection:'board',progress:.11},{id:'03-cooling',inspection:'cooling',progress:.354},{id:'04-hero',inspection:null,progress:.354}];
if(referenceReview)stages.push({id:'05-fans',inspection:'fans',progress:.354},{id:'06-power',inspection:'power',progress:.354});
for(const name of ['before','after','evidence'])fs.mkdirSync(path.join(out,name),{recursive:true});
const report={passed:false,viewport:{width:3440,height:1440,deviceScaleFactor:1},comparison:'Phase 4 GLB versus Phase 5 GLB; both opt-in with identical renderer/camera/light/exposure/progress. Local route serves both saved GLB byte streams; load timings are fixture timings, not CDN benchmarks.',loading:{},checks:[],pairs:[],runs:[],errors:[],external:[],failureScenarioErrors:[],sources:{}};
if(referenceReview)report.comparison='Phase 5 commit '+baselineCommit+' versus evidence-based service geometry; same opt-in renderer/camera/light/exposure/progress. Local GLB fixtures, not CDN benchmarks.';
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
// Corrupt only the service ownership declaration, retaining the valid binary
// payload and io mesh. The browser must reject this before omitting legacy IO.
function inconsistentServiceFixture(){
  const bytes=fs.readFileSync(current),oldLength=bytes.readUInt32LE(12);
  const doc=JSON.parse(bytes.subarray(20,20+oldLength).toString('utf8'));
  assert.equal(doc.extras.replacesServiceGeometry,true);
  doc.extras.replacesServiceGeometry=false;
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(json);
  const header=Buffer.from(bytes.subarray(0,20)),tail=bytes.subarray(20+oldLength);
  header.writeUInt32LE(20+json.length+tail.length,8);header.writeUInt32LE(json.length,12);
  return Buffer.concat([header,json,tail]);
}
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const summary=values=>{const sorted=values.slice().sort((a,b)=>a-b);return {min:sorted[0],median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],max:sorted.at(-1),mean:values.reduce((a,b)=>a+b,0)/values.length};};

function observeRealGL(){
  const tracked=new WeakMap(),shaders=new Set(),q={recording:false,trace:[],last:null,shaders:()=>Array.from(shaders)};
  const state=gl=>{let s=tracked.get(gl);if(!s){s={locations:new WeakMap(),uniforms:{},draws:0,submitted:0,shadowDraws:0,shadowSubmitted:0};tracked.set(gl,s);}return s;};
  const proto=WebGLRenderingContext.prototype;
  for(const name of ['getUniformLocation','uniform1f','uniform3fv','uniformMatrix4fv','drawArrays','drawElements','shaderSource']){
    const original=proto[name];
    proto[name]=function(...args){
      const s=state(this);let result;
      if(name==='getUniformLocation'){result=original.apply(this,args);if(result)s.locations.set(result,args[1]);return result;}
      if(name==='uniform1f'||name==='uniform3fv'||name==='uniformMatrix4fv'){
        const key=s.locations.get(args[0]);if(key)s.uniforms[key]=name==='uniform1f'?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);
      }
      if(name==='shaderSource')shaders.add(args[1]);
      if(name==='drawArrays'||name==='drawElements'){
        const count=args[name==='drawArrays'?2:1];
        if(s.uniforms.uShadowPass){s.shadowDraws++;s.shadowSubmitted+=count;}else{s.draws++;s.submitted+=count;}
      }
      return original.apply(this,args);
    };
  }
  window.__l10AssetQA=q;
  q.start=()=>{q.trace=[];q.recording=true;q.started=performance.now();q.canvas=document.querySelector('#system-core');q.scene=q.canvas.paCoreScene;q.gl=q.canvas.getContext('webgl');};
  window.addEventListener('pa-core-projection',()=>{
    const canvas=document.querySelector('#system-core'),scene=canvas?.paCoreScene;if(!scene)return;
    const gl=canvas.getContext('webgl'),g=state(gl),s=scene.getState();
    q.last={drawCalls:g.draws,submittedVerticesOrIndices:g.submitted,shadowDrawCalls:g.shadowDraws,shadowSubmittedVerticesOrIndices:g.shadowSubmitted,lighting:Object.fromEntries(['uKeyPosition','uLightTheme','uHasEnvironment','uReveal','uQuality'].filter(key=>key in g.uniforms).map(key=>[key,g.uniforms[key]]))};
    if(q.recording){
      const playback=document.querySelector('#core-story')?.paHeroPlayback?.getState();
      q.trace.push({ms:performance.now()-q.started,progress:s.progress,playback:playback?.mode,camera:s.camera,pose:s.assembly.primaryPose,insertion:s.assembly.insertion,l10:s.l10,inspection:s.inspection,quality:s.quality,reportedDrawCalls:s.drawCalls,geometryVertices:s.vertices,...q.last,sameContext:canvas===q.canvas&&scene===q.scene&&gl===q.gl,glError:gl.getError()});
      // The controller can switch to stopped after the final projection event.
      // Waiting for another draw would include the 6.5-second idle delay.
      if(q.trace.length>150&&s.progress>=.99999)q.recording=false;
    }
    g.draws=0;g.submitted=0;g.shadowDraws=0;g.shadowSubmitted=0;
  });
}

function analyzeFilm(observedRows){
  const endpoint=observedRows.findIndex(row=>row.progress>=.99999);
  assert.ok(endpoint>=0,'Observed trace contains the actual rendered endpoint');
  const rows=observedRows.slice(0,endpoint+1);
  assert.ok(rows.length>150,'Actual full film produces rendered frames');
  assert.ok(rows[0].progress<.02,'Film begins at the start');assert.ok(rows.at(-1).progress>=.99999,'Film reaches the endpoint');
  const intervals=[],bridge=[],resolutionChanges=[];let insertion=0;
  for(let i=0;i<rows.length;i++){
    const row=rows[i];assert.equal(row.sameContext,true);assert.equal(row.glError,0);assert.equal(row.pose.scale,1);assert.equal(row.inspection,null,'Normal film is not an inspection camera');
    if(row.progress<.8){assert.ok(row.insertion+1e-7>=insertion,'No repeated U40 insertion');insertion=row.insertion;}
    if(i){
      const prev=rows[i-1];assert.ok(row.progress+1e-7>=prev.progress,'Film progresses naturally');
      if(row.ms>prev.ms)intervals.push(row.ms-prev.ms);
      for(const key of ['boardLift','packageLift','ioLift','coolingLift'])assert.ok(row.l10[key]<=prev.l10[key]+1e-7,'No reassembly: '+key);
      if(row.quality.resolution!==prev.quality.resolution)resolutionChanges.push({progress:row.progress,from:prev.quality.resolution,to:row.quality.resolution,pixelCount:row.quality.pixelCount});
      if(row.progress>=.385&&prev.progress<=.59){
        const sample={progress:row.progress,eyeStep:distance(row.camera.eye,prev.camera.eye),targetStep:distance(row.camera.target,prev.camera.target),trayStep:distance([row.pose.x,row.pose.y,row.pose.z],[prev.pose.x,prev.pose.y,prev.pose.z]),yawStep:Math.abs(row.camera.yaw-prev.camera.yaw),elevationStep:Math.abs(row.camera.elevation-prev.camera.elevation)};
        assert.ok(sample.eyeStep<1.5&&sample.trayStep<.8&&sample.yawStep<.15&&sample.elevationStep<.15,'Conservative per-frame camera/tray jump guard');
        assert.equal(row.l10.flow,0);bridge.push(sample);
      }
    }
  }
  assert.ok(bridge.length>20);
  const elapsed=rows.at(-1).ms-rows[0].ms;
  return {frames:rows.length,rawObservedFrames:observedRows.length,postFilmObservationsOmitted:observedRows.length-rows.length,endpointRule:'First actual draw with progress >= 0.99999 (renderer progress epsilon); later idle draws remain in raw trace but are excluded from film metrics.',wallDurationMs:rows.at(-1).ms,authoredFilmDurationMs:35200,observedDrawFPS:(rows.length-1)/elapsed*1000,drawIntervalsMs:summary(intervals),drawCalls:summary(rows.map(r=>r.drawCalls)),submittedVerticesOrIndices:summary(rows.map(r=>r.submittedVerticesOrIndices)),shadowDrawCalls:summary(rows.map(r=>r.shadowDrawCalls)),shadowSubmittedVerticesOrIndices:summary(rows.map(r=>r.shadowSubmittedVerticesOrIndices)),geometryVertices:summary(rows.map(r=>r.geometryVertices)),nativePixels:summary(rows.map(r=>r.quality.pixelCount)),resolutionChanges,bridge:{frames:bridge.length,eyeStep:summary(bridge.map(r=>r.eyeStep)),trayStep:summary(bridge.map(r=>r.trayStep)),samples:bridge},limitations:'Observed native-browser draw cadence on this host, not GPU timer measurements or portable device certification. Raw draw counts include any repeated renderer draws before a projection event. Adaptive resolution changes are recorded and prevent an equal-pixel FPS speedup claim when variants differ.'};
}

if(process.argv.includes('--measure-loading-only')){
  (async()=>{
    const file=path.join(out,'prototype-comparison.json'),saved=JSON.parse(fs.readFileSync(file,'utf8'));
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
    try{
      for(const [variant,glbFile] of [['before',baseline],['after',current]]){
        const samples=[];
        for(let i=0;i<3;i++){
          const page=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1});
          await page.route('**/compute-board.glb',route=>route.fulfill({path:glbFile,contentType:'model/gltf-binary'}));
          const started=Date.now();await page.goto(base+'/?l10AssetLab=1&l10AssetPrototype=1#/dashboard',{waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>{const s=document.querySelector('#system-core')?.paCoreScene?.getState();return s?.ready&&s.quality.environmentReady&&s.asset.enabled&&!s.asset.loading&&!s.asset.failed;},null,{timeout:120000});
          assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true);
          samples.push(Date.now()-started);await page.close();
        }
        saved.loading[variant]={assetReadySamplesMs:samples,...summary(samples),glbBytes:fs.statSync(glbFile).size,glbSHA256:sha(fs.readFileSync(glbFile)),method:'Three fresh browser contexts; localhost GLB byte fixtures. Navigation through both environmentReady and asset upload completion. Includes shell/build/decode/upload; not a CDN or isolated download benchmark.'};
      }
      fs.writeFileSync(file,JSON.stringify(saved,null,2));console.log(JSON.stringify(saved.loading,null,2));
    }finally{await browser.close();}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}else if(process.argv.includes('--reanalyze-existing')){
  const file=path.join(out,'prototype-comparison.json'),saved=JSON.parse(fs.readFileSync(file,'utf8'));
  saved.runs=saved.runs.map(run=>({variant:run.variant,...analyzeFilm(JSON.parse(fs.readFileSync(path.join(out,'evidence',run.variant+'-film-trace.json'),'utf8'))),asset:run.asset}));
  saved.traceReanalysis='Original actual-browser traces retained byte-for-byte; film metrics end at first rendered endpoint, excluding any later idle draw.';
  fs.writeFileSync(file,JSON.stringify(saved,null,2));console.log(JSON.stringify(saved.runs.map(({variant,frames,wallDurationMs,observedDrawFPS,postFilmObservationsOmitted})=>({variant,frames,wallDurationMs,observedDrawFPS,postFilmObservationsOmitted})),null,2));
}else (async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
  let page,lastRead;
  const url=()=>base+'/?l10AssetLab=1&l10AssetPrototype=1#/dashboard';
  const createPage=async intentionalFailure=>{
    const p=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1});await p.addInitScript(observeRealGL);
    p.on('pageerror',e=>(intentionalFailure?report.failureScenarioErrors:report.errors).push(e.message));
    p.on('console',m=>{if(m.type()==='error')(intentionalFailure?report.failureScenarioErrors:report.errors).push(m.text());});
    p.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.external.push(r.url());});return p;
  };
  const read=()=>page.evaluate(()=>({scene:document.querySelector('#system-core').paCoreScene.getState(),playback:document.querySelector('#core-story').paHeroPlayback.getState(),observed:__l10AssetQA.last,canvas:{width:document.querySelector('#system-core').width,height:document.querySelector('#system-core').height},webgl:(()=>{const gl=document.querySelector('#system-core').getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR)};})()}));
  lastRead=read;
  const ready=()=>page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback&&document.querySelector('#system-core').paCoreScene.getState().quality.environmentReady,null,{timeout:120000});
  const settle=async()=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling,null,{timeout:90000});};
  const seek=async(progress,inspection=null)=>{
    await page.evaluate(({progress,inspection})=>{const s=document.querySelector('#system-core').paCoreScene;document.querySelector('#core-story').paHeroPlayback.seek(progress);s.resetOrbit();s.setInspection(inspection);},{progress,inspection});
    await page.waitForFunction(p=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.00003,progress);await settle();
  };
  const check=label=>{report.checks.push(label);console.log('PASS '+label);};
  try{
    for(const enabled of [false,true]){
      const variant=enabled?'after':'before';page=await createPage(false);const glbFile=enabled?current:baseline;
      await page.route('**/compute-board.glb',route=>route.fulfill({path:glbFile,contentType:'model/gltf-binary'}));
      const loadStarted=Date.now();await page.goto(url(),{waitUntil:'domcontentloaded',timeout:120000});await ready();
      assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true,'Synthetic fixture preview required');
      await page.waitForFunction(enabled=>{const a=document.querySelector('#system-core').paCoreScene.getState().asset;return a&&a.enabled===true&&!a.loading;},enabled,{timeout:120000});
      report.loading[variant]={navigationToAssetReadyMs:Date.now()-loadStarted,glbBytes:fs.statSync(glbFile).size,glbSHA256:sha(fs.readFileSync(glbFile)),method:'Fresh browser context; local GLB fixture; both environment and asset upload complete. Includes shell/build/decode/upload; one sample, no CDN/network estimate'};
      assert.equal((await read()).scene.asset.failed,false);await page.evaluate(()=>applyTheme('dark'));
      const envResponse=await page.request.get(base+'/static/img/l10/studio-small-09-radiance.png');assert.equal(envResponse.ok(),true);
      const envBytes=await envResponse.body(),shaderSources=await page.evaluate(()=>__l10AssetQA.shaders());
      report.sources[variant]={environmentSHA256:sha(envBytes),environmentBytes:envBytes.length,compiledShaderSHA256:shaderSources.map(source=>sha(Buffer.from(source))).sort()};
      for(const stage of stages){
        await seek(stage.progress,stage.inspection);const state=await read();
        assert.equal(state.scene.inspection,stage.inspection);assert.equal(state.scene.ready,true);assert.equal(state.scene.quality.resolution,1,'Static comparison uses native canvas pixels');assert.equal(state.scene.quality.contactShadows,true);assert.equal(state.scene.asset.enabled,true);
        assert.equal(state.scene.assembly.targetU,40);assert.equal(state.scene.assembly.primaryPose.scale,1);
        const file=path.join(out,variant,'3440x1440-'+stage.id+'.png');await page.screenshot({path:file,fullPage:false,animations:'disabled'});
        const png=fs.readFileSync(file);assert.equal(png.readUInt32BE(16),3440);assert.equal(png.readUInt32BE(20),1440);
        const evidence={variant,...stage,file:path.relative(out,file).replaceAll('\\','/'),sha256:sha(png),...state};
        fs.writeFileSync(path.join(out,variant,stage.id+'.json'),JSON.stringify(evidence,null,2));
        let pair=report.pairs.find(p=>p.id===stage.id);if(!pair){pair={id:stage.id};report.pairs.push(pair);}pair[variant]=evidence;
        console.log('CAPTURE '+variant+' '+stage.id+' '+state.scene.quality.pixelCount+' native canvas pixels');
      }
      check(variant+': '+stages.length+' native 3440x1440 captures, no lighting/exposure override');
      if(enabled){
        report.supplemental=[];
        for(const [label,progress,inspection] of [['cooling-reveal',.312,'cooling'],['bridge',.48,null],['rack-final',1,null]]){
          await seek(progress,inspection);const state=await read(),file=path.join(out,'after','3440x1440-'+label+'.png');
          await page.screenshot({path:file,fullPage:false,animations:'disabled'});
          report.supplemental.push({label,progress,file:path.relative(out,file).replaceAll('\\','/'),sha256:sha(fs.readFileSync(file)),...state});
        }
      }
      await seek(1);await page.locator('[data-vo-replay]').click();await page.evaluate(()=>__l10AssetQA.start());
      await page.waitForFunction(()=>!__l10AssetQA.recording&&__l10AssetQA.trace.at(-1)?.progress>=.99999&&document.querySelector('#core-story').paHeroPlayback.getState().mode==='stopped',null,{timeout:240000});
      const trace=await page.evaluate(()=>__l10AssetQA.trace);fs.writeFileSync(path.join(out,'evidence',variant+'-film-trace.json'),JSON.stringify(trace));
      const metrics=analyzeFilm(trace);report.runs.push({variant,...metrics,asset:(await read()).scene.asset});check(variant+': complete real-clock film, unchanged layer sequence, bridge and U40 identity');
      if(enabled){
        await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress>.005);await page.locator('[data-vo-skip]').click();await settle();
        const skipped=await read();assert.ok(skipped.scene.progress>=.99999);assert.equal(skipped.playback.mode,'stopped');assert.equal(skipped.scene.l10.flow,0);assert.equal(skipped.scene.l10.lid,1);assert.equal(skipped.scene.asset.failed,false);
        await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().mode==='film');await page.locator('#system-core').press('ArrowRight');await settle();assert.equal((await read()).playback.mode,'stopped');
        await seek(1);await page.locator('#system-core').press('ArrowRight');await settle();assert.notEqual((await read()).scene.yaw,0);await page.locator('#system-core').press('Home');await settle();assert.equal((await read()).scene.yaw,0);
        await page.locator('[data-core-view="rear"]').click();await settle();assert.equal((await read()).scene.camera.view,'rear');await page.locator('[data-core-view="reset"]').click();await settle();assert.equal((await read()).scene.camera.view,'authored');
        check('Opt-in: Skip, Replay, keyboard orbit and rear/reset remain operational');
        const beforeRestore=await read();await page.evaluate(()=>{const gl=document.querySelector('#system-core').getContext('webgl');window.__assetLost=gl.getExtension('WEBGL_lose_context');if(!__assetLost)throw Error('WEBGL_lose_context unavailable');__assetLost.loseContext();});
        await page.waitForFunction(()=>document.querySelector('#system-core').dataset.coreState==='fallback');await page.evaluate(()=>__assetLost.restoreContext());await ready();await page.waitForFunction(()=>{const a=document.querySelector('#system-core').paCoreScene.getState().asset;return !a.loading&&!a.failed;},null,{timeout:120000});await seek(1);
        const restored=await read();assert.equal(restored.scene.asset.enabled,true);assert.equal(restored.scene.vertices,beforeRestore.scene.vertices);assert.deepEqual(restored.scene.assembly,beforeRestore.scene.assembly);report.contextRestore={passed:true,before:beforeRestore.scene.asset,after:restored.scene.asset};check('Opt-in: WebGL context loss restores GLB and retained final pose');
        await page.emulateMedia({reducedMotion:'reduce'});await settle();const reduced=await read();assert.ok(reduced.scene.progress>=.99999);assert.equal(reduced.scene.idle.disabled,true);await page.emulateMedia({reducedMotion:'no-preference'});check('Opt-in: reduced motion retains assembled Rack and disables idle motion');
      }
      await page.close();
    }
    for(const pair of report.pairs){
      assert.deepEqual(pair.after.scene.camera,pair.before.scene.camera,pair.id+': exact eye/target/yaw/elevation/distance/FOV/view');assert.deepEqual(pair.after.canvas,pair.before.canvas,pair.id+': identical backing pixels');
      assert.equal(pair.after.scene.quality.pixelCount,pair.before.scene.quality.pixelCount);assert.deepEqual(pair.after.observed.lighting,pair.before.observed.lighting,pair.id+': same actual lighting uniforms');
      assert.equal(pair.after.scene.theme,pair.before.scene.theme);assert.deepEqual(pair.after.scene.assembly,pair.before.scene.assembly,pair.id+': same object pose and progress');
      pair.matched={camera:true,pixels:true,lightingUniforms:true,assembly:true};
    }
    assert.equal(report.sources.after.environmentSHA256,report.sources.before.environmentSHA256);assert.deepEqual(report.sources.after.compiledShaderSHA256,report.sources.before.compiledShaderSHA256,'Both variants compile exactly the same shaders');check(stages.length+' comparisons: exact camera, object pose, native pixels, lighting, environment and shader sources');
    page=await createPage(true);await page.route('**/*.glb',route=>route.abort('failed'));await page.goto(url(true),{waitUntil:'domcontentloaded',timeout:120000});await ready();await page.waitForFunction(()=>document.querySelector('#system-core').paCoreScene.getState().asset.failed===true,null,{timeout:120000});await seek(.354);
    const fallback=await read();assert.equal(fallback.scene.ready,true);assert.equal(fallback.scene.asset.failed,true);assert.ok(fallback.observed.drawCalls>0);assert.equal(fallback.scene.assembly.targetU,40);report.loaderFallback={passed:true,asset:fallback.scene.asset,vertices:fallback.scene.vertices,observed:fallback.observed};check('Blocked GLB network request falls back to renderable legacy geometry');
    if(referenceReview){
      await page.close();page=await createPage(true);
      await page.route('**/compute-board.glb',route=>route.fulfill({body:inconsistentServiceFixture(),contentType:'model/gltf-binary'}));
      await page.goto(url(),{waitUntil:'domcontentloaded',timeout:120000});await ready();
      await page.waitForFunction(()=>document.querySelector('#system-core').paCoreScene.getState().asset.failed===true,null,{timeout:120000});await seek(.354);
      const invalid=await read();assert.equal(invalid.scene.vertices,fallback.scene.vertices);assert.ok(invalid.observed.drawCalls>0);
      report.serviceOwnershipFallback={passed:true,asset:invalid.scene.asset,vertices:invalid.scene.vertices};
      check('Mismatched IO ownership fails closed and retains every legacy fan, cable and board');
    }
    await page.close();page=await createPage(true);await page.route('**/studio-small-09-radiance.png',route=>route.abort('failed'));await page.goto(url(true),{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>{const c=document.querySelector('#system-core'),s=c?.paCoreScene?.getState();return c?.dataset.coreState==='ready'&&s.quality.environmentFailed&&s.asset.failed&&!s.asset.loading;},null,{timeout:120000});await seek(.354);
    const missingHDR=await read();assert.equal(missingHDR.scene.quality.environmentReady,false);assert.equal(missingHDR.scene.asset.failed,true);assert.ok(missingHDR.observed.drawCalls>0);assert.equal(missingHDR.scene.vertices,fallback.scene.vertices,'Missing studio reference restores the complete baseline geometry');report.environmentFallback={passed:true,asset:missingHDR.scene.asset,quality:missingHDR.scene.quality,vertices:missingHDR.scene.vertices};check('Blocked studio environment restores the baseline without falsely reporting a textured prototype');
    assert.deepEqual(report.errors,[],'No errors in normal before/after operation');assert.deepEqual(report.external,[],'All runtime resources are self-hosted');report.passed=true;
  }catch(error){report.failure=error.stack;try{report.lastState=await lastRead();}catch{}throw error;}
  finally{fs.writeFileSync(path.join(out,'prototype-comparison.json'),JSON.stringify(report,null,2));await browser.close();}
  console.log(JSON.stringify({passed:report.passed,pairs:report.pairs.length,fullFilms:report.runs.length,checks:report.checks.length,report:path.join(out,'prototype-comparison.json')},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
