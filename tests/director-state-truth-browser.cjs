"use strict";

/*
 * Director state-truth regressions.
 *
 * This suite loads the working-tree production scripts in a real browser and
 * supplies only explicit API fixtures. Any unexpected /api request is answered
 * with 599 and fails the owning test. No backend, saved data, or hardware is
 * used.
 *
 * Run:
 *   PLAYWRIGHT_MODULE=<playwright module> node tests/director-state-truth-browser.cjs
 */

const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const REPO = path.resolve(__dirname, "..");
const JS = name => path.join(REPO, "app", "static", "js", name);
const BASE = "http://127.0.0.1:19491";

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

async function harness(browser, name, apiHandler, run, initScript) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const unexpected = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message || String(error)));
  if (initScript) await page.addInitScript(initScript);
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === BASE && url.pathname === "/__director_harness__") {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<!doctype html><html><head><meta charset=utf-8></head><body></body></html>",
      });
      return;
    }
    if (url.origin === BASE && url.pathname.startsWith("/api/")) {
      let handled = false;
      if (apiHandler) handled = await apiHandler({ route, url, method: route.request().method() });
      if (!handled) {
        unexpected.push(`${route.request().method()} ${url.pathname}${url.search}`);
        await json(route, { detail: "STRICT MOCK: unexpected API" }, 599);
      }
      return;
    }
    unexpected.push(`${route.request().method()} ${url.href}`);
    await route.fulfill({ status: 599, contentType: "text/plain", body: "STRICT MOCK: unexpected resource" });
  });
  try {
    await page.goto(BASE + "/__director_harness__", { waitUntil: "domcontentloaded" });
    await run(page);
    await page.waitForTimeout(30);
    assert.deepEqual(unexpected, [], `${name}: unexpected API/resource requests`);
    assert.deepEqual(pageErrors, [], `${name}: browser page errors`);
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

async function telemetryTruth(browser) {
  const analyses = [
    { ok: false, error: "analysis provider rejected the request" },
    { ok: true, analysis: "   " },
  ];
  let analysisCalls = 0;
  let chartCalls = 0;
  await harness(browser, "D01 telemetry 200/ok:false and empty analysis", async ({ route, url, method }) => {
    if (method === "GET" && /\/api\/machine\/director\/telemetry\/analyze$/.test(url.pathname)) {
      await json(route, analyses[analysisCalls++]);
      return true;
    }
    if (method === "GET" && url.pathname === "/api/telemetry/nodes/node-director/charts") {
      chartCalls += 1;
      await json(route, {
        state: "READY",
        last_sample: { host: 1700000000 },
        stats: { uptime: [{ value: 0 }], load: [{ value: 0 }], filesystem: [] },
        panels: [{ id: "cpu", title: "CPU", state: "NO_DATA", unit: "%", series: [] }],
      });
      return true;
    }
    return false;
  }, async page => {
    await page.addScriptTag({ path: JS("telemetry-native.js") });
    const node = { node_id: "node-director", state: "READY", components: { host: "READY", prometheus: "READY", gpu: { state: "READY" } } };

    await page.evaluate(nodeArg => {
      const root = document.createElement("main");
      root.id = "telemetry-one";
      document.body.append(root);
      window.__telemetry = new window.PANativeTelemetry.Dashboard(root, nodeArg, "director");
    }, node);
    await page.waitForFunction(() => document.querySelector("#telemetry-one [data-ai-state]")?.dataset.state === "ERROR");
    assert.equal(await page.locator("#telemetry-one [data-ai-state]").innerText(), "分析未完成");
    assert.equal(await page.locator("#telemetry-one [data-ai]").innerText(), "analysis provider rejected the request");
    const stats = await page.locator("#telemetry-one .tn-stats").innerText();
    assert.match(stats, /Uptime\s*0d 0h/);
    assert.match(stats, /Load 1m\s*0\.00/);
    assert.match(stats, /GPU Count\s*未取得/);
    await page.evaluate(() => window.__telemetry.dispose());

    await page.evaluate(nodeArg => {
      const root = document.createElement("main");
      root.id = "telemetry-two";
      document.body.append(root);
      window.__telemetry2 = new window.PANativeTelemetry.Dashboard(root, nodeArg, "director");
    }, node);
    await page.waitForFunction(() => document.querySelector("#telemetry-two [data-ai-state]")?.dataset.state === "EMPTY");
    assert.equal(await page.locator("#telemetry-two [data-ai-state]").innerText(), "尚無分析結果");
    assert.equal(await page.locator("#telemetry-two [data-ai]").innerText(), "此範圍尚無可用的 AI 分析結果。");
    await page.evaluate(() => window.__telemetry2.dispose());
    assert.equal(analysisCalls, 2);
    assert.equal(chartCalls, 2);
  });
}

async function assignmentAndSensorTruth(browser) {
  await harness(browser, "D02/D08/D10 batch clipboard, workflow copy, sensor counts", null, async page => {
    await page.addScriptTag({ path: JS("app.js") });
    const result = await page.evaluate(async () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => { throw new Error("clipboard denied"); } },
      });
      document.execCommand = () => false;
      window.__notices = [];
      window.uxNotify = (message, isError) => window.__notices.push({ message, isError });
      window.PA_Agent = { open() {} };

      const zeroSensors = machineSensorsHtml({ sensors: {
        critical: 0, warning: 0, ok: 0, ns: 0,
        critical_entries: [], warning_entries: [], entries: [],
      } }, { bmc_alive: true }, "director");
      const missingSensors = machineSensorsHtml({ sensors: {
        critical_entries: [], warning_entries: [], entries: [],
      } }, { bmc_alive: true }, "director-missing");

      machines = [{
        name: "Director DUT", project: "Director", os_ip: "192.0.2.10", os_user: "root",
        active_os: 0, os: [{ slot: 0, node_id: "node-director", ip: "192.0.2.10", expected_binding_revision: "rev-1" }],
      }];
      _assignTask.name = "Director DUT";
      _assignTask.machine = machines[0];
      _assignTask.sheet = { sheet: "director", label: "Director Cases" };
      _assignTask.items = [
        { case_variant_id: "director-a", code: "DIR-A", items: "First truth case", test_set: "Truth", ai_can_execute: "YES", ai_commands: "printf first" },
        { case_variant_id: "director-b", code: "DIR-B", items: "Second truth case", test_set: "Truth", ai_can_execute: "PARTIAL", ai_commands: "printf second" },
      ];
      _assignTask.sel = new Set(["director-a", "director-b"]);
      const one = assignTaskActionMeta(1);
      const two = assignTaskActionMeta(2);
      await assignTaskCopy();
      return { zeroSensors, missingSensors, one, two, notices: window.__notices };
    });

    assert.match(result.zeroSensors, />0<\/b><span>Critical/);
    assert.match(result.zeroSensors, /無異常感測器/);
    assert.doesNotMatch(result.zeroSensors, /不能判定為無異常/);
    assert.match(result.missingSensors, /未取得/);
    assert.match(result.missingSensors, /不能判定為無異常/);
    assert.equal(result.one.kind, "agent");
    assert.equal(result.one.label, "交給 PA Agent");
    assert.equal(result.two.kind, "batch");
    assert.match(result.two.label, /產生批次指令 \(2\)/);
    assert.match(result.two.note, /未啟動 Agent/);

    const hint = page.locator("#ar-hint");
    assert.equal(await hint.getAttribute("data-state"), "error");
    assert.match(await hint.innerText(), /批次指令已產生，但剪貼簿寫入失敗/);
    assert.equal(await page.locator("#ar-pa-agent").isHidden(), true);
    const generated = await page.locator("#ar-pre").innerText();
    assert.match(generated, /First truth case/);
    assert.match(generated, /Second truth case/);
    assert(result.notices.some(item => item.isError && /剪貼簿無法寫入/.test(item.message)));

    await page.locator("#ar-copy-all").click();
    assert.equal(await hint.getAttribute("data-state"), "error");
    assert.match(await hint.innerText(), /內容仍保留/);
    assert.equal(await page.locator("#ar-copy-all").isEnabled(), true);
  });
}

async function agentTruth(browser) {
  const longToolOutput = "tool-output:" + "X".repeat(4300) + "<not-markup>";
  const commands = Array.from({ length: 10 }, (_, index) => ({ tool: "terminal", thought: `command-${index}` }));
  const evidence = Array.from({ length: 10 }, (_, index) => ({ content: `evidence-${index}` }));
  let deletes = 0;
  await harness(browser, "D03/D04 attachment delete retention and output disclosure", async ({ route, url, method }) => {
    if (method === "GET" && url.pathname === "/api/agent/active") {
      await json(route, { run: { run_id: "run-director", status: "RUNNING", commands: [], evidence: [] } });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-director/messages") {
      await json(route, { messages: [{ seq: 1, role: "tool", kind: "command", text: longToolOutput, created_at: 1700000000 }] });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-director") {
      await json(route, { run: { run_id: "run-director", status: "DONE", commands, evidence, final_result: "" } });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-director/attachments/unconsumed") {
      await json(route, { attachments: [{ attachment_id: "att-director", name: "director.log", size: 19, kind: "file", status: "ready" }] });
      return true;
    }
    if (method === "DELETE" && url.pathname === "/api/agent/runs/run-director/attachments/att-director") {
      deletes += 1;
      await json(route, { detail: "retention lock refused delete" }, 503);
      return true;
    }
    return false;
  }, async page => {
    await page.addScriptTag({ path: JS("pa-agent.js") });
    await page.evaluate(() => window.PA_Agent.open({ case_variant_id: "director-case", title: "Director truth" }));
    await page.waitForSelector(".pa-msg-tool .pa-output-full");
    await page.waitForSelector(".pa-activity .pa-output-full", { state: "attached" });
    await page.waitForSelector('[data-id="att-director"]');

    const messageDisclosure = await page.locator(".pa-msg-tool .pa-output-disclosure").innerText();
    assert.match(messageDisclosure, /4,000 \/ 4,3\d\d 字/);
    assert.match(messageDisclosure, /內容已截斷/);
    assert.equal((await page.locator(".pa-msg-tool .pa-output-preview > pre").innerText()).length, 4000);
    assert.match(await page.locator(".pa-msg-tool .pa-output-full pre").textContent(), /<not-markup>$/);

    const activityDisclosure = await page.locator(".pa-activity > .pa-output-disclosure").textContent();
    assert.match(activityDisclosure, /最近 8 \/ 10 個動作、8 \/ 10 筆證據/);
    assert.match(await page.locator(".pa-activity > .pa-output-full pre").textContent(), /command-0/);
    assert.match(await page.locator(".pa-activity > .pa-output-full pre").textContent(), /evidence-0/);

    await page.locator('[data-rm="att-director"]').click();
    await page.waitForSelector('[data-id="att-director"] [role="alert"]');
    assert.equal(await page.locator('[data-id="att-director"]').count(), 1);
    assert.match(await page.locator('[data-id="att-director"] [role="alert"]').innerText(), /retention lock refused delete/);
    assert.equal(deletes, 1);
    await page.evaluate(() => window.PA_Agent.close());
  });
}

async function evidenceTruth(browser) {
  let copied = null;
  await harness(browser, "D07 evidence loading/error/empty copy gating", async ({ route, url, method }) => {
    if (method !== "GET") return false;
    if (url.pathname.endsWith("/evidence/slow/view")) {
      await new Promise(resolve => setTimeout(resolve, 180));
      await json(route, { text: "loaded evidence", source: "sensor", collected_at: 1700000000, truncated: false });
      return true;
    }
    if (url.pathname.endsWith("/evidence/error/view")) {
      await json(route, { detail: "snapshot storage unavailable" }, 503);
      return true;
    }
    if (url.pathname.endsWith("/evidence/empty/view")) {
      await json(route, { text: "", truncated: false });
      return true;
    }
    return false;
  }, async page => {
    await page.addScriptTag({ path: JS("inspection-evidence.js") });
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async text => { window.__evidenceCopied = text; } },
      });
      void window.InspectionEvidence.open("/api/machine/director/inspection", "slow", "Director / sensor");
    });
    await page.waitForSelector("dialog.pa-evidence-modal");
    assert.equal(await page.locator("dialog [data-copy]").isDisabled(), true);
    assert.equal(await page.locator("dialog input[type=search]").isDisabled(), true);
    assert.equal(await page.locator("dialog [data-next]").isDisabled(), true);
    assert.equal(await page.locator("dialog [data-status]").innerText(), "載入中…");
    await page.waitForFunction(() => document.querySelector("dialog [data-status]")?.dataset.state === "loaded");
    assert.equal(await page.locator("dialog [data-copy]").isEnabled(), true);
    await page.locator("dialog [data-copy]").click();
    copied = await page.evaluate(() => window.__evidenceCopied);
    assert.equal(copied, "loaded evidence");
    const windowClosed = await page.evaluate(() => { window.InspectionEvidence.close(); return !document.querySelector("dialog"); });
    assert.equal(windowClosed, true);

    await page.evaluate(() => { void window.InspectionEvidence.open("/api/machine/director/inspection", "error"); });
    await page.waitForFunction(() => document.querySelector("dialog [data-status]")?.dataset.state === "error");
    assert.match(await page.locator("dialog [data-status]").innerText(), /snapshot storage unavailable/);
    assert.equal(await page.locator("dialog [data-copy]").isDisabled(), true);
    assert.equal(await page.locator("dialog input[type=search]").isDisabled(), true);
    await page.evaluate(() => window.InspectionEvidence.close());

    await page.evaluate(() => { void window.InspectionEvidence.open("/api/machine/director/inspection", "empty"); });
    await page.waitForFunction(() => document.querySelector("dialog [data-status]")?.dataset.state === "empty");
    assert.match(await page.locator("dialog [data-status]").innerText(), /文件為空/);
    assert.equal(await page.locator("dialog [data-copy]").isDisabled(), true);
    assert.equal(await page.locator("dialog input[type=search]").isDisabled(), true);
    assert.match(await page.locator("dialog [data-source]").innerText(), /來源未提供/);
    assert.match(await page.locator("dialog [data-source]").innerText(), /採集時間未提供/);
    await page.evaluate(() => window.InspectionEvidence.close());
  });
}

async function inspectionTruth(browser) {
  await harness(browser, "D05/D10 inspection optional fields and zero-vs-missing", async ({ route, url, method }) => {
    if (method === "GET" && url.pathname === "/api/machine/director/inspection" && !url.search) {
      await json(route, {
        error: "", running: false, delayed: false,
        config: { enabled: false, thresholds: {} },
        summary: {}, lifecycle_counts: { recovered: 0 },
        nodes: [{ node_id: "node-director", label: "Director node" }],
        identity: {}, identity_history: [], coverage: [], progress: [],
        last_fast_at: 0, last_completed_at: 0, last_deep_at: 0,
      });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/machine/director/inspection/issues") {
      await json(route, { issues: [{
        id: "issue-director", node_id: "node-director", status: "ACTIVE", severity: "WARN",
        component: "CPU", rule: "cpu.utilization.high", facts: "Observed load",
        first_seen_at: 0, last_seen_at: 0, resolved_at: null,
        occurrences: 0, observations: null,
        evidence: "", acknowledged: false, known_issue: false, mute_until: 0,
        analysis: { state: "COMPLETE", result: { possible_causes: null, recommended_checks: ["", "Inspect cooling"], conclusion: null } },
      }] });
      return true;
    }
    return false;
  }, async page => {
    await page.addScriptTag({ path: JS("system-inspection.js") });
    await page.evaluate(() => {
      const workspace = document.createElement("main");
      workspace.className = "pd-workspace";
      workspace.innerHTML = '<span data-health-summary></span>' + window.SystemInspection.card();
      document.body.append(workspace);
      window.SystemInspection.mount("director");
    });
    await page.waitForFunction(() => document.querySelector("#pd-inspection [data-status]")?.textContent === "排程未啟用");
    assert.equal(await page.locator("#pd-inspection [data-fail]").innerText(), "未取得");
    assert.equal(await page.locator("#pd-inspection [data-warning]").innerText(), "未取得");
    assert.match(await page.locator("#pd-inspection [data-history-count]").innerText(), /最近恢復 0 · 歷史問題 未取得/);
    assert.equal(await page.locator(".pd-workspace [data-health-summary]").innerText(), "未取得 FAIL · 未取得 Warning");

    await page.locator("#pd-inspection [data-view]").click();
    await page.waitForSelector('[data-issue-id="issue-director"]');
    const issueText = await page.locator('[data-issue-id="issue-director"]').textContent();
    assert.match(issueText, /發生 0 次/);
    assert.match(issueText, /觀測 未取得 次/);
    assert.match(issueText, /復發 未取得 次/);
    assert.match(issueText, /判讀：未提供/);
    assert.match(issueText, /建議檢查[\s\S]*Inspect cooling/);
    assert.doesNotMatch(issueText, /undefined|null/);
    await page.evaluate(() => window.SystemInspection.dispose());
  });
}

async function cycleTruth(browser) {
  let phase = "history";
  let deletes = 0;
  let historyReads = 0;
  await harness(browser, "D06/D10 cycle async confirm, single DELETE, missing counters", async ({ route, url, method }) => {
    if (method === "GET" && url.pathname === "/api/cycle/runs" && phase === "history") {
      historyReads += 1;
      await json(route, { runs: [{ id: "Director_power_cycle_run-01", project: "Director", state: "COMPLETE", health: "OK", synthetic: true, created_at: 1700000000 }], has_more: false });
      return true;
    }
    if (method === "DELETE" && url.pathname === "/api/cycle/runs/Director_power_cycle_run-01") {
      deletes += 1;
      await json(route, { ok: true });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/cycle/runs/run-truth" && phase === "run") {
      await json(route, {
        id: "run-truth", project: "Director", state: "COMPLETE", health: "OK", synthetic: true,
        heartbeat: 1700000000, stop_requested: false, stop_reason: "", pre: null,
        targets: [{ name: "node-director", parent_name: "Director rack", node: "Node A", slot_key: "slot-a", os_ip: "192.0.2.10", os_port: 22, node_id: "node-id-a" }],
        nodes: [{ machine_id: "node-director", stage: "COMPLETE", loop: 0, attempts: 0, completed: null, boot_confirmed: 0, valid_cycles: null, health: "OK", cumulative_health: "OK", first_this_round: 0, unique_issues: null }],
      });
      return true;
    }
    return false;
  }, async page => {
    await page.addScriptTag({ path: JS("cycle-workspace.js") });
    await page.evaluate(() => {
      window.__confirmCalls = [];
      window.__confirmResult = false;
      window.uxConfirm = async message => { window.__confirmCalls.push(message); return window.__confirmResult; };
      document.body.innerHTML = window.CycleWorkspace.shell();
      location.hash = "#/cycle";
      return window.CycleWorkspace.mount();
    });
    await page.waitForSelector(".cw-del");
    await page.locator(".cw-del").click();
    await page.waitForTimeout(40);
    assert.equal(deletes, 0);
    assert.equal((await page.evaluate(() => window.__confirmCalls)).length, 1);
    assert.match((await page.evaluate(() => window.__confirmCalls[0])), /Evidence 與 log/);

    await page.evaluate(() => { window.__confirmResult = true; });
    await page.locator(".cw-del").click();
    await page.waitForFunction(() => document.querySelector(".cw-del")?.disabled === false);
    assert.equal(deletes, 1);
    assert.equal(historyReads, 2);

    phase = "run";
    await page.evaluate(() => {
      window.CycleWorkspace.dispose();
      window.CycleConsole = class { close() {} setJob() {} };
      document.body.innerHTML = window.CycleWorkspace.shell();
      location.hash = "#/cycle/runs/run-truth";
      return window.CycleWorkspace.mount();
    });
    await page.waitForSelector('[data-node="node-director"]');
    const topCells = await page.locator(".cw-progress-table tbody tr > td").allInnerTexts();
    assert.equal(topCells[1], "0");
    assert.equal(topCells[2], "未取得");
    const detail = await page.locator('[data-node="node-director"] .cw-progress-detail-grid').textContent();
    assert.match(detail, /嘗試次數\s*0/);
    assert.match(detail, /POST · 完成採集\s*未取得/);
    assert.match(detail, /Boot · 開機確認\s*0/);
    assert.match(detail, /本輪首次 \/ 累積問題\s*0 \/ 未取得/);
    assert.match(detail, /執行覆蓋\s*Not Exercised/);
    await page.evaluate(() => window.CycleWorkspace.dispose());
  });
}

async function topologyTruth(browser) {
  await harness(browser, "D11 topology incomplete ping summary", null, async page => {
    await page.evaluate(() => {
      window.__topologyCalls = [];
      window.__pingRound = 0;
      window.notifyUser = message => { throw new Error(message); };
      window.confirmUser = async () => true;
      window.machines = [];
      window.mgxTypeOf = () => "other";
      window.api = async (requestPath, options = {}) => {
        window.__topologyCalls.push(`${options.method || "GET"} ${requestPath}`);
        if (requestPath === "/api/projects/Director/topology" && !options.method) {
          return { revision: 1, racks: [{ id: "rack-director", name: "Director rack", devices: [], links: [] }] };
        }
        if (requestPath === "/api/projects/Director/topology/ping" && options.method === "POST") {
          window.__pingRound += 1;
          if (window.__pingRound === 1) return { summary: { configured: 0, alive: 0, down: null, unique_ips: 0 }, targets: [], error: "aggregator omitted down" };
          return { summary: { configured: 0, alive: 0, down: 0, unique_ips: 0 }, targets: [] };
        }
        throw new Error("STRICT MOCK: unexpected topology API " + requestPath);
      };
    });
    await page.addScriptTag({ path: JS("topology.js") });
    await page.evaluate(() => window.PATopology.open("Director"));
    await page.locator('[data-action="ping"]').click();
    await page.waitForSelector(".nt-ping-summary.nt-ping-failed[role=alert]");
    assert.match(await page.locator(".nt-ping-summary").innerText(), /Ping 結果尚無法判讀/);
    assert.match(await page.locator(".nt-ping-summary").innerText(), /aggregator omitted down/);

    await page.locator('[data-action="ping"]').click();
    await page.waitForSelector(".nt-ping-summary.nt-ping-empty");
    const zeroSummary = await page.locator(".nt-ping-summary").innerText();
    assert.match(zeroSummary, /沒有可檢查的 IP/);
    assert.match(zeroSummary, /0 個 IP · 可達 0 · 無回應 0 · 不重複 IP 0 · 耗時 未取得/);
    assert.deepEqual(await page.evaluate(() => window.__topologyCalls), [
      "GET /api/projects/Director/topology",
      "POST /api/projects/Director/topology/ping",
      "POST /api/projects/Director/topology/ping",
    ]);
    await page.locator('[data-action="close"]').click();
  });
}

(async () => {
  const launch = process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, headless: true }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true };
  const browser = await chromium.launch(launch);
  try {
    await telemetryTruth(browser);
    await assignmentAndSensorTruth(browser);
    await agentTruth(browser);
    await evidenceTruth(browser);
    await inspectionTruth(browser);
    await cycleTruth(browser);
    await topologyTruth(browser);
    console.log("PASS director state-truth suite: 7 scenarios, strict API mocks, no hardware");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
