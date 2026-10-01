/* Real application scripts and Copilot send/render path; isolated synthetic web only. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const failures=[];
 try {
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  await page.addInitScript(()=>localStorage.setItem('pa_theme','light'));
  await page.goto((process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187')+'/#/rack');
  await page.waitForFunction(()=>typeof rackCopSend==='function');
  await page.waitForTimeout(400);
  try {assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');}
  catch(e){failures.push('F16 saved theme: '+e.message);}
  await page.evaluate(()=>{
   // Mount the production Copilot panel, without depending on rack selection.
   const host=document.createElement('section');host.id='platform-copilot';
   host.innerHTML='<div id="rackcop-box"></div><textarea id="rackcop-input"></textarea><button id="rackcop-send"></button>';
   document.querySelectorAll('#rackcop-box,#rackcop-input,#rackcop-send').forEach(e=>e.remove());
   document.body.append(host);
  });
  for(const reply of ['Normal reply: < & >\nsecond line','<img src=x onerror="window.platformXss=1"><script>window.platformXss=2</script>']){
   await page.route('**/api/copilot',r=>r.fulfill({json:{ok:true,reply}}));
   await page.locator('#rackcop-input').fill('Explain rack status');
   await page.evaluate(()=>rackCopSend());
   await page.waitForTimeout(100);
   try {
    assert.equal(await page.locator('#rackcop-box .cop-bubble.ai').last().textContent(),reply);
    assert.equal(await page.locator('#rackcop-box img,#rackcop-box script').count(),0);
    assert.equal(await page.evaluate(()=>window.platformXss),undefined);
   }catch(e){failures.push('F08 Copilot reply: '+e.message);}
   await page.unroute('**/api/copilot');
  }
  const requests=[];
  await page.route('**/api/machine/*/power',r=>{
   requests.push(r.request().postDataJSON());return r.fulfill({json:{ok:true}});
  });
  await page.evaluate(async()=>{
   machines=[{name:'control-fixture',active_os:3,os:[{slot:3,node_id:'stable-n3',
    ip:'192.0.2.3',bmc_ip:'198.51.100.3',expected_binding_revision:'revision-three'}]}];
   const opts={method:'POST',body:JSON.stringify({on:true})};
   await api('/api/machine/control-fixture/power',opts);
   await api('/api/machine/control-fixture/power',opts);
  });
  try{
   assert.equal(requests[0].node_id,'stable-n3');
   assert.equal(requests[0].expected_binding_revision,'revision-three');
   assert.equal(requests[0].idempotency_key,requests[1].idempotency_key);
   await page.evaluate(async()=>{
    const job={kind:'on',running:true,cancel:false,rows:[{name:'control-fixture',state:'waiting',target:operationTarget('control-fixture')}]};
    await executePowerBatch(job);
    job.rows[0].state='waiting';job.running=true;
    await executePowerBatch(job);
   });
   assert.equal(requests[2].idempotency_key,requests[3].idempotency_key,'Batch retry must retain the action identity');
   assert.equal(await page.evaluate(()=>{machines[0].active_os=null;return operationTarget('control-fixture').node_id}),null);
  }catch(e){failures.push('F01 request binding: '+e.message);}
  let metadata;
  await page.route('**/api/machines/control-fixture',r=>{
   metadata=r.request().postDataJSON();return r.fulfill({json:{ok:true}});
  });
  await page.evaluate(async()=>{
   machines[0].active_os=3;
   await api('/api/machines/control-fixture',{method:'PATCH',body:JSON.stringify({bmc_port:2300})});
  });
  assert.deepEqual(metadata,{bmc_port:2300,expected_node_id:'stable-n3',expected_binding_revision:'revision-three'});
  const changes=[];
  await page.route('**/api/machines/control-fixture/change-*-ip',r=>{
   changes.push(r.request().postDataJSON());return r.fulfill({json:{ok:true,changed:true,
    machine:{os:[{node_id:'stable-n3',expected_binding_revision:'revision-after-os'}]}}});
  });
  await page.evaluate(()=>{
   Object.assign(machines[0],{mgx_type:'server',os_ip:'192.0.2.3',bmc_ip:'198.51.100.3',os_port:2222,bmc_port:2200});
   changeOsIp('control-fixture');
   machines[0].active_os=null; // Dialog remains bound to the node the user reviewed.
  });
  for(const [id,value] of Object.entries({'new-os-ip-input':'192.0.2.83','new-os-user-input':'new-os',
   'new-os-pass-input':'FAKE-OS-ONLY','new-os-port-input':'2345','new-bmc-ip-input':'198.51.100.83',
   'new-bmc-user-input':'new-bmc','new-bmc-pass-input':'FAKE-BMC-ONLY','new-bmc-port-input':'2346'}))await page.locator('#'+id).fill(value);
  await page.locator('#ip-submit-btn').click();
  await page.getByRole('button',{name:'知道了',exact:true}).waitFor();
  assert.equal(changes.length,2);
  assert.equal(changes[0].expected_node_id,'stable-n3');assert.equal(changes[0].expected_binding_revision,'revision-three');
  assert.equal(changes[0].os_port,2345);assert.equal(changes[0].os_pass,'FAKE-OS-ONLY');
  assert.equal(changes[1].expected_node_id,'stable-n3');assert.equal(changes[1].expected_binding_revision,'revision-after-os');
  assert.equal(changes[1].bmc_ssh_port,2346);assert.equal(changes[1].bmc_pass,'FAKE-BMC-ONLY');
  assert.deepEqual(failures,[]);
  console.log('PASS: stored light preference; normal and hostile Copilot replies rendered as text');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
