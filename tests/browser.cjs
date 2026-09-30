/* Playwright acceptance against the independent SYNTHETIC localhost service. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const output=path.resolve('.impeccable/review');fs.mkdirSync(output,{recursive:true});
  await page.goto('http://127.0.0.1:9180/');
  await page.waitForFunction(()=>typeof openProjectModal==='function');
  await page.evaluate(()=>openProjectModal());
  await page.getByRole('button',{name:'Cycle Test',exact:true}).first().click();
  await page.getByRole('heading',{name:'Neutrino Demo · Cycle Test',exact:true}).waitFor();
  await page.getByRole('checkbox',{name:'選取 neutrino-n1',exact:true}).check();
  await page.getByRole('checkbox',{name:'選取 neutrino-n2',exact:true}).check();
  assert(await page.getByRole('checkbox',{name:'選取 neutrino-n0',exact:true}).isDisabled());
  await page.locator('#cycle-search').fill('n3');
  assert.equal(await page.locator('#cycle-count').innerText(),'已選 2 台');
  await page.locator('#cycle-search').fill('');
  await page.locator('#cycle-loops').fill('2');
  await page.locator('#cycle-create').click();
  await page.locator('#cycle-confirm').waitFor({state:'visible',timeout:20000});
  const id=await page.locator('#cycle-job-id').innerText();
  await page.locator('#cycle-panel').evaluate(d=>d.scrollTop=0);
  await page.screenshot({path:path.join(output,'desktop.png')});
  await page.locator('#cycle-confirm').click();
  await page.waitForFunction(()=>document.getElementById('cycle-job-state').textContent==='已完成',{},{timeout:20000});
  assert.equal(await page.locator('#cycle-progress tr').count(),2);
  await page.locator('#cycle-artifacts').click();
  await page.getByRole('link',{name:'campaign.json',exact:true}).waitFor();
  const history=page.locator('#cycle-history [data-job]');
  if(await history.count()>1){
    const other=history.nth(1);const otherId=await other.getAttribute('data-job');
    await other.click();assert.equal(await page.locator('#cycle-file-list').innerText(),'');
    await other.focus();
    await page.waitForTimeout(1700); // Exercise one periodic history refresh.
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.job),otherId);
    let release;
    const barrier=new Promise(resolve=>release=resolve);
    await page.route(`**/jobs/${otherId}/artifacts`,async route=>{await barrier;await route.fulfill({json:{files:['stale-evidence.txt']}});});
    await page.locator('#cycle-artifacts').click();
    await page.locator(`[data-job="${id}"]`).click();
    release();await page.waitForTimeout(150);
    assert.equal(await page.locator('#cycle-file-list').innerText(),'');
    await page.unroute(`**/jobs/${otherId}/artifacts`);
  }
  await page.reload();await page.waitForFunction(()=>typeof openProjectModal==='function');
  await page.evaluate(()=>openProjectModal());
  await page.getByRole('button',{name:'Cycle Test',exact:true}).first().click();
  await page.locator(`[data-job="${id}"]`).click();
  assert.equal(await page.locator('#cycle-job-state').innerText(),'已完成');
  await page.setViewportSize({width:390,height:844});
  await page.locator('#cycle-panel').evaluate(d=>d.scrollTop=0);
  // The active surface is a top-layer scrolling dialog. Capture its viewport;
  // fullPage includes off-screen bounds of the inert legacy PA dashboard.
  await page.screenshot({path:path.join(output,'mobile.png')});
  const overflow=await page.locator('#cycle-panel').evaluate(d=>d.scrollWidth>d.clientWidth+1);
  assert.equal(overflow,false,'Dialog horizontal overflow');
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.screenshot({path:path.join(output,'dark.png'),animations:'disabled'});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#cycle-panel').evaluate(d=>d.open),false);
  assert.deepEqual(errors,[]);
  fs.writeFileSync('data/browser-results.json',JSON.stringify({passed:true,job:id,screenshots:['desktop.png','mobile.png'],errors},null,2));
  console.log(JSON.stringify({passed:true,job:id,errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
