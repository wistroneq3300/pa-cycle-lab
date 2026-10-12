const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
  const net = [];
  page.on('request', r => { const u=r.url(); if (u.includes('events')) net.push('REQ '+r.method()+' '+u.split('?')[0].replace(/^https?:\/\/[^/]+/,'')); });
  page.on('response', r => { const u=r.url(); if (u.includes('events')) net.push('RES '+r.status()+' '+u.split('?')[0].replace(/^https?:\/\/[^/]+/,'')); });
  page.on('pageerror', e => console.log('[PAGEERROR]', e.message.slice(0,150)));
  await page.goto('http://10.33.34.29:6969/#/machine/EQ3300-AIAgent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.productDetailTab('telemetry'));
  await page.waitForTimeout(3500);
  // Dump ALL telemetry job rows with raw data attributes
  const rows = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-job]')].map(el => {
      const attrs = {};
      for (const a of el.attributes) if (a.name.startsWith('data-')) attrs[a.name]=a.value;
      return { attrs, name: el.querySelector('.tp-job-name')?.textContent?.trim(), state: el.querySelector('.tp-state')?.textContent?.trim() };
    });
  });
  console.log('ALL [data-job] ROWS:');
  rows.forEach((r,i)=>console.log(`  [${i}]`, JSON.stringify(r.attrs), '|', r.name, '|', r.state));
  // Click each console button in order, capture state, then close
  for (let i=0;i<rows.length;i++){
    await page.evaluate(idx => { const els=[...document.querySelectorAll('[data-job]')]; els[idx]?.querySelector('[data-console]')?.click(); }, i);
    await page.waitForTimeout(3000);
    const s = await page.evaluate(() => ({
      rows: document.querySelectorAll('.tp-log-row').length,
      conn: document.querySelector('[data-connection]')?.textContent,
      pipeline: [...document.querySelectorAll('.tp-pipeline span')].map(x=>x.dataset.state).join(','),
    }));
    console.log(`  OPEN[${i}] (${rows[i].name}):`, JSON.stringify(s));
    await page.evaluate(() => document.querySelector('[data-close]')?.click());
    await page.waitForTimeout(600);
  }
  console.log('NET:', JSON.stringify(net, null, 0));
  await browser.close();
})();
