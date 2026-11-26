const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-all-market-'));
const directory = path.join(temp, 'src/pages/data/astock');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'shangzheng.json'), JSON.stringify([{ f12: '600000', f14: '浦发银行' }, { f12: '600001', f14: '其他' }]));
fs.writeFileSync(path.join(directory, 'shenzheng.json'), JSON.stringify([{ f12: '000002', f14: '万科' }, { f12: '000003', f14: 'ST股票' }]));
fs.writeFileSync(path.join(directory, 'beijiaosuo.json'), JSON.stringify([{ f12: '872392', f14: '北交所一' }, { f12: '920060', f14: '北交所二' }]));
let selected = ['1.600000', '0.872392'];
let failDatabase = false;
const processed = [];
const file = path.join(root, 'src/pages/api/day-rsi-watch/a-all.api.ts');
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../../utils/fetchRSIAndSendEmail') return { fetchRSIDataWithDetails: async ({ stockLists }) => { processed.push(...stockLists); return { buyList: [], sellList: [] }; } };
  if (request === '../../interface') return { EStockType: { A: 'A' }, EKLT: { DAY: 101 } };
  if (request === '../../utils/config') return { EReqType: { EASY_MONEY: 'EASY_MONEY' } };
  if (request === '../../utils/emailNotifier') return { sendRSIEmailNotification: async () => {} };
  if (request === '@/services/stockPoolService') return { getTaskStocks: async (taskId, options) => { assert.equal(taskId, 'day-rsi-watch-a'); assert.equal(options.allowEmpty, true); if (failDatabase) throw new Error('数据库不可用'); return selected; } };
  return originalLoad.call(this, request, parent, isMain);
};
try { loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file); }
finally { Module._load = originalLoad; }

function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
async function run() {
  process.chdir(temp);
  const res = response();
  await loaded.exports.default({ method: 'GET', query: { sendEmail: 'false' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(processed.sort(), ['0.000002', '0.920060', '1.600001']);
  processed.length = 0;
  selected = [];
  const empty = response();
  await loaded.exports.default({ method: 'GET', query: { markets: 'beijing', sendEmail: 'false' } }, empty);
  assert.equal(empty.statusCode, 200);
  assert.deepEqual(processed.sort(), ['0.872392', '0.920060']);
  processed.length = 0;
  failDatabase = true;
  const failed = response();
  await loaded.exports.default({ method: 'GET', query: { sendEmail: 'false' } }, failed);
  assert.equal(failed.statusCode, 500);
  assert.equal(processed.length, 0);
  console.log('all-market stock pool tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { process.chdir(root); fs.rmSync(temp, { recursive: true, force: true }); });
