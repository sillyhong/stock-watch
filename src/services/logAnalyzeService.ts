import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";

export type LogLevel = "error" | "warn" | "info";

export type LogFile = {
  name: string;
  size: number;
  modifiedAt: string;
};

export type LogLine = {
  text: string;
  level: LogLevel;
};

export type LogSnapshot = {
  directory: string;
  files: LogFile[];
  selectedFile: string | null;
  lines: LogLine[];
  totalLines: number;
  truncated: boolean;
  serverTime: string;
};

export class LogAnalyzeError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "LogAnalyzeError";
  }
}

const LOG_DIRECTORY = "/root/.pm2/logs";
const TAIL_CHUNK_BYTES = 64 * 1024;
const MAX_TAIL_BYTES = 2 * 1024 * 1024;

function classifyLine(text: string): LogLevel {
  const normalized = text.toLowerCase();
  if (/(\berror\b|\bfatal\b|\bexception\b|\berr\b|错误|异常)/i.test(normalized)) {
    return "error";
  }
  if (/(\bwarn(?:ing)?\b|\bnotice\b|警告|注意)/i.test(normalized)) {
    return "warn";
  }
  return "info";
}

function assertSafeFileName(fileName: string): string {
  if (!fileName || fileName === "." || fileName === ".." || path.basename(fileName) !== fileName) {
    throw new LogAnalyzeError("日志文件名无效", 400);
  }
  if (!fileName.endsWith(".log")) {
    throw new LogAnalyzeError("只允许读取 .log 日志文件", 400);
  }
  return fileName;
}

async function listLogFiles(): Promise<LogFile[]> {
  let entries;
  try {
    entries = await readdir(LOG_DIRECTORY, { withFileTypes: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") {
      throw new LogAnalyzeError(`PM2 日志目录不存在：${LOG_DIRECTORY}`, 503);
    }
    if (code === "EACCES") {
      throw new LogAnalyzeError(`没有权限读取 PM2 日志目录：${LOG_DIRECTORY}`, 503);
    }
    throw new LogAnalyzeError("读取 PM2 日志目录失败", 500);
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map(async (entry) => {
        const filePath = path.join(LOG_DIRECTORY, entry.name);
        const stats = await lstat(filePath);
        return {
          name: entry.name,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      }),
  );

  return files.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

async function readTailLines(fileName: string, lineLimit: number): Promise<Pick<LogSnapshot, "lines" | "totalLines" | "truncated">> {
  const filePath = path.join(LOG_DIRECTORY, assertSafeFileName(fileName));
  let stats;
  try {
    stats = await lstat(filePath);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") {
      throw new LogAnalyzeError("选择的日志文件不存在，可能已被 PM2 轮转", 404);
    }
    throw new LogAnalyzeError("读取日志文件信息失败", 500);
  }

  if (!stats.isFile()) {
    throw new LogAnalyzeError("选择的日志文件无效", 400);
  }

  if (stats.size === 0) {
    return { lines: [], totalLines: 0, truncated: false };
  }

  const handle = await open(filePath, "r");
  try {
    let position = stats.size;
    let bytesRead = 0;
    const chunks: Buffer[] = [];

    while (position > 0 && bytesRead < MAX_TAIL_BYTES) {
      const bytesToRead = Math.min(TAIL_CHUNK_BYTES, MAX_TAIL_BYTES - bytesRead);
      const start = Math.max(0, position - bytesToRead);
      const chunk = Buffer.alloc(position - start);
      const result = await handle.read(chunk, 0, chunk.length, start);
      chunks.unshift(chunk.subarray(0, result.bytesRead));
      bytesRead += result.bytesRead;
      position = start;

      const text = Buffer.concat(chunks).toString("utf8");
      const newlineCount = (text.match(/\n/g) ?? []).length;
      if (position === 0 || newlineCount >= lineLimit + 1) break;
    }

    const text = Buffer.concat(chunks).toString("utf8");
    const parts = text.split("\n");
    if (position > 0) parts.shift();
    if (parts.at(-1) === "") parts.pop();

    const lines = parts.slice(-lineLimit).map((line) => {
      const normalizedLine = line.endsWith("\r") ? line.slice(0, -1) : line;
      return { text: normalizedLine, level: classifyLine(normalizedLine) };
    });

    return {
      lines,
      totalLines: lines.length,
      truncated: position > 0,
    };
  } finally {
    await handle.close();
  }
}

export async function getLogSnapshot(fileName: string | undefined, lineLimit: number): Promise<LogSnapshot> {
  const files = await listLogFiles();
  const selectedFile = fileName ? assertSafeFileName(fileName) : files[0]?.name ?? null;

  if (fileName && !files.some((file) => file.name === selectedFile)) {
    throw new LogAnalyzeError("选择的日志文件不存在或不是可读取的 .log 文件", 404);
  }

  const content = selectedFile
    ? await readTailLines(selectedFile, lineLimit)
    : { lines: [], totalLines: 0, truncated: false };

  return {
    directory: LOG_DIRECTORY,
    files,
    selectedFile,
    ...content,
    serverTime: new Date().toISOString(),
  };
}
