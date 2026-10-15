'use strict';
// Reuse the accepted native Chromium recorder and read-only GPU observer.
// Only scenario inputs change: pinned reference, output, orbit and tracked face.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const evidence=path.resolve(__dirname,'../../artifacts/l10-followup/busbar');
function verifySaved(){
  const before=JSON.parse(fs.readFileSync(path.join(evidence,'before/busbar-playback.json'))),after=JSON.parse(fs.readFileSync(path.join(evidence,'after/busbar-playback.json')));
  for(const r of [before,after]){
    assert.equal(r.pass,true);assert.deepEqual(r.errors,[]);assert.equal(r.sweep.glError,0);
    assert.ok(/RTX 4070/.test(r.initial.renderer));assert.ok(r.sweep.wallMs>=8000);
    assert.ok(r.sweep.trace.length>=40);assert.ok(r.sweep.trace.every(f=>f.resolution===1));
  }
  assert.deepEqual(before.initial.state.camera,after.initial.state.camera,'Same native initial camera');
  assert.deepEqual(before.geometry,after.geometry,'Same tracked surface coordinates and unchanged I/O buffer');
  assert.ok(before.metrics.luminanceDeltaP95>35&&before.metrics.jumpsAbove35>100,'Baseline reproduces depth substitutions');
  assert.equal(after.metrics.jumpsAbove35,0,'No large temporal material substitutions after repair');
  assert.ok(after.metrics.luminanceDeltaP95<10&&after.metrics.luminanceDeltaMax<20,'Residual changes stay in the small normal PBR range');
  assert.ok(after.metrics.luminanceDeltaP95<before.metrics.luminanceDeltaP95*.2);
  const result={pass:true,baseline:before.baseline,method:after.method,initialCamera:after.initial.state.camera,geometry:after.geometry,renderer:after.initial.renderer,before:before.metrics,after:after.metrics,p95ReductionPercent:100*(1-after.metrics.luminanceDeltaP95/before.metrics.luminanceDeltaP95),hardwareSources:{before:before.resources['app/static/js/l10-hardware.js'],after:after.resources['app/static/js/l10-hardware.js']},videos:{before:before.videoSHA256,after:after.videoSHA256}};
  fs.writeFileSync(path.join(evidence,'comparison.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({pass:true,p95ReductionPercent:result.p95ReductionPercent,beforeJumps:result.before.jumpsAbove35,afterJumps:result.after.jumpsAbove35},null,2));
}
if(process.argv[2]==='verify'){verifySaved();process.exit(0);}
let script=fs.readFileSync(path.join(__dirname,'l10-p1-ssd-playback.cjs'),'utf8');
function replace(from,to){assert.ok(script.includes(from),'Recorder contract: '+from.slice(0,60));script=script.replace(from,to);}
replace("baseline='b3664ea97d52f1e6d756de00cfb5a8c84821c0cc'","baseline='1005e3033c206be9cae0d84089e9ba786af4bff0'");
replace("'docs/screenshots/l10-cinematic/p1-final/ssd'","'artifacts/l10-followup/busbar'");
replace("'artifacts/l10-p1/ssd-video'","'artifacts/l10-followup/busbar/video-temp'");
replace("scene.setOrbit(-.42,-.18)","scene.setOrbit(.10,-.15)");
replace("slot=built.storageLayout.slots[0],points=[]","slot={id:'rear-busbar-socket-front'},points=[]");
replace("for(const y of [-.04,0,.04])for(const z of [2.28,2.40,2.52,2.64,2.76,2.88])points.push([slot.body.min[0],y,z]);","for(const y of [-.085,-.055,.058])for(const x of [-.080,-.040,0,.040,.080])points.push([x,y,-2.949]);");
replace("scene.setOrbit(-.42+.20*Math.sin(t*Math.PI*2),-.18+.045*Math.sin(t*Math.PI*2))","scene.setOrbit(.10+.23*Math.sin(t*Math.PI*2),-.15+.04*Math.sin(t*Math.PI*2))");
replace("Math.abs(f.yaw+.42)>.15","Math.abs(f.yaw-.10)>.17");
const assertionsStart=script.indexOf("    // The two coincident materials");
const assertionsEnd=script.indexOf("    report.pass=true;",assertionsStart);
assert.ok(assertionsStart>0&&assertionsEnd>assertionsStart);
script=script.slice(0,assertionsStart)+`    report.interpretation='Tracked rear socket surface; evaluate temporal brightness jumps together with the native video and l10-busbar.cjs exact face-overlap regression.';
    if(variant==='before'){assert.ok(report.metrics.luminanceDeltaP95>35&&report.metrics.jumpsAbove35>100,'Baseline reproduces coplanar material substitutions');}
    else{assert.equal(report.metrics.jumpsAbove35,0,'No large temporal material substitutions');assert.ok(report.metrics.luminanceDeltaP95<10&&report.metrics.luminanceDeltaMax<20,'Native PBR surface remains stable during orbit');}
`+script.slice(assertionsEnd);
script=script.replaceAll('ssd-playback.json','busbar-playback.json').replaceAll('ssd-orbit.webm','busbar-orbit.webm');
new vm.Script(script,{filename:__filename}).runInNewContext({require,process,__dirname,console,URL,Buffer,setTimeout,clearTimeout});
