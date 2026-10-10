const INITIAL_DELAY_MS = 3_000;
const RETRY_DELAY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;

const schedulerEndpoints = [
  "/api/30-rsi-watch/hk",
  "/api/15-rsi-watch/hk",
  "/api/5-rsi-watch/hk",
  "/api/day-rsi-watch/hk",
  "/api/backtrend/15-rsi/hk",
  "/api/30-rsi-watch/a",
  "/api/15-rsi-watch/a",
  "/api/5-rsi-watch/a",
  "/api/day-rsi-watch/a",
  "/api/backtrend/30-rsi/a",
  "/api/backtrend/15-rsi/a",
  "/api/15-rsi-watch/us",
  "/api/day-rsi-watch/us",
  "/api/backtrend/15-rsi/us",
  "/api/day-rise/a",
  "/api/day-rise/us",
  "/api/nash-ai/daily",
  "/api/reuters",
] as const;

type BootstrapState = {
  started: boolean;
  retryTimer?: ReturnType<typeof setTimeout>;
};

const globalState = globalThis as typeof globalThis & {
  __stockWatchProductionSchedulerBootstrap?: BootstrapState;
};

const state: BootstrapState =
  globalState.__stockWatchProductionSchedulerBootstrap ?? { started: false };
globalState.__stockWatchProductionSchedulerBootstrap = state;

function isEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_PRODUCTION_SCHEDULERS !== "false"
  );
}

function getBaseUrl(): string {
  if (process.env.INTERNAL_SCHEDULER_BASE_URL) {
    return process.env.INTERNAL_SCHEDULER_BASE_URL.replace(/\/$/, "");
  }

  return `http://127.0.0.1:${process.env.PORT || "3008"}`;
}

async function registerEndpoint(endpoint: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getBaseUrl()}${endpoint}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function registerAllEndpoints(): Promise<boolean> {
  let failed = false;

  for (const endpoint of schedulerEndpoints) {
    try {
      await registerEndpoint(endpoint);
    } catch (error) {
      failed = true;
      console.error(
        `[production-schedulers] failed to register ${endpoint}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return !failed;
}

async function bootstrap(): Promise<void> {
  if (!isEnabled()) return;

  const succeeded = await registerAllEndpoints();
  if (succeeded) {
    console.info(
      `[production-schedulers] registered ${schedulerEndpoints.length} timer endpoints`,
    );
    return;
  }

  state.retryTimer = setTimeout(() => {
    void bootstrap();
  }, RETRY_DELAY_MS);
}

export function startProductionSchedulerBootstrap(): void {
  if (!isEnabled() || state.started) return;

  state.started = true;
  state.retryTimer = setTimeout(() => {
    void bootstrap();
  }, INITIAL_DELAY_MS);

  console.info(
    `[production-schedulers] bootstrap scheduled in ${INITIAL_DELAY_MS}ms`,
  );
}

