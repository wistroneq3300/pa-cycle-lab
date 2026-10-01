/* End-to-end UI changes using synthetic fixtures, never real equipment. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const BASE=process.env.PA_PREVIEW_URL||'http://127.0.0.1:18769',out='qa/artifacts/workspace-ux';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],results=[];
 page.on('pageerror',e=>errors.push(e.message));
 async function go(route){if(page.url().startsWith(BASE))await page.evaluate(()=>sessionStorage.clear());const response=await page.goto(BASE+'/#/'+route);if(!response)await page.reload();await page.waitForFunction(()=>!!window.uxRackSpecification&&document.querySelector('#content')?.textContent.length>60);await page.waitForTimeout(250);}
 const call=(url,body)=>page.evaluate(async({url,body})=>{const r=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},{url,body});
 try{
  await go('machine/host_a');
  const l10Spec=page.getByRole('button',{name:/\u5347\u7d1a\u81f3 L11/});
  assert.equal(await l10Spec.count(),1);assert.ok(await l10Spec.evaluate(el=>el.closest('.pd-operation-group')!==null));
  await l10Spec.click();await page.waitForSelector('#ux-spec-size');await page.keyboard.press('Escape');
  results.push('L10 detail uses the shared operation deck and exposes L11 promotion in place');

  await go('projects/fleet_l');
  const listPromote=page.locator('button[onclick*="rackPromote"]').filter({hasText:'\u5347 L11'}).first();
  assert.equal(await listPromote.isVisible(),true);assert.equal(await listPromote.evaluate(el=>el.closest('.p-row-menu')===null),true);
  await page.evaluate(()=>rackPromote('host_a'));
  await page.locator('#ux-spec-size').selectOption('4');
  await page.locator('#ux-spec-project').selectOption('proj_k');
  await page.locator('#rm-dialog-foot .primary').click();
  await page.waitForFunction(()=>machines.find(m=>m.name==='host_a')?.level==='rack');
  const promoted=await page.evaluate(()=>{const m=machines.find(m=>m.name==='host_a');return {size:m.rack_size,u:m.rack_u,project:m.project,ip:m.os_ip};});
  assert.deepEqual(promoted,{size:4,u:0,project:'proj_k',ip:'192.0.2.21'});
  await page.evaluate(()=>openMachine('host_a'));await page.waitForSelector('.pd-level-pill');
  assert.equal(await page.locator('.pd-level-pill').innerText(),'L11');
  const l11Spec=page.getByRole('button',{name:/\u4fee\u6b63\u8a2d\u5099\u9ad8\u5ea6/});
  assert.equal(await l11Spec.count(),1);assert.ok(await l11Spec.evaluate(el=>el.closest('.pd-operation-group')!==null));
  await page.evaluate(()=>uxRackSpecification('host_a'));await page.locator('#ux-spec-size').selectOption('8');
  await page.locator('#rm-dialog-foot .primary').click();await page.waitForFunction(()=>machines.find(m=>m.name==='host_a').rack_size===8);
  results.push('L10 to L11: explicit project and 4U; unplaced; IP preserved; pending correction to 8U');
  await go('rack/proj_k');
  await page.evaluate(()=>uxRackSpecification('SERVER-04U'));await page.locator('#ux-spec-size').selectOption('8');
  assert.equal(await page.locator('#rm-dialog-foot .primary').isDisabled(),true);
  await page.screenshot({path:out+'/height-conflict.png'});
  await page.locator('#ux-spec-size').selectOption('3');assert.equal(await page.locator('#rm-dialog-foot .primary').isEnabled(),true);
  await page.locator('#rm-dialog-foot .primary').click();await page.waitForFunction(()=>machines.find(m=>m.name==='SERVER-04U').rack_size===3);
  const stale=await call('/api/machines/SERVER-04U/rack-specification',{rack_size:4,project:'proj_k',expected_level:'rack',expected_project:'proj_k',expected_size:4,expected_u:40});assert.equal(stale.status,409);
  results.push('Placed height correction: overlap disabled, valid shrink saved, stale snapshot rejected');

  await go('projects/fleet_l');
  await page.locator('.p-search input').fill('host_');await page.locator('.eng-list-tools select').selectOption('os-offline');
  const expectedRows=await page.locator('#proj-sort-list tbody tr:visible .mach-link b').allTextContents();
  await page.locator('.mach-link').filter({hasText:'host_b'}).click();await page.waitForSelector('[data-pd-tab]');
  await page.goBack();await page.waitForSelector('.p-search input');
  assert.equal(await page.locator('.p-search input').inputValue(),'host_');
  assert.equal(await page.locator('.eng-list-tools select').inputValue(),'os-offline');
  assert.deepEqual(await page.locator('#proj-sort-list tbody tr:visible .mach-link b').allTextContents(),expectedRows);
  await page.goForward();await page.waitForSelector('[data-pd-tab]');assert.match(page.url(),/machine\/host_b$/);
  results.push('Back/Forward restore project search and status filter');

  await page.evaluate(()=>openAssignTask('host_b'));await page.waitForSelector('.assign-sheet-card');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#rm-dialog').isHidden(),true);
  await page.evaluate(()=>{void machinePower('host_b',false);});await page.waitForSelector('.ux-confirm-copy');
  assert.match(await page.locator('.ux-confirm-copy').innerText(),/host_b/);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#rm-dialog').isHidden(),true);
  results.push('Ordinary dialog Escape and power confirmation cancellation');
  await page.evaluate(()=>openAssignTask('host_b'));await page.locator('.assign-sheet-card').first().click();await page.locator('.eng-case-row input').first().check();
  const code=await page.locator('.eng-case-row input').first().getAttribute('aria-label');
  await page.locator('#assign-q').fill('no-such-case');assert.equal(await page.evaluate(()=>_assignTask.sel.size),1);
  await page.locator('#assign-q').fill('');assert.equal(await page.locator('.eng-case-row input').first().isChecked(),true);
  await page.locator('#rm-dialog-foot .primary').click();await page.waitForSelector('.ux-chosen');assert.ok((await page.locator('.ux-chosen').innerText()).includes(code));
  await page.screenshot({path:out+'/task-review.png'});await page.keyboard.press('Escape');
  results.push('Task selections survive search; explicit target/case review before generation');

  await page.locator('[data-pd-tab="telemetry"]').click();await page.waitForSelector('#ux-telemetry-tools');
  assert.match(await page.locator('#tel-cpu').locator('..').locator('.eng-chart-readout').innerText(),/%/);
  await page.locator('#ux-telemetry-tools select').selectOption('common');assert.equal(await page.locator('#tel-grid .chart-box:not([hidden])').count(),6);
  await page.locator('#ux-telemetry-tools select').selectOption('all');assert.equal(await page.locator('#tel-grid .chart-box:not([hidden])').count(),13);
  assert.match(await page.locator('#tel-cpu').locator('..').locator('.ux-chart-time').innerText(),/\d/);
  await page.screenshot({path:out+'/telemetry.png'});results.push('Telemetry units, sample timestamps, common/all views');

  for(const theme of ['dark','light'])for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    for(const route of ['dashboard','projects/fleet_l','rack/proj_k','machine/host_a','machine/CDU-01']){
      await go(route);await page.evaluate(t=>applyTheme(t),theme);await page.waitForTimeout(150);
      const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
      assert.ok(bounds.scroll<=bounds.width+1,JSON.stringify({route,theme,...bounds}));
      if((width===1440||width===390)&&!route.includes('CDU'))await page.screenshot({path:out+'/'+route.replaceAll('/','-')+'-'+theme+'-'+width+'.png'});
    }
  }
  results.push('5 routes x 4 widths x 2 themes without horizontal document overflow');
  await go('dashboard');await page.locator('.ux-story-toggle').click();assert.equal(await page.locator('#core-story').isHidden(),true);await page.locator('.ux-story-toggle').click();
  assert.equal(await page.locator('#core-story').isVisible(),true);results.push('3D story collapse/restore');
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
