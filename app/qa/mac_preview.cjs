const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
let playwright;
try { playwright=require('playwright'); }
catch { playwright=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const {chromium}=playwright;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.PA_PREVIEW_URL || 'http://127.0.0.1:8879')+'/#/machine/host_a');
  await page.waitForSelector('.pd-mac');
  assert.equal(await page.locator('.pd-mac').count(),2);
  assert.ok((await page.locator('.pd-mac').first().innerText()).includes('\u672a\u53d6\u5f97'));
  await page.evaluate(()=>{
   const m=machines.find(m=>m.name===_activeMachine);
   machineDetailCache[_activeMachine].network_identity={os:{ip:m.os_ip,mac:'02:11:22:33:44:55'},bmc:{ip:m.bmc_ip,mac:'02:aa:bb:cc:dd:ee'}};
   setView('machine');
  });
  await page.waitForFunction(()=>document.querySelector('.pd-mac')?.textContent.includes('02:11:22:33:44:55'));
  assert.ok((await page.locator('.pd-mac').first().innerText()).includes('02:11:22:33:44:55'));
  assert.ok((await page.locator('.pd-mac').nth(1).innerText()).includes('02:aa:bb:cc:dd:ee'));
  await page.screenshot({path:'qa/artifacts/mac-display.png',fullPage:true});
  await page.evaluate(()=>{machineDetailCache[_activeMachine].network_identity.os.ip='192.0.2.254';setView('machine')});
  await page.waitForFunction(()=>document.querySelector('.pd-mac')?.textContent.includes('\u672a\u53d6\u5f97'));
  const fragment=fs.readFileSync(path.join(__dirname,'previews','rack-cabling-review.html'),'utf8');
  await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0;color-scheme:light dark}</style>'+fragment);
  for(const width of [1024,390,320]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('.pa-check').click();
   assert.equal(await page.locator('.pa-wire[data-state="reachable"]').count(),1);
   assert.equal(await page.locator('.pa-wire[data-state="unreachable"]').count(),1);
   await page.locator('.pa-wire[data-select="1"]').click();
   assert.equal(await page.locator('#pa-cable-id').innerText(),'C-002');
   await page.screenshot({path:`qa/artifacts/cabling-preview-${width}.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS MAC unknown state; cabling selection and simulated Ping at 1024/390/320px; no overflow or page errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
