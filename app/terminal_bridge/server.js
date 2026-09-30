// Web Terminal Bridge (node/ssh2)
// 複刻已在 8888 驗證「OS+BMC 並行不崩 Invalid packet」的事件驅動架構，
// 並相容 pa-manager 前端既有 WS 協議：
//   - 前端連線:  /ws/terminal/{name}/{kind}?host=..&user=..&pass=..&port=..
//   - 前端送:    一般按鍵=文字或 binary；控制訊息= JSON {"type":"resize","cols":c,"rows":r}
//   - 回前端:    終端輸出=binary (Blob)；錯誤= JSON {"type":"error","msg":"..."}
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Client } = require('ssh2');

const PORT = Number(process.env.TERM_BRIDGE_PORT || 6968);
const HOST = process.env.TERM_BRIDGE_HOST || '0.0.0.0';

// 機台真實帳密來源：與 pa-manager 同一個 data.json。
// 前端 API 會把 os_pass/bmc_pass 遮蔽成 ****，bridge 不可信任前端傳的密碼，
// 一律以「name + kind」從 data.json 取真實帳密；前端 query 僅用於 passive 手動填寫覆寫。
const DATA_DIR = process.env.PA_DATA_DIR || '/srv/pa-manager-prod/data';
const DATA_FILE = path.join(DATA_DIR, 'data.json');
let CREDS = {}; // name -> { os:{host,user,pass,port}, bmc:{host,user,pass,port} }

function loadCreds() {
  CREDS = {};
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    const ms = d.machines || d;
    if (Array.isArray(ms)) {
      for (const m of ms) {
        const n = m.name;
        if (!n) continue;
        CREDS[n] = {
          os:  { host: m.os_ip,  user: m.os_user,  pass: m.os_pass,  port: m.os_port || 22 },
          bmc: { host: m.bmc_ip, user: m.bmc_user, pass: m.bmc_pass, port: m.bmc_port || 22 },
        };
      }
    } else {
      for (const [n, m] of Object.entries(ms)) {
        if (!m || typeof m !== 'object') continue;
        CREDS[n] = {
          os:  { host: m.os_ip,  user: m.os_user,  pass: m.os_pass,  port: m.os_port || 22 },
          bmc: { host: m.bmc_ip, user: m.bmc_user, pass: m.bmc_pass, port: m.bmc_port || 22 },
        };
      }
    }
  } catch (e) {
    console.error('[terminal-bridge] 讀取 data.json 失敗:', e && e.message || e);
  }
}

loadCreds();

function sendErr(ws, msg) { try { ws.send(JSON.stringify({ type: 'error', msg })); } catch {} }

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Web Terminal Bridge (node/ssh2) running.\n');
});

const wss = new WebSocketServer({ server, perMessageDeflate: false });

function handleTerminal(ws, url) {
  loadCreds(); // 每次連線前重新載入最新機台帳密（支援 runtime 新增大機台，不必重啟 bridge）
  const m = url.pathname.match(/^\/ws\/terminal\/([^/]+)\/([^/]+)$/);
  if (!m) { ws.close(4001, 'Bad path, expected /ws/terminal/{name}/{kind}'); return; }
  const name = decodeURIComponent(m[1]);
  const kind = m[2];
  if (kind !== 'os' && kind !== 'bmc') { sendErr(ws, 'kind 必須是 os 或 bmc'); return; }

  // 真實帳密優先取自 data.json（name + kind）；前端 query 只在前端 API 未遮蔽時覆寫。
  let host = url.searchParams.get('host') || '';
  let user = url.searchParams.get('user') || '';
  let pass = url.searchParams.get('pass') || '';
  const qPort = Number(url.searchParams.get('port') || 0);
  let port;
  const realHost = CREDS[name] && CREDS[name][kind] && CREDS[name][kind].host;

  if (realHost) {
    // data.json 有該機台 → 用真實帳密；query 只在「有值且非遮蔽」時覆寫
    const real = CREDS[name][kind];
    if (!host)                      host = real.host || '';
    if (!user)                      user = real.user || '';
    if (!pass || pass.indexOf('**') >= 0 || pass === '') pass = real.pass || '';
    host = host || real.host || '';
    if (qPort)                      port = qPort;
    else                            port = real.port || 22;
  } else {
    // data.json 沒有該機台（passive 手動填寫）→ 用 query
    if (!host || !user || !pass) { sendErr(ws, `${kind} 未設定連線資訊`); return; }
    port = qPort || 22;
  }
  if (!host || !user || !pass) { sendErr(ws, `${kind} 未設定連線資訊`); return; }

  let conn = null;
  let stream = null;
  let ready = false;

  const send = (type, payload) => {
    if (ws.readyState === ws.OPEN) {
      if (type === 'data') ws.send(payload);           // binary
      else ws.send(JSON.stringify({ type, ...(payload ? { msg: payload } : {}) }));
    }
  };

  ws.on('message', (data, isBinary) => {
    if (!stream) return;
    if (isBinary) {
      try { stream.write(data); } catch {}
      return;
    }
    // 嘗試 JSON 控制訊息（resize）
    let text;
    try { text = isBinary ? data.toString() : data.toString(); } catch { return; }
    let msg;
    try { msg = JSON.parse(text); } catch { try { stream.write(text); } catch {} return; }
    if (msg && msg.type === 'resize' && msg.cols && msg.rows && stream.setWindow) {
      try { stream.setWindow(parseInt(msg.rows, 10), parseInt(msg.cols, 10)); } catch {}
    } else if (msg && msg.type === 'data' && typeof msg.payload === 'string') {
      try { stream.write(msg.payload); } catch {}
    } else if (text.length) {
      try { stream.write(text); } catch {}
    }
  });

  ws.on('close', () => { cleanup(); });

  const cleanup = () => {
    if (stream) { try { stream.end(); } catch {} }
    if (conn) { try { conn.end(); } catch {} }
    stream = null; conn = null;
  };

  send('status', 'connecting...');

  const conn2 = new Client();
  conn2.on('ready', () => {
    conn2.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, str) => {
      if (err) { send('error', `SSH session 失敗: ${err.message}`); return; }
      stream = str;
      str.on('data', (d) => send('data', d));
      str.stderr.on('data', (d) => send('data', d));
      str.on('close', () => { if (ready) send('status', 'connection closed'); else send('error', 'SSH session closed before ready'); });
      conn2.on('close', () => {});
      ready = true;
      send('status', 'connected');
    });
  }).on('error', (err) => {
    let shown = String(err && err.message || err);
    if (/all configured authentication methods failed/i.test(shown)) shown = 'Authentication failed';
    send('error', `SSH 連線失敗: ${shown}`);
  }).connect({
    host, port, username: user, password: pass,
    readyTimeout: 15000,
  });
  conn = conn2;
}

// ---- 廣播終端（/ws/broadcast）：事件驅動 fan-out，多台 OS shell ----
function handleBroadcast(ws, url) {
  loadCreds(); // 每次連線前重新載入最新機台帳密（支援 runtime 新增大機台）
  let shells = {};      // name -> ssh2 Client stream

  const jsend = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };

  ws.on('message', (data, isBinary) => {
    let text;
    try { text = data.toString(); } catch { return; }
    let msg;
    try { msg = JSON.parse(text); } catch { return; }

    if (msg && msg.type === 'broadcast') {
      const payload = (typeof msg.data === 'string') ? msg.data : (JSON.stringify(msg.data));
      for (const nm of Object.keys(shells)) {
        try { shells[nm].write(payload); } catch {}
      }
    } else if (msg && msg.type === 'closeOne' && msg.name && shells[msg.name]) {
      shells[msg.name].end();
      delete shells[msg.name];
    } else if (msg && msg.type === 'sendOne' && msg.name && shells[msg.name]) {
      const payload = (typeof msg.data === 'string') ? msg.data : (JSON.stringify(msg.data));
      try { shells[msg.name].write(payload); } catch {}
    } else if (msg && msg.type === 'resize' && msg.cols && msg.rows) {
      for (const nm of Object.keys(shells)) {
        try { shells[nm].setWindow(parseInt(msg.rows,10), parseInt(msg.cols,10)); } catch {}
      }
    }
  });

  ws.on('close', () => { teardown(); });

  // 第一個 JSON 須為 {targets:[...], kind:"os"}
  ws.once('message', (data) => {
    let text; try { text = data.toString(); } catch {}
    let msg; try { msg = JSON.parse(text || ''); } catch {}
    if (!msg || !Array.isArray(msg.targets)) {
      jsend({ type:'error', msg:'廣播需先送 {targets:[...]}' });
      try { ws.close(); } catch {}
      return;
    }
    const kind = msg.kind || 'os';
    if (kind !== 'os') { jsend({ type:'error', msg:'廣播終端目前僅支援 OS shell' }); try{ws.close();}catch{} return; }

    const names = msg.targets;
    let pending = names.length;
    const joined = [];
    const failed = [];
    const started = (nm, stream) => {
      shells[nm] = stream;
      stream.on('data', (d) => {
        jsend({ type:'out', name:nm, data: d.toString('utf-8') });
      });
      stream.stderr.on('data', (d) => { jsend({ type:'out', name:nm, data: d.toString('utf-8') }); });
      stream.on('close', () => {
        jsend({ type:'closed', name:nm });
        if (shells[nm]) delete shells[nm];
      });
      joined.push(nm);
    };
    const done = () => {
      if (joined.length) {
        jsend({ type:'ready', joined, failed });
      } else {
        jsend({ type:'error', msg:'沒有主機可連線：' + (failed.join(', ') || '未知') });
        try { ws.close(); } catch {}
      }
    };

    for (const nm of names) {
      const cred = CREDS[nm] && CREDS[nm].os;
      if (!cred || !cred.host || !cred.user || !cred.pass) {
        failed.push(nm);
        pending--;
        if (pending === 0) done();
        continue;
      }
      const c = new Client();
      c.on('ready', () => {
        c.shell({ term:'xterm-256color', cols:100, rows:24 }, (err, stream) => {
          if (err) { failed.push(nm); }
          else { started(nm, stream); }
          pending--;
          if (pending === 0) done();
        });
      }).on('error', (err) => {
        failed.push(nm);
        pending--;
        if (pending === 0) done();
      }).connect({
        host: cred.host, port: cred.port || 22,
        username: cred.user, password: cred.pass,
        readyTimeout: 15000,
      });
    }
  });

  function teardown() {
    for (const nm of Object.keys(shells)) {
      try { shells[nm].destroy(); } catch {}
    }
    shells = {};
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/ws/broadcast') {
    handleBroadcast(ws, url);
  } else {
    handleTerminal(ws, url);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[terminal-bridge] listening on ws://${HOST}:${PORT}`);
});
