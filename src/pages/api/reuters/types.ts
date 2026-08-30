export type ReutersRegion = 'us' | 'china' | 'iran';

export interface IReutersFetchedEntry {
  title: string;
  publishedAt: string;
}

export interface IReutersFetchedEntriesByRegion {
  us: IReutersFetchedEntry[];
  china: IReutersFetchedEntry[];
  iran: IReutersFetchedEntry[];
}

export interface IReutersTitleEntry {
  publishedAt: string;
  en: string;
  zh: string;
}

export interface IReutersEntriesByRegion {
  us: IReutersTitleEntry[];
  china: IReutersTitleEntry[];
  iran: IReutersTitleEntry[];
}

export interface IReutersTitlesByRegion {
  us: string[];
  china: string[];
  iran: string[];
}

export interface IReutersDailyFile {
  date: string;
  latestRunAt: string;
  items: Record<string, IReutersEntriesByRegion>;
}

export interface IReutersFetchResult {
  region: ReutersRegion;
  url: string;
  entries: IReutersFetchedEntry[];
  titles: string[];
  statusCode?: number;
  errorMessage?: string;
}

export interface IReutersRunResult {
  executedAt: string;
  date: string;
  filePath: string | null;
  fetched: IReutersTitlesByRegion;
  translated: IReutersEntriesByRegion;
  incremental: IReutersTitlesByRegion;
  incrementalTranslated: IReutersEntriesByRegion;
  emailSent: boolean;
  emailSkippedReason?: string;
  errors: string[];
}
