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
     PASS / FAIL / BLOCKED / ERROR（終態）

   命名空間：window.PA_Agent = { open, close }
*/
(() => {
  "use strict";
  const API = "/api/agent";
  const POLL_MS = 2000;
  const TERMINAL = new Set(["PASS", "FAIL", "BLOCKED", "ERROR"]);

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const STATUS_LABEL = {
    PENDING: "待啟動",
    RUNNING: "執行中…",
    WAITING_FOR_USER: "等待回覆",
    PASS: "完成（PASS）",
    FAIL: "完成（FAIL）",
    BLOCKED: "已阻斷",
    ERROR: "錯誤",
  };
  const ROLE_LABEL = { user: "你", assistant: "PA Agent", tool: "PA Agent · 工具", system: "系統" };

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
        <div id="pa-drawer-body" class="pa-drawer-body" aria-live="polite"></div>
        <footer class="pa-drawer-foot">
          <span id="pa-drawer-hint" class="pa-drawer-hint">由 PA Backend AgentRun 處理；實際執行取決於 P3-d 授權策略</span>
        </footer>
      </aside>`;
    document.body.appendChild(root);
    root.querySelector("#pa-drawer-close").addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return root;
  }
  function onKey(e) { if (e.key === "Escape") close(); }

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

  // ---------- 建立並啟動 run ----------
  async function startRun() {
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
      if (!c.node_id) {
        setStatus("已建立（未啟動）");
        body().insertAdjacentHTML("beforeend",
          `<div class="pa-msg pa-msg-assistant"><div class="pa-msg-head"><span class="pa-msg-role">PA Agent</span></div>
             <div class="pa-msg-content">已建立 AgentRun（run_id：${esc(state.runId)}），未指定 node_id，故未啟動。可稍後從執行紀錄啟動。</div></div>`);
        scrollBottom();
        return;
      }
      setStatus("啟動中…", "busy");
      const s = await fetch(`${API}/runs/${encodeURIComponent(state.runId)}/start`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_run: true }),
      });
      const sd = await s.json().catch(() => ({}));
      if (!s.ok) {
        // gateway 未接（502）等：run 仍存在，訊息可繼續讀。
        setStatus("啟動受挫", "err");
        body().insertAdjacentHTML("beforeend",
          `<div class="pa-msg pa-msg-assistant"><div class="pa-msg-head"><span class="pa-msg-role">PA Agent</span></div>
             <div class="pa-msg-content pa-msg-error">啟動失敗：${esc(sd.detail || sd.error || ("HTTP " + s.status))}</div></div>`);
        scrollBottom();
        return;
      }
      state.run = sd.run || state.run;
      setStatus("執行中…", "busy");
      beginPolling();
    } catch (e) {
      setStatus("失敗", "err");
      body().insertAdjacentHTML("beforeend",
        `<div class="pa-msg pa-msg-assistant"><div class="pa-msg-head"><span class="pa-msg-role">PA Agent</span></div>
           <div class="pa-msg-content pa-msg-error">建立 run 失敗：${esc(e.message)}</div></div>`);
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
      applyRunStatus(state.run);
    } catch (e) {
      setStatus("連線中…", "busy");
    }
  }
  function applyRunStatus(run) {
    if (!run) return;
    const st = run.status || "PENDING";
    setStatus(STATUS_LABEL[st] || st, TERMINAL.has(st) ? "" : "busy");
    if (TERMINAL.has(st)) {
      cancelPolling();
      if (run.final_result) {
        const div = document.createElement("div");
        div.innerHTML = messageCard({ seq: -1, role: "assistant", kind: "message",
          text: "最終結果：" + run.final_result, created_at: run.updated_at });
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
    // context: { case_variant_id, node_id?, expected_binding_revision?, branch?, title?, task? }
    state.context = context || {};
    ensureRoot();
    root.classList.add("open");
    state.started = true;
    state.renderedSeq = 0;
    state.runId = null;
    state.run = null;
    body().innerHTML = "";
    renderContextBanner();
    if (state.context.case_variant_id) {
      startRun();
    } else {
      setStatus("就緒");
      body().innerHTML = `<div class="pa-msg-empty">未提供 case_variant_id，無法建立 AgentRun。請從指派結果視窗以該用例開啟。</div>`;
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

  window.PA_Agent = Object.freeze({ open, close });
})();
