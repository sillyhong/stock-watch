export type MarketCode = "ALL" | "A" | "HK" | "US";
export type IntervalCode = "ALL" | "DAY" | "5M" | "15M" | "30M" | "60M" | "BACKTREND";
export type FeatureCode = "ALL" | "RSI" | "MACD" | "BOLL" | "MA" | "RISE" | "MAIN_TREND" | "REUTERS" | "AI";

export type ApiParam = {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "date";
  required: boolean;
  defaultValue?: string | number | boolean;
  description?: string;
};

export type ApiTaskDefinition = {
  id: string;
  title: string;
  market: MarketCode;
  marketLabel: string;
  interval: Exclude<IntervalCode, "ALL">;
  intervalLabel: string;
  feature: Exclude<FeatureCode, "ALL">;
  featureLabel: string;
  purpose: string;
  endpoint: string;
  schedule?: {
    label: string;
    cron: string;
    timezone: string;
  };
  capabilities: {
    immediate: boolean;
    start: boolean;
    stop: boolean;
    status: boolean;
  };
  sideEffects?: string[];
  params?: ApiParam[];
};

const marketMeta: Record<Exclude<MarketCode, "ALL">, { label: string; path: string }> = {
  A: { label: "A股", path: "a" },
  HK: { label: "港股", path: "hk" },
  US: { label: "美股", path: "us" },
};

const intervalMeta: Record<Exclude<IntervalCode, "ALL">, { label: string; schedule: string }> = {
  DAY: { label: "日线", schedule: "工作日 · 日线任务" },
  "5M": { label: "5分钟", schedule: "交易时段 · 每 5 分钟" },
  "15M": { label: "15分钟", schedule: "交易时段 · 每 15 分钟" },
  "30M": { label: "30分钟", schedule: "交易时段 · 每 30 分钟" },
  "60M": { label: "60分钟", schedule: "交易时段 · 每 60 分钟" },
  BACKTREND: { label: "回测", schedule: "工作日 · 盘后回测" },
};

const featureMeta: Record<Exclude<FeatureCode, "ALL">, string> = {
  RSI: "RSI",
  MACD: "MACD",
  BOLL: "BOLL",
  MA: "均线",
  RISE: "涨幅",
  MAIN_TREND: "主涨段",
  REUTERS: "Reuters",
  AI: "AI分析",
};

function timerTask(input: {
  id: string;
  title: string;
  market: MarketCode;
  marketLabel: string;
  interval: Exclude<IntervalCode, "ALL">;
  feature: Exclude<FeatureCode, "ALL">;
  endpoint: string;
  purpose: string;
  immediate?: boolean;
  scheduleLabel?: string;
}): ApiTaskDefinition {
  return {
    id: input.id,
    title: input.title,
    market: input.market,
    marketLabel: input.marketLabel,
    interval: input.interval,
    intervalLabel: intervalMeta[input.interval].label,
    feature: input.feature,
    featureLabel: featureMeta[input.feature],
    purpose: input.purpose,
    endpoint: input.endpoint,
    schedule: {
      label: input.scheduleLabel ?? intervalMeta[input.interval].schedule,
      cron: "接口内置",
      timezone: "Asia/Shanghai",
    },
    capabilities: {
      immediate: input.immediate ?? true,
      start: true,
      stop: true,
      status: true,
    },
    sideEffects: ["可能触发数据抓取", "部分任务可能发送通知"],
  };
}

function marketTimerTasks(input: {
  prefix: string;
  title: string;
  interval: Exclude<IntervalCode, "ALL">;
  feature: Exclude<FeatureCode, "ALL">;
  route: string;
  purpose: string;
  markets?: Array<Exclude<MarketCode, "ALL">>;
  immediate?: boolean;
}): ApiTaskDefinition[] {
  return (input.markets ?? ["A", "HK", "US"]).map((market) => {
    const meta = marketMeta[market];
    return timerTask({
      id: `${input.prefix}-${market.toLowerCase()}`,
      title: `${meta.label} · ${input.title}`,
      market,
      marketLabel: meta.label,
      interval: input.interval,
      feature: input.feature,
      endpoint: input.route.replace(":market", meta.path),
      purpose: `${meta.label}${input.purpose}`,
      immediate: input.immediate,
    });
  });
}

const mainTrendDefinitions = [
  { market: "A" as const, interval: "DAY" as const, path: "day", configKey: "A_DAY_MAIN_TREND" },
  { market: "A" as const, interval: "60M" as const, path: "60m", configKey: "A_MIN_60_MAIN_TREND" },
  { market: "A" as const, interval: "30M" as const, path: "30m", configKey: "A_MIN_30_MAIN_TREND" },
  { market: "HK" as const, interval: "DAY" as const, path: "day", configKey: "HK_DAY_MAIN_TREND" },
  { market: "HK" as const, interval: "60M" as const, path: "60m", configKey: "HK_MIN_60_MAIN_TREND" },
  { market: "HK" as const, interval: "30M" as const, path: "30m", configKey: "HK_MIN_30_MAIN_TREND" },
  { market: "US" as const, interval: "DAY" as const, path: "day", configKey: "US_DAY_MAIN_TREND" },
  { market: "US" as const, interval: "60M" as const, path: "60m", configKey: "US_MIN_60_MAIN_TREND" },
  { market: "US" as const, interval: "30M" as const, path: "30m", configKey: "US_MIN_30_MAIN_TREND" },
] as const;

function mainTrendTasks(): ApiTaskDefinition[] {
  return mainTrendDefinitions.map((definition) => {
    const market = marketMeta[definition.market];
    const interval = intervalMeta[definition.interval];
    return timerTask({
      id: `main-trend-${definition.path}-${definition.market.toLowerCase()}`,
      title: `${market.label} · ${interval.label}主涨段`,
      market: definition.market,
      marketLabel: market.label,
      interval: definition.interval,
      feature: "MAIN_TREND",
      endpoint: `/api/day-rise/${market.path}/${definition.path}`,
      purpose: `${market.label}${interval.label}主涨段监控，读取 ${definition.configKey} 配置。`,
      scheduleLabel: "工作日 · 02:00",
    });
  });
}

export const apiCatalog: ApiTaskDefinition[] = [
  ...marketTimerTasks({
    prefix: "rsi-watch-5m",
    title: "5分钟 RSI 监控",
    interval: "5M",
    feature: "RSI",
    route: "/api/5-rsi-watch/:market",
    purpose: "监控 RSI 信号并按交易时段执行。",
    immediate: false,
  }),
  ...marketTimerTasks({
    prefix: "rsi-watch-15m",
    title: "15分钟 RSI 监控",
    interval: "15M",
    feature: "RSI",
    route: "/api/15-rsi-watch/:market",
    purpose: "监控 RSI 信号并执行数据抓取。",
  }),
  ...marketTimerTasks({
    prefix: "rsi-watch-30m",
    title: "30分钟 RSI 监控",
    interval: "30M",
    feature: "RSI",
    route: "/api/30-rsi-watch/:market",
    purpose: "监控 RSI 信号并执行数据抓取。",
  }),
  ...marketTimerTasks({
    prefix: "rsi-watch-60m",
    title: "60分钟 RSI 监控",
    interval: "60M",
    feature: "RSI",
    route: "/api/60-rsi-watch/:market",
    purpose: "监控 RSI 信号并执行数据抓取。",
    markets: ["A"],
  }),
  ...marketTimerTasks({
    prefix: "day-rsi-watch",
    title: "日线 RSI 监控",
    interval: "DAY",
    feature: "RSI",
    route: "/api/day-rsi-watch/:market",
    purpose: "执行日线 RSI 监控任务。",
  }),
  ...mainTrendTasks(),
  ...marketTimerTasks({
    prefix: "backtrend-15m",
    title: "15分钟 RSI 回测",
    interval: "BACKTREND",
    feature: "RSI",
    route: "/api/backtrend/15-rsi/:market",
    purpose: "执行 15 分钟 RSI 历史回测。",
  }),
  ...marketTimerTasks({
    prefix: "backtrend-30m",
    title: "30分钟 RSI 回测",
    interval: "BACKTREND",
    feature: "RSI",
    route: "/api/backtrend/30-rsi/:market",
    purpose: "执行 30 分钟 RSI 历史回测。",
  }),
  ...marketTimerTasks({
    prefix: "backtrend-60m",
    title: "60分钟 RSI 回测",
    interval: "BACKTREND",
    feature: "RSI",
    route: "/api/backtrend/60-rsi%20/:market",
    purpose: "执行 60 分钟 RSI 历史回测。",
  }),
  timerTask({
    id: "reuters-daily",
    title: "Reuters 新闻任务",
    market: "ALL",
    marketLabel: "全市场",
    interval: "DAY",
    feature: "REUTERS",
    endpoint: "/api/reuters",
    purpose: "抓取、翻译并处理 Reuters 新闻。",
    scheduleLabel: "定时新闻抓取",
  }),
  timerTask({
    id: "nash-ai-daily",
    title: "Nash AI 日报",
    market: "ALL",
    marketLabel: "全市场",
    interval: "DAY",
    feature: "AI",
    endpoint: "/api/nash-ai/daily",
    purpose: "生成每日 AI 股票分析任务。",
    scheduleLabel: "每日任务",
  }),
];

export const marketOptions = [
  { key: "ALL" as const, label: "全部市场" },
  { key: "A" as const, label: "A股" },
  { key: "HK" as const, label: "港股" },
  { key: "US" as const, label: "美股" },
];

export const intervalOptions = [
  { value: "ALL" as const, label: "全部分时" },
  { value: "DAY" as const, label: "日线" },
  { value: "5M" as const, label: "5分钟" },
  { value: "15M" as const, label: "15分钟" },
  { value: "30M" as const, label: "30分钟" },
  { value: "60M" as const, label: "60分钟" },
  { value: "BACKTREND" as const, label: "回测" },
];

export const featureOptions = [
  { value: "ALL" as const, label: "全部功能" },
  ...Object.entries(featureMeta).map(([value, label]) => ({ value: value as Exclude<FeatureCode, "ALL">, label })),
];

export const apiCatalogUpdatedAt = "2026-10-04";
