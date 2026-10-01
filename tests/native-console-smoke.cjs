/* Run after native-browser.cjs against the same isolated synthetic instance. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});
 try {
  const p=await b.newPage(),folder=path.resolve('data/native-desktop');
  const id=process.env.PA_CYCLE_JOB_ID||JSON.parse(fs.readFileSync(path.join(folder,'browser-result.json'))).job_id;
  await p.goto((process.env.PA_CYCLE_BASE_URL||'http://127.0.0.1:9187')+'/#/cycle/runs/'+id);
  await p.locator('#cw-run-id').waitFor();
  await require('./console-browser.cjs')(p,id,folder);
  console.log('PASS: bounded native Console, safe text, incremental reconnect, filters, desktop contrast');
 } finally {await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
