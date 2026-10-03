/* Verify delivered recordings can actually load and seek in the desktop browser. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../artifacts/shared-validation/acceptance');
 const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 try{
  for(const name of ['A-independent-inspection','B-boot-recovery','C-shared-rules-cycle','D-identity-auto-sync']){
   const page=await browser.newPage();await page.goto(pathToFileURL(path.join(root,name+'.webm')).href);
   await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
   const info=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message}));
   assert(info.duration>1);assert.equal(info.width,1920);assert.equal(info.height,1080);assert(!info.error);
   await page.locator('video').evaluate(v=>{v.currentTime=v.duration/2;});
   await page.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&v.readyState>=2;});
   results.push({name,...info,seek:true});await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync(path.join(root,'video-verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
