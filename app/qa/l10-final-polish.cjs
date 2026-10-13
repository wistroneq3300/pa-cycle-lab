/* Final bare-board comparison: actual native Chromium / WebGL at 3440 x 1440.
 * Baseline geometry and GLB are read with git show, never checked out/reset.
 * Both variants use the CURRENT, identical camera/shader/light pipeline.
 * Run only after asset, renderer and review-camera changes are complete.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/l10-final-polish');
const baseline='1611dd2c31c48b880ca100141e0b723e126bef93';
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Synthetic local preview only');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const historical=new Map();
const history=file=>{if(!historical.has(file))historical.set(file,cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:64*1024*1024}));return historical.get(file);};
const current=file=>fs.readFileSync(path.join(root,file));
const glbPath='app/static/models/l10-prototype/bare-compute-boards.glb';
const geometryFiles=['app/static/js/l10-hardware.js','app/static/js/rack-equipment-scene.js',glbPath];
const commonFiles=['app/static/js/core-scene.js','app/static/js/l10-gltf.js','app/static/js/l10-asset-runtime.js','app/static/js/l10-bareboard-review.js'];
const stages=[['A-hero','bare-hero'],['B-packages','bare-packages'],['C-network','bare-network'],['D-front','bare-front']];
const report={baseline,pass:false,viewport:{width:3440,height:1440},checks:[],pairs:[],loading:{},benchmark:{},source:{},resources:{},errors:[],external:[],limitations:['Subjective photorealism acceptance requires inspecting the PNGs; this script does not assign a visual score.','GPU texture bytes are renderer allocation estimates, not a GPU memory query.','Timing is one local run, not a network or cross-device benchmark.']};
for(const dir of ['before','after','evidence'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const snapshot=source=>{const box={window:{PAL10Hardware:{}},Float32Array,Math};vm.runInNewContext(source,box);return box.window.PACoreScene.assemblySnapshot;};
const oldMotion=snapshot(history('app/static/js/core-scene.js').toString()),newMotion=snapshot(current('app/static/js/core-scene.js').toString());
for(let i=0;i<=1000;i++)assert.equal(JSON.stringify(oldMotion(i/1000)),JSON.stringify(newMotion(i/1000)),'Unchanged authored animation pose '+i);
report.checks.push('1001 animation poses exactly match baseline 1611dd2');
report.commonSourceHashes=Object.fromEntries(commonFiles.map(file=>[file,sha(current(file))]));
function observe(){
 const uniforms={},locations=new WeakMap(),shaders=[],proto=WebGLRenderingContext.prototype;
 for(const name of ['getUniformLocation','uniform1f','uniform3fv','uniformMatrix4fv','shaderSource']){
  const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);
   if(name==='getUniformLocation'&&result)locations.set(result,args[1]);
   if(name==='uniform1f'||name==='uniform3fv'||name==='uniformMatrix4fv'){
    const key=locations.get(args[0]);if(key)uniforms[key]=name==='uniform1f'?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);
   }
   if(name==='shaderSource')shaders.push(args[1]);return result;
  };
 }
 window.__finalPolishQA={uniforms,shaders};
}
function glbInfo(bytes){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 return {sha256:sha(bytes),bytes:bytes.length,extras:doc.extras,triangles:doc.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0),primitives:doc.meshes.reduce((n,m)=>n+m.primitives.length,0),images:doc.images?.length||0,materials:doc.materials?.length||0};
}
const pauseFrames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function settle(page,view){
 await page.waitForFunction(expected=>{const c=document.querySelector('#system-core'),s=window.PAL10Review?.scene.getState();return s?.inspection===expected&&s.quality.resolution===1&&!s.settling&&c.width===3440&&c.height===1440;},view,{timeout:90000});
 await pauseFrames(page);
}
function htmlGallery(){
 const labels={'A-hero':'L10 bare-board Hero','B-packages':'CPU / GPU close-up','C-network':'BF3 / CX7 close-up','D-front':'Champagne front / eight E1.S carriers'};
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>L10 final bare-board comparison</title><style>body{margin:24px;background:#17191a;color:#eee;font:16px/1.5 system-ui}h1{font-size:24px}section{margin:32px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%;height:auto}figure{margin:0}a{color:#d6c492}figcaption{padding:8px 0}p{max-width:1000px}@media(max-width:900px){.pair{grid-template-columns:1fr}}</style><h1>L10 bare-board: actual Chromium / WebGL comparison</h1><p>Each original PNG is 3440 × 1440. Both sides use identical current camera, lighting, exposure, progress and compiled shaders. Before geometry and GLB: 1611dd2. The current pipeline is deliberately shared; this isolates geometry and material changes and is not a historical renderer comparison. No AI-generated render, photo texture replacement or composited hardware is used.</p>'+stages.map(([id])=>'<section><h2>'+labels[id]+'</h2><div class="pair">'+['before','after'].map(variant=>'<figure><a href="'+variant+'/'+id+'.png"><img src="'+variant+'/'+id+'.png" alt="'+variant+' '+labels[id]+'"></a><figcaption>'+variant+' · <a href="'+variant+'/'+id+'.json">captured state</a></figcaption></figure>').join('')+'</div></section>').join('')+'<p><a href="comparison.json">Machine-readable evidence and performance</a>. Passing these checks does not establish a photorealism score.</p></html>';
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const variant of ['before','after']){
   const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
   await page.addInitScript(observe);
   page.on('pageerror',e=>report.errors.push({variant,type:'pageerror',message:e.message}));
   page.on('console',m=>{if(m.type()==='error')report.errors.push({variant,type:'console',message:m.text()});});
   page.on('response',r=>{if(r.status()>=400)report.errors.push({variant,type:'http',status:r.status(),url:r.url()});});
   page.on('requestfailed',r=>report.errors.push({variant,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
   page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.external.push({variant,url:r.url()});});
   const resourceCounts={},resourceHashes={};report.resources[variant]={served:resourceCounts,sha256:resourceHashes};
   for(const file of geometryFiles){
    const bytes=variant==='before'?history(file):current(file),urlPath='/'+file.slice('app/'.length);
    resourceHashes[file]=sha(bytes);resourceCounts[file]=0;
    await page.route(url=>url.pathname===urlPath,route=>{resourceCounts[file]++;return route.fulfill({body:bytes,contentType:file.endsWith('.glb')?'model/gltf-binary':'application/javascript',headers:{'Cache-Control':'no-store'}});});
   }
   // Freeze the current pipeline in both contexts and verify it did not change
   // during the run, rather than comparing screenshots from different builds.
   for(const file of commonFiles){
    const bytes=current(file);assert.equal(sha(bytes),report.commonSourceHashes[file],'Common source changed during capture: '+file);
    await page.route(url=>url.pathname==='/'+file.slice(4),route=>route.fulfill({body:bytes,contentType:'application/javascript',headers:{'Cache-Control':'no-store'}}));
   }
   const info=glbInfo(variant==='before'?history(glbPath):current(glbPath));
   const start=Date.now();await page.goto(base+'/static/l10-bareboard-review.html?l10AssetLab=1&l10Bareboard=1&view=bare-hero',{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>{const s=window.PAL10Review?.scene.getState();return s?.ready&&s.quality.environmentReady&&!s.asset.loading;},null,{timeout:120000});
   const asset=await page.evaluate(()=>PAL10Review.scene.getState().asset);
   assert.equal(asset.enabled,true);assert.equal(asset.failed,false,asset.error);assert.ok(asset.metadata,'Actual GLB metadata required');
   assert.equal(asset.metadata.extras.id,variant==='before'?'dual-bare-compute-boards-r1':'dual-bare-compute-boards-r2');
   assert.deepEqual(asset.metadata.extras.replacesComputeBoards,[0,1]);assert.equal(asset.metadata.extras.bareBoardOnly,true);
   if(variant==='after'){assert.equal(asset.metadata.extras.replacesNetworking,true);assert.ok(asset.metadata.layers.includes('network'));assert.equal(asset.metadata.layers.length,4);}
   else assert.equal(asset.metadata.layers.length,3);
   report.loading[variant]={navigationToReadyMs:Date.now()-start,method:'Fresh local browser context; shell + geometry + decode + GPU upload, one sample'};
   report.source[variant]={glb:info,asset,shaders:await page.evaluate(()=>__finalPolishQA.shaders)};
   for(const [id,view] of stages){
    await page.evaluate(view=>PAL10Review.choose(view),view);await settle(page,view);
    const state=await page.evaluate(()=>{
     const c=document.querySelector('#system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info'),s=PAL10Review.scene.getState(),u=__finalPolishQA.uniforms;
     return {scene:s,canvas:[c.width,c.height],lighting:Object.fromEntries(['uKeyPosition','uLightTheme','uHasEnvironment','uHasShadow','uShadowTexel','uReveal','uQuality','uSectionX'].map(k=>[k,u[k]])),cameraUniforms:{eye:u.uEye,viewProjection:u.uViewProjection,model:u.uModel},webgl:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),error:gl.getError(),actualAsset:document.querySelector('#status')?.textContent,actualFallback:c.dataset.reviewFallback};
    });
    assert.equal(state.error,0);assert.equal(state.scene.asset.failed,false);assert.equal(state.actualFallback,'false');assert.equal(state.scene.inspection,view);
    assert.equal(state.scene.progress,.354);assert.deepEqual(state.canvas,[3440,1440]);
    const filename=path.join(out,variant,id+'.png');await page.screenshot({path:filename});
    const png=fs.readFileSync(filename);assert.equal(png.readUInt32BE(16),3440);assert.equal(png.readUInt32BE(20),1440);
    const evidence={...state,id,view,file:variant+'/'+id+'.png',sha256:sha(png)};
    fs.writeFileSync(path.join(out,variant,id+'.json'),JSON.stringify(evidence,null,2));
    let pair=report.pairs.find(p=>p.id===id);if(!pair)report.pairs.push(pair={id,view});pair[variant]=evidence;
    console.log('CAPTURE '+variant+' '+id+' '+state.scene.asset.metadata.extras.id);
   }
   await page.evaluate(()=>PAL10Review.choose('bare-hero'));await settle(page,'bare-hero');
   report.benchmark[variant]=await page.evaluate(async()=>{
    const times=[],start=performance.now();let last=start;
    for(let i=0;i<120;i++){PAL10Review.scene.resize();await new Promise(resolve=>requestAnimationFrame(resolve));const now=performance.now();times.push(now-last);last=now;}
    times.sort((a,b)=>a-b);const s=PAL10Review.scene.getState();return {durationMs:last-start,frames:120,fps:120000/(last-start),frameMsMedian:times[60],frameMsP95:times[114],quality:s.quality,drawCalls:s.drawCalls,asset:s.asset.metadata,method:'120 forced real requestAnimationFrame redraws; native browser, production adaptive resolution. VSync cadence, not a GPU timer.'};
   });
   for(const file of geometryFiles)assert.ok(resourceCounts[file]>0,'Browser must load recorded resource '+file);
   await context.close();
  }
  for(const pair of report.pairs){
   assert.deepEqual(pair.before.scene.camera,pair.after.scene.camera,pair.id+' camera');
   assert.deepEqual(pair.before.cameraUniforms,pair.after.cameraUniforms,pair.id+' actual camera uniforms');
   assert.deepEqual(pair.before.lighting,pair.after.lighting,pair.id+' light / shadow / section');
   assert.deepEqual(pair.before.canvas,pair.after.canvas,pair.id+' resolution');
   assert.equal(pair.before.scene.progress,pair.after.scene.progress,pair.id+' progress');
  }
  assert.deepEqual(report.source.before.shaders,report.source.after.shaders,'Same compiled shader sources / tone mapping');
  for(const variant of ['before','after'])report.source[variant].shaders=report.source[variant].shaders.map(s=>sha(Buffer.from(s)));
  for(const file of commonFiles)assert.equal(sha(current(file)),report.commonSourceHashes[file],'Common source changed during comparison '+file);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
  report.checks.push('Four actual 3440×1440 Chromium/WebGL Before / After pairs','Same camera uniforms, light, shadow settings, exposure, progress and compiled shaders','Verified baseline and candidate resource hashes were actually served','Actual r1 / r2 GLB identity, exact ownership and fallback OFF','No resource/shader/page errors or external requests');
  report.pass=true;
 }catch(error){report.failure=error.stack||error.message;throw error;}
 finally{fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'compare.html'),htmlGallery());await browser.close();}
 console.log(JSON.stringify({pass:report.pass,pairs:report.pairs.length,errors:report.errors,checks:report.checks,glb:{before:report.source.before?.glb,after:report.source.after?.glb}},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
