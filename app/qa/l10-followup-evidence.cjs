'use strict';
// Validate the committed native captures against the current shipping sources.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),evidence=path.join(root,'docs/screenshots/l10-cinematic/rack-followup');
const read=p=>JSON.parse(fs.readFileSync(path.join(evidence,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const captions=read('callouts/after/report.json'),before=read('callouts/before/report.json'),busbar=read('busbar/comparison.json');
assert.equal(captions.pass,true);assert.deepEqual(captions.errors,[]);assert.equal(captions.final.timeMs,39700);
assert.ok(captions.readableMs>=1300);assert.equal(captions.captures.length,6);assert.ok(captions.trace.length>1800);
for(const c of captions.captures){assert.equal(c.overlay.labels.length,4);assert.equal(c.scene.insertion,0);assert.equal(c.glError,0);assert.ok(!/SwiftShader|llvmpipe/i.test(c.renderer));assert.ok(fs.existsSync(path.join(evidence,'callouts/after',c.file)));}
for(const [file,resource]of Object.entries(captions.resources))assert.equal(hash(path.join(root,file)),resource.sha256,`Final served resource: ${file}`);
const old=before.captures[0],now=captions.captures.find(c=>c.width===1920&&c.theme==='dark');
assert.equal(old.overlay.visible,false);assert.equal(old.timeMs,now.timeMs);
// Camera damping stops within a documented numerical tolerance; it is not
// bit-identical between independent browser runs with different frame timings.
const values=c=>[c.yaw,c.elevation,c.distance,...c.target,...c.eye,c.fov];
const cameraMaxDelta=Math.max(...values(old.scene.camera).map((v,i)=>Math.abs(v-values(now.scene.camera)[i])));
assert.ok(cameraMaxDelta<.0002,'Same authored time/camera to settling precision');
assert.equal(busbar.pass,true);assert.ok(busbar.p95ReductionPercent>90);assert.equal(busbar.after.jumpsAbove35,0);
assert.equal(hash(path.join(root,'app/static/js/l10-hardware.js')),busbar.hardwareSources.after.sha256);
for(const variant of ['before','after']){
 const r=read(`busbar/${variant}/busbar-playback.json`);assert.equal(r.pass,true);assert.deepEqual(r.errors,[]);assert.equal(r.sweep.glError,0);
 assert.equal(hash(path.join(evidence,`busbar/${variant}/busbar-orbit.webm`)),r.videoSHA256);
 assert.deepEqual(r.initial.state.camera,busbar.initialCamera);assert.deepEqual(r.geometry,busbar.geometry);
 assert.ok(r.sweep.trace.every(f=>f.resolution===1));
}
console.log(JSON.stringify({pass:true,resources:Object.keys(captions.resources).length,filmFrames:captions.trace.length,captionReadableMs:captions.readableMs,cameraMaxDelta,busbarLargeJumps:[busbar.before.jumpsAbove35,busbar.after.jumpsAbove35],filmSHA256:hash(path.join(evidence,'callouts/after/captions-playback.webm'))},null,2));
