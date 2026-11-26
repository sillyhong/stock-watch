const assert = require('assert').strict;
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');
const axios = require('axios');

const file = path.resolve('src/services/futuQuoteService.ts');
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === './futuWebQuoteService') return { fetchFutuWebKlines: async () => ({ source: 'web' }) };
  return originalLoad.call(this, request, parent, isMain);
};
try { loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file); }
finally { Module._load = originalLoad; }
const { eastmoneyToFutuSymbol, fetchFutuKlines } = loaded.exports;
const originalGet = axios.get;
const originalPost = axios.post;
const originalEnv = { ...process.env };

function bar(date, close) {
  return { time_key: Date.parse(`${date}T01:30:00Z`), date: Number(date.replace(/-/g, '')), open: close - 1, close, high: close + 1, low: close - 2, volume: 1000, turnover: 10000, last_close: close - 1, sc_name: '测试股票' };
}

async function run() {
  delete process.env.FUTU_QUOTE_PROVIDER;
  delete process.env.FUTU_FALLBACK_ENABLED;
  assert.equal(loaded.exports.futuFallbackEnabled(), true);
  assert.equal((await fetchFutuKlines('0.300085', 101, { start: '2026-11-01', end: '2026-11-24' })).source, 'web');
  process.env.FUTU_FALLBACK_ENABLED = 'false';
  assert.equal(loaded.exports.futuFallbackEnabled(), false);
  process.env.FUTU_QUOTE_PROVIDER = 'openapi';
  assert.equal(eastmoneyToFutuSymbol('0.300085'), 'SZ.300085');
  assert.equal(eastmoneyToFutuSymbol('1.600519'), 'SH.600519');
  assert.equal(eastmoneyToFutuSymbol('0.830001'), 'BJ.830001');
  assert.equal(eastmoneyToFutuSymbol('116.00700'), 'HK.00700');
  assert.equal(eastmoneyToFutuSymbol('105.AAPL'), 'US.AAPL');
  assert.throws(() => eastmoneyToFutuSymbol('0.not-a-code'));
  process.env.FUTU_ACCESS_TOKEN = 'test-token';
  delete process.env.FUTU_CLIENT_ID;
  delete process.env.FUTU_REFRESH_TOKEN;
  const requests = [];
  axios.get = async (url, options) => {
    requests.push(new URL(url));
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return requests.length === 1
      ? { data: { ret_code: 0, data: { kline_list: [bar('2026-11-24', 10)], next_time: 123 }, pagination: { has_more: true } } }
      : { data: { ret_code: 0, data: { kline_list: [bar('2026-11-23', 9)] }, pagination: { has_more: false } } };
  };
  const result = await fetchFutuKlines('0.300085', 15, { start: '2026-11-01', end: '2026-11-24' });
  assert.equal(requests[0].searchParams.get('end'), '2026-11-25');
  assert.equal(requests[0].searchParams.get('ktype'), '7');
  assert.equal(requests[0].searchParams.get('autype'), '1');
  assert.equal(requests[1].searchParams.get('next_time'), '123');
  assert.equal(result.code, '300085');
  assert.equal(result.klines.length, 2);
  assert.ok(result.klines[0].startsWith('2026-11-23 09:30,'));
  assert.deepEqual(result.klines[0].split(',').slice(-3), ['1000', '10000', '37.5']);
  axios.get = async () => ({ data: { ret_code: 0, data: { kline_list: [bar('2026-11-24', 10)] } } });
  await assert.rejects(fetchFutuKlines('0.300085', 101, { start: '2026-11-01', end: '2026-11-24' }), /分页状态/);
  axios.get = async () => ({ data: { ret_code: -12, ret_msg: 'quota exceeded' } });
  await assert.rejects(fetchFutuKlines('0.300085', 101, { start: '2026-11-01', end: '2026-11-24' }), /code=-12/);
  delete process.env.FUTU_ACCESS_TOKEN;
  process.env.FUTU_CLIENT_ID = 'client';
  process.env.FUTU_REFRESH_TOKEN = 'refresh-secret';
  let refreshes = 0;
  axios.post = async () => { refreshes++; return { data: { access_token: 'refreshed-token', expires_in: 7200 } }; };
  axios.get = async (_, options) => {
    assert.equal(options.headers.Authorization, 'Bearer refreshed-token');
    return { data: { ret_code: 0, data: { kline_list: [bar('2026-11-24', 10)] }, pagination: { has_more: false } } };
  };
  await Promise.all([fetchFutuKlines('0.300085', 101, { start: '2026-11-01', end: '2026-11-24' }), fetchFutuKlines('1.600519', 101, { start: '2026-11-01', end: '2026-11-24' })]);
  assert.equal(refreshes, 1);
  let attempts = 0;
  axios.get = async () => {
    if (attempts++ === 0) throw new axios.AxiosError('expired', 'ERR_BAD_REQUEST', undefined, undefined, { status: 401 });
    return { data: { ret_code: 0, data: { kline_list: [bar('2026-11-24', 10)] }, pagination: { has_more: false } } };
  };
  await fetchFutuKlines('0.300085', 101, { start: '2026-11-01', end: '2026-11-24' });
  assert.equal(refreshes, 2);
  assert.equal(attempts, 2);
  console.log('futu quote service tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { axios.get = originalGet; axios.post = originalPost; process.env = originalEnv; });
