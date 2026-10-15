'use strict';
// CPU-only regression for caption restoration. No browser, render or file writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),baseline='1005e3033c206be9cae0d84089e9ba786af4bff0';
const canonical=s=>s.replace(/\r\n/g,'\n'),read=file=>canonical(fs.readFileSync(path.join(root,file),'utf8'));
const historical=file=>canonical(cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}));
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const corePath='app/static/js/core-scene.js',overlayPath='app/static/js/hero-callouts.js',timelinePath='app/static/js/l10-timeline.js';
const core=read(corePath),oldCore=historical(corePath),overlay=read(overlayPath),oldOverlay=historical(overlayPath),timeline=read(timelinePath);
const motionStart='  function motion(progress,out={}){',motionEnd='  function rackPlacementPose(';
function splitMotion(source){const start=source.indexOf(motionStart),end=source.indexOf(motionEnd,start);assert.ok(start>=0&&end>start);return {before:source.slice(0,start),motion:source.slice(start,end),after:source.slice(end)};}
const previous=splitMotion(oldCore),current=splitMotion(core);
assert.equal(current.before,previous.before,'All code before motion, including rack choreography, is byte-identical after CRLF normalization');
const projectionField='rackProgress:sample.rackProgress,calloutProgress:sample.calloutProgress,phase:sample.phase';
assert.equal(current.after.split(projectionField).length,2,'Exactly one projection payload gains the caption clock');
assert.equal(current.after.replace(projectionField,'rackProgress:sample.rackProgress,phase:sample.phase'),previous.after,'All remaining scene code, geometry, camera, shaders, lighting and render loop is identical');
assert.equal(overlay.replace('p=detail.calloutProgress??detail.rackProgress??detail.progress??1','p=detail.rackProgress??detail.progress??1'),oldOverlay,'Only overlay clock selection changes; original text, positioning, fades, collision checks and drawing remain identical');
for(const file of [timelinePath,'app/static/js/rack-equipment-scene.js'])assert.equal(read(file),historical(file),file+' stays identical');
function harness(source,{hardware=true,clock=true}={}){
 const window=hardware?{PAL10Hardware:{}}:{};
 if(clock)vm.runInNewContext(timeline,{window});
 vm.runInNewContext(source,{window});return {scene:window.PACoreScene,clock:window.PAL10Timeline};
}
const plain=o=>JSON.parse(JSON.stringify(o)),withoutCaptions=s=>{const copy=plain(s);delete copy.calloutProgress;delete copy.calloutVisibility;return copy;};
let compared=0;
for(const options of [{hardware:true,clock:true},{hardware:true,clock:false},{hardware:false,clock:true},{hardware:false,clock:false}]){
 const candidate=harness(core,options),reference=harness(oldCore,options),rackOnly=harness(oldCore,{hardware:false,clock:false});
 for(let i=0;i<=1000;i++){
  const p=i/1000,a=candidate.scene.assemblySnapshot(p,{coolingV1:true}),b=reference.scene.assemblySnapshot(p,{coolingV1:true});
  assert.deepEqual(withoutCaptions(a),withoutCaptions(b),'No geometry, phase, pose or animation changes at '+p+' '+JSON.stringify(options));
  if(!options.hardware){assert.equal(a.calloutProgress,a.rackProgress);assert.equal(a.calloutVisibility,b.calloutVisibility);}
  if(options.hardware&&!options.clock){assert.equal(a.calloutProgress,a.rackProgress);const raw=rackOnly.scene.assemblySnapshot(a.rackProgress);assert.equal(a.calloutVisibility,raw.calloutVisibility,'Missing timeline falls back to original rack caption clock');}
  compared++;
 }
}
const {scene,clock}=harness(core),epsilon=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const [ms,expected]of [[0,.19],[17500,.19],[19700,.19],[20000,.19+.137*300/2300],[20850,.2585],[22000,.327],[39700,.327]]){
 const sample=scene.assemblySnapshot(clock.progressAt(ms,'coolingV2'));epsilon(sample.calloutProgress,expected);
 if(ms<=19700||ms>=22000)assert.equal(sample.calloutVisibility,0,'Captions are hidden outside the existing bridge');
}
for(let ms=17500;ms<=22000;ms+=5){
 const a=scene.assemblySnapshot(clock.progressAt(ms,'coolingV2')),b=scene.assemblySnapshot(clock.progressAt(ms-4500,'legacy'));epsilon(a.calloutProgress,b.calloutProgress);epsilon(a.calloutVisibility,b.calloutVisibility);
}
function smooth(a,b,p){const x=Math.max(0,Math.min(1,(p-a)/(b-a)));return x*x*x*(x*(x*6-15)+10);}
function range(samples){return {firstMs:samples[0],lastMs:samples.at(-1),durationMs:samples.at(-1)-samples[0]};}
const windows={visible:[],primary80:[],secondary80:[]};
for(let ms=17500;ms<=22000;ms++){
 const s=scene.assemblySnapshot(clock.progressAt(ms,'coolingV2')),p=s.calloutProgress;
 if(s.calloutVisibility>0&&p>=.18&&p<.327)windows.visible.push(ms);
 if([0,1,2,3].every(i=>smooth(.199+i*.001,.214+i*.001,p)*(1-smooth(.293,.316,p))>.8))windows.primary80.push(ms);
 if([0,1,2,3].every(i=>smooth(.204+i*.001,.219+i*.001,p)*(1-smooth(.282,.302,p))>.8))windows.secondary80.push(ms);
}
const measured=Object.fromEntries(Object.entries(windows).map(([name,samples])=>[name,range(samples)]));
assert.ok(measured.visible.durationMs>2250);assert.ok(measured.primary80.durationMs>1450);assert.ok(measured.secondary80.durationMs>1150);
console.log(JSON.stringify({pass:true,baseline,method:'CPU source and function regression; canonical source comparison normalizes checkout CRLF only. No GPU or writes.',stateComparisons:compared,nonL10Unchanged:true,noTimelineFallback:true,legacyBridgeSameTimingWith4500msOffset:true,windows:measured,unchangedSourceSHA256:{beforeMotion:digest(current.before),afterMotionExceptProjectionField:digest(previous.after),timeline:digest(timeline),rackEquipment:digest(read('app/static/js/rack-equipment-scene.js'))}},null,2));
