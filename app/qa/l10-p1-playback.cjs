'use strict';
// Isolated shipping-dashboard Chromium/WebGL evidence. Historical GET responses
// come from git show, never checkout. Preview fixtures replace backend I/O only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),baseline='b3664ea97d52f1e6d756de00cfb5a8c84821c0cc';
const variant=process.argv[2]||'after',mode=process.argv[3]||'all',film=mode==='all';assert.ok(['before','after'].includes(variant));
const out=path.join(root,'docs/screenshots/l10-cinematic/p1-final',variant),viewport={width:3440,height:1440};
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),cache=new Map(),resources={};
const read=file=>{if(!cache.has(file)){const bytes=variant==='before'?cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024}):fs.readFileSync(path.join(root,file));cache.set(file,bytes);resources[file]={sha256:sha(bytes),bytes:bytes.length};}return cache.get(file);};
const mime=file=>({'html':'text/html; charset=utf-8',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',json:'application/json',glb:'model/gltf-binary',woff2:'font/woff2'}[file.split('.').pop()]||'application/octet-stream');
const server=http.createServer((req,res)=>{
 try{const url=new URL(req.url,'http://localhost');assert.ok(['GET','HEAD'].includes(req.method));
 const file=url.pathname==='/'?'app/static/index.html':'app'+decodeURIComponent(url.pathname);assert.ok(file.startsWith('app/static/')&&!file.includes('..'));
 let bytes=read(file);if(file==='app/static/index.html')bytes=Buffer.from(bytes.toString().replace('</head>','<script src="/static/js/preview-fixtures.js"></script></head>'));
 res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-store'});res.end(bytes);
 }catch(e){res.writeHead(404);res.end('Not found');}
});
function observe(){
 const proto=WebGLRenderingContext.prototype,locations=new WeakMap(),u={},trace=[],frames=[];let active=false,frame=0,fluidDraws=0,travelWrites=0,wallStart=0;
 for(const name of ['getUniformLocation','uniform1f','uniform2fv','uniform3fv','uniform4fv','uniformMatrix4fv','drawArrays','clear']){
  const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);
   if(name==='getUniformLocation'&&result)locations.set(result,args[1]);
   if(name.startsWith('uniform')){const key=locations.get(args[0]);if(key){u[key]=name==='uniform1f'?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);if(key==='uCoolingTravel')travelWrites++;}}
   if(name==='clear'&&(args[0]&this.COLOR_BUFFER_BIT)&&this.getParameter(this.FRAMEBUFFER_BINDING)===null){frame++;fluidDraws=0;}
   if(name==='drawArrays'&&u.uShadowPass===0&&u.uCoolingFlow>.5)fluidDraws++;
   return result;
  };
 }
 function tick(now){if(active){const c=document.querySelector('#system-core'),s=c?.paCoreScene?.getState(),p=document.querySelector('#core-story')?.paHeroPlayback?.getState();if(s&&p)trace.push({wallMs:now-wallStart,frame,elapsedMs:p.elapsedMs,mode:p.mode,timelineMode:p.timelineMode,flow:s.l10.flow,travel:s.l10.flowTravel,gpuTravel:u.uCoolingTravel,travelWrites,fluidDraws,progress:s.progress,phase:s.l10.phase,resolution:s.quality.resolution,camera:s.camera,canvas:[c.width,c.height]});}requestAnimationFrame(tick);}requestAnimationFrame(tick);
 window.__p1={u,trace,frames,start:()=>{trace.length=0;wallStart=performance.now();active=true;},stop:()=>{active=false;},capture:()=>({uniforms:JSON.parse(JSON.stringify(u)),frame,fluidDraws,travelWrites})};
}
async function ready(page,base,errors,entry=variant==='before'?'/?l10Bareboard=1#/dashboard':'/#/dashboard'){
 await page.addInitScript(observe);
 page.on('pageerror',e=>errors.push({type:'page',message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',message:m.text()});});
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.protocol==='http:'&&u.origin===base?route.continue():route.abort();});
 await page.goto(base+entry,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>{const s=document.querySelector('#system-core')?.paCoreScene?.getState();return s?.ready&&(!s.cooling.enabled||s.cooling.ready)&&s.quality.environmentReady&&document.querySelector('#core-story')?.paHeroPlayback;},null,{timeout:120000});
 await page.evaluate(()=>{applyTheme('dark');document.querySelector('#core-story').paHeroPlayback.pause();});
}
async function state(page){return page.evaluate(()=>{const c=document.querySelector('#system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {scene:c.paCoreScene.getState(),playback:document.querySelector('#core-story').paHeroPlayback.getState(),gpu:__p1.capture(),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),depthBits:gl.getParameter(gl.DEPTH_BITS),glError:gl.getError(),canvas:[c.width,c.height],cssCanvas:[c.clientWidth,c.clientHeight]};});}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const report={variant,baseline,entry:variant==='before'?'/?l10Bareboard=1#/dashboard':'/#/dashboard',viewport,resources,errors:[],frames:[],method:'Native Chromium shipping dashboard at unchanged authored times/camera/lighting. WebGL observer records uniforms only. Backend is isolated with the existing preview fixture. Full replay video uses native recordVideo with no seeking during playback. Before uses the RC opt-in; after uses the ordinary shipping URL.'};
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  if(mode==='entry'){
   const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();await ready(page,base,report.errors,'/#/dashboard');
   for(const ms of [8400,8650,9000,9700,9900]){await page.evaluate(ms=>document.querySelector('#core-story').paHeroPlayback.seekTime(ms),ms);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const s=await state(page);report.frames.push({requestedMs:ms,...s});console.log('ordinary entry '+ms+' '+s.playback.timelineMode+' flow='+s.scene.l10.flow+' shader='+s.gpu.uniforms.uCoolingFlow);}
   await context.close();report.pass=true;return;
  }
  let context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();await ready(page,base,report.errors);
  for(const ms of [5000,8000,11200,12300,13400,15500,22000,39700]){
   await page.evaluate(ms=>{document.querySelector('#core-story').paHeroPlayback.seekTime(ms);document.querySelector('#system-core').paCoreScene.resetOrbit();},ms);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.waitForFunction(()=>{const s=document.querySelector('#system-core').paCoreScene.getState();return !s.settling&&s.quality.resolution===1;},null,{timeout:90000});
   const s=await state(page);assert.equal(s.playback.timelineMode,'coolingV2');assert.equal(s.playback.duration,39700);assert.equal(s.glError,0);assert.ok(!/SwiftShader|llvmpipe/i.test(s.renderer),'Hardware WebGL required');
   const file='time-'+ms+'.png';await page.locator('#system-core').screenshot({path:path.join(out,file)});
   const nativeFile='time-'+ms+'-webgl.png',native=await page.evaluate(()=>new Promise(resolve=>{const c=document.querySelector('#system-core');c.paCoreScene.resize();requestAnimationFrame(()=>resolve(c.toDataURL('image/png')));}));
   fs.writeFileSync(path.join(out,nativeFile),Buffer.from(native.split(',')[1],'base64'));
   report.frames.push({requestedMs:ms,file,nativeFile,...s});console.log(variant+' '+ms+' '+s.renderer+' flow='+s.scene.l10.flow+' gpuTravel='+s.gpu.uniforms.uCoolingTravel);
  }
  await context.close();
  if(film){
   context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block',recordVideo:{dir:path.join(root,'artifacts/l10-p1/video'),size:viewport}});page=await context.newPage();await ready(page,base,report.errors);
   const video=page.video(),started=Date.now();await page.evaluate(()=>{__p1.start();document.querySelector('#core-story').paHeroPlayback.replay();});
   await page.waitForFunction(()=>{const p=document.querySelector('#core-story').paHeroPlayback.getState();return p.mode==='stopped'&&p.progress===1;},null,{timeout:180000});
   const wallMs=Date.now()-started;await page.evaluate(()=>__p1.stop());report.film={wallMs,trace:await page.evaluate(()=>__p1.trace),final:await state(page)};
   await context.close();await video.saveAs(path.join(out,'film.webm'));report.film.sha256=sha(fs.readFileSync(path.join(out,'film.webm')));assert.ok(wallMs>=39500);assert.ok(report.film.trace.some(s=>s.flow>.9));
   const flow=report.film.trace.filter(s=>s.elapsedMs>=11000&&s.elapsedMs<=14300);
   assert.ok(flow.length>80,'Continuous full-density flow must be sampled throughout the authored window');
   assert.ok(flow.every(s=>s.timelineMode==='coolingV2'&&s.flow>.99&&s.fluidDraws===22),'All complete fluid paths must draw during the full flow stage');
   assert.ok(flow.every(s=>Math.abs(s.gpuTravel-s.travel)<.05),'GPU travel must track the real clock (within one observer RAF)');
   assert.ok(new Set(flow.map(s=>s.gpuTravel)).size>80,'Travel must update continuously, not just illuminate the full loop');
   report.film.flowSummary={frames:flow.length,startMs:flow[0].elapsedMs,endMs:flow.at(-1).elapsedMs,firstTravel:flow[0].gpuTravel,lastTravel:flow.at(-1).gpuTravel,distinctTravel:new Set(flow.map(s=>s.gpuTravel)).size,minimumResolution:Math.min(...report.film.trace.map(s=>s.resolution))};
  }
  assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,mode==='entry'?'ordinary-entry.json':'playback.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
