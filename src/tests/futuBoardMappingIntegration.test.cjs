const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const axios = require('axios');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'futu-board-mapping-'));
const originalLoad = Module._load;
const originalGet = axios.get;
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
async function waitForJob(job, name, scope) {
  for (let i = 0; i < 100; i++) {
    const status = await job.getFutuMappingStatus(name, scope);
    if (status.status !== 'running') return status;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('mapping job timed out');
}
async function run() {
  process.chdir(temp);
  const aDir = path.join(temp, 'src/pages/data/astock');
  const hkDir = path.join(temp, 'src/pages/data/stock-pools/HK');
  fs.mkdirSync(aDir, { recursive: true });
  fs.mkdirSync(hkDir, { recursive: true });
  const aFile = path.join(aDir, 'cpo.ts');
  fs.writeFileSync(aFile, 'export const stocks = ["1.600118", "0.301606"];\n');
  fs.writeFileSync(path.join(hkDir, 'cpo.ts'), 'export const stocks = ["116.00700"];\n');
  const locator = compile('src/services/futuStockPoolLocator.ts');
  const store = compile('src/services/futuMappingStore.ts', { './futuStockPoolLocator': locator });
  const oldInfo = { stockCode: '600118', stockId: '43426415929974', name: '中国卫星', marketLabel: 'SH', marketType: 4 };
  await store.writeFutuMapping({ version: 1, fileName: 'cpo', updatedAt: '2020-01-01T00:00:00Z', stocks: { '1.600118': oldInfo }, failures: [] }, () => true);
  const web = compile('src/services/futuWebQuoteService.ts', { './futuMappingStore': store });
  const job = compile('src/services/futuMappingService.ts', { './futuMappingStore': store, './futuWebQuoteService': web, './futuStockPoolLocator': locator });
  const partial = await job.getFutuMappingStatus('cpo');
  assert.equal(partial.status, 'partial');
  assert.equal(partial.matched, 1);
  assert.equal(partial.pending, 1);
  const searches = [];
  axios.get = async (url, options) => {
    if (url.includes('/search-stock/predict')) {
      const code = options.params.keyword;
      searches.push(code);
      if (code === '300085') throw new Error('search unavailable');
      return { data: { code: 0, data: { quote: [{ stockSymbol: code, stockName: '绿联科技', stockId: '85499916263078', market: 'sz', marketType: 4 }] } } };
    }
    throw new Error('page unavailable');
  };
  job.startFutuMappingJob('cpo', ['1.600118', '0.301606']);
  const first = await waitForJob(job, 'cpo', 'astock');
  assert.equal(first.status, 'complete');
  assert.deepEqual(searches, ['301606'], 'existing IDs must not be queried again');
  assert.deepEqual(Object.keys((await store.readFutuMapping('cpo')).stocks).sort(), ['0.301606', '1.600118']);
  assert.ok(fs.existsSync(path.join(temp, 'src/pages/data/futu-mappings/astock/cpo.json')));
  assert.ok(!fs.existsSync(path.join(temp, 'src/pages/data/futu-mappings/auto')));
  const hkInfo = { stockCode: '00700', stockId: '54047868453564', name: '腾讯控股', marketLabel: 'HK', marketType: 1 };
  await store.saveFutuMappingForSources('116.00700', hkInfo);
  assert.equal((await store.readFutuMapping('cpo', 'HK')).stocks['116.00700'].stockId, hkInfo.stockId);
  assert.equal((await store.readFutuMapping('cpo', 'astock')).stocks['116.00700'], undefined, 'same-named boards must stay market-scoped');
  await assert.rejects(store.upsertFutuMapping('cpo', 'HK', '116.00700', { ...hkInfo, stockId: '999999' }), /不同的富途 ID/);
  assert.equal((await store.readFutuMapping('cpo', 'HK')).stocks['116.00700'].stockId, hkInfo.stockId, 'conflicting IDs must not overwrite existing data');
  fs.writeFileSync(aFile, 'export const stocks = ["0.301606", "0.300085"];\n');
  locator.invalidateFutuStockPoolIndex();
  job.startFutuMappingJob('cpo', ['0.301606', '0.300085']);
  const second = await waitForJob(job, 'cpo', 'astock');
  assert.equal(second.status, 'partial');
  const mapping = await store.readFutuMapping('cpo');
  assert.deepEqual(Object.keys(mapping.stocks), ['0.301606']);
  assert.equal(mapping.archivedStocks['1.600118'].stockId, oldInfo.stockId);
  assert.equal(mapping.failures[0].secid, '0.300085');
  assert.equal((await store.lookupFutuMapping('1.600118')).stockId, oldInfo.stockId);
  assert.deepEqual(searches, ['301606', '300085']);
  const legacyInfo = { stockCode: '300999', stockId: '123456', name: '旧映射', marketLabel: 'SZ', marketType: 4 };
  const legacyName = `auto_${Buffer.from('0.300999').toString('hex')}`;
  const legacyDir = path.join(temp, 'src/pages/data/futu-mappings/auto');
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, `${legacyName}.json`), JSON.stringify({ version: 1, fileName: legacyName, updatedAt: '2020-01-01T00:00:00Z', stocks: { '0.300999': legacyInfo }, failures: [] }));
  fs.writeFileSync(path.join(aDir, 'newboard.ts'), 'export const stocks = ["0.300999"];\n');
  locator.invalidateFutuStockPoolIndex();
  await store.writeFutuMapping({ version: 1, fileName: 'cache-reset', updatedAt: '2020-01-01T00:00:00Z', stocks: {}, failures: [] }, () => true);
  assert.equal((await web.resolveFutuStockInfo('0.300999')).stockId, legacyInfo.stockId);
  assert.equal((await store.readFutuMapping('newboard')).stocks['0.300999'].stockId, legacyInfo.stockId);
  assert.ok(fs.existsSync(path.join(legacyDir, `${legacyName}.json`)), 'old mapping must not be deleted');
  assert.deepEqual(searches, ['301606', '300085'], 'old mappings should be migrated without another search');
  await store.writeFutuMapping({ version: 1, fileName: 'conflict', updatedAt: '2026-11-27T00:00:00Z', stocks: { '116.00700': { ...hkInfo, stockId: '999999' } }, failures: [] }, () => true, 'HK');
  await assert.rejects(store.lookupFutuMapping('116.00700'), /不同的富途 ID/);
  await assert.rejects(web.resolveFutuStockInfo('116.00700'), /不同的富途 ID/);
  assert.deepEqual(searches, ['301606', '300085'], 'conflicting IDs should not trigger an automatic overwrite');
  console.log('futu board mapping integration tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { axios.get = originalGet; process.chdir(root); fs.rmSync(temp, { recursive: true, force: true }); });
