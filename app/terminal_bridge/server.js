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
const HOST = '127.0.0.1'; // Only the authenticated reservation-owning Web gateway connects.

// 機台真實帳密來源：與 pa-manager 同一個 data.json。
// 前端 API 會把 os_pass/bmc_pass 遮蔽成 ****，bridge 不可信任前端傳的密碼，
// Stored mode binds name + kind (+ slot) to one snapshot. Manual mode supplies all credentials.
const DATA_DIR = process.env.PA_DATA_DIR;
if (!DATA_DIR) throw new Error('Explicit isolated PA_DATA_DIR required');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
let CREDS = Object.create(null); // name -> connection snapshots

function loadCreds() {
  CREDS = Object.create(null);
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const d = JSON.parse(raw);
    const ms = d.machines || d;
    const build = (m) => {
      // osSlots: 多 OS 機框的每個 slot（slot 1..N）。os 預設=主 OS（os_ip）。
      let osSlots = null;
      if (Array.isArray(m.os) && m.os.length) {
        osSlots = m.os.map((e, i) => ({
          host: e.ip, user: e.user, pass: e.pass, port: e.port || 22,
          slot: e.slot, label: e.label || ('OS ' + e.slot),
          bmc: {host:e.bmc_ip,user:e.bmc_user,pass:e.bmc_pass,port:e.bmc_ssh_port || 22},
        }));
      }
      return {
        os:  { host: m.os_ip,  user: m.os_user,  pass: m.os_pass,  port: m.os_port || 22 },
        bmc: { host: m.bmc_ip, user: m.bmc_user, pass: m.bmc_pass, port: m.bmc_port || 22 },
        osSlots,
      };
    };
    if (Array.isArray(ms)) {
      for (const m of ms) {
        const n = m.name;
        if (!n) continue;
        CREDS[n] = build(m);
      }
    } else {
      for (const [n, m] of Object.entries(ms)) {
        if (!m || typeof m !== 'object') continue;
        CREDS[n] = build(m);
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

  // A masked/absent password selects stored mode; an explicit password selects manual mode.
  // kind==='os' 且帶 ?slot=N → 用多 OS 機框的第 N 個 OS（osSlots[N-1]）帳密。
  let host = url.searchParams.get('host') || '';
  let user = url.searchParams.get('user') || '';
  let pass = url.searchParams.get('pass') || '';
  const qPort = Number(url.searchParams.get('port') || 0);
  if (url.searchParams.get('port') && (!Number.isInteger(qPort) || qPort < 1 || qPort > 65535)) {
    sendErr(ws, 'Invalid SSH port'); return;
  }
  const qSlot = Number(url.searchParams.get('slot') || 0);
  let port;
  const entry = CREDS[name] || {};
  // 決定真實帳密來源：os + slot → osSlots[slot-1]；否則 os/bmc 主帳密
  let real = entry[kind];
  if (url.searchParams.has('slot')) {
    if (!Number.isInteger(qSlot) || qSlot < 1 || !entry.osSlots?.find(e => e.slot === qSlot)) {
      sendErr(ws, 'Invalid OS slot; reload equipment'); return;
    }
    const installed = entry.osSlots.find(e => e.slot === qSlot);
    real = kind === 'bmc' ? installed.bmc : installed;
  }
  const realHost = real && real.host;

  const manual = !!pass && !pass.includes('**');
  if (realHost && !manual) {
    // Stored secrets may only use their own endpoint/user/SSH-port snapshot.
    const storedPort = kind === 'bmc' && Number(real.port) === 623 ? 22 : Number(real.port || 22);
    if ((host && host !== real.host) || (user && user !== real.user) ||
        (url.searchParams.has('port') && url.searchParams.get('port') !== '' && qPort !== storedPort)) {
      sendErr(ws, 'Connection target changed; reload equipment or enter complete manual credentials'); return;
    }
    host = real.host; user = real.user; pass = real.pass; port = storedPort;
  } else {
    // Manual connections never borrow missing fields from inventory.
    if (!host || !user || !manual) { sendErr(ws, `${kind} 未設定連線資訊`); return; }
    port = qPort || 22;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) { sendErr(ws, 'Invalid SSH port'); return; }
  if (!host || !user || !pass) { sendErr(ws, `${kind} 未設定連線資訊`); return; }

  let conn = null;
  let stream = null;
  let ready = false;
  let closed = false;

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
    closed = true;
    if (stream) { try { stream.end(); } catch {} }
    if (conn) { try { conn.end(); } catch {} }
    stream = null; conn = null;
  };

  send('status', 'connecting...');

  const conn2 = new Client();
  conn = conn2;
  conn2.on('ready', () => {
    if (closed) { conn2.end(); return; }
    conn2.shell({ term: 'xterm-256color', cols: 120, rows: 30 }, (err, str) => {
      if (closed) { if (str) str.end(); conn2.end(); return; }
      if (err) { send('error', `SSH session 失敗: ${err.message}`); cleanup(); return; }
      stream = str;
      str.on('data', (d) => send('data', d));
      str.stderr.on('data', (d) => send('data', d));
      str.on('close', () => { if (ready) send('status', 'connection closed'); else send('error', 'SSH session closed before ready'); conn2.end(); });
      conn2.on('close', () => {});
      ready = true;
      send('status', 'connected');
    });
  }).on('error', (err) => {
    let shown = String(err && err.message || err);
    if (/all configured authentication methods failed/i.test(shown)) shown = 'Authentication failed';
    send('error', `SSH 連線失敗: ${shown}`);
    cleanup();
  }).connect({
    host, port, username: user, password: pass,
    readyTimeout: 15000,
  });
}

// ---- 廣播終端（/ws/broadcast）：事件驅動 fan-out，多台 OS shell ----
function handleBroadcast(ws, url) {
  loadCreds(); // 每次連線前重新載入最新機台帳密（支援 runtime 新增大機台）
  let shells = {};      // name -> ssh2 Client stream
  const clients = new Set();
  const revoked = new Set();
  const targetClients = new Map();
  let closed = false;

  const jsend = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };

  ws.on('message', (data, isBinary) => {
    let text;
    try { text = data.toString(); } catch { return; }
    let msg;
    try { msg = JSON.parse(text); } catch { return; }

    if (msg && msg.type === 'closeOne' && typeof msg.name === 'string') {
      revoked.add(msg.name);
      const stream = shells[msg.name]; delete shells[msg.name];
      try { stream?.destroy(); targetClients.get(msg.name)?.end(); } catch {}
      jsend({type:'closed',name:msg.name});
    } else if (msg && msg.type === 'broadcast') {
      const payload = (typeof msg.data === 'string') ? msg.data : (JSON.stringify(msg.data));
      for (const nm of Object.keys(shells)) {
        try { shells[nm].write(payload); } catch {}
      }
    } else if (msg && msg.type === 'sendOne' && msg.name && shells[msg.name]) {
      const payload = (typeof msg.data === 'string') ? msg.data : (JSON.stringify(msg.data));
      try { shells[msg.name].write(payload); } catch {}
    } else if (msg && msg.type === 'resize' && msg.cols && msg.rows) {
      const cols = parseInt(msg.cols,10), rows = parseInt(msg.rows,10);
      if (msg.name && shells[msg.name]) {
        // 指定單台（網格「同時顯示全部」時每格各自 resize）
        try { shells[msg.name].setWindow(rows, cols); } catch {}
      } else {
        // 沒指定 name → 套用所有 shell（向後相容）
        for (const nm of Object.keys(shells)) {
          try { shells[nm].setWindow(rows, cols); } catch {}
        }
      }
    }
  });

  ws.on('close', () => { teardown(); });

  // 第一個 JSON 須為 {targets:[...], kind:"os"}
  ws.once('message', (data) => {
    if (closed) return;
    let text; try { text = data.toString(); } catch {}
    let msg; try { msg = JSON.parse(text || ''); } catch {}
    if (!msg || !Array.isArray(msg.targets)) {
      jsend({ type:'error', msg:'廣播需先送 {targets:[...]}' });
      try { ws.close(); } catch {}
      return;
    }
    const kind = msg.kind || 'os';
    if (kind !== 'os') { jsend({ type:'error', msg:'廣播終端目前僅支援 OS shell' }); try{ws.close();}catch{} return; }

    const names = [...new Set(msg.targets.map(String))];
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
      if (closed) return;
      if (joined.length) {
        jsend({ type:'ready', joined, failed });
      } else {
        jsend({ type:'error', msg:'沒有主機可連線：' + (failed.join(', ') || '未知') });
        try { ws.close(); } catch {}
      }
    };

    if (!pending) { done(); return; }
    for (const nm of names) {
      // target 格式：純 name（主 OS，向後相容）或 name#slot
      //   slot=0（或無）→ 主 OS（CREDS[name].os）
      //   slot=N (>=1) → 多 OS 機框的節點（CREDS[name].osSlots[N-1]）
      const raw = String(nm);
      const hash = raw.indexOf('#');
      let root = raw, slot = 0;
      if (hash >= 0) {
        root = raw.slice(0, hash);
        const sv = raw.slice(hash + 1);
        slot = sv === '' ? 0 : (parseInt(sv, 10) || 0);
      }
      const rec = CREDS[root];
      let cred = null;
      if (rec) {
        if (slot <= 0) {
          cred = rec.os;   // 主 OS（單 OS 機台或 slot 0）
        } else {
          const osSlots = rec.osSlots || [];
          const si = osSlots.findIndex(e => e.slot === slot);
          if (osSlots[si]) {
            cred = { host: osSlots[si].host, user: osSlots[si].user, pass: osSlots[si].pass, port: osSlots[si].port || 22 };
          }
        }
      }
      if (!cred || !cred.host || !cred.user || !cred.pass) {
        failed.push(nm);
        pending--;
        if (pending === 0) done();
        continue;
      }
      const c = new Client();
      clients.add(c); targetClients.set(nm,c);
      let settled = false;
      const finish = (err, stream) => {
        if (closed || revoked.has(nm)) { if (stream) stream.destroy(); c.end(); return; }
        if (settled) return;
        settled = true;
        if (err) { failed.push(nm); c.end(); }
        else {
          started(nm, stream);
          stream.on('close', () => c.end());
        }
        pending--;
        if (pending === 0) done();
      };
      c.on('close', () => { clients.delete(c); if (!settled) finish(new Error('SSH closed before ready')); });
      c.on('ready', () => {
        if (closed || revoked.has(nm)) { c.end(); return; }
        c.shell({ term:'xterm-256color', cols:100, rows:24 }, finish);
      }).on('error', (err) => {
        if (settled) { c.end(); return; }
        finish(err);
      }).connect({
        host: cred.host, port: cred.port || 22,
        username: cred.user, password: cred.pass,
        readyTimeout: 15000,
      });
    }
  });

  function teardown() {
    closed = true;
    for (const nm of Object.keys(shells)) {
      try { shells[nm].destroy(); } catch {}
    }
    shells = {};
    for (const client of clients) { try { client.end(); } catch {} }
    clients.clear();
  }
}

wss.on('connection', (ws, req) => {
  try {
    const tokenFile = process.env.CYCLE_BRIDGE_TOKEN_FILE;
    const expected = tokenFile ? fs.readFileSync(tokenFile,'utf8').trim() : '';
    const supplied = String(req.headers['x-cycle-gateway'] || '');
    if (expected.length < 32 || expected.length !== supplied.length ||
        !require('crypto').timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) {
      ws.close(1008,'Authenticated gateway required'); return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/ws/broadcast') {
      handleBroadcast(ws, url);
    } else {
      handleTerminal(ws, url);
    }
  } catch {
    sendErr(ws, 'Invalid terminal connection request');
    try { ws.close(4001, 'Invalid connection request'); } catch {}
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[terminal-bridge] listening on ws://${HOST}:${PORT}`);
});
