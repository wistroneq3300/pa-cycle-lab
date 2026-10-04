/* PA chart owner. PromQL and credentials remain exclusively on the backend. */
(() => {
  'use strict';
  const colors=['#2785ad','#329780','#ba8533','#8566b0','#bf6473','#547eb8','#878537','#7c7470'];
  const periods=new Map();
  const labels={READY:'資料有效',NO_DATA:'尚無資料',STALE:'資料過舊',QUERY_ERROR:'查詢未完成',NOT_APPLICABLE:'不適用',LOADING:'載入中'};
  const stamp=v=>v?new Date(v*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得';
  const number=(v,u)=>v==null?'—':u==='B/s'?v>=1e9?(v/1e9).toFixed(1)+' GB/s':v>=1e6?(v/1e6).toFixed(1)+' MB/s':v>=1e3?(v/1e3).toFixed(1)+' KB/s':v.toFixed(1)+' B/s':v.toFixed(1)+' '+u;
  class Dashboard {
    constructor(root,node,name){
      this.root=root;this.node=node;this.name=name||'';this.charts=new Map();this.period=periods.get(node.node_id)||'1h';this.abort=new AbortController();this.closed=false;
      const ranges=[['10m','10 分鐘'],['30m','30 分鐘'],['1h','1 小時'],['6h','6 小時'],['12h','12 小時'],['24h','24 小時'],['2d','2 天'],['7d','7 天'],['30d','30 天']];
      root.innerHTML='<div class="tn-toolbar"><div><h3>效能趨勢</h3><p data-sample>正在取得中央監控資料…</p></div><label>時間範圍 <select aria-label="Telemetry 時間範圍">'+ranges.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label></div>'
        +'<section class="tn-ai" aria-label="遙測 AI 分析"><div class="tn-ai-head"><h4>遙測 AI 分析</h4><span data-ai-state>等待分析</span></div><div class="tn-ai-body" data-ai>正在分析此範圍的監控趨勢…</div></section>'
        +'<div class="tn-stats" aria-label="節點資訊"></div><p data-chart-error role="status"></p><div class="tn-grid"></div>';
      root.querySelector('select').value=this.period;root.querySelector('select').onchange=e=>{this.period=e.target.value;periods.set(this.node.node_id,this.period);this.load();};
      const help=document.createElement('section');help.className='tn-gpu-help';help.hidden=true;help.innerHTML='<strong>GPU 監控尚未就緒</strong><p data-gpu-detail></p><button type="button" class="btn" data-gpu-settings>前往 GPU 監控設定</button>';help.querySelector('[data-gpu-settings]').onclick=()=>document.querySelector('.tp-component[data-component="gpu"]')?.scrollIntoView({behavior:'smooth',block:'center'});root.querySelector('.tn-grid').before(help);this.manualHelp();
      this.theme=new MutationObserver(()=>this.repaint());this.theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
      this.load();
    }
    analyze(){
      const box=this.root.querySelector('[data-ai]'),state=this.root.querySelector('[data-ai-state]');if(!box)return;
      const nodeId=this.node.node_id,key=nodeId+':'+this.period;
      if(this.analysisKey===key)return;         // already requested for this node+range
      if(this.analysisDone===key)return;        // completed; keep the rendered text
      this.analysisKey=key;this.analysisDone=null;
      state.textContent='分析中…';box.textContent='正在分析此範圍的監控趨勢…';
      fetch('/api/machine/'+encodeURIComponent(this.name||'')+'/telemetry/analyze?minutes='+this.periodMinutes()+(nodeId?'&node_id='+encodeURIComponent(nodeId):''))
        .then(r=>r.ok?r.json():Promise.reject(new Error('無法完成趨勢分析，請稍後重試')))
        .then(data=>{if(this.closed||this.analysisKey!==key)return;this.analysisDone=key;state.textContent='分析完成';box.textContent=data.ok===false?(data.error||'AI 分析暫不可用'):(data.analysis||data.summary||'此範圍暫無明顯異常。');})
        .catch(error=>{if(this.closed||this.analysisKey!==key||error.name==='AbortError')return;this.analysisDone=key;state.textContent='分析未完成';box.textContent=error.message||'AI 分析暫不可用，請稍後重試。';});
    }
    update(node){this.node=node;this.manualHelp();}
    manualHelp(){
      const section=this.root.querySelector('.tn-gpu-help'),gpu=this.node.components?.gpu;
      section.hidden=!gpu||['READY','NOT_APPLICABLE','VERIFYING','PROVISIONING'].includes(gpu.state);
      if(!section.hidden)section.querySelector('[data-gpu-detail]').textContent=gpu.detail||'請在上方 GPU 監控卡片完成設定或重新檢查。';
    }
    periodMinutes(){const m={'10m':10,'30m':30,'1h':60,'6h':360,'12h':720,'24h':1440,'2d':2880,'7d':10080,'30d':43200};return m[this.period]||60;}
    async load(){
      clearTimeout(this.timer);this.request?.abort();this.request=new AbortController();const period=this.period;
      this.root.setAttribute('aria-busy','true');this.analyze();
      try{
        const response=await fetch('/api/telemetry/nodes/'+encodeURIComponent(this.node.node_id)+'/charts?period='+period,{signal:this.request.signal});
        if(!response.ok)throw new Error('無法取得中央監控資料，請稍後重試。');
        const data=await response.json();if(this.closed||period!==this.period)return;
        this.data=data;this.root.querySelector('[data-chart-error]').textContent=['BUSY','LOADING'].includes(data.state)?'查詢進行中，稍後自動更新。':'';
        if(data.panels?.length)this.repaint();
      }catch(e){if(e.name!=='AbortError'&&!this.closed)this.root.querySelector('[data-chart-error]').textContent=e.message;}
      finally{if(!this.closed){this.root.setAttribute('aria-busy','false');this.timer=setTimeout(()=>this.load(),30000);}}
    }
    repaint(){
      if(!this.data||this.closed)return;
      const data=this.data,grid=this.root.querySelector('.tn-grid');
      this.root.querySelector('[data-sample]').textContent='最近樣本 '+stamp(data.last_sample?.host)+' · 台灣時間 UTC+8';
      const stats=this.root.querySelector('.tn-stats');stats.replaceChildren();
      const gpu=this.node.components?.gpu||{},uptime=data.stats?.uptime?.[0]?.value,load=data.stats?.load?.[0]?.value;
      const values=[['Host',this.node.components?.host||this.node.state],['GPU',gpu.state||'尚未確認'],['Prometheus',this.node.components?.prometheus||'尚未確認'],['Uptime',uptime!=null?Math.floor(uptime/86400)+'d '+Math.floor(uptime%86400/3600)+'h':'—'],['Load 1m',load==null?'—':load.toFixed(2)],['GPU Count',gpu.gpus?.length??'—'],['GPU Model',[...new Set((gpu.gpus||[]).map(g=>g.model))].join(', ')||'—'],['Driver',gpu.gpus?.[0]?.driver||'—']];
      const filesystem=(data.stats?.filesystem||[]).filter(r=>r.value!=null);
      if(filesystem.length)values.push(['Filesystem max',Math.max(...filesystem.map(r=>r.value)).toFixed(1)+'%']);
      for(const [name,value] of values){const entry=document.createElement('span'),title=document.createElement('span'),v=document.createElement('strong');title.textContent=name;v.textContent=value;entry.append(title,v);stats.append(entry);}
      const dark=document.documentElement.dataset.theme==='dark',ink=dark?'#afc1cc':'#526975',line=dark?'#263b47':'#e4ecef';
      for(const panel of data.panels){
        let item=grid.querySelector('[data-panel="'+panel.id+'"]');
        if(!item){item=document.createElement('section');item.className='tn-panel';item.dataset.panel=panel.id;item.innerHTML='<header><h4></h4><span data-health></span></header><div class="tn-plot"><canvas></canvas><p data-empty></p></div><div class="tn-legend" aria-label="圖表序列"></div>';grid.append(item);}
        item.querySelector('h4').textContent=panel.title;const health=item.querySelector('[data-health]');health.textContent=labels[panel.state]||panel.state;health.dataset.state=panel.state;
        const empty=item.querySelector('[data-empty]');empty.textContent=panel.state==='NOT_APPLICABLE'?'此節點未配置 NVIDIA GPU。':panel.error?'Prometheus 查詢未完成，稍後自動重試。':'此時段尚無有效樣本。';empty.hidden=!!panel.series.length;
        const canvas=item.querySelector('canvas');canvas.hidden=!panel.series.length;canvas.setAttribute('aria-label',panel.title+'，詳細數值可在下方序列查看');canvas.setAttribute('role','img');
        const datasets=panel.series.map((s,i)=>({label:s.label,data:s.points.map(([x,y])=>({x,y})),borderColor:colors[i%colors.length],borderWidth:1.6,pointRadius:0,pointHitRadius:10,tension:0,spanGaps:false}));
        let chart=this.charts.get(panel.id);
        if(!chart&&window.Chart){chart=new Chart(canvas,{type:'line',data:{datasets},options:{animation:false,responsive:true,maintainAspectRatio:false,parsing:false,normalized:true,interaction:{mode:'nearest',axis:'x',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items.length?new Date(items[0].parsed.x).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'',label:ctx=>ctx.dataset.label+': '+number(ctx.parsed.y,panel.unit)}}},scales:{x:{type:'linear',grid:{display:false},ticks:{color:ink,maxTicksLimit:5,callback:v=>new Date(v).toLocaleTimeString('en-GB',{timeZone:'Asia/Taipei',hour12:false,hour:'2-digit',minute:'2-digit'})}},y:{beginAtZero:true,suggestedMax:panel.unit==='%'?100:undefined,grid:{color:line},ticks:{color:ink,maxTicksLimit:4,callback:v=>number(v,panel.unit)}}}}});this.charts.set(panel.id,chart);}
        else if(chart){chart.data.datasets=datasets;chart.options.scales.x.ticks.color=ink;chart.options.scales.y.ticks.color=ink;chart.options.scales.y.grid.color=line;chart.update('none');}
        const legend=item.querySelector('.tn-legend');legend.replaceChildren();
        panel.series.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.style.setProperty('--series-color',colors[i%colors.length]);b.textContent=s.label+' '+number(s.latest,panel.unit);b.setAttribute('aria-pressed','true');b.onclick=()=>{if(!chart)return;const visible=chart.isDatasetVisible(i);chart.setDatasetVisibility(i,!visible);b.setAttribute('aria-pressed',String(!visible));chart.update('none');};legend.append(b);});
      }
    }
    dispose(){this.closed=true;clearTimeout(this.timer);this.request?.abort();this.theme.disconnect();for(const c of this.charts.values())c.destroy();this.charts.clear();}
  }
  window.PANativeTelemetry={Dashboard};
})();
