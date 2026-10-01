/* Additional regression: real orbit interaction, Wistron Light/Dark, chart palette.
 * Only local fixture UI. Run after starting serve.py, alongside acceptance.cjs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let pw;
try { pw = require('playwright'); } catch { pw = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const BASE = process.env.PA_PREVIEW_URL || 'http://127.0.0.1:8769';
const OUT = path.join(__dirname,'artifacts');
const results = [], errors = [], external = [];
let browser, page, context;
async function test(name, fn) {
  try { const details = await fn(); results.push({name,status:'passed',details}); console.log('PASS '+name); }
  catch (e) { results.push({name,status:'failed',error:e.stack}); console.error('FAIL '+name+' '+e.message); await page.screenshot({path:path.join(OUT,'failure-appearance-'+results.length+'.png')}).catch(()=>{}); }
}
async function ready(route='dashboard') {
  await page.goto(BASE+'/#/'+route); await page.reload();
  await page.waitForFunction(()=>document.body.dataset.productView && document.querySelector('#content')?.textContent.length>50);
  if (route==='dashboard') await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready');
  if (route.startsWith('machine')) await page.locator('.pd-tabs').waitFor();
  if (route.startsWith('rack')) await page.locator('.rm-rack').waitFor();
}
async function theme(value) {
  if (await page.locator('html').getAttribute('data-theme')!==value) await page.locator('#theme-toggle').click();
  await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);
}
async function frame() { await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))); }
async function sceneProgress(p) {
  await page.evaluate(p=>{const s=document.getElementById('core-story'),v=document.getElementById('core-stage');scrollTo({top:s.getBoundingClientRect().top+scrollY-76+p*(s.offsetHeight-v.offsetHeight),behavior:'instant'});},p);
  await page.waitForFunction(p=>Math.abs(parseFloat(document.querySelector('#core-stage').style.getPropertyValue('--story-progress'))-p)<.004,p);
  await frame();
}
async function shot(name) { await page.screenshot({path:path.join(OUT,name+'.png'),animations:'disabled'}); }
async function orbit() { return page.locator('#system-core').evaluate(e=>({yaw:+e.dataset.coreYaw,pitch:+e.dataset.corePitch,drag:e.dataset.coreDragging})); }
async function drag(dx,dy) {
  const r=await page.locator('#system-core').boundingBox();
  const x=Math.min(1540,r.x+r.width*.55), y=Math.min(650,r.y+r.height*.45);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:16});await page.mouse.up();await frame();
}
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(BASE))external.push(r.url());});
  await test('01 L10 pointer orbit changes pixels, retains released angle, keyboard and reset',async()=>{
    await ready();await theme('dark');const c=page.locator('#system-core');
    assert.equal(await c.getAttribute('aria-hidden'),null);assert.equal(await c.getAttribute('tabindex'),'0');
    const initial=await orbit(),before=await c.screenshot();
    await drag(210,95);const after=await orbit();assert.ok(Math.abs(after.yaw-initial.yaw)>.2);assert.ok(Math.abs(after.pitch-initial.pitch)>.1);
    assert.notDeepEqual(await c.screenshot(),before,'Orbit must change rendered geometry, not only datasets');
    await page.mouse.move(270,100);await frame();assert.deepEqual(await orbit(),after,'Released orbit must remain steady');
    await c.focus();await c.press('ArrowLeft');await frame();assert.notEqual((await orbit()).yaw,after.yaw);
    assert.deepEqual(await page.locator('#core-stage').evaluate(e=>[e.scrollLeft,e.scrollTop]),[0,0],'Keyboard focus must not scroll the composition internally');
    await c.press('Home');await page.waitForFunction(()=>{const c=document.querySelector('#system-core');return Math.abs(+c.dataset.coreYaw)<.002&&Math.abs(+c.dataset.corePitch)<.002&&!c.paCoreScene.getState().settling;});
    await page.locator('[data-core-view="rear"]').click();await page.waitForFunction(()=>Math.abs(+document.querySelector('#system-core').dataset.coreYaw)>3);
    await shot('tray-rear-dark-1600');await page.locator('[data-core-view="reset"]').click();
    await page.waitForFunction(()=>{const c=document.querySelector('#system-core');return Math.abs(+c.dataset.coreYaw)<.002&&Math.abs(+c.dataset.corePitch)<.002&&!c.paCoreScene.getState().settling;});
    await shot('tray-front-dark-1600');return after;
  });
  await test('02 Same scene scroll continuity, rack orbit and return',async()=>{
    const handle=await page.locator('#system-core').elementHandle();await drag(-160,30);await sceneProgress(.2);
    await page.waitForFunction(()=>Math.abs(+document.querySelector('#system-core').dataset.coreYaw)<.002);
    await sceneProgress(.55);await shot('tray-rack-transition-dark-1600');
    await sceneProgress(1);assert.equal(await handle.evaluate(e=>e===document.querySelector('#system-core')),true);
    const c=page.locator('#system-core');assert.equal(await c.getAttribute('data-core-compute-trays'),'18');assert.equal(await c.getAttribute('data-core-switch-trays'),'9');
    await shot('rack-front-dark-1600');await page.locator('[data-core-view="rear"]').click();await frame();await shot('rack-rear-dark-1600');
    await drag(120,-50);assert.ok(Math.abs((await orbit()).pitch)>.05);
    await sceneProgress(0);await page.waitForFunction(()=>Math.abs(+document.querySelector('#system-core').dataset.coreYaw)<.002);return {sameCanvas:true,computeTrays:18,switchTrays:9};
  });
  await test('03 Distinct persisted Pearl Light and Graphite Dark',async()=>{
    await ready();await theme('light');
    const colors=await page.evaluate(()=>({bg:getComputedStyle(document.documentElement).getPropertyValue('--p-bg').trim(),text:getComputedStyle(document.body).color,theme:localStorage.getItem('pa_theme')}));
    assert.equal(colors.theme,'light');assert.equal(colors.bg,'#edf0ef');assert.match(await page.locator('#theme-toggle').innerText(),/Light/);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    await shot('dashboard-light-1600');await sceneProgress(1);await shot('rack-stage-light-1600');
    await theme('dark');assert.match(await page.locator('#theme-toggle').innerText(),/Dark/);assert.notEqual(await page.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--p-bg').trim()),colors.bg);return colors;
  });
  await test('04 Light/Dark workspace, dialogs and 13 telemetry chart palettes',async()=>{
    await ready('machine/host_a');await theme('light');await shot('system-detail-light-1600');
    for(const tab of ['hardware','sensors','telemetry','tasks']) {await page.locator('[data-pd-tab="'+tab+'"]').click();await frame();assert.equal(await page.locator('#pd-panel-'+tab).isVisible(),true);assert.equal(await page.locator('[data-pd-tab="'+tab+'"]').getAttribute('aria-selected'),'true');}
    await page.locator('[data-pd-tab="telemetry"]').click();await page.waitForFunction(()=>Object.values(Chart.instances).filter(c=>c.canvas.isConnected).length>=13);
    const light=await page.evaluate(()=>Object.values(Chart.instances).filter(c=>c.canvas.isConnected).map(c=>({id:c.canvas.id,color:c.options.color,w:c.width,h:c.height})));
    assert.equal(light.length,13);assert.ok(light.every(c=>c.color==='#46616e'&&c.w>0&&c.h>0));await shot('telemetry-light-1600');
    await theme('dark');assert.ok(await page.evaluate(()=>Object.values(Chart.instances).filter(c=>c.canvas.isConnected).every(c=>c.options.color==='#a3b3c1')));
    await ready('rack/proj_k');await theme('light');await shot('rack-workspace-light-1600');
    await page.locator('.rm-row[data-u="6"] button[title="換位/類型"]').click();await page.locator('#rm-dialog .modal').waitFor();await shot('dialog-light-1600');return {charts:13,lightColor:'#46616e',darkColor:'#a3b3c1'};
  });
  await test('05 Both themes at 1440/1600/1920; no document overflow',async()=>{
    const checks=[];
    for(const width of [1440,1600,1920])for(const mode of ['light','dark']) {
      await page.setViewportSize({width,height:1000});
      for(const route of ['dashboard','projects/fleet_l','machine/host_a','rack/proj_k']){
        await ready(route);await theme(mode);const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.client+1,JSON.stringify({width,mode,route,...size}));checks.push({width,mode,route});
      }
    }return {checks:checks.length};
  });
  await test('06 Reduced motion retains explicit orbit but no scroll narrative',async()=>{
    await page.setViewportSize({width:1600,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await ready();
    assert.equal(await page.locator('#core-system-copy').evaluate(e=>e.inert),false);assert.equal(await page.locator('#core-rack-copy').evaluate(e=>e.inert),false);
    const initial=await orbit();await page.locator('#system-core').focus();await page.locator('#system-core').press('ArrowRight');await frame();assert.notEqual((await orbit()).yaw,initial.yaw);
    await page.mouse.wheel(0,250);await frame();assert.equal(await page.locator('#core-stage').evaluate(e=>+e.style.getPropertyValue('--story-progress')),0);await page.emulateMedia({reducedMotion:'no-preference'});
  });
  await test('07 No runtime errors or external requests',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(external,[]);return {errors,external};});
  await page.close();await browser.close();
  const report={generatedAt:new Date().toISOString(),results,errors,external};
  fs.writeFileSync(path.join(OUT,'appearance-interaction.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(OUT,'appearance-interaction.md'),'# Appearance and 3D interaction acceptance\n\n'+results.map(r=>'- '+r.status.toUpperCase()+' — '+r.name+(r.error?'\n  '+r.error.split('\n')[0]:'')).join('\n')+'\n\nLocal fixture preview only.\n');
  process.exitCode=results.some(r=>r.status==='failed')?1:0;
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
