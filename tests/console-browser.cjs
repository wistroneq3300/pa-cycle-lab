/* Browser acceptance for persistent events plus a labelled bounded-load fixture. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
module.exports=async(page,id,output)=>{
  const firstNode=await page.locator('[data-part=nodes] button').nth(1).getAttribute('data-machine');
  const toggle=page.locator('#cw-console-toggle'),log=page.locator('[data-part=log]');
  const requests=[];page.on('request',r=>{if(r.url().includes(`/jobs/${id}/events`))requests.push(r);});
  await toggle.click();
  await page.waitForFunction(()=>document.querySelector('[data-part=log]').textContent.includes('Job COMPLETE'));
  const restored=await page.locator('.cycle-console-row').count();assert(restored>20,'Refresh restores persistent history');
  await page.locator('[data-part=pause]').click();
  const before=requests.length;
  await page.locator(`[data-machine="${firstNode}"][aria-pressed]`).click();
  assert(await page.locator('.cycle-console-row').count()>0);
  assert.equal(await page.locator(`.cycle-console-row:not([data-machine="${firstNode}"])`).count(),0);
  await page.locator('[data-part=search]').fill('identity');await page.waitForTimeout(180);
  assert(await page.locator('.cycle-console-row').count()>0);
  assert.equal(requests.length,before,'Local filters do not fetch');
  await page.locator('[data-part=search]').fill('');await page.waitForTimeout(180);
  await page.locator('[data-part=nodes] button').first().click();
  assert.equal(await page.locator('.cycle-console-row').count(),restored);
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.locator('[data-part=copy]').click();
  assert((await page.evaluate(()=>navigator.clipboard.readText())).includes('Job COMPLETE'));
  const downloadEvent=page.waitForEvent('download');await page.locator('[data-part=download]').click();
  const download=await downloadEvent;const content=fs.readFileSync(await download.path(),'utf8');
  assert(content.includes('SYNTHETIC: no hardware operated'));assert(content.includes('Job COMPLETE'));
  await page.locator('[data-part=history]').click();
  await page.waitForFunction(()=>document.querySelector('[data-part=status]').textContent.includes('歷史視窗'));
  assert(await page.locator('.cycle-console-row').count()>0);
  await page.locator('[data-part=live]').click();await page.locator('[data-part=pause]').click();
  await toggle.click();const closedRequests=requests.length;await page.waitForTimeout(1700);
  assert.equal(requests.length,closedRequests,'Closed console stops only console polling');
  assert((await page.locator('#cw-run-title').innerText()).includes('COMPLETE'));

  // 10,500 synthetic API events. No worker, command, or hardware is involved.
  const pattern=`**/jobs/${id}/events?*`;let sent=0,streamEnd=10500;const cursors=[];
  const levels=['INFO','CMD','WAIT','PASS','WARN','FAIL','ERROR','PRE','POST'];
  await page.route(pattern,async route=>{
    const u=new URL(route.request().url()),before=Number(u.searchParams.get('before') || 0),after=before?Math.max(0,before-501):Number(u.searchParams.get('after') || 0);cursors.push(after);
    const events=Array.from({length:Math.min(500,streamEnd-after)},(_,i)=>{
      const n=after+i+1;return {sequence:n,timestamp:'2026-10-01T02:31:05.000+00:00',job_id:id,run_id:'fixture',machine_id:n%2?'neutrino-n1':'neutrino-n2',tray:'t1',node:n%2?'n1':'n2',loop:12,phase:'POST',level:levels[n%levels.length],event_type:'FIXTURE',message:n===10500?'<img src=x onerror="window.consoleXSS=true">':`SYNTHETIC console load fixture ${n}`,detail:'Read-only rendering fixture; no hardware operated'};
    });sent+=events.length;await route.fulfill({json:{events,has_more:after+events.length<streamEnd,next_sequence:after+events.length,oldest_sequence:after+1}});
  });
  // Re-select a job through a fresh dialog to discard the previous view cursor.
  await page.reload();await page.locator('#cw-run-id').waitFor();await toggle.click();
  await page.waitForFunction(()=>document.querySelector('.cycle-console-row[data-sequence="10500"]'),{},{timeout:20000});
  await page.locator('[data-part=pause]').click();
  assert.equal(await log.getAttribute('data-buffer-count'),'3000');assert.equal(await page.locator('.cycle-console-row').count(),2000);
  assert.equal(await log.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.consoleXSS),undefined);
  assert(cursors.some(n=>n>0));assert(cursors.every((n,i)=>!i||n>=cursors[i-1]));
  await page.locator('[data-part=older]').click();
  await page.waitForFunction(()=>document.querySelector('.cycle-console-row[data-sequence="8500"]'));
  assert.equal(await page.locator('.cycle-console-row').first().getAttribute('data-sequence'),'8001','Older history starts immediately before the rendered window, without skipping buffered rows');
  await page.locator('[data-part=live]').click();
  await page.locator('[data-part=errors]').check();
  assert(await page.locator('.cycle-console-row').count()>0);
  assert.equal(await page.locator('.cycle-console-row:not([data-level=FAIL]):not([data-level=ERROR])').count(),0);
  await page.locator('[data-part=errors]').uncheck();
  if(await page.locator('[data-part=auto]').getAttribute('aria-pressed')==='true')await page.locator('[data-part=auto]').click();assert.equal(await page.locator('[data-part=auto]').getAttribute('aria-pressed'),'false');
  // Anchor to a retained event, independent of typography and row height.
  await log.evaluate(e=>{const row=e.querySelector('[data-sequence="9500"]');e.scrollTop+=row.getBoundingClientRect().top-e.getBoundingClientRect().top-e.clientTop;});
  const anchor=await log.evaluate(e=>{const row=[...e.children].find(r=>r.getBoundingClientRect().bottom>e.getBoundingClientRect().top+e.clientTop);return {sequence:row.dataset.sequence,top:row.getBoundingClientRect().top-e.getBoundingClientRect().top};});
  streamEnd=11000;await page.locator('[data-part=pause]').click();
  await page.waitForFunction(()=>document.querySelector('.cycle-console-row[data-sequence="11000"]'));
  await page.locator('[data-part=pause]').click();
  const top=await page.locator(`[data-sequence="${anchor.sequence}"]`).evaluate(e=>e.getBoundingClientRect().top-e.parentElement.getBoundingClientRect().top);
  assert(Math.abs(top-anchor.top)<2,'Active polling preserves the visible event anchor with Auto Scroll OFF');
  await log.evaluate(e=>e.scrollTop=0);streamEnd=11500;await page.locator('[data-part=pause]').click();
  await page.waitForFunction(()=>document.querySelector('.cycle-console-row[data-sequence="11500"]'));
  await page.locator('[data-part=pause]').click();
  assert((await page.locator('[data-part=status]').innerText()).includes('Earlier history'),'Evicted anchor has a history recovery notice');
  assert.equal(await page.locator('.cycle-console-row').count(),2000);
  await log.evaluate(e=>e.scrollTop=0);
  const contrast=async()=>page.evaluate(()=>{
    const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(n=>{n=Number(n)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
    const bg=lum(getComputedStyle(document.querySelector('.cycle-console')).backgroundColor);
    const levels=[...new Set([...document.querySelectorAll('.cycle-console-row')].map(e=>e.dataset.level))].map(level=>{const fg=lum(getComputedStyle(document.querySelector(`[data-level="${level}"] .cycle-console-level`)).color);return {level,ratio:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};});
    const placeholder=lum(getComputedStyle(document.querySelector('[data-part=search]'),'::placeholder').color);
    levels.push({level:'search placeholder',ratio:(Math.max(placeholder,bg)+.05)/(Math.min(placeholder,bg)+.05)});return levels;
  });
  const ratios={};
  for(const theme of ['light','dark']){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);ratios[theme]=await contrast();
    for(const value of ratios[theme])assert(value.ratio>=4.5,`${theme} ${value.level} contrast ${value.ratio}`);
    for(const [name,width,height] of [['desktop',1366,768],['wide',1920,1080]]){
      await page.setViewportSize({width,height});
      await page.locator('#cw-console').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#cycle-workspace').evaluate(d=>d.scrollWidth>d.clientWidth+1),false);
      await page.screenshot({path:path.join(output,`console-${name}-${theme}.png`),animations:'disabled'});
    }
  }
  await page.unroute(pattern);
  // An aborted late response must not repopulate a closed panel or advance its cursor.
  let release,started;
  const barrier=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>started=resolve);
  await page.route(pattern,async route=>{started();await barrier;await route.fulfill({json:{events:[{sequence:999999,level:'ERROR',message:'STALE CONSOLE RESPONSE'}],has_more:false}});},{times:1});
  await page.locator('[data-part=pause]').click();await pending;await toggle.click();release();await page.waitForTimeout(150);
  assert.equal(await page.locator('#cw-console').isHidden(),true);
  assert.equal(await page.locator('.cycle-console-row[data-sequence="999999"]').count(),0);
  // Reconnect against real persisted events after one failed read, without any POST.
  await page.reload();await page.locator('#cw-run-id').waitFor();
  await page.route(pattern,route=>route.abort('failed'),{times:1});await toggle.click();
  await page.locator('[data-part=error]').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('[data-part=log]').textContent.includes('Job COMPLETE'));
  assert.equal(await page.locator('[data-part=error]').isHidden(),true);
  const evidence=page.locator('.cycle-console-message a').first();assert(await evidence.count());
  assert.equal((await page.request.get(new URL(await evidence.getAttribute('href'),page.url()).href)).status(),200);
  assert(requests.every(r=>r.method()==='GET'),'Console never sends control commands');
  fs.writeFileSync('data/console-browser-results.json',JSON.stringify({passed:true,restoredEvents:restored,fixtureEvents:sent,buffer:3000,rendered:2000,ratios,checks:25},null,2));
};
