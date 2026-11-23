import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

const API_URL = 'https://push2.eastmoney.com/api/qt/clist/get';
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;
const CPO_BOARD_CODE = 'BK1128';
const BOARD_ALIASES = new Map([['cpo', CPO_BOARD_CODE], ['cpo概念', CPO_BOARD_CODE]]);

interface IEastmoneyStockItem {
  f12: string;
  f13: number;
  f14: string;
  f2?: number | string;
  f3?: number | string;
}

interface IEastmoneyApiResponse {
  rc?: number;
  rt?: number;
  data?: {
    total?: number;
    diff?: IEastmoneyStockItem[] | Record<string, IEastmoneyStockItem>;
  } | null;
}

class EastmoneyRequestError extends Error {}

function getSingleQueryParam(param: string | string[] | undefined): string {
  return (Array.isArray(param) ? param[0] || '' : param || '').trim();
}

function buildUrl(bkCode: string, page: number): string {
  const params = new URLSearchParams({
    fid: 'f12',
    po: '0',
    pz: String(PAGE_SIZE),
    pn: String(page),
    np: '1',
    fltt: '2',
    invt: '2',
    ut: '8dec03ba335b81bf4ebdf7b29ec27d15',
    fs: `b:${bkCode}`,
    fields: 'f12,f13,f14,f2,f3',
  });

  return `${API_URL}?${params.toString()}`;
}

function parseEastmoneyResponse(rawText: string): IEastmoneyApiResponse {
  // Some upstream deployments wrap the same payload in a JSONP callback.
  const json = rawText.trim().replace(/^[\w$.]+\s*\(\s*/, '').replace(/\s*\);?\s*$/, '');
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Eastmoney returned an invalid response');
  }

  return parsed as IEastmoneyApiResponse;
}

async function fetchBoardPage(bkCode: string, page: number): Promise<{ total: number; stocks: IEastmoneyStockItem[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(bkCode, page), {
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9',
        referer: `https://quote.eastmoney.com/bk/90.${bkCode}.html`,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = parseEastmoneyResponse(await response.text());
    if (parsed.rc !== 0) {
      throw new Error(`Eastmoney business error: rc=${parsed.rc}, rt=${parsed.rt ?? 'unknown'}`);
    }

    const total = parsed.data?.total;
    if (typeof total !== 'number' || !Number.isSafeInteger(total) || total <= 0) {
      throw new Error('No board stocks returned; the existing file has not been changed');
    }

    const diff = parsed.data?.diff;
    const stocks = Array.isArray(diff) ? diff : diff && typeof diff === 'object' ? Object.values(diff) : [];
    if (stocks.length === 0 || stocks.length > PAGE_SIZE || stocks.some((stock) => (
      !stock || typeof stock.f12 !== 'string' || !/^\d{6}$/.test(stock.f12) ||
      ![0, 1].includes(stock.f13) || typeof stock.f14 !== 'string' || !stock.f14.trim()
    ))) {
      throw new Error('Eastmoney returned incomplete or invalid stock data; the existing file has not been changed');
    }

    return { total, stocks };
  } catch (error) {
    const message = error instanceof Error
      ? error.name === 'AbortError' ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms` : error.message
      : String(error);
    throw new EastmoneyRequestError(`${bkCode} page ${page}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllBoardStocks(bkCode: string): Promise<IEastmoneyStockItem[]> {
  const firstPage = await fetchBoardPage(bkCode, 1);
  const stocks = [...firstPage.stocks];

  // A stable stock-code order and sequential pages avoid bursts and moving money-flow rankings.
  for (let page = 2; page <= Math.ceil(firstPage.total / PAGE_SIZE); page += 1) {
    const nextPage = await fetchBoardPage(bkCode, page);
    if (nextPage.total !== firstPage.total) {
      throw new EastmoneyRequestError('Board membership changed during pagination; please fetch again');
    }
    stocks.push(...nextPage.stocks);
  }

  const uniqueStocks = [...new Map(stocks.map((stock) => [`${stock.f13}.${stock.f12}`, stock])).values()];
  if (uniqueStocks.length !== firstPage.total) {
    throw new EastmoneyRequestError(`Incomplete board data: expected ${firstPage.total}, received ${uniqueStocks.length}; the existing file has not been changed`);
  }

  return uniqueStocks;
}

function formatBoardStocksAsTs(stocks: IEastmoneyStockItem[], exportName: string): string {
  const lines = stocks.map((stock) => {
    const name = stock.f14.replace(/[\r\n\u2028\u2029]/g, ' ').trim();
    return `${JSON.stringify(`${stock.f13}.${stock.f12}`)},// ${name}`;
  });
  return `export const ${exportName} = [\n${lines.join('\n')}\n]\n`;
}

async function saveBoardStocks(fileName: string, content: string): Promise<string> {
  const relativeFilePath = `src/pages/data/astock/${fileName}.ts`;
  const absoluteFilePath = path.join(process.cwd(), relativeFilePath);
  const temporaryFilePath = `${absoluteFilePath}.${randomUUID()}.tmp`;

  await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
  try {
    await fs.writeFile(temporaryFilePath, content, { encoding: 'utf-8', flag: 'wx' });
    await fs.rename(temporaryFilePath, absoluteFilePath);
  } finally {
    await fs.unlink(temporaryFilePath).catch(() => undefined);
  }

  return relativeFilePath;
}

// /stock/api/eastmoney/board-stocks?board=cpo
// /stock/api/easymony/board-stocks?bkCode=BK1128&fileName=cpo
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const board = getSingleQueryParam(req.query.board);
  const explicitCode = getSingleQueryParam(req.query.bkCode).toUpperCase();
  const boardCode = BOARD_ALIASES.get(board.toLowerCase()) || board.toUpperCase();
  if (board && explicitCode && boardCode !== explicitCode) {
    return res.status(400).json({ error: 'board and bkCode refer to different boards' });
  }

  const bkCode = explicitCode || boardCode;
  if (!/^BK\d{4}$/.test(bkCode)) {
    return res.status(400).json({ error: 'Specify board=cpo or a board code such as bkCode=BK1128' });
  }

  const fileName = getSingleQueryParam(req.query.fileName) || (bkCode === CPO_BOARD_CODE ? 'cpo' : bkCode.toLowerCase());
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(fileName)) {
    return res.status(400).json({ error: 'fileName must contain 1-80 letters, numbers, underscores, or hyphens, without .ts' });
  }

  const exportName = getSingleQueryParam(req.query.exportName) || `a_${fileName.replace(/-/g, '_')}`;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(exportName) || /^(?:await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|implements|interface|let|package|private|protected|public|static|eval|arguments)$/.test(exportName)) {
    return res.status(400).json({ error: 'exportName must be a valid TypeScript variable name' });
  }

  try {
    const stocks = await fetchAllBoardStocks(bkCode);
    const preview = getSingleQueryParam(req.query.preview) === 'true';
    const filePath = preview ? null : await saveBoardStocks(fileName, formatBoardStocksAsTs(stocks, exportName));

    return res.status(200).json({
      success: true,
      message: preview ? 'Board stocks fetched successfully' : 'Board stocks fetched and saved successfully',
      bkCode,
      fileName,
      exportName,
      count: stocks.length,
      filePath,
      codes: stocks.map((stock) => `${stock.f13}.${stock.f12}`),
      stocks: stocks.map((stock) => ({
        code: stock.f12,
        market: stock.f13,
        name: stock.f14,
        price: typeof stock.f2 === 'number' && Number.isFinite(stock.f2) ? stock.f2 : null,
        changePercent: typeof stock.f3 === 'number' && Number.isFinite(stock.f3) ? stock.f3 : null,
      })),
    });
  } catch (error) {
    return res.status(error instanceof EastmoneyRequestError ? 502 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      bkCode,
      fileName,
      exportName,
    });
  }
}
