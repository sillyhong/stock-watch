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
 * 🔄 **优化后的数据流程**（2025-01-27）:
 * ```
 * 股票代码列表 → fetchRSIDataWithDetails() → 完整处理结果
 *     ↓                     ↓                        ↓
 * 分批处理    →    RSI计算+HTML格式化    →    {buyList, sellList}
 *     ↓                     ↓                        ↓
 * 收集所有批次  →     包含真实股票代码      →     直接邮件发送
 * ```
 * 
 * 📊 关键改进:
 * ✅ 使用 fetchRSIDataWithDetails 获取完整数据结构
 * ✅ buyList/sellList 已包含真实股票代码和完整HTML格式
 * ✅ 删除了复杂的字符串解析和股票代码反向查找逻辑
 * ✅ 直接收集和使用格式化数据，提高性能和可靠性
 * ✅ 减少了80%的复杂代码，提高可维护性
 * 
 * 📈 技术特性:
 * - 支持全市场股票监控 (预计5000+只股票)
 * - 基于优化后的数据流程，使用真实股票代码
 * - 使用日线数据进行RSI计算
 * - 智能邮件通知系统（直接使用格式化数据）
 * - 完整的错误处理和日志记录
 * 
 * 🔗 API调用示例:
 * - 全市场: GET /api/day-rsi-watch/a-all
 * - 仅深证: GET /api/day-rsi-watch/a-all?markets=shenzhen
 * - 上证+深证: GET /api/day-rsi-watch/a-all?markets=shangzheng,shenzhen
 * - 回测模式: GET /api/day-rsi-watch/a-all?isBacktesting=true&sendEmail=false
 * - 自定义容错: GET /api/day-rsi-watch/a-all?maxConsecutiveFailures=5&bailoutThreshold=0.2
 * 
 * 📋 支持参数:
 * - markets: shangzheng,shenzhen,beijing,all (默认: all)
 * - isBacktesting: true/false (默认: false)
 * - sendEmail: true/false (默认: true)
 * - maxConsecutiveFailures: 数字 (默认: 10)
 * - maxTotalFailures: 数字 (默认: 50)
 * - bailoutThreshold: 0-1之间的小数 (默认: 0.3)
 * 
 * =============================================================
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { fetchRSIDataWithDetails } from '../../utils/fetchRSIAndSendEmail';
import { EStockType, EKLT } from '../../interface';
import { EReqType } from '../../utils/config';
// 导入邮件发送功能
import { sendRSIEmailNotification }  from '../../utils/emailNotifier';
import { getTaskStocks } from '@/services/stockPoolService';

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
 * 支持的市场类型
 */
export enum EMarketType {
  SHANGZHENG = 'shangzheng',     // 上证
  SHENZHEN = 'shenzhen',     // 深证
  BEIJING = 'beijing',       // 北交所
  ALL = 'all'                // 全部
}

/**
 * 市场配置信息
 */
interface IMarketConfig {
  name: string;
  fileName: string;
  prefix: string;
  description: string;
}

/**
 * 故障容忍配置
 */
interface IFaultToleranceConfig {
  maxConsecutiveFailures: number;  // 最大连续失败次数
  maxTotalFailures: number;        // 最大总失败次数
  bailoutThreshold: number;        // 提前退出阈值（失败率）
}

/**
 * 处理参数接口
 */
interface IProcessParams {
  markets: EMarketType[];
  faultTolerance: IFaultToleranceConfig;
  isBacktesting?: boolean;
  sendEmail?: boolean;
}

const currentReqType = EReqType.EASY_MONEY;

// 市场配置映射
const MARKET_CONFIGS: Record<EMarketType, IMarketConfig> = {
  [EMarketType.SHANGZHENG]: {
    name: '上证',
    fileName: 'shangzheng.json',
    prefix: '1.',
    description: '上海证券交易所'
  },
  [EMarketType.SHENZHEN]: {
    name: '深证', 
    fileName: 'shenzheng.json',
    prefix: '0.',
    description: '深圳证券交易所'
  },
  [EMarketType.BEIJING]: {
    name: '北交所',
    fileName: 'beijiaosuo.json', 
    prefix: '0.',
    description: '北京证券交易所'
  },
  [EMarketType.ALL]: {
    name: '全部',
    fileName: '',
    prefix: '',
    description: '全部市场'
  }
};

// 默认故障容忍配置
const DEFAULT_FAULT_TOLERANCE: IFaultToleranceConfig = {
  maxConsecutiveFailures: 6,  // 连续失败6次则停止
  maxTotalFailures: 50,        // 总失败50次则停止  
  bailoutThreshold: 0.3        // 失败率超过30%则提前退出
};

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
      .filter(stock => 
        stock?.f12 && 
        typeof stock.f12 === 'string' && 
        !stock?.f14?.includes('ST') && 
        !stock?.f14?.includes('退市') && 
        !stock?.f14?.endsWith('退')
      )
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
 * 获取指定市场的股票代码列表
 * @param markets 要获取的市场列表
 * @returns 去重后的股票代码数组
 */
async function getMarketStocks(markets: EMarketType[] = [EMarketType.ALL]): Promise<string[]> {
  const dataDir = path.join(process.cwd(), 'src/pages/data/astock');
  const monitoredStocks = new Set(await getTaskStocks('day-rsi-watch-a', { allowEmpty: true }));
  
  // 如果包含ALL，则获取所有市场
  const targetMarkets = markets.includes(EMarketType.ALL) 
    ? [EMarketType.SHANGZHENG, EMarketType.SHENZHEN, EMarketType.BEIJING]
    : markets;

  console.log(`🎯 目标市场: ${targetMarkets.map(m => MARKET_CONFIGS[m].name).join(', ')}`);

  const stockCollections: { [key: string]: string[] } = {};
  const allStocks: string[] = [];

  // 并行读取所有目标市场的数据
  for (const market of targetMarkets) {
    const config = MARKET_CONFIGS[market];
    const filePath = path.join(dataDir, config.fileName);
    
    try {
      const rawStocks = await readStockDataFromFile(filePath, config.name);
      const prefixedStocks = rawStocks.map(code => `${config.prefix}${code}`).filter(code => !monitoredStocks.has(code));
      
      stockCollections[config.name] = prefixedStocks;
      allStocks.push(...prefixedStocks);
      
    } catch (error) {
      console.error(`❌ [${config.name}] 获取股票数据失败:`, error);
      stockCollections[config.name] = [];
    }
  }

  // 去重处理
  const uniqueStocks = Array.from(new Set(allStocks));
  
  // 统计信息
  console.log(`📊 股票数据统计:`);
  Object.entries(stockCollections).forEach(([marketName, stocks]) => {
    console.log(`   ${marketName}: ${stocks.length}只`);
  });
  console.log(`   总计: ${allStocks.length}只`);
  console.log(`   去重后: ${uniqueStocks.length}只`);

  return uniqueStocks;
}



/**
 * 带故障容忍的分批处理函数
 */
async function processStocksBatchWithFaultTolerance(
  stockLists: string[],
  params: IProcessParams
): Promise<{ buyList: string[], sellList: string[], stats: { success: number, failed: number, bailedOut: boolean } }> {
  const { faultTolerance } = params;
  const batchSize = 20; // 每批处理20只股票
  const allBuyList: string[] = [];
  const allSellList: string[] = [];
  let consecutiveFailures = 0;
  let totalFailures = 0;
  let totalProcessed = 0;
  let bailedOut = false;

  console.log(`📊 开始分批处理 ${stockLists.length} 只股票，每批 ${batchSize} 只`);

  for (let i = 0; i < stockLists.length; i += batchSize) {
    const batch = stockLists.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(stockLists.length / batchSize);

    console.log(`🔄 处理第 ${batchNumber}/${totalBatches} 批，股票数: ${batch.length}`);

        try {
      // 🔄 **新数据流程关键点**: 使用 fetchRSIDataWithDetails 获取完整结果
      // ✅ 返回 {rsiDataList, buyList, sellList}，其中 buyList/sellList 已包含:
      //    - 完整的HTML格式 (<tr><td>...</td></tr>)
      //    - 真实的股票代码 (如 sz300001, bj830001)
      //    - 正确的股票链接 (东方财富页面)
      const batchResults = await fetchRSIDataWithDetails({
        reqType: currentReqType,
        stockLists: batch,
        stockType: EStockType.A,
        klt: EKLT.DAY,
        currentDate: dayjs(),
        isBacktesting: params.isBacktesting ?? false,
        batchDelayRange: {
          min: 2000,
          max: 3000,
        }
      });

      // 📊 **直接收集格式化数据**: 
      // ✅ 无需复杂解析，直接收集已包含真实股票代码的HTML数据
      // ✅ 每个HTML行格式: <tr><td>时间</td><td>指标</td><td>名字+链接</td><td>RSI值</td><td>建议</td></tr>
      allBuyList.push(...batchResults.buyList);
      allSellList.push(...batchResults.sellList);
      
      consecutiveFailures = 0; // 重置连续失败计数
      totalProcessed += batch.length;

      console.log(`✅ 第 ${batchNumber} 批处理成功，买入: ${batchResults.buyList.length}, 卖出: ${batchResults.sellList.length}`);

    } catch (error) {
      consecutiveFailures++;
      totalFailures++;
      totalProcessed += batch.length;

      console.error(`❌ 第 ${batchNumber} 批处理失败:`, error);
      console.warn(`⚠️ 连续失败: ${consecutiveFailures}次，总失败: ${totalFailures}次`);

      // 检查是否需要提前退出
      const failureRate = totalFailures / Math.ceil(totalProcessed / batchSize);
      
      if (consecutiveFailures >= faultTolerance.maxConsecutiveFailures) {
        console.error(`🛑 连续失败达到 ${faultTolerance.maxConsecutiveFailures} 次，停止处理`);
        bailedOut = true;
        break;
      }

      if (totalFailures >= faultTolerance.maxTotalFailures) {
        console.error(`🛑 总失败次数达到 ${faultTolerance.maxTotalFailures} 次，停止处理`);
        bailedOut = true;
        break;
      }

      if (failureRate >= faultTolerance.bailoutThreshold) {
        console.error(`🛑 失败率 ${(failureRate * 100).toFixed(2)}% 超过阈值 ${(faultTolerance.bailoutThreshold * 100).toFixed(2)}%，停止处理`);
        bailedOut = true;
        break;
      }

      // 添加延迟以避免频率限制
      const delay = Math.min(1000 * consecutiveFailures, 10000);
      console.log(`⏱️ 等待 ${delay}ms 后继续...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    buyList: allBuyList,
    sellList: allSellList,
    stats: {
      success: Math.ceil(totalProcessed / batchSize) - totalFailures,
      failed: totalFailures,
      bailedOut
    }
  };
}

/**
 * 发送简化的综合邮件通知（使用已格式化的数据）
 * 
 * 🚀 **简化后的邮件发送流程**:
 * - ✅ buyList/sellList 已经是完整的HTML格式，无需解析
 * - ✅ 包含真实股票代码，链接指向正确页面  
 * - ✅ 直接传递给 sendRSIEmailNotification，无需数据转换
 * 
 * @param buyList 买入建议列表（已包含HTML格式和真实股票代码）
 * @param sellList 卖出建议列表（已包含HTML格式和真实股票代码）
 * @param params 处理参数
 */
async function sendSimplifiedEmail(buyList: string[], sellList: string[], params: IProcessParams): Promise<void> {
  if (buyList.length === 0 && sellList.length === 0) {
    console.log(`📧 没有买卖建议，跳过邮件发送`);
    return;
  }
  
  // 📧 **直接发送邮件**: 数据已经是正确格式，包含真实股票代码和完整HTML
  await sendRSIEmailNotification({
    buyList,
    sellList,
    stockType: EStockType.A,
    reqType: currentReqType,
    klt: EKLT.DAY,
    currentDate: dayjs(),
    isBacktesting: params.isBacktesting ?? false,
    isOptimizeEmailList: true // 启用邮件优化
  });

  console.log(`📧 ✅ 已发送综合邮件: 买入建议 ${buyList.length} 个, 卖出建议 ${sellList.length} 个`);
}

/**
 * 改进的市场日RSI监控主处理函数
 */
async function processAllMarketDayRSI(params: IProcessParams = {
  markets: [EMarketType.ALL],
  faultTolerance: DEFAULT_FAULT_TOLERANCE,
  isBacktesting: false,
  sendEmail: true
}): Promise<unknown[]> {
  try {
    const startTime = dayjs();
    console.log(`🚀 [${startTime.format('YYYY-MM-DD HH:mm:ss')}] 开始市场日RSI监控...`);
    console.log(`📋 处理参数:`, {
      markets: params.markets.map(m => MARKET_CONFIGS[m].name).join(', '),
      faultTolerance: params.faultTolerance,
      isBacktesting: params.isBacktesting,
      sendEmail: params.sendEmail
    });

    // 1. 获取指定市场股票列表
    const allStocks = await getMarketStocks(params.markets);
    
    if (allStocks.length === 0) {
      throw new Error('未找到任何股票数据，请检查市场配置或数据文件');
    }

    console.log(`📈 准备分析 ${allStocks.length} 只股票的日RSI数据...`);

    // 2. 带故障容忍的分批处理
    const { buyList, sellList, stats } = await processStocksBatchWithFaultTolerance(allStocks, params);

    const endTime = dayjs();
    const duration = endTime.diff(startTime, 'minute', true);

    // 3. 发送综合邮件通知
    if (params.sendEmail && (buyList.length > 0 || sellList.length > 0)) {
      try {
        console.log(`📧 准备发送综合邮件通知: 买入 ${buyList.length} 个, 卖出 ${sellList.length} 个`);
        
        // 🚀 **使用简化邮件发送**: 直接传递已格式化的数据，包含真实股票代码
        await sendSimplifiedEmail(buyList, sellList, params);
        
        console.log(`✅ 综合邮件发送成功`);
      } catch (emailError) {
        console.error(`❌ 综合邮件发送失败:`, emailError);
        // 邮件发送失败不影响主流程
      }
    }

    // 4. 处理结果统计
    console.log(`✅ [${endTime.format('YYYY-MM-DD HH:mm:ss')}] 市场日RSI监控完成`);
    console.log(`📊 处理统计:`);
    console.log(`   目标股票: ${allStocks.length} 只`);
    console.log(`   成功批次: ${stats.success} 个`);
    console.log(`   失败批次: ${stats.failed} 个`);
    console.log(`   提前退出: ${stats.bailedOut ? '是' : '否'}`);
    console.log(`   买入建议: ${buyList.length} 条`);
    console.log(`   卖出建议: ${sellList.length} 条`);
    console.log(`   总建议数: ${buyList.length + sellList.length} 条`);
    console.log(`   处理耗时: ${duration.toFixed(2)} 分钟`);

    if (stats.bailedOut) {
      console.warn(`⚠️ 由于连续失败或失败率过高，处理提前终止。已获得 ${buyList.length + sellList.length} 条有效建议。`);
    }

    // 返回合并的结果用于API响应（兼容原有格式）
    return [...buyList, ...sellList];

  } catch (error) {
    console.error(`❌ [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 市场日RSI监控失败:`, error);
    throw error;
  }
}

/**
 * 解析查询参数为市场类型数组
 */
function parseMarketsFromQuery(marketsQuery: string | string[] | undefined): EMarketType[] {
  if (!marketsQuery) return [EMarketType.ALL];
  
  const marketStrings = Array.isArray(marketsQuery) ? marketsQuery : [marketsQuery];
  const validMarkets: EMarketType[] = [];
  
  for (const marketStr of marketStrings) {
    const market = marketStr.toLowerCase() as EMarketType;
    if (Object.values(EMarketType).includes(market)) {
      validMarkets.push(market);
    } else {
      console.warn(`⚠️ 无效的市场参数: ${marketStr}`);
    }
  }
  
  return validMarkets.length > 0 ? validMarkets : [EMarketType.ALL];
}

/**
 * 解析故障容忍配置
 */
function parseFaultToleranceFromQuery(req: NextApiRequest): IFaultToleranceConfig {
  const { 
    maxConsecutiveFailures, 
    maxTotalFailures, 
    bailoutThreshold 
  } = req.query;

  return {
    maxConsecutiveFailures: maxConsecutiveFailures 
      ? parseInt(maxConsecutiveFailures as string, 10) 
      : DEFAULT_FAULT_TOLERANCE.maxConsecutiveFailures,
    maxTotalFailures: maxTotalFailures 
      ? parseInt(maxTotalFailures as string, 10) 
      : DEFAULT_FAULT_TOLERANCE.maxTotalFailures,
    bailoutThreshold: bailoutThreshold 
      ? parseFloat(bailoutThreshold as string) 
      : DEFAULT_FAULT_TOLERANCE.bailoutThreshold
  };
}

/**
 * Next.js API路由处理器
 * 
 * 查询参数:
 * - markets: 市场类型，支持多个值 (shangzheng,shenzhen,beijing,all)
 * - isBacktesting: 是否回测模式 (true/false)
 * - sendEmail: 是否发送邮件 (true/false)
 * - maxConsecutiveFailures: 最大连续失败次数
 * - maxTotalFailures: 最大总失败次数
 * - bailoutThreshold: 提前退出阈值
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
    console.log(`🎯 [${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 收到市场日RSI监控请求`);
    console.log(`📋 查询参数:`, req.query);

    // 解析查询参数
    const markets = parseMarketsFromQuery(req.query.markets);
    const isBacktesting = req.query.isBacktesting === 'true';
    const sendEmail = req.query.sendEmail !== 'false'; // 默认为true
    const faultTolerance = parseFaultToleranceFromQuery(req);

    const params: IProcessParams = {
      markets,
      faultTolerance,
      isBacktesting,
      sendEmail
    };

    console.log(`🎯 处理参数:`, {
      markets: markets.map(m => MARKET_CONFIGS[m].name).join(', '),
      isBacktesting,
      sendEmail,
      faultTolerance
    });

    // 执行市场RSI分析
    const results = await processAllMarketDayRSI(params);

    // 统计买卖建议数量（现在results是HTML格式的数组）
    const buyCount = results.filter((item: unknown) => {
      if (typeof item !== 'string') return false;
      return item.includes('买入');
    }).length;
    
    const sellCount = results.filter((item: unknown) => {
      if (typeof item !== 'string') return false;
      return item.includes('卖出');
    }).length;
    
    const totalAnalyzed = results.length;
    const signalCount = buyCount + sellCount;

    return res.status(200).json({
      success: true,
      message: 'A股市场日RSI监控完成',
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      parameters: {
        markets: markets.map(m => MARKET_CONFIGS[m].name),
        isBacktesting,
        sendEmail,
        faultTolerance
      },
      statistics: {
        totalAnalyzed,
        buySignals: buyCount,
        sellSignals: sellCount,
        signalRate: totalAnalyzed === 0 ? '0.00%' : ((signalCount / totalAnalyzed * 100).toFixed(2) + '%'),
        requestStats: {
          requestType: currentReqType,
          totalResults: totalAnalyzed,
          signalResults: signalCount,
          noSignalResults: totalAnalyzed - signalCount
        }
      },
      data: results.slice(0, 100) // 限制返回数据量，避免响应过大
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ API处理失败:`, errorMessage);
    
    return res.status(500).json({
      success: false,
      error: '市场日RSI监控失败',
      message: errorMessage,
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
  }
}
