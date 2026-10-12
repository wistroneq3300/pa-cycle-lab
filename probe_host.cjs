const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
  const net = [];
  page.on('request', r => { const u=r.url(); if (u.includes('/jobs/') && u.includes('events')) net.push('REQ '+u.replace(/^https?:\/\/[^/]+/,'').replace(/&/g,'\n    ')); });
  page.on('response', r => { const u=r.url(); if (u.includes('/jobs/') && u.includes('events')) net.push('RES '+r.status()+' '+u.split('?')[0].replace(/^https?:\/\/[^/]+/,'')); });
  await page.goto('http://10.33.34.29:6969/#/machine/EQ3300-AIAgent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.productDetailTab('telemetry'));
  await page.waitForTimeout(2500);
  // Find all console buttons and their labels
  const btns = await page.evaluate(() => [...document.querySelectorAll('[data-console]')].map((b,i)=>({i, label:b.closest('[data-job]')?.dataset.job, name:b.closest('[data-job]')?.querySelector('.tp-job-name')?.textContent})));
  console.log('CONSOLE BUTTONS:', JSON.stringify(btns));
  // Click the HOST one (scope host). Identify by name containing '主機' or the host job_id
  const host = btns.find(b => (b.name||'').includes('主機')) || btns.find(b => b.job && b.job.startsWith('282e69'));
  if (host) {
    await page.evaluate(i => document.querySelectorAll('[data-console]')[i].click(), host.i);
    await page.waitForTimeout(4000);
    const s = await page.evaluate(() => ({
      rows: document.querySelectorAll('.tp-log-row').length,
      conn: document.querySelector('[data-connection]')?.textContent,
      modalOpen: !!document.querySelector('.tp-modal[open], .tp-modal[aria-hidden="false"], .tp-modal:not([aria-hidden="true"])'),
    }));
    console.log('AFTER HOST OPEN:', JSON.stringify(s));
    await page.screenshot({ path: '/tmp/host_console.png', fullPage: false });
    console.log('SHOT: /tmp/host_console.png');
  } else {
    console.log('NO HOST CONSOLE BUTTON FOUND');
  }
  console.log('EVENTS NET:', JSON.stringify(net));
  await browser.close();
})();
