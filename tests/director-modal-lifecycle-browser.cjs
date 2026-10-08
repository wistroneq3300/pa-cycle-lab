"use strict";

const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.env.PA_CYCLE_BASE_URL || "http://127.0.0.1:9196";

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [], unknown = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const table = {
      "/api/machines": { last_scan: "director-modal", machines: [] },
      "/api/projects": { projects: [] },
      "/api/ai/gpu-alerts": { alerts: [] },
    };
    if (route.request().method() === "GET" && Object.hasOwn(table, url.pathname)) {
      return route.fulfill({ json: table[url.pathname] });
    }
    unknown.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 599, json: { detail: "Unknown director modal fixture request" } });
  });

  try {
    await page.goto(base + "/#/projects", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof showDialog === "function" && typeof uxConfirm === "function");
    await page.evaluate(() => {
      const opener = document.createElement("button");
      opener.id = "director-modal-opener";
      opener.textContent = "Open modal";
      document.body.append(opener);
      opener.focus();
      showDialog("編輯節點", '<label for="director-field">Node ID</label><input id="director-field" value="node-原始值"><button type="button" id="director-body-action">Body action</button>', [
        { txt: "取消", fn: closeDialog },
        { txt: "儲存", cls: "primary", fn: () => {} },
      ]);
    });
    const modal = page.locator("#rm-dialog .rm-modal");
    assert.equal(await modal.getAttribute("role"), "dialog");
    assert.equal(await modal.getAttribute("aria-modal"), "true");
    assert.equal(await modal.getAttribute("aria-labelledby"), "rm-dialog-title");
    await page.waitForFunction(() => document.activeElement?.id === "director-field");

    const last = page.locator("#rm-dialog-foot button").last();
    await last.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "關閉對話框");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await last.evaluate(element => document.activeElement === element), true);

    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, isComposing: true })));
    assert.notEqual(await page.locator("#rm-dialog").evaluate(element => getComputedStyle(element).display), "none");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#rm-dialog").evaluate(element => getComputedStyle(element).display), "none");
    await page.waitForFunction(() => document.activeElement?.id === "director-modal-opener");

    await page.evaluate(() => {
      document.getElementById("director-modal-opener").focus();
      window.__directorSubmitCount = 0;
      showDialog("儲存設定", '<label for="director-retained">Hostname</label><input id="director-retained" value="工程師輸入">', [
        { txt: "取消", fn: closeDialog },
        { txt: "儲存", cls: "primary", fn: async () => {
          window.__directorSubmitCount++;
          await new Promise(resolve => setTimeout(resolve, 80));
          throw new Error("409 · binding revision 已變更");
        } },
      ]);
    });
    const save = page.locator("#rm-dialog-foot .primary");
    await save.click();
    await save.click({ force: true });
    await page.locator("#rm-dialog-error").waitFor();
    assert.equal(await page.evaluate(() => window.__directorSubmitCount), 1);
    assert.equal(await page.locator("#director-retained").inputValue(), "工程師輸入");
    assert.match(await page.locator("#rm-dialog-error").innerText(), /409 .*binding revision/);
    assert.notEqual(await page.locator("#rm-dialog").evaluate(element => getComputedStyle(element).display), "none");
    await page.evaluate(() => uxNotify("403 · 權限不足，未送出修改", true));
    const persistent = page.locator("#content > .ux-workspace-errors .ux-workspace-error");
    await persistent.waitFor();
    assert.match(await persistent.innerText(), /403 .* 權限不足/);
    await page.waitForTimeout(100);
    assert.equal(await persistent.count(), 1);
    assert.equal(unknown.length, 0, `Unknown API requests: ${unknown.join(", ")}`);
    assert.deepEqual(errors, []);
    console.log("PASS director modal lifecycle: role/focus trap/IME/Escape/restore/busy/error retention");
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
