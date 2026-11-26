import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { StockInfo } from './futuWebQuoteService';

export type FutuMappingFile = { version: 1; fileName: string; updatedAt: string; stocks: Record<string, StockInfo>; failures: Array<{ secid: string; error: string }> };
const DIRECTORY = path.join(process.cwd(), 'src/pages/data/futu-mappings');
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let indexExpires = 0;
let index = new Map<string, StockInfo>();
const writeQueues = new Map<string, Promise<void>>();

export function futuMappingPath(fileName: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(fileName)) throw new Error('无效的股票池文件名');
  return `src/pages/data/futu-mappings/${fileName}.json`;
}

export async function writeFutuMapping(mapping: FutuMappingFile, isCurrent: () => boolean): Promise<boolean> {
  const file = path.join(process.cwd(), futuMappingPath(mapping.fileName));
  const previous = writeQueues.get(file) || Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    if (!isCurrent()) return false;
    const temp = `${file}.${randomUUID()}.tmp`;
    await fs.mkdir(DIRECTORY, { recursive: true });
    try {
      await fs.writeFile(temp, `${JSON.stringify(mapping, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      if (!isCurrent()) return false;
      await fs.rename(temp, file);
      indexExpires = 0;
      return true;
    } finally { await fs.unlink(temp).catch(() => undefined); }
  });
  const pending = operation.then(() => undefined, () => undefined);
  writeQueues.set(file, pending);
  try {
    return await operation;
  } finally { if (writeQueues.get(file) === pending) writeQueues.delete(file); }
}

export async function readFutuMapping(fileName: string): Promise<FutuMappingFile | null> {
  const file = path.join(process.cwd(), futuMappingPath(fileName));
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error('富途映射文件无效');
    const data = JSON.parse(await fs.readFile(file, 'utf8')) as FutuMappingFile;
    if (data.version !== 1 || data.fileName !== fileName || !data.stocks || typeof data.stocks !== 'object' || !Array.isArray(data.failures)) throw new Error('富途映射文件格式无效');
    return data;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function lookupFutuMapping(secid: string): Promise<StockInfo | undefined> {
  if (Date.now() >= indexExpires) {
    const entries = await fs.readdir(DIRECTORY, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const latest = new Map<string, { info: StockInfo; updatedAt: number }>();
    for (const entry of entries) {
      if (!entry.isFile() || !/^[A-Za-z0-9_-]{1,80}\.json$/.test(entry.name)) continue;
      try {
        const mapping = await readFutuMapping(entry.name.slice(0, -5));
        const age = mapping ? Date.now() - Date.parse(mapping.updatedAt) : Infinity;
        if (!mapping || !Number.isFinite(age) || age < 0 || age > MAX_AGE) continue;
        const updatedAt = Date.parse(mapping.updatedAt);
        for (const [code, info] of Object.entries(mapping.stocks)) {
          if (!latest.has(code) || latest.get(code)!.updatedAt < updatedAt) latest.set(code, { info, updatedAt });
        }
      } catch { /* A broken mapping must not prevent live lookup. */ }
    }
    index = new Map([...latest].map(([code, entry]) => [code, entry.info]));
    indexExpires = Date.now() + 30_000;
  }
  return index.get(secid);
}
