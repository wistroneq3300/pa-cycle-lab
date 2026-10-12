const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://10.33.34.29:6969/#/machine/EQ3300-AIAgent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.productDetailTab('telemetry'));
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const jobs = [...document.querySelectorAll('[data-job]')];
    return jobs.map(j => ({
      job: j.dataset.job,
      name: j.querySelector('.tp-job-name')?.textContent,
      state: j.dataset.state,
      scope: j.dataset.scope,
      hasConsoleBtn: !!j.querySelector('[data-console]'),
    }));
  });
  console.log('JOB ROWS:', JSON.stringify(info, null, 1));
  // Also dump the raw outerHTML of the telemetry panel (truncated)
  const html = await page.evaluate(() => {
    const panel = document.querySelector('#detail-telemetry, [data-panel="telemetry"], .telemetry');
    return panel ? panel.outerHTML.slice(0, 4000) : '(no telemetry panel found)';
  });
  console.log('PANEL HTML (4000):', html);
  await browser.close();
})();
