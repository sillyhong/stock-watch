import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';

export type FutuMappingScope = 'astock' | 'A' | 'HK' | 'US';
export type FutuMappingSource = { scope: FutuMappingScope; fileName: string };

const ROOT = path.join(process.cwd(), 'src/pages/data');
const CACHE_MS = 30_000;
let cache: { expires: number; byStock: Map<string, FutuMappingSource[]> } | undefined;
let pending: Promise<Map<string, FutuMappingSource[]>> | undefined;
let revision = 0;

export function invalidateFutuStockPoolIndex(): void {
  revision++;
  cache = undefined;
}

async function loadSources(): Promise<Map<string, FutuMappingSource[]>> {
  const index = new Map<string, FutuMappingSource[]>();
  for (const scope of ['astock', 'A', 'HK', 'US'] as const) {
    const dir = scope === 'astock' ? path.join(ROOT, 'astock') : path.join(ROOT, 'stock-pools', scope);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      if (!entry.isFile() || !/^[A-Za-z0-9_-]{1,80}\.ts$/.test(entry.name) || (scope === 'astock' && entry.name === 'astock.ts')) continue;
      const file = path.join(dir, entry.name);
      const text = await fs.readFile(file, 'utf8');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const diagnostics = (source as import('typescript').SourceFile & { parseDiagnostics: readonly import('typescript').Diagnostic[] }).parseDiagnostics;
      if (diagnostics.length) continue;
      const codes = new Set<string>();
      for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
        for (const declaration of statement.declarationList.declarations) {
          if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) continue;
          for (const element of declaration.initializer.elements) {
            if (ts.isStringLiteral(element) && /^(?:0|1|105|106|116)\.[A-Za-z0-9.-]+$/.test(element.text)) codes.add(element.text);
          }
        }
      }
      for (const code of codes) {
        const sources = index.get(code) ?? [];
        sources.push({ scope, fileName: entry.name.slice(0, -3) });
        index.set(code, sources);
      }
    }
  }
  return index;
}

async function sourceIndex(): Promise<Map<string, FutuMappingSource[]>> {
  if (!cache || Date.now() >= cache.expires) {
    const currentRevision = revision;
    if (!pending) pending = loadSources().finally(() => { pending = undefined; });
    const byStock = await pending;
    if (currentRevision !== revision) return sourceIndex();
    cache = { byStock, expires: Date.now() + CACHE_MS };
  }
  return cache.byStock;
}

export async function findFutuMappingSources(secid: string): Promise<FutuMappingSource[]> {
  return (await sourceIndex()).get(secid) ?? [];
}

export async function listFutuSourceStocks(scope: FutuMappingScope, fileName: string): Promise<string[]> {
  const result: string[] = [];
  for (const [secid, sources] of await sourceIndex()) {
    if (sources.some((source) => source.scope === scope && source.fileName === fileName)) result.push(secid);
  }
  return result;
}
