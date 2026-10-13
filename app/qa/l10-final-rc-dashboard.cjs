/* Shipping dashboard evidence at its real 2127 x 1272 canvas size.
 * Only historical static-resource responses are substituted for the before run.
 * Neither geometry, shaders, clocks nor camera state are injected. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,process.env.PA_COOLING_OUTPUT||'docs/screenshots/l10-cinematic/final-rc');
const baseline=process.env.PA_COOLING_BASELINE||'108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c',base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8775';
const phase=process.env.PA_CAPTURE_PHASE||'both';assert.ok(['before','after','both'].includes(phase));assert.match(baseline,/^[0-9a-f]{40}$/);assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),origin=new URL(base).origin;
const report={baseline,pass:false,method:'Native Chromium canvas PNG plus complete shipping dashboard screenshot, without renderer injection, CSS sizing overrides, time stretching or image postprocessing.',viewport:{width:3440,height:1440},requiredCanvas:[2127,1272],frames:[],errors:[],resources:[]};
fs.mkdirSync(path.join(out,'evidence'),{recursive:true});
const historicalCache=new Map();
function historical(file){if(!historicalCache.has(file))historicalCache.set(file,cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024}));return historicalCache.get(file);}
function mime(file){return file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.glb')?'model/gltf-binary':'application/octet-stream';}
function observe(){
 const proto=WebGLRenderingContext.prototype,uniforms={},locations=new WeakMap(),attributes={},registered={},shaders=[],textureSources=new WeakMap(),textureUnits={};let material=[0,0],depth=true,draws=[],activeUnit=33984;
 for(const name of ['getUniformLocation','getAttribLocation','vertexAttrib2f','uniform1f','uniform1i','uniform3fv','uniformMatrix4fv','shaderSource','drawArrays','depthMask','clear','activeTexture','bindTexture','texImage2D']){
  const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args);
   if(name==='getUniformLocation'){registered[args[1]]=!!result;if(result)locations.set(result,args[1]);}
   if(name==='getAttribLocation')attributes[args[1]]=result;
   if(name==='vertexAttrib2f'&&args[0]===attributes.aMaterial)material=args.slice(1);
   if(name.startsWith('uniform')){const key=locations.get(args[0]);if(key)uniforms[key]=(name==='uniform1f'||name==='uniform1i')?args[1]:Array.from(args[name==='uniformMatrix4fv'?2:1]);}
   if(name==='shaderSource')shaders.push(args[1]);
   if(name==='depthMask')depth=args[0];
   if(name==='activeTexture')activeUnit=args[0];
   if(name==='bindTexture')textureUnits[activeUnit]=args[1];
   if(name==='texImage2D'&&args.length===6&&textureUnits[activeUnit])textureSources.set(textureUnits[activeUnit],args[5]?.src||'inline pixel source');
   if(name==='clear'&&(args[0]&this.COLOR_BUFFER_BIT))draws=[];
   if(name==='drawArrays'&&uniforms.uShadowPass===0)draws.push({asset:uniforms.uAsset,opacity:uniforms.uOpacity,depth,vertices:args[2],part:uniforms.uPart?.slice(),metallic:material[0],emission:material[1],roughness:uniforms.uAssetRoughness,flow:uniforms.uCoolingFlow||0,travel:uniforms.uCoolingTravel||0,filmStrength:uniforms.uAssetFilmStrength||0,ao:uniforms.uAssetAO||0,environment:textureSources.get(textureUnits[33985])||null});
   return result;
  };
 }
 window.__coolingQA={uniforms,registered,shaders,draws:()=>draws};
}

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium'),args:['--no-sandbox']});
 try{
  for(const variant of phase==='both'?['before','after']:[phase]){
   fs.mkdirSync(path.join(out,variant),{recursive:true});
   const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
   await page.addInitScript(observe);
   page.on('pageerror',error=>report.errors.push({variant,type:'pageerror',message:error.message}));
   page.on('console',m=>{if(m.type()==='error')report.errors.push({variant,type:'console',message:m.text()});});
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(!/^https?:$/.test(url.protocol))return route.continue();
    if(url.origin!==origin){report.errors.push({variant,type:'external',url:url.href});return route.abort();}
    if(!['GET','HEAD'].includes(route.request().method()))throw Error('Evidence must not submit requests');
    if(variant==='before'&&(url.pathname==='/'||url.pathname.startsWith('/static/'))){
     const file=url.pathname==='/'?'app/static/index.html':'app'+decodeURIComponent(url.pathname);
     assert.ok(!file.includes('..'),'Historical path remains in app');
     const original=historical(file),bytes=file==='app/static/index.html'?Buffer.from(original.toString('utf8').replace('</head>','<script src="/static/js/preview-fixtures.js"></script></head>')):original;
     report.resources.push({variant,file,sourceSHA256:sha(original),sha256:sha(bytes),bytes:bytes.length,previewFixtureInjection:file==='app/static/index.html'});
     return route.fulfill({body:bytes,contentType:mime(file)});
    }
    return route.continue();
   });
   await page.goto(base+'/?l10Bareboard=1#/dashboard',{waitUntil:'domcontentloaded',timeout:120000});
   await page.waitForFunction(()=>{const c=document.querySelector('#system-core'),s=c?.paCoreScene?.getState();return s?.ready&&s.cooling.ready&&s.quality.environmentReady&&document.querySelector('#core-story')?.paHeroPlayback;},null,{timeout:120000});
   await page.evaluate(()=>{applyTheme('dark');document.querySelector('#core-story').paHeroPlayback.pause();});
   for(const spec of [{id:'dashboard-flow-A',semantic:'flow',fraction:.4},{id:'dashboard-flow-B',semantic:'flow',fraction:.7},{id:'dashboard-solid',semantic:'solid',fraction:.5}]){
    await page.evaluate(spec=>{const scene=document.querySelector('#system-core').paCoreScene,clock=document.querySelector('#core-story').paHeroPlayback;clock.seek(PAL10Timeline.stageProgress(spec.semantic,spec.fraction,'coolingV2'));scene.resetOrbit();},spec);
    // resetOrbit schedules its draw; the previous settled flag can still be
    // false before that first draw notices the new target. Let it run first.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.waitForFunction(()=>{const s=document.querySelector('#system-core').paCoreScene.getState();return !s.settling&&s.quality.resolution===1;},null,{timeout:90000});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const state=await page.evaluate(()=>{const c=document.querySelector('#system-core'),gl=c.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');const u=__coolingQA.uniforms;return {cameraUniforms:{eye:u.uEye,viewProjection:u.uViewProjection,model:u.uModel},draws:__coolingQA.draws(),canvas:[c.width,c.height],cssCanvas:[c.clientWidth,c.clientHeight],scene:c.paCoreScene.getState(),playback:document.querySelector('#core-story').paHeroPlayback.getState(),webgl:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),glError:gl.getError()};});
    assert.deepEqual(state.canvas,report.requiredCanvas,'Real dashboard drawing buffer');assert.equal(state.glError,0);assert.equal(state.playback.duration,39700);assert.equal(state.scene.inspection,null,'Actual authored dashboard camera');assert.equal(state.scene.settling,false,'Actual camera has finished damping before capture');
    if(variant==='after'&&spec.semantic==='flow'){
     const before=JSON.parse(fs.readFileSync(path.join(out,'before',spec.id+'.json'),'utf8'));
     assert.equal(before.scene.settling,false,'Historical flow camera was settled');
     assert.equal(state.scene.progress,before.scene.progress,'Dashboard comparison uses the identical timeline position');
     const flatten=c=>[c.yaw,c.elevation,c.distance,...c.target,...c.eye,c.fov],a=flatten(before.scene.camera),b=flatten(state.scene.camera),error=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
     assert.ok(error<.002,'Authored Dashboard cameras match within the original settling tolerance: '+error);state.fixedCameraComparison={maximumComponentDifference:error,tolerance:.002};
    }
    const file=variant+'/'+spec.id+'-2127x1272.png',bytes=await page.locator('#system-core').screenshot({path:path.join(out,file)});
    // The CSS box can have fractional pixels; canvas.toBlob obtains the original
    // drawing buffer when Chromium's CSS screenshot rounds a different edge.
    if(bytes.readUInt32BE(16)!==2127||bytes.readUInt32BE(20)!==1272){
     const data=await page.locator('#system-core').evaluate(c=>c.toDataURL('image/png'));
     const raw=Buffer.from(data.split(',')[1],'base64');assert.equal(raw.readUInt32BE(16),2127);assert.equal(raw.readUInt32BE(20),1272);fs.writeFileSync(path.join(out,file),raw);
    }
    const frame={...spec,...state,file,sha256:sha(fs.readFileSync(path.join(out,file)))};
    fs.writeFileSync(path.join(out,variant,spec.id+'.json'),JSON.stringify(frame,null,2));report.frames.push(frame);
    if(spec.id==='dashboard-flow-A')await page.screenshot({path:path.join(out,variant,'dashboard-flow-full-page-3440x1440.png')});
    console.log('DASHBOARD '+variant+' '+spec.id+' canvas='+state.canvas.join('x'));
   }
   await context.close();
  }
  assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(error){report.failure=error.stack;throw error;}
 finally{fs.writeFileSync(path.join(out,'evidence/dashboard-'+phase+'.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
