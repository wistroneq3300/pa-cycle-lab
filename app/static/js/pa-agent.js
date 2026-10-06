/* PA Agent 工作區（P3-e→P3-g）：把「執行指令視窗」升級為
   「Test Case + Agent Engineering Workspace」。

   設計目標：工程師進場後是在跟一位 PA Agent 一起處理這條 Test Case。
   左欄＝測試任務（Test Case context，來自既有 case 快照，不改資料語意）；
   右欄＝真正的 Agent 對話區（計畫、討論、跑前確認、執行結果）。

   後端契約（integration/agent_routes.py + agent_gateway.py）：
     1) POST /api/agent/runs
            { case_variant_id, node_id?, expected_binding_revision? }
            → { ok, run: { run_id, status:"PENDING", ... } }
     2) POST /api/agent/runs/{run_id}/start
            { auto_run?, workspace_dir?, user_note?, mode? }
            mode:"plan" → agent 先出計畫並等待工程師（不執行）
            mode:"execute"（預設）→ 相容舊行為，直接執行
        註：start 只在建立 conversation 時呼叫一次（gateway 以 conversation_ref 去重）。
     3) POST /api/agent/runs/{run_id}/messages
            { text } → 追加一則工程師發言，讓 agent 回覆（真正的多輪對話）
     4) GET  /api/agent/runs/{run_id}         → { ok, run }（status / final_result）
        GET  /api/agent/runs/{run_id}/messages?limit=N
            → { ok, messages: [{seq,role,kind,text,created_at}] }

   run.status 值域：PENDING / RUNNING / WAITING_FOR_USER（進行中）；
   DONE / ERROR（終態）。DONE＝agent 停止並產出記錄，**不是**測試通過；
   PASS/FAIL/BLOCKED 由工程師看 log 自行裁定，本系統不代為判定。

   命名空間：window.PA_Agent = { open, close }
*/
(() => {
  "use strict";
  const API = "/api/agent";
  const POLL_MS = 2000;
  const TERMINAL = new Set(["DONE", "ERROR", "PASS", "FAIL", "BLOCKED"]);

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- 安全 Markdown 渲染 ----------
  // agent 回覆常是 Markdown（粗體、表格、行內碼、清單）。直接 esc() 會讓 ** 與 |
  // 裸露，排版難看。這裡只把「已知安全」的語法轉成白名單標籤，其餘文字一律先
  // esc()，因此不會產生 XSS 注入點（僅產生我們自己組的 <strong>/<table>/…）。
  function renderInline(raw) {
    let s = esc(raw);
    // 行內碼 `code`（先處理，避免其內容被後續規則改動）
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    // 連結 [text](http...) — 只允許 http/https
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    // 粗體 **x** / 斜體 *x*
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    // 還原行內碼
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
    return s;
  }

  // 將 Markdown 表格區塊（連續以 | 開頭的列）轉成 <table>。
  function renderTable(lines) {
    const rows = lines.map(l => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim()));
    if (rows.length >= 2 && rows[1].every(c => /^:?-{2,}:?$/.test(c))) {
      const head = rows[0];
      const body = rows.slice(2);
      const th = head.map(c => `<th>${renderInline(c)}</th>`).join("");
      const tb = body.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("");
      return `<table class="pa-md-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table>`;
    }
    return null;
  }

  function renderMarkdown(text) {
    const src = String(text ?? "").replace(/\r\n?/g, "\n");
    const out = [];
    const lines = src.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      // 圍籬程式碼 ```
      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push(`<pre class="pa-md-pre"><code>${esc(buf.join("\n"))}</code></pre>`);
        continue;
      }
      // 水平線 --- / *** / ___
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { out.push('<hr class="pa-md-hr">'); i++; continue; }
      // 標題 #..######
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { const n = h[1].length; out.push(`<h${n} class="pa-md-h">${renderInline(h[2])}</h${n}>`); i++; continue; }
      // 表格：此行以 | 開頭且下一行是分隔列
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1])) {
        const buf = [line]; i++;
        while (i < lines.length && /^\s*\|/.test(lines[i])) { buf.push(lines[i]); i++; }
        const t = renderTable(buf);
        if (t) { out.push(t); continue; }
        i -= buf.length; // 不是表格，退回逐行處理
      }
      // 無序清單 - * +
      if (/^\s*[-*+]\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*[-*+]\s+/, "")); i++; }
        out.push(`<ul class="pa-md-ul">${buf.map(x => `<li>${renderInline(x)}</li>`).join("")}</ul>`);
        continue;
      }
      // 有序清單 1. 2.
      if (/^\s*\d+\.\s+/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
        out.push(`<ol class="pa-md-ol">${buf.map(x => `<li>${renderInline(x)}</li>`).join("")}</ol>`);
        continue;
      }
      // 引用 > 
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push(`<blockquote class="pa-md-quote">${renderInline(buf.join(" "))}</blockquote>`);
        continue;
      }
      // 空行
      if (!line.trim()) { i++; continue; }
      // 一般段落（連續非空、非特殊行合併）
      const para = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*([-*+]\s|\d+\.\s|>|#{1,6}\s|```|\|)/.test(lines[i])) { para.push(lines[i]); i++; }
      out.push(`<p class="pa-md-p">${renderInline(para.join("\n")).replace(/\n/g, "<br>")}</p>`);
    }
    return out.join("");
  }


  // 狀態列：名稱 + 視覺色調。DONE 絕不顯示為 PASS（見檔頭）。
  const STATUS_META = {
    PENDING: { label: "準備中", tone: "idle" },
    RUNNING: { label: "執行中", tone: "busy" },
    WAITING_FOR_USER: { label: "等待工程師確認", tone: "wait" },
    DONE: { label: "PA Agent 已完成 · 等待工程師判定", tone: "done" },
    ERROR: { label: "錯誤", tone: "err" },
  };
  // 訊息角色標籤：工程師 / PA Agent / 系統 / 工具活動 視覺分離。
  const ROLE_LABEL = { user: "工程師", agent: "PA Agent", assistant: "PA Agent", tool: "工具活動", system: "系統" };
  const ROLE_CLASS = { user: "eng", agent: "agent", assistant: "agent", tool: "tool", system: "system" };

  let root = null;
  let state = {
    runId: null, run: null, renderedSeq: 0, context: null,
    timer: null, polling: false, started: false,
  };

  // ---------- 根節點 ----------
  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.createElement("div");
    root.id = "pa-agent-drawer";
    root.className = "pa-drawer";
    root.setAttribute("role", "complementary");
    root.setAttribute("aria-label", "PA Agent 工作區");
    root.innerHTML = `
      <div class="pa-drawer-scrim" data-close="1" aria-hidden="true"></div>
      <aside class="pa-drawer-panel" role="dialog" aria-modal="true">
        <header class="pa-drawer-head">
          <div class="pa-drawer-title">
            <span class="pa-drawer-ico" aria-hidden="true">PA</span>
            <div class="pa-drawer-titles">
              <strong>PA Agent</strong>
              <small id="pa-drawer-status" class="pa-drawer-status pa-status-idle">
                <span class="pa-status-dot" aria-hidden="true"></span><span id="pa-drawer-status-text">閒置</span>
              </small>
            </div>
          </div>
          <button type="button" id="pa-drawer-close" class="pa-drawer-close" title="關閉" aria-label="關閉">&times;</button>
        </header>
        <div id="pa-drawer-cols" class="pa-drawer-cols">
          <section id="pa-drawer-left" class="pa-drawer-left">
            <div class="pa-drawer-left-head">
              <strong>測試任務</strong>
              <span class="pa-drawer-left-sub">Test Case Context</span>
            </div>
            <div id="pa-drawer-case" class="pa-drawer-case"></div>
          </section>
          <section class="pa-drawer-right">
            <div id="pa-drawer-body" class="pa-drawer-body" aria-live="polite"></div>
            <footer class="pa-drawer-foot">
              <div id="pa-approval" class="pa-approval-slot" hidden></div>
              <div class="pa-input-wrap">
                <button type="button" id="pa-attach" class="pa-attach" disabled
                  title="附件功能建置中（PDF / TXT / LOG / SPEC / SOP）" aria-label="附件">📎</button>
                <textarea id="pa-msg-input" class="pa-msg-input" rows="1"
                  placeholder="與 PA Agent 對話；同意開始請輸入 OK 或 GO"
                  aria-label="訊息輸入"></textarea>
                <button type="button" id="pa-msg-send" class="pa-msg-send" aria-label="送出">送出</button>
              </div>
              <div class="pa-foot-hint" id="pa-drawer-hint">
                Enter 送出 · Shift+Enter 換行。PA Agent 會先說明計畫並等待你同意，輸入 OK / GO 送出後才開始執行。
              </div>
            </footer>
          </section>
        </div>
      </aside>`;
    document.body.appendChild(root);
    root.querySelector("#pa-drawer-close").addEventListener("click", close);
    root.querySelector(".pa-drawer-scrim").addEventListener("click", close);
    wireInput();
    document.addEventListener("keydown", onKey);
    return root;
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  // ---------- 對外 API ----------
  function open(context = {}) {
    // context: { case_variant_id, node_id?, expected_binding_revision?, branch?, title?, task?, rich?, mode? }
    state.context = context || {};
    state.mode = context.mode === "execute" ? "execute" : "plan";
    state.runId = null; state.run = null; state.renderedSeq = 0;
    ensureRoot();
    root.classList.add("open");
    state.started = true;
    body().innerHTML = "";
    setApproval(null);
    renderLeftPanel();
    setStatus("PENDING");
    if (state.context.case_variant_id) {
      createRun();
    } else {
      setStatus("ERROR");
      body().innerHTML = `<div class="pa-empty">未提供 case_variant_id，無法建立 AgentRun。請從指派結果視窗以該用例開啟。</div>`;
    }
  }
  function close() {
    if (!root) return;
    cancelPolling();
    state.started = false;
    root.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { if (root && !root.classList.contains("open")) { root.remove(); root = null; } }, 260);
  }

  // ---------- 左欄：測試任務（Test Case Context）----------
  // 內容一律來自既有 case 快照（context.rich / context.task），不改變其語意；
  // 這裡只做「外框 + 章節標題」的重新編排，讓工程師能快速掃視。
  function renderLeftPanel() {
    const left = root?.querySelector("#pa-drawer-case");
    if (!left) return;
    const c = state.context || {};
    const rich = typeof c.rich === "string" ? c.rich.trim() : "";
    const text = typeof c.task === "string" ? c.task : "";
    const parts = [`<div class="pa-task-meta">${taskMeta(c)}</div>`];
    if (rich) parts.push(`<div class="pa-case-rich eng-case-detail-wrap">${rich}</div>`);
    else if (text) parts.push(`<pre class="pa-case-text">${esc(text)}</pre>`);
    else parts.push(`<div class="pa-case-empty">（無測試任務內容）</div>`);
    // 參考文件（SPEC / SOP / 附件）：後端尚未支援上傳，誠實標示。
    parts.push(`<section class="pa-task-refs">
      <h4>參考文件</h4>
      <div class="pa-refs-empty">目前沒有附件。SPEC / SOP / LOG 上傳功能建置中。</div>
    </section>`);
    left.innerHTML = parts.join("");
  }

  // 測試任務摘要（名稱 / code / variant / node / 測試集）。缺欄位一律顯示「—」。
  function taskMeta(c) {
    const rows = [
      ["測試案例", c.title || "—", false],
      ["Variant", c.case_variant_id || "—", true],
      ["目標節點", c.node_id || "—", true],
      ["測試集", c.branch || "—", false],
    ];
    return `<dl class="pa-task-grid">${rows.map(([k, v, mono]) =>
      `<dt>${esc(k)}</dt><dd${mono ? ' class="pa-mono"' : ""}>${esc(v)}</dd>`).join("")}</dl>`;
  }

  // ---------- 右欄：訊息渲染 ----------
  function body() { return root.querySelector("#pa-drawer-body"); }
  function scrollBottom() {
    const b = body();
    requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; });
  }
  function setStatus(status) {
    const meta = STATUS_META[status] || { label: status || "—", tone: "idle" };
    const el = root.querySelector("#pa-drawer-status");
    if (el) el.className = "pa-drawer-status pa-status-" + meta.tone;
    const t = root.querySelector("#pa-drawer-status-text");
    if (t) t.textContent = meta.label;
  }

  function messageCard(msg) {
    const role = msg.role || "agent";
    const label = ROLE_LABEL[role] || role;
    const cls = ROLE_CLASS[role] || "agent";
    const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString("zh-TW", { hour12: false }) : "";
    const text = msg.text ?? "";
    let content;
    if (role === "tool" || msg.kind === "tool" || msg.kind === "command" || msg.kind === "evidence") {
      content = `<pre class="pa-msg-tool-io">${esc(text).slice(0, 4000) || "（無內容）"}</pre>`;
    } else {
      // agent/assistant 與工程師訊息皆可能含 Markdown；以安全渲染器轉成 HTML
      // （renderMarkdown 內部對所有文字先 esc()，只產生白名單標籤）。
      const html = text ? renderMarkdown(text) : (role === "agent" || role === "assistant" ? "（處理中…）" : "");
      content = `<div class="pa-msg-content pa-md">${html}</div>`;
    }
    return `<div class="pa-msg pa-msg-${esc(cls)}">
      <div class="pa-msg-head"><span class="pa-msg-role">${esc(label)}</span>${time ? `<span class="pa-msg-time">${esc(time)}</span>` : ""}</div>
      ${content}
    </div>`;
  }
  function addMessage(msg) {
    const div = document.createElement("div");
    div.innerHTML = messageCard(msg);
    body().appendChild(div.firstElementChild);
    scrollBottom();
  }

  // 右欄開場：系統提示（不是工程師發言，避免 system instruction 被誤顯示成「你」）。
  function renderSystemIntro() {
    const c = state.context || {};
    const div = document.createElement("div");
    div.className = "pa-sysnote";
    div.innerHTML = `<span class="pa-sysnote-tag">系統</span>
      <span>測試任務已載入${c.title ? "：" + esc(c.title) : ""}。PA Agent 正在準備執行計畫…</span>`;
    body().appendChild(div);
  }

  // 摺疊的「執行活動」（命令 / 證據），避免 shell output 淹沒對話。
  function renderActivity(run) {
    const cmds = Array.isArray(run?.commands) ? run.commands : [];
    const evi = Array.isArray(run?.evidence) ? run.evidence : [];
    let el = body().querySelector(".pa-activity");
    if (!cmds.length && !evi.length) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("details");
      el.className = "pa-activity";
      body().appendChild(el);
    }
    const lines = [];
    for (const cm of cmds.slice(-8)) {
      const t = cm.tool ? `[${cm.tool}] ` : "";
      lines.push("▶ " + t + String(cm.thought || cm.finish_message || "").trim());
    }
    for (const e of evi.slice(-8)) {
      const c = typeof e.content === "string" ? e.content : JSON.stringify(e.content ?? "");
      lines.push("   ↳ " + String(c).trim());
    }
    el.innerHTML = `<summary class="pa-activity-title">執行活動 · ${cmds.length} 動作 · ${evi.length} 證據</summary>
      <pre class="pa-msg-tool-io">${esc(lines.join("\n")).slice(0, 6000)}</pre>`;
  }

  // 等待提示：agent 出計畫、等工程師確認時顯示。純文字提示，**不放任何按鈕**——
  // 確認流程是對話式的（工程師自己在輸入框打 OK / GO 送出），與一般聊天一致。
  function setApproval(run) {
    const slot = root?.querySelector("#pa-approval");
    if (!slot) return;
    const waiting = run && run.status === "WAITING_FOR_USER";
    if (!waiting) { slot.hidden = true; slot.innerHTML = ""; return; }
    slot.hidden = false;
    slot.innerHTML = `
      <div class="pa-approval-hint" role="status">
        <span class="pa-approval-head">PA Agent 等待你的確認</span>
        <span class="pa-approval-note">看過計畫後，在下方輸入 <kbd>OK</kbd> 或 <kbd>GO</kbd> 送出即開始執行；若要補充或修改，直接輸入內容即可。</span>
      </div>`;
  }

  // ---------- 建立 / 啟動 / 對話 ----------
  async function createRun() {
    const c = state.context || {};
    try {
      setStatus("PENDING");
      renderSystemIntro();
      const res = await fetch(`${API}/runs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_variant_id: c.case_variant_id || "",
          node_id: c.node_id || "",
          expected_binding_revision: c.expected_binding_revision || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.run?.run_id) throw new Error(data.detail || data.error || ("HTTP " + res.status));
      state.runId = data.run.run_id;
      state.run = data.run;
      state.renderedSeq = 0;
      renderActivity(state.run);
      await startRun(state.mode);   // plan：agent 只講計畫、不執行；execute：相容舊行為
    } catch (e) {
      setStatus("ERROR");
      addError("建立 run 失敗：" + e.message);
    }
  }

  // 啟動對話：mode="plan" 先出計畫等工程師；mode="execute" 維持舊行為直接執行。
  async function startRun(mode) {
    try {
      const r = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_run: true, mode: mode || "execute" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // gateway 未接（502）等：run 仍在，訊息可續讀；誠實提示，不假裝成功。
        setStatus("ERROR");
        addError("啟動 PA Agent 失敗：" + (d.detail || d.error || ("HTTP " + r.status)));
        return;
      }
      if (d.run) state.run = d.run;
      setStatus(state.run?.status || "RUNNING");
      beginPolling();
    } catch (e) {
      setStatus("ERROR");
      addError("啟動 PA Agent 失敗：" + e.message);
    }
  }

  // 工程師發言 → 追加到對話，讓 agent 回覆（真正的多輪對話）。
  async function sendMessage(text) {
    const input = root?.querySelector("#pa-msg-input");
    const t = (text || "").trim();
    if (!t || !state.runId) return;
    if (input) { input.value = ""; input.style.height = "auto"; }
    addMessage({ seq: Date.now(), role: "user", kind: "message", text: t, created_at: new Date().toISOString() });
    const sendBtn = root?.querySelector("#pa-msg-send");
    if (sendBtn) sendBtn.disabled = true;
    try {
      const r = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) addError("訊息送出失敗：" + (d.detail || d.error || ("HTTP " + r.status)));
      else { setStatus(state.run?.status || "RUNNING"); beginPolling(); }
    } catch (e) {
      addError("訊息送出失敗：" + e.message);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function addError(text) {
    const div = document.createElement("div");
    div.innerHTML = messageCard({ seq: -Date.now(), role: "agent", kind: "message",
      text: "⚠ " + text, created_at: new Date().toISOString() });
    body().appendChild(div.firstElementChild);
    scrollBottom();
  }

  // ---------- 輪詢 ----------
  function beginPolling() {
    cancelPolling();
    state.polling = true;
    pollOnce();
    state.timer = setInterval(pollOnce, POLL_MS);
  }
  async function pollOnce() {
    if (!state.runId) return;
    try {
      const mres = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/messages?limit=500`);
      const md = await mres.json().catch(() => ({}));
      if (!mres.ok) throw new Error(md.detail || ("HTTP " + mres.status));
      for (const m of md.messages || []) {
        if (m.seq > state.renderedSeq) { state.renderedSeq = m.seq; addMessage(m); }
      }
      const rres = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}`);
      const rd = await rres.json().catch(() => ({}));
      if (!rres.ok) throw new Error(rd.detail || ("HTTP " + rres.status));
      state.run = rd.run || state.run;
      renderActivity(state.run);
      applyRunStatus(state.run);
    } catch (e) {
      // 暫時性連線問題：保留現有畫面，稍後重試。
    }
  }
  function applyRunStatus(run) {
    if (!run) return;
    const st = run.status || "PENDING";
    setStatus(st);
    setApproval(run);
    if (TERMINAL.has(st)) {
      cancelPolling();
      setApproval(null);
      if (run.final_result) {
        const div = document.createElement("div");
        div.innerHTML = messageCard({ seq: -1, role: "agent", kind: "finish",
          text: run.final_result, created_at: run.updated_at });
        body().appendChild(div.firstElementChild);
      }
      if (st === "DONE") {
        const note = document.createElement("div");
        note.className = "pa-done-note";
        note.innerHTML = `<span class="pa-sysnote-tag">系統</span>
          <span>PA Agent 已完成測試工作並產出結果。<strong>這不代表測試通過</strong>——PASS / FAIL / BLOCKED 請由工程師依上方記錄判定。</span>`;
        body().appendChild(note);
      }
      scrollBottom();
    }
  }
  function cancelPolling() {
    state.polling = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  // ---------- 輸入框 ----------
  // 純對話輸入：Enter 送出、Shift+Enter 換行。開窗時 agent 只會先出計畫；
  // 使用者打 OK / GO（或 開始 / 執行 / 可以 / run）送出後，agent 才會開始執行。
  // 非關鍵字的內容視為補充或提問，agent 會據此修正計畫、繼續等待同意。
  function wireInput() {
    const input = root.querySelector("#pa-msg-input");
    const sendBtn = root.querySelector("#pa-msg-send");
    if (!input) return;
    const autoGrow = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 200) + "px";
    };
    input.addEventListener("input", autoGrow);
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      sendMessage(input.value);
    });
    sendBtn?.addEventListener("click", () => sendMessage(input.value));
  }

  window.PA_Agent = Object.freeze({ open, close });
})();
