'use strict';
// Project actual GLB cross sections through the uniforms captured from native
// Chromium draws. No image masks, edge guesses, camera fitting or image edits.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/final-rc'),baseline='108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c',variant=process.argv[2]||'before';
assert.ok(['before','after'].includes(variant));
const read=file=>variant==='before'?cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024}):fs.readFileSync(path.join(root,file));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),sub=(a,b)=>a.map((v,i)=>v-b[i]),norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
const transform=(m,p)=>Array.from({length:4},(_,row)=>m[row]*p[0]+m[row+4]*p[1]+m[row+8]*p[2]+m[row+12]*p[3]);
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const bytes=read('app/static/models/l10-cooling-v1/cooling-assembly.glb'),contract=JSON.parse(read('app/static/models/l10-cooling-v1/assembly.json'));
 const scope={window:{},ArrayBuffer,Uint8Array,Float32Array,Float64Array,DataView,TextDecoder,URL,Blob,Math,Number,Set,Map};
 vm.runInNewContext(read('app/static/js/l10-gltf.js').toString(),scope);
 const asset=await scope.window.PAL10GLTF.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),{decodeImage:async(data,mime)=>{const b=Buffer.from(data);assert.equal(mime,'image/png');return {width:b.readUInt32BE(16),height:b.readUInt32BE(20),close(){}};}});
 const report={baseline,variant,pass:false,coolingSHA256:sha(bytes),method:'Actual GLB ring vertices projected as VP × model × part × position, exactly matching the production vertex shader. Width is the range along the screen-space perpendicular to the projected local route tangent. Physical hose OD uses shell vertices independently matched at the same section, not a screenshot mask.',limitations:['Geometric projected width is an upper bound on visible coloured fluid width; occlusion, Fresnel response, antialiasing and optical-density shader contrast can make the perceived core narrower.','No objective photorealism or readability score is inferred from these widths. Plate channels are not round physical pipes and have no claimed pipe OD.','Raw normalized tray radii are not millimetres. Projection includes the original non-uniform model scale.'],frames:[]};
 for(const id of ['dashboard-flow-A','C-dynamic-cooling-flow']){
  const frame=JSON.parse(fs.readFileSync(path.join(out,variant,id+'.json'),'utf8')),fluid=frame.draws.filter(d=>d.flow>0),part=fluid[0].part;
  assert.equal(fluid.length,22);for(const d of fluid)assert.deepEqual(d.part,part);
  const [width,height]=frame.canvas,mat=frame.cameraUniforms;
  const project=p=>{const q=transform(mat.viewProjection,transform(mat.model,transform(part,[...p,1])));assert.ok(q[3]>0);return [(q[0]/q[3]+1)*width/2,(1-q[1]/q[3])*height/2];};
  const rows=[];
  for(const route of contract.flowRoutes){
   const primitive=asset.primitives.find(p=>p.layer==='cooling-fluid'&&p.name.startsWith('Cooling V1 / cooling-fluid / '+route.id+'#'));assert.ok(primitive);
   // Use one actual authored ring nearest half the physical route distance.
   let station=0;for(let i=1;i<route.arcLengths.length;i++)if(Math.abs(route.arcLengths[i]-route.length/2)<Math.abs(route.arcLengths[station]-route.length/2))station=i;
   const center=route.points[station],ringMap=new Map();
   for(let i=0;i<primitive.data.length;i+=12)if(Math.abs(primitive.data[i+6]-route.uvOffset-route.arcLengths[station])<3e-5){const p=Array.from(primitive.data.slice(i,i+3));assert.ok(Math.abs(Math.hypot(...sub(p,center))-route.radius)<3e-6);ringMap.set(p.map(v=>v.toFixed(7)).join(','),p);}
   const ring=[...ringMap.values()];assert.equal(ring.length,12,'Actual twelve-sided stream cross section');
   const tangent=norm(sub(route.points[Math.min(station+1,route.points.length-1)],route.points[Math.max(station-1,0)]));
   const start=project(center.map((v,i)=>v-tangent[i]*.01)),end=project(center.map((v,i)=>v+tangent[i]*.01)),axis=norm(sub(end,start)),perpendicular=[-axis[1],axis[0]];
   const sectionWidth=points=>{const projected=points.map(project),d=projected.map(p=>p[0]*perpendicular[0]+p[1]*perpendicular[1]);return {pixels:Math.max(...d)-Math.min(...d),projected};};
   const core=sectionWidth(ring),branch=/\/(inlet|outlet)$/.test(route.id),channel=route.id.endsWith('/channels'),outerRadius=branch?.0135:channel?null:.017;
   let physical=null;
   if(outerRadius!==null){
    const component=branch?route.id.replace(/\/(inlet|outlet)$/,''):route.semantic,material=route.id.endsWith('header')?'Brushed nickel':'Elastomer hose';
    const shells=asset.primitives.filter(p=>p.layer==='cooling-plumbing'&&p.material.name===material&&p.name.startsWith('Cooling V1 / cooling-plumbing / '+component+'#'));
    const shellVertices=[];for(const p of shells)for(let i=0;i<p.data.length;i+=12)shellVertices.push(Array.from(p.data.slice(i,i+3)));
    assert.ok(shellVertices.length);
    const predicted=ring.map(p=>p.map((v,i)=>center[i]+(v-center[i])*outerRadius/route.radius));
    const matched=predicted.map(p=>{let best=null,distance=Infinity;for(const v of shellVertices){const d=Math.hypot(...sub(p,v));if(d<distance){best=v;distance=d;}}return {point:best,error:distance};});
    // Sixty-four-sided headers differ from twelve-sided streams. Their actual
    // ring is recovered directly by axial plane/radius, not nearest-angle snaps.
    if(route.id.endsWith('header')){
     const candidates=shellVertices.filter(p=>Math.abs(p[0]-center[0])<3e-6&&Math.abs(Math.hypot(p[1]-center[1],p[2]-center[2])-outerRadius)<3e-6);
     const unique=[...new Map(candidates.map(p=>[p.map(v=>v.toFixed(7)).join(','),p])).values()];assert.ok(unique.length>=32);
     physical={radius:outerRadius,...sectionWidth(unique),actualShellVertices:unique.length,maximumCoordinateMatchError:0};
    }else{
     const maximumCoordinateMatchError=Math.max(...matched.map(m=>m.error));assert.ok(maximumCoordinateMatchError<3e-6,route.id+' physical OD independently matches actual shell geometry');
     physical={radius:outerRadius,...sectionWidth(matched.map(m=>m.point)),actualShellVertices:matched.length,maximumCoordinateMatchError};
    }
   }
   rows.push({id:route.id,semantic:route.semantic,branch,station,arcLength:route.arcLengths[station],routeLength:route.length,center,core:{radius:route.radius,rawOD:route.radius*2,...core},physical:physical?{rawOD:physical.radius*2,...physical}:null});
  }
  const branches=rows.filter(r=>r.branch),stats=values=>({min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length});
  report.frames.push({id,source:variant+'/'+id+'.json',canvas:frame.canvas,cameraUniforms:mat,part,branchCorePixels:stats(branches.map(r=>r.core.pixels)),branchPipeODPixels:stats(branches.map(r=>r.physical.pixels)),routes:rows});
 }
 asset.disposeImages();report.pass=true;fs.writeFileSync(path.join(out,'evidence','projected-widths-'+variant+'.json'),JSON.stringify(plain(report),null,2)+'\n');
 console.log(JSON.stringify({variant,pass:report.pass,frames:report.frames.map(({id,canvas,branchCorePixels,branchPipeODPixels})=>({id,canvas,branchCorePixels,branchPipeODPixels}))},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
