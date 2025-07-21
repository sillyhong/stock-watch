/**
 * RSI数据处理模块 - rsiProcessor.ts
 * 
 * =========================== 重构说明 ===========================
 * 
 * 📅 重构时间: 2025-01-27
 * 🎯 重构目的: 从 fetchRSIAndSendEmail.ts 中提取RSI计算和股票分析逻辑，实现业务逻辑模块化
 * 
 * 🔄 主要改动:
 * 1. 提取了RSI数据处理逻辑 (原第269-391行)
 * 2. 抽离了股票信息格式化逻辑 (原第289-307行)
 * 3. 分离了筹码集中度分析功能 (原第316-321行)
 * 4. 重构了买卖建议生成逻辑 (原第330-383行)
 * 5. 优化了回测数据处理流程 (原第370-376行)
 * 
 * 📈 重构收益:
 * - 业务聚焦: 专注于RSI指标计算和股票分析
 * - 逻辑清晰: 将复杂的数据处理流程分解为小函数
 * - 类型安全: 改善了数据类型定义和错误处理
 * - 易扩展性: 便于添加新的技术指标分析
 * 
 * 🔗 依赖关系:
 * - 接收 dataFetcher.ts 提供的原始数据
 * - 为 emailNotifier.ts 提供处理后的结果
 * - 被 fetchRSIAndSendEmail.ts 协调调用
 * 
 * 📦 导出函数:
 * - processRSIData: 主要的RSI数据处理函数
 * 
 * 🧮 核心算法:
 * - RSI指标计算和阈值判断
 * - 股票名称特殊标识 ([北]、[创] 等)
 * - 筹码集中度趋势分析
 * - 价格变化和交易方向判断
 * 
 * =============================================================
 */

import dayjs, { Dayjs } from "dayjs";
import { formatKlinesData } from "./formatKlines";
import { GetConvert } from "@/modules/tools/indicator/origin_old";
import { 
  EStockType, 
  MarketType, 
  EKLT, 
  getEKLTDesc, 
  IStockData 
} from "../interface";
import { IFutuStockInfo } from "../interface/futu";
import { 
  ERSISuggestion,
  EReqType,
  calculateChipConcentration,
  calculatePriceChangeData,
  processFutuData,
  processRSISuggestion,
  shouldFilterByTime,
  RSIThresholds
} from "./config";
import { a_beijiaosuo_cn } from "../data/astock/beijiaosuo";
import { backtestRSI } from "./backtrend";
import { formatPriceChange } from "./format";
import { createEmailItem } from "./emailNotifier";

/**
 * RSI处理结果
 */
export interface IRSIProcessResult {
  rsiDataList: string[];
  buyList: string[];
  sellList: string[];
}

/**
 * RSI数据处理参数
 */
export interface IRSIProcessParams {
  allResults: unknown[];
  reqType: EReqType;
  stockLists: (string | IFutuStockInfo)[];
  stockType: EStockType;
  klt: EKLT;
  currentDate: Dayjs;
  isBacktesting: boolean;
}

/**
 * 处理RSI数据并生成买卖建议
 * @param params 处理参数
 * @returns RSI处理结果
 */
export const processRSIData = (params: IRSIProcessParams): IRSIProcessResult => {
  const { allResults, reqType, stockLists, stockType, klt, currentDate, isBacktesting } = params;
  const kltDesc = getEKLTDesc(klt);
  const targetRSIData: string[] = [];
  const buyList: string[] = [];
  const sellList: string[] = [];

  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 开始处理${allResults.length}个有效响应`);

  allResults.forEach((responseData: unknown, index) => {
    if (!responseData) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 请求 ${index} 失败`);
      return;
    }

    try {
      const processResult = processSingleStock({
        responseData,
        reqType,
        stockLists,
        stockType,
        klt,
        kltDesc,
        currentDate,
        isBacktesting
      });

      if (processResult) {
        const { rsiData, buyItems, sellItems } = processResult;
        if (rsiData && rsiData.length > 0) {
          targetRSIData.push(...rsiData);
        }
        buyList.push(...buyItems);
        sellList.push(...sellItems);
      }
    } catch (error) {
      console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 处理股票数据时出错:`, error);
    }
  });

  return {
    rsiDataList: targetRSIData,
    buyList,
    sellList
  };
};

/**
 * 处理单只股票的RSI数据
 */
function processSingleStock({
  responseData,
  reqType,
  stockLists,
  stockType,
  klt,
  kltDesc,
  currentDate,
  isBacktesting
}: {
  responseData: unknown;
  reqType: EReqType;
  stockLists: (string | IFutuStockInfo)[];
  stockType: EStockType;
  klt: EKLT;
  kltDesc: string | undefined;
  currentDate: Dayjs;
  isBacktesting: boolean;
}) {
  // ================================= 数据源处理 =================================
  let sourceData: IStockData = {};
  
  if (reqType === EReqType.EASY_MONEY) {
    const response = responseData as { data?: { data?: IStockData } };
    sourceData = response?.data?.data || {};
  } else {
    sourceData = processFutuData(responseData, stockLists);
  }

  // ================================= 股票信息提取 =================================
  const market = sourceData?.market;
  const stockCode = sourceData?.code;
  if (market === undefined || !stockCode || !sourceData?.name) {
    console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 股票数据不完整，跳过处理 ${{market, stockCode, name: sourceData?.name}}`);
    return null;
  }

  // 股票名称格式化：添加特殊标识
  let stockName = a_beijiaosuo_cn.includes(sourceData.name) 
    ? `[北]${sourceData.name}` 
    : sourceData.name;
  
  if (stockCode.startsWith('300') || stockCode.startsWith('688')) {
    stockName = `[创]${stockName}`;
  }

  const marketType = (MarketType as Record<number, string>)[market];
  if (!marketType) {
    console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 未知市场类型: ${market}`);
    return null;
  }

  // ================================= RSI计算 =================================
  const RSIData = formatKlinesData(sourceData);
  if (!RSIData?.full_klines || RSIData.full_klines.length === 0) {
    console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] RSI数据为空，跳过${stockName}`);
    return null;
  }

  // ================================= 筹码集中度分析 =================================
  let isChipIncrease = false;
  if (reqType === EReqType.EASY_MONEY && klt === EKLT.DAY) {
    isChipIncrease = calculateChipConcentration(RSIData);
  }

  // ================================= 价格变化计算 =================================
  const priceChangeMap = calculatePriceChangeData(RSIData, stockType, klt);

  // ================================= RSI分析与建议生成 =================================
  const fullKlinesData = GetConvert('RSI', RSIData.full_klines, { market, stockCode, stockName, kltDesc });
  
  const buyItems: string[] = [];
  const sellItems: string[] = [];
  
  const stockRSIData = (fullKlinesData || []).map((item: unknown[]) => {
    const itemTime = dayjs(item[0] as string);
    const formatItemTime = dayjs(item[0] as string).format('YYYY-MM-DD HH:mm');
    
    // 格式化价格变化和趋势信息
    const currentPriceChange = formatPriceChange(priceChangeMap?.priceChange?.[formatItemTime]);
    const currentTrade = priceChangeMap?.tradeDirection?.[formatItemTime];
    const currentTradeStr = currentTrade ? "" : "⬇️";

    // 时间过滤：只保留相关时间范围内的数据
    const diffInMinutes = currentDate.diff(itemTime, 'minute');
    if (shouldFilterByTime(diffInMinutes, klt, isBacktesting)) {
      return null;
    }

    // RSI阈值判断
    const sourceItem = RSIData?.full_klines?.find((klineItem: Record<string, unknown>) => 
      dayjs(klineItem?.date as string).isSame(itemTime, 'minute')
    );
    
    const rsiThresholds = RSIThresholds[stockType][klt];
    if (!rsiThresholds) {
      console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 未找到RSI阈值配置: ${stockType}-${klt}`);
      return null;
    }

    const rsiValue = Number(item?.[1]);
    const suggestion = processRSISuggestion(rsiValue, rsiThresholds, stockCode, klt, isBacktesting);
    
    if (!suggestion) {
      return null;
    }

    // 生成显示字符串和邮件项
    const increaseStr = isChipIncrease ? '💹' : '';
    const stockLink = `https://quote.eastmoney.com/${marketType}${stockCode}.html?from=classic#fullScreenChart`;
    
    let backtestingStr = '';
    if (isBacktesting && sourceItem) {
      const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType);
      const nextDayStr = backData?.nextdayPercentageProfit ? `next: ${backData.nextdayPercentageProfit}` : '';
      backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr}`;
    }

    // 添加到对应的建议列表
    const emailItem = createEmailItem(item, kltDesc || '', stockLink, stockName, suggestion, backtestingStr, currentPriceChange, currentTradeStr, increaseStr);
    
    if (suggestion === ERSISuggestion.MUST_BUY || suggestion === ERSISuggestion.BUY) {
      buyItems.push(emailItem);
    } else if (suggestion === ERSISuggestion.MUST_SELL || suggestion === ERSISuggestion.SELL) {
      sellItems.push(emailItem);
    }

    return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${suggestion} ${backtestingStr} ${currentTradeStr} ${increaseStr}`;
  }).filter((item: string | null) => !!item) as string[];

  return {
    rsiData: stockRSIData || [],
    buyItems,
    sellItems
  };
} 