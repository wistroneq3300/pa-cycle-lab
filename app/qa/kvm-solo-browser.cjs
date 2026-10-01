const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[],sockets=[];
 await context.route('**/static/vendor/novnc/core/rfb.js',route=>route.fulfill({contentType:'text/javascript',body:"export default class RFB extends EventTarget {constructor(target,url){super();(window.clients??=[]).push(this);this.url=url;this.canvas=document.createElement('canvas');this.canvas.width=1920;this.canvas.height=1080;target.append(this.canvas);const c=this.canvas.getContext('2d');c.fillStyle='#10212d';c.fillRect(0,0,1920,1080);c.fillStyle='#9bb8ca';c.font='36px monospace';c.fillText('Synthetic framebuffer / 1920 x 1080',80,100);}disconnect(){this.canvas.remove();this.dispatchEvent(new CustomEvent('disconnect',{detail:{clean:true}}));}focus(){}}"}));
 const page=await context.newPage();
 try{
  await page.goto((process.env.PA_PREVIEW_URL||'http://127.0.0.1:18769')+'/#/machine/host_a');
  await page.waitForSelector('.pd-operation');await page.evaluate(()=>applyTheme('dark'));
  const pending=page.waitForEvent('popup');await page.locator('.pd-operation').filter({hasText:'KVM'}).click();const popup=await pending;
  popup.on('pageerror',e=>errors.push(e.message));popup.on('websocket',w=>sockets.push(w.url()));
  await popup.waitForFunction(()=>window.clients?.length===1);
  assert.equal(await popup.evaluate(()=>clients[0].scaleViewport),true);
  assert.equal(await popup.evaluate(()=>typeof clients[0].connect),'undefined');
  await popup.evaluate(()=>clients[0].dispatchEvent(new CustomEvent('disconnect',{detail:{clean:false}})));
  await popup.waitForFunction(()=>clients.length===2);
  assert.equal(await popup.locator('#screen canvas').count(),1);
  await popup.evaluate(()=>clients[1].dispatchEvent(new Event('connect')));
  assert.equal(await popup.locator('#overlay').isHidden(),true);
  await page.evaluate(()=>applyTheme('light'));await popup.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await popup.locator('#stop').click();assert.equal(await popup.locator('#retry').isEnabled(),true);
  await popup.locator('#retry').click();await popup.waitForFunction(()=>clients.length===3);
  await popup.evaluate(()=>clients[2].dispatchEvent(new Event('securityfailure')));
  assert.equal(await popup.locator('#retry').isEnabled(),true);
  await popup.setViewportSize({width:320,height:700});assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  fs.mkdirSync('qa/artifacts/workspace-ux',{recursive:true});await popup.screenshot({path:'qa/artifacts/workspace-ux/kvm-mobile.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(sockets,[]);
  console.log('PASS: real detail popup, transport without connect(), new retry instance, first-frame scale setter, stop/manual retry, auth recovery UI, live theme sync, 320px, no WebSockets');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
