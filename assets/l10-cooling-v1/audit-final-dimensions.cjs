/* Read-only Final RC dimension/contact audit and in-memory stream proposal.
 * Reuses the committed V3 SAT/contact/path assertions without modifying them.
 * No authored Blender, GLB, metadata, textures or inventory are written.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),baseline='108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c',glbPath='app/static/models/l10-cooling-v1/cooling-assembly.glb';
const output=path.join(root,'docs/screenshots/l10-cinematic/final-rc/evidence');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),plain=x=>JSON.parse(JSON.stringify(x));
const source=fs.readFileSync(path.join(root,'app/qa/l10-cooling-v3.cjs'),'utf8'),exportsBox={exports:{}};
new Function('require','module','__dirname',source+'\nmodule.exports={loadGLB,allTriangles,coolingGeometry,coolingPaths,coolingCollisions,helperFixtures,pathDistance};')(require,exportsBox,path.join(root,'app/qa'));
const qa=exportsBox.exports;
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),add=(a,b,s)=>a.map((v,i)=>v+s*b[i]),clamp=x=>Math.max(0,Math.min(1,x));
function segmentDistance(p1,q1,p2,q2){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
 if(a<1e-16&&e<1e-16)return Math.hypot(...r);
 if(a<1e-16)t=clamp(f/e);else{const c=dot(d1,r);if(e<1e-16)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 return Math.hypot(...sub(add(p1,d1,s),add(p2,d2,t)));
}
assert.equal(segmentDistance([0,0,0],[1,0,0],[0,.035,0],[1,.035,0]),.035);
assert.equal(segmentDistance([0,0,0],[1,0,0],[.5,-1,0],[.5,1,0]),0);
const range=values=>({min:Math.min(...values),max:Math.max(...values)});
(async()=>{
 const original=fs.readFileSync(path.join(root,glbPath)),currentSHA=sha(original),loaded=await qa.loadGLB(glbPath),bare=await qa.loadGLB();
 const contract=JSON.parse(fs.readFileSync(path.join(root,'app/static/models/l10-cooling-v1/assembly.json'),'utf8'));
 const oldContract=JSON.parse(cp.execFileSync('git',['show',baseline+':app/static/models/l10-cooling-v1/assembly.json'],{cwd:root,encoding:'utf8'}));
 const report={baseline,readOnly:true,glbSHA256:currentSHA,checks:[],units:'PA raw display units, not millimetres or an OEM hydraulic specification',displayScale:[.688,1,.802]};
 qa.helperFixtures();
 for(const key of ['seats','mounts','envelope'])assert.deepEqual(contract[key],oldContract[key]);
 const geometry=qa.coolingGeometry(report,bare.asset,loaded.asset,contract),routeMap=new Map(contract.flowRoutes.map(r=>[r.id,r]));
 report.headerDimensions=['supply','return'].map(semantic=>{
  const route=routeMap.get(semantic+'-header'),center=route.points[0];
  const vertices=geometry.tris.filter(t=>t.layer==='cooling-plumbing'&&t.component===semantic&&t.material==='Brushed nickel').flatMap(t=>t.v).filter(p=>p[0]>=-1.780001&&p[0]<=1.780001&&Math.hypot(p[1]-center[1],p[2]-center[2])<.017001);
  const radii=range(vertices.map(p=>Math.hypot(p[1]-center[1],p[2]-center[2])));
  assert.ok(Math.abs(radii.max-.017)<1e-6);assert.ok(radii.min>.0119&&radii.min<.012001);
  return{semantic,centerline:route.points,length:route.length,nominalOuterDiameter:.034,nominalInnerDiameter:.024,nominalWallThickness:.005,actualVertexRadialRange:radii,streamRadius:route.radius,streamRadialNominalMargin:.012-route.radius,lidClearance:.125-center[1]-.017,doubledOuterDiameterLidClearance:.125-center[1]-.034};
 });
 const branches=contract.flowRoutes.filter(r=>/\/(inlet|outlet)$/.test(r.id));assert.equal(branches.length,12);
 report.branchDimensions=contract.seats.map(seat=>{
  const paths=[routeMap.get(seat.id+'/inlet'),routeMap.get(seat.id+'/outlet')];
  const vertices=geometry.tris.filter(t=>t.layer==='cooling-plumbing'&&t.component===seat.id&&t.material==='Elastomer hose').flatMap(t=>t.v);
  const radii=range(vertices.map(p=>Math.min(...paths.map(r=>qa.pathDistance(p,r.points)))));
  assert.ok(Math.abs(radii.max-.0135)<2e-6);assert.ok(radii.min>.0101);
  return{seat:seat.id,nominalOuterDiameter:.027,nominalInnerDiameter:.021,nominalWallThickness:.003,actualVertexRadialRange:radii,streamRadius:paths[0].radius,streamRadialNominalMargin:.0105-paths[0].radius,plateWidth:seat.plateWidth,branchODtoPlateWidth:.027/seat.plateWidth};
 });
 const spacing=[];
 for(let i=0;i<branches.length;i++)for(let j=i+1;j<branches.length;j++){
  const a=branches[i],b=branches[j];let distance=Infinity;
  for(let k=1;k<a.points.length;k++)for(let l=1;l<b.points.length;l++)distance=Math.min(distance,segmentDistance(a.points[k-1],a.points[k],b.points[l-1],b.points[l]));
  spacing.push({routes:[a.id,b.id],centerlineDistance:distance,nominalOuterSurfaceClearance:distance-.027,doubledOuterDiameterClearance:distance-.054});
 }
 spacing.sort((a,b)=>a.centerlineDistance-b.centerlineDistance);report.nearestBranchPairs=spacing.slice(0,8);
 report.connectorDimensions=contract.seats.map(seat=>({seat:seat.id,ports:['inlet','outlet'].map(port=>{
  const p=seat[port],start=seat.center[2]+seat.plateDepth/2-.012,end=p[2]+.008;
  const vertices=geometry.tris.filter(t=>t.layer==='cooling-frame'&&t.component===seat.id&&t.material==='Machined nickel fittings').flatMap(t=>t.v).filter(v=>Math.abs(v[0]-p[0])<.020001&&v[2]>start-1e-6&&v[2]<end+1e-6);
  const radii=range(vertices.map(v=>Math.hypot(v[0]-p[0],v[1]-p[1])));assert.ok(Math.abs(radii.min-.0145)<1e-6&&Math.abs(radii.max-.020)<1e-6);
  return{port,center:p,axialBounds:[start,end],length:end-start,actualRadialRange:radii,outerDiameter:.040,boreDiameter:.029,maxRadialWall:.0055,hoseToBoreNominalRadialGap:.001,portAxisSeparation:.38,relativeOuterDiameterToPlateWidth:.040/seat.plateWidth};
 })}));
 const proposedRadius=.009,proposal={checks:[],status:'not-run',changedRouteIds:branches.map(r=>r.id),branchStreamRadius:proposedRadius,widthGainPercent:(proposedRadius/.0068-1)*100,nominalBoreMargin:.0105-proposedRadius,conservativeStraight12SideBoreMargin:.0105*Math.cos(Math.PI/12)-proposedRadius,plateChannelRadius:.009,headerStreamRadius:.0105,physicalSolidMeshesUnchanged:true};
 const candidate={...loaded.asset,primitives:loaded.asset.primitives.map(p=>({...p,data:new Float32Array(p.data)}))},candidateContract=plain(contract);
 for(const route of candidateContract.flowRoutes.filter(r=>/\/(inlet|outlet)$/.test(r.id))){
  const previousRadius=route.radius;
  for(const primitive of candidate.primitives.filter(p=>p.layer==='cooling-fluid'&&p.name.startsWith('Cooling V1 / cooling-fluid / '+route.id+'#'))){
   const data=primitive.data;for(let i=0;i<data.length;i+=12){const arc=data[i+6]-route.uvOffset,k=route.arcLengths.findIndex(x=>Math.abs(x-arc)<3e-5);assert.ok(k>=0);
    const center=route.points[k];for(let axis=0;axis<3;axis++)data[i+axis]=center[axis]+(data[i+axis]-center[axis])*proposedRadius/previousRadius;
   }
  }
  route.radius=proposedRadius;
 }
 const scope={window:{},Float32Array,Math};vm.runInNewContext(fs.readFileSync(path.join(root,'app/static/js/rack-equipment-scene.js'),'utf8'),scope);vm.runInNewContext(fs.readFileSync(path.join(root,'app/static/js/l10-hardware.js'),'utf8'),scope);
 qa.coolingPaths(proposal,candidate,candidateContract,scope.window.PAL10Hardware.profile);
 qa.coolingCollisions(proposal,qa.allTriangles(candidate),geometry.bareTris,candidateContract);
 proposal.status='PASS';proposal.method='In-memory radial expansion of the actual delivered branch stream triangles; unchanged V3 path, SAT, contact and containment assertions, including every bend/port/header junction against all companion solids and frozen bare hardware.';
 report.proposedStream=proposal;report.physicalSizingConclusion='Retain all physical OD/ID and centerlines. Doubling causes negative lid, branch-spacing and socket margins. A larger explanatory stream core is a separate bounded visualization change.';
 assert.equal(sha(fs.readFileSync(path.join(root,glbPath))),currentSHA);loaded.asset.disposeImages();bare.asset.disposeImages();
 report.passed=true;report.stage=process.argv.includes('--final')?'actual-export-final':'pre-edit-proposal';fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,process.argv.includes('--final')?'dimensions-final.json':'dimensions-and-stream-proposal.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:true,glbSHA256:currentSHA,headerDimensions:report.headerDimensions,nearestBranchPairs:report.nearestBranchPairs.slice(0,2),streamProposal:{radius:proposedRadius,widthGainPercent:proposal.widthGainPercent,nominalBoreMargin:proposal.nominalBoreMargin,conservativeStraight12SideBoreMargin:proposal.conservativeStraight12SideBoreMargin,fluidWallCollisions:proposal.fluidWallAudit.collisionPairs,bareCollisions:proposal.bareCollisionAudit.collisionPairs},output:path.relative(root,output)},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
