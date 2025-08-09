import { NextApiRequest, NextApiResponse } from 'next';
import RSIService from '../../../services/rsiService';

/**
 * RSI统计信息API
 * GET /api/rsi/statistics
 * 
 * 返回RSI数据的统计信息，包括：
 * - 总记录数
 * - 今日记录数
 * - 买入推荐数
 * - 卖出推荐数
 * - 按股票类型分组的统计
 * - 按K线类型分组的统计
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 只允许GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: '不支持的请求方法' 
    });
  }

  try {
    // 获取统计信息
    const statistics = await RSIService.getRSIStatistics();

    return res.status(200).json({
      success: true,
      message: '获取统计信息成功',
      data: statistics
    });

  } catch (error) {
    console.error('获取RSI统计信息失败:', error);
    
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
} 