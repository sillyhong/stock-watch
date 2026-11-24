const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const host = process.env.DEPLOY_HOST || '43.156.33.21';
const user = process.env.DEPLOY_USER || 'root';
const keyPath = process.env.DEPLOY_KEY_PATH || path.join(os.homedir(), 'ssh', 'mac.pem');
const remoteRoot = process.env.DEPLOY_REMOTE_DIR || '/root/project/stock-watch';
const localConfig = path.join(projectRoot, 'config', '.env.production.local');
const healthUrl = 'http://127.0.0.1:3008/stock/';

function quote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function runLocal(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr ? `: ${result.stderr.trim()}` : '';
    throw new Error(`${command} failed (exit ${result.status})${detail}`);
  }
  return result.stdout ? result.stdout.trim() : '';
}

function validate() {
  if (!/^[A-Za-z0-9][A-Za-z0-9.:-]*$/.test(host) || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(user)) {
    throw new Error('Invalid DEPLOY_HOST or DEPLOY_USER.');
  }
  if (!path.posix.isAbsolute(remoteRoot) || remoteRoot === '/' || remoteRoot.split('/').includes('..')) {
    throw new Error('DEPLOY_REMOTE_DIR must be an absolute directory without .. segments.');
  }
  if (!fs.existsSync(keyPath)) throw new Error(`SSH private key not found: ${keyPath}`);
  const dirty = runLocal('git', ['status', '--porcelain', '--untracked-files=no']);
  if (dirty) console.warn('Warning: local uncommitted changes are not included in the deployment.');
  const branch = runLocal('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const commit = runLocal('git', ['rev-parse', 'HEAD']);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..') || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Invalid local branch or commit.');
  }
  const untracked = runLocal('git', ['ls-files', '--others', '--exclude-standard']);
  if (untracked) console.warn('Warning: untracked files are not included in the deployment.');
  return { branch, commit };
}

function main() {
  const { branch, commit } = validate();
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-watch-deploy-'));
  const temporaryKey = path.join(temporaryDir, 'key');

  try {
    // OpenSSH rejects keys with loose permissions; avoid changing the original file.
    fs.copyFileSync(keyPath, temporaryKey);
    fs.chmodSync(temporaryKey, 0o600);
    const sshOptions = [
      '-i', temporaryKey, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', `${user}@${host}`,
    ];
    const remote = (command, options = {}) => runLocal('ssh', [...sshOptions, command], options);
    const directory = quote(remoteRoot);
    const remoteConfig = quote(path.posix.join(remoteRoot, 'config', '.env.production.local'));

    console.log(`Checking ${user}@${host}:${remoteRoot} (${branch}, ${commit.slice(0, 12)})`);
    const check = `set -eu; cd ${directory}; ` +
      `test "$(git symbolic-ref --quiet --short HEAD)" = ${quote(branch)} || { echo 'Server branch differs from local branch' >&2; exit 1; }; ` +
      `test -z "$(git status --porcelain --untracked-files=no)" || { echo 'Server has tracked changes' >&2; exit 1; }; ` +
      `set -- $(git ls-remote --exit-code origin ${quote(`refs/heads/${branch}`)}); ` +
      `test "$1" = ${quote(commit)} || { echo 'Push the local commit before deploying' >&2; exit 1; }; ` +
      `pm2 jlist | node -e ${quote(`let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='stock-watch');if(!p||p.pm2_env.pm_cwd!==${JSON.stringify(remoteRoot)}){console.error('PM2 stock-watch process or working directory mismatch');process.exit(1)}})`)}; ` +
      `if [ -e ${remoteConfig} ]; then test -s ${remoteConfig} || { echo 'Production config is empty' >&2; exit 1; }; echo config-present; else echo config-missing; fi`;
    const preflight = remote(check);

    if (preflight.endsWith('config-missing')) {
      if (!fs.existsSync(localConfig) || !fs.statSync(localConfig).size) {
        throw new Error('Production config is missing on both server and local machine.');
      }
      console.log('Installing the missing production configuration with restricted permissions.');
      const configDir = quote(path.posix.join(remoteRoot, 'config'));
      const configInstall = `set -eu; umask 077; mkdir -p ${configDir}; ` +
        `tmp=$(mktemp ${quote(path.posix.join(remoteRoot, 'config', '.env.production.local.XXXXXX'))}); ` +
        `trap 'rm -f "$tmp"' EXIT; cat > "$tmp"; test -s "$tmp"; chmod 600 "$tmp"; ` +
        `ln "$tmp" ${remoteConfig}`;
      remote(configInstall, { input: fs.readFileSync(localConfig), stdio: ['pipe', 'inherit', 'inherit'] });
    }

    console.log('Pulling the verified revision, installing dependencies and building.');
    const deploy = `set -eu; cd ${directory}; git pull --ff-only; ` +
      `test "$(git rev-parse HEAD)" = ${quote(commit)} || { echo 'Deployed revision mismatch' >&2; exit 1; }; ` +
      'npm ci --include=dev; ' +
      'backup=$(mktemp -d .deploy-next.XXXXXX); restart_attempted=0; ' +
      'if [ -d .next ]; then mv .next "$backup/previous"; fi; ' +
      'restore() { if [ -d "$backup/previous" ]; then ' +
        'if [ -e .next ]; then mv .next "$backup/incomplete"; fi; ' +
        'mv "$backup/previous" .next; echo "Previous build restored" >&2; ' +
        'if [ "$restart_attempted" -eq 1 ]; then pm2 restart stock-watch || true; fi; fi; }; ' +
      'trap restore EXIT; npm run build; ' +
      'test -s .next/BUILD_ID || { echo "Build did not produce .next/BUILD_ID" >&2; exit 1; }; ' +
      'restart_attempted=1; pm2 restart stock-watch; ' +
      `n=0; until curl -fsSL --max-time 5 -o /dev/null ${quote(healthUrl)}; do ` +
        'n=$((n + 1)); if [ "$n" -ge 10 ]; then echo "Health check failed" >&2; exit 1; fi; sleep 3; done; ' +
      'trap - EXIT; rm -rf -- "$backup"';
    remote(deploy, { stdio: 'inherit' });
    console.log(`Deployment completed: ${commit.slice(0, 12)}`);
  } finally {
    if (fs.existsSync(temporaryKey)) fs.unlinkSync(temporaryKey);
    fs.rmdirSync(temporaryDir);
  }
}

try {
  main();
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exitCode = 1;
}
