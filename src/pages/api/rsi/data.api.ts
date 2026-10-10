import { NextApiRequest, NextApiResponse } from 'next';
import RSIService, { IRSIQueryParams } from '../../../services/rsiService';
import { EStockType, EKLT } from '../../interface';
import { ERSISuggestion, ENABLE_DATABASE_STORAGE } from '../../utils/config';

/**
 * RSI数据查询API
 * GET /api/rsi/data
 * 
 * 查询参数：
 * - page: 页码 (默认1)
 * - limit: 每页条数 (默认20)
 * - stockType: 股票类型 (A/HK/US)
 * - klt: K线类型 (5/15/101)
 * - stockCode: 股票代码 (支持模糊搜索)
 * - stockName: 股票名称 (支持模糊搜索)
 * - suggestion: 建议类型
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 * - sortBy: 排序字段 (timestamp/rsi_value/stock_name)
 * - sortOrder: 排序方向 (ASC/DESC)
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
    // 解析查询参数
    const {
      page = '1',
      limit = '20',
      stockType,
      klt,
      stockCode,
      stockName,
      suggestion,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'DESC'
    } = req.query;

    // 参数验证
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: '页码必须是大于0的整数'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: '每页条数必须是1-100之间的整数'
      });
    }

    // 验证股票类型
    if (stockType && !Object.values(EStockType).includes(stockType as EStockType)) {
      return res.status(400).json({
        success: false,
        message: '无效的股票类型，必须是A、HK或US'
      });
    }

    // 验证K线类型
    if (klt) {
      const kltNum = parseInt(klt as string, 10);
      if (!Object.values(EKLT).includes(kltNum)) {
        return res.status(400).json({
          success: false,
          message: '无效的K线类型，必须是5、15或101'
        });
      }
    }

    // 验证建议类型
    if (suggestion && !Object.values(ERSISuggestion).includes(suggestion as ERSISuggestion)) {
      return res.status(400).json({
        success: false,
        message: '无效的建议类型'
      });
    }

    // 验证排序字段
    const allowedSortFields = ['timestamp', 'rsi_value', 'stock_name'];
    if (!allowedSortFields.includes(sortBy as string)) {
      return res.status(400).json({
        success: false,
        message: '无效的排序字段'
      });
    }

    // 验证排序方向
    if (!['ASC', 'DESC'].includes(sortOrder as string)) {
      return res.status(400).json({
        success: false,
        message: '排序方向必须是ASC或DESC'
      });
    }

    // 检查数据库存储是否启用
    if (!ENABLE_DATABASE_STORAGE) {
      console.log('数据库存储已禁用，返回空的RSI数据响应');
      return res.status(200).json({
        success: true,
        message: '数据库存储已禁用，无法查询历史数据',
        data: [],
        pagination: {
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0,
        },
        note: '系统当前运行在数据库禁用模式下，RSI分析功能正常但无历史数据查询'
      });
    }

    // 构建查询参数
    const queryParams: IRSIQueryParams = {
      page: pageNum,
      limit: limitNum,
      stockType: stockType as EStockType,
      klt: klt ? parseInt(klt as string, 10) as EKLT : undefined,
      stockCode: stockCode as string,
      stockName: stockName as string,
      suggestion: suggestion as ERSISuggestion,
      startDate: startDate as string,
      endDate: endDate as string,
      sortBy: sortBy as 'timestamp' | 'rsi_value' | 'stock_name',
      sortOrder: sortOrder as 'ASC' | 'DESC',
    };

    // 查询数据
    const result = await RSIService.queryRSIData(queryParams);

    return res.status(200).json({
      success: true,
      message: '查询成功',
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      }
    });

  } catch (error) {
    console.error('RSI数据查询失败:', error);
    
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
} 