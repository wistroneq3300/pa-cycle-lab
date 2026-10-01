const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(2000);
  await page.goto((process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187')+'/#/projects');
  await page.waitForFunction(()=>machines.length>0);
  await page.evaluate(()=>{
   const m=machines[0];m.level='system';m.os=m.os.filter(n=>n.slot===3);m.active_os=null;
   m.os_alive=null;m.os_alive_map={};m.os_ip='';m.bmc_ip='';
   machineDetailCache[m.name]={machine:m,hardware:{},os:{},fw:[],sensors:[]};
   _activeMachine=m.name;setView('machine');
  });
  const failures=[];
  for(const [label,check] of [
   ['L10 Nodes tab',async()=>assert.equal(await page.locator('#pd-tab-osslots').count(),1)],
   ['Single N3 selection',async()=>assert.equal(await page.locator('.pd-os-select-box').count(),1)],
   ['Empty ACTIVE',async()=>assert.equal(await page.locator('.pd-os-select-box').inputValue(),'')],
   ['Unknown state',async()=>{await page.locator('#pd-tab-osslots').click();assert.equal(await page.locator('.pd-os-table .pd-state-offline').count(),0);}],
  ])try{await check();}catch(e){failures.push(label+': '+e.message);}
  assert.deepEqual(failures,[]);
  const node=await page.evaluate(()=>machines[0].os[0]);
  let edit;
  await page.route('**/api/machines/*/os/3',async route=>{
    edit=route.request().postDataJSON();
    await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({detail:'Node binding changed; reload before editing'})});
  });
  await page.getByRole('button',{name:'編輯連線',exact:true}).click();
  await page.locator('.pd-node-edit input[name="label"]').fill('N3 edited');
  await page.getByRole('button',{name:'儲存連線',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.pd-node-edit [role="status"]')?.textContent.includes('binding changed'));
  assert.deepEqual(edit,{expected_node_id:node.node_id,expected_binding_revision:node.expected_binding_revision,label:'N3 edited'});
  assert.equal(await page.locator('.pd-node-edit input[name="pass"]').inputValue(),'');
  assert.equal(await page.locator('.pd-node-edit input[name="port"]').inputValue(),String(node.port));
  await page.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await page.locator('.pd-node-edit').count(),0);
  assert(await page.locator('.pd-os-table').textContent().then(t=>t.includes('空槽')));
  let planned;
  await page.route('**/api/machines/*/os',async route=>{
    planned=route.request().postDataJSON();
    await route.fulfill({status:409,json:{detail:'Synthetic planned-node conflict'}});
  });
  await page.locator('#pd-os-new-ip').fill('192.0.2.233');
  await page.locator('#pd-os-new-user').fill('planned-user');
  await page.locator('#pd-os-new-port').fill('2345');
  await page.locator('#pd-os-new-bmc-port').fill('2346');
  await page.getByRole('button',{name:'＋ 建立計畫節點',exact:true}).click();
  await page.waitForTimeout(100);
  assert.equal(planned.port,2345);assert.equal(planned.bmc_ssh_port,2346);assert.equal(planned.ipmi_port,623);
  assert.equal(await page.locator('#pd-os-new-ip').inputValue(),'192.0.2.233');
  await page.locator('#pd-tab-sensors').click();
  assert.equal(await page.locator('#pd-panel-sensors h3').textContent(),'BMC 尚未設定');
  await page.locator('#pd-tab-tasks').click();
  assert.equal(await page.locator('#pd-panel-tasks h3').first().textContent(),'選擇案例，產生測試指令。');
  assert.equal(await page.locator('#pd-panel-tasks button[onclick^="openChassisCycle"].primary').count(),0);
  let detailRoute;
  await page.route('**/api/machine/*/detail',route=>{detailRoute=route;});
  await page.evaluate(()=>{
    const m=machines[0];delete m.os;m.active_os=1;
    window.pendingStaleDetail=machineLoadDetail(m.name);
  });
  for(let i=0;!detailRoute && i<100;i++)await page.waitForTimeout(10);
  assert(detailRoute,'No detail request was made');
  await page.evaluate(()=>{machines[0].active_os=2;});
  await detailRoute.fulfill({json:{staleSentinel:true,machine:{name:'stale'}}});
  await page.evaluate(()=>window.pendingStaleDetail);
  assert.equal(await page.evaluate(()=>Boolean(machineDetailCache[machines[0].name].staleSentinel)),false);
  console.log('PASS: L10 single sparse node management, empty ACTIVE selection and unknown reachability');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
