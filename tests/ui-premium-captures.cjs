"use strict";

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.PA_CYCLE_BASE_URL || "http://127.0.0.1:9196";
const PHASE = process.env.PA_CAPTURE_PHASE || "before";
const OUTPUT = path.resolve("docs", "ui-premium", "screens", PHASE);
const CHROME = process.env.CHROME_PATH;
const MACHINE = "PREMIUM-UI-MOCK-01";
const NODE = "node-premium-ui-01";
const SHEET = "premium-ui-fixture";
const WIDTHS = (process.env.PA_CAPTURE_WIDTHS || "1366,1600,1920,2560,3440")
  .split(",").map(Number).filter(Boolean);
const THEMES = (process.env.PA_CAPTURE_THEMES || "light,dark").split(",").filter(Boolean);

const cases = [
  {
    case_variant_id: "premium-ui-pcie-001",
    code: "PCIE-001",
    items: "PCIe 連線速率與寬度驗證",
    test_set: "Platform I/O",
    ai_can_execute: "PARTIAL",
    criteria: "所有預期裝置的 LnkSta 寬度與速率符合規格；不得有 downgraded link 或缺少裝置。",
    procedure: "1. 列出裝置。2. 核對 BDF。3. 保存完整 lspci -vvv 輸出。",
    ai_precheck: "確認目標節點與預期 PCIe topology；確認 lspci 可用。",
    ai_commands: "lspci -nn\nlspci -s <BDF> -vvv",
    ai_postcheck: "收集原始輸出並保留 BDF 對應。",
    ai_review: {
      automation_classification: "REQUIRES PACKAGE / USER CONFIRMATION",
      risk_level: "MEDIUM",
      purpose: "確認伺服器 PCIe 裝置沒有降速、降寬或遺失。",
      preconditions: ["目標節點已開機", "工程師已確認預期 topology"],
      safety_checks: ["只讀取 PCIe configuration space"],
      risk_notes: ["大量輸出可能需要橫向捲動"],
      required_packages: ["pciutils"],
      pre_check_commands: ["command -v lspci"],
      test_command: "lspci -nn && lspci -s <BDF> -vvv",
      post_check_commands: ["date -Is"],
      expected_evidence: ["完整 lspci -nn", "各 BDF 的 LnkCap / LnkSta"],
      logs_to_collect: ["pcie-inventory.log"],
      blocked_conditions: ["預期 topology 未提供"],
      requires_human_approval: true,
      user_confirmation_required: true,
      destructive_actions: false,
    },
  },
  {
    case_variant_id: "premium-ui-bios-002",
    code: "BIOS-002",
    items: "BIOS 版本與設定盤點（超長名稱用於驗證中英混排與溢位處理）",
    test_set: "Firmware Baseline",
    ai_can_execute: "YES",
    criteria: "BIOS 版本與已核准 baseline 相符；缺少 baseline 時不得判定 PASS。",
    ai_commands: "dmidecode -t bios",
    ai_review: {
      automation_classification: "FULLY AUTOMATABLE",
      risk_level: "LOW",
      purpose: "盤點 BIOS 識別資訊。",
      preconditions: ["dmidecode 可用"],
      test_command: "dmidecode -t bios",
      expected_evidence: ["完整 dmidecode BIOS 區段"],
      destructive_actions: false,
    },
  },
];

function json(route, value, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
}

async function mockApi(page, state, unknown) {
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = url.pathname + url.search;
    const method = request.method();
    if (key === "/api/machines") return json(route, { last_scan: "mock", machines: [{
      name: MACHINE, project: "Premium UI Fixture", os_ip: "192.0.2.99", os_user: "root",
      bmc_ip: "192.0.2.121", os_alive: true, bmc_alive: false, active_os: 0,
      os: [{ slot: 0, label: "N1", ip: "192.0.2.21", node_id: NODE, expected_binding_revision: "mock-rev-1" }],
    }] });
    if (key === "/api/projects") return json(route, { projects: [] });
    if (key === "/api/testlibrary/meta") return json(route, { version: "capture-v1", sheets: [{
      sheet: SHEET, label: "Platform Validation", count: cases.length, auto: 1, partial: 1, no: 0,
    }] });
    if (key === `/api/testlibrary?sheet=${encodeURIComponent(SHEET)}`) return json(route, { sheet: SHEET, items: cases });
    if (url.pathname === "/api/agent/active") return json(route, { ok: true, run: null });
    if (url.pathname === "/api/agent/runs" && method === "POST") return json(route, { ok: true, run: {
      run_id: "premium-ui-run-1", case_variant_id: cases[0].case_variant_id, status: "PENDING", attachments: [],
    } });
    if (url.pathname === "/api/agent/runs/premium-ui-run-1/start" && method === "POST") return json(route, {
      ok: true, run_id: "premium-ui-run-1", run: { run_id: "premium-ui-run-1", status: "RUNNING", attachments: [] },
    });
    if (url.pathname === "/api/agent/runs/premium-ui-run-1/messages" && method === "GET") {
      if (state.pollUnavailable) return json(route, { detail: "SYNTHETIC temporary sync outage" }, 503);
      return json(route, { ok: true, messages: [
      { seq: 1, role: "agent", kind: "message", created_at: "2026-10-08T00:00:00+08:00", text: "## 執行計畫\n\n1. 核對目標節點與 PCIe topology\n2. 執行 `lspci -nn`\n3. 收集 LnkCap / LnkSta 證據\n\n| 項目 | 處理 |\n|---|---|\n| 原始證據 | 完整保留 |\n| 得失判定 | 由工程師確認 |\n\n若同意開始，請回覆 **OK** 或 **GO**。" },
      ] });
    }
    if (url.pathname === "/api/agent/runs/premium-ui-run-1" && method === "GET") return json(route, { ok: true, run: {
      run_id: "premium-ui-run-1", status: state.agentStatus, started_at: "2026-10-08T00:00:00+08:00",
      updated_at: "2026-10-08T00:00:05+08:00", attachments: state.attachments || [], commands: [], evidence: [],
      failure_reason: state.failureReason || "",
      final_result: state.agentStatus === "DONE" ? "Agent 已完成資料收集；仍需由工程師依判定標準決定 PASS / FAIL / BLOCKED。" : "",
    } });
    unknown.add(`${method} ${key}`);
    return json(route, { detail: "UI capture fixture has no route for this request" }, 404);
  });
}

async function waitForApp(page) {
  await page.goto(`${BASE}/#/projects`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.openAssignTask === "function" && window.PA_Agent);
  await page.waitForFunction((name) => typeof machines !== "undefined" && Array.isArray(machines) && machines.some((m) => m.name === name), MACHINE);
}

async function capture(page, file) {
  await page.screenshot({ path: path.join(OUTPUT, file), animations: "disabled" });
}

function addCheck(report, name, passed, details = "") {
  report.checks.push({ name, passed: Boolean(passed), details });
}

async function verifyTestCaseContract(page, report, width, theme) {
  const suffix = `${width}-${theme}`;
  const action = page.locator("#rm-dialog-foot .primary");
  addCheck(report, `no-selection-action-${suffix}`,
    await action.textContent() === "選擇測項" && await action.isDisabled());
  const targetText = await page.locator(".assign-target-bar").innerText();
  addCheck(report, `canonical-operation-target-${suffix}`,
    targetText.includes(NODE) && targetText.includes("192.0.2.21") && !targetText.includes("192.0.2.99"),
    "The active node identity must win over the machine-level compatibility IP.");

  const initialState = await page.evaluate(() => {
    const row = document.querySelector(".eng-case-row");
    const criteria = document.querySelector(".eng-case-criteria");
    const detail = document.querySelector(".eng-case-detail");
    const c = criteria?.getBoundingClientRect();
    const d = detail?.getBoundingClientRect();
    return {
      inspected: row?.classList.contains("is-inspected"),
      selected: row?.classList.contains("is-selected"),
      criteriaVisible: Boolean(c && d && c.top >= d.top && c.bottom <= d.bottom),
    };
  });
  addCheck(report, `inspected-not-selected-${suffix}`,
    initialState.inspected && !initialState.selected);
  if (width === 1366) {
    addCheck(report, `criteria-visible-${suffix}`, initialState.criteriaVisible,
      "The complete criteria block must be inside the initial detail viewport.");
  }

  const searchState = await page.evaluate(() => {
    let field = document.getElementById("assign-q");
    field.focus();
    const startHandlerAttribute = field.getAttribute("oncompositionstart");
    const endHandlerAttribute = field.getAttribute("oncompositionend");
    const compositionWiring = startHandlerAttribute?.includes("dataset.composing")
      && endHandlerAttribute?.includes("assignTaskSearch");
    field.dataset.composing = "1";
    field.value = "PCI";
    field.setSelectionRange(3, 3);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const sameFieldDuringComposition = document.getElementById("assign-q") === field;
    const composingFlagDuringComposition = field.dataset.composing === "1";
    const rowCountDuringComposition = document.querySelectorAll(".eng-case-row").length;
    const heldDuringComposition = sameFieldDuringComposition
      && composingFlagDuringComposition
      && rowCountDuringComposition === 2;
    delete field.dataset.composing;
    assignTaskSearch(field);
    field = document.getElementById("assign-q");
    const restoredAfterSearch = document.activeElement === field
      && field?.selectionStart === 3
      && document.querySelectorAll(".eng-case-row").length === 1;
    return { compositionWiring, heldDuringComposition, sameFieldDuringComposition, composingFlagDuringComposition, rowCountDuringComposition, restoredAfterSearch };
  });
  addCheck(report, `search-ime-${suffix}`,
    searchState.compositionWiring && searchState.heldDuringComposition && searchState.restoredAfterSearch,
    JSON.stringify(searchState));
  await page.locator("#assign-q").fill("");
  await page.waitForFunction(() => document.querySelectorAll(".eng-case-row").length === 2);
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME || undefined });
  const report = { phase: PHASE, base: BASE, browser: browser.version(), captures: [], checks: [], unknownRequests: [] };
  try {
    for (const width of WIDTHS) {
      const height = width <= 1366 ? 768 : width <= 1600 ? 900 : width <= 1920 ? 1080 : 1440;
      for (const theme of THEMES) {
        const page = await browser.newPage({ viewport: { width, height } });
        const errors = [];
        const unknown = new Set();
        const state = { agentStatus: "WAITING_FOR_USER", attachments: [], pollUnavailable: false, failureReason: "" };
        page.on("pageerror", (error) => errors.push(String(error.message || error)));
        await page.addInitScript((value) => localStorage.setItem("pa_theme", value), theme);
        await mockApi(page, state, unknown);
        await waitForApp(page);

        await page.evaluate((name) => window.openAssignTask(name), MACHINE);
        await page.waitForSelector(".assign-sheet-card");
        await capture(page, `test-case-category-${width}x${height}-${theme}.png`);
        await page.locator(".assign-sheet-card").first().click();
        await page.waitForSelector(".eng-case-row");
        await page.locator(".eng-case-open").first().click();
        await verifyTestCaseContract(page, report, width, theme);
        await capture(page, `test-case-none-${width}x${height}-${theme}.png`);
        await page.locator(".eng-case-row input").nth(0).check();
        addCheck(report, `single-selection-action-${width}-${theme}`,
          await page.locator("#rm-dialog-foot .primary").textContent() === "交給 PA Agent"
          && await page.locator(".eng-case-row").nth(0).evaluate((row) => row.classList.contains("is-selected") && row.classList.contains("is-inspected")));
        await capture(page, `test-case-single-${width}x${height}-${theme}.png`);
        await page.locator(".eng-case-row input").nth(1).check();
        addCheck(report, `multi-selection-action-${width}-${theme}`,
          await page.locator("#rm-dialog-foot .primary").textContent() === "產生批次指令 (2)"
          && await page.locator(".eng-case-row").nth(1).evaluate((row) => row.classList.contains("is-selected") && !row.classList.contains("is-inspected")));
        await capture(page, `test-case-multiple-${width}x${height}-${theme}.png`);
        await page.evaluate(() => window.closeDialog());

        const agentContext = { c: cases[0], machine: MACHINE, node: NODE };
        const openAgent = ({ c, machine, node }) => window.PA_Agent.open({
          case_variant_id: c.case_variant_id, node_id: node, expected_binding_revision: "mock-rev-1",
          branch: c.test_set, title: c.items, task: `${c.items}\n${c.criteria}`,
          rich: `<article class="eng-case-detail"><header class="eng-case-head"><div class="eng-case-id"><code>${c.code}</code></div><h3>${c.items}</h3></header><section class="eng-case-sec"><h4>判定標準</h4><p class="eng-case-prose">${c.criteria}</p></section><section class="eng-case-sec"><h4>目標</h4><p class="eng-case-prose">${machine} · ${node}</p></section></article>`,
          mode: "plan",
        });
        await page.evaluate(openAgent, agentContext);
        await page.waitForSelector("#pa-agent-drawer.open");
        await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師"));
        await capture(page, `pa-agent-waiting-${width}x${height}-${theme}.png`);

        const riskSample = width === 1366 || width === 1920;
        if (riskSample) {
          state.attachments = [
            { attachment_id: "att-parsed", name: "pcie-baseline.txt", size: 18432, kind: "file", status: "parsed" },
            { attachment_id: "att-unparsed", name: "vendor-bundle.bin", size: 7340032, kind: "file", status: "unparsed", error: "SYNTHETIC parser unavailable" },
            { attachment_id: "att-image", name: "slot-photo.png", size: 245760, kind: "image", status: "ready", vision_supported: false },
          ];
          await page.waitForFunction(() => document.querySelectorAll("#pa-attach-strip .pa-att").length === 3, null, { timeout: 6000 });
          await capture(page, `pa-agent-attachments-${width}x${height}-${theme}.png`);
          if (width === 1366) {
            state.pollUnavailable = true;
            await page.waitForFunction(() => document.querySelector("#pa-sync")?.classList.contains("pa-sync-bad"), null, { timeout: 6000 });
            await capture(page, `pa-agent-reconnect-${width}x${height}-${theme}.png`);
            state.pollUnavailable = false;
            await page.waitForFunction(() => document.querySelector("#pa-sync")?.classList.contains("pa-sync-ok"), null, { timeout: 6000 });
          }
        }

        state.agentStatus = "DONE";
        await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師判定"), null, { timeout: 6000 });
        await capture(page, `pa-agent-done-${width}x${height}-${theme}.png`);

        if (riskSample) {
          await page.locator("#pa-drawer-close").click();
          await page.waitForSelector("#pa-agent-drawer", { state: "detached", timeout: 3000 });
          state.agentStatus = "WAITING_FOR_USER";
          state.attachments = [];
          await page.evaluate(openAgent, agentContext);
          await page.waitForSelector("#pa-agent-drawer.open");
          await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師"));
          state.failureReason = "SYNTHETIC gateway unavailable；未執行任何遠端命令。";
          state.agentStatus = "ERROR";
          await page.waitForFunction(() => document.querySelector(".pa-error-note")?.textContent.includes("gateway unavailable"), null, { timeout: 6000 });
          await capture(page, `pa-agent-error-${width}x${height}-${theme}.png`);
          addCheck(report, `agent-error-reason-${width}-${theme}`,
            (await page.locator(".pa-error-note").textContent()).includes("未執行任何遠端命令")
            && await page.locator("#pa-drawer-case .pa-ref-list").count() === 0,
            "A new run must show its failure reason without retaining the previous run's attachments.");
        }

        report.captures.push({ width, height, theme, errors, unknownRequests: [...unknown] });
        for (const request of unknown) if (!report.unknownRequests.includes(request)) report.unknownRequests.push(request);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUTPUT, "capture-results.json"), JSON.stringify(report, null, 2));
  const failedChecks = report.checks.filter((check) => !check.passed);
  console.log(JSON.stringify({ captures: report.captures.length, checks: report.checks.length, failedChecks, unknownRequests: report.unknownRequests }, null, 2));
  if (failedChecks.length) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
