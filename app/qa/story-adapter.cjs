/* VM-only lifecycle test of cinematic.js's DOM-to-scene adapter.
 * This does not test WebGL geometry, browser input, or rendered pixels. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../static/js/cinematic.js'),'utf8');
const functionSource = source.slice(source.indexOf('  function mountStory()'),source.indexOf('  function polishRack()'));
class Target {
  constructor(){this.listeners=new Map();this.dataset={};this.style={setProperty:(key,value)=>this.style[key]=value};this.classes=new Set();this.classList={add:key=>this.classes.add(key),remove:key=>this.classes.delete(key)};}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,event={}){for(const fn of [...(this.listeners.get(type)||[])])fn(event);}
  count(type){return this.listeners.get(type)?.size||0;}
  setAttribute(key,value){this[key]=value;}
}
function environment({lowResource=false,reducedMotion=false}={}) {
  const window=new Target(), reduced=new Target(); reduced.matches=reducedMotion;
  const ids=Object.fromEntries(['core-story','core-stage','system-core','core-visual','core-system-copy','core-rack-copy','core-interaction-help','core-tools'].map(id=>[id,new Target()]));
  const buttons=['rear','reset'].map(view=>{const b=new Target();b.dataset.coreView=view;b.closest=()=>b;return b;});
  ids['core-stage'].querySelectorAll=()=>buttons;
  ids['core-story'].offsetHeight=1600; ids['core-stage'].offsetHeight=600;
  let top=76;ids['core-story'].getBoundingClientRect=()=>({top});
  const scenes=[];
  window.PACoreScene={mount:canvas=>{canvas.dataset.coreState='ready';const scene={supported:true,progress:[],themes:[],orbit:[],resets:0,destroyed:false,setProgress(n){this.progress.push(n);},setTheme(value){this.themes.push(value);},setOrbit(...args){this.orbit.push(args);},resetOrbit(){this.resets++;},destroy(){this.destroyed=true;}};scenes.push(scene);return scene;}};
  let frameID=0;const frames=new Map();
  const context=vm.createContext({window,reduced,document:{getElementById:id=>ids[id],documentElement:{dataset:{theme:'light'}}},navigator:{deviceMemory:lowResource?2:8,hardwareConcurrency:8},requestAnimationFrame:fn=>{frames.set(++frameID,fn);return frameID;},cancelAnimationFrame:id=>frames.delete(id)});
  const adapter=vm.runInContext('let teardown=()=>{};'+functionSource+';({mount:mountStory,dispose:()=>teardown()})',context);
  const flush=()=>{const scheduled=[...frames.values()];frames.clear();scheduled.forEach(fn=>fn());};
  return {window,reduced,ids,buttons,scenes,adapter,frames,flush,setTop:value=>{top=value;}};
}
const normal=environment();
normal.adapter.mount();
assert.equal(normal.ids['core-stage'].dataset.scene,'interactive');
assert.equal(normal.buttons.every(b=>!b.disabled),true);
assert.equal(normal.ids['core-system-copy'].inert,false);
assert.equal(normal.ids['core-rack-copy'].inert,true);
normal.window.emit('pa-theme-change',{detail:{theme:'dark'}});
assert.equal(normal.scenes[0].themes.at(-1),'dark');
normal.ids['core-tools'].emit('click',{target:normal.buttons.find(b=>b.dataset.coreView==='rear')});
assert.equal(normal.scenes[0].orbit.length,1);
normal.ids['core-tools'].emit('click',{target:normal.buttons.find(b=>b.dataset.coreView==='reset')});
assert.equal(normal.scenes[0].resets,1);
normal.setTop(-924);normal.window.emit('scroll');normal.flush();
assert.equal(normal.scenes[0].progress.at(-1),1);
assert.equal(normal.ids['core-system-copy'].inert,true);
assert.equal(normal.ids['core-rack-copy'].inert,false);
normal.setTop(76);normal.window.emit('scroll');normal.flush();
assert.equal(normal.scenes[0].progress.at(-1),0);
assert.equal(normal.ids['core-system-copy'].inert,false);
assert.equal(normal.ids['core-rack-copy'].inert,true);
normal.ids['system-core'].emit('pa-core-fallback');
assert.equal(normal.buttons.every(b=>b.disabled),true);
assert.equal(normal.ids['system-core'].tabIndex,-1);
normal.ids['system-core'].emit('pa-core-ready');
assert.equal(normal.buttons.every(b=>!b.disabled),true);
assert.equal(normal.ids['system-core'].tabIndex,0);
normal.window.emit('resize');assert.equal(normal.frames.size,1);
normal.adapter.dispose();
assert.equal(normal.frames.size,0,'Pending animation frame cancelled on teardown');
assert.equal(normal.scenes[0].destroyed,true);
for(const event of ['scroll','resize','pa-theme-change'])assert.equal(normal.window.count(event),0);
assert.equal(normal.reduced.count('change'),0);
assert.equal(normal.ids['core-tools'].count('click'),0);
assert.equal(normal.ids['system-core'].count('pa-core-ready'),0);
assert.equal(normal.ids['system-core'].count('pa-core-fallback'),0);
const low=environment({lowResource:true});low.adapter.mount();
assert.equal(low.scenes.length,0);assert.equal(low.ids['core-stage'].dataset.scene,'fallback');assert.equal(low.buttons.every(b=>b.disabled),true);low.adapter.dispose();
const reduced=environment({reducedMotion:true});reduced.adapter.mount();
assert.equal(reduced.ids['core-system-copy'].inert,false);assert.equal(reduced.ids['core-rack-copy'].inert,false);reduced.adapter.dispose();
console.log('PASS adapter lifecycle: scene events, controls, reversible progress, normal teardown, low-resource fallback, reduced motion.');
const duplicate=environment();duplicate.adapter.mount();duplicate.adapter.mount();
assert.equal(duplicate.window.count('scroll'),1,'Repeated mount must not leak prior scroll listener');
assert.equal(duplicate.window.count('pa-theme-change'),1,'Repeated mount must not leak prior scene/theme listener');
duplicate.adapter.dispose();
assert.equal(duplicate.scenes.every(scene=>scene.destroyed),true,'Every mounted scene must be destroyed');
console.log('PASS adapter repeat mount is idempotent.');
