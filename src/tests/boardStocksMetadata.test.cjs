const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'board-metadata-'));
const file = path.join(root, 'src/pages/api/eastmoney/board-stocks.api.ts');
const compiled = new Module(file, module);
compiled.filename = file;
compiled.paths = Module._nodeModulePaths(path.dirname(file));
const load = Module._load;
Module._load = function(request, parent, main) {
  if (request === '@/services/futuMappingService') return { startFutuMappingJob: () => null };
  return load.call(this, request, parent, main);
};
try { compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file); }
finally { Module._load = load; }

function response() { return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
async function run() {
  process.chdir(temp);
  let failBoardName = false;
  let failStocks = false;
  global.fetch = async (url) => {
    if (String(url).includes('/bk/90.')) {
      if (failBoardName) throw new Error('network error');
      return { ok: true, text: async () => '<title>CPO概念(BK1128)_行情中心_东方财富网</title>' };
    }
    if (failStocks) throw new Error('network error');
    return { ok: true, text: async () => JSON.stringify({ rc: 0, data: { total: 1, diff: [{ f12: '300308', f13: 0, f14: '中际旭创' }] } }) };
  };
  const handler = compiled.exports.default;
  const request = { method: 'GET', query: { bkCode: 'BK1128', fileName: 'cpo' } };
  const first = response();
  await handler(request, first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.boardName, 'CPO概念');
  const output = path.join(temp, 'src/pages/data/astock/cpo.ts');
  const original = fs.readFileSync(output, 'utf8');
  assert.match(original, /eastmoneyBoardCode = "BK1128"/);
  assert.match(original, /eastmoneyBoardName = "CPO概念"/);
  assert.match(original, /0\.300308/);
  failBoardName = true;
  const second = response();
  await handler(request, second);
  assert.equal(second.body.boardName, 'CPO概念');
  assert.equal(fs.readFileSync(output, 'utf8'), original);
  failStocks = true;
  const failed = response();
  await handler(request, failed);
  assert.equal(failed.statusCode, 502);
  assert.equal(fs.readFileSync(output, 'utf8'), original);
  const reserved = response();
  await handler({ method: 'GET', query: { bkCode: 'BK1128', exportName: 'eastmoneyBoardCode' } }, reserved);
  assert.equal(reserved.statusCode, 400);
  console.log('board metadata tests passed');
}
run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => { process.chdir(root); fs.rmSync(temp, { recursive: true, force: true }); });
