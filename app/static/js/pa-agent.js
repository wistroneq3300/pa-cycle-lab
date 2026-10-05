/* PA Agent 對話側欄（P3-e）：透過 PA Backend Agent Gateway（/api/agent/*）
   啟動一個正式 AgentRun（P3-b/c）並輪詢其訊息流。本檔案僅呼叫 PA Backend 的
   /api/agent/* 端點，絕不直接 iframe／連線 OpenHands 前端 UI。

   真實後端契約（integration/agent_routes.py + agent_runs.py）：
     1) POST /api/agent/runs
            { case_variant_id, node_id?, expected_binding_revision?,
              required_documents?, user_attachments? }
            → { ok, run: { run_id, case_variant_id, status, context, ... } }
     2) POST /api/agent/runs/{run_id}/start
            { auto_run?, workspace_dir? }
            → { ok, run_id, conversation_ref, run }   （gateway 未接時 502）
     3) GET  /api/agent/runs/{run_id}        → { ok, run }  （含 status / final_result）
          GET  /api/agent/runs/{run_id}/messages?limit=N → { ok, messages: [{seq,role,kind,text,created_at}] }
        前端輪詢 (3) 把 messages 以對話卡片呈現；status 進入終態即停止。

   run.status 值域（agent_runs.py）：
     PENDING / RUNNING / WAITING_FOR_USER（進行中）
     DONE / ERROR（終態）
   DONE＝agent 停止並產出 Log（待工程師判定），非「測試通過」；PASS/FAIL/BLOCKED
   已從狀態機退役（工程師看 Log 自行裁定，不在本系統內產生）。

   命名空間：window.PA_Agent = { open, close }
*/
(() => {
  "use strict";
  const API = "/api/agent";
  const POLL_MS = 2000;
  const TERMINAL = new Set(["DONE", "ERROR", "PASS", "FAIL", "BLOCKED"]);

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // PASS/FAIL/BLOCKED are retired: the agent only logs, the engineer decides.
  // DONE means the agent stopped with its log ready for review — not a verdict.
  const STATUS_LABEL = {
    PENDING: "待啟動",
    RUNNING: "執行中…",
    WAITING_FOR_USER: "等待回覆",
    DONE: "完成（待工程師判定）",
    ERROR: "錯誤",
  };
  const ROLE_LABEL = { user: "你", agent: "PA Agent", assistant: "PA Agent", tool: "PA Agent · 工具", system: "系統" };

  let root = null;
  let state = {
    started: false, polling: false, timer: null,
    runId: null, run: null, renderedSeq: 0,
    context: null, task: "",
  };

  // 建立側欄根節點（每次 open 重建，關閉即移除）。
  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.createElement("div");
    root.id = "pa-agent-drawer";
    root.className = "pa-drawer";
    root.setAttribute("role", "complementary");
    root.setAttribute("aria-label", "PA Agent 對話");
    root.innerHTML = `
      <div class="pa-drawer-scrim" data-close="1" aria-hidden="true"></div>
      <aside class="pa-drawer-panel" role="dialog" aria-modal="true">
        <header class="pa-drawer-head">
          <div class="pa-drawer-title">
            <span class="pa-drawer-ico" aria-hidden="true">PA</span>
            <div class="pa-drawer-titles">
              <strong>PA Agent</strong>
              <small id="pa-drawer-status" class="pa-drawer-status">閒置</small>
            </div>
          </div>
          <button type="button" id="pa-drawer-close" class="pa-drawer-close" title="關閉" aria-label="關閉">&times;</button>
        </header>
        <div id="pa-drawer-cols" class="pa-drawer-cols">
          <section id="pa-drawer-left" class="pa-drawer-left">
            <div class="pa-drawer-left-head">指派給 PA Agent 的指令（請審閱）</div>
            <div id="pa-drawer-case" class="pa-drawer-case"></div>
          </section>
          <section class="pa-drawer-right">
            <div id="pa-drawer-body" class="pa-drawer-body" aria-live="polite"></div>
            <footer class="pa-drawer-foot">
              <textarea id="pa-msg-input" class="pa-msg-input" rows="1"
                placeholder="對 PA Agent 說點什麼…（可留空；Shift+Enter 換行）"
                aria-label="訊息輸入"></textarea>
              <div class="pa-foot-row">
                <span id="pa-drawer-hint" class="pa-drawer-hint">由 PA Backend AgentRun 處理；實際執行取決於 P3-d 授權策略</span>
                <button type="button" id="pa-drawer-start" class="pa-drawer-start" hidden>送出</button>
              </div>
            </footer>
          </section>
        </div>
      </aside>`;
    document.body.appendChild(root);
    root.querySelector("#pa-drawer-close").addEventListener("click", close);
    root.querySelector(".pa-drawer-scrim").addEventListener("click", close);
    root.querySelector("#pa-drawer-start").addEventListener("click", startRun);
    wireInput();
    document.addEventListener("keydown", onKey);
    return root;
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  // 右欄輸入：多行 textarea（自動增高）。內容會隨「送出」一起交給 agent，
// 不是獨立的聊天訊息（後端沒有 run-message endpoint）；留空則只執行測項本身。
  function wireInput() {
    const input = root.querySelector("#pa-msg-input");
    if (!input) return;
    const autoGrow = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 240) + "px";
    };
    input.addEventListener("input", autoGrow);
  }
  function addUserMessage(text) {
    const div = document.createElement("div");
    div.innerHTML = messageCard({ seq: Date.now(), role: "user", kind: "message",
      text, created_at: new Date().toISOString() });
    body().appendChild(div.firstElementChild);
    scrollBottom();
  }

  function setStatus(text, cls = "") {
    const el = root.querySelector("#pa-drawer-status");
    el.textContent = text;
    el.className = "pa-drawer-status" + (cls ? " " + cls : "");
  }
  function body() { return root.querySelector("#pa-drawer-body"); }
  function scrollBottom() {
    const b = body();
    requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; });
  }

  // ---------- 訊息卡片 ----------
  function messageCard(msg) {
    const role = msg.role || "assistant";
    const label = ROLE_LABEL[role] || role;
    const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString("zh-TW", { hour12: false }) : "";
    const text = msg.text ?? "";
    let content = "";
    if (role === "tool" || msg.kind === "tool" || msg.kind === "command" || msg.kind === "evidence") {
      content = `<pre class="pa-msg-tool-io">${esc(text).slice(0, 4000) || "（無內容）"}</pre>`;
    } else {
      content = `<div class="pa-msg-content">${esc(text) || (role === "assistant" ? "（處理中…）" : "")}</div>`;
    }
    return `<div class="pa-msg pa-msg-${esc(role)}">
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
  function renderHistory(messages) {
    // renderHistory 會清空 body，因此重建後要重新置頂「任務上下文」橫幅。
    body().innerHTML = "";
    renderContextBanner();
    state.renderedSeq = 0;
    for (const m of messages || []) addMessage(m);
    if (!messages?.length) {
      body().insertAdjacentHTML("beforeend",
        `<div class="pa-msg-empty">尚無訊息。PA Agent 建立 run 後會在此顯示對話流。</div>`);
    }
  }
  function renderContextBanner() {
    const c = state.context;
    if (!c) return;
    const lines = [];
    if (c.title) lines.push("標題：" + c.title);
    if (c.case_variant_id) lines.push("case_variant_id：" + c.case_variant_id);
    if (c.node_id) lines.push("node_id：" + c.node_id);
    if (c.branch) lines.push("branch：" + c.branch);
    if (c.task && !lines.length) lines.push(c.task);
    if (!lines.length) return;
    const div = document.createElement("div");
    div.className = "pa-ctx";
    div.innerHTML = `<strong>任務上下文</strong><pre>${esc(lines.join("\n"))}</pre>`;
    body().prepend(div);
  }

  // ---------- 審閱優先：先建立（PENDING），不自動執行 ----------
  // 建立 AgentRun（PENDING）。執行意圖（case/指令）已在左欄呈現，
  // 使用者審閱後才點右欄「開始執行」呼叫 startRun()。
  async function createRun() {
    const c = state.context || {};
    const body_ = {
      case_variant_id: c.case_variant_id || "",
      node_id: c.node_id || "",
      expected_binding_revision: c.expected_binding_revision || "",
    };
    try {
      setStatus("建立中…", "busy");
      const res = await fetch(`${API}/runs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body_),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.run?.run_id) throw new Error(data.detail || data.error || ("HTTP " + res.status));
      state.runId = data.run.run_id;
      state.run = data.run;
      renderHistory([]);
      const canStart = !!c.node_id;
      setStatus(canStart ? "待審閱" : "已建立（未啟動）");
      renderReviewState(canStart, c);
      scrollBottom();
    } catch (e) {
      setStatus("失敗", "err");
      body().insertAdjacentHTML("beforeend",
        `<div class="pa-msg pa-msg-assistant"><div class="pa-msg-head"><span class="pa-msg-role">PA Agent</span></div>
           <div class="pa-msg-content pa-msg-error">建立 run 失敗：${esc(e.message)}</div></div>`);
      scrollBottom();
    }
  }

  // 渲染右欄「待審閱」狀態：未提供 node_id 時說明無法啟動；提供時顯示開始執行按鈕。
  function renderReviewState(canStart, c = {}) {
    const startBtn = root?.querySelector("#pa-drawer-start");
    if (startBtn) { startBtn.hidden = !canStart; startBtn.disabled = false; }
    body().insertAdjacentHTML("beforeend",
      `<div class="pa-review">
         <div class="pa-review-title">待審閱 · AgentRun 已建立（PENDING）</div>
         <div class="pa-review-text">請先審閱左欄「指派給 PA Agent 的指令」，確認執行意圖、目標節點與風險後，再決定是否執行。PA Agent 不會自動執行。</div>
         ${canStart
           ? `<div class="pa-review-meta">run_id：${esc(state.runId)} · node：${esc(c.node_id || "—")}</div>`
           : `<div class="pa-review-meta pa-review-warn">未指定 node_id，無法啟動。可稍後從執行紀錄啟動。</div>`}
       </div>`);
  }

  // 使用者按下「送出」後才啟動（審閱通過）。輸入框內容若有，一併帶給 agent。
  async function startRun() {
    if (!state.runId) return;
    const startBtn = root?.querySelector("#pa-drawer-start");
    const input = root?.querySelector("#pa-msg-input");
    const note = (input?.value || "").trim();
    if (startBtn) { startBtn.disabled = true; startBtn.textContent = "送出中…"; }
    if (note) { addUserMessage(note); input.value = ""; input.style.height = "auto"; }
    setStatus("啟動中…", "busy");
    try {
      const s = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_run: true, user_note: note }),
      });
      const sd = await s.json().catch(() => ({}));
      if (!s.ok) {
        // gateway 未接（502）等：run 仍存在，訊息可繼續讀。
        setStatus("啟動受挫", "err");
        body().insertAdjacentHTML("beforeend",
          `<div class="pa-msg pa-msg-assistant"><div class="pa-msg-head"><span class="pa-msg-role">PA Agent</span></div>
             <div class="pa-msg-content pa-msg-error">啟動失敗：${esc(sd.detail || sd.error || ("HTTP " + s.status))}</div></div>`);
        if (startBtn) { startBtn.disabled = false; startBtn.textContent = "送出"; }
        scrollBottom();
        return;
      }
      state.run = sd.run || state.run;
      if (startBtn) { startBtn.hidden = true; }
      setStatus("執行中…", "busy");
      beginPolling();
    } catch (e) {
      setStatus("啟動受挫", "err");
      if (startBtn) { startBtn.disabled = false; startBtn.textContent = "送出"; }
      body().insertAdjacentHTML("beforeend",
        `<div class="pa-msg pa-msg-assistant"><div class="pa-msg-head"><span class="pa-msg-role">PA Agent</span></div>
           <div class="pa-msg-content pa-msg-error">啟動失敗：${esc(e.message)}</div></div>`);
      scrollBottom();
    }
  }

  // ---------- 輪詢訊息 ----------
  function beginPolling() {
    cancelPolling();
    state.polling = true;
    pollOnce();
    state.timer = setInterval(pollOnce, POLL_MS);
  }
  async function pollOnce() {
    if (!state.runId) return;
    try {
      // 訊息（全量重取，以 seq 增量渲染；上限 500 已足夠對話規模）
      const mres = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/messages?limit=500`);
      const md = await mres.json().catch(() => ({}));
      if (!mres.ok) throw new Error(md.detail || ("HTTP " + mres.status));
      for (const m of md.messages || []) {
        if (m.seq > state.renderedSeq) { state.renderedSeq = m.seq; addMessage(m); }
      }
      // run 狀態
      const rres = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}`);
      const rd = await rres.json().catch(() => ({}));
      if (!rres.ok) throw new Error(rd.detail || ("HTTP " + rres.status));
      state.run = rd.run || state.run;
      renderActivity(state.run);
      applyRunStatus(state.run);
    } catch (e) {
      setStatus("連線中…", "busy");
    }
  }

  // 執行中的「活動」：agent 的動作（ActionEvent）與工具輸出（ObservationEvent）
  // 不是 MessageEvent，不會進對話流；若只等訊息，RUNNING 期間右欄會一片空白。
  // 這裡把最新的命令/證據以單一可變卡片呈現（就地更新，不堆積）。
  function renderActivity(run) {
    if (!run) return;
    const cmds = Array.isArray(run.commands) ? run.commands : [];
    const evi = Array.isArray(run.evidence) ? run.evidence : [];
    const lastCmd = cmds[cmds.length - 1];
    const lastEvi = evi[evi.length - 1];
    const lines = [];
    if (lastCmd) {
      const t = lastCmd.tool ? `[${lastCmd.tool}] ` : "";
      lines.push("▶ " + t + (lastCmd.thought || lastCmd.finish_message || "").trim());
    }
    if (lastEvi) {
      const c = typeof lastEvi.content === "string" ? lastEvi.content : JSON.stringify(lastEvi.content ?? "");
      lines.push("   ↳ " + c.trim());
    }
    let el = body().querySelector(".pa-activity");
    if (!lines.length) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.className = "pa-activity";
      body().appendChild(el);
    }
    el.innerHTML = `<div class="pa-activity-title">執行活動（${cmds.length} 命令 · ${evi.length} 證據）</div>
      <pre class="pa-msg-tool-io">${esc(lines.join("\n")).slice(0, 4000)}</pre>`;
    body().appendChild(el);
    scrollBottom();
  }
  function applyRunStatus(run) {
    if (!run) return;
    const st = run.status || "PENDING";
    setStatus(STATUS_LABEL[st] || st, TERMINAL.has(st) ? "" : "busy");
    if (TERMINAL.has(st)) {
      cancelPolling();
      // The agent's log is the deliverable: show it as the closing card so the
      // engineer can read it and reach their own verdict.
      if (run.final_result) {
        const div = document.createElement("div");
        div.innerHTML = messageCard({ seq: -1, role: "agent", kind: "finish",
          text: run.final_result, created_at: run.updated_at });
        body().appendChild(div.firstElementChild);
      }
      if (st === "ERROR" && run.failure_reason) {
        const div = document.createElement("div");
        div.innerHTML = messageCard({ seq: -2, role: "assistant", kind: "message",
          text: "執行錯誤：" + run.failure_reason, created_at: run.updated_at });
        body().appendChild(div.firstElementChild);
      }
      scrollBottom();
    }
  }
  function cancelPolling() {
    state.polling = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  // ---------- 對外 API ----------
  function open(context = {}) {
    // context: { case_variant_id, node_id?, expected_binding_revision?, branch?, title?, task?, rich? }
    state.context = context || {};
    ensureRoot();
    root.classList.add("open");
    state.started = true;
    state.renderedSeq = 0;
    state.runId = null;
    state.run = null;
    body().innerHTML = "";
    const startBtn = root?.querySelector("#pa-drawer-start");
    if (startBtn) { startBtn.hidden = true; startBtn.disabled = false; startBtn.textContent = "送出"; }
    // 先填左欄指令內容，再於其上方 prepend 資訊確認卡（若先 renderInfoCard 會被 renderLeftPanel 的 innerHTML 清掉）。
    renderLeftPanel();
    renderInfoCard();
    renderContextBanner();
    if (state.context.case_variant_id) {
      // 審閱優先：只建立（PENDING），不自動啟動；使用者點「送出」才啟動。
      createRun();
    } else {
      setStatus("就緒");
      body().innerHTML = `<div class="pa-msg-empty">未提供 case_variant_id，無法建立 AgentRun。請從指派結果視窗以該用例開啟。</div>`;
    }
  }
  // 左欄頂端：案例資訊確認卡（簡單 information 確認：用例/variant/節點/branch/指令摘要）。
  function renderInfoCard() {
    const left = root?.querySelector("#pa-drawer-case");
    if (!left) return;
    const c = state.context || {};
    const title = c.title || "—";
    const variant = c.case_variant_id || "—";
    const node = c.node_id || "—";
    const branch = c.branch || "—";
    const text = typeof c.task === "string" ? c.task : "";
    const lineCount = text ? text.split("\n").filter(l => l.trim()).length : 0;
    const card = document.createElement("div");
    card.className = "pa-info-card";
    card.innerHTML = `
      <div class="pa-info-card-title">📋 執行案例確認</div>
      <dl class="pa-info-grid">
        <dt>標題</dt><dd>${esc(title)}</dd>
        <dt>Variant</dt><dd class="pa-info-mono">${esc(variant)}</dd>
        <dt>目標節點</dt><dd class="pa-info-mono">${esc(node)}</dd>
        <dt>分支</dt><dd>${esc(branch)}</dd>
        <dt>指令規模</dt><dd>${lineCount} 行</dd>
      </dl>`;
    left.prepend(card);
  }

  // 左欄：指派給 PA Agent 的指令（測項內容）＝ rich HTML（無則退回 plain text）。
  function renderLeftPanel() {
    const left = root?.querySelector("#pa-drawer-case");
    if (!left) return;
    const c = state.context || {};
    const rich = typeof c.rich === "string" ? c.rich.trim() : "";
    const text = typeof c.task === "string" ? c.task : "";
    if (rich) { left.innerHTML = `<div class="pa-case-rich">${rich}</div>`; }
    else if (text) { left.innerHTML = `<pre class="pa-case-text">${esc(text)}</pre>`; }
    else { left.innerHTML = `<div class="pa-case-empty">（無指令內容）</div>`; }
  }
  function close() {
    if (!root) return;
    cancelPolling();
    state.started = false;
    root.classList.remove("open");
    document.removeEventListener("keydown", onKey);
    setTimeout(() => { if (root && !root.classList.contains("open")) { root.remove(); root = null; } }, 260);
  }

  window.PA_Agent = Object.freeze({ open, close });
})();
