"use strict";

/*
 * Strict browser regression for PA Agent drawer session isolation.
 *
 * Read requests from drawer A are deliberately held until drawer B is fully
 * open.  The fetch shim ignores AbortSignal so the generation checks—not just
 * browser cancellation—must reject every late A response.
 *
 * Run:
 *   PLAYWRIGHT_MODULE=<playwright module> node tests/pa-agent-session-race-browser.cjs
 */

const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const REPO = path.resolve(__dirname, "..");
const SCRIPT = path.join(REPO, "app", "static", "js", "pa-agent.js");
const BASE = "http://127.0.0.1:19493";

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body),
  });
}

function delayedResponse() {
  let markSeen;
  let release;
  let markDone;
  const seen = new Promise(resolve => { markSeen = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const done = new Promise(resolve => { markDone = resolve; });
  let started = false;
  return {
    seen,
    done,
    release,
    async reply(route, body, status = 200) {
      if (!started) { started = true; markSeen(); }
      await blocked;
      try { await json(route, body, status); }
      finally { markDone(); }
    },
  };
}

function run(id, status = "DONE", extra = {}) {
  return { run_id: id, status, commands: [], evidence: [], ...extra };
}

async function harness(browser, name, apiHandler, exercise) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const unexpected = [];
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message || String(error)));

  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (resource, options = {}) => {
      const withoutSignal = { ...options };
      delete withoutSignal.signal;
      return nativeFetch(resource, withoutSignal);
    };
  });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin === BASE && url.pathname === "/__pa_session_race__") {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<!doctype html><html><head><meta charset=utf-8></head><body></body></html>",
      });
      return;
    }
    if (url.origin === BASE && url.pathname.startsWith("/api/")) {
      const handled = await apiHandler({ route, url, method: route.request().method() });
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
    await page.goto(BASE + "/__pa_session_race__", { waitUntil: "domcontentloaded" });
    await page.addScriptTag({ path: SCRIPT });
    await exercise(page);
    assert.deepEqual(unexpected, [], `${name}: unexpected API/resource requests`);
    assert.deepEqual(pageErrors, [], `${name}: browser page errors`);
    console.log(`PASS ${name}`);
  } finally {
    await context.close();
  }
}

async function open(page, caseId, title) {
  await page.evaluate(({ caseId: id, title: label }) => {
    void window.PA_Agent.open({ case_variant_id: id, title: label, node_id: `node-${id}` });
  }, { caseId, title });
}

async function close(page) {
  await page.evaluate(() => window.PA_Agent.close());
}

async function waitForText(page, text) {
  await page.waitForFunction(value => document.querySelector("#pa-agent-drawer.open")?.textContent.includes(value), text);
}

async function assertOnlyB(page) {
  const text = await page.locator("#pa-agent-drawer.open").innerText();
  assert.match(text, /B-TITLE/);
  assert.match(text, /B-HISTORY-MESSAGE/);
  assert.match(text, /B-ATTACHMENT\.log/);
  assert.doesNotMatch(text, /A-(?:TITLE|ACTIVE|HISTORY|POLL|ATTACHMENT|ERROR)|run-a/);
  assert.equal(await page.locator("#pa-agent-drawer .pa-error-note").count(), 0);
  assert.doesNotMatch(await page.locator("#pa-sync").innerText(), /連線中斷/);
}

function handleB({ route, url, method }) {
  if (method === "GET" && url.pathname === "/api/agent/active" && url.searchParams.get("case_variant_id") === "case-b") {
    return json(route, { run: run("run-b") }).then(() => true);
  }
  if (method === "GET" && url.pathname === "/api/agent/runs/run-b/messages") {
    return json(route, { messages: [{ seq: 1, role: "agent", kind: "message", text: "B-HISTORY-MESSAGE" }] }).then(() => true);
  }
  if (method === "GET" && url.pathname === "/api/agent/runs/run-b/attachments/unconsumed") {
    return json(route, { attachments: [{ attachment_id: "att-b", name: "B-ATTACHMENT.log", size: 8, kind: "file" }] }).then(() => true);
  }
  return false;
}

async function staleActive(browser) {
  const activeA = delayedResponse();
  await harness(browser, "session race: stale active response", async request => {
    const { route, url, method } = request;
    if (method === "GET" && url.pathname === "/api/agent/active" && url.searchParams.get("case_variant_id") === "case-a") {
      await activeA.reply(route, { run: run("run-a", "ERROR", { failure_reason: "A-ERROR", final_result: "A-ACTIVE" }) });
      return true;
    }
    return handleB(request);
  }, async page => {
    await open(page, "case-a", "A-TITLE");
    await activeA.seen;
    await close(page);
    await open(page, "case-b", "B-TITLE");
    await waitForText(page, "B-ATTACHMENT.log");
    activeA.release();
    await activeA.done;
    await page.waitForTimeout(50);
    await assertOnlyB(page);
    await close(page);
  });
}

async function staleHistoryAndAttachment(browser) {
  const historyA = delayedResponse();
  const attachmentsA = delayedResponse();
  await harness(browser, "session race: stale history and attachment responses", async request => {
    const { route, url, method } = request;
    if (method === "GET" && url.pathname === "/api/agent/active" && url.searchParams.get("case_variant_id") === "case-a") {
      await json(route, { run: run("run-a", "RUNNING") });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-a/messages") {
      await historyA.reply(route, { messages: [{ seq: 9, role: "agent", kind: "message", text: "A-HISTORY-MESSAGE" }] });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-a/attachments/unconsumed") {
      await attachmentsA.reply(route, { attachments: [{ attachment_id: "att-a", name: "A-ATTACHMENT.log", kind: "file" }] });
      return true;
    }
    return handleB(request);
  }, async page => {
    await open(page, "case-a", "A-TITLE");
    await Promise.all([historyA.seen, attachmentsA.seen]);
    await close(page);
    await open(page, "case-b", "B-TITLE");
    await waitForText(page, "B-ATTACHMENT.log");
    historyA.release();
    attachmentsA.release();
    await Promise.all([historyA.done, attachmentsA.done]);
    await page.waitForTimeout(50);
    await assertOnlyB(page);
    await close(page);
  });
}

async function stalePollAndAttachment(browser) {
  const pollA = delayedResponse();
  const attachmentsA = delayedResponse();
  let aMessageReads = 0;
  await harness(browser, "session race: stale poll and attachment responses", async request => {
    const { route, url, method } = request;
    if (method === "GET" && url.pathname === "/api/agent/active" && url.searchParams.get("case_variant_id") === "case-a") {
      await json(route, { run: run("run-a", "RUNNING") });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-a/messages") {
      aMessageReads += 1;
      if (aMessageReads === 1) await json(route, { messages: [] });
      else await pollA.reply(route, { messages: [{ seq: 10, role: "agent", kind: "message", text: "A-POLL-MESSAGE" }] });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-a/attachments/unconsumed") {
      await attachmentsA.reply(route, { attachments: [{ attachment_id: "att-a", name: "A-ATTACHMENT.log", kind: "file" }] });
      return true;
    }
    return handleB(request);
  }, async page => {
    await open(page, "case-a", "A-TITLE");
    await Promise.all([pollA.seen, attachmentsA.seen]);
    await close(page);
    await open(page, "case-b", "B-TITLE");
    await waitForText(page, "B-ATTACHMENT.log");
    pollA.release();
    attachmentsA.release();
    await Promise.all([pollA.done, attachmentsA.done]);
    await page.waitForTimeout(50);
    await assertOnlyB(page);
    assert.equal(aMessageReads, 2, "A issued exactly history + initial poll reads");
    await close(page);
  });
}

async function sameCaseResume(browser) {
  let activeReads = 0;
  let historyReads = 0;
  let attachmentReads = 0;
  await harness(browser, "session lifecycle: same case resumes after close", async ({ route, url, method }) => {
    if (method === "GET" && url.pathname === "/api/agent/active" && url.searchParams.get("case_variant_id") === "case-same") {
      activeReads += 1;
      await json(route, { run: run("run-same") });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-same/messages") {
      historyReads += 1;
      await json(route, { messages: [{ seq: 1, role: "agent", kind: "message", text: "SAME-HISTORY" }] });
      return true;
    }
    if (method === "GET" && url.pathname === "/api/agent/runs/run-same/attachments/unconsumed") {
      attachmentReads += 1;
      await json(route, { attachments: [{ attachment_id: "same-att", name: "SAME-ATTACHMENT.log", kind: "file" }] });
      return true;
    }
    return false;
  }, async page => {
    await open(page, "case-same", "SAME-TITLE");
    await waitForText(page, "SAME-ATTACHMENT.log");
    await close(page);
    await open(page, "case-same", "SAME-TITLE");
    await page.waitForFunction(() => document.querySelector("#pa-agent-drawer.open")?.textContent.includes("SAME-HISTORY"));
    await page.waitForFunction(() => document.querySelector("#pa-agent-drawer.open")?.textContent.includes("SAME-ATTACHMENT.log"));
    assert.equal(activeReads, 2);
    assert.equal(historyReads, 2);
    assert.equal(attachmentReads, 2);
    assert.match(await page.locator("#pa-drawer-status-text").innerText(), /已完成/);
    await close(page);
  });
}

(async () => {
  const launchOptions = { headless: true };
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  } else if (process.env.PLAYWRIGHT_CHANNEL) {
    launchOptions.channel = process.env.PLAYWRIGHT_CHANNEL;
  } else if (process.platform === "win32") {
    launchOptions.channel = "msedge";
  }
  const browser = await chromium.launch(launchOptions);
  try {
    await staleActive(browser);
    await staleHistoryAndAttachment(browser);
    await stalePollAndAttachment(browser);
    await sameCaseResume(browser);
    console.log("PASS pa-agent session race browser suite");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
