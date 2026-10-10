import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = 'https://push2.eastmoney.com/api/qt/clist/get';
const PAGE_SIZE = 100;
const DEFAULT_HEADERS = {
  accept: '*/*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  referer: 'https://quote.eastmoney.com/center/boardlist.html',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'Cookie': 'qgqp_b_id=b898f5e6ae213256636d2ac010423889; st_nvi=T8VaEUWdkb_sskT2hfMVzadd2; quote_lt=1; nid18=0f38fc1a4d417dd2a32a0335f8de07eb; nid18_create_time=1782789230462; gviem=q25pExlqdBbUx88D0FKm39baa; gviem_create_time=1782789230462; st_si=84972277438198; st_asi=delete; wsc_checkuser_ok=1; fullscreengg=1; fullscreengg2=1; websitepoptg_api_time=1788745739576; st_pvi=01848825546785; st_sp=2026-01-14%2017%3A24%3A13; st_inirUrl=https%3A%2F%2Fwx.mail.qq.com%2F; st_sn=7; st_psi=20260908095924967-113200301201-0113643764',
};
const REFERRER = 'https://quote.eastmoney.com/center/boardlist.html';
const DEFAULT_UT = '8dec03ba335b81bf4ebdf7b29ec27d15';
const DEFAULT_FIELDS = 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124,f1,f13';

interface IEastmoneyStockItem {
  f12?: string;
  f13?: number;
  f14?: string;
}

interface IEastmoneyApiResponse {
  rc?: number;
  rt?: number;
  data?: {
    total?: number;
    diff?: IEastmoneyStockItem[];
  };
}

function getSingleQueryParam(param: string | string[] | undefined): string {
  return Array.isArray(param) ? param[0] || '' : param || '';
}

function validateFileToken(value: string, label: string): string | null {
  if (!value) {
    return `${label} is required`;
  }

  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return `${label} must contain only letters, numbers, underscores, or hyphens`;
  }

  return null;
}

function normalizeExportName(fileName: string, exportName?: string): string {
  if (exportName) {
    return exportName;
  }

  const normalizedFileName = fileName.replace(/-/g, '_');
  return `a_${normalizedFileName}`;
}

function buildUrl(bkCode: string, page: number, pageSize: number): string {
  const params = new URLSearchParams({
    fid: 'f62',
    po: '1',
    pz: String(pageSize),
    pn: String(page),
    np: '1',
    fltt: '2',
    invt: '2',
    ut: DEFAULT_UT,
    fs: `b:${bkCode}`,
    fields: DEFAULT_FIELDS,
  });

  return `${API_URL}?${params.toString()}`;
}

function parseEastmoneyResponse(rawText: string): IEastmoneyApiResponse {
  const trimmedText = rawText.trim();
  if (!trimmedText) {
    throw new Error('Eastmoney returned empty response body');
  }

  try {
    return JSON.parse(trimmedText) as IEastmoneyApiResponse;
  } catch {
    const jsonpText = trimmedText.replace(/^[^(]+\(/, '').replace(/\);?$/, '');
    return JSON.parse(jsonpText) as IEastmoneyApiResponse;
  }
}

async function fetchBoardPage(bkCode: string, page: number, pageSize: number): Promise<IEastmoneyApiResponse> {
  const url = buildUrl(bkCode, page, pageSize);
  const response = await fetch(url, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
    referrer: REFERRER,
  });
  const rawText = await response.text();


  const parsedResponse = parseEastmoneyResponse(rawText);
  if (parsedResponse.rc !== 0) {
    throw new Error(`Eastmoney business error: rc=${parsedResponse.rc}, rt=${parsedResponse.rt ?? 'unknown'}`);
  }

  return parsedResponse;
}

async function fetchAllBoardStocks(bkCode: string): Promise<IEastmoneyStockItem[]> {
  const firstPage = await fetchBoardPage(bkCode, 1, PAGE_SIZE);
  const firstPageDiff = firstPage.data?.diff || [];
  const total = firstPage.data?.total || firstPageDiff.length;

  if (total <= PAGE_SIZE) {
    return firstPageDiff;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pagePromises: Array<Promise<IEastmoneyApiResponse>> = [];

  for (let page = 2; page <= totalPages; page += 1) {
    pagePromises.push(fetchBoardPage(bkCode, page, PAGE_SIZE));
  }

  const remainingPages = await Promise.all(pagePromises);
  const allStocks = [...firstPageDiff];

  remainingPages.forEach((pageData) => {
    if (pageData.data?.diff?.length) {
      allStocks.push(...pageData.data.diff);
    }
  });

  return allStocks;
}

function formatBoardStocksAsTs(items: IEastmoneyStockItem[], exportName: string): string {
  const lines = items
    .filter((item) => item.f12 && item.f14 && typeof item.f13 === 'number')
    .map((item) => `"${item.f13}.${item.f12}",// ${item.f14}`);

  return `export const ${exportName} = [\n${lines.join('\n')}\n]\n`;
}
// 请求例子： /api/easymony/board-stocks?bkCode=BK0546&fileName=cpo
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bkCode = getSingleQueryParam(req.query.bkCode).trim();
  const fileName = getSingleQueryParam(req.query.fileName).trim();
  const rawExportName = getSingleQueryParam(req.query.exportName).trim();

  const bkCodeError = validateFileToken(bkCode, 'bkCode');
  if (bkCodeError) {
    return res.status(400).json({ error: bkCodeError });
  }

  const fileNameError = validateFileToken(fileName, 'fileName');
  if (fileNameError) {
    return res.status(400).json({ error: fileNameError });
  }

  if (rawExportName && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rawExportName)) {
    return res.status(400).json({ error: 'exportName must be a valid TypeScript identifier' });
  }

  const exportName = normalizeExportName(fileName, rawExportName);

  try {
    const stocks = await fetchAllBoardStocks(bkCode);
    const content = formatBoardStocksAsTs(stocks, exportName);

    const dataDir = path.join(process.cwd(), 'src/pages/data/astock');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const absoluteFilePath = path.join(dataDir, `${fileName}.ts`);
    fs.writeFileSync(absoluteFilePath, content, 'utf-8');

    return res.status(200).json({
      message: 'Board stocks fetched and saved successfully',
      bkCode,
      fileName,
      exportName,
      count: stocks.length,
      filePath: `src/pages/data/astock/${fileName}.ts`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      error: errorMessage,
      bkCode,
      fileName,
      exportName,
    });
  }
}
