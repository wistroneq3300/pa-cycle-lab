"use strict";
/* E2E — P3-e: Assign Task -> PA Agent drawer hand-off (entry point #2).
 *
 * Drives the real production flow: open the genuine assign-task modal
 * (`openAssignTask`) -> pick sheet -> tick TWO cases -> 產生指令 (2) ->
 * 確認產生指令. The multi-case path renders the assign-result window; its
 * 🤖 PA Agent 對話 button (`#ar-pa-agent`) must hand the first chosen case to
 * PA_Agent.open, which opens the chat drawer and starts an AgentRun.
 * (A single-case selection short-circuits straight to PA_Agent.open; the
 * multi-case window is the path guarded here.)
 *
 * We intercept the PA Agent chat API (/api/agent/*) and the app's data APIs
 * with p.route() so no OpenHands session or real backend is required, and we
 * replace window.PA_Agent with a delegating wrapper (pa-agent.js exposes it
 * via Object.freeze, so the open property itself cannot be patched) to capture
 * exactly what the app handed over.
 *
 *   node tests/pa-agent-drawer-e2e.cjs
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const REPO = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPO, "app");
const PORT = process.env.PA_E2E_PORT || 9188;
const BASE = `http://127.0.0.1:${PORT}`;
const MACHINE = "E2E-PA-01";
const NODE_ID = "node-e2e-pa";
const VARIANT = "case-variant-e2e-001";
const SECOND_VARIANT = "case-variant-e2e-002";
const ITEM_LABEL = "PA Agent E2E 測試案例";
const SHEET = "e2e-sheet";

// Real /api/machines returns { machines: [...], last_scan } (integration/web.py).
// app.js requires Array.isArray(data.machines), so wrap in the object envelope.
const MACHINES_JSON = JSON.stringify({
  last_scan: "e2e",
  machines: [
    {
      name: MACHINE,
      os_ip: "10.0.0.201",
      bmc_ip: "10.0.0.101",
      os_user: "root",
      os_alive: true,
      bmc_alive: true,
      active_os: 0,
      os: [{ slot: 0, ip: "10.0.0.201", node_id: NODE_ID, expected_binding_revision: "rev-1" }],
    },
  ],
});
const META_JSON = JSON.stringify({
  version: 1,
  sheets: [{ sheet: SHEET, label: "E2E Sheet", count: 2, auto: 1, partial: 1, no: 0 }],
});
// /api/machine/{name}/detail — must return a success (non-error) shape, otherwise
// app.js detail view takes the "載入失敗" early-return branch (no 指派任務 button).
// bmc_alive:false avoids triggering background BMC sensor fetches (would 404 here).
const MACHINE_DETAIL_JSON = JSON.stringify({
  machine: {
    name: MACHINE,
    os_ip: "10.0.0.201",
    bmc_ip: "10.0.0.101",
    os_user: "root",
    os_alive: true,
    bmc_alive: false,
    active_os: 0,
    level: "system",
    os: [{ slot: 0, ip: "10.0.0.201", node_id: NODE_ID, expected_binding_revision: "rev-1" }],
  },
});
const SHEET_ITEMS_JSON = JSON.stringify({
  sheet: SHEET,
  items: [
    {
      case_variant_id: VARIANT,
      code: "E2E-PA-01",
      items: ITEM_LABEL,
      test_set: "E2E Set",
      ai_can_execute: "YES",
      ai_packages_needed: "",
      ai_commands: "echo e2e",
    },
    {
      case_variant_id: SECOND_VARIANT,
      code: "E2E-PA-02",
      items: "PA Agent E2E 第二測試案例",
      test_set: "E2E Set",
      ai_can_execute: "PARTIAL",
      ai_packages_needed: "",
      ai_commands: "echo e2e-2",
    },
  ],
});
const TYPE_BY_EXT = {
  html: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
};

async function serveStatic(page) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== BASE) return route.continue();
    const reqPath = decodeURIComponent(url.pathname);
    if (reqPath === "/" || reqPath === "/index.html") return route.continue();
    const fsPath = path.normalize(path.join(APP_DIR, reqPath));
    if (!fsPath.startsWith(APP_DIR)) {
      return route.fulfill({ status: 403, contentType: "text/plain", body: "forbidden" });
    }
    const stat = await new Promise((res) => fs.stat(fsPath, (err, s) => res(err ? null : s)));
    if (!stat || !stat.isFile()) {
      // Missing optional asset: return an empty 200 so the app does not log a
      // console error that would otherwise mask real page errors in this run.
      return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    }
    const data = await new Promise((res, rej) => fs.readFile(fsPath, (err, buf) => (err ? rej(err) : res(buf))));
    const ext = fsPath.split(".").pop().toLowerCase();
    route.fulfill({ status: 200, contentType: TYPE_BY_EXT[ext] || "application/octet-stream", body: data });
  });
}

async function serveJson(page) {
  let pollCount = 0;
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/api\//, async (route) => {
    const u = new URL(route.request().url());
    const key = u.pathname + u.search;
    const path = u.pathname;
    const method = route.request().method();
    const j = (o, s = 200) => route.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(o) });

    const table = {
      ["/api/machines"]: JSON.parse(MACHINES_JSON),
      ["/api/projects"]: { projects: [] },
      ["/api/machine/" + encodeURIComponent(MACHINE) + "/detail"]: JSON.parse(MACHINE_DETAIL_JSON),
      ["/api/testlibrary/meta"]: JSON.parse(META_JSON),
      ["/api/testlibrary?sheet=" + encodeURIComponent(SHEET)]: JSON.parse(SHEET_ITEMS_JSON),
    };
    if (key in table) return j(table[key]);

    // PA Agent gateway contract (integration/agent_routes.py).
    if (path === "/api/agent/runs" && method === "POST") {
      return j({ ok: true, run: { run_id: "run-e2e-1", case_variant_id: VARIANT, status: "PENDING", context: {} } });
    }
    if (path === "/api/agent/runs/run-e2e-1/start" && method === "POST") {
      return j({ ok: true, run_id: "run-e2e-1", conversation_ref: "conv-1", run: { run_id: "run-e2e-1", status: "RUNNING" } });
    }
    if (path === "/api/agent/runs/run-e2e-1/messages") {
      pollCount++;
      return j({ ok: true, messages: [
        { seq: 1, role: "user", kind: "message", text: "請分析此指派結果", created_at: 1759200000 },
        { seq: 2, role: "agent", kind: "message", text: `PA Agent E2E transcript for ${VARIANT}.`, created_at: 1759200003 },
      ] });
    }
    if (path === "/api/agent/runs/run-e2e-1") {
      // finished -> DONE (never PASS/FAIL: the agent only logs; the engineer decides).
      const status = pollCount >= 2 ? "DONE" : "RUNNING";
      return j({ ok: true, run: { run_id: "run-e2e-1", status,
        final_result: status === "DONE" ? "E2E agent log: lspci shows 2 GPUs; LnkSta x16." : "" } });
    }

    // Unmocked API routes return an empty success object rather than 404 so the
    // app's background pollers do not emit console errors during the run.
    return j({});
  });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE + "/");
      if (res.ok) return true;
    } catch { /* server not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

(async () => {
  const up = await waitForServer();
  if (!up) {
    console.error(`[e2e] FATAL: server not reachable at ${BASE} after 30s`);
    process.exit(2);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e && e.message ? e.message : e)));
  page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push("[console.error] " + m.text());
  });

  await serveStatic(page);
  await serveJson(page);

  let opened = null;
  // pa-agent.js exposes `window.PA_Agent = Object.freeze({ open, close })`, so the
  // open() property cannot be reassigned. Capture the hand-off by replacing the
  // whole (replaceable) window.PA_Agent binding with a delegating wrapper.
  await page.addInitScript(() => {
    window.__paOpen = null;
    const iv = setInterval(() => {
      const real = window.PA_Agent;
      if (real && typeof real.open === "function" && !real.__wrapped) {
        const wrapped = Object.freeze({
          open: (ctx) => { window.__paOpen = ctx; return real.open(ctx); },
          close: real.close,
          __wrapped: true,
        });
        try { window.PA_Agent = wrapped; } catch { /* binding not writable */ }
        clearInterval(iv);
      }
    }, 20);
  });

  await page.goto(BASE + "/#/" + encodeURIComponent("machine/" + MACHINE), {
    waitUntil: "domcontentloaded",
  });

  await page.waitForFunction(
    () => !!window.PA_Agent && typeof window.PA_Agent.open === "function",
    null,
    { timeout: 15000 },
  ).catch((e) => {
    console.error("[e2e] PA_Agent not available:", e && e.message);
    process.exit(3);
  });

  // Open the assign-task modal. The System Workspace renderer no longer exposes
  // the legacy `.mach-toolbar` entry, so drive the real modal function directly.
  await page.waitForFunction(
    () => typeof window.openAssignTask === "function",
    null,
    { timeout: 15000 },
  );
  await page.evaluate((m) => window.openAssignTask(m), MACHINE);

  // Sheet-card grid appears; pick the sheet.
  await page.waitForSelector(".assign-sheet-card", { timeout: 10000 });
  await page.locator(".assign-sheet-card").first().click();

  // Item list; tick the first TWO cases so the multi-case path runs
  // (single-case selections hand off directly; 2+ open the assign-result
  // window whose 🤖 PA Agent 對話 button opens the drawer).
  await page.waitForSelector(".eng-case-row input[type=checkbox]", { timeout: 10000 });
  const boxes = page.locator(".eng-case-row input[type=checkbox]");
  await boxes.nth(0).check();
  await boxes.nth(1).check();

  // Footer action reads 產生指令 (2) once cases are selected.
  const genBtn = page.locator('button:has-text("產生指令")').first();
  await genBtn.waitFor({ state: "visible", timeout: 10000 });
  await genBtn.click();

  // workspace-ux wraps assignTaskCopy with a confirm step.
  const confirmBtn = page.locator('button:has-text("確認產生指令")').first();
  await confirmBtn.waitFor({ state: "visible", timeout: 10000 });
  await confirmBtn.click();

  // The assign-result window renders; its 🤖 button must hand the FIRST chosen
  // case (VARIANT) to PA_Agent.open — this is the entry-point #2 bug guard.
  const paBtn = page.locator("#ar-pa-agent").first();
  await paBtn.waitFor({ state: "visible", timeout: 10000 });
  await paBtn.click();

  // PA_Agent.open captured with the real hand-off context.
  await page.waitForFunction(() => window.__paOpen !== null, null, { timeout: 15000 });
  opened = await page.evaluate(() => window.__paOpen);

  // The 🤖 window handler titles the run and passes the machine as branch.
  const EXPECT_TITLE = "PA Agent 分析指派結果 · " + MACHINE;

  // PA Agent drawer visible in the DOM.
  await page.waitForSelector("#pa-agent-drawer.open", { timeout: 10000 });
  const drawerVisible = await page.evaluate(() => {
    const el = document.getElementById("pa-agent-drawer");
    return !!el && el.classList.contains("open") && el.offsetWidth > 0 && el.offsetHeight > 0;
  });
  const ctxRendered = await page.evaluate(() => !!document.querySelector("#pa-agent-drawer .pa-ctx"));
  // 新兩欄：左欄測項內容應有內容（rich 或 text 之一）。
  const leftPane = await page.evaluate(() => {
    const el = document.querySelector("#pa-agent-drawer #pa-drawer-case");
    return el ? (el.textContent || "").trim() : "";
  });
  const statusText = await page.evaluate(() => {
    const el = document.getElementById("pa-drawer-status");
    return el ? el.textContent : "";
  });
  // 審閱優先：open() 只建立 PENDING run，不自動執行。先確認「開始執行」
  // 按鈕已顯示（待審閱），訊息尚未開始輪詢。
  await page.waitForSelector("#pa-drawer-start", { state: "visible", timeout: 10000 }).catch(() => {});
  const reviewState = await page.evaluate(() => {
    const btn = document.getElementById("pa-drawer-start");
    return {
      startVisible: !!(btn && !btn.hidden && btn.offsetWidth > 0),
      reviewBanner: !!document.querySelector("#pa-drawer-body .pa-review"),
      status: (document.getElementById("pa-drawer-status") || {}).textContent || "",
      msgsBefore: (document.querySelector("#pa-drawer-body") || { querySelectorAll: () => [] }).querySelectorAll(".pa-msg").length,
    };
  });
  // 使用者在輸入框打字後按 Enter → 應等同按「送出」→ 觸發 /start 並帶上該訊息。
  const ENTER_NOTE = "E2E-ENTER-NOTE: 請優先檢查 PCIe link";
  await page.fill("#pa-msg-input", ENTER_NOTE);
  await page.focus("#pa-msg-input");
  await page.keyboard.press("Enter");
  // Enter 送出是非同步：等送出鈕隱藏（= start 已發出）再讀狀態。
  await page.waitForFunction(
    () => { const b = document.getElementById("pa-drawer-start"); return b && b.hidden; },
    null, { timeout: 5000 },
  ).catch(() => {});
  // Enter 應已送出：run 啟動 → 送出鈕隱藏，且訊息以「你」卡片顯示。
  const enterResult = await page.evaluate((note) => {
    const btn = document.getElementById("pa-drawer-start");
    const body = document.getElementById("pa-drawer-body");
    const userMsgs = body
      ? Array.from(body.querySelectorAll(".pa-msg-role")).filter((n) => n.textContent === "你").length
      : 0;
    return {
      startHidden: !!btn && btn.hidden,
      noteShown: (body ? body.textContent : "").includes(note),
      userMsgs,
    };
  }, ENTER_NOTE);
  await page.waitForFunction(
    () => {
      const b = document.querySelector("#pa-drawer-body");
      return b && b.querySelectorAll(".pa-msg").length >= 2;
    },
    null,
    { timeout: 15000 },
  ).catch(() => {});
  const msgInfo = await page.evaluate(() => {
    const b = document.querySelector("#pa-drawer-body");
    return {
      count: b ? b.querySelectorAll(".pa-msg").length : 0,
      roles: b ? Array.from(b.querySelectorAll(".pa-msg-role")).map((n) => n.textContent) : [],
    };
  });
  // Let the poll settle the run to DONE before reading the final status.
  await page.waitForFunction(
    () => ((document.getElementById("pa-drawer-status") || {}).textContent || "").includes("工程師判定"),
    null, { timeout: 10000 },
  ).catch(() => {});

  // Centered two-column modal: the panel is horizontally + vertically centered
  // and a scrim covers the viewport (click-to-dismiss).
  const modal = await page.evaluate(() => {
    const panel = document.querySelector("#pa-agent-drawer .pa-drawer-panel");
    const scrim = document.querySelector("#pa-agent-drawer .pa-drawer-scrim");
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const cs = getComputedStyle(scrim || panel);
    return {
      cx: Math.abs((r.left + r.right) / 2 - window.innerWidth / 2),
      cy: Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2),
      hasScrim: !!scrim && cs.pointerEvents === "auto" && parseFloat(cs.opacity) > 0,
      cols: getComputedStyle(document.querySelector("#pa-agent-drawer .pa-drawer-cols")).flexDirection,
    };
  });
  // Status re-read after the run settles (statusText above was taken pre-start).
  const finalStatusText = await page.evaluate(() => {
    const el = document.getElementById("pa-drawer-status");
    return el ? el.textContent : "";
  });
  const doneStatus = finalStatusText.includes("工程師判定");

  const checks = [
    ["PA_Agent.open captured", !!opened],
    ["case_variant_id (first chosen case)", opened && opened.case_variant_id === VARIANT],
    ["node_id", opened && opened.node_id === NODE_ID],
    ["branch (machine name)", opened && opened.branch === MACHINE],
    ["title", opened && opened.title === EXPECT_TITLE],
    ["task carries assignment text", !!(opened && opened.task && opened.task.length > 0)],
    ["drawer element present + open", drawerVisible],
    ["context banner rendered", ctxRendered],
    ["left pane shows testcase content", leftPane.length > 0],
    ["run created (status shown)", statusText.length > 0],
    // 審閱優先：未自動執行 —— 開始執行按鈕已顯示 + 待審閱橫幅 + 尚未輪詢訊息。
    ["review-first: 開始執行 button shown", reviewState.startVisible],
    ["review-first: review banner present", reviewState.reviewBanner],
    ["review-first: not auto-started (0 msgs before click)", reviewState.msgsBefore === 0],
    ["Enter-to-send: typing + Enter started the run (送出 hidden)", enterResult.startHidden],
    ["Enter-to-send: typed note shown as user card", enterResult.noteShown],
    ["messages polled + rendered", msgInfo.count >= 2],
    ["user+assistant roles present", msgInfo.roles.includes("你") && msgInfo.roles.includes("PA Agent")],
    // Centered two-column modal + scrim.
    ["centered two-column modal", !!modal && modal.cx <= 2 && modal.cy <= 2],
    ["two columns side-by-side (row)", !!modal && modal.cols === "row"],
    ["scrim present + interactive", !!modal && modal.hasScrim],
    // Retired verdict: DONE card carries the agent's log, status says 待工程師判定.
    ["DONE status: 待工程師判定", doneStatus],
    ["agent log card rendered", msgInfo.roles.includes("PA Agent")],
  ];

  console.log("\n== P3-e E2E: PA Agent drawer hand-off ==");
  for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (pageErrors.length) {
    console.log("\npage errors:");
    for (const e of pageErrors.slice(0, 8)) console.log("  " + e);
  }

  await browser.close();
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    console.error(`\nRESULT: FAIL (${failed.length}/${checks.length})`);
    process.exit(1);
  }
  if (pageErrors.length) {
    console.error(`\nRESULT: FAIL (page errors: ${pageErrors.length})`);
    process.exit(1);
  }
  console.log(`\nRESULT: PASS (${checks.length}/${checks.length})`);
})().catch((e) => {
  console.error("[e2e] unhandled:", e && e.stack ? e.stack : e);
  process.exit(1);
});
