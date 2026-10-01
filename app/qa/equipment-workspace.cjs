const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'artifacts');
const base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8769';
const results=[];
const rgb=color=>{const values=color.match(/[\d.]+/g)?.map(Number);assert.ok(values?.length>=3,'Expected computed RGB color: '+color);return values.slice(0,3);};
const luminance=channels=>channels.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
(async()=>{
 const scope={window:{}};vm.createContext(scope);vm.runInContext(fs.readFileSync('static/js/workspace-reliability.js','utf8'),scope);
 const validate=scope.window.PAWorkspaceReliability.validatePlacements;
 const overlap=validate([{name:'a',rack_u:38,rack_size:4},{name:'b',rack_u:36,rack_size:2},{name:'c',rack_u:4,rack_size:4},{name:'d',rack_u:0,rack_size:1}]);
 assert.equal(overlap.issues.length,2);assert.equal(overlap.usedU,4);assert.equal(overlap.pending.length,1);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(base+'/#/rack/proj_k');
  await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
  const state=()=>page.evaluate(()=>document.querySelector('#ew-rack-canvas').paRackScene.getState());
  const initial=await state();assert.equal(initial.count,36);assert.equal(initial.occupiedU,48);
  for(const [name,top,bottom,size]of [['SERVER-04U',40,37,4],['SERVER-03U',36,34,3],['SERVER-02U',33,32,2],['BLANK-RESERVE-05U',9,5,5],['BLANK-BOTTOM-04U',4,1,4]]){
   const part=initial.placements.find(p=>p.name===name);assert.ok(part,name);assert.equal(part.top,top);assert.equal(part.bottom,bottom);assert.equal(part.size,size);
  }
  assert.deepEqual(initial.placements.find(p=>p.name==='CDU-01'),{name:'CDU-01',type:'cdu',top:0,bottom:0,size:0,external:true});assert.equal(initial.cooling.mode,'external');
  assert.equal(initial.placements.filter(p=>p.type==='nvlink'&&p.size===1).length,9);
  await page.screenshot({path:path.join(out,'equipment-rack-dark.png'),fullPage:true});
  await page.getByRole('button',{name:'\u80cc\u9762',exact:true}).click();assert.equal((await state()).view,'rear');
  await page.getByRole('button',{name:'\u6b63\u9762',exact:true}).click();assert.equal((await state()).yaw,0);
  await page.locator('#ew-rack-canvas').press('ArrowLeft');assert.notEqual((await state()).yaw,0);
  await page.getByRole('button',{name:'\u91cd\u8a2d\u8996\u89d2',exact:true}).click();assert.equal((await state()).view,'perspective');
  for(const kind of ['switch','nvlink','powershelf','cdu','blanking','server','pdu','storage','network']) {
   const scaleOnly=['pdu','storage','network'].includes(kind),project=scaleOnly?'L11-Rack-01':'proj_k';
   await page.goto(base+'/'+(scaleOnly?'?preview=scale':'')+'#/rack/'+project);await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
   const item=await page.evaluate(({project,kind})=>machines.filter(m=>m.project===project).find(m=>m.mgx_type===kind),{project,kind});assert.ok(item,kind);
   await page.locator('#ew-rack-component').selectOption(item.name);
   assert.equal((await state()).selected,item.name);
   await page.getByRole('button',{name:'\u958b\u555f\u5143\u4ef6\u8a73\u60c5',exact:true}).click();
   await page.waitForSelector('.pd-workspace');
   assert.equal(await page.locator('.pd-hardware-stage svg').getAttribute('data-hardware-type'),kind);
  }
  await page.goto(base+'/#/rack/proj_k');await page.waitForFunction(()=>document.querySelector('#ew-rack-canvas')?.dataset.rackState==='ready');
  for(const width of [1440,1600,1920]) {
   await page.setViewportSize({width,height:1000});
   for(const theme of ['light','dark']) {
    await page.evaluate(t=>applyTheme(t),theme);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(out,`equipment-rack-${theme}-${width}.png`)});
   }
  }
  await page.getByRole('button',{name:'48U \u914d\u7f6e',exact:true}).click();await page.waitForSelector('.rm-rack');assert.equal(await page.locator('.rm-u .mono').count(),48);
  results.push('3D geometry: 36 components / 48U, one external CDU with no U occupancy, mixed 1/2/3/4/5U heights, camera, selection, all 9 type identities, 48U edit, 3 widths / 2 themes');
  const nvlinkRow=page.locator('.rm-row[data-u="31"]'),nvlinkCell=nvlinkRow.locator('.rm-cell.mgx-nvlink'),contrasts=[];
  assert.match(await nvlinkCell.locator('.rm-name').innerText(),/NVLINK-01/);
  for(const theme of ['dark','light']){
   await page.evaluate(t=>applyTheme(t),theme);await nvlinkRow.scrollIntoViewIfNeeded();
   for(const interaction of ['default','hover','focus']){
    await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);
    if(interaction==='hover')await nvlinkCell.hover();
    if(interaction==='focus')await nvlinkCell.locator('button').first().focus();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const style=await nvlinkCell.evaluate(e=>{const s=getComputedStyle(e),text=getComputedStyle(e.querySelector('.rm-name'));return {color:text.color,textShadow:text.textShadow,background:s.backgroundImage,outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineStyle:s.outlineStyle,focused:e.matches(':focus-within'),hovered:e.matches(':hover')};});
    const endpoints=style.background.match(/rgba?\([^)]*\)/g)||[];assert.equal(endpoints.length,2,'NVLink background must retain both gradient endpoints');
    const ratios=endpoints.map(stop=>contrast(rgb(style.color),rgb(stop)));assert.ok(ratios.every(r=>r>=4.5),`${theme} ${interaction}: NVLink text contrast below 4.5:1 (${ratios.join(', ')})`);
    if(theme==='light'){
     assert.deepEqual(rgb(style.color),[32,52,62]);assert.equal(style.textShadow,'none');
     assert.deepEqual(endpoints.map(rgb),interaction==='hover'?[[237,229,208],[215,201,168]]:[[228,220,198],[203,189,156]]);
     if(interaction==='focus'){assert.equal(style.focused,true);assert.deepEqual(rgb(style.outline),[0,108,147]);assert.equal(style.outlineWidth,'2px');assert.equal(style.outlineStyle,'solid');}
    }else{
     assert.deepEqual(rgb(style.color),[232,240,255],'Existing dark-theme foreground should be unchanged');assert.deepEqual(endpoints.map(rgb),[[60,72,82],[35,51,64]],'Existing dark-theme gradient should be unchanged');
    }
    if(interaction==='hover')assert.equal(style.hovered,true);
    await nvlinkRow.screenshot({path:path.join(out,`equipment-nvlink-plane-${theme}-${interaction}.png`),animations:'disabled'});
    contrasts.push({theme,interaction,foreground:style.color,endpoints,ratios:ratios.map(r=>Number(r.toFixed(2)))});
   }
  }
  const numberedUnits=await page.locator('.rm-u .mono').allTextContents();assert.deepEqual(numberedUnits,Array.from({length:48},(_,i)=>'U'+(48-i)),'48U plane numbering must remain intact');
  results.push({nvlinkPlaneContrast:contrasts,minimumRatio:4.5,numberedUnits:numberedUnits.length});
  await page.goto(base+'/?preview=scale#/dashboard');await page.waitForFunction(()=>window.PA_PREVIEW&&machines.length>50);
  const scale=await page.evaluate(()=>({systems:machines.filter(m=>m.level!=='rack').length,racks:projects.filter(p=>p.level==='rack').length}));assert.equal(scale.systems,50);assert.equal(scale.racks,3);
  results.push(scale);
  await page.evaluate(()=>productLevel('system'));await page.waitForSelector('#proj-sort-list');
  assert.equal(await page.locator('#proj-sort-list tbody tr:visible').count(),50);
  await page.evaluate(()=>{projects.filter(p=>p.level==='system').forEach(p=>projectCollapsed[p.name]=true);setView('projects');});
  await page.getByRole('textbox',{name:'\u641c\u5c0b\u5c08\u6848\u8207\u7cfb\u7d71'}).fill('L10-Project-10-SYS-05');
  assert.equal(await page.locator('#proj-sort-list tbody tr:visible').count(),1);
  await page.evaluate(()=>{projects.push({name:'Empty-L11',level:'rack',desc:'QA only'});productRack('Empty-L11');});
  await page.waitForSelector('#ew-rack-canvas');assert.equal((await state()).count,0);
  assert.equal(await page.locator('.rack-sel select').inputValue(),'Empty-L11');
  assert.match(await page.locator('.ew-inspector-empty').innerText(),/[\u4e00-\u9fff]/);assert.doesNotMatch(await page.locator('.ew-inspector-empty').innerText(),/Select a component|placement|management interfaces/i);
  results.push('50 visible systems, collapsed-project search, empty typed L11 rack');
  await page.evaluate(()=>{const p=projects.find(p=>p.level==='rack'&&p.name!=='Empty-L11');machines.filter(m=>m.project===p.name).forEach(m=>m.rack_u=0);productRack(p.name);});
  await page.waitForSelector('#ew-rack-canvas');assert.equal((await state()).count,0);
  assert.ok(await page.locator('#ew-rack-component option').count()>1);assert.match(await page.locator('.ew-placement-warning').innerText(),/\u5c1a\u672a\u653e\u7f6e/);assert.doesNotMatch(await page.locator('.ew-placement-warning').innerText(),/unplaced|Placement requires attention|Review placement/i);
  results.push('All-unplaced rack retains component selection and placement warnings');
  await page.goto(base+'/#/machine/host_a');await page.waitForSelector('[data-pd-tab="hardware"]');
  await page.locator('[data-pd-tab="hardware"]').click();assert.ok(await page.locator('.ew-inventory-section').count()>=5);
  await page.screenshot({path:path.join(out,'equipment-hardware.png'),fullPage:true});
  await page.locator('[data-pd-tab="sensors"]').click();await page.waitForSelector('.ew-analysis');assert.equal(await page.locator('.ew-analysis #sensor-ai').count(),1);
  assert.match(await page.locator('.ew-analysis header').innerText(),/[\u4e00-\u9fff]/);assert.doesNotMatch(await page.locator('.ew-analysis header').innerText(),/ASSISTED ANALYSIS|Sensor AI/i);assert.match(await page.locator('.ew-sdr-title').innerText(),/[\u4e00-\u9fff]/);assert.doesNotMatch(await page.locator('.ew-sdr-title').innerText(),/Sensor readings|SDR INVENTORY/i);
  await page.screenshot({path:path.join(out,'equipment-sensors.png'),fullPage:true});
  results.push('Hardware groups and separated Sensor AI');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'equipment-workspace.json'),JSON.stringify({passed:true,results,errors},null,2));
  console.log(JSON.stringify({passed:true,results}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
