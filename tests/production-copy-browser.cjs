/* Production render chain with browser-only data. No hardware or service writes.
 * Cycle snapshots are read from an explicitly synthetic local service; every
 * browser API request and WebSocket stays intercepted. PA_PREVIEW is not set.
 */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const output=path.resolve('docs/screenshots/production-copy');fs.mkdirSync(output,{recursive:true});
const forbidden=/Sheng Wu|Wistron team|Local environment|FastAPI|DESIGN PREVIEW|CONCEPT HARDWARE|ENGINEERED FOR COMPLEXITY|Precision\.|Every layer\.|不可變 PRE|持久化任務|reviewed findings|工程助理|待開發|尚未接入|COMPLETE 不等於 PASS|OS null/;
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const server=http.createServer((q,r)=>{r.writeHead(404);r.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`,source=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9188';
 const results=[],errors=[],network=[];
 try{
  const client=await browser.newContext();
  assert.equal((await(await client.request.get(source+'/api/cycle/capabilities')).json()).mode,'synthetic');
  const cap=await(await client.request.get(source+'/api/cycle/capabilities')).json();
  const inventory=await(await client.request.get(source+'/api/cycle/inventory')).json();
  const runs=await(await client.request.get(source+'/api/cycle/runs')).json();const last=runs.runs.find(r=>r.state==='COMPLETE');assert(last);
  const job=await(await client.request.get(source+'/api/cycle/runs/'+last.id)).json();
  const url='/api/projects/'+encodeURIComponent(job.project)+'/cycle/jobs/'+job.id;
  const events=await(await client.request.get(source+url+'/events?tail=true&limit=500')).json();
  const artifacts=await(await client.request.get(source+url+'/artifacts')).json();
  let fixture=fs.readFileSync('app/static/js/preview-fixtures.js','utf8')
   .replace("if(!path.startsWith('/api/'))","if(!path.startsWith('/api/')||path.includes('/cycle'))")
   .replace('window.PA_PREVIEW=','window.__COPY_FIXTURE=')
   .replaceAll('Design preview','2026-10-03 10:00:00').replaceAll(' · sample inventory','').replaceAll(' (sample)','');
  // Fixture values stay test data; all production modules and DOM owners are real.
  for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
   await context.addInitScript({content:`localStorage.setItem('pa_theme',${JSON.stringify(theme)});`+fixture});
   const page=await context.newPage();page.on('pageerror',e=>errors.push({theme,error:e.message}));
   let current=structuredClone(job),empty=false,unavailable=false;
   await page.route('**/*',async r=>{
    const u=new URL(r.request().url()),method=r.request().method();
    if(u.origin!==base){network.push({blocked:u.href});return r.abort();}
    if(u.pathname==='/'||u.pathname.startsWith('/static/')||u.pathname==='/fixtures/tests.json'){
     let file=u.pathname==='/'?'app/static/index.html':u.pathname==='/fixtures/tests.json'?'app/data/tests.json':'app'+decodeURIComponent(u.pathname);
     if(!fs.existsSync(file))return r.fulfill({status:404,body:''});
     return r.fulfill({body:fs.readFileSync(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream'});
    }
    network.push({method,path:u.pathname});
    if(method!=='GET')return r.fulfill({status:403,json:{detail:'Read-only browser acceptance'}});
    if(u.pathname==='/api/cycle/capabilities')return r.fulfill(unavailable?{status:503,json:{detail:'服務暫時無法使用'}}:{json:cap});
    if(u.pathname==='/api/validation/overview')return r.fulfill({json:{generated_at:1791096000,totals:{projects:2,systems:3,nodes:6,issues:{fail:0,warning:0},validation:{checked:0,pass:0,total:6},cycle:{running:0,completed:1},monitoring:{reporting:0,total:6}},projects:[{name:'proj_k',level:'L11',systems:2,nodes:5,issues:{fail:0,warning:0},validation:{checked:0,pass:0,total:5},cycle:{running:0,completed:1},monitoring:{reporting:0,total:5},last_validation:null},{name:'proj_l10',level:'L10',systems:1,nodes:1,issues:{fail:0,warning:0},validation:{checked:0,pass:0,total:1},cycle:{running:0,completed:0},monitoring:{reporting:0,total:1},last_validation:null}],issues:[],recent_runs:[]}});
    if(u.pathname==='/api/cycle/inventory')return r.fulfill(unavailable?{status:503,json:{detail:'服務暫時無法使用'}}:{json:empty?{...inventory,projects:inventory.projects.map(p=>({...p,targets:[]}))}:inventory});
    if(u.pathname==='/api/cycle/runs')return r.fulfill({json:{runs:[job],has_more:false}});
    if(u.pathname.endsWith('/events'))return r.fulfill({json:events});
    if(u.pathname.endsWith('/artifacts'))return r.fulfill({json:artifacts});
    if(u.pathname==='/api/cycle/runs/'+job.id||u.pathname===url)return r.fulfill({json:current});
    return r.fulfill({status:404,json:{detail:'No browser fixture for this endpoint'}});
   });
   async function capture(name,{wide=false}={}){
    await page.waitForTimeout(180);
    const visible=await page.evaluate(()=>document.body.innerText+'\n'+[...document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')].filter(e=>e.getClientRects().length).map(e=>['aria-label','title','placeholder','alt'].map(a=>e.getAttribute(a)||'').join(' ')).join('\n'));
    assert(!forbidden.test(visible),`${name}: ${visible.match(forbidden)?.[0]}`);
    assert.equal(await page.evaluate(()=>!!window.PA_PREVIEW),false);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme);
    await page.screenshot({path:path.join(output,`${name}-1366-${theme}.png`),animations:'disabled'});
    if(wide){await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(output,`${name}-1920-${theme}.png`),animations:'disabled'});await page.setViewportSize({width:1366,height:768});}
    results.push({page:name,theme,passed:true});
   }
   await page.goto(base+'/#/dashboard');await page.locator('.vo-overview').waitFor();await capture('dashboard',{wide:true});
   assert.equal(await page.locator('.user').innerText(),'');
   await page.evaluate(()=>productLevel('system'));await capture('projects-l10');
   await page.evaluate(()=>productLevel('rack'));await capture('projects-l11');
   await page.evaluate(()=>openMachine('host_a'));await page.locator('.pd-system-header').waitFor();await capture('system-detail',{wide:true});
   for(const tab of ['hardware','osslots','sensors','telemetry','tasks']){await page.evaluate(t=>productDetailTab(t),tab);if(tab==='tasks')await page.locator('.pd-library-card').first().waitFor();await capture('system-'+tab);}
   await page.evaluate(()=>openAssignTask('host_a'));await page.locator('.assign-sheet-grid').waitFor();await capture('test-assignment');await page.evaluate(()=>closeDialog());
   await page.evaluate(()=>openTermDialog('host_a'));await capture('terminal-dialog');await page.evaluate(()=>closeDialog());
   await page.evaluate(()=>systemBroadcastDialog('system'));await capture('broadcast-selection');await page.evaluate(()=>closeDialog());
   await page.evaluate(()=>productRack('proj_k'));await page.locator('.rack-hero').waitFor();await capture('rack-3d',{wide:true});
   assert.equal(await page.locator('[onclick*="rackBulkReboot"],[onclick*="rackBulkAux"],[onclick*="topoTodo"]').count(),0);
   for(const view of ['list','telemetry']){await page.evaluate(v=>{devicesView=v;setView('rack');},view);await capture('rack-'+view);}
   await page.evaluate(()=>rackNetworkingTopology());await page.locator('.nt-window').waitFor();await capture('rack-topology');await page.locator('.nt-window [data-action=close]').click();
   await page.evaluate(()=>openKvmBroadcast('proj_k'));await page.locator('#kvm-grid').waitFor();await capture('kvm-broadcast');await page.evaluate(()=>closeKvmBroadcast());
   await page.evaluate(()=>openMachine('CDU-01'));await page.locator('.pd-system-header').waitFor();await capture('cdu-detail');assert.equal(await page.locator('#pd-tab-telemetry').count(),0);
   await page.evaluate(()=>USER_GUIDE.open());await page.locator('.ug-body').waitFor();await capture('user-guide');
   assert(!/Naboo|Switch-2201|32 台四節點|OS 1 不能刪除/.test(await page.locator('.ug-body').innerText()));
   await page.locator('.ug-close').click();
   await page.goto(base+'/#/cycle');await page.locator('#cw-next').waitFor();await capture('cycle-history');
   await page.goto(base+'/#/cycle/new');await page.locator('.cw-node').first().waitFor();await capture('cycle-create',{wide:true});
   current.state='AWAITING_CONFIRMATION';await page.goto(base+'/#/cycle/runs/'+job.id);await page.locator('#cw-confirm').waitFor();await capture('cycle-pre');
   current.state='RUNNING';await page.reload();await page.locator('#cw-progress details').first().waitFor();await page.locator('#cw-progress details summary').first().click();await capture('cycle-progress',{wide:true});
   await page.locator('#cw-console-toggle').click();await page.locator('.cycle-console-row').first().waitFor();await capture('cycle-console');
   const firstEvent=events.events[0];
   const expectedTaipei=await page.evaluate(ts=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(ts)),firstEvent.timestamp);
   assert.equal(await page.locator('.cycle-console-time').first().innerText(),expectedTaipei);
   assert.match(await page.locator('.live-console-note').innerText(),/台灣時間（UTC\+8）/);
   await page.locator('[data-part=full]').click();assert.equal(await page.locator('[data-part=full]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-part=pause]').click();assert.equal(await page.locator('[data-part=pause]').innerText(),'繼續檢視');await page.locator('[data-part=pause]').click();
   await page.locator('.cw-artifacts>summary').click();await page.locator('#cw-evidence').click();await page.locator('#cw-files a').first().waitFor();await capture('cycle-evidence');
   empty=true;await page.goto(base+'/#/cycle/new');await page.locator('#cw-matrix').waitFor();assert.equal(await page.locator('.cw-node').count(),0);await page.locator('#cw-matrix').scrollIntoViewIfNeeded();await capture('cycle-empty');
   unavailable=true;await page.reload();await page.locator('#cw-retry').waitFor();await capture('cycle-error');
   await page.goto(base+'/static/kvm_solo.html');await page.locator('#overlay').waitFor();await capture('kvm-solo-unconfigured');
   await context.close();
  }
  assert.deepEqual(errors,[]);assert(!network.some(r=>r.method&&r.method!=='GET'));
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({baseline:'4e21a03',results,page_errors:errors,network_requests:network.length,hardware_dispatches:0,notes:'Browser-only fixture/intercepted snapshots. No hardware acceptance.'},null,2));
  console.log(`PASS ${results.length} page/theme cases; all API writes intercepted; no hardware dispatch`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
