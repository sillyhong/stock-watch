import { NextApiRequest, NextApiResponse } from 'next';
import RSIAnalysisService from '../../../services/rsiAnalysisService';

/**
 * RSI成功率分析API
 * GET /api/rsi/success-rate
 * 
 * 查询参数：
 * - stockCode: 股票代码 (可选，为空则分析所有股票)
 * - days: 分析天数 (默认30天)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: '不支持的请求方法' 
    });
  }

  try {
    const { stockCode, days } = req.query;

    // 参数验证
    let daysNum = 30; // 默认30天
    if (days) {
      const parsed = parseInt(days as string, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 365) {
        return res.status(400).json({
          success: false,
          message: '分析天数必须是1-365之间的整数'
        });
      }
      daysNum = parsed;
    }

    // 执行成功率分析
    const analysisResults = await RSIAnalysisService.analyze15MinRSISuccessRate(
      stockCode as string,
      daysNum
    );

    // 计算总体统计
    const totalStats = {
      total_stocks: analysisResults.length,
      total_trades: analysisResults.reduce((sum, item) => sum + item.total_trades, 0),
      total_successful: analysisResults.reduce((sum, item) => sum + item.successful_trades, 0),
      overall_success_rate: 0,
      average_profit: 0,
      best_stock: null as any,
      worst_stock: null as any,
    };

    if (totalStats.total_trades > 0) {
      totalStats.overall_success_rate = parseFloat(
        ((totalStats.total_successful / totalStats.total_trades) * 100).toFixed(2)
      );
      
      const allProfits = analysisResults.flatMap(item => 
        item.trades.map(trade => trade.profit_percent)
      );
      
      if (allProfits.length > 0) {
        totalStats.average_profit = parseFloat(
          (allProfits.reduce((sum, profit) => sum + profit, 0) / allProfits.length).toFixed(2)
        );
      }

      // 找出表现最好和最差的股票
      if (analysisResults.length > 0) {
        totalStats.best_stock = analysisResults.reduce((best, current) => 
          current.success_rate > best.success_rate ? current : best
        );
        
        totalStats.worst_stock = analysisResults.reduce((worst, current) => 
          current.success_rate < worst.success_rate ? current : worst
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: '获取RSI成功率分析成功',
      data: {
        analysis_period: {
          days: daysNum,
          strategy: 'RSI < 25买入，RSI > 75卖出',
          min_holding_hours: 4,
        },
        total_stats: totalStats,
        stock_analysis: analysisResults,
      }
    });

  } catch (error) {
    console.error('RSI成功率分析失败:', error);
    
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
} 