"use strict";

/*
 * Deterministic Director site captures against real production HTML/CSS/JS.
 *
 * The browser loads APP_ROOT through an ephemeral loopback static server. The
 * production preview fixture is injected before the application scripts, then
 * a deliberately small test provider fills only surfaces that the preview
 * fixture does not own (PA Agent, Telemetry provision, Inspection and KVM
 * protocol detection). No backend, hardware or non-loopback request is used.
 *
 * Examples (PowerShell):
 *   $env:APP_ROOT='C:\path\to\worktree'; $env:PHASE='after'; node tests/director-site-captures.cjs
 *   $env:APP_ROOT='C:\path\to\baseline'; $env:OUTPUT="$env:TEMP\director-smoke";
 *   $env:WIDTHS='1366'; $env:THEMES='light'; $env:CAPTURES='S01,S02,F-RACK';
 *   node tests/director-site-captures.cjs
 *   $env:BROWSER_ZOOM='1.25'; $env:CAPTURES='S01,S02,F-RACK'; node tests/director-site-captures.cjs
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

let playwright;
try {
  playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright");
} catch (_) {
  playwright = require(process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
}
const { chromium } = playwright;

const REPO = path.resolve(__dirname, "..");
const APP_ROOT = path.resolve(process.env.APP_ROOT || REPO);
const STATIC_ROOT = path.join(APP_ROOT, "app", "static");
const PHASE = process.env.PHASE || process.env.PA_CAPTURE_PHASE || "after";
const OUTPUT = path.resolve(process.env.OUTPUT || path.join(REPO, "docs", "ui-premium", "screens", `director-site-${PHASE}`));
const WIDTHS = parseList(process.env.WIDTHS || process.env.PA_CAPTURE_WIDTHS || "1366,1920,3440", Number)
  .filter(width => [1366, 1920, 3440].includes(width));
const THEMES = parseList(process.env.THEMES || process.env.PA_CAPTURE_THEMES || "light,dark", String)
  .filter(theme => ["light", "dark"].includes(theme));
const CAPTURE_FILTER = new Set(parseList(process.env.CAPTURES || "", value => value.toLowerCase()));
const BROWSER_ZOOM_REQUESTED = Number(process.env.BROWSER_ZOOM || process.env.PA_CAPTURE_BROWSER_ZOOM || "1");
const ZOOM_EXTENSION_ROOT = path.resolve(process.env.ZOOM_EXTENSION || path.join(REPO, "tests", "fixtures", "director-zoom-extension"));
const FIXED_ISO = "2026-10-08T04:00:00.000Z";
const FIXED_SECONDS = Date.parse(FIXED_ISO) / 1000;
const FIXTURE_ID = "director-static-preview-v1/rack-network/fake-provider-v1";
const HEIGHTS = new Map([[1366, 768], [1920, 1080], [3440, 1440]]);

assert(WIDTHS.length, "WIDTHS must contain one or more of 1366, 1920, 3440");
assert(THEMES.length, "THEMES must contain light and/or dark");
assert([1, 1.25, 2].includes(BROWSER_ZOOM_REQUESTED), "BROWSER_ZOOM must be exactly 1, 1.25 or 2");
for (const required of [
  path.join(STATIC_ROOT, "index.html"),
  path.join(STATIC_ROOT, "js", "preview-fixtures.js"),
  path.join(APP_ROOT, "app", "data", "tests.json"),
]) assert(fs.existsSync(required), `APP_ROOT is not a capturable checkout; missing ${required}`);

function parseList(raw, convert) {
  return String(raw || "").split(",").map(value => value.trim()).filter(Boolean).map(convert);
}

function git(args) {
  const result = spawnSync("git", ["-C", APP_ROOT, ...args], { encoding: "utf8", windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
}

const appGit = {
  commit: git(["rev-parse", "HEAD"]),
  dirty: null,
};
const status = git(["status", "--porcelain", "--untracked-files=normal"]);
if (status !== null) appGit.dirty = status.length > 0;

function osScalingEvidence() {
  if (process.platform !== "win32") return {
    status: "not-run", platform: process.platform,
    reason: "AppliedDPI registry evidence is implemented only for Windows.",
  };
  const command = "(Get-ItemProperty -LiteralPath 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name AppliedDPI -ErrorAction Stop).AppliedDPI";
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    encoding: "utf8", windowsHide: true, timeout: 5000,
  });
  const appliedDpi = Number(String(result.stdout || "").trim());
  if (result.status !== 0 || !Number.isFinite(appliedDpi) || appliedDpi <= 0) return {
    status: "not-run", platform: process.platform, source: "HKCU/Control Panel/Desktop/WindowMetrics/AppliedDPI",
    reason: String(result.stderr || "AppliedDPI was unavailable.").trim(),
  };
  return {
    status: "measured-registry", platform: process.platform,
    source: "HKCU/Control Panel/Desktop/WindowMetrics/AppliedDPI",
    appliedDpi, scaleFactor: appliedDpi / 96, percent: Math.round(appliedDpi / 96 * 100),
    limitation: "Registry AppliedDPI is OS-level evidence and may differ from per-monitor scaling.",
  };
}

const OS_SCALING = osScalingEvidence();

const coverage = {
  S01: { status: "captured", surface: "Shell / sidebar / topbar" },
  S02: { status: "captured", surface: "Overview and fixed Hero" },
  S03: { status: "captured", surface: "Systems / Projects and fixed Rack" },
  S04: { status: "captured", surface: "System detail / Nodes" },
  S05: { status: "captured", surface: "Inventory / Sensors / Firmware" },
  S06: { status: "captured", surface: "Validation / Test Case assignment" },
  S07: { status: "captured", surface: "PA Agent" },
  S08: { status: "partial", surface: "Cycle", reason: "Only the real Cycle entry is captured here. PRE / Console / Report require the separate strict synthetic Cycle harness; this static provider does not manufacture Cycle execution truth." },
  S09: { status: "captured", surface: "Telemetry / Exporter" },
  S10: { status: "captured", surface: "Inspection / AI / Evidence entry" },
  S11: { status: "captured", surface: "Terminal / Broadcast / KVM frames" },
  S12: { status: "partial", surface: "Modals / forms", reason: "One representative production connection form is captured; this is not an exhaustive modal inventory." },
  S13: { status: "partial", surface: "Evidence / Report / SOP", reason: "Raw evidence viewer and SOP reference entry are captured. A Cycle report viewer is unavailable because S08 is not fixture-backed." },
  S14: { status: "captured", surface: "User Guide" },
  S15: { status: "captured", surface: "Topology" },
};

const bootstrapScript = `(() => {
  const fixed = ${Date.parse(FIXED_ISO)};
  const RealDate = Date;
  class DirectorDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  }
  DirectorDate.parse = RealDate.parse;
  DirectorDate.UTC = RealDate.UTC;
  window.Date = DirectorDate;
  let seed = 0x51f15e;
  Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  window.__DIRECTOR_TRACE = { fixtureIdentity: ${JSON.stringify(FIXTURE_ID)}, requests: [], unknownRequests: [], externalRequests: [], notices: [] };
  window.alert = message => window.__DIRECTOR_TRACE.notices.push({ kind: 'alert', message: String(message) });
  window.SPX_KVM_LAUNCH_API = location.origin + '/__director__/kvm-disabled';
})();`;

const providerScript = `(() => {
  const trace = window.__DIRECTOR_TRACE;
  const fixtureFetch = window.fetch.bind(window);
  const fixed = ${FIXED_SECONDS};
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Director-Fixture': ${JSON.stringify(FIXTURE_ID)} }
  });
  const attachment = { attachment_id: 'director-sop-1', name: 'Director-SOP.md', size: 4280, kind: 'file', status: 'parsed' };
  const agentRun = {
    run_id: 'director-agent-1', case_variant_id: 'director-case-1', status: 'WAITING_FOR_USER',
    started_at: ${JSON.stringify(FIXED_ISO)}, updated_at: ${JSON.stringify(FIXED_ISO)},
    plan_revision: 3, attachments: [attachment], commands: [], evidence: []
  };
  const telemetryNode = {
    node_id: 'director-node-1', slot: 'N0', hostname: 'director-host-a', os_ip: '192.0.2.21',
    binding_revision: 'director-rev-1', state: 'READY', configured: true, stale: false,
    detail: 'Host exporter, GPU exporter and Prometheus target are ready.', checked_at: fixed,
    dashboard_url: '',
    components: {
      host: 'READY', prometheus: 'READY',
      gpu: { state: 'READY', detail: 'DCGM metrics available.', gpus: [
        { index: 0, model: 'NVIDIA H100', driver: 'Director fixture' },
        { index: 1, model: 'NVIDIA H100', driver: 'Director fixture' }
      ] }
    },
    host_setup: { detection: 'systemctl is-active node_exporter', installation: 'Fixture: no command is executed.', check_on_node: 'curl 127.0.0.1:9100/metrics', check_on_manager: 'Fixture: loopback only.', exporter_url: 'http://192.0.2.21:9100/metrics', prometheus_url: 'http://127.0.0.1:9090' },
    gpu_setup: { detection: 'nvidia-smi', runtime_check: 'docker info', runtime_prepare: 'Fixture: no command is executed.', installation: 'Fixture: no command is executed.', check_on_manager: 'Fixture: loopback only.', exporter_url: 'http://192.0.2.21:9400/metrics', prometheus_url: 'http://127.0.0.1:9090', image: 'director/dcgm-exporter:fixed' }
  };
  const points = (base, step) => Array.from({ length: 12 }, (_, index) => [(fixed - (11-index)*300) * 1000, base + ((index % 4)-1.5)*step]);
  const inspection = () => ({
    running: false, delayed: false, error: '', last_completed_at: fixed, last_fast_at: fixed, last_deep_at: fixed - 120,
    checker_hash: 'director-checker-0123456789', shared_core_version: 'director-core-0123456789',
    config: { enabled: true, ai_enabled: true, interval_seconds: 300, deep_seconds: 1800, sensor_seconds: 300, firmware_seconds: 3600, duration_seconds: 120, recovery_samples: 2, stale_seconds: 300, hysteresis: 5, thresholds: { cpu: 90, memory: 90, gpu: 95, vram: 95 } },
    summary: { fail: 1, warning: 1 }, lifecycle_counts: { recovered: 2, archived: 4 }, progress: [],
    nodes: [{ node_id: 'director-node-1', label: 'host_a / N0', os_hostname: 'director-host-a', os_hostname_raw: 'director-host-a', bmc_hostname: 'director-bmc-a', bmc_hostname_raw: 'director-bmc-a' }],
    identity: { 'director-node-1': { os_status: 'SUCCESS', bmc_status: 'SUCCESS', collected_at: fixed } }, identity_history: [],
    coverage: [
      { node_id: 'director-node-1', source: 'Sensors', state: 'FRESH', collected_at: fixed, duration: 1.2, detail: 'Read-only sensor sample retained.', evidence_ref: { snapshot_id: 'director-evidence-1' } },
      { node_id: 'director-node-1', source: 'Redfish', services: ['EventLog','SEL'], state: 'FRESH', collected_at: fixed, duration: 2.4, detail: 'Event services read successfully.' },
      { node_id: 'director-node-1', source: 'Telemetry', state: 'FRESH', collected_at: fixed, duration: 0.8, detail: 'Prometheus sample is current.' }
    ]
  });
  const issues = () => ({ issues: [{
    id: 'director-issue-1', node_id: 'director-node-1', affected_nodes: [], status: 'ACTIVE', severity: 'FAIL',
    component: 'GPU', rule: 'DMESG_XID', facts: 'Synthetic read-only evidence contains one GPU XID event for layout review.',
    first_seen_at: fixed - 3600, last_seen_at: fixed - 120, resolved_at: 0, occurrences: 1, observations: 4, recurrences: 0,
    occurrence_precision: 'exact', evidence: 'dmesg / Redfish EventLog', evidence_ref: { snapshot_id: 'director-evidence-1' },
    acknowledged: false, known_issue: false, mute_until: 0,
    analysis: { state: 'COMPLETE', completed_at: fixed - 60, result: {
      possible_causes: ['A transient accelerator reset was recorded.'],
      recommended_checks: ['Correlate the timestamp with the retained EventLog evidence.'],
      conclusion: 'Review required; the fixture does not assert a hardware verdict.',
      confidence_note: 'Synthetic evidence for deterministic UI capture.', based_on: ['dmesg', 'Redfish EventLog']
    }, based_on: { last_seen_at: fixed - 120, source: 'saved read-only evidence' } }
  }] });

  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const method = String(options.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const request = method + ' ' + url.pathname + url.search;
    trace.requests.push(request);
    if (url.origin !== location.origin) {
      trace.externalRequests.push(request);
      return json({ detail: 'DIRECTOR FIXTURE: external request blocked' }, 599);
    }
    if (method === 'GET' && url.pathname === '/api/agent/active') return json({ ok: true, run: agentRun });
    if (method === 'GET' && url.pathname === '/api/agent/runs/director-agent-1') return json({ ok: true, run: agentRun });
    if (method === 'GET' && url.pathname === '/api/agent/runs/director-agent-1/messages') return json({ ok: true, messages: [{
      seq: 1, role: 'agent', kind: 'message', created_at: ${JSON.stringify(FIXED_ISO)},
      text: '## Director review plan\\n\\n1. Confirm the selected node identity.\\n2. Read the attached SOP and saved evidence.\\n3. Keep the final PASS / FAIL decision with the engineer.\\n\\nNo hardware command is executed by this fixture.'
    }] });
    if (method === 'GET' && url.pathname === '/api/agent/runs/director-agent-1/attachments/unconsumed') return json({ ok: true, attachments: [attachment] });
    if (method === 'GET' && url.pathname === '/api/telemetry/systems/host_a/nodes') return json({ nodes: [telemetryNode] });
    if (method === 'GET' && url.pathname === '/api/telemetry/nodes/director-node-1') return json(telemetryNode);
    if (method === 'GET' && url.pathname === '/api/telemetry/nodes/director-node-1/charts') return json({
      state: 'READY', last_sample: { host: fixed },
      stats: { uptime: [{ value: 1036800 }], load: [{ value: 3.25 }], filesystem: [{ value: 42.4 }] },
      panels: [
        { id: 'cpu', title: 'CPU Utilization', state: 'READY', unit: '%', series: [{ label: 'Host CPU', points: points(48, 3), latest: 49.5 }] },
        { id: 'memory', title: 'Host Memory', state: 'READY', unit: '%', series: [{ label: 'Memory used', points: points(61, 1.5), latest: 61.8 }] },
        { id: 'gpu', title: 'GPU Utilization', state: 'READY', unit: '%', series: [{ label: 'GPU 0', points: points(72, 4), latest: 74 }, { label: 'GPU 1', points: points(66, 3), latest: 67.5 }] }
      ]
    });
    if (method === 'GET' && url.pathname === '/api/machine/host_a/inspection') return json(inspection());
    if (method === 'GET' && url.pathname === '/api/machine/host_a/inspection/issues') return json(issues());
    if (method === 'GET' && url.pathname === '/api/machine/host_a/inspection/evidence/director-evidence-1/view') return json({
      text: JSON.stringify([{ source: 'dmesg', line: 'NVRM: Xid 31 (synthetic capture evidence)' }, { source: 'Redfish EventLog', severity: 'Warning', message: 'Synthetic retained event' }]),
      source: 'Director fixture / read-only evidence', collected_at: fixed, truncated: false
    });
    if (method === 'GET' && url.pathname === '/api/kvm/basecode') {
      const candidates = (window.PA_PREVIEW?.machines || []).filter(machine => machine.project === url.searchParams.get('project') && machine.bmc_ip);
      const machines = Object.fromEntries(candidates.map(machine => [machine.name, { label: 'RFB fixture', proto: 'RFB', online: false, rfb: true, bmc_ip: machine.bmc_ip }]));
      return json({ sync_ok: false, reason: 'Director fake provider keeps every KVM connection offline.', detected_kinds: ['rfb'], machines });
    }
    const response = await fixtureFetch(input, options);
    if (url.pathname.startsWith('/api/')) {
      const data = await response.clone().json().catch(() => null);
      if (data?.detail === 'This action is not connected in the design preview.') {
        trace.unknownRequests.push(request);
      }
    }
    return response;
  };
})();`;

function mime(file) {
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json; charset=utf-8",
  })[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function insideRoot(file) {
  const relative = path.relative(APP_ROOT, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function startServer() {
  const unknown = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname);
    const send = (statusCode, body, contentType) => {
      response.writeHead(statusCode, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(body);
    };
    if (pathname === "/__director__/bootstrap.js") return send(200, bootstrapScript, mime("x.js"));
    if (pathname === "/__director__/provider.js") return send(200, providerScript, mime("x.js"));
    if (pathname.startsWith("/api/") || pathname.startsWith("/ws/")) {
      unknown.push(`${request.method} ${pathname}${url.search}`);
      return send(599, JSON.stringify({ detail: "DIRECTOR FIXTURE: request escaped browser provider" }), mime("x.json"));
    }
    let file;
    if (pathname === "/" || pathname === "/index.html") file = path.join(STATIC_ROOT, "index.html");
    else if (pathname === "/fixtures/tests.json") file = path.join(APP_ROOT, "app", "data", "tests.json");
    else if (pathname.startsWith("/static/")) file = path.resolve(path.join(APP_ROOT, "app"), `.${pathname}`);
    else file = path.resolve(STATIC_ROOT, `.${pathname}`);
    if (!insideRoot(file) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      unknown.push(`${request.method} ${pathname}${url.search}`);
      return send(404, "Not found", "text/plain; charset=utf-8");
    }
    let body = fs.readFileSync(file);
    if (file === path.join(STATIC_ROOT, "index.html")) {
      const marker = '<script src="/static/vendor/xterm/xterm.js"></script>';
      let html = body.toString("utf8");
      assert(html.includes(marker), "Unable to inject Director fixture before application scripts");
      html = html.replace(marker, `<script src="/__director__/bootstrap.js"></script>\n<script src="/static/js/preview-fixtures.js"></script>\n<script src="/__director__/provider.js"></script>\n${marker}`);
      body = Buffer.from(html);
    }
    send(200, body, mime(file));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, unknown, base: `http://127.0.0.1:${server.address().port}` };
}

function pngInfo(buffer) {
  assert(buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG", "Screenshot is not a PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function safe(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function selected(meta) {
  if (!CAPTURE_FILTER.size) return true;
  return [meta.key, meta.sId, meta.frozenMarker].filter(Boolean).some(value => CAPTURE_FILTER.has(String(value).toLowerCase()));
}

function groupSelected(...values) {
  if (!CAPTURE_FILTER.size) return true;
  return values.some(value => CAPTURE_FILTER.has(String(value).toLowerCase()));
}

async function settle(page, milliseconds = 100) {
  await page.waitForTimeout(milliseconds);
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function scrollPanel(page, selector) {
  await page.locator(selector).evaluate(element => {
    const top = element.getBoundingClientRect().top + scrollY - 82;
    scrollTo(0, Math.max(0, top));
  });
  await settle(page, 60);
}

async function auditVisibleTextContrast(page) {
  return page.evaluate(() => {
    const MAX_VIOLATIONS = 200;
    const counts = {
      scannedElements: 0, auditedTextElements: 0, violations: 0,
      skippedNoOwnText: 0, skippedNotVisibleInViewport: 0, skippedMediaOrVector: 0,
      skippedDisabled: 0, approximatedComplexBackground: 0, skippedOpacityOrEffect: 0,
      skippedUnparsedColor: 0,
    };
    const parseColor = value => {
      const match = String(value || "").match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
      return match ? { r: +match[1], g: +match[2], b: +match[3], a: match[4] == null ? 1 : +match[4] } : null;
    };
    const over = (front, back) => {
      const a = front.a + back.a * (1 - front.a);
      if (!a) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a,
        a,
      };
    };
    const luminance = color => {
      const channel = value => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const ratio = (a, b) => {
      const one = luminance(a), two = luminance(b);
      return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
    };
    const selector = element => {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const parts = [];
      for (let node = element; node && node !== document.documentElement && parts.length < 5; node = node.parentElement) {
        let part = node.localName || "element";
        const classes = [...node.classList].filter(Boolean).slice(0, 2);
        if (classes.length) part += "." + classes.map(name => CSS.escape(name)).join(".");
        const siblings = node.parentElement ? [...node.parentElement.children].filter(item => item.localName === node.localName) : [];
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        parts.unshift(part);
      }
      return parts.join(" > ");
    };
    const violations = [];
    for (const element of document.body.querySelectorAll("*")) {
      counts.scannedElements++;
      const ownText = [...element.childNodes]
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
      if (!ownText) { counts.skippedNoOwnText++; continue; }
      if (element.closest("svg, canvas, img, picture, video")) { counts.skippedMediaOrVector++; continue; }
      if (element.closest("[disabled], [aria-disabled='true']")) { counts.skippedDisabled++; continue; }
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth ||
          style.display === "none" || style.visibility !== "visible" || style.contentVisibility === "hidden") {
        counts.skippedNotVisibleInViewport++; continue;
      }
      let background = { r: 0, g: 0, b: 0, a: 0 };
      let complex = false, effect = false, unparsed = false;
      for (let node = element; node; node = node.parentElement) {
        const ancestorStyle = getComputedStyle(node);
        if (ancestorStyle.backgroundImage !== "none") complex = true;
        if (Number(ancestorStyle.opacity) < 0.999 || ancestorStyle.filter !== "none" || ancestorStyle.mixBlendMode !== "normal" || ancestorStyle.backdropFilter !== "none") effect = true;
        const layer = parseColor(ancestorStyle.backgroundColor);
        if (!layer) { unparsed = true; break; }
        background = over(background, layer);
        if (background.a >= 0.999) break;
      }
      if (complex) counts.approximatedComplexBackground++;
      if (effect) { counts.skippedOpacityOrEffect++; continue; }
      const foreground = parseColor(style.color);
      if (unparsed || !foreground) { counts.skippedUnparsedColor++; continue; }
      background = over(background, { r: 255, g: 255, b: 255, a: 1 });
      const renderedForeground = over(foreground, background);
      const fontSizePx = Number.parseFloat(style.fontSize) || 0;
      const numericWeight = Number(style.fontWeight) || ({ normal: 400, bold: 700 }[style.fontWeight] || 400);
      const largeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && numericWeight >= 700);
      const threshold = largeText ? 3 : 4.5;
      const measured = ratio(renderedForeground, background);
      counts.auditedTextElements++;
      if (measured + 1e-9 < threshold) {
        counts.violations++;
        if (violations.length < MAX_VIOLATIONS) violations.push({
          selector: selector(element), text: ownText.slice(0, 160), ratio: Number(measured.toFixed(2)),
          threshold, largeText, fontSizePx, fontWeight: numericWeight,
          foreground: style.color, background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
          backgroundApproximation: complex ? "CSS background image/gradient omitted; computed backgroundColor layers used" : null,
        });
      }
    }
    return {
      status: "partial", standard: "WCAG 2.x contrast thresholds only; this is not a full WCAG audit",
      method: "Computed foreground over solid ancestor backgrounds with RGBA alpha composition",
      scope: "Own text nodes visibly intersecting the captured viewport",
      thresholds: { normalText: 4.5, largeText: 3, largeTextDefinition: ">=24 CSS px, or >=18.66 CSS px and weight >=700" },
      exclusions: ["image/canvas/SVG/video", "disabled or aria-disabled", "opacity/filter/blend/backdrop effects", "pseudo-element text"],
      limitations: ["CSS background images/gradients are approximated using their computed backgroundColor layers."],
      counts, violations, violationsTruncated: counts.violations > violations.length,
    };
  });
}

async function machine(page) {
  await page.evaluate(() => window.openMachine("host_a"));
  await page.locator(".pd-system-header").waitFor();
  await page.locator(".pd-showcase").waitFor();
  await settle(page, 160);
}

async function closeCommon(page) {
  await page.evaluate(() => {
    try { window.InspectionEvidence?.close(); } catch (_) {}
    try { window.PA_Agent?.close(); } catch (_) {}
    try { window.closeTerm?.(); } catch (_) {}
    try { window.closeBroadcast?.(); } catch (_) {}
    try { window.closeKvmBroadcast?.(); } catch (_) {}
    try { window.closeDialog?.(); } catch (_) {}
    document.querySelector('.nt-window [data-action="close"]')?.click();
    document.querySelector(".ug-close")?.click();
  });
  await page.waitForTimeout(300);
}

function browserContextOptions(width, height, theme, allowServiceWorkers = false) {
  return {
    viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: "reduce",
    locale: "zh-TW", timezoneId: "Asia/Taipei", serviceWorkers: allowServiceWorkers ? "allow" : "block",
    permissions: ["clipboard-read", "clipboard-write"],
  };
}

async function browserZoomEvidence(page) {
  if (BROWSER_ZOOM_REQUESTED === 1) return {
    status: "default-100", requested: 1, actual: 1,
    source: "Fresh browser context/profile with no zoom mutation",
    getZoomReturned: 1,
  };
  try {
    await page.waitForFunction(() => {
      const value = document.querySelector('meta[name="director-browser-zoom-evidence"]')?.content;
      return Boolean(value && value.length > 2);
    }, null, { timeout: 8000 });
    const raw = await page.locator('meta[name="director-browser-zoom-evidence"]').getAttribute("content");
    const evidence = JSON.parse(raw || "{}");
    const actual = Number(evidence.actual);
    return {
      ...evidence,
      requested: BROWSER_ZOOM_REQUESTED,
      actual: Number.isFinite(actual) ? actual : null,
      getZoomReturned: Number.isFinite(actual) ? actual : null,
      source: evidence.source || "chrome.tabs.getZoom",
    };
  } catch (error) {
    return {
      status: "not-run", requested: BROWSER_ZOOM_REQUESTED, actual: null, getZoomReturned: null,
      source: "MV3 chrome.tabs.setZoom/getZoom extension",
      reason: `The zoom extension did not publish evidence: ${String(error.message || error)}`,
    };
  }
}

async function runViewport(browser, base, serverUnknown, browserVersion, width, theme, manifest, suppliedContext = null, zoomLaunch = null) {
  const height = HEIGHTS.get(width);
  const external = [], pageErrors = [], consoleErrors = [], failedRequests = [], badResponses = [];
  const context = suppliedContext || await browser.newContext(browserContextOptions(width, height, theme));
  await context.addInitScript(value => {
    localStorage.setItem("pa_theme", value);
    sessionStorage.setItem("pa_dashboard_cinematic_v3_played", "1");
    localStorage.removeItem("ug-state");
  }, theme);
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.origin !== base) {
      external.push(`${route.request().method()} ${url.href}`);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const page = suppliedContext ? (context.pages()[0] || await context.newPage()) : await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => pageErrors.push(String(error.message || error)));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin === base && response.status() >= 400) badResponses.push(`${response.status()} ${url.pathname}${url.search}`);
  });
  let cursor = { page: 0, console: 0, external: 0, traceExternal: 0, failed: 0, bad: 0, unknown: 0, server: 0 };
  let zoomEvidence = null;

  const capture = async meta => {
    if (!selected(meta)) return;
    if (meta.reachabilitySelector) {
      const primary = page.locator(meta.reachabilitySelector).first();
      await primary.waitFor({ state: "visible" });
      await primary.scrollIntoViewIfNeeded();
      await primary.focus().catch(() => {});
    }
    await settle(page, meta.settleMs || 90);
    const zoom = await page.evaluate(() => ({
      dpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      visualViewport: visualViewport ? { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale, offsetLeft: visualViewport.offsetLeft, offsetTop: visualViewport.offsetTop } : null,
      theme: document.documentElement.dataset.theme,
      route: location.hash,
      unknownRequests: [...(window.__DIRECTOR_TRACE?.unknownRequests || [])],
      externalRequests: [...(window.__DIRECTOR_TRACE?.externalRequests || [])],
      fixtureIdentity: window.__DIRECTOR_TRACE?.fixtureIdentity,
      notices: [...(window.__DIRECTOR_TRACE?.notices || [])],
    }));
    if (BROWSER_ZOOM_REQUESTED === 1) assert.equal(zoom.dpr, 1, `${meta.key}: devicePixelRatio must be 1 at default browser zoom`);
    assert.equal(zoom.theme, theme, `${meta.key}: requested theme did not apply`);
    assert.equal(zoom.fixtureIdentity, FIXTURE_ID, `${meta.key}: explicit fixture identity missing`);
    const reachability = await page.evaluate(selector => {
      const focusableSelector = 'a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
      const visible = element => {
        if (!element) return false;
        const style = getComputedStyle(element), rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const bounds = element => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return Object.fromEntries(["top", "right", "bottom", "left", "width", "height"]
          .map(key => [key, Number(rect[key].toFixed(2))]));
      };
      const inViewport = element => {
        const rect = element?.getBoundingClientRect();
        return Boolean(rect && rect.top >= -0.5 && rect.left >= -0.5 && rect.bottom <= innerHeight + 0.5 && rect.right <= innerWidth + 0.5);
      };
      const primary = selector ? document.querySelector(selector) : null;
      const focusables = [...document.querySelectorAll(focusableSelector)].filter(visible);
      const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
      return {
        documentWidth,
        bodyHorizontalOverflowPx: Math.max(0, documentWidth - document.documentElement.clientWidth),
        visibleFocusableCount: focusables.length,
        visibleFocusableInViewportCount: focusables.filter(inViewport).length,
        primary: selector ? {
          selector, exists: Boolean(primary), visible: visible(primary),
          focusable: Boolean(primary?.matches(focusableSelector)),
          focused: document.activeElement === primary,
          inViewport: inViewport(primary), rect: bounds(primary),
        } : null,
      };
    }, meta.reachabilitySelector || null);
    const contrastAudit = await auditVisibleTextContrast(page);
    const zoomSuffix = BROWSER_ZOOM_REQUESTED === 1 ? "" :
      `-zoom${Math.round(BROWSER_ZOOM_REQUESTED * 100)}-${zoomEvidence?.status === "applied" ? "verified" : "not-run"}`;
    const stem = `${safe(meta.key)}-${width}x${height}-${theme}${zoomSuffix}`;
    const pngPath = path.join(OUTPUT, `${stem}.png`);
    const jsonPath = path.join(OUTPUT, `${stem}.json`);
    await page.screenshot({ path: pngPath, animations: "disabled", caret: "hide", fullPage: false, scale: "device" });
    const buffer = fs.readFileSync(pngPath), dimensions = pngInfo(buffer);
    const traceUnknown = zoom.unknownRequests.slice(cursor.unknown);
    const traceExternal = zoom.externalRequests.slice(cursor.traceExternal);
    const metadata = {
      schema: "director-site-capture/v2", phase: PHASE, fixtureIdentity: FIXTURE_ID,
      region: meta.region, surfaceId: meta.sId, frozenMarker: meta.frozenMarker || null,
      routeState: { route: zoom.route, state: meta.state || "default", details: meta.details || null },
      app: { root: APP_ROOT, commit: appGit.commit, dirty: appGit.dirty },
      browser: {
        version: browserVersion, theme: zoom.theme,
        browserZoomRequested: BROWSER_ZOOM_REQUESTED,
        browserZoom: zoomEvidence?.status === "applied" || BROWSER_ZOOM_REQUESTED === 1 ? zoomEvidence?.actual : null,
        browserZoomEvidence: zoomEvidence,
        devicePixelRatio: zoom.dpr, visualViewport: zoom.visualViewport,
        osScaling: OS_SCALING,
      },
      viewportRequested: { width, height }, viewportCss: zoom.viewport,
      png: { file: path.basename(pngPath), width: dimensions.width, height: dimensions.height, sha256: crypto.createHash("sha256").update(buffer).digest("hex") },
      pageErrors: pageErrors.slice(cursor.page), consoleErrors: consoleErrors.slice(cursor.console),
      externalRequests: [...external.slice(cursor.external), ...traceExternal],
      unknownRequests: [...badResponses.slice(cursor.bad), ...traceUnknown, ...serverUnknown.slice(cursor.server)],
      failedRequests: failedRequests.slice(cursor.failed), notices: zoom.notices,
      reachability,
      contrastAudit,
      gaps: [...(meta.gaps || []), ...(BROWSER_ZOOM_REQUESTED !== 1 && zoomEvidence?.status !== "applied" ? [`Requested browser zoom ${BROWSER_ZOOM_REQUESTED} was not applied; see browserZoomEvidence.`] : [])],
      capturedAt: FIXED_ISO,
    };
    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2) + "\n");
    manifest.images.push(metadata);
    cursor = { page: pageErrors.length, console: consoleErrors.length, external: external.length, traceExternal: zoom.externalRequests.length, failed: failedRequests.length, bad: badResponses.length, unknown: zoom.unknownRequests.length, server: serverUnknown.length };
  };

  try {
    const zoomQuery = BROWSER_ZOOM_REQUESTED === 1 ? "" : `&director_zoom=${encodeURIComponent(BROWSER_ZOOM_REQUESTED)}`;
    await page.goto(`${base}/?preview=rack-network&director_fixture=v1${zoomQuery}#/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.PA_PREVIEW?.scenario === "rack-network" && typeof machines !== "undefined" && Array.isArray(machines) && machines.some(machine => machine.name === "host_a"));
    zoomEvidence = await browserZoomEvidence(page);
    manifest.zoomRuns.push({ width, height, theme, evidence: zoomEvidence, launch: zoomLaunch });
    if (BROWSER_ZOOM_REQUESTED !== 1 && (zoomEvidence.status !== "applied" || Math.abs(Number(zoomEvidence.actual) - BROWSER_ZOOM_REQUESTED) > 0.0001)) {
      manifest.zoomFailures.push({ width, height, theme, evidence: zoomEvidence, launch: zoomLaunch });
    }
    await page.locator(".vo-overview").waitFor();
    await page.evaluate(() => document.getElementById("core-story")?.paHeroPlayback?.seek(1));
    await page.waitForFunction(() => document.getElementById("core-stage")?.dataset.shot === "final");
    await page.evaluate(() => scrollTo(0, 0));
    await capture({ key: "s01-shell", sId: "S01", region: "Application shell / sidebar / topbar", state: "dashboard; rack-network preview", reachabilitySelector: '.nav-btn[data-view="projects"]' });
    await capture({ key: "s02-hero-fixed", sId: "S02", frozenMarker: "F-HERO", region: "Overview / frozen Hero V3", state: "hero progress=1; shot=final; reduced motion" });
    if (selected({ key: "s02-overview-below-hero", sId: "S02" })) {
      const target = page.locator("[data-vo-status]");
      await target.scrollIntoViewIfNeeded();
      await capture({ key: "s02-overview-below-hero", sId: "S02", region: "Overview / validation status below Hero", state: "global overview summary" });
    }

    if (groupSelected("S03", "s03-projects-l10", "s03-projects-l11", "s03-projects-search-empty")) {
      await page.evaluate(() => { scrollTo(0, 0); window.productLevel("system"); });
      await page.locator(".p-workspace-tabs").waitFor();
      await capture({ key: "s03-projects-l10", sId: "S03", region: "Systems / Projects", state: "L10 System Level" });
      await page.evaluate(() => window.productLevel("rack"));
      await settle(page);
      await capture({ key: "s03-projects-l11", sId: "S03", region: "Systems / Projects", state: "L11 Rack Level" });
      await page.evaluate(() => window.productLevel("system"));
      const search = page.locator('.p-search input[type="search"], .p-search input').first();
      await search.fill("director-no-matching-system");
      await page.waitForFunction(() => [...document.querySelectorAll("#proj-sort-list tbody tr")].every(row => row.hidden));
      await capture({ key: "s03-projects-search-empty", sId: "S03", region: "Systems / Projects search", state: "explicit no-result query" });
      await search.fill("");
    }

    if (groupSelected(
      "S04", "S05", "S06", "S09", "S10", "S13",
      "s04-system-overview", "s04-system-nodes", "s05-system-inventory", "s05-system-health",
      "s06-system-validation", "s09-telemetry-exporter", "s10-inspection-ai", "s13-evidence-viewer"
    )) {
      await machine(page);
      await page.evaluate(() => scrollTo(0, 0));
      await capture({ key: "s04-system-overview", sId: "S04", region: "System detail", state: "host_a / overview" });

      await page.evaluate(() => window.productDetailTab("osslots"));
      await scrollPanel(page, "#pd-panel-osslots");
      const nodeReachability = await page.locator("#pd-panel-osslots .pd-os-table-wrap").evaluate(wrapper => {
        wrapper.focus();
        wrapper.scrollLeft = wrapper.scrollWidth;
        const cells = [...wrapper.querySelectorAll("tbody tr td:last-child")];
        const actionCell = cells.at(-1) || null;
        const buttons = actionCell ? [...actionCell.querySelectorAll("button")] : [];
        const actionButton = buttons.at(-1) || null;
        const bounds = element => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        };
        const wrapperBox = bounds(wrapper), cellBox = bounds(actionCell), buttonBox = bounds(actionButton);
        const inside = (inner, outer) => Boolean(inner && outer && inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5);
        const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
        const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
        return {
          role: wrapper.getAttribute("role"), tabIndex: wrapper.tabIndex,
          scrollLeft: wrapper.scrollLeft, scrollWidth: wrapper.scrollWidth, clientWidth: wrapper.clientWidth,
          bodyHorizontalOverflowPx: Math.max(0, documentWidth - innerWidth),
          wrapperBox, actionCellBox: cellBox, actionButtonBox: buttonBox,
          actionCellInsideWrapper: inside(cellBox, wrapperBox), actionCellInsideViewport: inside(cellBox, viewport),
          actionButtonInsideWrapper: inside(buttonBox, wrapperBox), actionButtonInsideViewport: inside(buttonBox, viewport),
        };
      });
      if (path.normalize(APP_ROOT).toLowerCase() === path.normalize(REPO).toLowerCase()) {
        assert.equal(nodeReachability.role, "region", "S04 Nodes: table wrapper must expose role=region");
        assert.equal(nodeReachability.tabIndex, 0, "S04 Nodes: table wrapper must be keyboard focusable");
        assert.equal(nodeReachability.bodyHorizontalOverflowPx, 0, "S04 Nodes: body must not overflow horizontally");
        assert(nodeReachability.actionCellInsideWrapper && nodeReachability.actionCellInsideViewport, "S04 Nodes: final action cell must remain fully reachable");
        assert(nodeReachability.actionButtonInsideWrapper && nodeReachability.actionButtonInsideViewport, "S04 Nodes: final action button must remain fully reachable");
      }
      await settle(page, 60);
      await capture({ key: "s04-system-nodes", sId: "S04", region: "System detail / Nodes", state: "host_a / OS slots; horizontal table end focused", details: { nodeReachability }, reachabilitySelector: "#pd-panel-osslots .pd-os-table-wrap tbody tr:last-child td:last-child button:last-child" });

      await page.evaluate(() => window.productDetailTab("hardware"));
      await scrollPanel(page, "#pd-panel-hardware");
      await capture({ key: "s05-system-inventory", sId: "S05", region: "System Inventory", state: "host_a / hardware inventory" });

      await page.evaluate(() => window.productDetailTab("sensors", true));
      await page.locator("#pd-sensor-live").waitFor();
      await page.waitForFunction(() => document.querySelector("#pd-inspection [data-status]")?.textContent.includes("Fast"));
      await scrollPanel(page, "#pd-panel-sensors");
      await capture({ key: "s05-system-health", sId: "S05", region: "System Sensors / Firmware", state: "host_a / health" });

      if (groupSelected("S10", "S13")) {
        await page.locator("#pd-inspection [data-view]").click();
        await page.locator(".pd-inspection-issue").waitFor();
        await page.locator(".pd-inspection-issue summary").first().click();
        await page.locator('.pd-ai [data-ai-state][data-state="COMPLETE"]').waitFor();
        await page.locator("#pd-inspection").scrollIntoViewIfNeeded();
        await capture({ key: "s10-inspection-ai", sId: "S10", region: "Inspection / AI / evidence entry", state: "active synthetic issue expanded; AI complete", reachabilitySelector: "[data-evidence-open]" });
        if (selected({ key: "s13-evidence-viewer", sId: "S13" })) {
          try {
            await page.locator("[data-evidence-open]").first().click();
            await page.locator('.pa-evidence-modal [data-status][data-state="loaded"]').waitFor({ timeout: 3000 });
            await capture({ key: "s13-evidence-viewer", sId: "S13", region: "Read-only evidence viewer", state: "saved inspection evidence loaded", gaps: [coverage.S13.reason] });
          } catch (error) {
            manifest.scenarioFailures.push({
              key: "s13-evidence-viewer", surfaceId: "S13", width, height, theme,
              status: "failed/not-captured", error: String(error.message || error),
            });
          } finally {
            await page.evaluate(() => window.InspectionEvidence?.close());
          }
        }
      }

      await page.evaluate(() => window.productDetailTab("telemetry"));
      await page.locator('#pd-panel-telemetry select[data-node] option[value="director-node-1"]').waitFor({ state: "attached" });
      await page.locator("#pd-panel-telemetry select[data-node]").selectOption("director-node-1");
      await page.waitForFunction(() => document.querySelector("#pd-panel-telemetry .tp-state")?.dataset.state === "READY");
      await page.locator(".tn-panel").first().waitFor();
      await scrollPanel(page, "#pd-panel-telemetry");
      await capture({ key: "s09-telemetry-exporter", sId: "S09", region: "Telemetry / Exporter", state: "host_a / director-node-1 / READY", reachabilitySelector: "#pd-panel-telemetry select[data-node]" });

      await page.evaluate(() => window.productDetailTab("tasks"));
      await page.locator(".pd-library-card").first().waitFor();
      await scrollPanel(page, "#pd-panel-tasks");
      await capture({ key: "s06-system-validation", sId: "S06", region: "System Validation", state: "host_a / Test Library entry" });
      await capture({ key: "s08-cycle-entry", sId: "S08", region: "Cycle entry from System Validation", state: "host_a / Cycle entry visible; execution is covered by the strict Cycle harness", reachabilitySelector: "#pd-panel-tasks .pd-task-intro button" , gaps: [coverage.S08.reason] });
    }

    if (groupSelected("S06", "S07", "S13", "s06-test-assignment", "s07-pa-agent", "s13-sop-reference-entry")) {
      await page.evaluate(() => window.openAssignTask("host_a"));
      await page.locator(".assign-sheet-card").first().waitFor();
      await page.locator(".assign-sheet-card").first().click();
      await page.locator(".eng-case-row").first().waitFor();
      const firstCase = page.locator('.eng-case-row input[type="checkbox"]').first();
      await firstCase.check();
      await page.locator(".eng-case-open").first().click();
      await page.evaluate(() => window.scrollTo(0, 0));
      const assignmentLayout = await page.evaluate(() => {
        const rect = element => {
          if (!element) return null;
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
        };
        const backdrop = document.getElementById("rm-dialog");
        const dialog = backdrop?.querySelector(".assign-task-modal");
        const body = document.getElementById("rm-dialog-body");
        const footer = document.getElementById("rm-dialog-foot");
        const footerRect = footer?.getBoundingClientRect();
        return {
          viewport: { width: innerWidth, height: innerHeight },
          pageScroll: { x: scrollX, y: scrollY },
          backdrop: rect(backdrop), dialog: rect(dialog), body: rect(body), footer: rect(footer),
          footerFullyInViewport: !!footerRect && footerRect.top >= 0 && footerRect.bottom <= innerHeight,
          bodyScroll: body ? { scrollTop: body.scrollTop, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight } : null,
        };
      });
      await capture({ key: "s06-test-assignment", sId: "S06", region: "Test Case / Assignment", state: "first fixture case inspected and selected", details: assignmentLayout, reachabilitySelector: "#rm-dialog-foot button.primary" });
      await page.evaluate(() => window.closeDialog());

      await page.evaluate(() => window.PA_Agent.open({
        case_variant_id: "director-case-1", node_id: "director-node-1", expected_binding_revision: "director-rev-1",
        branch: "Director fixture", title: "Deterministic platform review",
        task: "Review the saved evidence and Director-SOP.md without executing hardware commands.",
        rich: '<article class="eng-case-detail"><h3>Deterministic platform review</h3><p>Read-only fixture-backed evidence review.</p></article>', mode: "plan"
      }));
      await page.locator("#pa-agent-drawer.open").waitFor();
      await page.waitForFunction(() => document.querySelector("#pa-drawer-status-text")?.textContent.includes("等待工程師"));
      await page.locator('.pa-att-name', { hasText: 'Director-SOP.md' }).waitFor();
      await capture({ key: "s07-pa-agent", sId: "S07", region: "PA Agent", state: "existing WAITING_FOR_USER run; fake provider", reachabilitySelector: "#pa-msg-input" });
      await page.locator("#pa-attach-strip").scrollIntoViewIfNeeded();
      await capture({ key: "s13-sop-reference-entry", sId: "S13", region: "SOP reference entry", state: "Director-SOP.md pending reference visible in PA Agent attachment strip", gaps: [coverage.S13.reason] });
      await page.evaluate(() => window.PA_Agent.close());
      await page.waitForSelector("#pa-agent-drawer", { state: "detached" });
    }

    if (groupSelected("S11", "s11-terminal-frame", "s11-broadcast-frame", "s11-kvm-frame")) {
      await page.evaluate(() => window.openTerm("host_a"));
      await page.waitForFunction(() => getComputedStyle(document.getElementById("term-modal")).display === "flex");
      await page.waitForTimeout(220);
      await capture({ key: "s11-terminal-frame", sId: "S11", region: "Terminal frame", state: "OS + BMC; preview WebSocket provider", reachabilitySelector: "#term-modal button" });
      await page.evaluate(() => window.closeTerm());

      await page.evaluate(() => window.openBroadcast(["host_a", "host_g"]));
      await page.waitForFunction(() => getComputedStyle(document.getElementById("bc-modal")).display === "flex");
      await page.waitForTimeout(220);
      await capture({ key: "s11-broadcast-frame", sId: "S11", region: "Broadcast terminal frame", state: "two systems; preview WebSocket provider", reachabilitySelector: "#bc-modal button" });
      await page.evaluate(() => window.closeBroadcast());

      await page.evaluate(() => window.openKvmBroadcast("proj_k"));
      await page.locator("#kvm-grid .kvm-box").first().waitFor();
      await capture({ key: "s11-kvm-frame", sId: "S11", region: "KVM broadcast frame", state: "explicit fake detector; every KVM offline; no RFB connection", reachabilitySelector: "#kvm-overlay button" });
      await page.evaluate(() => window.closeKvmBroadcast());
    }

    if (groupSelected("S12", "s12-generic-modal")) {
      await page.evaluate(() => window.changeOsIp("host_a"));
      await page.locator("#new-os-ip-input").waitFor();
      await capture({ key: "s12-generic-modal", sId: "S12", region: "Representative modal / connection form", state: "host_a endpoint form; no submit", gaps: [coverage.S12.reason] });
      await page.evaluate(() => window.closeDialog());
    }

    if (groupSelected("F-RACK", "S03", "S15", "f-rack-fixed", "s15-topology")) {
      await page.evaluate(() => { scrollTo(0, 0); window.productRack("Naboo"); });
      await page.locator("#ew-rack-canvas").waitFor();
      await page.waitForFunction(() => ["ready", "fallback"].includes(document.getElementById("ew-rack-canvas")?.dataset.rackState));
      const supported = await page.locator("#ew-rack-canvas").evaluate(canvas => canvas.paRackScene?.supported === true);
      if (supported) {
        await page.evaluate(() => {
          window.equipmentRackCamera("front");
          window.equipmentRackZoom(1.12);
          window.equipmentRackSelect("naboo-01");
          const toggle = document.getElementById("ew-network-toggle");
          if (toggle?.getAttribute("aria-pressed") === "false") window.equipmentRackNetworkToggle();
        });
        await page.waitForFunction(() => {
          const canvas = document.getElementById("ew-rack-canvas");
          return canvas?.dataset.rackView === "front" && canvas.dataset.rackZoom === "1.120" &&
            canvas.dataset.rackSelected === "naboo-01" && canvas.dataset.rackNetworkVisible === "true" &&
            Number(canvas.dataset.rackNetworkRoutes) > 0;
        });
      }
      const rackDetails = await page.locator("#ew-rack-canvas").evaluate(canvas => ({ ...canvas.dataset }));
      await capture({ key: "f-rack-fixed", sId: "S03", frozenMarker: "F-RACK", region: "Rack + CDU frozen surface", state: "Naboo / naboo-01 / front / zoom 1.120 / wiring visible", details: rackDetails, gaps: supported ? [] : ["WebGL rack scene is unavailable in this browser; fallback was captured."] });

      await page.evaluate(() => window.rackNetworkingTopology());
      await page.locator(".nt-window").waitFor();
      await page.waitForFunction(() => document.querySelectorAll(".nt-device").length > 0);
      await capture({ key: "s15-topology", sId: "S15", region: "Network Topology", state: "Naboo stored topology / rack-network preview", reachabilitySelector: '.nt-window [data-action="close"]' });
      await page.locator('.nt-window [data-action="close"]').click();
    }

    if (groupSelected("S14", "s14-user-guide")) {
      await page.locator("#guide-btn").click();
      await page.locator(".ug-body").waitFor();
      await page.waitForFunction(() => document.querySelector(".ug-body")?.textContent.trim().length > 200);
      await capture({ key: "s14-user-guide", sId: "S14", region: "User Guide", state: "production template loaded from APP_ROOT", reachabilitySelector: ".ug-close" });
      await page.locator(".ug-close").click();
    }

    const finalTrace = await page.evaluate(() => window.__DIRECTOR_TRACE || {});
    const uncapturedUnknown = (finalTrace.unknownRequests || []).slice(cursor.unknown);
    const uncapturedExternal = (finalTrace.externalRequests || []).slice(cursor.external);
    if (uncapturedUnknown.length || uncapturedExternal.length) {
      manifest.trailingIssues.push({ width, theme, unknownRequests: uncapturedUnknown, externalRequests: uncapturedExternal });
    }
  } finally {
    await closeCommon(page).catch(() => {});
    await context.close();
  }
}

const commonBrowserArgs = [
  "--force-device-scale-factor=1", "--high-dpi-support=1", "--font-render-hinting=none",
  "--use-angle=swiftshader", "--enable-webgl",
];

async function launchSharedBrowser() {
  const options = { headless: true, args: commonBrowserArgs };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  else options.channel = process.env.BROWSER_CHANNEL || "msedge";
  try {
    return await chromium.launch(options);
  } catch (error) {
    if (options.executablePath || process.env.BROWSER_CHANNEL) throw error;
    delete options.channel;
    return chromium.launch(options);
  }
}

async function launchZoomContext(width, height, theme) {
  for (const required of ["manifest.json", "service-worker.js", "content-script.js"]) {
    assert(fs.existsSync(path.join(ZOOM_EXTENSION_ROOT, required)), `Zoom extension is incomplete: ${required}`);
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "director-zoom-profile-"));
  const args = [
    ...commonBrowserArgs,
    `--disable-extensions-except=${ZOOM_EXTENSION_ROOT}`,
    `--load-extension=${ZOOM_EXTENSION_ROOT}`,
  ];
  const options = {
    ...browserContextOptions(width, height, theme, true),
    headless: process.env.ZOOM_HEADED !== "1", args,
  };
  if (process.env.CHROME_PATH) options.executablePath = process.env.CHROME_PATH;
  else options.channel = process.env.BROWSER_CHANNEL || "msedge";
  const launch = {
    mode: "persistent-context-mv3", requestedChannel: options.executablePath ? null : options.channel,
    executablePath: options.executablePath || null, headless: options.headless,
    extension: ZOOM_EXTENSION_ROOT, profile, attempts: [],
    api: "chrome.tabs.setZoom + chrome.tabs.getZoom",
  };
  try {
    const context = await chromium.launchPersistentContext(profile, options);
    launch.attempts.push({ channel: options.channel || "bundled-chromium", status: "launched" });
    return { context, launch, profile };
  } catch (error) {
    launch.attempts.push({ channel: options.channel || "bundled-chromium", status: "failed", error: String(error.message || error) });
    if (options.executablePath || process.env.BROWSER_CHANNEL) throw Object.assign(error, { directorLaunch: launch, directorProfile: profile });
    delete options.channel;
    try {
      const context = await chromium.launchPersistentContext(profile, options);
      launch.attempts.push({ channel: "bundled-chromium", status: "launched" });
      return { context, launch, profile };
    } catch (fallbackError) {
      launch.attempts.push({ channel: "bundled-chromium", status: "failed", error: String(fallbackError.message || fallbackError) });
      throw Object.assign(fallbackError, { directorLaunch: launch, directorProfile: profile });
    }
  }
}

function removeZoomProfile(profile) {
  if (!profile) return;
  const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
  const resolved = path.resolve(profile);
  if (!resolved.startsWith(temporaryRoot) || !path.basename(resolved).startsWith("director-zoom-profile-")) return;
  fs.rmSync(resolved, { recursive: true, force: true });
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const serverState = await startServer();
  const manifest = {
    schema: "director-site-capture-manifest/v2", phase: PHASE, fixtureIdentity: FIXTURE_ID,
    app: { root: APP_ROOT, ...appGit }, browserVersions: [], widths: WIDTHS, themes: THEMES,
    browserZoomRequested: BROWSER_ZOOM_REQUESTED,
    zoomMethod: BROWSER_ZOOM_REQUESTED === 1 ? "fresh profile/context default" : "MV3 chrome.tabs.setZoom/getZoom",
    osScaling: OS_SCALING,
    fixture: "rack-network + explicit Director fake provider", hardwareDispatches: 0,
    contrastAudit: {
      status: "partial", standard: "WCAG 2.x contrast thresholds only; not a full WCAG audit",
      method: "Computed foreground over solid ancestor backgrounds with alpha composition",
    },
    requestedCaptures: CAPTURE_FILTER.size ? [...CAPTURE_FILTER] : ["all"],
    coverage, images: [], zoomRuns: [], zoomFailures: [], scenarioFailures: [], viewportFailures: [], trailingIssues: [], generatedAt: FIXED_ISO,
  };
  let browser = null;
  try {
    if (BROWSER_ZOOM_REQUESTED === 1) {
      browser = await launchSharedBrowser();
      manifest.browserVersions.push(browser.version());
    }
    for (const width of WIDTHS) for (const theme of THEMES) {
      let profile = null;
      try {
        if (BROWSER_ZOOM_REQUESTED === 1) {
          await runViewport(browser, serverState.base, serverState.unknown, browser.version(), width, theme, manifest);
        } else {
          const launched = await launchZoomContext(width, HEIGHTS.get(width), theme);
          profile = launched.profile;
          const version = launched.context.browser()?.version() || "unknown";
          if (!manifest.browserVersions.includes(version)) manifest.browserVersions.push(version);
          await runViewport(null, serverState.base, serverState.unknown, version, width, theme, manifest, launched.context, launched.launch);
        }
      } catch (error) {
        const launch = error.directorLaunch || null;
        if (!profile) profile = error.directorProfile || null;
        manifest.viewportFailures.push({
          width, height: HEIGHTS.get(width), theme, status: "failed/not-captured",
          error: String(error.stack || error), launch,
        });
        if (BROWSER_ZOOM_REQUESTED !== 1 && launch) manifest.zoomFailures.push({ width, height: HEIGHTS.get(width), theme, status: "not-run", launch });
      } finally {
        removeZoomProfile(profile);
      }
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => serverState.server.close(resolve));
  }
  if (serverState.unknown.length) manifest.trailingIssues.push({ serverUnknownRequests: serverState.unknown });
  const failures = manifest.images.filter(image => image.pageErrors.length || image.consoleErrors.length || image.externalRequests.length || image.unknownRequests.length || image.failedRequests.length);
  const manifestPath = path.join(OUTPUT, "capture-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({
    output: OUTPUT, images: manifest.images.length, app: manifest.app, coverage,
    browserZoomRequested: BROWSER_ZOOM_REQUESTED, zoomFailures: manifest.zoomFailures,
    failures, scenarioFailures: manifest.scenarioFailures, viewportFailures: manifest.viewportFailures, trailingIssues: manifest.trailingIssues,
  }, null, 2));
  if (failures.length || manifest.zoomFailures.length || manifest.scenarioFailures.length || manifest.viewportFailures.length || manifest.trailingIssues.length) process.exitCode = 1;
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
