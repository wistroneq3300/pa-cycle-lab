/* SSD depth-conflict regression against the accepted RC. Geometry only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),reference='b3664ea97d52f1e6d756de00cfb5a8c84821c0cc';
const hardware='app/static/js/l10-hardware.js',rack='app/static/js/rack-equipment-scene.js';
const source=fs.readFileSync(path.join(root,hardware),'utf8');
const baseline=execFileSync('git',['show',`${reference}:${hardware}`],{cwd:root,encoding:'utf8'});
const rackSource=fs.readFileSync(path.join(root,rack),'utf8');
assert.equal(rackSource,execFileSync('git',['show',`${reference}:${rack}`],{cwd:root,encoding:'utf8'}),'Rack source remains unchanged');
const marker='return {data,box,bevel,cylinder,ring,screw,tube,line,tri,quad};';
const near=(a,b,epsilon=1e-7)=>Math.abs(a-b)<epsilon;
const sameColor=(p,c)=>p.args[6].every((v,i)=>near(v,c[i]));
function build(text,options){
  assert.ok(text.includes(marker),'Audit instruments the actual mesh builder');
  const context={window:{},Float32Array,Math,__bevels:[]};
  vm.runInNewContext(rackSource,context);
  vm.runInNewContext(text.replace(marker,`return {data,box,bevel:(...args)=>{const start=data.length;bevel(...args);__bevels.push({args,data:new Float32Array(data.slice(start))});},cylinder,ring,screw,tube,line,tri,quad};`),context);
  const result=context.window.PAL10Hardware.build(context.window.PAL10Hardware.profile,options);
  return {...result,bevels:context.__bevels};
}
function triangles(data){
  const result=[];
  for(let i=0;i<data.length;i+=36)result.push([0,12,24].map(offset=>Array.from(data.slice(i+offset,i+offset+3))));
  return result;
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function signedArea(p){return p.reduce((sum,v,i)=>{const q=p[(i+1)%p.length];return sum+v[0]*q[1]-q[0]*v[1];},0)/2;}
function overlapArea(a,b){
  const raw=cross(sub(a[1],a[0]),sub(a[2],a[0])),length=Math.hypot(...raw);
  if(length<1e-12)return 0;
  const normal=raw.map(v=>v/length);
  if(b.some(p=>Math.abs(dot(normal,sub(p,a[0])))>1e-7))return 0;
  const axis=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const project=p=>p.filter((_,i)=>i!==axis);
  let polygon=a.map(project),clip=b.map(project);
  if(signedArea(clip)<0)clip.reverse();
  for(let i=0;i<3&&polygon.length;i++){
    const p=clip[i],q=clip[(i+1)%3],output=[];
    for(let j=0;j<polygon.length;j++){
      const start=polygon[j],end=polygon[(j+1)%polygon.length],ds=cross2(p,q,start),de=cross2(p,q,end);
      if(ds>=0)output.push(start);
      if((ds>=0)!==(de>=0)){
        const t=ds/(ds-de);output.push(start.map((v,k)=>v+(end[k]-v)*t));
      }
    }
    polygon=output;
  }
  return polygon.length<3?0:Math.abs(signedArea(polygon))/Math.abs(normal[axis]);
}
function coplanarOverlap(a,b){
  let area=0,pairs=0;
  for(const ta of triangles(a))for(const tb of triangles(b)){
    const intersection=overlapArea(ta,tb);
    if(intersection>1e-10){area+=intersection;pairs++;}
  }
  return {area,pairs};
}
function bounds(data){
  const min=[Infinity,Infinity,Infinity],max=min.map(v=>-v);
  for(let i=0;i<data.length;i+=12)for(let j=0;j<3;j++){min[j]=Math.min(min[j],data[i+j]);max[j]=Math.max(max[j],data[i+j]);}
  return {min,max};
}
function withoutBodySide(data,slots){
  const result=[];
  for(let i=0;i<data.length;i+=36){
    const side=slots.some(slot=>[0,12,24].every(offset=>{
      const j=i+offset;return data[j]===Math.fround(slot.body.min[0])&&data[j+3]===-1&&data[j+4]===0&&data[j+5]===0&&
        data[j+6]===Math.fround(.040)&&data[j+7]===Math.fround(.045)&&data[j+8]===Math.fround(.049)&&data[j+10]===Math.fround(.32);
    }));
    if(!side)result.push(...data.subarray(i,i+36));
  }
  return new Float32Array(result);
}
const bytes=data=>Buffer.from(data.buffer,data.byteOffset,data.byteLength);
const results=[];
for(const [mode,options] of [['procedural',{}],['coolingV2-runtime',{omitBareBoards:true,replaceServiceGeometry:true,replaceNetworking:true}]]){
  const before=build(baseline,options),after=build(source,options),slots=after.storageLayout.slots;
  assert.equal(JSON.stringify(before.storageLayout),JSON.stringify(after.storageLayout),'Accepted 15 mm envelope, layout and clearances remain unchanged');
  for(const [name,mesh] of Object.entries(before.meshes)){
    if(name==='l10-io')continue;
    assert.deepEqual(bytes(mesh.data),bytes(after.meshes[name].data),`${mode}: ${name} remains byte-identical`);
  }
  assert.deepEqual(bytes(withoutBodySide(before.meshes['l10-io'].data,slots)),bytes(withoutBodySide(after.meshes['l10-io'].data,slots)),'Every I/O triangle outside the eight corrected enclosure faces remains byte-identical');
  const bodies=model=>model.bevels.filter(p=>sameColor(p,[.040,.045,.049])&&near(p.args[7],.32));
  const plates=model=>model.bevels.filter(p=>sameColor(p,[.52,.57,.59])&&near(p.args[3],.004)&&near(p.args[7],.82));
  const oldBodies=bodies(before),newBodies=bodies(after),oldPlates=plates(before),newPlates=plates(after);
  assert.equal(oldBodies.length,8);assert.equal(newBodies.length,8);assert.equal(oldPlates.length,8);assert.equal(newPlates.length,8);
  const drives=[];
  for(let i=0;i<8;i++){
    const oldBody=oldBodies[i].data,newBody=newBodies[i].data,oldPlate=oldPlates[i].data,newPlate=newPlates[i].data;
    assert.deepEqual(bytes(oldPlate),bytes(newPlate),'Nickel insert vertices, normals, opacity and PBR values remain byte-identical');
    assert.deepEqual(bounds(oldBody),bounds(newBody),'SSD physical body bounds remain exact');
    const overlapBefore=coplanarOverlap(oldBody,oldPlate),overlapAfter=coplanarOverlap(newBody,newPlate);
    assert.ok(overlapBefore.area>.17&&overlapBefore.pairs>=2,'Reference RC reproduces positive-area coplanar enclosure/insert overlap');
    assert.equal(overlapAfter.pairs,0,'No positive-area coplanar overlap remains, including bevel faces');
    const negativeX=triangles(newBody).filter(t=>t.every(p=>p[0]===Math.fround(slots[i].body.min[0])));
    const area=triangles(oldBody).filter(t=>t.every(p=>p[0]===Math.fround(slots[i].body.min[0]))).reduce((sum,t)=>sum+Math.hypot(...cross(sub(t[1],t[0]),sub(t[2],t[0])))/2,0);
    const borderArea=negativeX.reduce((sum,t)=>sum+Math.hypot(...cross(sub(t[1],t[0]),sub(t[2],t[0])))/2,0);
    assert.ok(near(borderArea+overlapBefore.area,area,1e-7),'Dark border plus existing nickel insert exactly cover the original side without a hole');
    for(let a=0;a<negativeX.length;a++)for(let b=a+1;b<negativeX.length;b++)assert.ok(overlapArea(negativeX[a],negativeX[b])<1e-10,'Corrected border triangles do not overlap one another');
    drives.push({id:slots[i].id,beforeOverlap:overlapBefore,afterOverlap:overlapAfter});
  }
  results.push({mode,drives});
}
console.log(JSON.stringify({pass:true,reference,checks:['Eight SSDs retain exact envelope and material data','Baseline reproduces the coplanar overlap','No body/insert or border self-overlap after repair','No gaps in the corrected side','Every other mesh and I/O triangle remains byte-identical','Procedural and actual coolingV2 replacement builds'],results},null,2));
