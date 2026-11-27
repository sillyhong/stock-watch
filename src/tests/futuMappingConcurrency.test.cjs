const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'futu-concurrent-'));
const worker = `
  const fs = require('fs'), path = require('path');
  const root = process.argv[1], temp = process.argv[2], n = Number(process.argv[3]);
  const ts = require(path.join(root, 'node_modules/typescript'));
  require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
  process.chdir(temp);
  const store = require(path.join(root, 'src/services/futuMappingStore.ts'));
  (async () => { for (let i = 0; i < 20; i++) {
    const code = String(n * 100 + i).padStart(6, '0');
    await store.upsertFutuMapping('board', 'A', '0.' + code, { name: code, stockCode: code, stockId: String(n * 100 + i + 1), marketType: 4, marketLabel: 'SZ' });
  } })().catch(e => { console.error(e); process.exitCode = 1; });
`;
function runWorker(n) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', worker, root, temp, String(n)], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', data => { error += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error)));
  });
}
async function run() {
  await Promise.all([0, 1, 2, 3].map(runWorker));
  const file = path.join(temp, 'src/pages/data/futu-mappings/A/board.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(Object.keys(data.stocks).length, 80, 'concurrent processes must not lose writes');
  assert.ok(!fs.existsSync(file + '.lock'));
  console.log('futu mapping cross-process concurrency test passed');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temp, { recursive: true, force: true }));
