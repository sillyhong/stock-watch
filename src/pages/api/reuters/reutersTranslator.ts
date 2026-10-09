import axios from 'axios';
import { IReutersEntriesByRegion, IReutersFetchedEntriesByRegion, IReutersTitleEntry } from './types';

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_TRANSLATE_URL = 'https://api.mymemory.translated.net/get';
const TRANSLATE_TIMEOUT_MS = 15000;
const TRANSLATE_CONCURRENCY = 4;
const REPEATED_ERROR_ABORT_THRESHOLD = 2;

class TranslationAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranslationAbortError';
  }
}

type TranslationProvider = 'primary' | 'fallback';

interface ITranslationErrorSequence {
  fingerprint: string;
  count: number;
}

interface ITranslationErrorTracker {
  aborted: boolean;
  errorSequences: Record<TranslationProvider, ITranslationErrorSequence | null>;
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

function getErrorFingerprint(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return `axios:${error.code || 'unknown'}:${error.response?.status || 'unknown'}:${error.message}`;
  }

  if (error instanceof Error) {
    return `${error.name}:${error.message}`;
  }

  return String(error);
}

function createTranslationErrorTracker(): ITranslationErrorTracker {
  return {
    aborted: false,
    errorSequences: {
      primary: null,
      fallback: null,
    },
  };
}

function markTranslateAttemptSuccess(tracker: ITranslationErrorTracker, provider: TranslationProvider): void {
  tracker.errorSequences[provider] = null;
}

function recordTranslateAttemptError(
  tracker: ITranslationErrorTracker,
  provider: TranslationProvider,
  error: unknown
): number {
  if (tracker.aborted) {
    throw new TranslationAbortError('Translation aborted after repeated identical errors');
  }

  const fingerprint = getErrorFingerprint(error);
  const previous = tracker.errorSequences[provider];
  const count = previous?.fingerprint === fingerprint ? previous.count + 1 : 1;
  tracker.errorSequences[provider] = { fingerprint, count };

  if (count >= REPEATED_ERROR_ABORT_THRESHOLD) {
    tracker.aborted = true;
  }

  return count;
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

async function translateTitle(title: string, tracker: ITranslationErrorTracker): Promise<string> {
  if (tracker.aborted) {
    throw new TranslationAbortError('Translation aborted after repeated identical errors');
  }

  try {
    const translated = await translateWithMyMemory(title);
    markTranslateAttemptSuccess(tracker, 'primary');
    return translated;
  } catch (primaryError) {
    const errorCount = recordTranslateAttemptError(tracker, 'primary', primaryError);
    console.error(`⚠️ Reuters title translate primary failed (same error count=${errorCount}):`, primaryError);
    if (tracker.aborted) {
      throw new TranslationAbortError('Translation aborted after repeated identical primary errors');
    }
  }

  if (tracker.aborted) {
    throw new TranslationAbortError('Translation aborted after repeated identical errors');
  }

  try {
    const translated = await translateWithGoogle(title);
    markTranslateAttemptSuccess(tracker, 'fallback');
    return translated;
  } catch (fallbackError) {
    const errorCount = recordTranslateAttemptError(tracker, 'fallback', fallbackError);
    console.error(`⚠️ Reuters title translate fallback failed (same error count=${errorCount}):`, fallbackError);
    if (tracker.aborted) {
      throw new TranslationAbortError('Translation aborted after repeated identical fallback errors');
    }
    return title;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  tracker?: ITranslationErrorTracker
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      if (tracker?.aborted) {
        throw new TranslationAbortError('Translation aborted after repeated identical errors');
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
  tracker: ITranslationErrorTracker
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
  const tracker = createTranslationErrorTracker();

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
    if (error instanceof TranslationAbortError) {
      console.error('⚠️ Reuters translation aborted after repeated identical errors. Fallback to raw titles.');
      return buildRawEntriesByRegion(entriesByRegion);
    }

    throw error;
  }
}
