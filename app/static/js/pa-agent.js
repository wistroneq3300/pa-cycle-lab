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
    timer: null, polling: false, started: false, mode: "plan",
    sending: false, lastSync: 0, stickBottom: true, unread: 0,
    opener: null, uploads: [],
    // Optimistic user turns that were shown locally before the server echoed
    // them back. Keyed by text so the poll can adopt the server copy instead of
    // rendering it a second time (which showed every line twice).
    pendingUser: [],
    // 對話剛建立、PA Agent 還沒說第一句之前，先鎖住輸入，避免工程師的話被塞進
    // 進行中的那一輪。agent 講完第一句（或 run 進入終端狀態）就解鎖。
    awaitingFirstReply: false,
  };

  // Enter 送出與「送出」按鈕共用一個 in-flight 守門，避免連點造成重複送出。
  function beginSend() { if (state.sending) return false; state.sending = true; return true; }
  function endSend() { state.sending = false; }

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
      <aside class="pa-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="pa-drawer-heading">
        <header class="pa-drawer-head">
          <div class="pa-drawer-title">
            <span class="pa-drawer-ico" aria-hidden="true">PA</span>
            <div class="pa-drawer-titles">
              <strong id="pa-drawer-heading">PA Agent</strong>
              <small id="pa-drawer-status" class="pa-drawer-status pa-status-idle">
                <span class="pa-status-dot" aria-hidden="true"></span><span id="pa-drawer-status-text">閒置</span>
              </small>
            </div>
          </div>
          <button type="button" id="pa-drawer-close" class="pa-drawer-close" title="關閉" aria-label="關閉">&times;</button>
        </header>
        <div id="pa-summary" class="pa-summary" aria-live="polite"></div>
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
            <button type="button" id="pa-new-messages" class="pa-new-messages" hidden>\u6709\u65b0\u8a0a\u606f \u00b7 \u56de\u5230\u6700\u65b0</button>
            <div id="pa-attach-strip" class="pa-attach-strip" hidden></div>
            <footer class="pa-drawer-foot">
              <div id="pa-approval" class="pa-approval-slot" hidden></div>
              <div id="pa-drop-hint" class="pa-drop-hint">放開以加入附件</div>
              <div class="pa-input-wrap">
                <button type="button" id="pa-attach" class="pa-attach"
                  title="加入附件（點選、拖曳或貼上圖片）" aria-label="附件">📎</button>
                <input type="file" id="pa-attach-input" multiple hidden
                  accept=".png,.jpg,.jpeg,.webp,.txt,.log,.pdf,.json,.csv,.md">
                <textarea id="pa-msg-input" class="pa-msg-input" rows="1"
                  placeholder="與 PA Agent 對話；同意開始請輸入 OK 或 GO"
                  aria-label="訊息輸入"></textarea>
                <button type="button" id="pa-msg-send" class="pa-msg-send" aria-label="送出">送出</button>
                <button type="button" id="pa-run-delete" class="pa-run-delete"
                  title="刪除這筆對話紀錄，重新開始（不影響 DUT 上的測試檔案）"
                  aria-label="刪除對話">🗑</button>
              </div>
              <div class="pa-compose-gate" id="pa-compose-gate" hidden>
                <span class="pa-gate-dot" aria-hidden="true"></span>PA Agent 正在準備計畫…等它說明完再開始輸入
              </div>
              <div class="pa-foot-hint" id="pa-drawer-hint">
                Enter 送出 · Shift+Enter 換行。PA Agent 會先說明計畫並等待你同意，輸入 OK / GO 送出後才開始執行。
                <span id="pa-sync" class="pa-sync"></span>
              </div>
            </footer>
          </section>
        </div>
      </aside>`;
    document.body.appendChild(root);
    root.querySelector("#pa-drawer-close").addEventListener("click", close);
    root.querySelector(".pa-drawer-scrim").addEventListener("click", close);
    root.querySelector("#pa-run-delete").addEventListener("click", deleteRun);
    wireInput();
    wireAttachments();
    document.addEventListener("keydown", onKey);
    return root;
  }
  function onKey(e) {
    if (!root?.classList.contains("open")) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const focusable = [...root.querySelectorAll('button:not([disabled]):not([hidden]),textarea:not([disabled]),input:not([disabled]),a[href],summary')]
      .filter(el => !el.hidden && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- 對外 API ----------
  async function open(context = {}) {
    // context: { case_variant_id, node_id?, expected_binding_revision?, branch?, title?, task?, rich?, mode? }
    state.opener = document.activeElement;
    state.context = context || {};
    state.mode = context.mode === "execute" ? "execute" : "plan";
    state.runId = null; state.run = null; state.renderedSeq = 0;
    state.lastSync = 0; state.stickBottom = true; state.unread = 0; state.uploads = []; state._attachments = [];
    state.pendingUser = [];
    state._finalShown = null; state._doneNoteShown = null; state._errorShown = null;
    ensureRoot();
    root.classList.add("open");
    state.started = true;
    body().innerHTML = "";
    setApproval(null);
    renderLeftPanel();
    setStatus("PENDING");
    // 先鎖住輸入：PA Agent 還沒說第一句之前不讓工程師送訊息。接回舊對話或
    // agent 開口後，addMessage 會自動解鎖。
    setComposerEnabled(false);
    requestAnimationFrame(() => root?.querySelector("#pa-drawer-close")?.focus({ preventScroll: true }));
    if (!state.context.case_variant_id) {
      setStatus("ERROR");
      body().innerHTML = `<div class="pa-empty">未提供 case_variant_id，無法建立 AgentRun。請從指派結果視窗以該用例開啟。</div>`;
      return;
    }
    // P1-5：關閉抽屜 ≠ 結束任務。重新開啟同一 Test Case 時，先找進行中的 run，
    //   找到就接回同一個對話（狀態／訊息／證據），找不到才建立新的。
    try {
      const resumed = await resumeRun();
      if (resumed) return;
    } catch (e) { /* 找不到 active run 就照常建立新的 */ }
    createRun();
  }
  async function resumeRun() {
    const c = state.context || {};
    const q = new URLSearchParams({ case_variant_id: c.case_variant_id || "" });
    if (c.node_id) q.set("node_id", c.node_id);
    const res = await fetch(`${API}/active?${q.toString()}`);
    if (!res.ok) return false;
    const d = await res.json().catch(() => ({}));
    const run = d?.run;
    if (!run || !run.run_id) return false;
    state.runId = run.run_id;
    state.run = run;
    state.renderedSeq = 0;
    renderActivity(state.run);
    refreshStrip();
    await loadHistory();
    setStatus(state.run.status || "PENDING");
    applyRunStatus(state.run);
    if (!TERMINAL.has(state.run.status || "")) beginPolling();
    return true;
  }
  async function loadHistory() {
    const res = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/messages?limit=500`);
    const d = await res.json().catch(() => ({}));
    body().innerHTML = "";
    renderSystemIntro();
    for (const m of d.messages || []) {
      if (m.seq > state.renderedSeq) { state.renderedSeq = m.seq; addMessage(m); }
    }
  }
  function close() {
    if (!root) return;
    const opener = state.opener;
    cancelPolling();
    state.started = false;
    root.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => {
      if (root && !root.classList.contains("open")) { root.remove(); root = null; }
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus({ preventScroll: true });
    }, 260);
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
    // 參考文件（SPEC / SOP / 附件）：可由右側拖曳／貼上加入；此處顯示目前附件清單。
    const atts = (state.run && state.run.attachments) || state._attachments || [];
    const attHtml = atts.length
      ? `<ul class="pa-ref-list">${atts.map(a =>
          `<li><span class="pa-ref-name">${esc(a.name)}</span>` +
          `<span class="pa-ref-size">${fmtSize(a.size)}</span>` +
          (a.kind === "image" && !a.vision_supported ? `<span class="pa-ref-warn">目前模型無法解析</span>` : "") +
          `</li>`).join("")}</ul>`
      : `<div class="pa-refs-empty">尚無附件。可直接把檔案拖進右側對話、貼上圖片，或按 📎 加入 SPEC / SOP / LOG。</div>`;
    parts.push(`<section class="pa-task-refs">
      <h4>參考文件</h4>
      ${attHtml}
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
  function fmtSize(n) {
    const b = Number(n || 0);
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    return (b / 1024 / 1024).toFixed(1) + " MB";
  }
  function scrollBottom() {
    if (!state.stickBottom) return;
    const b = body();
    state.unread = 0;
    updateNewMessages();
    requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; });
  }
  function updateNewMessages() {
    const button = root?.querySelector("#pa-new-messages");
    if (!button) return;
    button.hidden = !state.unread;
    button.textContent = state.unread ? `${state.unread} 則新訊息 · 回到最新` : "有新訊息 · 回到最新";
  }
  function setStatus(status) {
    const meta = STATUS_META[status] || { label: status || "—", tone: "idle" };
    const el = root.querySelector("#pa-drawer-status");
    if (el) el.className = "pa-drawer-status pa-status-" + meta.tone;
    const t = root.querySelector("#pa-drawer-status-text");
    if (t) t.textContent = meta.label;
  }

  // 頂部摘要列：Test Case / Project / Node / 狀態 / 時間 / 最後同步（P2）。
  function renderSummary(run) {
    const box = root?.querySelector("#pa-summary");
    if (!box) return;
    const c = state.context || {};
    const r = run || state.run || {};
    const st = STATUS_META[r.status] || STATUS_META.PENDING;
    const started = r.started_at ? new Date(r.started_at) : null;
    const ended = r.ended_at ? new Date(r.ended_at) : null;
    let dur = "—";
    if (started) {
      const end = ended || new Date();
      const secs = Math.max(0, Math.round((end - started) / 1000));
      dur = secs < 60 ? secs + "s" : (secs < 3600 ? Math.floor(secs / 60) + "m" + (secs % 60) + "s" : Math.floor(secs / 3600) + "h" + Math.floor((secs % 3600) / 60) + "m");
    }
    const sync = state.lastSync ? new Date(state.lastSync).toLocaleTimeString("zh-TW", { hour12: false }) : "—";
    const shortId = value => {
      const text = String(value || "");
      return text.length > 20 ? text.slice(0, 9) + "…" + text.slice(-7) : (text || "—");
    };
    const caseText = c.title || c.case_variant_id || "—";
    const targetText = c.node_id || "—";
    const runText = r.run_id || state.runId || "—";
    box.innerHTML =
      `<span class="pa-sum-item pa-sum-case" title="${esc(caseText)}"><b>Case</b>${esc(caseText)}</span>` +
      `<span class="pa-sum-item" title="${esc(targetText)}"><b>Target</b><span class="pa-mono">${esc(shortId(targetText))}</span></span>` +
      `<span class="pa-sum-item" title="${esc(runText)}"><b>Run</b><span class="pa-mono">${esc(shortId(runText))}</span></span>` +
      `<span class="pa-sum-item"><b>狀態</b><span class="pa-sum-status pa-status-${st.tone}">${esc(st.label)}</span></span>` +
      `<span class="pa-sum-item"><b>耗時</b>${esc(dur)}</span>` +
      `<span class="pa-sum-item"><b>最後同步</b>${esc(sync)}</span>` +
      (r.plan_revision ? `<span class="pa-sum-item"><b>計畫版本</b>r${esc(r.plan_revision)}</span>` : "");
  }

  // 刪除本筆 run 的對話與紀錄，讓下一次開啟是乾淨的一筆。
  // 只清 PA Agent 自己的紀錄（訊息／狀態／上傳附件），不動 DUT 上的測試 log。
  async function deleteRun() {
    if (!state.runId) return;
    const ok = window.confirm(
      "確定要刪除這筆對話紀錄嗎？\n\n" +
      "• 會刪除：本筆對話訊息、執行紀錄、你上傳的附件\n" +
      "• 不會刪除：DUT 上的測試檔案（/home/PAagent/…）\n\n" +
      "刪除後重新開啟這個 Test Case 會建立一筆全新的對話。");
    if (!ok) return;
    try {
      const res = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || d.error || ("HTTP " + res.status));
      // Reset the drawer to a clean state and rebuild the run from scratch.
      state.runId = null; state.run = null; state.renderedSeq = 0;
      state.uploads = []; state._attachments = []; state.pendingUser = [];
      body().innerHTML = "";
      setApproval(null);
      renderAttachmentStrip([]);
      setStatus("PENDING");
      renderSystemIntro();
      await createRun();
    } catch (e) {
      addError("刪除對話失敗：" + e.message);
    }
  }

  // 附件列（右側、輸入框上方）：顯示「這一輪還沒送出」的附件與上傳狀態。
  // 圖片以縮圖預覽呈現（如 OpenHands），檔案才用名稱 chip；送出後即從此列消失。
  function renderAttachmentStrip(atts) {
    const strip = root?.querySelector("#pa-attach-strip");
    if (!strip) return;
    state._attachments = atts || [];
    const all = [...state._attachments, ...(state.uploads || [])];
    if (!all.length) { strip.hidden = true; strip.innerHTML = ""; return; }
    strip.hidden = false;
    strip.innerHTML = all.map(a => {
      const id = esc(a.attachment_id);
      // Transient / problem states keep a small label; a ready attachment shows none.
      let status = "";
      if (a.status === "uploading") status = `<span class="pa-att-status">上傳中</span>`;
      else if (a.status === "failed") status = `<span class="pa-att-warn" title="${esc(a.error || "")}">上傳失敗</span><button type="button" class="pa-att-retry" data-retry="${id}">重試</button>`;
      else if (a.status === "unparsed") status = `<span class="pa-att-warn" title="${esc(a.error || "")}">無法解析</span>`;
      else if (a.kind === "image" && !a.vision_supported) status = `<span class="pa-att-warn">模型不支援圖片解析</span>`;
      const rm = `<button type="button" class="pa-att-rm" data-rm="${id}" title="移除">✕</button>`;
      if (a.kind === "image") {
        // Local picks preview from the in-memory File; stored ones come from the run.
        const src = a._previewUrl
          || `${API}/runs/${encodeURIComponent(state.runId)}/attachments/${encodeURIComponent(a.attachment_id)}/raw`;
        return `<span class="pa-att pa-att-thumb" data-id="${id}">
          <img class="pa-att-thumb-img" src="${esc(src)}" alt="${esc(a.name)}" loading="lazy" />
          <span class="pa-att-thumb-meta">${status}${rm}</span>
        </span>`;
      }
      return `<span class="pa-att" data-id="${id}">
        <span class="pa-att-name">${esc(a.name)}</span>
        <span class="pa-att-size">${fmtSize(a.size)}</span>${status}${rm}
      </span>`;
    }).join("");
    strip.querySelectorAll("[data-rm]").forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-rm");
      const local = state.uploads.find(item => item.attachment_id === id);
      if (local) {
        state.uploads = state.uploads.filter(item => item.attachment_id !== id);
        renderAttachmentStrip(state._attachments);
        return;
      }
      try {
        await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/attachments/${encodeURIComponent(id)}`, { method: "DELETE" });
      } catch (e) { /* ignore */ }
      renderAttachmentStrip(state._attachments.filter(x => x.attachment_id !== id));
      renderLeftPanel();
    }));
    strip.querySelectorAll("[data-retry]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-retry");
      const failed = state.uploads.find(item => item.attachment_id === id);
      if (!failed?._file) return;
      state.uploads = state.uploads.filter(item => item.attachment_id !== id);
      uploadOne(failed._file);
    }));
  }

  // 以「尚未送出」的附件刷新預覽列。送出過的圖不會再回來，避免同一張圖重複出現。
  async function refreshStrip() {
    if (!state.runId) { renderAttachmentStrip([]); return; }
    try {
      const res = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/attachments/unconsumed`);
      const d = await res.json().catch(() => ({}));
      if (res.ok) renderAttachmentStrip(d.attachments || []);
    } catch (e) { /* 保持現狀，下次輪詢再試 */ }
  }

  function attachmentChips(atts) {
    if (!Array.isArray(atts) || !atts.length) return "";
    const items = atts.map(a => {
      const id = esc(a.attachment_id || a.attachmentId || "");
      const name = esc(a.name || "attachment");
      const isImg = a.kind === "image";
      if (isImg) {
        const url = `${API}/runs/${encodeURIComponent(state.runId)}/attachments/${encodeURIComponent(a.attachment_id)}/raw`;
        return `<a class="pa-msg-att pa-msg-att-img" href="${url}" target="_blank" rel="noopener" title="${name}">
          <img src="${url}" alt="${name}" loading="lazy" />
        </a>`;
      }
      return `<span class="pa-msg-att pa-msg-att-file" title="${name}">📎 ${name}</span>`;
    }).join("");
    return `<div class="pa-msg-atts">${items}</div>`;
  }

  function messageCard(msg) {
    const role = msg.role || "agent";
    const label = ROLE_LABEL[role] || role;
    const cls = ROLE_CLASS[role] || "agent";
    const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString("zh-TW", { hour12: false }) : "";
    const text = msg.text ?? "";
    const atts = attachmentChips(msg.attachments);
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
      ${atts}${content}
    </div>`;
  }
  function addMessage(msg) {
    const div = document.createElement("div");
    div.innerHTML = messageCard(msg);
    const el = div.firstElementChild;
    if (msg && msg.pending) el.setAttribute("data-pending", "1");
    body().appendChild(el);
    // Agent 講了第一句（真正有內容，不是「（處理中…）」佔位）就解鎖輸入框，
    // 並收掉「思考中」提示 —— 它已經開口了。
    if ((msg.role === "agent" || msg.role === "assistant") && (msg.text || "").trim()) {
      setThinking(false);
      unlockComposer();
    }
    if (state.stickBottom) scrollBottom();
    else { state.unread += 1; updateNewMessages(); }
  }

  // Drop the local optimistic copy of a user turn once the server echoes it back,
  // so pollOnce can render the canonical row without producing a duplicate.
  function adoptPendingUser(text) {
    const i = state.pendingUser.indexOf(text);
    if (i === -1) return false;
    state.pendingUser.splice(i, 1);
    const el = body()?.querySelector('[data-pending="1"]');
    if (el) el.remove();
    return true;
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
      refreshStrip();
      renderSummary(state.run);
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
  // 送出前先做 in-flight 守門，避免 Enter 與按鈕連點造成重複送出（P2）。
  async function sendMessage(text) {
    const input = root?.querySelector("#pa-msg-input");
    const t = (text || "").trim();
    if (!t || !state.runId) return;
    if (!beginSend()) return;
    state.stickBottom = true;
    state.pendingUser.push(t);
    // Only the files attached for THIS send ride the optimistic bubble — not
    // every file ever uploaded to the run, which would stamp the same image on
    // each new message.
    const optimisticAtts = (state.uploads || []).filter(a => a.status !== "failed");
    addMessage({ seq: Date.now(), role: "user", kind: "message", text: t, pending: true,
      attachments: optimisticAtts, created_at: new Date().toISOString() });
    const sendBtn = root?.querySelector("#pa-msg-send");
    let sent = false;
    if (input) input.disabled = true;
    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "傳送中…"; }
    try {
      const r = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) addError("訊息未送出：" + (d.detail || d.error || ("HTTP " + r.status)) + "。內容已保留，可修正後重試。");
      else {
        sent = true;
        if (input) { input.value = ""; autoGrowInput(input); }
        // This turn consumed its uploads: clear the local pending list and
        // re-fetch the unconsumed set so the sent image leaves the preview strip
        // and cannot ride the next message.
        state.uploads = [];
        refreshStrip();
        setStatus(state.run?.status || "RUNNING");
        // 立即顯示「思考中」，不用等下一次輪詢才有回饋。
        setThinking(true);
        // 補充訊息會建立新的計畫版本；提示工程師 GO 將採用最新版（P0-2）。
        if (d.intent === "question") {
          appendSystemNote("已記錄為本次計畫的補充內容；輸入 OK / GO 時會採用最新版本的計畫。");
          fetch(`${API}/runs/${encodeURIComponent(state.runId)}`).then(x => x.json())
            .then(x => { if (x.run) { state.run = x.run; renderSummary(state.run); } })
            .catch(() => {});
        }
        beginPolling();
      }
    } catch (e) {
      addError("訊息未送出：" + e.message + "。內容已保留，可修正後重試。");
    } finally {
      state.sending = false;
      // On failure the turn never reached the server, so the optimistic copy must
      // drop its pending marker: a later poll will never adopt it, and the next
      // successful send of the same text must not remove the wrong row.
      if (!sent) {
        const i = state.pendingUser.indexOf(t);
        if (i !== -1) state.pendingUser.splice(i, 1);
        const el = body()?.querySelector('[data-pending="1"]');
        if (el) el.removeAttribute("data-pending");
      }
      if (input) { input.disabled = false; if (!sent) input.value = t; input.dispatchEvent(new Event("input")); input.focus(); }
      if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "送出"; }
    }
  }

  function appendSystemNote(text) {
    const div = document.createElement("div");
    div.className = "pa-sysnote";
    div.innerHTML = `<span class="pa-sysnote-tag">系統</span><span>${esc(text)}</span>`;
    body().appendChild(div);
    scrollBottom();
  }

  function addError(text) {
    const div = document.createElement("div");
    div.innerHTML = messageCard({ seq: -Date.now(), role: "agent", kind: "message",
      text: "⚠ " + text, created_at: new Date().toISOString() });
    body().appendChild(div.firstElementChild);
    scrollBottom();
  }

  // 「思考中」提示：agent 還在跑（RUNNING）且尚未吐出下一則訊息時，在對話底部
  // 顯示一個動畫泡泡，讓工程師知道它正在忙、不是卡住。離開 RUNNING 或 agent
  // 一開口就移除。
  function setThinking(on, label) {
    const b = body();
    if (!b) return;
    let el = b.querySelector(".pa-typing");
    if (!on) { if (el) el.remove(); return; }
    const text = label || "PA Agent 正在思考";
    if (el) { el.querySelector(".pa-typing-text").textContent = text; return; }
    el = document.createElement("div");
    el.className = "pa-typing";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<span class="pa-typing-role">PA Agent</span>
      <span class="pa-typing-text">${esc(text)}</span>
      <span class="pa-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>`;
    b.appendChild(el);
    scrollBottom();
  }

  // ---------- 輪詢 ----------
  function beginPolling() {
    state.polling = true;
    if (state.timer) return;              // 已在輪詢就不重複開
    pollOnce();
    state.timer = setInterval(pollOnce, POLL_MS);
  }
  function setSync(ok) {
    const el = root?.querySelector("#pa-sync");
    if (!el) return;
    el.textContent = ok ? "· 已連線" : "· 連線中斷，重試中";
    el.className = "pa-sync " + (ok ? "pa-sync-ok" : "pa-sync-bad");
  }
  async function pollOnce() {
    if (!state.runId) return;
    try {
      const mres = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/messages?limit=500`);
      const md = await mres.json().catch(() => ({}));
      if (!mres.ok) throw new Error(md.detail || ("HTTP " + mres.status));
      for (const m of md.messages || []) {
        if (m.seq > state.renderedSeq) {
          // A user turn we optimistically rendered before the server echoed it:
          // drop the local copy, then render the canonical server row below.
          if (m.role === "user" && state.pendingUser.includes(m.text)) adoptPendingUser(m.text);
          state.renderedSeq = m.seq;
          addMessage(m);
        }
      }
      const rres = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}`);
      const rd = await rres.json().catch(() => ({}));
      if (!rres.ok) throw new Error(rd.detail || ("HTTP " + rres.status));
      state.run = rd.run || state.run;
      state.lastSync = Date.now();
      renderActivity(state.run);
      renderSummary(state.run);
      refreshStrip();
      setSync(true);
      applyRunStatus(state.run);
    } catch (e) {
      // 暫時性連線問題：保留現有畫面，顯示連線狀態，稍後重試；不要默默吞掉（P2）。
      setSync(false);
    }
  }
  function applyRunStatus(run) {
    if (!run) return;
    const st = run.status || "PENDING";
    setStatus(st);
    setApproval(run);
    // 思考中提示：run 在跑就顯示；一旦進入等待確認 / 終端 / 錯誤就收掉。
    const busy = st === "RUNNING" || st === "PENDING";
    setThinking(busy);
    // 安全解鎖：run 進入終端狀態或出錯時，就算 agent 沒正常開口，也要讓工程師
    // 能輸入／追問，不能把輸入框永久鎖住。
    if (TERMINAL.has(st) || st === "ERROR" || st === "WAITING_FOR_USER") unlockComposer();
    if (TERMINAL.has(st)) {
      cancelPolling();
      setApproval(null);
      // final_result 只渲染一次：以 run 的結束時間/內容指紋去重，避免輪詢與
      // 重新開啟時重複貼同一份結果（P0-7）。
      const fingerprint = `${run.ended_at || ""}|${(run.final_result || "").length}`;
      if (run.final_result && state._finalShown !== fingerprint) {
        state._finalShown = fingerprint;
        const div = document.createElement("div");
        div.innerHTML = messageCard({ seq: -1, role: "agent", kind: "finish",
          text: run.final_result, created_at: run.updated_at });
        body().appendChild(div.firstElementChild);
      }
      if (st === "DONE" && state._doneNoteShown !== fingerprint) {
        state._doneNoteShown = fingerprint;
        const note = document.createElement("div");
        note.className = "pa-done-note";
        note.innerHTML = `<span class="pa-sysnote-tag">系統</span>
          <span>PA Agent 已完成測試工作並產出結果。<strong>這不代表測試通過</strong>——PASS / FAIL / BLOCKED 請由工程師依上方記錄判定。</span>`;
        body().appendChild(note);
      }
      if (st === "ERROR") {
        const reason = String(run.failure_reason || "PA Agent 執行失敗；後端未提供進一步原因。");
        const errorFingerprint = `${run.ended_at || ""}|${reason}`;
        if (state._errorShown !== errorFingerprint) {
          state._errorShown = errorFingerprint;
          const note = document.createElement("div");
          note.className = "pa-error-note";
          note.setAttribute("role", "alert");
          note.innerHTML = `<span class="pa-sysnote-tag">錯誤</span><span>${esc(reason)}</span>`;
          body().appendChild(note);
        }
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
  //
  // 鎖定：剛建立對話、PA Agent 還沒說第一句之前，輸入框與送出鈕先停用，避免
  // 工程師的訊息被併進 agent 正在寫計畫的那一輪。agent 一開口就解鎖。
  function setComposerEnabled(enabled) {
    const input = root?.querySelector("#pa-msg-input");
    const sendBtn = root?.querySelector("#pa-msg-send");
    const attach = root?.querySelector("#pa-attach");
    const gate = root?.querySelector("#pa-compose-gate");
    state.awaitingFirstReply = !enabled;
    if (input) {
      input.disabled = !enabled;
      if (enabled) autoGrowInput(input);
    }
    if (sendBtn) sendBtn.disabled = !enabled;
    if (attach) attach.disabled = !enabled;
    if (gate) gate.hidden = enabled;
    const panel = root?.querySelector(".pa-drawer-panel");
    panel?.classList.toggle("pa-awaiting-reply", !enabled);
  }
  function unlockComposer() {
    if (!state.awaitingFirstReply) return;
    setComposerEnabled(true);
    root?.querySelector("#pa-msg-input")?.focus({ preventScroll: true });
  }

  // ---------- 輸入框 ----------
  // 打很多字時輸入框自動長高（最多約 12 行，超過就內部捲動），不會擠掉對話區。
  const INPUT_MAX_PX = 320;
  function autoGrowInput(input) {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, INPUT_MAX_PX) + "px";
    input.style.overflowY = input.scrollHeight > INPUT_MAX_PX ? "auto" : "hidden";
  }

  function wireInput() {
    const input = root.querySelector("#pa-msg-input");
    const sendBtn = root.querySelector("#pa-msg-send");
    if (!input) return;
    const autoGrow = () => autoGrowInput(input);
    input.addEventListener("input", autoGrow);
    // 有些瀏覽器在貼上 / 程式設值後才量到新高度，補一次。
    input.addEventListener("change", autoGrow);
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      sendMessage(input.value);
    });
    sendBtn?.addEventListener("click", () => sendMessage(input.value));
    autoGrow();
    // 使用者往上閱讀舊訊息時，不要被新訊息強制拉到底（P2）。
    const b = body();
    b?.addEventListener("scroll", () => {
      const nearBottom = (b.scrollHeight - b.scrollTop - b.clientHeight) < 60;
      state.stickBottom = nearBottom;
      if (nearBottom) { state.unread = 0; updateNewMessages(); }
    });
    root.querySelector("#pa-new-messages")?.addEventListener("click", () => {
      state.stickBottom = true;
      scrollBottom();
    });
  }

  // ---------- 附件（P1-1）----------
  // 三種加入方式：點 📎、拖曳檔案到視窗、Ctrl+V 貼上截圖。上傳後立刻顯示於
  // 附件列；圖片標示「目前模型無法解析」（除非後端回報支援 vision）。
  function wireAttachments() {
    const pick = root.querySelector("#pa-attach");
    const fileInput = root.querySelector("#pa-attach-input");
    const panel = root.querySelector(".pa-drawer-panel");
    const hint = root.querySelector("#pa-drop-hint");
    pick?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", () => {
      uploadFiles(Array.from(fileInput.files || []));
      fileInput.value = "";
    });
    // Drag & drop over the whole panel.
    ["dragenter", "dragover"].forEach(ev => panel?.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      if (hint) hint.classList.add("show");
    }));
    panel?.addEventListener("dragleave", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (hint) hint.classList.remove("show");
    });
    panel?.addEventListener("drop", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (hint) hint.classList.remove("show");
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) uploadFiles(files);
    });
    // Paste screenshot (Ctrl+V) while the drawer is open.
    root.addEventListener("paste", (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const files = [];
      for (const it of items) {
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) { e.preventDefault(); uploadFiles(files); }
    });
  }

  const IMAGE_RE = /^image\//;
  function uploadFiles(files) {
    if (!state.runId) { addError("請先建立 / 開啟 AgentRun 再上傳附件。"); return; }
    for (const f of files) uploadOne(f);
  }
  async function uploadOne(file) {
    const isImage = IMAGE_RE.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    const kind = isImage ? "image" : "file";
    // Optimistic placeholder row so the engineer sees progress immediately.
    const pendingId = "pending-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const pending = { attachment_id: pendingId, name: file.name || "screenshot.png", size: file.size,
      kind, status: "uploading", vision_supported: false, _file: file };
    if (kind === "image") {
      try { pending._previewUrl = URL.createObjectURL(file); } catch (e) { /* older browsers */ }
    }
    state.uploads = [...(state.uploads || []), pending];
    renderAttachmentStrip(state._attachments || []);
    try {
      const res = await fetch(
        `${API}/runs/${encodeURIComponent(state.runId)}/attachments?` +
        new URLSearchParams({ name: file.name || "screenshot.png", kind, mime: file.type || "" }),
        { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || d.error || ("HTTP " + res.status));
      const local = state.uploads.find(a => a.attachment_id === pendingId);
      if (local?._previewUrl) { try { URL.revokeObjectURL(local._previewUrl); } catch (e) { /* ignore */ } }
      state.uploads = state.uploads.filter(a => a.attachment_id !== pendingId);
      // Refresh from server truth (unconsumed set — what is still pending to send).
      const listRes = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/attachments/unconsumed`);
      const list = await listRes.json().catch(() => ({}));
      if (!listRes.ok) addError("附件已上傳，但清單同步失敗：" + (list.detail || ("HTTP " + listRes.status)));
      renderAttachmentStrip(listRes.ok ? (list.attachments || []) : (state._attachments || []));
      renderLeftPanel();
    } catch (e) {
      pending.status = "failed";
      pending.error = e.message;
      renderAttachmentStrip(state._attachments || []);
      addError("附件上傳失敗：" + e.message + "。檔案已保留在本畫面，不會自動重試。");
    }
  }

  window.PA_Agent = Object.freeze({ open, close });
})();
