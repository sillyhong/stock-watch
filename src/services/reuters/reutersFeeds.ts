import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { IReutersFetchedEntry, ReutersRegion } from './types';
import { normalizeReutersArticleUrl, normalizeReutersNewsUrl } from './reutersUrl';

dayjs.extend(utc);
dayjs.extend(timezone);

type FeedSource = 'rsshub' | 'google-news';

export function buildReutersFeedUrl(source: FeedSource, region: ReutersRegion): string {
  if (source === 'rsshub') {
    const base = (process.env.REUTERS_RSSHUB_BASE_URL || 'https://rsshub.app').replace(/\/+$/, '');
    const rsshubRegion = region === 'iran' ? 'middle-east' : region;
    return `${base}/reuters/world/${rsshubRegion}`;
  }
  const params = new URLSearchParams({
    q: `site:reuters.com/world/${region} when:7d`,
    hl: 'en-US', gl: 'US', ceid: 'US:en',
  });
  return `https://news.google.com/rss/search?${params}`;
}

export async function fetchReutersFeed(source: FeedSource, region: ReutersRegion): Promise<{ entries: IReutersFetchedEntry[]; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(buildReutersFeedUrl(source, region), {
      headers: { accept: 'application/rss+xml, application/xml, text/xml' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    if (XMLValidator.validate(xml) !== true) throw new Error('Invalid RSS XML');
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false }).parse(xml);
    if (!parsed?.rss?.channel) throw new Error('Missing RSS channel');
    const items = parsed.rss.channel.item;
    const itemList = Array.isArray(items) ? items : items ? [items] : [];
    const entries: IReutersFetchedEntry[] = itemList
      .flatMap((item: Record<string, unknown>) => {
        if (typeof item.title !== 'string' || typeof item.link !== 'string') return [];
        if (source === 'rsshub' && region === 'iran' && !/\b(iran|iranian|tehran|persian gulf)\b/i.test(item.title)) return [];
        if (source === 'google-news') {
          const publisher = item.source as Record<string, unknown> | undefined;
          if (typeof publisher !== 'object' || publisher === null || publisher['#text'] !== 'Reuters' || !normalizeReutersArticleUrl(String(publisher['@_url'] || '') + '/article')) return [];
        }
        const url = source === 'google-news' ? normalizeReutersNewsUrl(item.link) : normalizeReutersArticleUrl(item.link);
        if (!url) return [];
        const date = typeof item.pubDate === 'string' ? dayjs(item.pubDate) : null;
        return [{
          title: source === 'google-news' ? item.title.replace(/\s+-\s+Reuters\s*$/i, '').trim() : item.title.trim(),
          publishedAt: date?.isValid() ? date.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') : '',
          publishedAtSource: date?.isValid() ? source : undefined,
          url,
        }];
      });
    return { entries, error: itemList.length > 0 && entries.length === 0 ? 'Feed contained no valid Reuters items' : undefined };
  } catch (error) {
    return { entries: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}
