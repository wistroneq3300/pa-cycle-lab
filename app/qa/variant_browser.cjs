const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.PA_PREVIEW_URL+'/#/machine/host_a');
    await page.waitForFunction(()=>typeof openAssignTask==='function'&&machines.length);
    await page.evaluate(async()=>{
      const original=api;
      window.fixtureVersion='v1';
      window.api=async(url,options)=>{
        if(url==='/api/testlibrary/meta')return {version:fixtureVersion,sheets:[{sheet:'Functional',label:'Functional',count:2}]};
        if(url.startsWith('/api/testlibrary?'))return {items:[
          {code:'DUP',case_variant_id:fixtureVersion+'-a',items:'variant A',criteria:'criteria A',ai_commands:'echo ONE',ai_can_execute:'YES'},
          {code:'DUP',case_variant_id:fixtureVersion+'-b',items:'variant B',criteria:'criteria B',ai_commands:'echo TWO',ai_can_execute:'YES'}]};
        return original(url,options);
      };
      window.assignTaskClip=async text=>{window.copied=text;return true;};
      await openAssignTask('host_a');await assignTaskOpenSheet('Functional');
    });
    await page.locator('.eng-case-row input').first().check();
    assert.equal(await page.locator('.eng-case-row input').nth(1).isChecked(),false);
    assert.deepEqual(await page.evaluate(()=>[..._assignTask.sel]),['v1-a']);
    await page.evaluate(()=>assignTaskCopy());
    assert.ok(!(await page.locator('#rm-dialog-body').innerText()).includes('variant B'));
    await page.locator('#rm-dialog-foot .primary').click();
    await page.waitForFunction(()=>window.copied);
    const copied=await page.evaluate(()=>window.copied);
    assert.ok(copied.includes('criteria A'));assert.ok(!copied.includes('criteria B'));assert.ok(copied.includes('v1-a'));
    await page.evaluate(async()=>{fixtureVersion='v2';await openAssignTask('host_a');await assignTaskOpenSheet('Functional');});
    assert.equal(await page.evaluate(()=>_assignTask.items[0].case_variant_id),'v2-a');
    assert.equal(await page.evaluate(()=>_assignTask.sel.size),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: duplicate-code independent selection, precise generated criteria/variant, and library cache version invalidation');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
