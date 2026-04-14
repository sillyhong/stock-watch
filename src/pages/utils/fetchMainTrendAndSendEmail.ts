/**
 * 主涨段数据获取和邮件发送主协调器 - fetchMainTrendAndSendEmail.ts
 * 
 * =========================== 功能说明 ===========================
 * 
 * 🎯 核心功能: 检测A股主涨段股票并发送邮件通知
 * 
 * 📋 主涨段定义（需同时满足3个条件）:
 * 1. 月MACD金叉: DIFF > DEA
 * 2. 日线在MA55上方: 当前价格 > MA55
 * 3. 60分钟在BOLL中轨上方: 当前价格 > BOLL中轨
 * 
 * 🔄 处理流程:
 * 1. 批量获取股票列表
 * 2. 并行检测各股票的主涨段条件
 * 3. 筛选符合条件的股票
 * 4. 发送邮件通知
 * 
 * 📦 模块依赖:
 * - mainTrendProcessor.ts (主涨段检测)
 * - emailNotifier.ts (邮件通知)
 * - stockList.ts (股票列表)
 * 
 * =============================================================
 */

import dayjs, { Dayjs } from "dayjs";
import { detectMainTrendBatch, IMainTrendResult } from "./mainTrendProcessor";
import { EStockType, EKLT } from "../interface";
import { EasyStockLists } from "./stockList";
import { EReqType } from "./config";
import { QQMail } from "./emailNotifier";
import { 
  IMainTrendConditionConfig, 
  DEFAULT_MAIN_TREND_CONFIG
} from "./mainTrendConfig";

/**
 * 主涨段检测参数接口
 */
export interface IFetchMainTrendParams {
  reqType?: EReqType;
  klt?: EKLT;
  currentDate?: Dayjs;
  sendEmail?: boolean;
  config?: IMainTrendConditionConfig;  // 主涨段条件配置
  stockType?: EStockType;  // 股票市场类型
}

/**
 * 获取市场中文名称
 */
function getMarketName(marketType: EStockType): string {
  const marketNames: Record<EStockType, string> = {
    [EStockType.A]: 'A股',
    [EStockType.HK]: '港股',
    [EStockType.US]: '美股',
  };
  return marketNames[marketType] || '未知市场';
}

/**
 * 生成主涨段邮件HTML内容
 * @param mainTrendList 主涨段股票列表
 * @param currentDate 当前时间
 * @param config 主涨段配置
 * @returns HTML格式的邮件内容
 */
function generateMainTrendEmailHtml(
  mainTrendList: IMainTrendResult[],
  currentDate: Dayjs,
  config: IMainTrendConditionConfig
): string {
  const marketName = getMarketName(config.marketType);
  // 表格行
  const tableRows = mainTrendList.map((stock, index) => `
    <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${index + 1}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; font-weight: bold;">${stock.stockName}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; color: #666;">${stock.stockCode}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; color: #e74c3c; font-weight: bold;">¥${stock.currentPrice.toFixed(2)}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${stock.macdGoldenCross ? '✅' : '❌'}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; font-size: 12px;">
        DIFF: ${typeof stock.macdDiff === 'number' ? stock.macdDiff.toFixed(2) : stock.macdDiff}<br>
        DEA: ${typeof stock.macdDea === 'number' ? stock.macdDea.toFixed(2) : stock.macdDea}
      </td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${stock.aboveMA ? '✅' : '❌'}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; font-size: 12px;">
        ${typeof stock.maValue === 'number' ? stock.maValue.toFixed(2) : stock.maValue}
      </td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd;">${stock.aboveBollMid ? '✅' : '❌'}</td>
      <td style="padding: 12px; text-align: center; border-bottom: 1px solid #ddd; font-size: 12px;">
        中轨: ${typeof stock.bollMid === 'number' ? stock.bollMid.toFixed(2) : stock.bollMid}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #3498db;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2c3e50;
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header .subtitle {
      color: #7f8c8d;
      font-size: 14px;
    }
    .config-badge {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
      margin-top: 10px;
    }
    .summary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 30px;
      text-align: center;
    }
    .summary h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
    }
    .summary p {
      margin: 5px 0;
      font-size: 16px;
    }
    .info-box {
      background-color: #e8f4f8;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    .info-box h3 {
      margin-top: 0;
      color: #2980b9;
      font-size: 16px;
    }
    .info-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .info-box li {
      margin: 5px 0;
      color: #555;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px;
      text-align: center;
      font-weight: 600;
      font-size: 14px;
      border: none;
    }
    td {
      padding: 12px;
      text-align: center;
      border-bottom: 1px solid #ddd;
    }
    tr:hover {
      background-color: #f0f8ff !important;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #eee;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 ${marketName}主涨段监控报告</h1>
      <div class="config-badge">${config.name}</div>
      <div class="subtitle">检测时间: ${currentDate.format('YYYY-MM-DD HH:mm:ss')}</div>
    </div>
    
    <div class="summary">
      <h2>📊 检测摘要</h2>
      <p>${marketName} - 共发现 <strong>${mainTrendList.length}</strong> 只股票符合主涨段条件</p>
    </div>
    
    <div class="info-box">
      <h3>📋 主涨段定义（需同时满足以下3个条件）</h3>
      <ul>
        <li><strong>条件1：</strong>${config.macd.description}</li>
        <li><strong>条件2：</strong>${config.ma.description}</li>
        <li><strong>条件3：</strong>${config.boll.description}</li>
      </ul>
    </div>
    
    ${mainTrendList.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th style="border-top-left-radius: 6px;">序号</th>
          <th>股票名称</th>
          <th>股票代码</th>
          <th>当前价格</th>
          <th>MACD</th>
          <th>MACD值</th>
          <th>MA</th>
          <th>MA值</th>
          <th>BOLL</th>
          <th style="border-top-right-radius: 6px;">BOLL中轨</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    ` : `
    <div style="text-align: center; padding: 40px; color: #999;">
      <p style="font-size: 18px;">暂无符合条件的股票</p>
    </div>
    `}
    
    <div class="footer">
      <p>本邮件由股票监控系统自动发送</p>
      <p>数据仅供参考，投资需谨慎</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 发送主涨段邮件通知
 * @param mainTrendList 主涨段股票列表
 * @param currentDate 当前时间
 * @param config 主涨段配置
 */
async function sendMainTrendEmailNotification(
  mainTrendList: IMainTrendResult[],
  currentDate: Dayjs,
  config: IMainTrendConditionConfig
): Promise<void> {
  try {
    const marketName = getMarketName(config.marketType);
    const subject = `📈 ${marketName}主涨段 [${config.name}] - 发现${mainTrendList.length}只符合条件 [${currentDate.format('YYYY-MM-DD HH:mm')}]`;
    const html = generateMainTrendEmailHtml(mainTrendList, currentDate, config);
    
    // 发送邮件
    await QQMail.sendMail({
      from: '1175166300@qq.com',
      to: '1175166300@qq.com',
      subject,
      html
    });
    
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 主涨段邮件通知发送成功`);
  } catch (error) {
    console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 主涨段邮件发送失败:`, error);
    throw error;
  }
}

/**
 * 获取主涨段数据（支持多市场）
 * @param params 请求参数
 * @returns 主涨段股票列表
 */
export const fetchAMainTrend = async (params: IFetchMainTrendParams = {}): Promise<IMainTrendResult[]> => {
  const {
    reqType = EReqType.EASY_MONEY,
    currentDate = dayjs(),
    sendEmail = true,
    stockType: paramStockType,
    config: paramConfig
  } = params;
  
  // 如果没有传入配置，使用默认配置（根据市场类型）
  const stockType = paramStockType || EStockType.A;
  const config = paramConfig || DEFAULT_MAIN_TREND_CONFIG[stockType];
  const marketName = getMarketName(config.marketType);
  
  try {
    console.log(`\n========== 开始${marketName}主涨段监控 ==========`);
    console.log(`市场类型: ${marketName}`);
    console.log(`配置类型: ${config.name}`);
    console.log(`检测时间: ${currentDate.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`请求类型: ${reqType}`);
    
    // ================================= 获取股票列表 =================================
    // 使用日线的股票列表（根据市场类型）
    const stockLists = EasyStockLists[config.eltConfig]?.[config.marketType];
    
    if (!stockLists || stockLists.length === 0) {
      throw new Error(`未找到${marketName}股票列表`);
    }
    
    console.log(`股票数量: ${stockLists.length}`);
    
    // ================================= 批量检测主涨段 =================================
    // 将股票列表转换为所需格式
    const stocks = (stockLists as string[]).map(code => ({
      code,
      name: code // 简单使用代码作为名称，实际会在检测时从API获取真实名称
    }));
    
    const mainTrendList = await detectMainTrendBatch(stocks, config);
    
    console.log(`\n${marketName}检测完成，共发现 ${mainTrendList.length} 只主涨段股票`);
    
    // 打印结果
    if (mainTrendList.length > 0) {
      console.log('\n符合主涨段条件的股票:');
      mainTrendList.forEach((stock, index) => {
        console.log(`${index + 1}. ${stock.stockName} (${stock.stockCode}) - ¥${stock.currentPrice.toFixed(2)}`);
      });
    }
    
    // ================================= 邮件发送 =================================
    if (sendEmail && mainTrendList.length > 0) {
      try {
        await sendMainTrendEmailNotification(mainTrendList, currentDate, config);
      } catch (emailError) {
        console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 邮件发送失败:`, emailError);
      }
    }
    
    console.log(`========================================\n`);
    
    return mainTrendList;
  } catch (error) {
    const marketName = config ? getMarketName(config.marketType) : '股票';
    console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ${marketName}主涨段检测失败:`, error);
    throw error;
  }
};
