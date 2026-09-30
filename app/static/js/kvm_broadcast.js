/* KVM Broadcast — 依專案把多台系統的 BMC KVM 一起顯示，並可「鍵盤/滑鼠同步廣播」。
 *
 * 架構（方案 2）：
 *   - 每台系統一格，各自用 noVNC RFB client 連「後端的 /ws/kvm/{name}」代理。
 *   - 後端代登入 BMC（AMI/OneTree 或 OpenBMC），BMC 帳密不進瀏覽器。
 *   - 同步廣播：把「Master 格」的 keyboard/mouse 原生事件複製分派到每個 Slave 格的 canvas，
 *     讓每個 slave 的 RFB client 自己把它送進各自的 BMC KVM。
 *
 * 對外掛 window 的全域函式（供 app.js 的 onclick 呼叫）：
 *   openKvmBroadcast(project), closeKvmBroadcast()
 */
import RFB from "/static/vendor/novnc/core/rfb.js";

/* ---------- state ---------- */
const K = {
  project: null,
  rfbMap: new Map(),       // name -> {rfb, box, canvas, alive, master}
  master: null,            // 目前 master 的 name
  broadcast: false,        // 同步開關
  kbSync: true,
  msSync: true,
  overlay: null,
  solo: null,              // 單獨放大顯示的 name
};

/* ---------- 小工具 ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function $(id) { return document.getElementById(id); }

/* ---------- 從 app.js 的 machines 快取抓該專案有 BMC 的系統 ---------- */
function kvmCandidates(project) {
  const list = (window.kvmMachinesFn && window.kvmMachinesFn()) || [];
  return list.filter(m => m && m.bmc_ip && (m.project || "") === project);
}

/* ---------- 建立 overlay ---------- */
function ensureOverlay() {
  if (K.overlay) return K.overlay;
  const ov = document.createElement("div");
  ov.id = "kvm-overlay";
  ov.style.cssText = "position:fixed;inset:0;background:#0b0e13;z-index:99999;display:flex;flex-direction:column;font-family:system-ui;color:#dfe6f0;";
  ov.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#141a23;border-bottom:1px solid #2a3441;flex-wrap:wrap">
      <b>📺 KVM 廣播</b>
      <span id="kvm-proj" style="color:#8fb0f0"></span>
      <span style="color:#5a6b80">Master：</span>
      <select id="kvm-master" style="background:#0b0e13;color:#dfe6f0;border:1px solid #2a3441;border-radius:6px;padding:4px 8px"></select>
      <label style="color:#5a6b80;display:flex;align-items:center;gap:4px"><input type="checkbox" id="kvm-broadcast" checked> <span id="kvm-broadcast-lbl">🔊 同步廣播</span></label>
      <label style="color:#5a6b80;display:flex;align-items:center;gap:4px"><input type="checkbox" id="kvm-kbsync" checked> 鍵盤</label>
      <label style="color:#5a6b80;display:flex;align-items:center;gap:4px"><input type="checkbox" id="kvm-mssync" checked> 滑鼠</label>
      <span class="kvm-sep" style="width:1px;height:20px;background:#2a3441"></span>
      <button class="kvm-btn" onclick="kvmSendKey('F2', 0xffbd)">F2</button>
      <button class="kvm-btn" onclick="kvmSendKey('F11', 0xffc5)">F11</button>
      <button class="kvm-btn" onclick="kvmSendKey('F12', 0xffc6)">F12</button>
      <button class="kvm-btn" onclick="kvmSendKey('Esc', 0xff1b)">Esc</button>
      <button class="kvm-btn" onclick="kvmSendKey('Enter', 0xff0d)">Enter</button>
      <button class="kvm-btn" onclick="kvmSendCtrlAltDel()">Ctrl+Alt+Del</button>
      <span class="spacer" style="margin-left:auto"></span>
      <button class="kvm-btn" onclick="closeKvmBroadcast()">✕ 關閉</button>
    </div>
    <div id="kvm-status" style="padding:4px 14px;font-size:12px;color:#6f8498;background:#10151d;border-bottom:1px solid #1d252f"></div>
    <div id="kvm-banner" style="display:none;padding:8px 14px;font-size:13px;line-height:1.7"></div>
    <div id="kvm-grid" style="flex:1;overflow:auto;display:grid;padding:12px;gap:10px;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));align-content:start"></div>
  `;
  document.body.appendChild(ov);
  K.overlay = ov;
  return ov;
}

/* ---------- 連線一台 ---------- */
function connectOne(name, bmcIp) {
  const grid = $("kvm-grid");
  const box = document.createElement("div");
  box.className = "kvm-box";
  box.dataset.name = name;
  box.style.cssText = "background:#0f1319;border:1px solid #223043;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;";
  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #223043;background:#131a24;";
  head.innerHTML = `
    <span class="kvm-dot" style="width:8px;height:8px;border-radius:50%;background:#5a6b80"></span>
    <span class="kvm-role" style="font-size:11px;font-weight:700;color:#8fb0f0;background:#1d2a46;border:1px solid #2f4259;border-radius:4px;padding:1px 6px"></span>
    <b style="font-size:13px"></b>
    <span class="kvm-bmc" style="color:#5a6b80;font-size:11px"></span>
    <span class="spacer" style="margin-left:auto"></span>
    <button class="kvm-fullbtn" style="background:#1d2a3a;color:#dfe6f0;border:1px solid #2f4259;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer" title="單獨放大這台到全畫面（單台 KVM 控制）">⛶ 單獨</button>
    <button class="kvm-mkbtn" style="background:#1d2a3a;color:#dfe6f0;border:1px solid #2f4259;border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer" title="設為 Master（主控，鍵鼠同步由此格廣播）">★ 設為 Master</button>
  `;
  head.querySelector("b").textContent = name;
  head.querySelector(".kvm-bmc").textContent = bmcIp;
  const roleEl = head.querySelector(".kvm-role");
  const canvasWrap = document.createElement("div");
  canvasWrap.style.cssText = "flex:1;background:#000;min-height:220px;";
  box.appendChild(head);
  box.appendChild(canvasWrap);
  grid.appendChild(box);

  const wsUrl = `${location.origin.replace(/^http/, "ws")}/ws/kvm/${encodeURIComponent(name)}`;
  let rfb;
  try {
    rfb = new RFB(canvasWrap, wsUrl, {
      wsProtocols: [],
      scaleViewport: true,
      qualityLevel: 8,
      compressionLevel: 9,
      showDotCursor: true,
    });
    // 官方 noVNC v1.5.0：RFB 在建構子傳入 wsUrl 即自動 `_connect()`，無公開 `connect()` 方法。
  } catch (e) {
    head.querySelector(".kvm-dot").style.background = "#e05656";
    box.title = "建立 RFB 失敗：" + e.message;
    return;
  }
  const rec = { name, rfb, box, canvasWrap, roleEl, alive: false, master: false };
  K.rfbMap.set(name, rec);

  rfb.addEventListener("connect", () => { markMasterUI(); });
  rfb.addEventListener("disconnect", (e) => {
    const detail = e && e.detail && e.detail.clean ? "" : "（已斷線，會自動重連）";
    showStatus(`${name} 斷線${detail}`);
  });
  rfb.addEventListener("securityfailure", (e) => {
    head.querySelector(".kvm-dot").style.background = "#ffb020";
    showStatus(`${name} 認證失敗：${e.detail ? e.detail.reason : "未知"}`);
  });

  // 若尚未指定 master，預設這台就是 master（讓開起來就可用、確定性設定）
  if (!K.master) { K.master = name; }
  const selfBtn = head.querySelector(".kvm-mkbtn");
  selfBtn.onclick = () => { K.master = name; $("kvm-master").value = name; markMasterUI(); showStatus(`Master 切換為 ${name}`); };
  const fullBtn = head.querySelector(".kvm-fullbtn");
  fullBtn.onclick = () => kvmSolo(name);
  head.addEventListener("click", () => { try { rfb.focus && rfb.focus(); } catch (e) {} });
  updateMasterSelect();
  markMasterUI();
  // 不依賴 connect 事件：用輪詢讀 noVNC 真實連線狀態，作為 alive / 紅綠點判斷
  const dot = head.querySelector(".kvm-dot");
  (function poll() {
    rec.pollT = setTimeout(poll, 600);
    const st = rec.rfb ? rec.rfb._rfbConnectionState : null;
    const isUp = st === "connected";
    if (isUp !== rec.alive) {
      rec.alive = isUp;
      dot.style.background = isUp ? "#3ad28b" : (st === "connecting" ? "#ffb020" : "#e05656");
      rec.aliveEl = dot;
    }
  })();
}

/* ---------- 更新 Master 下拉 ---------- */
function updateMasterSelect() {
  const sel = $("kvm-master");
  sel.innerHTML = "";
  K.rfbMap.forEach((rec, name) => {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  });
  if (K.master && K.rfbMap.has(K.master)) sel.value = K.master;
  else { K.master = sel.value; }
}

function markMasterUI() {
  K.rfbMap.forEach((rec, name) => {
    const box = rec.box;
    const isMaster = (rec.name === K.master);
    box.style.borderColor = isMaster ? "#f0b64a" : "#223043";
    box.style.boxShadow = isMaster ? "0 0 0 1px #f0b64a" : "none";
    if (rec.roleEl) {
      rec.roleEl.textContent = isMaster ? "★ MASTER" : "SLAVE";
      rec.roleEl.style.visibility = "visible";
      rec.roleEl.style.background = isMaster ? "#3a2f14" : "#1d2a46";
      rec.roleEl.style.color = isMaster ? "#f0b64a" : "#8fb0f0";
      rec.roleEl.style.borderColor = isMaster ? "#b88b2a" : "#2f4259";
    }
  });
}

/* ---------- 狀態列 ---------- */
function showStatus(msg) {
  const el = $("kvm-status");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => {
    const live = [...K.rfbMap.values()].filter(r => r.alive).length;
    el.textContent = `${live}/${K.rfbMap.size} 已連線 · Master：${K.master || "—"} · 同步：${K.broadcast ? "開" : "關"}`;
  }, 2500);
}

/* =====================================================================
 * 同步廣播核心：攔截 master 格的 keyboard/mouse，複製到所有 slave 格。
 * ===================================================================== */
function installInputMirror() {
  // 用 capture 在所有 input 事件的 capture 階段攔截，避免 slave 自己的處理器先跑
  document.addEventListener("keydown", mirrorInput, true);
  document.addEventListener("keyup", mirrorInput, true);
  document.addEventListener("mousedown", mirrorInput, true);
  document.addEventListener("mouseup", mirrorInput, true);
  document.addEventListener("mousemove", mirrorInput, true);
  document.addEventListener("wheel", mirrorInput, true);
}

function mirrorInput(ev) {
  if (!K.broadcast || !K.master) return;
  const src = ev.target;
  // 來源必須是 master 格的 canvas
  const masterRec = K.rfbMap.get(K.master);
  if (!masterRec || !masterRec.rfb) return;
  const masterCanvas = masterRec.canvasWrap && masterRec.rfb._canvas;
  if (!masterCanvas) return;
  if (src !== masterCanvas) return;

  const isKey = ev.type === "keydown" || ev.type === "keyup";
  const isMouse = ev.type.startsWith("mouse") || ev.type === "wheel";
  if (isKey && !K.kbSync) return;
  if (isMouse && !K.msSync) return;

  // 只複製 master 格的輸入 → 分派給所有 slave 格
  let n = 0;
  K.rfbMap.forEach((rec, name) => {
    if (name === K.master) return;
    if (!rec.rfb || !rec.alive) return;
    const c = rec.rfb._canvas;
    if (!c) return;
    try {
      const clone = new ev.constructor(ev.type, ev);
      c.dispatchEvent(clone);
      n++;
    } catch (e) { /* 某些事件型別 clone 失敗就略過 */ }
  });
  // 視覺回饋（keydown/wheel 才顯示，mousemove 狂刷會蓋住狀態）
  if (n && (ev.type === "keydown" || ev.type === "mousedown" || ev.type === "wheel")) {
    const el = $("kvm-status");
    if (el) { el.textContent = `🔁 已同步 ${n} 台 slave（${ev.type}）`; }
  }
}

/* ---------- 對全部（或非 master）發送鍵盤按鍵 ---------- */
function kvmSendKey(label, sym) {
  K.rfbMap.forEach((rec, name) => {
    if (!rec.rfb || !rec.alive) return;
    try {
      rec.rfb.sendKey(sym, null, true);
      rec.rfb.sendKey(sym, null, false);
    } catch (e) {}
  });
  showStatus(`已送出 ${label}（全部 ${K.rfbMap.size} 台）`);
}

function kvmSendCtrlAltDel() {
  K.rfbMap.forEach((rec) => {
    if (!rec.rfb || !rec.alive) return;
    try { rec.rfb.sendCtrlAltDel(); } catch (e) {}
  });
  showStatus("已送出 Ctrl+Alt+Del（全部）");
}

/* ---------- Phase1：basecode 偵測 + 協議把關（點『KVM 廣播』時先跑） ---------- */
async function detectProjectBasecodes(project) {
  try {
    const r = await api(`/api/kvm/basecode?project=${encodeURIComponent(project)}`);
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

function setBanner(html, kind) {
  const el = $("kvm-banner");
  if (!el) return;
  if (!html) { el.style.display = "none"; el.innerHTML = ""; return; }
  const colors = {
    ok:   ["#0f1a12", "#1f4a2e", "#7fd69a"],
    warn: ["#1a1508", "#4a3d1f", "#e8c46a"],
    err:  ["#1a0f10", "#4a1f24", "#e88a8f"],
  };
  const [bg, bd, fg] = colors[kind] || colors.warn;
  el.style.cssText = `display:block;padding:8px 14px;font-size:13px;line-height:1.7;background:${bg};border-bottom:1px solid ${bd};color:${fg};`;
  el.innerHTML = html;
}

function detectDetailHTML(data) {
  const ms = data.machines || {};
  let rows = "";
  Object.keys(ms).forEach((n) => {
    const d = ms[n] || {};
    const dot = d.online ? "🟢" : "🔴離線";
    rows += `<div>· ${esc(n)} — ${esc(d.label || "未知")}（${esc(d.proto || "?")}）${dot}（${esc(d.bmc_ip || "-")}）</div>`;
  });
  const kindsStr = (data.detected_kinds || []).join("、") || "無";
  return `<div style="margin-top:2px"><b>偵測結果：</b>協議 = ${esc(kindsStr)}</div>${rows}`;
}

/* ---------- SP-X 卡片：本版本 KVM 不可用（無開啟按鈕） ---------- */
/* MegaRAC SP-X 使用專屬 IVTP 協定，本版本暫不提供 KVM 開啟，僅顯示「無法使用」。 */
function spxCard(name, bmcSubdomain) {
  const grid = $("kvm-grid");
  if (!grid) return;
  const box = document.createElement("div");
  box.className = "kvm-box";
  box.dataset.name = name;
  box.dataset.kind = "spx";
  box.style.cssText = "background:#0f1319;border:1px solid #3a2f14;border-radius:10px;overflow:hidden;" +
    "display:flex;flex-direction:column;min-height:220px;";
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #223043;background:#131a24">
      <span style="width:8px;height:8px;border-radius:50%;background:#7a4a4a;flex:0 0 auto"></span>
      <span style="font-size:11px;font-weight:700;color:#e8c46a;background:#2a2014;border:1px solid #4a3a28;border-radius:4px;padding:1px 6px;flex:0 0 auto">SP-X</span>
      <b class="spx-name" style="font-size:13px;color:#dfe6f0"></b>
      <span class="spx-bmc" style="color:#5a6b80;font-size:11px"></span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;color:#9fb0c4;text-align:center">
      <b style="color:#e88a8f;font-size:14px">MegaRAC SP-X</b>
      <div style="font-size:12px;line-height:1.7;max-width:360px">⚠ KVM 無法使用：本機為 MegaRAC SP-X，使用專屬 IVTP 協定，本版本不提供 KVM 開啟。</div>
    </div>`;
  box.querySelector(".spx-name").textContent = name;
  box.querySelector(".spx-bmc").textContent = subdomainToIp(bmcSubdomain);
  grid.appendChild(box);
}

/* bmc-<id>.kvm.lab... -> bmc-internal-a（顯示用；也是 broker 的 server_id 對照來源） */
function subdomainToIp(sub) {
  const m = /^bmc-([0-9-]+)\.kvm\./.exec(sub || "");
  return m ? m[1].replace(/-/g, ".") : (sub || "");
}

/* 伺服器 BMC IP -> dedicated subdomain：INTERNAL_IP_2 -> bmc-bmc-internal-a.kvm.lab.example.internal
   （與 nginx `map $host $bmc_upstream` 的 allowlist 命名一致） */
function subdomainFor(bmcIp) {
  const sid = String(bmcIp || "").replace(/\./g, "-");
  return sid ? `bmc-${sid}.kvm.lab.example.internal` : "";
}

/* 非 RFB / 離線 卡片：不連線，只顯示 basecode 與原因（SP-X 另走 spxCard） */
function offlineCard(name, baseLabel, ip, reason) {
  const grid = $("kvm-grid");
  if (!grid) return;
  const box = document.createElement("div");
  box.className = "kvm-box";
  box.dataset.name = name;
  box.dataset.kind = "offline";
  box.style.cssText = "background:#0f1319;border:1px dashed #4a3d1f;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;min-height:220px;";
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #223043;background:#131a24">
      <span style="width:8px;height:8px;border-radius:50%;background:#e05656;flex:0 0 auto"></span>
      <span style="font-size:11px;font-weight:700;color:#e05656;background:#2a2014;border:1px solid #4a3a28;border-radius:4px;padding:1px 6px;flex:0 0 auto">未開啟</span>
      <b class="oc-name" style="font-size:13px;color:#dfe6f0"></b>
      <span class="oc-bmc" style="color:#5a6b80;font-size:11px"></span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;color:#9fb0c4;text-align:center">
      <b style="color:#e05656;font-size:14px">⚠ 本機未連線</b>
      <div class="oc-reason" style="font-size:12px;line-height:1.7;max-width:360px"></div>
    </div>`;
  box.querySelector(".oc-name").textContent = name;
  box.querySelector(".oc-bmc").textContent = `${baseLabel || "未知"} · ${ip || "-"}`;
  box.querySelector(".oc-reason").textContent = reason || "離線 / 偵測失敗";
  grid.appendChild(box);
}

/* ---------- 主流程：開啟 ---------- */
async function openKvmBroadcast(project) {
  const cands = kvmCandidates(project);
  if (!cands.length) {
    alert(`專案「${project}」目前沒有帶 BMC IP 的系統可開 KVM。`);
    return;
  }

  K.project = project;
  K.rfbMap.clear();
  K.master = null;
  K.broadcast = true;

  const ov = ensureOverlay();
  ov.style.display = "flex";
  const gridEl = $("kvm-grid");
  if (!gridEl) { setBanner("KVM 廣播 overlay 元件未建立", "err"); return; }
  gridEl.innerHTML = "";
  $("kvm-master").innerHTML = "";
  setBanner(`⏳ 正在自動偵測 ${cands.length} 台 BMC 的 basecode / KVM 協議…`, "ok");

  // 1) 偵測
  const det = await detectProjectBasecodes(project);
  const detMap = det.ok ? (det.data.machines || {}) : {};
  if (!det.ok) {
    setBanner(`⚠ 偵測失敗（${esc(det.error)}）。將以「全部當 RFB」方式嘗試（可能部分失敗）。`, "warn");
  }

  // 2) 分類：RFB(可同步) / SP-X(走 auto-login 新分頁) / 其他離線或不可同步
  const rfbCands = [], spxCands = [], otherCands = [];
  for (const c of cands) {
    const d = detMap[c.name] || {};
    c._base = d.label || "未偵測";
    c._kind = d.kind || null;
    if (det.ok) {
      const online = !!d.online;
      const isRfb = d.rfb !== false;
      if (online && isRfb) {
        rfbCands.push(c);
      } else if (online && c._kind === "spx") {
        spxCands.push(c);          // SP-X：新分頁開原生 KVM（Plan A auto-login）
      } else {
        otherCands.push(c);
        c._reason = !online
          ? "離線 / BMC 帳密偵測失敗"
          : `${c._base}（非 RFB/IVTP）本版本未開放同步`;
      }
    } else {
      rfbCands.push(c);
    }
  }

  // 3) Banner + 偵測詳情
  if (det.ok) {
    if (!det.data.sync_ok && !spxCands.length) {
      // 完全 sync-incompatible 且沒有 SP-X 可開：只連 RFB 可同步的。
      const NL = '\n';
      const lines = Object.keys(det.data.machines || {}).map(function(n) {
        const d = (det.data.machines && det.data.machines[n]) || {};
        return '  ' + n + ' - ' + (d.label || '?') + ' / ' + (d.proto || '?');
      }).join(NL);
      alert('KVM 無法同步廣播' + NL + NL +
            (det.data.reason || '協議不一致') + NL + NL +
            '偵測結果：' + NL +
            lines + NL + NL +
            '本頁仍會開啟，但只連線可同步的 RFB 系統。');
    }
    if (det.data.sync_ok) {
      setBanner(`✔ 協議一致，可同步。<br>${detectDetailHTML(det.data)}`, "ok");
    } else if ((otherCands.length || spxCands.length) && rfbCands.length) {
      setBanner(`⚠ 協議不一致，無法「全部同步」。<br>
                 <div style="color:#e88a8f">原因：${esc(det.data.reason || "")}</div>
                 ${detectDetailHTML(det.data)}
                 <div style="margin-top:4px;color:#8fa0b5">SP-X（MegaRAC）本版本不提供 KVM，以「無法使用」卡片顯示；RFB 則並排同步。</div>`,
                "err");
    } else if (spxCands.length) {
      setBanner(`ℹ 本專案為 SP-X（MegaRAC IVTP），本版本不提供 KVM 開啟，顯示為「無法使用」。<br>${detectDetailHTML(det.data)}`, "warn");
    } else if (otherCands.length) {
      setBanner(`⚠ 本專案沒有可開啟的 RFB/SP-X 系統。<br>${detectDetailHTML(det.data)}`, "warn");
    } else {
      setBanner(detectDetailHTML(det.data), "ok");
    }
  }

  // 4) 卡片：SP-X 顯示「無法使用」；其他離線/不可同步為「未開啟」
  //    先更新 overlay 標題（無論有無 RFB 都會顯示目前專案）
  const projEl = $("kvm-proj");
  if (projEl) projEl.textContent = `｜專案：${project}（RFB ${rfbCands.length} 台 · SP-X ${spxCands.length} 台` + (otherCands.length ? ` · 其他 ${otherCands.length} 台不可同步` : "") + `）`;
  spxCands.forEach(c => spxCard(c.name, subdomainFor(c.bmc_ip)));
  otherCands.forEach(c => offlineCard(c.name, c._base, c.bmc_ip, c._reason));

  // 5) 完全沒有可連線的 RFB（可同步）系統 → 早退（SP-X 卡已顯示）
  if (!rfbCands.length) {
    showStatus(spxCands.length ? `偵測到 ${spxCands.length} 台 SP-X（MegaRAC），KVM 不可用` : "沒有可開啟的 RFB 系統");
    return;
  }

  // 6) 綁定控制項並對 RFB 系統連線
  $("kvm-broadcast").checked = true; K.broadcast = true;
  $("kvm-kbsync").checked = true; K.kbSync = true;
  $("kvm-mssync").checked = true; K.msSync = true;
  $("kvm-broadcast").onchange = (e) => { K.broadcast = e.target.checked; $("kvm-broadcast-lbl").textContent = K.broadcast ? "🔊 同步廣播" : "🔇 只控制 Master"; };
  $("kvm-kbsync").onchange = (e) => { K.kbSync = e.target.checked; };
  $("kvm-mssync").onchange = (e) => { K.msSync = e.target.checked; };
  $("kvm-master").onchange = (e) => { K.master = e.target.value; markMasterUI(); showStatus(`Master 切換為 ${K.master}`); };

  rfbCands.forEach(c => connectOne(c.name, c.bmc_ip));

  if (!K.master) {
    const sel = $("kvm-master");
    if (sel.options.length) { K.master = sel.value; markMasterUI(); }
  }
  showStatus(`連線中 ${rfbCands.length} 台 RFB 系統…`);
}

function closeKvmBroadcast() {
  K.rfbMap.forEach(rec => {
    try { rec.rfb && rec.rfb.disconnect(); } catch (e) {}
    clearTimeout(rec.pollT);
  });
  K.rfbMap.clear();
  K.solo = null;
  // 徹底移除「返回多格」浮動按鈕（它在 body 上，不隨 overlay 隱藏）
  const backBtn = $("kvm-back-grid");
  if (backBtn) backBtn.remove();
  if (K.overlay) K.overlay.style.display = "none";
}

/* ---------- 單獨放大一台到全畫面（單台 KVM 控制） ---------- */
function kvmSolo(name) {
  const rec = K.rfbMap.get(name);
  if (!rec) return;
  K.solo = name;
  applySoloUI();
  showStatus(`單獨顯示：${name}（鍵鼠直接控制此台，不廣播）`);
  try { rec.rfb.focus && rec.rfb.focus(); } catch (e) {}
}

function kvmBackToGrid() {
  K.solo = null;
  applySoloUI();
  showStatus(`回到多格廣播檢視（Master：${K.master || "—"}）`);
}

function applySoloUI() {
  let backBtn = $("kvm-back-grid");
  if (K.solo) {
    K.rfbMap.forEach((r, n) => {
      const single = (n === K.solo);
      r.box.style.display = single ? "flex" : "none";
      r.box.style.gridColumn = "1 / -1";
      r.box.style.gridRow = "1 / -1";
      r.box.style.position = "sticky";
      r.box.style.top = "0";
      r.box.style.minHeight = "calc(100vh - 140px)";
      // solo 時該格即為控制焦點，設為 master 以利 F2/鍵鼠
    });
    if (!backBtn) {
      backBtn = document.createElement("button");
      backBtn.id = "kvm-back-grid";
      backBtn.textContent = "◀ 返回多格";
      backBtn.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:100001;background:#f0b64a;color:#1a1206;border:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.5)";
      backBtn.onclick = kvmBackToGrid;
      document.body.appendChild(backBtn);
    }
    backBtn.style.display = "block";
  } else {
    K.rfbMap.forEach((r) => {
      r.box.style.display = "flex";
      r.box.style.gridColumn = "";
      r.box.style.gridRow = "";
      r.box.style.position = "";
      r.box.style.top = "";
      r.box.style.minHeight = "220px";
    });
    if (backBtn) backBtn.style.display = "none";
  }
}

/* ---------- 給 app.js 用的全域 hooks ---------- */
window.openKvmBroadcast = openKvmBroadcast;
window.closeKvmBroadcast = closeKvmBroadcast;
window.kvmSendKey = kvmSendKey;
window.kvmSendCtrlAltDel = kvmSendCtrlAltDel;

installInputMirror();
// 把 module 成功載入的可見狀態寫到 document title 提示列，方便除錯（Firefox 可能看不到 console）
try {
  const _b = document.createElement("div");
  _b.id = "kvm-loaded-marker";
  _b.style.cssText = "display:none";
  document.body.appendChild(_b);
} catch (e) {}
console.log("[kvm] KVM Broadcast module loaded");
window.__kvmLoaded = true;
