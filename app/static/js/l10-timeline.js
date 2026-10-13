/* One authored clock. Scene progress remains a choreography coordinate, not
 * elapsed-time percentage. Legacy Rack curves retain their original duration. */
(()=>{
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
  const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
  const smoother=x=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
  const legacyKeys=[[0,0],[1.7,.065],[3.3,.135],[5.4,.202],[6.6,.248],[8.4,.292],[8.65,.300],[9.7,.325],[9.9,.333],[12,.376],[13,.407],[17.5,.56],[21,.653333],[23.8,.733333],[26.2,.80],[27.2,.84],[29.7,.893333],[30.7,.906667],[33.2,.96],[35.2,1]];
  const coolingKeys=[[0,0],[1.7,.065],[3.3,.135],[5.4,.202],[7.5,.248],[9.3,.276],[9.6,.278],[9.9,.284],[10.5,.292],[11,.300],[13.9,.325],[14.3,.333],[15.1,.345],[16.5,.376],[17.5,.407],[22,.56],[25.5,.653333],[28.3,.733333],[30.7,.80],[31.7,.84],[34.2,.893333],[35.2,.906667],[37.7,.96],[39.7,1]];
  const stages=[['bare',0,3.3],['silicon',3.3,7.5],['plate-install',7.5,9.3],['plumbing',9.3,10.5],['flow',10.5,14.3],['restore',14.3,15.1],['solid',15.1,16.5],['lid',16.5,17.5],['bridge',17.5,22],['rack',22,39.7]].map(([id,start,end])=>Object.freeze({id,startMs:start*1000,endMs:end*1000}));
  const markers=Object.freeze({bareEnd:3.3,plateStart:7.5,plateSeated:9.6,plumbingStart:9.3,plumbingLowered:9.9,plumbingSeated:10.5,flowStart:10.5,flowVisible:11,flowEnd:14.3,metalRestored:15.1,lidStart:16.5,lidEnd:17.5,bridgeEnd:22});
  const make=(id,keys)=>Object.freeze({id,durationMs:keys.at(-1)[0]*1000,keys:Object.freeze(keys.map(Object.freeze))});
  const definitions=Object.freeze({legacy:make('legacy-35.2',legacyKeys),coolingV2:make('cooling-v2-39.7',coolingKeys)});
  function definition(mode){if(!Object.hasOwn(definitions,mode))throw new Error('Unknown L10 timeline');return definitions[mode];}
  function progressAt(milliseconds,mode='legacy'){
    const d=definition(mode),seconds=Math.max(0,Number(milliseconds)||0)/1000;
    for(let i=1;i<d.keys.length;i++){const [end,b]=d.keys[i],[start,a]=d.keys[i-1];if(seconds<=end)return a+(b-a)*smooth((seconds-start)/(end-start));}return 1;
  }
  function timeAt(value,mode='legacy'){
    const d=definition(mode),p=clamp(value);if(p===0)return 0;if(p===1)return d.durationMs;
    for(let i=1;i<d.keys.length;i++){const [end,b]=d.keys[i],[start,a]=d.keys[i-1];if(p<=b){
      const q=(p-a)/(b-a);if(q===0)return start*1000;if(q===1)return end*1000;
      // Inverse smoothstep; deterministic and monotonic even near stationary keys.
      let lo=0,hi=1;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(smooth(mid)<q)lo=mid;else hi=mid;}
      return (start+(end-start)*(lo+hi)/2)*1000;
    }}return d.durationMs;
  }
  function sample(p,mode='legacy'){
    const d=definition(mode),timeMs=timeAt(p,mode),stage=mode==='coolingV2'?(stages.find(s=>timeMs<s.endMs)||stages.at(-1)):null;
    return {progress:clamp(p),timeMs,durationMs:d.durationMs,timeProgress:timeMs/d.durationMs,stage:stage?.id||'legacy',stageProgress:stage?clamp((timeMs-stage.startMs)/(stage.endMs-stage.startMs)):timeMs/d.durationMs};
  }
  function stageProgress(id,fraction=.5,mode='coolingV2'){
    if(mode!=='coolingV2')throw new Error('Named cooling stages require coolingV2');
    const s=stages.find(s=>s.id===id);if(!s)throw new Error('Unknown cooling stage');
    return progressAt(s.startMs+(s.endMs-s.startMs)*clamp(fraction),mode);
  }
  function coolingPose(p){
    const sampleTime=sample(p,'coolingV2'),t=sampleTime.timeMs/1000,m=markers;
    const span=(a,b)=>smoother((t-a)/(b-a)),cooling=span(m.plateStart,m.plateSeated);
    return {cooling,coolingLift:1-cooling,plumbing:span(m.plumbingStart,m.plumbingSeated),
      plumbingLift:.60*(1-span(m.plumbingStart,m.plumbingLowered)),plumbingZ:.10*(1-span(m.plumbingLowered,m.plumbingSeated)),
      coolingVisibility:span(m.plateStart-.35,m.plateStart),plumbingVisibility:span(m.plumbingStart-.40,m.plumbingStart),
      flow:span(m.flowStart,m.flowVisible)*(1-span(m.flowEnd,m.metalRestored)),
      flowTravel:Math.max(0,t-m.flowStart)*.85,clock:sampleTime,
      phase:({'bare':'bare-board','silicon':'silicon-detail','plate-install':'cooling-install','plumbing':'manifold-connect','flow':'cooling-reveal','restore':'cooling-restore','solid':'l10-hero','lid':'chassis-close','bridge':'camera-bridge','rack':'rack-integration'})[sampleTime.stage]};
  }
  function cameraWeights(p){
    const t=timeAt(p,'coolingV2')/1000,span=(a,b)=>smoother((t-a)/(b-a));
    return {bare:1-span(6.7,7.5),detail:span(2.5,4.1)*(1-span(6.3,7.5)),
      cooling:span(6.3,7.5)*(1-span(15.1,16.5)),reveal:span(9.6,10.5)*(1-span(14.3,15.1))};
  }
  window.PAL10Timeline=Object.freeze({definitions,stages:Object.freeze(stages),markers,progressAt,timeAt,sample,stageProgress,coolingPose,cameraWeights});
})();
