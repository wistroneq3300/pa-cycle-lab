const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:9180/');
  await page.waitForFunction(()=>typeof openProjectModal==='function');
  await page.evaluate(()=>openProjectModal());
  await page.getByRole('button',{name:'Cycle Test',exact:true}).first().click();
  await page.locator('#cycle-history [data-job]').first().click();
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.addStyleTag({content:'*,*::before,*::after { transition:none!important; animation:none!important; }'});
  await page.locator('#cycle-panel').evaluate(d=>d.scrollTop=0);
  await page.screenshot({path:'.impeccable/review/dark.png',animations:'disabled'});
  console.log(await page.locator('#cycle-close').evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
