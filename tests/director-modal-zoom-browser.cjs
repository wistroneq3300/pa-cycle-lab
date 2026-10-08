"use strict";

/*
 * Bounded 100% / real-browser-125% accessibility check for the shared
 * #rm-dialog connection and Test Assignment surfaces.
 *
 * Production HTML/CSS/JS is rendered on loopback.  An MV3 extension applies
 * and reads Chrome tab zoom for 125%; deviceScaleFactor is deliberately kept
 * at 1.  Every API read is explicitly fixture-backed, every mutation is
 * rejected, and no Terminal/KVM/Broadcast or hardware provider is opened.
 *
 *   $env:PHASE='before'; node tests/director-modal-zoom-browser.cjs
 *   $env:PHASE='after';  node tests/director-modal-zoom-browser.cjs
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
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
const baseUrl = new URL(BASE);
const PHASE = process.env.PHASE || "after";
const OUTPUT = path.resolve(process.env.OUTPUT || path.join(
  REPO, "docs", "ui-premium", "screens", "director-modal-zoom", PHASE));
const ZOOM_EXTENSION_ROOT = path.resolve(process.env.ZOOM_EXTENSION || path.join(
  REPO, "tests", "fixtures", "director-zoom-extension"));
const VIEWPORT = { width: 1366, height: 768 };
const THEMES = ["light", "dark"];
const ZOOMS = [1, 1.25];

assert(["before", "after"].includes(PHASE), "PHASE must be before or after");
assert(["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname),
  `Refusing non-loopback UI target: ${baseUrl.origin}`);
for (const required of ["manifest.json", "service-worker.js", "content-script.js"]) {
  assert(fs.existsSync(path.join(ZOOM_EXTENSION_ROOT, required)), `Zoom extension is incomplete: ${required}`);
}
fs.mkdirSync(OUTPUT, { recursive: true });

function git(...args) {
  try {
    return execFileSync("git", ["-C", REPO, ...args], {
      encoding: "utf8", windowsHide: true,
    }).trim();
  } catch (_) { return null; }
}

function pngDimensions(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "Screenshot is not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function removeZoomProfile(profile) {
  if (!profile) return;
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  const resolved = path.resolve(profile);
  if (!resolved.startsWith(temporaryRoot) || !path.basename(resolved).startsWith("director-modal-zoom-profile-")) return;
  fs.rmSync(resolved, { recursive: true, force: true });
}

const fixedIso = "2026-10-08T04:00:00.000Z";
const machine = {
  name: "host_a", project: "Director Modal Zoom", level: "system", mgx_type: "server",
  active_os: 1, os_ip: "192.0.2.21", bmc_ip: "198.51.100.21",
  os_user: "engineer", os_port: 22, bmc_user: "admin", bmc_port: 22,
  os_status: "online", bmc_status: "online", power: "on",
  os: [{
    slot: 1, node_id: "director-node-modal-zoom-00000000000000000001",
    ip: "192.0.2.21", bmc_ip: "198.51.100.21",
    os_hostname: "director-host-a.example.internal", expected_binding_revision: "director-revision-125",
  }],
};
const projectsFixture = [{
  name: machine.project, desc: "Strict loopback fixture for modal zoom reachability.",
  machine_count: 1, level: "system",
}];
const testItems = Array.from({ length: 14 }, (_, index) => ({
  case_variant_id: `director-modal-zoom-case-${String(index + 1).padStart(2, "0")}`,
  code: `MODAL-ZOOM-${String(index + 1).padStart(3, "0")}`,
  items: `長內容測試案例 ${index + 1}／確認 125% 縮放時最後一筆選項與固定操作列仍可由鍵盤到達`,
  test_set: "Director 125% Modal Accessibility",
  ai_can_execute: index % 3 === 0 ? "PARTIAL" : "NO",
  ai_packages_needed: index % 2 ? "" : "read-only fixture package",
  ai_commands: "printf 'loopback fixture only'\nprintf 'no hardware request'\nprintf 'engineer verdict retained'",
}));

function responseFixtures(url, method) {
  if (method !== "GET") return null;
  if (url.pathname === "/api/machines") return { last_scan: fixedIso, machines: [machine] };
  if (url.pathname === "/api/projects") return { projects: projectsFixture };
  if (url.pathname === "/api/ai/gpu-alerts") return { alerts: [] };
  if (url.pathname === "/api/settings/public") return {};
  if (url.pathname === "/api/testlibrary/meta") return {
    version: "director-modal-zoom-v1",
    sheets: [{ sheet: "Director", label: "Director 125% 長內容測試資料庫", count: testItems.length, auto: 0, partial: 5, no: 9 }],
  };
  if (url.pathname === "/api/testlibrary" && url.searchParams.get("sheet") === "Director") {
    return { version: "director-modal-zoom-v1", sheet: "Director", items: testItems };
  }
  return undefined;
}

async function browserZoomEvidence(page, requested) {
  if (requested === 1) return {
    status: "default-100", requested: 1, actual: 1,
    source: "Fresh browser context with no zoom mutation",
  };
  await page.waitForFunction(() => {
    const value = document.querySelector('meta[name="director-browser-zoom-evidence"]')?.content;
    return Boolean(value && value.length > 2);
  }, null, { timeout: 10000 });
  const raw = await page.locator('meta[name="director-browser-zoom-evidence"]').getAttribute("content");
  const evidence = JSON.parse(raw || "{}");
  assert.equal(evidence.status, "applied", `Browser zoom was not applied: ${raw}`);
  assert(Math.abs(Number(evidence.actual) - requested) < 0.0001,
    `Expected browser zoom ${requested}; chrome.tabs.getZoom returned ${evidence.actual}`);
  return evidence;
}

async function launchZoomContext(theme) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "director-modal-zoom-profile-"));
  const args = [
    "--force-device-scale-factor=1", "--high-dpi-support=1", "--font-render-hinting=none",
    `--disable-extensions-except=${ZOOM_EXTENSION_ROOT}`,
    `--load-extension=${ZOOM_EXTENSION_ROOT}`,
  ];
  const options = {
    viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "reduce",
    locale: "zh-TW", timezoneId: "Asia/Taipei", serviceWorkers: "allow",
    headless: process.env.ZOOM_HEADED !== "1", args,
  };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  else options.channel = process.env.BROWSER_CHANNEL || "msedge";
  const context = await chromium.launchPersistentContext(profile, options);
  return { context, profile };
}

async function measureSurface(page, surface) {
  return page.evaluate(({ surface }) => {
    const backdrop = document.getElementById("rm-dialog");
    const modal = backdrop?.querySelector(".rm-modal");
    const body = document.getElementById("rm-dialog-body");
    const footer = document.getElementById("rm-dialog-foot");
    const primary = footer?.querySelector(".primary") || footer?.querySelector("button:last-child");
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return Object.fromEntries(["x", "y", "top", "right", "bottom", "left", "width", "height"]
        .map(key => [key, Number(value[key].toFixed(3))]));
    };
    const visible = element => Boolean(element && getComputedStyle(element).display !== "none" && element.getClientRects().length);
    const bodyFocusable = [...(body?.querySelectorAll(
      'button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])') || [])]
      .filter(visible);
    const last = bodyFocusable.at(-1) || null;
    let scrollOwner = last?.parentElement || body;
    while (scrollOwner && scrollOwner !== body &&
      !(scrollOwner.scrollHeight > scrollOwner.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(scrollOwner).overflowY))) {
      scrollOwner = scrollOwner.parentElement;
    }
    if (!scrollOwner || !body?.contains(scrollOwner)) scrollOwner = body;
    if (scrollOwner) scrollOwner.scrollTop = scrollOwner.scrollHeight;
    if (body) body.scrollTop = body.scrollHeight;
    last?.focus({ preventScroll: false });
    last?.scrollIntoView({ block: "nearest", inline: "nearest" });
    // Keep the final control focused, then prove the owning scroll region can
    // still reach its exact end instead of accepting a near-bottom heuristic.
    if (scrollOwner) scrollOwner.scrollTop = scrollOwner.scrollHeight;
    if (body) body.scrollTop = body.scrollHeight;
    const inner = { width: innerWidth, height: innerHeight };
    const visual = visualViewport ? {
      width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale,
      offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop,
      pageLeft: visualViewport.pageLeft, pageTop: visualViewport.pageTop,
    } : null;
    const viewportRect = element => {
      const value = element?.getBoundingClientRect();
      return Boolean(value && value.top >= -0.5 && value.left >= -0.5 &&
        value.bottom <= inner.height + 0.5 && value.right <= inner.width + 0.5);
    };
    const bodyRect = body?.getBoundingClientRect();
    const lastRect = last?.getBoundingClientRect();
    const lastWithinBody = Boolean(bodyRect && lastRect &&
      lastRect.top >= bodyRect.top - 0.5 && lastRect.bottom <= bodyRect.bottom + 0.5 &&
      lastRect.left >= bodyRect.left - 0.5 && lastRect.right <= bodyRect.right + 0.5);
    const backdropRect = backdrop?.getBoundingClientRect();
    const topHit = document.elementFromPoint(4, 4);
    const backdropStyle = backdrop ? getComputedStyle(backdrop) : null;
    const modalStyle = modal ? getComputedStyle(modal) : null;
    const bodyStyle = body ? getComputedStyle(body) : null;
    const footerStyle = footer ? getComputedStyle(footer) : null;
    return {
      surface,
      window: { innerWidth: innerWidth, innerHeight: innerHeight, outerWidth, outerHeight, scrollX, scrollY },
      visualViewport: visual,
      devicePixelRatio,
      rects: {
        backdrop: rect(backdrop), modal: rect(modal), body: rect(body), footer: rect(footer),
        primary: rect(primary), lastBodyFocusable: rect(last),
      },
      computed: {
        backdrop: backdropStyle ? {
          position: backdropStyle.position, inset: backdropStyle.inset, top: backdropStyle.top,
          right: backdropStyle.right, bottom: backdropStyle.bottom, left: backdropStyle.left,
          height: backdropStyle.height, padding: backdropStyle.padding, alignItems: backdropStyle.alignItems,
          overflow: backdropStyle.overflow, zIndex: backdropStyle.zIndex,
        } : null,
        modal: modalStyle ? { height: modalStyle.height, maxHeight: modalStyle.maxHeight, overflow: modalStyle.overflow } : null,
        body: bodyStyle ? { height: bodyStyle.height, maxHeight: bodyStyle.maxHeight, overflowY: bodyStyle.overflowY } : null,
        footer: footerStyle ? { height: footerStyle.height, flexShrink: footerStyle.flexShrink } : null,
      },
      bodyScroll: body ? {
        scrollTop: body.scrollTop, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight,
        maxScrollTop: Math.max(0, body.scrollHeight - body.clientHeight),
        bottomReachable: Math.abs(body.scrollTop - Math.max(0, body.scrollHeight - body.clientHeight)) <= 1,
        focusableCount: bodyFocusable.length,
        lastFocusable: last?.id || last?.getAttribute("aria-label") || last?.getAttribute("type") || last?.tagName || null,
        lastFocused: document.activeElement === last,
        lastWithinBody,
        lastWithinViewport: viewportRect(last),
      } : null,
      descendantScroll: scrollOwner ? {
        owner: scrollOwner.id ? `#${scrollOwner.id}` : scrollOwner.className ? `.${String(scrollOwner.className).trim().split(/\s+/).join(".")}` : scrollOwner.tagName,
        scrollTop: scrollOwner.scrollTop, scrollHeight: scrollOwner.scrollHeight,
        clientHeight: scrollOwner.clientHeight,
        maxScrollTop: Math.max(0, scrollOwner.scrollHeight - scrollOwner.clientHeight),
        bottomReachable: Math.abs(scrollOwner.scrollTop - Math.max(0, scrollOwner.scrollHeight - scrollOwner.clientHeight)) <= 1,
      } : null,
      assertions: {
        backdropCoversViewport: Boolean(backdropRect && backdropRect.top <= 0.5 && backdropRect.left <= 0.5 &&
          backdropRect.right >= inner.width - 0.5 && backdropRect.bottom >= inner.height - 0.5),
        backdropOwnsTopPoint: Boolean(backdrop && topHit && backdrop.contains(topHit)),
        modalFullyInViewport: viewportRect(modal),
        footerFullyInViewport: viewportRect(footer),
        primaryFullyInViewport: viewportRect(primary),
        bodyBottomReachable: Boolean(scrollOwner && Math.abs(scrollOwner.scrollTop - Math.max(0, scrollOwner.scrollHeight - scrollOwner.clientHeight)) <= 1),
        lastBodyFocusReachable: Boolean(last && document.activeElement === last && lastWithinBody && viewportRect(last)),
      },
    };
  }, { surface });
}

async function runContext(context, theme, zoom, manifest) {
  const state = { requests: [], mutations: [], unknownReads: [], external: [], pageErrors: [], consoleErrors: [] };
  await context.addInitScript(value => {
    localStorage.setItem("pa_theme", value);
    sessionStorage.setItem("pa_dashboard_cinematic_v3_played", "1");
  }, theme);
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (["http:", "https:"].includes(url.protocol) && url.origin !== baseUrl.origin) {
      state.external.push(`${method} ${url.href}`);
      return route.abort("blockedbyclient");
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const key = `${method} ${url.pathname}${url.search}`;
    state.requests.push(key);
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      state.mutations.push(key);
      return route.fulfill({
        status: 599, contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ detail: "Mutation rejected by Director modal zoom harness" }),
      });
    }
    const fixture = responseFixtures(url, method);
    if (fixture === undefined) {
      state.unknownReads.push(key);
      return route.fulfill({
        status: 599, contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ detail: "Unknown read rejected by Director modal zoom harness" }),
      });
    }
    return route.fulfill({
      status: 200, contentType: "application/json; charset=utf-8",
      headers: { "X-Director-Fixture": "modal-zoom-v1" }, body: JSON.stringify(fixture),
    });
  });

  const page = context.pages()[0] || await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => state.pageErrors.push(String(error.message || error)));
  page.on("console", message => { if (message.type() === "error") state.consoleErrors.push(message.text()); });
  const query = zoom === 1 ? "" : `?director_zoom=${zoom}`;
  await page.goto(`${BASE}/${query}#/projects`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof showDialog === "function" && typeof changeOsIp === "function" &&
    typeof openAssignTask === "function" && typeof assignTaskOpenSheet === "function");
  const zoomEvidence = await browserZoomEvidence(page, zoom);
  await page.evaluate(({ machine, projectsFixture }) => {
    machines = [machine];
    projects = projectsFixture;
    let probe = document.getElementById("director-modal-scroll-probe");
    if (!probe) {
      probe = document.createElement("div");
      probe.id = "director-modal-scroll-probe";
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "height:1200px;pointer-events:none";
      document.body.appendChild(probe);
    }
  }, { machine, projectsFixture });

  for (const surface of ["connection", "assignment"]) {
    // A generic dialog can be opened after inspecting content below the fold.
    // Preserve that real entry condition; the original formal image was taken
    // from a scrolled work page and exposed an offset/clipping defect at 125%.
    await page.evaluate(() => scrollTo(0, 75));
    await page.waitForFunction(() => scrollY >= 70);
    if (surface === "connection") {
      await page.evaluate(() => changeOsIp("host_a"));
      await page.locator("#new-bmc-pass-input").waitFor();
    } else {
      await page.evaluate(async () => {
        await openAssignTask("host_a");
        await assignTaskOpenSheet("Director");
      });
      await page.locator("#assign-task-body .assign-row").last().waitFor();
    }
    await page.waitForTimeout(80);
    const measurement = await measureSurface(page, surface);
    const stem = `${surface}-1366x768-${theme}-zoom${Math.round(zoom * 100)}`;
    const screenshotPath = path.join(OUTPUT, `${stem}.png`);
    await page.screenshot({ path: screenshotPath, animations: "disabled", caret: "hide", fullPage: false, scale: "device" });
    const buffer = fs.readFileSync(screenshotPath);
    const png = pngDimensions(buffer);
    assert.deepEqual(png, VIEWPORT, `${stem}: screenshot dimensions must remain the requested physical viewport`);
    const assertionFailures = Object.entries(measurement.assertions)
      .filter(([, passed]) => !passed).map(([name]) => name);
    manifest.captures.push({
      phase: PHASE, surface, theme, zoomRequested: zoom, zoomEvidence,
      requestedViewport: VIEWPORT, screenshot: {
        file: path.basename(screenshotPath), ...png,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"), bytes: buffer.length,
      },
      measurement, assertionFailures,
    });
    await page.evaluate(() => closeDialog());
  }

  assert.deepEqual(state.mutations, [], `Unexpected mutation attempts: ${state.mutations.join(", ")}`);
  assert.deepEqual(state.unknownReads, [], `Unknown API reads: ${state.unknownReads.join(", ")}`);
  assert.deepEqual(state.external, [], `External requests: ${state.external.join(", ")}`);
  assert.deepEqual(state.pageErrors, [], `Page errors: ${state.pageErrors.join(" | ")}`);
  manifest.runs.push({ theme, zoom, zoomEvidence, ...state });
}

(async () => {
  const manifest = {
    schema: "director-modal-zoom-accessibility/v1",
    generatedAt: new Date().toISOString(), phase: PHASE,
    app: {
      branch: git("branch", "--show-current"), commit: git("rev-parse", "HEAD"),
      dirty: Boolean(git("status", "--porcelain")),
    },
    fixture: "strict loopback / explicit GET allowlist / all mutations rejected / no hardware transport",
    viewport: VIEWPORT, themes: THEMES, zooms: ZOOMS,
    zoomMethod: "100% fresh context; 125% MV3 chrome.tabs.setZoom + chrome.tabs.getZoom; deviceScaleFactor=1",
    sourceAssets: Object.fromEntries([
      "app/static/index.html", "app/static/css/style.css", "app/static/css/workspace-cinematic.css",
      "app/static/css/engineering-ux.css", "app/static/js/app.js", "app/static/js/engineering-ux.js",
    ].map(relative => {
      const bytes = fs.readFileSync(path.join(REPO, relative));
      return [relative, crypto.createHash("sha256").update(bytes).digest("hex")];
    })),
    hardwareDispatches: 0, captures: [], runs: [],
  };
  let standardBrowser = null;
  try {
    standardBrowser = await chromium.launch({
      channel: process.env.BROWSER_CHANNEL || "msedge", headless: true,
      args: ["--force-device-scale-factor=1", "--high-dpi-support=1", "--font-render-hinting=none"],
    });
    for (const theme of THEMES) {
      const context100 = await standardBrowser.newContext({
        viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "reduce",
        locale: "zh-TW", timezoneId: "Asia/Taipei", serviceWorkers: "block",
      });
      try { await runContext(context100, theme, 1, manifest); }
      finally { await context100.close(); }

      const { context: context125, profile } = await launchZoomContext(theme);
      try { await runContext(context125, theme, 1.25, manifest); }
      finally { await context125.close(); removeZoomProfile(profile); }
    }

    const captures100 = manifest.captures.filter(item => item.zoomRequested === 1);
    const captures125 = manifest.captures.filter(item => item.zoomRequested === 1.25);
    const failed100 = captures100.filter(item => item.assertionFailures.length);
    const failed125 = captures125.filter(item => item.assertionFailures.length);
    manifest.summary = {
      total: manifest.captures.length,
      passed: manifest.captures.filter(item => !item.assertionFailures.length).length,
      failed: manifest.captures.filter(item => item.assertionFailures.length).length,
      failed100: failed100.map(item => ({ surface: item.surface, theme: item.theme, failures: item.assertionFailures })),
      failed125: failed125.map(item => ({ surface: item.surface, theme: item.theme, failures: item.assertionFailures })),
      status: failed100.length || failed125.length ? "FAIL" : "PASS",
    };
    fs.writeFileSync(path.join(OUTPUT, "metadata.json"), JSON.stringify(manifest, null, 2) + "\n");

    assert.equal(failed100.length, 0, `100% modal reachability regressions: ${JSON.stringify(manifest.summary.failed100)}`);
    if (PHASE === "before") {
      if (failed125.length) console.log(`PASS reproduced ${failed125.length} bounded 125% modal reachability failures; 100% remains reachable`);
      else console.log("PASS current baseline did not reproduce the legacy clipped formal image; measured geometry is fully reachable");
    } else {
      assert.equal(failed125.length, 0, `125% modal reachability regressions: ${JSON.stringify(manifest.summary.failed125)}`);
      console.log("PASS connection + Test Assignment modal reachability at 100% and real browser 125%, light/dark");
    }
    console.log(`Evidence: ${OUTPUT}`);
  } finally {
    if (standardBrowser) await standardBrowser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
