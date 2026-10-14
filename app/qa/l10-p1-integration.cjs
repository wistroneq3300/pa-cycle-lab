'use strict';
// Real GPU integration: inspect shipping bytes and WebGL calls without replacing
// geometry, shaders, material uniforms, the render loop or the playback clock.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {PNG}=require(process.env.PLAYWRIGHT_MODULE?path.join(path.dirname(process.env.PLAYWRIGHT_MODULE),'pngjs'):'pngjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/p1-final/integration');
const viewport={width:3440,height:1440},sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out,{recursive:true});
const mime=f=>({html:'text/html; charset=utf-8',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',json:'application/json',glb:'model/gltf-binary',woff2:'font/woff2'}[f.split('.').pop()]||'application/octet-stream');
const server=http.createServer((req,res)=>{
 try{assert.equal(req.method,'GET');const u=new URL(req.url,'http://localhost'),rel=u.pathname==='/'?'app/static/index.html':'app'+decodeURIComponent(u.pathname);assert.ok(rel.startsWith('app/static/')&&!rel.includes('..'));let bytes=fs.readFileSync(path.join(root,rel));
 if(rel==='app/static/index.html')bytes=Buffer.from(bytes.toString().replace('</head>','<script src="/static/js/preview-fixtures.js"></script></head>'));
 res.writeHead(200,{'Content-Type':mime(rel),'Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
function observe(){
 const proto=WebGLRenderingContext.prototype,locations=new WeakMap(),bufferMeta=new WeakMap(),pending=[],uploads=[],shaders=[],assets=[],uniforms={};let bound=null,draws=[],totalDraws=0,frame=0;
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const originalFetch=window.fetch;window.fetch=async function(...args){const response=await originalFetch.apply(this,args);const pathname=new URL(response.url||args[0],location.href).pathname;if(pathname.endsWith('.glb')){const task=response.clone().arrayBuffer().then(async bytes=>assets.push({path:pathname,status:response.status,bytes:bytes.byteLength,sha256:await digest(bytes)}));pending.push(task);}return response;};
 const save=(name,handler)=>{const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);handler.call(this,args,result);return result;};};
 save('bindBuffer',function(a){if(a[0]===this.ARRAY_BUFFER)bound=a[1];});
 save('bufferData',function(a){if(a[0]!==this.ARRAY_BUFFER||!ArrayBuffer.isView(a[1]))return;const entry={index:uploads.length,bytes:a[1].byteLength,sha256:null};bufferMeta.set(bound,entry);uploads.push(entry);const copy=a[1].buffer.slice(a[1].byteOffset,a[1].byteOffset+a[1].byteLength);pending.push(digest(copy).then(hash=>entry.sha256=hash));});
 save('shaderSource',function(a){const entry={type:this.getShaderParameter(a[0],this.SHADER_TYPE),source:a[1],sha256:null};shaders.push(entry);pending.push(digest(new TextEncoder().encode(a[1])).then(hash=>entry.sha256=hash));});
 save('getUniformLocation',function(a,r){if(r)locations.set(r,a[1]);});
 for(const method of ['uniform1f','uniform1i','uniform2fv','uniform3fv','uniform4fv','uniformMatrix4fv'])save(method,function(a){const name=locations.get(a[0]);if(name)uniforms[name]=method==='uniform1f'||method==='uniform1i'?a[1]:Array.from(a[method==='uniformMatrix4fv'?2:1]);});
 save('clear',function(a){if(a[0]&this.COLOR_BUFFER_BIT&&this.getParameter(this.FRAMEBUFFER_BINDING)===null){frame++;draws=[];}});
 save('drawArrays',function(a){totalDraws++;if(this.getParameter(this.FRAMEBUFFER_BINDING)!==null)return;draws.push({buffer:bufferMeta.get(bound),mode:a[0],first:a[1],count:a[2],asset:uniforms.uAsset,coolingFlow:uniforms.uCoolingFlow,coolingTravel:uniforms.uCoolingTravel,coolingRoute:uniforms.uCoolingRoute,coolingPhase:uniforms.uCoolingPhase,opacity:uniforms.uOpacity,part:uniforms.uPart,model:uniforms.uModel,viewProjection:uniforms.uViewProjection,eye:uniforms.uEye,depthWrite:this.getParameter(this.DEPTH_WRITEMASK)});});
 window.__integration={pending,uploads,shaders,assets,uniforms,flush:async()=>{await Promise.all(pending);},snapshot:()=>({frame,totalDraws,draws,uploads,shaders,assets,uniforms})};
}
const waitFrames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function snapshot(page){return page.evaluate(()=>{
 const c=document.querySelector('#system-core'),gl=c.paCoreScene?c.getContext('webgl'):null,e=gl?.getExtension('WEBGL_debug_renderer_info');
 return {state:c.paCoreScene?.getState()||{supported:false,ready:false},playback:document.querySelector('#core-story')?.paHeroPlayback?.getState()||null,dataset:{...c.dataset},stageScene:document.querySelector('#core-stage')?.dataset.scene||null,canvas:[c.width,c.height],renderer:gl?gl.getParameter(e?e.UNMASKED_RENDERER_WEBGL:gl.RENDERER):null,glError:gl?.getError()??null,gpu:__integration.snapshot(),controls:Array.from(document.querySelectorAll('[data-vo-replay],[data-vo-skip],[data-core-view]')).map(b=>({name:b.textContent.trim(),disabled:b.disabled})),help:document.querySelector('#core-interaction-help')?.textContent||null};
});}
async function nativePNG(page,file){const data=await page.evaluate(()=>new Promise(resolve=>{const c=document.querySelector('#system-core');c.paCoreScene.resize();requestAnimationFrame(()=>resolve(c.toDataURL('image/png')));}));fs.writeFileSync(path.join(out,file),Buffer.from(data.split(',')[1],'base64'));return sha(fs.readFileSync(path.join(out,file)));}
const orderedSignature=report=>report.gpu.draws.map(({buffer,...d})=>({...d,buffer:{bytes:buffer.bytes,sha256:buffer.sha256}}));
function pixelDifference(first,second){
 const a=PNG.sync.read(fs.readFileSync(path.join(out,first))),b=PNG.sync.read(fs.readFileSync(path.join(out,second)));assert.equal(a.width,b.width);assert.equal(a.height,b.height);
 let changed=0,total=0,max=0,left=a.width,top=a.height,right=-1,bottom=-1;
 for(let p=0;p<a.width*a.height;p++){let d=0;for(let c=0;c<4;c++){const v=Math.abs(a.data[p*4+c]-b.data[p*4+c]);d=Math.max(d,v);total+=v;max=Math.max(max,v);}if(d>2){changed++;const x=p%a.width,y=Math.floor(p/a.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 return {first,second,changedPixelsAbove2:changed,maxChannelDelta:max,meanAbsoluteChannelDelta:total/a.data.length,boundingBox:[left,top,right,bottom]};
}
const errors=[];
async function open(browser,base,entry,fault){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),resources=[],tasks=[];let releaseSlow;
 const slowGate=new Promise(resolve=>releaseSlow=resolve);
 await page.addInitScript(observe);
 page.on('pageerror',e=>errors.push({entry,type:'page',message:e.message}));
 page.on('response',r=>{if(/\.(?:js|html)(?:\?|$)/.test(r.url())||new URL(r.url()).pathname==='/')tasks.push(r.body().then(bytes=>resources.push({path:new URL(r.url()).pathname,sha256:sha(bytes),bytes:bytes.length,status:r.status()})).catch(e=>resources.push({path:new URL(r.url()).pathname,error:e.message})));});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
 const cooling=u.pathname.endsWith('/cooling-assembly.glb'),normal=u.pathname.endsWith('/studio-small-09-radiance.png'),env=u.pathname.endsWith('/studio-small-09-cooling-radiance.png'),hardware=u.pathname.endsWith('/l10-hardware.js'),core=u.pathname.endsWith('/core-scene.js');
 if(fault==='slow'&&cooling)await slowGate;
 if(fault==='cooling'&&cooling||fault==='environment'&&normal||fault==='cooling-environment'&&env||fault==='hardware'&&hardware||fault==='core'&&core)return route.fulfill({status:503,contentType:'text/plain',body:'Intentional isolated QA failure'});
 return route.continue();});
 await page.goto(base+entry,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>{const c=document.querySelector('#system-core');return (c?.paCoreScene||c?.dataset.coreState==='fallback'||document.querySelector('#core-stage')?.dataset.scene==='fallback')&&(!document.querySelector('#core-story')||document.querySelector('#core-story').paHeroPlayback);},null,{timeout:120000});
 return {context,page,resources,tasks,releaseSlow};
}
async function compareMode(browser,base,name,entry){
 const p=await open(browser,base,entry),{page}=p;
 try{
 await page.waitForFunction(()=>{const s=document.querySelector('#system-core').paCoreScene.getState();return s.ready&&s.cooling.ready&&s.quality.environmentReady&&s.quality.coolingEnvironmentReady;},null,{timeout:120000});
 await page.evaluate(()=>{
  const c=document.querySelector('#system-core'),s=c.paCoreScene,p=document.querySelector('#core-story')?.paHeroPlayback;
  p?.pause();window.applyTheme?.('dark');s.setTheme('dark');
  c.style.width='2127px';c.style.height='1272px';c.style.maxWidth='none';c.style.maxHeight='none';
  if(p)p.seekTime(12300);else s.setProgress(PAL10Timeline.progressAt(12300,'coolingV2'));
  s.resetOrbit();s.setInspection('cooling-hero');s.resize();
 });
 await waitFrames(page);
 await page.waitForFunction(()=>{const s=document.querySelector('#system-core').paCoreScene.getState();return !s.settling&&s.quality.resolution===1;},null,{timeout:90000});
 await page.evaluate(()=>__integration.flush());await Promise.all(p.tasks);
 const screenshot=name+'-12300-native.png',pngSHA256=await nativePNG(page,screenshot),report=await snapshot(page);
 Object.assign(report,{entry,requestedTimeMs:12300,inspection:'cooling-hero',screenshot,pngSHA256,resources:p.resources});
 assert.equal(report.glError,0);assert.ok(!/SwiftShader|llvmpipe/i.test(report.renderer));assert.deepEqual(report.canvas,[2127,1272]);assert.equal(report.state.cooling.ready,true);
 assert.equal(report.gpu.draws.filter(d=>d.coolingFlow>.5).length,22);
 if(report.playback){assert.equal(report.playback.timelineMode,'coolingV2');assert.equal(report.playback.duration,39700);assert.equal(Math.round(report.playback.elapsedMs),12300);}
 report.orderedDrawSHA256=sha(JSON.stringify(orderedSignature(report)));report.fluidDraws=report.gpu.draws.filter(d=>d.coolingFlow>.5).length;
 fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(report,null,2)+'\n');console.log(name+': '+report.gpu.draws.length+' draws; '+report.fluidDraws+' fluid; '+report.orderedDrawSHA256);
 if(name==='dashboard'){
  const flow={method:'Native PNG at three authored times, same cooling-hero inspection and physical camera matrices; geometry/draw/material metadata identical apart from advancing coolingTravel. No pixel editing.',frames:[],differences:[]};
  for(const ms of [11200,12300,13400]){
   await page.evaluate(ms=>{const c=document.querySelector('#system-core');document.querySelector('#core-story').paHeroPlayback.seekTime(ms);c.paCoreScene.resetOrbit();c.paCoreScene.setInspection('cooling-hero');},ms);await waitFrames(page);
   await page.waitForFunction(()=>{const s=document.querySelector('#system-core').paCoreScene.getState();return !s.settling&&s.quality.resolution===1;},null,{timeout:90000});
   const image='flow-'+ms+'-fixed-camera-native.png',pngSHA256=await nativePNG(page,image),s=await snapshot(page);
   assert.equal(s.state.l10.flow,1);assert.equal(s.gpu.draws.filter(d=>d.coolingFlow>.5).length,22);
   const geometrySHA256=sha(JSON.stringify(orderedSignature(s).map(({coolingTravel,...draw})=>draw)));
   flow.frames.push({timeMs:ms,image,pngSHA256,flow:s.state.l10.flow,flowTravel:s.state.l10.flowTravel,gpuTravel:s.gpu.uniforms.uCoolingTravel,geometrySHA256,camera:s.state.camera,viewProjection:s.gpu.uniforms.uViewProjection,model:s.gpu.uniforms.uModel,eye:s.gpu.uniforms.uEye,fluidDraws:s.gpu.draws.filter(d=>d.coolingFlow>.5)});
  }
  for(let i=1;i<flow.frames.length;i++){assert.equal(flow.frames[i].geometrySHA256,flow.frames[0].geometrySHA256);const difference=pixelDifference(flow.frames[i-1].image,flow.frames[i].image);assert.ok(difference.changedPixelsAbove2>1000,'Visible moving pixels, not only a changing uniform');flow.differences.push(difference);}
  flow.pass=true;fs.writeFileSync(path.join(out,'flow-fixed-camera.json'),JSON.stringify(flow,null,2)+'\n');report.flow=flow;
 }
 return report;
 }finally{await p.context.close();}
}
async function faultMode(browser,base,fault){
 const p=await open(browser,base,'/#/dashboard',fault),{page}=p;
 try{
 await page.waitForFunction(fault=>{const c=document.querySelector('#system-core');return fault==='slow'?c.dataset.coreCooling==='loading':fault==='core'?document.querySelector('#core-stage')?.dataset.scene==='fallback':c.dataset.coreState==='fallback';},fault,{timeout:120000});
 await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.replay());const first=await snapshot(page);
 await page.waitForTimeout(1200);const second=await snapshot(page);
 assert.equal(first.playback.timelineMode,'coolingV2');assert.equal(second.playback.duration,39700);assert.equal(second.playback.elapsedMs,first.playback.elapsedMs);assert.equal(second.gpu.totalDraws,0);assert.equal(second.state.ready,false);assert.ok(second.controls.every(b=>b.disabled));
 const report={fault,first,second,heldMs:1200,resources:p.resources};
 if(fault==='slow'){
  assert.equal(second.dataset.coreState,'loading');p.releaseSlow();
  await page.waitForFunction(()=>document.querySelector('#system-core').dataset.coreState==='ready',null,{timeout:120000});
  await page.waitForTimeout(250);report.recovered=await snapshot(page);assert.equal(report.recovered.state.cooling.ready,true);assert.equal(report.recovered.playback.timelineMode,'coolingV2');assert.ok(report.recovered.playback.elapsedMs>0);assert.ok(report.recovered.playback.elapsedMs<1500);
 }else{assert.equal(fault==='core'?second.stageScene:second.dataset.coreState,'fallback');assert.equal(second.playback.mode,'stopped');assert.match(second.help,/重新整理/);}
 await page.evaluate(()=>__integration.flush());await Promise.all(p.tasks);report.pass=true;
 fs.writeFileSync(path.join(out,'fault-'+fault+'.json'),JSON.stringify(report,null,2)+'\n');console.log('fault '+fault+': closed gate passed');return report;
 }finally{p.releaseSlow();await p.context.close();}
}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']}),report={method:'Native Chromium hardware WebGL; observer-only calls and fetch hashing. Existing preview-fixtures isolates backend. Same semantic time, native inspection camera, and 2127x1272 canvas. No material, shader, geometry or clock substitutions.',modes:[],faults:[],errors};
 try{
 for(const [name,entry]of [['dashboard','/?l10AssetLab=1#/dashboard'],['opt-in','/?l10AssetLab=1&l10Bareboard=1#/dashboard'],['review','/static/l10-cooling-v2-review.html?l10AssetLab=1&l10Bareboard=1&stage=flow']]){
  const r=await compareMode(browser,base,name,entry);report.modes.push({name,entry,canvas:r.canvas,renderer:r.renderer,draws:r.gpu.draws.length,fluidDraws:r.fluidDraws,orderedDrawSHA256:r.orderedDrawSHA256,assets:r.gpu.assets,shaders:r.gpu.shaders.map(({type,sha256})=>({type,sha256})),screenshot:r.screenshot,pngSHA256:r.pngSHA256});
 }
 const reference=report.modes[0];for(const mode of report.modes.slice(1)){assert.equal(mode.orderedDrawSHA256,reference.orderedDrawSHA256);assert.deepEqual(mode.assets.slice().sort((a,b)=>a.path.localeCompare(b.path)),reference.assets.slice().sort((a,b)=>a.path.localeCompare(b.path)));assert.deepEqual(mode.shaders,reference.shaders);}
 for(const fault of ['slow','cooling','environment','cooling-environment','hardware','core']){const r=await faultMode(browser,base,fault);report.faults.push({fault,pass:r.pass,duration:r.second.playback.duration,elapsed:r.second.playback.elapsedMs,totalDraws:r.second.gpu.totalDraws,help:r.second.help});}
 assert.deepEqual(errors,[]);report.pass=true;console.log('Integration PASS');
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
