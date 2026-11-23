import fs from 'fs';
import path from 'path';

export const BAOGAO_DAILY_CALL_LIMIT = 7;

const USAGE_FILE = path.join(process.cwd(), '.baogao-api-usage.json');
const LOCK_FILE = `${USAGE_FILE}.lock`;
const LOCK_WAIT_TIMEOUT_MS = 10_000;
const STALE_LOCK_MS = 60_000;

interface IBaogaoUsageState {
  date: string;
  usedCalls: number;
}

export interface IBaogaoDailyUsage extends IBaogaoUsageState {
  limit: number;
  remainingCalls: number;
}

export class BaogaoDailyQuotaExceededError extends Error {
  constructor(readonly usage: IBaogaoDailyUsage) {
    super(`Baogao daily query limit reached (${usage.usedCalls}/${usage.limit})`);
    this.name = 'BaogaoDailyQuotaExceededError';
  }
}

function getShanghaiDateKey(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function acquireLock(): Promise<number> {
  fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      return fs.openSync(LOCK_FILE, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }

      try {
        if (Date.now() - fs.statSync(LOCK_FILE).mtimeMs > STALE_LOCK_MS) {
          fs.unlinkSync(LOCK_FILE);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') {
          continue;
        }
        throw statError;
      }

      if (Date.now() - startedAt >= LOCK_WAIT_TIMEOUT_MS) {
        throw new Error('Timed out waiting to update Baogao daily query usage.');
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

function releaseLock(lockDescriptor: number): void {
  fs.closeSync(lockDescriptor);
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

function readUsageState(date: string): IBaogaoUsageState {
  let raw: string;
  try {
    raw = fs.readFileSync(USAGE_FILE, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { date, usedCalls: 0 };
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Baogao daily query usage state is invalid; refusing to make more provider calls.');
  }

  if (
    !parsed
    || typeof parsed !== 'object'
    || typeof (parsed as IBaogaoUsageState).date !== 'string'
    || !Number.isInteger((parsed as IBaogaoUsageState).usedCalls)
    || (parsed as IBaogaoUsageState).usedCalls < 0
    || (parsed as IBaogaoUsageState).usedCalls > BAOGAO_DAILY_CALL_LIMIT
  ) {
    throw new Error('Baogao daily query usage state is invalid; refusing to make more provider calls.');
  }

  const saved = parsed as IBaogaoUsageState;
  return saved.date === date ? saved : { date, usedCalls: 0 };
}

function toDailyUsage(state: IBaogaoUsageState): IBaogaoDailyUsage {
  return {
    ...state,
    limit: BAOGAO_DAILY_CALL_LIMIT,
    remainingCalls: Math.max(0, BAOGAO_DAILY_CALL_LIMIT - state.usedCalls),
  };
}

function writeUsageState(state: IBaogaoUsageState): void {
  const tempFile = `${USAGE_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(state), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tempFile, USAGE_FILE);
  } catch (error) {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // Best effort cleanup; the usage counter remains unchanged if the rename failed.
    }
    throw error;
  }
}

export async function getBaogaoDailyUsage(): Promise<IBaogaoDailyUsage> {
  const lockDescriptor = await acquireLock();
  try {
    return toDailyUsage(readUsageState(getShanghaiDateKey()));
  } finally {
    releaseLock(lockDescriptor);
  }
}

export async function reserveBaogaoDailyCalls(count = 1): Promise<IBaogaoDailyUsage> {
  if (!Number.isInteger(count) || count < 1 || count > BAOGAO_DAILY_CALL_LIMIT) {
    throw new Error(`Invalid Baogao daily query reservation count: ${count}`);
  }

  const lockDescriptor = await acquireLock();
  try {
    const date = getShanghaiDateKey();
    const current = readUsageState(date);
    if (current.usedCalls + count > BAOGAO_DAILY_CALL_LIMIT) {
      throw new BaogaoDailyQuotaExceededError(toDailyUsage(current));
    }

    const updated = { date, usedCalls: current.usedCalls + count };
    writeUsageState(updated);
    return toDailyUsage(updated);
  } finally {
    releaseLock(lockDescriptor);
  }
}
