/**
 * A股全市场日RSI监控API - a-all.ts
 * 
 * =========================== 功能说明 ===========================
 * 
 * 📅 创建时间: 2025-01-27
 * 🎯 功能目的: 整合三大交易所全市场股票的日RSI监控和预警
 * 
 * 🏛️ 数据源:
 * - 上海证券交易所: src/pages/data/astock/shangzheng.json
 * - 深圳证券交易所: src/pages/data/astock/shenzheng.json
 * - 北京证券交易所: src/pages/data/astock/beijiaosuo.json
 * 
 * 📊 处理流程:
 * 1. 读取三个市场的JSON数据文件
 * 2. 合并所有股票代码，去重处理
 * 3. 调用日RSI数据获取和分析逻辑
 * 4. 生成买卖建议并发送邮件通知
 * 5. 返回完整的RSI分析结果
 * 
 * 📈 技术特性:
 * - 支持全市场股票监控 (预计5000+只股票)
 * - 基于fetchRSIAndSendEmail.ts的成熟逻辑
 * - 使用日线数据进行RSI计算
 * - 智能邮件通知系统
 * - 完整的错误处理和日志记录
 * 
 * 🔗 API调用: GET /api/day-rsi-watch/a-all
 * 
 * =============================================================
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { fetchRSIAndSendEmail } from '../../utils/fetchRSIAndSendEmail';
import { EStockType, EKLT } from '../../interface';
import { EReqType } from '../../utils/config';

/**
 * 东方财富API股票数据结构
 */
interface IEastmoneyStock {
  f12: string; // 股票代码
  f14: string; // 股票名称
  f13?: number; // 市场代码
  [key: string]: unknown;
}

/**
 * 从JSON文件读取股票数据
 * @param filePath JSON文件路径
 * @param marketName 市场名称（用于日志）
 * @returns 股票代码数组
 */
async function readStockDataFromFile(filePath: string, marketName: string): Promise<string[]> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ [${marketName}] 数据文件不存在: ${filePath}`);
      return [];
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const stockData: IEastmoneyStock[] = JSON.parse(fileContent);
    
    if (!Array.isArray(stockData)) {
      console.error(`❌ [${marketName}] 数据格式错误，不是数组格式`);
      return [];
    }

    // 提取股票代码，过滤无效数据
    const stockCodes = stockData
      .filter(stock => stock?.f12 && typeof stock.f12 === 'string')
      .map(stock => stock.f12)
      .filter(code => code.trim().length > 0);

    console.log(`✅ [${marketName}] 成功读取${stockCodes.length}只股票`);
    return stockCodes;

  } catch (error) {
    console.error(`❌ [${marketName}] 读取数据文件失败:`, error);
    return [];
  }
}

/**
 * 获取全市场股票代码列表
 * @returns 去重后的股票代码数组
 */
async function getAllMarketStocks(): Promise<string[]> {
  const dataDir = path.join(process.cwd(), 'src/pages/data/astock');
  
  const [rawShangzhengStocks, rawShenzhengStocks, rawBeijiaosuoStocks] = await Promise.all([
    readStockDataFromFile(path.join(dataDir, 'shangzheng.json'), '上证'),
    readStockDataFromFile(path.join(dataDir, 'shenzheng.json'), '深证'),
    readStockDataFromFile(path.join(dataDir, 'beijiaosuo.json'), '北交所')
  ]);
  const shangzhengStocks = rawShangzhengStocks.map(code => `1.${code}`);
  const shenzhengStocks = rawShenzhengStocks.map(code => `0.${code}`);
  const beijiaosuoStocks = rawBeijiaosuoStocks.map(code => `1.${code}`);

  // 合并所有股票代码并去重
  const allStocks = [
    // ...shangzhengStocks,
    // ...shenzhengStocks,
    ...beijiaosuoStocks
  ];

  // 去重处理
  const uniqueStocks = Array.from(new Set(allStocks));
  
  console.log(`📊 全市场股票统计:`);
  console.log(`   上证: ${shangzhengStocks.length}只`);
  console.log(`   深证: ${shenzhengStocks.length}只`);
  console.log(`   北交所: ${beijiaosuoStocks.length}只`);
  console.log(`   总计: ${allStocks.length}只`);
  console.log(`   去重后: ${uniqueStocks.length}只`);

  return uniqueStocks;
}

/**
 * 全市场日RSI监控主处理函数
 */
async function processAllMarketDayRSI(): Promise<unknown[]> {
  try {
    console.log(`🚀 [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 开始全市场日RSI监控...`);

    // 1. 获取全市场股票列表
    const allStocks = await getAllMarketStocks();
    console.log("🚀 ~ processAllMarketDayRSI ~ allStocks:", allStocks)
    
    if (allStocks.length === 0) {
      throw new Error('未找到任何股票数据，请先运行市场数据获取API');
    }

    console.log(`📈 准备分析${allStocks.length}只股票的日RSI数据...`);

    // 2. 调用RSI分析处理逻辑
    const rsiResults = await fetchRSIAndSendEmail({
      reqType: EReqType.EASY_MONEY,
      stockLists: allStocks,
      stockType: EStockType.A,
      klt: EKLT.DAY, // 使用日线数据
      currentDate: dayjs(),
      sendEmail: true, // 启用邮件通知
      isBacktesting: false
    });

    console.log(`✅ [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 全市场日RSI监控完成`);
    console.log(`📊 RSI分析结果: ${rsiResults.length}条有效数据`);

    return rsiResults;

  } catch (error) {
    console.error(`❌ [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 全市场日RSI监控失败:`, error);
    throw error;
  }
}

/**
 * Next.js API路由处理器
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许 GET 方法
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: '方法不被允许',
      message: '只支持GET请求' 
    });
  }

  try {
    console.log(`🎯 [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 收到全市场日RSI监控请求`);

    // 执行全市场RSI分析
    const results = await processAllMarketDayRSI();

    // 统计买卖建议数量
    const buyCount = results.filter((item: unknown) => 
      typeof item === 'object' && item !== null && 
      'suggestion' in item && (item as Record<string, unknown>).suggestion === 'buy'
    ).length;
    const sellCount = results.filter((item: unknown) => 
      typeof item === 'object' && item !== null && 
      'suggestion' in item && (item as Record<string, unknown>).suggestion === 'sell'
    ).length;
    const totalAnalyzed = results.length;

    return res.status(200).json({
      success: true,
      message: 'A股全市场日RSI监控完成',
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      statistics: {
        totalAnalyzed,
        buySignals: buyCount,
        sellSignals: sellCount,
        markets: ['上证', '深证', '北交所']
      },
      data: results
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ API处理失败:`, errorMessage);
    
    return res.status(500).json({
      success: false,
      error: '全市场日RSI监控失败',
      message: errorMessage,
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
  }
}
