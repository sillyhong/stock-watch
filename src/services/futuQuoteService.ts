import axios from 'axios';
import dayjs from 'dayjs';
import { fetchFutuWebKlines } from './futuWebQuoteService';

type Bar = { time_key?: number; date?: number; open?: number; close?: number; high?: number; low?: number; volume?: number; turnover?: number; last_close?: number; change_rate?: number; turnover_rate?: number; name?: string; sc_name?: string };
type Payload = { ret_code?: number; ret_msg?: string; data?: { kline_list?: Bar[]; next_time?: number }; pagination?: { has_more?: boolean; next_page_token?: string } };
type EastmoneyData = { code: string; market: number; name: string; preKPrice: number; klines: string[] };

const types: Record<number, number> = { 5: 6, 15: 7, 30: 8, 60: 9, 101: 2, 102: 3, 103: 4 };
let cachedToken = '';
let tokenExpiresAt = 0;
let refreshing: Promise<string> | undefined;
let active = 0;
const waiters: Array<() => void> = [];

export function futuFallbackEnabled(): boolean {
  return process.env.FUTU_FALLBACK_ENABLED !== 'false';
}

export function eastmoneyToFutuSymbol(secid: string): string {
  const match = /^(0|1|105|106|116)\.([A-Za-z0-9.-]+)$/.exec(secid);
  if (!match) throw new Error(`不支持的东方财富股票代码: ${secid}`);
  const [, market, code] = match;
  if ((market === '0' || market === '1') && !/^\d{6}$/.test(code)) throw new Error(`无效的 A 股代码: ${secid}`);
  if (market === '116' && !/^\d{5}$/.test(code)) throw new Error(`无效的港股代码: ${secid}`);
  const prefix = market === '1' ? 'SH' : market === '0' ? (/^(4|8|92)/.test(code) ? 'BJ' : 'SZ') : market === '116' ? 'HK' : 'US';
  return `${prefix}.${code}`;
}

async function accessToken(forceRefresh = false): Promise<string> {
  const fixed = process.env.FUTU_ACCESS_TOKEN;
  const clientId = process.env.FUTU_CLIENT_ID;
  const refreshToken = process.env.FUTU_REFRESH_TOKEN;
  if (!forceRefresh && cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (!forceRefresh && fixed) return fixed;
  if (!clientId || !refreshToken) throw new Error('未配置富途 OAuth 凭据（FUTU_CLIENT_ID 和 FUTU_REFRESH_TOKEN）');
  if (!refreshing) {
    refreshing = axios.post('https://webapi.futunn.com/oauth2/token', new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000,
    }).then(({ data }) => {
      if (typeof data?.access_token !== 'string' || !data.access_token || !Number.isFinite(Number(data.expires_in))) throw new Error('富途 OAuth 返回无效的令牌');
      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000;
      return cachedToken;
    }).catch(() => { throw new Error('富途 OAuth 刷新失败，请检查授权是否过期'); }).finally(() => { refreshing = undefined; });
  }
  return refreshing;
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiters.push(resolve));
  else active++;
  try { return await fn(); } finally {
    const next = waiters.shift();
    if (next) next(); else active--;
  }
}

function formatTime(bar: Bar, market: number, klt: number): string {
  if (klt >= 101 && /^\d{8}$/.test(String(bar.date))) return String(bar.date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  if (!Number.isFinite(bar.time_key)) throw new Error('富途 K 线缺少时间');
  const zone = market === 105 || market === 106 ? 'America/New_York' : 'Asia/Shanghai';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(bar.time_key as number));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}${klt >= 101 ? '' : ` ${get('hour')}:${get('minute')}`}`;
}

export async function fetchFutuKlines(secid: string, klt: number, options: { start: string; end: string; limit?: number; adjustment?: number }): Promise<EastmoneyData> {
  const provider = process.env.FUTU_QUOTE_PROVIDER || 'web';
  if (provider === 'web') return fetchFutuWebKlines(secid, klt, options);
  if (provider !== 'openapi') throw new Error('无效的富途行情提供方式');
  return fetchFutuOpenApiKlines(secid, klt, options);
}

async function fetchFutuOpenApiKlines(secid: string, klt: number, options: { start: string; end: string; limit?: number; adjustment?: number }): Promise<EastmoneyData> {
  const symbol = eastmoneyToFutuSymbol(secid);
  const type = types[klt];
  if (!type || ![0, 1, 2].includes(options.adjustment ?? 1)) throw new Error(`富途不支持的周期或复权方式: ${klt}`);
  const market = Number(secid.split('.')[0]);
  const intraday = klt < 101;
  const end = intraday ? dayjs(options.end).add(1, 'day').format('YYYY-MM-DD') : options.end;
  const query = new URLSearchParams({ start: options.start, end, ktype: String(type), autype: String(options.adjustment ?? 1), num: '370', extended_time: '0' });
  const bars: Bar[] = [];
  const cursors = new Set<string>();
  for (let page = 0; page < 30; page++) {
    const payload = await withSlot(async () => {
      let token = await accessToken();
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await axios.get<Payload>(`https://webapi.futunn.com/api/v1.0/quote/${encodeURIComponent(symbol)}/history-kline?${query}`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
          return response.data;
        } catch (error) {
          if (attempt === 0 && axios.isAxiosError(error) && error.response?.status === 401 && process.env.FUTU_CLIENT_ID && process.env.FUTU_REFRESH_TOKEN) { token = await accessToken(true); continue; }
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          throw new Error(`富途行情请求失败${status ? ` HTTP ${status}` : ''}`);
        }
      }
      throw new Error('富途认证失败');
    });
    if (payload.ret_code !== 0 || !Array.isArray(payload.data?.kline_list)) throw new Error(`富途行情接口失败 (code=${payload.ret_code ?? 'unknown'})`);
    if (typeof payload.pagination?.has_more !== 'boolean') throw new Error('富途历史 K 线缺少分页状态');
    bars.push(...payload.data.kline_list);
    if (!payload.pagination?.has_more) break;
    if (options.limit && bars.length >= options.limit) break;
    const cursor = payload.pagination.next_page_token || String(payload.data.next_time || '');
    if (!cursor || cursors.has(cursor) || page === 29) throw new Error('富途历史 K 线分页不完整');
    cursors.add(cursor);
    query.delete('page_token'); query.delete('next_time');
    if (payload.pagination.next_page_token) query.set('page_token', cursor); else query.set('next_time', cursor);
  }
  if (!bars.length) throw new Error(`富途无 K 线数据: ${symbol}`);
  const sorted = bars.sort((a, b) => Number(a.time_key) - Number(b.time_key));
  const selected = options.limit ? sorted.slice(-options.limit) : sorted;
  const seen = new Set<string>();
  const klines = selected.map((bar) => {
    const date = formatTime(bar, market, klt);
    if (seen.has(date)) throw new Error('富途 K 线存在重复时间');
    seen.add(date);
    const values = [bar.open, bar.close, bar.high, bar.low, bar.volume, bar.turnover];
    if (!Number.isFinite(bar.time_key) || values.some((value) => typeof value !== 'number' || !Number.isFinite(value)) || Number(bar.low) <= 0 || Number(bar.low) > Math.min(Number(bar.open), Number(bar.close)) || Number(bar.high) < Math.max(Number(bar.open), Number(bar.close)) || Number(bar.volume) < 0 || Number(bar.turnover) < 0) throw new Error('富途 K 线价格或成交数据无效');
    const last = Number(bar.last_close) || 0;
    const amplitude = last ? (Number(bar.high) - Number(bar.low)) / last * 100 : 0;
    return [date, bar.open, bar.close, bar.high, bar.low, bar.volume, bar.turnover, amplitude, bar.change_rate ?? 0, last ? Number(bar.close) - last : 0, bar.turnover_rate ?? 0, bar.volume, bar.turnover, amplitude].join(',');
  });
  return { market, code: secid.split('.')[1], name: selected[0].sc_name || selected[0].name || symbol, preKPrice: Number(selected[0].last_close) || 0, klines };
}
