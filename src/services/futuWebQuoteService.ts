import axios from 'axios';
import { createHash, createHmac } from 'crypto';
import { lookupFutuMapping, saveFutuMappingForSources } from './futuMappingStore';

export type StockInfo = { name: string; stockCode: string; stockId: string | number; marketType: string | number; marketLabel: string; marketCode?: string | number; instrumentType?: string | number; subInstrumentType?: string | number };
type SearchItem = { stockSymbol?: unknown; stockName?: unknown; stockId?: unknown; market?: unknown; marketType?: unknown };
type WebBar = { k?: number; o?: string | number; c?: string | number; h?: string | number; l?: string | number; v?: number; t?: number; r?: number | null; lc?: number; cp?: string | number };
export type FutuQuoteOptions = { start: string; end: string; limit?: number; adjustment?: number };
export type FutuEastmoneyData = { code: string; market: number; name: string; preKPrice: number; klines: string[] };

const KLINE_TYPES: Record<number, string> = { 5: '6', 15: '7', 30: '8', 60: '9', 101: '2', 102: '3', 103: '4' };
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';
const STOCK_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const SEARCH_INTERVAL_MS = 200;
const stockCache = new Map<string, { info: StockInfo; expires: number }>();
const stockPending = new Map<string, Promise<StockInfo>>();
const circuitUntil = new Map<string, number>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();
let active = 0;
let nextSearchAt = 0;
const waiters: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiters.push(resolve));
  else active++;
  try { return await fn(); } finally {
    const next = waiters.shift();
    if (next) next(); else active--;
  }
}

export function signFutuWebParams(params: Record<string, string>): string {
  const text = JSON.stringify(params);
  const first = createHmac('sha512', 'quote_web').update(text).digest('hex').slice(0, 10);
  return createHash('sha256').update(first).digest('hex').slice(0, 10);
}

export function parseFutuStockPage(html: string, code: string, marketLabel: string): StockInfo {
  const match = /window\.__INITIAL_STATE__\s*=\s*\{/.exec(html);
  if (!match) throw new Error('富途股票页面缺少初始状态');
  const start = match.index + match[0].lastIndexOf('{');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error('富途股票页面状态不完整');
  let info: StockInfo;
  try { info = JSON.parse(html.slice(start, end)).stock_info; } catch { throw new Error('富途股票页面状态解析失败'); }
  if (!isValidStockInfo(info, code, marketLabel)) throw new Error(`富途股票身份不匹配: ${marketLabel}.${code}`);
  return info;
}

function isValidStockInfo(info: StockInfo | undefined, code: string, marketLabel: string): info is StockInfo {
  const expectedMarketType = marketLabel === 'HK' ? 1 : marketLabel === 'US' ? 2 : 4;
  return !!info && String(info.stockCode).toUpperCase() === code.toUpperCase() && String(info.marketLabel).toUpperCase() === marketLabel && typeof info.name === 'string' && !!info.name.trim() && /^[1-9]\d*$/.test(String(info.stockId)) && (typeof info.stockId !== 'number' || Number.isSafeInteger(info.stockId)) && Number(info.marketType) === expectedMarketType && [info.marketCode, info.instrumentType, info.subInstrumentType].every((value) => value === undefined || (value !== null && /^\d+$/.test(String(value))));
}

function getStockRoute(secid: string): { market: number; code: string; exchange: string } {
  const match = /^(0|1|105|106|116)\.([A-Za-z0-9.-]+)$/.exec(secid);
  if (!match) throw new Error(`不支持的东方财富股票代码: ${secid}`);
  const market = Number(match[1]);
  const code = match[2];
  if ((market === 0 || market === 1) && !/^\d{6}$/.test(code)) throw new Error(`无效 A 股代码: ${secid}`);
  if (market === 116 && !/^\d{5}$/.test(code)) throw new Error(`无效港股代码: ${secid}`);
  const exchange = market === 1 ? 'SH' : market === 0 ? (/^(4|8|92)/.test(code) ? 'BJ' : 'SZ') : market === 116 ? 'HK' : 'US';
  return { market, code, exchange };
}

function checkCircuit(key: string): void {
  if ((circuitUntil.get('*') || 0) > Date.now() || (circuitUntil.get(key) || 0) > Date.now()) throw new Error('富途网页行情暂时熔断');
}

function requestError(error: unknown, key: string): Error {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 401 || status === 403 || status === 429) circuitUntil.set('*', Date.now() + COOLDOWN_MS);
  else if (status === 504 || (axios.isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code || ''))) circuitUntil.set(key, Date.now() + COOLDOWN_MS);
  return new Error(`富途网页请求失败${status ? ` HTTP ${status}` : axios.isAxiosError(error) && error.code ? ` ${error.code}` : ''}`);
}

async function searchStockInfo(code: string, exchange: string): Promise<StockInfo> {
  let payload: { code?: number; data?: { quote?: SearchItem[] } };
  try {
    const response = await withSlot(async () => {
      const now = Date.now();
      const scheduled = Math.max(now, nextSearchAt);
      nextSearchAt = scheduled + SEARCH_INTERVAL_MS;
      if (scheduled > now) await new Promise((resolve) => setTimeout(resolve, scheduled - now));
      checkCircuit('*');
      return axios.get<typeof payload>('https://www.futunn.com/search-stock/predict', {
        params: { keyword: code, lang: 'zh-cn', site: 'cn' },
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain, */*', Referer: 'https://www.futunn.com/' },
        timeout: 15000, maxContentLength: 5 * 1024 * 1024,
      });
    });
    payload = response.data;
  } catch (error) { throw requestError(error, '*'); }
  if (payload?.code !== 0 || !Array.isArray(payload.data?.quote)) throw new Error('富途股票搜索返回无效数据');
  const matches = payload.data.quote.filter((item) => !!item && typeof item === 'object' && typeof item.stockSymbol === 'string' && item.stockSymbol.toUpperCase() === code.toUpperCase() && typeof item.market === 'string' && item.market.toUpperCase() === exchange);
  const candidates = matches.map((item) => ({ name: item.stockName, stockCode: item.stockSymbol, stockId: item.stockId, marketType: item.marketType, marketLabel: exchange } as StockInfo)).filter((info) => isValidStockInfo(info, code, exchange));
  const unique = new Map(candidates.map((info) => [String(info.stockId), info]));
  if (unique.size !== 1) throw new Error(`富途股票搜索未找到唯一匹配: ${exchange}.${code}`);
  return [...unique.values()][0];
}

async function saveSourceMappings(secid: string, info: StockInfo): Promise<void> {
  await saveFutuMappingForSources(secid, info).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'FUTU_MAPPING_CONFLICT') throw error;
    console.error(`[futu-mapping] ${secid}: 保存板块映射失败:`, error instanceof Error ? error.message : String(error));
  });
}

async function getStockInfo(secid: string): Promise<StockInfo> {
  const cached = stockCache.get(secid);
  if (cached && cached.expires > Date.now()) {
    await saveSourceMappings(secid, cached.info);
    return cached.info;
  }
  const pending = stockPending.get(secid);
  if (pending) return pending;
  const { code, exchange } = getStockRoute(secid);
  const request = (async () => {
    const stored = await lookupFutuMapping(secid).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'FUTU_MAPPING_CONFLICT') throw error;
      return undefined;
    });
    if (isValidStockInfo(stored, code, exchange)) {
      await saveSourceMappings(secid, stored);
      stockCache.set(secid, { info: stored, expires: Date.now() + STOCK_TTL_MS });
      return stored;
    }
    checkCircuit('*');
    let info: StockInfo;
    try {
      info = await searchStockInfo(code, exchange);
    } catch (searchError) {
      // Do not send another request after an upstream authentication or rate-limit response.
      checkCircuit('*');
      try {
        const response = await withSlot(() => axios.get<string>(`https://www.futunn.com/stock/${encodeURIComponent(code)}-${exchange}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, timeout: 15000, maxContentLength: 5 * 1024 * 1024, responseType: 'text' }));
        info = parseFutuStockPage(response.data, code, exchange);
      } catch (pageError) {
        const searchMessage = searchError instanceof Error ? searchError.message : String(searchError);
        const pageMessage = axios.isAxiosError(pageError) ? requestError(pageError, '*').message : pageError instanceof Error ? pageError.message : String(pageError);
        throw new Error(`${searchMessage}; ${pageMessage}`);
      }
    }
    await saveSourceMappings(secid, info);
    if (stockCache.size >= 500) stockCache.delete(stockCache.keys().next().value as string);
    stockCache.set(secid, { info, expires: Date.now() + STOCK_TTL_MS });
    return info;
  })();
  stockPending.set(secid, request);
  try { return await request; } finally { stockPending.delete(secid); }
}

export function resolveFutuStockInfo(secid: string): Promise<StockInfo> {
  return getStockInfo(secid);
}

function formatTime(seconds: number, market: number, klt: number): string {
  const zone = market === 105 || market === 106 ? 'America/New_York' : 'Asia/Shanghai';
  let formatter = timeFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    timeFormatters.set(zone, formatter);
  }
  const parts = formatter.formatToParts(new Date(seconds * 1000));
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}${klt >= 101 ? '' : ` ${part('hour')}:${part('minute')}`}`;
}

function periodStart(date: string, klt: number): string {
  if (klt === 103) return `${date.slice(0, 7)}-01`;
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
}

export async function fetchFutuWebKlines(secid: string, klt: number, options: FutuQuoteOptions): Promise<FutuEastmoneyData> {
  const { market, code, exchange } = getStockRoute(secid);
  const type = KLINE_TYPES[klt];
  if (!type || (options.adjustment ?? 1) !== 1) throw new Error(`富途网页不支持此周期或复权方式: ${klt}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.start) || !/^\d{4}-\d{2}-\d{2}$/.test(options.end) || options.start > options.end || (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1))) throw new Error('富途 K 线日期或数量无效');
  const circuitKey = `${secid}:${type}`;
  checkCircuit(circuitKey);
  const info = await getStockInfo(secid);
  const params: Record<string, string> = { stockId: String(info.stockId), marketType: String(info.marketType), type };
  for (const key of ['marketCode', 'instrumentType', 'subInstrumentType'] as const) if (info[key] !== undefined) params[key] = String(info[key]);
  params._ = String(Date.now());
  let payload: { code?: number; message?: string; data?: { list?: WebBar[] } };
  try {
    const response = await withSlot(() => axios.get<typeof payload>('https://www.futunn.com/quote-api/quote-v2/get-kline', { params, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, text/plain, */*', Referer: `https://www.futunn.com/stock/${encodeURIComponent(code)}-${exchange}`, 'quote-token': signFutuWebParams(params) }, timeout: 20000, maxContentLength: 30 * 1024 * 1024 }));
    payload = response.data;
  } catch (error) { throw requestError(error, circuitKey); }
  if (payload?.code !== 0 || !Array.isArray(payload.data?.list)) {
    const message = typeof payload?.message === 'string' ? `, message=${payload.message.replace(/[\r\n]/g, ' ').slice(0, 100)}` : '';
    throw new Error(`富途网页 K 线返回无效数据 (code=${payload?.code ?? 'unknown'}${message})`);
  }
  const from = klt === 102 || klt === 103 ? periodStart(options.start, klt) : options.start;
  const bars = payload.data.list.filter((bar) => {
    if (!Number.isFinite(bar.k)) throw new Error('富途 K 线时间无效');
    const date = formatTime(bar.k as number, market, klt).slice(0, 10);
    return date >= from && date <= options.end;
  }).sort((a, b) => Number(a.k) - Number(b.k));
  let periods = bars.map((bar) => ({ bar, date: formatTime(bar.k as number, market, klt) }));
  if ((klt === 102 || klt === 103) && periods.length) {
    if (options.limit) periods = periods.slice(-(options.limit + 1));
    const first = periods[0].date;
    const daily = await fetchFutuWebKlines(secid, 101, { start: first, end: '9999-12-31', adjustment: options.adjustment });
    const latestByPeriod = new Map<string, string>();
    for (const line of daily.klines) {
      const date = line.split(',')[0];
      latestByPeriod.set(periodStart(date, klt), date);
    }
    periods = periods.flatMap(({ bar, date }) => {
      const lastTradingDay = latestByPeriod.get(date);
      if (!lastTradingDay) throw new Error(`无法确认富途周期最后交易日: ${date}`);
      return lastTradingDay >= options.start && lastTradingDay <= options.end ? [{ bar, date: lastTradingDay }] : [];
    });
  }
  const selected = options.limit ? periods.slice(-options.limit) : periods;
  if (!selected.length) throw new Error(`富途网页无指定日期 K 线: ${secid}`);
  const seen = new Set<string>();
  const klines = selected.map(({ bar, date }) => {
    if (seen.has(date)) throw new Error('富途 K 线存在重复时间');
    seen.add(date);
    const [open, close, high, low, volume, turnover, last] = [bar.o, bar.c, bar.h, bar.l, bar.v, bar.t, bar.lc].map((value) => value === null || value === undefined || value === '' ? NaN : Number(value));
    if (![open, close, high, low, volume, turnover, last].every(Number.isFinite) || low <= 0 || low > Math.min(open, close) || high < Math.max(open, close) || volume < 0 || turnover < 0 || last <= 0) throw new Error('富途 K 线价格或成交数据无效');
    const eastVolume = market === 0 || market === 1 ? volume / 100 : volume;
    const amplitude = (high - low) / last * 100;
    const change = close - last;
    const changeRate = change / last * 100;
    const turnoverRate = typeof bar.r === 'number' && Number.isFinite(bar.r) ? bar.r * 100 : 0;
    return [date, open, close, high, low, eastVolume, turnover, amplitude, changeRate, change, turnoverRate, eastVolume, turnover, amplitude].join(',');
  });
  return { market, code, name: info.name, preKPrice: Number(selected[0].bar.lc), klines };
}
