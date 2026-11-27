const assert = require('assert').strict;
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');
const axios = require('axios');
const file = path.resolve('src/services/futuWebQuoteService.ts');
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
const originalLoad = Module._load;
let savedInfo;
const automaticMappings = new Map();
let failSave = false;
Module._load = function(request, parent, isMain) {
  if (request === './futuMappingStore') return { lookupFutuMapping: async () => savedInfo, saveFutuMappingForSources: async (code, value) => { if (failSave) throw new Error('disk unavailable'); automaticMappings.set(code, value); } };
  return originalLoad.call(this, request, parent, isMain);
};
try { loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file); }
finally { Module._load = originalLoad; }
const service = loaded.exports;
const originalGet = axios.get;
const info = { stockCode: '300085', stockId: '63367949785269', marketLabel: 'SZ', name: '银之杰', marketType: 4, marketCode: 35, instrumentType: 3, subInstrumentType: 3002 };
const html = `<script>window.__INITIAL_STATE__=${JSON.stringify({ stock_info: info, nested: { text: 'a } " b' } })};window.other=1;</script>`;
const example = { k: 1795590000, o: '27.5', c: '26.1', h: '27.59', l: '26', v: 53991766, t: 1441396744.73, r: 0.09048, lc: 28.08, cp: '-1.98' };
let pages = 0;
let quotes = 0;
let responseBars = [example];

async function run() {
  assert.equal(service.signFutuWebParams({ stockId: '82639465969979', _: '1749342789694' }), '5702fa4857');
  assert.equal(service.signFutuWebParams({ marketType: '4', plateId: '10000002', page: '0', pageSize: '1000', _: '1767110400000' }), 'e676c3ac30');
  assert.equal(service.parseFutuStockPage(html, '300085', 'SZ').stockId, info.stockId);
  assert.throws(() => service.parseFutuStockPage(html, '600519', 'SH'), /身份不匹配/);
  assert.throws(() => service.parseFutuStockPage('bad html', '300085', 'SZ'), /缺少初始状态/);
  axios.get = async (url, options) => {
    if (url.includes('/search-stock/predict')) return { data: { code: 0, data: { quote: [] } } };
    if (url.includes('/stock/')) { pages++; return { data: html }; }
    quotes++;
    assert.equal(options.headers['quote-token'], service.signFutuWebParams(options.params));
    assert.equal(options.params.marketCode, '35');
    const list = options.params.type === '3' ? responseBars.map((bar) => ({ ...bar, k: 1795392000 })) : options.params.type === '4' ? responseBars.map((bar) => ({ ...bar, k: 1793491200 })) : responseBars;
    return { data: { code: 0, data: { list } } };
  };
  const types = { 5: '6', 15: '7', 30: '8', 60: '9', 101: '2', 102: '3', 103: '4' };
  for (const [klt, type] of Object.entries(types)) {
    let capturedType;
    const old = axios.get;
    axios.get = async (url, options) => { if (url.includes('/get-kline') && !capturedType) capturedType = options.params.type; return old(url, options); };
    const data = await service.fetchFutuWebKlines('0.300085', Number(klt), { start: '2026-11-25', end: '2026-11-25', limit: 10 });
    axios.get = old;
    assert.equal(capturedType, type);
    assert.equal(data.code, '300085');
    assert.equal(data.market, 0);
    assert.equal(data.klines.length, 1);
    const fields = data.klines[0].split(',');
    assert.equal(fields[0], Number(klt) >= 101 ? '2026-11-25' : '2026-11-25 15:00');
    assert.equal(Number(fields[5]), 539917.66);
    assert.ok(Math.abs(Number(fields[10]) - 9.048) < 0.00001);
    assert.equal(Number(fields[11]), 539917.66);
  }
  assert.equal(pages, 1, 'stock metadata should be cached');
  assert.equal(quotes, 9);
  savedInfo = { ...info, stockCode: '300086', stockId: '456' };
  const mapped = await service.fetchFutuWebKlines('0.300086', 101, { start: '2026-11-25', end: '2026-11-25' });
  assert.equal(mapped.code, '300086');
  assert.equal(pages, 1, 'a valid stored mapping should avoid a page request');
  savedInfo = undefined;
  await assert.rejects(service.fetchFutuWebKlines('0.300085', 102, { start: '2026-11-01', end: '2026-11-24' }), /无指定日期/);
  await assert.rejects(service.fetchFutuWebKlines('0.300085', 101, { start: '2026-11-25', end: '2026-11-25', adjustment: 0 }), /复权方式/);
  responseBars = [{ ...example, c: 200 }];
  await assert.rejects(service.fetchFutuWebKlines('0.300085', 101, { start: '2026-11-25', end: '2026-11-25' }), /数据无效/);
  responseBars = [example, example];
  await assert.rejects(service.fetchFutuWebKlines('0.300085', 101, { start: '2026-11-25', end: '2026-11-25' }), /重复时间/);
  responseBars = [example];
  let failedRequests = 0;
  const originalMock = axios.get;
  axios.get = async (url, options) => {
    if (url.includes('/get-kline') && options.params.type === '6') {
      failedRequests++;
      throw new axios.AxiosError('timeout', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 504 });
    }
    return originalMock(url, options);
  };
  await assert.rejects(service.fetchFutuWebKlines('0.300085', 5, { start: '2026-11-25', end: '2026-11-25' }), /504/);
  await assert.rejects(service.fetchFutuWebKlines('0.300085', 5, { start: '2026-11-25', end: '2026-11-25' }), /熔断/);
  assert.equal(failedRequests, 1);
  assert.equal((await service.fetchFutuWebKlines('0.300085', 101, { start: '2026-11-25', end: '2026-11-25' })).klines.length, 1);
  let searchCalls = 0;
  let klineParams;
  const searchMock = axios.get;
  axios.get = async (url, options) => {
    if (url.includes('/search-stock/predict')) {
      searchCalls++;
      const code = options.params.keyword;
      return { data: { code: 0, data: { quote: [
        { stockSymbol: code, stockName: '错误市场', stockId: '900', market: 'hk', marketType: 1 },
        { stockSymbol: code, stockName: '中国卫星', stockId: '43426415929974', market: 'sh', marketType: 4 },
      ] } } };
    }
    if (url.includes('/get-kline')) {
      klineParams = options.params;
      assert.equal(options.headers['quote-token'], service.signFutuWebParams(options.params));
      return { data: { code: 0, data: { list: [example] } } };
    }
    return searchMock(url, options);
  };
  const found = await service.fetchFutuWebKlines('1.600118', 101, { start: '2026-11-25', end: '2026-11-25' });
  assert.equal(found.name, '中国卫星');
  assert.equal(found.code, '600118');
  assert.equal(klineParams.stockId, '43426415929974');
  assert.equal(klineParams.marketType, '4');
  assert.equal(klineParams.marketCode, undefined);
  assert.equal(automaticMappings.get('1.600118').stockId, '43426415929974');
  assert.equal(searchCalls, 1);
  assert.equal(pages, 1, 'search result should avoid the stock page');
  failSave = true;
  const stockWithoutDisk = await service.fetchFutuWebKlines('1.600121', 101, { start: '2026-11-25', end: '2026-11-25' });
  assert.equal(stockWithoutDisk.code, '600121', 'disk failure must not block live quote retrieval');
  failSave = false;
  axios.get = async (url) => {
    if (url.includes('/search-stock/predict')) return { data: { code: 0, data: { quote: [
      { stockSymbol: '600119', stockName: '候选1', stockId: '123', market: 'sh', marketType: 4 },
      { stockSymbol: '600119', stockName: '候选2', stockId: '456', market: 'sh', marketType: 4 },
    ] } } };
    if (url.includes('/stock/')) return { data: html };
    throw new Error('unexpected quote request');
  };
  await assert.rejects(service.resolveFutuStockInfo('1.600119'), /未找到唯一匹配/);
  assert.equal(automaticMappings.has('1.600119'), false, 'ambiguous search must not be saved');
  let pageAfterLimit = false;
  axios.get = async (url) => {
    if (url.includes('/search-stock/predict')) throw new axios.AxiosError('rate limited', 'ERR_BAD_REQUEST', undefined, undefined, { status: 429 });
    if (url.includes('/stock/')) pageAfterLimit = true;
    throw new Error('unexpected request');
  };
  await assert.rejects(service.resolveFutuStockInfo('1.600120'), /熔断/);
  assert.equal(pageAfterLimit, false, 'rate-limited search must not retry through the page');
  axios.get = searchMock;
  console.log('futu web quote tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { axios.get = originalGet; });
