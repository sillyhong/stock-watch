import fs from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const LOG_CLEANUP_CRON = "0 3 */2 * *";
export const LOG_CLEANUP_TIMEZONE = "Asia/Shanghai";
export const LOG_CLEANUP_RETENTION_DAYS = 2;

type CleanupMode = "delete" | "dry-run";

export type LogCleanupSummary = {
  startedAt: string;
  finishedAt: string;
  cutoff: string;
  mode: CleanupMode;
  scannedFiles: number;
  candidateFiles: number;
  deletedFiles: number;
  failedFiles: number;
  deletedSchedulerLogs: number;
  errors: string[];
};

type CleanupState = {
  running: boolean;
  lastRun: LogCleanupSummary | null;
};

const globalState = globalThis as typeof globalThis & {
  __stockWatchLogCleanupState?: CleanupState;
};

const state: CleanupState = globalState.__stockWatchLogCleanupState ?? {
  running: false,
  lastRun: null,
};
globalState.__stockWatchLogCleanupState = state;

function getProjectRoot(): string {
  return process.cwd();
}

function getConfiguredLogDirectories(): string[] {
  const configured = (process.env.LOG_CLEANUP_DIRS || process.env.PM2_LOG_DIR || "")
    .split(path.delimiter)
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([
    path.join(getProjectRoot(), "logs"),
    path.join(getProjectRoot(), "src/pages/data/logs"),
    ...configured.map((value) => path.resolve(getProjectRoot(), value)),
  ]));
}

function isSafeCleanupDirectory(directory: string): boolean {
  const resolved = path.resolve(directory);
  const projectRoot = path.resolve(getProjectRoot());
  const isProjectLogDirectory = [
    path.join(projectRoot, "logs"),
    path.join(projectRoot, "src/pages/data/logs"),
  ].includes(resolved);

  if (isProjectLogDirectory) return true;
  return Boolean(process.env.LOG_CLEANUP_DIRS || process.env.PM2_LOG_DIR) && path.isAbsolute(resolved);
}

function getReutersDirectory(): string {
  return path.join(getProjectRoot(), "src/pages/data/reuters");
}

function isExpired(filePath: string, cutoff: Date): boolean {
  const stats = fs.statSync(filePath);
  return stats.mtime.getTime() < cutoff.getTime();
}

function isLogFile(fileName: string): boolean {
  return /\.(log|out|err)(?:\.[0-9]+|\.\d{4}-\d{2}-\d{2})?$/i.test(fileName);
}

function collectFiles(directory: string, predicate: (fileName: string) => boolean): string[] {
  try {
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
  } catch {
    return [];
  }

  const files: string[] = [];
  try {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        files.push(...collectFiles(entryPath, predicate));
      } else if (entry.isFile() && predicate(entry.name)) {
        files.push(entryPath);
      }
    }
  } catch {
    return files;
  }
  return files;
}

function collectReutersFiles(): string[] {
  return collectFiles(getReutersDirectory(), (fileName) => /^\d{4}-\d{2}-\d{2}\.json$/.test(fileName));
}

function collectLogFiles(): string[] {
  return getConfiguredLogDirectories()
    .filter(isSafeCleanupDirectory)
    .flatMap((directory) => collectFiles(directory, isLogFile));
}

function deleteFiles(files: string[], cutoff: Date, mode: CleanupMode, errors: string[]) {
  let candidateFiles = 0;
  let deletedFiles = 0;
  let failedFiles = 0;

  for (const filePath of files) {
    try {
      if (!isExpired(filePath, cutoff)) continue;
      candidateFiles += 1;
      if (mode === "dry-run") continue;
      fs.unlinkSync(filePath);
      deletedFiles += 1;
    } catch (error) {
      failedFiles += 1;
      errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { candidateFiles, deletedFiles, failedFiles };
}

export function getLogCleanupState(): CleanupState {
  return { ...state };
}

export async function runLogCleanup(options: { dryRun?: boolean } = {}): Promise<LogCleanupSummary> {
  if (state.running) throw new Error("Log cleanup is already running");
  state.running = true;

  const startedAt = new Date();
  const cutoff = new Date(startedAt.getTime() - LOG_CLEANUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const mode: CleanupMode = options.dryRun ? "dry-run" : "delete";
  const errors: string[] = [];

  try {
    const files = Array.from(new Set([...collectReutersFiles(), ...collectLogFiles()]));
    const fileResult = deleteFiles(files, cutoff, mode, errors);
    let deletedSchedulerLogs = 0;

    if (mode === "delete") {
      try {
        // Load Sequelize only when cleanup actually runs; instrumentation must stay lightweight.
        const { default: SchedulerService } = await import("@/services/schedulerService");
        deletedSchedulerLogs = await SchedulerService.cleanupOldLogs(LOG_CLEANUP_RETENTION_DAYS);
      } catch (error) {
        errors.push(`scheduler_logs: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const summary: LogCleanupSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      cutoff: cutoff.toISOString(),
      mode,
      scannedFiles: files.length,
      candidateFiles: fileResult.candidateFiles,
      deletedFiles: fileResult.deletedFiles,
      failedFiles: fileResult.failedFiles,
      deletedSchedulerLogs,
      errors,
    };
    state.lastRun = summary;
    return summary;
  } finally {
    state.running = false;
  }
}
