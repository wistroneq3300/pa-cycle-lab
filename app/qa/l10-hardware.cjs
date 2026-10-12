/* Inspect generated surfaces at the package/TIM/copper interface. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={window:{},Float32Array,Math};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../static/js/l10-hardware.js'),'utf8'),sandbox);
const api=sandbox.window.PAL10Hardware,{meshes,profile}=api.build();
const near=(a,b)=>Math.abs(a-b)<1e-6;
let vertices=0;
for(const {data}of Object.values(meshes)){
 assert.equal(data.length%12,0);vertices+=data.length/12;
 for(let i=0;i<data.length;i+=12){assert.ok(Array.from(data.subarray(i,i+12)).every(Number.isFinite));assert.ok(near(Math.hypot(data[i+3],data[i+4],data[i+5]),1),'Unit normal');}
}
function surfaceYs(data,p,{normal,metal,color}){
 const result=[];
 for(let i=0;i<data.length;i+=12){
  if(Math.abs(data[i]-p.x)>p.width*.51||Math.abs(data[i+2]-p.z)>p.depth*.51)continue;
  if(!near(data[i+4],normal)||!near(data[i+10],metal))continue;
  if(color&&!color.every((v,c)=>near(data[i+6+c],v)))continue;
  result.push(data[i+1]);
 }
 assert.ok(result.length>=3,'Actual contact surface exists');return result;
}
for(const p of profile.packages){
 const top=Math.max(...surfaceYs(meshes['l10-packages'].data,p,{normal:1,metal:.85}));
 const bottom=Math.min(...surfaceYs(meshes['l10-cooling-frame'].data,p,{normal:-1,metal:.12,color:[.19,.20,.20]}));
 const interfaceTop=Math.max(...surfaceYs(meshes['l10-cooling-frame'].data,p,{normal:1,metal:.12,color:[.19,.20,.20]}));
 const copperBottom=Math.min(...surfaceYs(meshes['l10-cooling-frame'].data,p,{normal:-1,metal:.89,color:[.38,.255,.135]}));
 assert.ok(near(top,bottom),`${p.type} heat spreader meets interface`);
 assert.ok(near(interfaceTop,copperBottom),`${p.type} interface meets cold-plate copper`);
 assert.ok(interfaceTop-bottom>0&&(interfaceTop-bottom)/profile.height*43.6<.2,'Thin thermal interface, not a spacer');
 const underfillBottom=Math.min(...surfaceYs(meshes['l10-packages'].data,p,{normal:-1,metal:.06,color:[.026,.032,.038]}));
 assert.ok(near(underfillBottom,-.0715),`${p.type} bonded underfill meets board surface`);
}
function hasPlaneVertex(data,x,z,y,normal,metal,color,radius=.034){
 for(let i=0;i<data.length;i+=12){
  if(Math.hypot(data[i]-x,data[i+2]-z)>radius||!near(data[i+1],y)||!near(data[i+4],normal)||!near(data[i+10],metal))continue;
  if(color.every((v,c)=>near(data[i+6+c],v)))return true;
 }
 return false;
}
for(const b of profile.boards)for(const sx of [-1,1])for(const sz of [-1,1]){
 const x=b.x+sx*(b.width/2-.058),z=b.z+sz*(b.depth/2-.062);
 assert.ok(hasPlaneVertex(meshes['l10-chassis'].data,x,z,-.098,1,.78,[.49,.38,.17]),'Chassis pillar is centered on the actual PCB mounting hole and seats against its underside');
 assert.ok(hasPlaneVertex(meshes['l10-board'].data,x,z,-.069,1,.8,[.49,.38,.17]),'PCB plated washer shares pillar axis');
}
for(const p of profile.packages)for(const sx of [-1,1])for(const sz of [-1,1]){
 const x=p.x+sx*(p.width/2+.077),z=p.z+sz*(p.depth/2+.077);
 assert.ok(hasPlaneVertex(meshes['l10-cooling-frame'].data,x,z,-.069,-1,.78,[.16,.19,.21],.016),'Cold-plate retention collar touches board washer');
 assert.ok(hasPlaneVertex(meshes['l10-board'].data,x,z,-.069,1,.85,[.62,.66,.68]),'Retention collar has a board landing washer');
 assert.ok(Math.abs(x-p.x)-.015>p.width/2+.050&&Math.abs(z-p.z)-.015>p.depth/2+.050,'Retention axis clears the bonded package laminate');
}
const moved={...profile,packages:profile.packages.map((p,i)=>({...p,x:p.x+(i?0:.025)}))};
assert.notDeepEqual(api.build(moved).meshes['l10-packages'].data,meshes['l10-packages'].data,'Asset layout can change through profile');
assert.deepEqual(api.build().meshes['l10-packages'].data,meshes['l10-packages'].data,'Alternate profile does not mutate default');
console.log(`PASS ${vertices} finite vertices, normalized surfaces, six package/TIM/copper contacts and bonded underfill, eight aligned board supports, 24 cold-plate retention contacts, profile isolation`);
