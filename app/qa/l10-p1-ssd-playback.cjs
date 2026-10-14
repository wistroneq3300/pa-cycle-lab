'use strict';
// Diagnostic native-orbit video, not a replacement for the authored-film test.
// All rendering, materials, geometry, lights, quality and depth state are intact.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),baseline='b3664ea97d52f1e6d756de00cfb5a8c84821c0cc';
const variant=process.argv[2]||'after';assert.ok(['before','after'].includes(variant));
const out=path.join(root,'docs/screenshots/l10-cinematic/p1-final/ssd',variant),viewport={width:2560,height:1440};
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),cache=new Map(),resources={};
const read=file=>{if(!cache.has(file)){const bytes=variant==='before'?cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024}):fs.readFileSync(path.join(root,file));cache.set(file,bytes);resources[file]={sha256:sha(bytes),bytes:bytes.length};}return cache.get(file);};
const mime=file=>({html:'text/html; charset=utf-8',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',json:'application/json',glb:'model/gltf-binary',woff2:'font/woff2'}[file.split('.').pop()]||'application/octet-stream');
const server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');assert.ok(['GET','HEAD'].includes(req.method));const file='app'+decodeURIComponent(url.pathname);assert.ok(file.startsWith('app/static/')&&!file.includes('..'));res.writeHead(200,{'Content-Type':mime(file),'Cache-Control':'no-store'});res.end(read(file));}catch(e){res.writeHead(404);res.end('Not found');}});
function observe(){
  const proto=WebGLRenderingContext.prototype,locations=new WeakMap(),u={},trace=[];
  let active=false,ioCount=0,points=[],start=0,lastSample=-Infinity;
  const mul=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[i+4]*v[1]+m[i+8]*v[2]+m[i+12]*v[3]);
  for(const name of ['getUniformLocation','uniform1f','uniformMatrix4fv','drawArrays']){
    const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);
      if(name==='getUniformLocation'&&result)locations.set(result,args[1]);
      if(name==='uniform1f')u[locations.get(args[0])]=args[1];
      if(name==='uniformMatrix4fv')u[locations.get(args[0])]=Array.from(args[2]);
      if(name==='drawArrays'&&active&&args[2]===ioCount&&u.uShadowPass===0&&u.uAsset===0&&performance.now()-lastSample>=55){
        lastSample=performance.now();
        const gl=this,pixels=points.map(p=>{let clip=mul(u.uPart,[...p,1]);clip=mul(u.uModel,clip);clip=mul(u.uViewProjection,clip);const x=Math.round((clip[0]/clip[3]*.5+.5)*gl.drawingBufferWidth),y=Math.round((clip[1]/clip[3]*.5+.5)*gl.drawingBufferHeight);if(x<1||y<1||x>=gl.drawingBufferWidth-1||y>=gl.drawingBufferHeight-1)return {x,y,rgba:null};const rgba=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return {x,y,rgba:Array.from(rgba)};});
        const s=document.querySelector('#system-core').paCoreScene.getState();trace.push({wallMs:lastSample-start,yaw:s.yaw,pitch:s.pitch,camera:s.camera,resolution:s.quality.resolution,pixels});
      }
      return result;
    };
  }
  window.__ssdEvidence={trace,configure(count,p){ioCount=count;points=p;},start(){trace.length=0;start=performance.now();lastSample=-Infinity;active=true;},stop(){active=false;}};
}
function summarize(trace){
  const luminance=p=>p?.rgba?.[3]>.9?(p.rgba[0]*.2126+p.rgba[1]*.7152+p.rgba[2]*.0722):null;
  const delta=[],ranges=[];let darkSamples=0,darkCrossings=0;
  for(let point=0;point<(trace[0]?.pixels.length||0);point++){
    const samples=trace.map(f=>luminance(f.pixels[point])).filter(v=>v!==null),sorted=samples.slice().sort((a,b)=>a-b);
    darkSamples+=samples.filter(v=>v<35).length;
    for(let i=1;i<samples.length;i++){delta.push(Math.abs(samples[i]-samples[i-1]));if((samples[i]<35)!==(samples[i-1]<35))darkCrossings++;}
    if(sorted.length)ranges.push({point,min:sorted[0],max:sorted.at(-1),p10:sorted[Math.floor(sorted.length*.1)],p90:sorted[Math.floor(sorted.length*.9)]});
  }
  delta.sort((a,b)=>a-b);
  return {frames:trace.length,pointCount:trace[0]?.pixels.length||0,deltaCount:delta.length,luminanceDeltaP95:delta[Math.floor(delta.length*.95)]||0,luminanceDeltaMax:delta.at(-1)||0,jumpsAbove35:delta.filter(v=>v>35).length,darkSamples,darkCrossings,darkThreshold:35,ranges};
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const report={variant,baseline,viewport,resources,errors:[],frames:[],method:'Continuous 8-second sweep using the existing scene.setOrbit control at authored bare-tray progress 0. This is a diagnostic camera, not the shipping film camera. Native Chromium recordVideo; production rendering untouched. Pixel samples read after the real opaque I/O draw at tracked surface coordinates.'};
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block',recordVideo:{dir:path.join(root,'artifacts/l10-p1/ssd-video'),size:viewport}}),page=await context.newPage(),video=page.video();
    await page.addInitScript(observe);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===base?r.continue():r.abort();});
    await page.goto(base+'/static/l10-bareboard-review.html?l10AssetLab=1&l10Bareboard=1&view=bare-hero',{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>{const s=document.querySelector('#system-core')?.paCoreScene?.getState();return s?.ready&&s.cooling.ready&&s.quality.environmentReady;},null,{timeout:120000});
    report.geometry=await page.evaluate(()=>{
      const scene=document.querySelector('#system-core').paCoreScene;scene.setInspection(null);scene.setProgress(0);scene.setOrbit(-.42,-.18);
      const built=PAL10Hardware.build(PAL10Hardware.profile,{omitBareBoards:true,replaceServiceGeometry:true,replaceNetworking:true}),slot=built.storageLayout.slots[0],points=[];
      for(const y of [-.04,0,.04])for(const z of [2.28,2.40,2.52,2.64,2.76,2.88])points.push([slot.body.min[0],y,z]);
      __ssdEvidence.configure(built.meshes['l10-io'].data.length/12,points);return {slot:slot.id,points,ioVertices:built.meshes['l10-io'].data.length/12};
    });
    await page.waitForFunction(()=>{const s=document.querySelector('#system-core').paCoreScene.getState();return !s.settling&&s.quality.resolution===1;},null,{timeout:90000});
    report.initial=await page.evaluate(()=>{const c=document.querySelector('#system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {state:c.paCoreScene.getState(),renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),depthBits:gl.getParameter(gl.DEPTH_BITS),glError:gl.getError()};});
    assert.ok(/RTX 4070/i.test(report.initial.renderer),'This evidence run requires the RTX 4070 hardware renderer');assert.equal(report.initial.glError,0);
    await page.screenshot({path:path.join(out,'orbit-start.png')});
    const started=Date.now();
    const sweep=page.evaluate(()=>new Promise(resolve=>{
      const scene=document.querySelector('#system-core').paCoreScene,t0=performance.now();__ssdEvidence.start();
      function tick(now){const t=Math.min(1,(now-t0)/8000);scene.setOrbit(-.42+.20*Math.sin(t*Math.PI*2),-.18+.045*Math.sin(t*Math.PI*2));if(t<1)requestAnimationFrame(tick);else{__ssdEvidence.stop();resolve({trace:__ssdEvidence.trace,state:scene.getState(),glError:document.querySelector('#system-core').getContext('webgl').getError()});}}requestAnimationFrame(tick);
    }));
    for(let i=1;i<=3;i++){await page.waitForTimeout(1900);const file='orbit-'+i+'.png';await page.screenshot({path:path.join(out,file)});report.frames.push({file,wallMs:Date.now()-started});}
    report.sweep=await sweep;report.sweep.wallMs=Date.now()-started;report.metrics=summarize(report.sweep.trace);
    assert.ok(report.sweep.wallMs>=8000);assert.equal(report.sweep.glError,0);assert.ok(report.sweep.trace.length>=40,'Continuous moving frames were sampled');assert.ok(report.sweep.trace.every(f=>f.resolution===1),'Native resolution retained throughout the diagnostic');assert.ok(report.sweep.trace.some(f=>Math.abs(f.yaw+.42)>.15),'Native camera orbit actually moved');assert.deepEqual(report.errors,[]);
    await context.close();await video.saveAs(path.join(out,'ssd-orbit.webm'));report.videoSHA256=sha(fs.readFileSync(path.join(out,'ssd-orbit.webm')));
    // The two coincident materials have separated brightness bands at these
    // interior points: dark enclosure <35, intended nickel >50. Smooth PBR
    // highlights remain free to change as the native camera moves.
    if(variant==='before'){assert.ok(report.metrics.darkCrossings>100,'Pinned RC reproduces repeated dark-enclosure/nickel substitutions');assert.ok(report.metrics.luminanceDeltaP95>35,'Pinned RC reproduces large temporal jumps');}
    else{assert.equal(report.metrics.darkSamples,0,'Opaque dark enclosure never replaces the nickel insert');assert.equal(report.metrics.darkCrossings,0);assert.ok(report.metrics.luminanceDeltaP95<10,'Tracked nickel surface remains temporally stable during orbit');}
    if(variant==='after'){
      const beforeFile=path.join(out,'../before/ssd-playback.json');if(fs.existsSync(beforeFile)){const before=JSON.parse(fs.readFileSync(beforeFile));report.comparison={before:before.metrics,after:report.metrics,note:'Tracked-material temporal jumps are diagnostic statistics; inspect video alongside the exact coplanar geometry regression.'};assert.ok(report.metrics.luminanceDeltaP95<before.metrics.luminanceDeltaP95*.2,'At least 80% reduction in the 95th-percentile temporal jump');}
    }
    report.pass=true;
    console.log(JSON.stringify({variant,pass:report.pass,renderer:report.initial.renderer,metrics:report.metrics,output:out},null,2));
  }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'ssd-playback.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
