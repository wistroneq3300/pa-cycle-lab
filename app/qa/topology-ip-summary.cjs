const cp=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),py='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';

(async()=>{
  const server=cp.spawn(py,['-u','-c',"from serve import PreviewHandler,ThreadingHTTPServer; s=ThreadingHTTPServer(('127.0.0.1',0),PreviewHandler); print(s.server_port,flush=True); s.serve_forever()"],{cwd:root,windowsHide:true});
  let browser;
  try{
    const port=await new Promise((resolve,reject)=>{server.stdout.once('data',data=>resolve(Number(data.toString().trim())));server.once('error',reject);});
    browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/#/rack/proj_k`);await page.waitForSelector('#ew-rack-add');
    await page.evaluate(()=>machines.push(
      {name:'AUTO-SLOTS',project:'proj_k',level:'rack',mgx_type:'server',os:[
        {slot:1,ip:'192.0.2.10',bmc_ip:'198.51.100.10'},
        {slot:2,ip:'192.0.2.78',bmc_ip:'198.51.100.78'},
        {slot:3,ip:'192.0.2.12',bmc_ip:'198.51.100.12'}
      ]},
      {name:'MANUAL-FALLBACK',project:'proj_k',level:'rack',mgx_type:'server'}
    ));
    const act=name=>page.locator(`.nt-overlay [data-action="${name}"]`).first().click();
    const apply=()=>page.locator('.nt-form button[type="submit"]').click();
    await page.getByRole('tablist').getByRole('button',{name:'\u7db2\u8def\u62d3\u6a38',exact:true}).click();
    await act('rack');await page.locator('#nt-name').fill('IP summary rack');await apply();
    assert.equal(await page.locator('[data-action="ping"]').innerText(),'\u6aa2\u67e5 IP');
    assert.match(await page.locator('.nt-ping-summary').innerText(),/\u5c1a\u672a\u6aa2\u67e5 IP/);
    assert.equal(await page.locator('#nt-filter option[value="power"]').innerText(),'\u96fb\u529b\u8a2d\u5099\u7ba1\u7406');
    assert.equal(await page.locator('#nt-filter option[value="cooling"]').innerText(),'\u51b7\u537b\u8a2d\u5099\u7ba1\u7406');

    await act('import');
    await page.locator('input[name="inventory"][value="AUTO-SLOTS"]').check();
    await page.locator('input[name="inventory"][value="MANUAL-FALLBACK"]').check();
    await page.locator('#nt-nodes').fill('2');await apply();
    const autoCard=page.locator('.nt-device').filter({hasText:'AUTO-SLOTS'}),fallbackCard=page.locator('.nt-device').filter({hasText:'MANUAL-FALLBACK'});
    await autoCard.locator('[data-action="focus"]').click();
    assert.equal(await page.locator('.nt-node').count(),3);
    assert.match(await page.locator('.nt-node').nth(1).innerText(),/192\.0\.2\.78[\s\S]*198\.51\.100\.78/);
    await fallbackCard.locator('[data-action="focus"]').click();
    assert.equal(await page.locator('.nt-node').count(),2);

    await act('device');await page.locator('#nt-name').fill('POWER-SHELF');await page.locator('#nt-kind').selectOption('other');await apply();
    await act('save');await page.waitForFunction(()=>document.querySelector('.nt-save-state')?.textContent.includes('\u7248\u672c 1'));
    const ids=await page.evaluate(async()=>{const doc=await api('/api/projects/proj_k/topology'),rack=doc.racks[0];const server=rack.devices.find(device=>device.name==='AUTO-SLOTS'),power=rack.devices.find(device=>device.name==='POWER-SHELF');return {server:server.id,nodes:server.nodes.map(node=>node.id),power:power.id};});
    await page.evaluate(ids=>{
      const nativeFetch=window.fetch;window.__pingMode='failed';
      window.fetch=async (input,options={})=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.pathname.endsWith('/topology/ping')&&(options.method||'GET').toUpperCase()==='POST'){
          const all=[
            {device_id:ids.server,node_id:ids.nodes[0],field:'host_os',ip:'192.0.2.10',alive:true},
            {device_id:ids.server,node_id:ids.nodes[1],field:'host_os',ip:'192.0.2.78',alive:window.__pingMode==='success'},
            {device_id:ids.server,node_id:ids.nodes[2],field:'host_os',ip:'192.0.2.12',alive:true},
            {device_id:ids.power,node_id:'',field:'primary_ip',ip:'198.51.100.9',alive:window.__pingMode==='success'}
          ];
          const targets=window.__pingMode==='empty'?[]:all,alive=targets.filter(target=>target.alive).length;
          return new Response(JSON.stringify({ok:true,rack_id:'rack',duration_ms:12,targets,summary:{configured:targets.length,unique_ips:targets.length,alive,down:targets.length-alive}}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return nativeFetch(input,options);
      };
    },ids);

    await act('ping');await page.waitForFunction(()=>document.querySelectorAll('.nt-ping-failures li').length===2);
    const failures=await page.locator('.nt-ping-summary').innerText();
    assert.match(failures,/2 \u500b IP \u7121\u56de\u61c9/);assert.match(failures,/AUTO-SLOTS[\s\S]*\u7bc0\u9ede 2[\s\S]*192\.0\.2\.78/);assert.match(failures,/POWER-SHELF[\s\S]*\u4e3b\u8981 IP[\s\S]*198\.51\.100\.9/);
    await autoCard.locator('[data-action="focus"]').click();
    assert.match(await page.locator('.nt-node').nth(1).innerText(),/192\.0\.2\.78[\s\S]*\u7121\u56de\u61c9/);
    await page.evaluate(()=>window.__pingMode='success');await act('ping');await page.waitForFunction(()=>document.querySelector('.nt-ping-summary')?.textContent.includes('\u5168\u90e8 4 \u500b IP \u7686\u53ef\u9054'));
    assert.equal(await page.locator('.nt-ping-failures').count(),0);
    await page.evaluate(()=>window.__pingMode='empty');await act('ping');await page.waitForFunction(()=>document.querySelector('.nt-ping-summary')?.textContent.includes('\u6c92\u6709\u53ef\u6aa2\u67e5\u7684 IP'));
    assert.deepEqual(errors,[]);
    console.log('PASS topology IP summary: OS-slot inference with IP import/manual fallback, power/cooling roles, failed server node and primary-device details, success and empty states.');
  }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
