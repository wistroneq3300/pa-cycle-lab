/* Shipping player lifecycle: explicit profile, delayed readiness and failure.
 * Real player/timeline source with deterministic DOM/RAF doubles; GPU evidence
 * is handled by the separate native Chromium playback suite. No output writes. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
function target(){
  const listeners=new Map();
  return {dataset:{},style:{},attributes:{},disabled:false,hidden:false,children:[],textContent:'',
    addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
    removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
    dispatch(name){for(const fn of [...(listeners.get(name)||[])])fn({type:name});},
    setAttribute(name,value){this.attributes[name]=value;},replaceChildren(...nodes){this.children=nodes;this.textContent='';},append(node){this.children.push(node);},
    focus(){},click(){if(!this.disabled)this.onclick?.();},listenerCount(name){return listeners.get(name)?.size||0;}};
}
function harness({status,reduce=false,played=false,mountFallback=false}={}){
  let now=0,next=0,sceneProgress=0;
  const frames=new Map(),timers=new Map(),storage=new Map(),writes=[];
  if(played)storage.set('pa_dashboard_cinematic_l10_v1_played','1');
  const stage=target(),canvas=target(),story=target(),overview=target(),help=target(),tools=target(),replay=target(),skip=target(),rear=target(),reset=target(),reduced=target();
  reduced.matches=reduce;canvas.dataset.coreProfile='coolingV2';if(status)canvas.dataset.coreState=status;
  canvas.paCoreScene={setProgress(p){sceneProgress=p;writes.push(p);},getState(){return {progress:sceneProgress};},resetOrbit(){}};
  if(mountFallback){stage.dataset.scene='fallback';delete canvas.paCoreScene;}
  const ids={'core-stage':stage,'system-core':canvas,'core-story':story,'core-interaction-help':help,'core-tools':tools};
  const nodes=new Map([['[data-vo-replay]',replay],['[data-vo-skip]',skip],['#core-tools',tools]]);
  const query=selector=>{if(!nodes.has(selector))nodes.set(selector,target());return nodes.get(selector);};
  for(const node of [stage,story,overview]){node.querySelector=query;node.querySelectorAll=selector=>selector==='[data-core-view]'?[rear,reset]:[];}
  story.offsetHeight=1440;overview.isConnected=true;
  const window=target(),document=Object.assign(target(),{hidden:false,activeElement:null,getElementById:id=>ids[id],querySelector:selector=>selector==='.vo-overview'?overview:null,createElement:target});
  const scope={window,document,Math,Date,Float32Array,console,RENDERERS:{},_renderMachine(){},state:{view:'dashboard'},scrollY:0,
    matchMedia:()=>reduced,fetch:()=>new Promise(()=>{}),sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    requestAnimationFrame:fn=>{const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++next,clearInterval(){}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'app/static/js/l10-timeline.js'),'utf8'),scope);
  vm.runInNewContext(fs.readFileSync(path.join(root,'app/static/js/validation-overview.js'),'utf8'),scope);
  function frame(ms=16){now+=ms;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));}
  scope._renderMachine();frame();
  const player=story.paHeroPlayback;
  function ready(){canvas.dataset.coreState='ready';canvas.dataset.coreCooling='ready';canvas.dataset.coreAsset='ready';canvas.dataset.coreEnvironment='ready';canvas.dispatch('pa-core-ready');}
  function fail(){canvas.dataset.coreState='fallback';canvas.dataset.coreCooling='fallback';canvas.dispatch('pa-core-fallback');}
  return {scope,canvas,story,help,replay,skip,rear,reset,reduced,document,window,storage,writes,player,frame,ready,fail};
}
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
check('Ordinary Dashboard explicitly requests coolingV2 before mounting; undefined/loading state never spends movie time',()=>{
  const h=harness();assert.match(h.scope.RENDERERS.dashboard(),/<canvas id="system-core" data-core-profile="coolingV2"/);
  assert.equal(h.player.getState().timelineMode,'coolingV2');assert.equal(h.player.getState().duration,39700);
  h.frame(5000);assert.equal(h.player.getState().elapsedMs,0);assert.ok(h.replay.disabled&&h.skip.disabled&&h.rear.disabled&&h.reset.disabled);
  assert.equal(h.storage.size,0,'A failed initial load must not count as an already-played movie');
  h.canvas.dataset.coreState='loading';h.player.replay();h.player.resume();h.frame(5000);assert.equal(h.player.getState().elapsedMs,0);
  h.ready();h.frame();h.frame();assert.ok(h.player.getState().elapsedMs>0&&h.player.getState().elapsedMs<40,'Delayed load cannot produce an elapsed-time jump');
  assert.equal(h.replay.disabled,false);assert.equal(h.skip.disabled,false);assert.equal(h.storage.size,1);
});
check('Seek queues during loading and an explicit Resume starts at that target only after complete readiness',()=>{
  const h=harness({status:'loading'});h.player.seekTime(12000);h.player.resume();h.frame(5000);assert.equal(h.player.getState().elapsedMs,0);
  h.ready();assert.ok(Math.abs(h.player.getState().elapsedMs-12000)<.001);h.frame();h.frame();assert.ok(h.player.getState().elapsedMs>12000&&h.player.getState().elapsedMs<12040);
  assert.equal(h.player.getState().timelineMode,'coolingV2');
});
check('Fallback cancels pending film/seek; Replay, Resume, Skip, direct seek and scroll cannot bypass the error',()=>{
  const h=harness({status:'loading'});h.player.seekTime(12000);h.player.resume();h.fail();const before=h.player.getState().elapsedMs;
  for(const action of [()=>h.player.replay(),()=>h.player.resume(),()=>h.player.seekTime(14000),()=>h.player.skip()]){action();h.frame(1000);assert.equal(h.player.getState().elapsedMs,before);assert.equal(h.player.getState().mode,'stopped');}
  h.scope.scrollY=600;h.window.dispatch('scroll');h.frame();assert.equal(h.player.getState().elapsedMs,before);
  assert.equal(h.player.getState().duration,39700);assert.equal(h.player.getState().timelineMode,'coolingV2');assert.match(h.help.textContent,/載入失敗.*重新整理/);
  assert.ok(h.replay.disabled&&h.skip.disabled);assert.equal(h.storage.size,0);
  h.ready();h.frame(1000);assert.equal(h.player.getState().mode,'stopped');assert.equal(h.player.getState().elapsedMs,before,'Recovery discards a failed pending seek');
  h.player.replay();h.frame(100);h.frame();assert.ok(h.player.getState().elapsedMs>0,'User may replay after the renderer really recovers');
});
check('Failure before player mount is visible and never falls through to legacy playback',()=>{
  const h=harness({status:'fallback'});h.frame(5000);assert.equal(h.player.getState().mode,'stopped');assert.equal(h.player.getState().elapsedMs,0);assert.equal(h.player.getState().duration,39700);assert.match(h.help.textContent,/載入失敗/);
});
check('Existing mount fallback marker reports missing core script even without renderer state',()=>{
  const h=harness({mountFallback:true});assert.equal(h.canvas.dataset.coreState,undefined);h.frame(5000);
  assert.equal(h.player.getState().mode,'stopped');assert.equal(h.player.getState().elapsedMs,0);assert.equal(h.player.getState().duration,39700);
  assert.match(h.help.textContent,/載入失敗.*重新整理/);assert.ok(h.replay.disabled&&h.skip.disabled);assert.equal(h.storage.size,0);
  for(const action of [()=>h.player.replay(),()=>h.player.resume(),()=>h.player.seekTime(12000),()=>h.player.skip()]){action();h.frame(1000);assert.equal(h.player.getState().mode,'stopped');assert.equal(h.player.getState().elapsedMs,0);}
});
check('A mid-film renderer failure holds the current authored time and recovery does not auto-resume',()=>{
  const h=harness({status:'ready'});h.canvas.dataset.coreCooling='ready';h.player.seekTime(12300);h.player.resume();h.frame();h.frame();const elapsed=h.player.getState().elapsedMs;h.fail();h.frame(5000);
  assert.equal(h.player.getState().elapsedMs,elapsed);h.ready();h.frame(5000);assert.equal(h.player.getState().elapsedMs,elapsed);assert.equal(h.player.getState().mode,'stopped');
});
check('Reduced Motion and a prior completed visit queue the final pose until resources are ready',()=>{
  for(const options of [{reduce:true},{played:true}]){const h=harness({status:'loading',...options});h.frame(5000);assert.equal(h.player.getState().elapsedMs,0);h.ready();assert.equal(h.player.getState().progress,1);assert.equal(h.player.getState().elapsedMs,39700);assert.equal(h.player.getState().mode,'stopped');if(options.reduce)assert.equal(h.replay.disabled,true);}
});
check('Visibility pauses wall time and teardown removes the failure/ready listeners',()=>{
  const h=harness({status:'ready'});h.canvas.dataset.coreCooling='ready';h.player.seekTime(12000);h.player.resume();h.frame();h.frame();const elapsed=h.player.getState().elapsedMs;
  h.document.hidden=true;h.document.dispatch('visibilitychange');h.frame(5000);assert.equal(h.player.getState().elapsedMs,elapsed);
  h.document.hidden=false;h.document.dispatch('visibilitychange');h.frame();assert.equal(h.player.getState().elapsedMs,elapsed);h.frame();assert.ok(h.player.getState().elapsedMs>elapsed);
  h.scope.state.view='other';h.scope._renderMachine();assert.equal(h.story.paHeroPlayback,undefined);assert.equal(h.canvas.listenerCount('pa-core-ready'),0);assert.equal(h.canvas.listenerCount('pa-core-fallback'),0);
});
console.log(JSON.stringify({pass:true,checks:checks.length,scope:'Real shipping player and timeline source; deterministic DOM/RAF lifecycle tests, not WebGL verification'},null,2));
