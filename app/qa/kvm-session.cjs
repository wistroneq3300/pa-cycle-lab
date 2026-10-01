const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const source=fs.readFileSync('static/js/kvm-session.js','utf8');
const {createKvmSession}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const clients=[],timers=new Map(),states=[];let seq=0;
class RFB extends EventTarget{
 constructor(){super();clients.push(this);}
 disconnect(){this.closed=true;this.dispatchEvent(new CustomEvent('disconnect',{detail:{clean:true}}));}
 focus(){this.focused=true;}
}
const session=createKvmSession({RFB,target:{},url:'ws://fixture',status:(...s)=>states.push(s),schedule:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},cancel:id=>timers.delete(id)});
session.connect();assert.equal(clients[0].scaleViewport,true);assert.equal(clients[0].resizeSession,false);
const fail=c=>c.dispatchEvent(new CustomEvent('disconnect',{detail:{clean:false}}));
for(let i=0;i<3;i++){fail(clients.at(-1));assert.equal(timers.size,1);const [id,t]=[...timers][0];assert.equal(t.ms,1000*2**i);timers.delete(id);t.fn();assert.equal(clients.at(-2).closed,true);}
fail(clients.at(-1));assert.equal(timers.size,0);assert.equal(states.at(-1)[0],'failed');assert.equal(clients.length,4);
session.connect();clients.at(-1).dispatchEvent(new Event('connect'));assert.equal(states.at(-1)[0],'connected');
fail(clients.at(-1));session.stop();assert.equal(timers.size,0);assert.equal(states.at(-1)[0],'stopped');
session.connect();const old=clients.at(-2);fail(old);assert.equal(states.at(-1)[0],'connecting');
clients.at(-1).dispatchEvent(new Event('credentialsrequired'));fail(clients.at(-1));assert.equal(states.at(-1)[0],'auth');assert.equal(timers.size,0);
session.connect();fail(clients.at(-1));session.dispose();assert.equal(timers.size,0);const count=clients.length;session.connect();assert.equal(clients.length,count);
console.log('PASS: initial scaling, 3 bounded backoff retries, fresh instances, manual stop/retry, authentication failure, stale events and disposal');
})().catch(e=>{console.error(e);process.exitCode=1});
