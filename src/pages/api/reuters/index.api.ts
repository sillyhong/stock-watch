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
} = {}): Promise<IReutersRunResult> {
  const { sendEmail = true } = options;

  if (isReutersJobRunning) {
    throw new Error('Reuters task is already running');
  }

  isReutersJobRunning = true;

  try {
    const executedAt = dayjs().format('YYYY-MM-DD HH:mm:ss.SSS');
    const date = dayjs().format('YYYY-MM-DD');
    console.info(`[reuters] run started at=${executedAt} sendEmail=${sendEmail}`);
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
    console.info(
      `[reuters] fetch completed counts=${JSON.stringify(fetchedCounts)} errors=${errors.length}`,
    );
    errors.forEach((error) => console.warn(`[reuters] fetch warning ${error}`));

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
      console.info(
        `[reuters] sending email incremental=${JSON.stringify({
          us: incrementalTranslated.us.length,
          china: incrementalTranslated.china.length,
          iran: incrementalTranslated.iran.length,
        })}`,
      );
      await sendReutersIncrementEmail(executedAt, incrementalTranslated);
      emailSent = true;
      console.info('[reuters] email sent successfully');
    }

    if (!emailSent) {
      console.info(`[reuters] email skipped reason=${emailSkippedReason ?? 'unknown'}`);
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
    console.info(
      `[reuters] run completed emailSent=${runResult.emailSent} incremental=${JSON.stringify({
        us: runResult.incremental.us.length,
        china: runResult.incremental.china.length,
        iran: runResult.incremental.iran.length,
      })}`,
    );
    return runResult;
  } finally {
    isReutersJobRunning = false;
  }
}

function ensureReutersCron(): void {
  if (reutersTask) {
    return;
  }

  console.log('📅 Creating Reuters hourly cron task...');
  reutersTask = cron.schedule(CRON_EXPRESSION, async () => {
    if (!shouldRunScheduledTask()) {
      return;
    }

    try {
      await executeReutersTask({ sendEmail: true });
    } catch (error) {
      console.error('❌ Reuters cron execution failed:', error);
    }
  }, {
    timezone: SHANGHAI_TIMEZONE,
    scheduled: true,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    ensureReutersCron();

    const isImmediately = parseBooleanFlag(req.query.isImmediately, false);
    const sendEmail = parseBooleanFlag(req.query.sendEmail, true);

    if (!isImmediately) {
      console.info('[reuters] scheduler initialized; this request did not execute a fetch');
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

    try {
      const data = await executeReutersTask({ sendEmail });
      const fetchedCount = data.fetched.us.length + data.fetched.china.length + data.fetched.iran.length;
      const allRegionsFailed = fetchedCount === 0;
      const message = data.emailSent
        ? 'Reuters 抓取完成，邮件已提交发送。'
        : `Reuters 抓取完成，但未发送邮件：${data.emailSkippedReason ?? '未知原因'}`;

      return res.status(allRegionsFailed ? 502 : 200).json({
        success: !allRegionsFailed,
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
      console.error('❌ Reuters API execution failed:', error);
      return res.status(500).json({
        message: 'Failed to execute Reuters task',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (req.method === 'DELETE') {
    if (reutersTask) {
      reutersTask.stop();
      reutersTask = null;
      console.log('🛑 Reuters cron task stopped');
      return res.status(200).json({ message: 'Reuters cron task stopped.' });
    }

    return res.status(400).json({ message: 'Reuters cron task is not running.' });
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
