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
 * 从HTML格式的RSI数据字符串中解析股票名称和backtestMatch值
 * 传入格式: <tr><td>2025-08-08 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/sh688110.html?from=classic#fullScreenChart" style="color: green;">[创]东芯股份</a></td><td>18.661 [-6.71%]</td><td style="color: red;">立即买入🚀 today: +7.48%   </td></tr>
 */
const parseStockBacktestInfo = (rsiDataStr: string): IStockBacktestInfo | null => {
  try {
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
    const lastTdMatch = rsiDataStr.match(/<td[^>]*>([^<]*today:[^<]*)<\/td>/);
    if (!lastTdMatch) {
      console.warn('无法找到包含today的td标签:', rsiDataStr.substring(0, 100));
      return null;
    }
    
    const todayContent = lastTdMatch[1];
    
    // 从today内容中提取百分比值
    const percentageMatch = todayContent.match(/today:\s*([+\-]?\d+\.?\d*)%/);
    if (!percentageMatch) {
      console.warn('无法解析today百分比值:', todayContent);
      return null;
    }
    
    const backtestValue = parseFloat(percentageMatch[1]);
    
    return {
      stockName,
      backtestMatch: backtestValue,
      originalItem: rsiDataStr
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
 * 优化邮件列表：为每只股票选择最优的backtestMatch记录
 */
const optimizeEmailListByBacktest = (emailList: string[]): string[] => {
  if (emailList.length === 0) return emailList;
  
  // 解析所有股票的回测信息
  const stockInfos = emailList
    .map(parseStockBacktestInfo)
    .filter((info): info is IStockBacktestInfo => info !== null);
  
  if (stockInfos.length === 0) return emailList;
  
  // 按股票名称分组
  const stockGroups = stockInfos.reduce((groups, info) => {
    if (!groups[info.stockName]) {
      groups[info.stockName] = [];
    }
    groups[info.stockName].push(info);
    return groups;
  }, {} as Record<string, IStockBacktestInfo[]>);
  
  // 为每个股票组选择最优记录
  const optimizedList: string[] = [];
  const uniqueStockCount = Object.keys(stockGroups).length;
  
  Object.values(stockGroups).forEach(stockInfos => {
    const optimal = selectOptimalStockByBacktest(stockInfos);
    optimizedList.push(optimal.originalItem);
  });
  
  console.log(`[邮件优化] 股票数量: ${uniqueStockCount}, 优化前: ${emailList.length}条记录, 优化后: ${optimizedList.length}条记录`);
  
  return optimizedList;
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

  // 解析所有股票的回测信息（不进行日期过滤）
  const stockInfos = emailList
    .map(parseStockBacktestInfo)
    .filter((info): info is IStockBacktestInfo => info !== null);

  if (stockInfos.length === 0) {
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

  // 按股票名称分组，每只股票只保留最优记录
  const stockGroups = stockInfos.reduce((groups, info) => {
    if (!groups[info.stockName]) {
      groups[info.stockName] = [];
    }
    groups[info.stockName].push(info);
    return groups;
  }, {} as Record<string, IStockBacktestInfo[]>);

  // 获取每只股票的最优backtestMatch值，并根据当天日期进行过滤
  const optimalBacktestValues: number[] = [];
  let totalStocksBeforeFilter = 0;
  let filteredStocksCount = 0;
  
  Object.values(stockGroups).forEach(stockInfos => {
    const optimal = selectOptimalStockByBacktest(stockInfos);
    totalStocksBeforeFilter++;
    
    // 从optimal.originalItem中提取日期进行过滤
    const dateMatch = optimal.originalItem.match(/<td>([^<]*)<\/td>/);
    if (dateMatch) {
      const itemDateStr = dateMatch[1].trim();
      
      // 尝试解析日期，支持多种格式
      let itemDate: string;
      const parsedDate = dayjs(itemDateStr);
      
      if (parsedDate.isValid()) {
        itemDate = parsedDate.format('YYYY-MM-DD');
      } else {
        // 如果日期解析失败，尝试提取日期部分
        const dateOnlyMatch = itemDateStr.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateOnlyMatch) {
          itemDate = dayjs(dateOnlyMatch[1]).format('YYYY-MM-DD');
        } else {
          console.warn(`[回测统计] 无法解析日期格式: ${itemDateStr} - ${optimal.stockName}`);
          // 无法解析日期时，保留数据
          optimalBacktestValues.push(optimal.backtestMatch);
          filteredStocksCount++;
          return;
        }
      }
      
      const isToday = itemDate === targetDate;
      
      if (isToday) {
        optimalBacktestValues.push(optimal.backtestMatch);
        filteredStocksCount++;
      } else {
        console.log(`[回测统计] 跳过非当天数据: ${optimal.stockName} - ${itemDateStr} (解析为: ${itemDate})`);
      }
    } else {
      console.warn(`[回测统计] 无法提取日期信息: ${optimal.stockName} - ${optimal.originalItem.substring(0, 100)}...`);
      // 无法提取日期时，保留数据
      optimalBacktestValues.push(optimal.backtestMatch);
      filteredStocksCount++;
    }
  });

  console.log(`[回测统计] 日期过滤结果: 股票分组数 ${totalStocksBeforeFilter} -> 当天股票数 ${filteredStocksCount}`);

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
  
  // ================================= 新功能：backtestMatch优化 =================================
  // 根据backtestMatch值优化邮件列表，每只股票只保留最优记录
  const optimizedBuyList = isOptimizeEmailList ? optimizeEmailListByBacktest(buyList) : buyList;
  const optimizedSellList = isOptimizeEmailList ? optimizeEmailListByBacktest(sellList) : sellList;
  
  // 排序：优先级排序 + 股票名称排序
  const sortedBuyList = [...optimizedBuyList];
  const sortedSellList = [...optimizedSellList];
  
  sortListBySuggestion(sortedBuyList, ERSISuggestion.MUST_BUY);
  sortListBySuggestion(sortedSellList, ERSISuggestion.MUST_SELL);
  
  if (isBacktesting || klt === EKLT.DAY) {
    const finalBuyList = sortByStockName(sortedBuyList);
    normalSortByStockName(sortedSellList);
    sortedBuyList.splice(0, sortedBuyList.length, ...finalBuyList);
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
  const originalEmailContent = generateEmailTables(sortedBuyList as unknown as IEmailListItem[], sortedSellList as unknown as IEmailListItem[]);
  
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