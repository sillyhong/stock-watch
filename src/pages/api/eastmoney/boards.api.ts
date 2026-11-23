import type { NextApiRequest, NextApiResponse } from 'next';

type Board = { code: string; name: string; categories: string[]; industryLevels: number[] };
type BoardItem = { f12?: unknown; f14?: unknown };
type BoardPage = { rc?: number; data?: { total?: number; diff?: BoardItem[] | Record<string, BoardItem> } | null };

const API = 'https://push2.eastmoney.com/api/qt/clist/get';
const PAGE_SIZE = 100;
const CACHE_MS = 15 * 60 * 1000;
const CATEGORIES = [
  { fs: 'm:90+t:1', name: '地域', level: 0 },
  { fs: 'm:90+s:2+f:!50', name: '行业', level: 1 },
  { fs: 'm:90+s:4+f:!50', name: '行业', level: 2 },
  { fs: 'm:90+s:8+f:!50', name: '行业', level: 3 },
  { fs: 'm:90+t:3', name: '概念', level: 0 },
];
let cache: { boards: Board[]; fetchedAt: number } | undefined;
let pending: Promise<{ boards: Board[]; fetchedAt: number }> | undefined;

async function fetchPage(filter: string, page: number): Promise<{ total: number; items: BoardItem[] }> {
  const params = new URLSearchParams({
    fid: 'f12', po: '0', pz: String(PAGE_SIZE), pn: String(page), np: '1', fltt: '2', invt: '2',
    ut: '8dec03ba335b81bf4ebdf7b29ec27d15', fs: filter, fields: 'f12,f14',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${API}?${params}`, {
      headers: { accept: 'application/json, text/plain, */*', referer: 'https://quote.eastmoney.com/center/boardlist.html', 'user-agent': 'Mozilla/5.0' },
      cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as BoardPage;
    if (data.rc !== 0 || !Number.isSafeInteger(data.data?.total) || (data.data?.total ?? 0) <= 0) throw new Error('东方财富返回的板块列表无效');
    const diff = data.data?.diff;
    const items = Array.isArray(diff) ? diff : diff && typeof diff === 'object' ? Object.values(diff) : [];
    if (!items.length || items.length > PAGE_SIZE || items.some((item) => !item || typeof item.f12 !== 'string' || !/^BK\d{4}$/.test(item.f12) || typeof item.f14 !== 'string' || !item.f14.trim())) {
      throw new Error('东方财富返回的板块数据不完整');
    }
    return { total: data.data!.total!, items };
  } finally { clearTimeout(timeout); }
}

async function loadBoards(): Promise<{ boards: Board[]; fetchedAt: number }> {
  const boards = new Map<string, Board>();
  for (const category of CATEGORIES) {
    const first = await fetchPage(category.fs, 1);
    const items = [...first.items];
    for (let page = 2; page <= Math.ceil(first.total / PAGE_SIZE); page += 1) {
      const next = await fetchPage(category.fs, page);
      if (next.total !== first.total) throw new Error('板块列表在分页时发生变化，请重试');
      items.push(...next.items);
    }
    if (new Set(items.map((item) => item.f12)).size !== first.total) throw new Error('板块列表分页不完整，请重试');
    for (const item of items) {
      const code = item.f12 as string;
      const existing = boards.get(code);
      if (existing) {
        if (!existing.categories.includes(category.name)) existing.categories.push(category.name);
        if (category.level && !existing.industryLevels.includes(category.level)) existing.industryLevels.push(category.level);
      } else {
        boards.set(code, { code, name: (item.f14 as string).trim(), categories: [category.name], industryLevels: category.level ? [category.level] : [] });
      }
    }
  }
  return { boards: [...boards.values()], fetchedAt: Date.now() };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ success: false, error: 'Method not allowed' }); }
  try {
    if (!cache || Date.now() - cache.fetchedAt >= CACHE_MS) {
      if (!pending) pending = loadBoards().finally(() => { pending = undefined; });
      cache = await pending;
    }
    return res.status(200).json({ success: true, count: cache.boards.length, boards: cache.boards, fetchedAt: new Date(cache.fetchedAt).toISOString() });
  } catch (error) {
    return res.status(502).json({ success: false, error: error instanceof Error ? error.message : '获取板块列表失败' });
  }
}
