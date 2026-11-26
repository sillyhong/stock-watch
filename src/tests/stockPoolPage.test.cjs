const assert = require('assert').strict;
const path = require('path');
const { chromium } = require('playwright-core');

const base = process.env.STOCK_POOL_TEST_URL || 'http://127.0.0.1:3019';
const executablePath = process.env.EASTMONEY_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const tasks = [
  { id: 'rsi-watch-5m-a', title: 'A股 · 5分钟 RSI 监控', market: 'A', marketLabel: 'A股', intervalLabel: '5分钟' },
  { id: 'day-rsi-watch-hk', title: '港股 · 日线 RSI 监控', market: 'HK', marketLabel: '港股', intervalLabel: '日线' },
  { id: 'day-rsi-watch-us', title: '美股 · 日线 RSI 监控', market: 'US', marketLabel: '美股', intervalLabel: '日线' },
];
const sources = Array.from({ length: 45 }, (_, i) => {
  const name = `pool${String(i).padStart(2, '0')}`;
  return { id: `board:${name}`, fileName: `${name}.ts`, label: `${name}.ts`, exportName: `a_${name}`, market: 'A', count: 10 };
});
sources[1] = { ...sources[1], label: '软件开发 · BK0737', scope: 'partial', warning: '市场前缀需核实' };
sources.push({ id: 'board:hk', fileName: 'hk.ts', label: '港股分类', exportName: 'hk', market: 'HK', count: 1 });
const pools = [
  { taskId: 'rsi-watch-5m-a', sources: [sources[0].id, 'missing.ts#a_missing'], version: 1 },
  { taskId: 'day-rsi-watch-hk', sources: [], version: 1 },
  { taskId: 'day-rsi-watch-us', sources: [], version: 1 },
];

async function run() {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const capture = async (name) => {
      if (process.env.STOCK_POOL_SCREENSHOTS_DIR) await page.screenshot({ path: path.join(process.env.STOCK_POOL_SCREENSHOTS_DIR, name), fullPage: true });
    };
    let saved;
    await page.route('**/api/stock-pools**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'PUT') {
        saved = request.postDataJSON();
        const pool = pools.find((item) => item.taskId === saved.taskId);
        pool.sources = saved.sources;
        pool.version++;
        return route.fulfill({ json: { success: true, pool } });
      }
      if (url.searchParams.has('taskId')) return route.fulfill({ json: { success: true, stocks: ['0.000001'] } });
      return route.fulfill({ json: { success: true, tasks, sources, pools } });
    });
    await page.goto(`${base}/stock/stock-pools`, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('heading', { name: '配置池' }).count(), 1);
    assert.equal(await page.getByText('A股 · 5分钟 RSI 监控').count(), 1);
    await page.getByRole('tab', { name: /港股/ }).click();
    assert.equal(await page.getByText('港股 · 日线 RSI 监控').count(), 1);
    assert.equal(await page.getByText('A股 · 5分钟 RSI 监控').count(), 0);
    await page.getByRole('tab', { name: /A股/ }).click();
    await page.getByRole('button', { name: '配置', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await page.waitForTimeout(350);
    assert.equal(await dialog.getByText('软件开发 · BK0737').count(), 1);
    assert.equal(await dialog.getByText(/市场前缀需核实/).count(), 1);
    await capture('stock-pools-drawer.png');
    await dialog.locator('.ant-pagination-item-2').click();
    await dialog.getByRole('checkbox', { name: /pool21\.ts/ }).check();
    await dialog.getByLabel('搜索股票分类').fill('pool00');
    assert.equal(await dialog.getByRole('checkbox', { name: /pool00\.ts/ }).isChecked(), true);
    await dialog.getByLabel('搜索股票分类').clear();
    await dialog.getByRole('checkbox', { name: '仅看已选' }).check();
    assert.equal(await dialog.getByRole('checkbox', { name: /pool21\.ts/ }).isChecked(), true);
    await dialog.getByRole('checkbox', { name: /missing\.ts/ }).click();
    assert.equal(await dialog.getByRole('checkbox', { name: /missing\.ts/ }).count(), 0);
    await dialog.getByRole('button', { name: '保存配置' }).click();
    await page.waitForTimeout(250);
    assert.deepEqual(saved.sources, [sources[0].id, sources[21].id]);
    await capture('stock-pools-desktop.png');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert.ok(dimensions.document <= dimensions.viewport, `mobile horizontal overflow: ${JSON.stringify(dimensions)}`);
    await capture('stock-pools-mobile.png');
    assert.equal(await page.getByRole('button', { name: '配置', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: '配置', exact: true }).click();
    await page.waitForTimeout(350);
    await capture('stock-pools-mobile-drawer.png');
    console.log('stock pool page browser tests passed');
  } finally { await browser.close(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
