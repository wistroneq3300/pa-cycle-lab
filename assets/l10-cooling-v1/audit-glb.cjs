'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),file='app/static/models/l10-cooling-v1/cooling-assembly.glb';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const r=Math.hypot(...a);return a.map(v=>v/r);};
function decode(bytes){const n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);return{doc,accessor(index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView],count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],getter={5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType],stride=v.byteStride||count*size,offset=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,i)=>Array.from({length:count},(_,j)=>bin[getter](offset+i*stride+j*size)));}};}
function audit(bytes){const{doc,accessor}=decode(bytes),rows=[];
 for(const[component,yy,zz]of[['supply',.066,-.43],['return',.100,-.33]]){
  const angles=[],axial=[],seams=[];let triangles=0;
  for(const node of doc.nodes){if(node.extras?.l10Layer!=='cooling-plumbing'||node.extras.component!==component)continue;
   for(const primitive of doc.meshes[node.mesh].primitives){if(doc.materials[primitive.material].name!=='Brushed nickel')continue;
    const p=accessor(primitive.attributes.POSITION),n=accessor(primitive.attributes.NORMAL),uv=accessor(primitive.attributes.TEXCOORD_0),indices=accessor(primitive.indices).flat();
    for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),v=ids.map(k=>p[k]);
     if(v.some(a=>a[0]<-1.78001||a[0]>1.78001||Math.abs(Math.hypot(a[1]-yy,a[2]-zz)-.017)>.0004))continue;
     const gn=norm(cross(sub(v[1],v[0]),sub(v[2],v[0]))),center=v[0].map((_,j)=>v.reduce((s,a)=>s+a[j],0)/3),radial=norm([0,center[1]-yy,center[2]-zz]);
     if(Math.abs(gn[0])>.001||dot(gn,radial)<.98)continue;triangles++;
     const vv=ids.map(k=>uv[k][1]);if(Math.max(...vv)-Math.min(...vv)>.5)seams.push(i/3);
     for(const k of ids){const r=norm([0,p[k][1]-yy,p[k][2]-zz]);angles.push(Math.acos(Math.max(-1,Math.min(1,dot(r,norm(n[k])))))*180/Math.PI);axial.push(Math.abs(n[k][0]));}
    }
   }
  }
  rows.push({component,exteriorTriangles:triangles,corners:angles.length,radialNormalErrorDegrees:{mean:angles.reduce((a,b)=>a+b,0)/angles.length,max:Math.max(...angles),over5:angles.filter(a=>a>5).length},maxAxialNormal:Math.max(...axial),UVWrapCrossingTriangles:seams.length});
 }
 return rows;
}
const baseline=cp.execFileSync('git',['show','5f8e059c6e0c1a614fe412b990a463d643fc0a32:'+file],{cwd:root,maxBuffer:32*1024*1024}),current=fs.readFileSync(path.join(root,file));
const report={method:'Independent decoding of exported GLB POSITION/NORMAL/TEXCOORD/index accessors; geometric triangle normals isolate true straight manifold outer surfaces.',baselineCommit:'5f8e059c6e0c1a614fe412b990a463d643fc0a32',glbSHA256:crypto.createHash('sha256').update(current).digest('hex'),scriptSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),before:audit(baseline),after:audit(current)};
for(const row of report.after){assert.ok(row.corners>300);assert.ok(row.radialNormalErrorDegrees.max<.1);assert.ok(row.maxAxialNormal<.00001);assert.equal(row.UVWrapCrossingTriangles,0);}
const b=decode(baseline),c=decode(current),bfluid=b.doc.nodes.filter(n=>n.extras?.l10Layer==='cooling-fluid'),cfluid=c.doc.nodes.filter(n=>n.extras?.l10Layer==='cooling-fluid');
report.materialPreservation=c.doc.materials.map(material=>{const old=b.doc.materials.find(m=>m.name===material.name);assert.ok(old,material.name);const factors=m=>({baseColor:m.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1],metallic:m.pbrMetallicRoughness?.metallicFactor??1,roughness:m.pbrMetallicRoughness?.roughnessFactor??1,emissive:m.emissiveFactor||[0,0,0],alphaMode:m.alphaMode||'OPAQUE'});assert.deepEqual(factors(material),factors(old),material.name+' PBR scalar factors unchanged');assert.equal(material.normalTexture,undefined);return{name:material.name,scalarFactorsUnchanged:true,...factors(material),normalTexture:false};});
assert.equal(bfluid.length,22);assert.equal(cfluid.length,22);
for(const node of bfluid){const next=cfluid.find(n=>n.extras.component===node.extras.component),bp=b.doc.meshes[node.mesh].primitives,cp=c.doc.meshes[next.mesh].primitives;assert.equal(bp.length,cp.length);for(let i=0;i<bp.length;i++){assert.deepEqual(b.accessor(bp[i].indices),c.accessor(cp[i].indices));for(const field of['POSITION','NORMAL','TEXCOORD_0'])assert.deepEqual(b.accessor(bp[i].attributes[field]),c.accessor(cp[i].attributes[field]),node.name+' '+field);}}
assert.deepEqual(b.doc.extras.flowRoutes,c.doc.extras.flowRoutes);report.streamPreservation={routes:22,allPositionsNormalsUVsIndicesIdentical:true,flowRoutesContractIdentical:true};report.passed=true;
const out=path.join(root,'docs/screenshots/l10-cinematic/cooling-v3/evidence');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'manifold-glb-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
