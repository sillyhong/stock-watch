// Run only in an isolated checkout: the test performs real network requests.
const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const dayjs = require('dayjs');
const axios = require('axios');

if (process.env.FUTU_LIVE_TEST !== '1') {
  console.log('futu server live test skipped; set FUTU_LIVE_TEST=1 in an isolated checkout');
  process.exit(0);
}

const root = process.cwd();
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, parent, isMain, options);
};
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, file);

const { batchFetchStockData } = require('../pages/utils/dataFetcher.ts');
const config = require('../pages/utils/config.ts');
const { EReqType } = config;
const { lookupFutuMapping, readFutuMapping } = require('../services/futuMappingStore.ts');
const { startFutuMappingJob, getFutuMappingStatus } = require('../services/futuMappingService.ts');

async function run() {
  const mappingDir = path.join(root, 'src/pages/data/futu-mappings');
  assert.ok(!fs.existsSync(mappingDir), 'Use an isolated checkout with no existing mappings');
  const boards = [['A', ['1.600118', '1.601698', '1.603083', '0.301606']], ['HK', ['116.00700']], ['US', ['105.AAPL']]];
  for (const [scope, codes] of boards) {
    const dir = path.join(root, 'src/pages/data/stock-pools', scope);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'live-board.ts'), `export const stocks = ${JSON.stringify(codes)};\n`);
  }
  let searches = 0;
  const realGet = axios.get;
  axios.get = async (url, options) => { if (String(url).includes('/search-stock/predict')) searches++; return realGet(url, options); };
  async function fillBoard(scope, codes) {
    startFutuMappingJob('live-board', codes, scope);
    for (let i = 0; i < 500; i++) {
      const status = await getFutuMappingStatus('live-board', scope);
      if (status.status !== 'running') {
        console.log(JSON.stringify({ scope, mappingStatus: status.status, matched: status.matched, failed: status.failed }));
        assert.equal(status.status, 'complete', JSON.stringify(status.failureSamples));
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`mapping job timed out: ${scope}`);
  }
  for (const [scope, codes] of boards) await fillBoard(scope, codes);
  assert.equal(searches, 6, 'each new stock should be searched once');
  const webPath = require.resolve('../services/futuWebQuoteService.ts');
  const storePath = require.resolve('../services/futuMappingStore.ts');
  delete require.cache[webPath];
  delete require.cache[storePath];
  const freshWeb = require(webPath);
  await freshWeb.resolveFutuStockInfo('1.600118');
  assert.equal(searches, 6, 'a persisted mapping should survive a service restart without a new search');
  for (const [scope, codes] of boards) await fillBoard(scope, codes);
  assert.equal(searches, 6, 'updating unchanged boards must not repeat searches');
  config.createEastmoneyRequest = async () => { throw new Error('simulated Eastmoney failure'); };
  const end = dayjs().format('YYYY-MM-DD');
  const start = dayjs().subtract(60, 'day').format('YYYYMMDD');
  const tests = [
    ['1.600118', 101], ['1.601698', 101], ['1.603083', 101],
    ['0.301606', 101], ['116.00700', 101], ['105.AAPL', 101], ['0.301606', 5],
  ];
  const failures = [];
  for (const [secid, klt] of tests) {
    const result = await batchFetchStockData({ reqType: EReqType.EASY_MONEY, stockLists: [secid], stockType: 'LIVE_TEST', klt, startFormatDay: start, endFormatDay: end, batchDelayRange: { min: 0, max: 0 } });
    const data = result.results[0]?.response?.data?.data;
    const mapping = await lookupFutuMapping(secid);
    const scope = secid.startsWith('116.') ? 'HK' : secid.startsWith('105.') ? 'US' : 'A';
    const board = await readFutuMapping('live-board', scope);
    const boardMapping = board?.stocks?.[secid];
    const ok = result.successfulRequestCount === 1 && data?.code === secid.split('.')[1] && Number(data?.market) === Number(secid.split('.')[0]) && data?.klines?.length > 0;
    console.log(JSON.stringify({ secid, klt, ok, forcedEastmoneyFailure: true, stockId: mapping?.stockId, boardMappingSaved: !!boardMapping, bars: data?.klines?.length ?? 0, errors: result.requestFailures.map((item) => item.errorMessage) }));
    if (!ok || !boardMapping) failures.push(secid + ':' + klt);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.ok(!fs.existsSync(path.join(mappingDir, 'auto')), 'Automatic per-stock mapping files must not be created');
  assert.deepEqual(failures, [], 'Live fallback or mapping persistence failed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
