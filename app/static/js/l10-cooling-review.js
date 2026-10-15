/* Compatible review entry. Stage coordinates come from the central timeline;
 * the dashboard remains the sole authored movie playback owner. */
(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('l10AssetLab')!=='1'||params.get('l10Bareboard')!=='1'){
    params.set('l10AssetLab','1');params.set('l10Bareboard','1');
    location.replace(location.pathname+'?'+params.toString());return;
  }
  const timeline=window.PAL10Timeline,profile='coolingV2';
  const stages=Object.freeze({
    bareHero:{semantic:'bare',fraction:.5,inspection:'bare-hero',note:'裸板 · 2 CPU / 4 GPU · 兩片 Compute Board'},
    packages:{semantic:'silicon',fraction:.5,inspection:'bare-packages',note:'封裝接觸面 · 2 CPU / 4 GPU'},
    'plate-descent':{semantic:'plate-install',fraction:.5,inspection:null,note:'Cold plate 安裝 · Cinematic 組裝相機'},
    plumbing:{semantic:'plumbing',fraction:.5,inspection:'cooling-hero',note:'管路與接頭 · 全機構檢視'},
    flow:{semantic:'flow',fraction:.4,inspection:'cooling-close',note:'流路展示 · 供水與回水為示意，不代表 CFD 結果'},
    'fluid-timeB':{semantic:'flow',fraction:.7,inspection:'cooling-close',note:'流路推進 · 與前一畫面相同相機'},
    solid:{semantic:'solid',fraction:.5,inspection:'cooling-close',note:'實體水冷總成 · 流路展示已關閉'},
    lid:{semantic:'lid',fraction:.5,inspection:null,note:'上蓋閉合 · Cinematic 相機'},
    finished:{semantic:'bridge',fraction:.04,inspection:null,note:'完整設備 · 既有 Rack 銜接'},
    rack:{semantic:'rack',fraction:.35,inspection:null,note:'Rack Integration · 既有設備與互動'}
  });
  const canvas=document.querySelector('#system-core'),scene=window.PACoreScene.mount(canvas),status=document.querySelector('#status');
  function choose(id){
    if(!Object.hasOwn(stages,id))id='bareHero';
    const stage=stages[id];scene.setProgress(timeline.stageProgress(stage.semantic,stage.fraction,profile));scene.resetOrbit();scene.setInspection(stage.inspection);
    document.querySelectorAll('[data-stage]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stage===id)));
    document.querySelector('#note').textContent=stage.note;
    params.set('stage',id);history.replaceState(null,'',location.pathname+'?'+params.toString());
  }
  const movieLink=document.querySelector('footer a');
  movieLink.textContent='完整動畫 · Scrub / Replay / Skip';
  document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.stage)));
  window.addEventListener('pa-core-projection',()=>{
    const state=scene.getState(),asset=state.asset;
    const id=asset.metadata?.extras?.id||'procedural';
    const cooling=state.cooling;
    const playbackProfile=cooling?.ready?profile:'legacy';
    movieLink.textContent=(timeline.definitions[playbackProfile].durationMs/1000).toFixed(1)+' 秒動畫 · Scrub / Replay / Skip';
    status.textContent=asset.loading?'Loading assets…':asset.failed?'FALLBACK · '+asset.error:cooling?.loading?'Loading cooling assembly…':cooling?.failed?'Cooling fallback · '+cooling.error:'Asset: '+id+' · '+(cooling?.ready?'cooling ready':asset.enabled?'bare-board loaded':'procedural');
    canvas.dataset.reviewAsset=id;canvas.dataset.reviewFallback=String(asset.failed||!!cooling?.failed);
  });
  choose(params.get('stage')||'bareHero');
  window.PAL10CoolingReview=Object.freeze({choose,scene,stages});
})();
