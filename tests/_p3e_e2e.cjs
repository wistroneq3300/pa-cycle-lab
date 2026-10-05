/* P3-e E2E: PA Agent chat drawer.
   Drives the real window.PA_Agent.open(...) entry point (same one the
   assign-result "🤖 PA Agent 對話" button calls) and mocks the PA Backend
   /api/agent/* contract to verify: drawer opens, run is created+started,
   messages are polled and rendered, terminal status stops polling. */
const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:6969";
const MACHINE = "E2E-PA-01";
const VARIANT = "cv-e2e-0001";

(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror:" + e.message));

  const detail = { machine: { name: MACHINE, os_ip: "10.0.0.201", bmc_ip: "10.0.0.101", os_user: "root", os_alive: true, bmc_alive: false, active_os: 0, level: "system", os: [{ slot: 0, ip: "10.0.0.201", node_id: "eq3300", expected_binding_revision: "rev-1" }] } };

  let pollCount = 0;
  await page.route(/^http:\/\/127\.0\.0\.1:6969\/api\//, async (r) => {
    const u = new URL(r.request().url());
    const p = u.pathname;
    const j = (o, s = 200) => r.fulfill({ status: s, contentType: "application/json", body: JSON.stringify(o) });

    if (p === "/api/machines") return j({ machines: [{ name: MACHINE, os_ip: "10.0.0.201", bmc_ip: "10.0.0.101", os_user: "root", level: "system", state: "online", passive: true }] });
    if (p === `/api/machine/${MACHINE}/detail`) return j(detail);
    if (p === "/api/testlibrary/meta") return j({ version: 1, sheets: [] });
    if (p === "/api/projects") return j({ projects: [] });
    // --- PA Agent contract ---
    if (p === "/api/agent/runs" && r.request().method() === "POST") {
      return j({ ok: true, run: { run_id: "run-e2e-1", case_variant_id: VARIANT, status: "PENDING", context: {} } });
    }
    if (p === "/api/agent/runs/run-e2e-1/start" && r.request().method() === "POST") {
      return j({ ok: true, run_id: "run-e2e-1", conversation_ref: "conv-1", run: { run_id: "run-e2e-1", status: "RUNNING" } });
    }
    if (p === "/api/agent/runs/run-e2e-1/messages") {
      pollCount++;
      if (pollCount < 2) return j({ ok: true, messages: [] });
      return j({ ok: true, messages: [
        { seq: 1, role: "user", kind: "message", text: "請分析此指派結果", created_at: 1759200000 },
        { seq: 2, role: "agent", kind: "message", text: "收到，開始檢查節點 eq3300。", created_at: 1759200003 },
        { seq: 3, role: "tool", kind: "command", text: "ipmitool mc info\nCisco CIMC 4.1", created_at: 1759200005 },
      ] });
    }
    if (p === "/api/agent/runs/run-e2e-1") {
      // flip to DONE after a couple of polls (finished -> DONE, not PASS: the
      // agent only logs; PASS/FAIL is the engineer's call).
      const status = pollCount >= 3 ? "DONE" : "RUNNING";
      return j({ ok: true, run: { run_id: "run-e2e-1", status, final_result: status === "DONE" ? "節點健康，指派可執行。" : "",
        commands: [{ tool: "terminal", thought: "檢查 IPMI", timestamp: "t" }],
        evidence: [{ tool: "terminal", content: "Cisco CIMC 4.1", timestamp: "t" }] } });
    }
    return j({ error: p }, 404);
  });

  await page.goto(BASE + "/#/machine/" + MACHINE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  // Open the drawer exactly as the assign-result button does.
  await page.evaluate(({ variant, machine }) => {
    window.PA_Agent.open({
      case_variant_id: variant,
      node_id: "eq3300",
      expected_binding_revision: "rev-1",
      branch: machine,
      title: "E2E 指派測項",
      task: "PA Agent 依此測項與目標節點執行並回報結果。",
    });
  }, { variant: VARIANT, machine: MACHINE });

  const snap = async (tag) => {
    const d = await page.evaluate(() => {
      const root = document.querySelector("#pa-agent-drawer");
      const bodyEl = document.querySelector("#pa-drawer-body");
      return {
        open: !!(root && root.classList.contains("open")),
        hasClose: !!document.querySelector("#pa-drawer-close"),
        status: (document.querySelector("#pa-drawer-status") || {}).textContent,
        ctx: !!document.querySelector(".pa-ctx"),
        msgCount: bodyEl ? bodyEl.querySelectorAll(".pa-msg").length : 0,
        roles: bodyEl ? Array.from(bodyEl.querySelectorAll(".pa-msg-role")).map((n) => n.textContent) : [],
        hasLog: bodyEl ? /節點健康，指派可執行。/.test(bodyEl.textContent) : false,
        hasActivity: !!document.querySelector("#pa-drawer-body .pa-activity"),
      };
    });
    console.log(tag, JSON.stringify(d));
    return d;
  };

  await page.waitForTimeout(400);
  const a = await snap("after-open ");
  // Review-first: the run is only created (PENDING) until the user starts it.
  await page.evaluate(() => { const b = document.getElementById("pa-drawer-start"); if (b && !b.hidden) b.click(); });
  await page.waitForTimeout(4500); // let polling tick a few times
  const b = await snap("after-poll ");
  await page.waitForTimeout(2500);
  const c = await snap("after-final");
  await page.screenshot({ path: ".agent_tmp/p3e-drawer.png", animations: "disabled" });

  // close via Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => !document.querySelector("#pa-agent-drawer"));
  console.log("closed(escaped):", closed);

  console.log("pollCount:", pollCount);
  console.log("errors:", errs.slice(0, 5));
  await browser.close();

  let ok = true;
  const check = (cond, label) => { if (!cond) { ok = false; console.log("FAIL:", label); } };
  check(a.open && a.hasClose, "drawer opened with close button");
  check(a.ctx, "context banner rendered");
  check(/待審閱|待啟動/.test(a.status), "review-first: pending review before start");
  check(b.msgCount >= 3, ">=3 messages rendered");
  check(b.roles.includes("你") && b.roles.includes("PA Agent"), "user+assistant roles present");
  check(b.hasActivity, "live activity strip shown (commands/evidence not in chat)");
  check(/工程師判定/.test(c.status), "DONE status: 待工程師判定");
  check(c.hasLog, "agent log card shown on DONE");
  check(closed, "drawer removed after Escape");
  console.log(ok ? "\nP3-e E2E: PASS ✅" : "\nP3-e E2E: FAIL ❌");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("THROW", e); process.exit(1); });
