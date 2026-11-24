const fs = require('fs');
const path = require('path');

const CONFIG_KEYS = new Set([
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_DATABASE',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
]);

function parseValue(raw, file, lineNumber) {
  const value = raw.trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0];
    let end = 1;
    let escaped = false;
    for (; end < value.length; end += 1) {
      if (value[end] === quote && !escaped) break;
      escaped = value[end] === '\\' && !escaped;
    }
    if (end === value.length || !/^(?:\s*(?:#.*)?)$/.test(value.slice(end + 1))) {
      throw new Error(`Invalid environment value in ${file} at line ${lineNumber}.`);
    }
    const content = value.slice(1, end);
    return quote === '"'
      ? content.replace(/\\([\\"$nrt])/g, (_, character) => ({ n: '\n', r: '\r', t: '\t' }[character] ?? character))
      : content;
  }
  return value.replace(/\s+#.*$/, '').trimEnd();
}

function loadPlatformEnvironment(projectRoot = process.cwd()) {
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const file = path.join(projectRoot, 'config', `.env.${environment}.local`);
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const [index, line] of content.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || !CONFIG_KEYS.has(match[1]) || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = parseValue(match[2], file, index + 1);
  }
}

module.exports = { loadPlatformEnvironment };
