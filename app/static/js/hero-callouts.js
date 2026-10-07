/* Overview-only engineering captions. Hardware projection is owned by the
 * WebGL scene; this overlay never changes a device, camera or rack placement. */
(() => {
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=(a,b,p)=>{const t=clamp((p-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function segmentHits(a,b,box){
    // Liang–Barsky clipping catches diagonal crossings as well as horizontal
    // leaders. Two-pixel clearance avoids visually touching unrelated hardware.
    let low=0,high=1;const dx=b.x-a.x,dy=b.y-a.y;
    for(const [p,q]of [[-dx,a.x-box.left],[dx,box.right-a.x],[-dy,a.y-box.top],[dy,box.bottom-a.y]]){
      if(Math.abs(p)<1e-7){if(q<0)return false;continue;}
      const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return false;
    }
    return high>0.015&&low<.985;
  }
  const boxPixels=(box,w,h,pad=0)=>({left:box.left*w-pad,right:box.right*w+pad,top:box.top*h-pad,bottom:box.bottom*h+pad});
  function mount(svg,canvas){
    if(!svg||!canvas)return {destroy(){}};
    const nodes=new Map();let state={visible:false,labels:[]},disposed=false;
    function element(tag,attributes,parent){const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,value);parent.append(el);return el;}
    function getNode(item){
      if(nodes.has(item.type))return nodes.get(item.type);
      const group=element('g',{'data-device-class':item.type},svg);
      const line=element('path',{class:'vo-callout-leader',pathLength:1},group);
      const anchor=element('circle',{class:'vo-callout-anchor',r:1.6},group);
      const primary=element('text',{class:'vo-callout-primary'},group);
      const secondary=element('text',{class:'vo-callout-secondary'},group);
      const node={group,line,anchor,primary,secondary};nodes.set(item.type,node);return node;
    }
    function update(event){
      if(disposed)return;
      const detail=event.detail||{},p=detail.progress??1;
      if(p<.18||p>=.327||canvas.dataset.coreState!=='ready'){
        svg.style.display='none';state={visible:false,labels:[]};return;
      }
      const {width:w,height:h}=canvas.getBoundingClientRect();if(!w||!h)return;
      svg.style.display='block';svg.style.visibility='visible';svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
      const compact=w<1000,margin=compact?18:32,font=compact?10:12;
      const obstacles=(detail.equipmentBounds||[]).filter(b=>b.visible!==false).map(b=>({...boxPixels(b,w,h,2),name:b.name}));
      const rack=detail.rackBounds?boxPixels(detail.rackBounds,w,h,3):null;
      if(rack&&Number.isFinite(rack.left))obstacles.push({...rack,name:'rack-frame'});
      const used=[],diagnostics=[];
      const items=[...(detail.callouts||[])].filter(item=>item.anchor?.visible!==false).sort((a,b)=>a.anchor.y-b.anchor.y);
      for(const [index,item]of items.entries()){
        const node=getNode(item),delay=index*.001,anchorOpacity=smooth(.19+delay,.197+delay,p)*(1-smooth(.319,.326,p));
        const lineProgress=smooth(.192+delay,.207+delay,p)*(1-smooth(.303,.324,p));
        const primaryOpacity=smooth(.199+delay,.214+delay,p)*(1-smooth(.293,.316,p));
        const secondaryOpacity=smooth(.204+delay,.219+delay,p)*(1-smooth(.282,.302,p));
        node.primary.textContent=item.label;node.secondary.textContent=compact?`×${item.count}`:`${item.description} · ×${item.count}`;
        node.primary.style.fontSize=`${font}px`;node.secondary.style.fontSize=`${font-2}px`;
        // SVG measurement uses the actual inherited font and tracking, keeping
        // long NVLink labels out of the hardware at every supported viewport.
        const labelW=Math.ceil(Math.max(node.primary.getComputedTextLength(),compact?0:node.secondary.getComputedTextLength()))+2;
        const labelH=compact?32:37;
        const anchors=(item.anchors?.length?item.anchors:[item.anchor]).filter(a=>a.visible!==false).map(a=>({x:a.x*w,y:a.y*h}));
        const ownBounds=item.bounds?boxPixels(item.bounds,w,h):null;
        const blockers=obstacles.filter(b=>b.name!==item.name);
        let best=null;
        // Outboard captions, sorted by projected height. Search both sides and
        // free vertical lanes; no fixed viewport coordinates stand in for 3D.
        for(const sign of [-1,1]){
          const outboard=sign<0?margin:w-margin-labelW;
          const adjacent=ownBounds?Math.max(margin,Math.min(w-margin-labelW,sign<0?ownBounds.left-labelW-54:ownBounds.right+54)):outboard;
          for(const left of [adjacent,outboard]){
          for(const anchor of anchors){
            for(const offset of [0,-36,36,-72,72,-112,112,-160,160,-220,220]){
              const baseline=Math.max(108+labelH,Math.min(h-106,anchor.y+offset));
              const label={left,right:left+labelW,top:baseline-labelH,bottom:baseline-3};
              if(used.some(b=>intersects({...label,top:label.top-14,bottom:label.bottom+14},b))||obstacles.some(b=>intersects(label,b)))continue;
              const near={x:sign<0?label.right+8:label.left-8,y:baseline};
              const far={x:sign<0?label.left:label.right,y:baseline};
              const elbow={x:near.x-sign*22,y:baseline};
              const path=[anchor,elbow,near,far];
              const crossings=blockers.filter(box=>path.slice(1).some((point,i)=>segmentHits(path[i],point,box))).length;
              const labelCrossings=used.filter(box=>path.slice(1).some((point,i)=>segmentHits(path[i],point,box))).length;
              // Labels never overlap hardware. Geometry silhouettes can
              // overlap their bounding boxes; an obstructed leader is omitted
              // rather than drawing through the rack or another component.
              const sidePenalty=ownBounds&&(sign<0?anchor.x>(ownBounds.left+ownBounds.right)/2:anchor.x<(ownBounds.left+ownBounds.right)/2)?80:0;
              const score=crossings*10000+labelCrossings*20000+distance(anchor,elbow)+Math.abs(offset)*.6+sidePenalty;
              if(!best||score<best.score)best={score,label,path,anchor,sign,crossings:crossings+labelCrossings};
            }
          }
          }
        }
        if(!best){node.group.style.visibility='hidden';continue;}
        node.group.style.visibility='visible';used.push(best.label);
        const {label,path,anchor,sign}=best,x=sign<0?label.right:label.left;
        for(const text of [node.primary,node.secondary]){text.setAttribute('x',x);text.setAttribute('text-anchor',sign<0?'end':'start');}
        node.primary.setAttribute('y',label.top+font);node.secondary.setAttribute('y',label.top+font+17);
        node.primary.style.opacity=primaryOpacity;node.secondary.style.opacity=secondaryOpacity;
        node.anchor.setAttribute('cx',anchor.x);node.anchor.setAttribute('cy',anchor.y);node.anchor.style.opacity=anchorOpacity;
        node.line.setAttribute('d',path.map((v,i)=>`${i?'L':'M'}${v.x.toFixed(2)},${v.y.toFixed(2)}`).join(' '));
        node.line.style.strokeDasharray=`${lineProgress} 1`;node.line.style.opacity=best.crossings?0:1;
        diagnostics.push({type:item.type,name:item.name,count:item.count,label:item.label,anchor,labelBounds:label,leader:path,leaderVisible:!best.crossings,primaryOpacity,secondaryOpacity});
      }
      const shown=new Set(items.map(item=>item.type));for(const [type,node]of nodes)if(!shown.has(type))node.group.style.visibility='hidden';
      state={visible:true,width:w,height:h,compact,labels:diagnostics};
    }
    canvas.addEventListener('pa-core-projection',update);
    const fallback=()=>{svg.style.display='none';state={visible:false,labels:[]};};
    canvas.addEventListener('pa-core-fallback',fallback);
    const api={getState:()=>JSON.parse(JSON.stringify(state)),destroy(){disposed=true;canvas.removeEventListener('pa-core-projection',update);canvas.removeEventListener('pa-core-fallback',fallback);svg.replaceChildren();delete svg.paHeroCallouts;}};
    svg.paHeroCallouts=api;return api;
  }
  window.PAHeroCallouts=Object.freeze({mount});
})();
