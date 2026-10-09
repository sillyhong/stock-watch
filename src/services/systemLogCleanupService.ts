type FsModule = typeof import("node:fs");
type CronModule = typeof import("node-cron");
type CronTask = ReturnType<CronModule["schedule"]>;

export const SYSTEM_LOG_CLEANUP_CRON = "0 3 28-31 * *";
export const SYSTEM_LOG_CLEANUP_TIMEZONE = "Asia/Shanghai";
export const SYSTEM_LOG_FILES = ["/var/log/secure", "/var/log/cron"] as const;

type SystemLogCleanupFileResult = {
  path: string;
  status: "truncated" | "skipped" | "failed";
  reason?: string;
};

export type SystemLogCleanupSummary = {
  startedAt: string;
  finishedAt: string;
  results: SystemLogCleanupFileResult[];
};

type SystemLogCleanupState = {
  task: CronTask | null;
  lastRun: SystemLogCleanupSummary | null;
};

const globalState = globalThis as typeof globalThis & {
  __stockWatchSystemLogCleanupState?: SystemLogCleanupState;
};

const state: SystemLogCleanupState = globalState.__stockWatchSystemLogCleanupState ?? {
  task: null,
  lastRun: null,
};
globalState.__stockWatchSystemLogCleanupState = state;

function isEnabled(): boolean {
  return process.env.SYSTEM_LOG_CLEANUP_ENABLED !== "false";
}

async function loadRuntimeRequire(): Promise<NodeRequire> {
  const { createRequire } = await import(/* webpackIgnore: true */ "node:module");
  return createRequire(`${process.cwd()}/package.json`);
}

async function loadCron(): Promise<CronModule> {
  // Runtime loading keeps node-cron and its Node-only dependencies out of Next's instrumentation bundle.
  const runtimeRequire = await loadRuntimeRequire();
  return runtimeRequire("node-cron") as CronModule;
}

async function loadFs(): Promise<FsModule> {
  const runtimeRequire = await loadRuntimeRequire();
  return runtimeRequire("node:fs") as FsModule;
}

function getDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SYSTEM_LOG_CLEANUP_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as { year: number; month: number; day: number };
}

export function isLastDayOfMonth(date = new Date()): boolean {
  const current = getDateParts(date);
  const next = getDateParts(new Date(date.getTime() + 24 * 60 * 60 * 1000));
  return current.year !== next.year || current.month !== next.month;
}

export async function runSystemLogCleanup(): Promise<SystemLogCleanupSummary> {
  const startedAt = new Date();
  const fs = await loadFs();
  const results = SYSTEM_LOG_FILES.map((filePath): SystemLogCleanupFileResult => {
    try {
      if (!fs.existsSync(filePath)) {
        return { path: filePath, status: "skipped", reason: "file does not exist" };
      }

      if (!fs.statSync(filePath).isFile()) {
        return { path: filePath, status: "skipped", reason: "path is not a regular file" };
      }

      fs.truncateSync(filePath, 0);
      return { path: filePath, status: "truncated" };
    } catch (error) {
      return {
        path: filePath,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const summary: SystemLogCleanupSummary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    results,
  };
  state.lastRun = summary;

  const failed = results.filter((result) => result.status === "failed");
  if (failed.length > 0) {
    console.error("[system-log-cleanup] failed", failed);
  } else {
    console.info("[system-log-cleanup] completed", results);
  }

  return summary;
}

export function getSystemLogCleanupState(): {
  enabled: boolean;
  scheduled: boolean;
  cron: string;
  timezone: string;
  lastRun: SystemLogCleanupSummary | null;
} {
  return {
    enabled: isEnabled(),
    scheduled: Boolean(state.task),
    cron: SYSTEM_LOG_CLEANUP_CRON,
    timezone: SYSTEM_LOG_CLEANUP_TIMEZONE,
    lastRun: state.lastRun,
  };
}

export async function registerSystemLogCleanupScheduler(): Promise<boolean> {
  if (!isEnabled() || state.task) return false;

  const cron = await loadCron();
  state.task = cron.schedule(
    SYSTEM_LOG_CLEANUP_CRON,
    () => {
      if (!isLastDayOfMonth()) return;
      void runSystemLogCleanup();
    },
    {
      scheduled: true,
      timezone: SYSTEM_LOG_CLEANUP_TIMEZONE,
    },
  );

  console.info(
    `[system-log-cleanup] scheduled: ${SYSTEM_LOG_CLEANUP_CRON} (${SYSTEM_LOG_CLEANUP_TIMEZONE})`,
  );
  return true;
}
