/* UI contract comparison against 1a51f2a. All mutations intercepted: no worker dispatch. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const base=process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9188';
const baseline='1a51f2a4e4b00bc68890e3e6343abae69609100a';
const old=file=>cp.execFileSync('git',['show',`${baseline}:${file}`],{encoding:'utf8',maxBuffer:5000000});
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 try{
  const request=await b.newPage();assert.equal((await(await request.request.get(base+'/api/cycle/capabilities')).json()).mode,'synthetic');
  const runs=await(await request.request.get(base+'/api/cycle/runs')).json();const completed=runs.runs.find(r=>r.state==='COMPLETE');assert(completed);
  const job=await(await request.request.get(base+'/api/cycle/runs/'+completed.id)).json();
  const inventory=await(await request.request.get(base+'/api/cycle/inventory')).json();
  const traces=[];const out='docs/screenshots/live-branch-ui';fs.mkdirSync(out,{recursive:true});
  for(const version of ['baseline','current']){
   const p=await b.newPage({viewport:{width:1366,height:768}}),trace=[],errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   let current=structuredClone(job);current.state='AWAITING_CONFIRMATION';
   await p.route('**/*',async r=>{
    const u=new URL(r.request().url()),method=r.request().method();
    if(u.origin!==base)return r.abort();
    if(u.pathname==='/'||u.pathname.startsWith('/static/')){
     const file=u.pathname==='/'?'app/static/index.html':'app'+decodeURIComponent(u.pathname);
     if(!fs.existsSync(file))return r.continue();
     const ext=path.extname(file),type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[ext]||'application/octet-stream';
     const body=version==='baseline'&&['app/static/js/cycle-workspace.js','app/static/css/cycle-workspace.css'].includes(file)?old(file):fs.readFileSync(file);
     return r.fulfill({body,contentType:type});
    }
    if(method!=='GET'){
     const body=r.request().postDataJSON();if(body?.idempotency_key){assert(body.idempotency_key);body.idempotency_key='<generated>';}
     trace.push({method,path:u.pathname,body});
     if(u.pathname.endsWith('/confirm'))current.state='RUNNING';
     if(u.pathname.endsWith('/stop')){current.state='STOP_REQUESTED';current.stop_requested=true;}
     return r.fulfill({json:current});
    }
    if(u.pathname==='/api/cycle/inventory')return r.fulfill({json:inventory});
    if(u.pathname==='/api/cycle/runs')return r.fulfill({json:{runs:[job],has_more:false}});
    if(u.pathname==='/api/cycle/runs/'+job.id||u.pathname.endsWith('/cycle/jobs/'+job.id))return r.fulfill({json:current});
    return r.continue();
   });
   await p.goto(base+'/#/cycle/new');await p.locator('.cw-node').first().waitFor();
   assert.equal(await p.locator('#cw-profile').getAttribute('type'),'hidden');assert.equal(await p.locator('#cw-parallel').count(),0);
   assert.equal(await p.locator('#cw-limit-kind').inputValue(),'');assert.equal(await p.locator('#cw-limit-value').inputValue(),'');
   await p.locator('#cw-search').fill('chassis-01');await p.locator('.cw-node input').nth(2).check();
   await p.locator('#cw-create').click();assert.equal(trace.length,0,'Unspecified limits must not create');
   await p.locator('#cw-limit-kind').selectOption('loops');await p.locator('#cw-limit-value').fill('2.5');await p.locator('#cw-create').click();assert.equal(trace.length,0);
   await p.locator('#cw-limit-value').fill('2');await p.locator('#cw-search').fill('no-result');await p.locator('#cw-search').fill('chassis-01');assert.equal(await p.locator('.cw-node input:checked').count(),1);
   if(version==='current'){
    await p.reload();await p.locator('.cw-node').first().waitFor();await p.locator('#cw-search').fill('chassis-01');await p.locator('.cw-node input').nth(2).check();await p.locator('#cw-limit-kind').selectOption('loops');await p.locator('#cw-limit-value').fill('2');
    assert.match(await p.locator('#cw-review-selection').textContent(),/1 nodes/);
    for(const width of [1366,1920])for(const theme of ['light','dark']){
     await p.setViewportSize({width,height:width===1366?768:1080});await p.evaluate(t=>applyTheme(t),theme);
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(100);
     await p.screenshot({path:`${out}/create-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
    }
   }
   await p.locator('#cw-create').click();await p.locator('#cw-confirm').waitFor({state:'visible'});
   await p.locator('#cw-confirm').click();await p.locator('#cw-console-toggle').click();await p.locator('[data-part=density]').waitFor();
   assert.equal(await p.locator('[data-part=density]').innerText(),'Summary');await p.locator('[data-part=density]').click();assert.equal(await p.locator('[data-part=density]').innerText(),'Full');
   if(version==='current'){
    const details=p.locator('#cw-progress details').first();await details.locator('summary').click();await details.locator('summary').focus();
    const identity=await details.getAttribute('data-node');await p.waitForTimeout(1800);
    assert.equal(await details.getAttribute('open'),'');assert.equal(await p.evaluate(()=>document.activeElement.parentElement.dataset.node),identity);
    const n=job.nodes.find(n=>n.machine_id===identity);
    const values=await details.locator('dd').allTextContents();assert.equal(values[0],String(n.attempts||0));assert.equal(values[1],String(n.completed||0));assert.equal(values[2],String(n.boot_confirmed||0));assert.equal(values.length,5);
    await p.locator('.cw-artifacts>summary').click();await p.locator('#cw-evidence').click();await p.locator('#cw-evidence-node').waitFor();
    const files=await(await p.request.get(base+'/api/projects/'+encodeURIComponent(job.project)+'/cycle/jobs/'+job.id+'/artifacts')).json();assert.equal(await p.locator('#cw-files a').count(),files.files.length);
    await p.locator('#cw-evidence-search').fill('not-a-real-file');assert.match(await p.locator('#cw-evidence-count').innerText(),/^0 /);await p.locator('#cw-evidence-search').fill('');
    for(const width of [1366,1920])for(const theme of ['light','dark']){
     await p.setViewportSize({width,height:width===1366?768:1080});await p.evaluate(t=>{applyTheme(t);window.scrollTo({top:0,behavior:'instant'});},theme);await p.waitForTimeout(100);
     assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/run-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
    }
    await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>getComputedStyle(document.querySelector('.cw-confirm-dot')).animationName==='none');
    const moving=await p.locator('#cycle-workspace').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>({name:a.animationName,target:a.effect.target.className,pseudo:a.effect.pseudoElement})));assert.deepEqual(moving,[]);
   }
   await p.locator('#cw-stop').click();await p.waitForTimeout(100);
   current.state='COMPLETE';await p.goto(base+'/#/cycle');await p.locator('.cw-del').waitFor();assert(await p.locator('.cw-del').isEnabled());
   p.once('dialog',d=>d.dismiss());await p.locator('.cw-del').click();assert.equal(trace.filter(t=>t.method==='DELETE').length,0);
   p.once('dialog',d=>d.accept());await p.locator('.cw-del').click();await p.waitForTimeout(100);
   await p.goto(base+'/#/cycle/new');await p.locator('.cw-node').first().waitFor();await p.locator('.cw-node input').first().check();await p.locator('#cw-limit-kind').selectOption('hours');await p.locator('#cw-limit-value').fill('1.5');await p.locator('#cw-create').click();await p.waitForTimeout(200);
   assert.deepEqual(errors,[]);traces.push(trace);await p.close();
  }
  assert.deepEqual(traces[1],traces[0],'Create/confirm/stop/delete contracts must match 1a51f2a byte-for-byte except generated idempotency key');
  assert.equal(fs.readFileSync('app/static/js/cycle-console.js','utf8').replace(/\r\n/g,'\n'),old('app/static/js/cycle-console.js').replace(/\r\n/g,'\n'));
  console.log('PASS: baseline/current identical action requests; loop/hour validation; node selection; Summary/Full; deletion confirmation; hidden profile/default parallelism; four desktop themes. No hardware dispatch.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
