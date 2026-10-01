import RFB from '/static/vendor/novnc/core/rfb.js';
import {createKvmSession} from './kvm-session.js?v=20260924-ux1';
const machine=new URLSearchParams(location.search).get('m');
const $=id=>document.getElementById(id);
$('mname').textContent=machine||'\u672a\u6307\u5b9a\u8a2d\u5099';
document.title='KVM / '+(machine||'');
const session=createKvmSession({RFB,target:$('screen'),url:location.origin.replace(/^http/,'ws')+'/ws/kvm/'+encodeURIComponent(machine||''),
 status(state,info,seconds){
   const labels={connecting:'\u6b63\u5728\u5efa\u7acb KVM \u9023\u7dda\u2026',connected:'\u5df2\u9023\u7dda',stopped:'\u5df2\u505c\u6b62\u9023\u7dda\uff0c\u53ef\u624b\u52d5\u91cd\u8a66',auth:'\u9a57\u8b49\u5931\u6557\u6216\u9700\u8981\u6191\u8b49\uff0c\u8acb\u6aa2\u67e5 KVM \u8a2d\u5b9a',failed:'\u9023\u7dda\u5931\u6557\uff0c\u5df2\u505c\u6b62\u81ea\u52d5\u91cd\u8a66'};
   const text=state==='retrying'?'\u9023\u7dda\u4e2d\u65b7\uff0c'+seconds+'\u79d2\u5f8c\u91cd\u8a66 ('+info+'/3)':labels[state];
   $('st-dot').className='dot'+(state==='connected'?' on':['failed','stopped','auth'].includes(state)?' err':'');
   $('st-lbl').textContent=text;$('st-lbl').title=info;
   $('overlay').style.display=state==='connected'?'none':'flex';$('overlay').textContent=text;
   $('retry').disabled=['connecting','connected','retrying'].includes(state)||!machine;
   $('stop').disabled=['failed','stopped','auth'].includes(state);
 }});
$('retry').addEventListener('click',()=>session.connect());
$('stop').addEventListener('click',()=>session.stop());
$('screen').addEventListener('click',()=>session.focus());
window.addEventListener('resize',()=>session.refit());
window.addEventListener('pagehide',()=>session.dispose(),{once:true});
if(machine)session.connect();else{$('overlay').textContent='\u8acb\u5f9e\u8a2d\u5099\u8a73\u60c5\u91cd\u65b0\u958b\u555f KVM';$('retry').disabled=true;$('stop').disabled=true;}
