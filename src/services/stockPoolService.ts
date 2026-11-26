import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import { QueryTypes } from 'sequelize';
import { apiCatalog, type ApiTaskDefinition } from '@/config/apiCatalog';
import sequelize from '@/services/lib/database';
import { getFutuMappingStatus, startFutuMappingJob } from '@/services/futuMappingService';

const SOURCE_DIRECTORY = path.join(process.cwd(), 'src/pages/data/astock');
const WATCHLIST_FILE = path.join(process.cwd(), 'src/pages/utils/stockList.ts');
const WATCHLIST = '@watchlist';
const SECTOR_DIRECTORY = path.join(process.cwd(), 'src/pages/data/stock-pools');
const sectors: Record<'A' | 'HK' | 'US', Record<string, string>> = {
  A: { ZHENGQUAN: '券商自选', XINPIAN: '芯片自选', HANGTIAN: '航天自选', GUTAIDIANCHI: '固态电池自选', GUANGFU: '光伏自选', YOUSE: '有色自选', CHANGXIN: '长鑫自选', CPO: 'CPO自选', BOLIJIBAN: '玻璃基板自选', CHUANGXINYAO: '创新药自选', AI: 'AI自选', GUANGDIAN: '光电自选', HUPAN: '护盘自选' },
  HK: { HULIANWANG: '互联网自选', KEJI: '科技自选', QICHE: '汽车自选', BANDAOTI: '半导体自选', JINRONG: '金融自选', YILIAO: '医疗自选', FANGDICHAN: '房地产自选' },
  US: { HULIANWANG: '科技互联网自选', BANDAOTI: '半导体自选', CHUCUN: '存储自选', QICHE: '汽车自选', CAILIAO: '材料自选', QITA: '其他自选' },
};
const sectorIds = (market: 'A' | 'HK' | 'US') => Object.keys(sectors[market]).map((name) => `sector:${market}/${name.toLowerCase()}`);

export type StockPoolSource = { id: string; fileName: string; exportName: string; label: string; market: 'A' | 'HK' | 'US'; count: number; boardCode?: string; boardName?: string; scope?: 'partial' | 'file' | 'candidate' | 'unverified'; origin?: string; classifiedAt?: string; warning?: string };
export type TaskPool = { taskId: string; market: 'A' | 'HK' | 'US'; sources: string[]; version: number };
type PoolRow = { task_id: string; market: string | null; sources: string; version: number };
type SectorSource = StockPoolSource & { legacySource?: string; codes: string[] };

let schemaPromise: Promise<void> | undefined;
let sectorSourcesPending: Promise<SectorSource[]> | undefined;

export function stockPoolTasks(): ApiTaskDefinition[] {
  return apiCatalog.filter((task) => task.feature === 'RSI' || task.feature === 'MAIN_TREND');
}

function taskDefinition(taskId: string): ApiTaskDefinition {
  const task = stockPoolTasks().find((item) => item.id === taskId);
  if (!task || task.market === 'ALL') throw new Error(`未知股票任务: ${taskId}`);
  return task;
}

function defaultSources(task: ApiTaskDefinition): string[] {
  if (task.market === 'HK' || task.market === 'US') return sectorIds(task.market);
  const isDay = task.interval === 'DAY';
  const isFiveMinutes = task.interval === '5M';
  return [...sectorIds('A'), ...(!isFiveMinutes ? ['board:bandaoti', 'board:cpo'] : []), ...(isDay ? ['board:MLCC'] : [])];
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = sequelize.query(`CREATE TABLE IF NOT EXISTS task_stock_pools (
      task_id VARCHAR(128) NOT NULL PRIMARY KEY,
      market VARCHAR(8) NULL,
      sources TEXT NOT NULL,
      version INT UNSIGNED NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).then(async () => {
      const columns = await sequelize.query<{ Field: string }>('SHOW COLUMNS FROM task_stock_pools', { type: QueryTypes.SELECT });
      if (!columns.some((column) => column.Field === 'market')) {
        try { await sequelize.query('ALTER TABLE task_stock_pools ADD COLUMN market VARCHAR(8) NULL AFTER task_id'); }
        catch (error) {
          if ((error as { original?: { code?: string } }).original?.code !== 'ER_DUP_FIELDNAME') throw error;
        }
      }
    }).catch((error) => { schemaPromise = undefined; throw error; });
  }
  return schemaPromise;
}

async function ensureTask(task: ApiTaskDefinition): Promise<void> {
  await ensureSchema();
  await sequelize.query('INSERT IGNORE INTO task_stock_pools (task_id, market, sources) VALUES (:taskId, :market, :sources)', {
    replacements: { taskId: task.id, market: task.market, sources: JSON.stringify(defaultSources(task)) },
  });
}

function marketForCodes(codes: string[]): StockPoolSource['market'] | null {
  if (!codes.length) return null;
  if (codes.every((code) => /^(0|1)\.\d{6}$/.test(code))) return 'A';
  if (codes.every((code) => /^116\.\d{5}$/.test(code))) return 'HK';
  if (codes.every((code) => /^(105|106)\.[A-Za-z0-9.-]+$/.test(code))) return 'US';
  return null;
}

async function readArrays(file: string): Promise<Map<string, string[]>> {
  const text = await fs.readFile(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const diagnostics = (source as import('typescript').SourceFile & { parseDiagnostics: readonly import('typescript').Diagnostic[] }).parseDiagnostics;
  if (diagnostics.length) throw new Error(`股票池文件语法错误: ${path.basename(file)}`);
  const result = new Map<string, string[]>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
      if (!declaration.initializer.elements.every(ts.isStringLiteral)) continue;
      result.set(declaration.name.text, declaration.initializer.elements.map((element) => (element as import('typescript').StringLiteral).text.trim()));
    }
  }
  return result;
}

async function sectorFile(id: string, market: string): Promise<string> {
  const match = /^sector:(A|HK|US)\/([A-Za-z0-9_-]+)$/.exec(id);
  if (!match || match[1] !== market) throw new Error(`股票分类不属于 ${market}: ${id}`);
  const file = path.join(SECTOR_DIRECTORY, match[1], `${match[2]}.ts`);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`股票分类不是普通文件: ${id}`);
  return file;
}

async function readStringExports(file: string): Promise<Record<string, string>> {
  const text = await fs.readFile(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const result: Record<string, string> = {};
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isStringLiteral(declaration.initializer)) result[declaration.name.text] = declaration.initializer.text;
    }
  }
  return result;
}

function listSectorSources(): Promise<SectorSource[]> {
  if (!sectorSourcesPending) sectorSourcesPending = readSectorSources().finally(() => { sectorSourcesPending = undefined; });
  return sectorSourcesPending;
}

async function readSectorSources(): Promise<SectorSource[]> {
  const result: SectorSource[] = [];
  for (const market of ['A', 'HK', 'US'] as const) {
    const entries = await fs.readdir(path.join(SECTOR_DIRECTORY, market), { withFileTypes: true });
    for (const entry of entries.filter((item) => item.isFile() && /^[A-Za-z0-9_-]+\.ts$/.test(item.name)).sort((a, b) => a.name.localeCompare(b.name))) {
      const id = `sector:${market}/${entry.name.slice(0, -3)}`;
      const file = await sectorFile(id, market);
      const codes = (await readArrays(file)).get('stocks');
      if (!codes || marketForCodes(codes) !== market) throw new Error(`股票分类无效: ${id}`);
      const meta = await readStringExports(file);
      const boardCode = /^BK\d{4}$/.test(meta.boardCode ?? '') ? meta.boardCode : undefined;
      const boardName = boardCode && meta.boardName ? meta.boardName : undefined;
      const scope = boardCode ? 'partial' : 'unverified';
      result.push({ id, fileName: `${market}/${entry.name}`, exportName: 'stocks', label: boardCode ? `${boardName ?? '板块名称待核实'} · ${boardCode}` : `行业待核实 · ${meta.label || entry.name}`, market, count: codes.length, boardCode, boardName, scope, origin: meta.legacySource, classifiedAt: meta.classificationAsOf, warning: meta.warning, legacySource: meta.legacySource, codes });
    }
  }
  return result;
}

async function sectorMigrations(sources: SectorSource[]): Promise<Map<string, string[]>> {
  const groups = new Map<string, typeof sources>();
  for (const source of sources) {
    if (source.legacySource && /^sector:A\/[A-Za-z0-9_-]+$/.test(source.legacySource)) groups.set(source.legacySource, [...(groups.get(source.legacySource) ?? []), source]);
  }
  const migrations = new Map<string, string[]>();
  for (const [legacy, parts] of groups) {
    const old = sources.find((source) => source.id === legacy);
    if (!old) continue;
    const expected = new Set(old.codes);
    const actual = new Set(parts.flatMap((part) => part.codes));
    if (expected.size === actual.size && [...expected].every((code) => actual.has(code))) migrations.set(legacy, parts.map((part) => part.id));
  }
  return migrations;
}

export async function listStockSources(): Promise<StockPoolSource[]> {
  const files = (await fs.readdir(SOURCE_DIRECTORY, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^[A-Za-z0-9_-]+\.ts$/.test(entry.name))
    .map((entry) => entry.name).sort();
  const result: StockPoolSource[] = [];
  const sectorSources = await listSectorSources();
  const migrations = await sectorMigrations(sectorSources);
  for (const { codes: _codes, legacySource: _legacySource, ...source } of sectorSources) {
    if (!migrations.has(source.id)) result.push(source);
  }
  for (const fileName of files) {
    if (fileName === 'astock.ts') continue;
    const arrays = await readArrays(path.join(SOURCE_DIRECTORY, fileName));
    const metadata = await readStringExports(path.join(SOURCE_DIRECTORY, fileName));
    const known = fileName === 'cpo.ts' ? { code: 'BK1128', name: 'CPO概念', candidate: false }
      : fileName === 'boliboxian.ts' ? { code: 'BK0546', name: '玻璃玻纤', candidate: false }
        : fileName === 'bandaoti.ts' ? { code: 'BK1036', name: '半导体', candidate: true }
          : fileName === 'MLCC.ts' ? { code: 'BK0890', name: 'MLCC', candidate: true } : undefined;
    const declaredBoardCode = /^BK\d{4}$/.test(metadata.eastmoneyBoardCode ?? '') ? metadata.eastmoneyBoardCode : undefined;
    const boardCode = declaredBoardCode ?? known?.code;
    const boardName = (declaredBoardCode ? metadata.eastmoneyBoardName : undefined) || (known && known.code === boardCode ? known.name : undefined);
    const counts = new Map<string, number>();
    for (const codes of arrays.values()) { const market = marketForCodes(codes); if (market) counts.set(market, (counts.get(market) ?? 0) + 1); }
    for (const [exportName, codes] of arrays) {
      const market = marketForCodes(codes);
      if (market) result.push({ id: counts.get(market) === 1 ? `board:${fileName.slice(0, -3)}` : `${fileName}#${exportName}`, fileName, exportName, label: boardCode ? `${boardName || '名称待核实'} · ${boardCode}` : `板块待核实 · ${fileName.slice(0, -3)}`, market, count: codes.length, boardCode, boardName, scope: boardCode ? (!declaredBoardCode && known?.candidate ? 'candidate' : 'file') : 'unverified' });
    }
  }
  return result;
}

async function loadSource(id: string, market: string): Promise<string[]> {
  if (id.startsWith('sector:')) {
    const codes = (await readArrays(await sectorFile(id, market))).get('stocks');
    if (!codes || marketForCodes(codes) !== market) throw new Error(`股票分类缺失、为空或不属于 ${market}: ${id}`);
    return codes;
  }
  if (id.startsWith('board:')) {
    const name = id.slice(6);
    if (!/^[A-Za-z0-9_-]+$/.test(name) || name === 'astock') throw new Error(`无效股票池: ${id}`);
    const file = path.join(SOURCE_DIRECTORY, `${name}.ts`);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`股票池不是普通文件: ${name}`);
    const matching = [...(await readArrays(file)).values()].filter((codes) => marketForCodes(codes) === market);
    if (matching.length !== 1) throw new Error(`股票池缺失、存在多个分类或不属于 ${market}: ${id}`);
    return matching[0];
  }
  const [fileName, exportName, extra] = id.split('#');
  if (extra !== undefined || !exportName || !/^[A-Za-z_$][\w$]*$/.test(exportName)) throw new Error(`无效股票池: ${id}`);
  const isWatchlist = fileName === WATCHLIST && ['HKStockList', 'USStockList'].includes(exportName);
  if (!isWatchlist && !/^[A-Za-z0-9_-]+\.ts$/.test(fileName)) throw new Error(`无效股票池文件: ${fileName}`);
  const file = isWatchlist ? WATCHLIST_FILE : path.join(SOURCE_DIRECTORY, fileName);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`股票池不是普通文件: ${fileName}`);
  const codes = (await readArrays(file)).get(exportName);
  if (!codes || marketForCodes(codes) !== market) throw new Error(`股票池缺失、为空或不属于 ${market}: ${id}`);
  return codes;
}

export async function getTaskPool(taskId: string): Promise<TaskPool> {
  const task = taskDefinition(taskId);
  await ensureTask(task);
  const rows = await sequelize.query<PoolRow>('SELECT task_id, market, sources, version FROM task_stock_pools WHERE task_id = :taskId', { replacements: { taskId }, type: QueryTypes.SELECT });
  if (!rows.length) throw new Error(`未找到股票池配置: ${taskId}`);
  const sources: unknown = JSON.parse(rows[0].sources);
  if (!Array.isArray(sources) || !sources.every((value) => typeof value === 'string')) throw new Error(`股票池配置格式错误: ${taskId}`);
  const market = task.market as 'A' | 'HK' | 'US';
  if (rows[0].market && rows[0].market !== market) throw new Error(`任务市场配置不匹配: ${taskId}`);
  const catalog = (sources as string[]).some((source) => source.includes('#') && !source.startsWith('@watchlist') && source !== 'astock.ts#AStockList') ? await listStockSources() : [];
  const sectorSplit = market === 'A' && (sources as string[]).some((source) => source === 'astock.ts#AStockList' || sectorIds('A').includes(source)) ? await sectorMigrations(await listSectorSources()) : new Map<string, string[]>();
  const migrated: string[] = [];
  for (const source of sources as string[]) {
    const aggregate = (market === 'A' && source === 'astock.ts#AStockList') || (market === 'HK' && source === '@watchlist#HKStockList') || (market === 'US' && source === '@watchlist#USStockList');
    if (aggregate) {
      const replacement = sectorIds(market);
      const oldCodes = new Set(await loadSource(source, market));
      const newCodes = new Set((await Promise.all(replacement.map((id) => loadSource(id, market)))).flat());
      if (oldCodes.size !== newCodes.size || [...oldCodes].some((code) => !newCodes.has(code))) throw new Error(`旧股票列表与拆分分类不一致，已保留原配置: ${source}`);
      migrated.push(...replacement.flatMap((id) => sectorSplit.get(id) ?? [id]));
    } else {
      const match = catalog.find((item) => item.market === market && `${item.fileName}#${item.exportName}` === source);
      const id = match?.id ?? source;
      migrated.push(...(sectorSplit.get(id) ?? [id]));
    }
  }
  const unique = [...new Set(migrated)];
  if (!rows[0].market || JSON.stringify(unique) !== JSON.stringify(sources)) {
    const [, metadata] = await sequelize.query('UPDATE task_stock_pools SET market = :market, sources = :sources, version = version + 1 WHERE task_id = :taskId AND version = :version', { replacements: { taskId, market, sources: JSON.stringify(unique), version: Number(rows[0].version) } });
    if ((metadata as { affectedRows?: number }).affectedRows !== 1) return getTaskPool(taskId);
    return { taskId, market, sources: unique, version: Number(rows[0].version) + 1 };
  }
  return { taskId, market, sources: unique, version: Number(rows[0].version) };
}

export async function getTaskStocks(taskId: string, options: { allowEmpty?: boolean } = {}): Promise<string[]> {
  const task = taskDefinition(taskId);
  const pool = await getTaskPool(taskId);
  if (!pool.sources.length) {
    if (options.allowEmpty) return [];
    throw new Error(`任务 ${taskId} 尚未配置股票池`);
  }
  const lists = await Promise.all(pool.sources.map((source) => loadSource(source, task.market)));
  const stocks = [...new Set(lists.flat())];
  if (!stocks.length) throw new Error(`任务 ${taskId} 的股票池为空`);
  return stocks;
}

export async function updateTaskPool(taskId: string, sources: string[], version: number): Promise<TaskPool> {
  const task = taskDefinition(taskId);
  if (!Number.isSafeInteger(version) || version < 1 || sources.length > 100 || new Set(sources).size !== sources.length) throw new Error('股票池配置或版本无效');
  await Promise.all(sources.map((source) => loadSource(source, task.market)));
  const previous = await getTaskPool(taskId);
  const [, metadata] = await sequelize.query('UPDATE task_stock_pools SET sources = :sources, version = version + 1 WHERE task_id = :taskId AND version = :version', {
    replacements: { taskId, version, sources: JSON.stringify(sources) },
  });
  if ((metadata as { affectedRows?: number }).affectedRows !== 1) throw new Error('配置已被其他人修改，请刷新后重试');
  const newFiles = [...new Set(sources.filter((source) => !previous.sources.includes(source)).map((source) => source.startsWith('board:') ? `${source.slice(6)}.ts` : source.split('#')[0]).filter((file) => /^[A-Za-z0-9_-]{1,80}\.ts$/.test(file)))];
  for (const file of newFiles) {
    void (async () => {
      const fileName = file.slice(0, -3);
      if ((await getFutuMappingStatus(fileName).catch(() => null))?.status === 'running') return;
      const arrays = await readArrays(path.join(SOURCE_DIRECTORY, file));
      const codes = [...new Set([...arrays.values()].filter((items) => marketForCodes(items)).flat())];
      if (codes.length) startFutuMappingJob(fileName, codes);
    })().catch((error) => console.error(`[futu-mapping] ${file}: 启动失败:`, error instanceof Error ? error.message : String(error)));
  }
  return getTaskPool(taskId);
}
