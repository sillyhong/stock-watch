import { NextApiRequest, NextApiResponse } from 'next';
import RSIAnalysisService from '../../../services/rsiAnalysisService';
import { EKLT } from '../../interface';

/**
 * RSI图表数据API
 * GET /api/rsi/chart
 * 
 * 查询参数：
 * - stockCode: 股票代码 (必需)
 * - klt: K线类型 (5/15/101)
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: '不支持的请求方法' 
    });
  }

  try {
    const { stockCode, klt, startDate, endDate } = req.query;

    // 参数验证
    if (!stockCode) {
      return res.status(400).json({
        success: false,
        message: '股票代码是必需的'
      });
    }

    // 验证K线类型
    let kltValue: EKLT = 15; // 默认15分钟
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

    // 获取图表数据
    const chartData = await RSIAnalysisService.getRSIChartData(
      stockCode as string,
      kltValue,
      startDate as string,
      endDate as string
    );

    return res.status(200).json({
      success: true,
      message: '获取RSI图表数据成功',
      data: {
        stock_code: stockCode,
        klt: kltValue,
        chart_data: chartData,
        trading_points: chartData.filter(item => item.trading_point).map(item => item.trading_point)
      }
    });

  } catch (error) {
    console.error('RSI图表数据查询失败:', error);
    
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
} 