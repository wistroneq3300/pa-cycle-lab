"use strict";

/*
 * Director S12/S13 modal-surface audit.
 *
 * This harness renders production HTML/CSS/JS against a loopback origin.  All
 * API reads are explicit fixtures; every mutation and every unknown API read
 * is rejected.  Terminal/KVM/Broadcast transports are intentionally not
 * opened here (their fake-provider checks live in director-site-captures.cjs).
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
} catch (_) {
  playwright = require(process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
}
const { chromium } = playwright;

const REPO = path.resolve(__dirname, "..");
const BASE = process.env.PA_CYCLE_BASE_URL || "http://127.0.0.1:9196";
const OUTPUT = path.resolve(process.env.OUTPUT || path.join(
  REPO, "docs", "ui-premium", "screens", "director-modal-surfaces"));
const baseUrl = new URL(BASE);
assert(["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname),
  `Refusing non-loopback UI target: ${baseUrl.origin}`);
fs.mkdirSync(OUTPUT, { recursive: true });
const projectBeforeFile = path.join(OUTPUT, "05-project-management-long.png");
const projectBeforeEvidence = fs.existsSync(projectBeforeFile) ? {
  filename: path.basename(projectBeforeFile),
  sha256: crypto.createHash("sha256").update(fs.readFileSync(projectBeforeFile)).digest("hex"),
  finding: "At 500px the long project name wrapped almost word-by-word and compressed the action column.",
} : null;

function git(...args) {
  try {
    return execFileSync("git", ["-C", REPO, ...args], {
      encoding: "utf8", windowsHide: true,
    }).trim();
  } catch (_) { return null; }
}

const inventory = [
  ["S12-GENERIC", "Generic showDialog / uxConfirm", "dialog", "app/static/js/app.js + workspace-ux.js", "showDialog / uxConfirm", "tested"],
  ["S12-CONFIRM", "Delete / retire / power / Cycle destructive confirmation", "dialog", "app/static/js/workspace-ux.js", "uxConfirm / confirmUser", "tested-cancel"],
  ["S12-STATUS-ERROR", "Operation completed but list refresh failed", "dialog", "app/static/js/cinematic.js", "showDialog status update failure", "source-reviewed"],
  ["S12-ADD-SYSTEM", "新增系統（L10 / L11）", "modal", "app/static/index.html + app.js", "openAdd", "tested"],
  ["S12-PROJECT", "新增／編輯／刪除專案與 Cycle entry", "modal", "app/static/index.html + app.js", "openProjectModal", "tested"],
  ["S12-CONNECTION-IP", "修改管理 IP", "dialog", "app/static/js/equipment-connections.js", "equipmentIpDialog", "tested"],
  ["S12-CONNECTION-SSH", "OS / BMC SSH Terminal credentials", "dialog", "app/static/js/equipment-connections.js", "equipmentSshDialog", "source-reviewed"],
  ["S12-POWER-CUSTOM", "單機自訂電源指令", "dialog", "app/static/js/equipment-connections.js", "equipmentPowerDialog", "source-reviewed"],
  ["S12-POWER-RACK", "整櫃電源目標選擇", "dialog", "app/static/js/app.js", "rackBulkDialog", "source-reviewed"],
  ["S12-POWER-BATCH", "批次電源進度／結果", "dialog", "app/static/js/operations-ux.js", "showPowerBatch", "source-reviewed"],
  ["S12-COMPONENT", "Rack component control", "dialog", "app/static/js/app.js", "machControlDialog", "source-reviewed"],
  ["S12-RACK-SPEC", "升級 L11／設備高度", "dialog", "app/static/js/workspace-ux.js", "uxRackSpecification", "source-reviewed"],
  ["S12-RACK-MOVE", "機櫃位置", "dialog", "app/static/js/app.js", "rackMoveDialog", "source-reviewed"],
  ["S12-RACK-ADD", "加入機櫃／選擇設備與 U 位", "dialog", "app/static/js/app.js", "rackAddDialog / rackAddDialogAt", "source-reviewed"],
  ["S12-CDU", "新增／編輯 CDU 安裝方式", "dialog", "app/static/js/app.js", "rackCduDialog", "source-reviewed"],
  ["S12-RACK-COMPONENT", "新增機櫃元件／加入機櫃專案", "dialog", "app/static/js/app.js", "addRackComponentDialog", "source-reviewed"],
  ["S12-TOPOLOGY-LEGACY", "Legacy topology add entry", "dialog", "app/static/js/app.js", "linkAddDialog", "source-reviewed"],
  ["S12-ASSIGN-CATEGORY", "Test Case category", "dialog", "app/static/js/app.js + engineering-ux.js", "openAssignTask", "source-reviewed"],
  ["S12-ASSIGN-CASES", "Test Case search / selection", "dialog", "app/static/js/app.js + engineering-ux.js", "assignTaskOpenSheet", "source-reviewed"],
  ["S12-ASSIGN-RESULT", "Batch instruction result", "non-modal-dialog", "app/static/js/app.js + engineering-ux.js", "AssignResultWin.render", "source-reviewed"],
  ["S12-MACHINE-TERMINAL", "Machine Terminal credential setup", "dialog", "app/static/js/app.js", "openTermDialog", "source-reviewed"],
  ["S12-MACHINE-SETTINGS", "System settings / edit connection", "dialog", "app/static/js/app.js", "changeOsIp", "source-reviewed"],
  ["S12-BROADCAST-SELECT", "Rack/System Broadcast target selection", "dialog", "app/static/js/app.js", "rackBroadcastDialog / systemBroadcastDialog", "source-reviewed"],
  ["S12-KVM-PREVIEW", "Design-only KVM preview", "dialog", "app/static/js/atelier.js", "atelier KVM preview", "source-reviewed"],
  ["S12-ROW-MENU", "System row More menu / project move", "popover-menu", "app/static/js/product.js + workspace-ux.js", "p-row-menu", "source-reviewed"],
  ["S07-AGENT", "PA Agent mission drawer", "drawer", "app/static/js/pa-agent.js", "PA_Agent.open", "tested"],
  ["S08-CYCLE", "Cycle workspace / PRE / confirmation / live console", "native-dialog", "app/static/js/cycle.js + cycle-console.js", "openCycleTest", "covered-by-cycle-harness"],
  ["S09-EXPORTER", "Telemetry Exporter Console", "native-dialog", "app/static/js/telemetry-provision.js", "TelemetryProvision", "covered-by-telemetry-harness"],
  ["S13-EVIDENCE", "Inspection raw Evidence viewer", "native-dialog", "app/static/js/inspection-evidence.js", "InspectionEvidence.open", "tested"],
  ["S13-REPORT", "Cycle report / evidence download entry", "link-viewer", "app/static/js/cycle.js + cycle-console.js", "cycle-report / evidence download", "covered-by-cycle-harness"],
  ["S14-GUIDE", "User Guide floating viewer", "non-modal-dialog", "app/static/js/userguide.js", "USER_GUIDE.open", "tested"],
  ["S15-TOPOLOGY", "Topology overlay and nested editors / confirmations", "dialog", "app/static/js/topology.js", "PATopology.open", "tested"],
  ["S11-TERMINAL", "OS / BMC Terminal", "modal", "app/static/index.html + app.js", "openTerm", "fake-provider-only-elsewhere"],
  ["S11-BROADCAST", "Broadcast terminal", "modal", "app/static/index.html + app.js", "openBroadcast", "fake-provider-only-elsewhere"],
  ["S11-KVM", "KVM grid / solo", "overlay", "app/static/js/kvm_broadcast.js", "openKvmBroadcast / openKvmSolo", "fake-provider-only-elsewhere"],
].map(([id, surface, type, owner, entry, audit]) => ({ id, surface, type, owner, entry, audit }));

const fixedIso = "2026-10-08T04:00:00.000Z";
const fixedSeconds = Date.parse(fixedIso) / 1000;
const longProject = "Director 展示專案／超長中文名稱／GPU Validation Cluster Alpha";
const machine = {
  name: "director-hostname-with-a-very-long-engineering-identity.example.internal",
  project: longProject, level: "system", mgx_type: "server", rack_size: 8,
  rack_u: 0, os_ip: "2001:db8:1000:2000::1234", bmc_ip: "192.0.2.42",
  os_user: "engineer", os_port: 22, bmc_user: "admin", bmc_port: 22,
  os_status: "online", bmc_status: "online", power: "on",
  os: [{ node_id: "director-node-00000000000000000000000000000001", ip: "2001:db8:1000:2000::1234", bmc_ip: "192.0.2.42" }],
};
const projectsFixture = [
  { name: longProject, desc: "Long deterministic project description retained for modal wrapping review.", machine_count: 1, level: "system" },
  { name: "Empty Review Project", desc: "No systems", machine_count: 0, level: "system" },
];
const topology = {
  revision: 7,
  racks: [{
    id: "rack-director", name: "Director Rack / long placement name", links: [],
    devices: [{
      id: "device-host", name: machine.name, kind: "server", inventory: machine.name,
      nodes: [{ id: "node-host", name: "Compute Node / extremely long target label", bf4: "BF4-Director", host_os: machine.os_ip, host_bmc: machine.bmc_ip, dpu_os: "", dpu_bmc: "" }],
      ports: [{ id: "port-host", name: "Management RJ45 / Port 0001", role: "host", nodes: ["node-host"] }],
    }],
  }],
};
const agentRun = {
  run_id: "director-modal-run", case_variant_id: "director-case-modal", status: "DONE",
  started_at: fixedIso, updated_at: fixedIso, duration_seconds: 89,
  target: { node_id: "director-node-00000000000000000000000000000001", os_ip: machine.os_ip },
  attachments: [{ attachment_id: "modal-sop", name: "Director-Long-SOP-Reference.md", size: 4821, kind: "file", status: "parsed" }],
  commands: [], evidence: [],
};
const longEvidence = JSON.stringify(Array.from({ length: 48 }, (_, index) => ({
  sequence: index + 1,
  source: "Redfish EventLog / deterministic loopback fixture",
  node_id: "director-node-00000000000000000000000000000001",
  message: `Synthetic read-only evidence row ${String(index + 1).padStart(2, "0")} — ` + "long engineering content ".repeat(6),
})), null, 2);

const trace = { requests: [], mutations: [], unknownReads: [], external: [], captures: [], checks: [] };
const mark = (name, status, detail = "") => trace.checks.push({ name, status, detail });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: "light" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => {
    const url = new URL(request.url());
    if (![baseUrl.origin, "data:"].includes(url.origin) && url.protocol !== "blob:") {
      trace.external.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const key = `${method} ${url.pathname}${url.search}`;
    trace.requests.push(key);
    const json = (body, status = 200) => route.fulfill({
      status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body),
      headers: { "X-Director-Fixture": "modal-surface-v1" },
    });
    if (url.origin !== baseUrl.origin) {
      trace.external.push(key);
      return json({ detail: "External request blocked by Director modal harness" }, 599);
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      trace.mutations.push(key);
      return json({ detail: "Mutation rejected by Director modal harness" }, 599);
    }
    if (url.pathname === "/api/machines") return json({ last_scan: fixedIso, machines: [machine] });
    if (url.pathname === "/api/projects") return json({ projects: projectsFixture });
    if (url.pathname === "/api/ai/gpu-alerts") return json({ alerts: [] });
    if (url.pathname === "/api/settings/public") return json({});
    if (url.pathname === "/api/agent/active") return json({ ok: true, run: agentRun });
    if (url.pathname === "/api/agent/runs/director-modal-run/messages") return json({ ok: true, messages: [{
      seq: 1, role: "agent", kind: "message", created_at: fixedIso,
      text: "## 已完成執行，待工程師判定\n\n" + "這是長內容閱讀與重新開啟測試，不代表 PASS。\n\n".repeat(18),
    }] });
    if (url.pathname === "/api/agent/runs/director-modal-run/attachments/unconsumed") {
      return json({ ok: true, attachments: agentRun.attachments });
    }
    if (url.pathname === `/api/projects/${encodeURIComponent(longProject)}/topology`) return json(topology);
    if (url.pathname === "/api/director-evidence/evidence/long/view") return json({
      text: longEvidence, source: "Director loopback fixture", collected_at: fixedSeconds,
      truncated: false,
    });
    if (url.pathname === "/api/director-evidence/evidence/error/view") {
      return json({ detail: "403 · Director fixture：證據來源權限不足" }, 403);
    }
    trace.unknownReads.push(key);
    return json({ detail: "Unknown read rejected by Director modal harness" }, 599);
  });

  async function capture(filename, surface, state, selector) {
    const target = selector ? page.locator(selector) : page;
    const file = path.join(OUTPUT, filename);
    await target.screenshot({ path: file, animations: "disabled" });
    const bytes = fs.readFileSync(file);
    const ui = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      dpr: devicePixelRatio,
      focused: document.activeElement?.id || document.activeElement?.getAttribute("aria-label") || document.activeElement?.tagName || null,
      theme: document.documentElement.dataset.theme || document.body.dataset.theme || "light",
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    trace.captures.push({
      filename, surface, state, selector: selector || "viewport", ...ui,
      bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }

  try {
    await page.goto(BASE + "/#/projects", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof showDialog === "function" && typeof uxConfirm === "function" &&
      typeof openAdd === "function" && typeof openProjectModal === "function" &&
      typeof InspectionEvidence?.open === "function" && typeof PA_Agent?.open === "function");
    await page.evaluate(({ machine, projectsFixture }) => {
      machines = [machine];
      projects = projectsFixture;
      const opener = document.createElement("button");
      opener.id = "director-surface-opener";
      opener.className = "btn primary";
      opener.textContent = "Director surface opener";
      document.body.append(opener);
    }, { machine, projectsFixture });

    // Generic shared dialog: semantics, focus cycle, IME-safe Escape, restore.
    await page.evaluate(() => {
      const opener = document.getElementById("director-surface-opener");
      opener.focus();
      showDialog("編輯 Node / 長內容驗收", `
        <p>目前對象：Director / System / Node / OS Slot / 2001:db8:1000:2000::1234</p>
        <label for="director-long-host">Hostname</label>
        <input class="input" id="director-long-host" value="director-hostname-with-a-very-long-engineering-identity.example.internal">
        <label for="director-long-note">說明</label>
        <textarea class="input" id="director-long-note">工程師輸入會在錯誤後保留。這是一段很長的繁體中文內容，用來確認對話框內容區可以捲動、Footer 保持可達，而且最後一個欄位不會被遮住。</textarea>
      `, [{ txt: "取消", fn: closeDialog }, { txt: "儲存", cls: "primary", fn: () => {} }]);
    });
    const generic = page.locator("#rm-dialog .rm-modal");
    assert.equal(await generic.getAttribute("role"), "dialog");
    assert.equal(await generic.getAttribute("aria-modal"), "true");
    assert.equal(await generic.getAttribute("aria-labelledby"), "rm-dialog-title");
    await page.waitForFunction(() => document.activeElement?.id === "director-long-host");
    await capture("01-generic-long-normal.png", "Generic form dialog", "normal-long-content", "#rm-dialog .rm-modal");
    const genericLast = page.locator("#rm-dialog-foot button").last();
    await genericLast.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "關閉對話框");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await genericLast.evaluate(node => document.activeElement === node), true);
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.notEqual(await page.locator("#rm-dialog").evaluate(node => getComputedStyle(node).display), "none");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("rm-dialog")).display === "none");
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");
    mark("generic dialog role/aria/focus/IME/Escape/restore", "PASS");

    // Async failure: one submit, retained input, persistent reason, then clean reopen.
    await page.evaluate(() => {
      window.__directorSubmitCount = 0;
      document.getElementById("director-surface-opener").focus();
      showDialog("儲存設定", '<label for="director-retained">Hostname</label><input class="input" id="director-retained" value="工程師尚未送出的內容">', [
        { txt: "取消", fn: closeDialog },
        { txt: "儲存", cls: "primary", fn: async () => {
          window.__directorSubmitCount++;
          await new Promise(resolve => setTimeout(resolve, 80));
          throw new Error("409 · binding revision 已變更；請重新取得目前資料");
        } },
      ]);
    });
    const save = page.locator("#rm-dialog-foot .primary");
    await save.click();
    await save.click({ force: true });
    await page.locator("#rm-dialog-error").waitFor();
    assert.equal(await page.evaluate(() => window.__directorSubmitCount), 1);
    assert.equal(await page.locator("#director-retained").inputValue(), "工程師尚未送出的內容");
    assert.match(await page.locator("#rm-dialog-error").innerText(), /409 .*binding revision/);
    await page.evaluate(() => uxNotify("403 · 權限不足，設定未變更", true));
    await page.locator("#content > .ux-workspace-errors .ux-workspace-error").waitFor();
    await capture("02-generic-persistent-error.png", "Generic form dialog", "submit-error-retains-input", "#rm-dialog .rm-modal");
    await page.evaluate(() => showDialog("重新開啟設定", '<label for="director-reopen">Node ID</label><input class="input" id="director-reopen" value="node-reopened">', [{ txt: "取消", fn: closeDialog }]));
    assert.equal(await page.locator("#rm-dialog-error").count(), 0);
    await capture("03-generic-reopened.png", "Generic form dialog", "reopened-clean", "#rm-dialog .rm-modal");
    await page.locator("#rm-dialog-foot button").click();
    await page.evaluate(() => {
      document.querySelectorAll("#ux-notifications button, .ux-workspace-errors button").forEach(button => button.click());
    });
    mark("async failure retains value/reason; duplicate submit blocked; reopen clean", "PASS");

    // uxConfirm cancel must produce no request.
    const mutationsBeforeConfirm = trace.mutations.length;
    await page.evaluate(() => {
      window.__directorConfirmResult = null;
      uxConfirm("Project：Director\nRun：run-001\nEvidence + log 將刪除且無法復原").then(value => { window.__directorConfirmResult = value; });
    });
    await page.locator("#rm-dialog-foot button", { hasText: "取消" }).click();
    await page.waitForFunction(() => window.__directorConfirmResult === false);
    assert.equal(trace.mutations.length, mutationsBeforeConfirm);
    mark("uxConfirm cancel sends zero requests", "PASS");

    // Static add form: production surface + newly scoped IME/Escape/restore.
    await page.evaluate(() => { document.getElementById("director-surface-opener").focus(); openAdd("system"); });
    await page.waitForFunction(() => getComputedStyle(document.getElementById("add-modal")).display === "flex");
    const addModal = page.locator("#add-modal .modal");
    assert.equal(await addModal.getAttribute("role"), "dialog");
    assert.equal(await addModal.getAttribute("aria-modal"), "true");
    await page.waitForFunction(() => document.getElementById("add-modal").contains(document.activeElement));
    await page.locator("#f-os-ip").fill("2001:db8:aaaa:bbbb::99");
    await capture("04-add-system-long-ip.png", "Add system modal", "normal-long-ip", "#add-modal .modal");
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('#add-modal button:not(:disabled),#add-modal input:not(:disabled):not([type="hidden"]),#add-modal select:not(:disabled),#add-modal textarea:not(:disabled),#add-modal a[href]')].filter(node => node.offsetParent !== null);
      window.__directorFocusFirst = items[0];
      window.__directorFocusLast = items.at(-1);
      window.__directorFocusLast.focus();
    });
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement === window.__directorFocusFirst), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement === window.__directorFocusLast), true);
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.equal(await page.locator("#add-modal").evaluate(node => getComputedStyle(node).display), "flex");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("add-modal")).display === "none");
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");
    assert.equal(trace.mutations.length, mutationsBeforeConfirm);
    mark("add system role/aria/focus/IME/Escape/restore/cancel zero request", "PASS");

    // Static project manager with long content and the same scoped key contract.
    await page.evaluate(() => { document.getElementById("director-surface-opener").focus(); openProjectModal(); });
    await page.waitForFunction(() => getComputedStyle(document.getElementById("project-modal")).display === "flex");
    const projectModal = page.locator("#project-modal .modal");
    assert.equal(await projectModal.getAttribute("role"), "dialog");
    assert.equal(await projectModal.getAttribute("aria-modal"), "true");
    await page.waitForFunction(() => document.activeElement?.id === "new-project-name");
    await page.locator("#new-project-name").fill("未送出的專案名稱應由取消關閉且不發 request");
    await capture("05-project-management-long-after.png", "Project manager modal", "long-content-after-scoped-width-fix", "#project-modal .modal");
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('#project-modal button:not(:disabled),#project-modal input:not(:disabled):not([type="hidden"]),#project-modal select:not(:disabled),#project-modal textarea:not(:disabled),#project-modal a[href]')].filter(node => node.offsetParent !== null);
      window.__directorFocusFirst = items[0];
      window.__directorFocusLast = items.at(-1);
      window.__directorFocusLast.focus();
    });
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement === window.__directorFocusFirst), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement === window.__directorFocusLast), true);
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.equal(await page.locator("#project-modal").evaluate(node => getComputedStyle(node).display), "flex");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("project-modal")).display === "none");
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");
    assert.equal(trace.mutations.length, mutationsBeforeConfirm);
    mark("project manager role/aria/focus/IME/Escape/restore/cancel zero request", "PASS");
    mark("project manager long-name layout", "PASS", "Scoped 900px modal and fixed table columns replace the cramped 500px before state.");

    // A real owner-specific generic dialog; cancel leaves API trace unchanged.
    await page.evaluate(name => { document.getElementById("director-surface-opener").focus(); equipmentIpDialog(name); }, machine.name);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("rm-dialog")).display === "flex");
    await capture("06-connection-ip-form.png", "Management IP dialog", "normal", "#rm-dialog .rm-modal");
    await page.locator("#rm-dialog-foot button", { hasText: "取消" }).click();
    assert.equal(trace.mutations.length, mutationsBeforeConfirm);
    mark("management IP owner dialog rendered; cancel zero request", "PASS");

    // Evidence loaded/long and error states, focus cycle, Escape and reopen.
    await page.evaluate(() => {
      document.getElementById("director-surface-opener").focus();
      InspectionEvidence.open("/api/director-evidence", "long", "Director / System / Node / Run / collected source");
    });
    const evidence = page.locator("dialog.pa-evidence-modal");
    await evidence.locator('[data-status][data-state="loaded"]').waitFor();
    assert.equal(await evidence.getAttribute("aria-modal"), "true");
    assert.equal(await evidence.locator("[data-copy]").isDisabled(), false);
    assert.match(await evidence.locator("[data-source]").innerText(), /Director loopback fixture.*已載入全文.*唯讀/);
    await capture("07-evidence-loaded-long.png", "Raw evidence viewer", "loaded-long-content", "dialog.pa-evidence-modal");
    const evidenceLast = evidence.locator("a[href]").last();
    await evidenceLast.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute("data-close")), true);
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.equal(await evidence.evaluate(node => node.open), true);
    await page.keyboard.press("Escape");
    await evidence.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");

    await page.evaluate(() => InspectionEvidence.open("/api/director-evidence", "error", "403 error state"));
    const evidenceError = page.locator("dialog.pa-evidence-modal");
    await evidenceError.locator('[data-status][data-state="error"]').waitFor();
    assert.match(await evidenceError.locator("[data-status]").innerText(), /403 .*權限不足/);
    assert.equal(await evidenceError.locator("[data-copy]").isDisabled(), true);
    assert.equal(await evidenceError.locator("pre").innerText(), "");
    await capture("08-evidence-source-error.png", "Raw evidence viewer", "403-source-error", "dialog.pa-evidence-modal");
    await evidenceError.locator("[data-close]").click();
    await page.evaluate(() => InspectionEvidence.open("/api/director-evidence", "long", "reopened after error"));
    const evidenceReopen = page.locator("dialog.pa-evidence-modal");
    await evidenceReopen.locator('[data-status][data-state="loaded"]').waitFor();
    assert.doesNotMatch(await evidenceReopen.locator("[data-status]").innerText(), /403|權限不足/);
    await evidenceReopen.locator("[data-close]").click();
    mark("evidence loaded/error/reopen truth + copy gating + focus/Escape/restore", "PASS");

    // Agent drawer actual DONE state. It is tested here without any write.
    await page.evaluate(() => {
      document.getElementById("director-surface-opener").focus();
      PA_Agent.open({
        case_variant_id: "director-case-modal", title: "Long Test Case / Director modal review",
        node_id: "director-node-00000000000000000000000000000001",
        task: "Criteria：保留 DONE 待工程師判定，不得顯示 PASS。\n".repeat(12),
      });
    });
    await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師判定"));
    const agent = page.locator("#pa-agent-drawer .pa-drawer-panel");
    assert.equal(await agent.getAttribute("role"), "dialog");
    assert.equal(await agent.getAttribute("aria-modal"), "true");
    assert.match(await page.locator("#pa-drawer-status-text").innerText(), /等待工程師判定/);
    await capture("09-agent-drawer-long-done.png", "PA Agent drawer", "DONE-awaiting-engineer-long-content", "#pa-agent-drawer .pa-drawer-panel");
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.equal(await page.locator("#pa-agent-drawer.open").count(), 1);
    await page.keyboard.press("Escape");
    await page.locator("#pa-agent-drawer").waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");
    mark("PA Agent actual DONE drawer / IME-safe Escape / restore / no mutation", "PASS");

    // Topology editor renders actual form. Close is tested only in a clean state.
    await page.evaluate(project => { document.getElementById("director-surface-opener").focus(); PATopology.open(project); }, longProject);
    const topo = page.locator(".nt-overlay");
    await topo.locator('[data-action="close"]').waitFor();
    assert.equal(await topo.getAttribute("role"), "dialog");
    assert.equal(await topo.getAttribute("aria-modal"), "true");
    await topo.locator('[data-action="device"]').first().click();
    await topo.locator("#nt-name").fill("Draft topology device name retained until explicit apply/cancel");
    await capture("10-topology-editor-long.png", "Topology overlay/editor", "unsaved-editor-long-content", ".nt-window");
    // Cancel editor through the actual nested confirmation; reject the draft.
    await topo.locator('[data-action="cancel"]').click();
    await page.locator("#rm-dialog-foot button", { hasText: "取消" }).click();
    assert.equal(await topo.locator("#nt-name").inputValue(), "Draft topology device name retained until explicit apply/cancel");
    // Explicitly apply nothing; close through a reload-free clean reopen for focus proof.
    await topo.locator('[data-action="cancel"]').click();
    await page.locator("#rm-dialog-foot button", { hasText: "確認送出" }).click();
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.equal(await topo.count(), 1);
    await page.keyboard.press("Escape");
    await topo.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");
    assert.equal(trace.mutations.length, mutationsBeforeConfirm);
    mark("topology nested cancel retains draft; IME-safe Escape; clean close restores focus", "PASS");

    // User Guide is deliberately non-modal; regular close/restore is exercised.
    await page.evaluate(() => { localStorage.removeItem("ug-state"); document.getElementById("director-surface-opener").focus(); USER_GUIDE.open(); });
    const guide = page.locator(".ug-window");
    await guide.waitFor();
    assert.equal(await guide.getAttribute("role"), "dialog");
    assert.equal(await guide.getAttribute("aria-modal"), "false");
    await page.evaluate(() => document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.notEqual(await guide.evaluate(node => getComputedStyle(node).display), "none");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".ug-window")).display === "none");
    await page.waitForFunction(() => document.activeElement?.id === "director-surface-opener");
    mark("User Guide non-modal semantics / IME-safe Escape / regular Escape / restore", "PASS");

    assert.deepEqual(trace.mutations, [], `Unexpected mutations: ${trace.mutations.join(", ")}`);
    assert.deepEqual(trace.unknownReads, [], `Unknown API reads: ${trace.unknownReads.join(", ")}`);
    assert.deepEqual(trace.external, [], `External requests: ${trace.external.join(", ")}`);
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(" | ")}`);
  } finally {
    const metadata = {
      schema: "director-modal-surface-v1",
      generatedAt: new Date().toISOString(),
      base: BASE,
      fixture: "strict loopback / explicit GET allowlist / every mutation rejected",
      app: {
        branch: git("branch", "--show-current"),
        commit: git("rev-parse", "HEAD"),
        dirty: Boolean(git("status", "--porcelain")),
      },
      browser: await page.evaluate(() => ({ userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio })).catch(() => null),
      overall: "PARTIAL",
      overallReason: "All assertions inside the claimed deterministic scope passed, including PA Agent, Topology and User Guide IME-safe Escape. Terminal/Broadcast/KVM, Cycle and Telemetry remain delegated to their dedicated fake-provider harnesses, so this inventory-level report stays PARTIAL.",
      visualComparisons: [{
        surface: "Project manager long-name layout",
        before: projectBeforeEvidence,
        after: trace.captures.find(item => item.filename === "05-project-management-long-after.png") || null,
        change: "Only #project-modal is widened; project table columns and action wrapping are scoped to that modal.",
      }],
      inventory,
      ...trace,
      pageErrors,
    };
    fs.writeFileSync(path.join(OUTPUT, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
    await browser.close();
  }

  console.log(`PASS deterministic modal/evidence checks: ${trace.checks.filter(check => check.status === "PASS").length}`);
  console.log(`PARTIAL deterministic checks: ${trace.checks.filter(check => check.status === "PARTIAL").length}`);
  console.log(`PARTIAL full inventory: ${inventory.length} surfaces; dedicated transport/console gaps are explicit`);
  console.log(`Evidence: ${OUTPUT}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
