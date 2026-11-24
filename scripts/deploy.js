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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr ? `: ${result.stderr.trim()}` : '';
    const error = new Error(`${command} failed (exit ${result.status})${detail}`);
    error.exitStatus = result.status;
    throw error;
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
  if (run('git', ['status', '--porcelain', '--untracked-files=no'])) {
    console.warn('Warning: local uncommitted changes are not included in the build.');
  }
  if (run('git', ['ls-files', '--others', '--exclude-standard'])) {
    console.warn('Warning: untracked files are not included in the build.');
  }
  const branch = run('git', ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const commit = run('git', ['rev-parse', 'HEAD']);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) || branch.includes('..') || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Invalid local branch or commit.');
  }
  return { branch, commit };
}

function findNode(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid server Node.js version.');
  const candidates = [
    process.env.DEPLOY_NODE_PATH,
    process.versions.node === version ? process.execPath : null,
    path.join(os.homedir(), '.nvm', 'versions', 'node', `v${version}`, 'bin', 'node'),
  ].filter(Boolean);
  const node = candidates.find(candidate => fs.existsSync(candidate) && run(candidate, ['--version']) === `v${version}`);
  if (!node) throw new Error(`Install Node.js ${version} locally or set DEPLOY_NODE_PATH to its executable.`);
  const npm = path.join(path.dirname(node), 'npm');
  if (!fs.existsSync(npm)) throw new Error(`npm is missing next to ${node}.`);
  return { node, npm };
}

function main() {
  const { branch, commit } = validate();
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-watch-deploy-'));
  const temporaryKey = path.join(temporaryDir, 'key');
  const sourceDir = path.join(temporaryDir, 'source');
  const sourceArchive = path.join(temporaryDir, 'source.tar');
  const releaseArchive = path.join(temporaryDir, 'release.tar.gz');
  let stageCreated = false;
  let lockAcquired = false;
  let completed = false;
  let remoteUncertain = false;
  let remote;
  const stage = path.posix.join(remoteRoot, `.deploy-stage-${Date.now()}-${process.pid}`);
  const directory = quote(remoteRoot);
  const qStage = quote(stage);
  const qLock = quote(path.posix.join(remoteRoot, '.deploy-lock'));
  const remoteConfig = quote(path.posix.join(remoteRoot, 'config', '.env.production.local'));

  try {
    fs.copyFileSync(keyPath, temporaryKey);
    fs.chmodSync(temporaryKey, 0o600);
    const sshOptions = [
      '-i', temporaryKey, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', `${user}@${host}`,
    ];
    remote = (command, options = {}) => {
      try {
        return run('ssh', [...sshOptions, command], options);
      } catch (error) {
        if (error.exitStatus === 255 || error.code) remoteUncertain = true;
        throw error;
      }
    };

    console.log(`Checking ${user}@${host}:${remoteRoot} (${branch}, ${commit.slice(0, 12)})`);
    const check = `set -eu; cd ${directory}; ` +
      `test "$(git symbolic-ref --quiet --short HEAD)" = ${quote(branch)} || { echo 'Server branch differs from local branch' >&2; exit 1; }; ` +
      `test -z "$(git status --porcelain --untracked-files=no)" || { echo 'Server has tracked changes' >&2; exit 1; }; ` +
      `set -- $(git ls-remote --exit-code origin ${quote(`refs/heads/${branch}`)}); ` +
      `test "$1" = ${quote(commit)} || { echo 'Push the local commit before deploying' >&2; exit 1; }; ` +
      `pm2 jlist | node -e ${quote(`let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{const p=JSON.parse(s).find(x=>x.name==='stock-watch');if(!p||p.pm2_env.pm_cwd!==${JSON.stringify(remoteRoot)}){console.error('PM2 stock-watch process or working directory mismatch');process.exit(1)}})`)}; ` +
      'node -p "process.versions.node"; ' +
      `if [ -e ${remoteConfig} ]; then test -s ${remoteConfig} || { echo 'Production config is empty' >&2; exit 1; }; echo config-present; else echo config-missing; fi`;
    const preflight = remote(check).split(/\r?\n/);
    const configStatus = preflight.pop();
    const version = preflight.pop();
    if (!['config-present', 'config-missing'].includes(configStatus)) throw new Error('Unexpected server preflight response.');
    const { node, npm } = findNode(version);

    console.log(`Building commit ${commit.slice(0, 12)} locally with Node.js ${version}.`);
    fs.mkdirSync(sourceDir);
    run('git', ['archive', '--format=tar', `--output=${sourceArchive}`, commit]);
    run('tar', ['-xf', sourceArchive, '-C', sourceDir]);
    const buildEnv = {
      ...process.env,
      PATH: `${path.dirname(node)}${path.delimiter}${process.env.PATH || ''}`,
      NODE_ENV: 'production',
      ENABLE_PRODUCTION_SCHEDULERS: 'false',
      NEXT_TELEMETRY_DISABLED: '1',
    };
    run(npm, ['ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: sourceDir, env: buildEnv, stdio: 'inherit' });
    run(npm, ['run', 'build'], { cwd: sourceDir, env: buildEnv, stdio: 'inherit' });
    if (!fs.existsSync(path.join(sourceDir, '.next', 'BUILD_ID')) || !fs.statSync(path.join(sourceDir, '.next', 'BUILD_ID')).size) {
      throw new Error('Local build did not produce .next/BUILD_ID.');
    }
    run('tar', ['--no-xattrs', '-czf', releaseArchive, '--exclude=.next/cache', '--exclude=._*', '.next', 'package.json', 'package-lock.json'], {
      cwd: sourceDir,
      env: { ...process.env, COPYFILE_DISABLE: '1' },
    });

    if (configStatus === 'config-missing') {
      if (!fs.existsSync(localConfig) || !fs.statSync(localConfig).size) throw new Error('Production config is missing on both server and local machine.');
      console.log('Installing the missing production configuration with restricted permissions.');
      const configDir = quote(path.posix.join(remoteRoot, 'config'));
      remote(`set -eu; umask 077; mkdir -p ${configDir}; ` +
        `tmp=$(mktemp ${quote(path.posix.join(remoteRoot, 'config', '.env.production.local.XXXXXX'))}); ` +
        `trap 'rm -f "$tmp"' EXIT; cat > "$tmp"; test -s "$tmp"; chmod 600 "$tmp"; ln "$tmp" ${remoteConfig}`,
      { input: fs.readFileSync(localConfig), stdio: ['pipe', 'inherit', 'inherit'] });
    }

    console.log('Uploading and preparing the build on the server.');
    remote(`set -eu; mkdir ${qLock} || { echo 'Another deployment is running or the deployment lock needs inspection' >&2; exit 1; }; ` +
      `mkdir ${qStage} || { rmdir ${qLock}; exit 1; }`);
    lockAcquired = true;
    stageCreated = true;
    const archiveFd = fs.openSync(releaseArchive, 'r');
    try {
      remote(`set -eu; umask 077; cat > ${qStage}/release.tar.gz`, { stdio: [archiveFd, 'inherit', 'inherit'] });
    } finally {
      fs.closeSync(archiveFd);
    }
    const prepare = `set -eu; cd ${directory}; tar -xzf ${qStage}/release.tar.gz -C ${qStage}; ` +
      `test -s ${qStage}/.next/BUILD_ID; test -s ${qStage}/package-lock.json; ` +
      `old_lock=$(git show HEAD:package-lock.json | sha256sum | cut -d' ' -f1); ` +
      `new_lock=$(sha256sum ${qStage}/package-lock.json | cut -d' ' -f1); ` +
      `if [ "$old_lock" != "$new_lock" ] || [ ! -x node_modules/.bin/next ]; then ` +
        `available=$(df -Pk . | awk 'END {print $4}'); ` +
        `test "$available" -ge 1048576 || { echo 'At least 1 GiB free is required to prepare new dependencies' >&2; exit 1; }; ` +
        `npm ci --prefix ${qStage} --include=dev --no-audit --no-fund; ` +
      `fi`;
    remote(prepare, { stdio: 'inherit' });

    console.log('Switching release and checking application health.');
    const deploy = `set -eu; cd ${directory}; old_commit=$(git rev-parse HEAD); ` +
      `test -z "$(git status --porcelain --untracked-files=no)" || { echo 'Server has tracked changes' >&2; exit 1; }; ` +
      `had_next=0; had_modules=0; switched_next=0; switched_modules=0; pulled=0; restart_attempted=0; ` +
      `restore() { status=$?; trap - EXIT; set +e; if [ "$status" -ne 0 ]; then ` +
        `if [ "$switched_next" -eq 1 ] && [ -e .next ]; then mv .next ${qStage}/failed-next; fi; ` +
        `if [ "$had_next" -eq 1 ] && [ -d ${qStage}/previous-next ]; then mv ${qStage}/previous-next .next; fi; ` +
        `if [ "$switched_modules" -eq 1 ] && [ -e node_modules ]; then mv node_modules ${qStage}/failed-modules; fi; ` +
        `if [ "$had_modules" -eq 1 ] && [ -d ${qStage}/previous-modules ]; then mv ${qStage}/previous-modules node_modules; fi; ` +
        `if [ "$pulled" -eq 1 ]; then git reset --hard "$old_commit" || echo 'Code rollback failed' >&2; fi; ` +
        `if [ "$restart_attempted" -eq 1 ]; then pm2 restart stock-watch || echo 'PM2 rollback restart failed' >&2; fi; ` +
        `echo 'Deployment failed; previous release restored where possible' >&2; fi; exit "$status"; }; ` +
      `trap restore EXIT; git pull --ff-only; pulled=1; ` +
      `test "$(git rev-parse HEAD)" = ${quote(commit)} || { echo 'Deployed revision mismatch' >&2; exit 1; }; ` +
      `if [ -d ${qStage}/node_modules ]; then if [ -d node_modules ]; then mv node_modules ${qStage}/previous-modules; had_modules=1; fi; ` +
        `mv ${qStage}/node_modules node_modules; switched_modules=1; fi; ` +
      `if [ -d .next ]; then mv .next ${qStage}/previous-next; had_next=1; fi; ` +
      `mv ${qStage}/.next .next; switched_next=1; test -s .next/BUILD_ID; ` +
      `restart_attempted=1; pm2 restart stock-watch; ` +
      `n=0; until curl -fsSL --max-time 5 -o /dev/null ${quote(healthUrl)}; do ` +
        `n=$((n + 1)); if [ "$n" -ge 10 ]; then echo 'Health check failed' >&2; exit 1; fi; sleep 3; done; ` +
      `trap - EXIT`;
    remote(deploy, { stdio: 'inherit' });
    completed = true;
    console.log(`Deployment completed: ${commit.slice(0, 12)}`);
  } finally {
    if (stageCreated && remote) {
      try {
        // Keep failed release and backups for diagnosis; remove the stage only after success.
        if (completed) remote(`rm -rf -- ${qStage}`);
        else console.warn(`Server staging directory retained: ${stage}`);
      } catch (error) {
        console.warn(`Could not remove server staging directory ${stage}: ${error.message}`);
      }
    }
    if (lockAcquired && remote && !remoteUncertain) {
      try {
        remote(`rmdir ${qLock}`);
      } catch (error) {
        console.warn(`Could not release deployment lock: ${error.message}`);
      }
    } else if (lockAcquired && remoteUncertain) {
      console.warn('SSH connection was interrupted; the deployment lock was retained for inspection.');
    }
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exitCode = 1;
}
