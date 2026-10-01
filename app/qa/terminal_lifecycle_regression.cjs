const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
let connection;
const clients = [];
class Client extends EventEmitter {
  constructor() {super(); this.ended = false; this.shellCalls = 0; clients.push(this);}
  connect() {return this;}
  end() {this.ended = true;}
  shell(options, callback) {this.shellCalls++; this.callback = callback;}
}
class WebSocketServer {on(event, callback) {connection = callback;}}
const source = fs.readFileSync('terminal_bridge/server.js','utf8');
vm.runInNewContext(source, {URL, Buffer, process:{env:{PA_DATA_DIR:'fixture',CYCLE_BRIDGE_TOKEN_FILE:'fixture-token'}}, console:{log(){},error(){}}, require(name) {
  if(name==='http') return {createServer:()=>({listen(){}})};
  if(name==='fs') return {readFileSync:file=>file==='fixture-token'?'x'.repeat(32):JSON.stringify({machines:{node:{os_ip:'192.0.2.1',os_user:'fixture',os_pass:'fixture'}}})};
  if(name==='crypto') return require('node:crypto');
  if(name==='path') return require('node:path');
  if(name==='ssh2') return {Client};
  if(name==='ws') return {WebSocketServer};
  throw Error(name);
}});
function socket(url) {
  clients.length=0;
  const ws=new EventEmitter(); ws.readyState=ws.OPEN=1; ws.messages=[];
  ws.send=msg=>ws.messages.push(JSON.parse(msg));
  ws.close=()=>{ws.readyState=3;ws.emit('close');};
  connection(ws,{url,headers:{'x-cycle-gateway':'x'.repeat(32)}}); return ws;
}
function stream() {
  const s=new EventEmitter(); s.stderr=new EventEmitter(); s.ended=false;
  s.end=s.destroy=()=>{s.ended=true;}; return s;
}
assert.doesNotThrow(()=>socket('/ws/terminal/%ZZ/os'));
assert.equal(clients.length,0);
for (const broadcast of [false,true]) {
  for (const afterReady of [false,true]) {
    const ws=socket(broadcast?'/ws/broadcast':'/ws/terminal/node/os');
    if(broadcast) ws.emit('message',Buffer.from(JSON.stringify({targets:['node'],kind:'os'})));
    const c=clients[0]; assert.ok(c);
    if(afterReady) c.emit('ready');
    ws.close(); assert.ok(c.ended);
    if(afterReady) {const s=stream();c.callback(null,s);assert.ok(s.ended);}
    else {c.emit('ready');assert.equal(c.shellCalls,0);}
  }
  const ws=socket(broadcast?'/ws/broadcast':'/ws/terminal/node/os');
  if(broadcast) ws.emit('message',Buffer.from(JSON.stringify({targets:['node'],kind:'os'})));
  const c=clients[0]; c.emit('ready'); const s=stream(); c.callback(null,s);
  ws.close(); assert.ok(c.ended); assert.ok(s.ended);
}
const ws=socket('/ws/broadcast');
ws.emit('message',Buffer.from(JSON.stringify({targets:['node','node'],kind:'os'})));
assert.equal(clients.length,1);
clients[0].emit('error',Error('synthetic failure'));
clients[0].emit('error',Error('repeated failure'));
assert.ok(clients[0].ended);
console.log('PASS: malformed URL, single/broadcast close before ready/during shell/after connect, duplicate targets and repeated errors; no sockets');

// A removed broadcast target cannot rejoin on a late ready callback.
for (const late of [false,true]) {
  const ws=socket('/ws/broadcast');
  ws.emit('message',Buffer.from(JSON.stringify({targets:['node'],kind:'os'})));
  const c=clients[0];
  if (!late) c.emit('ready');
  ws.emit('message',Buffer.from(JSON.stringify({type:'closeOne',name:'node'})));
  if (late) c.emit('ready');
  const channel=stream(); channel.writes=[];channel.write=v=>channel.writes.push(v);
  if(c.callback)c.callback(null,channel);
  ws.emit('message',Buffer.from(JSON.stringify({type:'broadcast',data:'DO NOT SEND'})));
  assert.equal(channel.writes.length,0);assert(c.ended);
}
clients.length=0;
const denied=new EventEmitter();denied.close=()=>{};denied.send=()=>{};
connection(denied,{url:'/ws/terminal/node/os',headers:{}});
assert.equal(clients.length,0);
console.log('PASS: gateway authentication and closeOne revocation including late SSH readiness');
