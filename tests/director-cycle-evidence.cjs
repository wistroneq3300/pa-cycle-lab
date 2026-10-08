"use strict";

/*
 * S08 Cycle visual evidence harness.
 *
 * This is deliberately separate from director-cycle-browser.cjs: the latter
 * protects the current wording and interaction contract, while this harness
 * can render both the detached fe82088 baseline and the current worktree.
 * It still uses an explicit synthetic allowlist, rejects unknown API calls,
 * and never opens a hardware transport.
 *
 * Required environment:
 *   PA_PREVIEW_URL       loopback validation_console_preview server
 *   APP_ROOT             worktree served by that server
 *   PA_CYCLE_CAPTURE_DIR evidence output directory
 * Optional:
 *   BROWSER_ZOOM         1, 1.25 or 2 (default 1)
 *   PHASE                before or after
 */

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
} catch (_) {
  playwright = require("C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
}
const { chromium, request } = playwright;

const REPO = path.resolve(__dirname, "..");
const APP_ROOT = path.resolve(process.env.APP_ROOT || REPO);
const BASE = process.env.PA_PREVIEW_URL || "http://127.0.0.1:19492";
const baseUrl = new URL(BASE);
const OUTPUT = path.resolve(process.env.PA_CYCLE_CAPTURE_DIR || path.join(
  REPO, "docs", "ui-premium", "screens", "cycle-after-zoom125"));
const PHASE = process.env.PHASE || "after";
const ZOOM = Number(process.env.BROWSER_ZOOM || "1");
const ZOOM_EXTENSION = path.resolve(process.env.ZOOM_EXTENSION || path.join(
  REPO, "tests", "fixtures", "director-zoom-extension"));
const VIEWPORTS = [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }];
const THEMES = ["light", "dark"];
const assetFiles = [
  "app/static/js/cycle-workspace.js",
  "app/static/js/cycle-console.js",
  "app/static/js/cycle-fleet.js",
  "app/static/css/cycle-workspace.css",
  "app/static/css/validation-console.css",
];

assert(["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname),
  `Refusing non-loopback target ${baseUrl.origin}`);
assert([1, 1.25, 2].includes(ZOOM), "BROWSER_ZOOM must be 1, 1.25 or 2");
assert(["before", "after"].includes(PHASE), "PHASE must be before or after");
for (const name of ["manifest.json", "service-worker.js", "content-script.js"]) {
  assert(fs.existsSync(path.join(ZOOM_EXTENSION, name)), `Missing browser zoom extension file: ${name}`);
}
fs.mkdirSync(OUTPUT, { recursive: true });

const clone = value => JSON.parse(JSON.stringify(value));
const sha256 = buffer => crypto.createHash("sha256").update(buffer).digest("hex");
const git = (...args) => cp.execFileSync("git", ["-C", APP_ROOT, ...args], {
  encoding: "utf8", windowsHide: true,
}).trim();
const pngDimensions = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });

function readOsScaling() {
  try {
    const raw = cp.execFileSync("reg", ["query", "HKCU\\Control Panel\\Desktop\\WindowMetrics", "/v", "AppliedDPI"], {
      encoding: "utf8", windowsHide: true,
    }).trim();
    const match = raw.match(/AppliedDPI\s+REG_DWORD\s+0x([0-9a-f]+)/i);
    const dpi = match ? parseInt(match[1], 16) : null;
    return {
      source: "HKCU\\Control Panel\\Desktop\\WindowMetrics\\AppliedDPI",
      appliedDpi: dpi,
      registryPercent: dpi ? Number(((dpi / 96) * 100).toFixed(2)) : null,
      limitation: "Registry evidence only; it does not prove the physical display used for a future presentation.",
      raw,
    };
  } catch (error) {
    return { source: "Windows registry", appliedDpi: null, registryPercent: null, error: String(error.message || error) };
  }
}

function removeProfile(profile) {
  if (!profile) return;
  const safeRoot = path.resolve(os.tmpdir()) + path.sep;
  const resolved = path.resolve(profile);
  if (!resolved.startsWith(safeRoot) || !path.basename(resolved).startsWith("director-cycle-evidence-")) return;
  try { fs.rmSync(resolved, { recursive: true, force: true }); } catch (_) { /* Edge can release late. */ }
}

async function waitForZoomEvidence(page) {
  if (ZOOM === 1) return {
    status: "default-100", requested: 1, actual: 1,
    source: "Fresh persistent Edge profile; no zoom mutation requested",
  };
  await page.waitForFunction(() => {
    const value = document.querySelector('meta[name="director-browser-zoom-evidence"]')?.content;
    return Boolean(value && value.length > 2);
  }, null, { timeout: 15000 });
  const raw = await page.locator('meta[name="director-browser-zoom-evidence"]').getAttribute("content");
  const evidence = JSON.parse(raw || "{}");
  assert.equal(evidence.status, "applied", `Browser zoom extension did not apply zoom: ${raw}`);
  assert(Math.abs(Number(evidence.actual) - ZOOM) < 0.0001,
    `chrome.tabs.getZoom=${evidence.actual}; expected ${ZOOM}`);
  return evidence;
}

(async () => {
  const seed = await request.newContext({ baseURL: BASE });
  const capabilitiesResponse = await seed.get("/api/cycle/capabilities");
  assert(capabilitiesResponse.ok(), await capabilitiesResponse.text());
  const capabilities = await capabilitiesResponse.json();
  assert.equal(capabilities.mode, "synthetic", "Evidence server must be synthetic");

  const jobs = new Map();
  for (const count of [1, 4, 32, 128]) {
    const response = await seed.post("/__validation/campaign", { data: { count } });
    assert(response.ok(), await response.text());
    jobs.set(count, await response.json());
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "director-cycle-evidence-"));
  const args = [
    "--force-device-scale-factor=1", "--high-dpi-support=1", "--font-render-hinting=none",
    `--disable-extensions-except=${ZOOM_EXTENSION}`, `--load-extension=${ZOOM_EXTENSION}`,
  ];
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.BROWSER_CHANNEL || "msedge",
    headless: process.env.ZOOM_HEADED !== "1",
    viewport: VIEWPORTS[0], deviceScaleFactor: 1, reducedMotion: "reduce",
    locale: "zh-TW", timezoneId: "Asia/Taipei", serviceWorkers: "allow",
    permissions: ["clipboard-read", "clipboard-write"], args,
  });
  const pages = context.pages();
  const page = pages[0] || await context.newPage();
  const cdp = await context.newCDPSession(page);
  const unknown = [], allowedPassThrough = [], mutations = [], pageErrors = [], consoleErrors = [];
  const captures = [], fixtureChecks = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });

  const run4 = jobs.get(4);
  const current = new Map([...jobs].map(([count, job]) => [job.id, clone(job)]));
  const historyJob = { ...clone(run4), state: "COMPLETE", stop_requested: false, updated_at: run4.updated_at + 30 };
  const inventory = {
    mode: "synthetic",
    projects: [{
      name: run4.project, project_id: run4.targets[0].project_id,
      profile: run4.targets[0].cycle_profile,
      targets: run4.targets.map(target => ({ ...target, reasons: [] })),
    }],
  };
  const artifacts = {
    files: ["CYCLE_REVIEW_REPORT.html", "cycle_summary.json", "node/loop4/dmesg.txt"],
    manifest: [
      { path: "CYCLE_REVIEW_REPORT.html", kind: "html-report" },
      { path: "cycle_summary.json", kind: "summary" },
      { path: "node/loop4/dmesg.txt", kind: "raw-evidence" },
    ],
  };

  await page.route("**/api/**", async route => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());
    const pathname = url.pathname;
    if (url.origin !== baseUrl.origin) {
      unknown.push({ method, url: req.url(), reason: "non-loopback API" });
      return route.abort();
    }
    if (method === "GET" && pathname === "/api/cycle/inventory") return route.fulfill({ json: inventory });
    if (method === "GET" && pathname === "/api/cycle/runs") return route.fulfill({ json: { runs: [historyJob], has_more: false } });
    const direct = pathname.match(/^\/api\/cycle\/runs\/([^/]+)$/);
    if (method === "GET" && direct) {
      const job = current.get(decodeURIComponent(direct[1]));
      return job ? route.fulfill({ json: job }) : route.fulfill({ status: 404, json: { detail: "Synthetic job not found" } });
    }
    if (method === "POST" && pathname === "/api/cycle/runs") {
      const body = req.postDataJSON();
      mutations.push({ action: "create", method, path: pathname, body });
      assert.deepEqual(Object.keys(body).sort(), [
        "channel", "cycle_mode", "cycle_profile", "idempotency_key", "limits", "machine_ids", "project",
      ].sort());
      assert.equal(body.project, run4.project);
      assert.equal(body.machine_ids.length, 4);
      const job = current.get(run4.id);
      job.state = "AWAITING_CONFIRMATION";
      job.stop_requested = false;
      job.pre = {
        version: "director-evidence-pre-v1",
        runnable_ids: job.targets.map(target => target.name), excluded: [], findings: [],
      };
      return route.fulfill({ json: job });
    }
    const projectJob = pathname.match(/^\/api\/projects\/[^/]+\/cycle\/jobs\/([^/]+)$/);
    if (method === "GET" && projectJob) {
      const job = current.get(decodeURIComponent(projectJob[1]));
      return job ? route.fulfill({ json: job }) : route.fulfill({ status: 404, json: { detail: "Synthetic job not found" } });
    }
    const jobAction = pathname.match(/^\/api\/projects\/[^/]+\/cycle\/jobs\/([^/]+)\/(confirm|stop|reconcile)$/);
    if (method === "POST" && jobAction) {
      const [, id, action] = jobAction;
      const job = current.get(decodeURIComponent(id));
      assert(job, `Unknown synthetic job ${id}`);
      const body = req.postDataJSON();
      mutations.push({ action, method, path: pathname, body });
      if (action === "confirm") {
        assert.deepEqual(body, { version: job.pre.version, machine_ids: job.pre.runnable_ids });
        job.state = "RUNNING";
      }
      if (action === "stop") { assert.deepEqual(body, {}); job.state = "STOP_REQUESTED"; job.stop_requested = true; }
      if (action === "reconcile") { job.state = "INCOMPLETE"; }
      return route.fulfill({ json: job });
    }
    if (method === "GET" && /\/artifacts$/.test(pathname)) return route.fulfill({ json: artifacts });
    if (method === "GET" && ["/api/machines", "/api/projects", "/api/ai/gpu-alerts", "/api/settings/public"].includes(pathname)) {
      allowedPassThrough.push({ method, path: pathname });
      return route.continue();
    }
    if (method === "GET" && /^\/api\/projects\/[^/]+\/cycle\/jobs\//.test(pathname)) {
      allowedPassThrough.push({ method, path: pathname });
      return route.continue();
    }
    unknown.push({ method, path: pathname });
    return route.fulfill({ status: 501, json: { detail: `Strict Cycle evidence harness rejected ${method} ${pathname}` } });
  });

  const routeUrl = hash => `${BASE}/?director_zoom=${ZOOM}#${hash}`;
  let zoomEvidence = null;

  async function setTheme(theme) {
    await page.evaluate(value => {
      localStorage.setItem("pa_theme", value);
      if (typeof window.applyTheme === "function") window.applyTheme(value);
      else {
        document.documentElement.dataset.theme = value;
        document.body?.setAttribute("data-theme", value);
      }
    }, theme);
    await page.waitForTimeout(180);
  }

  async function capture(state, viewport, theme, targetSelector, extraSelectors = []) {
    await page.setViewportSize(viewport);
    await setTheme(theme);
    const target = page.locator(targetSelector).first();
    await target.waitFor({ state: "visible" });
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    const measurement = await page.evaluate(({ targetSelector, extraSelectors }) => {
      const visibleRect = selector => {
        const element = document.querySelector(selector);
        if (!element) return { selector, exists: false, inViewport: false, rect: null };
        const r = element.getBoundingClientRect();
        const rect = Object.fromEntries(["top", "right", "bottom", "left", "width", "height"]
          .map(key => [key, Number(r[key].toFixed(2))]));
        return {
          selector, exists: true, rect,
          inViewport: r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5,
        };
      };
      const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
      return {
        window: { innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio },
        visualViewport: window.visualViewport ? {
          width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale,
          offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
        } : null,
        documentWidth,
        bodyHorizontalOverflow: documentWidth > document.documentElement.clientWidth + 1,
        controls: [targetSelector, ...extraSelectors].map(visibleRect),
      };
    }, { targetSelector, extraSelectors });
    assert.equal(measurement.bodyHorizontalOverflow, false,
      `${state} ${viewport.width} ${theme}: horizontal body overflow`);
    assert.equal(measurement.controls[0].inViewport, true,
      `${state} ${viewport.width} ${theme}: primary reviewed control is not reachable`);
    const fileName = `${state}-${viewport.width}-${theme}.png`;
    const file = path.join(OUTPUT, fileName);
    // Playwright's scrolled viewport clip is offset by (zoom - 1) * scrollY
    // under real tab zoom.  A direct visible-surface capture avoids the false
    // blank band while preserving the same actual tab, zoom and pixels.
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png", fromSurface: true, captureBeyondViewport: false,
    });
    const image = Buffer.from(screenshot.data, "base64");
    fs.writeFileSync(file, image);
    captures.push({
      file: fileName, sha256: sha256(image), screenshotPixels: pngDimensions(image),
      requestedViewport: viewport, theme, browserZoomRequested: ZOOM,
      browserZoomActual: zoomEvidence?.actual ?? 1, measurement,
    });
  }

  async function captureGrid(state, targetSelector, extraSelectors = []) {
    for (const viewport of VIEWPORTS) {
      for (const theme of THEMES) await capture(state, viewport, theme, targetSelector, extraSelectors);
    }
  }

  let result = "PASS";
  let failure = null;
  try {
    await page.goto(routeUrl("/cycle/new"), { waitUntil: "domcontentloaded" });
    zoomEvidence = await waitForZoomEvidence(page);
    await page.locator(".cw-node").first().waitFor();
    await page.locator("#cw-visible").click();
    await page.locator("#cw-limit-kind").selectOption("loops");
    await page.locator("#cw-limit-value").fill("2");
    assert.match(await page.locator("#cw-count").innerText(), /4\s*個節點/);
    await captureGrid("create", "#cw-create", ["#cw-visible", "#cw-limit-value"]);

    await page.locator("#cw-create").click();
    await page.locator("#cw-confirm").waitFor({ state: "visible" });
    assert.equal(mutations.filter(item => item.action === "create").length, 1);
    await captureGrid("pre-confirm", "#cw-confirm", ["#cw-pre-shell"]);

    await page.locator("#cw-confirm").click();
    await page.locator("#cw-console-toggle").waitFor({ state: "visible" });
    assert.equal(mutations.filter(item => item.action === "confirm").length, 1);
    await page.locator("#cw-console-toggle").click();
    await page.waitForFunction(() => document.querySelectorAll(".cycle-console-row").length > 0);
    await captureGrid("run-console", ".live-console [data-part=download]", ["#cw-console-toggle", ".live-console [data-part=copy]"]);

    await page.locator("#cw-evidence-count").waitFor({ state: "visible" });
    assert.equal(await page.locator("#cw-test-results-title").innerText(), "Test Results");
    assert.equal(await page.locator(".cw-artifact-report").count(), 2);
    assert.equal(await page.locator(".cw-artifact-link").count(), 1);
    await captureGrid("evidence", ".cw-results-head", ["#cw-files a"]);

    for (const count of [1, 4, 32, 128]) {
      const job = jobs.get(count);
      current.set(job.id, clone(job));
      await page.goto(routeUrl(`/cycle/runs/${job.id}`), { waitUntil: "domcontentloaded" });
      await page.locator("#cw-console-toggle").waitFor({ state: "visible" });
      await page.locator("#cw-console-toggle").click();
      await page.waitForFunction(expected => document.querySelector(".lc-fleet-counts strong")?.textContent === expected,
        `${count} ${count === 1 ? "NODE" : "NODES"}`);
      const summaryRowCount = await page.locator(".cycle-console-row").count();
      if (summaryRowCount === 0) {
        await page.locator("[data-part=full]").click();
        await page.waitForFunction(() => document.querySelectorAll(".cycle-console-row").length > 0);
      }
      const verifiedRowCount = await page.locator(".cycle-console-row").count();
      const label = await page.locator(".lc-fleet-counts strong").innerText();
      fixtureChecks.push({
        count, label, summaryRowCount, verifiedRowCount,
        eventView: summaryRowCount === 0 ? "full (raw-event verification after no Summary row at immediate check)" : "summary",
        strictLabel: label === `${count} ${count === 1 ? "NODE" : "NODES"}`,
      });
      assert(verifiedRowCount > 0, `${count}-node synthetic fixture has no console events even in Full mode`);
      if (count === 1) assert.equal(await page.locator(".lc-fleet-controls").count(), 0);
      if (count > 8) {
        const fleetText = await page.locator(".lc-fleet-counts").innerText();
        assert.match(fleetText, /(Health PASS|Completed \/ healthy)/);
        assert.match(fleetText, /(Recovery|recovery)/);
      }
    }

    assert.deepEqual(unknown, [], "Unknown API requests must remain empty");
    assert.deepEqual(pageErrors, [], "Page errors must remain empty");
  } catch (error) {
    result = "FAIL";
    failure = { name: error.name, message: error.message, stack: error.stack };
    throw error;
  } finally {
    const status = cp.execFileSync("git", ["-C", APP_ROOT, "status", "--porcelain"], {
      encoding: "utf8", windowsHide: true,
    });
    const metadata = {
      result, failure,
      phase: PHASE,
      mode: "loopback synthetic fixtures; strict API allowlist; no hardware transport",
      appRoot: APP_ROOT,
      appSha: git("rev-parse", "HEAD"),
      appDirty: Boolean(status.trim()),
      branch: git("branch", "--show-current") || "detached",
      browser: "Microsoft Edge / Playwright persistent context",
      browserZoom: {
        requested: ZOOM, evidence: zoomEvidence,
        method: ZOOM === 1 ? "fresh profile default" : "MV3 chrome.tabs.setZoom + chrome.tabs.getZoom",
        deviceScaleFactor: 1,
      },
      screenshotCapture: {
        api: "Chrome DevTools Protocol Page.captureScreenshot",
        scope: "actual visible browser surface; fullPage=false equivalent",
        reason: "Avoids Playwright's false (zoom - 1) * scrollY blank band after a real per-tab zoom; no image post-processing was used.",
      },
      os: { platform: process.platform, release: os.release(), scaling: readOsScaling() },
      requestedViewports: VIEWPORTS,
      themes: THEMES,
      fixtures: [1, 4, 32, 128],
      fixtureChecks,
      captures,
      mutations,
      allowedPassThrough,
      unknownRequests: unknown,
      pageErrors,
      consoleErrors,
      assets: Object.fromEntries(assetFiles.map(file => {
        const absolute = path.join(APP_ROOT, file);
        return [file, fs.existsSync(absolute) ? sha256(fs.readFileSync(absolute)) : null];
      })),
      baselineCurrentAcceptanceComparison: PHASE === "before" ? {
        command: "tests/director-cycle-browser.cjs against fe82088",
        status: "FAIL_AFTER_5_SCREENSHOTS",
        reason: "Current acceptance expects the revised 'cumulative validation health' wording; fe82088 rendered '累積健康'. Baseline was not modified.",
        observedSummary: "執行狀態 Running · 累積健康 Fail · 覆蓋 4 / 4 個節點 · 執行狀態與硬體驗證結果分開判定",
      } : null,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(OUTPUT, "metadata.json"), JSON.stringify(metadata, null, 2));
    await context.close();
    await seed.dispose();
    removeProfile(profile);
    console.log(JSON.stringify({ result, phase: PHASE, zoom: ZOOM, captures: captures.length, fixtures: fixtureChecks, unknown: unknown.length }));
  }
})().catch(error => { console.error(error); process.exit(1); });
