import fs from 'fs';
import path from 'path';
import { IReutersDailyFile, IReutersEntriesByRegion, IReutersFetchedEntriesByRegion, IReutersFetchedEntry, IReutersTitleEntry, IReutersTitlesByRegion } from './types';

const DATA_DIR = path.join(process.cwd(), 'src/pages/data/reuters');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function normalizeEntries(payload: unknown, fallbackPublishedAt: string): IReutersTitleEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (typeof item === 'string') {
        return {
          publishedAt: fallbackPublishedAt,
          en: item,
          zh: item,
        };
      }

      if (
        item &&
        typeof item === 'object' &&
        typeof (item as IReutersTitleEntry).en === 'string' &&
        typeof (item as IReutersTitleEntry).zh === 'string'
      ) {
        const entry = item as Partial<IReutersTitleEntry>;
        return {
          publishedAt: typeof entry.publishedAt === 'string' && entry.publishedAt ? entry.publishedAt : fallbackPublishedAt,
          en: entry.en!,
          zh: entry.zh!,
        };
      }

      return null;
    })
    .filter((item): item is IReutersTitleEntry => Boolean(item));
}

function normalizeItems(payload: unknown): Record<string, IReutersEntriesByRegion> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const normalized: Record<string, IReutersEntriesByRegion> = {};

  Object.entries(payload as Record<string, unknown>).forEach(([fetchedAt, regionPayload]) => {
    const regionRecord = regionPayload as Record<string, unknown>;
    normalized[fetchedAt] = {
      us: normalizeEntries(regionRecord?.us, fetchedAt),
      china: normalizeEntries(regionRecord?.china, fetchedAt),
      iran: normalizeEntries(regionRecord?.iran, fetchedAt),
    };
  });

  return normalized;
}

export function normalizeReutersTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getReutersDailyFilePath(date: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `${date}.json`);
}

export function createEmptyDailyFile(date: string): IReutersDailyFile {
  return {
    date,
    latestRunAt: '',
    items: {},
  };
}

export function readReutersDailyFile(date: string): IReutersDailyFile {
  const filePath = getReutersDailyFilePath(date);
  if (!fs.existsSync(filePath)) {
    return createEmptyDailyFile(date);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<IReutersDailyFile>;

  return {
    date,
    latestRunAt: typeof parsed.latestRunAt === 'string' ? parsed.latestRunAt : '',
    items: normalizeItems(parsed.items),
  };
}

export function flattenTitlesByRegion(dailyFile: IReutersDailyFile): IReutersTitlesByRegion {
  const us: string[] = [];
  const china: string[] = [];
  const iran: string[] = [];

  Object.values(dailyFile.items).forEach((titlesByRegion) => {
    us.push(...(titlesByRegion?.us || []).map((item) => item.en));
    china.push(...(titlesByRegion?.china || []).map((item) => item.en));
    iran.push(...(titlesByRegion?.iran || []).map((item) => item.en));
  });

  return { us, china, iran };
}

function filterIncrementalEntries(currentEntries: IReutersTitleEntry[], incrementalTitles: string[]): IReutersTitleEntry[] {
  const incrementalKeys = new Set(incrementalTitles.map((title) => normalizeReutersTitle(title)));
  return currentEntries.filter((entry) => incrementalKeys.has(normalizeReutersTitle(entry.en)));
}

function filterIncrementalFetchedEntries(currentEntries: IReutersFetchedEntry[], incrementalTitles: string[]): IReutersFetchedEntry[] {
  const incrementalKeys = new Set(incrementalTitles.map((title) => normalizeReutersTitle(title)));
  return currentEntries.filter((entry) => incrementalKeys.has(normalizeReutersTitle(entry.title)));
}

function filterIncrementalTitles(currentTitles: string[], existingTitles: string[]): string[] {
  const existingTitleKeys = new Set(existingTitles.map((title) => normalizeReutersTitle(title)));
  const currentSeen = new Set<string>();
  const incrementalTitles: string[] = [];

  currentTitles.forEach((title) => {
    const key = normalizeReutersTitle(title);
    if (!key || existingTitleKeys.has(key) || currentSeen.has(key)) {
      return;
    }

    currentSeen.add(key);
    incrementalTitles.push(title);
  });

  return incrementalTitles;
}

export function computeIncrementalTitles(
  dailyFile: IReutersDailyFile,
  currentTitlesByRegion: IReutersTitlesByRegion
): IReutersTitlesByRegion {
  const existingTitles = flattenTitlesByRegion(dailyFile);

  return {
    us: filterIncrementalTitles(currentTitlesByRegion.us, existingTitles.us),
    china: filterIncrementalTitles(currentTitlesByRegion.china, existingTitles.china),
    iran: filterIncrementalTitles(currentTitlesByRegion.iran, existingTitles.iran),
  };
}

export function computeIncrementalFetchedEntries(
  dailyFile: IReutersDailyFile,
  currentEntriesByRegion: IReutersFetchedEntriesByRegion
): IReutersFetchedEntriesByRegion {
  const incrementalTitles = computeIncrementalTitles(dailyFile, {
    us: currentEntriesByRegion.us.map((entry) => entry.title),
    china: currentEntriesByRegion.china.map((entry) => entry.title),
    iran: currentEntriesByRegion.iran.map((entry) => entry.title),
  });

  return {
    us: filterIncrementalFetchedEntries(currentEntriesByRegion.us, incrementalTitles.us),
    china: filterIncrementalFetchedEntries(currentEntriesByRegion.china, incrementalTitles.china),
    iran: filterIncrementalFetchedEntries(currentEntriesByRegion.iran, incrementalTitles.iran),
  };
}

export function persistReutersRun(
  date: string,
  fetchedAt: string,
  incrementalFetchedEntriesByRegion: IReutersFetchedEntriesByRegion,
  incrementalTranslatedEntriesByRegion: IReutersEntriesByRegion
): {
  filePath: string;
  dailyFile: IReutersDailyFile;
  incremental: IReutersTitlesByRegion;
  incrementalTranslated: IReutersEntriesByRegion;
} {
  const dailyFile = readReutersDailyFile(date);
  const incremental: IReutersTitlesByRegion = {
    us: incrementalFetchedEntriesByRegion.us.map((entry) => entry.title),
    china: incrementalFetchedEntriesByRegion.china.map((entry) => entry.title),
    iran: incrementalFetchedEntriesByRegion.iran.map((entry) => entry.title),
  };
  const incrementalTranslated: IReutersEntriesByRegion = {
    us: filterIncrementalEntries(incrementalTranslatedEntriesByRegion.us, incremental.us),
    china: filterIncrementalEntries(incrementalTranslatedEntriesByRegion.china, incremental.china),
    iran: filterIncrementalEntries(incrementalTranslatedEntriesByRegion.iran, incremental.iran),
  };

  dailyFile.latestRunAt = fetchedAt;
  if (incrementalTranslated.us.length > 0 || incrementalTranslated.china.length > 0 || incrementalTranslated.iran.length > 0) {
    dailyFile.items[fetchedAt] = {
      us: [...incrementalTranslated.us],
      china: [...incrementalTranslated.china],
      iran: [...incrementalTranslated.iran],
    };
  }

  const filePath = getReutersDailyFilePath(date);
  fs.writeFileSync(filePath, JSON.stringify(dailyFile, null, 2), 'utf-8');

  return {
    filePath,
    dailyFile,
    incremental,
    incrementalTranslated,
  };
}
