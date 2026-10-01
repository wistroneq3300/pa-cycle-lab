/* Fixture-only CDU rendering checks. Starts its own loopback server; no live backend. */
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const runtime=process.env.CODEX_DEPENDENCIES||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(runtime,'node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'artifacts/cdu-focus');

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const server=cp.spawn(process.env.PYTHON_PATH||path.join(runtime,'python/python.exe'),['-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});
 let browser,page;
 const errors=[],external=[];
 try{
  const port=await new Promise((resolve,reject)=>{
   let output='',errorText='';
   const timeout=setTimeout(()=>reject(Error('Fixture preview startup timed out')),10000);
   server.stderr.on('data',d=>{errorText=(errorText+d).slice(-2000);});
   server.stdout.on('data',d=>{output+=d;const match=output.match(/^([0-9]+)\r?\n/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});
   server.once('error',error=>{clearTimeout(timeout);reject(error);});
   server.once('exit',code=>{clearTimeout(timeout);reject(Error(`Fixture preview exited (${code}): ${errorText}`));});
  });
  const base=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'no-preference'});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(base+'/'))external.push(request.url());});
  const ready=()=>page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
  const state=()=>page.evaluate(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState());
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const canvas=page.locator('#ew-rack-canvas');
  await page.goto(base+'/?preview=rack-network#/rack/Naboo');await ready();await settle();
  await page.locator('#ew-rack-component').selectOption('CDU-1-main');
  await page.evaluate(()=>{
   const gl=document.querySelector('#ew-rack-canvas').getContext('webgl');
   const clear=gl.clear.bind(gl),draw=gl.drawArrays.bind(gl),matrix=gl.uniformMatrix4fv.bind(gl);
   gl.clear=(...args)=>{window.__focusFrame={draws:0,matrices:[]};return clear(...args);};
   gl.drawArrays=(...args)=>{__focusFrame.draws++;return draw(...args);};
   gl.uniformMatrix4fv=(location,transpose,value)=>{__focusFrame.matrices.push(Array.from(value));return matrix(location,transpose,value);};
  });
  const transform=(m,v)=>[0,1,2,3].map(r=>m[r]*v[0]+m[r+4]*v[1]+m[r+8]*v[2]+m[r+12]*v[3]);
  async function verifyFocus(){
   const frame=await page.evaluate(()=>__focusFrame);
   assert.equal(frame.draws,1,'External CDU inspection must draw only the CDU, with no occluding rack, pipes or cables');
   const [vp,model,part]=frame.matrices;
   const center=transform(model,transform(part,[0,-.45,-1.415,1]));
   assert.ok(center.slice(0,3).every(v=>Math.abs(v)<.00001),'Orbit pivot must coincide with the external cabinet center');
   for(const x of [-3.12,3.12])for(const y of [-7.84,6.94])for(const z of [-6.38,3.55]){
    const p=transform(vp,transform(model,transform(part,[x,y,z,1])));
    assert.ok(Math.abs(p[0]/p[3])<.96&&Math.abs(p[1]/p[3])<.96,'Whole CDU must fit inside the focused canvas at every angle');
   }
  }
  for(const width of [1600,390]){
   await page.setViewportSize({width,height:width===1600?1100:900});
   await page.evaluate(()=>equipmentRackCamera('front'));
   await page.locator('.ew-focus').click();await settle();await canvas.scrollIntoViewIfNeeded();await settle();
   for(let i=0;i<4;i++){
    await verifyFocus();
    await canvas.screenshot({path:path.join(out,'focused-'+width+'-angle-'+i+'.png')});
    await canvas.focus();for(let j=0;j<6;j++)await page.keyboard.press('Shift+ArrowRight');await settle();
   }
   await page.evaluate(()=>equipmentRackCamera('front'));await settle();
   assert.ok((await page.evaluate(()=>__focusFrame.draws))>1,'Leaving inspection restores the full rack');
   assert.equal((await state()).networkCabling.routeCount,69,'Inspection must preserve saved wiring');
  }
  await page.setViewportSize({width:1600,height:1100});
  await page.locator('.ew-focus').click();await settle();
  await canvas.click();await settle();
  assert.equal((await state()).selected,'CDU-1-main','Picking the isolated CDU must not select hidden rack equipment');
  await page.locator('#ew-rack-component').selectOption('naboo-01');await settle();
  assert.ok((await page.evaluate(()=>__focusFrame.draws))>1,'Selecting rack-mounted hardware restores its rack context');
  await page.evaluate(()=>equipmentRackCamera('perspective'));await settle();
  await canvas.screenshot({path:path.join(out,'restored-rack.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const result={passed:true,checks:['External CDU only, unobstructed through four orbit quadrants','Centered pivot and unclipped bounds at 1600/390px','Picking and selection retain correct target','Full rack and 69 saved routes restored on exit'],errors,external};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
