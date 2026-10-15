/* Fixed inspection views seek semantic stages through the central timeline.
 * The shipping dashboard remains the sole authored movie playback owner. */
(()=>{
  'use strict';
  const params=new URLSearchParams(location.search);
  if(params.get('l10AssetLab')!=='1'||params.get('l10Bareboard')!=='1'){
    params.set('l10AssetLab','1');params.set('l10Bareboard','1');
    location.replace(location.pathname+'?'+params.toString());return;
  }
  const timeline=window.PAL10Timeline,profile='coolingV2';
  const stages=Object.freeze({
    bare:{semantic:'bare',fraction:.5,inspection:'bare-hero',note:'裸板 · 2 CPU / 4 GPU · 兩片 Compute Board'},
    'plate-install':{semantic:'plate-install',fraction:.5,inspection:'cooling',note:'Cold plate 安裝 · 六個接觸面'},
    plumbing:{semantic:'plumbing',fraction:.5,inspection:'cooling',note:'管路接合 · 供水與回水'},
    flow:{semantic:'flow',fraction:.4,inspection:'cooling',note:'動態流路 · 示意流向，不代表 CFD 結果'},
    'flow-b':{semantic:'flow',fraction:.7,inspection:'cooling',note:'流路推進 · 與前一畫面相同相機'},
    solid:{semantic:'solid',fraction:.5,inspection:'cooling',note:'實體水冷總成 · 流路展示已關閉'},
    lid:{semantic:'lid',fraction:.5,inspection:'cooling-hero',note:'上蓋閉合 · 固定全景檢視'},
    rack:{semantic:'rack',fraction:1,inspection:null,note:'Rack · 已完成組裝'}
  });
  const canvas=document.querySelector('#system-core'),scene=window.PACoreScene.mount(canvas),status=document.querySelector('#status');
  function choose(id){
    if(!Object.hasOwn(stages,id))id='bare';
    const stage=stages[id],progress=timeline.stageProgress(stage.semantic,stage.fraction,profile);
    scene.setProgress(progress);scene.resetOrbit();scene.setInspection(stage.inspection);
    document.querySelectorAll('[data-stage]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stage===id)));
    document.querySelector('#note').textContent=stage.note;
    params.set('stage',id);history.replaceState(null,'',location.pathname+'?'+params.toString());
  }
  const movieLink=document.querySelector('footer a');
  movieLink.textContent='完整動畫 · Scrub / Replay / Skip';
  document.querySelectorAll('[data-stage]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.stage)));
  window.addEventListener('pa-core-projection',()=>{
    const {asset,cooling}=scene.getState(),id=asset.metadata?.extras?.id||'procedural';
    const playbackProfile=cooling?.ready?profile:'legacy';
    movieLink.textContent=(timeline.definitions[playbackProfile].durationMs/1000).toFixed(1)+' 秒動畫 · Scrub / Replay / Skip';
    status.textContent=asset.loading?'Loading assets…':asset.failed?'FALLBACK · '+asset.error:cooling?.loading?'Loading cooling assembly…':cooling?.failed?'Cooling fallback · '+cooling.error:'Asset: '+id+' · '+(cooling?.ready?'cooling ready':asset.enabled?'bare-board loaded':'procedural');
    canvas.dataset.reviewAsset=id;canvas.dataset.reviewFallback=String(asset.failed||!!cooling?.failed);
  });
  choose(params.get('stage')||'bare');
  window.PAL10CoolingReview=Object.freeze({choose,scene,stages,profile});
})();
