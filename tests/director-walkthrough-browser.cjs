"use strict";

/*
 * Three consecutive, loopback-only Director demo walkthroughs.
 *
 * The production frontend is served from an ephemeral loopback static server
 * with the repository's browser-only rack-network preview.  Only the missing
 * Agent / Inspection / Telemetry / Cycle surfaces are supplied by a strict,
 * explicit in-page provider.  Cycle seed data comes from the isolated
 * validation_console_preview URL in PA_CYCLE_SEED_URL.  No DUT transport is
 * opened and every unexpected special-surface API is rejected and recorded.
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright"); }
catch (_) { playwright = require("C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"); }
const { chromium } = playwright;

const REPO = path.resolve(__dirname, "..");
const STATIC = path.join(REPO, "app", "static");
const OUTPUT = path.resolve(process.env.OUTPUT || path.join(REPO, "docs", "ui-premium", "screens", "director-walkthrough"));
const SEED = new URL(process.env.PA_CYCLE_SEED_URL || "http://127.0.0.1:19520");
const ROUNDS = Number(process.env.WALKTHROUGH_ROUNDS || "3");
assert(["127.0.0.1", "localhost", "::1"].includes(SEED.hostname), `Refusing non-loopback seed ${SEED.origin}`);
assert(Number.isInteger(ROUNDS) && ROUNDS >= 1 && ROUNDS <= 3, "WALKTHROUGH_ROUNDS must be 1..3");
fs.mkdirSync(OUTPUT, { recursive: true });

const mime = file => ({
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".woff": "font/woff", ".woff2": "font/woff2",
})[path.extname(file).toLowerCase()] || "application/octet-stream";
const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const clone = value => JSON.parse(JSON.stringify(value));
const git = (...args) => { try { return execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", windowsHide: true }).trim(); } catch (_) { return null; } };

async function startServer() {
  const unknown = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    const send = (status, body, type) => {
      response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(body);
    };
    if (/\/api\/projects\/.*\/cycle\/jobs\/.*\/files\/CYCLE_REVIEW_REPORT\.html$/.test(pathname)) {
      return send(200, "<!doctype html><html lang=zh-TW><head><title>Cycle Review Report · Synthetic</title></head><body><h1>Cycle Review Report</h1><p>SYNTHETIC · loopback acceptance evidence only.</p></body></html>", "text/html; charset=utf-8");
    }
    let file;
    if (pathname === "/" || pathname === "/index.html") file = path.join(STATIC, "index.html");
    else if (pathname === "/fixtures/tests.json") file = path.join(REPO, "app", "data", "tests.json");
    else if (pathname.startsWith("/static/")) file = path.resolve(path.join(REPO, "app"), `.${pathname}`);
    else file = path.resolve(STATIC, `.${pathname}`);
    const relative = path.relative(REPO, file);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      unknown.push(`${request.method} ${pathname}${url.search}`);
      return send(404, "Not found", "text/plain; charset=utf-8");
    }
    let body = fs.readFileSync(file);
    if (file === path.join(STATIC, "index.html")) {
      const html = body.toString("utf8").replace("</head>", '<script src="/static/js/preview-fixtures.js"></script></head>');
      body = Buffer.from(html);
    }
    send(200, body, mime(file));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { server, unknown, base: `http://127.0.0.1:${server.address().port}` };
}

async function seedCycle() {
  const response = await fetch(new URL("/__validation/campaign", SEED), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 4, healthy: true }),
  });
  if (!response.ok) throw new Error(`Cycle seed failed: ${response.status} ${await response.text()}`);
  const job = await response.json();
  const project = encodeURIComponent(job.project), id = encodeURIComponent(job.id);
  const eventResponse = await fetch(new URL(`/api/projects/${project}/cycle/jobs/${id}/events?after=0&limit=500`, SEED));
  assert(eventResponse.ok, `Cycle events seed failed: ${eventResponse.status}`);
  const events = (await eventResponse.json()).events || [];
  assert(events.length > 0, "Cycle seed produced no console events");
  return { job, events };
}

async function installProvider(page, cycleSeed, round) {
  await page.evaluate(({ cycleSeed, round }) => {
    const baseFetch = window.fetch.bind(window);
    const fixed = Math.floor(Date.now() / 1000);
    const trace = window.__DIRECTOR_WALKTHROUGH = {
      round, fixture: "rack-network + strict walkthrough provider", requests: [], unknown: [], mutations: [],
      expectedFailures: [], hardwareDispatches: 0, evidenceFailOnce: true,
    };
    const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json; charset=utf-8", "X-Director-Walkthrough": "strict-v1" },
    }));
    const job = JSON.parse(JSON.stringify(cycleSeed.job));
    job.state = "CREATED"; job.health = "UNKNOWN"; job.nodes = [];
    job.pre = null; job.stop_requested = false; job.synthetic = true;
    const events = JSON.parse(JSON.stringify(cycleSeed.events));
    const run = {
      run_id: `director-walkthrough-agent-${round}`, case_variant_id: "", node_id: "", status: "PENDING",
      started_at: new Date().toISOString(), updated_at: new Date().toISOString(), plan_revision: 1,
      attachments: [], commands: [], evidence: [], final_result: "",
    };
    const messages = [];
    let agentCreated = false;
    const telemetryNode = {
      node_id: "director-walkthrough-node", slot: "N0", hostname: "director-host-a", os_ip: "192.0.2.21",
      binding_revision: "director-walkthrough-rev", state: "READY", configured: true, stale: false,
      detail: "Host exporter, GPU exporter and Prometheus target are ready.", checked_at: fixed, dashboard_url: "",
      components: { host: "READY", prometheus: "READY", gpu: { state: "READY", detail: "DCGM metrics available.", gpus: [{ index: 0, model: "NVIDIA H100" }] } },
      host_setup: { detection: "systemctl is-active node_exporter", installation: "Fixture: no command is executed.", check_on_node: "curl 127.0.0.1:9100/metrics", check_on_manager: "Loopback fixture.", exporter_url: "http://192.0.2.21:9100/metrics", prometheus_url: "http://127.0.0.1:9090" },
      gpu_setup: { detection: "nvidia-smi", runtime_check: "docker info", runtime_prepare: "Fixture: no command is executed.", installation: "Fixture: no command is executed.", check_on_manager: "Loopback fixture.", exporter_url: "http://192.0.2.21:9400/metrics", prometheus_url: "http://127.0.0.1:9090", image: "director/dcgm-exporter:fixed" },
    };
    const points = (base, step) => Array.from({ length: 12 }, (_, i) => [(fixed - (11 - i) * 300) * 1000, base + ((i % 4) - 1.5) * step]);
    const testItems = [1, 2].map(index => ({
      case_variant_id: `director-walkthrough-case-${round}-${index}`,
      code: `WT-${String(index).padStart(3, "0")}`,
      items: `Director walkthrough read-only testcase ${index}`,
      test_set: "Director Walkthrough",
      ai_can_execute: index === 1 ? "PARTIAL" : "NO",
      ai_packages_needed: "fixture only",
      ai_commands: "printf 'loopback fixture only'",
      procedure: "Review the saved synthetic evidence. Do not operate hardware.",
      criteria: "Engineer confirms the displayed evidence and retains the final verdict.",
    }));
    const inspection = {
      running: false, delayed: false, error: "", last_completed_at: fixed, last_fast_at: fixed, last_deep_at: fixed - 120,
      checker_hash: "director-walkthrough-checker", shared_core_version: "director-walkthrough-core",
      config: { enabled: true, ai_enabled: true, interval_seconds: 300, deep_seconds: 1800, sensor_seconds: 300, firmware_seconds: 3600, duration_seconds: 120, recovery_samples: 2, stale_seconds: 300, hysteresis: 5, thresholds: { cpu: 90, memory: 90, gpu: 95, vram: 95 } },
      summary: { fail: 1, warning: 0 }, lifecycle_counts: { recovered: 1, archived: 0 }, progress: [],
      nodes: [{ node_id: "director-walkthrough-node", label: "host_a / N0", os_hostname: "director-host-a", os_hostname_raw: "director-host-a", bmc_hostname: "director-bmc-a", bmc_hostname_raw: "director-bmc-a" }],
      identity: { "director-walkthrough-node": { os_status: "SUCCESS", bmc_status: "SUCCESS", collected_at: fixed } }, identity_history: [],
      coverage: [{ node_id: "director-walkthrough-node", source: "Sensors", state: "FRESH", collected_at: fixed, duration: 1.2, detail: "Read-only synthetic evidence retained.", evidence_ref: { snapshot_id: "director-walkthrough-evidence" } }],
    };
    const issues = { issues: [{
      id: "director-walkthrough-issue", node_id: "director-walkthrough-node", affected_nodes: [], status: "ACTIVE", severity: "FAIL",
      component: "GPU", rule: "DMESG_XID", facts: "Synthetic read-only evidence contains one event for walkthrough validation.",
      first_seen_at: fixed - 3600, last_seen_at: fixed - 120, resolved_at: 0, occurrences: 1, observations: 4, recurrences: 0,
      occurrence_precision: "exact", evidence: "dmesg / Redfish EventLog", evidence_ref: { snapshot_id: "director-walkthrough-evidence" },
      acknowledged: false, known_issue: false, mute_until: 0,
      analysis: { state: "COMPLETE", completed_at: fixed - 60, result: { possible_causes: ["A transient accelerator reset was recorded."], recommended_checks: ["Correlate with retained evidence."], conclusion: "Review required; this fixture is not a hardware verdict.", confidence_note: "Synthetic UI acceptance evidence.", based_on: ["dmesg", "Redfish EventLog"] }, based_on: { last_seen_at: fixed - 120, source: "saved read-only evidence" } },
    }] };
    trace.readState = () => ({ run: JSON.parse(JSON.stringify(run)), agentCreated, messages: messages.length, cycleState: job.state });
    window.fetch = async (input, options = {}) => {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      const method = String(options.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
      const path = url.pathname;
      trace.requests.push(`${method} ${path}${url.search}`);
      if (url.origin !== location.origin) {
        trace.unknown.push(`${method} ${url.href} :: non-loopback-origin`);
        return json({ detail: "Walkthrough blocked a non-current-origin request" }, 599);
      }
      const active = path === "/api/agent/active";
      if (method === "GET" && active) return json({ ok: true, run: agentCreated ? run : null });
      if (method === "POST" && path === "/api/agent/runs") {
        const body = JSON.parse(options.body || "{}");
        Object.assign(run, { case_variant_id: body.case_variant_id, node_id: body.node_id, status: "PENDING" });
        agentCreated = true; trace.mutations.push({ action: "agent-create", method, path, body });
        return json({ ok: true, run });
      }
      if (method === "POST" && /^\/api\/agent\/runs\/[^/]+\/start$/.test(path)) {
        const body = JSON.parse(options.body || "{}");
        run.status = "WAITING_FOR_USER"; run.updated_at = new Date().toISOString();
        messages.push({ seq: 1, role: "agent", kind: "message", created_at: run.updated_at, text: "## 執行計畫\n\n1. 確認 Node 與 binding revision。\n2. 僅讀取保存的證據。\n3. 等待工程師輸入 OK / GO。\n\n此 fixture 不執行硬體命令。" });
        trace.mutations.push({ action: "agent-start-plan", method, path, body });
        return json({ ok: true, run });
      }
      if (method === "POST" && /^\/api\/agent\/runs\/[^/]+\/messages$/.test(path)) {
        const body = JSON.parse(options.body || "{}"), text = String(body.text || "");
        messages.push({ seq: messages.length + 1, role: "user", kind: "message", created_at: new Date().toISOString(), text });
        trace.mutations.push({ action: "agent-message", method, path, body });
        if (/^(ok|go)$/i.test(text.trim())) {
          run.status = "DONE"; run.ended_at = new Date().toISOString(); run.updated_at = run.ended_at;
          run.final_result = "Agent 工作已完成；保存的 evidence 已整理。此狀態不代表 PASS，請由工程師判定。";
          run.commands = [{ command: "read-only fixture", status: "DONE", output: "No hardware command executed." }];
          run.evidence = [{ name: "director-walkthrough-evidence", path: "saved/evidence.json", summary: "Synthetic read-only evidence." }];
          messages.push({ seq: messages.length + 1, role: "agent", kind: "message", created_at: run.updated_at, text: "工作已完成；等待工程師依 criteria 判定 PASS / FAIL / BLOCKED。" });
        }
        return json({ ok: true, intent: "approval", run });
      }
      if (method === "GET" && /^\/api\/agent\/runs\/[^/]+\/messages$/.test(path)) return json({ ok: true, messages });
      if (method === "GET" && /^\/api\/agent\/runs\/[^/]+\/attachments\/unconsumed$/.test(path)) return json({ ok: true, attachments: [] });
      if (method === "GET" && /^\/api\/agent\/runs\/[^/]+$/.test(path)) return json({ ok: true, run });

      if (method === "GET" && path === "/api/telemetry/systems/host_a/nodes") return json({ nodes: [telemetryNode] });
      if (method === "GET" && path === "/api/telemetry/nodes/director-walkthrough-node") return json(telemetryNode);
      if (method === "GET" && path === "/api/telemetry/nodes/director-walkthrough-node/charts") return json({
        state: "READY", last_sample: { host: fixed }, stats: { uptime: [{ value: 86400 }], load: [{ value: 3.25 }], filesystem: [{ value: 42.4 }] },
        panels: [
          { id: "cpu", title: "CPU Utilization", state: "READY", unit: "%", series: [{ label: "Host CPU", points: points(48, 3), latest: 49.5 }] },
          { id: "gpu", title: "GPU Utilization", state: "READY", unit: "%", series: [{ label: "GPU 0", points: points(72, 4), latest: 74 }] },
        ],
      });
      if (method === "GET" && path === "/api/machine/host_a/inspection") return json(inspection);
      if (method === "GET" && path === "/api/machine/host_a/inspection/issues") return json(issues);
      if (method === "GET" && path === "/api/machine/host_a/inspection/evidence/director-walkthrough-evidence/view") {
        if (trace.evidenceFailOnce) {
          trace.evidenceFailOnce = false; trace.expectedFailures.push({ path, status: 503, reason: "deliberate persistent-error / reopen scenario" });
          return json({ detail: "Synthetic evidence source temporarily unavailable" }, 503);
        }
        return json({ text: JSON.stringify([{ source: "dmesg", line: "Synthetic Xid evidence" }]), source: "Director walkthrough fixture", collected_at: fixed, truncated: false });
      }
      if (method === "GET" && path === "/api/kvm/basecode") {
        const candidates = (window.PA_PREVIEW?.machines || []).filter(machine => machine.project === url.searchParams.get("project") && machine.bmc_ip);
        return json({ sync_ok: false, reason: "Walkthrough fake provider keeps KVM offline.", detected_kinds: ["rfb"], machines: Object.fromEntries(candidates.map(machine => [machine.name, { label: "RFB fixture", proto: "RFB", online: false, rfb: true, bmc_ip: machine.bmc_ip }])) });
      }
      if (method === "GET" && path === "/api/testlibrary/meta") return json({ version: `director-walkthrough-${round}`, total: testItems.length, sheets: [{ sheet: "Walkthrough", label: "Director Walkthrough", count: testItems.length, auto: 0, partial: 1, no: 1 }] });
      if (method === "GET" && path === "/api/testlibrary" && url.searchParams.get("sheet") === "Walkthrough") return json({ version: `director-walkthrough-${round}`, sheet: "Walkthrough", items: testItems });

      if (method === "GET" && path === "/api/cycle/inventory") return json({ mode: "synthetic", projects: [{ name: job.project, project_id: job.targets[0].project_id, profile: job.targets[0].cycle_profile, targets: job.targets.map(target => ({ ...target, reasons: [] })) }] });
      if (method === "GET" && path === "/api/cycle/runs") return json({ runs: [], has_more: false });
      if (method === "POST" && path === "/api/cycle/runs") {
        const body = JSON.parse(options.body || "{}");
        trace.mutations.push({ action: "cycle-create", method, path, body });
        job.config = { ...job.config, ...body }; job.state = "AWAITING_CONFIRMATION"; job.health = "UNKNOWN"; job.nodes = [];
        job.pre = { version: `walkthrough-pre-${round}`, runnable_ids: [...body.machine_ids], excluded: [], findings: [] };
        return json(job);
      }
      if (method === "GET" && /^\/api\/cycle\/runs\/[^/]+$/.test(path)) return json(job);
      if (method === "GET" && /\/api\/projects\/[^/]+\/cycle\/jobs\/[^/]+$/.test(path)) return json(job);
      if (method === "GET" && /^\/api\/projects\/[^/]+\/cycle\/jobs\/[^/]+\/console-summary$/.test(path)) {
        const nodes = job.targets.map(target => {
          const rows = events.filter(event => event.machine_id === target.name);
          const loop = rows.reduce((latest, event) => Math.max(latest, Number(event.loop || 0)), 0);
          const latest = rows.filter(event => Number(event.loop || 0) === loop);
          const completed = [
            ["ACTION", "COMMAND_DISPATCHED"],
            ["RECOVERY", "RECOVERY_DETECTED"],
            ["POST", "POST_COMPLETED"],
          ].filter(([, type]) => latest.some(event => event.event_type === type)).map(([phase]) => phase);
          return { machine_id: target.name, loop, completed, markers: latest.slice(-2) };
        });
        return json({ nodes, basis: "typed events, latest loop per node" });
      }
      if (method === "POST" && /\/api\/projects\/[^/]+\/cycle\/jobs\/[^/]+\/confirm$/.test(path)) {
        const body = JSON.parse(options.body || "{}"); trace.mutations.push({ action: "cycle-confirm", method, path, body });
        job.state = "RUNNING"; job.health = cycleSeed.job.health; job.nodes = JSON.parse(JSON.stringify(cycleSeed.job.nodes)); job.heartbeat = Math.floor(Date.now() / 1000);
        return json(job);
      }
      if (method === "GET" && /\/api\/projects\/[^/]+\/cycle\/jobs\/[^/]+\/events$/.test(path)) {
        const after = Number(url.searchParams.get("after") || 0), limit = Number(url.searchParams.get("limit") || 500);
        const rows = events.filter(event => Number(event.sequence) > after).slice(0, limit);
        return json({ events: rows, has_more: false, next_sequence: rows.at(-1)?.sequence || after, oldest_sequence: events[0]?.sequence || 0, cursor_reset: false, history_compacted: false });
      }
      if (method === "GET" && /\/api\/projects\/[^/]+\/cycle\/jobs\/[^/]+\/artifacts$/.test(path)) return json({
        files: ["CYCLE_REVIEW_REPORT.html", "cycle_summary.json", "node/evidence.log"],
        manifest: [{ path: "CYCLE_REVIEW_REPORT.html", kind: "html-report" }, { path: "cycle_summary.json", kind: "summary" }, { path: "node/evidence.log", kind: "raw-evidence" }],
      });

      const special = path.startsWith("/api/agent/") || path.startsWith("/api/telemetry/") || path.includes("/inspection") || path.startsWith("/api/cycle/") || /\/cycle\/jobs\//.test(path);
      if (special) {
        trace.unknown.push(`${method} ${path}${url.search}`);
        return json({ detail: `Strict walkthrough provider rejected ${method} ${path}` }, 501);
      }
      const response = await baseFetch(input, options);
      if (path.startsWith("/api/")) {
        const data = await response.clone().json().catch(() => null);
        if (data?.detail === "This action is not connected in the design preview.") trace.unknown.push(`${method} ${path}${url.search}`);
      }
      return response;
    };
  }, { cycleSeed, round });
}

async function runRound(browser, base, round, cycleSeed) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, colorScheme: round % 2 ? "dark" : "light", reducedMotion: "reduce", locale: "zh-TW", timezoneId: "Asia/Taipei", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const result = { round, status: "RUNNING", steps: [], screenshots: [], pageErrors: [], consoleErrors: [], externalRequests: [], unknownRequests: [], mutations: [], expectedFailures: [], notRun: [] };
  const collectedTraces = [];
  page.on("pageerror", error => result.pageErrors.push(String(error.message || error)));
  page.on("console", message => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== base) {
      result.externalRequests.push(`${route.request().method()} ${url.href}`); return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const shot = async name => {
    const file = path.join(OUTPUT, `round-${round}-${name}.png`);
    const buffer = await page.screenshot({ path: file, fullPage: false, animations: "disabled" });
    result.screenshots.push({ file: path.basename(file), sha256: sha256(buffer), width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), route: await page.evaluate(() => location.hash) });
  };
  const step = async (name, fn) => {
    const started = Date.now();
    try { const details = await fn(); result.steps.push({ name, status: "PASS", durationMs: Date.now() - started, details: details || null }); }
    catch (error) { result.steps.push({ name, status: "FAIL", durationMs: Date.now() - started, error: String(error.stack || error) }); throw error; }
  };
  const harvestTrace = async label => {
    const trace = await page.evaluate(() => {
      if (!window.__DIRECTOR_WALKTHROUGH) return null;
      return {
        unknown: [...(window.__DIRECTOR_WALKTHROUGH.unknown || [])],
        mutations: [...(window.__DIRECTOR_WALKTHROUGH.mutations || [])],
        expectedFailures: [...(window.__DIRECTOR_WALKTHROUGH.expectedFailures || [])],
        state: window.__DIRECTOR_WALKTHROUGH.readState?.() || null,
      };
    });
    if (trace) collectedTraces.push({ label, ...trace });
  };
  const openMachine = async () => {
    await page.evaluate(() => window.openMachine("host_a"));
    await page.locator(".pd-system-header").waitFor();
  };
  try {
    await step("overview", async () => {
      await page.goto(`${base}/?preview=rack-network#/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.PA_PREVIEW?.scenario === "rack-network" && document.querySelector(".vo-overview"));
      await installProvider(page, cycleSeed, round);
      assert.match(await page.locator("body").innerText(), /PA Validation|Product Assurance/);
    });
    await step("theme-toggle", async () => {
      const before = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.locator("#theme-toggle").click();
      await page.waitForFunction(value => document.documentElement.dataset.theme !== value, before);
      return { before, after: await page.evaluate(() => document.documentElement.dataset.theme) };
    });
    await step("refresh-and-provider-reinstall", async () => {
      await harvestTrace("before-refresh");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.PA_PREVIEW?.scenario === "rack-network" && document.querySelector(".vo-overview"));
      await installProvider(page, cycleSeed, round);
      assert.equal(await page.evaluate(() => Boolean(window.__DIRECTOR_WALKTHROUGH)), true);
    });
    await step("project-system-node-inventory", async () => {
      await page.evaluate(() => window.productLevel("system"));
      await page.locator(".p-workspace-tabs").waitFor();
      await openMachine();
      await page.evaluate(() => window.productDetailTab("osslots"));
      await page.locator("#pd-panel-osslots").waitFor({ state: "visible" });
      await page.evaluate(() => window.productDetailTab("hardware"));
      await page.locator("#pd-panel-hardware").waitFor({ state: "visible" });
    });
    await step("inspection-evidence-failure-reopen", async () => {
      await page.evaluate(() => window.productDetailTab("sensors", true));
      await page.locator("#pd-sensor-live").waitFor();
      await page.locator("#pd-inspection [data-view]").click();
      await page.locator(".pd-inspection-issue summary").first().click();
      await page.locator("[data-evidence-open]").first().click();
      await page.locator('.pa-evidence-modal [data-status][data-state="error"]').waitFor();
      assert.match(await page.locator(".pa-evidence-modal [data-status]").innerText(), /temporarily unavailable|暫時/);
      await shot("evidence-error");
      await page.evaluate(() => window.InspectionEvidence.close());
      await page.locator("[data-evidence-open]").first().click();
      await page.locator('.pa-evidence-modal [data-status][data-state="loaded"]').waitFor();
      assert.match(await page.locator(".pa-evidence-modal pre").innerText(), /Synthetic Xid evidence/);
      await page.evaluate(() => window.InspectionEvidence.close());
    });
    await step("telemetry-ready", async () => {
      await page.evaluate(() => window.productDetailTab("telemetry"));
      await page.locator('#pd-panel-telemetry select[data-node] option[value="director-walkthrough-node"]').waitFor({ state: "attached" });
      await page.locator("#pd-panel-telemetry select[data-node]").selectOption("director-walkthrough-node");
      await page.waitForFunction(() => document.querySelector("#pd-panel-telemetry .tp-state")?.dataset.state === "READY");
      assert(await page.locator(".tn-panel").count() > 0);
    });
    let caseVariant = "";
    await step("test-case-single-agent-go-done", async () => {
      await page.evaluate(() => window.productDetailTab("tasks"));
      await page.locator(".pd-library-card").first().waitFor();
      await page.evaluate(() => window.openAssignTask("host_a"));
      await page.locator(".assign-sheet-card").first().click();
      await page.locator('.assign-row input[type="checkbox"]').first().check();
      caseVariant = await page.locator(".assign-row").first().evaluate(row => row.querySelector("input")?.getAttribute("onchange") || "");
      assert.match(await page.locator("#rm-dialog-foot .primary").innerText(), /PA Agent/, `single-select CTA mismatch; ${caseVariant}`);
      await page.locator("#rm-dialog-foot .primary").click();
      await page.waitForFunction(() => document.getElementById("rm-dialog-title")?.textContent.includes("確認測項"));
      assert.match(await page.locator("#rm-dialog-foot .primary").innerText(), /PA Agent/);
      await page.locator("#rm-dialog-foot .primary").click();
      await page.waitForTimeout(500);
      const agentOpenDiagnostic = await page.evaluate(() => ({
        drawer: document.getElementById("pa-agent-drawer")?.outerHTML.slice(0, 240) || null,
        dialogDisplay: getComputedStyle(document.getElementById("rm-dialog")).display,
        dialogBusy: document.getElementById("rm-dialog")?.getAttribute("aria-busy"),
        dialogTitle: document.getElementById("rm-dialog-title")?.textContent,
        dialogBody: document.getElementById("rm-dialog-body")?.innerText.slice(0, 500),
        footer: document.getElementById("rm-dialog-foot")?.innerText,
        selected: document.querySelector("#assign-selcount")?.textContent,
        notices: document.getElementById("ux-notifications")?.innerText || "",
        requests: (window.__DIRECTOR_WALKTHROUGH?.requests || []).filter(value => value.includes("/api/agent")),
      }));
      assert(agentOpenDiagnostic.drawer, `PA Agent drawer was not created: ${JSON.stringify(agentOpenDiagnostic)}`);
      await page.locator("#pa-agent-drawer.open").waitFor();
      await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師"));
      await page.locator("#pa-msg-input").fill("GO");
      await page.locator("#pa-msg-send").click();
      await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師判定"));
      assert.match(await page.locator("#pa-agent-drawer").innerText(), /不代表測試通過|等待工程師判定/);
      await shot("agent-done");
    });
    await step("agent-close-reopen", async () => {
      const state = await page.evaluate(() => window.__DIRECTOR_WALKTHROUGH.readState());
      await page.evaluate(() => window.PA_Agent.close());
      await page.waitForSelector("#pa-agent-drawer", { state: "detached" });
      await page.evaluate(run => window.PA_Agent.open({ case_variant_id: run.case_variant_id, node_id: run.node_id, expected_binding_revision: "director-walkthrough-rev", branch: "walkthrough", title: "Reopen completed run", task: "Read-only walkthrough fixture", mode: "plan" }), state.run);
      await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師判定"));
      await page.evaluate(() => window.PA_Agent.close());
      await page.waitForSelector("#pa-agent-drawer", { state: "detached" });
    });
    await step("test-case-multi-batch-no-agent", async () => {
      await page.evaluate(() => window.openAssignTask("host_a"));
      await page.locator(".assign-sheet-card").first().click();
      const boxes = page.locator('.assign-row input[type="checkbox"]');
      await boxes.nth(0).check(); await boxes.nth(1).check();
      assert.match(await page.locator("#rm-dialog-foot .primary").innerText(), /批次指令/);
      await page.locator("#rm-dialog-foot .primary").click();
      let nextSurface;
      try {
        nextSurface = await page.waitForFunction(() => {
          const result = document.querySelector(".ar-window");
          if (result && getComputedStyle(result).display !== "none") return "result";
          const title = document.getElementById("rm-dialog-title")?.textContent || "";
          if (title.includes("確認測項") || title.includes("確認批次指令範圍")) return "confirm";
          return false;
        }).then(handle => handle.jsonValue());
      } catch (error) {
        const diagnostic = await page.evaluate(() => ({
          title: document.getElementById("rm-dialog-title")?.textContent || "",
          footer: document.getElementById("rm-dialog-foot")?.innerText || "",
          resultDisplay: document.querySelector(".ar-window") ? getComputedStyle(document.querySelector(".ar-window")).display : "missing",
        }));
        throw new Error(`Batch transition was not recognized: ${JSON.stringify(diagnostic)}`, { cause: error });
      }
      if (nextSurface === "confirm") {
        assert.match(await page.locator("#rm-dialog-foot .primary").innerText(), /批次指令/);
        await page.locator("#rm-dialog-foot .primary").click();
      }
      await page.locator(".ar-window").waitFor({ state: "visible" });
      assert.match(await page.locator("#ar-title").innerText(), /批次指令/);
      assert.equal(await page.locator("#ar-pa-agent").isHidden(), true);
      assert.equal(await page.locator("#pa-agent-drawer").count(), 0);
      await page.locator('.ar-window [data-act="close"]').click();
    });
    await step("cycle-pre-confirm-console-report", async () => {
      await harvestTrace("before-cycle-navigation");
      await page.goto(`${base}/?preview=rack-network#/cycle/new`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.PA_PREVIEW?.scenario === "rack-network");
      await installProvider(page, cycleSeed, round);
      await page.locator(".cw-node").first().waitFor();
      await page.locator("#cw-visible").click();
      await page.locator("#cw-limit-kind").selectOption("loops");
      await page.locator("#cw-limit-value").fill("2");
      await page.locator("#cw-create").click();
      await page.locator("#cw-confirm").waitFor({ state: "visible" });
      await page.locator("#cw-confirm").click();
      await page.locator("#cw-console-toggle").waitFor({ state: "visible" });
      await page.locator("#cw-console-toggle").click();
      await page.waitForFunction(() => document.querySelectorAll(".cycle-console-row").length > 0);
      await shot("cycle-console");
      await page.locator(".cw-artifact-report").first().waitFor();
      const [report] = await Promise.all([context.waitForEvent("page"), page.locator(".cw-artifact-report").first().click()]);
      await report.waitForLoadState("domcontentloaded");
      assert.match(await report.title(), /Cycle Review Report/);
      await report.close();
      await harvestTrace("cycle-running");
    });
    await step("terminal-broadcast-kvm-frames", async () => {
      await page.goto(`${base}/?preview=rack-network#/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.PA_PREVIEW?.scenario === "rack-network");
      await installProvider(page, cycleSeed, round);
      await page.evaluate(() => window.openTerm("host_a"));
      await page.waitForFunction(() => getComputedStyle(document.getElementById("term-modal")).display === "flex");
      await page.evaluate(() => window.closeTerm());
      await page.evaluate(() => window.openBroadcast(["host_a", "host_g"]));
      await page.waitForFunction(() => getComputedStyle(document.getElementById("bc-modal")).display === "flex");
      await page.evaluate(() => window.closeBroadcast());
      await page.evaluate(() => window.openKvmBroadcast("fleet_l"));
      await page.locator("#kvm-grid .kvm-box").first().waitFor();
      await page.evaluate(() => window.closeKvmBroadcast());
    });
    await step("rack-topology-return-reopen", async () => {
      await page.evaluate(() => window.productRack("Naboo"));
      await page.locator("#ew-rack-canvas").waitFor();
      await page.evaluate(() => window.rackNetworkingTopology());
      await page.locator(".nt-window").waitFor();
      await page.locator('.nt-window [data-action="close"]').click();
      await page.evaluate(() => window.productLevel("system"));
      await page.locator(".p-workspace-tabs").waitFor();
      await page.evaluate(() => window.productRack("Naboo"));
      await page.locator("#ew-rack-canvas").waitFor();
    });
    await step("user-guide", async () => {
      await page.locator("#guide-btn").click();
      await page.locator(".ug-body").waitFor();
      await page.waitForFunction(() => document.querySelector(".ug-body")?.textContent.trim().length > 200);
      await shot("user-guide");
      await page.locator(".ug-close").click();
    });
    await harvestTrace("final-surface");
    result.unknownRequests = collectedTraces.flatMap(trace => trace.unknown);
    result.mutations = collectedTraces.flatMap(trace => trace.mutations);
    result.expectedFailures = collectedTraces.flatMap(trace => trace.expectedFailures);
    assert.deepEqual(result.unknownRequests, [], "unknown special-surface requests must be empty");
    assert.deepEqual(result.externalRequests, [], "external requests must be empty");
    assert.deepEqual(result.pageErrors, [], "page errors must be empty");
    assert(collectedTraces.some(trace => trace.label === "cycle-running" && trace.state?.cycleState === "RUNNING"), "Cycle trace must retain RUNNING state before navigation");
    assert.equal(result.mutations.filter(item => item.action === "agent-create").length, 1);
    assert.equal(result.mutations.filter(item => item.action === "agent-start-plan").length, 1);
    assert.equal(result.mutations.filter(item => item.action === "agent-message" && /^(ok|go)$/i.test(String(item.body?.text || "").trim())).length, 1);
    assert.equal(result.mutations.filter(item => item.action === "cycle-create").length, 1);
    assert.equal(result.mutations.filter(item => item.action === "cycle-confirm").length, 1);
    result.status = "PASS";
  } catch (error) {
    result.status = "FAIL"; result.failure = String(error.stack || error);
  } finally {
    result.notRun = result.status === "PASS" ? [
      "Physical display/projector and OS text-only scaling were not exercised.",
      "No real hardware, SSH, BMC, KVM framebuffer, Gateway or OpenHands provider was contacted.",
      "The synthetic report proves the existing entry opens; it does not validate production report generation or saved-file completion.",
    ] : ["Remaining steps after the first failed step were not run in this round."];
    await context.close();
  }
  return result;
}

(async () => {
  const serverState = await startServer();
  let browser;
  const rounds = [];
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true, args: ["--force-device-scale-factor=1", "--high-dpi-support=1", "--font-render-hinting=none", "--use-angle=swiftshader", "--enable-webgl"] });
    for (let round = 1; round <= ROUNDS; round++) rounds.push(await runRound(browser, serverState.base, round, await seedCycle()));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => serverState.server.close(resolve));
  }
  const status = git("status", "--porcelain", "--untracked-files=normal") || "";
  const metadata = {
    schema: "director-walkthrough/v1", result: rounds.every(round => round.status === "PASS") ? "PASS" : "FAIL",
    mode: "strict loopback synthetic fixtures; no hardware transport", app: { root: REPO, sha: git("rev-parse", "HEAD"), dirty: Boolean(status.trim()) },
    browser: { name: "Microsoft Edge via Playwright", version: browser?.version?.() || "closed", viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
    staticServer: { host: "127.0.0.1", ephemeralPort: true, unknownRequests: serverState.unknown }, cycleSeed: { origin: SEED.origin, endpoint: "/__validation/campaign", mode: "synthetic" },
    rounds, limitations: ["This is synthetic UI acceptance, not real hardware end-to-end acceptance.", "Physical display/projector, OS text-only 200%, and real OS per-monitor scaling remain unverified."], generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUTPUT, "metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
  console.log(JSON.stringify({ result: metadata.result, rounds: rounds.map(round => ({ round: round.round, status: round.status, steps: round.steps.map(step => `${step.name}:${step.status}`), unknown: round.unknownRequests.length, external: round.externalRequests.length, pageErrors: round.pageErrors.length, failure: round.failure || null })), serverUnknown: serverState.unknown }, null, 2));
  if (metadata.result !== "PASS" || serverState.unknown.length) process.exitCode = 1;
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
