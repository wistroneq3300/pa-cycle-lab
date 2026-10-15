/* Inspection shell only. Uses the unchanged PA WebGL pipeline and film poses. */
(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  if(!params.has('l10AssetLab')){
    params.set('l10AssetLab','1');params.set('l10Bareboard','1');
    location.replace(location.pathname+'?'+params.toString());return;
  }
  const canvas=document.querySelector('#system-core'),scene=window.PACoreScene.mount(canvas);
  const views=['bare-front','bare-storage','bare-section','bare-hero','bare-packages','bare-network','rack'];
  function choose(view){
    if(!views.includes(view))view='bare-hero';
    scene.setProgress(view==='rack'?.723:.354);scene.resetOrbit();scene.setInspection(view==='rack'?null:view);
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.querySelector('#note').textContent=view==='bare-section'?'Section at X = 0.58 · Same 3D tray / closed lid · 118.75 × 33.75 × 15 mm SSD':'Concept display · 2 CPU / 4 GPU · BF3 × 2 / CX7 × 1 · 8 E1.S';
    params.set('view',view);history.replaceState(null,'',location.pathname+'?'+params.toString());
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.view)));
  const status=document.querySelector('#status');
  window.addEventListener('pa-core-projection',()=>{
    const a=scene.getState().asset;
    const id=a.metadata?.extras?.id||(a.metadata?'compute-board.glb / revision '+a.metadata.extras.prototypeRevision:'procedural');
    status.textContent=a.loading?'Loading asset…':a.failed?'FALLBACK · '+a.error:a.enabled?'Asset: '+id+' · fallback OFF':'Production procedural · prototype OFF';
    canvas.dataset.reviewAsset=id;canvas.dataset.reviewFallback=String(a.failed);
  });
  choose(params.get('view')||'bare-hero');
  window.PAL10Review=Object.freeze({choose,scene});
})();
