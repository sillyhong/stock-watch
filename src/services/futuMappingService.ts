import { completeFutuMapping, existingFutuMappingPath, futuMappingPath, readFutuMapping, upsertFutuMapping } from './futuMappingStore';
import { resolveFutuStockInfo, type StockInfo } from './futuWebQuoteService';
import { listFutuSourceStocks, type FutuMappingScope } from './futuStockPoolLocator';

export type FutuMappingStatus = { fileName: string; status: 'running' | 'complete' | 'partial' | 'failed'; total: number; completed: number; matched: number; failed: number; pending?: number; filePath: string; error?: string; failureSamples?: Array<{ secid: string; error: string }> };
type Job = { status: FutuMappingStatus; generation: symbol };
type MappingGlobal = typeof globalThis & { __futuMappingJobs?: Map<string, Job> };
const globalState = globalThis as MappingGlobal;
const jobs = globalState.__futuMappingJobs || (globalState.__futuMappingJobs = new Map());

export function startFutuMappingJob(fileName: string, codes: string[], scope: FutuMappingScope = 'astock'): FutuMappingStatus {
  const filePath = futuMappingPath(fileName, scope);
  const jobKey = `${scope}/${fileName}`;
  codes = [...new Set(codes)];
  const generation = Symbol(fileName);
  const status: FutuMappingStatus = { fileName, status: 'running', total: codes.length, completed: 0, matched: 0, failed: 0, filePath };
  jobs.set(jobKey, { status, generation });
  const isCurrent = () => jobs.get(jobKey)?.generation === generation;
  const run = async () => {
    const stocks: Record<string, StockInfo> = {};
    const failures: Array<{ secid: string; error: string }> = [];
    let cursor = 0;
    const worker = async () => {
      while (isCurrent()) {
        const i = cursor++;
        if (i >= codes.length) return;
        const secid = codes[i];
        try {
          const info = await resolveFutuStockInfo(secid);
          await upsertFutuMapping(fileName, scope, secid, info, isCurrent);
          stocks[secid] = info;
          status.matched++;
        } catch (error) {
          failures.push({ secid, error: (error instanceof Error ? error.message : String(error)).slice(0, 200) });
          status.failed++;
          status.failureSamples = failures.slice(0, 5);
        }
        status.completed++;
        if (isCurrent()) await new Promise((resolve) => setTimeout(resolve, 200));
      }
    };
    await Promise.all([worker(), worker()]);
    if (!isCurrent()) return;
    const written = await completeFutuMapping(fileName, scope, codes, stocks, failures, isCurrent);
    if (!written || !isCurrent()) return;
    status.status = failures.length ? status.matched ? 'partial' : 'failed' : 'complete';
    console.log(`[futu-mapping] ${fileName}: ${status.status}, 匹配 ${status.matched}/${status.total}, 失败 ${status.failed}`);
  };
  void run().catch((error) => {
    if (!isCurrent()) return;
    status.status = 'failed';
    status.error = error instanceof Error ? error.message : String(error);
    console.error(`[futu-mapping] ${fileName}: 映射生成失败: ${status.error}`);
  });
  return { ...status };
}

export async function getFutuMappingStatus(fileName: string, scope: FutuMappingScope = 'astock'): Promise<FutuMappingStatus | null> {
  futuMappingPath(fileName, scope);
  const running = jobs.get(`${scope}/${fileName}`);
  if (running?.status.status === 'running') return { ...running.status };
  const mapping = await readFutuMapping(fileName, scope);
  if (!mapping) return running ? { ...running.status } : null;
  const sourceCodes = await listFutuSourceStocks(scope, fileName);
  const expected = sourceCodes.length ? new Set(sourceCodes) : new Set([...Object.keys(mapping.stocks), ...mapping.failures.map((failure) => failure.secid)]);
  const matched = [...expected].filter((code) => !!mapping.stocks[code]).length;
  const failureSamples = mapping.failures.filter((failure) => expected.has(failure.secid) && !mapping.stocks[failure.secid]);
  const failed = failureSamples.length;
  const pending = Math.max(0, expected.size - matched - failed);
  return { fileName, status: failed ? matched ? 'partial' : 'failed' : pending ? 'partial' : 'complete', total: expected.size, completed: matched + failed, matched, failed, pending, filePath: await existingFutuMappingPath(fileName, scope), error: running?.status.error, failureSamples: failureSamples.slice(0, 5) };
}
