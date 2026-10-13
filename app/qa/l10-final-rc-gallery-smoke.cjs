'use strict';
// Review-document smoke test only; no production renderer/data mutations.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/final-rc'),review=JSON.parse(fs.readFileSync(path.join(out,'acceptance.json'),'utf8'));
const report={passed:false,score:review.overallScore,viewports:[],errors:[],relativeFiles:[]};assert.ok(Number.isFinite(review.overallScore),'Only smoke the final reviewer-populated report');
(async()=>{
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(out,'.'+decodeURIComponent(url.pathname==='/'?'/compare.html':url.pathname));if(!file.startsWith(out+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.errors.push(r.url()+' '+r.status());});
  await page.goto(origin+'/compare.html',{waitUntil:'load'});
  const refs=await page.evaluate(()=>[...document.querySelectorAll('[href],[src]')].flatMap(e=>[e.getAttribute('href'),e.getAttribute('src')]).filter(Boolean));
  for(const ref of new Set(refs)){if(ref.startsWith('#')||/^[a-z]+:/i.test(ref))continue;const file=path.resolve(out,decodeURIComponent(ref.split('#')[0].split('?')[0]));assert.ok(file.startsWith(out+path.sep));assert.ok(fs.existsSync(file),'Relative resource exists: '+ref);report.relativeFiles.push(ref);}
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const state=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('h2')].map(e=>e.textContent),score:document.querySelector('#review-result strong')?.textContent,scoreBounds:document.querySelector('#review-result strong')?.getBoundingClientRect().toJSON(),topVerdict:document.querySelector('#review-result')?.textContent,knownBaselineFailure:document.body.innerText.includes('KNOWN BASELINE FAIL')}));
   assert.ok(state.scrollWidth<=state.width,'No horizontal document overflow');assert.equal(state.score,String(review.overallScore));assert.ok(state.scoreBounds.top>=0&&state.scoreBounds.bottom<=viewport.height,'Final score is visible in initial viewport');
   assert.ok(state.topVerdict.includes('Target '+review.targetScore+': '+(review.targetMet?'PASS':'FAIL')));assert.equal(state.knownBaselineFailure,true,'Known historical failure remains distinct from the visual target result');
   const file='evidence/gallery-'+viewport.width+'.png';await page.screenshot({path:path.join(out,file)});report.viewports.push({...viewport,...state,file});
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'evidence/gallery-smoke.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({passed:report.passed,relativeFiles:report.relativeFiles.length,viewports:report.viewports.map(v=>v.width)},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
