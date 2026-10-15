'use strict';
// The sheet and flush socket must have one surface owner, not two equal depths.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),reference='1005e3033c206be9cae0d84089e9ba786af4bff0';
const file='app/static/js/l10-hardware.js',rack='app/static/js/rack-equipment-scene.js';
const before=execFileSync('git',['show',reference+':'+file],{cwd:root,encoding:'utf8'}),after=fs.readFileSync(path.join(root,file),'utf8');
const rackSource=fs.readFileSync(path.join(root,rack),'utf8');
assert.equal(rackSource,execFileSync('git',['show',reference+':'+rack],{cwd:root,encoding:'utf8'}),'Rack geometry unchanged');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function build(source,options){const c={window:{},Float32Array,Math};vm.runInNewContext(rackSource,c);vm.runInNewContext(source,c);return c.window.PAL10Hardware.build(c.window.PAL10Hardware.profile,options);}
const plane=t=>t.every(p=>p[2]===Math.fround(-2.949)&&p[3]===0&&p[4]===0&&p[5]===1);
const tris=d=>Array.from({length:d.length/36},(_,i)=>[0,12,24].map(o=>Array.from(d.slice(i*36+o,i*36+o+12))));
const area=t=>Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))/2;
const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
function overlap(a,b){
 let poly=a.map(p=>p.slice(0,2)),clip=b.map(p=>p.slice(0,2));if(cross(...clip)<0)clip.reverse();
 for(let i=0;i<3&&poly.length;i++){const p=clip[i],q=clip[(i+1)%3],next=[];for(let j=0;j<poly.length;j++){const s=poly[j],e=poly[(j+1)%poly.length],ds=cross(p,q,s),de=cross(p,q,e);if(ds>=0)next.push(s);if((ds>=0)!==(de>=0)){const t=ds/(ds-de);next.push(s.map((v,k)=>v+(e[k]-v)*t));}}poly=next;}
 return Math.abs(poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
}
const flatBytes=t=>bytes(new Float32Array(t.flat(2)));
const bounds=d=>[0,1,2].map(k=>{const values=[];for(let i=k;i<d.length;i+=12)values.push(d[i]);return [Math.min(...values),Math.max(...values)];});
const results=[];
for(const [mode,options]of [['procedural',{}],['coolingV2-runtime',{omitBareBoards:true,replaceServiceGeometry:true,replaceNetworking:true}]]){
 const a=build(before,options),b=build(after,options);
 for(const [name,m]of Object.entries(a.meshes))if(name!=='l10-chassis')assert.deepEqual(bytes(m.data),bytes(b.meshes[name].data),`${name} byte-identical, including SSD and busbar socket`);
 const old=tris(a.meshes['l10-chassis'].data),now=tris(b.meshes['l10-chassis'].data),socket=tris(b.meshes['l10-io'].data).filter(plane);
 const original=old.filter(plane),border=now.filter(plane);
 assert.equal(original.length,2);assert.equal(border.length,8);assert.equal(socket.length,2);
 assert.deepEqual(flatBytes(old.filter(t=>!plane(t))),flatBytes(now.filter(t=>!plane(t))),'Every chassis triangle outside the single inner face is byte-identical');
 assert.deepEqual(bounds(a.meshes['l10-chassis'].data),bounds(b.meshes['l10-chassis'].data),'Exact chassis bounds unchanged');
 for(const t of border)for(const p of t)assert.deepEqual(p.slice(3),original[0][0].slice(3),'Normals, opacity and PBR values unchanged');
 const count=(x,y)=>{let pairs=0,total=0;for(const p of x)for(const q of y){const v=overlap(p,q);if(v>1e-10){pairs++;total+=v;}}return {pairs,area:total};};
 const oldOverlap=count(original,socket),newOverlap=count(border,socket);
 assert.equal(oldOverlap.pairs,4);assert.ok(oldOverlap.area>.043);assert.equal(newOverlap.pairs,0);
 const originalArea=original.reduce((n,t)=>n+area(t),0),borderArea=border.reduce((n,t)=>n+area(t),0),socketArea=socket.reduce((n,t)=>n+area(t),0);
 assert.ok(Math.abs(originalArea-borderArea-socketArea)<1e-8,'Border plus original socket exactly fill the original plane: no hole');
 for(let i=0;i<border.length;i++)for(let j=i+1;j<border.length;j++)assert.ok(overlap(border[i],border[j])<1e-10,'Border has no self-overlap');
 results.push({mode,before:oldOverlap,after:newOverlap,originalArea,borderArea,socketArea});
}
console.log(JSON.stringify({pass:true,reference,unchanged:['Rack source','All I/O including SSD/socket','All other L10 meshes','All chassis triangles except one inner wall face','Chassis bounds, normals, alpha and PBR values'],results},null,2));
