import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { IReutersFetchResult, IReutersFetchedEntriesByRegion, IReutersFetchedEntry, IReutersTitlesByRegion, ReutersRegion } from './types';

dayjs.extend(utc);
dayjs.extend(timezone);

const REUTERS_URLS: Record<ReutersRegion, string> = {
  us: 'https://www.reuters.com/world/us/',
  china: 'https://www.reuters.com/world/china/',
  iran: 'https://www.reuters.com/world/iran/',
};

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 15000;
const REUTERS_SECTION_API = 'https://www.reuters.com/pf/api/v3/content/fetch/articles-by-section-alias-or-id-v1';
const SHANGHAI_TIMEZONE = 'Asia/Shanghai';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, '\'')
    .replace(/&#39;/g, '\'')
    .replace(/&apos;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeTitle(title: string): string {
  return decodeHtmlEntities(title)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyHeadline(title: string): boolean {
  if (!title) return false;
  if (title.length < 12 || title.length > 240) return false;
  if (/^(reuters|world|united states|china|iran)$/i.test(title)) return false;
  if (/latest news|headlines/i.test(title) && /reuters/i.test(title)) return false;
  return true;
}

function normalizePublishedAt(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = value > 1e12 ? dayjs(value) : dayjs.unix(value);
    return date.isValid() ? date.tz(SHANGHAI_TIMEZONE).format('YYYY-MM-DD HH:mm:ss') : '';
  }

  if (typeof value === 'string' && value.trim()) {
    const date = dayjs(value);
    return date.isValid() ? date.tz(SHANGHAI_TIMEZONE).format('YYYY-MM-DD HH:mm:ss') : '';
  }

  return '';
}

function dedupeEntries(entries: IReutersFetchedEntry[]): IReutersFetchedEntry[] {
  const entryMap = new Map<string, IReutersFetchedEntry>();

  entries.forEach((entry) => {
    const normalizedTitle = normalizeTitle(entry.title);
    if (!isLikelyHeadline(normalizedTitle)) {
      return;
    }

    const key = normalizedTitle.toLowerCase();
    const normalizedEntry: IReutersFetchedEntry = {
      title: normalizedTitle,
      publishedAt: entry.publishedAt,
    };

    if (!entryMap.has(key)) {
      entryMap.set(key, normalizedEntry);
      return;
    }

    const existing = entryMap.get(key)!;
    if (!existing.publishedAt && normalizedEntry.publishedAt) {
      entryMap.set(key, normalizedEntry);
    }
  });

  return Array.from(entryMap.values());
}

function dedupeTitles(titles: string[]): string[] {
  return dedupeEntries(titles.map((title) => ({ title, publishedAt: '' }))).map((entry) => entry.title);
}

function collectHeadlineValues(payload: unknown, output: string[]): void {
  if (!payload) {
    return;
  }

  if (typeof payload === 'string') {
    return;
  }

  if (Array.isArray(payload)) {
    payload.forEach((item) => collectHeadlineValues(item, output));
    return;
  }

  if (typeof payload === 'object') {
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      if (key === 'headline' && typeof value === 'string') {
        output.push(value);
        return;
      }
      collectHeadlineValues(value, output);
    });
  }
}

function extractTitlesFromJsonLd(html: string): string[] {
  const titles: string[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(regex)) {
    const rawContent = match[1]?.trim();
    if (!rawContent) {
      continue;
    }

    try {
      const parsed = JSON.parse(rawContent) as unknown;
      collectHeadlineValues(parsed, titles);
    } catch (error) {
      console.warn('⚠️ Reuters JSON-LD parse failed:', error);
    }
  }

  return titles;
}

function extractTitlesFromHeadlineField(html: string): string[] {
  const titles: string[] = [];
  const regex = /"headline"\s*:\s*"((?:\\"|[^"])*)"/g;

  for (const match of html.matchAll(regex)) {
    const rawTitle = match[1];
    if (!rawTitle) {
      continue;
    }

    titles.push(rawTitle.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }

  return titles;
}

function buildArticleHrefPattern(region: ReutersRegion): RegExp {
  if (region === 'us') {
    return /(?:https:\/\/www\.reuters\.com)?\/world\/us\/[^"'?#<\s]+/i;
  }

  if (region === 'china') {
    return /(?:https:\/\/www\.reuters\.com)?\/world\/china\/[^"'?#<\s]+/i;
  }

  return /(?:https:\/\/www\.reuters\.com)?\/world\/iran\/[^"'?#<\s]+/i;
}

function stripInnerTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitlesFromAnchors(html: string, region: ReutersRegion): string[] {
  const titles: string[] = [];
  const hrefPattern = buildArticleHrefPattern(region);
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const attrs = match[1] || '';
    const innerHtml = match[2] || '';
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const href = hrefMatch?.[1] || '';
    if (!hrefPattern.test(href)) {
      continue;
    }

    const ariaMatch = attrs.match(/aria-label=["']([^"']+)["']/i);
    if (ariaMatch?.[1]) {
      titles.push(ariaMatch[1]);
    }

    const text = stripInnerTags(innerHtml);
    if (text) {
      titles.push(text);
    }
  }

  return titles;
}

function extractReutersTitles(html: string, region: ReutersRegion): string[] {
  return dedupeTitles([
    ...extractTitlesFromJsonLd(html),
    ...extractTitlesFromHeadlineField(html),
    ...extractTitlesFromAnchors(html, region),
  ]);
}

function buildSectionApiUrl(region: ReutersRegion): string {
  const sectionIdMap: Record<ReutersRegion, string> = {
    us: '/world/us',
    china: '/world/china',
    iran: '/world/iran',
  };

  const query = {
    section_id: sectionIdMap[region],
    size: 30,
    website: 'reuters',
    fetch_type: 'section',
  };

  return `${REUTERS_SECTION_API}?query=${encodeURIComponent(JSON.stringify(query))}`;
}

function pickStringFields(record: Record<string, unknown>, fieldNames: string[]): string | null {
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

function extractTitlesFromArticleList(payload: unknown): string[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const titles: string[] = [];
  payload.forEach((article) => {
    if (!article || typeof article !== 'object') {
      return;
    }

    const record = article as Record<string, unknown>;
    const title =
      pickStringFields(record, ['basic_headline', 'headline', 'title']) ||
      pickStringFields(record, ['promo_headline']) ||
      pickStringFields(record, ['short_description']);

    if (title) {
      titles.push(title);
    }
  });

  return dedupeTitles(titles);
}

function pickDateFields(record: Record<string, unknown>, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const normalized = normalizePublishedAt(record[fieldName]);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function extractEntriesFromArticleList(payload: unknown): IReutersFetchedEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  const entries: IReutersFetchedEntry[] = [];
  payload.forEach((article) => {
    if (!article || typeof article !== 'object') {
      return;
    }

    const record = article as Record<string, unknown>;
    const title =
      pickStringFields(record, ['basic_headline', 'headline', 'title']) ||
      pickStringFields(record, ['promo_headline']) ||
      pickStringFields(record, ['short_description']);

    if (!title) {
      return;
    }

    const publishedAt = pickDateFields(record, [
      'display_time',
      'published_time',
      'publish_time',
      'publish_date',
      'first_publish_date',
      'updated_time',
      'updated_date',
      'versionCreated',
      'date',
      'canonical_timestamp',
    ]);

    entries.push({
      title,
      publishedAt,
    });
  });

  return dedupeEntries(entries);
}

async function fetchReutersRegionFromApi(region: ReutersRegion): Promise<IReutersFetchResult> {
  const url = buildSectionApiUrl(region);
  const { signal, cleanup } = createAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        referer: REUTERS_URLS[region],
        'user-agent': DEFAULT_USER_AGENT,
      },
      redirect: 'follow',
      signal,
    });

    const rawText = await response.text();
    if (!response.ok) {
      return {
        region,
        url,
        entries: [],
        titles: [],
        statusCode: response.status,
        errorMessage: `Reuters API failed: ${response.status} ${rawText.slice(0, 180)}`,
      };
    }

    const parsed = JSON.parse(rawText) as {
      arcResult?: { articles?: unknown[] };
      result?: { articles?: unknown[] };
    };

    const entries = extractEntriesFromArticleList(parsed.arcResult?.articles || parsed.result?.articles || []);
    const titles = entries.map((entry) => entry.title);
    return {
      region,
      url,
      entries,
      titles,
      statusCode: response.status,
      errorMessage: titles.length ? undefined : 'Reuters API returned no titles',
    };
  } catch (error) {
    return {
      region,
      url,
      entries: [],
      titles: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    cleanup();
  }
}

async function fetchReutersRegionFromHtml(region: ReutersRegion): Promise<IReutersFetchResult> {
  const url = REUTERS_URLS[region];
  const { signal, cleanup } = createAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'cache-control': 'no-cache',
        pragma: 'no-cache',
        referer: 'https://www.reuters.com/',
        'upgrade-insecure-requests': '1',
        'user-agent': DEFAULT_USER_AGENT,
      },
      redirect: 'follow',
      signal,
    });

    const html = await response.text();
    if (!response.ok) {
      return {
        region,
        url,
        entries: [],
        titles: [],
        statusCode: response.status,
        errorMessage: `Reuters HTML failed: ${response.status} ${html.slice(0, 180)}`,
      };
    }

    const titles = extractReutersTitles(html, region);
    return {
      region,
      url,
      entries: titles.map((title) => ({ title, publishedAt: '' })),
      titles,
      statusCode: response.status,
      errorMessage: titles.length ? undefined : 'No titles extracted from Reuters HTML',
    };
  } catch (error) {
    return {
      region,
      url,
      entries: [],
      titles: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    cleanup();
  }
}

function createAbortSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildEmptyTitlesByRegion(): IReutersTitlesByRegion {
  return {
    us: [],
    china: [],
    iran: [],
  };
}

export function buildEmptyFetchedEntriesByRegion(): IReutersFetchedEntriesByRegion {
  return {
    us: [],
    china: [],
    iran: [],
  };
}

export async function fetchReutersRegion(region: ReutersRegion): Promise<IReutersFetchResult> {
  const apiResult = await fetchReutersRegionFromApi(region);
  if (apiResult.titles.length > 0) {
    return apiResult;
  }

  const htmlResult = await fetchReutersRegionFromHtml(region);
  if (htmlResult.titles.length > 0) {
    return htmlResult;
  }

  return {
    region,
    url: apiResult.url,
    entries: [],
    titles: [],
    statusCode: apiResult.statusCode || htmlResult.statusCode,
    errorMessage: [apiResult.errorMessage, htmlResult.errorMessage].filter(Boolean).join(' | '),
  };
}
