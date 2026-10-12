const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const logs=[]; page.on('console', m => logs.push(m.type()+': '+m.text().slice(0,120)));
  await page.goto('http://10.33.34.29:6969/#/machine/EQ3300-AIAgent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => window.productDetailTab('telemetry'));
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({
    tpJobs: document.querySelectorAll('.tp-job').length,
    tpGrid: document.querySelectorAll('.tp-job-grid').length,
    tpSection: document.querySelectorAll('.tp-section, [data-section]').length,
    detailPanels: [...document.querySelectorAll('#detail-detail [data-panel], .product-detail [data-panel]')].map(p=>({id:p.id, panel:p.dataset.panel, hidden:p.classList.contains('hidden'), visible:p.offsetParent!==null})),
    anyVisibleSection: [...document.querySelectorAll('.product-detail, #product-detail')].map(e=>({cls:e.className, textLen:e.textContent.length})),
    consoleBtns: document.querySelectorAll('[data-console]').length,
  }));
  console.log('INFO:', JSON.stringify(info,null,1));
  console.log('CONSOLE LOGS:', logs.slice(-8).join('\n'));
  await browser.close();
})();
