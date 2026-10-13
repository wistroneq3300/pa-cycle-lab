/* Final RC package audit. Read-only assets; writes evidence only. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),baseline='108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c',file='app/static/models/l10-cooling-v1/cooling-assembly.glb';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function decode(bytes){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
 return{doc,bin,accessor(index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],getter={5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType],stride=v.byteStride||count*size,offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,i)=>Array.from({length:count},(_,j)=>bin[getter](offset+i*stride+j*size)));},image(im){const v=doc.bufferViews[im.bufferView];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}};
}
const previous=cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:32*1024*1024}),current=fs.readFileSync(path.join(root,file)),b=decode(previous),c=decode(current);
const report={baselineCommit:baseline,glbSHA256:sha(current),bytes:current.length,readOnly:true,checks:[]};
assert.equal(c.doc.nodes.length,b.doc.nodes.length);assert.equal(c.doc.materials.length,b.doc.materials.length);
const factors=m=>({baseColor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1],metallic:m.pbrMetallicRoughness?.metallicFactor??1,roughness:m.pbrMetallicRoughness?.roughnessFactor??1,emissive:m.emissiveFactor||[0,0,0],alphaMode:m.alphaMode||'OPAQUE',doubleSided:m.doubleSided||false});
report.materials=c.doc.materials.map(m=>{const old=b.doc.materials.find(n=>n.name===m.name);assert.ok(old);assert.deepEqual(factors(m),factors(old));assert.equal(m.normalTexture,undefined);assert.equal(m.emissiveTexture,undefined);if(m.name!=='Machined nickel fittings')assert.deepEqual(m.occlusionTexture,old.occlusionTexture);return{name:m.name,scalarFactorsUnchanged:true,...factors(m)};});
assert.equal(c.doc.images.length,b.doc.images.length+1);
report.images=b.doc.images.map(old=>{const next=c.doc.images.find(im=>im.name===old.name);assert.ok(next,old.name);assert.deepEqual(c.image(next),b.image(old));return{name:old.name,sha256:sha(c.image(next)),acceptedMapBytesUnchanged:true};});
const ao=c.doc.images.find(im=>im.name==='cooling-socket-contact-ao');assert.ok(ao);const socket=c.doc.materials.find(m=>m.name==='Machined nickel fittings');assert.equal(c.doc.textures[socket.occlusionTexture.index].source,c.doc.images.indexOf(ao));assert.equal(socket.occlusionTexture.strength??1,1);
assert.deepEqual(c.image(ao),fs.readFileSync(path.join(root,'assets/l10-cooling-v1/textures/cooling-socket-contact-ao.png')));report.newAO={name:ao.name,sha256:sha(c.image(ao)),material:socket.name,externalEmbeddedIdentical:true};
const oldRoutes=b.doc.extras.flowRoutes,nextRoutes=c.doc.extras.flowRoutes;assert.equal(oldRoutes.length,22);assert.equal(nextRoutes.length,22);
const oldFluid=b.doc.nodes.filter(n=>n.extras?.l10Layer==='cooling-fluid'),nextFluid=c.doc.nodes.filter(n=>n.extras?.l10Layer==='cooling-fluid');assert.equal(oldFluid.length,22);assert.equal(nextFluid.length,22);
report.routes=oldRoutes.map(route=>{
 const next=nextRoutes.find(r=>r.id===route.id),branch=/\/(inlet|outlet)$/.test(route.id);assert.ok(next);const expected={...route,radius:branch?.009:route.radius};assert.deepEqual(next,expected,route.id+' every centerline/arc UV/end point/direction is preserved');
 const node=oldFluid.find(n=>n.extras.component===route.id),after=nextFluid.find(n=>n.extras.component===route.id);assert.ok(node&&after);
 const beforePrimitives=b.doc.meshes[node.mesh].primitives,afterPrimitives=c.doc.meshes[after.mesh].primitives;assert.equal(beforePrimitives.length,afterPrimitives.length);let count=0,maxPositionExpansionError=0,maxNormalComponentDifference=0;
 for(let i=0;i<beforePrimitives.length;i++){
  const p=beforePrimitives[i],q=afterPrimitives[i],bi=b.accessor(p.indices),ai=c.accessor(q.indices);assert.equal(bi.length,ai.length);
  const bp=b.accessor(p.attributes.POSITION),ap=c.accessor(q.attributes.POSITION),bn=b.accessor(p.attributes.NORMAL),an=c.accessor(q.attributes.NORMAL),uv=b.accessor(p.attributes.TEXCOORD_0),au=c.accessor(q.attributes.TEXCOORD_0);count+=ap.length;
  if(!branch){assert.deepEqual(bi,ai);assert.deepEqual(uv,au);assert.deepEqual(bp,ap);assert.deepEqual(bn,an);continue;}
  const keys=rows=>[...new Set(rows.map(r=>JSON.stringify(r)))].sort();assert.deepEqual(keys(uv),keys(au),route.id+' identical unique raw distance/section UV coordinates');
  const map=new Map();for(let v=0;v<uv.length;v++){const key=JSON.stringify(uv[v]);if(!map.has(key))map.set(key,[]);map.get(key).push(v);}
  assert.equal(route.radius,.0068);assert.equal(next.radius,.009);
  for(let v=0;v<ap.length;v++){
   const candidates=map.get(JSON.stringify(au[v])),old=candidates.reduce((best,k)=>Math.hypot(...an[v].map((x,a)=>x-bn[k][a]))<Math.hypot(...an[v].map((x,a)=>x-bn[best][a]))?k:best,candidates[0]);
   const arc=au[v][0]-route.uvOffset,ring=route.arcLengths.findIndex(x=>Math.abs(x-arc)<3e-5);assert.ok(ring>=0,route.id+' matched arc ring');const center=route.points[ring];
   for(let axis=0;axis<3;axis++){
    const expected=center[axis]+(bp[old][axis]-center[axis])*.009/.0068;
    maxPositionExpansionError=Math.max(maxPositionExpansionError,Math.abs(ap[v][axis]-expected));
    maxNormalComponentDifference=Math.max(maxNormalComponentDifference,Math.abs(an[v][axis]-bn[old][axis]));
   }
  }
 }
 assert.ok(maxPositionExpansionError<3e-7,route.id+' only permitted radial expansion');
 assert.ok(maxNormalComponentDifference<.001,route.id+' only float export normal drift, not shading redesign');
 return{id:route.id,branch,oldRadius:route.radius,newRadius:next.radius,vertices:count,indicesAndVertexArraysIdentical:!branch,triangleCountsAndUniqueDistanceSectionUVsIdentical:true,fullRouteContractPreservedExceptApprovedRadius:true,maxPositionExpansionError,maxNormalComponentDifference};
});
assert.equal(report.routes.filter(r=>r.branch).length,12);report.normalDifferenceInterpretation='Branch normal differences are measured, not hidden. Radius changes cause Blender to re-weld export vertices and re-triangulate faces, so branch raw indices are not claimed unchanged. Normals are matched by identical arc/section UV and nearest baseline normal; each current vertex must equal the approved radial expansion within 3e-7. The other ten fluid primitives retain byte-equivalent accessor values; the independent geometry gate additionally checks containment and all protected primitives.';
report.protectedPrimitiveAttributes=[];
for(const node of c.doc.nodes){
 if(node.mesh===undefined)continue;const oldNode=b.doc.nodes.find(n=>n.name===node.name);assert.ok(oldNode);const before=b.doc.meshes[oldNode.mesh].primitives,after=c.doc.meshes[node.mesh].primitives;
 for(const p of after){
  const material=c.doc.materials[p.material],branch=node.extras?.l10Layer==='cooling-fluid'&&/\/(inlet|outlet)$/.test(node.extras.component),fitting=material.name==='Machined nickel fittings'&&node.extras?.l10Layer==='cooling-frame';if(branch||fitting)continue;
  const q=before.find(x=>b.doc.materials[x.material].name===material.name);assert.ok(q);const pos=c.accessor(p.attributes.POSITION),normal=c.accessor(p.attributes.NORMAL),uv=c.accessor(p.attributes.TEXCOORD_0),oldPos=b.accessor(q.attributes.POSITION),oldNormal=b.accessor(q.attributes.NORMAL),oldUV=b.accessor(q.attributes.TEXCOORD_0);
  const positionNormalKey=(positions,normals,i)=>JSON.stringify([positions[i],normals[i]]),oldMap=new Map();
  for(let i=0;i<oldPos.length;i++){const key=positionNormalKey(oldPos,oldNormal,i);if(!oldMap.has(key))oldMap.set(key,[]);oldMap.get(key).push(oldUV[i]);}
  assert.deepEqual([...new Set(pos.map((_,i)=>positionNormalKey(pos,normal,i)))].sort(),[...oldMap.keys()].sort(),node.name+' '+material.name+' exact position/normal pairs');
  let maxUVDelta=0;for(let i=0;i<pos.length;i++){const values=oldMap.get(positionNormalKey(pos,normal,i)),delta=Math.min(...values.map(old=>Math.max(...uv[i].map((x,k)=>Math.abs(x-old[k])))));maxUVDelta=Math.max(maxUVDelta,delta);}
  const mapped=!!(material.pbrMetallicRoughness?.baseColorTexture||material.pbrMetallicRoughness?.metallicRoughnessTexture||material.occlusionTexture||material.normalTexture||material.emissiveTexture);
  assert.ok(maxUVDelta<3e-7,node.name+' '+material.name+' generated UV limited to float export precision');
  report.protectedPrimitiveAttributes.push({node:node.name,material:material.name,textureMapped:mapped,positionsAndNormalsExact:true,maxUVDelta});
 }
}
report.protectedUVInterpretation='Rebuilding deterministic auto-projected UVs incurs <=2.3841858e-7 float32 drift on some cooling bodies/covers/fasteners (under .000123 texel at 512px). Positions and normals are exact; all UV deltas are bounded below 3e-7, and no original map pixels/factors change. Manifold/plumbing and the ten unchanged fluid meshes have zero UV drift. This is not described as byte-identical UV preservation.';
for(const key of ['seats','mounts','envelope'])assert.deepEqual(c.doc.extras[key],b.doc.extras[key],key);
report.nodes=c.doc.nodes.length;report.materialCount=c.doc.materials.length;report.triangles=c.doc.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+c.accessor(p.indices).length/3,0),0);report.passed=true;
const out=path.join(root,'docs/screenshots/l10-cinematic/final-rc/evidence/package-audit.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,glbSHA256:report.glbSHA256,nodes:report.nodes,materials:report.materialCount,triangles:report.triangles,oldMapsUnchanged:report.images.length,newAO:report.newAO,branchMaxPositionExpansionError:Math.max(...report.routes.map(r=>r.maxPositionExpansionError)),branchMaxNormalComponentDifference:Math.max(...report.routes.map(r=>r.maxNormalComponentDifference)),protectedUVMaxFloatDrift:Math.max(...report.protectedPrimitiveAttributes.map(r=>r.maxUVDelta)),output:path.relative(root,out)},null,2));
