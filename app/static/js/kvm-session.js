// Lifecycle controller accepts a transport constructor for offline contract tests.
export function createKvmSession({RFB,target,url,status,schedule=setTimeout,cancel=clearTimeout}) {
  let client=null,timer=null,generation=0,retries=0,disposed=false;
  const clear=()=>{if(timer!==null)cancel(timer);timer=null;};
  function release(){const old=client;client=null;generation++;if(old)try{old.disconnect();}catch{}}
  function connect(manual=false){
    if(disposed)return;
    clear();release();if(manual)retries=0;
    const token=generation;
    status('connecting','Connecting');
    try{
      const rfb=client=new RFB(target,url,{wsProtocols:[]});
      rfb.scaleViewport=true;rfb.resizeSession=false;rfb.clipViewport=false;
      const current=()=>!disposed&&client===rfb&&generation===token;
      let authFailed=false;
      rfb.addEventListener('connect',()=>{if(current()){clear();retries=0;status('connected','Connected');}});
      rfb.addEventListener('disconnect',e=>{
        if(!current()||authFailed)return;
        clear();
        if(e.detail?.clean){status('stopped','Disconnected');return;}
        if(retries>=3){status('failed','Retry limit reached');return;}
        const delay=1000*2**retries;retries++;
        status('retrying',String(retries),delay/1000);
        clear();timer=schedule(()=>{timer=null;connect();},delay);
      });
      const auth=()=>{if(current()){authFailed=true;clear();release();status('auth','Authentication required or failed');}};
      rfb.addEventListener('credentialsrequired',auth);rfb.addEventListener('securityfailure',auth);
      timer=schedule(()=>{timer=null;if(current()){release();status('failed','Connection timed out');}},15000);
    }catch(error){release();status('failed',error.message||'Connection failed');}
  }
  return {connect:()=>connect(true),stop(){clear();release();status('stopped','Stopped');},focus(){client?.focus();},refit(){if(client)client.scaleViewport=true;},dispose(){disposed=true;clear();release();}};
}
