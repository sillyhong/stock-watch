import { futuMappingPath, readFutuMapping, writeFutuMapping } from './futuMappingStore';
import { resolveFutuStockInfo, type StockInfo } from './futuWebQuoteService';

export type FutuMappingStatus = { fileName: string; status: 'running' | 'complete' | 'partial' | 'failed'; total: number; completed: number; matched: number; failed: number; filePath: string; error?: string; failureSamples?: Array<{ secid: string; error: string }> };
type Job = { status: FutuMappingStatus; generation: symbol };
type MappingGlobal = typeof globalThis & { __futuMappingJobs?: Map<string, Job> };
const globalState = globalThis as MappingGlobal;
const jobs = globalState.__futuMappingJobs || (globalState.__futuMappingJobs = new Map());

export function startFutuMappingJob(fileName: string, codes: string[]): FutuMappingStatus {
  const filePath = futuMappingPath(fileName);
  const generation = Symbol(fileName);
  const status: FutuMappingStatus = { fileName, status: 'running', total: codes.length, completed: 0, matched: 0, failed: 0, filePath };
  jobs.set(fileName, { status, generation });
  const isCurrent = () => jobs.get(fileName)?.generation === generation;
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
          stocks[secid] = await resolveFutuStockInfo(secid);
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
    const written = await writeFutuMapping({ version: 1, fileName, updatedAt: new Date().toISOString(), stocks, failures }, isCurrent);
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

export async function getFutuMappingStatus(fileName: string): Promise<FutuMappingStatus | null> {
  futuMappingPath(fileName);
  const running = jobs.get(fileName);
  if (running) return { ...running.status };
  const mapping = await readFutuMapping(fileName);
  if (!mapping) return null;
  const matched = Object.keys(mapping.stocks).length;
  const failed = mapping.failures.length;
  return { fileName, status: failed ? matched ? 'partial' : 'failed' : 'complete', total: matched + failed, completed: matched + failed, matched, failed, filePath: futuMappingPath(fileName), failureSamples: mapping.failures.slice(0, 5) };
}
