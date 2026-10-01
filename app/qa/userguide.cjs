/* Fixture-only user guide checks. Starts its own loopback server; no live backend. */
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const runtime=process.env.CODEX_DEPENDENCIES||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(runtime,'node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'artifacts/userguide');

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

  await page.goto(base+'/?preview=rack-network#/rack/Naboo');
  await page.locator('#guide-btn').click();
  const win=page.locator('.ug-window'), input=page.locator('.ug-search input');
  await win.waitFor();
  assert.equal(await page.locator('section.ug-sec').count(),26);
  assert.ok(await page.evaluate(()=>{
   const ids=[...document.querySelectorAll('section.ug-sec')].map(n=>n.id);
   return new Set(ids).size===ids.length && [...document.querySelectorAll('.ug-doc a')].every(a=>document.querySelector(a.getAttribute('href')));
  }));
  for(const term of ['OS Slot','2048','CDU']){
   await input.fill(term);
   assert.ok(await page.locator('section.ug-sec:visible').count()>0);
   assert.ok(await page.locator('section.ug-sec:visible').count()<26);
  }
  await input.fill('no_such_guide_term');
  assert.equal(await page.locator('section.ug-sec:visible').count(),0);
  await input.fill('');
  const hash=await page.evaluate(()=>location.hash);
  await page.locator('a[href="#ug-ping"]').click();
  assert.equal(await page.evaluate(()=>location.hash),hash);
  await page.waitForTimeout(1200);
  await win.screenshot({path:path.join(out,'desktop-ping.png')});
  for(let n=0;n<2;n++){
   await page.locator('[data-act="min"]').click();
   assert.ok((await win.boundingBox()).height<45);
   await page.locator('.ug-title').click();
   assert.ok((await win.boundingBox()).height>200);
  }
  await page.locator('[data-act="max"]').click();
  assert.ok((await win.boundingBox()).width>1500);
  await page.locator('[data-act="close"]').click();
  await page.locator('#guide-btn').click();
  await win.waitFor();
  await page.locator('[data-act="max"]').click();
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   await input.fill('');
   await page.locator('.ug-body').evaluate(n=>{n.style.scrollBehavior='auto';n.scrollTop=0;});
   await page.waitForTimeout(100);
   const bounds=await win.boundingBox();
   assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
   assert.ok(await page.locator('.ug-body').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
   await win.screenshot({path:path.join(out,'mobile-'+width+'.png')});
  }
  await page.setViewportSize({width:1600,height:1100});
  await page.locator('#theme-toggle').click();
  await win.screenshot({path:path.join(out,'desktop-light.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS: 26 sections, anchors, search, routing, repeated minimize/restore, maximize/reopen, 390/320px containment; no browser errors or external requests.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
