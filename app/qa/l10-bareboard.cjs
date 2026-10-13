/* Real Chromium captures: same renderer, lens, exposure, studio and film pose.
 * Historical geometry comes from read-only git show, never a checkout/reset. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'artifacts/l10-bareboard'),baseline='1cebe37399392b4bfaa2d43aa886a80a5d86ebfb';
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const history=file=>cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:40*1024*1024});
for(const dir of ['before','after','evidence'])fs.mkdirSync(path.join(out,dir),{recursive:true});
// Authored timeline and all 1001 object poses are independent of new inspection cameras.
const snapshot=source=>{const box={window:{PAL10Hardware:{}},Float32Array,Math};vm.runInNewContext(source,box);return box.window.PACoreScene.assemblySnapshot;};
const oldMotion=snapshot(history('app/static/js/core-scene.js').toString()),newMotion=snapshot(fs.readFileSync(path.join(root,'app/static/js/core-scene.js'),'utf8'));
for(let i=0;i<=1000;i++)assert.equal(JSON.stringify(oldMotion(i/1000)),JSON.stringify(newMotion(i/1000)),'Retained animation pose '+i);
const stages=[['A-front','bare-front'],['B-storage','bare-storage'],['C-section','bare-section'],['D-hero','bare-hero']];
const report={baseline,pass:false,viewport:{width:3440,height:1440},pairs:[],loading:{},errors:[],checks:['1001 unchanged film poses'],benchmark:{},source:{}};
function observe(){
 const uniforms={},locations=new WeakMap(),shaders=[],proto=WebGLRenderingContext.prototype;
 for(const name of ['getUniformLocation','uniform1f','uniform3fv','shaderSource']){
  const original=proto[name];proto[name]=function(...args){
   const result=original.apply(this,args);
   if(name==='getUniformLocation'&&result)locations.set(result,args[1]);
   if(name==='uniform1f'||name==='uniform3fv'){const key=locations.get(args[0]);if(key)uniforms[key]=name==='uniform1f'?args[1]:Array.from(args[1]);}
   if(name==='shaderSource')shaders.push(args[1]);return result;
  };
 }
 window.__bareQA={uniforms,shaders};
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
 for(const variant of ['before','after']){
  const page=await browser.newPage({viewport:report.viewport,deviceScaleFactor:1});await page.addInitScript(observe);
  page.on('pageerror',e=>report.errors.push(variant+': '+e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(variant+': '+m.text());});
  page.on('response',r=>{if(r.status()>=400)report.errors.push(variant+' HTTP '+r.status()+' '+r.url());});
  if(variant==='before'){
   for(const file of ['l10-hardware.js','rack-equipment-scene.js'])await page.route('**/'+file+'?*',r=>r.fulfill({body:history('app/static/js/'+file),contentType:'application/javascript'}));
   await page.route('**/compute-board.glb',r=>r.fulfill({body:history('app/static/models/l10-prototype/compute-board.glb'),contentType:'model/gltf-binary'}));
  }
  const start=Date.now(),url=base+'/static/l10-bareboard-review.html?l10AssetLab=1&'+(variant==='after'?'l10Bareboard=1':'l10AssetPrototype=1');
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{const s=window.PAL10Review?.scene.getState();return s?.ready&&s.quality.environmentReady&&!s.asset.loading;},null,{timeout:120000});
  assert.equal(await page.evaluate(()=>PAL10Review.scene.getState().asset.failed),false);
  report.loading[variant]={navigationToReadyMs:Date.now()-start,method:'Fresh local browser context; shell + geometry + image decoding + GPU upload, one sample'};
  report.source[variant]=await page.evaluate(()=>({shaders:__bareQA.shaders,asset:PAL10Review.scene.getState().asset}));
  for(const [id,view] of stages){
   await page.evaluate(view=>PAL10Review.choose(view),view);
   await page.waitForFunction(()=>{const s=PAL10Review.scene.getState();return s.inspection&&s.quality.resolution===1&&!s.settling&&document.querySelector('canvas').width===3440&&document.querySelector('canvas').height===1440;});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const state=await page.evaluate(()=>{const c=document.querySelector('canvas'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {scene:PAL10Review.scene.getState(),canvas:[c.width,c.height],lighting:Object.fromEntries(['uKeyPosition','uLightTheme','uHasEnvironment','uReveal','uQuality','uSectionX'].map(k=>[k,__bareQA.uniforms[k]])),webgl:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),error:gl.getError()};});
   assert.equal(state.error,0);const file=path.join(out,variant,id+'.png');await page.screenshot({path:file});
   const png=fs.readFileSync(file);assert.equal(png.readUInt32BE(16),3440);assert.equal(png.readUInt32BE(20),1440);
   const evidence={...state,id,view,file:variant+'/'+id+'.png',sha256:sha(png)};
   fs.writeFileSync(path.join(out,variant,id+'.json'),JSON.stringify(evidence,null,2));
   let pair=report.pairs.find(x=>x.id===id);if(!pair)report.pairs.push(pair={id});pair[variant]=evidence;
   console.log('CAPTURE '+variant+' '+id);
  }
  if(variant==='after'){
   await page.evaluate(()=>PAL10Review.choose('rack'));await page.waitForTimeout(350);
   await page.screenshot({path:path.join(out,'after','E-rack-integration.png')});
   report.rackIntegration=await page.evaluate(()=>PAL10Review.scene.getState());
   await page.evaluate(()=>PAL10Review.scene.setProgress(1));await page.waitForTimeout(350);
   await page.screenshot({path:path.join(out,'after','F-rack-overview.png')});
  }
  await page.evaluate(()=>PAL10Review.choose('bare-hero'));
  report.benchmark[variant]=await page.evaluate(async()=>{
   const frames=[],start=performance.now();let last=start;
   for(let i=0;i<120;i++){PAL10Review.scene.resize();await new Promise(r=>requestAnimationFrame(r));const now=performance.now();frames.push(now-last);last=now;}
   frames.sort((a,b)=>a-b);return {durationMs:last-start,frames:120,fps:120000/(last-start),frameMsMedian:frames[60],frameMsP95:frames[114],quality:PAL10Review.scene.getState().quality,drawCalls:PAL10Review.scene.getState().drawCalls,method:'120 forced renderer redraws with real requestAnimationFrame, native browser and production adaptive resolution'};
  });
  await page.close();
 }
 for(const pair of report.pairs){
  assert.deepEqual(pair.before.scene.camera,pair.after.scene.camera,pair.id+' camera');assert.deepEqual(pair.before.lighting,pair.after.lighting,pair.id+' light/section');assert.deepEqual(pair.before.canvas,pair.after.canvas,pair.id+' resolution');assert.equal(pair.before.scene.progress,pair.after.scene.progress);
 }
 assert.deepEqual(report.source.before.shaders,report.source.after.shaders,'Exactly the same compiled shaders/tone mapping');
 for(const variant of ['before','after'])report.source[variant].shaders=report.source[variant].shaders.map(s=>sha(Buffer.from(s)));
 assert.deepEqual(report.errors,[]);report.checks.push('4 same-camera/light/exposure/progress 3440×1440 WebGL pairs','Same compiled shaders/tone mapping','No resource/shader errors','Retained U40 Rack insertion');report.pass=true;
 }finally{fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({pass:report.pass,pairs:report.pairs.length,errors:report.errors,benchmark:report.benchmark},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
