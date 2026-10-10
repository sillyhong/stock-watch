const CLEANUP_TIMEZONE = "Asia/Shanghai";
const CLEANUP_POLL_INTERVAL_MS = 30_000;

const globalState = globalThis as typeof globalThis & {
  __stockWatchCleanupTimer?: ReturnType<typeof setInterval>;
  __stockWatchCleanupLastKey?: string;
};

function getCleanupUrl(): string {
  if (process.env.LOG_CLEANUP_URL) return process.env.LOG_CLEANUP_URL;
  const port = process.env.PORT || "3008";
  return `http://127.0.0.1:${port}/api/maintenance/log-cleanup`;
}

async function triggerCleanup(): Promise<void> {
  try {
    const response = await fetch(getCleanupUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "instrumentation-cron" }),
    });
    if (!response.ok) {
      console.error(`❌ 日志清理接口失败: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("❌ 日志清理接口请求失败:", error);
  }
}

function getShanghaiClock(): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLEANUP_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function checkCleanupWindow(): void {
  const clock = getShanghaiClock();
  if (clock.hour !== 3 || clock.minute !== 0 || clock.day % 2 !== 1) return;

  const runKey = `${clock.year}-${clock.month}-${clock.day}`;
  if (globalState.__stockWatchCleanupLastKey === runKey) return;

  globalState.__stockWatchCleanupLastKey = runKey;
  void triggerCleanup();
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (!globalState.__stockWatchCleanupTimer) {
    // Keep instrumentation free of Node-only dependencies such as node-cron, fs, and path.
    globalState.__stockWatchCleanupTimer = setInterval(checkCleanupWindow, CLEANUP_POLL_INTERVAL_MS);
  }

  try {
    const { registerSystemLogCleanupScheduler } = await import("@/services/systemLogCleanupService");
    await registerSystemLogCleanupScheduler();
  } catch (error) {
    console.error("[system-log-cleanup] scheduler registration failed", error);
  }
}
