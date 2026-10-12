const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1050 } });
  const net = [];
  page.on('request', r => { const u=r.url(); if (u.includes('/jobs/')&&u.includes('events')) net.push('REQ '+u.split('?')[0].split('/jobs/')[1].slice(0,14)); });
  page.on('response', r => { const u=r.url(); if (u.includes('/jobs/')&&u.includes('events')) net.push('RES '+r.status()+' job='+u.split('/jobs/')[1].split('/')[0].slice(0,14)); });
  await page.goto('http://10.33.34.29:6969/#/machine/EQ3300-AIAgent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.productDetailTab('telemetry'));
  await page.waitForTimeout(3000);
  // List the telemetry job rows: name + scope + job id
  const rows = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-job]')].map(el => ({
      job: el.getAttribute('data-job'),
      scope: el.getAttribute('data-scope'),
      name: el.querySelector('.tp-job-name')?.textContent?.trim(),
    }));
  });
  console.log('ROWS:', JSON.stringify(rows, null, 1));
  // Click the HOST row's console button (scope host)
  const hostIdx = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-job]')];
    return els.findIndex(el => el.getAttribute('data-scope')==='host');
  });
  console.log('HOST IDX:', hostIdx);
  if (hostIdx >= 0) {
    await page.evaluate(i => { const els=[...document.querySelectorAll('[data-job]')]; els[i].querySelector('[data-console]')?.click(); }, hostIdx);
    await page.waitForTimeout(4500);
    const s = await page.evaluate(() => ({
      rows: document.querySelectorAll('.tp-log-row').length,
      conn: document.querySelector('[data-connection]')?.textContent,
      steps: [...document.querySelectorAll('.tp-log-step')].map(x=>x.textContent),
      follow: document.querySelector('[data-follow]')?.textContent,
    }));
    console.log('HOST CONSOLE:', JSON.stringify(s, null, 1));
    await page.screenshot({ path: '/tmp/host2.png' });
  }
  console.log('NET:', JSON.stringify(net));
  await browser.close();
})();
