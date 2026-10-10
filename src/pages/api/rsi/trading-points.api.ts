import { NextApiRequest, NextApiResponse } from 'next';
import RSIAnalysisService from '../../../services/rsiAnalysisService';
import { EStockType, EKLT } from '../../interface';

/**
 * RSI交易点API
 * GET /api/rsi/trading-points
 * 
 * 查询参数：
 * - stockType: 股票类型 (A/HK/US)
 * - klt: K线类型 (5/15/101)
 * - days: 查询天数 (默认7天)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: '不支持的请求方法' 
    });
  }

  try {
    const { stockType, klt, days } = req.query;

    // 参数验证
    let stockTypeValue: EStockType | undefined;
    if (stockType && !Object.values(EStockType).includes(stockType as EStockType)) {
      return res.status(400).json({
        success: false,
        message: '无效的股票类型，必须是A、HK或US'
      });
    }
    stockTypeValue = stockType as EStockType;

    let kltValue: EKLT | undefined;
    if (klt) {
      const kltNum = parseInt(klt as string, 10);
      if (!Object.values(EKLT).includes(kltNum)) {
        return res.status(400).json({
          success: false,
          message: '无效的K线类型，必须是5、15或101'
        });
      }
      kltValue = kltNum as EKLT;
    }

    let daysNum = 7; // 默认7天
    if (days) {
      const parsed = parseInt(days as string, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 30) {
        return res.status(400).json({
          success: false,
          message: '查询天数必须是1-30之间的整数'
        });
      }
      daysNum = parsed;
    }

    // 获取交易点
    const tradingPoints = await RSIAnalysisService.getTradingPoints(
      stockTypeValue,
      kltValue,
      daysNum
    );

    // 按类型分组统计
    const buyPoints = tradingPoints.filter(point => point.action === 'buy');
    const sellPoints = tradingPoints.filter(point => point.action === 'sell');
    const immediateSignals = tradingPoints.filter(point => point.signal_strength === 'immediate');
    const suggestedSignals = tradingPoints.filter(point => point.signal_strength === 'suggested');

    return res.status(200).json({
      success: true,
      message: '获取RSI交易点成功',
      data: {
        query_params: {
          stock_type: stockTypeValue,
          klt: kltValue,
          days: daysNum,
        },
        summary: {
          total_points: tradingPoints.length,
          buy_signals: buyPoints.length,
          sell_signals: sellPoints.length,
          immediate_signals: immediateSignals.length,
          suggested_signals: suggestedSignals.length,
        },
        trading_points: tradingPoints,
        buy_points: buyPoints,
        sell_points: sellPoints,
      }
    });

  } catch (error) {
    console.error('RSI交易点查询失败:', error);
    
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
} 