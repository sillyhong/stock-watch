import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import dayjs from 'dayjs';
import Holidays from 'date-holidays';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { buildEmptyFetchedEntriesByRegion, buildEmptyTitlesByRegion, fetchReutersRegion } from '@/services/reuters/reutersFetcher';
import { sendReutersIncrementEmail } from '@/services/reuters/reutersMailer';
import { computeIncrementalFetchedEntries, computeIncrementalTitles, persistReutersRun, readReutersDailyFile } from '@/services/reuters/reutersStorage';
import { IReutersEntriesByRegion, IReutersRunResult } from '@/services/reuters/types';
import { translateReutersTitlesByRegion } from '@/services/reuters/reutersTranslator';

export const dynamic = 'force-dynamic';

dayjs.extend(utc);
dayjs.extend(timezone);

const CRON_EXPRESSION = '*/5 * * * *';
const SCHEDULE_LABEL = '工作日A股交易时段每5分钟，非工作日06:00执行一次';
const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const CHHoliday = new Holidays('CN');

let reutersTask: cron.ScheduledTask | null = null;
let isReutersJobRunning = false;
let lastReutersRunResult: IReutersRunResult | null = null;

function parseBooleanFlag(value: string | string[] | undefined, defaultValue: boolean = false): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return defaultValue;
  }

  return raw === 'true' || raw === '1';
}

type ReutersLogLevel = 'INFO' | 'WARN' | 'ERROR';

function sanitizeLogText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/\s+/g, ' ')
    .slice(0, 400);
}

function writeReutersLog(level: ReutersLogLevel, event: string, details: Record<string, unknown> = {}): void {
  const timestamp = dayjs().tz(SHANGHAI_TIMEZONE).format('YYYY-MM-DD HH:mm:ss.SSS');
  const entry = { timestamp, service: 'reuters', level, event, ...details };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

function describeError(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) {
    return { message: sanitizeLogText(String(error)) };
  }

  const details: Record<string, string> = {
    name: error.name,
    message: sanitizeLogText(error.message),
  };
  if (error.stack) {
    details.stack = error.stack.split('\n').slice(0, 5).join('\n');
  }
  return details;
}

function hasIncrementalTitles(result: IReutersRunResult): boolean {
  return result.incremental.us.length > 0 || result.incremental.china.length > 0 || result.incremental.iran.length > 0;
}

function hasFetchedTitles(fetched: { us: string[]; china: string[]; iran: string[] }): boolean {
  return fetched.us.length > 0 || fetched.china.length > 0 || fetched.iran.length > 0;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isAStockWorkday(date: Date): boolean {
  if (isWeekend(date)) {
    return false;
  }

  return !CHHoliday.isHoliday(date);
}

function isInAShareTradingWindow(): boolean {
  const now = dayjs().tz(SHANGHAI_TIMEZONE);
  const currentMinutes = now.hour() * 60 + now.minute();

  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;

  return (currentMinutes >= morningStart && currentMinutes <= morningEnd) ||
    (currentMinutes >= afternoonStart && currentMinutes <= afternoonEnd);
}

function shouldRunScheduledTask(): boolean {
  const now = dayjs().tz(SHANGHAI_TIMEZONE);
  const isWorkday = isAStockWorkday(now.toDate());

  if (isWorkday) {
    return isInAShareTradingWindow();
  }

  return now.hour() === 6 && now.minute() === 0;
}

async function executeReutersTask(options: {
  sendEmail?: boolean;
  trigger?: 'manual' | 'scheduled';
  requestId?: string;
} = {}): Promise<IReutersRunResult> {
  const { sendEmail = true, trigger = 'scheduled', requestId = 'cron' } = options;
  const startedAtMs = Date.now();

  if (isReutersJobRunning) {
    writeReutersLog('WARN', 'execution_rejected', { requestId, trigger, reason: 'another run is in progress' });
    throw new Error('Reuters task is already running');
  }

  isReutersJobRunning = true;

  try {
    const executedAt = dayjs().format('YYYY-MM-DD HH:mm:ss.SSS');
    const date = dayjs().format('YYYY-MM-DD');
    writeReutersLog('INFO', 'execution_started', { requestId, trigger, executedAt, sendEmail });
    const fetched = buildEmptyTitlesByRegion();
    const fetchedEntries = buildEmptyFetchedEntriesByRegion();
    const translated: IReutersEntriesByRegion = {
      us: [],
      china: [],
      iran: [],
    };
    const errors: string[] = [];

    const [usResult, chinaResult, iranResult] = await Promise.all([
      fetchReutersRegion('us'),
      fetchReutersRegion('china'),
      fetchReutersRegion('iran'),
    ]);
    fetched.us = usResult.titles;
    fetchedEntries.us = usResult.entries;
    if (usResult.errorMessage) {
      errors.push(`[us] ${usResult.errorMessage}`);
    }
    fetched.china = chinaResult.titles;
    fetchedEntries.china = chinaResult.entries;
    if (chinaResult.errorMessage) {
      errors.push(`[china] ${chinaResult.errorMessage}`);
    }
    fetched.iran = iranResult.titles;
    fetchedEntries.iran = iranResult.entries;
    if (iranResult.errorMessage) {
      errors.push(`[iran] ${iranResult.errorMessage}`);
    }

    const fetchedCounts = {
      us: fetched.us.length,
      china: fetched.china.length,
      iran: fetched.iran.length,
    };
    const regionResults = {
      us: { titles: fetched.us.length, entries: fetchedEntries.us.length, error: usResult.errorMessage },
      china: { titles: fetched.china.length, entries: fetchedEntries.china.length, error: chinaResult.errorMessage },
      iran: { titles: fetched.iran.length, entries: fetchedEntries.iran.length, error: iranResult.errorMessage },
    };
    const logRegionResults = Object.fromEntries(
      Object.entries(regionResults).map(([region, result]) => [region, {
        titles: result.titles,
        entries: result.entries,
        error: result.error ? sanitizeLogText(result.error) : undefined,
      }]),
    );
    writeReutersLog(errors.length > 0 ? 'WARN' : 'INFO', 'fetch_completed', {
      requestId,
      regions: logRegionResults,
      fetchedCounts,
      failedRegions: errors.length,
    });

    let filePath: string | null = null;
    let incremental = buildEmptyTitlesByRegion();
    let incrementalTranslated: IReutersEntriesByRegion = {
      us: [],
      china: [],
      iran: [],
    };

    if (hasFetchedTitles(fetched)) {
      const dailyFile = readReutersDailyFile(date);
      incremental = computeIncrementalTitles(dailyFile, fetched);
      const incrementalFetchedEntries = computeIncrementalFetchedEntries(dailyFile, fetchedEntries);

      if (incremental.us.length > 0 || incremental.china.length > 0 || incremental.iran.length > 0) {
        const translatedResult = await translateReutersTitlesByRegion(incrementalFetchedEntries);
        translated.us = translatedResult.us;
        translated.china = translatedResult.china;
        translated.iran = translatedResult.iran;
        incrementalTranslated = translatedResult;
      }

      const persisted = persistReutersRun(date, executedAt, incrementalFetchedEntries, incrementalTranslated);
      filePath = persisted.filePath;
      incremental = persisted.incremental;
      incrementalTranslated = persisted.incrementalTranslated;
    }

    let emailSent = false;
    let emailSkippedReason: string | undefined;

    if (!hasFetchedTitles(fetched)) {
      emailSkippedReason = 'Fetch failed for all regions';
    } else if (!sendEmail) {
      emailSkippedReason = 'Email disabled by request';
    } else if (!hasIncrementalTitles({
      executedAt,
      date,
      filePath,
      fetched,
      translated,
      incremental,
      incrementalTranslated,
      emailSent: false,
      errors,
    })) {
      emailSkippedReason = 'No incremental titles';
    } else {
      writeReutersLog('INFO', 'email_sending', {
        requestId,
        incremental: {
          us: incrementalTranslated.us.length,
          china: incrementalTranslated.china.length,
          iran: incrementalTranslated.iran.length,
        },
      });
      await sendReutersIncrementEmail(executedAt, incrementalTranslated);
      emailSent = true;
      writeReutersLog('INFO', 'email_sent', { requestId });
    }

    if (!emailSent) {
      writeReutersLog('INFO', 'email_skipped', {
        requestId,
        reason: emailSkippedReason ?? 'unknown',
        incremental: {
          us: incrementalTranslated.us.length,
          china: incrementalTranslated.china.length,
          iran: incrementalTranslated.iran.length,
        },
      });
    }

    const runResult: IReutersRunResult = {
      executedAt,
      date,
      filePath,
      fetched,
      translated,
      incremental,
      incrementalTranslated,
      emailSent,
      emailSkippedReason,
      errors,
    };

    lastReutersRunResult = runResult;
    const fetchedCount = runResult.fetched.us.length + runResult.fetched.china.length + runResult.fetched.iran.length;
    writeReutersLog(fetchedCount === 0 ? 'ERROR' : errors.length > 0 ? 'WARN' : 'INFO', 'execution_completed', {
      requestId,
      trigger,
      outcome: fetchedCount === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'success',
      durationMs: Date.now() - startedAtMs,
      fetchedCounts: {
        us: runResult.fetched.us.length,
        china: runResult.fetched.china.length,
        iran: runResult.fetched.iran.length,
      },
      incrementalCounts: {
        us: runResult.incremental.us.length,
        china: runResult.incremental.china.length,
        iran: runResult.incremental.iran.length,
      },
      emailSent: runResult.emailSent,
      emailSkippedReason: runResult.emailSkippedReason,
      errors: errors.map(sanitizeLogText),
    });
    return runResult;
  } catch (error) {
    writeReutersLog('ERROR', 'execution_failed', {
      requestId,
      trigger,
      durationMs: Date.now() - startedAtMs,
      ...describeError(error),
    });
    throw error;
  } finally {
    isReutersJobRunning = false;
  }
}

function ensureReutersCron(): void {
  if (reutersTask) {
    return;
  }

  reutersTask = cron.schedule(CRON_EXPRESSION, async () => {
    if (!shouldRunScheduledTask()) {
      return;
    }

    try {
      await executeReutersTask({ sendEmail: true, trigger: 'scheduled' });
    } catch (error) {
      writeReutersLog('ERROR', 'scheduled_execution_failed', describeError(error));
    }
  }, {
    timezone: SHANGHAI_TIMEZONE,
    scheduled: true,
  });
  writeReutersLog('INFO', 'scheduler_started', {
    cronExpression: CRON_EXPRESSION,
    schedule: SCHEDULE_LABEL,
    timezone: SHANGHAI_TIMEZONE,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    ensureReutersCron();

    const isImmediately = parseBooleanFlag(req.query.isImmediately, false);
    const sendEmail = parseBooleanFlag(req.query.sendEmail, true);
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    if (!isImmediately) {
      return res.status(200).json({
        success: true,
        action: 'scheduler_initialized',
        executed: false,
        message: 'Reuters 定时器已启动；本次请求没有立即抓取新闻。传入 isImmediately=true 可立即执行。',
        schedule: SCHEDULE_LABEL,
        cronExpression: CRON_EXPRESSION,
        running: isReutersJobRunning,
        initialized: Boolean(reutersTask),
        lastRun: lastReutersRunResult,
      });
    }

    const immediateStartedAtMs = Date.now();
    writeReutersLog('INFO', 'immediate_request_received', { requestId, sendEmail });

    try {
      const data = await executeReutersTask({ sendEmail, trigger: 'manual', requestId });
      const fetchedCount = data.fetched.us.length + data.fetched.china.length + data.fetched.iran.length;
      const allRegionsFailed = fetchedCount === 0;
      const message = data.emailSent
        ? 'Reuters 抓取完成，邮件已提交发送。'
        : `Reuters 抓取完成，但未发送邮件：${data.emailSkippedReason ?? '未知原因'}`;

      writeReutersLog(allRegionsFailed ? 'ERROR' : 'INFO', 'immediate_response_sent', {
        requestId,
        httpStatus: allRegionsFailed ? 502 : 200,
        emailSent: data.emailSent,
        fetchedCount,
      });

      return res.status(allRegionsFailed ? 502 : 200).json({
        success: !allRegionsFailed,
        requestId,
        action: 'executed',
        executed: true,
        message: allRegionsFailed
          ? 'Reuters 本次抓取失败，所有地区均未获取到新闻。'
          : message,
        emailSent: data.emailSent,
        emailSkippedReason: data.emailSkippedReason,
        schedule: SCHEDULE_LABEL,
        cronExpression: CRON_EXPRESSION,
        running: isReutersJobRunning,
        initialized: Boolean(reutersTask),
        lastRun: data,
      });
    } catch (error) {
      writeReutersLog('ERROR', 'immediate_execution_failed', {
        requestId,
        durationMs: Date.now() - immediateStartedAtMs,
        httpStatus: 500,
        ...describeError(error),
      });
      return res.status(500).json({
        requestId,
        message: 'Failed to execute Reuters task',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (req.method === 'DELETE') {
    if (reutersTask) {
      reutersTask.stop();
      reutersTask = null;
      writeReutersLog('INFO', 'scheduler_stopped');
      return res.status(200).json({ message: 'Reuters cron task stopped.' });
    }

    return res.status(400).json({ message: 'Reuters cron task is not running.' });
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
