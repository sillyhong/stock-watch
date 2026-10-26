import nodemailer from 'nodemailer';
import { IReutersEntriesByRegion } from './types';
import { normalizeReutersArticleUrl } from './reutersUrl';

const RECIPIENT_EMAIL = process.env.REUTERS_RECIPIENT_EMAIL || '1175166300@qq.com';
const SENDER_EMAIL = '1175166300@qq.com';
const QQMail = nodemailer.createTransport({
  service: 'QQ',
  auth: {
    user: SENDER_EMAIL,
    pass: 'jxidhvesevtciege',
  },
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTitleList(entries: IReutersEntriesByRegion['us']): string {
  if (!entries.length) {
    return '<li>None</li>';
  }

  return entries
    .map((entry) => {
      const englishTitle = `${entry.publishedAt ? `[${entry.publishedAt}] ` : ''}${entry.en}`;
      const url = normalizeReutersArticleUrl(entry.url);
      const originalLink = url
        ? `<br /><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;padding:5px 12px;background:#1d4ed8;border:1px solid #1d4ed8;border-radius:6px;color:#ffffff;font-size:12px;line-height:20px;text-decoration:none;">查看原文</a>`
        : '';
      return `<li>${escapeHtml(entry.zh)}<br /><span style="color:#64748b;font-size:12px;">${escapeHtml(englishTitle)}</span>${originalLink}</li>`;
    })
    .join('');
}

function generateReutersEmailHtml(executedAt: string, incremental: IReutersEntriesByRegion): string {
  const totalCount = incremental.us.length + incremental.china.length + incremental.iran.length;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #f4f7fb;
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }
    .card {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #dbe5f1;
      overflow: hidden;
      box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
    }
    .hero {
      padding: 24px 28px;
      background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
      color: #ffffff;
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: 24px;
    }
    .hero p {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 24px 28px 30px;
    }
    .summary {
      margin-bottom: 18px;
      padding: 16px 18px;
      border-radius: 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
    }
    .section {
      margin-top: 22px;
    }
    .section h2 {
      margin: 0 0 12px;
      font-size: 18px;
      color: #0f172a;
    }
    ul {
      margin: 0;
      padding-left: 22px;
      line-height: 1.7;
    }
    li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="hero">
      <h1>Reuters News Increment</h1>
      <p>Executed at ${escapeHtml(executedAt)}</p>
    </div>
    <div class="content">
      <div class="summary">
        <strong>Total new titles:</strong> ${totalCount}<br />
        <strong>US:</strong> ${incremental.us.length} &nbsp;&nbsp;
        <strong>China:</strong> ${incremental.china.length} &nbsp;&nbsp;
        <strong>Iran:</strong> ${incremental.iran.length}
      </div>

      <div class="section">
        <h2>US</h2>
        <ul>${buildTitleList(incremental.us)}</ul>
      </div>

      <div class="section">
        <h2>China</h2>
        <ul>${buildTitleList(incremental.china)}</ul>
      </div>

      <div class="section">
        <h2>Iran</h2>
        <ul>${buildTitleList(incremental.iran)}</ul>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendReutersIncrementEmail(
  executedAt: string,
  incremental: IReutersEntriesByRegion
): Promise<void> {
  const totalCount = incremental.us.length + incremental.china.length + incremental.iran.length;

  await QQMail.sendMail({
    from: `[Reuters][Increment]<${SENDER_EMAIL}>`,
    to: RECIPIENT_EMAIL,
    subject: `[Reuters] ${executedAt} new titles ${totalCount}`,
    html: generateReutersEmailHtml(executedAt, incremental),
  });
}
