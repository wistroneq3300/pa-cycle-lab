/* Read-only projection of canonical targets, node snapshots and typed events. */
(() => {
  'use strict';
  const phases=['PRE','ACTION','RECOVERY','POST'];
  const eventPhase={PRE_STARTED:'PRE',PRE_COMPLETED:'PRE',ACTION_PREPARING:'ACTION',COMMAND_DISPATCHING:'ACTION',COMMAND_DISPATCHED:'ACTION',RESPONSE_RETURNED:'ACTION',RESPONSE_LOST:'RECOVERY',WAIT_OFFLINE:'RECOVERY',OS_UNREACHABLE:'RECOVERY',WAIT_RECOVERY:'RECOVERY',BOOT_ID_CHANGED:'RECOVERY',RECOVERY_DETECTED:'RECOVERY',POST_STARTED:'POST',POST_COMPLETED:'POST'};
  const complete={PRE_COMPLETED:'PRE',COMMAND_DISPATCHED:'ACTION',RECOVERY_DETECTED:'RECOVERY',POST_COMPLETED:'POST'};
  const states={PRE:'PRE',START:'PRE','waiting OS boot':'RECOVERY','OS up, system check running':'POST','system check done':'POST',DONE:'POST'};
  const element=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text||'';if(cls)el.className=cls;return el;};
  window.CycleFleet=class {
    constructor(root,onchange){this.root=root;this.onchange=onchange;this.observed=new Map();this.filter='ALL';this.node='';this.chassis='';this.search='';this.openGroups=new Set();this.matrixOpen=false;}
    reset(){this.signature=null;this.observed.clear();this.filter='ALL';this.node='';this.openGroups.clear();this.matrixOpen=false;this.search='';this.chassis='';}
    observe(events){for(const e of events){if(!e.machine_id)continue;let row=this.observed.get(e.machine_id)||{loop:0,done:new Set()};const loop=Number(e.loop||0);if(loop>row.loop)row={loop,done:new Set(row.done.has('PRE')?['PRE']:[])};if(loop<row.loop)continue;
      row.loop=loop;if(eventPhase[e.event_type]&&(!row.sequence||e.sequence>=row.sequence)){row.phase=eventPhase[e.event_type];row.sequence=e.sequence;}if(complete[e.event_type])row.done.add(complete[e.event_type]);if(e.event_type?.startsWith('ISSUE_')&&['WARN','FAIL','ERROR'].includes(e.level))row.issue=e.message;this.observed.set(e.machine_id,row);}}
    rows(){const nodes=new Map((this.job.nodes||[]).map(n=>[n.machine_id,n]));return this.job.targets.map(t=>{const n=nodes.get(t.name)||{},o=this.observed.get(t.name)||{},health=String(n.cumulative_health||n.health||'UNKNOWN').toUpperCase();const phase=o.loop===Number(n.loop||0)&&o.phase||states[n.stage]||(n.stage?.endsWith(' sent')?'ACTION':'');const group=t.chassis_id||t.parent_name||t.tray||'Unassigned';
      // Health and execution are intentionally independent. A node may still be in
      // RECOVERY while its latest health snapshot is PASS; never collapse those two
      // facts into one "healthy/completed" bucket.
      const bucket=['FAIL','ERROR'].includes(health)?'FAIL':health==='WARN'?'WARNING':health==='PASS'?'HEALTHY':'UNKNOWN';
      return {t,n,o,phase,health,group,bucket,label:[t.tray,t.slot_key||t.node||t.name].filter(Boolean).join(' / ')};});}
    matching(row){return (!this.chassis||row.group===this.chassis)&&(!this.search||[row.label,row.t.name,row.t.node_id,row.t.os_hostname,row.t.display_name,row.group].join(' ').toLowerCase().includes(this.search.toLowerCase()))&&(this.filter==='ALL'||(this.filter==='ATTENTION'&&['FAIL','WARNING'].includes(row.bucket))||this.filter===row.bucket||this.filter===row.phase);}
    accepts(id){if(this.node)return id===this.node;if(!id)return this.filter==='ALL'&&!this.chassis&&!this.search;return this.allowed.has(id);}
    select(id){this.node=this.node===id?'':id;this.render();this.onchange();}
    update(job){this.job=job;const signature=JSON.stringify([job.state,job.nodes,job.pre?.runnable_ids,[...this.observed].map(([id,o])=>[id,o.loop,o.phase,[...(o.done||[])],o.issue])]);if(signature===this.signature)return;this.signature=signature;this.render();}
    button(label,fn,on=false){const b=element('button',label,'btn');b.type='button';b.dataset.fleetFocus=label;b.setAttribute('aria-pressed',String(on));b.onclick=fn;return b;}
    render(){if(!this.job)return;const focus=this.root.contains(document.activeElement)?document.activeElement.dataset.fleetFocus:null;const start=focus==='search'?document.activeElement.selectionStart:null;
      const rows=this.rows();this.allowed=new Set(rows.filter(r=>this.matching(r)).map(r=>r.t.name));const fragment=document.createDocumentFragment();
      const counts=element('div','','lc-fleet-counts');counts.append(element('strong',`${rows.length} ${rows.length===1?'NODE':'NODES'}`));
      if(rows.length>8)for(const [key,label,value] of [
        ['HEALTHY','Health PASS',rows.filter(r=>r.bucket==='HEALTHY').length],
        ['WARNING','Health WARN',rows.filter(r=>r.bucket==='WARNING').length],
        ['FAIL','Health FAIL',rows.filter(r=>r.bucket==='FAIL').length],
        ['RECOVERY','Recovery',rows.filter(r=>r.phase==='RECOVERY').length],
        ['UNKNOWN','Unconfirmed',rows.filter(r=>r.bucket==='UNKNOWN').length]
      ]){const span=element('span',`${label} ${value}`);span.dataset.state=key;counts.append(span);}
      fragment.append(counts);
      const controls=element('div','','lc-fleet-controls');
      if(rows.length>8){for(const [key,label] of [['ALL','ALL'],['HEALTHY','PASS'],['RECOVERY','RECOVERY'],['WARNING','WARN'],['FAIL','FAIL']]){const count=key==='ALL'?rows.length:key==='RECOVERY'?rows.filter(r=>r.phase==='RECOVERY').length:rows.filter(r=>r.bucket===key).length;controls.append(this.button(`${label} ${count}`,()=>{this.filter=key;this.node='';this.render();this.onchange();},this.filter===key&&!this.node));}
        const select=element('select');select.setAttribute('aria-label','Chassis filter');select.dataset.fleetFocus='chassis';select.append(new Option('All chassis',''));for(const group of new Set(rows.map(r=>r.group))){const first=rows.find(r=>r.group===group);select.append(new Option(first.t.parent_name||first.t.tray||group,group));}select.value=this.chassis;select.onchange=()=>{this.chassis=select.value;this.node='';this.render();this.onchange();};controls.append(select);
        const search=element('input');search.type='search';search.placeholder='Find node / hostname / chassis';search.setAttribute('aria-label','Search all job targets');search.dataset.fleetFocus='search';search.value=this.search;search.oninput=()=>{this.search=search.value;this.node='';this.render();this.onchange();};controls.append(search);
      } else if(rows.length>1){controls.dataset.part='nodes';controls.append(this.button('ALL',()=>{this.node='';this.render();this.onchange();},!this.node));for(const row of rows)controls.append(this.chip(row));}
      if(rows.length>1)fragment.append(controls);
      if(rows.length===1)fragment.append(element('p',rows[0].label+' · '+(rows[0].t.os_hostname||rows[0].t.os_ip||''),'lc-single-target'));
      const scope=this.node?rows.filter(r=>r.t.name===this.node):rows.filter(r=>this.matching(r));const loop=Math.max(0,...scope.map(r=>Number(r.n.loop||0)));
      const loopLimit=this.job.config?.limits?.loops||this.job.config?.max_loops;
      const hourLimit=this.job.config?.limits?.hours;
      const limitLabel=loopLimit?` / ${loopLimit}`:hourLimit?` · ${hourLimit} hr limit`:'';
      const flow=element('div','','lc-flow');flow.append(element('span',`LOOP ${String(loop).padStart(3,'0')}${limitLabel}`));
      for(const phase of phases){const completed=scope.filter(r=>phase==='PRE'?(this.job.pre?.runnable_ids||[]).includes(r.t.name)||r.o.done?.has('PRE'):r.o.loop===loop&&r.o.done?.has(phase)).length;const active=scope.filter(r=>r.phase===phase&&Number(r.n.loop||0)===loop&&!(r.o.loop===loop&&r.o.done?.has(phase))).length;
        const b=this.button(`${phase} ${completed}/${scope.length}${active?' · '+active+' active':''}`,()=>{this.filter=this.filter===phase?'ALL':phase;this.node='';this.render();this.onchange();},this.filter===phase);b.dataset.state=active?'ACTIVE':completed===scope.length&&scope.length?'COMPLETE':'PENDING';flow.append(b);}
      fragment.append(flow,element('small','Counts reflect observed completion markers for the latest loop. Missing markers remain unconfirmed; execution completion is separate from hardware health.','lc-fleet-note'));
      if(rows.length>8){const attention=rows.filter(r=>['FAIL','WARNING'].includes(r.bucket));const details=element('details','','lc-attention');details.open=this.attentionOpen!==false;details.ontoggle=()=>{if(!details.isConnected)return;this.attentionOpen=details.open;};details.append(element('summary',`需處理 ${attention.length}`));const list=element('div');for(const row of attention.slice(0,12)){const b=this.chip(row);b.title=row.o.issue||row.n.stop_reason||'查看節點發現與證據';b.append(element('small',row.o.issue||row.n.stop_reason||row.bucket+' · 請查看節點發現'));list.append(b);}if(attention.length>12)list.append(this.button('顯示全部受影響節點',()=>{this.filter='ATTENTION';this.node='';this.search='';this.chassis='';this.matrixOpen=true;this.render();this.onchange();}));details.append(list);fragment.append(details);
        const matrix=element('details','','lc-matrix');matrix.open=this.matrixOpen;matrix.append(element('summary',`Node Matrix · ${this.allowed.size} targets`));const groups=element('div');matrix.append(groups);
        const fill=()=>{groups.replaceChildren();if(!matrix.open)return;for(const group of new Set(rows.filter(r=>this.matching(r)).map(r=>r.group))){const subset=rows.filter(r=>r.group===group&&this.matching(r));const d=element('details');d.open=this.openGroups.has(group);d.append(element('summary',`${subset[0].t.parent_name||subset[0].t.tray||group} · 健康 PASS ${subset.filter(r=>r.bucket==='HEALTHY').length}/${subset.length}`));const nodes=element('div');d.append(nodes);const populate=()=>{nodes.replaceChildren();if(d.open)for(const r of subset)nodes.append(this.chip(r));};d.ontoggle=()=>{if(!d.isConnected)return;if(d.open)this.openGroups.add(group);else this.openGroups.delete(group);populate();};populate();groups.append(d);}};
        matrix.ontoggle=()=>{if(!matrix.isConnected)return;this.matrixOpen=matrix.open;fill();};fill();fragment.append(matrix);
      }
      if(this.node)fragment.append(this.button('Clear node filter',()=>{this.node='';this.render();this.onchange();}));
      this.root.replaceChildren(fragment);if(focus){const el=[...this.root.querySelectorAll('[data-fleet-focus]')].find(e=>e.dataset.fleetFocus===focus);el?.focus();if(start!=null)el?.setSelectionRange(start,start);}
    }
    chip(row){const b=this.button(`${row.label} · ${row.phase||row.n.stage||'PENDING'} · Health ${row.health}`,()=>this.select(row.t.name),this.node===row.t.name);b.dataset.machine=row.t.name;b.dataset.state=row.bucket;return b;}
  };
})();
