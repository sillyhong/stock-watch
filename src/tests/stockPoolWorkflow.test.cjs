const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-pool-workflow-'));
const stockDir = path.join(temp, 'src/pages/data/astock');
fs.mkdirSync(stockDir, { recursive: true });
fs.mkdirSync(path.join(temp, 'src/pages/utils'), { recursive: true });
fs.cpSync(path.join(root, 'src/pages/data/stock-pools'), path.join(temp, 'src/pages/data/stock-pools'), { recursive: true });
fs.writeFileSync(path.join(stockDir, 'astock.ts'), 'export const AStockList = ["0.000001"]\n');
fs.writeFileSync(path.join(stockDir, 'bandaoti.ts'), 'export const a_bantaoti = ["0.000002"]\n');
fs.writeFileSync(path.join(stockDir, 'cpo.ts'), 'export const a_cpo = ["1.600001"]\n');
fs.writeFileSync(path.join(stockDir, 'MLCC.ts'), 'export const a_MLCC = ["0.000003"]\n');
fs.writeFileSync(path.join(stockDir, 'custom.ts'), 'export const a_custom = ["0.300001", "1.600001"]\n');
fs.writeFileSync(path.join(stockDir, 'hk.ts'), 'export const hk_custom = ["116.00175"]\n');
fs.writeFileSync(path.join(stockDir, 'us.ts'), 'export const us_custom = ["105.TSLA"]\n');
fs.writeFileSync(path.join(temp, 'src/pages/utils/stockList.ts'), 'export const HKStockList = ["116.00700"]; export const USStockList = ["105.AAPL"];\n');
const originalLoad = Module._load;
function compile(file, mocks = {}) {
  const filename = path.join(root, file);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try { loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename); }
  finally { Module._load = originalLoad; }
  return loaded.exports;
}
const rows = new Map();
const database = { async query(sql, options = {}) {
  const p = options.replacements || {};
  if (sql.startsWith('CREATE')) return [];
  if (sql.startsWith('SHOW')) return [{ Field: 'market' }];
  if (sql.startsWith('INSERT')) { if (!rows.has(p.taskId)) rows.set(p.taskId, { task_id: p.taskId, market: p.market, sources: p.sources, version: 1 }); return []; }
  if (sql.startsWith('SELECT')) return rows.has(p.taskId) ? [{ ...rows.get(p.taskId) }] : [];
  if (sql.startsWith('UPDATE')) { const row = rows.get(p.taskId); if (!row || row.version !== p.version) return [null, { affectedRows: 0 }]; row.sources = p.sources; if (p.market) row.market = p.market; row.version++; return [null, { affectedRows: 1 }]; }
  throw new Error('Unexpected SQL');
} };
function response() { return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

async function run() {
  process.chdir(temp);
  const catalog = compile('src/config/apiCatalog.ts');
  const mapping = { getFutuMappingStatus: async () => null, startFutuMappingJob: () => ({ status: 'running' }) };
  const service = compile('src/services/stockPoolService.ts', { '@/config/apiCatalog': catalog, '@/services/lib/database': { __esModule: true, default: database }, '@/services/futuMappingService': mapping });
  const handler = compile('src/pages/api/stock-pools.api.ts', { '@/services/stockPoolService': service }).default;
  const original = { task_id: 'rsi-watch-5m-a', market: null, sources: '["astock.ts#AStockList"]', version: 1 };
  rows.set(original.task_id, { ...original });
  await assert.rejects(service.getTaskPool(original.task_id), /不一致/);
  assert.deepEqual(rows.get(original.task_id), original);
  rows.delete(original.task_id);
  fs.writeFileSync(path.join(temp, 'src/pages/data/stock-pools/HK/new-sector.ts'), 'export const label = "新增分类"; export const stocks = ["116.00700"];\n');
  const list = response();
  await handler({ method: 'GET', query: {} }, list);
  assert.equal(list.statusCode, 200);
  assert.ok(list.body.sources.some((item) => item.id === 'board:custom'));
  assert.ok(list.body.sources.some((item) => item.id === 'sector:HK/new-sector' && item.label.includes('新增分类') && item.scope === 'unverified'));
  fs.writeFileSync(path.join(temp, 'src/pages/data/stock-pools/A/ai.ts'), 'export const label = "修改后的旧分类"; export const stocks = ["0.300001"];\n');
  rows.set('day-rsi-watch-a', { task_id: 'day-rsi-watch-a', market: 'A', sources: '["sector:A/ai"]', version: 4 });
  const unchanged = await service.getTaskPool('day-rsi-watch-a');
  assert.deepEqual(unchanged.sources, ['sector:A/ai']);
  assert.equal(unchanged.version, 4);
  assert.deepEqual(await service.getTaskStocks('day-rsi-watch-a'), ['0.300001']);
  async function setPool(taskId, sources) {
    const pool = await service.getTaskPool(taskId);
    const res = response();
    await handler({ method: 'PUT', body: { taskId, sources, version: pool.version } }, res);
    assert.equal(res.statusCode, 200);
    return pool.version;
  }
  const version = await setPool('rsi-watch-15m-a', ['board:custom', 'board:cpo']);
  await setPool('day-rsi-watch-a', ['board:custom']);
  await setPool('rsi-watch-5m-a', ['board:custom']);
  await setPool('rsi-watch-30m-a', ['board:bandaoti']);
  await setPool('rsi-watch-60m-a', ['board:MLCC']);
  await setPool('rsi-watch-15m-hk', ['board:hk']);
  await setPool('rsi-watch-30m-us', ['board:us']);
  await setPool('backtrend-30m-a', ['board:cpo']);
  await setPool('main-trend-day-a', ['board:cpo']);
  await setPool('main-trend-60m-a', ['board:custom']);
  const conflict = response();
  await handler({ method: 'PUT', body: { taskId: 'rsi-watch-15m-a', sources: [], version } }, conflict);
  assert.equal(conflict.statusCode, 409);
  const calls = [];
  const enums = { EStockType: { A: 'A', HK: 'HK', US: 'US' }, EKLT: { '5M': 5, '15M': 15, '30M': 30, '60M': 60, DAY: 101 } };
  const periodDays = { 5: 7, 15: 40, 30: 40, 60: 40, 101: 180 };
  const config = { EReqType: { EASY_MONEY: 'EASY_MONEY', FU_TU: 'FU_TU' }, BATCH_DELAY_RANGE: { min: 0, max: 0 }, PrePullDayConfig: { A: periodDays, HK: periodDays, US: periodDays }, ENABLE_DATABASE_STORAGE: false };
  const rsi = compile('src/pages/utils/fetchRSIAndSendEmail.ts', {
    '../interface': enums, './stockList': { FutuStockLists: {} }, '@/services/stockPoolService': service, './config': config,
    './sort': { sortByStockName: (value) => value },
    './dataFetcher': { batchFetchStockData: async (input) => { calls.push(input.stockLists); return { results: [], requestFailures: [], totalRequestCount: input.stockLists.length, successfulRequestCount: input.stockLists.length }; }, logRequestStatistics: () => {} },
    './rsiProcessor': { processRSIDataAsync: async () => ({ rsiDataList: [], buyList: [], sellList: [] }) },
    './emailNotifier': { sendRSIEmailNotification: async () => {} }, './rsiDatabaseSaver': { RSIDatabaseSaver: {} },
  });
  await rsi.fetchARSI({ klt: 15, sendEmail: false });
  assert.deepEqual(calls.pop(), ['0.300001', '1.600001']);
  await rsi.fetchARSI({ klt: 101, sendEmail: false });
  assert.deepEqual(calls.pop(), ['0.300001', '1.600001']);
  await rsi.fetchARSI({ klt: 5, sendEmail: false });
  assert.deepEqual(calls.pop(), ['0.300001', '1.600001']);
  await setPool('rsi-watch-5m-a', ['sector:A/hangtian_bk1232_invalid', 'sector:A/cpo_bk0448_invalid']);
  await rsi.fetchARSI({ klt: 5, sendEmail: false });
  assert.deepEqual(calls.pop(), ['1.600118', '1.601698', '1.603083']);
  await rsi.fetchARSI({ klt: 30, sendEmail: false });
  assert.deepEqual(calls.pop(), ['0.000002']);
  await rsi.fetchARSI({ klt: 60, sendEmail: false });
  assert.deepEqual(calls.pop(), ['0.000003']);
  await rsi.fetchHKRSI({ klt: 15, sendEmail: false });
  assert.deepEqual(calls.pop(), ['116.00175']);
  await rsi.fetchHKRSI({ klt: 101, sendEmail: false });
  assert.equal(calls.pop().length, 19);
  await rsi.fetchUSRSI({ klt: 30, sendEmail: false });
  assert.deepEqual(calls.pop(), ['105.TSLA']);
  await rsi.fetchARSI({ klt: 30, sendEmail: false, isBacktesting: true });
  assert.deepEqual(calls.pop(), ['1.600001']);
  fs.writeFileSync(path.join(stockDir, 'custom.ts'), 'export const a_custom = ["0.300001", "0.300002"]\n');
  await rsi.fetchARSI({ klt: 15, sendEmail: false });
  assert.deepEqual(calls.pop(), ['0.300001', '0.300002', '1.600001']);
  const trendCalls = [];
  const trend = compile('src/pages/utils/fetchMainTrendAndSendEmail.ts', {
    '../interface': enums, '@/services/stockPoolService': service, './config': config,
    './mainTrendProcessor': { detectMainTrendBatch: async (stocks) => { trendCalls.push(stocks.map((stock) => stock.code)); return []; } },
    './mainTrendConfig': { DEFAULT_MAIN_TREND_CONFIG: {} }, './emailNotifier': { QQMail: {} },
  });
  await trend.fetchAMainTrend({ config: { name: 'test day', marketType: 'A', eltConfig: 101 }, sendEmail: false });
  assert.deepEqual(trendCalls.pop(), ['1.600001']);
  await trend.fetchAMainTrend({ config: { name: 'test 60', marketType: 'A', eltConfig: 60 }, sendEmail: false });
  assert.deepEqual(trendCalls.pop(), ['0.300001', '0.300002']);
  await setPool('main-trend-60m-a', ['sector:A/hangtian_bk1232_invalid', 'sector:A/cpo_bk0448_invalid']);
  await trend.fetchAMainTrend({ config: { name: 'test 60', marketType: 'A', eltConfig: 60 }, sendEmail: false });
  assert.deepEqual(trendCalls.pop(), ['1.600118', '1.601698', '1.603083']);
  console.log('stock pool workflow tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { process.chdir(root); fs.rmSync(temp, { recursive: true, force: true }); });
