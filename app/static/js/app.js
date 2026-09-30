"use strict";
/* Wistron PA Server Manager - frontend */
const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "首頁 / Dashboard", group: "總覽" },
  { id: "projects",  icon: "🖘", label: "System Manager", group: "管理" },
  { id: "rack",      icon: "🗄", label: "Rack Manager", group: "管理" },
];
const TITLES = { dashboard: "首頁 / Dashboard", projects: "System Manager", rack: "Rack Manager", machine: "單機詳情" };
const RENDERERS = { dashboard: pageDashboard, projects: pageProjects, rack: pageRack, machine: pageMachine };
const state = { view: "dashboard" };
let _activeProject = "";       // #/projects/{name}：目前定位的專案（deep-link + 高亮）
let _flashActiveProject = false;  // 只在 parseHash deep-link 時設 true（跳轉後閃一下再清掉）
const $ = (id) => document.getElementById(id);
const RACK_U = 48;          // 機櫃總 U 數（改 48U 標準）
const ROW_TOP = RACK_U + 1; // CSS grid 第 1 列在最上方（U48）；topRow = ROW_TOP - u
const RACK_SIZES = [1,2,3,4,6,8,12,16,24,32,48]; // 可選元件高度
let machines = [];
let projects = [];
// KVM 廣播（static/js/kvm_broadcast.js，type=module）需要這隻 callback 取機台清單
window.kvmMachinesFn = () => machines;
const root = document.documentElement;
function applyTheme(t) {
  root.dataset.theme = t;
  localStorage.setItem("pa_theme", t);
  $("mode-label").textContent = "Mode: " + (t === "dark" ? "Dark" : "Light");
}
function loadTheme() {
  const saved = localStorage.getItem("pa_theme") || "light";
  applyTheme(saved);
}
async function api(path, options) {
  options = options || {};
  // 停用瀏覽器 HTTP 快取：確保新增/刪除/重新掃描後一定拿到伺服器最新資料，不需 Ctrl+Shift+R
  if (!("cache" in options)) options.cache = "no-store";
  const r = await fetch(path, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.detail || "請求失敗"); e.data = data; throw e; }
  return data;
}
// 帶 timeout 的 api：AI 分析類請求避免因後端 LLM 忙碌而無限期卡住 spinner
async function apiWithTimeout(path, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { return await api(path, { signal: ctl.signal }); }
  finally { clearTimeout(t); }
}
async function loadMachines(assignMissingU) {
  const data = await api("/api/machines");
  machines = data.machines || [];
  if (data.last_scan) window.__lastScan = data.last_scan;
  // 一次性：為尚未有 rack_u 的 rack 機台指派 U（依專案內既有 order，由上往下 48→…）
  if (assignMissingU !== false) {
    const racks = machines.filter(m => m.level === "rack");
    const byProj = {};
    racks.forEach(m => { (byProj[m.project] = byProj[m.project] || []).push(m); });
    for (const p of Object.keys(byProj)) {
      const ms = byProj[p].sort((a,b)=>(a.order||0)-(b.order||0));
      let u = RACK_U;
      for (const m of ms) {
        if (m.rack_u === 0) continue; // 已「✕ 從機櫃移除」：只是維持 L11、取消 U 位置，不要自動補 U（避免重整後又出現）
        if (typeof m.rack_u !== "number" || m.rack_u < 1) {
          m.rack_u = u;
          // 同步寫回後端（非等待，失敗也不影響顯示）
          rackAssign(m.name, { rack_u: u }).catch(()=>{});
          u--;
        }
      }
    }
  }
}
async function loadProjects() {
  const data = await api("/api/projects");
  projects = data.projects || [];
}
// BMC 電源狀態 cell（System Manager 表格用）
function powerCell(m) {
  const p = m.power;
  if (p === "ON")  return `<span class="badge green"><span class="dot"></span>開機 <b>ON</b></span>`;
  if (p === "OFF") return `<span class="badge" style="background:var(--bg-panel-2);color:var(--text-dim)"><span class="dot" style="background:var(--text-faint)"></span>關機 <b>OFF</b></span>`;
  // 未知：BMC 離線 / 無 BMC / 尚未抓到
  return `<span style="color:var(--text-faint)">—</span>`;
}
function statusBadge(alive) {
  if (alive === true) return `<span class="badge green"><span class="dot"></span>在線</span>`;
  if (alive === false) return `<span class="badge red"><span class="dot"></span>離線</span>`;
  return `<span class="badge" style="background:var(--bg-panel-2);color:var(--text-faint)">未設定</span>`;
}
// BMC 電源狀態：解析 ipmitool 原始輸出（如 "Chassis Power is on/off"）→ 彩色 badge
function powerBadge(raw) {
  const s = String(raw || "").toLowerCase();
  if (/\bon\b/.test(s) && !/\boff\b/.test(s)) return `<span class="badge green"><span class="dot"></span>電源開啟 <span class="mono">ON</span></span>`;
  if (/\boff\b/.test(s)) return `<span class="badge red"><span class="dot"></span>電源關閉 <span class="mono">OFF</span></span>`;
  return `<span class="badge" style="background:var(--bg-panel-2);color:var(--text-faint)">未知</span>`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function projectMembers(pname) {
  return machines.filter(m => m.project === pname).sort((a, b) => (a.order||0) - (b.order||0));
}
function unassignedMachines() { return machines.filter(m => !m.project).sort((a,b)=>(a.order||0)-(b.order||0)); }
/* ---- 狀態分類（矩陣 / 堆疊條共用） ---- */
function mState(m) {
  if (m.os_alive === true) return "on";                                   // OS 在線
  if (m.bmc_alive === true || m.power === "ON") return "bmc";             // 有機/ BMC 在線，OS 未回
  if (m.os_alive === false || m.power === "OFF") return "off";            // 离线 / 電源关
  return "unk";                                                           // 未知
}
const _STATE_META = {
  on:  { label: "OS 在線", color: "var(--green)" },
  bmc: { label: "有機/無OS", color: "var(--amber)" },
  off: { label: "離線/斷電", color: "var(--red)" },
  unk: { label: "未知", color: "var(--text-faint)" },
};
function pageDashboard() {
  const total = machines.length;
  const online = machines.filter(m => m.os_alive === true).length;
  const offline = machines.filter(m => m.os_alive === false).length;
  const unknown = total - online - offline;
  const racks = machines.filter(m => isRackItem(m)).length;
  const systems = machines.filter(m => !isRackItem(m)).length;
  const pwrOff = machines.filter(m => m.power === "OFF").length;          // BMC 電源關機中
  const pwrOn  = machines.filter(m => m.power === "ON").length;           // BMC 電源開機中
  const rate = total ? Math.round(online / total * 100) : 0;
  const lastScan = window.__lastScan;
  const lastScanTxt = lastScan
    ? new Date(lastScan * 1000).toLocaleString("zh-TW", { hour12: false })
    : "";
  const lastAgo = lastScan
    ? Math.max(0, Math.round((Date.now() / 1000) - lastScan))
    : null;
  const agoTxt = lastAgo === null ? ""
    : lastAgo < 60 ? lastAgo + " 秒前"
    : lastAgo < 3600 ? Math.round(lastAgo / 60) + " 分鐘前"
    : Math.round(lastAgo / 3600) + " 小時前";
  const ring = total ? `
    <svg viewBox="0 0 120 120" class="donut">
      <circle class="donut-track" cx="60" cy="60" r="48"/>
      <circle class="donut-val good" cx="60" cy="60" r="48" stroke-dasharray="${(online/total)*301.6} 301.6"/>
      <circle class="donut-val warn" cx="60" cy="60" r="48" stroke-dasharray="${(unknown/total)*301.6} 301.6" stroke-dashoffset="${-(online/total)*301.6}"/>
      <circle class="donut-val bad" cx="60" cy="60" r="48" stroke-dasharray="${(offline/total)*301.6} 301.6" stroke-dashoffset="${-((online+unknown)/total)*301.6}"/>
      <text x="60" y="58" class="donut-n">${total}</text>
      <text x="60" y="74" class="donut-l">受管系統</text>
    </svg>` :
    `<div class="empty-small">尚無系統</div>`;
  const projCards = projects.map(p => {
    const members = projectMembers(p.name);
    const o = members.filter(m => m.os_alive === true).length;
    const managed = members.filter(m => m.os_ip || m.bmc_ip).length;   // 有管理介面的台數
    const abnormal = members.filter(m => (m.os_ip || m.bmc_ip) && m.os_alive !== true).length; // 有IP但離線/未知 = 異常
    const off = members.length - o;
    const n = members.length;
    const sizeCls = n >= 20 ? "lg" : n >= 5 ? "mid" : "sm";
    const healthy = abnormal === 0;
    const warnRatio = managed ? abnormal / managed : 0;
    const statusCls = healthy ? "ok" : (warnRatio >= 0.5 ? "bad" : "warn");
    const badge = healthy
      ? `<span class="dash-proj-badge ok" title="無異常">✓ 正常</span>`
      : `<span class="dash-proj-badge bad" title="${abnormal} 台異常">⚠ ${abnormal} 異常</span>`;
    return `
      <div class="dash-proj ${statusCls} ${sizeCls}" onclick="viewProject(${JSON.stringify(p.name)})" title="點我看此專案">
        <div class="dash-proj-head">
          <span class="dash-proj-name">📁 ${esc(p.name)}</span>
          ${badge}
          <span class="dash-proj-count">${n} 台</span>
        </div>
        ${p.desc ? `<div class="dash-proj-desc">${esc(p.desc)}</div>` : ""}
        <div class="dash-proj-stats">
          <span class="mini">🖥 L10 ${members.filter(m=>m.level!=="rack").length}</span>
          <span class="mini">🗄 L11 ${members.filter(m=>m.level==="rack").length}</span>
          <span class="mini green">● ${o} 線上</span>
          <span class="mini red">● ${off} 離線</span>
        </div>
      </div>`;
  }).join("");
  return `
    <div class="dash-kpis">
      <div class="stat"><div class="k">受管系統</div><div class="v">${total}</div></div>
      <div class="stat"><div class="k">Rack / L11</div><div class="v" style="color:var(--accent-blue)">${racks}</div></div>
      <div class="stat"><div class="k">System / L10</div><div class="v" style="color:var(--w-green)">${systems}</div></div>
      <div class="stat"><div class="k">在線率</div><div class="v" style="color:${rate >= 80 ? "var(--green)" : rate >= 50 ? "var(--amber)" : "var(--red)"}">${rate}<span style="font-size:14px;margin-left:2px">%</span></div></div>
      <div class="stat"><div class="k">電源 ON / OFF</div><div class="v"><span style="color:var(--green)">${pwrOn}</span><span style="color:var(--text-faint);font-size:18px"> / </span><span style="color:var(--red)">${pwrOff}</span></div></div>
      <div class="stat"><div class="k">離線</div><div class="v" style="color:var(--red)">${offline}</div></div>
    </div>
    ${lastScanTxt ? `<div class="dash-lastscan">📡 最後掃描 <b>${lastScanTxt}</b>（${agoTxt}）· 狀態為快取值，到系統管理頁點「⟳ 重新掃描」可即時重抓</div>` : ""}
    <div class="dash-mid">
      <div class="glass-panel health-panel">
        <div class="card-title">SUT Health Overview</div>
        <div class="health-body">
          <div class="hero-num">
            <span class="hero-big" style="color:${rate >= 80 ? "var(--green)" : rate >= 50 ? "var(--amber)" : "var(--red)"}">${rate}<span class="hero-unit">%</span></span>
            <span class="hero-cap">在線率</span>
          </div>
          <div class="hero-detail">
            <span class="mini green">● ${online} 在線</span>
            <span class="mini red">● ${offline} 離線</span>
            <span class="mini">● ${unknown} 未知</span>
          </div>
        </div>
      </div>
      <div class="glass-panel bars-panel">
        <div class="card-title">專案狀態分布 <span class="hint">全 ${total} 台 · 按狀態</span></div>
        <div class="donut-wrap">
          <svg viewBox="0 0 120 120" class="donut2">
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--bg-panel-2)" stroke-width="14"/>
            ${(() => {
              const c = { on: 0, bmc: 0, off: 0, unk: 0 };
              machines.forEach(m => c[mState(m)]++);
              const order = ["on", "bmc", "off", "unk"];
              const total2 = machines.length || 1;
              let acc = 0;
              const C = 2 * Math.PI * 42;
              return order.map(k => {
                if (!c[k]) return "";
                const frac = c[k] / total2;
                const dash = (frac * C).toFixed(3);
                const off = acc;
                acc += frac * C;
                return `<circle class="donut2-seg" cx="60" cy="60" r="42" fill="none" stroke="${_STATE_META[k].color}" stroke-width="14" stroke-dasharray="${dash} ${(C - dash).toFixed(3)}" stroke-dashoffset="${(-off).toFixed(3)}" style="transform:rotate(-90deg);transform-origin:60px 60px" title="${_STATE_META[k].label} ${c[k]} 台（${(frac * 100).toFixed(0)}%）"/>`;
              }).join("");
            })()}
            <text x="60" y="56" class="donut2-n">${total}</text>
            <text x="60" y="72" class="donut2-l">台系統</text>
          </svg>
          <div class="donut2-legend">
            ${["on", "bmc", "off", "unk"].map(k => {
              const n = machines.filter(m => mState(m) === k).length;
              const pct = total ? Math.round(n / total * 100) : 0;
              return `<div class="dl"><span class="dl-dot" style="background:${_STATE_META[k].color}"></span><span class="dl-label">${_STATE_META[k].label}</span><span class="dl-n">${n} <span class="dl-pct">${pct}%</span></span></div>`;
            }).join("")}
          </div>
        </div>
      </div>
    </div>
    <div class="dash-bottom">
      <div class="glass-panel proj-panel">
        <div class="card-title">Projects <span class="hint">${projects.length} 個專案</span></div>
        <div class="dash-proj-grid">${projCards}</div>
      </div>
      <div class="rack-cop-panel">
        <div class="rack-cop-head">
          <span class="cop-avatar ai">🤖</span>
          <div class="cop-title">AI Copilot</div>
          <button class="btn small rack-cop-clear" id="cop-clear" title="清除對話紀錄">🗑</button>
        </div>
        <div class="rack-cop-body" id="cop-box">
          <div class="cop-msg ai">
            <span class="cop-avatar ai">🤖</span>
            <div class="cop-bubble ai">👋 我是 AI Copilot。目前已監控 <b>${total}</b> 台系統、<b>${online}</b> 線上、<b>${offline}</b> 離線。問我任何問題～（例如「哪台有問題？」「proj_k 專案狀態？」）</div>
          </div>
        </div>
        <div class="rack-cop-input">
          <textarea id="cop-input" rows="1" placeholder="輸入訊息，Enter 送出…" autocomplete="off"></textarea>
          <button class="btn primary" id="cop-send">➤</button>
        </div>
      </div>
    </div>
  `;
}

let _copBusy = false;
function copAppend(role, html, raw) {
  const box = document.getElementById("cop-box");
  if (!box) return;
  const av = role === "user" ? "🧑" : "🤖";
  box.insertAdjacentHTML("beforeend", `<div class="cop-msg ${role}">
    <span class="cop-avatar ${role}">${av}</span>
    <div class="cop-bubble ${role}">${raw ? html : esc(html)}</div>
  </div>`);
  box.scrollTop = box.scrollHeight;
}
function copTyping(on) {
  const box = document.getElementById("cop-box");
  if (!box) return;
  let t = document.getElementById("cop-typing");
  if (on) {
    if (t) return;
    box.insertAdjacentHTML("beforeend", `<div class="cop-msg ai" id="cop-typing">
      <span class="cop-avatar ai">🤖</span><div class="cop-bubble ai typing">正在思考…</div></div>`);
  } else if (t) { t.remove(); }
  box.scrollTop = box.scrollHeight;
}
async function copSend() {
  const inp = document.getElementById("cop-input");
  const send = document.getElementById("cop-send");
  const text = (inp ? inp.value : "").trim();
  if (!text || _copBusy) return;
  copAppend("user", text);
  if (inp) inp.value = autoGrow(inp);
  _copBusy = true;
  if (send) { send.disabled = true; send.textContent = "…"; }
  copTyping(true);
  try {
    const r = await fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    const j = await r.json();
    copTyping(false);
    if (j.ok) copAppend("ai", j.reply, true);
    else copAppend("ai", `⨠ ${j.error || "呼叫失敗"}`);
  } catch (e) {
    copTyping(false);
    copAppend("ai", `⨠ 無法連線到後端： ${e.message}`);
  } finally {
    _copBusy = false;
    if (send) { send.disabled = false; send.textContent = "➤"; }
  }
}
function bindCopilot() {
  const inp = document.getElementById("cop-input");
  const send = document.getElementById("cop-send");
  const clr = document.getElementById("cop-clear");
  if (send) send.addEventListener("click", copSend);
  if (inp) inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); copSend(); }
  });
  if (inp) inp.addEventListener("input", () => autoGrow(inp));
  if (clr) clr.addEventListener("click", () => {
    const box = document.getElementById("cop-box");
    if (box) box.innerHTML = "";
    copAppend("ai", "👋 對話已清除。問我任何問題～（例如「哪台有問題？」）");
  });
}

function rackCopilotHtml() {
  const proj = rackView.project || "";
  return `
    <div class="rack-cop-panel">
      <div class="rack-cop-head">
        <span class="cop-avatar ai">🤖</span>
        <div class="cop-title">AI Copilot <span class="hint">${esc(proj) || "未選專案"}</span></div>
        <button class="btn small rack-cop-clear" id="rackcop-clear" title="清除對話紀錄">🗑</button>
      </div>
      <div class="rack-cop-body" id="rackcop-box">
        <div class="cop-msg ai">
          <span class="cop-avatar ai">🤖</span>
          <div class="cop-bubble ai">🖧 這裡的 Copilot 只會回答目前選中的機櫃專案：<b>${esc(proj) || "（尚未選擇）"}</b>。<br>可問「這櫃有幾台？哪些離線？溫度異常？」等。</div>
        </div>
      </div>
      <div class="rack-cop-input">
        <textarea id="rackcop-input" rows="1" placeholder="輸入訊息，Enter 送出…" autocomplete="off"></textarea>
        <button class="btn primary" id="rackcop-send">➤</button>
      </div>
    </div>`;
}
function rackCopAppend(role, html, raw) {
  const box = document.getElementById("rackcop-box");
  if (!box) return;
  const av = role === "user" ? "🧑" : "🤖";
  box.insertAdjacentHTML("beforeend", `<div class="cop-msg ${role}">
    <span class="cop-avatar ${role}">${av}</span>
    <div class="cop-bubble ${role}">${raw ? html : esc(html)}</div>
  </div>`);
  box.scrollTop = box.scrollHeight;
}
let _rackCopBusy = false;
function rackCopTyping(on) {
  const box = document.getElementById("rackcop-box");
  if (!box) return;
  let t = document.getElementById("rackcop-typing");
  if (on) {
    if (t) return;
    box.insertAdjacentHTML("beforeend", `<div class="cop-msg ai" id="rackcop-typing">
      <span class="cop-avatar ai">🤖</span><div class="cop-bubble ai typing">正在思考…</div></div>`);
  } else if (t) {
    t.remove();
  }
  box.scrollTop = box.scrollHeight;
}
async function rackCopSend() {
  const inp = document.getElementById("rackcop-input");
  const send = document.getElementById("rackcop-send");
  const text = (inp ? inp.value : "").trim();
  if (!text || _rackCopBusy) return;
  const proj = rackView.project || "";
  rackCopAppend("user", text);
  if (inp) inp.value = autoGrow(inp);
  if (send) { send.disabled = true; send.textContent = "…"; }

  // 後端 copilot 是同步叫本機 AI（vLLM），忙碌時可能達 60s 以上。
  // 用 AbortController 設上限，避免按鈕永久卡在 disabled。
  const COPTIMEOUT = 90000;
  async function ask() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), COPTIMEOUT);
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, project: proj }),
        signal: ctl.signal,
      });
      return await r.json();
    } finally { clearTimeout(t); }
  }

  _rackCopBusy = true;
  rackCopTyping(true);
  try {
    let j;
    try { j = await ask(); }
    catch (e) {
      // 逾時/繁忙：重試一次（AI 常因並發長請求暫時無回應）
      if (e && e.name === "AbortError") { rackCopAppend("ai", "⏳ AI 較慢，再試一次…"); try { j = await ask(); } catch (e2) { throw e2; } }
      else throw e;
    }
    rackCopTyping(false);
    if (j.ok) rackCopAppend("ai", j.reply, true);
    else rackCopAppend("ai", `⨠ ${j.error || "呼叫失敗"}`);
  } catch (e) {
    rackCopTyping(false);
    const msg = (e && e.name === "AbortError") ? "AI 逾時（90 秒）。目前可能有其他分析任務佔用，請稍後再試。" : `無法連線到後端： ${e && e.message ? e.message : e}`;
    rackCopAppend("ai", `⨠ ${msg}`);
  } finally {
    _rackCopBusy = false;
    if (send) { send.disabled = false; send.textContent = "➤"; }
  }
}
function autoGrow(el) {
  if (el && el.style) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }
  return "";
}
function bindRackCopilot() {
  const inp = document.getElementById("rackcop-input");
  const send = document.getElementById("rackcop-send");
  const clr = document.getElementById("rackcop-clear");
  if (send) send.addEventListener("click", rackCopSend);
  if (inp) inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); rackCopSend(); }
  });
  if (inp) inp.addEventListener("input", () => autoGrow(inp));
  if (clr) clr.addEventListener("click", () => {
    const box = document.getElementById("rackcop-box");
    if (box) box.innerHTML = "";
    const proj = rackView.project || "";
    rackCopAppend("ai", `🖧 對話已清除。仍只回答機櫃專案：<b>${proj || "（尚未選擇）"}</b>。`);
  });
}

function viewProject(pname) {
  projectLevelFilter.val = "all";
  _activeProject = pname || "";
  state.view = "projects";
  setView("projects");
}
/* ============ Rack Manager (L11 整櫃監控/控制) ============ */
const rackView = { mode: "list", project: "", pinged: null };
let racksProjectDesc = "";
function rackPowerState(name) {
  return rackSim[name] || (rackSim[name] = { on: true, led: "green" });
}
function rackSetProject(v) {
  rackView.project = v;
  rackView.pinged = null;
  setView("rack");
}
function rackSetMode(mode) {
  rackView.mode = mode;
  setView("rack");
}
async function rackPing(project) {
  const btn = $("rack-ping-btn");
  if (btn) { btn.textContent = "⏳ Ping 中…"; btn.disabled = true; }
  try {
    const data = await api(`/api/rack/ping?project=${encodeURIComponent(project)}`);
    rackView.pinged = data.nodes;
  } catch (e) {
    rackView.pinged = [];
    alert("Ping 失敗：" + e.message);
  }
  if (btn) { btn.textContent = "📡 Ping Rack"; btn.disabled = false; }
  setView("rack");
}
// 整櫃開/關機：彈出「廣播式多選」讓使用者勾選要同時控制哪些機台
// 通用「整櫃批量操作」多選對話框。kind: "on"|"off"|"reboot"|"aux"
// 沿用勾選框 + 全選/全不選，只對勾選的機台送出動作。
function rackBulkDialog(kind) {
  const project = rackView.project;
  let racks = machines.filter(m => m.level === "rack" && m.project === project);
  // reboot / aux 過濾掉空檔板(blanking)：這些沒有系統可控制。
  // 其餘 server/switch/pdu 等全部列出供勾選（即使尚未填 IP，未來填入即可批次發送）。
  // 整櫃操作需要能控制（具 OS 或 BMC IP）：過濾掉空檔板(blanking)與「沒有 IP」的元件。
  racks = racks.filter(m => (m.os_ip || m.bmc_ip) && mgxTypeOf(m) !== "blanking");
  if (!racks.length) return alert("此專案沒有可控制（具 OS/BMC IP）的整櫃機台");
  const mode = kind === "on" ? "開機" : kind === "off" ? "關機" : kind === "reboot" ? "Reboot" : "AUX / AC cycle";
  const icon = kind === "on" || kind === "off" ? "⏻" : kind === "reboot" ? "⟳" : "⚡";
  const rows = racks.map(m => {
    const info = mgxInfo(m);
    const badge = m.os_ip || m.bmc_ip ? `<span class="mono" style="color:var(--text-dim)">${esc(m.os_ip || m.bmc_ip)}</span>` : `${info.icon} ${esc(info.label)}`;
    return `<label class="bc-check" style="display:block;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer">
      <input type="checkbox" class="rcp-chk" value="${esc(m.name)}" checked>
      <b>${esc(m.name)}</b> ${badge}
    </label>`;
  }).join("");
  showDialog(`${icon} ${mode}整櫃 — 選擇要一起 ${mode} 的機台`, `
    <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:10px">
      勾選要一起「${mode}」的機台，會同時送出控制指令（不勾的機台會保持現狀）。
    </label>
    <div class="table-scroll" style="max-height:46vh;overflow:auto;margin-bottom:12px">${rows}</div>
    <div style="display:flex;gap:8px">
      <button class="btn small" onclick="racpSetAll(true)">☑ 全選</button>
      <button class="btn small" onclick="racpSetAll(false)">☐ 全不選</button>
      <span class="spacer"></span><span class="hint" id="rcp-sel-count">已選 ${racks.length} 台</span>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: `確認 ${mode}`, cls: kind === "off" ? "btn-danger" : kind === "reboot" ? "btn-warn" : "primary", fn: () => {
        const sel = [...document.querySelectorAll(".rcp-chk:checked")].map(x => x.value);
        closeDialog();
        if (!sel.length) { alert("請至少勾選一台機台。"); return; }
        rackBulkRun(kind, sel);
      } },
    ]);
}
function rackPowerAllDialog(on) { rackBulkDialog(on === false ? "off" : "on"); }
function rackBulkReboot() { rackBulkDialog("reboot"); }
function rackBulkAux() { rackBulkDialog("aux"); }
function racpSetAll(v) {
  document.querySelectorAll(".rcp-chk").forEach(c => c.checked = v);
  const n = document.querySelectorAll(".rcp-chk:checked").length;
  const el = $("rcp-sel-count"); if (el) el.textContent = `已選 ${n} 台`;
}
// 依 kind 對多台依序送出控制指令
async function rackBulkRun(kind, names) {
  const label = kind === "on" ? "開機" : kind === "off" ? "關機" : kind === "reboot" ? "Reboot" : "AUX / AC cycle";
  // reboot / aux 尚未接上真實指令，目前只做多選 UI 占位，不送出控制動作
  if (kind === "reboot" || kind === "aux") {
    const namesStr = names.map(n => "\u00b7 " + n).join("\n");
    alert(`「${label}」尚未實作接上系統指令。\n\n已選取 ${names.length} 台：\n${namesStr}\n\n之後會批次送出 ${label} 指令。`);
    return;
  }
  const okTag = kind === "on" ? "已開機 \ud83d\udfe2" : "已關機 \u26aa";
  const done = [];
  for (const name of names) {
    let url, body;
    url = `/api/machine/${encodeURIComponent(name)}/power`; body = JSON.stringify({ on: kind === "on" });
    try {
      const r = await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      done.push(`${name}: ${r.ok ? okTag : "失敗：" + (r.info || "")}`);
    } catch (e) {
      done.push(`${name}: 錯誤 ${e.message}`);
    }
  }
  setView("rack");
  setTimeout(() => alert(`正在執行 ${label} ${names.length} 台…\n\n` + done.join("\n")), 200);
}

async function rackPowerAllNames(names, on) {
  const okMsg = `正在${on ? "開機" : "關機"}${names.length} 台…`;
  const done = [];
  for (const name of names) {
    try {
      const r = await api(`/api/machine/${encodeURIComponent(name)}/power`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on })
      });
      done.push(`${name}: ${r.ok ? (on ? "已開機 🟢" : "已關機 ⚪") : "失敗：" + (r.info || "")}`);
    } catch (e) {
      done.push(`${name}: 錯誤 ${e.message}`);
    }
  }
  setView("rack");
  setTimeout(() => alert(okMsg + "\n\n" + done.join("\n")), 200);
}
async function singlePower(name, on) {
  if (!confirm(`確定要「${on ? "開機" : "關機"}」${name} 嗎？`)) return;
  await rackDoPower(name, on ? "poweron" : "poweroff");
}
async function auxCycle(name) {
  if (!confirm(`確定要對「${name}」執行 AUX / AC cycle（${name} 完整斷電重上電）嗎？`)) return;
  try {
    const r = await api(`/api/machine/${encodeURIComponent(name)}/aux`, { method: "POST" });
    setView("rack");
    setTimeout(() => alert(`${name} ${r.ok ? "AUX/AC cycle 已送出 ⚡" : "操作失敗：" + (r.info||"")}`), 200);
  } catch (e) {
    alert("操作失敗：" + e.message);
  }
}
async function rackDoPower(name, action) {
  if (action === "aux") return auxCycle(name);
  const on = action === "poweron";
  try {
    const r = await api(`/api/machine/${encodeURIComponent(name)}/power`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on })
    });
    setView("rack");
    setTimeout(() => alert(`${name} ${r.ok ? (on ? "已開機 🟢" : "已關機 ⚪") : "操作失敗：" + (r.info||"")}
目前狀態：${r.power_status}`), 200);
  } catch (e) {
    alert("操作失敗：" + e.message);
  }
}
// 元件控制對話框：開機／關機／reboot／AUX cycle ＋ -C 17 選擇
function machControlDialog(name) {
  const m = machines.find(x => x.name === name);
  if (!m) return;
  const info = mgxInfo(m);
  const hasPower = m.os_ip || m.bmc_ip;
  showDialog(`⚙ 元件控制 — ${info.icon} ${esc(name)}`, `
    <div class="rm-modal-body">
      <p style="margin-bottom:12px;font-size:12px;color:var(--text-faint)">
        選擇要對「<b>${esc(name)}</b>」進行的控制（${hasPower ? "此元件有連線資訊可控制" : "⚠️ 此元件沒有 BMC / OS 資訊" }）。
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <button class="btn btn-good" ${hasPower?"":"disabled"} onclick="singlePower('${esc(name)}',true)">⏻ 開機</button>
        <button class="btn btn-good" ${hasPower?"":"disabled"} onclick="singlePower('${esc(name)}',false)">⏻ 關機</button>
        <button class="btn btn-warn" ${hasPower?"":"disabled"} onclick="machineReboot('${esc(name)}')">⟳ Reboot</button>
        <button class="btn" ${hasPower?"":"disabled"} onclick="auxCycle('${esc(name)}')">⚡ AUX / AC cycle</button>
      </div>
      <p style="font-size:11px;color:var(--text-faint)">點上方按鈕即直接執行（會先彈確認）。開關機一律以 <code class="mono">-C 17</code> 送出。</p>
    </div>`,
    [
      { txt: "關閉", cls: "", fn: () => closeDialog() },
    ]);
}
// Reboot：SSH 進 OS 下 reboot（無 OS 才用 BMC power reset）
async function machineReboot(name) {
  if (!confirm(`確定要「Reboot」${name} 嗎？（OS reboot）`)) return;
  try {
    const r = await api(`/api/machine/${encodeURIComponent(name)}/reboot`, { method: "POST" });
    setView("rack");
    setTimeout(() => alert(`${name} ${r.ok ? "已送出 reboot ⟳" : "操作失敗：" + (r.info||"")}`), 200);
  } catch (e) { alert("操作失敗：" + e.message); }
}
function rackPingNode(m) {
  const n = (rackView.pinged || []).find(x => x.name === m.name);
  const osUp = n ? n.os_alive : null;
  const bmcUp = n ? n.bmc_alive : null;
  const lamp = (v) => v === true ? `<span class="ping-lamp on" title="Online">🟢</span>`
              : v === false ? `<span class="ping-lamp off" title="No reply">🔴</span>`
              : `<span class="ping-lamp none" title="未 Ping">⨪</span>`;
  const nm = `${esc(m.name)}${m.passive ? ' <span class="badge badge-rack" style="font-size:9px;padding:1px 6px">無BMC</span>' : ""}`;
  return `<td class="mono">${nm}</td>
          <td>${m.os_ip ? `${lamp(osUp)} <span class="ping-ip mono">${esc(m.os_ip)}</span>` : `<span style="color:var(--text-faint)">—</span>`}</td>
          <td>${m.bmc_ip ? `${lamp(bmcUp)} <span class="ping-ip mono">${esc(m.bmc_ip)}</span>` : `<span style="color:var(--text-faint)">—</span>`}</td>`;
}
/* ================= Rack Manager 整合頁（Rackmap + 卡片/清單 + MGX 元件） ================= */
const MGX_TYPES = {
  server:      { icon: "🖥", label: "Server 伺服器",    cls: "mgx-server" },
  switch:      { icon: "🔀", label: "Switch 交換器",    cls: "mgx-switch" },
  powershelf:  { icon: "⚡", label: "Power Shelf 電源", cls: "mgx-ps" },
  pdu:         { icon: "🔌", label: "PDU 電源分配器",   cls: "mgx-ps" },
  cdu:         { icon: "💧", label: "CDU 冷卻分配單元", cls: "mgx-cdu" },
  storage:     { icon: "💾", label: "Storage 儲存",     cls: "mgx-storage" },
  network:     { icon: "🌐", label: "Network 網路功能", cls: "mgx-network" },
  blanking:    { icon: "⬛", label: "Blank Panel", cls: "mgx-blanking", passive: true },
};

function mgxTypeLabel(m) {
  const t = mgxTypeOf(m);
  const info = MGX_TYPES[t] || MGX_TYPES.server;
  return info.label;
}
function mgxTypeShort(m) {
  const t = mgxTypeOf(m);
  return MGX_TYPES[t] ? t : "server";
}
function isRackItem(m) { return m.level === "rack" || !!m.passive; }
// 判斷機台是否屬於某個層級分頁（L10/L11），與 isRackItem 顯示一致，避免 L10 分頁混入顯示為 L11 的 passive 機台
function inLevelFilter(m, f) {
  if (f === "all") return true;
  return f === "rack" ? isRackItem(m) : !isRackItem(m);
}

function mgxTypeOf(m) {
  if (!m) return "server"; // 防呆：若資料缺項（undefined/null）不崩潰，回退為 server
  if (m.mgx_type && MGX_TYPES[m.mgx_type]) return m.mgx_type;
  const n = (m.name || "").toLowerCase();
  if (n.includes("sw")) return "switch";
  if (n.includes("ps") || n.includes("pdu") || n.includes("power")) return "powershelf";
  if (n.includes("cdu")) return "cdu";
  if (n.includes("stor") || n.includes("nas")) return "storage";
  if (n.includes("gw") || n.includes("fw") || n.includes("router")) return "network";
  if (n.includes("blank") || n.includes("blk") || n.includes("擋板") || n.includes("擋")) return "blanking";
  return "server";
}
function mgxInfo(m) { return MGX_TYPES[mgxTypeOf(m)] || MGX_TYPES.server; }
async function rackAssign(machine, patch) {
  await api(`/api/machines/${encodeURIComponent(machine)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch)
  });
  // 之後呼叫方會 setView("rack") 重繪：先把伺服器最新資料載進來，才不會用舊快取渲染
  await loadMachines(false);
}
function rackMoveDialog(name) {
  const m = machines.find(x => x.name === name);
  if (!m) return;
  // quick jump：直接輸入目標 U（取代慢慢按）
  quickJumpTo = "";
  const proj = m.project;
  const members = machines.filter(x => x.level === "rack" && x.project === proj);
  // 找出所有被「其他元件」占用的 U 範圍（含多 U 延伸），以及目前機台自身占用的範圍
  const curSize = clampU(m.rack_size || 1);
  const curU = (typeof m.rack_u === "number" && m.rack_u > 0) ? m.rack_u : RACK_U;
  const occupied = new Set();
  members.forEach(x => {
    if (x.name === name) return;
    const xu = (typeof x.rack_u === "number" && x.rack_u > 0) ? x.rack_u : RACK_U;
    const xs = clampU(x.rack_size || 1);
    for (let k = xu; k >= Math.max(xu - xs + 1, 1); k--) occupied.add(k);
  });
  let opts = "";
  for (let u = RACK_U; u >= 1; u--) {
    const take = (curU <= u && u <= curU + curSize - 1);
    const blocked = occupied.has(u);
    opts += `<option value="${u}" ${u === curU ? "selected" : ""} ${blocked ? "disabled" : ""} title="${blocked ? "被其他元件占用" : `U${u}`}">U${u}${blocked ? "（占用）" : ""}</option>`;
  }
  const typeBtns = Object.entries(MGX_TYPES)
    .map(([k, v]) => `<button class="btn small ${mgxTypeOf(m) === k ? "active" : ""}" onclick="rackMoveSetType('${esc(m.name)}','${k}')">${v.icon} ${esc(v.label)}</button>`)
    .join("");
  const sizeOpts = RACK_SIZES
    .map(s => `<option value="${s}" ${s === curSize ? "selected" : ""}>${s}U</option>`).join("");
  showDialog("⇅ 移動 / 設定位置", `
    <div class="rm-modal-body">
      <p style="margin-bottom:12px">機台：<b>${esc(m.name)}</b>（目前 ${curSize}U，起始 U${curU}）</p>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">快速跳到 U</label>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input class="input" id="rm-move-jump" type="number" min="1" max="${RACK_U}" placeholder="輸入 1–${RACK_U}" style="flex:1;padding:8px" onkeydown="if(event.key==='Enter')rackMoveJump()">
        <button class="btn" onclick="rackMoveJump()">跳</button>
      </div>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">選擇目標 U 槽（已占用顯示灰）</label>
      <select class="input" id="rm-move-u" style="width:100%;padding:8px">${opts}</select>
      <div style="margin-top:12px">
        <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">占用高度（U 數，支援 >1U 大元件）</label>
        <select class="input" id="rm-move-size" style="width:100%;padding:8px">${sizeOpts}</select>
      </div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${typeBtns}</div>
      <p style="font-size:11px;color:var(--text-faint);margin-top:10px">元件類型：<b id="rm-newtype">${esc(MGX_TYPES[mgxTypeOf(m)].label)}</b></p>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "儲存位置", cls: "primary", fn: () => {
        const u = +$("rm-move-u").value;
        const sz = +$("rm-move-size").value || 1;
        const patch = { rack_u: u, rack_size: sz };
        if (rackMoveTargetType) patch.mgx_type = rackMoveTargetType;
        rackAssign(m.name, patch).then(() => { closeDialog(); setView("rack"); });
      } },
    ]);
}
function clampU(s) { return (typeof s === "number" && s > 0 && s <= RACK_U) ? Math.floor(s) : 1; }
let quickJumpTo = "";
function rackMoveJump() {
  const el = $("rm-move-jump");
  if (!el) return;
  const v = parseInt(el.value, 10);
  if (!v || v < 1 || v > RACK_U) return alert(`請輸入 1–${RACK_U}`);
  const sel = $("rm-move-u");
  if (!sel) return;
  const opt = [...sel.options].find(o => +o.value === v && !o.disabled);
  if (!opt) { alert(`U${v} 已被其他元件占用`); return; }
  sel.value = String(v);
  el.value = "";
}
function rackMoveSetType(name, type) {
  const lbl = $("rm-newtype"); if (lbl) lbl.textContent = MGX_TYPES[type].label;
  rackMoveTargetType = type;
}
let rackMoveTargetType = null;
async function rackAddPassive() { rackAddPassiveWithU(); }
function rackAddPassiveWithU(u, projOverride) {
  // projOverride：從 System Manager 的 L11 分頁呼叫時指定目標專案；Rack Manager 內則沿用目前機櫃專案
  const proj = projOverride || rackView.project;
  rackAddOccupied(proj);
  showDialog("➕ 新增機櫃元件（無 OS/BMC 亦可）", `
    <div class="rm-modal-body">
      <p style="margin-bottom:12px;font-size:12px;color:var(--text-faint)">用於加入 switch / power shelf / CDU / PDU / Storage 等<b>沒有 OS 或 BMC</b>的元件。只需名稱 + 類型 + U 槽即可。</p>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">元件名稱 *</label>
      <input class="input" id="rp-name" style="width:100%;padding:8px;margin-bottom:12px" placeholder="例如 SW-01 / CDU-1 / PS-3">
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">類型</label>
      <select class="input" id="rp-type" style="width:100%;padding:8px;margin-bottom:12px">
        ${Object.entries(MGX_TYPES).map(([k,v]) => `<option value="${k}">${v.icon} ${esc(v.label)}</option>`).join("")}
      </select>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">占用高度（U 數）</label>
      <select class="input" id="rp-size" style="width:100%;padding:8px;margin-bottom:12px" onchange="rackAddRefreshU('rp-u','rp-size')">
        ${RACK_SIZES.map(s => `<option value="${s}" ${s===1?"selected":""}>${s}U${s>1 ? "（需連續空位）" : ""}</option>`).join("")}
      </select>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">選擇起始 U 槽</label>
      <select class="input" id="rp-u" style="width:100%;padding:8px;margin-bottom:12px"></select>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">管理 IP <span class="hint">（選填，可 ping 用）</span></label>
      <input class="input" id="rp-ip" style="width:100%;padding:8px" placeholder="留空則無 IP">
      <p class="hint-msg" style="margin-top:8px" id="rp-ping-msg">有填管理 IP 時，會先 ping 確認主機在線才允許建立（IP 不通不會新增）。</p>
      <div id="rp-loading" style="display:none;align-items:center;gap:8px;margin-top:12px;color:var(--text-dim)">
        <span class="spinner"></span><span>建立中，請稍候…</span>
      </div>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "建立並加入", cls: "primary", fn: () => {
        const name = $("rp-name").value.trim();
        if (!name) return alert("請填元件名稱");
        const showLoading = (on) => {
          const l = $("rp-loading"), b = document.querySelector("#rm-dialog-foot .primary");
          if (l) l.style.display = on ? "flex" : "none";
          if (b) b.disabled = on;
        };
        showLoading(true);
        rackCheckPingAdd($("rp-ip").value.trim(), () => {
          api("/api/rack/passive", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, mgx_type: $("rp-type").value, rack_u: +$("rp-u").value, rack_size: +$("rp-size").value || 1, manage_ip: $("rp-ip").value.trim(), project: proj }) })
            .then(() => loadMachines())
            .then(() => { closeDialog(); setView("rack"); })
            .catch(e => { showLoading(false); alert("建立失敗：" + e.message); });
        });
      } },
    ]);
  rackAddRefreshU("rp-u", "rp-size");
  if (u) { const sel = $("rp-u"); if (sel) sel.value = String(u); }
}
// 新增元件時：若填了管理 IP，先 ping，不通就擋下不新增
function rackCheckPingAdd(ip, okCb) {
  const hideLoading = () => { const l = $("rp-loading"); if (l) l.style.display = "none"; };
  if (!ip) { okCb(); return; }            // 無 IP 不擋
  const btnT = document.querySelector("#rm-dialog-foot .btn-primary, #rm-dialog-foot .primary");
  if (btnT) { btnT.disabled = true; btnT.textContent = "⏳ 確認中…"; }
  fetch(`/api/ping-ip?ip=${encodeURIComponent(ip)}`).then(r=>r.json())
    .then(d => { const alive = !!d.alive; if (btnT){btnT.disabled=false;btnT.textContent="建立並加入";} if (!alive) { hideLoading(); alert("⚠️ 無法 ping 到此管理 IP（" + ip + "），請確認主機在線後再新增。"); return; } okCb(); })
    .catch(e => { if (btnT){btnT.disabled=false;btnT.textContent="建立並加入";} hideLoading(); alert("Ping 檢查失敗：" + e.message); });
}
// 已佔用 U 集合（含多 U 延伸槽）全域保留給 rackAddRefreshU 用
let _rackAddOccupied = new Set();
let _rackAddProj = "";
function rackAddOccupied(proj) {
  _rackAddProj = proj;
  const members = machines.filter(x => x.level === "rack" && x.project === proj);
  const occ = new Set();
  members.forEach(x => {
    const xu = (typeof x.rack_u === "number" && x.rack_u > 0) ? x.rack_u : (x.rack_u || 0);
    if (xu > 0) {
      const xs = (typeof x.rack_size === "number" && x.rack_size > 0 && x.rack_size <= RACK_U) ? x.rack_size : 1;
      for (let k = xu; k >= Math.max(xu - xs + 1, 1); k--) occ.add(k);
    }
  });
  _rackAddOccupied = occ;
  return occ;
}
// 依「高度 s 格連續空位」重算起始 U 下拉；支援 rm-add-*（加入機櫃）/ rp-*（新增機櫃元件）
function rackAddRefreshU(uSel, sizeSel) {
  uSel = uSel || "rm-add-u"; sizeSel = sizeSel || "rm-add-size";
  const s = +(document.getElementById(sizeSel)?.value || 1);
  const sel = document.getElementById(uSel);
  if (!sel) return;
  const occ = (typeof _rackAddOccupied === "object" && _rackAddOccupied.size) ? _rackAddOccupied : rackAddOccupied(_rackAddProj || rackView.project);
  let opts = "";
  for (let u = RACK_U; u >= 1; u--) {
    let ok = true;
    for (let k = u; k >= u - s + 1; k--) {
      if (k < 1 || occ.has(k)) { ok = false; break; }
    }
    opts += `<option value="${u}" ${occ.has(u) || !ok ? "disabled" : ""}>U${u}${!ok && !occ.has(u) ? "（下方已用）" : occ.has(u) ? "（已用）" : ""}</option>`;
  }
  sel.innerHTML = opts;
}
function rackAddDialog(presetU) {
  const proj = rackView.project;
  const inRack = new Set(machines.filter(x => x.project === proj && x.level === "rack" && (x.rack_u||0) > 0).map(x => x.name));
  // 需求：加入機櫃只能選「L11（rack）」系統。L10 若要變 L11，請先在 System Manager 升為 L11。
  // 需求：+ 號只能加「System Manager 同專案」的 L11 系統（不同專案的 L11 不得跨專案加入）
  const candidates = machines.filter(x => x.project === proj && x.level === "rack" && !inRack.has(x.name));
  if (!candidates.length) {
    const otherProjects = machines.filter(x => x.level === "rack" && x.project !== proj);
    alert(otherProjects.length
      ? `這個機櫃專案「${proj}」沒有其他可加入的 L11 機台。\n其他專案的 L11 不能跨專案加進來（${esc([...new Set(otherProjects.map(m=>m.project))].join("、"))}）。請在 System Manager 把該系統設為本專案的 L11。`
      : "此機櫃目前沒有其他可加入的 L11 機台（所有同專案 L11 都已在此機櫃；L10 請先在 System Manager 升為本專案的 L11）。");
    return;
  }
  const selOpts = candidates.map(m => `<option value="${esc(m.name)}">${esc(m.name)} (${esc(m.os_ip||"—")})</option>`).join("");
  // 依「已佔用 U 集合」與「元件高度」計算可用起始 U：多 U 元件須連同其延伸佔用的槽一起排除
  rackAddOccupied(proj);
  showDialog("➕ 加入機櫃", `
    <div class="rm-modal-body">
      <p style="margin-bottom:12px;font-size:12px;color:var(--text-faint)">把既有 L11 機台加入機櫃專案「${esc(proj)}」並指派 U 槽。</p>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">選擇機台</label>
      <select class="input" id="rm-add-m" style="width:100%;padding:8px;margin-bottom:12px" onchange="rackAddPickMachine()">${selOpts}</select>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">占用高度（U 數）<span class="hint" id="rm-add-size-hint"></span></label>
      <select class="input" id="rm-add-size" style="width:100%;padding:8px;margin-bottom:12px" onchange="rackAddRefreshU()">
        ${RACK_SIZES.map(s => `<option value="${s}" ${s===1?"selected":""}>${s}U${s>1 ? "（需連續空位）" : ""}</option>`).join("")}
      </select>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">選擇起始 U 槽</label>
      <select class="input" id="rm-add-u" style="width:100%;padding:8px"></select>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:12px 0 6px">元件類型</label>
      <select class="input" id="rm-add-type" style="width:100%;padding:8px">
        ${Object.entries(MGX_TYPES).map(([k, v]) => `<option value="${k}">${v.icon} ${esc(v.label)}</option>`).join("")}
      </select>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "加入", cls: "primary", fn: () => {
        const nm = $("rm-add-m").value, u = +$("rm-add-u").value, ty = $("rm-add-type").value;
        const __m = machines.find(x=>x.name===nm);
        rackAssign(nm, { project: proj, level: "rack", rack_u: u, rack_size: (+$("rm-add-size").value || (__m && __m.rack_size > 0 ? __m.rack_size : 1)), mgx_type: ty })
          .then(() => { closeDialog(); setView("rack"); })
          .catch(e => alert("加入失敗：" + e.message));
      } },
    ]);
  rackAddRefreshU();
  if (presetU) { const selSel = $("rm-add-u"); if (selSel) selSel.value = String(presetU); }
  // 依目前預設選中的機台帶出「固定 U 數」
  rackAddPickMachine();
}
// 從機櫃「＋」加入既有 L11：選中機台後，自動帶出其固有的 rack_size（固定 U 數，不改動）
function rackAddPickMachine() {
  const sel = $("rm-add-m"); if (!sel) return;
  const nm = sel.value;
  const m = machines.find(x => x.name === nm);
  const sizeSel = $("rm-add-size"), hintEl = $("rm-add-size-hint");
  if (!sizeSel) return;
  // U is now user-editable. Default to the machine's own rack_size; every option stays enabled.
  sizeSel.value = String(m && m.rack_size && m.rack_size > 0 ? m.rack_size : 1);
  if (hintEl) hintEl.textContent = "";
  rackAddRefreshU();
}
function rackAddDialogAt(u) { closeDialog(); rackAddDialog(u); }

function dialogBackdrop() {
  let b = $("rm-dialog");
  if (b) return b;
  b = document.createElement("div");
  b.className = "modal-backdrop"; b.id = "rm-dialog"; b.style.display = "none";
  b.innerHTML = `<div class="modal rm-modal"><div class="modal-head"><div class="modal-title" id="rm-dialog-title"></div><button class="btn small" onclick="closeDialog()">✕</button></div><div class="modal-body" id="rm-dialog-body"></div><div class="modal-foot" id="rm-dialog-foot"></div></div>`;
  document.body.appendChild(b);
  return b;
}
function showDialog(title, bodyHtml, actions) {
  const b = dialogBackdrop();
  $("rm-dialog-title").textContent = title;
  $("rm-dialog-body").innerHTML = bodyHtml;
  const foot = $("rm-dialog-foot");
  foot.innerHTML = "";
  (actions || []).forEach(a => {
    const btn = document.createElement("button");
    btn.textContent = a.txt; btn.className = "btn " + (a.cls || "");
    if (a.id) btn.id = a.id;
    btn.onclick = () => a.fn();
    foot.appendChild(btn);
  });
  b.style.display = "flex";
}
function closeDialog() { const b = $("rm-dialog"); if (b) b.style.display = "none"; rackMoveTargetType = null; }

function pageRack() {
  // 已從機櫃移除(rack_u<=0)的 L11 只留在 System Manager，不繪製在機櫃上
  const racksAll = machines.filter(m => m.level === "rack" && (m.rack_u||0) > 0);
  const projSet = [...new Set(racksAll.map(m => m.project).filter(Boolean))];
  // 「暫存」專案：有 L11 機台但全部未放上機櫃（rack_u=0）→ 讓它能被選到並提示放置
  const pendingByProj = {};
  machines.forEach(m => { if (m.level === "rack" && m.project && (m.rack_u||0) <= 0) (pendingByProj[m.project] = pendingByProj[m.project]||[]).push(m); });
  const pendingSet = Object.keys(pendingByProj);
  const selAll = [...projSet, ...pendingSet.filter(p => !projSet.includes(p))];
  const selKey = rackView.project || (selAll[0] || "");
  rackView.project = selAll.includes(rackView.project) ? rackView.project : selKey;
  const proj = rackView.project;
  const selOpts = selAll.map(pn => {
    const nOn = racksAll.filter(m => m.project === pn).length;
    const nP = (pendingByProj[pn] || []).length;
    return `<option value="${esc(pn)}" ${pn === proj ? "selected" : ""}>${esc(pn)}（${nOn} 台已上櫃${nP ? ` / ${nP} 台未放置` : ""}）</option>`;
  }).join("");
  const members = racksAll.filter(m => m.project === proj);
  const pinged = rackView.pinged || [];
  const pobj = projects.find(p => p.name === proj);
  racksProjectDesc = pobj ? (pobj.desc || "") : "";
  const anyRack = racksAll.length > 0;
  if (!rackView._linksLoaded) {
    rackView._linksLoaded = true;
    loadLinks().then(() => { if (state.view === "rack") setView("rack"); });
  }

  // 只列「有 L11（Rack）機台」的專案（含「已上櫃」與「暫存未放置」的專案）
  const toolbar = `
    <span class="spacer"></span>
    <label class="rack-sel">機櫃專案
      <select class="input" onchange="rackSetProject(this.value)">
        <option value="">（選擇機櫃專案）</option>
        ${selOpts}
      </select>
    </label>`;

  return `
    <div class="rack-hero">
      <div class="rack-hero-left">
        <div class="rack-hero-title">🗄 Rack Manager</div>
        <div class="rack-hero-sub">${esc(proj || "（未選專案）")} 專案 · ${members.length} 台</div>
        ${racksProjectDesc ? `<div class="rack-hero-desc">${esc(racksProjectDesc)}</div>` : ""}
      </div>
      ${toolbar}
      ${anyRack ? `
      <button class="btn primary" id="rack-ping-btn" onclick="rackPing('${esc(rackView.project)}')">📡 Ping Rack</button>
      <button class="btn" onclick="topoTodo()">🗺 新增拓樸</button>
      <button class="btn" title="自動建立 server→switch、CDU→switch、Powershelf→switch 的模擬連線，看看拓樸圖長怎樣" onclick="topoTodo()">🧪 模擬拓樸</button>
      <button class="btn" onclick="rackPowerAllDialog()">⏻ 開機整櫃</button>
      <button class="btn btn-danger" onclick="rackPowerAllDialog(false)">⏻ 關機整櫃</button>
      <button class="btn btn-warn" onclick="rackBulkReboot()">⟳ Reboot 整櫃</button>
      <button class="btn" onclick="rackBulkAux()">⚡ AUX 整櫃</button>
      <button class="btn primary" onclick="rackBroadcastDialog('${esc(rackView.project)}')">📡 廣播終端</button>` : ""}
    </div>
    ${proj && (pendingByProj[proj]||[]).length && !members.length ? `
    <div class="rack-pending-hint">
      ⏳ <b>${esc(proj)}</b> 有 <b>${(pendingByProj[proj]||[]).length}</b>台 L11 系統還沒上櫃。到 System Manager 的 L11 分頁按「＋ 新增至機櫃」挑一台、選 U 數，就會出現在這裡。
    </div>` : ""}
    <div class="rack-status-legend">
      ${Object.values(MGX_TYPES).filter((v, i, a) => a.findIndex(x => x.cls === v.cls) === i).map(v => `<span class="mgx-legend"><span class="mgx-dot ${v.cls}"></span>${esc(v.label)}</span>`).join("")}
      &nbsp;·&nbsp; ${rackStatusCounts(members, pinged)}
    </div>
    ${anyRack && members.length ? rackLayoutHtml(members, pinged) : (anyRack ? emptyRackCard() : "")}
    `;
}
// 機櫃頁面排版：只有「平面圖」檢視在右欄顯示拓樸連線圖；卡片/清單為全寬、不顯示拓樸。
function rackLayoutHtml(members, pinged) {
  if (devicesView === "plane") {
    const left = `<div class="rack-main-pad"><div class="rack-main-head">
        <span class="rack-hero-sub">機櫃平面圖（＋放置）</span>${rackSubviewTabs()}</div>${rackmapHtml(members, pinged)}
      </div>`;
    return `<div class="rack-layout plane">
      <div class="rack-left">${left}</div>
      <div class="rack-right">
        ${rackTopoHtml(members)}
        ${rackView.project ? rackCopilotHtml() : ""}
      </div>
    </div>`;
  }
  // 清單 / telemetry：全寬顯示，無拓樸
  if (devicesView === "telemetry") {
    return `<div class="rack-layout alone">${rackTelemetryHtml()}</div>`;
  }
  return `<div class="rack-layout alone">${devicesHtml(members, pinged)}</div>`;
}
function emptyRackCard() {
  return `<div class="card" style="margin-top:18px"><div class="empty">目前沒有 L11（Rack）整櫃機台。<br>請在「新增系統」把層級選成 <b>L11 · Rack Level</b>，或「➕ 加入機櫃」把既有機台放進來。</div></div>`;
}
function rackmapHtml(members, pinged) {
  // 依「起始 U（rack_u=上方第一個 U）」放置；rack_size 代表占用幾個 U
  const rackU = {};
  members.forEach(m => {
    const u = (typeof m.rack_u === "number" && m.rack_u > 0) ? m.rack_u : RACK_U;
    rackU[u] = m;
  });
  // 計算每個 U 槽是否被占用（多 U 元件佔用連續多槽）
  const occupied = (m) => {
    const u = (typeof m.rack_u === "number" && m.rack_u > 0) ? m.rack_u : RACK_U;
    const s = (typeof m.rack_size === "number" && m.rack_size > 0 && m.rack_size <= RACK_U) ? m.rack_size : 1;
    return { u, s };
  };
  const filledU = new Set();
  let blocks = [];     // 多 U 元件（跨列）
  members.forEach(m => {
    const { u, s } = occupied(m);
    if (s > 1) {
      blocks.push({ m, u, s });
      // 只把「多 U 元件向下延伸的非起始槽」加入 filledU：起始槽由 startsHere 負責、
      // 單 U 元件（s===1）不該被塞進 filledU，否則會被下方迴圈當成延伸槽而跳過→整台消失。
      for (let k = u - 1; k >= Math.max(u - s + 1, 1); k--) filledU.add(k);
    }
  });

  // 單 U 元件與空格：由上往下每 U 一行
  let rows = "";
  let u = RACK_U;
  while (u >= 1) {
    // 若此槽是多 U 元件的延伸部分（非起始），由起始 U 的整塊負責，跳過
    const startsHere = members.find(m => {
      const { u: mu, s } = occupied(m);
      return mu === u && s > 1;
    });
    if (startsHere) {
      // startsHere 是機台物件（非 {m,u,s}）：直接用它的 rack_size；起始 U 即 u
      const ss = (typeof startsHere.rack_size === "number" && startsHere.rack_size > 0 && startsHere.rack_size <= RACK_U) ? startsHere.rack_size : 1;
      rows += rackBlockRow(startsHere, u, ss, pinged);
      u -= ss;
      continue;
    }
    if (filledU.has(u)) { u--; continue; }   // 多 U 元件延伸槽（已被塊處理）
    const m = rackU[u];
    if (m && (m.rack_size || 1) <= 1) {
      rows += rackBlockRow(m, u, 1, pinged);
      u--;
      continue;
    }
    rows += `<div class="rm-row" style="grid-row:${ROW_TOP-u} / ${ROW_TOP+1-u}"><span class="rm-u"><span class="mono">U${u}</span></span><div class="rm-empty-slot" onclick="rackEmptyClick(${u})" title="點擊放置機台">＋</div></div>`;
    u--;
  }
  // 頂部名牌：已用 U 統計（每台佔 rack_size 個連續槽）
  const usedSet = new Set();
  members.forEach(m => {
    const { u, s } = occupied(m);
    for (let k = u; k > u - s && k >= 1; k--) usedSet.add(k);
  });
  // 頂部 U 統計
  return `
  <div class="rm-rack">
    <div class="rm-head">
      <span class="rm-head-name">${esc(rackView.project)} <span class="rm-head-sep">/</span> ${RACK_U}U</span>
      <span class="rm-head-stat">${usedSet.size}/${RACK_U} U 已用 · 空 ${RACK_U - usedSet.size}U</span>
    </div>
    <div class="rm-body">
    ${rows}
    </div>
  </div>`;
}
// 建立一個元件列；>1U 用 rm-block 跨 grid 多列（grid-row span）
function rackBlockRow(m, u, size, pinged) {
  const n = pinged.find(x => x.name === m.name);
  const up = n ? n.os_alive : null;
  const bmcUp = n ? n.bmc_alive : null;
  const info = mgxInfo(m);
  const osTitle = up === true ? "OS 在線" : up === false ? "OS 離線" : "OS 未知";
  const led = `<span class="led ${up === true ? "on" : up === false ? "off" : "unk"}" title="${osTitle}"></span>`;
  const ledBmc = m.bmc_ip
    ? `<span class="led sm ${bmcUp === true ? "on" : bmcUp === false ? "off" : "unk"}" title="BMC ${bmcUp === true ? "在線" : bmcUp === false ? "離線" : "未知"}"></span>`
    : "";
  // 點機櫃元件本身一律進「單機詳情」；換位/類型請按右側「⇅」按鈕
  const click = `openMachine('${esc(m.name)}')`;
  const delBtn = `<button class="btn small btn-del" title="從機櫃移除" onclick="rackUnmount('${esc(m.name)}')">✕</button>`;
  const nm = `${info.icon} ${esc(m.name)}`;
  const uStack = size > 1
    ? Array.from({ length: size }, (_, i) => `<span class="mono">U${u - i}</span>`).join("")
    : `<span class="mono">U${u}</span>`;
  // CSS grid row 1 在最上方（U48）；topRow = ROW_TOP - u
  const topRow = ROW_TOP - u;
  const span = ` style="grid-row:${topRow} / ${topRow + size}"`;
  return `
  <div class="rm-row ${size > 1 ? "rm-block" : ""}" data-u="${u}" ${span}>
    <span class="rm-u ${size > 1 ? "rm-u-block" : ""}">${uStack}</span>
    <div class="rm-cell ${info.cls}" onclick="${click}" style="align-items:${size > 1 ? "center" : "stretch"}">
      <div class="rm-cell-inner">
        <span class="rm-lamps">${led}${ledBmc}</span>
        <span class="rm-name">${nm}</span>
        <span class="rm-ip mono">${esc(m.bmc_ip || m.os_ip || "")}</span>
        <span class="rm-actions" onclick="event.stopPropagation()">
          <button class="btn small" title="換位/類型" onclick="rackMoveDialog('${esc(m.name)}')">⇅</button>
          ${delBtn}
        </span>
      </div>
    </div>
  </div>`;
}
function rackEmptyClick(u) {
  // rack 平面圖「＋」只保留「新增系統」：加入同專案既有 L11 機台（U 數固定）。
  // 機櫃元件改從 System Manager 的 L11 分頁「＋ 新增元件」加入。
  rackAddDialogAt(u);
}
// 新增機櫃元件：帶預設 U 槽 = 點到的空位 u
function rackAddPassiveAt(u) {
  closeDialog();
  rackAddPassiveWithU(u);
}
// System Manager 的 L11 分頁「＋ 新增元件」：先選目標專案，再進新增機櫃元件 dialog
// 依「L11 分頁只能加 L11 專案」：只列出 L11 專案（純 L10 專案被擋掉；空/混合/未標 level 放行）
function addRackComponentDialog() {
  const rackProjects = projectsForLevel("rack").map(p => p.name);
  if (!rackProjects.length) return alert("請先選擇專案。");
  const opts = rackProjects.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  showDialog("新增至機櫃 — 選擇專案", `
    <div class="rm-modal-body">
      <p style="margin-bottom:12px;font-size:12px;color:var(--text-faint)">選一台還沒上櫃的 L11 系統，掛上機櫃後即可使用。</p>
      <select class="input" id="rcp-proj" style="width:100%;padding:8px;margin-bottom:4px">${opts}</select>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "L11 " + "系統", cls: "primary", fn: () => { const proj = $("rcp-proj").value; if (!proj) return alert("請先選擇專案。"); closeDialog(); rackView.project = proj; rackAddDialog(); } },
      { txt: "SW / PDU / CDU " + "元件", cls: "", fn: () => { const proj = $("rcp-proj").value; if (!proj) return alert("請先選擇專案。"); closeDialog(); rackAddPassiveWithU(undefined, proj); } },
    ]);
}



let devicesView = "plane";   // "plane" | "cards" | "list" | "telemetry"
function devicesSetView(v) { devicesView = v; setView("rack"); }

// 機櫃檢視分頁（取代往下捲：切換卡片/清單/平面圖/telemetry）
function rackSubviewTabs() {
  const defs = [
    ["plane", "🗄 平面圖"],
    ["list", "▰ 清單"],
    ["telemetry", "📊 Telemetry"],
  ];
  return `<div class="rack-subtabs" role="tablist">` + defs.map(([k, lbl]) =>
    `<button class="btn small ${devicesView === k ? "active" : ""}" onclick="devicesSetView('${k}')">${lbl}</button>`
  ).join("") + `</div>`;
}

function devicesHtml(members, pinged) {
  // (卡片檢視已移除，保留 list 為目前唯一「清單」呈現)
  // 依 U 由大到小（U48→U1）排列
  const byU = (a, b) => ((b.rack_u || 0) - (a.rack_u || 0));
  members = members.slice().sort(byU);
  const lamp = v => v === true ? `<span class="ping-lamp on">🟢</span>` : v === false ? `<span class="ping-lamp off">🔴</span>` : `<span class="ping-lamp none">⨪</span>`;
  const body = `<div class="card"><div class="table-scroll"><table class="t rack-ping-table">
    <thead><tr><th>U</th><th>Node</th><th>類型</th><th>OS IP</th><th>BMC IP</th><th>操作</th></tr></thead>
    <tbody>` + members.map(m => {
      const n = pinged.find(x => x.name === m.name);
      const isServerLike = (mgxTypeOf(m) !== "switch" && mgxTypeOf(m) !== "pdu" && mgxTypeOf(m) !== "powershelf" && mgxTypeOf(m) !== "cdu");
      // 其他零件（switch/pdu/powershelf/cdu）只顯示 OS 狀態；server/storage/network 顯示 OS+BMC
      const osUp = n ? n.os_alive : null;
      const bmcUp = n ? n.bmc_alive : null;
      const info = mgxInfo(m);
      const osCell = m.os_ip
        ? `${lamp(osUp)} <span class="ping-ip mono">${esc(m.os_ip)}</span>`
        : `<span style="color:var(--text-faint)">—</span>`;
      const bmcCell = !isServerLike
        ? `<span class="hint" style="color:var(--text-faint)">—</span>`
        : (m.bmc_ip ? `${lamp(bmcUp)} <span class="ping-ip mono">${esc(m.bmc_ip)}</span>` : `<span style="color:var(--text-faint)">—</span>`);
      // 只有「有 OS IP」的系統才有 Terminal + 開關機（跟 System Manager 清單同一套邏輯）
      const hasOs = !!m.os_ip;
      return `<tr>
        <td class="mono">U${m.rack_u || "—"}${(m.rack_size||1)>1?`<span class="hint"> (+${(m.rack_size||1)-1})</span>`:""}</td>
        <td class="mono"><a href="#" class="mach-link" onclick="event.preventDefault();openMachine('${esc(m.name)}')"><b>${esc(m.name)}</b></a></td>
        <td>${info.icon} ${esc(info.label)}</td>
        <td class="mono">${osCell}</td>
        <td class="mono">${bmcCell}</td>
        <td style="white-space:nowrap">
          <button class="btn small" title="換位/類型" onclick="rackMoveDialog('${esc(m.name)}')">⇅</button>
          ${hasOs ? `<button class="btn small" onclick="openTerm('${esc(m.name)}')">▶ Terminal</button>` : ""}
          ${hasOs ? `<button class="btn small" onclick="machControlDialog('${esc(m.name)}')" title="開關機 / Reboot / AC cycle">⏻ 開關機</button>` : ""}
          <button class="btn small" title="從機櫃拿掉（System Manager 的 L11 不受影響）" onclick="rackUnmount('${esc(m.name)}')">刪除</button>
        </td>
      </tr>`;
    }).join("") + `</tbody></table></div></div>`;
  return `<div class="rack-main-pad">
    <div class="rack-main-head"><span class="rack-hero-sub">機櫃元件（${members.length}）</span>${rackSubviewTabs()}</div>
    ${body}
  </div>`;
}

/* ---------- 整櫃 Telemetry（Rack Level） ---------- */
let _rackTelMinutes = 60;
let rackTelCharts = {};
let _rackTelLoading = false;
// 元件類型資訊（與後端 RACK_METRIC_DEF.kind 對應）
const RACK_KIND_INFO = {
  server:     { icon: "🖥", label: "Server 伺服器" },
  switch:     { icon: "🔀", label: "Switch 交換器" },
  powershelf: { icon: "⚡", label: "Power Shelf 電源" },
  pdu:        { icon: "🔌", label: "PDU 電源分配" },
  cdu:        { icon: "💧", label: "CDU 冷卻分配" },
  storage:    { icon: "💾", label: "Storage 儲存" },
  network:    { icon: "🌐", label: "Network 網路" },
  blanking:   { icon: "⬛", label: "Blank Panel" },
};
function rackKindInfo(kind) { return RACK_KIND_INFO[kind] || { icon: "▧", label: kind }; }

function rackTelemetryHtml() {
  const proj = rackView.project || "";
  return `<div class="rack-main-pad">
    <div class="rack-main-head"><span class="rack-hero-sub">整櫃 Telemetry（${esc(proj)}）</span>${rackSubviewTabs()}</div>
    <div class="card" style="margin-top:14px">
      <div class="card-title tel-card-title" onclick="toggleRackTelAll()">
        <span>📊 Rack Telemetry <span class="hint" id="racktel-window"></span></span>
        <span class="tel-collapse-all" id="racktel-collapse-all">▲ 全部收合</span>
      </div>
      <div class="tel-toolbar">
        <label class="tel-range-sel">時間範圍
          <select class="input" id="racktel-select">
            <option value="10">10 分鐘</option>
            <option value="30">30 分鐘</option>
            <option value="60" selected>1 小時</option>
            <option value="360">6 小時</option>
            <option value="720">12 小時</option>
            <option value="1440">24 小時</option>
          </select>
        </label>
      </div>
      <div class="racktel-status" id="racktel-status"></div>
      <div id="racktel-ai-wrap" style="display:none">
        <div class="racktel-ai-head">🤖 整櫃 AI 分析</div>
        <div class="tel-ai" id="racktel-ai"></div>
      </div>
      <div class="tel-grid" id="racktel-grid"><!-- 依類型動態填入 --></div>
      <div class="footer-hint">Rack Telemetry 依元件類型分開監控（Server＝CPU/記憶體/GPU、Switch＝Port流量/溫度、Power Shelf/PDU＝功耗/電壓/電流、CDU＝水流量/水溫/水壓），後端定時透過 SSH 收集。</div>
    </div>
  </div>`;
}
// 依 data-open 更新各 block 的箭頭（展開＝▼，收合＝▶）
function rackTelUpdateArrows() {
  document.querySelectorAll("#racktel-grid .rt-kind").forEach(b => {
    const a = b.querySelector(":scope > .tel-block-head .tel-arrow");
    if (a) a.textContent = (b.dataset.open === "1") ? "▼" : "▶";
  });
}
function rackTelResizeVisible() {   // 展開後 canvas 之前可能是 0 尺寸，需 resize 重繪
  Object.values(rackTelCharts).forEach(ch => { try { ch.resize(); } catch (_) {} });
}
function rackTelUpdateCollapseAll() {
  const box = $("racktel-grid"); if (!box) return;
  const el = $("racktel-collapse-all"); if (!el) return;
  const anyClosed = box.querySelector("div[data-open='0']") !== null;
  el.textContent = anyClosed ? "▼ 全部展開" : "▲ 全部收合";
}
function rackTelSetAll(open) {
  const box = $("racktel-grid");
  if (!box) return;
  box.querySelectorAll("div[data-open]").forEach(d => d.dataset.open = open ? "1" : "0");
  rackTelUpdateArrows();
  rackTelUpdateCollapseAll();
  if (open) requestAnimationFrame(rackTelResizeVisible);
}
function rackTelToggleBlock(headEl) {
  const blk = headEl.closest(".tel-block");
  if (!blk) return;
  blk.dataset.open = (blk.dataset.open === "1") ? "0" : "1";
  rackTelUpdateArrows();
  rackTelUpdateCollapseAll();
  if (blk.dataset.open === "1") requestAnimationFrame(rackTelResizeVisible);
}
function toggleRackTelAll() {
  const box = $("racktel-grid");
  if (!box) return;
  rackTelSetAll(box.querySelector("div[data-open='1']") === null);  // 有開的→全收合；沒→全展開
}
// 產生某一類型（kind）的 tel-block HTML；canvas id 用 racktel-{kind}-{metric} 避免碰撞
function rackTelKindBlock(kind, count) {
  const info = rackKindInfo(kind);
  return `<div class="tel-block rt-kind" data-kind="${esc(kind)}" data-open="1">
    <div class="tel-block-head" onclick="rackTelToggleBlock(this)"><span class="tel-label">${info.icon} ${info.label} <em>（${count} 台）</em></span><span class="tel-arrow">▼</span></div>
    <div class="tel-block-body">
      <div class="rt-kind-empty" style="display:none">${info.icon} ${esc(info.label)} 目前無 telemetry 資料 — 等待接上真實系統後自動開始收集。</div>
      <div class="rt-kind-charts" style="display:block"></div>
      <div class="rt-kind-bars"></div>
    </div>
  </div>`;
}
// 產生某類型內一組指標的 bars（每台最新值，可多指標並排）
function rackTelAppendBars(container, machines, defs) {
  if (!container || !machines.length) return;
  // 找出有資料的指標作為「主要 bars」；每台每個指標一格
  const metricKeys = Object.keys(defs || {});
  if (!metricKeys.length) return;
  // 依指標數設定 CSS 欄位數（第 1 欄＝名稱，其後每指標一欄）
  container.style.setProperty("--rt-cols", String(metricKeys.length));
  // 用第一列標題，後面每台一列，每列內每個指標一個小格
  container.innerHTML = `
    <div class="rt-bars-head"><span class="rt-bars-h">機台</span>${metricKeys.map(k => `<span class="rt-bars-h">${esc((defs[k]||{}).label||k)}</span>`).join("")}</div>
    ${machines.map(m => `
      <div class="rt-bar-row">
        <span class="rt-bar-name">${esc(m.name)}</span>
        ${metricKeys.map(k => {
          const v = m[k] == null ? null : m[k];
          const def = defs[k] || { unit: "" };
          if (v == null) return `<span class="rt-bar-cell rt-bar-na">—</span>`;
          const unit = def.unit || "";
          return `<span class="rt-bar-cell"><span class="rt-bar-num">${v}${esc(unit)}</span></span>`;
        }).join("")}
      </div>`).join("")}`;
}
async function loadRackTelemetry() {
  const proj = rackView.project || "";
  if (!proj || _rackTelLoading) return;
  _rackTelLoading = true;
  const win = $("racktel-window"); if (win) win.textContent = telWindowLabel(_rackTelMinutes);
  const grid = $("racktel-grid");
  if (!grid) { _rackTelLoading = false; return; }
  const st = $("racktel-status"); if (st) st.innerHTML = "⏳ 正在彙總整櫃 telemetry…";
  let d;
  try {
    d = await api(`/api/rack/${encodeURIComponent(proj)}/telemetry?minutes=${_rackTelMinutes}`);
  } catch (e) { if (st) st.innerHTML = `⚠ 無法載入：${esc(e.message)}`; _rackTelLoading = false; return; }
  if (!d || !d.data) { if (st) st.innerHTML = "⚠ 此專案尚無 telemetry 資料（後端尚未採樣到機台）。"; _rackTelLoading = false; return; }
  rackTelAnalyze(proj, _rackTelMinutes);   // 背景觸發 AI 分析（cache 去重，不阻塞渲染）
  // 依 kinds（後端已回傳此專案擁有的類型）建立各類型的 tel-block
  const kinds = d.kinds && d.kinds.length ? d.kinds : ["server"];
  const kindsCount = d.kinds_count || {};
  grid.innerHTML = kinds.map(k => rackTelKindBlock(k, kindsCount[k] || 0)).join("");
  // 重新生成 canvas 後，舊 Chart 執行個體綁的是舊節點，需清空 cache 避免疊加/失效
  rackTelCharts = {};
  // 狀態列
  if (st) {
    const total = d.components ? d.components.length : 0;
    st.innerHTML = `<span class="hint">✅ 依類型分組：${kinds.map(k => `${rackKindInfo(k).label} ${kindsCount[k]||0} 台`).join("、")}（${esc(proj)}）</span>`;
  }
  // 每個類型填入 charts + bars
  kinds.forEach(kind => {
    const kindData = d.data[kind];
    if (!kindData) return;
    const block = grid.querySelector(`.rt-kind[data-kind="${CSS.escape ? CSS.escape(kind) : kind}"]`);
    if (!block) return;
    const chartsBox = block.querySelector(".rt-kind-charts");
    const emptyBox = block.querySelector(".rt-kind-empty");
    const barsBox = block.querySelector(".rt-kind-bars");
    const defs = kindData.defs || {};
    const history = kindData.history || {};
    const machines = kindData.machines || [];
    const hasData = machines.length > 0 && Object.keys(history).length > 0;
    if (!hasData && emptyBox) { emptyBox.style.display = "block"; if (chartsBox) chartsBox.style.display = "none"; }
    // 先依 history 建好每個 metric 的 canvas
    Object.keys(history).forEach(metric => {
      const h = history[metric] || {};
      const box = document.createElement("div");
      box.className = "chart-box";
      box.innerHTML = `<div class="chart-title">${esc(h.label||metric)} <span class="unit">＝${h.agg === "sum" ? "整櫃總和" : "整櫃平均"}（${esc(h.unit||"")}）</span></div><canvas id="racktel-${kind}-${metric}"></canvas>`;
      if (chartsBox) chartsBox.appendChild(box);
    });
    // 每個 metric 一個折線圖
    Object.keys(history).forEach(metric => {
      const h = history[metric];
      if (!h) return;
      const labels = (h.ts || []).map(telT);
      rackTelSet(`racktel-${kind}-${metric}`, labels, [{ key: metric, data: h.values }],
        { [metric]: { label: `${h.label}（${h.agg === "sum" ? "總和" : "平均"}）`, color: h.color || "#2563eb" } });
    });
    // bars：每台所有指標值
    if (machines.length) rackTelAppendBars(barsBox, machines, defs);
  });
  rackTelUpdateArrows();
  rackTelUpdateCollapseAll();
  _rackTelLoading = false;
}
function rackTelChart(id) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (rackTelCharts[id]) return rackTelCharts[id];
  const ch = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", maxHeight: 48, labels: { boxWidth: 10, font: { size: 9.5 } } } },
      scales: { x: { ticks: { maxTicksLimit: 6, font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } } }
    }
  });
  rackTelCharts[id] = ch;
  return ch;
}
function rackTelSet(id, labels, series, defs) {
  const ch = rackTelChart(id);
  if (!ch) return;
  ch.data.labels = labels;
  ch.data.datasets = series.map(s => {
    const d = defs[s.key] || { color: TEL_PALETTE[0], label: s.key };
    return { label: d.label, data: s.data, borderColor: d.color, backgroundColor: d.color,
             tension: .3, pointRadius: 0, borderWidth: 2 };
  });
  ch.update();
}
// 整櫃 telemetry 簡短 AI 分析：叫 /api/rack/{project}/telemetry/analyze → 本機 AI（vLLM）
// 用 cache 避免每次 range 切換都打 AI（較慢）
const rackAiTelCache = {};
async function rackTelAnalyze(proj, minutes) {
  const box = $("racktel-ai");
  const wrap = $("racktel-ai-wrap");
  if (!box || !wrap || !proj) return;
  const key = `${proj}|${minutes}`;
  if (rackAiTelCache[key] && box.dataset.k === key) {
    box.innerHTML = rackAiTelCache[key]; wrap.style.display = ""; return;
  }
  wrap.style.display = "";
  box.innerHTML = "✨ 正在彙總整櫃監控摘要並分析中…";
  box.dataset.k = key;
  let d;
  try {
    d = await api(`/api/rack/${encodeURIComponent(proj)}/telemetry/analyze?minutes=${minutes}`);
  } catch (e) {
    box.innerHTML = `⚠ AI 分析暫不可用（${esc(e.message)}）`; return;
  }
  if (d.error || !d.ok) {
    box.innerHTML = d.error ? `⚠ ${esc(d.error)}` : "";
    return;
  }
  const html = `${esc(d.analysis || d.summary || "")}`;
  rackAiTelCache[key] = html;
  box.innerHTML = html;
}
function initRackTelemetry() {
  const sel = $("racktel-select");
  if (sel) sel.onchange = () => { _rackTelMinutes = +sel.value; loadRackTelemetry(); };
  loadRackTelemetry();
}


/* ---------- 機櫃拓樸 / 連線圖 ---------- */
let linksCache = [];          // [{a,b,type,a_port,b_port}]
async function loadLinks() {
  try { const d = await api("/api/links"); linksCache = d.links || []; }
  catch (e) { linksCache = []; }
  return linksCache;
}
const LINK_TYPE = { eth: "Ethernet", ib: "InfiniBand", power: "電源", coolant: "液冷" };
function linkCss(t) { return "lk-" + (t || "eth"); }
// 連線類型 → SVG 顏色
const LINK_COLOR = { eth: "#2563eb", ib: "#a855f7", power: "#e0a800", coolant: "#14b8a6" };

// 由 mgx_type 決定 SVG 節點屬於哪一群（左欄 hub / 右欄 leaf）
function topoGroupOf(m) {
  const t = mgxTypeOf(m);
  return (t === "server" || t === "storage" || t === "network") ? "leaf" : "hub";
}

// 依成員與連線資料產生 SVG 連接圖。
// 版面：左＝交換/電源/冷卻（hub），右＝伺服/儲存（leaf）；每台可有多條連線到不同 switch。
// 每條邊依 a_port/b_port 在對應節點上標出 NIC 埠；顏色區分 eth/ib/power/coolant。
function rackTopoHtml(members) {
  const names = new Set(members.map(m => m.name));
  // 只取「兩端都在本專案」的連線，避免跨專案雜訊
  const rel = linksCache.filter(lk => names.has(lk.a) && names.has(lk.b));
  const involvedNm = new Set();
  rel.forEach(lk => { involvedNm.add(lk.a); involvedNm.add(lk.b); });

  if (!rel.length) {
    return `<div class="topo-card">
      <div class="topo-card-title">🗺 機櫃拓樸</div>
      <div class="topo-empty">此機櫃沒有連線資料。<br>點「新增拓樸」把 server↔switch/PDU/CDU 接起來，即會顯示實體連線圖。</div>
    </div>`;
  }

  // 分類節點：有連線的 leaf（放右欄）與 hub（放左欄）；依 U 排列 leaf
  const byU = (a, b) => ((b.rack_u || 0) - (a.rack_u || 0));
  const leaves = members.filter(m => topoGroupOf(m) === "leaf" && involvedNm.has(m.name)).slice().sort(byU);
  const hubs = members.filter(m => topoGroupOf(m) === "hub" && involvedNm.has(m.name));

  const W = 900, H = Math.max(400, leaves.length * 62 + 60);
  const LEFTX = 150, RIGHTX = W - 26;
  const hubY = hubs.length ? Math.max(60, H / 2 - (hubs.length - 1) * 70 / 2) : 60;

  // ---- 節點（hub 左欄 / leaf 右欄）----
  let defs = "";
  let nodesSvg = "";
  hubs.forEach((m, i) => {
    const info = mgxInfo(m);
    const y = hubY + i * 70;
    defs += `<g id="port-hub-${esc(m.name)}" class="port-dot"></g>`;
    nodesSvg += `<g class="topo-svg-node hub">
      <rect x="${LEFTX-110}" y="${y-20}" width="108" height="40" rx="8" class="topo-node-box ${info.cls}"/>
      <text x="${LEFTX-110+8}" y="${y+5}" class="topo-node-ico">${info.icon}</text>
      <text x="${LEFTX-110+24}" y="${y+5}" class="topo-node-txt">${esc(m.name)}</text>
    </g>`;
  });
  leaves.forEach((m, i) => {
    const info = mgxInfo(m);
    const y = 40 + i * 62;
    nodesSvg += `<g class="topo-svg-node leaf">
      <rect x="${RIGHTX-150}" y="${y-19}" width="146" height="38" rx="8" class="topo-node-box ${info.cls}"/>
      <text x="${RIGHTX-150+8}" y="${y+5}" class="topo-node-ico">${info.icon}</text>
      <text x="${RIGHTX-150+24}" y="${y+5}" class="topo-node-txt">${esc(m.name)}</text>
    </g>`;
  });

  // ---- 連線（SVG 曲線）----
  // 收集每個 leaf 到每個 hub 的連線，依序分佈在 y 上偏移避免重疊
  const leafYof = {}; leaves.forEach((m, i) => leafYof[m.name] = 40 + i * 62);
  const hubYof = {}; hubs.forEach((m, i) => hubYof[m.name] = hubY + i * 70);

  // 為同一 leaf↔hub 對的多條連線做垂直偏移
  const lanes = {};   // key: "leaf|hub" -> idx
  const laneCount = {};// key: "leaf|hub" -> n
  rel.forEach(lk => {
    // 判斷 leaf/hub 各是哪邊
    const lkPair = [lk.a, lk.b];
    const leafSide = lkPair.find(n => leaves.find(l => l.name === n));
    const hubSide = lkPair.find(n => hubs.find(h => h.name === n));
    if (!leafSide || !hubSide) return;   // 跳過 leaf-leaf / hub-hub（罕見）
    const key = leafSide + "|" + hubSide;
    laneCount[key] = (laneCount[key] || 0) + 1;
  });
  let edgeSvg = "";
  const usedCurve = {};
  rel.forEach(lk => {
    const lkPair = [lk.a, lk.b];
    const leafSide = lkPair.find(n => leaves.find(l => l.name === n));
    const hubSide = lkPair.find(n => hubs.find(h => h.name === n));
    if (!leafSide || !hubSide) return;
    const key = leafSide + "|" + hubSide;
    const cnt = laneCount[key];
    usedCurve[key] = (usedCurve[key] || 0);
    const laneIdx = usedCurve[key]++;
    const col = LINK_COLOR[lk.type] || "#8b8b8b";
    const lY = leafYof[leafSide], hY = hubYof[hubSide];
    // 多條同 leaf↔hub：縱向偏移 ±(laneIdx)*7
    const offset = (cnt > 1 ? (laneIdx - (cnt - 1) / 2) * 10 : 0);
    const y1 = lY + offset, y2 = hY;   // 從 leaf 到 hub
    // 控制點（水平 S 曲線）
    const mx = (RIGHTX - 150 + LEFTX) / 2;
    // a/b 哪邊是 leaf：葉端在右、hub端在左
    const fromX = RIGHTX, fromY = y1;
    const toX = LEFTX, toY = y2;
    const mid = (fromX + toX) / 2;
    const d = `M ${fromX} ${fromY} C ${mid} ${fromY}, ${mid} ${toY}, ${toX} ${toY}`;
    // 標籤：埠號
    const isAleaf = leafSide === lk.a;
    const leafPort = isAleaf ? (lk.a_port || "?") : (lk.b_port || "?");
    const hubPort = isAleaf ? (lk.b_port || "") : (lk.a_port || "");
    const lbl = `${esc(lk.type)} ${leafPort}${hubPort ? "→" + esc(hubPort) : ""}`;
    const tooltip = `${esc(lk.type)} 連線${leafPort ? ` ${esc(leafPort)}` : ""}${hubPort ? ` → ${esc(hubPort)}` : ""}\n${esc(leafSide)} ↔ ${esc(hubSide)}`;
    edgeSvg += `
      <g class="topo-edge-group">
        <path d="${d}" class="topo-edge" stroke="${col}" fill="none" stroke-width="2" stroke-dasharray="0" />
        <path d="${d}" class="topo-edge-hit" />
        <text x="${mid}" y="${(fromY + toY) / 2 - 3}" text-anchor="middle" class="topo-edge-lbl" fill="${col}">${lbl}</text>
        <title>${esc(tooltip)}</title>
      </g>`;
  });

  // 圖例
  const legendSvg = Object.entries(LINK_TYPE).map(([k, v]) =>
    `<span class="topo-legend lk-${k}"><i style="background:${LINK_COLOR[k]}"></i>${esc(v)}</span>`).join("");

  return `<div class="topo-card">
    <div class="topo-card-title" style="display:flex;align-items:center;gap:8px">🗺 機櫃拓樸
      <button class="btn small" onclick="topoCompactToggle(this)" title="收合/展開圖形">↕</button>
      <button class="btn small btn-del" onclick="rackClearTopo()" title="刪除整個機櫃拓樸圖的所有連線">🗑 刪除全部</button>
      <span class="hint" style="margin-left:auto">${rel.length} 條連線 · ${leaves.length} 台 / ${hubs.length} 台基座</span>
    </div>
    <div class="topo-svg-wrap" style="overflow:auto;max-height:70vh">
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="topo-svg">${defs}${edgeSvg}${nodesSvg}</svg>
    </div>
    <div class="topo-legends">${legendSvg}
      <span class="hint" style="margin-left:auto">左＝交換/電源/冷卻 · 右＝伺服/儲存</span>
    </div>
  </div>`;
}
// 拓樸圖收合/展開：切換 svg wrap 的 compact 樣式，避免圖太長把整頁撐高
function topoCompactToggle(btn) {
  const wrap = document.querySelector(".topo-svg-wrap");
  if (!wrap) return;
  wrap.classList.toggle("topo-compact");
  btn.textContent = wrap.classList.contains("topo-compact") ? "↔" : "↕";
}

// 刪除整個機櫃拓樸圖（本專案內的所有連線）
async function rackClearTopo() {
  if (!rackView.project) return;
  const proj = rackView.project;
  const names = new Set(machines.filter(m => m.project === proj).map(m => m.name));
  const rel = linksCache.filter(lk => names.has(lk.a) && names.has(lk.b));
  if (!rel.length) { alert("此機櫃目前沒有連線可刪除。"); return; }
  if (!confirm(`確定刪除整個「${proj}」機櫃拓樸圖嗎？\n此動作會移除本機櫃內全部 ${rel.length} 條連線。`)) return;
  let done = 0;
  for (const lk of rel) {
    try {
      const d = await api("/api/links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: lk.a, b: lk.b }) });
      linksCache = d.links || linksCache; done++;
    } catch (e) {}
  }
  await loadLinks();
  setView("rack");
  alert(`已刪除 ${done} 條連線，機櫃拓樸圖已清空。`);
}

function rackStatusCounts(members, pinged) {
  let up = 0, down = 0, none = 0;
  members.forEach(m => {
    const n = pinged.find(x => x.name === m.name);
    const upOs = n ? n.os_alive : null;
    const upBmc = n ? n.bmc_alive : null;
    if (upOs === true || upBmc === true) up++;
    else if (upOs === false || upBmc === false) down++;
    else none++;
  });
  return `狀態：<span class="ping-lamp on">🟢</span> Up ${up} &nbsp;<span class="ping-lamp off">🔴</span> Down ${down} &nbsp;<span class="ping-lamp none">⨪</span> 未 Ping ${none}`;
}
// 模擬拓樸：自動把 server→sw1/sw2（eth/ib），cdu→sw1（coolant），powershelf→sw2（power）接起來。
// 依元件類型挑前兩個 switch、第一個 cdu、第一個 powershelf、前面幾台 server/storage。
// [暂停|功能待開發] 此按鈕暫指 topoTodo()，模擬拓樸待日後啟用。原始實作保留。
async function rackDemoTopo() {
  const proj = rackView.project;
  const members = machines.filter(x => x.project === proj && x.level === "rack");
  const sw = members.filter(m => mgxTypeOf(m) === "switch").slice(0, 2);
  const cdu = members.find(m => mgxTypeOf(m) === "cdu");
  const ps = members.find(m => mgxTypeOf(m) === "powershelf" || mgxTypeOf(m) === "pdu");
  const servers = members.filter(m => mgxTypeOf(m) === "server" || mgxTypeOf(m) === "storage" || mgxTypeOf(m) === "network");
  if (!sw.length) { alert("此機櫃沒有 switch，無法建立模擬拓樸。請先加入 switch。"); return; }
  if (!confirm(`要自動建立模擬拓樸嗎？\n• ${servers.length} 台 server → ${sw.map(s=>s.name).join(" / ")}（Ethernet）\n${cdu ? `• ${cdu.name} → ${sw[0].name}（液冷 coolant）\n` : ""}${ps ? `• ${ps.name} → ${sw[sw.length>1?1:0].name}（電源 power）\n` : ""}這會新增連線資料。`)) return;
  const created = [];
  const add = async (a, b, type, a_port, b_port) => {
    try { await api("/api/links", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ a, b, type, a_port: a_port||"", b_port: b_port||"" }) }); created.push(`${a}↔${b}`); } catch(e) {}
  };
  // server → 每個 switch 各一條 eth + (第二台起)不同 NIC
  servers.forEach((s, i) => {
    const p1 = `eth${i+1}`, p2a = (i % sw.length) === 0 ? "1/0/1" : "1/0/3";
    add(s.name, sw[i % sw.length].name, "eth", p1, p2a);
  });
  // 液冷：cdu → sw1
  if (cdu && sw[0]) add(cdu.name, sw[0].name, "coolant", "port-A", "cool-lo");
  // 電源：powershelf → sw2
  if (ps) add(ps.name, sw[sw.length > 1 ? 1 : 0].name, "power", "PS1", "PWR-A");
  await loadLinks();
  setView("rack");
  setTimeout(() => alert(`已建立模擬拓樸 ${created.length ? "（" + created.length + " 條）" : "（重複則已跳過）"}，請看右側連線圖。`), 200);
}
function topoTodo() {
  showDialog("拓樸功能", `<div class="empty">此功能待開發。</div>`, [ { txt: "知道了", cls: "primary", fn: () => closeDialog() } ]);
}
// [暂停|功能待開發] 此按鈕暫指 topoTodo()，新增拓樸待日後啟用。原始實作保留。
function linkAddDialog() {
  const proj = rackView.project;
  const members = machines.filter(x => x.project === proj && x.level === "rack");
  const opts = members.map(m => `<option value="${esc(m.name)}">${esc(m.name)} (${esc(mgxInfo(m).label)})</option>`).join("");
  if (!members.length) { alert("此專案沒有機櫃元件可連線"); return; }
  showDialog("🗺 新增拓樸", `
    <div class="rm-modal-body">
      <p style="margin-bottom:12px;font-size:12px;color:var(--text-faint)">把兩個機櫃元件連起來（node ↔ switch / PDU / CDU）。可填兩端「埠號/網卡」（例如 eth0 / 1/1），讓拓展樸畫出是哪條 NIC 接到哪個口；留空也行。</p>
      <div style="display:flex;gap:12px">
        <div style="flex:1">
          <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">元件 A</label>
          <select class="input" id="lk-a" style="width:100%;padding:8px;margin-bottom:6px">${opts}</select>
          <input class="input" id="lk-a-port" style="width:100%;padding:8px" placeholder="A 埠 / 網卡（如 eth0、1/1）">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:6px">元件 B</label>
          <select class="input" id="lk-b" style="width:100%;padding:8px;margin-bottom:6px">${opts}</select>
          <input class="input" id="lk-b-port" style="width:100%;padding:8px" placeholder="B 埠 / 網卡（如 1/1、eth0）">
        </div>
      </div>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:12px 0 6px">連線類型</label>
      <select class="input" id="lk-type" style="width:100%;padding:8px">
        ${Object.entries(LINK_TYPE).map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("")}
      </select>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "新增拓樸", cls: "primary", fn: () => {
        const a = $("lk-a").value, b = $("lk-b").value, t = $("lk-type").value;
        const ap = $("lk-a-port") ? $("lk-a-port").value.trim() : "";
        const bp = $("lk-b-port") ? $("lk-b-port").value.trim() : "";
        if (a === b) return alert("A 與 B 不能相同");
        api("/api/links", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ a, b, type: t, a_port: ap, b_port: bp }) })
          .then(d => { linksCache = d.links || linksCache; closeDialog(); setView("rack"); })
          .catch(e => alert("新增失敗：" + e.message));
      } },
    ]);
}
async function deleteLink(a, b) {
  if (!confirm(`刪除此連線（${a} — ${b}）？`)) return;
  try {
    const d = await api("/api/links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b }) });
    linksCache = d.links || linksCache;
    setView("rack");
  } catch (e) { alert("刪除失敗：" + e.message); }
}


/* ---------- System manager頁：L10/L11 層級 + 專案分組 ---------- */
const projectLevelFilter = { val: "system" };
function setProjectLevelFilter(v) {
  projectLevelFilter.val = v;
  document.querySelectorAll(".lvl-tab").forEach(b => b.classList.toggle("active", b.dataset.lvl === v));
  const bb = document.getElementById("sys-btn-broadcast");
  const bc = document.getElementById("sys-btn-addcomp");
  if (bb) bb.style.display = (v === "system") ? "" : "none";   // 📡 系統廣播 只在 L10
  if (bc) bc.style.display = (v === "rack") ? "" : "none";     // ＋ 新增元件 只在 L11
  const holder = $("proj-sort-list");
  if (holder) { holder.outerHTML = renderProjectsList(); initProjectDrag(); }
}
// 專案收合狀態（以專案名記錄，大量機台如 PROJ_K 可直接收起來）
const projectCollapsed = {};   // { pname: bool }
function renderCollapsed() {
  const holder = $("proj-sort-list");
  if (holder) { holder.outerHTML = renderProjectsList(); initProjectDrag(); }
}
function toggleProject(pname) {
  projectCollapsed[pname] = !projectCollapsed[pname];
  renderCollapsed();
}
function collapseAllProjects(collapse) {
  projects.forEach(p => { projectCollapsed[p.name] = collapse; });
  renderCollapsed();
}
function renderProjectsList() {
  const f = projectLevelFilter.val;
  const un = unassignedMachines().filter(m => inLevelFilter(m, f));
  let html = `<div id="proj-sort-list" class="proj-sort-list">`;
  const visibleProjects = projects.filter(p => projectMembers(p.name).some(m => inLevelFilter(m, f)));
  if (!visibleProjects.length && !un.length) {
    html += `<div class="card"><div class="empty">目前這個層級還沒有機台，先新增一台。</div></div>`;
    return html + `</div>`;
  }
  visibleProjects.forEach((p, pi) => {
    const members = projectMembers(p.name).filter(m => inLevelFilter(m, f));
    const rows = members.map((m, mi) => machineRowSortable(m, pi, mi, members.length));
    const rackN = members.filter(m=>m.level==="rack").length;
    const sysN = members.length - rackN;
    const collapsed = !!projectCollapsed[p.name];
    const kvmCands = projectMembers(p.name).filter(m => m.bmc_ip);     // 該專案有 BMC 的系統（KVM 用）
    html += `
      <div class="proj-card card ${collapsed ? "collapsed" : ""}" data-pname="${esc(p.name)}">
        <div class="proj-card-head" draggable="true" title="拖動以調整專案順序">
          <div class="proj-card-grip">⠿</div>
          <div class="proj-card-info">
            <span class="proj-card-name">${esc(p.name)}</span>
            <span class="proj-card-count">${members.length} 台 ${f==="all" ? `(R${rackN}/S${sysN})` : f==="rack" ? "· L11" : "· L10"}</span>
            ${p.desc ? `<span class="proj-card-desc">${esc(p.desc)}</span>` : ""}
          </div>
          <span class="spacer"></span>
          ${kvmCands.length ? `<button class="btn small proj-kvm-btn" onclick="event.stopPropagation();openKvmBroadcast && openKvmBroadcast('${esc(p.name)}')" title="支援 OpenBMC / OneTree 等 BMC 同步遠端">📺 同步 KVM</button>` : ""}
          <button class="btn small proj-collapse-btn" onclick="event.stopPropagation();toggleProject('${esc(p.name)}')" title="${collapsed ? "展開此專案" : "收合此專案（隱藏機台清單）"}">${collapsed ? "▼ 展開" : "▲ 收合"}</button>
        </div>
        ${!collapsed && members.length ? `<div class="proj-table-scroll"><table class="t">
            <colgroup><col class="cw-name"><col class="cw-lvl"><col class="cw-ip"><col class="cw-ip"><col class="cw-st"><col class="cw-st"><col class="cw-pwr"><col class="cw-move"><col class="cw-act"></colgroup>
            <thead><tr><th>系統名稱</th><th>層級</th><th>OS IP</th><th>BMC IP</th><th>OS 狀態</th><th>BMC 狀態</th><th>BMC 電源</th><th>移動</th><th>操作</th></tr></thead>
            <tbody>${rows.join("")}</tbody></table></div>`
          : `${!collapsed ? `<div style="padding:10px 14px;color:var(--text-faint)">此專案在此層級內沒有機台</div>` : ""}`}
      </div>`;
  });
  if (un.length) {
    html += `
      <div class="proj-card card" data-pname="">
        <div class="proj-card-head">
          <div class="proj-card-grip" style="opacity:.35">⠿</div>
          <div class="proj-card-info"><span class="proj-card-name">未分類</span><span class="proj-card-count">${un.length} 台</span></div>
        </div>
        <div class="proj-table-scroll"><table class="t"><colgroup><col class="cw-name"><col class="cw-lvl"><col class="cw-ip"><col class="cw-ip"><col class="cw-st"><col class="cw-st"><col class="cw-pwr"><col class="cw-move"><col class="cw-act"></colgroup><thead><tr><th>系統名稱</th><th>層級</th><th>OS IP</th><th>BMC IP</th><th>OS 狀態</th><th>BMC 狀態</th><th>BMC 電源</th><th>移動</th><th>操作</th></tr></thead>
        <tbody>${un.map(m => machineRowUnassigned(m)).join("")}</tbody></table></div>
      </div>`;
  }
  html += `</div>`;
  return html;
}
function pageProjects() {
  const nSys = machines.filter(m => !isRackItem(m)).length;
  const nRack = machines.filter(m => isRackItem(m)).length;
  return `
    <div class="section-h flex-wrap">
      <span class="t" style="font-size:18px">System Manager</span>
      <span class="hint">專案分組 · 拖曳卡片調整順序</span>
      <div class="lvl-tabs">
        <button class="btn small lvl-tab ${projectLevelFilter.val==="system"?"active":""}" data-lvl="system" onclick="setProjectLevelFilter('system')">🖘 L10 系統 ${nSys}</button>
        <button class="btn small lvl-tab ${projectLevelFilter.val==="rack"?"active":""}" data-lvl="rack" onclick="setProjectLevelFilter('rack')">🗄 L11 整櫃 ${nRack}</button>
      </div>
      <span class="spacer"></span>
      <button class="btn small" onclick="collapseAllProjects(true)" title="把各專案的機台清單全部收合（適合大量機台）">▲ 全部收合</button>
      <button class="btn small" onclick="collapseAllProjects(false)">▼ 全部展開</button>
      <button class="btn" onclick="openProjectModal()">📁 專案管理</button>
      <button class="btn" onclick="refreshStatus()" id="refresh-btn">⟳ 重新掃描</button>
      <button class="btn primary" onclick="openAdd()">＋ 新增系統</button>
      <button class="btn" id="sys-btn-addcomp" style="display:${projectLevelFilter.val==="rack"?"":"none"}" onclick="addRackComponentDialog()" title="新增可放入機櫃的元件（switch / power shelf / CDU / PDU 等），會加入選定的整櫃專案">＋ 新增至機櫃</button>
      <button class="btn" id="sys-btn-broadcast" style="display:${projectLevelFilter.val==="system"?"":"none"}" onclick="systemBroadcastDialog()" title="對多台 L10 系統同時下指令（廣播終端）">📡 系統廣播</button>
    </div>
    ${renderProjectsList()}
  `;
}
function machineRowSortable(m, pi, mi, total) {
  // 依機台本身的 L10/L11 過濾可移動目標（純 L11 專案對 L10 機台隱藏、反之亦然）
  const mLv = isRackItem(m) ? "rack" : "system";
  const targetOpts = projects.filter(p => p.name !== m.project && projectAllowsLevel(p.name, mLv)).map(p =>
    `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  const lvlBadge = isRackItem(m)
    ? `<span class="badge badge-rack">L11 · Rack</span>`
    : `<span class="badge badge-system">L10 · Sys</span>`;
  const typeTag = mgxTypeOf(m) === "server"
    ? ""
    : `<span class="badge" style="font-size:9px;padding:1px 6px;margin-left:6px">${MGX_TYPES[mgxTypeOf(m)].icon} ${esc(mgxTypeLabel(m))}</span>`;
  const srv = mgxTypeOf(m) === "server";
  const lvlBtn = srv
    ? (m.level !== "rack"
        ? `<button class="btn small" onclick="rackPromote('${esc(m.name)}','${esc(m.project||"")}')" title="把這台 L10 系統升為 L11，並加入該專案的 Rack。">🗄 升 L11</button>`
        : `<button class="btn small" onclick="rackDemote('${esc(m.name)}')" title="把這台 L11 降回 L10。">📉 降 L10</button>`)
    : "";
  // 除擋板(blanking)外，switch/pdu/cdu/powershelf/storage/network/server 都有 Terminal
  const canTerm = mgxTypeOf(m) !== "blanking";
  return `
    <tr>
      <td class="mono mach-drag" draggable="true" title="按左鍵拖曳以調整排序"><a href="#" class="mach-link mach-linkbox" onclick="event.preventDefault();openMachine('${esc(m.name)}')"><b>${esc(m.name)}</b></a>${typeTag}</td>
      <td>${lvlBadge}</td>
      <td class="mono os-ip-cell" title="${m.os_user ? `帳號 @${esc(m.os_user)}` : ``}">${esc(m.os_ip)}</td>
      <td class="mono bmc-ip-cell">${esc(m.bmc_ip || "—")}</td>
      <td>${statusBadge(m.os_alive)}</td>
      <td>${m.bmc_ip ? statusBadge(m.bmc_alive) : `<span style="color:var(--text-faint)">—</span>`}</td>
      <td>${powerCell(m)}</td>
      <td>
        <select class="input move-sel" onchange="moveMachineTo('${esc(m.name)}', this.value)">
          <option value="">移至…</option>
          ${targetOpts}
          ${m.project ? `<option value="">（移除專案）</option>` : ""}
        </select>
      </td>
      <td style="white-space:nowrap">
        ${lvlBtn}
        ${canTerm ? `<button class="btn small" onclick="openTerm('${esc(m.name)}')">▶ Terminal</button>` : ""}
        <button class="btn small" onclick="changeOsIp('${esc(m.name)}')" title="變更 OS IP / BMC IP（OS 需 ping 通 + hostname 相符；BMC 需 ping 通）">⚙ 設定</button>
        <button class="btn small" onclick="deleteMachine('${esc(m.name)}')">刪除</button>
      </td>
    </tr>`;
}
function machineRowUnassigned(m) {
  // 依機台本身的 L10/L11 過濾可移動目標
  const mLv = isRackItem(m) ? "rack" : "system";
  const opts = projectsForLevel(mLv).map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  const lvlBadge = isRackItem(m)
    ? `<span class="badge badge-rack">L11 · Rack</span>`
    : `<span class="badge badge-system">L10 · Sys</span>`;
  const typeTag = mgxTypeOf(m) === "server"
    ? ""
    : `<span class="badge" style="font-size:9px;padding:1px 6px;margin-left:6px">${MGX_TYPES[mgxTypeOf(m)].icon} ${esc(mgxTypeLabel(m))}</span>`;
  const srv = mgxTypeOf(m) === "server";
  const lvlBtn = srv
    ? (m.level !== "rack"
        ? `<button class="btn small" onclick="rackPromote('${esc(m.name)}','')" title="把這台 L10 系統升為 L11（加入未分類的 Rack）。">🗄 升 L11</button>`
        : `<button class="btn small" onclick="rackDemote('${esc(m.name)}')" title="把這台 L11 降回 L10。">📉 降 L10</button>`)
    : "";
  // 除擋板(blanking)外，switch/pdu/cdu/powershelf/storage/network/server 都有 Terminal
  const canTerm = mgxTypeOf(m) !== "blanking";
  return `
    <tr>
      <td class="mono mach-drag" draggable="true" title="按左鍵拖曳以調整排序"><a href="#" class="mach-link mach-linkbox" onclick="event.preventDefault();openMachine('${esc(m.name)}')"><b>${esc(m.name)}</b></a>${typeTag}</td>
      <td>${lvlBadge}</td>
      <td class="mono os-ip-cell">${esc(m.os_ip)}</td>
      <td class="mono bmc-ip-cell">${esc(m.bmc_ip || "—")}</td>
      <td>${statusBadge(m.os_alive)}</td>
      <td>${m.bmc_ip ? statusBadge(m.bmc_alive) : `<span style="color:var(--text-faint)">—</span>`}</td>
      <td>${powerCell(m)}</td>
      <td>
        <select class="input move-sel" onchange="moveMachineTo('${esc(m.name)}', this.value)">
          <option value="">移至…</option>
          ${opts}
        </select>
      </td>
      <td style="white-space:nowrap">
        ${lvlBtn}
        ${canTerm ? `<button class="btn small" onclick="openTerm('${esc(m.name)}')">▶ Terminal</button>` : ""}
        <button class="btn small" onclick="changeOsIp('${esc(m.name)}')" title="變更 OS IP / BMC IP（OS 需 ping 通 + hostname 相符；BMC 需 ping 通）">⚙ 設定</button>
        <button class="btn small" onclick="deleteMachine('${esc(m.name)}')">刪除</button>
      </td>
    </tr>`;
}
/* ---------- 移動：專案拖曳排序 / 機台排序 / 機台搬移 ---------- */
function projectNamesInOrder() { return projects.map(p => p.name); }
let _dragSrc = null;
function initProjectDrag() {
  const cards = document.querySelectorAll("#proj-sort-list .proj-card");
  cards.forEach(card => {
    const head = card.querySelector(".proj-card-head");
    if (!head || !head.hasAttribute("draggable")) return;
    head.addEventListener("dragstart", (e) => {
      $("content").querySelectorAll(".proj-card").forEach(c => c.classList.add("drag-idle"));
      card.classList.add("drag-src");
      _dragSrc = card.dataset.pname;
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", card.dataset.pname); } catch (_) {}
    });
    head.addEventListener("dragend", () => {
      $("content").querySelectorAll(".proj-card").forEach(c => c.classList.remove("drag-idle", "drag-src", "drag-over"));
      _dragSrc = null;
    });
    card.addEventListener("dragover", (e) => {
      if (!_dragSrc) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (!_dragSrc || _dragSrc === card.dataset.pname) return;
      reorderProjects(_dragSrc, card.dataset.pname);
    });
  });
}
async function reorderProjects(a, b) {
  const names = projectNamesInOrder();
  const ia = names.indexOf(a), ib = names.indexOf(b);
  if (ia < 0 || ib < 0 || ia === ib) return;
  names.splice(ia, 1);
  names.splice(ib, 0, a);
  await api("/api/projects/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names }) });
  await Promise.all([loadProjects(), loadMachines()]);
  setView("projects");
}

/* ---------- 系統名稱拖曳排序（跟專案卡片一樣，按住左鍵拖曳） ---------- */
let _machDrag = { src: null, proj: null };
function rowNameOf(tr) { const a = tr && tr.querySelector(".mach-link"); return a ? a.textContent.trim() : null; }
function machScopeOf(tr) { return tr && tr.closest(".proj-card") ? (tr.closest(".proj-card").dataset.pname || null) : null; }
function reorderMachineRow(srcName, proj, targetName, after) {
  const list = (proj ? projectMembers(proj) : unassignedMachines()).map(x => x.name);
  const si = list.indexOf(srcName), ti = list.indexOf(targetName);
  if (si < 0 || ti < 0 || si === ti) return;
  list.splice(si, 1);
  const ti2 = list.indexOf(targetName);
  list.splice(after ? ti2 + 1 : ti2, 0, srcName);
  // 批次單一請求寫整個順序（避免逐台 PATCH），後端只存檔一次 → 快速
  return api("/api/machines/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: list }) })
    .then(async () => { await Promise.all([loadMachines(), loadProjects()]); setView("projects"); })
    .catch(e => alert("調整排序失敗：" + e.message));
}
document.addEventListener("dragstart", (e) => {
  const tr = e.target.closest("tr");
  if (!tr || !tr.querySelector(".mach-link")) return;
  if (e.target.closest("button, select, input, a")) return; // 不攔截名稱以外的控件（點連結開機台不拖曳）
  _machDrag = { src: rowNameOf(tr), proj: machScopeOf(tr) };
  tr.classList.add("mach-drag-src");
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", _machDrag.src); } catch (_) {}
});
document.addEventListener("dragend", (e) => {
  document.querySelectorAll(".mach-drag-src, tr.mach-over").forEach(el => el.classList.remove("mach-drag-src", "mach-over"));
  _machDrag = { src: null, proj: null };
});
document.addEventListener("dragover", (e) => {
  const tr = e.target.closest("tr");
  if (!tr || !tr.querySelector(".mach-link") || !_machDrag.src) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.querySelectorAll("tr.mach-over").forEach(el => el.classList.remove("mach-over"));
  tr.classList.add("mach-over");
});
document.addEventListener("drop", (e) => {
  const tr = e.target.closest("tr");
  document.querySelectorAll("tr.mach-over").forEach(el => el.classList.remove("mach-over"));
  if (!tr || !_machDrag.src) return;
  e.preventDefault();
  const targetName = rowNameOf(tr);
  const srcProj = _machDrag.proj, tgtProj = machScopeOf(tr);
  if (!targetName || !srcProj || srcProj !== tgtProj) { return; } // 只在同一專案(或同為未分類)內排序
  const r = tr.getBoundingClientRect();
  const after = (e.clientY - r.top) > (r.height / 2);
  const src = _machDrag.src;
  _machDrag = { src: null, proj: null };
  tr.classList.remove("mach-over");
  reorderMachineRow(src, srcProj, targetName, after);
});
async function moveMachine(name, dir) {
  const m = machines.find(x => x.name === name);
  if (!m) return;
  const members = projectMembers(m.project).map(x => x.name);
  const i = members.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= members.length) return;
  await swapMachineOrder(members[i], members[j]);
  await Promise.all([loadMachines(), loadProjects()]);
  setView("projects");
}
async function swapMachineOrder(a, b) {
  const ma = machines.find(x => x.name === a), mb = machines.find(x => x.name === b);
  const ea = ma.order, eb = mb.order;
  await api("/api/machines/" + encodeURIComponent(a), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: eb }) });
  await api("/api/machines/" + encodeURIComponent(b), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: ea }) });
}
async function moveMachineTo(name, project) {
  if (project) {
    const m = machines.find(x => x.name === name);
    if (m) {
      const lv = isRackItem(m) ? "rack" : "system";
      if (!projectAllowsLevel(project, lv)) {
        alert(`⚠️ 「${name}」是 ${lv === "rack" ? "L11" : "L10"} 系統，不能移到「${project}」專案。\n（L10 只能掛 L10 專案、L11 只能掛 L11 專案）`);
        return;
      }
    }
  }
  const targetMembers = (project || "" ? machines.filter(m => m.project === project) : unassignedMachines()).filter(m => m.name !== name);
  const targetOrder = targetMembers.length ? Math.max(...targetMembers.map(m => m.order||0)) + 1 : 0;
  await api("/api/machines/" + encodeURIComponent(name), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project, order: targetOrder }) });
  await Promise.all([loadMachines(), loadProjects()]);
  setView("projects");
}

// 把 L10 系統升為 L11（整櫃）：只改層級 + 指派一個可用 U 槽，之後可在 Rack Manager 自由搬移。
async function rackPromote(name, project) {
  if (!confirm("確定要把「" + name + "」升為 L11（加入 Rack Manager）嗎？")) return;
  const proj = project || "";
  // 找該專案機櫃內「已佔用 U」集合，選一個空起始 U（含多 U 元件延伸），否則 U48
  const racks = machines.filter(x => x.project === proj && x.level === "rack");
  const used = new Set();
  racks.forEach(x => {
    const xu = (typeof x.rack_u === "number" && x.rack_u > 0) ? x.rack_u : RACK_U;
    const xs = (typeof x.rack_size === "number" && x.rack_size > 0 && x.rack_size <= RACK_U) ? x.rack_size : 1;
    for (let k = xu; k >= Math.max(xu - xs + 1, 1); k--) used.add(k);
  });
  let u = RACK_U;
  while (u >= 1 && used.has(u)) u--;
  if (u < 1) u = RACK_U;
  try {
    await api("/api/machines/" + encodeURIComponent(name), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: "rack", mgx_type: "server", rack_u: u, rack_size: 1 }) });
    await Promise.all([loadMachines(), loadProjects()]);
    setView("projects");
    alert("✅ 「" + name + "」已升為 L11（Rack）。\n已放到 " + (proj ? "專案「" + proj + "」" : "未分類") + "的 U" + u + "。\n可在 Rack Manager 選此專案，或「加入機櫃」挑到它。");
  } catch (e) { alert("❌ 升 L11 失敗：" + (e && e.message || e)); }
}

// 把 L11 降回 L10（單機）：清除機櫃位置欄位
async function rackDemote(name) {
  if (!confirm("確定要把「" + name + "」降回 L10（退出 Rack Manager）嗎？")) return;
  try {
    await api("/api/machines/" + encodeURIComponent(name), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: "system", rack_size: 1 }) });
    await Promise.all([loadMachines(), loadProjects()]);
    setView("projects");
  } catch (e) { alert("❌ 降 L10 失敗：" + (e && e.message || e)); }
}

// 機器詳情頁去抖：多個非同步載入（感測器 poll / detail / refresh）完成時各自要求重繪，
// 若每次都整頁重繪會造成 chart 反覆重建 + telemetry 重抓 → 狂跳卡死。
// 已在 machine view 時的重複請求，於一短暫視窗內合併為一次。從其他 view 切入則立即渲染。
let _machineRenderTimer = null;
function setView(view) {
  if (view === "machine" && state.view === "machine") {
    if (_machineRenderTimer) clearTimeout(_machineRenderTimer);
    _machineRenderTimer = setTimeout(() => { _renderMachine(state.view); }, 250);
    state.view = view;
    syncHash();
    return;
  }
  // 切到其他 view：取消可能尚未執行的 machine 去抖重繪
  if (_machineRenderTimer) { clearTimeout(_machineRenderTimer); _machineRenderTimer = null; }
  _renderMachine(view);
}
function _renderMachine(view) {
  state.view = view;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("page-title").textContent = TITLES[view] || TITLES.machine;
  $("content").innerHTML = RENDERERS[view]();
  if (view === "projects") {
    initProjectDrag();
    if (_activeProject && _flashActiveProject) {
      _flashActiveProject = false;
      requestAnimationFrame(() => {
        const sel = `.proj-card[data-pname="${CSS.escape(_activeProject)}"]`;
        const card = document.querySelector(sel);
        if (card) {
          card.classList.add("proj-card-active");
          try { card.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) { card.scrollIntoView(); }
          setTimeout(() => card.classList.remove("proj-card-active"), 2500);
        }
      });
    }
  }
  if (view === "dashboard") bindCopilot();
  if (view === "machine") initTelemetry();
  if (view === "rack") {
    setTimeout(() => { bindRackCopilot(); if (devicesView === "telemetry") initRackTelemetry(); }, 0);
  }
  syncHash();
}

/* ---- URL 分頁路由（hash）：重新整理不回首頁 ---- */
function currentRoute() {
  if (state.view === "machine") return "machine/" + encodeURIComponent(_activeMachine || "");
  if (state.view === "rack" && rackView.project)
    return "rack/" + encodeURIComponent(rackView.project);
  if (state.view === "projects" && _activeProject)
    return "projects/" + encodeURIComponent(_activeProject);
  return state.view || "dashboard";
}
function syncHash() {
  const h = "#/" + currentRoute();
  if (location.hash !== h) history.replaceState(null, "", h);
}
function parseHash() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  const view = parts[0] || "dashboard";
  if (view === "machine" && parts[1]) {
    state.view = "machine";
    _activeMachine = decodeURIComponent(parts[1]).trim();
  } else if (view === "rack") {
    // 支援三種寫法（專案優先）：
    //   #/rack/{project}                      ← 新（預設 subview）
    //   #/rack/{project}/{subview}            ← 新
    //   #/rack/{subview}/{project}            ← 舊（保留相容）
    state.view = "rack";
    if (parts.length >= 2) {
      const SUBVIEWS = new Set(["plane", "list", "telemetry"]);
      let sub = null, proj = null;
      if (SUBVIEWS.has(parts[1])) {                          // rack/{subview}/{project}
        sub = parts[1]; proj = parts[2] || null;
      } else if (parts.length >= 3 && SUBVIEWS.has(parts[2])) {  // rack/{project}/{subview}
        proj = parts[1]; sub = parts[2];
      } else {                                                // rack/{project}
        proj = parts[1];
      }
      if (sub)  devicesView = sub;
      if (proj) rackSetProject(decodeURIComponent(proj));
    }
  } else if (view === "projects") {
    state.view = "projects";
    if (parts[1]) {
      _activeProject = decodeURIComponent(parts[1]);
      _flashActiveProject = true;
    }
  } else {
    state.view = ["dashboard", "projects", "rack"].includes(view) ? view : "dashboard";
  }
}

/* ============ System Telemetry（CPU/DIMM/SSD/NIC/GPU） ============ */
let telCharts = {};
const TEL_PALETTE = ["#2563eb", "#22c55e", "#e5484d", "#7c5cff", "#e0a800", "#14b8a6", "#f97316", "#ec4899", "#0ea5e9", "#84cc16"];
let telMinutes = 60;

function telT(ts) {
  const d = new Date(ts * 1000);
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function telWindowLabel(min) {
  if (min >= 1440) { const d = min / 1440; return d >= 1 && Number.isInteger(d) ? `${d} 天` : `${d} 天`; }
  if (min >= 60) { const h = min / 60; return `${h} 小時`; }
  return `${min} 分鐘`;
}
function telToggleAllBtn(anyOpen) {
  const b = $("tel-collapse-all");
  if (b) b.textContent = anyOpen ? "▲ 全部收合" : "▼ 全部展開";
}
function syncTelBlocks() {
  document.querySelectorAll("#tel-grid .tel-block").forEach(blk => {
    const open = blk.dataset.open === "1";
    const arrow = blk.querySelector(".tel-arrow");
    if (arrow) arrow.textContent = open ? "▼" : "▶";
    const body = blk.querySelector(".tel-block-body");
    if (body) body.style.display = open ? "" : "none";
  });
  const anyOpen = [...document.querySelectorAll("#tel-grid .tel-block")].some(b => b.dataset.open === "1");
  telToggleAllBtn(anyOpen);
}
function toggleTel(key) {
  const blk = document.querySelector(`#tel-grid .tel-block[data-key="${key}"]`) ||
              document.querySelector(`#tel-grid .tel-block`);
  // 找不到 data-key 時用 canvas id 反查
  let target = blk;
  if (key) {
    const cv = document.getElementById(`tel-${key}`);
    target = cv ? cv.closest(".tel-block") : blk;
  }
  if (!target) return;
  target.dataset.open = target.dataset.open === "1" ? "0" : "1";
  syncTelBlocks();
  // 展開後重繪（canvas 原先隱藏可能沒畫全）
  loadTelemetry();
}
function toggleTelAll() {
  const anyOpen = [...document.querySelectorAll("#tel-grid .tel-block")].some(b => b.dataset.open === "1");
  document.querySelectorAll("#tel-grid .tel-block").forEach(b => b.dataset.open = anyOpen ? "0" : "1");
  syncTelBlocks();
  loadTelemetry();
}
function initTelemetry() {
  if (!document.getElementById("tel-cpu")) return;  // 非 machine 頁
  // 清除舊 chart（避免重建時重複）
  Object.keys(telCharts).forEach(k => { try { telCharts[k].destroy(); } catch(e){} });
  telCharts = {};
  const sel = $("tel-select");
  if (sel) {
    sel.value = String(telMinutes);
    sel.onchange = () => { telMinutes = +sel.value; loadTelemetry(); };
  }
  // 給每個 block 補 data-key（由 canvas id 推得）
  document.querySelectorAll("#tel-grid .tel-block").forEach(blk => {
    const cv = blk.querySelector("canvas");
    if (cv && !blk.dataset.key) {
      const id = cv.id.replace("tel-", "");
      const map = { "tel-cpu": "cpu", "tel-mem": "mem", "tel-disk": "disk", "tel-net": "net", "tel-gpu": "gpu" };
      for (const [cid, key] of Object.entries(map)) if (blk.querySelector(cid)) { blk.dataset.key = key; break; }
    }
  });
  syncTelBlocks();
  // 若全收合則展開 CPU（確保至少有圖）
  if (![...document.querySelectorAll("#tel-grid .tel-block")].some(b => b.dataset.open === "1")) {
    const first = document.querySelector("#tel-grid .tel-block");
    if (first) first.dataset.open = "1";
    syncTelBlocks();
  }
  loadTelemetry();
}
function telChart(id, unit) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  if (telCharts[id]) return telCharts[id];
  const ch = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { position: "bottom", maxHeight: 64, labels: { boxWidth: 10, font: { size: 9.5 }, padding: 6 } },
                 tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y} ${unit||""}` } } },
      scales: { x: { ticks: { maxTicksLimit: 6, font: { size: 10 } } },
                y: { beginAtZero: true, grid: { color: "rgba(0,0,0,.05)" } } }
    }
  });
  telCharts[id] = ch;
  return ch;
}
function telSet(ch, labels, series, defs) {
  if (!ch) return;
  ch.data.labels = labels;
  ch.data.datasets = series.map(s => {
    const d = defs[s.key] || { color: TEL_PALETTE[0] };
    return { label: d.label, data: s.data, borderColor: d.color, backgroundColor: d.color,
             tension: .3, pointRadius: 0, borderWidth: 2, borderDash: d.dash || undefined };
  });
  ch.update();
}
// Telemetry 簡短 AI 分析：抓單機該範圍趨勢 → AI 回一小段文字 → 填入 #tel-ai
// 同一機台+範圍重複載入直接用快取，避免每次重整都打 AI（較慢）。
const aiTelCache = {};
async function telAnalyze(name, minutes) {
  const box = $("tel-ai");
  if (!box) return;
  const key = `${name}|${minutes}`;
  if (aiTelCache[key] && box.dataset.k === key) {
    box.innerHTML = aiTelCache[key]; return;
  }
  box.innerHTML = "✨ 正在分析此範圍的監控趨勢…";
  box.dataset.k = key;
  let d;
  try {
    d = await apiWithTimeout(`/api/machine/${encodeURIComponent(name)}/telemetry/analyze?minutes=${minutes}`, 12000);
  } catch (e) {
    box.innerHTML = `<span class="hint">🤖 趨勢分析稍後再試（AI 忙碌）</span>`; return;
  }
  if (d.error) { box.innerHTML = `<span class="hint">🤖 ${esc(d.error)}</span>`; return; }
  const html = `${esc(d.analysis || d.summary || "")}`;
  aiTelCache[key] = html;
  if (box) box.innerHTML = html;
}

async function loadTelemetry() {
  const name = _activeMachine;
  if (!name) return;
  const win = $("tel-window"); if (win) win.textContent = telWindowLabel(telMinutes);
  telAnalyze(name, telMinutes);   // 背景觸發簡短 AI 分析（不阻塞 telemetry 繪圖）
  let d;
  try {
    d = await api(`/api/machine/${encodeURIComponent(name)}/telemetry?minutes=${telMinutes}`);
  } catch (e) { return; }
  const os = d.os || {}, gpu = d.gpu || {};
  const oarr = os.os || [];
  const oLabels = oarr.map(r => telT(r.ts));

  // CPU：使用率 %
  let ch = telChart("tel-cpu", "%");
  telSet(ch, oLabels, [{ key: "cpu", data: oarr.map(r => r.cpu_used) }], { cpu: { label: "CPU 使用率", color: "#2563eb" } });

  // CPU：溫度 °C
  ch = telChart("tel-cputemp", "°C");
  telSet(ch, oLabels, [{ key: "temp", data: oarr.map(r => r.cpu_temp_c) }], { temp: { label: "CPU 溫度", color: "#f97316" } });

  // CPU Load（1/5/15 min）
  ch = telChart("tel-load", "load");
  telSet(ch, oLabels, [
    { key: "l1", data: oarr.map(r => r.load1) },
    { key: "l5", data: oarr.map(r => r.load5) },
    { key: "l15", data: oarr.map(r => r.load15) },
  ], { l1: { label: "Load 1m", color: "#2563eb" }, l5: { label: "Load 5m", color: "#7c5cff" }, l15: { label: "Load 15m", color: "#84cc16" } });

  // DIMM：記憶體使用率 %（後端 mem_used_pct，缺值時由 used/total 推算）
  ch = telChart("tel-mem", "%");
  telSet(ch, oLabels, [{ key: "usedpct", data: oarr.map(r => r.mem_used_pct != null ? r.mem_used_pct : (r.mem_total_gb ? r.mem_used_gb / r.mem_total_gb * 100 : null)) }], { usedpct: { label: "記憶體使用率", color: "#e5484d" } });

  // DIMM：已用 + 總量 GB
  ch = telChart("tel-memgb", "GB");
  telSet(ch, oLabels, [
    { key: "used", data: oarr.map(r => r.mem_used_gb) },
    { key: "total", data: oarr.map(r => r.mem_total_gb) },
  ], { used: { label: "已用", color: "#e5484d" }, total: { label: "總量", color: "#94a3b8" } });

  // DIMM：可用
  ch = telChart("tel-swap", "GB");
  telSet(ch, oLabels, [{ key: "avail", data: oarr.map(r => r.mem_avail_gb) }], { avail: { label: "可用記憶體", color: "#22c55e" } });

  // SSD：各掛載點 %
  ch = telChart("tel-disk", "%");
  const mounts = os.disk || [];
  const dLabels = mounts[0] ? mounts[0].ts.map(telT) : [];
  const dDefs = {}; mounts.forEach((m,i) => dDefs[m.mount] = { label: m.mount, color: TEL_PALETTE[i%TEL_PALETTE.length] });
  telSet(ch, dLabels, mounts.map((m,i) => ({ key: m.mount, data: m.pct })), dDefs);

  // SSD：已用量 GB
  ch = telChart("tel-diskused", "GB");
  const dUsedDefs = {}; mounts.forEach((m,i) => dUsedDefs[m.mount] = { label: m.mount, color: TEL_PALETTE[i%TEL_PALETTE.length] });
  telSet(ch, dLabels, mounts.map((m,i) => ({ key: m.mount, data: m.used_gb })), dUsedDefs);

  // NIC（網路吞吐 MB/s）
  ch = telChart("tel-net", "MB/s");
  const nets = os.net || [];
  const allPts = nets.flatMap(n => n.points);
  const tsArr = [...new Set(allPts.map(p => p.ts))].sort((a,b)=>a-b);
  const nLabels = tsArr.map(telT);
  const nSeries = [], nDefs = {};
  const MB = 1024*1024;
  nets.forEach((n,i) => {
    const col = TEL_PALETTE[i%TEL_PALETTE.length];
    const byTs = {}; n.points.forEach(p => byTs[p.ts] = p);
    const rx = tsArr.map(ts => byTs[ts] && byTs[ts].rx != null ? byTs[ts].rx/MB : null);
    const tx = tsArr.map(ts => byTs[ts] && byTs[ts].tx != null ? byTs[ts].tx/MB : null);
    const tag = n.iface.length>14 ? n.iface.slice(0,13)+"…" : n.iface;
    nSeries.push({ key: `tx${i}`, data: tx }); nSeries.push({ key: `rx${i}`, data: rx });
    nDefs[`tx${i}`] = { label: `${tag} TX`, color: col };
    nDefs[`rx${i}`] = { label: `${tag} RX`, color: col, dash: [4,4] };
  });
  telSet(ch, nLabels, nSeries, nDefs);

  // GPU：利用率 %
  let gch = telChart("tel-gpu", "%");
  const gser = gpu.series || [];
  const gLabels = gser[0] ? gser[0].ts.map(telT) : [];
  const gName = s => (s.name && String(s.name).trim()) ? `${s.name} (GPU ${s.gpu})` : `GPU ${s.gpu}`;
  const gDefs = {}; gser.forEach((s,i) => gDefs[`g${s.gpu}`] = { label: gName(s), color: TEL_PALETTE[i%TEL_PALETTE.length] });
  telSet(gch, gLabels, gser.map(s => ({ key: `g${s.gpu}`, data: s.util })), gDefs);

  // GPU：記憶體使用
  gch = telChart("tel-gpumem", "GB");
  const gmDefs = {}; gser.forEach((s,i) => gmDefs[`g${s.gpu}`] = { label: gName(s), color: TEL_PALETTE[i%TEL_PALETTE.length] });
  telSet(gch, gLabels, gser.map(s => ({ key: `g${s.gpu}`, data: s.mem_used })), gmDefs);

  // GPU：溫度
  gch = telChart("tel-gputemp", "°C");
  const gtDefs = {}; gser.forEach((s,i) => gtDefs[`g${s.gpu}`] = { label: gName(s), color: TEL_PALETTE[i%TEL_PALETTE.length] });
  telSet(gch, gLabels, gser.map(s => ({ key: `g${s.gpu}`, data: s.temp })), gtDefs);

  // GPU：功耗
  gch = telChart("tel-gpupow", "W");
  const gpDefs = {}; gser.forEach((s,i) => gpDefs[`g${s.gpu}`] = { label: gName(s), color: TEL_PALETTE[i%TEL_PALETTE.length] });
  telSet(gch, gLabels, gser.map(s => ({ key: `g${s.gpu}`, data: s.power })), gpDefs);
}
/* ---------- 單機詳情頁 ---------- */
let _activeMachine = null;
function openMachine(name) {
  _activeMachine = name;
  state.view = "machine";
  setView("machine");
}
function machineBack() {
  setView("projects");
}
function machineGo(view) {
  state.view = view;
}
async function machineRefresh() {
  const name = _activeMachine;
  if (!name) return;
  delete machineDetailCache[name];     // 強制重抓詳情 + OS/HW（refresh=1）
  sensorAiDone.delete(name);           // 重新整理 → 讓 Sensor AI 用最新資料重跑一次
  delete sensorAiResult[name];
  await machineLoadDetail(name, true);
  // 感測器不強制重抓：TTL 內直接用快取，避免按重新整理後陷入長時間『背景抓取中』
  if (_activeMachine === name) await machineLoadSensors(name, false);
  if (_activeMachine === name) setView("machine");
}
const machineSensorsCache = {};
// 感測器是背景抓取的（OpenBMC sdr list 約 20 秒）。
// 只更新 #sensor-body 區塊，絕不整頁重繪（避免每次都重畫 telemetry 造成狂跳/卡死）。
// 無快取時每 3 秒查一次；有舊值（refreshing）時改每 12 秒緩查，減少開銷。
async function machineLoadSensors(name, refresh = false) {
  const poll = async () => {
    let d;
    try {
      d = await api(`/api/machine/${encodeURIComponent(name)}/sensors${refresh ? "?refresh=1" : ""}`);
      machineSensorsCache[name] = d;
    } catch (e) {
      d = { error: e.message };
      machineSensorsCache[name] = d;
    }
    if (_activeMachine !== name) return;         // 已切走，停止
    const st = d && d.sensors;
    // 只更新感測器卡片本體，不動整個頁面（sensor-body 只存在於 bmc_alive 的詳情頁）
    const body = $("sensor-body");
    if (body) {
      const oldScroll = body.querySelector(".sdr-scroll");
      const keepTop = oldScroll ? oldScroll.scrollTop : 0;
      body.innerHTML = machineSensorsHtml(d, { bmc_alive: true }, name);
      const newScroll = body.querySelector(".sdr-scroll");
      if (newScroll && keepTop) newScroll.scrollTop = keepTop; // 保留捲動位置，避免重繪跳回頂部
    }
    // 感測器有資料（含背景刷新中）即自動觸發一次 Sensor AI 診斷
    if (d && !d.error && d.sensors && (d.sensors.total || d.sensors.ok)) sensorAnalyze(name);
    if (d.error) return;                         // 出錯就停（不再輪詢）
    if (d.loading) {
      // refreshing（回舊值）或尚無資料 → 排下一輪；無資料時更快
      setTimeout(poll, (st && (st.total || st.ok)) ? 12000 : 3000);
    }
  };
  poll();
}
function machineSensorsHtml(d, base, name) {
  if (!base.bmc_alive) return `<div class="empty">BMC 目前不可連</div>`;
  if (d && d.error) return `<div class="empty">${esc(d.error)}</div>`;
  const s = (d && d.sensors) || {};
  // 完全沒有資料時才顯示「抓取中」；有舊快取（refreshing）時照常顯示資料並在背景更新
  if (!d || (d.loading && !Object.keys(s).length)) {
    return `<div class="empty">🔍 感測器抓取中（sdr list 較慢，約 20 秒）…</div>`;
  }
  const critRow = (s.critical_entries || []).map(l => `<li>🔴 ${esc(l)}</li>`).join("");
  const warnRow = (s.warning_entries || []).map(l => `<li>🟠 ${esc(l)}</li>`).join("");
  const nsRow = (s.ns && s.ns > 0) ? `<li class="no-alert" style="color:var(--text-dim)">⚠️ ${s.ns} 筆感測器 No Reading（ns，未讀取到數值）</li>` : "";
  // 完整 SDR：放固定高度框內可往下拉，避免網頁過長
  const allRows = (s.entries || []).map(l => `<tr><td class="mono">${esc(l)}</td></tr>`).join("");
  const sdrBox = s.entries && s.entries.length
    ? `<div class="sdr-scroll">
        <table class="t sdr-table"><tbody>${allRows}</tbody></table>
      </div>
      <span class="hint">共 ${s.entries.length} 筆感測器（可捲動）</span>`
    : "";
  return `
    <div class="sensor-kpis">
      <div class="sensor-kpi ${s.critical>0?'bad':''}"><b>${s.critical||0}</b><span>Critical</span></div>
      <div class="sensor-kpi ${s.warning>0?'warn':''}"><b>${s.warning||0}</b><span>Warning</span></div>
      <div class="sensor-kpi"><b>${s.ok||0}</b><span>${s.ns>0 ? `OK (+${s.ns||0} ns)` : "OK"}</span></div>
    </div>
    <ul class="alerts" style="margin-top:10px">
      ${critRow || warnRow || nsRow || `<li class="no-alert">✔ 無異常感測器（無 Critical / Warning / No Reading）</li>`}
    </ul>
    <div class="tel-ai sensor-ai" id="sensor-ai">${sensorAiResult[name] ?? (sensorAiDone.has(name) ? "🤖 Sensor AI 已就緒（暫無分析）" : "🤖 正在分析感測器狀況…")}</div>
    ${d.refreshing ? `<span class="hint">（快取已過期，背景重新抓取中…）</span>` : ""}
    ${sdrBox}`;
}
// Sensor AI 診斷（比照 Telemetry AI）：感測器就緒後自動分析一次，結果快取，重繪可還原。
// 資料未就緒時會定時重試（最多約 90 秒），避免卡在「尚無資料」也立即顯示 AI 狀態。
const sensorAiDone = new Set();
const sensorAiResult = {};
const sensorAiBusy = new Set();
function sensorAiHtml(text, counts) {
  let html = `🤖 ${esc(text || "")}`;
  if (counts) {
    let c = `<span class="hint">共 ${counts.total} 筆感測器 · OK ${counts.ok} · No Reading ${counts.ns}`;
    if (counts.critical) c += ` · 🔴 Crit ${counts.critical}`;
    if (counts.warning) c += ` · 🟠 Warn ${counts.warning}`;
    c += `</span>`;
    html += `<br>${c}`;
  }
  return html;
}
async function sensorAnalyze(name) {
  if (!name || sensorAiBusy.has(name)) return;
  const show = (html) => { const el = $("#sensor-ai"); if (el) el.innerHTML = html; };
  if (sensorAiDone.has(name) && sensorAiResult[name] != null) { show(sensorAiResult[name]); return; }
  sensorAiBusy.add(name);
  show("🤖 正在分析感測器狀況…");
  try {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (_activeMachine !== name || state.view !== "machine") {
        if (sensorAiResult[name] == null) sensorAiResult[name] = "🤖 Sensor AI 已就緒";
        return;
      }
      let d;
      try {
        d = await apiWithTimeout(`/api/machine/${encodeURIComponent(name)}/sensors/analyze`, 12000);
      } catch (e) {
        d = { error: e.name === "AbortError" ? "逾時" : "連線失敗" };
      }
      if (!d || d.error) {
        show(`🤖 感測器資料抓取中，AI 待命…（已等待 ${attempt + 1} 輪）`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      sensorAiDone.add(name);
      const html = sensorAiHtml(d.analysis, d.counts);
      sensorAiResult[name] = html;
      show(html);
      return;
    }
    sensorAiResult[name] = "⚙️    Sensor AI 暫無資料（多次重試後仍未就緒）";
    show(sensorAiResult[name]);
  } finally {
    sensorAiBusy.delete(name);
  }
}

const machineDetailCache = {};
async function machineLoadDetail(name, refresh = false) {
  try {
    const d = await api(`/api/machine/${encodeURIComponent(name)}/detail${refresh ? "?refresh=1" : ""}`);
    machineDetailCache[name] = d;
  } catch (e) {
    machineDetailCache[name] = { error: e.message };
  }
  if (_activeMachine === name) setView("machine");
}

/* ---- 單機詳情頁 ---- */

/* 硬體資訊（CPU/DIMM/SSD/NIC/GPU）專業表格式卡片呈現（無 emoji） */
function hwItem(label, lines) {
  const rows = lines.filter(x=>x).map(l => `<div class="hw-line">${l}</div>`).join("");
  return `<div class="hw-item"><div class="hw-label">${label}</div><div class="hw-body"><div class="hw-lines">${rows}</div></div></div>`;
}
function hwHtml(oi) {
  const hw = (oi && oi.hw) || null;
  if (!hw) {
    if (oi && oi.raw) return `<pre class="mach-pre mono">${esc(oi.raw)}</pre>`;
    return `<div class="empty">尚未抓取硬體型號（需 root + dmidecode/lspci）</div>`;
  }
  let out = `<div class="hw-grid">`;
  const cpu = hw.cpu;
  if (cpu) {
    const sockets = parseInt(cpu.sockets) || 0;
    const cores = parseInt(cpu.cores) || 0;
    const threads = parseInt(cpu.threads) || 0;
    const totalCores = sockets && cores ? sockets * cores : 0;
    const totalThreads = totalCores && threads ? totalCores * threads : 0;
    const specs = [
      cpu.sockets ? `${cpu.sockets} × ${cpu.cores||"?"} 核` : "",
      totalCores ? `共 ${totalCores} 核` : "",
      threads ? `每核 ${threads} 執行緒` : "",
      totalThreads ? `共 ${totalThreads} 執行緒` : "",
    ].filter(Boolean).join("　") || "";
    out += hwItem("CPU", [
      `<div class="cpu-model"><b>${esc(cpu.model || "—")}</b></div>`,
      specs ? `<div class="cpu-spec">${esc(specs)}</div>` : "",
    ]);
  }
  const d = hw.dimm;
  if (d) {
    const size = `${d.count||""} 條記憶體`;
    const parts = (d.parts||[]).map(p=>`<span class="hw-part">${esc(p)}</span>`).join("");
    out += hwItem("DIMM", [
      `<b>${size}</b> <span class="mono">${(d.types||[]).join(" · ")} ${(d.speeds||[]).join(" · ")}</span>`,
      parts ? `<span class="hw-parts">${parts}</span>` : "",
    ]);
  }
  const ssd = hw.ssd;
  if (ssd && ssd.length) {
    const rows = ssd.slice(0,12).map(dd => `
      <div class="ssd-cell">
        <span class="ssd-name mono">${esc(dd.name)}</span>
        <span class="ssd-model">${esc(dd.model)}</span>
        <span class="ssd-size">${esc(dd.size)}</span>
      </div>`).join("");
    out += `<div class="hw-item"><div class="hw-label">SSD</div><div class="hw-body"><div class="ssd-grid">${rows}</div></div></div>`;
  }
  const gpu = hw.gpu;
  if (gpu && gpu.length) {
    // GPU 多顆時用兩欄網格，減少垂直空間
    const rows = gpu.map(g => `<div class="gpu-cell"><span class="gpu-name">${esc(g.name)}</span> <span class="gpu-mem">${esc(g.mem)}</span> <span class="gpu-util">${esc(g.util)}</span></div>`).join("");
    out += `<div class="hw-item"><div class="hw-label">GPU</div><div class="hw-body"><div class="gpu-grid">${rows}</div></div></div>`;
  }
  const nic = hw.nic;
  if (nic && nic.length) {
    // 解析 lspci 網卡行 → {type,model,count,buses}；同型號合併計數，用多欄卡片精簡呈現
    function tidyModel(raw) {
      let m = String(raw).replace(/\s*\(rev \d+\)\s*$/i, "").trim();
      // 連續移除結尾的 Controller / Integrated / Network 等修飾詞（會疊加出現）
      while (/\b(controller|integrated|network|adapter)\b[\s:]*$/i.test(m)) {
        const next = m.replace(/\b(controller|integrated|network|adapter)\b[\s:]*$/i, "").replace(/\s{2,}/g, " ").trim();
        if (next === m) break;
        m = next;
      }
      return m.replace(/^\s*(Mellanox Technologies|Intel Corporation|Broadcom Limited|Broadcom Inc\.|Marvell Technology Group|NVIDIA Corporation)\s*/i, "").trim();
    }
    const groups = new Map();
    (nic || []).forEach(l => {
      const mm = String(l).match(/^([\da-fA-F]{2}:[\da-fA-F]{2}\.[\da-fA-F])\s+(\S+) controller:\s*(.+)$/i);
      if (mm) {
        const type = (mm[2].toLowerCase().includes("infiniband") ? "InfiniBand"
                    : mm[2].toLowerCase().includes("ethernet") ? "Ethernet" : mm[2]);
        const model = tidyModel(mm[3]);
        const key = `${type}|${model}`;
        if (!groups.has(key)) groups.set(key, { type, model, count: 0, buses: [] });
        groups.get(key).count++; groups.get(key).buses.push(mm[1]);
      } else {
        const key = "__raw__|" + l;
        if (!groups.has(key)) groups.set(key, { type: "NIC", model: String(l), count: 0, buses: [] });
        groups.get(key).count++;
      }
    });
    const cells = [...groups.values()].map(g => `
      <div class="nic-cell">
        <div class="nic-top">
          <span class="nic-type ${g.type === "InfiniBand" ? "ib" : (g.type === "Ethernet" ? "eth" : "")}">${esc(g.type)}</span>
          <span class="nic-model">${esc(g.model)}</span>
          ${g.count > 1 ? `<span class="nic-n">×${g.count}</span>` : ""}
        </div>
        <div class="nic-bus mono">${esc(g.buses.join(", "))}</div>
      </div>`).join("");
    out += `<div class="hw-item"><div class="hw-label">NIC <span class="hw-sub">${(nic||[]).length} 埠</span></div><div class="hw-body"><div class="nic-list">${cells}</div></div></div>`;
  }
  out += `</div>`;
  // OS 摘要（distro/uptime/cpu/mem）在最上面
  const os = (oi && oi.os) || null;
  if (os && (os.distro || os.uptime)) {
    const osStats = [
      os.distro ? `<b>${esc(os.distro)}</b>` : "",
      os.uptime ? `已開機 ${esc(os.uptime)}` : "",
      os.cpu ? `CPU ${esc(os.cpu)} 執行緒` : "",
      os.mem ? esc(os.mem) : "",
    ].filter(v => v).map(v => `<span class="os-stat">${v}</span>`).join("");
    out = `<div class="os-summary">${osStats}</div>` + out;
  }
  if (oi && oi.raw) {
    out += `<details class="hw-raw"><summary>原始輸出 (raw)</summary><pre class="mach-pre mono">${esc(oi.raw)}</pre></details>`;
  }
  return out;
}

function pageMachine() {
  const name = _activeMachine;
  const m = machines.find(x => x.name === name);
  if (!m) return `<div class="card"><div class="empty">找不到機台</div></div>`;
  const d = machineDetailCache[name];
  if (!d) {
    machineLoadDetail(name);
    return `
      <div class="mach-toolbar">
        <button class="btn small" onclick="machineBack()">← 返回</button>
        <span class="mach-name">🖥 ${esc(name)}</span>
        <span class="spacer"></span>
      <span class="hint">專案分組 · 拖曳卡片調整順序</span>
      </div>
      <div class="card"><div class="empty">正在抓取機台資訊（開機資訊需要 SSH, BMC 用 ipmitool）…</div></div>`;
  }
  if (d.error) {
    return `
      <div class="mach-toolbar">
        <button class="btn small" onclick="machineBack()">← 返回</button>
        <span class="mach-name">🖥 ${esc(name)}</span>
        <span class="spacer"></span>
        <button class="btn small" onclick="machineRefresh()">⟳ 重試</button>
      </div>
      <div class="card"><div class="empty">載入失敗：${esc(d.error)}</div></div>`;
  }
  const base = d.machine || {};
  const lvlBadge = base.level === "rack"
    ? `<span class="badge badge-rack">L11 · Rack</span>` : `<span class="badge badge-system">L10 · Sys</span>`;
  const osState = base.os_alive ? statusBadge(true) : statusBadge(false);
  const bmcState = base.bmc_ip ? (base.bmc_alive ? statusBadge(true) : statusBadge(false)) : `<span style="color:var(--text-faint)">無</span>`;
  // OS 系統資訊（可能為快取歷史值）
  // OS 系統資訊（硬體型號卡片）
  let osInfoHtml = hwHtml(d.os_info || {});
  if (d.os_info && d.os_info.fetched_at) osInfoHtml += `<span class="hint">抓取時間：${esc(d.os_info.fetched_at)}</span>`;
  // BMC FW + 電源 + 感測
  let fwHtml = `<div class="empty">BMC 目前不可連，無從抓取</div>`;
  if (base.bmc_alive) {
    const fwRows = (d.fw || []).map(f => `<tr><td class="mono">${esc(f.key)}</td><td class="mono">${esc(f.value)}</td></tr>`).join("");
    fwHtml = fwRows ? `<table class="t fw-table"><tbody>${fwRows}</tbody></table>`
                    : d.bmc_loading ? `<div class="empty">BMC 連線抓取中（Cisco CIMC 較慢約 15–30 秒）…<br><span class="mono" style="font-size:11px">稍後自動更新</span></div>`
                    : `<div class="empty">無 FW 資料</div>`;
  }
  // BIOS / Device Firmware（dmidecode + smartctl + ethtool + nvidia-smi，跨 vendor 容錯）
  const hwFw = (d.os_info && d.os_info.hw && d.os_info.hw.firmware) || null;
  if (hwFw) {
    let fwRows = "";
    if (hwFw.bios) {
      const parts = [hwFw.bios.vendor, hwFw.bios.version, hwFw.bios.release].filter(Boolean).join(" · ");
      fwRows += `<tr><td class="mono bfw-tag">BIOS</td><td class="mono">${esc(parts)}</td></tr>`;
    }
    (hwFw.ssd || []).forEach(s => fwRows += `<tr><td class="mono bfw-tag">SSD ${esc(s.dev)}</td><td class="mono">${esc(s.fw)}</td></tr>`);
    (hwFw.nic || []).forEach(n => fwRows += `<tr><td class="mono bfw-tag">NIC ${esc(n.iface)}</td><td class="mono">${esc(n.fw)}</td></tr>`);
    (hwFw.gpu || []).forEach(g => fwRows += `<tr><td class="mono bfw-tag">GPU ${esc(g.index)}</td><td class="mono">${esc(g.fw) || "—"}</td></tr>`);
    if (fwRows) {
      fwHtml += `
      <details class="bfw-wrap">
        <summary class="bfw-title">＋ BIOS / 裝置韌體 (OS) <span class="bfw-count">${(fwRows.match(/<tr>/g)||[]).length} 項</span></summary>
        <table class="t fw-table bfw-table"><tbody>${fwRows}</tbody></table>
      </details>`;
    }
  }
  // 感測器：獨立 /sensors 端點，非同步載入（不阻塞主畫面）
  const sd = machineSensorsCache[name];
  if (base.bmc_alive && !sd) machineLoadSensors(name);
  const sensorHtml = machineSensorsHtml(sd, base, name);
  // 只要 BMC 在線就安排一次 Sensor AI 診斷（含已有快取、重繪回詳情頁時）
  if (base.bmc_alive && _activeMachine === name) {
    setTimeout(() => { if (state.view === "machine") sensorAnalyze(name); }, 60);
  }

  // BMC 背景抓取進行中 → 數秒後自動重打 detail（不打 refresh，讀快取）更新
  if (d.bmc_loading) {
    setTimeout(() => {
      if (_activeMachine === name && state.view === "machine") {
        delete machineDetailCache[name];
        machineLoadDetail(name);
      }
    }, 12000);
  }
  return `
    <div class="mach-toolbar">
      <button class="btn small" onclick="machineBack()">← 返回</button>
      <span class="mach-name">🖥 ${esc(name)} ${lvlBadge}</span>
      <span class="spacer"></span>
      <button class="btn small" onclick="openTermDialog('${esc(name)}')">▶ Terminal</button>
      ${m.passive ? "" : `<button class="btn small" onclick="runDiagnose('${esc(name)}')">🩺 系統診斷</button>`}
      <button class="btn small btn-good" onclick="openAssignTask('${esc(name)}')">📋 指派任務</button>
      <button class="btn small" onclick="machineRefresh()">⟳ 重新整理</button>
    </div>
    <div class="mach-grid">
      <div class="card">
        <div class="card-title">基本資訊</div>
        <table class="t mach-info">
          <tr><td>專案</td><td>${esc(base.project || "未分類")}</td></tr>
          <tr><td>層級</td><td>${lvlBadge}</td></tr>
          <tr><td>OS IP</td><td class="mono">${esc(base.os_ip)} (${esc(base.os_user||"")}) — <b>${osState}</b></td></tr>
          <tr><td>BMC IP</td><td class="mono">${esc(base.bmc_ip||"—")} (${esc(base.bmc_user||"")}) — <b>${bmcState}</b></td></tr>
          <tr><td>BMC 電源</td><td>${base.bmc_alive ? powerBadge(d.power) : "—"}</td></tr>
        </table>
        ${base.bmc_ip ? `
        <div class="mach-power-actions">
          <button class="btn small btn-good" onclick="machinePower('${esc(name)}',true)">⏻ 開機</button>
          <button class="btn small btn-danger" onclick="machinePower('${esc(name)}',false)">⏻ 關機</button>
          <button class="btn small btn-warn" onclick="machineRebootDetail('${esc(name)}')">⟳ Reboot</button>
          <button class="btn small" onclick="machineAuxDetail('${esc(name)}')">⚡ AC cycle</button>
        </div>
        ` : ""}
      </div>
      <div class="card">
        <div class="card-title">OS 系統資訊 ${d.os_info && d.os_info.fetched_at ? `<span class="hint">(${d.os_info.fetched_at})</span>` : ""}</div>
        <div class="os-scroll">${osInfoHtml}</div>
      </div>
    </div>
    ${base.bmc_alive ? `
    <div class="mach-grid">
      <div class="card">
        <div class="card-title">BMC 感測器 (ipmitool sdr)</div>
        <div id="sensor-body">${sensorHtml}</div>
      </div>
      <div class="card">
        <div class="card-title">BMC Firmware (ipmitool mc info)</div>
        ${fwHtml}
      </div>
    </div>` : `
    <div class="card"><div class="empty">BMC (${esc(base.bmc_ip||"—")}) 目前不可連，無法抓取感測器與 FW 資訊。</div></div>`}
    ${m.passive ? "" : `<div class="card diag-card" style="margin-top:18px">
      <div class="card-title">🩺 系統診斷（AI 分析）</div>
      <div class="diag-body" id="diag-body"></div>
      ${diagBodyFill(name)}
    </div>`}
    <div class="card" style="margin-top:18px">
      <div class="card-title tel-card-title" onclick="toggleTelAll()">
        <span>📊 System Telemetry <span class="hint" id="tel-window"></span></span>
        <span class="tel-collapse-all" id="tel-collapse-all">▲ 全部收合</span>
      </div>
      <div class="tel-toolbar">
        <label class="tel-range-sel">時間範圍
          <select class="input" id="tel-select">
            <option value="10">10 分鐘</option>
            <option value="30">30 分鐘</option>
            <option value="60" selected>1 小時</option>
            <option value="360">6 小時</option>
            <option value="720">12 小時</option>
            <option value="1440">24 小時</option>
            <option value="2880">2 天</option>
            <option value="10080">7 天</option>
            <option value="43200">30 天</option>
          </select>
        </label>
        <span class="tel-ai-hint">🤖 Telemetry AI</span>
      </div>
      <div class="tel-ai" id="tel-ai">✨ 正在分析此範圍的監控趨勢…</div>
      <div class="tel-grid" id="tel-grid">
        <div class="tel-block" data-open="1">
          <div class="tel-block-head"><span class="tel-label">CPU <em>（中央處理器）</em></span></div>
          <div class="tel-block-body">
            <div class="chart-box"><div class="chart-title">CPU 使用率 <span class="unit">＝ 各核心忙碌比例的平均，0~100%</span></div><canvas id="tel-cpu"></canvas></div>
            <div class="chart-box"><div class="chart-title">CPU 溫度 <span class="unit">＝ 包裝溫度（x86_pkg_temp / lm-sensors），無感測器時留空</span></div><canvas id="tel-cputemp"></canvas></div>
            <div class="chart-box"><div class="chart-title">CPU Load（平均負載） <span class="unit">＝ 排隊等待的核心任務數，超過核心數代表過載</span></div><canvas id="tel-load"></canvas></div>
          </div>
        </div>
        <div class="tel-block" data-open="1">
          <div class="tel-block-head"><span class="tel-label">DIMM <em>（記憶體）</em></span></div>
          <div class="tel-block-body">
            <div class="chart-box"><div class="chart-title">記憶體使用率 <span class="unit">＝ 已用／總容量</span></div><canvas id="tel-mem"></canvas></div>
            <div class="chart-box"><div class="chart-title">記憶體使用量 <span class="unit">＝ 已用 vs 總量（GB）</span></div><canvas id="tel-memgb"></canvas></div>
            <div class="chart-box"><div class="chart-title">可用記憶體 <span class="unit">＝ 可用的 GB</span></div><canvas id="tel-swap"></canvas></div>
          </div>
        </div>
        <div class="tel-block" data-open="1">
          <div class="tel-block-head"><span class="tel-label">SSD <em>（固態硬碟 / 儲存）</em></span></div>
          <div class="tel-block-body">
            <div class="chart-box"><div class="chart-title">掛載點使用率 <span class="unit">＝ 每個分割區已用百分比</span></div><canvas id="tel-disk"></canvas></div>
            <div class="chart-box"><div class="chart-title">掛載點已用量 <span class="unit">＝ 每個分割區已用空間（GB）</span></div><canvas id="tel-diskused"></canvas></div>
          </div>
        </div>
        <div class="tel-block" data-open="1">
          <div class="tel-block-head"><span class="tel-label">NIC <em>（網路卡）</em></span></div>
          <div class="tel-block-body">
            <div class="chart-box"><div class="chart-title">網路吞吐量 <span class="unit">＝ 每張網卡 RX↓收 / TX↑送（MB/s）</span></div><canvas id="tel-net"></canvas></div>
          </div>
        </div>
        <div class="tel-block" data-open="1">
          <div class="tel-block-head"><span class="tel-label">GPU <em>（顯示卡）</em></span></div>
          <div class="tel-block-body">
            <div class="chart-box"><div class="chart-title">GPU 使用率 <span class="unit">＝ GPU 核心運算負載</span></div><canvas id="tel-gpu"></canvas></div>
            <div class="chart-box"><div class="chart-title">GPU 記憶體使用 <span class="unit">＝ VRAM（GB）</span></div><canvas id="tel-gpumem"></canvas></div>
            <div class="chart-box"><div class="chart-title">GPU 溫度 <span class="unit">＝ 顯示卡溫度（°C）</span></div><canvas id="tel-gputemp"></canvas></div>
            <div class="chart-box"><div class="chart-title">GPU 功耗 <span class="unit">＝ 顯示卡功耗（W）</span></div><canvas id="tel-gpupow"></canvas></div>
          </div>
        </div>
      </div>
      <div class="footer-hint">Telemetry 由後端定時透過 SSH 收集（NVIDIA nvidia-smi / AMD rocm-smi + /proc），不需在被監控機器安裝 agent。</div>
    </div>`;
}
// 系統診斷結果暫存（key=機台名），避免頁面 async 更新時被清掉
const diagStore = {};   // { name: {state:'loading'|'done'|'error', html:'...'} }

function diagBodyFill(name) {
  const s = diagStore[name];
  if (!s) return `<div class="empty">點上方「🩺 系統診斷」按鈕，收集 dmesg / journalctl / GPU / BMC event log，並由 AI 分析問題與建議處理。</div>`;
  if (s.state === "loading") return `<div class="empty">⏳ 正在收集資料並呼叫 AI 分析（約 30~60 秒）…</div>`;
  return s.html || `<div class="empty">(無結果)</div>`;
}
function runDiagnose(name) {
  const btn = [...document.querySelectorAll("button")].find(b => b.textContent.includes("系統診斷") || b.textContent.includes("診斷中"));
  diagStore[name] = { state: "loading", html: "" };
  if (btn) { btn.disabled = true; btn.textContent = "⏳ 診斷中…"; }
  const body = $("diag-body");
  if (body) body.innerHTML = diagBodyFill(name);
  api(`/api/machine/${encodeURIComponent(name)}/diagnose`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ include_bmc: true })
  }).then(d => {
    if (!d.ok) throw new Error(d.error || "分析失敗");
    if (d.note) { diagStore[name] = { state: "done", html: `<div class="empty">${esc(d.note)}</div>` }; return; }
    const md = d.report || "(無分析結果)";
    const bmcMode = d.collect && d.collect.bmc_mode === "os_local"
      ? "本機 ipmitool（SSH 進 OS 執行）"
      : d.collect && d.collect.bmc ? "OOB lanplus" : "—";
    diagStore[name] = { state: "done", html: `
      <div class="diag-report"><pre class="mach-pre mono">${esc(md)}</pre></div>
      <details class="diag-raw"><summary>診斷原始資料（收集時間 ${esc(d.collected_at||"—")} · IPMI：${esc(bmcMode)}）</summary>
        <pre class="mach-pre mono">${esc((d.collect&&d.collect.os)||"(無 OS 資料)")}</pre>
        ${d.collect && d.collect.bmc ? `<pre class="mach-pre mono">===== BMC SEL =====\n${esc(d.collect.bmc)}</pre>` : ""}
      </details>` };
  }).catch(e => {
    diagStore[name] = { state: "error", html: `<div class="empty" style="color:var(--danger)">診斷失敗：${esc(e.message)}</div>` };
  }).finally(() => {
    const b2 = $("diag-body");
    if (b2) b2.innerHTML = diagBodyFill(name);
    if (btn) { btn.disabled = false; btn.textContent = "🩺 系統診斷"; }
  });
}
async function machinePower(name, on) {
  if (!confirm(`確定要「${on?"開機":"關機"}」${name} 嗎？（透過 BMC ipmitool）`)) return;
  try {
    const r = await api(`/api/machine/${encodeURIComponent(name)}/power`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on })
    });
    await machineLoadDetail(name);
    setTimeout(() => alert(`${name} ${r.ok?(on?"已開機":"已關機"):"操作失敗："+(r.info||"")}\nBMC 目前狀態：${r.power_status}`), 250);
  } catch (e) {
    alert("操作失敗：" + e.message);
  }
}
// 系統詳情頁 Reboot（OS reboot，無 OS 才用 BMC reset）
async function machineRebootDetail(name) {
  if (!confirm(`確定要「Reboot」${name} 嗎？（OS reboot）`)) return;
  try {
    const r = await api(`/api/machine/${encodeURIComponent(name)}/reboot`, { method: "POST" });
    await machineLoadDetail(name);
    setTimeout(() => alert(`${name} ${r.ok ? "已送出 reboot ⟳" : "操作失敗：" + (r.info||"")}`), 250);
  } catch (e) { alert("操作失敗：" + e.message); }
}
async function machineAuxDetail(name) {
  if (!confirm(`確定要對「${name}」執行 AC cycle（完整斷電重上電）嗎？`)) return;
  try {
    const r = await api(`/api/machine/${encodeURIComponent(name)}/aux`, { method: "POST" });
    setTimeout(() => alert(`${name} ${r.ok ? "AC cycle 已送出 ⚡" : "操作失敗：" + (r.info||"")}`), 250);
  } catch (e) { alert("操作失敗：" + e.message); }
}

/* =================== Assign Task (test library) ===================
   Pick test cases from the library on a machine detail view, then produce
   a "copy to OpenHands" instruction text (Traditional Chinese UI strings are
   emitted as \uXXXX escapes so this block stays 7-bit clean). The target
   machine os_ip/user come from the machine; password is a placeholder. */
const _assignTask = {
  name: null,
  machine: null,
  meta: [],
  sheet: null,
  items: [],
  sel: new Set(),
  q: "",
  page: 0,
  perPage: 100,
};

function assignTaskMach() {
  return (_assignTask.machine) || machines.find(x => x.name === _assignTask.name) || null;
}

async function openAssignTask(name) {
  _assignTask.name = name;
  const m = machines.find(x => x.name === name) || {};
  _assignTask.machine = m;
  _assignTask.sheet = null;
  _assignTask.items = [];
  _assignTask.sel = new Set();
  _assignTask.q = "";
  _assignTask.page = 0;
  try {
    const meta = await api("/api/testlibrary/meta");
    _assignTask.meta = meta.sheets || [];
  } catch (e) {
    _assignTask.meta = [];
  }
  // use a wider modal to hold the list
  const dlg = dialogBackdrop();
  const modal = dlg.querySelector(".modal");
  if (modal) modal.style.width = "880px";
  showDialog("\u2705 \u6307\u6d3e\u4efb\u52d9", `<div id="assign-task-body">${assignTaskMetaHtml()}</div>`,
    [{ txt: "\u95dc\u9589", cls: "btn", fn: () => { if (modal) modal.style.width = ""; closeDialog(); } }]);
}
function assignTaskBack() {
  _assignTask.sheet = null;
  _assignTask.items = [];
  _assignTask.sel = new Set();
  _assignTask.q = "";
  _assignTask.page = 0;
  const dlg = dialogBackdrop();
  const modal = dlg.querySelector(".modal");
  if (modal) modal.style.width = "880px";
  showDialog("\u2705 \u6307\u6d3e\u4efb\u52d9", `<div id="assign-task-body">${assignTaskMetaHtml()}</div>`,
    [{ txt: "\u95dc\u9589", cls: "btn", fn: () => { if (modal) modal.style.width = ""; closeDialog(); } }]);
}

function assignTaskMetaHtml() {
  const target = assignTaskMach();
  const ip = target && target.os_ip ? target.os_ip : "\u2014";
  const user = (target && target.os_user) || "root";
  const head = `
    <div style="margin-bottom:14px;padding:12px 14px;background:var(--bg-panel-2);border-radius:10px;font-size:13px">
      <b>\u76ee\u6a19\u6a5f\u53f0\uff1a</b> ${esc(_assignTask.name)} &nbsp;·&nbsp; <b>OS\u200bIP\uff1a</b>
      <span class="mono">${esc(ip)}</span> &nbsp;·&nbsp; <b>\u5e33\u865f\uff1a</b><span class="mono">${esc(user)}</span>
    </div>`;
  if (!_assignTask.meta.length) {
    return head + `<div class="empty">\u6e2c\u8a66\u5eab\u5c1a\u672a\u8f09\u5165\uff08\u6c92\u6709 tests.json \u6216\u5f8c\u7aef\u932f\u8aa4\uff09</div>`;
  }
  const cards = _assignTask.meta.map(s => `
    <div class="assign-sheet-card" onclick="assignTaskOpenSheet('${s.sheet}')">
      <div class="assign-sheet-label">${esc(s.label)} <span class="hint">${esc(s.sheet)}</span></div>
      <div class="assign-sheet-count"><b>${s.count}</b> \u500b\u6e2c\u9805</div>
      <div class="assign-sheet-badges">
        <span class="badge" style="color:var(--green)">\u53ef\u81ea\u52d5 ${s.auto}</span>
        <span class="badge" style="color:var(--w-green)">\u90e8\u5206 ${s.partial}</span>
        <span class="badge" style="color:var(--red)">\u4eba\u5de5 ${s.no}</span>
      </div>
    </div>`).join("");
  return head + `<div class="assign-sheet-grid">${cards}</div>
    <div style="margin-top:12px;font-size:12px;color:var(--text-faint)">\u9ede\u9078\u5206\u985e\u5f8c\uff0c\u53ef\u8907\u9078\u6e2c\u9805\u5f85\u767c\u9001</div>`;
}

const assignSheetCache = {};
async function assignTaskOpenSheet(sheetName) {
  let s;
  if (assignSheetCache[sheetName]) {
    s = assignSheetCache[sheetName];
  } else {
    try {
      s = await api("/api/testlibrary?sheet=" + encodeURIComponent(sheetName));
      assignSheetCache[sheetName] = s;
    } catch (e) {
      alert("\u8f09\u5165\u5931\u6557\uff1a" + e.message); return;
    }
  }
  const m = (_assignTask.meta || []).find(x => x.sheet === sheetName) ||
            { sheet: sheetName, label: sheetName, count: (s.items || []).length };
  _assignTask.sheet = m;
  _assignTask.items = (s && s.items) || [];
  _assignTask.page = 0;
  _assignTask.q = "";
  const dlg = dialogBackdrop();
  const modal = dlg.querySelector(".modal");
  if (modal) modal.style.width = "940px";
  showDialog(`\u2705 \u6307\u6d3e\u4efb\u52d9 \u00b7 ${esc(m.label)}`, `<div id="assign-task-body">${assignTaskListHtml()}</div>`,
    [
      { txt: "\u25c0 \u56de\u5206\u985e", cls: "btn", fn: () => assignTaskBack() },
      { txt: "\u95dc\u9589", cls: "btn", fn: () => { if (modal) modal.style.width = ""; closeDialog(); } },
      { txt: `\ud83d\udccb \u8907\u88fd\u6e2c\u9805\u6539\u70ba\u6307\u4ee4 (${_assignTask.sel.size})`,
        cls: "btn-primary primary", fn: () => assignTaskCopy() },
    ]);
}

function assignTaskListHtml() {
  const mm = _assignTask.sheet || {};
  const rows = _assignTask.items;
  const q = _assignTask.q.trim().toLowerCase();
  let filt = q ? rows.filter(r =>
      String(r.code||"").toLowerCase().includes(q) ||
      String(r.items||"").toLowerCase().includes(q) ||
      String(r.test_set||"").toLowerCase().includes(q)
    ) : rows;
  const totalPages = Math.max(1, Math.ceil(filt.length / _assignTask.perPage));
  if (_assignTask.page >= totalPages) _assignTask.page = totalPages - 1;
  const pg = _assignTask.page;
  const slice = filt.slice(pg * _assignTask.perPage, (pg + 1) * _assignTask.perPage);
  const filterMeta = filt.length !== _assignTask.items.length;
  const selCount = _assignTask.sel.size;

  const dupCodes = dupCodeSet();
  const rowsHtml = slice.map(r => assignTaskRow(r, dupCodes)).join("");
  const toolbar = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <input id="assign-q" class="assign-search" type="text" placeholder="\u641c\u5c0b code / items / test set"
        value="${esc(_assignTask.q)}" oninput="assignTaskSearch()" />
      <button class="btn small" onclick="assignTaskSelAll()">\u2713 \u5168\u9078\u672c\u9801</button>
      <button class="btn small" onclick="assignTaskSelClear()">\u7a7a \u6e05\u7a7a</button>
      <span class="hint">\u5df2\u9078 <b id="assign-selcount">${selCount}</b> /\u5171 ${_assignTask.items.length}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px">
      <button class="btn small" ${pg<=0?"disabled":""} onclick="assignTaskPage(-1)">\u2039 \u4e0a\u4e00\u9801</button>
      <span class="hint">\u7b2c ${pg+1} / ${totalPages} \u9801 \u00b7 ${filt.length} \u9805${filterMeta?` \u00b7 \u641c\u5c0b: ${esc(_assignTask.q)}`:""}</span>
      <button class="btn small" ${pg>=totalPages-1?"disabled":""} onclick="assignTaskPage(1)">\u4e0b\u4e00\u9801 \u203a</button>
    </div>`;

  return toolbar + `<div class="assign-rows">${rowsHtml || `<div class="empty">\u6c92\u6709\u76f8\u7b26\u6e2c\u9805</div>`}</div>`;
}

function dupCodeSet() {
  const m = new Map();
  (_assignTask.items||[]).forEach(r => m.set(r.code, (m.get(r.code)||0)+1));
  const s = new Set();
  m.forEach((n,c) => { if (n>1) s.add(c); });
  return s;
}

function assignTaskRow(r, dup) {
  const checked = _assignTask.sel.has(r.code) ? "checked" : "";
  const can = String(r.ai_can_execute || "NO").toUpperCase();
  const badge = can === "YES" ? `<span class="badge green">YES</span>`
    : can === "PARTIAL" ? `<span class="badge" style="color:var(--w-green)">PARTIAL</span>`
    : `<span class="badge" style="color:var(--red)">NO</span>`;
  const pkg = r.ai_packages_needed ? `<span class="hint">\ud83d\udce6 ${esc(r.ai_packages_needed)}</span>` : "";
  return `
    <label class="assign-row">
      <input type="checkbox" ${checked} onchange="assignTaskToggle('${esc(r.code)}', this.checked)" />
      <div class="assign-row-body">
        <div class="assign-row-title">${badge} <span class="mono">${esc(r.code)}</span>
          <span class="assign-items">${esc(r.items)}${dup && dup.has(r.code) ? ` [${esc(r.test_set||"")}]` : ""}</span></div>
        <div class="assign-row-sub">${esc(r.test_set || "")} ${pkg}</div>
        <div class="assign-row-cmd"><span class="hint">\u547d\u4ee4\uff1a</span>${esc((r.ai_commands||"").split("\\n").slice(0,3).join(" "))}</div>
      </div>
    </label>`;
}

function assignTaskSearch() {
  _assignTask.q = ($("assign-q").value || "");
  _assignTask.page = 0;
  const dlg = dialogBackdrop();
  const modal = dlg.querySelector(".modal");
  if (modal) modal.style.width = "940px";
  showDialog(`\u2705 \u6307\u6d3e\u4efb\u52d9 \u00b7 ${esc(_assignTask.sheet ? _assignTask.sheet.label : "")}`, `<div id="assign-task-body">${assignTaskListHtml()}</div>`,
    [
      { txt: "\u25c0 \u56de\u5206\u985e", cls: "btn", fn: () => assignTaskBack() },
      { txt: "\u95dc\u9589", cls: "btn", fn: () => { if (modal) modal.style.width = ""; closeDialog(); } },
      { txt: `\ud83d\udccb \u8907\u88fd\u6e2c\u9805\u6539\u70ba\u6307\u4ee4 (${_assignTask.sel.size})`,
        cls: "btn-primary primary", fn: () => assignTaskCopy() },
    ]);
}
function assignTaskPage(dir) {
  _assignTask.page += dir;
  const dlg = dialogBackdrop();
  const modal = dlg.querySelector(".modal");
  if (modal) modal.style.width = "940px";
  showDialog(`\u2705 \u6307\u6d3e\u4efb\u52d9 \u00b7 ${esc(_assignTask.sheet ? _assignTask.sheet.label : "")}`, `<div id="assign-task-body">${assignTaskListHtml()}</div>`, [
    { txt: "\u25c0 \u56de\u5206\u985e", cls: "btn", fn: () => assignTaskBack() },
    { txt: "\u95dc\u9589", cls: "btn", fn: () => { if (modal) modal.style.width = ""; closeDialog(); } },
    { txt: `\ud83d\udccb \u8907\u88fd\u6e2c\u9805\u6539\u70ba\u6307\u4ee4 (${_assignTask.sel.size})`, cls: "btn-primary primary", fn: () => assignTaskCopy() },
  ]);
}
function assignTaskToggle(code, on) {
  if (on) _assignTask.sel.add(code); else _assignTask.sel.delete(code);
  const c = $("assign-selcount");
  if (c) c.textContent = _assignTask.sel.size;
}
function assignTaskSelAll() {
  const q = _assignTask.q.trim().toLowerCase();
  const rows = _assignTask.items;
  let filt = q ? rows.filter(r => String(r.code||"").toLowerCase().includes(q) ||
      String(r.items||"").toLowerCase().includes(q) || String(r.test_set||"").toLowerCase().includes(q)) : rows;
  const pg = _assignTask.page;
  const slice = filt.slice(pg * _assignTask.perPage, (pg + 1) * _assignTask.perPage);
  slice.forEach(r => _assignTask.sel.add(r.code));
  assignTaskReRender();
}
function assignTaskSelClear() {
  _assignTask.sel.clear();
  assignTaskReRender();
}
function assignTaskReRender() {
  const dlg = dialogBackdrop();
  const modal = dlg.querySelector(".modal");
  if (modal) modal.style.width = "940px";
  showDialog(`\u2705 \u6307\u6d3e\u4efb\u52d9 \u00b7 ${esc(_assignTask.sheet ? _assignTask.sheet.label : "")}`, `<div id="assign-task-body">${assignTaskListHtml()}</div>`, [
    { txt: "\u25c0 \u56de\u5206\u985e", cls: "btn", fn: () => assignTaskBack() },
    { txt: "\u95dc\u9589", cls: "btn", fn: () => { if (modal) modal.style.width = ""; closeDialog(); } },
    { txt: `\ud83d\udccb \u8907\u88fd\u6e2c\u9805\u6539\u70ba\u6307\u4ee4 (${_assignTask.sel.size})`, cls: "btn-primary primary", fn: () => assignTaskCopy() },
  ]);
}

async function assignTaskCopy() {
  const sel = _assignTask.sel;
  if (!sel.size) { alert("\u8acb\u5148\u52fe\u9078\u81f3\u5c11\u4e00\u9805\u6e2c\u9805\uff01"); return; }
  const mm = _assignTask.sheet || {};
  const m = assignTaskMach();
  const ip = (m && m.os_ip) || "<OS_IP>";
  const user = (m && m.os_user) || "root";
  const pass = (m && m.os_pass && m.os_pass !== "****") ? m.os_pass : "<PASSWORD>";
  const sname = mm.sheet || "";
  const items = _assignTask.items;
  const dupSet = dupCodeSet();
  const chosen = items.filter(r => sel.has(r.code));
  if (!chosen.length) { alert("\u6e2c\u9805\u6e05\u55ae\u5df2\u5207\u63db\uff0c\u8acb\u91cd\u65b0\u52fe\u9078"); return; }

  // \u6e05\u7406\u539f\u59cb\u8cc4\u6599\u91cc\u591a\u990a\u7684\u7a7a\u884c\uff082 \u500b\u4ee5\u4e0a\u9023\u7e8c blank line \u5168\u7e2e\u6210 1 \u500b\uff09\uff0c\u7559\u4e0b\u6b63\u5e38\u6bb5\u843d\u9593\u8ddd
  const collapseBlank = (s) => String(s || "").replace(/\n{3,}/g, "\n\n");
  const lines = [];
  lines.push(`\u76ee\u6a19\u6a5f\u53f0\uff1a${mm.label} \u00b7 ${sname} \u00b7 ${ip} \u00b7 ${user}`);
  lines.push(`\u8acb\u5728 ${ip} \u9019\u53f0 ${user} \u4e3b\u6a5f\u4e0a\u57f7\u884c\u4ee5\u4e0b\u6e2c\u9805\uff08\u60a8\u8907\u88fd\u5f8c\u8cbc\u4e0a\u56de\u5230 OpenHands \u804a\u5929\uff0c\u8b93\u6211 SSH \u4e0a\u53bb\u5b89\u88dd/\u57f7\u884c/\u6536\u96c6\u8b49\u64da\uff1b\u5f97\u5931\u5224\u5b9a\u7531\u60a8\uff09\uff1a`);
  chosen.forEach((r, i) => {
    const can = String(r.ai_can_execute || "NO").toUpperCase();
    const cmdRaw = collapseBlank(r.ai_commands).trim();
    const tname = r.items ? String(r.items) : r.code;
    const pkg = r.ai_packages_needed ? `\uff08\u5305\uff1a${r.ai_packages_needed}\uff09` : "";
    const SEP = "   " + "\u2500".repeat(64);
    const box = (s) => {
      const L = s.split('\n');
      const w = Math.max(40, ...L.map(l => l.length)) + 1;
      const out = ["   \u250c" + "\u2500".repeat(w)];
      L.forEach(l => out.push("   \u2502 " + l));
      out.push("   \u2514" + "\u2500".repeat(w));
      return out.join('\n');
    };
    const indent = (s, n) => s.split('\n').map(l => " ".repeat(n) + (l || "")).join('\n');

    lines.push(`${i + 1}. ${can === "YES" ? "\ud83d\udfe2" : can === "PARTIAL" ? "\ud83d\udfe0" : "\u26ab"} \u6e2c\u8a66\u9805\u76ee\uff1a${tname}${dupSet.has(r.code) ? ` [${r.test_set||""}]` : ""}`);
    if (pkg) lines.push(`   ${pkg}`);
    const note = can === "YES"
      ? "\u53ef\u81ea\u52d5\u57f7\u884c\u3002"
      : can === "PARTIAL"
        ? "\u90e8\u5206\u53ef\u81ea\u52d5\uff0c\u4f46\u9700\u78ba\u8a8d\u786c\u9ad4\u74b0\u5883\/\u6307\u5b9a\u6e2c\u8a66\u76ee\u6a19\uff0c\u8acb\u5148\u78ba\u8a8d\u518d\u57f7\u884c\u3002"
        : "\u7121\u6cd5\u81ea\u52d5\u57f7\u884c\uff08\u9700\u4eba\u5de5\u64cd\u4f5c\u6216\u5371\u96aa\u64cd\u4f5c\uff09\uff0c\u53ea\u63d0\u4f9b\u53c3\u8003\u3002";
    lines.push(`   ${note}`);

    const cmdValid = can !== "NO" && cmdRaw
      && !cmdRaw.startsWith("\u2014") && cmdRaw.indexOf("<CMD>") === -1 && cmdRaw.indexOf("sshpass") === -1;
    if (cmdValid) {
      lines.push(SEP);
      lines.push(`   \u25b6 \u672c\u6b21\u8981\u8dd1\u7684\u6307\u4ee4\uff08AI \u5df2\u6574\u7406\uff0c\u53ef\u76f4\u63a5\u8cbc\u4e0a shell \u57f7\u884c\uff09\uff1a`);
      lines.push(box(cmdRaw));
    } else if (cmdRaw) {
      lines.push(SEP);
      lines.push(`   \u25b6 \u53c3\u8003\u6307\u4ee4\uff08\u7121\u6cd5\u76f4\u63a5\u57f7\u884c\uff0c\u4ec5\u4f9b\u53c3\u8003\uff09\uff1a`);
      lines.push(box(cmdRaw));
    }

    const procRaw = collapseBlank(r.procedure).trim();
    if (procRaw) {
      const hasCmd = !!cmdValid;
      lines.push(SEP);
      lines.push(`   \ud83d\udd0e \u539f\u59cb\u624b\u4f5c\u696d\u55ae\uff08${hasCmd ? "\u7559\u4f5c\u53c3\u7167\uff0c\u975e\u672c\u6b21\u8981\u8dd1\u7684\u6307\u4ee4" : "\u9700\u4eba\u5de5\u64cd\u4f5c"}\uff09\uff1a`);
      lines.push(indent(procRaw, 6));
    }

    const critRaw = collapseBlank(r.criteria).trim();
    if (critRaw) {
      lines.push(SEP);
      lines.push(`   \u2705 \u5224\u5b9a\u6a19\u6e96\uff1a`);
      lines.push(indent(critRaw, 6));
    }

    lines.push("");
  });
  const text = lines.join("\n");
  const summary = chosen.length + "\u500b\u6e2c\u9805" + " \u00b7 " + (mm.label || sname);

  // 複製到剪貼簿（成功與否都開浮動視窗；失敗時視窗內仍可「複製全部」手動重試）
  try { await assignTaskClip(text); } catch (e) { /* noop */ }

  // 開仿 User Guide 的浮動小視窗，讓使用者在下方滾動看完整 TEST CASE
  AssignResultWin.render("\u2705 \u6307\u6d3e\u53ef\u57f7\u884c\u6307\u4ee4 \u00b7 " + summary, text);
}

async function assignTaskClip(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand && document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) { return false; }
}

// ============================================================

// [AR-HL v1 \u2014 assign-window command syntax coloring (display only)]
function arEscapeHl(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function arHlLine(raw) {
  var pm = raw.match(/^\s*(?:\u2502\s*)*/);
  if (pm && pm.length < raw.length) {
    // Fix: handle unicode char │ which may include extra invisible spacing
    var matchStart = pm[0].length;
    var commentStart = matchStart;
    for (var i = matchStart; i < raw.length; i++) {
      if (raw.charAt(i) !== ' ') { commentStart = i; break; }
    }
    if (commentStart < raw.length && raw.charAt(commentStart) === "#") {
      return arEscapeHl(raw.slice(0, commentStart)) +
             '<span class="ar-cmt">' + arEscapeHl(raw.slice(commentStart)) + "</span>";
    }
  }
  var TOK = /(\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^\{\}]*\})|(\[[A-Za-z][A-Za-z0-9_.+~-]*\])|(\b(?:sshpass|ssh|sudo|ipmitool|curl|wget|fio|cat|echo|printf|grep|egrep|awk|sed|head|tail|tee|ls|cp|mv|apt-get|apt|dmesg|lscpu|lspci|dmidecode|ethtool|snmpget|jq|bash|sh|python3|python|timeout|nohup|mst|devlink|nvsm|rvs|rsmi|nvidia-smi|dcgmi|storcli|sas3ircu|ssacli|iperf3|iperf|systemctl|nvme|hdparm|smartctl|redis-cli|stress-ng|lshw|ping|ifconfig|reboot)\b)/g;
  var out = "", last = 0, m;
  TOK.lastIndex = 0;
  while ((m = TOK.exec(raw)) !== null) {
    if (m.index > last) out += arEscapeHl(raw.slice(last, m.index));
    if (m[1] != null) out += '<span class="ar-var">' + arEscapeHl(m[1]) + "</span>";
    else if (m[2] != null) out += '<span class="ar-sec">' + arEscapeHl(m[2]) + "</span>";
    else if (m[3] != null) out += '<span class="ar-cmd">' + arEscapeHl(m[3]) + "</span>";
    last = m.index + m[0].length;
    if (m.index === TOK.lastIndex) TOK.lastIndex++;
  }
  out += arEscapeHl(raw.slice(last));
  return out;
}
function arHlAssignText(text) {
  var L = String(text).split("\n");
  for (var i = 0; i < L.length; i++) L[i] = arHlLine(L[i]);
  return L.join("\n");
}
// [AR-HL v1 END]

// 指派任務結果浮動視窗（複製測項改為指令） — 仿 User Guide 小視窗
// ============================================================
const AssignResultWin = (() => {
  let win = null, dragOff = null, resize = null, lastNormal = null;

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function build() {
    win = el("div", "ar-window");
    const bar = el("div", "ar-bar");
    bar.innerHTML =
      '<span class="ar-title" id="ar-title"></span>' +
      '<button class="ar-btn" data-act="max" title="最大化 / 縮小">□</button>' +
      '<button class="ar-btn ar-close" data-act="close" title="關閉">✕</button>';
    const content = el("div", "ar-content");
    const body = el("div", "ar-body");
    const pre = document.createElement("pre");
    pre.className = "ar-pre"; pre.id = "ar-pre";
    body.appendChild(pre);
    const foot = el("div", "ar-foot");
    foot.innerHTML =
      '<span class="ar-hint" id="ar-hint"></span>' +
      '<button class="btn small" id="ar-copy-all" title="複製全部指令文字">\ud83d\udccb 複製全部</button>';
    content.appendChild(body);
    content.appendChild(foot);
    win.appendChild(bar);
    win.appendChild(content);
    const grip = el("div", "ar-grip"); grip.title = "拖動以縮放視窗";
    win.appendChild(grip);
    document.body.appendChild(win);
    bind();
  }

  function bind() {
    const bar = win.querySelector(".ar-bar");
    bar.addEventListener("mousedown", startDrag);
    bar.addEventListener("click", (e) => {
      const bt = e.target.closest(".ar-btn"); if (!bt) return;
      if (bt.dataset.act === "close") close();
      else if (bt.dataset.act === "max") toggleMax();
    });
    win.querySelector("#ar-copy-all").addEventListener("click", async () => {
      await assignTaskClip(win._text || "");
      const hint = win.querySelector("#ar-hint");
      const prev = hint.textContent;
      hint.textContent = "\u2705 \u5df2\u8907\u88fd\u5230\u526a\u8cbc\u7c3f";
      setTimeout(() => { hint.textContent = prev; }, 1600);
    });
    win.querySelector(".ar-grip").addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      resize = { x: e.clientX, y: e.clientY, w: win.offsetWidth, h: win.offsetHeight };
      document.addEventListener("mousemove", onResizeMove);
      document.addEventListener("mouseup", onResizeEnd);
    });
  }

  function startDrag(e) {
    if (e.target.closest(".ar-btn") || win.classList.contains("ar-maxed")) return;
    dragOff = { x: e.clientX - win.offsetLeft, y: e.clientY - win.offsetTop };
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
  }
  function onDragMove(e) {
    if (!dragOff) return;
    let x = e.clientX - dragOff.x, y = e.clientY - dragOff.y;
    x = Math.max(-win.offsetWidth + 80, Math.min(x, window.innerWidth - 80));
    y = Math.max(0, Math.min(y, window.innerHeight - 40));
    win.style.left = x + "px"; win.style.top = y + "px";
  }
  function onDragEnd() {
    dragOff = null;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
  }
  function onResizeMove(e) {
    if (!resize) return;
    let w = Math.max(360, Math.min(window.innerWidth - 8, resize.w + (e.clientX - resize.x)));
    let h = Math.max(240, Math.min(window.innerHeight - 8, resize.h + (e.clientY - resize.y)));
    win.style.width = w + "px"; win.style.height = h + "px";
  }
  function onResizeEnd() {
    resize = null;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
  }
  function toggleMax() {
    if (!win.classList.contains("ar-maxed")) {
      lastNormal = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
      win.classList.add("ar-maxed");
    } else {
      win.classList.remove("ar-maxed");
      if (lastNormal) Object.assign(win.style, { left: lastNormal.l, top: lastNormal.t, width: lastNormal.w, height: lastNormal.h });
    }
  }

  function render(title, text) {
    if (!win) build();
    win._text = text;
    win.querySelector("#ar-title").textContent = title;
    win.querySelector("#ar-hint").textContent = "\u5df2\u8907\u88fd\u5230\u526a\u8cbc\u7c3f\u3002\u53ef\u5728\u4e0b\u65b9\u6efe\u52d5\u67e5\u770b\u5b8c\u6574 TEST CASE\uff0c\u518d\u8cbc\u56de OpenHands \u804a\u5929\u3002";
    win.querySelector("#ar-pre").innerHTML = arHlAssignText(text);
    win.style.display = "flex";
    win.style.width = "720px"; win.style.height = "72vh";
    win.style.left = "calc(50vw - 360px)"; win.style.top = "12vh";
    win.classList.remove("ar-maxed");
    win.querySelector(".ar-body").scrollTop = 0;
  }
  function close() { if (win) win.style.display = "none"; }
  return { render, close };
})();



// [AI AGENT 已停用] /* ---- 機器 AI Agent（單機）----
// [AI AGENT 已停用]    安全核心：LLM 永遠不直接執行動作；它只能提出「提案」，由使用者確認後才執行。
// [AI AGENT 已停用]    對話狀態存於閉包（每次重開 modal 重來一段 session）。 */
// [AI AGENT 已停用] const _agentSession = { messages: [], name: "", busy: false };
// [AI AGENT 已停用] const _AGENT_ACTION_LABEL = {
// [AI AGENT 已停用]   reboot: "Reboot（OS 重新開機）",
// [AI AGENT 已停用]   poweron: "開機（電源開啟）",
// [AI AGENT 已停用]   poweroff: "關機（電源關閉）",
// [AI AGENT 已停用]   aux: "AC cycle（完整斷電重上電）",
// [AI AGENT 已停用] };
// [AI AGENT 已停用] function openMachineAgent(name) {
// [AI AGENT 已停用]   _agentSession.messages = [];
// [AI AGENT 已停用]   _agentSession.name = name;
// [AI AGENT 已停用]   _agentSession.busy = false;
// [AI AGENT 已停用]   showDialog(`🤖 AI Agent — ${esc(name)}`, `
// [AI AGENT 已停用]     <div class="agent-modal-body">
// [AI AGENT 已停用]       <div class="agent-box" id="agent-box">
// [AI AGENT 已停用]         <div class="cop-msg ai">
// [AI AGENT 已停用]           <span class="cop-avatar ai">🤖</span>
// [AI AGENT 已停用]           <div class="cop-bubble ai">👋 我是這台機器的 AI Agent。你可以問我〈狀態 / 診斷〉，或請我〈重開機 / 開關機 / AC cycle〉。任何會改變狀態的操作，我會先提出提案，由你確認後才真的執行。</div>
// [AI AGENT 已停用]         </div>
// [AI AGENT 已停用]       </div>
// [AI AGENT 已停用]       <div class="agent-input">
// [AI AGENT 已停用]         <textarea id="agent-input" rows="1" placeholder="例如：幫我重開機 / 目前狀態？ / 幫我看一下診斷" autocomplete="off"></textarea>
// [AI AGENT 已停用]         <button class="btn primary" id="agent-send">➤</button>
// [AI AGENT 已停用]       </div>
// [AI AGENT 已停用]     </div>`,
// [AI AGENT 已停用]     [{ txt: "關閉", cls: "", fn: () => closeDialog() }]);
// [AI AGENT 已停用]   const inp = $("agent-input"), send = $("agent-send");
// [AI AGENT 已停用]   const doSend = () => agentSend();
// [AI AGENT 已停用]   inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); doSend(); } });
// [AI AGENT 已停用]   send.addEventListener("click", doSend);
// [AI AGENT 已停用] }
// [AI AGENT 已停用] async function agentSend() {
// [AI AGENT 已停用]   if (_agentSession.busy) return;
// [AI AGENT 已停用]   const inp = $("agent-input");
// [AI AGENT 已停用]   const text = (inp ? inp.value.trim() : "");
// [AI AGENT 已停用]   if (!text) return;
// [AI AGENT 已停用]   _agentSession.messages.push({ role: "user", content: text });
// [AI AGENT 已停用]   agentAppend("user", esc(text));
// [AI AGENT 已停用]   if (inp) { inp.value = ""; }
// [AI AGENT 已停用]   _agentSession.busy = true;
// [AI AGENT 已停用]   agentSetBusy(true);
// [AI AGENT 已停用]   agentTyping(true);
// [AI AGENT 已停用]   try {
// [AI AGENT 已停用]     const r = await api(`/api/machine/${encodeURIComponent(_agentSession.name)}/agent`, {
// [AI AGENT 已停用]       method: "POST", headers: { "Content-Type": "application/json" },
// [AI AGENT 已停用]       body: JSON.stringify({ messages: _agentSession.messages }),
// [AI AGENT 已停用]     });
// [AI AGENT 已停用]     if (r.proposal) {
// [AI AGENT 已停用]       _agentSession.messages.push({ role: "assistant", content: `提案：${r.proposal.reason}` });
// [AI AGENT 已停用]       agentAppend("ai", esc(`提案請求——請確認後才執行：`));
// [AI AGENT 已停用]       agentRenderProposal(r.proposal);
// [AI AGENT 已停用]     } else if (r.ok) {
// [AI AGENT 已停用]       _agentSession.messages.push({ role: "assistant", content: r.reply });
// [AI AGENT 已停用]       agentAppend("ai", esc(r.reply));
// [AI AGENT 已停用]       // 使用者若已要求操作但 LLM 用文字回應沒走 propose_action → 提醒需明確指令
// [AI AGENT 已停用]       if (/(重開機|開機|關機|ac cycle|電源|重新啟動)/i.test(r.reply) && !r.reply.includes("提案")) {
// [AI AGENT 已停用]         agentAppend("ai", '<div class="cop-bubble ai' + '" style="color:var(--amber)">提示：若你要我執行開關機/重開機，請直接說「幫我重開機」等，我會提出提案待你確認。</div>');
// [AI AGENT 已停用]       }
// [AI AGENT 已停用]     } else {
// [AI AGENT 已停用]       agentAppend("ai", `⨠ ${esc(r.error || "呼叫失敗")}`);
// [AI AGENT 已停用]     }
// [AI AGENT 已停用]     agentTyping(false);
// [AI AGENT 已停用]   } catch (e) {
// [AI AGENT 已停用]     agentTyping(false);
// [AI AGENT 已停用]     agentAppend("ai", `⨠ ${esc("無法連線到後端：" + e.message)}`);
// [AI AGENT 已停用]     if (/無法連線|Failed|fetch/i.test(e.message)) {
// [AI AGENT 已停用]       // 可能是 AI 忙碌或連線中斷，提示可重試
// [AI AGENT 已停用]     }
// [AI AGENT 已停用]   } finally {
// [AI AGENT 已停用]     _agentSession.busy = false;
// [AI AGENT 已停用]     agentSetBusy(false);
// [AI AGENT 已停用]   }
// [AI AGENT 已停用] }
// [AI AGENT 已停用] function agentAppend(role, html) {
// [AI AGENT 已停用]   const box = $("agent-box");
// [AI AGENT 已停用]   if (!box) return;
// [AI AGENT 已停用]   box.insertAdjacentHTML("beforeend", `<div class="cop-msg ${role}">
// [AI AGENT 已停用]     <span class="cop-avatar ${role}">${role === "user" ? "🧑" : "🤖"}</span>
// [AI AGENT 已停用]     <div class="cop-bubble ${role}">${html}</div>
// [AI AGENT 已停用]   </div>`);
// [AI AGENT 已停用]   box.scrollTop = box.scrollHeight;
// [AI AGENT 已停用] }
// [AI AGENT 已停用] function agentTyping(on) {
// [AI AGENT 已停用]   const box = $("agent-box");
// [AI AGENT 已停用]   if (!box) return;
// [AI AGENT 已停用]   let t = $("agent-typing");
// [AI AGENT 已停用]   if (on) {
// [AI AGENT 已停用]     if (t) return;
// [AI AGENT 已停用]     box.insertAdjacentHTML("beforeend", `<div class="cop-msg ai" id="agent-typing">
// [AI AGENT 已停用]       <span class="cop-avatar ai">🤖</span><div class="cop-bubble ai typing">正在思考…</div></div>`);
// [AI AGENT 已停用]   } else if (t) { t.remove(); }
// [AI AGENT 已停用]   box.scrollTop = box.scrollHeight;
// [AI AGENT 已停用] }
// [AI AGENT 已停用] function agentSetBusy(bool) {
// [AI AGENT 已停用]   const send = $("agent-send");
// [AI AGENT 已停用]   const inp = $("agent-input");
// [AI AGENT 已停用]   if (send) { send.disabled = bool; send.textContent = bool ? "…" : "➤"; }
// [AI AGENT 已停用]   if (inp) { inp.disabled = bool; }
// [AI AGENT 已停用] }
// [AI AGENT 已停用] // 呈現「提案確認卡」：執行／取消。執行才呼叫 /agent-execute（同既有按鈕權限）。
// [AI AGENT 已停用] function agentRenderProposal(p) {
// [AI AGENT 已停用]   const label = _AGENT_ACTION_LABEL[p.action] || p.action;
// [AI AGENT 已停用]   const box = $("agent-box");
// [AI AGENT 已停用]   if (!box) return;
// [AI AGENT 已停用]   box.insertAdjacentHTML("beforeend", `
// [AI AGENT 已停用]     <div class="cop-msg ai">
// [AI AGENT 已停用]       <span class="cop-avatar ai">🤖</span>
// [AI AGENT 已停用]       <div class="cop-bubble ai" style="border:1px solid var(--amber);background:color-mix(in srgb,var(--amber) 10%, transparent)">
// [AI AGENT 已停用]         <div style="font-weight:600;color:var(--amber);margin-bottom:6px">⚠️ 提案確認</div>
// [AI AGENT 已停用]         <div>動作：<b>${esc(label)}</b></div>
// [AI AGENT 已停用]         <div style="margin-top:4px;color:var(--text-dim)">原因：${esc(p.reason || "（無說明）")}</div>
// [AI AGENT 已停用]         <div style="margin-top:10px;display:flex;gap:8px">
// [AI AGENT 已停用]           <button class="btn primary" onclick="agentExecute('${esc(p.action)}','${esc(p.reason||"")}')">✅ 確認執行</button>
// [AI AGENT 已停用]           <button class="btn" onclick="agentDecline()">取消</button>
// [AI AGENT 已停用]         </div>
// [AI AGENT 已停用]       </div>
// [AI AGENT 已停用]     </div>`);
// [AI AGENT 已停用]   box.scrollTop = box.scrollHeight;
// [AI AGENT 已停用]   // 把提案記錄到 session，供執行後回填結果
// [AI AGENT 已停用]   _agentSession.pending = p;
// [AI AGENT 已停用] }
// [AI AGENT 已停用] async function agentExecute(action, reason) {
// [AI AGENT 已停用]   if (!_agentSession.pending || _agentSession.pending.action !== action) return;
// [AI AGENT 已停用]   const name = _agentSession.name;
// [AI AGENT 已停用]   const confirmOk = confirm(`確定要對「${name}」執行「${(_AGENT_ACTION_LABEL[action]||action)}」嗎？`);
// [AI AGENT 已停用]   if (!confirmOk) return;
// [AI AGENT 已停用]   const btn = document.querySelector('#agent-box .btn.primary');
// [AI AGENT 已停用]   if (btn) { btn.disabled = true; btn.textContent = "執行中…"; }
// [AI AGENT 已停用]   try {
// [AI AGENT 已停用]     const r = await api(`/api/machine/${encodeURIComponent(name)}/agent-execute`, {
// [AI AGENT 已停用]       method: "POST", headers: { "Content-Type": "application/json" },
// [AI AGENT 已停用]       body: JSON.stringify({ action }),
// [AI AGENT 已停用]     });
// [AI AGENT 已停用]     const okText = (action === "reboot" ? "已送出 reboot" : action === "aux" ? "AC cycle 已送出" : action === "poweron" ? "已開機" : "已關機");
// [AI AGENT 已停用]     agentAppend("ai", r.ok
// [AI AGENT 已停用]       ? `✅ <b>${okText}</b><br><span class="hint">${esc(r.info || "")}</span>`
// [AI AGENT 已停用]       : `❌ 操作失敗：${esc(r.info || "")}`);
// [AI AGENT 已停用]     _agentSession.pending = null;
// [AI AGENT 已停用]     // 執行成功後重新載入詳情，讓狀態燈更新
// [AI AGENT 已停用]     machineLoadDetail(name).catch(() => {});
// [AI AGENT 已停用]   } catch (e) {
// [AI AGENT 已停用]     agentAppend("ai", `❌ ${esc("操作失敗：" + e.message)}`);
// [AI AGENT 已停用]     if (btn) { btn.disabled = false; btn.textContent = "確認執行"; }
// [AI AGENT 已停用]   }
// [AI AGENT 已停用] }
// [AI AGENT 已停用] function agentDecline() {
// [AI AGENT 已停用]   _agentSession.pending = null;
// [AI AGENT 已停用]   agentAppend("ai", '已取消，未執行任何動作。');
// [AI AGENT 已停用] }
/* ---------- 新增系統 ---------- */
// 專案是否「只允許該層級」：純 L10 專案不進 L11 下拉、純 L11 專案不進 L10 下拉；
// 空專案 / 混合專案 / 未標 level 的專案都放行（避免鎖死後續加機）。
function projectAllowsLevel(pname, lv) {
  const p = projects.find(x => x.name === pname);
  const members = projectMembers(pname);
  if (!p || (p.level !== "rack" && p.level !== "system")) {
    const hasL10 = members.some(m => !isRackItem(m));
    const hasL11 = members.some(m => isRackItem(m));
    if (lv === "rack" && hasL10 && !hasL11) return false;     // 純 L10 專案：擋 L11
    if (lv === "system" && hasL11 && !hasL10) return false;    // 純 L11 專案：擋 L10
    return true;                                                // 空 / 混合 / 未標 level：放行
  }
  return p.level === lv;
}
function projectsForLevel(lv) { return projects.filter(p => projectAllowsLevel(p.name, lv)); }
async function fillProjectSelect(selId, lv) {
  const sel = $(selId);
  if (!sel) return;
  const cur = sel.value;
  const list = lv ? projectsForLevel(lv) : projects;
  sel.innerHTML = `<option value="">— 未分類 —</option>` +
    list.map(p => `<option value="${esc(p.name)}">${esc(p.name)}${p.level ? `（${p.level === "rack" ? "L11" : "L10"}）` : ""}</option>`).join("");
  sel.value = cur;
}
function onAddLevelChange() {
  // L11 new: do not ask rack size here; the U-slot is picked (and editable) at mount time.
  const wrap = $("f-rack-size-wrap");
  if (wrap) wrap.style.display = "none";
}
function openAdd(lockedLevel) {
  // 需求：L10 分頁只能加 L10，L11 分頁只能加 L11（依目前分頁鎖定層級）
  const locked = lockedLevel || (projectLevelFilter.val === "rack" ? "rack" : "system");
  const lvlSel = $("f-level");
  lvlSel.value = locked;
  lvlSel.disabled = !!locked;   // 從 System Manager 分頁進來就鎖死層級，不能切換
  if (locked) onAddLevelChange();   // L11 時顯示「必選 U 數」
  // L10 分頁只能選 L10 專案（純 L11 專案被擋掉）、L11 分頁反之。
  fillProjectSelect("f-project", locked);
  resetBmcProbe();
  $("add-modal").style.display = "flex";
  $("add-err").style.display = "none";
  $("save-btn").disabled = false;
  $("save-btn").textContent = "儲存並測試連線";
}
function closeAdd() { $("add-modal").style.display = "none"; }
function showErr(msg) {
  const e = $("add-err");
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";   // 沒有錯誤訊息就不顯示紅框
}
// 依 OS 資訊探測：抓 hostname 並用 OS 本機 ipmitool lan print 自動帶入 BMC IP
async function probeBmc() {
  const btn = $("probe-bmc-btn");
  const dot = $("probe-bmc-dot");
  const os_ip = $("f-os-ip").value.trim();
  const os_user = $("f-os-user").value.trim();
  const os_pass = $("f-os-pass").value;
  if (!os_ip || !os_user || !os_pass) { showErr("請先填 OS IP、SSH 帳號跟密碼，再抓取 BMC IP"); return; }
  const msg = $("probe-bmc-msg");
  btn.disabled = true; btn.textContent = "🔍 抓取中…"; showErr("");
  if (dot) { dot.className = "dot-sm scan"; }
  if (msg) { msg.className = ""; msg.textContent = ""; }
  try {
    const d = await api("/api/machines/probe-bmc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ os_ip, os_user, os_pass, os_port: parseInt($("f-os-port").value) || 22 }),
    });
    if (d.ok) {
      $("f-bmc-ip").value = d.bmc_ip;
      if (dot) { dot.className = "dot-sm ok"; }
      if (msg) { msg.className = "ok"; msg.textContent = "✅ BMC IP 掃描成功：" + d.bmc_ip; }
      showErr(""); // 成功：BMC IP 已自動帶入（反灰欄位）
    } else {
      if (dot) { dot.className = "dot-sm fail"; }
      if (msg) { msg.className = "err"; msg.textContent = "⚠︎ BMC IP 掃描失敗"; }
      if (d.ipmitool_ok === false) {
        alert("⚠️ 無法自動抓取 BMC IP：\nOS 內未偵測到 ipmitool。\n\n請先在該主機安裝 ipmitool（例如 apt-get install ipmitool），之後再重新抓取。");
      } else {
        alert("⚠️ 抓取 BMC IP 失敗：\n" + (d.error || "未知錯誤"));
      }
    }
  } catch (e) {
    if (dot) { dot.className = "dot-sm fail"; }
    if (msg) { msg.className = "err"; msg.textContent = "⚠︎ BMC IP 掃描失敗：" + e.message; }
    alert("⚠️ 抓取 BMC IP 失敗：\n" + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "🔍 依 OS 抓取 BMC IP（需 ipmitool）";
  }
}
// 開啟新增系統表單時重設 BMC IP（避免殘留上次的）
function resetBmcProbe() {
  const f = $("f-bmc-ip");
  if (f) f.value = "";
}
async function saveMachine() {
  const body = {
    os_ip: $("f-os-ip").value.trim(),
    os_user: $("f-os-user").value.trim(),
    os_pass: $("f-os-pass").value,
    os_port: parseInt($("f-os-port").value) || 22,
    bmc_ip: $("f-bmc-ip").value.trim(),
    bmc_user: $("f-bmc-user").value.trim(),
    bmc_pass: $("f-bmc-pass").value,
    project: $("f-project").value,
    level: $("f-level").value == "rack" ? "rack" : "system",
    rack_size: ($("f-level").value == "rack" && $("f-rack-size")) ? (parseInt($("f-rack-size").value) || 1) : undefined,
  };
  if (!body.os_ip || !body.os_user || !body.os_pass) { showErr("請填 OS IP、SSH 帳號跟密碼"); return; }
  if (body.level === "system") {
    if (!body.bmc_user || !body.bmc_pass) { showErr("BMC 帳號和密碼為必填（供開關機/遠端管理用）— 欄位已標示紅色 *。"); return; }
  } else if (body.bmc_ip && (!body.bmc_user || !body.bmc_pass)) { showErr("有填 BMC IP 時，BMC 帳號和密碼為必填。"); return; }
  if (!body.project) { showErr("請選擇專案（沒有案子的請先開專案分類）"); return; }
  const btn = $("save-btn");
  btn.disabled = true; btn.textContent = "連線中…"; showErr("");
  try {
    const data = await api("/api/machines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const name = data.machine.name;
    await Promise.all([loadMachines(), loadProjects()]);
    closeAdd(); setView(state.view);
    alert("✅ 系統已新增：hostname = " + name + "\n層級 = " + (body.level === "rack" ? "L11 Rack" : "L10 System"));
  } catch (e) {
    showErr("新增失敗：\n" + e.message);
    btn.disabled = false; btn.textContent = "儲存並測試連線";
  }
}
/* ---------- 刪除 ---------- */
function deleteMachine(name) {
  if (!confirm("確定要刪除系統 " + name + " 嗎？")) return;
  fetch("/api/machines/" + encodeURIComponent(name), { method: "DELETE" })
    .then(() => {
      // 立即顯示：先本地移除，不整頁重整，只重繪目前視圖讓該格馬上消失
      machines = machines.filter(x => x.name !== name);
      setView(state.view);
    })
    .catch(e => alert("刪除失敗：" + e.message));
}
/* ---------- 機櫃移除（只拿下機櫃，保留 System Manager，即時顯示） ---------- */
async function rackUnmount(name) {
  if (!confirm("「" + name + "」要從機櫃拿掉嗎？\n（System Manager 的系統不會被刪除，只是取消機櫃 U 位置、仍維持 L11）")) return;
  try {
    await api("/api/machines/" + encodeURIComponent(name), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rack_u: 0, rack_size: 1 })
    });
    // 即時顯示：本地同步 + 只重繪目前視圖（留在機櫃頁，不跳走、不整頁重整）
    const m = machines.find(x => x.name === name);
    if (m) { m.rack_u = 0; m.rack_size = 1; }
    setView("rack");
  } catch (e) { alert("移除失敗：" + e.message); }
}
/* ---------- 重新掃描（同步強制 ping 所有 OS + BMC + 健康度，返回最新真實值）---------- */
async function refreshStatus() {
  const btn = $("refresh-btn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ 掃描中…"; }
  try {
    const data = await api("/api/machines?force_scan=1");
    machines = data.machines || [];
    if (data.last_scan) window.__lastScan = data.last_scan;
    setView(state.view);
  }
  catch (e) { alert("重新掃描失敗：" + e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = "⟳ 重新掃描"; } }
}
/* ---------- 專案管理 ---------- */
function togglePw(id, btn) {
  const el = $(id);
  if (el.type === "password") { el.type = "text"; btn.textContent = "🷈"; }
  else { el.type = "password"; btn.textContent = "👁"; }
}
/* ---------- 專案管理 ---------- */
function openProjectModal() {
  resetProjectForm();
  renderProjectList();
  $("project-err").style.display = "none";
  $("project-modal").style.display = "flex";
}
function closeProjectModal() { resetProjectForm(); $("project-modal").style.display = "none"; }
const LEVELS = { system: "L10 · System", rack: "L11 · Rack" };
function renderProjectList() {
  $("project-list-body").innerHTML = projects.map(p => {
    const canDelete = p.machine_count === 0;
    const racks = machines.filter(m => m.project === p.name && isRackItem(m)).length;
    const systems = machines.filter(m => m.project === p.name && !isRackItem(m)).length;
    return `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.desc || "")}</td><td>${p.machine_count}（R${racks}/S${systems}）</td>
      <td style="white-space:nowrap">
        <button class="btn small" data-cycle-project="${encodeURIComponent(p.name)}">Cycle Test</button>
        <button class="btn small" onclick="editProjectStart('${esc(p.name)}')">翮改</button>
        <button class="btn small${canDelete ? "" : " disabled"}" title="${canDelete ? "刪除" : "此專案還有機台，無法刪除"}" ${canDelete ? `onclick="deleteProject('${esc(p.name)}')"` : "disabled"}>刪除</button>
      </td></tr>`;
  }).join("") || `<tr><td colspan="4" style="color:var(--text-faint)">還沒有專案，請先在線新增。</td></tr>`;
}
let editingProjectName = null;
function editProjectStart(name) {
  const proj = projects.find(p => p.name === name);
  if (!proj) return;
  editingProjectName = name;
  $("new-project-name").value = proj.name;
  $("new-project-desc").value = proj.desc || "";
  $("project-add-btn").textContent = "儲存修改";
  $("project-err").style.display = "none";
}
function resetProjectForm() {
  editingProjectName = null;
  $("new-project-name").value = "";
  $("new-project-desc").value = "";
  $("project-add-btn").textContent = "新增專案";
}
async function addProject() {
  const name = $("new-project-name").value.trim();
  const desc = $("new-project-desc").value.trim();
  const err = $("project-err");
  if (!name) { err.style.display = "block"; err.textContent = "請填專案名稱"; return; }
  err.style.display = "none";
  try {
    if (editingProjectName) {
      await api("/api/projects/" + encodeURIComponent(editingProjectName), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, desc }) });
      resetProjectForm();
    } else {
      await api("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, desc }) });
      resetProjectForm();
    }
    await Promise.all([loadProjects(), loadMachines()]);
    renderProjectList(); setView(state.view);
  } catch (e) {
    err.style.display = "block"; err.textContent = e.message;
  }
}
async function deleteProject(name) {
  if (!confirm("確定要刪除專案「" + name + "」嗎？")) return;
  const err = $("project-err");
  try {
    await api("/api/projects/" + encodeURIComponent(name), { method: "DELETE" });
    err.style.display = "none";
    await Promise.all([loadProjects(), loadMachines()]);
    renderProjectList(); setView(state.view);
  } catch (e) {
    err.style.display = "block"; err.textContent = e.message;
  }
}
/* ---------- 終端機（左右：左 OS / 右 BMC） ---------- */
let termInstances = null;
let termMode = "both";   // 'both' | 'os' | 'bmc'：終端機視圖（並排 / 只 OS / 只 BMC）
// 把帳密資訊編進 URL 查詢（passive 元件點開時需動態填）
function _termUrl(name, kind, creds) {
  let u = `/ws/terminal/${encodeURIComponent(name)}/${kind}`;
  if (creds) {
    const p = new URLSearchParams({ host: creds.host || "", user: creds.user || "", pass: creds.pass || "", port: creds.port || "" });
    u += "?" + p.toString();
  }
  return u;
}
// 所有元件點「▶」都走這：有存量連線資訊直接開；沒有或 passive → 先請填帳密
function openTermDialog(name) {
  const m = machines.find(x => x.name === name);
  if (!m) return;
  const hasCreds = (m.os_ip && m.os_user && m.os_pass) || (m.bmc_ip && m.bmc_user && m.bmc_pass);
  const hasOs = m.os_ip && m.os_user && m.os_pass;
  const hasBmc = m.bmc_ip && m.bmc_user && m.bmc_pass;

  const osPrefillHost = m.os_ip || "";
  const bmcPrefillHost = m.bmc_ip || "";
  const kinds = [];
  if (hasOs) kinds.push("os");
  if (hasBmc) kinds.push("bmc");
  if (!kinds.length) kinds.push("os");   // passive 未知 → 預設 OS

  let osFields = hasOs
    ? `<span class="hint">將直接使用元件已存的 OS 帳密連線</span>`
    : `
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">OS Host</label>
      <input class="input" id="td-os-host" style="width:100%;padding:8px" value="${esc(osPrefillHost)}" placeholder="ssh host / ip">
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">OS 帳號</label>
      <input class="input" id="td-os-user" style="width:100%;padding:8px" placeholder="root">
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">OS 密碼</label>
      <input class="input" id="td-os-pass" type="password" style="width:100%;padding:8px" placeholder="••••">`;
  let bmcFields = hasBmc
    ? `<span class="hint">將直接使用元件已存的 BMC 帳密連線</span>`
    : `
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">BMC/IPMI Host</label>
      <input class="input" id="td-bmc-host" style="width:100%;padding:8px" value="${esc(bmcPrefillHost)}" placeholder="bmc host / ip">
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">BMC 帳號</label>
      <input class="input" id="td-bmc-user" style="width:100%;padding:8px" placeholder="admin">
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">BMC 密碼</label>
      <input class="input" id="td-bmc-pass" type="password" style="width:100%;padding:8px" placeholder="••••">`;

  showDialog(`◈ 終端機 — ${esc(name)}`, `
    <div class="rm-modal-body">
      <p style="font-size:12px;color:var(--text-faint);margin-bottom:8px">
        此元件 ${hasCreds ? "已存有連線資訊（直接使用）" : "沒有已存的連線帳密，請填一下要連到哪台（OS 與 BMC 擇一即可）"}。
      </p>
      <div style="margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;margin:10px 0 2px">🖥 OS <span class="hint">（作業系統 / shell）</span></div>
        ${osFields}
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;margin:10px 0 2px">🌐 BMC / IPMI <span class="hint">（BMC shell / ipmitool）</span></div>
        ${bmcFields}
      </div>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "連接終端", cls: "primary", fn: () => {
        const osCreds = hasOs ? null : {
          host: ($("td-os-host") && $("td-os-host").value.trim()) || m.os_ip || "",
          user: ($("td-os-user") && $("td-os-user").value.trim()) || "",
          pass: ($("td-os-pass") && $("td-os-pass").value) || "",
          port: m.os_port || 22,
        };
        const bmcCreds = hasBmc ? null : {
          host: ($("td-bmc-host") && $("td-bmc-host").value.trim()) || m.bmc_ip || "",
          user: ($("td-bmc-user") && $("td-bmc-user").value.trim()) || "",
          pass: ($("td-bmc-pass") && $("td-bmc-pass").value) || "",
          port: m.bmc_port || 623,
        };
        // 至少要有一組有效 creds
        const osOK = hasOs || (osCreds.host && osCreds.user && osCreds.pass);
        const bmcOK = hasBmc || (bmcCreds.host && bmcCreds.user && bmcCreds.pass);
        if (!osOK && !bmcOK) { alert("請至少填一組 OS 或 BMC 的 host／帳號／密碼"); return; }
        closeDialog();
        openTermAt(name, hasOs ? { host: m.os_ip, user: m.os_user, pass: m.os_pass, port: m.os_port || 22 } : (osOK ? osCreds : null),
                  hasBmc ? { host: m.bmc_ip, user: m.bmc_user, pass: m.bmc_pass, port: m.bmc_port || 623 } : (bmcOK ? bmcCreds : null));
      } },
    ]);
}
// 用指定的 os/bmc creds 開起終端窗
function openTermAt(name, osCreds, bmcCreds) {
  const showOs = !!(osCreds && osCreds.host && osCreds.user && osCreds.pass);
  const showBmc = !!(bmcCreds && bmcCreds.host && bmcCreds.user && bmcCreds.pass);
  $("term-title").innerHTML = `<span class="grip">▦</span> 終端機 — ${esc(name)}`;
  resetTermGeometry();
  $("term-os-status").innerHTML = `OS <span class="term-badge warn">連線中</span>`;
  $("term-bmc-status").innerHTML = `BMC <span class="term-badge warn">連線中</span>`;
  // 有商品(creds)的 pane 完全由 termMode (CSS state class) 控制；不存在的 pane 用 inline display:none 強制隱藏
  $("term-os-pane").style.display = showOs ? "" : "none";
  $("term-bmc-pane").style.display = showBmc ? "" : "none";
  $("term-modal").style.display = "flex";
  setupTermPane("term-os");
  setupTermPane("term-bmc");
  termInstances = {};
  if (showOs) termInstances.os = new Term("term-os", _termUrl(name, "os", osCreds), "term-os-status");
  if (showBmc) termInstances.bmc = new Term("term-bmc", _termUrl(name, "bmc", bmcCreds), "term-bmc-status");
  Object.values(termInstances).forEach(t => t.connect());
  setTermMode("both");   // 一開啟預設並排，並依商品可用性致能按鈕
  requestAnimationFrame(() => fitAll());
}
// 切換終端機視圖：'both' 並排 / 'os' 單獨放大 / 'bmc' 單獨放大
function setTermMode(mode) {
  const box = $("term-modal-box");
  const hasOs = !!termInstances?.os && $("term-os-pane").style.display !== "none";
  const hasBmc = !!termInstances?.bmc && $("term-bmc-pane").style.display !== "none";
  // 指定 mode 不可用時自動回退到可用的
  let m = mode;
  if (m === "os" && !hasOs) m = hasBmc ? "bmc" : "both";
  if (m === "bmc" && !hasBmc) m = hasOs ? "os" : "both";
  if (m === "both" && !hasOs && !hasBmc) m = "both";
  termMode = m;
  if (box) {
    box.classList.remove("term-state-both", "term-state-os", "term-state-bmc");
    box.classList.add("term-state-" + (m === "both" ? "both" : m));
  }
  ["both", "os", "bmc"].forEach(k => {
    const b = $("term-mode-" + k);
    if (!b) return;
    b.classList.toggle("active", k === m);
    if (k === "os") b.disabled = !hasOs;
    if (k === "bmc") b.disabled = !hasBmc;
  });
  requestAnimationFrame(() => fitAll());
}
// 原本的 openTerm：使用已存帳密（有 os+bmc 連兩窗；沒有就帶 creds 為空）
function openTerm(name) {
  const m = machines.find(x => x.name === name);
  if (!m) return;
  openTermAt(name,
    (m.os_ip && m.os_user && m.os_pass) ? { host: m.os_ip, user: m.os_user, pass: m.os_pass, port: m.os_port || 22 } : null,
    (m.bmc_ip && m.bmc_user && m.bmc_pass) ? { host: m.bmc_ip, user: m.bmc_user, pass: m.bmc_pass, port: m.bmc_port || 623 } : null);
}
// ⚙ 設定：變更 OS IP / BMC IP（各自獨立，未更動的欄位後端不會動）。
// OS IP 需 ping 通 + hostname 相符；BMC IP 只要 ping 通即可。
function changeOsIp(name) {
  const m = machines.find(x => x.name === name);
  if (!m) return;
  const curOs = m.os_ip || "";
  const curBmc = m.bmc_ip || "";
  showDialog(`⚙ 設定 — ${esc(name)}`, `
    <div class="rm-modal-body">
      <p style="font-size:12px;color:var(--text-faint);margin-bottom:8px">
        變更此機台的 IP。填了新的才會改、與原值相同會跳過。<br>
        <b>OS IP</b>：ping 得通 + SSH 抓到的 hostname 與機台名稱相同才受理。<br>
        <b>BMC IP</b>：ping 得通即可受理。
      </p>
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">OS IP</label>
      <input class="input" id="new-os-ip-input" style="width:100%;padding:8px;font-family:monospace" value="${esc(curOs)}" placeholder="例如 INTERNAL_IP_10">
      <label style="display:block;font-size:12px;color:var(--text-faint);margin:8px 0 4px">BMC IP</label>
      <input class="input" id="new-bmc-ip-input" style="width:100%;padding:8px;font-family:monospace" value="${esc(curBmc)}" placeholder="例如 INTERNAL_IP_11">
      <div id="osip-msg" style="margin-top:10px;font-size:12px;white-space:pre-line"></div>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "變更 IP", cls: "primary", id: "ip-submit-btn", fn: () => submitChangeOsIp(name) },
    ]);
}
function _ipSetBusy(busy) { const btn = $("ip-submit-btn"); if (btn) { btn.disabled = busy; btn.textContent = busy ? "變更中…" : "變更 IP"; } }
function _ipSetDone() {
  // 結果已顯示在下方的 osip-msg：把按鈕換成「知道了」，按下才關窗並重新載入清單
  const foot = $("rm-dialog-foot");
  if (foot) {
    foot.innerHTML = "";
    const ok = document.createElement("button");
    ok.textContent = "知道了"; ok.className = "btn primary";
    ok.onclick = () => { closeDialog(); loadMachines().then(() => setView(state.view)); };
    foot.appendChild(ok);
  }
}
async function submitChangeOsIp(name) {
  const msgEl = $("osip-msg");
  const ip = $("new-os-ip-input") ? $("new-os-ip-input").value.trim() : "";
  const bmcIp = $("new-bmc-ip-input") ? $("new-bmc-ip-input").value.trim() : "";
  if (!ip && !bmcIp) { msgEl.textContent = "OS IP 跟 BMC IP 至少填一個"; msgEl.style.color = "var(--red)"; return; }
  const results = [];
  const failed = [];
  _ipSetBusy(true);
  try {
    if (ip) {
      const d = await api(`/api/machines/${encodeURIComponent(name)}/change-os-ip`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_os_ip: ip }) });
      results.push(`OS IP：${d.msg || (d.changed === false ? "與原本相同，未變更。" : "變更成功。")}`);
      if (d.ok === false) failed.push("OS IP");
    }
    if (bmcIp) {
      const d = await api(`/api/machines/${encodeURIComponent(name)}/change-bmc-ip`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_bmc_ip: bmcIp }) });
      results.push(`BMC IP：${d.msg || (d.changed === false ? "與原本相同，未變更。" : "變更成功。")}`);
      if (d.ok === false) failed.push("BMC IP");
    }
    // 成功/失敗結果都留在窗口內顯示，按「知道了」才關窗並重新載入清單
    msgEl.textContent = (failed.length ? "⚠️ " : "✅ ") + results.join("\n");
    msgEl.style.color = failed.length ? "var(--amber)" : "var(--green)";
    _ipSetDone();
  } catch (e) {
    if (results.length) msgEl.textContent = results.join("\n") + "\n";
    msgEl.textContent += "❌ " + e.message;
    msgEl.style.color = "var(--red)";
    _ipSetBusy(false);   // 失敗保持原按鈕，可改值重試
  }
}
function setupTermPane(id) { $(id).innerHTML = ""; }
function fitAll() {
  Object.values(termInstances || {}).forEach(t => t.fit());
}
function resetTermGeometry() {
  const box = $("term-modal-box");
  if (!box) return;
  box.classList.remove("maximized");
  box.style.left = ""; box.style.top = ""; box.style.transform = "";
}

/* ===== 廣播終端（同時控制多台 rack 系統 OS shell；Clusterssh 風格 fan-out） ===== */
const bcState = { ws: null, order: [], terms: {}, stat: {}, active: null, broadcast: true };

function rackBroadcastDialog(project) {
  // 只列出該機櫃專案中「有 OS 連線資訊」的系統
  const cands = machines.filter(m => m.project === project && m.level === "rack" && m.os_ip);
  if (!cands.length) {
    const anyCands = machines.filter(m => m.level === "rack" && m.os_ip);
    if (anyCands.length) {
      showDialog("廣播終端", `<div class="empty">目前機櫃專案「${esc(project)}」沒有可連線的系統。\n有 OS 連線資訊的機櫃機台：${esc(anyCands.map(m=>m.name).join("、"))}</div>`);
    } else {
      showDialog("廣播終端", `<div class="empty">目前沒有任何帶 OS 連線資訊的機櫃機台可用。</div>`);
    }
    return;
  }
  const rows = cands.map(m =>
    `<label class="bc-check" style="display:block;padding:7px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer">
       <input type="checkbox" class="bc-chk" value="${esc(m.name)}" checked>
       <b>${esc(m.name)}</b> <span class="mono" style="color:var(--text-dim)">${esc(m.os_ip)}</span>
     </label>`).join("");
  showDialog("📡 廣播終端 — 選擇要同時控制的主機", `
    <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:10px">
      勾選要同步下指令的系統（同一次指令，會同時送到所有勾選的主機 OS shell）。
    </label>
    <div class="table-scroll" style="max-height:46vh;overflow:auto;margin-bottom:12px">${rows}</div>
    <div style="display:flex;gap:8px">
      <button class="btn small" onclick="bcSetAll(true)">☑ 全選</button>
      <button class="btn small" onclick="bcSetAll(false)">☐ 全不選</button>
      <span class="spacer"></span><span class="hint" id="bc-sel-count">已選 ${cands.length} 台</span>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "開啟廣播", cls: "primary", fn: () => {
        const sel = [...document.querySelectorAll(".bc-chk:checked")].map(x => x.value);
        closeDialog();
        if (!sel.length) { alert("請至少勾選一台主機。"); return; }
        openBroadcast(sel);
      } },
    ]);
}

// System Manager 的「📡 系統廣播」：依專案把帶 OS 的 L10 系統分組列出，勾選後開啟廣播。
function systemBroadcastDialog() {
  const cands = machines.filter(m => m.os_ip && !isRackItem(m));
  const anyCands = machines.filter(m => m.os_ip);
  if (!cands.length) {
    if (anyCands.length) {
      showDialog("📡 系統廣播", `<div class="empty">目前沒有帶 OS IP 的 L10 系統可廣播。\n有 OS 連線資訊的機台：<br>${esc(anyCands.map(m=>m.name).join("、"))}</div>`);
    } else {
      showDialog("📡 系統廣播", `<div class="empty">目前沒有任何帶 OS 連線資訊的系統可用。</div>`);
    }
    return;
  }
  // 依專案分組
  const groups = {};
  cands.forEach(m => { const p = m.project || "(未分類)"; (groups[p] = groups[p] || []).push(m); });
  const html = Object.entries(groups).map(([proj, list]) => `
    <div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <b>${esc(proj)}</b><span class="hint">${list.length} 台</span>
        <span style="margin-left:auto"><button class="btn small" onclick="systemBroadcastSetGroup('${esc(proj)}', true)">☑</button>
        <button class="btn small" onclick="systemBroadcastSetGroup('${esc(proj)}', false)">☐</button></span>
      </div>
      ${list.map(m => `<label class="bc-check" style="display:block;padding:6px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:4px;cursor:pointer">
         <input type="checkbox" class="bc-chk" value="${esc(m.name)}" data-proj="${esc(proj)}" checked>
         <b>${esc(m.name)}</b> <span class="mono" style="color:var(--text-dim)">${esc(m.os_ip)}</span>
       </label>`).join("")}
    </div>`).join("");

  showDialog("📡 系統廣播 — 依專案選擇要同時控制的主機", `
    <label style="display:block;font-size:12px;color:var(--text-faint);margin-bottom:10px">
      勾選要同步下指令的系統（一次指令同時送到所有勾選主機的 OS shell）。依專案分組。
    </label>
    <div class="table-scroll" style="max-height:52vh;overflow:auto;margin-bottom:12px">${html}</div>
    <div style="display:flex;gap:8px">
      <button class="btn small" onclick="bcSetAll(true)">☑ 全選</button>
      <button class="btn small" onclick="bcSetAll(false)">☐ 全不選</button>
      <span class="spacer"></span><span class="hint">已選 <span id="bc-sel-count">${cands.length}</span> 台</span>
    </div>`,
    [
      { txt: "取消", cls: "", fn: () => closeDialog() },
      { txt: "開啟廣播", cls: "primary", fn: () => {
        const sel = [...document.querySelectorAll(".bc-chk:checked")].map(x => x.value);
        closeDialog();
        if (!sel.length) { alert("請至少勾選一台主機。"); return; }
        openBroadcast(sel);
      } },
    ]);
  // 即時更新「已選 N 台」
  const upd = () => { const el = $("bc-sel-count"); if (el) el.textContent = document.querySelectorAll(".bc-chk:checked").length; };
  document.querySelectorAll(".bc-chk").forEach(c => c.addEventListener("change", upd));
}
// 依專案整組勾選/取消勾選（System Manager 系統廣播的專案分組用）
function systemBroadcastSetGroup(proj, on) {
  document.querySelectorAll(".bc-chk").forEach(c => { if (c.dataset.proj === proj) c.checked = on; });
  const el = $("bc-sel-count"); if (el) el.textContent = document.querySelectorAll(".bc-chk:checked").length;
}

function bcSetAll(v) {
  document.querySelectorAll(".bc-chk").forEach(c => c.checked = v);
  const n = document.querySelectorAll(".bc-chk:checked").length;
  const el = $("bc-sel-count"); if (el) el.textContent = `已選 ${n} 台`;
}

// 指令歷史（bc-hlog）：開啟廣播時清空，送出指令時記錄「時間 + 指令」（不列目標主機，避免控多台時列表爆掉）
function bcInitLog() {
  const h = $("bc-hlog"); if (!h) return;
  h.innerHTML = `<div class="bc-hlog-empty">（尚未送出指令）</div>`;
}
function bcLog(cmd) {
  const h = $("bc-hlog"); if (!h) return;
  const empty = h.querySelector(".bc-hlog-empty"); if (empty) empty.remove();
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  const line = document.createElement("div");
  line.className = "bc-hlog-item";
  line.innerHTML = `<span class="bc-hlog-time">${ts}</span><span class="bc-hlog-cmd">${esc(cmd)}</span>`;
  h.appendChild(line);
  h.scrollTop = h.scrollHeight;
}

function openBroadcast(names) {
  // 重置狀態
  bcState.ws = null; bcState.order = names.slice(); bcState.terms = {}; bcState.stat = {}; bcState.ack = {}; bcState.active = names[0] || null;
  const tabsEl = $("bc-tabs"), panesEl = $("bc-panes");
  tabsEl.innerHTML = ""; panesEl.innerHTML = "";
  $("bc-title-hint").textContent = `${names.length} 台`;
  names.forEach(nm => {
    // tab
    const tab = document.createElement("div");
    tab.className = "bc-tab" + (nm === bcState.active ? " active" : "");
    tab.id = "bc-tab-" + nm;
    tab.innerHTML = `<span class="lamp none" id="lamp-${nm}"></span><span class="tname">${esc(nm)}</span><span class="bc-ack" id="bc-ack-${nm}"></span><span class="x" title="關閉此主機">✕</span>`;
    tab.querySelector(".tname").onclick = () => bcSelect(nm);
    tab.querySelector(".x").onclick = (e) => { e.stopPropagation(); bcCloseHost(nm); };
    tabsEl.appendChild(tab);
    // pane
    const pane = document.createElement("div");
    pane.className = "bc-pane" + (nm === bcState.active ? " active" : "");
    pane.id = "bc-pane-" + nm;
    pane.innerHTML = `<div class="bc-pane-label"><span>${esc(nm)}</span><span class="mono" style="color:var(--text-dim);font-size:10px">${esc((machines.find(m=>m.name===nm)||{}).os_ip||"")}</span></div><div class="bc-box" id="bc-box-${nm}"></div>`;
    panesEl.appendChild(pane);
    // xterm
    const t = new Terminal({ ...XTERM_COMMON });
    const fit = new FitAddon.FitAddon();
    t.loadAddon(fit);
    t.open($("bc-box-" + nm));
    try { fit.fit(); } catch {}
    t.onData(d => {
      if (!bcState.ws || bcState.ws.readyState !== 1) return;
      if (bcState.broadcast) bcState.ws.send(JSON.stringify({ type: "broadcast", data: d }));
      else bcState.ws.send(JSON.stringify({ type: "sendOne", name: nm, data: d }));
    });
    bcState.terms[nm] = { term: t, fit };
    bcState.stat[nm] = "wait";
  });
  bcInitLog();  // 開啟廣播時清除上一次的指令歷史
  $("bc-input").value = "";
  $("bc-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); bcSendInput(); } });
  $("bc-modal").style.display = "flex";
  setTimeout(() => bcFitAll(), 60);
  // 連線
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  bcState.ws = new WebSocket(proto + location.host + `/ws/rack-broadcast`);
  bcState.ws.onopen = () => { bcState.ws.send(JSON.stringify({ targets: names, kind: "os" })); bcStatus(`連接 ${names.length} 台…`); };
  bcState.ws.onmessage = e => { bcWsMsg(e.data); };
  bcState.ws.onclose = () => { bcStatus("已斷線"); bcSetAllLamp("err"); };
  bcState.ws.onerror = () => { bcStatus("連線錯誤"); };
  bcStatus(bcState.broadcast ? "廣播模式：指令列會送到全部主機" : "目前主機模式：只送到目前選取主機");
}

function bcStatus(txt) { const el = $("bc-status-txt"); if (el) el.textContent = txt; }

function bcSetAllLamp(state) {
  bcState.order.forEach(nm => { const l = $("lamp-" + nm); if (l) { l.className = "lamp " + (state || (bcState.stat[nm] || "none")); } });
}
function bcLamp(nm, st) { bcState.stat[nm] = st; const l = $("lamp-" + nm); if (l) l.className = "lamp " + st; }

function bcSelect(nm) {
  if (!bcState.order.includes(nm)) return;
  bcState.active = nm;
  bcState.order.forEach(n => {
    const tab = $("bc-tab-" + n), pane = $("bc-pane-" + n);
    if (tab) tab.classList.toggle("active", n === nm);
    if (pane) pane.classList.toggle("active", n === nm);
  });
  const t = bcState.terms[nm]; if (t) { try { t.fit.fit(); } catch {} bcFitOne(nm); }
  bcStatus(bcState.broadcast ? "廣播模式：指令列會送到全部主機；此窗顯示 " + nm : `目前主機：${nm}`);
}

function bcCloseHost(nm) {
  bcState.ws.send(JSON.stringify({ type: "closeOne", name: nm })); // 後端可忽略，前端直接關
  delete bcState.terms[nm]; delete bcState.stat[nm];
  bcState.order = bcState.order.filter(x => x !== nm);
  const t = $("bc-tab-" + nm), p = $("bc-pane-" + nm); if (t) t.remove(); if (p) p.remove();
  if (bcState.active === nm) bcState.active = bcState.order[0] || null;
  if (bcState.order.length === 0) closeBroadcast();
  else if (bcState.active) bcSelect(bcState.active);
}

function bcSetBroadcast(v) {
  bcState.broadcast = v;
  $("bc-bcast-on").classList.toggle("active", v);
  $("bc-bcast-off").classList.toggle("active", !v);
  bcStatus(v ? "廣播模式：指令列會送到全部主機" : "目前主機模式：只送到目前「" + (bcState.active||"") + "」");
}

function bcWsMsg(raw) {
  if (typeof raw === "string") {
    let j; try { j = JSON.parse(raw); } catch { return; }
    if (j.type === "ready") {
      bcStatus(`已就緒：${j.joined.length} 台`);
      j.joined.forEach(nm => bcLamp(nm, "on"));
      j.failed.forEach(nm => { bcLamp(nm, "err"); bcAppend(nm, "\r\n\x1b[31m[連線失敗]\x1b[0m\r\n"); });
    } else if (j.type === "out") {
      bcAppend(j.name, j.data);
    } else if (j.type === "closed") {
      bcLamp(j.name, "err");
    } else if (j.type === "error") {
      bcStatus(j.msg);
    }
  }
}

function bcAppend(nm, txt) {
  const t = bcState.terms[nm]; if (t && t.term) { try { t.term.write(txt); } catch {} }
  bcMarkAck(nm, "ok");   // 有輸出回來 = 該台確實收到指令
}

function bcFitAll() { Object.values(bcState.terms).forEach(t => { try { t.fit.fit(); } catch {} }); bcSendResize(); }
function bcFitOne(nm) { const t = bcState.terms[nm]; if (t) { try { t.fit.fit(); } catch {} } bcSendResize(); }
function bcSendResize() {
  if (!bcState.ws || bcState.ws.readyState !== 1) return;
  const t = bcState.terms[bcState.active]; if (!t) return;
  const d = t.fit.proposeDimensions(); if (!d) return;
  bcState.ws.send(JSON.stringify({ type: "resize", cols: d.cols, rows: d.rows }));
}

// 指令列：Enter 送出（廣播 or 目前主機）
function bcSendInput() {
  const inp = $("bc-input"); if (!inp) return;
  const cmd = inp.value; inp.value = "";
  if (!cmd || !bcState.ws || bcState.ws.readyState !== 1) return;
  const payload = cmd + "\r";
  const targets = bcState.broadcast
    ? bcState.order.filter(n => bcState.stat[n] === "on" || bcState.stat[n] === "wait")
    : (bcState.active ? [bcState.active] : []);
  if (bcState.broadcast) bcState.ws.send(JSON.stringify({ type: "broadcast", data: payload }));
  else if (bcState.active) bcState.ws.send(JSON.stringify({ type: "sendOne", name: bcState.active, data: payload }));
  // 📡 B：標記「已送出，等收確認」：廣播→所有已連線主機都亮「…」；單台→只亮該台
  targets.forEach(nm => bcMarkAck(nm, "send"));
    bcLog(cmd);  // 記錄到指令歷史（時間 + 指令，不含目標主機）
  bcStatus(`${esc(cmd)} → ${bcState.broadcast ? `廣播 ${targets.length} 台（等待確認）` : esc(bcState.active) + "（等待確認）"}`);
}

// 每台 tab 的「收到指令 ✓」燈號（send=送出待回 / ok=收到輸出）
function bcMarkAck(nm, state) {
  bcState.ack = bcState.ack || {};
  bcState.ack[nm] = state;
  const a = $("bc-ack-" + nm);
  if (a) {
    a.textContent = state === "ok" ? "✓" : state === "send" ? "…" : "";
    a.classList.toggle("ok", state === "ok");
    a.classList.toggle("send", state === "send");
  }
}

function closeBroadcast() {
  try { bcState.ws && bcState.ws.close(); } catch {}
  bcState.ws = null; bcState.order = []; bcState.terms = {}; bcState.stat = {}; bcState.active = null;
  $("bc-modal").style.display = "none";
}

let bcMax = false;
function toggleBcMaximize() {
  const box = $("bc-modal-box"), btn = $("bc-max-btn");
  if (!box) return;
  bcMax = !bcMax;
  box.classList.toggle("maximized", bcMax);
  btn.textContent = bcMax ? "🗗" : "⛶";
  setTimeout(bcFitAll, 60);
}

function resetBcGeometry() {
  const box = $("bc-modal-box"); if (!box) return;
  box.classList.remove("maximized"); box.style.left = ""; box.style.top = ""; box.style.transform = "";
}

// 終端機共用外觀（MobaXterm 風近黑深色 + 完整 16 色板 + 粗體/行距/實心光標）
// 單機 Term 與廣播 openBroadcast 都共用，保持一致。改這裡即可整體換色。
const XTERM_COMMON = {
  cursorBlink: true,
  cursorStyle: "block",
  fontSize: 13,
  fontFamily: '"Cascadia Mono","Consolas","Noto Sans Mono CJK TC","Noto Sans Mono",monospace',
  fontWeight: "400",
  fontWeightBold: "700",
  lineHeight: 1.25,
  letterSpacing: 0.6,
  scrollback: 2000,
  theme: {
    background: "#0c0c0c",
    foreground: "#d4d4d4",
    cursor: "#aeafad",
    cursorAccent: "#000000",
    selectionBackground: "#264f78",
    black: "#000000", red: "#cd3131", green: "#0dbc79", yellow: "#e5e510",
    blue: "#2472c8", magenta: "#bc3fbc", cyan: "#11a8cd", white: "#e5e5e5",
    brightBlack: "#666666", brightRed: "#f14c4c", brightGreen: "#23d18b", brightYellow: "#f5f543",
    brightBlue: "#3b8eea", brightMagenta: "#d670d6", brightCyan: "#29b8db", brightWhite: "#ffffff",
  },
};

class Term {

  constructor(containerId, url, statusId) {
    this.container = $(containerId); this.url = url; this.statusEl = $(statusId);
    this.term = null; this.ws = null; this.fitAddon = null;
  }
  connect() {
    if (!window.Terminal) { this.setStatus("終端未載入", "err"); return; }
    this.term = new Terminal({ ...XTERM_COMMON });
    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.container);
    this.fitAddon.fit();
    const proto = location.protocol === "https:" ? "wss://" : "ws://";
    this.ws = new WebSocket(proto + location.host + this.url);
    this.term.onData(d => { if (this.ws && this.ws.readyState === 1) this.ws.send(d); });
    this.ws.onopen = () => { this.setStatus("已連線", "ok"); this.sendResize(); };
    this.ws.onmessage = e => {
      if (e.data instanceof Blob) { e.data.arrayBuffer().then(buf => this.term.write(new Uint8Array(buf))); }
      else { try { const j = JSON.parse(e.data); if (j.type === "error") this.setStatus(j.msg, "err"); } catch { this.term.write(e.data); } }
    };
    this.ws.onclose = () => this.setStatus("已斷線", "err");
    this.ws.onerror = () => this.setStatus("連線錯誤", "err");
  }
  setStatus(text, cls) { if (this.statusEl) this.statusEl.innerHTML = `${this.url.includes("/bmc") ? "BMC" : "OS"} <span class="term-badge ${cls}">${esc(text)}</span>`; }
  fit() {
    if (!this.fitAddon || !this.term) return;
    try { this.fitAddon.fit(); } catch {}
    this.sendResize();
  }
  sendResize() {
    if (!this.fitAddon) return;
    const dims = this.fitAddon.proposeDimensions();
    if (dims && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
  }
}
function closeTerm() {
  [termInstances?.os, termInstances?.bmc].forEach(t => { try { t?.ws && t.ws.close(); } catch {} });
  termInstances = null;
  $("term-modal").style.display = "none";
}
function toggleTermMaximize() {
  const box = $("term-modal-box");
  if (!box) return;
  box.classList.toggle("maximized");
  box.style.left = ""; box.style.top = ""; box.style.transform = "";
  requestAnimationFrame(() => fitAll());
}
let dragState = null;
function initTermDrag() {
  const handle = $("term-head");
  const box = $("term-modal-box");
  if (!handle || !box) return;
  handle.addEventListener("mousedown", (e) => {
    if (box.classList.contains("maximized")) return;
    if (e.target.closest("button")) return;
    const r = box.getBoundingClientRect();
    dragState = { startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top };
    box.classList.add("dragging");
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    e.preventDefault();
  });
  function onDragMove(e) {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    box.style.left = (dragState.origX + dx) + "px";
    box.style.top = (dragState.origY + dy) + "px";
    box.style.transform = "none";
  }
  function onDragEnd() {
    dragState = null;
    box.classList.remove("dragging");
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    requestAnimationFrame(() => fitAll());
  }
}
let bcDragState = null;
function initBcDrag() {
  const handle = $("bc-head");
  const box = $("bc-modal-box");
  if (!handle || !box) return;
  handle.addEventListener("mousedown", (e) => {
    if (box.classList.contains("maximized")) return;
    if (e.target.closest("button")) return;
    const r = box.getBoundingClientRect();
    bcDragState = { startX: e.clientX, startY: e.clientY, origX: r.left, origY: r.top };
    box.classList.add("dragging");
    document.addEventListener("mousemove", onBcDragMove);
    document.addEventListener("mouseup", onBcDragEnd);
    e.preventDefault();
  });
  function onBcDragMove(e) {
    if (!bcDragState) return;
    box.style.left = (bcDragState.origX + (e.clientX - bcDragState.startX)) + "px";
    box.style.top = (bcDragState.origY + (e.clientY - bcDragState.startY)) + "px";
    box.style.transform = "none";
  }
  function onBcDragEnd() {
    bcDragState = null;
    box.classList.remove("dragging");
    document.removeEventListener("mousemove", onBcDragMove);
    document.removeEventListener("mouseup", onBcDragEnd);
    requestAnimationFrame(() => bcFitAll());
  }
}
/* ---------- GPU 熱度快訊（AI 主動告警） ---------- */
let _gpuAlerts = [];
async function gpuAlertPoll() {
  try {
    const r = await fetch("/api/ai/gpu-alerts");
    const d = await r.json();
    _gpuAlerts = Array.isArray(d.alerts) ? d.alerts : [];
  } catch (e) {
    _gpuAlerts = [];
  }
  paintGpuAlerts();
}
function paintGpuAlerts() {
  const ticker = $("gpu-alert-ticker");
  if (ticker) {
    ticker.innerHTML = _gpuAlerts.slice(0, 6).map(a =>
      `<span class="gpu-alert-badge" title="${esc(a.text || "")}">🔥 ${esc(a.machine)} GPU${a.gpu} ${a.kind === "high_temp" ? "高溫" : "高載"}</span>`
    ).join("");
  }
  const active = new Set(_gpuAlerts.map(a => a.machine));
  document.querySelectorAll("tr").forEach(tr => {
    const link = tr.querySelector("a.mach-link, a.mach-linkbox");
    if (!link) return;
    const name = (link.textContent || "").replace(/\s+/g, "");
    tr.classList.toggle("has-gpu-alert", active.has(name));
    const chip = tr.querySelector(".gpu-alert-chip");
    const hasChip = !!chip;
    if (active.has(name) && !hasChip) {
      link.insertAdjacentHTML("afterend", `<span class="gpu-alert-chip" title="GPU 高載/高溫快訊">🔥</span>`);
    } else if (!active.has(name) && hasChip) {
      chip.remove();
    }
  });
}

/* ---------- 啟動 ---------- */
function buildNav() {
  const nav = $("nav");
  let cur = null;
  NAV_ITEMS.forEach(it => {
    if (it.group !== cur) { cur = it.group; nav.insertAdjacentHTML("beforeend", `<div class="nav-group">${it.group}</div>`); }
    const b = document.createElement("button");
    b.className = "nav-btn"; b.dataset.view = it.id;
    b.innerHTML = `<span class="ico">${it.icon}</span><span>${esc(it.label)}</span>`;
    b.addEventListener("click", () => setView(it.id));
    nav.appendChild(b);
  });
}
$("theme-toggle")?.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark"));
window.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeAdd(); closeProjectModal(); } });
document.addEventListener("DOMContentLoaded", async () => {
  loadTheme(); buildNav(); initTermDrag(); initBcDrag();
  parseHash();                      // 讀取 URL hash，指定初始分頁
  window.addEventListener("resize", () => { fitAll(); bcFitAll(); });
  window.addEventListener("hashchange", () => { parseHash(); setView(state.view); });
  try {
    await Promise.all([loadMachines(), loadProjects()]);
    setView(state.view);
  } catch (e) {
    $("content").innerHTML = `<div class="empty">後端無法連線（${esc(e.message)}）<br>請確認有啟動 python 後端程式。</div>`;
  }
  gpuAlertPoll();
  setInterval(gpuAlertPoll, 20000);
});
