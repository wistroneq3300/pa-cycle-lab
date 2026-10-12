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
}
const moved={...profile,packages:profile.packages.map((p,i)=>({...p,x:p.x+(i?0:.025)}))};
assert.notDeepEqual(api.build(moved).meshes['l10-packages'].data,meshes['l10-packages'].data,'Asset layout can change through profile');
assert.deepEqual(api.build().meshes['l10-packages'].data,meshes['l10-packages'].data,'Alternate profile does not mutate default');
console.log(`PASS ${vertices} finite vertices, normalized surfaces, six package/TIM/copper contacts, profile isolation`);
