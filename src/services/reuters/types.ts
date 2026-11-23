export type ReutersRegion = 'us' | 'china' | 'iran';

export interface IReutersFetchedEntry {
  title: string;
  publishedAt: string;
  publishedAtSource?: 'rsshub' | 'google-news';
  url?: string;
}

export interface IReutersFetchedEntriesByRegion {
  us: IReutersFetchedEntry[];
  china: IReutersFetchedEntry[];
  iran: IReutersFetchedEntry[];
}

export interface IReutersTitleEntry {
  publishedAt: string;
  publishedAtSource?: 'rsshub' | 'google-news';
  en: string;
  zh: string;
  url?: string;
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
  sources?: ReutersSourceStats;
  statusCode?: number;
  errorMessage?: string;
}

export interface ReutersSourceStatus {
  count: number;
  error?: string;
}

export interface ReutersSourceStats {
  direct: ReutersSourceStatus;
  rsshub: ReutersSourceStatus;
  googleNews: ReutersSourceStatus;
}

export interface IReutersRunResult {
  executedAt: string;
  date: string;
  sourceMode?: 'all' | 'google-news';
  filePath: string | null;
  fetched: IReutersTitlesByRegion;
  translated: IReutersEntriesByRegion;
  incremental: IReutersTitlesByRegion;
  incrementalTranslated: IReutersEntriesByRegion;
  sourcesByRegion?: Record<ReutersRegion, ReutersSourceStats>;
  emailSent: boolean;
  emailSkippedReason?: string;
  errors: string[];
}
