const assert = require('assert').strict;
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');
const file = path.resolve('src/pages/utils/dataFetcher.ts');
const originalLoad = Module._load;
const calls = [];
let enabled = true;
const config = {
  EReqType: { EASY_MONEY: 'EASY_MONEY', FU_TU: 'FU_TU' },
  BATCH_DELAY_RANGE: { min: 0, max: 0 },
  createBatches: (stocks) => [stocks],
  createEastmoneyRequest: async (stock) => {
    if (stock === '0.000002' || stock === '0.301589') throw new Error('socket hang up');
    if (stock === '0.000003') return { data: { data: null } };
    return { data: { data: { market: 0, code: stock.split('.')[1], name: 'test', klines: ['original'] } } };
  },
  getStockIdentifier: (stock) => stock,
  getStockName: (stock) => stock,
  getSimplifiedErrorMessage: (error) => ({ type: 'API_ERROR', message: error.message }),
};
const headers = { randomDelay: async () => {}, getRandomUserAgent: () => '', getRandomUserToken: () => '', randomFromArray: () => '', randomIP: () => '' };
const futu = {
  futuFallbackEnabled: () => enabled,
  fetchFutuKlines: async (stock, klt, options) => { calls.push({ stock, klt, options }); return { market: 0, code: stock.split('.')[1], name: 'test', klines: ['futu'] }; },
};
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
Module._load = function(request, parent, isMain) {
  if (request === './config') return config;
  if (request === './header') return headers;
  if (request === '@/services/futuQuoteService') return futu;
  return originalLoad.call(this, request, parent, isMain);
};
try { loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file); }
finally { Module._load = originalLoad; }

async function run() {
  const params = { reqType: 'EASY_MONEY', stockLists: ['0.000001', '0.000002', '0.000003'], stockType: 'A', klt: 15, startFormatDay: '20261001', endFormatDay: '2026-11-20', batchDelayRange: { min: 0, max: 0 } };
  const result = await loaded.exports.batchFetchStockData(params);
  assert.equal(result.successfulRequestCount, 3);
  assert.deepEqual(calls.map((call) => call.stock), ['0.000002', '0.000003']);
  assert.equal(calls[0].options.start, '2026-10-01');
  assert.equal(calls[0].options.end, '2026-11-20');
  assert.equal(result.results[0].response.data.data.klines[0], 'original');
  assert.equal(result.results[1].response.data.data.klines[0], 'futu');
  enabled = false;
  calls.length = 0;
  const disabled = await loaded.exports.batchFetchStockData(params);
  assert.equal(disabled.successfulRequestCount, 1);
  assert.equal(disabled.requestFailures.length, 2);
  assert.equal(calls.length, 0);
  if (process.env.FUTU_LIVE_TEST === '1') {
    const webFile = path.resolve('src/services/futuWebQuoteService.ts');
    const web = new Module(webFile, module);
    web.filename = webFile;
    web.paths = Module._nodeModulePaths(path.dirname(webFile));
    const load = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === './futuMappingStore') return { lookupFutuMapping: async () => undefined, saveFutuMappingForSources: async () => {} };
      return load.call(this, request, parent, isMain);
    };
    try { web._compile(ts.transpileModule(fs.readFileSync(webFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, webFile); }
    finally { Module._load = load; }
    enabled = true;
    futu.fetchFutuKlines = web.exports.fetchFutuWebKlines;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const start = new Date(Date.now() - 14 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }).replace(/-/g, '');
    const live = await loaded.exports.batchFetchStockData({ ...params, stockLists: ['0.301589'], klt: 5, startFormatDay: start, endFormatDay: today });
    assert.equal(live.successfulRequestCount, 1);
    assert.equal(live.results[0].response.data.data.code, '301589');
    assert.ok(live.results[0].response.data.data.klines.length > 0);
    console.log(`futu live fallback: ${live.results[0].response.data.data.klines.length} bars`);
  }
  console.log('futu fallback tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
