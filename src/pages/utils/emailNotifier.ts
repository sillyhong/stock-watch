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
import { EStockType, EKLT, getEKLTDesc } from "../interface";
import  nodemailer from 'nodemailer';
import { ERSISuggestion, generateEmailTables } from "./config";
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

export const createEmailItem = (item: any, kltDesc: string | undefined, stockLink: string, stockName: string, suggestion: ERSISuggestion, backtestingStr: string = '',currentPriceChange = '', currentTradeStr = '', increaseStr = '') => {
  const stockColor = [ERSISuggestion.BUY, ERSISuggestion.MUST_BUY].includes(suggestion) ? 'green' : 'red'
  const buyColor = [ERSISuggestion.MUST_BUY, ERSISuggestion.MUST_SELL].includes(suggestion) ? 'red' : 'orange'
  return `<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: ${stockColor};">${stockName}</a></td><td>${item[1]} [${currentPriceChange}]</td><td style="color: ${buyColor};">${suggestion} ${backtestingStr} ${currentTradeStr} ${increaseStr}</td></tr>`;
};

/**
 * 邮件发送参数
 */
export interface IEmailNotificationParams {
  buyList: string[];
  sellList: string[];
  stockType: EStockType;
  klt: EKLT;
  currentDate: Dayjs;
  isBacktesting: boolean;
}

/**
 * 发送RSI分析结果邮件通知
 * @param params 邮件参数
 * @returns Promise<void>
 */
export const sendRSIEmailNotification = async (params: IEmailNotificationParams): Promise<void> => {
  const { buyList, sellList, stockType, klt, currentDate, isBacktesting } = params;
  
  if (!buyList.length && !sellList.length) {
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 没有买卖建议，不发送邮件`);
    return;
  }

  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 准备发送邮件: 买入${buyList.length}个, 卖出${sellList.length}个`);
  
  // 排序：优先级排序 + 股票名称排序
  const sortedBuyList = [...buyList];
  const sortedSellList = [...sellList];
  
  sortListBySuggestion(sortedBuyList, ERSISuggestion.MUST_BUY);
  sortListBySuggestion(sortedSellList, ERSISuggestion.MUST_SELL);
  
  if (isBacktesting || klt === EKLT.DAY) {
    const finalBuyList = sortByStockName(sortedBuyList);
    normalSortByStockName(sortedSellList);
    sortedBuyList.splice(0, sortedBuyList.length, ...finalBuyList);
  }

  // 生成邮件内容
  const kltDesc = getEKLTDesc(klt);
  const emailContent = generateEmailTables(sortedBuyList as unknown as any[], sortedSellList as unknown as any[]);

  const mailOptions = {
    from: `[${stockType}][${kltDesc}]<1175166300@qq.com>`,
    to: '1175166300@qq.com',
    subject: `${dayjs(currentDate).format('YYYY-MM-DD HH:mm')}${isBacktesting ? '回测' : ''}[${stockType}][${kltDesc}]`,
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