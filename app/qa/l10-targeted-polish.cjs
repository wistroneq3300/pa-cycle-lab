/* Historical baseline versus targeted material polish, using the existing native
 * Chromium / WebGL review harness. No checkout, reset, render substitution or
 * image postprocessing. PA_CAPTURE_PHASE=before|after supports two-pass review.
 * Baseline and candidate shaders may differ: this is a full renderer comparison,
 * while camera, lighting uniforms, environment and display transform stay fixed.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..');
const out=path.resolve(root,process.env.PA_POLISH_OUTPUT||'docs/screenshots/l10-cinematic/targeted-polish');
const baseline='08dbc28af276c6b62e30f9502d6befe4aa4ce145';
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
const phase=process.env.PA_CAPTURE_PHASE||'both';
assert.ok(['before','after','both'].includes(phase));
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Synthetic local preview only');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const history=file=>cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024});
const current=file=>fs.readFileSync(path.join(root,file));
const glbPath='app/static/models/l10-prototype/bare-compute-boards.glb';
const environmentPath='app/static/img/l10/studio-small-09-radiance.png';
const files=['app/static/l10-bareboard-review.html',...['l10-hardware','l10-gltf','l10-asset-runtime','rack-equipment-scene','core-scene','l10-bareboard-review'].map(name=>'app/static/js/'+name+'.js'),glbPath,environmentPath];
const stages=[['A-hero','bare-hero'],['B-packages','bare-packages'],['C-network','bare-network'],['D-front','bare-front']];
for(const dir of ['before','after','evidence'])fs.mkdirSync(path.join(out,dir),{recursive:true});
const reportPath=path.join(out,'comparison.json');
const report=phase==='after'?JSON.parse(fs.readFileSync(reportPath,'utf8')):{baseline,pass:false,viewport:{width:3440,height:1440},checks:[],pairs:[],source:{},resources:{},errors:[],external:[],limitations:['Visual scores require human inspection of the full-resolution PNGs; this harness does not assign photorealism scores.','The candidate may change material shaders; the report records both shader hashes and verifies unchanged environment, display transform, camera and light uniforms.','This is a local native Chromium capture, not a cross-device performance benchmark.']};
assert.equal(report.baseline,baseline);report.pass=false;delete report.failure;
if(phase==='after'){report.errors=report.errors.filter(e=>e.variant!=='after');report.external=report.external.filter(e=>e.variant!=='after');}
const variants=phase==='both'?['before','after']:[phase];
const snapshots={};
for(const variant of variants)snapshots[variant]=Object.fromEntries(files.map(file=>[file,variant==='before'?history(file):current(file)]));
const animation=source=>{const box={window:{PAL10Hardware:{}},Float32Array,Math};vm.runInNewContext(source,box);return box.window.PACoreScene.assemblySnapshot;};
const baselineScene=history('app/static/js/core-scene.js').toString();
const candidateScene=(snapshots.after?.['app/static/js/core-scene.js']||current('app/static/js/core-scene.js')).toString();
const oldMotion=animation(baselineScene),newMotion=animation(candidateScene);
for(let i=0;i<=1000;i++)assert.equal(JSON.stringify(oldMotion(i/1000)),JSON.stringify(newMotion(i/1000)),'Unchanged authored animation pose '+i);
const displayTransform=source=>source.match(/vec3 displayTransform\(vec3 linear\)\{[\s\S]*?\n\s*\}/)?.[0];
assert.ok(displayTransform(baselineScene),'Baseline display transform located');
assert.equal(displayTransform(candidateScene),displayTransform(baselineScene),'Exposure / tone mapping unchanged');
assert.equal(sha(history(environmentPath)),sha(snapshots.after?.[environmentPath]||current(environmentPath)),'Studio environment unchanged');
function observe(){
 const uniforms={},locations=new WeakMap(),registered={},attributes={},shaders=[],drawMaterials={},proto=WebGLRenderingContext.prototype;
 let material=[0,0];
 for(const name of ['getUniformLocation','getAttribLocation','vertexAttrib2f','uniform1f','uniform1i','uniform3fv','uniformMatrix4fv','shaderSource','drawArrays']){
  const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);
   if(name==='getUniformLocation'){registered[args[1]]=!!result;if(result)locations.set(result,args[1]);}
   if(name==='getAttribLocation')attributes[args[1]]=result;
   if(name==='vertexAttrib2f'&&args[0]===attributes.aMaterial)material=args.slice(1);
   if(name.startsWith('uniform')){const key=locations.get(args[0]);if(key)uniforms[key]=(name==='uniform1f'||name==='uniform1i')?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);}
   if(name==='drawArrays'&&uniforms.uAsset===1&&uniforms.uShadowPass===0){
    const sample={metallic:material[0],emission:material[1],roughness:uniforms.uAssetRoughness,normalScale:uniforms.uAssetNormalScale,aoStrength:uniforms.uAssetAO,filmStrength:uniforms.uAssetFilmStrength||0,filmThickness:uniforms.uAssetFilmThickness||0};
    const key=JSON.stringify(sample);if(!drawMaterials[key])drawMaterials[key]={...sample,calls:0};drawMaterials[key].calls++;
   }
   if(name==='shaderSource')shaders.push(args[1]);return result;
  };
 }
 window.__targetedQA={uniforms,shaders,registered,drawMaterials,resetDraws:()=>{for(const key of Object.keys(drawMaterials))delete drawMaterials[key];}};
}
function glbInfo(bytes){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 return {sha256:sha(bytes),bytes:bytes.length,extras:doc.extras,triangles:doc.meshes.reduce((total,m)=>total+m.primitives.reduce((n,p)=>n+doc.accessors[p.indices].count/3,0),0),primitives:doc.meshes.reduce((n,m)=>n+m.primitives.length,0),images:doc.images?.length||0,materials:doc.materials?.length||0,siliconFinishes:(doc.materials||[]).filter(m=>m.extras?.l10ThinFilmStrength>0).map(m=>({name:m.name,filmStrength:m.extras.l10ThinFilmStrength,filmThickness:m.extras.l10ThinFilmThickness})),occlusionMaterials:(doc.materials||[]).filter(m=>m.occlusionTexture).map(m=>({name:m.name,texture:m.occlusionTexture.index,image:doc.images[doc.textures[m.occlusionTexture.index].source].name}))};
}
async function settle(page,view){
 await page.waitForFunction(expected=>{const c=document.querySelector('#system-core'),s=window.PAL10Review?.scene.getState();return s?.inspection===expected&&s.quality.resolution===1&&!s.settling&&c.width===3440&&c.height===1440;},view,{timeout:90000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
function htmlGallery(){
 const labels={'A-hero':'A · Bare-board Hero','B-packages':'B · CPU / GPU close-up','C-network':'C · BF3 / CX7 close-up','D-front':'D · Gold front'};
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>L10 targeted photorealism comparison</title><style>body{margin:24px;background:#17191a;color:#eee;font:16px/1.5 system-ui}h1{font-size:24px}section{margin:32px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%;height:auto}figure{margin:0}a{color:#d6c492}figcaption{padding:8px 0}p{max-width:1100px}@media(max-width:900px){.pair{grid-template-columns:1fr}}</style><h1>L10 targeted photorealism · actual Chromium / WebGL</h1><p>Original PNGs: 3440 × 1440. Before uses exact runtime and asset bytes from '+baseline+'. After uses the recorded candidate resource hashes. Identical fixed cameras, light uniforms, environment, exposure, film pose and resolution. Material shaders may differ and both compiled shader hashes are recorded. No image postprocessing or generated render replacement.</p>'+stages.map(([id])=>'<section><h2>'+labels[id]+'</h2><div class="pair">'+['before','after'].map(variant=>'<figure><a href="'+variant+'/'+id+'.png"><img src="'+variant+'/'+id+'.png" alt="'+variant+' '+labels[id]+'"></a><figcaption>'+variant+' · <a href="'+variant+'/'+id+'.json">captured state</a></figcaption></figure>').join('')+'</div></section>').join('')+'<p><a href="comparison.json">Machine-readable evidence</a>. Automated checks do not establish a photorealism score.</p></html>';
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const variant of variants){
   const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
   await page.addInitScript(observe);
   page.on('pageerror',e=>report.errors.push({variant,type:'pageerror',message:e.message}));
   page.on('console',m=>{if(m.type()==='error')report.errors.push({variant,type:'console',message:m.text()});});
   page.on('response',r=>{if(r.status()>=400)report.errors.push({variant,type:'http',status:r.status(),url:r.url()});});
   page.on('requestfailed',r=>report.errors.push({variant,type:'requestfailed',url:r.url(),message:r.failure()?.errorText}));
   page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(base).origin)report.external.push({variant,url:r.url()});});
   const counts={},hashes={};report.resources[variant]={served:counts,sha256:hashes};
   for(const [file,bytes] of Object.entries(snapshots[variant])){
    hashes[file]=sha(bytes);counts[file]=0;
    const contentType=file.endsWith('.glb')?'model/gltf-binary':file.endsWith('.png')?'image/png':file.endsWith('.html')?'text/html':'application/javascript';
    await page.route(url=>url.pathname==='/'+file.slice(4),route=>{counts[file]++;return route.fulfill({body:bytes,contentType,headers:{'Cache-Control':'no-store'}});});
   }
   await page.goto(base+'/static/l10-bareboard-review.html?l10AssetLab=1&l10Bareboard=1&view=bare-hero',{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>{const s=window.PAL10Review?.scene.getState();return s?.ready&&s.quality.environmentReady&&!s.asset.loading;},null,{timeout:120000});
   const asset=await page.evaluate(()=>PAL10Review.scene.getState().asset);
   assert.equal(asset.enabled,true);assert.equal(asset.failed,false,asset.error);assert.ok(asset.metadata,'Actual GLB metadata required');
   assert.deepEqual(asset.metadata.extras.replacesComputeBoards,[0,1]);assert.equal(asset.metadata.extras.bareBoardOnly,true);
   assert.equal(asset.metadata.extras.replacesNetworking,true);assert.ok(asset.metadata.layers.includes('network'));assert.equal(asset.metadata.layers.length,4);
   report.source[variant]={glb:glbInfo(snapshots[variant][glbPath]),asset,compiledShaderSha256:(await page.evaluate(()=>__targetedQA.shaders)).map(s=>sha(Buffer.from(s))),displayTransformSha256:sha(Buffer.from(displayTransform(snapshots[variant]['app/static/js/core-scene.js'].toString()))),capturedAt:new Date().toISOString()};
   for(const [id,view] of stages){
    await page.evaluate(view=>{__targetedQA.resetDraws();PAL10Review.choose(view);},view);await settle(page,view);
    const state=await page.evaluate(()=>{
     const c=document.querySelector('#system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info'),s=PAL10Review.scene.getState(),u=__targetedQA.uniforms;
     return {scene:s,canvas:[c.width,c.height],lighting:Object.fromEntries(['uKeyPosition','uLightViewProjection','uLightTheme','uHasEnvironment','uHasShadow','uShadowTexel','uReveal','uQuality','uSectionX','uScan','uScanY'].map(k=>[k,u[k]]).filter(([,value])=>value!==undefined)),cameraUniforms:{eye:u.uEye,viewProjection:u.uViewProjection,model:u.uModel},materialDraws:Object.values(__targetedQA.drawMaterials),filmUniformLocations:Object.fromEntries(['uAssetFilmStrength','uAssetFilmThickness'].map(k=>[k,__targetedQA.registered[k]||false])),webgl:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),error:gl.getError(),actualAsset:document.querySelector('#status')?.textContent,actualFallback:c.dataset.reviewFallback};
    });
    assert.equal(state.error,0);assert.equal(state.scene.asset.failed,false);assert.equal(state.actualFallback,'false');assert.equal(state.scene.inspection,view);
    assert.equal(state.scene.progress,.354);assert.deepEqual(state.canvas,[3440,1440]);
    assert.ok(state.materialDraws.length>0,'Observed actual asset draw calls');
    assert.ok(state.materialDraws.every(m=>m.emission===0),'All asset material emission remains zero');
    if(variant==='after'){
     assert.ok(Object.values(state.filmUniformLocations).every(Boolean),'Actual linked silicon film uniform locations');
     assert.ok(state.materialDraws.some(m=>m.filmStrength>0&&m.filmThickness>0),'Actual nonzero angle-dependent silicon finish at draw time');
     for(const material of report.source.after.glb.siliconFinishes)assert.ok(state.materialDraws.some(draw=>Math.abs(draw.filmStrength-material.filmStrength)<1e-7&&Math.abs(draw.filmThickness-material.filmThickness)<1e-7),'Actual authored silicon finish draw: '+material.name);
     assert.ok(state.materialDraws.some(m=>m.aoStrength>0),'Actual contact occlusion strength at asset draw time');
     assert.equal(report.source.after.glb.occlusionMaterials.length,5,'Five board-specific contact occlusion materials');
     assert.equal(new Set(report.source.after.glb.occlusionMaterials.map(m=>m.image)).size,5,'Five distinct board-specific contact occlusion maps');
    }
    const filename=path.join(out,variant,id+'.png');await page.screenshot({path:filename});
    const png=fs.readFileSync(filename);assert.equal(png.readUInt32BE(16),3440);assert.equal(png.readUInt32BE(20),1440);
    const evidence={...state,id,view,file:variant+'/'+id+'.png',sha256:sha(png)};
    fs.writeFileSync(path.join(out,variant,id+'.json'),JSON.stringify(evidence,null,2));
    let pair=report.pairs.find(p=>p.id===id);if(!pair)report.pairs.push(pair={id,view});pair[variant]=evidence;
    console.log('CAPTURE '+variant+' '+id+' '+state.scene.asset.metadata.extras.id);
   }
   for(const file of files)assert.ok(counts[file]>0,'Browser must load recorded resource '+file);
   await context.close();
  }
  if(phase!=='before'){
   for(const pair of report.pairs){
    assert.ok(pair.before&&pair.after,'Complete Before / After pair '+pair.id);
    assert.deepEqual(pair.before.scene.camera,pair.after.scene.camera,pair.id+' camera');
    assert.deepEqual(pair.before.cameraUniforms,pair.after.cameraUniforms,pair.id+' actual camera uniforms');
    assert.deepEqual(pair.before.lighting,pair.after.lighting,pair.id+' light / shadow / section / scan');
    assert.deepEqual(pair.before.canvas,pair.after.canvas,pair.id+' resolution');
    assert.equal(pair.before.scene.progress,pair.after.scene.progress,pair.id+' progress');
   }
   assert.equal(report.resources.before.sha256[environmentPath],report.resources.after.sha256[environmentPath],'Identical actual environment resource');
   assert.equal(report.source.before.displayTransformSha256,report.source.after.displayTransformSha256,'Identical display transform / exposure');
   report.checks=['1001 authored animation poses exactly match 08dbc28','Four actual 3440×1440 native Chromium / WebGL pairs','Same camera matrices, studio environment, light and shadow uniforms, exposure, progress and scan state','Historical baseline runtime and candidate resource hashes actually served','Actual linked film uniforms and nonzero silicon reflectance at asset draw time; every asset draw emission is zero','Two compute boards, network layer, actual GLB loading and fallback OFF','No resource, shader or page errors and no external requests'];
   report.pass=true;
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
 }catch(error){report.pass=false;report.failure=error.stack||error.message;throw error;}
 finally{fs.writeFileSync(reportPath,JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'compare.html'),htmlGallery());await browser.close();}
 console.log(JSON.stringify({phase,pass:report.pass,pairs:report.pairs.length,errors:report.errors,glb:{before:report.source.before?.glb.sha256,after:report.source.after?.glb.sha256}},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
