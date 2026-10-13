/* Actual Chromium/WebGL regression for the separate V3 cooling environment.
 * A loopback-only fixture mounts the unchanged production renderer and assets.
 * Faults are confined to individual pages; no application inventory is used.
 * Run only when GPU capture work is idle:
 *   node app/qa/l10-cooling-v3-environment.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),base=process.env.PA_PREVIEW_URL||'http://127.0.0.1:8775';
const output=path.join(root,'docs/screenshots/l10-cinematic/cooling-v3/evidence/environment');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Synthetic loopback preview only');
const atlasPath='/static/img/l10/studio-small-09-cooling-radiance.png',originalPath='/static/img/l10/studio-small-09-radiance.png';
const report={passed:false,checks:[],cases:[],errors:[],expectedFixtureErrors:[],external:[],sourceHashes:{},method:'Native Chromium/WebGL; production renderer/GLB/atlas assets. Minimal isolated mount fixture; only explicitly named resource failure cases are mocked. Texture binding instrumentation observes actual GPU draws.'};
for(const file of ['app/static/js/core-scene.js','app/static/js/l10-asset-runtime.js','app/static'+atlasPath.slice('/static'.length),'app/static'+originalPath.slice('/static'.length)])report.sourceHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');

function observe(){
  const proto=WebGLRenderingContext.prototype,locations=new WeakMap(),sources=new WeakMap(),contexts=new WeakMap();
  let q=null,activeLayer=null,activeMaterial=null;
  function record(gl){
    let state=contexts.get(gl);if(state)return state;
    state={live:new Set(),created:0,deleted:0,lost:0,lossEvents:0,frames:0,draws:[],uniforms:{},units:{},active:33984};contexts.set(gl,state);q=state;
    gl.canvas.addEventListener('webglcontextlost',()=>{state.lost+=state.live.size;state.live.clear();state.lossEvents++;state.units={};},true);
    return state;
  }
  for(const name of ['getUniformLocation','uniform1f','uniform1i','activeTexture','bindTexture','texImage2D','createTexture','deleteTexture','clear','drawArrays']){
    const original=proto[name];proto[name]=function(...args){
      const state=record(this),result=original.apply(this,args);
      if(name==='getUniformLocation'&&result)locations.set(result,args[1]);
      if(name==='uniform1f'||name==='uniform1i'){const key=locations.get(args[0]);if(key)state.uniforms[key]=args[1];}
      if(name==='activeTexture')state.active=args[0];
      if(name==='bindTexture')state.units[state.active]=args[1];
      if(name==='createTexture'&&result){state.live.add(result);state.created++;}
      if(name==='deleteTexture'&&args[0]&&state.live.delete(args[0]))state.deleted++;
      if(name==='texImage2D'&&args.length===6&&state.units[state.active])sources.set(state.units[state.active],args[5]?.src||'inline image');
      if(name==='clear'&&(args[0]&this.COLOR_BUFFER_BIT)){state.frames++;state.draws=[];}
      if(name==='drawArrays'&&state.uniforms.uShadowPass===0)state.draws.push({layer:activeLayer,material:activeMaterial,asset:state.uniforms.uAsset||0,finish:state.uniforms.uL10Finish||0,coolingFinish:state.uniforms.uCoolingFinish||0,flow:state.uniforms.uCoolingFlow||0,travel:state.uniforms.uCoolingTravel||0,environment:sources.get(state.units[33985])||null,vertices:args[2]});
      return result;
    };
  }
  window.__environmentQA={
    wrapRuntime(){
      const original=window.PAL10AssetRuntime;
      window.PAL10AssetRuntime=Object.freeze({...original,upload(...args){
        const runtime=original.upload(...args);
        return {...runtime,draw(...drawArgs){
          const previous=activeLayer,previousMaterial=activeMaterial,beforePrimitive=drawArgs[5];activeLayer=drawArgs[0];
          drawArgs[5]=primitive=>{activeMaterial=primitive.material.name;beforePrimitive?.(primitive);};
          try{return runtime.draw(...drawArgs);}finally{activeLayer=previous;activeMaterial=previousMaterial;}
        }};
      }});
    },
    snapshot(){return q?{liveTextures:q.live.size,createdTextures:q.created,deletedTextures:q.deleted,lostTextures:q.lost,lossEvents:q.lossEvents,frames:q.frames,draws:q.draws}:null;}
  };
}
function fixture(withHardware){
  const scripts=[...(withHardware?['l10-hardware','l10-gltf','l10-asset-runtime']:[]),'rack-equipment-scene','l10-timeline','core-scene'];
  return `<!doctype html><html><head><link rel="icon" href="data:,"><style>html,body{margin:0;background:#121516}canvas{width:960px;height:640px;display:block}</style></head><body><canvas id="system-core"></canvas>${scripts.map(name=>'<script src="/static/js/'+name+'.js?qa=cooling-v3-environment"></script>').join('')}<script>${withHardware?'__environmentQA.wrapRuntime();':''}window.__scene=PACoreScene.mount(document.querySelector('canvas'));__scene.setProgress(${withHardware?"PAL10Timeline.stageProgress('flow',.4)":'.8'});${withHardware?"__scene.setInspection('cooling');":''}</script></body></html>`;
}
function summarizeDraws(draws){
  const groups={};for(const draw of draws){const key=JSON.stringify([draw.layer,draw.material,draw.asset,draw.finish,draw.coolingFinish,draw.flow,draw.environment]);const group=groups[key]||(groups[key]={...draw,calls:0,vertices:0});group.calls++;group.vertices+=draw.vertices;}return Object.values(groups);
}
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'/usr/bin/chromium')});
  try{
    async function open(name,{withHardware=true,atlasFailure=false}={}){
      const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});page.setDefaultTimeout(120000);await page.addInitScript(observe);
      page.on('pageerror',error=>report.errors.push({case:name,error:error.message}));
      page.on('console',message=>{if(message.type()==='error')(atlasFailure?report.expectedFixtureErrors:report.errors).push({case:name,error:message.text()});});
      page.on('request',request=>{if(/^https?:/.test(request.url())&&new URL(request.url()).origin!==new URL(base).origin)report.external.push(request.url());});
      await page.route('**/qa/l10-cooling-v3-environment.html?*',route=>route.fulfill({status:200,contentType:'text/html',body:fixture(withHardware)}));
      if(atlasFailure)await page.route('**/studio-small-09-cooling-radiance.png*',route=>route.fulfill({status:404,body:'Intentional isolated filtered-atlas failure'}));
      await page.goto(base+'/qa/l10-cooling-v3-environment.html?l10Bareboard=1&l10AssetLab=1&case='+name,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__scene?.getState().ready&&!__scene.getState().settling);
      return page;
    }
    const read=page=>page.evaluate(()=>({scene:__scene.getState(),gpu:__environmentQA.snapshot(),glError:document.querySelector('canvas').getContext('webgl').getError()}));
    async function seek(page,stage,inspection='cooling'){
      await page.evaluate(({stage,inspection})=>{__scene.setInspection(inspection);__scene.setProgress(PAL10Timeline.stageProgress(stage,.5));__scene.resize();},{stage,inspection});
      await page.waitForFunction(()=>__scene.getState().ready&&!__scene.getState().settling);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    async function closeAndAudit(page,name){
      await page.evaluate(()=>__scene.destroy());const destroyed=await read(page);
      check(name+': destroying the scene releases every tracked live texture',()=>{assert.equal(destroyed.scene.disposed,true);assert.equal(destroyed.gpu.liveTextures,0);assert.equal(destroyed.glError,0);});
      await page.close();return destroyed.gpu;
    }

    let page=await open('missing-hardware',{withHardware:false});let state=await read(page);
    check('Bareboard query with missing PAL10Hardware reaches ready Rack fallback',()=>{
      assert.equal(state.scene.ready,true);assert.equal(state.scene.l10,null);assert.equal(state.scene.asset.enabled,false);assert.equal(state.scene.quality.environmentReady,false);assert.equal(state.scene.quality.coolingEnvironmentReady,false);assert.ok(state.gpu.draws.length>0);assert.equal(state.glError,0);
    });
    report.cases.push({name:'missing-hardware',scene:state.scene,gpu:{...state.gpu,draws:summarizeDraws(state.gpu.draws)},cleanup:await closeAndAudit(page,'Missing-hardware fallback')});

    page=await open('normal');state=await read(page);
    function assertSeparation(snapshot,filtered){
      const draws=snapshot.gpu.draws,expected=filtered?atlasPath:originalPath;
      assert.ok(draws.some(d=>d.layer?.startsWith('cooling-')),'Real cooling asset draws observed');
      assert.ok(draws.some(d=>['board','packages','io','network'].includes(d.layer)),'Real protected bare asset draws observed');
      for(const draw of draws){
        const cooling=draw.layer?.startsWith('cooling')||draw.finish===2;
        assert.ok(draw.environment?.includes(cooling?expected:originalPath),(cooling?'Cooling/lid':'Protected Rack/bare')+' draw uses its designated environment: '+JSON.stringify(draw));
        const finish=draw.material==='CPU satin nickel cover'?1:draw.material==='GPU machined nickel cover'?2:0;
        assert.equal(draw.coolingFinish,finish,'CPU/GPU machining finish must not leak into other actual GPU materials: '+JSON.stringify(draw));
      }
      for(const finish of [1,2])assert.ok(draws.some(draw=>draw.coolingFinish===finish),'Actual CPU/GPU cover finish '+finish+' was drawn');
      assert.equal(snapshot.glError,0);
    }
    check('Successful filtered atlas stays isolated to cooling draws; protected bare draws use original radiance',()=>{
      assert.equal(state.scene.asset.failed,false);assert.equal(state.scene.cooling.ready,true);assert.equal(state.scene.quality.environmentReady,true);assert.equal(state.scene.quality.coolingEnvironmentReady,true);assert.equal(state.scene.quality.coolingEnvironmentFailed,false);assertSeparation(state,true);
    });
    check('Only CPU satin nickel and GPU machined nickel cover draws receive cooling finish 1/2; every other material is 0',()=>{
      const covers=state.gpu.draws.filter(draw=>draw.coolingFinish>0);
      assert.ok(covers.some(draw=>draw.material==='CPU satin nickel cover'&&draw.coolingFinish===1));
      assert.ok(covers.some(draw=>draw.material==='GPU machined nickel cover'&&draw.coolingFinish===2));
      assert.ok(covers.every(draw=>draw.asset===1&&draw.layer==='cooling'));
      assert.ok(state.gpu.draws.filter(draw=>!draw.layer?.startsWith('cooling')).every(draw=>draw.coolingFinish===0));
    });
    const normalTextures=state.gpu.liveTextures,normalEvidence={name:'normal',scene:state.scene,gpu:{...state.gpu,draws:summarizeDraws(state.gpu.draws)}};
    await seek(page,'lid','cooling-hero');state=await read(page);
    check('Lid uses the filtered atlas and does not rebind protected bare materials',()=>{assert.ok(state.gpu.draws.some(d=>d.finish===2));assertSeparation(state,true);});
    normalEvidence.lidDraws=summarizeDraws(state.gpu.draws);
    await seek(page,'rack',null);state=await read(page);
    check('Rack integration restores original environment for all ordinary procedural equipment',()=>{const draws=state.gpu.draws.filter(d=>!d.layer&&d.finish!==2);assert.ok(draws.length>=41);assert.ok(draws.every(d=>d.environment?.includes(originalPath)));assertSeparation(state,true);});
    normalEvidence.rackDraws=summarizeDraws(state.gpu.draws);

    await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl'),ext=gl.getExtension('WEBGL_lose_context');if(!ext)throw new Error('Test browser lacks WEBGL_lose_context');window.__restoreEnvironment=()=>ext.restoreContext();ext.loseContext();});
    await page.waitForFunction(()=>__scene.getState().contextLost);await page.waitForTimeout(150);await page.evaluate(()=>__restoreEnvironment());
    await page.waitForFunction(()=>__scene.getState().ready&&__scene.getState().cooling.ready&&__scene.getState().quality.coolingEnvironmentReady);
    await seek(page,'flow');state=await read(page);
    check('Context restoration reloads both atlases without accumulating live textures',()=>{assert.equal(state.scene.contextLost,false);assert.equal(state.gpu.lossEvents,1);assert.equal(state.gpu.liveTextures,normalTextures);assertSeparation(state,true);});
    normalEvidence.restoration={scene:state.scene,gpu:{...state.gpu,draws:summarizeDraws(state.gpu.draws)}};normalEvidence.cleanup=await closeAndAudit(page,'Restored scene');report.cases.push(normalEvidence);

    page=await open('filtered-atlas-404',{atlasFailure:true});state=await read(page);
    check('Missing filtered atlas retains loaded cooling and falls back to original radiance',()=>{
      assert.equal(state.scene.ready,true);assert.equal(state.scene.asset.failed,false);assert.equal(state.scene.cooling.ready,true);assert.equal(state.scene.cooling.failed,false);assert.equal(state.scene.quality.environmentReady,true);assert.equal(state.scene.quality.coolingEnvironmentReady,false);assert.equal(state.scene.quality.coolingEnvironmentFailed,true);assertSeparation(state,false);
    });
    report.cases.push({name:'filtered-atlas-404',scene:state.scene,gpu:{...state.gpu,draws:summarizeDraws(state.gpu.draws)},cleanup:await closeAndAudit(page,'Filtered-atlas fallback')});
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.passed=true;
  }catch(error){report.failure=error.stack;throw error;}
  finally{fs.writeFileSync(path.join(output,'environment-lifecycle.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,output},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
