'use strict';
// Native shipping-page check for the restored historical equipment captions.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),before=process.argv.includes('before'),record=process.argv.includes('video'),reference='1005e3033c206be9cae0d84089e9ba786af4bff0';
const out=path.join(root,'artifacts/l10-followup/callouts',before?'before':'after');fs.mkdirSync(out,{recursive:true});
const cache=new Map(),resources={},read=file=>{if(!cache.has(file)){const b=before?cp.execFileSync('git',['show',reference+':'+file],{cwd:root,maxBuffer:96*1024*1024}):fs.readFileSync(path.join(root,file));cache.set(file,b);resources[file]={sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};}return cache.get(file);};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=u.pathname==='/'?'app/static/index.html':'app'+decodeURIComponent(u.pathname);assert.ok(file.startsWith('app/static/')&&!file.includes('..'));let b=read(file);if(file.endsWith('/index.html'))b=Buffer.from(b.toString().replace('</head>','<script src="/static/js/preview-fixtures.js"></script></head>'));res.writeHead(200,{'Content-Type':({html:'text/html; charset=utf-8',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',glb:'model/gltf-binary',json:'application/json'}[file.split('.').pop()]||'application/octet-stream'),'Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404);res.end();}});
async function snapshot(page){return page.evaluate(()=>{
 const canvas=document.querySelector('#system-core'),scene=canvas.paCoreScene.getState(),svg=document.querySelector('[data-vo-callouts]'),gl=canvas.getContext('webgl'),ext=gl.getExtension('WEBGL_debug_renderer_info');
 return {progress:scene.progress,rackProgress:scene.rackProgress,timeMs:document.querySelector('#core-story').paHeroPlayback.getState().elapsedMs,scene:{insertion:scene.assembly.insertion,drawCalls:scene.drawCalls,quality:scene.quality,camera:scene.camera},overlay:svg.paHeroCallouts.getState(),text:[...svg.querySelectorAll('text')].map(t=>({text:t.textContent,opacity:getComputedStyle(t).opacity,rect:t.getBoundingClientRect().toJSON()})),display:getComputedStyle(svg).display,renderer:gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER),glError:gl.getError()};
 });}
async function seek(page,p){await page.evaluate(p=>{document.querySelector('#core-story').paHeroPlayback.seek(p);document.querySelector('#system-core').paCoreScene.resetOrbit();},p);await page.waitForFunction(p=>{const c=document.querySelector('#system-core'),s=c.paCoreScene.getState();return Math.abs(Number(c.dataset.coreProgress)-p)<.00001&&Math.abs(s.projection.progress-p)<.00001&&!s.settling&&s.quality.resolution===1;},p,{timeout:60000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,report={reference,before,resources,errors:[],captures:[]};
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  await page.goto(base+'/#/dashboard',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback,null,{timeout:120000});await page.evaluate(()=>document.querySelector('#core-story').paHeroPlayback.pause());
  for(const [width,height]of before?[[1920,1080]]:[[1366,768],[1920,1080],[3440,1440]]){
   await page.setViewportSize({width,height});for(const theme of before?['dark']:['dark','light']){
    await page.evaluate(t=>applyTheme(t),theme);await seek(page,.5);const s=await snapshot(page),file=`${width}-${theme}-identify.png`;
    await page.screenshot({path:path.join(out,file)});report.captures.push({width,height,theme,file,...s});
    console.log(`${width} ${theme}: ${s.overlay.labels.length} labels at ${(s.timeMs/1000).toFixed(3)}s / rack ${s.rackProgress.toFixed(4)}`);
    assert.equal(s.glError,0);assert.ok(!/SwiftShader|llvmpipe/i.test(s.renderer));
    if(before)assert.equal(s.overlay.visible,false);else{assert.equal(s.overlay.visible,true);assert.equal(s.overlay.labels.length,4);assert.equal(s.scene.insertion,0);assert.deepEqual(s.overlay.labels.map(l=>l.type).sort(),['nvlink','powershelf','server','switch']);}
   }
  }
  for(const p of [0,.32,.40,.48,.56,.70,1]){await seek(page,p);const s=await snapshot(page);assert.equal(s.overlay.visible,false,`No stale captions at ${p}`);}
  await context.close();
  if(record){
   const filmContext=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block',recordVideo:{dir:out,size:{width:1920,height:1080}}}),film=await filmContext.newPage();
   film.on('pageerror',e=>report.errors.push(e.message));film.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await film.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
   await film.goto(base+'/#/dashboard',{waitUntil:'domcontentloaded'});await film.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback,null,{timeout:120000});
   await film.evaluate(()=>{applyTheme('dark');window.__captionTrace=[];const c=document.querySelector('#system-core');c.addEventListener('pa-core-projection',()=>{const p=document.querySelector('#core-story').paHeroPlayback.getState(),o=document.querySelector('[data-vo-callouts]').paHeroCallouts.getState(),s=c.paCoreScene.getState();if(p.mode==='film')window.__captionTrace.push({time:p.elapsedMs,progress:p.progress,visible:o.visible,labels:o.labels.map(l=>({label:l.label,opacity:l.primaryOpacity})),insertion:s.assembly.insertion,drawCalls:s.drawCalls,flow:s.l10.flow,travel:s.l10.flowTravel});});document.querySelector('#core-story').paHeroPlayback.replay();});
   await film.waitForFunction(()=>{const p=document.querySelector('#core-story').paHeroPlayback.getState();return p.mode==='stopped'&&p.progress===1;},null,{timeout:90000});report.trace=await film.evaluate(()=>window.__captionTrace);report.final=await snapshot(film);
   const video=film.video();await filmContext.close();await video.saveAs(path.join(out,'captions-playback.webm'));
   const readable=report.trace.filter(s=>s.visible&&s.labels.length===4&&s.labels.every(l=>l.opacity>.8));report.readableMs=readable.at(-1).time-readable[0].time;assert.ok(report.readableMs>=1300,'Four captions need a readable hold within the existing bridge');assert.ok(readable.every(s=>s.insertion===0));assert.equal(report.final.timeMs,39700);
  }
  assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
