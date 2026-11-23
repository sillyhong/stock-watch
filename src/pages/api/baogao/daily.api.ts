import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import dayjs from 'dayjs';
import { QQMail } from '../../utils/emailNotifier';
import {
  BAOGAO_DAILY_CALL_LIMIT,
  BaogaoDailyQuotaExceededError,
  getBaogaoDailyUsage,
  reserveBaogaoDailyCalls,
} from '@/services/baogaoDailyQuota';

export const dynamic = 'force-dynamic';

const DOMESTIC_REPORT_URL = 'https://baogao.joy-func.com/reports/search';
const FOREIGN_REPORT_URL = 'https://baogao.joy-func.com/reports/foreign-rt/search';
const BAOGAO_AI_AUTHORIZATION = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI0MDNlNjM0OTVjNWY0ZjVhOTJiYjM2ZmVhYWFlNGExNSIsImRldmljZSI6IjE2Y2M1NmI4MzFlM2NiNzc1ZjBkMjg0YTRiZTczODUwMzMxNjU4NjFhNGFmMTRhOGYwYTM1Yzg1MDIyMTI3YWUiLCJpYXQiOjE3OTU0MDAzMjIsImV4cCI6MTc5NTQ4NjcyMn0.izxRfbJE7cl0QDltoqlHu8ENGCyr7X6qnQv5zwqgbe_ZgmdOo73XgGFuyUOT4zSFvxNJaOhcmY0drZbGF7Nvcw';
const FOREIGN_INSTITUTIONS = ['Goldman Sachs', 'JPMorgan', 'Nomura', 'HSBC', 'Morgan Stanley'];
const RECIPIENT_EMAIL = '1175166300@qq.com';
const CRON_EXPRESSION = '0 6 * * *';
const MAX_REPORTS_PER_QUERY = 1_000;

let baogaoDailyTask: cron.ScheduledTask | null = null;
let baogaoDailyTaskRun: Promise<IBaogaoTaskResult> | null = null;


enum ESORT_MODE  {
  TIME = 'TIME',
  COMPREHENSIVE = "COMPREHENSIVE"
}

interface IBaogaoRecord {
  id?: number;
  title?: string | null;
  titleZh?: string | null;
  securities?: string | null;
  stockCode?: string | null;
  stockName?: string | null;
  reDate?: string | null;
}

interface IBaogaoResponse {
  code?: number;
  message?: string;
  data?: {
    records?: IBaogaoRecord[];
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
}

interface IDailyEmailPayload {
  domesticReports: IBaogaoRecord[];
  foreignReports: IBaogaoRecord[];
  domesticTotal: number;
  foreignTotal: number;
  domesticTruncated: boolean;
  foreignTruncated: boolean;
  domesticTruncationReason?: BaogaoTruncationReason;
  foreignTruncationReason?: BaogaoTruncationReason;
  apiCallsUsedToday: number;
  apiCallsRemainingToday: number;
  startDate: string;
  endDate: string;
  executedAt: string;
}

interface IBaogaoFetchResult {
  records: IBaogaoRecord[];
  total: number;
  truncated: boolean;
  truncationReason?: BaogaoTruncationReason;
}

type BaogaoTruncationReason = 'member-limit' | 'daily-call-limit';

interface IBaogaoSearchState extends IBaogaoFetchResult {
  url: string;
  baseBody: Record<string, unknown>;
  currentPage: number;
  maxPage: number;
}

class BaogaoBusinessError extends Error {
  constructor(readonly code: number | undefined, readonly businessMessage: string) {
    super(`Baogao business error: code=${code}, message=${businessMessage}`);
    this.name = 'BaogaoBusinessError';
  }
}

interface IBaogaoTaskResult {
  startDate: string;
  endDate: string;
  domesticCount: number;
  domesticTotal: number;
  domesticTruncated: boolean;
  domesticTruncationReason?: BaogaoTruncationReason;
  foreignCount: number;
  foreignTotal: number;
  foreignTruncated: boolean;
  foreignTruncationReason?: BaogaoTruncationReason;
  apiCallsUsedToday: number;
  apiCallsRemainingToday: number;
}

function isImmediatelyRequested(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === 'true' || rawValue === '1';
}

function buildDateRange() {
  return {
    startDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  };
}

function isMemberResultLimitMessage(message: string): boolean {
  return /非会员最多查看前\s*1,?000\s*条结果/.test(message);
}

function isMemberResultLimitError(error: unknown): boolean {
  return error instanceof BaogaoBusinessError
    && error.code === 403
    && isMemberResultLimitMessage(error.businessMessage);
}

async function fetchBaogaoPage(
  url: string,
  body: Record<string, unknown>,
  callAlreadyReserved = false,
): Promise<IBaogaoResponse> {
  if (!callAlreadyReserved) {
    await reserveBaogaoDailyCalls();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      authorization: BAOGAO_AI_AUTHORIZATION,
      'content-type': 'application/json',
      origin: 'https://baogao.joy-func.com',
      referer: 'https://baogao.joy-func.com/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  if (!response.ok) {
    if (response.status === 403 && isMemberResultLimitMessage(rawText)) {
      throw new BaogaoBusinessError(403, rawText);
    }
    throw new Error(`Baogao request failed with status ${response.status}: ${rawText.slice(0, 200)}`);
  }

  const parsed = JSON.parse(rawText) as IBaogaoResponse;
  if (parsed.code !== 200) {
    throw new BaogaoBusinessError(parsed.code, parsed.message || 'unknown');
  }

  return parsed;
}

function createBaogaoSearchState(
  url: string,
  baseBody: Record<string, unknown>,
  firstPage: IBaogaoResponse,
): IBaogaoSearchState {
  const firstRecords = firstPage.data?.records || [];
  const reportedTotal = firstPage.data?.total;
  const total = Math.max(
    typeof reportedTotal === 'number' && Number.isFinite(reportedTotal) ? reportedTotal : 0,
    firstRecords.length,
  );
  const returnedPageSize = firstPage.data?.pageSize;
  const requestedPageSize = Number(baseBody.pageSize);
  const pageSize = Math.max(
    1,
    typeof returnedPageSize === 'number' && returnedPageSize > 0
      ? Math.floor(returnedPageSize)
      : Number.isFinite(requestedPageSize) && requestedPageSize > 0
        ? Math.floor(requestedPageSize)
        : 200,
  );
  const records = firstRecords.slice(0, MAX_REPORTS_PER_QUERY);
  const totalPages = Math.ceil(total / pageSize);
  const safePageCount = Math.floor(MAX_REPORTS_PER_QUERY / pageSize);
  const truncated = firstRecords.length > MAX_REPORTS_PER_QUERY || total > MAX_REPORTS_PER_QUERY;
  return {
    url,
    baseBody,
    records,
    total,
    truncated,
    truncationReason: truncated ? 'member-limit' : undefined,
    currentPage: 1,
    maxPage: Math.min(totalPages, safePageCount),
  };
}

function hasMoreBaogaoPages(search: IBaogaoSearchState): boolean {
  return search.currentPage < search.maxPage
    && search.records.length < MAX_REPORTS_PER_QUERY
    && search.records.length < search.total;
}

async function fetchNextBaogaoPage(search: IBaogaoSearchState): Promise<void> {
  const nextPage = search.currentPage + 1;
  try {
    const pageData = await fetchBaogaoPage(search.url, { ...search.baseBody, pageNum: nextPage });
    const pageRecords = pageData.data?.records || [];
    search.records.push(...pageRecords.slice(0, MAX_REPORTS_PER_QUERY - search.records.length));
    search.currentPage = nextPage;
  } catch (error) {
    if (isMemberResultLimitError(error) && search.records.length > 0) {
      search.truncated = true;
      search.truncationReason = 'member-limit';
      search.currentPage = search.maxPage;
      return;
    }
    throw error;
  }

  if (search.records.length >= MAX_REPORTS_PER_QUERY && search.total > search.records.length) {
    search.truncated = true;
    search.truncationReason = 'member-limit';
  }
}

async function fetchBaogaoReportsWithinDailyLimit(
  domesticBody: Record<string, unknown>,
  foreignBody: Record<string, unknown>,
): Promise<{
  domestic: IBaogaoFetchResult;
  foreign: IBaogaoFetchResult;
  usage: Awaited<ReturnType<typeof getBaogaoDailyUsage>>;
}> {
  const usageAfterInitialReservation = await reserveBaogaoDailyCalls(2);
  const [domesticFirstPage, foreignFirstPage] = await Promise.all([
    fetchBaogaoPage(DOMESTIC_REPORT_URL, { ...domesticBody, pageNum: 1 }, true),
    fetchBaogaoPage(FOREIGN_REPORT_URL, { ...foreignBody, pageNum: 1 }, true),
  ]);
  const domestic = createBaogaoSearchState(DOMESTIC_REPORT_URL, domesticBody, domesticFirstPage);
  const foreign = createBaogaoSearchState(FOREIGN_REPORT_URL, foreignBody, foreignFirstPage);

  let remainingCalls = usageAfterInitialReservation.remainingCalls;
  let nextSearch: 'domestic' | 'foreign' = 'foreign';
  while (remainingCalls > 0) {
    const orderedSearches: IBaogaoSearchState[] = nextSearch === 'foreign'
      ? [foreign, domestic]
      : [domestic, foreign];
    const search: IBaogaoSearchState | undefined = orderedSearches.find(hasMoreBaogaoPages);
    if (!search) break;

    try {
      await fetchNextBaogaoPage(search);
    } catch (error) {
      if (error instanceof BaogaoDailyQuotaExceededError) {
        remainingCalls = 0;
        break;
      }
      throw error;
    }

    remainingCalls -= 1;
    nextSearch = search === foreign ? 'domestic' : 'foreign';
  }

  [domestic, foreign].forEach((search) => {
    if (hasMoreBaogaoPages(search)) {
      search.truncated = true;
      search.truncationReason = 'daily-call-limit';
    } else if (search.total > search.records.length) {
      search.truncated = true;
      search.truncationReason = search.truncationReason || 'member-limit';
    }
  });

  return {
    domestic,
    foreign,
    usage: await getBaogaoDailyUsage(),
  };
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() || '--';
}

function buildDomesticRows(records: IBaogaoRecord[]): string {
  if (!records.length) {
    return '<tr><td colspan="4" class="empty-row">暂无国内研报</td></tr>';
  }

  return records
    .map((record) => `
      <tr>
        <td>${normalizeText(record.securities)}</td>
        <td>${normalizeText(record.titleZh || record.title)}</td>
        <td>${normalizeText(record.stockCode)}</td>
        <td>${normalizeText(record.stockName)}</td>
      </tr>
    `)
    .join('');
}

function buildForeignRows(records: IBaogaoRecord[]): string {
  if (!records.length) {
    return '<tr><td colspan="4" class="empty-row">暂无国外机构研报</td></tr>';
  }

  return records
    .map((record) => `
      <tr>
        <td>${normalizeText(record.securities)}</td>
        <td>${normalizeText(record.titleZh || record.title)}</td>
        <td>${normalizeText(record.stockCode)}</td>
        <td>${normalizeText(record.stockName)}</td>
      </tr>
    `)
    .join('');
}

function buildTruncationNotice(
  records: IBaogaoRecord[],
  total: number,
  reason: BaogaoTruncationReason | undefined,
): string {
  if (!reason) return '';
  const limitMessage = reason === 'daily-call-limit'
    ? `受 Baogao 每日 ${BAOGAO_DAILY_CALL_LIMIT} 次查询调用上限影响`
    : '受非会员最多查看前 1,000 条结果限制';
  return `<p class="limit-notice">${limitMessage}，本邮件展示 ${records.length} / ${total} 篇。</p>`;
}

function generateDailyEmailHtml(payload: IDailyEmailPayload): string {
  const {
    domesticReports,
    foreignReports,
    domesticTotal,
    foreignTotal,
    domesticTruncated,
    foreignTruncated,
    domesticTruncationReason,
    foreignTruncationReason,
    apiCallsUsedToday,
    apiCallsRemainingToday,
    startDate,
    endDate,
    executedAt,
  } = payload;
  const domesticRows = buildDomesticRows(domesticReports);
  const foreignRows = buildForeignRows(foreignReports);
  const domesticLimitNotice = domesticTruncated
    ? buildTruncationNotice(domesticReports, domesticTotal, domesticTruncationReason)
    : '';
  const foreignLimitNotice = foreignTruncated
    ? buildTruncationNotice(foreignReports, foreignTotal, foreignTruncationReason)
    : '';

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%);
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    }
    .container {
      max-width: 1180px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 18px 48px rgba(15, 23, 42, 0.10);
      border: 1px solid #dbe7ff;
    }
    .hero {
      padding: 28px 32px;
      background: linear-gradient(135deg, #0f4c81 0%, #165dff 55%, #4f8cff 100%);
      color: #ffffff;
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: 28px;
      line-height: 1.2;
    }
    .hero p {
      margin: 0;
      opacity: 0.92;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      padding: 22px 32px;
      background: #f7faff;
      border-bottom: 1px solid #e5edf9;
    }
    .card {
      background: #ffffff;
      border: 1px solid #d8e4f8;
      border-radius: 14px;
      padding: 16px 18px;
    }
    .card-label {
      font-size: 12px;
      color: #5b6b84;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 22px;
      font-weight: 700;
      color: #102a43;
    }
    .section {
      padding: 28px 32px 16px;
    }
    .section-title {
      margin: 0 0 14px;
      font-size: 20px;
      color: #102a43;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      color: #165dff;
      background: #e8f1ff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid #dbe7ff;
    }
    thead th {
      background: #183b74;
      color: #ffffff;
      font-size: 13px;
      text-align: left;
      padding: 13px 14px;
      letter-spacing: 0.2px;
    }
    tbody td {
      padding: 13px 14px;
      border-bottom: 1px solid #edf2f7;
      font-size: 13px;
      line-height: 1.6;
      vertical-align: top;
      color: #243b53;
    }
    tbody tr:nth-child(even) {
      background: #f8fbff;
    }
    tbody tr:hover {
      background: #edf4ff;
    }
    .empty-row {
      text-align: center;
      color: #7b8794;
      padding: 24px 14px;
    }
    .limit-notice {
      margin: -4px 0 14px;
      color: #8a4b08;
      font-size: 13px;
    }
    .footer {
      padding: 18px 32px 28px;
      color: #6b778c;
      font-size: 12px;
      border-top: 1px solid #edf2f7;
      background: #fbfdff;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>报告每日研报速览</h1>
      <p>覆盖日期 ${startDate} 至 ${endDate}，执行时间 ${executedAt}</p>
    </div>

    <div class="summary">
      <div class="card">
        <div class="card-label">国内研报数量</div>
        <div class="card-value">${domesticReports.length}</div>
      </div>
      <div class="card">
        <div class="card-label">国外机构研报数量</div>
        <div class="card-value">${foreignReports.length}</div>
      </div>
      <div class="card">
        <div class="card-label">起始日期</div>
        <div class="card-value">${startDate}</div>
      </div>
      <div class="card">
        <div class="card-label">结束日期</div>
        <div class="card-value">${endDate}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">
        国内研报
        <span class="section-tag">公司研究</span>
      </h2>
      ${domesticLimitNotice}
      <table>
        <thead>
          <tr>
            <th style="width: 18%;">机构</th>
            <th style="width: 44%;">标题</th>
            <th style="width: 16%;">股票代码</th>
            <th style="width: 22%;">股票名称</th>
          </tr>
        </thead>
        <tbody>
          ${domesticRows}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">
        国外机构研究
        <span class="section-tag">Goldman Sachs / JPMorgan / Nomura / HSBC / Morgan Stanley</span>
      </h2>
      ${foreignLimitNotice}
      <table>
        <thead>
          <tr>
            <th style="width: 18%;">机构</th>
            <th style="width: 50%;">标题</th>
            <th style="width: 14%;">股票代码</th>
            <th style="width: 18%;">股票名称</th>
          </tr>
        </thead>
        <tbody>
          ${foreignRows}
        </tbody>
      </table>
    </div>

    <div class="footer">
      本邮件由 Baogao 日报任务自动发送。本日查询接口已使用 ${apiCallsUsedToday}/${BAOGAO_DAILY_CALL_LIMIT} 次，剩余 ${apiCallsRemainingToday} 次。内容来自第三方接口整理，仅供研究参考。
    </div>
  </div>
</body>
</html>
  `;
}

async function sendDailyEmail(payload: IDailyEmailPayload): Promise<void> {
  const limitedCategories = [
    payload.domesticTruncated ? '国内' : '',
    payload.foreignTruncated ? '国外' : '',
  ].filter(Boolean);
  const limitSuffix = limitedCategories.length
    ? `（${limitedCategories.join('、')}结果部分展示）`
    : '';
  const subject = `报告日报 ${payload.endDate} | 国内${payload.domesticReports.length}篇 / 国外${payload.foreignReports.length}篇${limitSuffix}`;
  const html = generateDailyEmailHtml(payload);

  await QQMail.sendMail({
    from: RECIPIENT_EMAIL,
    to: RECIPIENT_EMAIL,
    subject,
    html,
  });
}

async function executeBaogaoDailyTask(): Promise<IBaogaoTaskResult> {
  const { startDate, endDate } = buildDateRange();

  const domesticBaseBody = {
    releaseDate: '',
    startDate,
    endDate,
    minPages: 0,
    keyword: '',
    reportTypes: ['公司研究'],
    industries: [],
    pageNum: 1,
    pageSize: 20,
  };

  const foreignBaseBody = {
    releaseDate: '',
    startDate,
    endDate,
    minPages: 0,
    keyword: '',
    reportTypes: [],
    pageNum: 1,
    pageSize: 20,
    institutions: FOREIGN_INSTITUTIONS,
    sortMode: ESORT_MODE.TIME
  };

  const { domestic: domesticResult, foreign: foreignResult, usage } =
    await fetchBaogaoReportsWithinDailyLimit(domesticBaseBody, foreignBaseBody);

  const payload: IDailyEmailPayload = {
    domesticReports: domesticResult.records,
    foreignReports: foreignResult.records,
    domesticTotal: domesticResult.total,
    foreignTotal: foreignResult.total,
    domesticTruncated: domesticResult.truncated,
    foreignTruncated: foreignResult.truncated,
    domesticTruncationReason: domesticResult.truncationReason,
    foreignTruncationReason: foreignResult.truncationReason,
    apiCallsUsedToday: usage.usedCalls,
    apiCallsRemainingToday: usage.remainingCalls,
    startDate,
    endDate,
    executedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  };

  await sendDailyEmail(payload);

  return {
    startDate,
    endDate,
    domesticCount: domesticResult.records.length,
    domesticTotal: domesticResult.total,
    domesticTruncated: domesticResult.truncated,
    domesticTruncationReason: domesticResult.truncationReason,
    foreignCount: foreignResult.records.length,
    foreignTotal: foreignResult.total,
    foreignTruncated: foreignResult.truncated,
    foreignTruncationReason: foreignResult.truncationReason,
    apiCallsUsedToday: usage.usedCalls,
    apiCallsRemainingToday: usage.remainingCalls,
  };
}

function runBaogaoDailyTask(): Promise<IBaogaoTaskResult> {
  if (baogaoDailyTaskRun) {
    return baogaoDailyTaskRun;
  }

  const currentRun = executeBaogaoDailyTask();
  baogaoDailyTaskRun = currentRun;
  return currentRun.finally(() => {
    if (baogaoDailyTaskRun === currentRun) {
      baogaoDailyTaskRun = null;
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isImmediately = isImmediatelyRequested(req.query.isImmediately);

  if (req.method === 'GET') {
    try {
      if (!baogaoDailyTask) {
        baogaoDailyTask = cron.schedule(CRON_EXPRESSION, async () => {
          try {
            console.log('🚀 开始执行 Baogao 每日研报定时任务...');
            const result = await runBaogaoDailyTask();
            if (result.domesticTruncated || result.foreignTruncated) {
              console.warn('⚠️ Baogao 日报部分结果受限:', result);
            }
            console.log('✅ Baogao 每日研报定时任务执行完成:', result);
          } catch (error) {
            console.error('❌ Baogao 每日研报定时任务执行失败:', error);
          }
        }, {
          timezone: 'Asia/Shanghai',
          scheduled: true,
        });
      }

      let executionResult = null;
      if (isImmediately) {
        executionResult = await runBaogaoDailyTask();
      }

      return res.status(200).json({
        message: 'Baogao daily task started successfully',
        schedule: '每天 06:00',
        cronExpression: CRON_EXPRESSION,
        timezone: 'Asia/Shanghai',
        isImmediately,
        data: executionResult,
        quota: await getBaogaoDailyUsage(),
      });
    } catch (error) {
      const isQuotaExceeded = error instanceof BaogaoDailyQuotaExceededError;
      return res.status(isQuotaExceeded ? 429 : 500).json({
        message: 'Failed to execute Baogao daily task',
        error: error instanceof Error ? error.message : String(error),
        quota: isQuotaExceeded ? error.usage : undefined,
      });
    }
  }

  if (req.method === 'DELETE') {
    if (baogaoDailyTask) {
      baogaoDailyTask.stop();
      baogaoDailyTask = null;
      return res.status(200).json({
        message: 'Baogao daily task stopped successfully',
        stoppedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
    }

    return res.status(400).json({
      message: 'Baogao daily task is not running',
    });
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
