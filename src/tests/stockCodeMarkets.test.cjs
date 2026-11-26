const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const roots = ['src/pages/data/astock', 'src/pages/data/stock-pools'];
const files = [];
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.(ts|json)$/.test(entry.name)) files.push(file);
  }
}
roots.forEach(scan);
files.push('src/pages/utils/stockList.ts');

const failures = [];
let checked = 0;
function check(code, location) {
  if (!/^[01]\.\d{6}$/.test(code)) return;
  checked++;
  const [market, stock] = code.split('.');
  // Shanghai B shares start with 9; the Shanghai Composite index is 1.000001.
  if ((market === '0' && /^[56]/.test(stock)) ||
      (market === '1' && /^[0348]/.test(stock) && code !== '1.000001')) failures.push(`${location}: ${code}`);
}
for (const file of files) {
  const input = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    for (const item of JSON.parse(input)) if (typeof item.f12 === 'string' && (item.f13 === 0 || item.f13 === 1)) check(`${item.f13}.${item.f12}`, file);
    continue;
  }
  const source = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true);
  function walk(node) {
    if (ts.isStringLiteral(node)) check(node.text, `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
    ts.forEachChild(node, walk);
  }
  walk(source);
}
assert.ok(checked > 100, 'No stock codes scanned');
assert.deepEqual(failures, [], 'Possible stock market prefix mismatch');
console.log(`stock market prefix tests passed (${checked} entries)`);
