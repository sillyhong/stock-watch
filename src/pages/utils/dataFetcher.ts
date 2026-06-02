/**
 * 数据获取模块 - dataFetcher.ts
 * 
 * =========================== 重构说明 ===========================
 * 
 * 📅 重构时间: 2025-01-27
 * 🎯 重构目的: 从 fetchRSIAndSendEmail.ts (433行) 中提取数据获取逻辑，实现模块化
 * 
 * 🔄 主要改动:
 * 1. 提取了批量股票数据获取逻辑 (原第139-267行)
 * 2. 抽离了请求头生成函数 (原第140-160行)
 * 3. 统一了错误处理和请求统计 (原第180-267行)
 * 4. 优化了批次处理和延迟控制逻辑
 * 
 * 📈 重构收益:
 * - 单一职责: 专注于数据获取功能
 * - 可复用性: 可被其他模块独立使用
 * - 易测试性: 独立的数据获取逻辑便于单元测试
 * - 错误隔离: 数据获取错误不影响其他模块
 * 
 * 🔗 依赖关系:
 * - 被 fetchRSIAndSendEmail.ts 调用
 * - 为 rsiProcessor.ts 提供原始数据
 * 
 * 📦 导出函数:
 * - batchFetchStockData: 批量获取股票数据
 * - logRequestStatistics: 打印请求统计信息
 * 
 * =============================================================
 */

import dayjs from "dayjs";
import { 
  EReqType, 
  BATCH_DELAY_RANGE, 
  createBatches,
  createEastmoneyRequest,
  createFutuRequest,
  getStockIdentifier,
  getStockName,
  getSimplifiedErrorMessage
} from "./config";
import { 
  ACCEPT_LANGUAGES, 
  ACCEPTS, 
  COOKIES, 
  getRandomUserAgent, 
  getRandomUserToken, 
  randomDelay, 
  randomFromArray, 
  randomIP, 
  REFERERS 
} from "./header";
import { IRequestFailureInfo } from "../interface";
import { IFutuStockInfo } from "../interface/futu";

/**
 * 批量数据获取结果
 */
export interface IBatchFetchResult {
  results: unknown[];
  requestFailures: IRequestFailureInfo[];
  totalRequestCount: number;
  successfulRequestCount: number;
}

/**
 * 批量获取股票数据
 * @param params 请求参数
 * @returns 批量获取结果
 */
export const batchFetchStockData = async ({
  reqType,
  stockLists,
  stockType,
  klt,
  startFormatDay,
  batchDelayRange = BATCH_DELAY_RANGE
}: {
  reqType: EReqType;
  stockLists: (string | IFutuStockInfo)[];
  stockType: string;
  klt: number;
  startFormatDay: string;
  batchDelayRange: { min: number, max: number}
}): Promise<IBatchFetchResult> => {
  const batches = createBatches(stockLists);
  const allResults: unknown[] = [];
  const requestFailures: IRequestFailureInfo[] = [];
  let totalRequestCount = 0;
  let successfulRequestCount = 0;

  // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 开始批量获取数据，共${batches.length}批次，${stockLists.length}只股票`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    // 为每批次生成随机请求头，模拟不同用户行为
    const headers = generateRandomHeaders();

    // 创建本批次的所有请求
    const requests = batch.map(async stockId => {
      totalRequestCount++;
      // 随机延迟，避免请求过于频繁
      await randomDelay(batchDelayRange.min, batchDelayRange.max);
      
      try {
        let result;
        if (reqType === EReqType.EASY_MONEY) {
          const userToken = getRandomUserToken();
          result = await createEastmoneyRequest(stockId as string, userToken, klt, startFormatDay, headers);
        } else if (reqType === EReqType.FU_TU) {
          result = await createFutuRequest(stockId as IFutuStockInfo, klt);
        }
        
        if (result) {
          successfulRequestCount++;
        }
        return result;
      } catch (error) {
        const errorInfo = getSimplifiedErrorMessage(error);
        const stockIdentifier = getStockIdentifier(stockId, reqType);
        const stockName = getStockName(stockId, reqType);
        
        const failureInfo: IRequestFailureInfo = {
          stockId: stockIdentifier,
          stockName: stockName,
          requestType: reqType === EReqType.EASY_MONEY ? '东方财富' : '富途',
          errorType: errorInfo.type,
          errorMessage: errorInfo.message,
          batchIndex: batchIdx + 1,
          timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
        };
        
        requestFailures.push(failureInfo);
        return null;
      }
    });

    try {
      // 批次间延迟，进一步降低被限制的风险
      if (batchIdx > 0) {
        await randomDelay(BATCH_DELAY_RANGE.min, BATCH_DELAY_RANGE.max);
      }

      // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 执行第${batchIdx + 1}/${batches.length}批次`);
      const batchResults = await Promise.all(requests);
      allResults.push(...batchResults.filter(result => result !== null));
    } catch (err) {
      console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 第${batchIdx + 1}批次请求失败，跳过该批次:`, err);
      
      // 将整个批次的失败也记录
      batch.forEach(stockId => {
        const errorInfo = getSimplifiedErrorMessage(err);
        const stockIdentifier = getStockIdentifier(stockId, reqType);
        const stockName = getStockName(stockId, reqType);
        
        const failureInfo: IRequestFailureInfo = {
          stockId: stockIdentifier,
          stockName: stockName,
          requestType: reqType === EReqType.EASY_MONEY ? '东方财富' : '富途',
          errorType: 'BATCH_FAILURE',
          errorMessage: `批次失败: ${errorInfo.message}`,
          batchIndex: batchIdx + 1,
          timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss')
        };
        
        requestFailures.push(failureInfo);
      });
    }
  }

  return {
    results: allResults,
    requestFailures,
    totalRequestCount,
    successfulRequestCount
  };
};

/**
 * 生成随机请求头
 */
function generateRandomHeaders() {
  const userAgent = getRandomUserAgent();
  const accept = randomFromArray(ACCEPTS);
  const acceptLanguage = randomFromArray(ACCEPT_LANGUAGES);
  const referer = randomFromArray(REFERERS);
  const cookie = randomFromArray(COOKIES);
  const xForwardedFor = randomIP();
  const xRealIp = randomIP();

  return {
    'User-Agent': userAgent,
    'Accept': accept,
    'Accept-Language': acceptLanguage,
    'Referer': referer,
    'Cookie': cookie,
    'Connection': 'keep-alive',
    'X-Forwarded-For': xForwardedFor,
    'X-Real-IP': xRealIp
  };
}

/**
 * 打印请求结果统计
 */
export const logRequestStatistics = (
  reqType: EReqType,
  result: IBatchFetchResult,
  stockType: string,
  klt: number
): void => {
  const { requestFailures, totalRequestCount, successfulRequestCount } = result;
  
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 请求完成统计: 请求类型: ${reqType === EReqType.EASY_MONEY ? '东方财富' : '富途'}   总请求数: ${totalRequestCount} 成功请求数: ${successfulRequestCount} 失败请求数: ${requestFailures.length} 成功率: ${totalRequestCount > 0 ? ((successfulRequestCount / totalRequestCount) * 100).toFixed(2) : 0}%`);

  // 如果有失败请求，按错误类型分组展示
  if (requestFailures.length > 0) {
    const failuresByType = requestFailures.reduce((acc, failure) => {
      if (!acc[failure.errorType]) {
        acc[failure.errorType] = [];
      }
      acc[failure.errorType].push(failure);
      return acc;
    }, {} as Record<string, IRequestFailureInfo[]>);

    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 失败请求详情:`);
    Object.entries(failuresByType).forEach(([errorType, failures]) => {
      console.log(`  ${errorType} (${failures.length}个):`);
      failures.slice(0, 2).forEach(failure => { // 只显示前2个
        console.log(`    - ${failure.stockName || failure.stockId}: ${failure.errorMessage}`);
      });
      if (failures.length > 2) {
        console.log(`    ... 还有${failures.length - 2}个${errorType}失败`);
      }
    });
  }
}; 