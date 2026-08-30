import axios from 'axios';
import { IReutersEntriesByRegion, IReutersFetchedEntriesByRegion, IReutersTitleEntry } from './types';

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_TRANSLATE_URL = 'https://api.mymemory.translated.net/get';
const TRANSLATE_TIMEOUT_MS = 15000;
const TRANSLATE_CONCURRENCY = 4;
const BLOCK_ABORT_THRESHOLD = 2;

class TranslationBlockedAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationBlockedAbortError';
  }
}

interface ITranslationBlockTracker {
  aborted: boolean;
  consecutiveBlocks: number;
}

function createEmptyEntriesByRegion(): IReutersEntriesByRegion {
  return {
    us: [],
    china: [],
    iran: [],
  };
}

function isBlockedHtml(payload: unknown): boolean {
  return typeof payload === 'string' && /<html|Sorry\.\.\.|automated queries/i.test(payload);
}

function isBlockedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /blocked|challenge|captcha|interstitial|automated queries/i.test(message);
}

function createBlockTracker(): ITranslationBlockTracker {
  return {
    aborted: false,
    consecutiveBlocks: 0,
  };
}

function markTranslateAttemptSuccess(tracker: ITranslationBlockTracker): void {
  tracker.consecutiveBlocks = 0;
}

function handleTranslateAttemptError(tracker: ITranslationBlockTracker, error: unknown): void {
  if (tracker.aborted) {
    throw new TranslationBlockedAbortError('Translation aborted after consecutive block responses');
  }

  if (isBlockedError(error)) {
    tracker.consecutiveBlocks += 1;
    if (tracker.consecutiveBlocks >= BLOCK_ABORT_THRESHOLD) {
      tracker.aborted = true;
      throw new TranslationBlockedAbortError('Translation aborted after consecutive block responses');
    }
    return;
  }

  tracker.consecutiveBlocks = 0;
}

async function translateWithMyMemory(title: string): Promise<string> {
  const response = await axios.get(MYMEMORY_TRANSLATE_URL, {
    timeout: TRANSLATE_TIMEOUT_MS,
    params: {
      q: title,
      langpair: 'en|zh-CN',
    },
    headers: {
      'User-Agent': 'Mozilla/5.0',
      accept: 'application/json',
    },
  });

  const data = response.data as {
    responseData?: {
      translatedText?: string;
    };
    responseStatus?: number;
  };

  const translated = data?.responseData?.translatedText?.trim();
  if (data?.responseStatus !== 200 || !translated) {
    throw new Error(`MyMemory translate invalid response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return translated;
}

async function translateWithGoogle(title: string): Promise<string> {
  const response = await axios.get(GOOGLE_TRANSLATE_URL, {
    timeout: TRANSLATE_TIMEOUT_MS,
    params: {
      client: 'gtx',
      sl: 'en',
      tl: 'zh-CN',
      dt: 't',
      q: title,
    },
    headers: {
      'User-Agent': 'Mozilla/5.0',
      accept: 'application/json,text/plain,*/*',
    },
    responseType: 'text',
    transformResponse: [(raw) => raw],
  });

  const rawData = response.data as unknown;
  if (isBlockedHtml(rawData)) {
    throw new Error('Google translate blocked with HTML challenge');
  }

  const parsed = typeof rawData === 'string' ? JSON.parse(rawData) as unknown : rawData;
  if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
    throw new Error(`Google translate invalid response: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  const translated = (parsed[0] as unknown[])
    .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
    .join('')
    .trim();

  if (!translated) {
    throw new Error('Google translate returned empty translation');
  }

  return translated;
}

async function translateTitle(title: string, tracker: ITranslationBlockTracker): Promise<string> {
  if (tracker.aborted) {
    throw new TranslationBlockedAbortError('Translation aborted after consecutive block responses');
  }

  try {
    const translated = await translateWithMyMemory(title);
    markTranslateAttemptSuccess(tracker);
    return translated;
  } catch (primaryError) {
    handleTranslateAttemptError(tracker, primaryError);
    console.error('⚠️ Reuters title translate primary failed:', primaryError);
  }

  if (tracker.aborted) {
    throw new TranslationBlockedAbortError('Translation aborted after consecutive block responses');
  }

  try {
    const translated = await translateWithGoogle(title);
    markTranslateAttemptSuccess(tracker);
    return translated;
  } catch (fallbackError) {
    handleTranslateAttemptError(tracker, fallbackError);
    console.error('⚠️ Reuters title translate fallback failed:', fallbackError);
    return title;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  tracker?: ITranslationBlockTracker
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      if (tracker?.aborted) {
        throw new TranslationBlockedAbortError('Translation aborted after consecutive block responses');
      }

      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function buildRawEntries(entries: IReutersFetchedEntriesByRegion['us']): IReutersTitleEntry[] {
  return entries.map((entry) => ({
    publishedAt: entry.publishedAt,
    en: entry.title,
    zh: entry.title,
  }));
}

function buildRawEntriesByRegion(entriesByRegion: IReutersFetchedEntriesByRegion): IReutersEntriesByRegion {
  return {
    us: buildRawEntries(entriesByRegion.us),
    china: buildRawEntries(entriesByRegion.china),
    iran: buildRawEntries(entriesByRegion.iran),
  };
}

async function translateRegionTitles(
  entries: IReutersFetchedEntriesByRegion['us'],
  tracker: ITranslationBlockTracker
): Promise<IReutersTitleEntry[]> {
  return mapWithConcurrency(entries, TRANSLATE_CONCURRENCY, async (entry) => {
    const title = entry.title;
    const zh = await translateTitle(title, tracker);
    return {
      publishedAt: entry.publishedAt,
      en: title,
      zh,
    };
  }, tracker);
}

export async function translateReutersTitlesByRegion(entriesByRegion: IReutersFetchedEntriesByRegion): Promise<IReutersEntriesByRegion> {
  const tracker = createBlockTracker();

  try {
    const translated = createEmptyEntriesByRegion();
    const [us, china, iran] = await Promise.all([
      translateRegionTitles(entriesByRegion.us, tracker),
      translateRegionTitles(entriesByRegion.china, tracker),
      translateRegionTitles(entriesByRegion.iran, tracker),
    ]);
    translated.us = us;
    translated.china = china;
    translated.iran = iran;
    return translated;
  } catch (error) {
    if (error instanceof TranslationBlockedAbortError) {
      console.error('⚠️ Reuters translation aborted after consecutive block responses. Fallback to raw titles.');
      return buildRawEntriesByRegion(entriesByRegion);
    }

    throw error;
  }
}
