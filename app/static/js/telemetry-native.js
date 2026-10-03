/* PA chart owner. PromQL and credentials remain exclusively on the backend. */
(() => {
  'use strict';
  const colors=['#2785ad','#329780','#ba8533','#8566b0','#bf6473','#547eb8','#878537','#7c7470'];
  const periods=new Map();
  const labels={READY:'資料有效',NO_DATA:'尚無資料',STALE:'資料過舊',QUERY_ERROR:'查詢未完成',NOT_APPLICABLE:'不適用',LOADING:'載入中'};
  const stamp=v=>v?new Date(v*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未取得';
  const number=(v,u)=>v==null?'—':u==='B/s'?v>=1e9?(v/1e9).toFixed(1)+' GB/s':v>=1e6?(v/1e6).toFixed(1)+' MB/s':v>=1e3?(v/1e3).toFixed(1)+' KB/s':v.toFixed(1)+' B/s':v.toFixed(1)+' '+u;
  class Dashboard {
    constructor(root,node){
      this.root=root;this.node=node;this.charts=new Map();this.period=periods.get(node.node_id)||'1h';this.abort=new AbortController();this.closed=false;
      root.innerHTML='<div class="tn-toolbar"><div><h3>效能趨勢</h3><p data-sample>正在取得中央監控資料…</p></div><label>時間範圍 <select aria-label="Telemetry 時間範圍"><option>1h</option><option>6h</option><option>24h</option><option>7d</option></select></label></div><div class="tn-stats" aria-label="節點資訊"></div><p data-chart-error role="status"></p><div class="tn-grid"></div>';
      root.querySelector('select').value=this.period;root.querySelector('select').onchange=e=>{this.period=e.target.value;periods.set(this.node.node_id,this.period);this.load();};
      const help=document.createElement('details');help.className='tn-gpu-help';help.hidden=true;help.innerHTML='<summary>GPU 監控未就緒 · 查看手動安裝與連接說明</summary><div data-gpu-help></div>';root.querySelector('.tn-grid').before(help);this.manualHelp();
      this.theme=new MutationObserver(()=>this.repaint());this.theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
      this.load();
    }
    update(node){this.node=node;this.manualHelp();}
    manualHelp(){
      const section=this.root.querySelector('.tn-gpu-help'),gpu=this.node.components?.gpu,setup=this.node.gpu_setup;
      section.hidden=!gpu||['READY','NOT_APPLICABLE','VERIFYING','PROVISIONING'].includes(gpu.state)||!setup;
      if(section.hidden)return;const signature=JSON.stringify([gpu,setup]);if(section.dataset.signature===signature)return;section.dataset.signature=signature;
      const body=section.querySelector('[data-gpu-help]');body.replaceChildren();
      const paragraph=text=>{const p=document.createElement('p');p.textContent=text;body.append(p);};
      const command=text=>{const pre=document.createElement('pre');pre.textContent=text;body.append(pre);};
      paragraph('CPU、Memory、Disk 與 Network 監控可繼續使用。GPU 尚未就緒：'+gpu.detail);
      paragraph('連接目的地：目前 PA Manager '+location.origin+'。由中央 Prometheus 主動讀取此節點的 /metrics；DCGM 不需要設定推送到 PA 的網址。');
      paragraph('中央 Prometheus（PA 後端設定）：'+(setup.prometheus_url||'尚未設定')+'。採集端點：'+setup.exporter_url);
      paragraph('1. 在這台 GPU Server 確認 NVIDIA Driver 與既有 Docker NVIDIA runtime。CPU-only Server 不需要安裝 DCGM。');command(setup.detection);
      paragraph('2. 若尚未安裝 DCGM Exporter，依此平台相容版本手動安裝。下列容器方式需要已設定好的 NVIDIA Container Toolkit；不會替換 Driver。已有服務請沿用，不要重複建立或停止占用連接埠的其他程式。');
      if(!setup.image)paragraph('尚未指定映像版本：請先從 NVIDIA 官方安裝說明選擇符合 GPU／Driver 的固定版本，替換下面的版本欄位。');
      command(setup.installation);
      const link=document.createElement('a');link.href=setup.documentation;link.target='_blank';link.rel='noopener';link.textContent='NVIDIA DCGM Exporter 安裝說明 ↗';body.append(link);
      paragraph('3. 在 PA Manager／中央監控主機確認可讀取下列端點。若兩者分開部署，請在 Prometheus 所在主機檢查；節點需允許該主機連入採集連接埠。');command(setup.check_on_manager);
      paragraph('4. 回本頁按「啟用 Telemetry」。PA 會沿用健康的 Exporter，將此 Node 登記至目前中央 Prometheus，再確認 GPU metrics。Host 圖表不需要等待此步完成。');
      paragraph('Target 設定：'+(setup.file_sd||'尚未設定')+'。由 PA 更新，維持原 node_id；不需要重裝 Grafana 或重啟 Prometheus。');
      const copy=document.createElement('button');copy.type='button';copy.className='btn small';copy.textContent='複製安裝與連接說明';copy.onclick=async()=>{try{await navigator.clipboard.writeText([...body.children].filter(e=>e!==copy).map(e=>e.textContent).join('\n\n'));copy.textContent='已複製說明';}catch{copy.textContent='請選取說明文字複製';}};body.append(copy);
    }
    async load(){
      clearTimeout(this.timer);this.request?.abort();this.request=new AbortController();const period=this.period;
      this.root.setAttribute('aria-busy','true');
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
