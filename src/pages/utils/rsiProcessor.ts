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
import { GetConvert } from "@/modules/tools/indicator/update_old";
import { CloseMA } from "@/modules/tools/indicator/ma";
import { countMACD } from "@/modules/tools/indicator/macd";
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
  RSIThresholds,
  ENABLE_ADVANCED_FEATURES,
  EGlodCrossType,
  EMA55BreadType,
} from "./config";
import { a_beijiaosuo_cn } from "../data/astock/beijiaosuo";
import { backtestRSI } from "./backtrend";
import { formatPriceChange } from "./format";
import { createEmailItem } from "./emailNotifier";
import { detectMACDFirstGoldenCross } from "./macdProcessor";
import { detectMA55FirstBreakthrough } from "./maProcessor";

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
 * 处理RSI数据并生成买卖建议（真正的异步并行版本）
 * @param params 处理参数
 * @returns Promise<RSI处理结果>
 */
export const processRSIDataAsync = async (params: IRSIProcessParams): Promise<IRSIProcessResult> => {
  const { allResults, reqType, stockLists, stockType, klt, currentDate, isBacktesting } = params;
  const kltDesc = getEKLTDesc(klt);

  const startTime = Date.now();
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 🚀 开始异步并行处理${allResults.length}个有效响应`);

  // 创建异步任务数组，使用Promise.all实现真正的并行处理
  const processTasks = allResults.map(async (responseData: unknown, index) => {
    if (!responseData) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 请求 ${index} 失败`);
      return null;
    }

    try {
      // 使用 Promise.resolve 包装同步操作，让其在微任务队列中执行
      return await Promise.resolve().then(() => 
        processSingleStockRSI({
          responseData,
          reqType,
          stockLists,
          stockType,
          klt,
          kltDesc,
          currentDate,
          isBacktesting
        })
      );
    } catch (error) {
      console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 处理股票 ${index} 数据时出错:`, error);
      return null;
    }
  });

  // 并行等待所有任务完成
  const processResults = await Promise.all(processTasks);

  // 汇总所有处理结果
  const targetRSIData: string[] = [];
  const buyList: string[] = [];
  const sellList: string[] = [];

  processResults.forEach((processResult) => {
    if (processResult) {
      const { rsiData, buyItems, sellItems } = processResult;
      if (rsiData && rsiData.length > 0) {
        targetRSIData.push(...rsiData);
      }
      buyList.push(...buyItems);
      sellList.push(...sellItems);
    }
  });

  const endTime = Date.now();
  const duration = endTime - startTime;
  const successCount = processResults.filter(r => r !== null).length;
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] ✅ 异步并行处理完成，耗时: ${duration}ms，成功处理: ${successCount}/${allResults.length} 个股票`);

  return {
    rsiDataList: targetRSIData,
    buyList,
    sellList
  };
};

/**
 * 处理RSI数据并生成买卖建议（同步版本，默认使用）
 * 注意：由于JavaScript是单线程的，同步操作无法真正并行
 * 如需真正的并行处理，请使用 processRSIDataAsync
 * @param params 处理参数
 * @returns RSI处理结果
 */
export const processRSIData = (params: IRSIProcessParams): IRSIProcessResult => {
  const { allResults, reqType, stockLists, stockType, klt, currentDate, isBacktesting } = params;
  const kltDesc = getEKLTDesc(klt);

  const startTime = Date.now();
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 开始处理${allResults.length}个有效响应（同步模式）`);

  // 使用map处理所有股票数据
  const processResults = allResults.map((responseData: unknown, index) => {
    if (!responseData) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 请求 ${index} 失败`);
      return null;
    }

    try {
      return processSingleStockRSI({
        responseData,
        reqType,
        stockLists,
        stockType,
        klt,
        kltDesc,
        currentDate,
        isBacktesting
      });
    } catch (error) {
      console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 处理股票 ${index} 数据时出错:`, error);
      return null;
    }
  });

  // 汇总所有处理结果
  const targetRSIData: string[] = [];
  const buyList: string[] = [];
  const sellList: string[] = [];

  processResults.forEach((processResult) => {
    if (processResult) {
      const { rsiData, buyItems, sellItems } = processResult;
      if (rsiData && rsiData.length > 0) {
        targetRSIData.push(...rsiData);
      }
      buyList.push(...buyItems);
      sellList.push(...sellItems);
    }
  });

  const endTime = Date.now();
  const duration = endTime - startTime;
  const successCount = processResults.filter(r => r !== null).length;
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 处理完成，耗时: ${duration}ms，成功处理: ${successCount}/${allResults.length} 个股票`);

  return {
    rsiDataList: targetRSIData,
    buyList,
    sellList
  };
};

/**
 * 高级功能处理结果
 */
interface IAdvancedFeaturesResult {
  ma55BreakThrough: boolean;
  macdGoldenCross: boolean;
  ma55BreadBreakthrough: string;
  macdGoldenCrossStr: string;
}


/**
 * 处理高级功能：MA55突破和MACD金叉检测
 * @param itemTime 当前时间点
 * @param sourceItem 当前K线数据
 * @param stockName 股票名称
 * @param ma55Data MA55数据数组
 * @param macdData MACD数据数组
 * @param RSIData RSI完整数据
 * @returns 高级功能处理结果
 */
function processAdvancedFeatures({
  itemTime,
  sourceItem,
  stockName,
  ma55Data,
  macdData,
  RSIData
}: {
  itemTime: Dayjs;
  sourceItem: Record<string, unknown> | undefined;
  stockName: string;
  ma55Data: Array<[string, number | string, number | string, number | string, number | string, number | string, number | string]>;
  macdData: Array<[string, number | string, number | string, number | string]>;
  RSIData: { full_klines: Record<string, unknown>[] };
}): IAdvancedFeaturesResult {
  // 默认返回值
  let ma55BreakThrough = false;
  let macdGoldenCross = false;
  let ma55BreadBreakthrough = '';
  let macdGoldenCrossStr = '';

  // 如果未开启高级功能或数据不完整，直接返回
  if (!ENABLE_ADVANCED_FEATURES) {
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [高级功能] 高级功能未开启 ENABLE_ADVANCED_FEATURES=${ENABLE_ADVANCED_FEATURES}`);
    return { ma55BreakThrough, macdGoldenCross, ma55BreadBreakthrough, macdGoldenCrossStr };
  }
  
  if (!sourceItem) {
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [高级功能] ${stockName} sourceItem为空，跳过处理`);
    return { ma55BreakThrough, macdGoldenCross, ma55BreadBreakthrough, macdGoldenCrossStr };
  }

  const currentPrice = Number(sourceItem.close);
  // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [高级功能] ${stockName} 开始高级功能处理 时间:${itemTime.format('YYYY-MM-DD HH:mm')} 价格:${currentPrice.toFixed(2)} MA55数据量:${ma55Data.length} MACD数据量:${macdData.length}`);
  
  // ================================= MA55首次突破检测 =================================
  if (ma55Data.length > 0) {
    const ma55Result = detectMA55FirstBreakthrough({
      itemTime,
      currentPrice,
      stockName,
      ma55Data,
      RSIData
    });
    ma55BreakThrough = ma55Result.ma55BreakThrough;
    ma55BreadBreakthrough = ma55Result.ma55BreadBreakthrough;
  } 

  // ================================= MACD首次金叉检测 =================================
  if (macdData.length > 0) {
    const macdResult = detectMACDFirstGoldenCross({
      itemTime,
      stockName,
      macdData
    });
    macdGoldenCross = macdResult.macdGoldenCross;
    macdGoldenCrossStr = macdResult.macdGoldenCrossStr;
  } 

  return { ma55BreakThrough, macdGoldenCross, ma55BreadBreakthrough, macdGoldenCrossStr };
}

/**
 * 处理单只股票的RSI数据
 */
function processSingleStockRSI({
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
    console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 数据不完整，跳过处理 ${JSON.stringify({market, stockCode, name: sourceData?.name})}`);
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

  // ================================= 高级功能：MA55和MACD计算 =================================
  let ma55Data: Array<[string, number | string, number | string, number | string, number | string, number | string, number | string]> = [];
  let macdData: Array<[string, number | string, number | string, number | string]> = [];
  
  if (ENABLE_ADVANCED_FEATURES) {
    try {
      // 计算MA55数据
      const klinesForMA = RSIData.full_klines.map((kline: Record<string, unknown>) => ({
        date: kline.date as string,
        close: kline.close as number
      }));
      ma55Data = CloseMA(klinesForMA) as Array<[string, number | string, number | string, number | string, number | string, number | string, number | string]>;
      
      // 计算MACD数据
      macdData = countMACD(klinesForMA) as Array<[string, number | string, number | string, number | string]>;
      
      // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [高级功能] ${stockName} MA55和MACD计算完成`);
    } catch (error) {
      console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [高级功能] ${stockName} MA55/MACD计算失败:`, error);
    }
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
    let suggestion = processRSISuggestion(rsiValue, rsiThresholds, stockCode, klt, isBacktesting);
    
    // 日线即使没有RSI命中信息也需要展示金叉死叉信息，其他情况没有RSI命中则去掉
   if(klt !== EKLT.DAY && klt !== EKLT['30M']) {
     if (!suggestion) {
      return null;
     }
   }

    // ================================= 高级功能：MA55过滤和MACD金叉检测 =================================
    const advancedFeatures = processAdvancedFeatures({
      itemTime,
      sourceItem,
      stockName,
      ma55Data,
      macdData,
      RSIData
    });
    
    const { ma55BreadBreakthrough, macdGoldenCrossStr } = advancedFeatures;

    // 日线情况且没有suggestion,需要重新赋值
    if(klt === EKLT.DAY && !suggestion) {
      if(macdGoldenCrossStr.includes(EGlodCrossType.FISRT_GOLDEN_CROSS) || ma55BreadBreakthrough.includes(EMA55BreadType.FISRT_BREAK_THROUGH)) {
        suggestion = ERSISuggestion.MUST_BUY
      }else if (macdGoldenCrossStr.includes(EGlodCrossType.LATEST_GOLDEN_CROSS)) {
        suggestion = ERSISuggestion.BUY
      }
    }

    // 经过RSI、MACD检查，还是没有 suggestion
    if(!suggestion)return null

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
    const emailItem = createEmailItem(item as [string, number], kltDesc || '', stockLink, stockName, suggestion, backtestingStr, currentPriceChange, currentTradeStr, increaseStr + macdGoldenCrossStr + ma55BreadBreakthrough);
    
    if (suggestion === ERSISuggestion.MUST_BUY || suggestion === ERSISuggestion.BUY) {
      buyItems.push(emailItem);
    } else if (suggestion === ERSISuggestion.MUST_SELL || suggestion === ERSISuggestion.SELL) {
      sellItems.push(emailItem);
    }

    return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${suggestion} ${backtestingStr} ${currentTradeStr} ${increaseStr}${macdGoldenCrossStr}`;
  }).filter((item: string | null) => !!item) as string[];

  return {
    rsiData: stockRSIData || [],
    buyItems,
    sellItems
  };
} 