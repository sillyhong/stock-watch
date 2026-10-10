/**
 * 上证市场股票数据获取API - shangzheng.ts
 * 
 * =========================== 重构说明 ===========================
 * 
 * 📅 重构时间: 2025-01-27
 * 🎯 重构目的: 从通用市场API分离出专门处理上海证券交易所的独立API
 * 
 * 🏛️ 市场信息:
 * - 交易所: 上海证券交易所 (SSE)
 * - fs参数: m:1+t:2,m:1+t:23
 * - 输出文件: src/pages/data/astock/shangzheng.json
 * 
 * 📈 数据范围:
 * - 主板股票 (m:1+t:2)
 * - 科创板股票 (m:1+t:23)
 * 
 * =============================================================
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const PAGE_SIZE = 100;
const TOTAL_PAGE_SIZE = 2500; // 上证股票数量预估
const API_URL = "https://push2.eastmoney.com/api/qt/clist/get";
const DEFAULT_HEADERS = {
  "accept": "*/*",
  "accept-language": "en,zh-CN;q=0.9,zh;q=0.8,es;q=0.7,ar;q=0.6",
  "cache-control": "no-cache",
  "pragma": "no-cache",
  "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Google Chrome\";v=\"138\"",
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": "\"macOS\"",
  "sec-fetch-dest": "script",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-site": "same-site"
};
const REFERRER = "https://quote.eastmoney.com/center/gridlist.html";

/**
 * API响应数据结构
 */
interface IEastmoneyApiResponse {
  data?: {
    total?: number;
    diff?: unknown[];
  };
}

/**
 * 构建上证市场的API请求URL
 * @param page 页码
 * @param pageSize 每页大小
 * @returns API请求URL
 */
function buildUrl(page: number, pageSize: number): string {
  // 上证市场: m:1+t:2 (主板) + m:1+t:23 (科创板)
  const fsParam = "m%3A1%2Bt%3A2%2Cm%3A1%2Bt%3A23";
  return `${API_URL}?np=1&fltt=1&invt=2&cb=jQuery37107019990135997664_1752983941985&fs=${fsParam}&fields=f12%2Cf13%2Cf14%2Cf1%2Cf2%2Cf4%2Cf3%2Cf152%2Cf5%2Cf6%2Cf7%2Cf15%2Cf18%2Cf16%2Cf17%2Cf10%2Cf8%2Cf9%2Cf23&fid=f3&pn=${page}&pz=${pageSize}&po=1&dect=1&ut=fa5fd1943c7b386f172d6893dbfba10b&wbp2u=1181325662278720%7C0%7C1%7C0%7Cweb&_=${Date.now()}`;
}

async function fetchStockPage(page: number, pageSize: number): Promise<IEastmoneyApiResponse> {
  const url = buildUrl(page, pageSize);
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    referrer: REFERRER,
    method: "GET",
    mode: "cors",
    credentials: "include"
  });
  const text = await res.text();
  // The response is JSONP, need to extract JSON
  const jsonStr = text.replace(/^jQuery\d+_\d+\(/, '').replace(/\);?$/, '');
  return JSON.parse(jsonStr) as IEastmoneyApiResponse;
}

async function fetchAllStocks(): Promise<unknown[]> {
  // 直接根据TOTAL_PAGE_SIZE和PAGE_SIZE计算总页数
  const totalPages = Math.ceil(TOTAL_PAGE_SIZE / PAGE_SIZE);
  console.log("🚀 [上证] fetchAllStocks ~ totalPages:", totalPages);
  
  const pagePromises: Promise<IEastmoneyApiResponse>[] = [];
  for (let page = 1; page <= totalPages; page++) {
    pagePromises.push(fetchStockPage(page, PAGE_SIZE));
  }
  
  const results = await Promise.all(pagePromises);
  const allDiffs: unknown[] = [];
  for (const result of results) {
    if (result.data?.diff) {
      console.log(`[上证] 第${results.indexOf(result) + 1}页数据长度:`, result.data.diff.length);
      allDiffs.push(...result.data.diff);
    }
  }
  return allDiffs;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许 GET 方法
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🏛️ 开始获取上海证券交易所股票数据...');
    const allStocks = await fetchAllStocks();
    
    // 确保目录存在
    const dataDir = path.join(process.cwd(), 'src/pages/data/astock');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 写入到上证专用的JSON文件
    const filePath = path.join(dataDir, 'shangzheng.json');
    fs.writeFileSync(filePath, JSON.stringify(allStocks, null, 2), 'utf-8');
    
    console.log(`✅ 上证数据获取完成，共${allStocks.length}条记录`);
    
    return res.status(200).json({ 
      message: '上海证券交易所股票数据获取并保存成功', 
      market: '上证',
      count: allStocks.length,
      filePath: 'src/pages/data/astock/shangzheng.json'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ 获取上证股票数据失败:', errorMessage);
    return res.status(500).json({ 
      error: errorMessage,
      market: '上证' 
    });
  }
}
