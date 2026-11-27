import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { findFutuMappingSources, type FutuMappingScope } from './futuStockPoolLocator';
import type { StockInfo } from './futuWebQuoteService';

export type FutuMappingFile = { version: 1; fileName: string; updatedAt: string; stocks: Record<string, StockInfo>; failures: Array<{ secid: string; error: string }>; archivedStocks?: Record<string, StockInfo> };
const DIRECTORY = path.join(process.cwd(), 'src/pages/data/futu-mappings');
const SCOPES: FutuMappingScope[] = ['astock', 'A', 'HK', 'US'];
let indexExpires = 0;
let index = new Map<string, StockInfo>();
let conflictingCodes = new Set<string>();
const writeQueues = new Map<string, Promise<void>>();

export class FutuMappingConflictError extends Error {
  readonly code = 'FUTU_MAPPING_CONFLICT';
  constructor(secid: string) { super(`股票 ${secid} 存在不同的富途 ID，请检查板块映射`); }
}

function isCompatibleMapping(secid: string, info: StockInfo): boolean {
  const match = /^(0|1|105|106|116)\.([A-Za-z0-9.-]+)$/.exec(secid);
  if (!match || !info || typeof info !== 'object') return false;
  const [, market, code] = match;
  const exchange = market === '1' ? 'SH' : market === '0' ? (/^(4|8|92)/.test(code) ? 'BJ' : 'SZ') : market === '116' ? 'HK' : 'US';
  const expectedMarketType = exchange === 'HK' ? 1 : exchange === 'US' ? 2 : 4;
  return String(info.stockCode).toUpperCase() === code.toUpperCase() && String(info.marketLabel).toUpperCase() === exchange && typeof info.name === 'string' && !!info.name.trim() && /^[1-9]\d*$/.test(String(info.stockId)) && (typeof info.stockId !== 'number' || Number.isSafeInteger(info.stockId)) && Number(info.marketType) === expectedMarketType && [info.marketCode, info.instrumentType, info.subInstrumentType].every((value) => value === undefined || (value !== null && /^\d+$/.test(String(value))));
}

function validate(fileName: string, scope: FutuMappingScope): void {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(fileName) || !SCOPES.includes(scope)) throw new Error('无效的股票池文件名或市场');
}

export function futuMappingPath(fileName: string, scope: FutuMappingScope = 'astock'): string {
  validate(fileName, scope);
  return `src/pages/data/futu-mappings/${scope}/${fileName}.json`;
}

async function readMappingFile(file: string, fileName: string): Promise<FutuMappingFile | null> {
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

export async function readFutuMapping(fileName: string, scope: FutuMappingScope = 'astock'): Promise<FutuMappingFile | null> {
  const file = path.join(process.cwd(), futuMappingPath(fileName, scope));
  const current = await readMappingFile(file, fileName);
  if (current) return current;
  const legacyName = scope === 'astock' ? fileName : `sector_${scope}_${fileName}`;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(legacyName)) return null;
  const legacy = await readMappingFile(path.join(DIRECTORY, `${legacyName}.json`), legacyName);
  return legacy ? { ...legacy, fileName } : null;
}

export async function existingFutuMappingPath(fileName: string, scope: FutuMappingScope = 'astock'): Promise<string> {
  const current = futuMappingPath(fileName, scope);
  if (await readMappingFile(path.join(process.cwd(), current), fileName)) return current;
  const legacyName = scope === 'astock' ? fileName : `sector_${scope}_${fileName}`;
  if (/^[A-Za-z0-9_-]{1,80}$/.test(legacyName) && await readMappingFile(path.join(DIRECTORY, `${legacyName}.json`), legacyName)) return `src/pages/data/futu-mappings/${legacyName}.json`;
  return current;
}

async function updateMapping(fileName: string, scope: FutuMappingScope, isCurrent: () => boolean, update: (previous: FutuMappingFile | null, materialized: boolean) => FutuMappingFile | null): Promise<boolean> {
  const file = path.join(process.cwd(), futuMappingPath(fileName, scope));
  const previous = writeQueues.get(file) || Promise.resolve();
  const operation = previous.catch(() => undefined).then(async () => {
    if (!isCurrent()) return false;
    const current = await readMappingFile(file, fileName);
    const next = update(current ?? await readFutuMapping(fileName, scope), !!current);
    if (!next || !isCurrent()) return false;
    const temp = `${file}.${randomUUID()}.tmp`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    try {
      await fs.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      if (!isCurrent()) return false;
      await fs.rename(temp, file);
      indexExpires = 0;
      return true;
    } finally { await fs.unlink(temp).catch(() => undefined); }
  });
  const pending = operation.then(() => undefined, () => undefined);
  writeQueues.set(file, pending);
  try { return await operation; }
  finally { if (writeQueues.get(file) === pending) writeQueues.delete(file); }
}

export async function writeFutuMapping(mapping: FutuMappingFile, isCurrent: () => boolean, scope: FutuMappingScope = 'astock'): Promise<boolean> {
  return updateMapping(mapping.fileName, scope, isCurrent, () => mapping);
}

export async function upsertFutuMapping(fileName: string, scope: FutuMappingScope, secid: string, info: StockInfo, isCurrent: () => boolean = () => true): Promise<boolean> {
  return updateMapping(fileName, scope, isCurrent, (previous, materialized) => {
    for (const old of [previous?.stocks[secid], previous?.archivedStocks?.[secid]]) {
      if (old && isCompatibleMapping(secid, old) && String(old.stockId) !== String(info.stockId)) throw new FutuMappingConflictError(secid);
    }
    if (materialized && previous && JSON.stringify(previous.stocks[secid]) === JSON.stringify(info) && !previous.failures.some((failure) => failure.secid === secid)) return null;
    const archivedStocks = { ...previous?.archivedStocks };
    delete archivedStocks[secid];
    return { version: 1, fileName, updatedAt: new Date().toISOString(), stocks: { ...previous?.stocks, [secid]: info }, failures: (previous?.failures ?? []).filter((failure) => failure.secid !== secid), archivedStocks };
  });
}

export async function completeFutuMapping(fileName: string, scope: FutuMappingScope, codes: string[], stocks: Record<string, StockInfo>, failures: FutuMappingFile['failures'], isCurrent: () => boolean): Promise<boolean> {
  return updateMapping(fileName, scope, isCurrent, (previous) => {
    const allowed = new Set(codes);
    const failed = new Set(failures.map((failure) => failure.secid));
    const archivedStocks = { ...previous?.archivedStocks };
    for (const [code, info] of Object.entries(previous?.stocks ?? {})) if (!allowed.has(code)) archivedStocks[code] = info;
    const active: Record<string, StockInfo> = {};
    for (const code of allowed) {
      const info = stocks[code] ?? (!failed.has(code) ? previous?.stocks[code] : undefined);
      if (info) for (const old of [previous?.stocks[code], previous?.archivedStocks?.[code]]) {
        if (old && isCompatibleMapping(code, old) && String(old.stockId) !== String(info.stockId)) throw new FutuMappingConflictError(code);
      }
      if (info) { active[code] = info; delete archivedStocks[code]; }
      else if (previous?.stocks[code]) archivedStocks[code] = previous.stocks[code];
    }
    return { version: 1, fileName, updatedAt: new Date().toISOString(), stocks: active, failures: failures.filter((failure) => !active[failure.secid]), archivedStocks };
  });
}

export async function saveFutuMappingForSources(secid: string, info: StockInfo): Promise<void> {
  const sources = await findFutuMappingSources(secid);
  await Promise.all(sources.map(({ fileName, scope }) => upsertFutuMapping(fileName, scope, secid, info)));
}

export async function lookupFutuMapping(secid: string): Promise<StockInfo | undefined> {
  if (Date.now() >= indexExpires) {
    const latest = new Map<string, { info: StockInfo; updatedAt: number }>();
    const conflicts = new Set<string>();
    for (const directory of [DIRECTORY, ...SCOPES.map((scope) => path.join(DIRECTORY, scope)), path.join(DIRECTORY, 'auto')]) {
      const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      for (const entry of entries) {
        if (!entry.isFile() || !/^[A-Za-z0-9_-]{1,80}\.json$/.test(entry.name)) continue;
        try {
          const mapping = await readMappingFile(path.join(directory, entry.name), entry.name.slice(0, -5));
          if (!mapping) continue;
          const updatedAt = Number.isFinite(Date.parse(mapping.updatedAt)) ? Date.parse(mapping.updatedAt) : 0;
          for (const [code, info] of Object.entries({ ...mapping.archivedStocks, ...mapping.stocks })) {
            if (!isCompatibleMapping(code, info)) continue;
            if (latest.has(code) && String(latest.get(code)!.info.stockId) !== String(info.stockId)) conflicts.add(code);
            if (!latest.has(code) || latest.get(code)!.updatedAt < updatedAt) latest.set(code, { info, updatedAt });
          }
        } catch { /* A broken mapping must not prevent other mappings from loading. */ }
      }
    }
    index = new Map([...latest].map(([code, entry]) => [code, entry.info]));
    conflictingCodes = conflicts;
    indexExpires = Date.now() + 30_000;
  }
  if (conflictingCodes.has(secid)) throw new FutuMappingConflictError(secid);
  return index.get(secid);
}
