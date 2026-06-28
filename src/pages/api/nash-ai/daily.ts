import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import dayjs from 'dayjs';
import { QQMail } from '../../utils/emailNotifier';

export const dynamic = 'force-dynamic';

const DOMESTIC_REPORT_URL = 'https://www.nash-ai.cn/reports/search';
const FOREIGN_REPORT_URL = 'https://www.nash-ai.cn/reports/foreign-rt/search';
const NASH_AI_AUTHORIZATION = 'Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIyY2U5MmM1OGNlOGU0MmZiODA0NzVhNGQ2ODI2YTliMiIsImlhdCI6MTc4MTY4OTkyNSwiZXhwIjoxNzgxNzc2MzI1fQ.p0v0oW_KDkl1plWYoDFWH9xgkU7qK3F4Ec0jmuuXWjnojRuQx3RmNFGkdENvkZ6i11LqpVzThO_cWAsptOAWbA';
const FOREIGN_INSTITUTIONS = ['Goldman Sachs', 'JPMorgan', 'Nomura', 'HSBC', 'Morgan Stanley'];
const RECIPIENT_EMAIL = '1175166300@qq.com';
const CRON_EXPRESSION = '0 6 * * *';

let nashAIDailyTask: cron.ScheduledTask | null = null;

interface INashAiRecord {
  id?: number;
  title?: string | null;
  securities?: string | null;
  stockCode?: string | null;
  stockName?: string | null;
  reDate?: string | null;
}

interface INashAiResponse {
  code?: number;
  message?: string;
  data?: {
    records?: INashAiRecord[];
    total?: number;
    pageNum?: number;
    pageSize?: number;
  };
}

interface IDailyEmailPayload {
  domesticReports: INashAiRecord[];
  foreignReports: INashAiRecord[];
  startDate: string;
  endDate: string;
  executedAt: string;
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

async function fetchNashAiPage(url: string, body: Record<string, unknown>): Promise<INashAiResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/plain, */*',
      authorization: NASH_AI_AUTHORIZATION,
      'content-type': 'application/json',
      origin: 'https://www.nash-ai.cn',
      referer: 'https://www.nash-ai.cn/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Nash AI request failed with status ${response.status}: ${rawText.slice(0, 200)}`);
  }

  const parsed = JSON.parse(rawText) as INashAiResponse;
  if (parsed.code !== 200) {
    throw new Error(`Nash AI business error: code=${parsed.code}, message=${parsed.message || 'unknown'}`);
  }

  return parsed;
}

async function fetchAllNashAiRecords(url: string, baseBody: Record<string, unknown>): Promise<INashAiRecord[]> {
  const firstPage = await fetchNashAiPage(url, { ...baseBody, pageNum: 1 });
  const firstRecords = firstPage.data?.records || [];
  const total = firstPage.data?.total || firstRecords.length;
  const pageSize = firstPage.data?.pageSize || Number(baseBody.pageSize) || 200;

  if (total <= pageSize) {
    return firstRecords;
  }

  const totalPages = Math.ceil(total / pageSize);
  const pagePromises: Array<Promise<INashAiResponse>> = [];
  for (let pageNum = 2; pageNum <= totalPages; pageNum += 1) {
    pagePromises.push(fetchNashAiPage(url, { ...baseBody, pageNum }));
  }

  const remainingPages = await Promise.all(pagePromises);
  const allRecords = [...firstRecords];
  remainingPages.forEach((pageData) => {
    if (pageData.data?.records?.length) {
      allRecords.push(...pageData.data.records);
    }
  });

  return allRecords;
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() || '--';
}

function buildDomesticRows(records: INashAiRecord[]): string {
  if (!records.length) {
    return '<tr><td colspan="4" class="empty-row">暂无国内研报</td></tr>';
  }

  return records
    .map((record) => `
      <tr>
        <td>${normalizeText(record.securities)}</td>
        <td>${normalizeText(record.title)}</td>
        <td>${normalizeText(record.stockCode)}</td>
        <td>${normalizeText(record.stockName)}</td>
      </tr>
    `)
    .join('');
}

function buildForeignRows(records: INashAiRecord[]): string {
  if (!records.length) {
    return '<tr><td colspan="4" class="empty-row">暂无国外机构研报</td></tr>';
  }

  return records
    .map((record) => `
      <tr>
        <td>${normalizeText(record.securities)}</td>
        <td>${normalizeText(record.title)}</td>
        <td>${normalizeText(record.stockCode)}</td>
        <td>${normalizeText(record.stockName)}</td>
      </tr>
    `)
    .join('');
}

function generateDailyEmailHtml(payload: IDailyEmailPayload): string {
  const { domesticReports, foreignReports, startDate, endDate, executedAt } = payload;
  const domesticRows = buildDomesticRows(domesticReports);
  const foreignRows = buildForeignRows(foreignReports);

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
      <h1>Nash AI 每日研报速览</h1>
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
      本邮件由 Nash AI 日报任务自动发送。内容来自第三方接口整理，仅供研究参考。
    </div>
  </div>
</body>
</html>
  `;
}

async function sendDailyEmail(payload: IDailyEmailPayload): Promise<void> {
  const subject = `Nash AI 日报 ${payload.endDate} | 国内${payload.domesticReports.length}篇 / 国外${payload.foreignReports.length}篇`;
  const html = generateDailyEmailHtml(payload);

  await QQMail.sendMail({
    from: RECIPIENT_EMAIL,
    to: RECIPIENT_EMAIL,
    subject,
    html,
  });
}

async function runNashAIDailyTask() {
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
    pageSize: 200,
  };

  const foreignBaseBody = {
    releaseDate: '',
    startDate,
    endDate,
    minPages: 0,
    keyword: '',
    reportTypes: [],
    industries: FOREIGN_INSTITUTIONS,
    pageNum: 1,
    pageSize: 200,
    institutions: FOREIGN_INSTITUTIONS,
  };

  const [domesticReports, foreignReports] = await Promise.all([
    fetchAllNashAiRecords(DOMESTIC_REPORT_URL, domesticBaseBody),
    fetchAllNashAiRecords(FOREIGN_REPORT_URL, foreignBaseBody),
  ]);

  const payload: IDailyEmailPayload = {
    domesticReports,
    foreignReports,
    startDate,
    endDate,
    executedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  };

  await sendDailyEmail(payload);

  return {
    startDate,
    endDate,
    domesticCount: domesticReports.length,
    foreignCount: foreignReports.length,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const isImmediately = isImmediatelyRequested(req.query.isImmediately);

  if (req.method === 'GET') {
    try {
      if (!nashAIDailyTask) {
        nashAIDailyTask = cron.schedule(CRON_EXPRESSION, async () => {
          try {
            console.log('🚀 开始执行 Nash AI 每日研报定时任务...');
            await runNashAIDailyTask();
            console.log('✅ Nash AI 每日研报定时任务执行完成');
          } catch (error) {
            console.error('❌ Nash AI 每日研报定时任务执行失败:', error);
          }
        }, {
          timezone: 'Asia/Shanghai',
          scheduled: true,
        });
      }

      let executionResult = null;
      if (isImmediately) {
        executionResult = await runNashAIDailyTask();
      }

      return res.status(200).json({
        message: 'Nash AI dayily task started successfully',
        schedule: '每天 06:00',
        cronExpression: CRON_EXPRESSION,
        timezone: 'Asia/Shanghai',
        isImmediately,
        data: executionResult,
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Failed to execute Nash AI dayily task',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (req.method === 'DELETE') {
    if (nashAIDailyTask) {
      nashAIDailyTask.stop();
      nashAIDailyTask = null;
      return res.status(200).json({
        message: 'Nash AI dayily task stopped successfully',
        stoppedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
    }

    return res.status(400).json({
      message: 'Nash AI dayily task is not running',
    });
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
