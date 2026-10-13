/* Native Chromium / WebGL evidence. Historical resources are git-show bytes;
 * no checkout, image editing, camera injection, or replacement render is used.
 * PA_CAPTURE_PHASE=before|after|both; PA_COOLING_OUTPUT retains previous runs. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.PA_COOLING_OUTPUT||'docs/screenshots/l10-cinematic/cooling-v1');
const baseline=process.env.PA_COOLING_BASELINE||'fa55ce8b439a9825e5e9eac34871fd5330344799',phase=process.env.PA_CAPTURE_PHASE||'both',base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8775';
assert.match(baseline,/^[0-9a-f]{40}$/i);assert.ok(['before','after','both','video'].includes(phase));assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),historical=file=>cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024}),current=file=>fs.readFileSync(path.join(root,file));
const barePath='app/static/models/l10-prototype/bare-compute-boards.glb',coolingPath='app/static/models/l10-cooling-v1/cooling-assembly.glb',envPath='app/static/img/l10/studio-small-09-radiance.png';
const common=[...['l10-hardware','l10-gltf','l10-asset-runtime','rack-equipment-scene','core-scene'].map(n=>'app/static/js/'+n+'.js'),barePath,envPath];
const stages=[
 {id:'01-bare-hero',p:.20,view:'bare-hero',controlled:true},
 {id:'02-packages',p:.225,view:'bare-packages',controlled:true},
 {id:'03-plate-descent',p:.263,view:'cooling',controlled:true},
 {id:'04-plumbing',p:.284,view:'cooling',controlled:true},
 {id:'05-flow',p:.310,view:'cooling',controlled:true},
 {id:'06-fluid-timeB',p:.320,view:'cooling',controlled:true},
 {id:'07-solid',p:.350,view:'cooling',controlled:true},
 {id:'08-lid',p:.390,view:null,controlled:false},
 {id:'09-finished',p:.412,view:null,controlled:true},
 {id:'10-rack',p:.723,view:null,controlled:true},
 {id:'guard-network',p:.354,view:'bare-network',controlled:true},
 {id:'guard-gold-front',p:.354,view:'bare-front',controlled:true},
 {id:'context-install-camera',p:.263,view:null,controlled:false},
 {id:'context-flow-camera',p:.310,view:null,controlled:false}
];
const candidateViews=[{id:'context-cooling-hero',p:.350,view:'cooling-hero'},{id:'context-cooling-rear',p:.350,view:'cooling-rear'},{id:'context-cooling-section',p:.350,view:'cooling-section'}];
for(const dir of ['before','after','evidence'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const reportPath=path.join(out,'comparison.json');
const report=phase==='after'?JSON.parse(fs.readFileSync(reportPath,'utf8')):{baseline,pass:false,viewport:{width:3440,height:1440},pairs:[],source:{},resources:{},errors:[],external:[],checks:[],limitations:['Controlled comparisons use unchanged existing inspection cameras. Authored camera context shots intentionally differ within the new opt-in assembly prefix.','New cooling inspection presets are candidate-only context, not historical camera matches.','Header and footer are hidden identically during full-viewport evidence captures; WebGL pixels receive no postprocessing.','Cooling flow is an illustrative assembly visualization, not CFD.','This local Chromium evidence does not establish cross-device performance or a numeric photorealism score.']};
assert.equal(report.baseline,baseline);report.pass=false;delete report.failure;
// Keep the comparison index small while preserving complete per-frame draw
// evidence in immutable sidecars. Hydrate historical frames for a later pass.
if(phase==='after')for(const pair of report.pairs)for(const variant of ['before','after'])if(pair[variant])pair[variant]=JSON.parse(fs.readFileSync(path.join(out,variant,pair.id+'.json'),'utf8'));
const variants=phase==='video'?[]:phase==='both'?['before','after']:[phase],snapshots={};
for(const variant of variants){
 const shell=variant==='before'?'l10-bareboard-review':'l10-cooling-review';
 const files=[...common,'app/static/'+shell+'.html','app/static/js/'+shell+'.js',...(variant==='after'?[coolingPath]:[])];
 snapshots[variant]=Object.fromEntries(files.map(file=>[file,variant==='before'?historical(file):current(file)]));
 report.errors=report.errors.filter(e=>e.variant!==variant);report.external=report.external.filter(e=>e.variant!==variant);
}
const displayTransform=source=>source.match(/vec3 displayTransform\(vec3 linear\)\{[\s\S]*?\n\s*\}/)?.[0];
function animation(source){const box={window:{PAL10Hardware:{}},Float32Array,Math};vm.runInNewContext(source,box);return box.window.PACoreScene.assemblySnapshot;}
const oldScene=historical('app/static/js/core-scene.js').toString();
if(snapshots.after){const newScene=snapshots.after['app/static/js/core-scene.js'].toString(),oldMotion=animation(oldScene),newMotion=animation(newScene);for(let i=0;i<=1000;i++)assert.equal(JSON.stringify(oldMotion(i/1000)),JSON.stringify(newMotion(i/1000)),'Default animation pose '+i);assert.equal(displayTransform(newScene),displayTransform(oldScene),'Exposure and tone mapping');assert.equal(sha(historical(envPath)),sha(snapshots.after[envPath]),'Environment');}
function observe(){
 const proto=WebGLRenderingContext.prototype,uniforms={},locations=new WeakMap(),attributes={},registered={},shaders=[];let material=[0,0],depth=true,draws=[];
 for(const name of ['getUniformLocation','getAttribLocation','vertexAttrib2f','uniform1f','uniform1i','uniform3fv','uniformMatrix4fv','shaderSource','drawArrays','depthMask','clear']){
  const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);
   if(name==='getUniformLocation'){registered[args[1]]=!!result;if(result)locations.set(result,args[1]);}
   if(name==='getAttribLocation')attributes[args[1]]=result;
   if(name==='vertexAttrib2f'&&args[0]===attributes.aMaterial)material=args.slice(1);
   if(name.startsWith('uniform')){const key=locations.get(args[0]);if(key)uniforms[key]=(name==='uniform1f'||name==='uniform1i')?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);}
   if(name==='shaderSource')shaders.push(args[1]);
   if(name==='depthMask')depth=args[0];
   if(name==='clear'&&(args[0]&this.COLOR_BUFFER_BIT))draws=[];
   if(name==='drawArrays'&&uniforms.uShadowPass===0)draws.push({asset:uniforms.uAsset,opacity:uniforms.uOpacity,depth,vertices:args[2],part:uniforms.uPart?.slice(),metallic:material[0],emission:material[1],roughness:uniforms.uAssetRoughness,flow:uniforms.uCoolingFlow||0,travel:uniforms.uCoolingTravel||0,filmStrength:uniforms.uAssetFilmStrength||0,ao:uniforms.uAssetAO||0});
   return result;
  };
 }
 window.__coolingQA={uniforms,registered,shaders,draws:()=>draws};
}
function glbInfo(bytes){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 return {sha256:sha(bytes),bytes:bytes.length,extras:doc.extras,triangles:doc.meshes.reduce((n,m)=>n+m.primitives.reduce((a,p)=>a+doc.accessors[p.indices].count/3,0),0),primitives:doc.meshes.reduce((n,m)=>n+m.primitives.length,0),images:doc.images?.length||0,materials:doc.materials?.length||0,emissiveMaterials:(doc.materials||[]).filter(m=>(m.emissiveFactor||[]).some(v=>v>0)||m.emissiveTexture).map(m=>m.name)};
}
function compactReport(){
 const summary=frame=>frame?{file:frame.file,evidence:frame.file.replace(/\.png$/,'.json'),sha256:frame.sha256,progress:frame.scene.progress,camera:frame.scene.camera,cameraUniforms:frame.cameraUniforms,lighting:frame.lighting,canvas:frame.canvas,drawCalls:frame.scene.drawCalls,vertices:frame.scene.vertices,flow:frame.scene.l10.flow,coolingReady:frame.scene.cooling?.ready||false,webgl:frame.webgl}:undefined;
 return {...report,pairs:report.pairs.map(pair=>({id:pair.id,p:pair.p,view:pair.view,controlled:!!pair.controlled,before:summary(pair.before),after:summary(pair.after)}))};
}
function gallery(){return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>L10 cooling assembly evidence</title><style>body{margin:24px;background:#17191a;color:#eee;font:16px/1.5 system-ui}h1{font-size:24px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}section{margin:32px 0}figure{margin:0}img{width:100%;height:auto}a{color:#d8c6a4}p{max-width:1050px}@media(max-width:900px){.pair{grid-template-columns:1fr}}</style><h1>L10 cooling assembly · actual Chromium / WebGL</h1><p>Before: '+baseline+'. Original PNGs 3440 × 1440. Controlled pairs share the same inspection camera, light, exposure and environment. Authored camera context is marked separately because the new opt-in assembly prefix has a new camera path. No image postprocessing. Review chrome is hidden identically.</p>'+report.pairs.map(pair=>'<section><h2>'+pair.id+'</h2><p>'+(pair.controlled?'Controlled camera comparison':'Context only · not a controlled camera comparison')+' · progress '+pair.p+'</p><div class="pair">'+['before','after'].filter(v=>pair[v]).map(v=>'<figure><a href="'+v+'/'+pair.id+'.png"><img loading="lazy" src="'+v+'/'+pair.id+'.png" alt="'+v+' '+pair.id+'"></a><figcaption>'+v+' · <a href="'+v+'/'+pair.id+'.json">actual renderer state</a></figcaption></figure>').join('')+'</div></section>').join('')+'<p><a href="comparison.json">Resource hashes and actual draw evidence</a>. Visual acceptance is independent of automated pass status.</p></html>';}
async function recordFilm(){
 const viewport={width:3440,height:1440},errors=[],responses=[],pending=[],trace=[],metadataErrors=[],videoReport={pass:false,viewport,authoredDurationMs:35200,method:'Playwright native Chromium recordVideo of the shipping dashboard; full viewport includes dashboard chrome. No frame synthesis, time stretching, seeking during the film, resource substitution or renderer injection.',recordedAt:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),resources:responses,metadataErrors,errors,trace};
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block',recordVideo:{dir:path.join(root,'artifacts/l10-cooling-v1/video'),size:viewport}}),page=await context.newPage();
 let timer;
 try{
  page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',message:m.text()});});
  const inspector=await context.newCDPSession(page);await inspector.send('Network.enable',{maxTotalBufferSize:134217728,maxResourceBufferSize:50331648});
  page.on('response',response=>{if(response.status()>=400)errors.push({type:'http',status:response.status(),url:response.url()});if(/(bare-compute-boards\.glb|cooling-assembly\.glb|core-scene\.js|l10-gltf\.js|l10-asset-runtime\.js|validation-overview\.js|studio-small-09-radiance\.png)(\?|$)/.test(response.url()))pending.push(response.body().then(bytes=>responses.push({url:response.url(),bytes:bytes.length,sha256:sha(bytes)})).catch(error=>metadataErrors.push({url:response.url(),error:error.message})));});
  await page.goto(base+'/?l10Bareboard=1#/dashboard',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>{const s=document.querySelector('#system-core')?.paCoreScene?.getState();return s?.ready&&s.quality.environmentReady&&s.cooling.ready&&document.querySelector('#core-story')?.paHeroPlayback;},null,{timeout:120000});
  videoReport.initial=await page.evaluate(()=>({playback:document.querySelector('#core-story').paHeroPlayback.getState(),scene:document.querySelector('#system-core').paCoreScene.getState(),canvas:[document.querySelector('#system-core').width,document.querySelector('#system-core').height],cssCanvas:{width:document.querySelector('#system-core').clientWidth,height:document.querySelector('#system-core').clientHeight}}));
  assert.equal(videoReport.initial.playback.duration,35200);
  await page.locator('[data-vo-replay]').click();const started=Date.now();
  timer=setInterval(()=>pending.push(page.evaluate(()=>{const s=document.querySelector('#system-core').paCoreScene.getState(),p=document.querySelector('#core-story').paHeroPlayback.getState();return {progress:p.progress,mode:p.mode,phase:s.l10.phase,flow:s.l10.flow,travel:s.l10.flowTravel,coolingReady:s.cooling.ready,assetFailed:s.asset.failed,coolingFailed:s.cooling.failed,drawCalls:s.drawCalls,quality:s.quality,inspection:s.inspection};}).then(s=>trace.push({wallMs:Date.now()-started,...s}))),160);
  await page.waitForFunction(()=>{const p=document.querySelector('#core-story').paHeroPlayback.getState();return p.mode==='stopped'&&p.progress>=1;},null,{timeout:240000});
  clearInterval(timer);timer=null;videoReport.replayWallMs=Date.now()-started;await Promise.all(pending);
  videoReport.final=await page.evaluate(()=>({playback:document.querySelector('#core-story').paHeroPlayback.getState(),scene:document.querySelector('#system-core').paCoreScene.getState()}));
  assert.ok(videoReport.replayWallMs>=35000,'One real-clock film, without time acceleration');assert.ok(trace.length>100);assert.ok(trace.every(s=>s.coolingReady&&!s.coolingFailed&&!s.assetFailed&&s.inspection===null));assert.ok(trace.some(s=>s.flow>.9)&&trace.some(s=>s.progress>.4&&s.flow===0));assert.deepEqual(errors,[]);
  videoReport.wallToNominalRatio=videoReport.replayWallMs/35200;
  const actual=responses.find(r=>r.url.includes('/l10-cooling-v1/cooling-assembly.glb'));assert.ok(actual);assert.equal(actual.sha256,sha(current(coolingPath)));videoReport.coolingSHA256=actual.sha256;
  await context.close();await page.video().saveAs(path.join(out,'film.webm'));
  const bytes=current(path.relative(root,path.join(out,'film.webm')));videoReport.file='film.webm';videoReport.bytes=bytes.length;videoReport.sha256=sha(bytes);
  const verify=await browser.newPage({viewport:{width:640,height:360}});await verify.route('**/film.webm',route=>route.fulfill({body:bytes,contentType:'video/webm'}));await verify.setContent('<!doctype html><title>Recorded video metadata verification</title>');
  videoReport.encoded=await verify.evaluate(url=>new Promise((resolve,reject)=>{const v=document.createElement('video');v.onloadedmetadata=()=>resolve({width:v.videoWidth,height:v.videoHeight,durationSeconds:Number.isFinite(v.duration)?v.duration:null});v.onerror=()=>reject(Error('Recorded WebM metadata failed'));v.src=url;}),base+'/film.webm');
  assert.equal(videoReport.encoded.width,3440);assert.equal(videoReport.encoded.height,1440);await verify.close();
  const browserCache=process.env.PLAYWRIGHT_BROWSERS_PATH||path.join(root,'artifacts/l10-cooling-v1/playwright'),ffmpegDir=fs.readdirSync(browserCache).find(n=>n.startsWith('ffmpeg-'));
  const ffmpeg=path.join(browserCache,ffmpegDir,process.platform==='win32'?'ffmpeg-win64.exe':'ffmpeg-linux');
  const probe=cp.spawnSync(ffmpeg,['-i',path.join(out,'film.webm')],{encoding:'utf8'}).stderr||'',fps=probe.match(/(\d+(?:\.\d+)?) fps/),duration=probe.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  videoReport.container={fps:fps?Number(fps[1]):null,durationSeconds:duration?Number(duration[1])*3600+Number(duration[2])*60+Number(duration[3]):null,probe};
  assert.ok(videoReport.container.fps>0,'Measured encoded frame rate');
  videoReport.limitations=['Encoded FPS is the native recording rate, not a GPU-render benchmark.','The video includes load/setup before Replay and brief completion overhead; its container duration exceeds the measured Replay wall time.','Any measured Replay slowdown is retained in the file and reported without trimming or time scaling.'];videoReport.pass=true;
 }catch(error){videoReport.failure=error.stack||String(error);throw error;}
 finally{if(timer)clearInterval(timer);await context.close().catch(()=>{});await browser.close();fs.writeFileSync(path.join(out,'evidence/video.json'),JSON.stringify(videoReport,null,2));}
 console.log(JSON.stringify({video:videoReport.file,pass:videoReport.pass,wallMs:videoReport.replayWallMs,encoded:videoReport.encoded,bytes:videoReport.bytes},null,2));
}
(async()=>{
 if(phase==='video'){await recordFilm();return;}
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const variant of variants){
   const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),resources=snapshots[variant],counts={},hashes={},unexpected=[];
   await page.addInitScript(observe);report.resources[variant]={served:counts,sha256:hashes,unexpected};
   page.on('pageerror',e=>report.errors.push({variant,type:'pageerror',message:e.message}));
   page.on('console',m=>{if(m.type()==='error')report.errors.push({variant,type:'console',message:m.text()});});
   page.on('requestfailed',r=>report.errors.push({variant,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
   page.on('response',r=>{if(r.status()>=400)report.errors.push({variant,type:'http',status:r.status(),url:r.url()});});
   const byURL=Object.fromEntries(Object.entries(resources).map(([file,bytes])=>{hashes[file]=sha(bytes);counts[file]=0;return ['/'+file.slice(4),{file,bytes}];}));
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());if(url.origin!==new URL(base).origin){report.external.push({variant,url:url.href});return route.abort();}
    const entry=byURL[url.pathname];if(!entry){unexpected.push(url.href);return route.abort();}
    counts[entry.file]++;const contentType=entry.file.endsWith('.glb')?'model/gltf-binary':entry.file.endsWith('.png')?'image/png':entry.file.endsWith('.html')?'text/html':'application/javascript';return route.fulfill({body:entry.bytes,contentType,headers:{'Cache-Control':'no-store'}});
   });
   const shell=variant==='before'?'l10-bareboard-review':'l10-cooling-review';
   await page.goto(base+'/static/'+shell+'.html?l10AssetLab=1&l10Bareboard=1',{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>{const s=(window.PAL10CoolingReview||window.PAL10Review)?.scene.getState();return s?.ready&&s.quality.environmentReady&&!s.asset.loading&&!s.cooling?.loading;},null,{timeout:120000});
   const chromeStyle=await page.addStyleTag({content:'header,footer{display:none!important}'});
   const loaded=await page.evaluate(()=>(window.PAL10CoolingReview||window.PAL10Review).scene.getState());
   assert.equal(loaded.asset.enabled,true);assert.equal(loaded.asset.failed,false,loaded.asset.error);assert.ok(loaded.asset.metadata);if(variant==='after'){assert.equal(loaded.cooling.ready,true,loaded.cooling.error);assert.equal(loaded.cooling.failed,false);}
   report.source[variant]={bare:glbInfo(resources[barePath]),cooling:variant==='after'?glbInfo(resources[coolingPath]):null,compiledShaderSha256:(await page.evaluate(()=>__coolingQA.shaders)).map(s=>sha(Buffer.from(s))),displayTransformSha256:sha(Buffer.from(displayTransform(resources['app/static/js/core-scene.js'].toString()))),capturedAt:new Date().toISOString()};
   for(const stage of [...stages,...(variant==='after'?candidateViews:[])]){
    await page.evaluate(stage=>{const scene=(window.PAL10CoolingReview||window.PAL10Review).scene;scene.setProgress(stage.p);scene.resetOrbit();scene.setInspection(stage.view);},stage);
    await page.waitForFunction(stage=>{const c=document.querySelector('#system-core'),s=(window.PAL10CoolingReview||window.PAL10Review).scene.getState();return s.inspection===stage.view&&s.progress===stage.p&&s.quality.resolution===1&&!s.settling&&c.width===3440&&c.height===1440;},stage,{timeout:90000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const state=await page.evaluate(()=>{const c=document.querySelector('#system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info'),u=__coolingQA.uniforms;return {scene:(window.PAL10CoolingReview||window.PAL10Review).scene.getState(),canvas:[c.width,c.height],lighting:Object.fromEntries(['uKeyPosition','uLightViewProjection','uLightTheme','uHasEnvironment','uHasShadow','uShadowTexel','uReveal','uQuality','uSectionX','uScan','uScanY'].map(k=>[k,u[k]]).filter(([,v])=>v!==undefined)),cameraUniforms:{eye:u.uEye,viewProjection:u.uViewProjection,model:u.uModel},draws:__coolingQA.draws(),uniformLocations:__coolingQA.registered,webgl:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),error:gl.getError()};});
    assert.equal(state.error,0);assert.equal(state.scene.asset.failed,false);assert.deepEqual(state.canvas,[3440,1440]);assert.ok(state.draws.length>0);if(variant==='after')assert.equal(state.scene.cooling.ready,true);
    const filename=path.join(out,variant,stage.id+'.png');await page.screenshot({path:filename});const bytes=fs.readFileSync(filename);assert.equal(bytes.readUInt32BE(16),3440);assert.equal(bytes.readUInt32BE(20),1440);
    const evidence={...stage,...state,file:variant+'/'+stage.id+'.png',sha256:sha(bytes)};fs.writeFileSync(path.join(out,variant,stage.id+'.json'),JSON.stringify(evidence,null,2));
    let pair=report.pairs.find(p=>p.id===stage.id);if(!pair)report.pairs.push(pair={...stage});pair[variant]=evidence;
    console.log('CAPTURE '+variant+' '+stage.id+' draws='+state.scene.drawCalls);
   }
   if(variant==='after'){
    assert.deepEqual(report.source.after.cooling.emissiveMaterials,[],'Companion material emission zero');
    await chromeStyle.evaluate(node=>node.remove());
    await page.evaluate(()=>PAL10CoolingReview.choose('solid'));
    report.ui=[];
    for(const viewport of [{width:3440,height:1440},{width:1366,height:768},{width:390,height:844}]){
     await page.setViewportSize(viewport);await page.waitForFunction(()=>!(window.PAL10CoolingReview.scene.getState().settling));
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const ui=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,buttons:document.querySelectorAll('[data-stage]').length,active:document.querySelector('[aria-pressed=true]')?.dataset.stage,dashboardLink:document.querySelector('footer a').getAttribute('href'),note:document.querySelector('#note').textContent,status:document.querySelector('#status').textContent}));
     assert.equal(ui.overflow,false);assert.equal(ui.buttons,10);assert.equal(ui.active,'solid');assert.equal(ui.dashboardLink,'/?l10Bareboard=1#/dashboard');
     const file='evidence/review-ui-'+viewport.width+'x'+viewport.height+'.png';await page.screenshot({path:path.join(out,file)});report.ui.push({...viewport,...ui,file});
    }
   }
   for(const file of Object.keys(resources))assert.ok(counts[file]>0,'Actual browser resource '+file);assert.deepEqual(unexpected,[],'No unrecorded resources, especially no new companion in baseline');await context.close();
  }
  if(phase!=='before'){
   for(const pair of report.pairs.filter(p=>p.controlled)){
    assert.ok(pair.before&&pair.after,'Complete pair '+pair.id);assert.deepEqual(pair.before.scene.camera,pair.after.scene.camera,pair.id+' camera');assert.deepEqual(pair.before.cameraUniforms,pair.after.cameraUniforms,pair.id+' camera uniforms');assert.deepEqual(pair.before.lighting,pair.after.lighting,pair.id+' lighting');assert.equal(pair.before.scene.progress,pair.after.scene.progress,pair.id+' progress');
   }
   assert.equal(report.resources.before.sha256[envPath],report.resources.after.sha256[envPath]);assert.equal(report.source.before.displayTransformSha256,report.source.after.displayTransformSha256);
   const flowA=report.pairs.find(p=>p.id==='05-flow').after,flowB=report.pairs.find(p=>p.id==='06-fluid-timeB').after,solid=report.pairs.find(p=>p.id==='07-solid').after;
   assert.deepEqual(flowA.cameraUniforms,flowB.cameraUniforms,'Flow motion uses same camera');assert.deepEqual(flowA.lighting,flowB.lighting,'Flow motion uses same illumination');assert.notEqual(flowA.sha256,flowB.sha256,'Two actual flow frames differ');
   const movingA=flowA.draws.filter(d=>d.flow>0),movingB=flowB.draws.filter(d=>d.flow>0);assert.ok(movingA.length>0&&movingB.length>0,'Actual flow draw calls');assert.deepEqual(movingA.map(({travel,...draw})=>draw),movingB.map(({travel,...draw})=>draw),'Fluid geometry, material and opacity stay fixed while travel advances');assert.notDeepEqual(movingA.map(d=>d.travel),movingB.map(d=>d.travel),'Flow travel advances on actual draw');assert.ok(movingA.concat(movingB).every(d=>d.emission===0),'Actual fluid emission zero');assert.ok(solid.draws.every(d=>d.flow===0),'Solid assembly has no fluid overlay');
   report.flowMotion={sameCamera:true,sameLighting:true,differentRawPNG:true,travelA:movingA.map(d=>d.travel),travelB:movingB.map(d=>d.travel),emissionZero:true,solidFlowOff:true};
   report.checks=['1001 default assembly snapshots match historical baseline','11 controlled fixed-camera 3440×1440 comparisons; authored prefix context explicitly separated','Same camera uniforms, lighting, studio environment and display transform for controlled pairs','Historical runtime and full bare GLB bytes served without any new companion request','Candidate actual companion loaded; shader hashes and actual per-draw opacity/depth/flow recorded','No page, resource or WebGL errors'];report.pass=true;
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
 }catch(error){report.pass=false;report.failure=error.stack||error.message;throw error;}
 finally{fs.writeFileSync(reportPath,JSON.stringify(compactReport(),null,2));fs.writeFileSync(path.join(out,'compare.html'),gallery());await browser.close();}
 console.log(JSON.stringify({phase,pass:report.pass,captures:report.pairs.length,errors:report.errors,bare:report.source[phase]?.bare?.sha256,cooling:report.source.after?.cooling?.sha256},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
