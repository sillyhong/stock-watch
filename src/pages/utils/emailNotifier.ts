/**
 * 邮件通知模块 - emailNotifier.ts
 * 
 * =========================== 重构说明 ===========================
 * 
 * 📅 重构时间: 2025-01-27
 * 🎯 重构目的: 从 fetchRSIAndSendEmail.ts 中提取邮件发送逻辑，实现通知功能模块化
 * 
 * 🔄 主要改动:
 * 1. 提取了邮件发送逻辑 (原第392-425行)
 * 2. 抽离了数据排序功能 (原第399-405行)
 * 3. 重构了邮件内容生成 (原第407-414行)
 * 4. 改进了异步邮件发送处理 (原第417-425行)
 * 5. 增强了错误处理和日志记录
 * 
 * 📈 重构收益:
 * - 职责单一: 专注于邮件通知功能
 * - 异步优化: 使用Promise改善异步处理
 * - 错误隔离: 邮件发送失败不影响主流程
 * - 配置灵活: 支持不同类型的邮件通知
 * 
 * 🔗 依赖关系:
 * - 接收 rsiProcessor.ts 提供的分析结果
 * - 被 fetchRSIAndSendEmail.ts 调用
 * - 依赖 email.ts 的邮件基础设施
 * 
 * 📦 导出函数:
 * - sendRSIEmailNotification: 发送RSI分析结果邮件
 * 
 * 📧 邮件功能:
 * - 买卖建议数据排序 (优先级 + 股票名称)
 * - HTML邮件内容生成
 * - 异步邮件发送和错误处理
 * - 回测模式和实时模式支持
 * 
 * =============================================================
 */

import dayjs, { Dayjs } from "dayjs";
import { EStockType, EKLT, getEKLTDesc, IEmailListItem } from "../interface";
import  nodemailer from 'nodemailer';
import { EReqType, ERSISuggestion, generateEmailTables } from "./config";
import { normalSortByStockName, sortByStockName, sortListBySuggestion } from "./sort";

// 创建一个 SMTP 传输对象
export const QQMail = nodemailer.createTransport({
  service: 'QQ', // 使用的邮件服务，这里以 QQ 邮箱为例
  auth: {
      user: '1175166300@qq.com', // 发件人邮箱地址
      pass: 'jxidhvesevtciege' // 发件人邮箱的 SMTP 授权码
  }
});
// echo '[2025-01-27 13:30] RSI: 22.114 ➜ 建议买入"\,\n"[2025-01-27 14:45] RSI: 23.205 ➜ 建议买入"\,"[2025-01-27 15:00] RSI: 20.604 ➜ 建议买入"' | msmtp -a default 1175166300@qq.com

export const createEmailItem = (item: [string, number], kltDesc: string | undefined, stockLink: string, stockName: string, suggestion: ERSISuggestion, backtestingStr: string = '',currentPriceChange = '', currentTradeStr = '', increaseStr = '') => {
  const stockColor = [ERSISuggestion.BUY, ERSISuggestion.MUST_BUY].includes(suggestion) ? 'green' : 'red'
  const buyColor = [ERSISuggestion.MUST_BUY, ERSISuggestion.MUST_SELL].includes(suggestion) ? 'red' : 'orange'
  return `<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: ${stockColor};">${stockName}</a></td><td>${item[1]} [${currentPriceChange}]</td><td style="color: ${buyColor};">${suggestion} ${backtestingStr} ${currentTradeStr} ${increaseStr}</td></tr>`;
};

/**
 * 解析股票信息的接口
 */
interface IStockBacktestInfo {
  stockName: string;
  backtestMatch: number;
  originalItem: string;
  date: string; // 新增日期字段，格式为 YYYY-MM-DD
}

/**
 * 回测统计信息接口
 */
interface IBacktestStatistics {
  totalUniqueStocks: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  positivePercentage: number;
  negativePercentage: number;
  zeroPercentage: number;
  averagePositive: number;
  averageNegative: number;
}

/**
 * 从HTML格式的RSI数据字符串中解析股票名称、backtestMatch值和日期
 * 传入格式: <tr><td>2025-08-08 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/sh688110.html?from=classic#fullScreenChart" style="color: green;">[创]东芯股份</a></td><td>18.661 [-6.71%]</td><td style="color: red;">立即买入🚀 today: +7.48%   </td></tr>
 */
const parseStockBacktestInfo = (rsiDataStr: string): IStockBacktestInfo | null => {
  try {
    // 解析日期 - 从第一个<td>中提取
    const dateMatch = rsiDataStr.match(/<td>([^<]*)<\/td>/);
    if (!dateMatch) {
      console.warn('无法解析日期:', rsiDataStr.substring(0, 100));
      return null;
    }
    
    const dateTimeStr = dateMatch[1].trim();
    let formattedDate: string;
    
    // 尝试解析日期，支持多种格式
    const parsedDate = dayjs(dateTimeStr);
    if (parsedDate.isValid()) {
      formattedDate = parsedDate.format('YYYY-MM-DD');
    } else {
      // 如果日期解析失败，尝试提取日期部分
      const dateOnlyMatch = dateTimeStr.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateOnlyMatch) {
        formattedDate = dayjs(dateOnlyMatch[1]).format('YYYY-MM-DD');
      } else {
        console.warn('无法解析日期格式:', dateTimeStr);
        return null;
      }
    }
    
    // 解析股票名称 - 从<a>标签中提取
    const stockNameMatch = rsiDataStr.match(/<a[^>]*>([^<]+)<\/a>/);
    if (!stockNameMatch) {
      console.warn('无法解析股票名称:', rsiDataStr.substring(0, 100));
      return null;
    }
    
    let stockName = stockNameMatch[1].trim();
    // 移除[创]、[北]等标识
    stockName = stockName.replace(/^\[.\]/, '');
    
    // 解析backtestMatch值 - 从最后一个<td>中提取today后面的百分比值
    const lastTdMatch = rsiDataStr.match(/<td[^>]*>([^<]*)<\/td>/g);
    if (!lastTdMatch || lastTdMatch.length === 0) {
      console.warn('无法找到td标签:', rsiDataStr.substring(0, 100));
      return null;
    }
    
    // 获取最后一个td标签的内容（买入建议列）
    const lastTdContent = lastTdMatch[lastTdMatch.length - 1];
    const suggestionContent = lastTdContent.replace(/<\/?td[^>]*>/g, '');
    
    let backtestValue = 0;
    
    // 尝试多种格式解析backtestMatch值
    // 1. today: +X.XX% 格式
    let percentageMatch = suggestionContent.match(/today:\s*([+\-]?\d+\.?\d*)%/);
    if (percentageMatch) {
      backtestValue = parseFloat(percentageMatch[1]);
    } else {
      // 2. [Max]: +X.XX% 格式
      percentageMatch = suggestionContent.match(/\[Max\]:\s*([+\-]?\d+\.?\d*)%/);
      if (percentageMatch) {
        backtestValue = parseFloat(percentageMatch[1]);
      }
    }
    
    // console.log(`[解析调试] ${stockName}: 建议内容="${suggestionContent.substring(0, 50)}..." -> backtestValue=${backtestValue}`);
    
    
    return {
      stockName,
      backtestMatch: backtestValue,
      originalItem: rsiDataStr,
      date: formattedDate
    };
  } catch (error) {
    console.warn('解析股票回测信息失败:', error);
    return null;
  }
};

/**
 * 根据backtestMatch值选择最优股票
 * 规则：
 * 1. 如果都是正值，取绝对值最大的一条
 * 2. 如果都是负值，取绝对值最大的一条  
 * 3. 如果同时有正值和负值，取正值绝对值最大的一条
 */
const selectOptimalStockByBacktest = (stockInfos: IStockBacktestInfo[]): IStockBacktestInfo => {
  const positiveValues = stockInfos.filter(info => info.backtestMatch > 0);
  const negativeValues = stockInfos.filter(info => info.backtestMatch < 0);
  
  // 如果有正值，选择正值中绝对值最大的
  if (positiveValues.length > 0) {
    return positiveValues.reduce((max, current) => 
      Math.abs(current.backtestMatch) > Math.abs(max.backtestMatch) ? current : max
    );
  }
  
  // 如果只有负值，选择负值中绝对值最大的
  if (negativeValues.length > 0) {
    return negativeValues.reduce((max, current) => 
      Math.abs(current.backtestMatch) > Math.abs(max.backtestMatch) ? current : max
    );
  }
  
  // 如果都没有backtestMatch值，返回第一个
  return stockInfos[0];
};

/**
 * 根据当天优先+backtestMatch值选择每个股票组内的最优记录
 * 选择策略：
 * 1. 优先选择当天的记录（不管backtestMatch值）
 * 2. 如果当天有多条记录，再按backtestMatch值选择：
 *    - 正值选最大值
 *    - 负值选绝对值最大的（即数值最小的）
 * 3. 如果没有当天记录，才考虑其他天的记录
 */
const selectOptimalStockByValue = (stockInfos: IStockBacktestInfo[], currentDate: Dayjs): IStockBacktestInfo => {
  const currentDateStr = currentDate.format('YYYY-MM-DD');
  
  // 分离当天和其他天的记录
  const todayRecords = stockInfos.filter(info => info.date === currentDateStr);
  const otherDayRecords = stockInfos.filter(info => info.date !== currentDateStr);
  
  // 优先选择当天的记录
  if (todayRecords.length > 0) {
    // 如果当天只有一条记录，直接返回
    if (todayRecords.length === 1) {
      return todayRecords[0];
    }
    
    // 如果当天有多条记录，按backtestMatch值选择
    return selectByBacktestValue(todayRecords);
  }
  
  // 如果没有当天记录，从其他天的记录中选择
  if (otherDayRecords.length > 0) {
    return selectByBacktestValue(otherDayRecords);
  }
  
  // 保险措施：返回第一个记录
  return stockInfos[0];
};

/**
 * 根据backtestMatch值选择最优记录
 * 选择策略：
 * 1. 如果有正值，选择最大的正值
 * 2. 如果没有正值但有0值和负值，选择负值中绝对值最大的（优先负值）
 * 3. 如果只有0值，选择0值
 * 4. 如果只有负值，选择绝对值最大的负值（-2.1比-0.5更好）
 */
const selectByBacktestValue = (stockInfos: IStockBacktestInfo[]): IStockBacktestInfo => {
  // 分离正值、负值、零值
  const positiveValues = stockInfos.filter(info => info.backtestMatch > 0);
  const negativeValues = stockInfos.filter(info => info.backtestMatch < 0);
  const zeroValues = stockInfos.filter(info => info.backtestMatch === 0);
  
  // 如果有正值，选择正值中的最大值
  if (positiveValues.length > 0) {
    return positiveValues.reduce((max, current) => 
      current.backtestMatch > max.backtestMatch ? current : max
    );
  }
  
  // 如果没有正值但有0值和负值，选择负值中绝对值最大的（优先负值）
  if (zeroValues.length > 0 && negativeValues.length > 0) {
    return negativeValues.reduce((min, current) => 
      current.backtestMatch < min.backtestMatch ? current : min
    );
  }
  
  // 如果只有0值，选择0值
  if (zeroValues.length > 0) {
    return zeroValues[0];
  }
  
  // 如果只有负值，选择绝对值最大的负值（-2.1比-0.5更好）
  if (negativeValues.length > 0) {
    return negativeValues.reduce((min, current) => 
      current.backtestMatch < min.backtestMatch ? current : min
    );
  }
  
  // 保险措施：返回第一个记录
  return stockInfos[0];
};

/**
 * 优化邮件列表：为每天每只股票选择最优的backtestMatch记录（旧版本）
 * @deprecated 使用optimizeEmailListByTime替代，该函数基于时间选择最新记录
 */
export const optimizeEmailListByBacktest = (emailList: string[]): string[] => {
  if (emailList.length === 0) return emailList;
  
  // 解析所有股票的回测信息
  const stockInfos = emailList
    .map(parseStockBacktestInfo)
    .filter((info): info is IStockBacktestInfo => info !== null);
  
  if (stockInfos.length === 0) return emailList;
  
  // 按日期+股票名称分组（组合键格式：日期-股票名称）
  const stockGroups = stockInfos.reduce((groups, info) => {
    const groupKey = `${info.date}-${info.stockName}`;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(info);
    return groups;
  }, {} as Record<string, IStockBacktestInfo[]>);
  
  // 为每个日期-股票组合选择最优记录
  const optimizedList: string[] = [];
  const uniqueGroupCount = Object.keys(stockGroups).length;
  
  // 统计日期和股票数量
  const dateStats = stockInfos.reduce((stats, info) => {
    stats.dates.add(info.date);
    stats.stocks.add(info.stockName);
    return stats;
  }, { dates: new Set<string>(), stocks: new Set<string>() });
  
  Object.values(stockGroups).forEach(stockInfos => {
    const optimal = selectOptimalStockByBacktest(stockInfos);
    optimizedList.push(optimal.originalItem);
  });
  
  console.log(`[邮件优化] 覆盖${dateStats.dates.size}天, ${dateStats.stocks.size}只股票, 共${uniqueGroupCount}个日期-股票组合, 优化前: ${emailList.length}条记录, 优化后: ${optimizedList.length}条记录`);
  
  return optimizedList;
};

/**
 * 优化邮件列表：基于当天优先+backtestMatch值的新策略
 * 为每只股票选择最优记录，但保留所有数据，然后按最优记录排序
 * 同时确保每个股票分组内只有被选中的最优记录才有📍标记
 */
const optimizeEmailListByTime = (emailList: string[], currentDate: Dayjs): string[] => {
  if (emailList.length === 0) return emailList;
  
  // console.log(`[当天优先] 开始处理 ${emailList.length} 条记录, 当天日期: ${currentDate.format('YYYY-MM-DD')}`);
  
  // 解析所有股票的回测信息
  const stockInfos = emailList
    .map((item) => {
      const info = parseStockBacktestInfo(item);
      if (info) {
        // 先移除所有📍标记，后面会重新添加到选中的记录上
        info.originalItem = info.originalItem.replace(/ 📍/g, '');
      }
      return info;
    })
    .filter((info): info is IStockBacktestInfo => info !== null);
  
  if (stockInfos.length === 0) return emailList;
  
  // console.log(`[当天优先] 成功解析 ${stockInfos.length} 条记录`);
  
  // 按股票名称分组
  const stockGroups = stockInfos.reduce((groups, info) => {
    if (!groups[info.stockName]) {
      groups[info.stockName] = [];
    }
    groups[info.stockName].push(info);
    return groups;
  }, {} as Record<string, IStockBacktestInfo[]>);
  
  // 为每个股票组选择最优记录，传递当天日期
  const stockOptimalMap = new Map<string, IStockBacktestInfo>();
  
  Object.entries(stockGroups).forEach(([stockName, stockInfos]) => {
    const optimalInfo = selectOptimalStockByValue(stockInfos, currentDate);
    stockOptimalMap.set(stockName, optimalInfo);
    
    // 为被选中的最优记录添加📍标记（如果是当天的记录）
    if (optimalInfo.date === currentDate.format('YYYY-MM-DD')) {
      optimalInfo.originalItem = optimalInfo.originalItem.replace(
        /<td>([^<]*)<\/td>/,
        `<td>$1 📍</td>`
      );
    }
    
    // if (stockInfos.length > 1) {
    //   const allValues = stockInfos.map(info => `${info.date}(${info.backtestMatch}%)`);
    //   const isToday = optimalInfo.date === currentDate.format('YYYY-MM-DD');
    //   console.log(`[当天优先] ${stockName}: ${stockInfos.length}条记录 [${allValues.join(', ')}] -> 选择: ${optimalInfo.date}(${optimalInfo.backtestMatch}%) ${isToday ? '✅当天' : '📅其他天'}`);
    // }
  });
  
  // 按每个股票的最优backtestMatch值排序股票
  const sortedStockNames = Array.from(stockOptimalMap.keys()).sort((a, b) => {
    const valueA = stockOptimalMap.get(a)!.backtestMatch;
    const valueB = stockOptimalMap.get(b)!.backtestMatch;
    return valueB - valueA; // 从大到小排序
  });
  
  // 按排序后的股票顺序重新组织所有记录
  const sortedEmailList: string[] = [];
  
  sortedStockNames.forEach(stockName => {
    const stockInfos = stockGroups[stockName];
    
    // 将该股票的所有记录按时间顺序排序（保持原有的时间顺序）
    const sortedStockInfos = stockInfos.sort((a, b) => {
      // 按日期和时间排序
      const dateTimeA = new Date(`${a.date} ${a.originalItem.match(/<td>([^<]*)<\/td>/)?.[1]?.split(' ')[1] || '00:00'}`);
      const dateTimeB = new Date(`${b.date} ${b.originalItem.match(/<td>([^<]*)<\/td>/)?.[1]?.split(' ')[1] || '00:00'}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });
    
    // 添加该股票的所有记录（按时间顺序）
    sortedStockInfos.forEach(info => {
      sortedEmailList.push(info.originalItem);
    });
  });
  
  console.log(`[当天优先] 最终结果: ${sortedStockNames.length}只股票, 保留全部 ${sortedEmailList.length} 条记录, 按当天优先+最优值排序`);
  
  // 输出排序结果预览
  // sortedStockNames.forEach((stockName, index) => {
  //   const optimal = stockOptimalMap.get(stockName)!;
  //   const isToday = optimal.date === currentDate.format('YYYY-MM-DD');
  //   console.log(`${index + 1}. ${stockName}: ${optimal.backtestMatch}% (${optimal.date}) ${isToday ? '✅当天选中' : '📅其他天选中'} (该股票共${stockGroups[stockName].length}条记录)`);
  // });
  
  return sortedEmailList;
};

/**
 * 计算回测统计信息 - 仅统计当天回测日期的数据
 * @param emailList 邮件列表
 * @param currentDate 当前日期，用于过滤当天数据
 * @returns 回测统计数据
 */
const calculateBacktestStatistics = (emailList: string[], currentDate?: Dayjs): IBacktestStatistics => {
  if (emailList.length === 0) {
    return {
      totalUniqueStocks: 0,
      positiveCount: 0,
      negativeCount: 0,
      zeroCount: 0,
      positivePercentage: 0,
      negativePercentage: 0,
      zeroPercentage: 0,
      averagePositive: 0,
      averageNegative: 0
    };
  }

  // 获取当天日期字符串 (YYYY-MM-DD)
  const targetDate = currentDate ? currentDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
  console.log(`[回测统计] 过滤目标日期: ${targetDate}`);

  // 解析所有股票的回测信息
  const allStockInfos = emailList
    .map(parseStockBacktestInfo)
    .filter((info): info is IStockBacktestInfo => info !== null);

  if (allStockInfos.length === 0) {
    console.warn(`[回测统计] 无有效回测数据可解析`);
    return {
      totalUniqueStocks: 0,
      positiveCount: 0,
      negativeCount: 0,
      zeroCount: 0,
      positivePercentage: 0,
      negativePercentage: 0,
      zeroPercentage: 0,
      averagePositive: 0,
      averageNegative: 0
    };
  }

  // ⚠️ 修复BUG：先按日期过滤，只保留当天的记录
  const todayStockInfos = allStockInfos.filter(info => info.date === targetDate);
  
  if (todayStockInfos.length === 0) {
    console.warn(`[回测统计] 当天(${targetDate})无回测数据`);
    return {
      totalUniqueStocks: 0,
      positiveCount: 0,
      negativeCount: 0,
      zeroCount: 0,
      positivePercentage: 0,
      negativePercentage: 0,
      zeroPercentage: 0,
      averagePositive: 0,
      averageNegative: 0
    };
  }

  // 再按股票名称分组，每只股票选择当天的最优记录
  const stockGroups = todayStockInfos.reduce((groups, info) => {
    if (!groups[info.stockName]) {
      groups[info.stockName] = [];
    }
    groups[info.stockName].push(info);
    return groups;
  }, {} as Record<string, IStockBacktestInfo[]>);

  // 获取每只股票当天的最优backtestMatch值
  const optimalBacktestValues: number[] = [];
  
  Object.values(stockGroups).forEach(stockInfos => {
    const optimal = selectOptimalStockByBacktest(stockInfos);
    optimalBacktestValues.push(optimal.backtestMatch);
  });

  console.log(`[回测统计] 当天数据统计: 原始记录 ${allStockInfos.length}条 -> 当天记录 ${todayStockInfos.length}条 -> 去重后 ${optimalBacktestValues.length}只股票`);

  // 检查是否有当天的数据
  if (optimalBacktestValues.length === 0) {
    console.warn(`[回测统计] 当天(${targetDate})无有效回测数据`);
    return {
      totalUniqueStocks: 0,
      positiveCount: 0,
      negativeCount: 0,
      zeroCount: 0,
      positivePercentage: 0,
      negativePercentage: 0,
      zeroPercentage: 0,
      averagePositive: 0,
      averageNegative: 0
    };
  }

  // 统计正值、负值、零值的数量
  const positiveValues = optimalBacktestValues.filter(value => value > 0);
  const negativeValues = optimalBacktestValues.filter(value => value < 0);
  const zeroValues = optimalBacktestValues.filter(value => value === 0);

  const totalUniqueStocks = optimalBacktestValues.length;

  // 计算百分比
  const positivePercentage = totalUniqueStocks > 0 ? (positiveValues.length / totalUniqueStocks) * 100 : 0;
  const negativePercentage = totalUniqueStocks > 0 ? (negativeValues.length / totalUniqueStocks) * 100 : 0;
  const zeroPercentage = totalUniqueStocks > 0 ? (zeroValues.length / totalUniqueStocks) * 100 : 0;

  // 计算平均值
  const averagePositive = positiveValues.length > 0 
    ? positiveValues.reduce((sum, val) => sum + val, 0) / positiveValues.length 
    : 0;
  const averageNegative = negativeValues.length > 0 
    ? negativeValues.reduce((sum, val) => sum + val, 0) / negativeValues.length 
    : 0;

  return {
    totalUniqueStocks,
    positiveCount: positiveValues.length,
    negativeCount: negativeValues.length,
    zeroCount: zeroValues.length,
    positivePercentage: Math.round(positivePercentage * 100) / 100,
    negativePercentage: Math.round(negativePercentage * 100) / 100,
    zeroPercentage: Math.round(zeroPercentage * 100) / 100,
    averagePositive: Math.round(averagePositive * 100) / 100,
    averageNegative: Math.round(averageNegative * 100) / 100
  };
};

/**
 * 生成回测统计HTML内容
 * @param stats 统计数据
 * @param isBacktesting 是否为回测模式
 * @returns HTML字符串
 */
const generateBacktestStatisticsHtml = (stats: IBacktestStatistics, isBacktesting: boolean): string => {
  if (stats.totalUniqueStocks === 0) {
    return '';
  }

  const modeText = isBacktesting ? '回测模式' : '实时模式';
  const emoji = isBacktesting ? '📊' : '⚡';
  
  // 根据正值比例判断市场情况
  let marketSentiment = '';
  let sentimentColor = '';
  
  if (stats.positivePercentage >= 70) {
    marketSentiment = '强势看涨 🚀';
    sentimentColor = '#28a745';
  } else if (stats.positivePercentage >= 50) {
    marketSentiment = '偏向看涨 📈';
    sentimentColor = '#6f9654';
  } else if (stats.positivePercentage >= 30) {
    marketSentiment = '震荡整理 ⚖️';
    sentimentColor = '#ffc107';
  } else {
    marketSentiment = '偏向看跌 📉';
    sentimentColor = '#dc3545';
  }

  return `
    <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 16px; margin-bottom: 20px; font-family: Arial, sans-serif;">
      <h3 style="color: #495057; margin: 0 0 12px 0; font-size: 16px;">
        ${emoji} ${modeText} - 回测统计分析
      </h3>
      
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px;">
        <div style="flex: 1; min-width: 120px;">
          <span style="color: #6c757d; font-size: 12px;">总数</span><br>
          <strong style="color: #495057; font-size: 18px;">${stats.totalUniqueStocks}</strong>
        </div>
        
        <div style="flex: 1; min-width: 120px;">
          <span style="color: #6c757d; font-size: 12px;">盈利数</span><br>
          <strong style="color: #28a745; font-size: 18px;">${stats.positiveCount} (${stats.positivePercentage}%)</strong>
          ${stats.averagePositive > 0 ? `<br><span style="color: #6c757d; font-size: 11px;">平均: +${stats.averagePositive}%</span>` : ''}
        </div>
        
        <div style="flex: 1; min-width: 120px;">
          <span style="color: #6c757d; font-size: 12px;">亏损数</span><br>
          <strong style="color: #dc3545; font-size: 18px;">${stats.negativeCount} (${stats.negativePercentage}%)</strong>
          ${stats.averageNegative < 0 ? `<br><span style="color: #6c757d; font-size: 11px;">平均: ${stats.averageNegative}%</span>` : ''}
        </div>
        
        ${stats.zeroCount > 0 ? `
        <div style="flex: 1; min-width: 120px;">
          <span style="color: #6c757d; font-size: 12px;">平盘</span><br>
          <strong style="color: #6c757d; font-size: 18px;">${stats.zeroCount} (${stats.zeroPercentage}%)</strong>
        </div>
        ` : ''}
      </div>
      
      <div style="border-top: 1px solid #dee2e6; padding-top: 12px;">
        <span style="color: #6c757d; font-size: 12px;">市场情绪: </span>
        <strong style="color: ${sentimentColor}; font-size: 14px;">${marketSentiment}</strong>
      </div>
    </div>
  `;
};

/**
 * 邮件发送参数
 */
export interface IEmailNotificationParams {
  buyList: string[];
  sellList: string[];
  stockType: EStockType;
  reqType: EReqType,
  klt: EKLT;
  currentDate: Dayjs;
  isBacktesting: boolean;
  isOptimizeEmailList?: boolean;
}

/**
 * 发送RSI分析结果邮件通知
 * @param params 邮件参数
 * @returns Promise<void>
 */
export const sendRSIEmailNotification = async (params: IEmailNotificationParams): Promise<void> => {
  const { buyList, sellList, stockType, reqType, klt, currentDate, isBacktesting, isOptimizeEmailList = true } = params;
  
  if (!buyList.length && !sellList.length) {
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 没有买卖建议，不发送邮件`);
    return;
  }

  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 准备发送邮件: 买入${buyList.length}个, 卖出${sellList.length}个`);
  
  // ================================= 新功能：当天优先策略 =================================
  // 根据当天优先+backtestMatch值优化邮件列表，每只股票优先选择当天记录，然后按backtestMatch排序
  const optimizedBuyList = isOptimizeEmailList ? optimizeEmailListByTime(buyList, currentDate) : buyList;
  const optimizedSellList = isOptimizeEmailList ? optimizeEmailListByTime(sellList, currentDate) : sellList;
  
  // 排序：优先级排序 + 股票名称排序
  const sortedBuyList = [...optimizedBuyList];
  const sortedSellList = [...optimizedSellList];
  
  // ⚠️ 当使用优化函数时，跳过所有额外的排序以保持我们的当天优先+backtestMatch排序
  if (!isOptimizeEmailList) {
    sortListBySuggestion(sortedBuyList, ERSISuggestion.MUST_BUY);
    sortListBySuggestion(sortedSellList, ERSISuggestion.MUST_SELL);
    
    if (isBacktesting || klt === EKLT.DAY) {
      const finalBuyList = sortByStockName(sortedBuyList);
      normalSortByStockName(sortedSellList);
      sortedBuyList.splice(0, sortedBuyList.length, ...finalBuyList);
    }
  }

  // ================================= 生成回测统计信息 =================================
  let statisticsHtml = '';
  if (isBacktesting && isOptimizeEmailList && (optimizedBuyList.length > 0 || optimizedSellList.length > 0)) {
    // 合并买入和卖出列表进行统计分析
    const allEmailList = [...optimizedBuyList, ...optimizedSellList];
    const statistics = calculateBacktestStatistics(allEmailList, currentDate);
    statisticsHtml = generateBacktestStatisticsHtml(statistics, isBacktesting);
    
    console.log(`[回测统计] 当天(${currentDate.format('YYYY-MM-DD')})股票统计: 总股票: ${statistics.totalUniqueStocks}, 盈利: ${statistics.positiveCount}(${statistics.positivePercentage}%), 亏损: ${statistics.negativeCount}(${statistics.negativePercentage}%)`);
  }
  
  const backDataStr = `${isBacktesting ? '[回测]' : ''}`
  const reqTypeStr = reqType  === EReqType.FU_TU ? '[FU]' : ''

  // 生成邮件内容
  const kltDesc = getEKLTDesc(klt);
  
  // 应用高亮逻辑，但📍标记已在优化函数中处理
  const enhancedBuyList = highlightTodayRecords(sortedBuyList, currentDate);
  const enhancedSellList = highlightTodayRecords(sortedSellList, currentDate);
  
  const originalEmailContent = generateEmailTables(enhancedBuyList as unknown as IEmailListItem[], enhancedSellList as unknown as IEmailListItem[]);
  
  // 将统计信息添加到邮件内容前面
  const emailContent = statisticsHtml + originalEmailContent;

  const mailOptions = {
    from: `[${stockType}][${kltDesc}]<1175166300@qq.com>`,
    to: '1175166300@qq.com',
    subject: `${dayjs(currentDate).format('YYYY-MM-DD HH:mm')}${backDataStr}${reqTypeStr}[${stockType}][${kltDesc}]`,
    html: emailContent,
  };

  return new Promise((resolve, reject) => {
    QQMail.sendMail(mailOptions, (error: unknown) => {
      if (error) {
        console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 邮件发送失败:`, error);
        reject(error);
        return;
      }
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [${stockType}]${kltDesc}邮件发送成功`);
      resolve();
    });
  });
};

/**
 * 为当天记录的时间字段添加突出显示（不添加📍标记，📍由optimizeEmailListByTime统一管理）
 * @param emailList 邮件记录列表
 * @param currentDate 当前日期
 * @returns 处理后的邮件记录列表
 */
const highlightTodayRecords = (emailList: string[], currentDate: Dayjs): string[] => {
  if (emailList.length === 0) return emailList;
  
  const currentDateStr = currentDate.format('YYYY-MM-DD');
  
  return emailList.map((itemStr: string) => {
    // 解析时间字段中的日期
    const timeMatch = itemStr.match(/<td>([^<]*)<\/td>/);
    if (!timeMatch) return itemStr;
    
    const timeContent = timeMatch[1];
    const dateMatch = timeContent.match(/(\d{4}-\d{2}-\d{2})/);
    
    if (dateMatch && dateMatch[1] === currentDateStr) {
      // 为当天记录的时间添加突出样式（保持原有的📍，不重复添加）
      const hasExistingPin = timeContent.includes('📍');
      const baseTimeContent = hasExistingPin ? timeContent : timeContent;
      const enhancedTimeContent = `<span style="color: #ff6b35; font-weight: bold; background-color: #fff3cd; padding: 2px 4px; border-radius: 3px;">${baseTimeContent}</span>`;
      return itemStr.replace(/<td>([^<]*)<\/td>/, `<td>${enhancedTimeContent}</td>`);
    }
    
    return itemStr;
  });
}; 