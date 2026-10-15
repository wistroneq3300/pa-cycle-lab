/* Phase 3 acceptance evidence: the shipping film, real RAF time, native Chrome.
 * This is synthetic-preview QA. It never changes production state or advances
 * the film clock artificially. Run NODE_PATH=... PA_PREVIEW_URL=... node ...
 * CDP bridge frames are compositor captures (not a promise of 30/60 fps).
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
const out=path.resolve(__dirname,'../../artifacts/l10-phase3/motion');
const requestedRuns=Number(process.env.PA_L10_ACCEPT_RUNS||3);
assert.ok(Number.isInteger(requestedRuns)&&requestedRuns>=1&&requestedRuns<=3,'Use 1–3 real film runs; final acceptance requires 3');
fs.mkdirSync(path.join(out,'bridge-frames'),{recursive:true});
const report={passed:false,requestedRuns,viewport:{width:3440,height:1440,deviceScaleFactor:1},runs:[],checks:[],errors:[],external:[],limitations:[
  'Native headless Chromium on this host; these results are not a physical-GPU performance certification.',
  'Bridge images are consecutive frames delivered by the browser compositor screencast; compositor delivery may omit rendered frames. The independent numeric trace samples every observed distinct WebGL color frame.',
  'Numeric continuity and GL errors do not certify visual absence of all clipping, shadow acne or flicker; bridge images require visual review.',
  'Film completion requires playback progress 1; the rendered final pose accepts the existing renderer progress epsilon of 0.00001.',
  'Run 1 includes screencast overhead. Runs 2 and 3 render without screencast.'
]};
report.testedSourceHashes=Object.fromEntries(['app/static/js/l10-hardware.js','app/static/js/core-scene.js','app/static/js/rack-equipment-scene.js','app/static/js/validation-overview.js','app/static/css/validation-overview.css'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',file))).digest('hex')]));
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const percentile=(values,p)=>{if(!values.length)return null;const a=values.slice().sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))];};
const summarize=values=>({min:Math.min(...values),median:percentile(values,.5),p95:percentile(values,.95),max:Math.max(...values)});

// Observe actual draw commands; no WebGL commands or product APIs are replaced.
function observeRendering(){
  const p=WebGLRenderingContext.prototype,original={},states=new WeakMap();
  const state=gl=>{let s=states.get(gl);if(!s){s={id:0,buffer:null,buffers:new WeakMap(),locations:new WeakMap(),uniforms:{},draws:[]};states.set(gl,s);}return s;};
  const hash=data=>{let h=2166136261;const words=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);for(let i=0;i<words.length;i+=Math.max(1,Math.floor(words.length/101)))h=Math.imul(h^words[i],16777619);return `${data.length}:${h>>>0}`;};
  for(const name of ['bindBuffer','bufferData','getUniformLocation','uniformMatrix4fv','uniform1f','clear','drawArrays'])original[name]=p[name];
  p.bindBuffer=function(target,buffer){state(this).buffer=buffer;return original.bindBuffer.apply(this,arguments);};
  p.bufferData=function(target,data){const s=state(this);if(s.buffer&&ArrayBuffer.isView(data))s.buffers.set(s.buffer,hash(data));return original.bufferData.apply(this,arguments);};
  p.getUniformLocation=function(program,name){const location=original.getUniformLocation.apply(this,arguments);if(location)state(this).locations.set(location,name);return location;};
  p.uniformMatrix4fv=function(location,transpose,value){const s=state(this);s.uniforms[s.locations.get(location)]=Array.from(value);return original.uniformMatrix4fv.apply(this,arguments);};
  p.uniform1f=function(location,value){const s=state(this);s.uniforms[s.locations.get(location)]=value;return original.uniform1f.apply(this,arguments);};
  p.clear=function(){const s=state(this);s.draws=[];s.id++;return original.clear.apply(this,arguments);};
  p.drawArrays=function(mode,first,count){const s=state(this);if(!s.uniforms.uShadowPass)s.draws.push({hash:s.buffers.get(s.buffer),part:s.uniforms.uPart?.slice(),model:s.uniforms.uModel?.slice(),opacity:s.uniforms.uOpacity,count});return original.drawArrays.apply(this,arguments);};
  window.__l10Acceptance={hash,read:gl=>state(gl),trace:[],running:false,bridgeSent:false,endSent:false,lastFrame:-1};
  window.__l10Acceptance.start=()=>{
    const q=window.__l10Acceptance,canvas=document.querySelector('#system-core'),scene=canvas.paCoreScene,gl=canvas.getContext('webgl');
    q.canvas=canvas;q.scene=scene;q.gl=gl;q.trace=[];q.running=true;q.bridgeSent=false;q.endSent=false;q.lastFrame=-1;q.started=performance.now();
    q.meshes=Object.fromEntries(Object.entries(PAL10Hardware.build().meshes).map(([name,mesh])=>[q.hash(mesh.data),name]));
    function sample(now){
      if(!q.running)return;
      const g=q.read(gl),playback=document.querySelector('#core-story').paHeroPlayback.getState();
      if(g.id!==q.lastFrame&&g.draws.length){
        q.lastFrame=g.id;const s=scene.getState();
        const layers={};for(const d of g.draws){const name=q.meshes[d.hash];if(name)layers[name]={part:d.part,model:d.model,opacity:d.opacity,count:d.count};}
        const row={ms:now-q.started,wallMs:Date.now(),frame:g.id,progress:s.progress,playback:playback.mode,camera:s.camera,pose:s.assembly.primaryPose,alignment:s.assembly.alignment,insertion:s.assembly.insertion,rackProgress:s.rackProgress,l10:s.l10,layers,quality:s.quality,sameContext:canvas===document.querySelector('#system-core')&&scene===canvas.paCoreScene&&gl===canvas.getContext('webgl'),glError:gl.getError()};
        q.trace.push(row);
        if(!q.bridgeSent&&s.progress>=.385){q.bridgeSent=true;window.__l10BridgeCapture?.('start');}
        if(!q.endSent&&s.progress>=.59){q.endSent=true;window.__l10BridgeCapture?.('end');}
      }
      if(playback.mode==='stopped'&&playback.progress===1&&q.trace.at(-1)?.progress>=.99999){q.running=false;q.finished=performance.now();}
    }
    // Capture after the actual scene draw, not an independent RAF that might
    // observe a next-frame logical progress with a previous-frame camera.
    q.record=sample;
  };
  window.addEventListener('pa-core-projection',()=>window.__l10Acceptance.record?.(performance.now()));
}

function analyzeRun(trace){
  assert.ok(trace.length>150,'A full playback must produce enough observed frames');
  assert.ok(trace[0].progress<.02,'Playback starts at exploded view');
  assert.ok(trace.at(-1).progress>=.99999,'Playback reaches the final frame within the renderer 0.00001 progress epsilon');
  const gaps=[],bridge=[],slips=[],resolutionChanges=[],resolutions=new Set();let priorInsertion=0;
  for(let i=0;i<trace.length;i++){
    const s=trace[i];assert.equal(s.sameContext,true,'One canvas/context/scene for the full film');assert.equal(s.glError,0);assert.equal(s.pose.scale,1,'No tray scale animation');
    assert.ok(s.layers['l10-chassis'],'Same L10 chassis is drawn');
    assert.equal(s.quality.contactShadows,true);assert.equal(s.quality.shadowMapSize,2048);
    resolutions.add(s.quality.resolution);
    if(s.progress<.80){assert.ok(s.insertion+1e-7>=priorInsertion,'No repeated primary insertion before original exploded-rack sequence');priorInsertion=s.insertion;}
    if(i){const prev=trace[i-1],dt=(s.ms-prev.ms)/1000;assert.ok(s.progress+1e-7>=prev.progress,'Uninterrupted film progress is monotonic');assert.ok(dt>0);gaps.push(dt*1000);
      if(s.quality.resolution!==prev.quality.resolution)resolutionChanges.push({progress:s.progress,ms:s.ms,from:prev.quality.resolution,to:s.quality.resolution,pixelCount:s.quality.pixelCount});
      for(const property of ['boardLift','packageLift','ioLift','coolingLift'])assert.ok(s.l10[property]<=prev.l10[property]+1e-7,'No L10 layer reassembly: '+property);
      if(s.progress>=.385&&prev.progress<=.59){
        const row={progress:s.progress,ms:s.ms,dt,eyeDistance:distance(s.camera.eye,prev.camera.eye),targetDistance:distance(s.camera.target,prev.camera.target),poseDistance:distance([s.pose.x,s.pose.y,s.pose.z],[prev.pose.x,prev.pose.y,prev.pose.z]),yawDelta:Math.abs(s.camera.yaw-prev.camera.yaw),elevationDelta:Math.abs(s.camera.elevation-prev.camera.elevation),distanceDelta:Math.abs(s.camera.distance-prev.camera.distance)};
        row.eyeVelocity=s.camera.eye.map((n,k)=>(n-prev.camera.eye[k])/dt);
        row.targetVelocity=s.camera.target.map((n,k)=>(n-prev.camera.target[k])/dt);
        row.poseVelocity=[s.pose.x,s.pose.y,s.pose.z].map((n,k)=>(n-[prev.pose.x,prev.pose.y,prev.pose.z][k])/dt);
        row.yawVelocity=(s.camera.yaw-prev.camera.yaw)/dt;row.elevationVelocity=(s.camera.elevation-prev.camera.elevation)/dt;row.distanceVelocity=(s.camera.distance-prev.camera.distance)/dt;
        row.eyeSpeed=row.eyeDistance/dt;row.poseSpeed=row.poseDistance/dt;row.yawSpeed=row.yawDelta/dt;
        if(bridge.length){const last=bridge.at(-1);row.eyeAcceleration=distance(row.eyeVelocity,last.eyeVelocity)/dt;row.poseAcceleration=distance(row.poseVelocity,last.poseVelocity)/dt;}
        bridge.push(row);
        if(row.eyeDistance>1.5||row.poseDistance>.8||row.yawDelta>.15||row.elevationDelta>.15)slips.push(row);
        assert.equal(s.layers['l10-cooling'].opacity,1,'No metal/ghost-state change during bridge');assert.equal(s.layers['l10-cooling-frame'].opacity,1);
        assert.ok(!s.layers['l10-flow-supply']&&!s.layers['l10-flow-return'],'Conceptual flow has ended before bridge');
        assert.deepEqual(s.layers['l10-chassis'].model,prev.layers['l10-chassis'].model,'Common transform remains unchanged');
      }
    }
  }
  assert.ok(bridge.length>20,'Bridge receives actual rendered-frame observations');
  assert.deepEqual(slips,[],'No single observed camera/tray displacement exceeds the documented conservative jump guard');
  const boundary=p=>{const index=trace.findIndex(s=>s.progress>=p);return {before:trace[Math.max(0,index-1)],after:trace[index]};};
  return {frames:trace.length,wallDurationMs:trace.at(-1).ms,filmDurationMs:35200,drawIntervalsMs:summarize(gaps),observedMeanFPS:(trace.length-1)/(trace.at(-1).ms-trace[0].ms)*1000,resolutions:Array.from(resolutions),resolutionChanges,bridge:{observations:bridge.length,eyeStep:summarize(bridge.map(s=>s.eyeDistance)),targetStep:summarize(bridge.map(s=>s.targetDistance)),trayStep:summarize(bridge.map(s=>s.poseDistance)),eyeSpeed:summarize(bridge.map(s=>s.eyeSpeed)),traySpeed:summarize(bridge.map(s=>s.poseSpeed)),eyeAcceleration:summarize(bridge.filter(s=>s.eyeAcceleration!=null).map(s=>s.eyeAcceleration)),trayAcceleration:summarize(bridge.filter(s=>s.poseAcceleration!=null).map(s=>s.poseAcceleration)),yawStep:summarize(bridge.map(s=>s.yawDelta)),elevationStep:summarize(bridge.map(s=>s.elevationDelta)),distanceStep:summarize(bridge.map(s=>s.distanceDelta)),velocitySamples:bridge,jumpGuard:{eyeStep:1.5,trayStep:.8,angleStep:.15,unit:'Authored scene units / radians per observed frame; a guard, not a visual-quality score'},jumpGuardFailures:slips,boundaries:{start:boundary(.407),handoff:boundary(.56)}}};
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1});
  await page.addInitScript(observeRendering);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.external.push(r.url());});
  const session=await page.context().newCDPSession(page),bridgeFrames=[],writes=[];let activeRun=0,capturing=false,capturePending=Promise.resolve();
  session.on('Page.screencastFrame',event=>{
    session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
    const file=`bridge-${String(bridgeFrames.length+1).padStart(4,'0')}.jpg`;
    bridgeFrames.push({file,...event.metadata,receivedWallMs:Date.now()});
    writes.push(fs.promises.writeFile(path.join(out,'bridge-frames',file),Buffer.from(event.data,'base64')));
  });
  await page.exposeBinding('__l10BridgeCapture',async(source,action)=>{
    if(activeRun!==1||process.env.PA_L10_ACCEPT_CAPTURE==='0')return;
    capturePending=capturePending.then(async()=>{
      if(action==='start'&&!capturing){capturing=true;await session.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:3440,maxHeight:1440,everyNthFrame:1});console.log('BRIDGE CAPTURE started');}
      if(action==='end'&&capturing){await session.send('Page.stopScreencast');capturing=false;console.log('BRIDGE CAPTURE stopped: '+bridgeFrames.length+' compositor frames');}
    });await capturePending;
  });
  const state=()=>page.evaluate(()=>({scene:document.querySelector('#system-core').paCoreScene.getState(),playback:document.querySelector('#core-story').paHeroPlayback.getState()}));
  const ready=()=>page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback,null,{timeout:90000});
  const settle=()=>page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling,null,{timeout:90000});
  const seek=async p=>{await page.evaluate(p=>{document.querySelector('#core-story').paHeroPlayback.seek(p);document.querySelector('#system-core').paCoreScene.resetOrbit();},p);await page.waitForFunction(p=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.00003,p);await settle();};
  try{
    await page.goto(base+'/#/dashboard',{waitUntil:'domcontentloaded',timeout:90000});await ready();
    await page.waitForFunction(()=>document.querySelector('#system-core').paCoreScene.getState().quality.environmentReady===true,null,{timeout:90000});
    assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),true,'Acceptance uses synthetic fixture preview only');
    await page.evaluate(()=>applyTheme('dark'));await seek(0);
    report.webgl=await page.evaluate(()=>{const gl=document.querySelector('#system-core').getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),vendor:gl.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:gl.VENDOR)};});
    for(activeRun=1;activeRun<=requestedRuns;activeRun++){
      console.log(`PLAY ${activeRun}/${requestedRuns}: starting real film clock`);
      // Runs 2/3 replay directly from the completed previous film. Do not seek
      // the camera back first and accidentally hide a real Replay defect.
      await page.locator('[data-vo-replay]').click();await page.evaluate(()=>window.__l10Acceptance.start());
      await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().mode==='stopped'&&document.querySelector('#core-story').paHeroPlayback.getState().progress===1&&window.__l10Acceptance.trace.at(-1)?.progress>=.99999,null,{timeout:240000});
      await page.evaluate(()=>{window.__l10Acceptance.running=false;});
      const trace=await page.evaluate(()=>window.__l10Acceptance.trace);
      fs.writeFileSync(path.join(out,`play-${activeRun}-trace.json`),JSON.stringify(trace));
      const analysis=analyzeRun(trace);report.runs.push({run:activeRun,...analysis});
      console.log(`PLAY ${activeRun}: ${analysis.frames} frames, ${(analysis.wallDurationMs/1000).toFixed(2)} s wall clock, observed ${analysis.observedMeanFPS.toFixed(1)} fps; no camera/tray jump guard failures`);
      await settle();
    }
    await capturePending;if(capturing){await session.send('Page.stopScreencast');capturing=false;}await Promise.all(writes);
    report.bridgeCapture={count:bridgeFrames.length,format:'JPEG88',requestedViewport:[3440,1440],everyNthFrame:1,frames:bridgeFrames};
    if(process.env.PA_L10_ACCEPT_CAPTURE!=='0')assert.ok(bridgeFrames.length>10,'Actual transition compositor frames must exist');
    report.checks.push(`${requestedRuns} complete real-clock plays, same canvas/context and L10 identity; monotonic assembly and no repeated insertion`);
    report.checks.push('Camera/target/angles/distance, tray pose/constant scale and metal/flow state recorded for every observed WebGL frame across the bridge');

    const skip=page.locator('[data-vo-skip]');
    report.skip={available:await skip.count()>0};
    assert.equal(report.skip.available,false,'HERO-01 removes the Skip Intro control');
    await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress>.005);
    await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.seek(1));await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress===1&&document.querySelector('#core-story').paHeroPlayback.getState().mode==='stopped');await settle();
    const completed=await state();assert.equal(completed.scene.l10.cooling,1);assert.equal(completed.scene.l10.lid,1);assert.equal(completed.scene.assembly.primaryPose.scale,1);assert.equal(completed.scene.l10.flow,0);
    report.skip={available:false,passed:true,progress:completed.scene.progress,mode:completed.playback.mode};report.checks.push('Skip Intro UI is absent; deterministic QA seek still lands at the final rack state');
    await page.locator('[data-vo-replay]').click();await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().mode==='film');
    await page.locator('#system-core').press('ArrowRight');await settle();assert.equal((await state()).playback.mode,'stopped');
    await seek(1);await page.locator('#system-core').press('ArrowRight');await settle();assert.notEqual((await state()).scene.yaw,0);
    await page.locator('#system-core').press('Home');await settle();assert.equal((await state()).scene.yaw,0);
    const box=await page.locator('#system-core').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5,{steps:8});await page.mouse.up();await settle();assert.ok(Math.abs((await state()).scene.yaw)>.05);
    await page.locator('[data-core-view="rear"]').click();await settle();assert.equal((await state()).scene.camera.view,'rear');
    await page.locator('[data-core-view="reset"]').click();await settle();assert.equal((await state()).scene.camera.view,'authored');
    await seek(.56);await page.evaluate(()=>scrollBy(0,80));await page.waitForFunction(()=>document.querySelector('#core-story').paHeroPlayback.getState().progress>.57);const forward=(await state()).scene.progress;
    await page.evaluate(()=>scrollBy(0,-80));await page.waitForFunction(p=>document.querySelector('#core-story').paHeroPlayback.getState().progress<p-.01,forward);
    report.checks.push('Replay button starts; keyboard cancels replay; keyboard/pointer orbit, rear/reset, forward/reverse scroll remain functional');
    await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await ready();assert.equal((await state()).scene.progress,1);assert.equal(await page.locator('[data-vo-replay]').isDisabled(),true);
    report.checks.push('Reduced motion starts at completed rack and disables replay');
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.passed=true;
  }catch(error){report.failure=error.stack;try{report.lastState=await state();const failedTrace=await page.evaluate(()=>window.__l10Acceptance.trace);fs.writeFileSync(path.join(out,'failure-trace.json'),JSON.stringify(failedTrace));}catch{}throw error;}
  finally{
    if(capturing)await session.send('Page.stopScreencast').catch(()=>{});await Promise.allSettled(writes);
    if(!report.bridgeCapture)report.bridgeCapture={count:bridgeFrames.length,frames:bridgeFrames};
    fs.writeFileSync(path.join(out,'acceptance-motion.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
  console.log(JSON.stringify({passed:report.passed,runs:report.runs.length,checks:report.checks.length,bridgeFrames:bridgeFrames.length,report:path.join(out,'acceptance-motion.json')},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
