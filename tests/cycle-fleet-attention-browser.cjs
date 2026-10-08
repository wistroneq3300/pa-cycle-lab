/* Synthetic browser regression for CycleFleet's affected-node expansion. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:19487';

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1920,height:1080}}),page=await context.newPage();
 try{
  await page.goto(`${base}/?preview=cycle-attention#/dashboard`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof CycleFleet==='function');
  const result=await page.evaluate(()=>{
   const expand=(healths,configure)=>{
    const root=document.createElement('div');document.body.append(root);
    const targets=healths.map((health,index)=>({name:`attention-${index}`,node_id:`N${index}`,chassis_id:`chassis-${index%2}`}));
    const f=new CycleFleet(root,()=>{});
    f.job={targets,nodes:healths.map((health,index)=>({machine_id:`attention-${index}`,cumulative_health:health,loop:1})),config:{limits:{loops:1}}};
    if(configure)configure(f);else f.render();
    const button=[...root.querySelectorAll('button')].find(el=>el.textContent.trim()==='顯示全部受影響節點');
    if(!button)throw new Error('missing affected-node expansion button');
    button.click();
    const matrix=root.querySelector('.lc-matrix');
    if(!matrix?.open)throw new Error('Node Matrix did not open');
    for(const group of matrix.querySelectorAll(':scope > div > details')){group.open=true;group.ontoggle();}
    const output={filter:f.filter,node:f.node,search:f.search,chassis:f.chassis,count:matrix.querySelectorAll('[data-machine]').length};
    root.remove();return output;
   };
   const independent=(healths,filter)=>{
    const root=document.createElement('div');document.body.append(root);
    const targets=healths.map((health,index)=>({name:`filtered-${index}`,node_id:`F${index}`,chassis_id:'filtered'}));
    const f=new CycleFleet(root,()=>{});f.job={targets,nodes:healths.map((health,index)=>({machine_id:`filtered-${index}`,cumulative_health:health,loop:1})),config:{limits:{loops:1}}};f.filter=filter;f.render();
    const matrix=root.querySelector('.lc-matrix');matrix.open=true;matrix.ontoggle();for(const group of matrix.querySelectorAll(':scope > div > details')){group.open=true;group.ontoggle();}const count=matrix.querySelectorAll('[data-machine]').length;root.remove();return count;
   };
   const shortList=(()=>{
    const healths=Array(12).fill('WARN'),root=document.createElement('div');document.body.append(root);
    const f=new CycleFleet(root,()=>{});f.job={targets:healths.map((health,index)=>({name:`short-${index}`,chassis_id:'short'})),nodes:healths.map((health,index)=>({machine_id:`short-${index}`,cumulative_health:health}))};f.render();
    const output={button:[...root.querySelectorAll('button')].some(el=>el.textContent.trim()==='顯示全部受影響節點'),chips:root.querySelectorAll('.lc-attention [data-machine]').length};root.remove();return output;
   })();
   return {
    warnOnly:expand(Array(13).fill('WARN')),
    warnFail:expand([...Array(10).fill('WARN'),...Array(5).fill('FAIL')]),
    failOnly:expand(Array(13).fill('FAIL')),
    errorMapping:expand([...Array(12).fill('FAIL'),'ERROR']),
    healthyMixed:expand([...Array(13).fill('WARN'),...Array(3).fill('PASS')]),
    clearedFilters:expand([...Array(13).fill('WARN'),...Array(3).fill('PASS')],f=>{f.node='attention-0';f.search='attention-0';f.chassis='chassis-0';f.render();}),
    shortList,
    independentWarn:independent([...Array(10).fill('WARN'),...Array(5).fill('FAIL')],'WARNING'),
    independentFail:independent([...Array(10).fill('WARN'),...Array(5).fill('FAIL')],'FAIL')
   };
  });
  assert.equal(result.warnOnly.count,13);
  assert.equal(result.warnFail.count,15);
  assert.equal(result.failOnly.count,13);
  assert.equal(result.errorMapping.count,13);
  assert.equal(result.healthyMixed.count,13);
  assert.deepEqual(result.clearedFilters,{filter:'ATTENTION',node:'',search:'',chassis:'',count:13});
  assert.deepEqual(result.shortList,{button:false,chips:12});
  assert.equal(result.independentWarn,10);
  assert.equal(result.independentFail,5);
  console.log('CycleFleet affected-node attention PASS',JSON.stringify(result));
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
