/* PA chart owner. PromQL and credentials remain exclusively on the backend. */
(() => {
  'use strict';
  const colors=['#2785ad','#329780','#ba8533','#8566b0','#bf6473','#547eb8','#878537','#7c7470'];
  const periods=new Map(),seriesVisibility=new Map();
  const labels={READY:'資料有效',NO_DATA:'尚無資料',STALE:'資料過舊',QUERY_ERROR:'查詢未完成',NOT_APPLICABLE:'不適用',LOADING:'載入中'};
  const stamp=v=>v?new Date(v*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得';
  const number=(v,u)=>v==null?'未取得':u==='B/s'?v>=1e9?(v/1e9).toFixed(1)+' GB/s':v>=1e6?(v/1e6).toFixed(1)+' MB/s':v>=1e3?(v/1e3).toFixed(1)+' KB/s':v.toFixed(1)+' B/s':v.toFixed(1)+' '+u;
  const responseError=async(response,fallback)=>{const raw=await response.json().catch(()=>({})),data=raw&&typeof raw==='object'?raw:{};return new Error(data.detail||data.error||fallback);};
  class Dashboard {
    constructor(root,node,name){
      this.root=root;this.node=node;this.name=name||'';this.charts=new Map();this.seriesVisibility=seriesVisibility;this.period=periods.get(node.node_id)||'1h';this.abort=new AbortController();this.closed=false;
      const ranges=[['10m','10 分鐘'],['30m','30 分鐘'],['1h','1 小時'],['6h','6 小時'],['12h','12 小時'],['24h','24 小時'],['2d','2 天'],['7d','7 天'],['30d','30 天']];
      root.innerHTML='<div class="tn-toolbar"><div><h3>效能趨勢</h3><p data-sample>正在取得中央監控資料…</p><p data-freshness></p></div><label>時間範圍 <select aria-label="Telemetry 時間範圍">'+ranges.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label></div>'
        +'<section class="tn-health" aria-label="Hardware Health"><div><h4>Selected Node Health</h4><p data-health-scope>Node Scope</p><p data-health-state>正在讀取已保存的 Inspection 結果…</p></div><dl><div><dt data-health-count-label>Node FAIL / WARN</dt><dd data-health-counts>—</dd></div><div><dt>Last Inspected</dt><dd data-health-time>—</dd></div><div><dt>Coverage / Freshness</dt><dd data-health-coverage>—</dd></div></dl><button class="btn small" type="button" data-health-open>開啟 Health / Inspection</button></section>'
        +'<section class="tn-ai" aria-label="Telemetry AI Analysis"><div class="tn-ai-head"><h4>Telemetry AI Analysis</h4><div class="tn-ai-actions"><span data-ai-state>等待分析</span><button class="btn small" type="button" data-ai-retry hidden>重新分析</button></div></div><div class="tn-ai-body" data-ai>正在分析此範圍的監控趨勢…</div></section>'
        +'<div class="tn-stats" aria-label="節點資訊"></div><p data-chart-error role="status"></p><div class="tn-grid"></div>';
      root.querySelector('select').value=this.period;root.querySelector('select').onchange=e=>{this.period=e.target.value;periods.set(this.node.node_id,this.period);this.load();};
      root.querySelector('[data-ai-retry]').onclick=()=>{this.analysisKey=null;this.analysisDone=null;this.analyze();};
      root.querySelector('[data-health-open]').onclick=()=>window.productDetailTab?.('sensors',true);this.loadHealth();
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
      const retry=this.root.querySelector('[data-ai-retry]');retry.hidden=true;state.textContent='分析中…';state.dataset.state='LOADING';box.textContent='正在分析此範圍的監控趨勢…';
      fetch('/api/machine/'+encodeURIComponent(this.name||'')+'/telemetry/analyze?minutes='+this.periodMinutes()+(nodeId?'&node_id='+encodeURIComponent(nodeId):''))
        .then(async r=>{if(!r.ok)throw await responseError(r,'無法完成趨勢分析，請稍後重試。');return r.json();})
        .then(data=>{if(this.closed||this.analysisKey!==key)return;this.analysisDone=key;const payload=data&&typeof data==='object'?data:{},result=[payload.analysis,payload.summary].find(value=>typeof value==='string'&&value.trim())?.trim()||'';if(payload.ok===false){state.textContent='分析未完成';state.dataset.state='ERROR';box.textContent=payload.error||payload.detail||'AI 分析暫不可用。';retry.hidden=false;return;}if(!result){state.textContent='尚無分析結果';state.dataset.state='EMPTY';box.textContent='此範圍尚無可用的 AI 分析結果。';retry.hidden=false;return;}state.textContent='分析完成';state.dataset.state='COMPLETE';const structured=payload.analysis_result||{},section=(title,value)=>{const area=document.createElement('section'),h=document.createElement('h5'),p=document.createElement('p');h.textContent=title;p.textContent=value||'證據不足';area.append(h,p);return area;};box.replaceChildren(section('Finding',structured.finding||result),section('直接觀測 Evidence',structured.evidence||payload.summary),section('Possible Cause · AI 推論',structured.possible_cause),section('Suggested Action',structured.suggested_action),section('證據來源與限制',[structured.evidence_source,structured.evidence_limit].filter(Boolean).join(' · ')));})
        .catch(error=>{if(this.closed||this.analysisKey!==key||error.name==='AbortError')return;this.analysisDone=key;state.textContent='分析未完成';state.dataset.state='ERROR';box.textContent=error.message||'AI 分析暫不可用，請稍後重試。';retry.hidden=false;});
    }
    update(node){this.node=node;this.manualHelp();this.loadHealth();}
    async loadHealth(){
      const state=this.root.querySelector('[data-health-state]'),nodeId=this.node.node_id,request=Symbol();this.healthRequest=request;if(!this.name){state.textContent='NOT MONITORED · 無法對應系統';return;}
      try{const response=await fetch('/api/machine/'+encodeURIComponent(this.name)+'/inspection',{cache:'no-store'});if(!response.ok)throw await responseError(response,'Inspection 摘要無法取得');const data=await response.json();if(this.closed||this.healthRequest!==request)return;const overrides=data.config?.node_overrides||{},enabled=overrides[nodeId]??data.config?.enabled,rows=(data.check_matrix||[]).filter(row=>row.node_id===nodeId),scope=this.root.querySelector('[data-health-scope]'),countLabel=this.root.querySelector('[data-health-count-label]');let fail,warn,required,complete,stale,last,health;
        if(rows.length){fail=rows.filter(row=>row.health_status==='FAIL').length;warn=rows.filter(row=>row.health_status==='WARN').length;required=rows.filter(row=>row.required);complete=required.filter(row=>['PASS','WARN','FAIL'].includes(row.status));stale=rows.some(row=>row.status==='STALE');last=Math.max(0,...rows.map(row=>Number(row.last_checked)||0));health=!enabled?'NOT MONITORED':fail?'FAIL':warn?'WARN':required.length&&complete.length===required.length?'READY':'NO DATA';scope.textContent=`Node Scope · ${this.node.slot||this.node.hostname||nodeId}`;countLabel.textContent='Node FAIL / WARN';
        }else{const summary=data.summary||{},coverage=data.coverage_summary||{};fail=summary.fail??0;warn=summary.warning??0;required=Array.from({length:Number(coverage.required)||0});complete=Array.from({length:Number(coverage.completed)||0});stale=(data.coverage||[]).some(row=>row.state==='STALE');last=Number(data.last_completed_at)||0;health=!enabled?'NOT MONITORED':fail?'FAIL':warn?'WARN':complete.length&&complete.length===required.length?'READY':'NO DATA';scope.textContent='System Scope · Selected Node 尚無獨立 Matrix';countLabel.textContent='System FAIL / WARN';}
        state.textContent=health;state.dataset.state=health;this.root.querySelector('[data-health-counts]').textContent=`${fail} FAIL / ${warn} WARN`;this.root.querySelector('[data-health-time]').textContent=stamp(last);this.root.querySelector('[data-health-coverage]').textContent=`${complete.length} / ${required.length} · ${stale?'STALE':enabled?'READY':'NOT MONITORED'}`;}catch(error){if(!this.closed&&this.healthRequest===request){state.textContent='Inspection 摘要讀取失敗';state.dataset.state='QUERY_ERROR';this.root.querySelector('[data-health-coverage]').textContent=error.message;}}
    }
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
        if(!response.ok)throw await responseError(response,'無法取得中央監控資料，請稍後重試。');
        const data=await response.json();if(this.closed||period!==this.period)return;
        this.data=data;const chartError=this.root.querySelector('[data-chart-error]');chartError.textContent=['BUSY','LOADING'].includes(data.state)?'查詢進行中，稍後自動更新。':'';chartError.dataset.state=['BUSY','LOADING'].includes(data.state)?'loading':'';
        if(data.panels?.length)this.repaint();
      }catch(e){if(e.name!=='AbortError'&&!this.closed){const chartError=this.root.querySelector('[data-chart-error]');chartError.textContent=e.message;chartError.dataset.state='error';}}
      finally{if(!this.closed){this.root.setAttribute('aria-busy','false');this.timer=setTimeout(()=>this.load(),30000);}}
    }
    repaint(){
      if(!this.data||this.closed)return;
      const data=this.data,grid=this.root.querySelector('.tn-grid');
      this.root.querySelector('[data-sample]').textContent='最近樣本 '+stamp(data.last_sample?.host)+' · 台灣時間 UTC+8';
      const freshness=this.root.querySelector('[data-freshness]'),panelStates=new Set((data.panels||[]).map(panel=>panel.state));const freshnessState=panelStates.has('QUERY_ERROR')?'QUERY_ERROR':panelStates.has('STALE')?'STALE':panelStates.has('READY')?'READY':panelStates.has('NO_DATA')?'NO_DATA':panelStates.size&&[...panelStates].every(value=>value==='NOT_APPLICABLE')?'NOT_APPLICABLE':data.state||'NO_DATA';freshness.textContent='Data Freshness · '+(labels[freshnessState]||freshnessState);freshness.dataset.state=freshnessState;
      const stats=this.root.querySelector('.tn-stats');stats.replaceChildren();
      const gpu=this.node.components?.gpu||{},uptime=data.stats?.uptime?.[0]?.value,load=data.stats?.load?.[0]?.value;
      const gpuNotApplicable=gpu.state==='NOT_APPLICABLE',gpuList=Array.isArray(gpu.gpus)?gpu.gpus:null;
      const values=[['Host',this.node.components?.host||this.node.state||'未取得'],['GPU',gpu.state||'尚未確認'],['Prometheus',this.node.components?.prometheus||'尚未確認'],['Uptime',uptime!=null?Math.floor(uptime/86400)+'d '+Math.floor(uptime%86400/3600)+'h':'未取得'],['Load 1m',load==null?'未取得':load.toFixed(2)],['GPU Count',gpuNotApplicable?'不適用':gpuList?gpuList.length:'未取得'],['GPU Model',gpuNotApplicable?'不適用':gpuList?[...new Set(gpuList.map(g=>g.model).filter(Boolean))].join(', ')||'未提供':'未取得'],['Driver',gpuNotApplicable?'不適用':gpuList?.[0]?.driver||'未取得']];
      const filesystem=(data.stats?.filesystem||[]).filter(r=>r.value!=null);
      if(filesystem.length)values.push(['Filesystem max',Math.max(...filesystem.map(r=>r.value)).toFixed(1)+'%']);
      for(const [name,value] of values){const entry=document.createElement('span'),title=document.createElement('span'),v=document.createElement('strong');title.textContent=name;v.textContent=value;entry.append(title,v);stats.append(entry);}
      const dark=document.documentElement.dataset.theme==='dark',ink=dark?'#afc1cc':'#526975',line=dark?'#263b47':'#e4ecef';
      for(const panel of data.panels){
        let item=grid.querySelector('[data-panel="'+panel.id+'"]');
        if(!item){item=document.createElement('section');item.className='tn-panel';item.dataset.panel=panel.id;item.innerHTML='<header><h4></h4><span data-health></span></header><div class="tn-plot"><canvas></canvas><p data-empty></p></div><div class="tn-legend" aria-label="圖表序列"></div>';grid.append(item);}
        item.querySelector('h4').textContent=panel.title;const health=item.querySelector('[data-health]');health.textContent=labels[panel.state]||panel.state;health.dataset.state=panel.state;
        const empty=item.querySelector('[data-empty]');empty.textContent=panel.state==='NOT_APPLICABLE'?'此節點未配置 NVIDIA GPU。':panel.state==='QUERY_ERROR'?('Prometheus 查詢失敗：'+(panel.error||'未提供原因')):panel.state==='STALE'?'此時段的最近樣本已過舊。':'此時段尚無有效樣本。';empty.hidden=!!panel.series.length;
        const canvas=item.querySelector('canvas');canvas.hidden=!panel.series.length;canvas.setAttribute('aria-label',panel.title+'，詳細數值可在下方序列查看');canvas.setAttribute('role','img');
        const visibilityKeys=panel.series.map(s=>this.node.node_id+'|'+panel.id+'|'+s.label);
        const datasets=panel.series.map((s,i)=>({label:s.label,data:s.points.map(([x,y])=>({x,y})),borderColor:colors[i%colors.length],borderWidth:1.6,pointRadius:0,pointHitRadius:10,tension:0,spanGaps:false,hidden:this.seriesVisibility.get(visibilityKeys[i])===false}));
        let chart=this.charts.get(panel.id);
        if(!chart&&window.Chart){chart=new Chart(canvas,{type:'line',data:{datasets},options:{animation:false,responsive:true,maintainAspectRatio:false,parsing:false,normalized:true,interaction:{mode:'nearest',axis:'x',intersect:false},plugins:{legend:{display:false},tooltip:{callbacks:{title:items=>items.length?new Date(items[0].parsed.x).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'',label:ctx=>ctx.dataset.label+': '+number(ctx.parsed.y,panel.unit)}}},scales:{x:{type:'linear',grid:{display:false},ticks:{color:ink,maxTicksLimit:5,callback:v=>new Date(v).toLocaleTimeString('en-GB',{timeZone:'Asia/Taipei',hour12:false,hour:'2-digit',minute:'2-digit'})}},y:{beginAtZero:true,suggestedMax:panel.unit==='%'?100:undefined,grid:{color:line},ticks:{color:ink,maxTicksLimit:4,callback:v=>number(v,panel.unit)}}}}});this.charts.set(panel.id,chart);}
        else if(chart){chart.data.datasets=datasets;chart.options.scales.x.ticks.color=ink;chart.options.scales.y.ticks.color=ink;chart.options.scales.y.grid.color=line;panel.series.forEach((_,i)=>chart.setDatasetVisibility(i,this.seriesVisibility.get(visibilityKeys[i])!==false));chart.update('none');}
        const legend=item.querySelector('.tn-legend');legend.replaceChildren();
        panel.series.forEach((s,i)=>{const b=document.createElement('button'),visibilityKey=visibilityKeys[i];b.type='button';b.style.setProperty('--series-color',colors[i%colors.length]);b.textContent=s.label+' '+number(s.latest,panel.unit);const visible=chart?chart.isDatasetVisible(i):this.seriesVisibility.get(visibilityKey)!==false;b.setAttribute('aria-pressed',String(visible));b.onclick=()=>{if(!chart)return;const next=!chart.isDatasetVisible(i);this.seriesVisibility.set(visibilityKey,next);chart.setDatasetVisibility(i,next);b.setAttribute('aria-pressed',String(next));chart.update('none');};legend.append(b);});
      }
    }
    dispose(){this.closed=true;clearTimeout(this.timer);this.request?.abort();this.theme.disconnect();for(const c of this.charts.values())c.destroy();this.charts.clear();}
  }
  window.PANativeTelemetry={Dashboard};
})();
