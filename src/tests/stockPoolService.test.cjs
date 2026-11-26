const assert = require('assert').strict;
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

const rows = new Map();
const mappingCalls = [];
const database = {
  async query(sql, options = {}) {
    const values = options.replacements || {};
    if (sql.startsWith('CREATE')) return [];
    if (sql.startsWith('SHOW')) return [{ Field: 'market' }];
    if (sql.startsWith('INSERT')) {
      if (!rows.has(values.taskId)) rows.set(values.taskId, { task_id: values.taskId, market: values.market, sources: values.sources, version: 1 });
      return [];
    }
    if (sql.startsWith('SELECT')) return rows.has(values.taskId) ? [{ ...rows.get(values.taskId) }] : [];
    if (sql.startsWith('UPDATE')) {
      const row = rows.get(values.taskId);
      if (!row || row.version !== values.version) return [null, { affectedRows: 0 }];
      row.sources = values.sources;
      if (values.market) row.market = values.market;
      row.version++;
      return [null, { affectedRows: 1 }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  },
};

const tasks = [
  { id: 'rsi-watch-5m-a', market: 'A', feature: 'RSI', interval: '5M' },
  { id: 'rsi-watch-15m-a', market: 'A', feature: 'RSI', interval: '15M' },
  { id: 'day-rsi-watch-hk', market: 'HK', feature: 'RSI', interval: 'DAY' },
  { id: 'day-rsi-watch-us', market: 'US', feature: 'RSI', interval: 'DAY' },
  { id: 'main-trend-day-a', market: 'A', feature: 'MAIN_TREND', interval: 'DAY' },
];
const file = path.resolve('src/services/stockPoolService.ts');
const originalLoad = Module._load;
const moduleInstance = new Module(file, module);
moduleInstance.filename = file;
moduleInstance.paths = Module._nodeModulePaths(path.dirname(file));
Module._load = function(request, parent, isMain) {
  if (request === '@/services/lib/database') return { __esModule: true, default: database };
  if (request === '@/config/apiCatalog') return { apiCatalog: tasks };
  if (request === '@/services/futuMappingService') return { getFutuMappingStatus: async () => null, startFutuMappingJob: (fileName, codes) => { mappingCalls.push({ fileName, codes }); return { status: 'running' }; } };
  return originalLoad.call(this, request, parent, isMain);
};
try {
  moduleInstance._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
} finally { Module._load = originalLoad; }

async function run() {
  const service = moduleInstance.exports;
  function stockFile(fileName) {
    const input = fs.readFileSync(fileName, 'utf8');
    const parsed = ts.createSourceFile(fileName, input, ts.ScriptTarget.Latest, true);
    for (const statement of parsed.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(parsed) === 'stocks') return declaration.initializer.elements.map((element) => element.text);
    }
    throw new Error('Missing stocks');
  }
  const sources = await service.listStockSources();
  assert.ok(sources.some((source) => source.id === 'board:cpo'));
  assert.ok(sources.some((source) => source.id === 'board:cpo' && source.boardCode === 'BK1128' && source.boardName === 'CPO概念'));
  assert.ok(sources.some((source) => source.id === 'board:bandaoti' && source.boardCode === 'BK1036' && source.scope === 'candidate'));
  assert.ok(sources.some((source) => source.id === 'sector:A/zhengquan_bk0737' && source.boardName === '软件开发' && source.scope === 'partial'));
  assert.ok(!sources.some((source) => source.id === 'sector:A/zhengquan'));
  assert.ok(sources.some((source) => source.id === 'sector:HK/hulianwang'));
  assert.ok(!sources.some((source) => source.id.includes('@watchlist') || source.id.includes('astock.ts#AStockList')));
  rows.set('rsi-watch-5m-a', { task_id: 'rsi-watch-5m-a', market: null, sources: JSON.stringify(['astock.ts#AStockList']), version: 1 });
  rows.set('day-rsi-watch-hk', { task_id: 'day-rsi-watch-hk', market: null, sources: JSON.stringify(['@watchlist#HKStockList']), version: 1 });
  rows.set('day-rsi-watch-us', { task_id: 'day-rsi-watch-us', market: null, sources: JSON.stringify(['@watchlist#USStockList']), version: 1 });
  const initial = await service.getTaskPool('rsi-watch-5m-a');
  assert.equal(initial.market, 'A');
  assert.ok(initial.sources.length > 1);
  assert.ok(initial.sources.every((id) => id.startsWith('sector:A/')));
  assert.ok(initial.sources.includes('sector:A/zhengquan_bk0737'));
  assert.ok(initial.sources.includes('sector:A/hangtian_bk1232_invalid'));
  assert.ok(sources.some((source) => source.id === 'sector:A/hangtian_bk1232_invalid' && !source.warning));
  for (const [id, market] of [['day-rsi-watch-hk', 'HK'], ['day-rsi-watch-us', 'US']]) {
    const pool = await service.getTaskPool(id);
    assert.equal(pool.market, market);
    assert.ok(pool.sources.length > 1);
    assert.ok((await service.getTaskStocks(id)).length > 0);
  }
  const first = await service.getTaskStocks(initial.taskId);
  assert.ok(first.length > 0);
  for (const code of ['1.600118', '1.601698', '1.603083']) assert.ok(first.includes(code));
  for (const code of ['0.600118', '0.601698', '0.603083']) assert.ok(!first.includes(code));
  const previousA = [...new Set(fs.readdirSync('src/pages/data/stock-pools/A').filter((name) => !name.includes('_')).flatMap((name) => stockFile(`src/pages/data/stock-pools/A/${name}`)))];
  assert.deepEqual([...first].sort(), previousA.sort());
  rows.set('rsi-watch-15m-a', { task_id: 'rsi-watch-15m-a', market: 'A', sources: JSON.stringify(['sector:A/ai', 'sector:A/zhengquan']), version: 7 });
  const migrated = await service.getTaskPool('rsi-watch-15m-a');
  assert.equal(migrated.version, 8);
  assert.ok(migrated.sources.includes('sector:A/ai_bk0737'));
  assert.ok(migrated.sources.includes('sector:A/zhengquan_bk0737'));
  const expected = [...new Set([...stockFile('src/pages/data/stock-pools/A/ai.ts'), ...stockFile('src/pages/data/stock-pools/A/zhengquan.ts')])];
  assert.deepEqual([...(await service.getTaskStocks(migrated.taskId))].sort(), expected.sort());
  rows.set('main-trend-day-a', { task_id: 'main-trend-day-a', market: 'A', sources: JSON.stringify(['sector:A/hangtian_bk1232_invalid', 'sector:A/cpo_bk0448_invalid']), version: 4 });
  assert.deepEqual(await service.getTaskStocks('main-trend-day-a'), ['1.600118', '1.601698', '1.603083']);
  assert.equal((await service.getTaskPool('main-trend-day-a')).version, 4);
  const saved = await service.updateTaskPool(initial.taskId, ['board:cpo'], initial.version);
  assert.equal(saved.version, initial.version + 1);
  for (let i = 0; i < 20 && !mappingCalls.length; i++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(mappingCalls[0].fileName, 'cpo');
  assert.ok(mappingCalls[0].codes.length > 0);
  assert.notDeepEqual(await service.getTaskStocks(initial.taskId), first);
  assert.ok((await service.getTaskPool('rsi-watch-15m-a')).sources.includes('sector:A/ai_bk0737'));
  await assert.rejects(service.updateTaskPool(initial.taskId, ['board:cpo'], 1), /其他人修改/);
  await assert.rejects(service.updateTaskPool(initial.taskId, ['sector:HK/hulianwang'], saved.version), /不属于 A/);
  await service.updateTaskPool(initial.taskId, [], saved.version);
  await assert.rejects(service.getTaskStocks(initial.taskId), /尚未配置/);
  assert.deepEqual(await service.getTaskStocks(initial.taskId, { allowEmpty: true }), []);
  console.log('stock pool service tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
