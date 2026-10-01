/* Real bundled Chart.js option/update regression, using a no-op canvas in Node.
 * No browser, external packages, network, or pixel/screenshot claim. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Chart = require('../static/vendor/chartjs/chart.umd.min.js');
const source = fs.readFileSync(path.join(__dirname,'../static/js/cinematic.js'),'utf8');
const section = source.slice(source.indexOf('  const originalTheme ='),source.indexOf('  const two ='));
const root = {dataset:{theme:'dark'}};
const button = {setAttribute(key,value){this[key]=value;}};
const mode = {};
const saved = new Map();
const dispatched = [];
const document = {documentElement:root,getElementById:id=>id==='theme-toggle'?button:id==='mode-label'?mode:null};
const localStorage = {setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)};
const context = vm.createContext({
  document,localStorage,Chart,root,$:id=>document.getElementById(id),
  window:{Chart,dispatchEvent:event=>dispatched.push(event)},
  CustomEvent:class {constructor(type,init){this.type=type;this.detail=init.detail;}}
});
// Exercise the actual base persistence implementation instead of a replacement.
const app = fs.readFileSync(path.join(__dirname,'../static/js/app.js'),'utf8');
vm.runInContext(app.slice(app.indexOf('function applyTheme('),app.indexOf('function loadTheme('))+section,context);
function canvas() {
  const element = {width:640,height:320,isConnected:true,style:{}};
  const ctx = new Proxy({canvas:element,measureText:text=>({width:String(text).length*6}),getLineDash:()=>[]}, {
    get:(target,key)=>key in target?target[key]:()=>{}, set:(target,key,value)=>(target[key]=value,true)
  });
  element.getContext = () => ctx;
  return element;
}
const callback = value => `${value.parsed.y} W`;
const makeChart = legend => new Chart(canvas(),{
  type:'line',data:{labels:['A','B'],datasets:[{label:'Reported series',data:[1,2],borderColor:'#237daa'}]},
  options:{responsive:false,animation:false,plugins:{legend,title:{display:true,text:'Telemetry'},tooltip:{callbacks:{label:callback}}},scales:{x:{ticks:{maxTicksLimit:6}},y:{beginAtZero:true,title:{display:true,text:'W'},grid:{color:'old'}}}}
});
let standard,disabled;
try {
  standard = makeChart({position:'bottom',labels:{boxWidth:10,font:{size:9.5}}});
  disabled = makeChart(false);
  assert.ok(standard.ctx,'Bundled Chart.js acquired the no-op canvas');
  const dataset = standard.data.datasets[0];
  const scenarios = [['light','#46616e','rgba(37,73,89,.12)'],['dark','#a3b3c1','rgba(154,183,203,.13)'],['light','#46616e','rgba(37,73,89,.12)']];
  for (const [theme,ink,grid] of scenarios) {
    vm.runInContext(`applyTheme('${theme}')`,context);
    assert.equal(root.dataset.theme,theme);
    assert.equal(saved.get('pa_theme'),theme);
    assert.match(button.innerHTML,new RegExp(theme==='light'?'Light':'Dark'));
    assert.equal(button['aria-pressed'],String(theme==='light'));
    assert.equal(dispatched.at(-1).type,'pa-theme-change');
    assert.equal(dispatched.at(-1).detail.theme,theme);
    assert.equal(standard.options.color,ink,'Resolved chart color uses current theme immediately');
    assert.equal(standard.options.plugins.legend.labels.color,ink,'Legend resolver uses current theme');
    assert.equal(standard.options.plugins.title.color,ink);
    assert.equal(standard.scales.x.options.ticks.color,ink,'Rendered x-axis uses current theme');
    assert.equal(standard.scales.y.options.grid.color,grid,'Rendered grid uses current theme');
    assert.equal(standard.scales.y.options.title.color,ink);
    assert.equal(standard.config.options.plugins.tooltip.callbacks.label,callback,'Tooltip callback retained');
    assert.equal(standard.config.options.plugins.legend.position,'bottom');
    assert.equal(standard.config.options.plugins.legend.labels.boxWidth,10);
    assert.equal(standard.config.options.scales.x.ticks.maxTicksLimit,6);
    assert.equal(standard.data.datasets[0],dataset,'Dataset identity retained');
    assert.equal(dataset.borderColor,'#237daa','Data series colors retained');
    assert.equal(disabled.config.options.plugins.legend,false,'Disabled legend not re-enabled');
  }
  console.log('PASS real Chart.js palette: Light → Dark → Light resolves in the same update; callbacks, options, dataset colors and disabled legend preserved; theme persistence/event/button updated.');
} finally {
  standard?.destroy(); disabled?.destroy(); Chart.unregister('paWistronPalette');
}
