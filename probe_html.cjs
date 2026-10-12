const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://10.33.34.29:6969/#/machine/EQ3300-AIAgent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.productDetailTab('telemetry'));
  await page.waitForTimeout(3000);
  // Find the visible telemetry section
  const html = await page.evaluate(() => {
    // find element containing "啟用紀錄" text and closest section
    const btn = document.querySelector('[data-console]');
    if (!btn) return 'NO CONSOLE BTN';
    // walk up to a section-ish ancestor
    let el = btn;
    for (let i=0;i<6 && el.parentElement;i++) el = el.parentElement;
    return (el.id||el.className||'root') + ' ::\n' + el.outerHTML.slice(0, 5000);
  });
  console.log(html);
  await browser.close();
})();
