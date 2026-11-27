#!/usr/bin/env node
/* Run from the application root with the same Node version as the server. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const axios = require('axios');

require.extensions['.ts'] = (module, file) => {
  const source = fs.readFileSync(file, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, file);
};
const root = process.cwd();
const locator = require(path.join(root, 'src/services/futuStockPoolLocator.ts'));
const store = require(path.join(root, 'src/services/futuMappingStore.ts'));
const web = require(path.join(root, 'src/services/futuWebQuoteService.ts'));
const delay = Number(process.env.FUTU_MAPPING_INTERVAL_MS || 3000);
if (!Number.isSafeInteger(delay) || delay < 2000) throw new Error('FUTU_MAPPING_INTERVAL_MS must be at least 2000');
let stopped = false;
let restricted = false;
let requests = 0;
let nextRequest = 0;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopped = true; });
const get = axios.get.bind(axios);
axios.get = async (...args) => {
  const wait = nextRequest - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  if (stopped) throw new Error('batch stopped');
  nextRequest = Date.now() + delay;
  requests++;
  try { return await get(...args); }
  catch (error) {
    if ([401, 403, 429].includes(error?.response?.status)) restricted = true;
    throw error;
  }
};

async function run() {
  const lock = path.join(root, 'src/pages/data/futu-mappings/.bulk.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try { fs.mkdirSync(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`another mapping batch may be running; inspect ${lock}`);
    throw error;
  }
  try {
  fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const sources = await locator.listAllFutuSourceStocks();
  const summary = { total: sources.size, processed: 0, reused: 0, fetched: 0, failed: 0, requests: 0, stopped: false };
  let consecutiveNetworkFailures = 0;
  console.log(JSON.stringify({ event: 'started', total: summary.total, intervalMs: delay }));
  for (const [secid, boards] of sources) {
    if (stopped || restricted) break;
    const before = requests;
    try {
      const info = await web.resolveFutuStockInfo(secid);
      for (const board of boards) await store.upsertFutuMapping(board.fileName, board.scope, secid, info);
      if (requests === before) summary.reused++; else summary.fetched++;
      consecutiveNetworkFailures = 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await store.recordFutuMappingFailureForSources(secid, message);
      summary.failed++;
      console.error(JSON.stringify({ event: 'stock_failed', secid, message }));
      if (/请求失败|ECONN|ETIMEDOUT|socket hang up|熔断/i.test(message)) consecutiveNetworkFailures++;
      else consecutiveNetworkFailures = 0;
    }
    summary.processed++;
    if (summary.processed % 25 === 0) console.log(JSON.stringify({ event: 'progress', ...summary, requests }));
    if (consecutiveNetworkFailures >= 5) { stopped = true; console.error(JSON.stringify({ event: 'stopped_after_network_failures', count: consecutiveNetworkFailures })); }
  }
  summary.requests = requests;
  summary.stopped = stopped || restricted;
  console.log(JSON.stringify({ event: 'finished', ...summary, restricted }));
  if (summary.stopped || summary.failed) process.exitCode = 1;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}
run().catch(error => { console.error(JSON.stringify({ event: 'fatal', message: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
