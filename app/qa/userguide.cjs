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
  let guideRequests=0;
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
   await page.route('**/static/userguide_template.html*',async route=>{
    guideRequests++;
    if(guideRequests===1)return route.fulfill({status:503,contentType:'text/plain',body:'temporary guide fixture failure'});
    return route.continue();
   });

  await page.goto(base+'/?preview=rack-network#/rack/Naboo');
  await page.locator('#guide-btn').click();
  const win=page.locator('.ug-window'), input=page.locator('.ug-search input');
  await win.waitFor();
   const loadError=page.locator('.ug-load-state[role="alert"]');
   await loadError.waitFor();
   assert.equal(await page.evaluate(()=>window.__ugTpl),undefined);
   assert.equal(guideRequests,1);
   await loadError.locator('[data-ug-retry]').click();
   await page.locator('section.ug-sec').first().waitFor();
   assert.equal(await page.locator('section.ug-sec').count(),28);
   assert.equal(guideRequests,2);
   assert.equal(await page.evaluate(()=>document.activeElement?.matches('.ug-search input')),true);
  assert.ok(await page.evaluate(()=>{
   const ids=[...document.querySelectorAll('section.ug-sec')].map(n=>n.id);
    const required=['ug-tasks','ug-cycle','ug-telemetry','ug-inspection','ug-reports'];
    return required.every(id=>ids.includes(id))&&new Set(ids).size===ids.length&&[...document.querySelectorAll('.ug-doc a[href^="#ug-"]')].every(a=>document.querySelector(a.getAttribute('href')));
  }));
   const guideText=await page.locator('.ug-body').innerText();
   for(const term of ['交給 PA Agent','產生批次指令 (N)','OK','GO','等待工程師判定','Node Exporter','DCGM Exporter','停止：不再派送新動作','Recovery','下載完整證據','下載完整紀錄'])assert.ok(guideText.includes(term),term+' guide contract missing');
   for(const stale of ['不是模擬','會在真實設備執行'])assert.equal(guideText.includes(stale),false,stale+' stale claim remains');
   for(const term of ['OS Slot','PA Agent','PRE','DCGM Exporter','Evidence']){
   await input.fill(term);
   assert.ok(await page.locator('section.ug-sec:visible').count()>0);
    assert.ok(await page.locator('section.ug-sec:visible').count()<28);
  }
  await input.fill('no_such_guide_term');
  assert.equal(await page.locator('section.ug-sec:visible').count(),0);
  await input.fill('');
  const hash=await page.evaluate(()=>location.hash);
  await page.locator('a[href="#ug-ping"]').click();
  assert.equal(await page.evaluate(()=>location.hash),hash);
  await page.waitForTimeout(1200);
  await win.screenshot({path:path.join(out,'desktop-ping.png')});
   const minButton=page.locator('[data-act="min"]');
   await minButton.focus();await page.keyboard.press('Enter');
   assert.equal(await minButton.getAttribute('aria-expanded'),'false');
   assert.ok((await win.boundingBox()).height<45);
   await page.keyboard.press('Enter');
   assert.equal(await minButton.getAttribute('aria-expanded'),'true');
   assert.ok((await win.boundingBox()).height>200);
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
   assert.equal(guideRequests,2,'successful template should be reused on reopen');
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

   // Closing and reloading must not let the persisted `closed` flag make the
   // toolbar button look broken. Oversized saved coordinates are clamped too.
   await page.locator('[data-act="close"]').click();
   await page.evaluate(()=>localStorage.setItem('ug-state',JSON.stringify({x:'1500px',y:'900px',w:'640px',h:'690px',min:false,max:false,closed:true})));
   await page.setViewportSize({width:800,height:700});
   await page.reload();
   await page.locator('#guide-btn').click();
   await page.locator('section.ug-sec').first().waitFor();
   const restored=await page.locator('.ug-window').boundingBox();
   assert.ok(restored.x>=0&&restored.y>=0&&restored.x+restored.width<=800&&restored.y+restored.height<=700);
   assert.equal(guideRequests,3);

   // Escape closes the guide and returns focus to its opener.
   assert.equal(await page.evaluate(()=>document.activeElement?.matches('.ug-search input')),true);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('.ug-window').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'guide-btn');

   // The global `?` shortcut must not steal input from editable or remote-control surfaces.
   await page.evaluate(()=>{const editable=document.createElement('div');editable.id='ug-editable-fixture';editable.contentEditable='true';editable.tabIndex=0;document.body.append(editable);editable.focus();});
   await page.keyboard.press('?');
   assert.equal(await page.locator('.ug-window').isVisible(),false);
   await page.evaluate(()=>{document.getElementById('ug-editable-fixture')?.remove();const modal=document.getElementById('term-modal');modal.style.display='flex';document.getElementById('term-max-btn').focus();});
   await page.keyboard.press('?');
   assert.equal(await page.locator('.ug-window').isVisible(),false);
   await page.evaluate(()=>{document.getElementById('term-modal').style.display='none';const overlay=document.createElement('div');overlay.id='kvm-overlay';overlay.tabIndex=0;overlay.textContent='KVM keyboard fixture';document.body.append(overlay);overlay.focus();});
   await page.keyboard.press('?');
   assert.equal(await page.locator('.ug-window').isVisible(),false);
   await page.evaluate(()=>{document.getElementById('kvm-overlay')?.remove();document.getElementById('guide-btn').focus();});
   await page.keyboard.press('?');
   await page.locator('.ug-window').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>document.activeElement?.matches('.ug-search input')),true);
   const expected503=errors.filter(message=>message.includes('503'));
   assert.equal(expected503.length,1,'the forced first guide request should be the only 503');
   assert.deepEqual(errors.filter(message=>!message.includes('503')),[]);assert.deepEqual(external,[]);
   console.log('PASS: 28 workflow sections, anchors/search, transient 503 retry/cache lifecycle, focus/Escape restore, editable/Terminal/KVM shortcut guards, repeated minimize/maximize/reopen, persisted close recovery, and desktop/mobile containment; no unexpected browser errors or external requests.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
