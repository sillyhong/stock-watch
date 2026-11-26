const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-futu-mapping-'));
const originalLoad = Module._load;
function compile(file, mocks = {}) {
  const source = path.join(root, file);
  const loaded = new Module(source, module);
  loaded.filename = source;
  loaded.paths = Module._nodeModulePaths(path.dirname(source));
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try { loaded._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, source); }
  finally { Module._load = originalLoad; }
  return loaded.exports;
}

async function run() {
  process.chdir(temp);
  const store = compile('src/services/futuMappingStore.ts');
  const info = { stockCode: '300085', stockId: '123', name: '测试', marketLabel: 'SZ', marketType: 4, marketCode: 35, instrumentType: 3, subInstrumentType: 3002 };
  const job = compile('src/services/futuMappingService.ts', {
    './futuMappingStore': store,
    './futuWebQuoteService': { resolveFutuStockInfo: async (code) => { if (code === '0.000002') throw new Error('不可用'); return info; } },
  });
  const started = job.startFutuMappingJob('testpool', ['0.300085', '0.000002']);
  assert.equal(started.status, 'running');
  let status;
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    status = await job.getFutuMappingStatus('testpool');
    if (status.status !== 'running') break;
  }
  assert.equal(status.status, 'partial');
  assert.equal(status.matched, 1);
  assert.equal(status.failed, 1);
  assert.equal(status.failureSamples[0].secid, '0.000002');
  const saved = await store.readFutuMapping('testpool');
  assert.equal(saved.stocks['0.300085'].stockId, '123');
  assert.equal((await store.lookupFutuMapping('0.300085')).stockId, '123');
  assert.equal(await store.lookupFutuMapping('0.000002'), undefined);
  assert.throws(() => job.startFutuMappingJob('../invalid', []), /文件名/);
  const racing = compile('src/services/futuMappingService.ts', {
    './futuMappingStore': store,
    './futuWebQuoteService': { resolveFutuStockInfo: async (code) => { if (code === '0.000001') await new Promise((resolve) => setTimeout(resolve, 500)); return { ...info, stockCode: code.split('.')[1] }; } },
  });
  racing.startFutuMappingJob('race', ['0.000001']);
  racing.startFutuMappingJob('race', ['0.300085']);
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.deepEqual(Object.keys((await store.readFutuMapping('race')).stocks), ['0.300085']);

  let starts = 0;
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ rc: 0, data: { total: 1, diff: [{ f12: '300085', f13: 0, f14: '银之杰' }] } }) });
  const api = compile('src/pages/api/eastmoney/board-stocks.api.ts', {
    '@/services/futuMappingService': { startFutuMappingJob: () => { starts++; throw new Error('模拟富途异常'); } },
  }).default;
  function response() { return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
  const preview = response();
  await api({ method: 'GET', query: { bkCode: 'BK0546', fileName: 'testboard', preview: 'true' } }, preview);
  assert.equal(preview.statusCode, 200);
  assert.equal(starts, 0);
  const res = response();
  await api({ method: 'GET', query: { bkCode: 'BK0546', fileName: 'testboard' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.futuMapping.status, 'failed');
  assert.ok(fs.readFileSync(path.join(temp, 'src/pages/data/astock/testboard.ts'), 'utf8').includes('0.300085'));
  assert.equal(starts, 1);
  global.fetch = async () => { const error = new TypeError('fetch failed'); error.cause = { code: 'ECONNRESET' }; throw error; };
  const fetchError = response();
  await api({ method: 'GET', query: { bkCode: 'BK0546', fileName: 'testboard' } }, fetchError);
  assert.equal(fetchError.statusCode, 502);
  assert.match(fetchError.body.error, /ECONNRESET/);
  assert.ok(fs.readFileSync(path.join(temp, 'src/pages/data/astock/testboard.ts'), 'utf8').includes('0.300085'));
  assert.equal(starts, 1);
  if (process.env.FUTU_MAPPING_LIVE_TEST === '1') {
    const web = compile('src/services/futuWebQuoteService.ts', { './futuMappingStore': store });
    const liveJob = compile('src/services/futuMappingService.ts', { './futuMappingStore': store, './futuWebQuoteService': web });
    liveJob.startFutuMappingJob('livetest', ['0.301589', '0.300085']);
    let live;
    for (let i = 0; i < 100; i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      live = await liveJob.getFutuMappingStatus('livetest');
      if (live.status !== 'running') break;
    }
    assert.equal(live.status, 'complete');
    const liveMapping = await store.readFutuMapping('livetest');
    assert.equal(liveMapping.stocks['0.301589'].stockCode, '301589');
    assert.equal(liveMapping.stocks['0.300085'].stockCode, '300085');
    console.log(`futu live mapping: ${live.matched}/${live.total}`);
  }
  console.log('futu mapping tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { process.chdir(root); fs.rmSync(temp, { recursive: true, force: true }); });
