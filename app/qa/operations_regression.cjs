// Offline async lifecycle regressions; no fetch or live device operations.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('static/js/app.js','utf8');
function extract(text,name){const start=text.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return text.slice(start,text.indexOf('\n}',start)+2);}
const scope={console,JSON,Number,Set,Array,Date,encodeURIComponent,
  machines:[{name:'a',active_os:1,os_ip:'a',bmc_ip:'ba',level:'rack',project:'p',rack_u:10,rack_size:4}],
  state:{view:'machine'},_activeMachine:'a',machineDetailCache:{},machineDetailRequests:{},
  document:{addEventListener(){}},window:{},RACK_U:48,esc:s=>String(s),rackIsExternal:m=>m.rack_mount==='external',
  setView:()=>{throw Error('stale request navigated')},showDialog(){},closeDialog(){},confirm:()=>true};
vm.createContext(scope);
const ux=fs.readFileSync('static/js/operations-ux.js','utf8');
vm.runInContext(ux.slice(0,ux.indexOf('(function(){')),scope);
vm.runInContext('renderPowerBatch=()=>{}',scope);
(async()=>{
 let placementCalls=[];
 scope.api=async(path,options)=>{placementCalls.push({path,body:JSON.parse(options.body)});};
 scope.loadMachines=async()=>{};
 vm.runInContext(extract(app,'rackPlace'),scope);
 await scope.rackPlace('blank 5U',9,'rack');
 assert.equal(placementCalls[0].path,'/api/machines/blank%205U/placement');
 assert.deepEqual(placementCalls[0].body,{rack_u:9,expected_project:'rack'});
 assert.match(app,/id="rm-add-type" disabled/);
 assert.match(app,/id="rm-add-size" disabled/);
 let resolve;scope.api=()=>new Promise(r=>resolve=r);
 vm.runInContext(extract(app,'machineLoadDetail'),scope);
 let pending=scope.machineLoadDetail('a');scope.state.view='projects';resolve({machine:{name:'a'}});await pending;
 assert.ok(scope.machineDetailCache.a); // cache is allowed; navigation is not
 scope.state.view='machine';pending=scope.machineLoadDetail('a');scope.machines[0].active_os=2;resolve({old:true});await pending;
 assert.equal(scope.machineDetailCache.a.old,undefined);
 let writes=0;scope.rackAssign=()=>{writes++};scope.api=async()=>({machines:[{name:'unplaced',level:'rack',rack_size:8}]});
 vm.runInContext(extract(app,'loadMachines'),scope);await scope.loadMachines();assert.equal(writes,0);assert.equal(scope.machines[0].rack_u,undefined);
 scope.machines=[{name:'occupied',project:'p',level:'rack',rack_u:10,rack_size:4}];
 assert.equal(scope.placementPreview('p','new',12,4).valid,false);
 assert.equal(scope.placementPreview('p','new',6,4).valid,true);
 assert.equal(scope.placementPreview('p','new',2,4).valid,false);
 assert.equal(scope.placementPreview('p','new',0,0,true).valid,true);
 let calls=[];scope.api=async(path,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true}};
 const job={kind:'on',running:true,cancel:false,rows:[{name:'a',state:'waiting',target:{active_os:1,os_ip:'a',bmc_ip:'b'}},{name:'b',state:'waiting',target:{}}]};
 scope.api=async(path,opts)=>{calls.push(JSON.parse(opts.body));job.cancel=true;return {ok:true}};
 await scope.executePowerBatch(job);assert.equal(calls.length,1);assert.equal(job.rows[0].state,'success');assert.equal(job.rows[1].state,'cancelled');assert.equal(calls[0].expected_target.os_ip,'a');
 job.cancel=false;job.running=true;job.rows[0].state='waiting';scope.api=async()=>{throw Error('network unavailable')};await scope.executePowerBatch(job);assert.equal(job.rows[0].state,'failed');assert.equal(job.running,false);
 const kvm=fs.readFileSync('static/js/kvm_broadcast.js','utf8');let disconnected=0;
 const k={K:{rfbMap:new Map([['a',{rfb:{disconnect(){disconnected++}}}]]),overlay:{style:{}}},kvmGeneration:0,
  clearTimeout(){},$:()=>null};vm.createContext(k);vm.runInContext(extract(kvm,'closeKvmBroadcast'),k);
 k.closeKvmBroadcast();assert.equal(disconnected,1);assert.equal(k.kvmGeneration,1);assert.equal(k.K.rfbMap.size,0);
 // Resolve detection after close: no stale UI/client creation is permitted.
 const ids={'kvm-grid':{innerHTML:''},'kvm-master':{innerHTML:''}};
 Object.assign(k,{$:id=>ids[id],kvmCandidates:()=>[{name:'a'}],ensureOverlay:()=>({style:{}}),setBanner(){},detectProjectBasecodes:()=>new Promise(r=>resolve=r)});
 vm.runInContext(extract(kvm,'openKvmBroadcast'),k);pending=k.openKvmBroadcast('p');k.closeKvmBroadcast();resolve({ok:true,data:{machines:{}}});await pending;
 console.log('PASS: stale detail/slot responses, read-only list loading, placement overlap/bounds, batch cancel/errors/target snapshot, KVM cleanup and cancelled detection');
})().catch(e=>{console.error(e);process.exitCode=1});
