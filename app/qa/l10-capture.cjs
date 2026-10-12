/* Capture the shipping Overview renderer, not a separate presentation scene. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const pass=process.env.PA_L10_PASS||'first';
if(!/^[a-z0-9-]+$/i.test(pass))throw Error('Invalid capture pass');
const out=path.resolve(__dirname,'../../artifacts/l10-cinematic',pass);fs.mkdirSync(out,{recursive:true});
const stages=[['01-exploded',.035],['02-cpu-gpu-assembly',.177],['03-cooling-install',.265],['04-cooling-flow',.314],['05-l10-hero',.354],['06-rack-bridge',.515],['07-rack-insertion',.694],['08-l11-overview',1],['09-l11-rear',1,'rear']];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:3440,height:1440},deviceScaleFactor:1}),errors=[],captures=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.PA_PREVIEW_URL||'http://127.0.0.1:8774')+'/#/dashboard',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>document.querySelector('#system-core')?.dataset.coreState==='ready'&&document.querySelector('#core-story')?.paHeroPlayback);
  await page.evaluate(()=>applyTheme('dark'));
  for(const [label,p,view]of stages){
   await page.evaluate(p=>{document.querySelector('#core-story').paHeroPlayback.seek(p);document.querySelector('#system-core').paCoreScene.resetOrbit();},p);
   await page.waitForFunction(p=>Math.abs(Number(document.querySelector('#system-core').dataset.coreProgress)-p)<.0002,p);
   if(view)await page.evaluate(v=>document.querySelector('#system-core').paCoreScene.setView(v),view);
   await page.waitForTimeout(150);
   await page.waitForFunction(()=>!document.querySelector('#system-core').paCoreScene.getState().settling,null,{timeout:60000});
   const state=await page.evaluate(()=>document.querySelector('#system-core').paCoreScene.getState());
   const file=`3440x1440-${label}.png`;await page.screenshot({path:path.join(out,file),animations:'disabled'});
   captures.push({file,progress:p,view:view||'authored',state});console.log('CAPTURE '+file);
  }
  fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify({captures,errors},null,2));
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
