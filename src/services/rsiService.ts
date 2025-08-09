import dayjs from 'dayjs';
import RSIData from './models/RSIData';
import RSIRecommendation from './models/RSIRecommendation';
import { EStockType, EKLT, getEKLTDesc } from '../pages/interface';
import { ERSISuggestion } from '../pages/utils/config';
import { Op } from 'sequelize';

// 定义RSI原始数据保存接口
export interface IRSIRawData {
  stockCode: string;
  stockName: string;
  stockType: EStockType;
  market: number;
  klt: EKLT;
  rsiValue: number;
  price: number;
  priceChange: string | null;
  timestamp: Date;
  marketLink: string;
  reqType: string;
}

// 定义RSI分析推荐数据保存接口
export interface IRSIRecommendationData {
  rsiDataId?: number | null; // 关联的原始数据ID
  stockCode: string;
  stockName: string;
  stockType: EStockType;
  market: number;
  klt: EKLT;
  rsiValue: number;
  suggestion: ERSISuggestion;
  price: number;
  priceChange: string | null;
  volume: number | null;
  timestamp: Date;
  marketLink: string;
  isChipIncrease: boolean;
  isBacktest: boolean;
  backtestProfit: string | null;
  tradeDirection: boolean | null;
  reqType: string;
}

// 兼容旧接口的完整数据结构
export interface IRSISaveData {
  stockCode: string;
  stockName: string;
  stockType: EStockType;
  market: number;
  klt: EKLT;
  rsiValue: number;
  suggestion: ERSISuggestion | null;
  price: number;
  priceChange: string | null;
  volume: number | null;
  timestamp: Date;
  isChipIncrease: boolean;
  isBacktest: boolean;
  backtestProfit: string | null;
  marketLink: string;
  tradeDirection: boolean | null;
  reqType: string;
}

// RSI查询参数接口
export interface IRSIQueryParams {
  page?: number;
  limit?: number;
  stockType?: EStockType;
  klt?: EKLT;
  stockCode?: string;
  stockName?: string;
  suggestion?: ERSISuggestion;
  startDate?: string;
  endDate?: string;
  sortBy?: 'timestamp' | 'rsi_value' | 'stock_name' | 'analysis_timestamp';
  sortOrder?: 'ASC' | 'DESC';
  includeRecommendations?: boolean; // 是否包含关联的推荐数据
}

// RSI查询结果接口
export interface IRSIQueryResult {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * RSI数据服务类
 * 适配新的数据分离架构：原始数据与分析结果分离
 */
export class RSIService {
  
  /**
   * 批量保存RSI原始数据（纯净数据）
   * @param rsiRawDataList RSI原始数据列表
   * @returns 保存的原始数据记录
   */
  static async batchSaveRSIRawData(rsiRawDataList: IRSIRawData[]): Promise<any[]> {
    if (rsiRawDataList.length === 0) {
      console.log('🔄 没有RSI原始数据需要保存');
      return [];
    }

    try {
      const createdDate = dayjs().format('YYYY-MM-DD');
      const createdDateObj = new Date(createdDate);
      
      // 准备原始数据记录
      const rawRecords = rsiRawDataList.map(data => ({
        stock_code: data.stockCode,
        stock_name: data.stockName,
        stock_type: data.stockType,
        market: data.market,
        klt: data.klt,
        klt_desc: getEKLTDesc(data.klt) || '',
        rsi_value: data.rsiValue,
        price: data.price,
        price_change: data.priceChange,
        timestamp: data.timestamp,
        market_link: data.marketLink,
        req_type: data.reqType,
        created_date: createdDateObj,
      }));

      // 批量插入原始数据
      const savedRecords = await RSIData.bulkCreate(rawRecords, {
        ignoreDuplicates: true,
        returning: true, // 返回创建的记录
      });

      console.log(`✅ 成功保存${savedRecords.length}条RSI原始数据到数据库`);
      return savedRecords;

    } catch (error) {
      console.error('❌ 保存RSI原始数据失败:', error);
      throw error;
    }
  }

  /**
   * 批量保存RSI分析推荐数据
   * @param recommendationDataList RSI推荐数据列表
   */
  static async batchSaveRSIRecommendations(recommendationDataList: IRSIRecommendationData[]): Promise<void> {
    if (recommendationDataList.length === 0) {
      console.log('🔄 没有RSI推荐数据需要保存');
      return;
    }

    try {
      const createdDate = dayjs().format('YYYY-MM-DD');
      const createdDateObj = new Date(createdDate);
      
      // 准备推荐数据记录
      const recommendationRecords = recommendationDataList.map(data => ({
        rsi_data_id: data.rsiDataId,
        stock_code: data.stockCode,
        stock_name: data.stockName,
        stock_type: data.stockType,
        market: data.market,
        klt: data.klt,
        klt_desc: getEKLTDesc(data.klt) || '',
        rsi_value: data.rsiValue,
        suggestion: data.suggestion,
        price: data.price,
        price_change: data.priceChange,
        volume: data.volume,
        timestamp: data.timestamp,
        market_link: data.marketLink,
        is_chip_increase: data.isChipIncrease,
        is_backtest: data.isBacktest,
        backtest_profit: data.backtestProfit,
        trade_direction: data.tradeDirection,
        req_type: data.reqType,
        created_date: createdDateObj,
        is_processed: false,
      }));

      // 批量插入推荐数据
      await RSIRecommendation.bulkCreate(recommendationRecords, {
        ignoreDuplicates: true,
      });

      console.log(`✅ 成功保存${recommendationRecords.length}条RSI推荐数据到数据库`);

    } catch (error) {
      console.error('❌ 保存RSI推荐数据失败:', error);
      throw error;
    }
  }

  /**
   * 批量保存RSI数据（兼容旧接口）
   * 根据是否有建议自动分离存储到原始数据表和推荐表
   * @param rsiDataList RSI数据列表
   */
  static async batchSaveRSIData(rsiDataList: IRSISaveData[]): Promise<void> {
    if (rsiDataList.length === 0) {
      console.log('🔄 没有RSI数据需要保存');
      return;
    }

    try {
      // 分离原始数据和推荐数据
      const rawDataList: IRSIRawData[] = rsiDataList.map(data => ({
        stockCode: data.stockCode,
        stockName: data.stockName,
        stockType: data.stockType,
        market: data.market,
        klt: data.klt,
        rsiValue: data.rsiValue,
        price: data.price,
        priceChange: data.priceChange,
        timestamp: data.timestamp,
        marketLink: data.marketLink,
        reqType: data.reqType,
      }));

      // 保存原始数据并获取创建的记录
      const savedRawRecords = await this.batchSaveRSIRawData(rawDataList);

      // 创建原始数据ID映射
      const dataIdMap = new Map<string, number>();
      savedRawRecords.forEach((record, index) => {
        if (record && record.id) {
          const key = `${rsiDataList[index].stockCode}_${rsiDataList[index].timestamp.getTime()}`;
          dataIdMap.set(key, record.id);
        }
      });

      // 筛选有建议的数据并创建推荐记录
      const recommendationDataList: IRSIRecommendationData[] = rsiDataList
        .filter(data => data.suggestion)
        .map(data => {
          const key = `${data.stockCode}_${data.timestamp.getTime()}`;
          const rsiDataId = dataIdMap.get(key);
          
          return {
            rsiDataId,
            stockCode: data.stockCode,
            stockName: data.stockName,
            stockType: data.stockType,
            market: data.market,
            klt: data.klt,
            rsiValue: data.rsiValue,
            suggestion: data.suggestion!,
            price: data.price,
            priceChange: data.priceChange,
            volume: data.volume,
            timestamp: data.timestamp,
            marketLink: data.marketLink,
            isChipIncrease: data.isChipIncrease,
            isBacktest: data.isBacktest,
            backtestProfit: data.backtestProfit,
            tradeDirection: data.tradeDirection,
            reqType: data.reqType,
          };
        });

      // 保存推荐数据
      if (recommendationDataList.length > 0) {
        await this.batchSaveRSIRecommendations(recommendationDataList);
      }

    } catch (error) {
      console.error('❌ 批量保存RSI数据失败:', error);
      throw error;
    }
  }

  /**
   * 查询RSI原始数据
   * @param params 查询参数
   * @returns 查询结果
   */
  static async queryRSIData(params: IRSIQueryParams): Promise<IRSIQueryResult> {
    const {
      page = 1,
      limit = 20,
      stockType,
      klt,
      stockCode,
      stockName,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'DESC',
      includeRecommendations = false
    } = params;

    try {
      // 构建查询条件
      const where: any = {};
      
      if (stockType) where.stock_type = stockType;
      if (klt) where.klt = klt;
      if (stockCode) where.stock_code = { [Op.like]: `%${stockCode}%` };
      if (stockName) where.stock_name = { [Op.like]: `%${stockName}%` };
      
      if (startDate && endDate) {
        where.timestamp = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      // 计算偏移量
      const offset = (page - 1) * limit;

      // 查询配置
      const queryOptions: any = {
        where,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
        raw: !includeRecommendations,
      };

      // 如果需要包含推荐数据，添加关联查询
      if (includeRecommendations) {
        queryOptions.include = [{
          model: RSIRecommendation,
          as: 'recommendations',
          required: false,
        }];
      }

      // 执行查询
      const { count, rows } = await RSIData.findAndCountAll(queryOptions);

      return {
        data: rows,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };

    } catch (error) {
      console.error('❌ 查询RSI原始数据失败:', error);
      throw error;
    }
  }

  /**
   * 查询RSI推荐数据
   * @param params 查询参数
   * @returns 查询结果
   */
  static async queryRSIRecommendations(params: IRSIQueryParams): Promise<IRSIQueryResult> {
    const {
      page = 1,
      limit = 20,
      stockType,
      klt,
      stockCode,
      suggestion,
      startDate,
      endDate,
      sortBy = 'analysis_timestamp',
      sortOrder = 'DESC'
    } = params;

    try {
      // 构建查询条件
      const where: any = {};
      
      if (stockType) where.stock_type = stockType;
      if (klt) where.klt = klt;
      if (stockCode) where.stock_code = { [Op.like]: `%${stockCode}%` };
      if (suggestion) where.suggestion = suggestion;
      
      if (startDate && endDate) {
        where.analysis_timestamp = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      const offset = (page - 1) * limit;

      const { count, rows } = await RSIRecommendation.findAndCountAll({
        where,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
        include: [{
          model: RSIData,
          as: 'rsiData',
          required: false,
        }],
      });

      return {
        data: rows,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };

    } catch (error) {
      console.error('❌ 查询RSI推荐数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取RSI统计信息
   */
  static async getRSIStatistics(): Promise<any> {
    try {
      // 获取原始数据统计
      const rawDataStats = await RSIData.findAll({
        attributes: [
          'stock_type',
          'klt',
          [RSIData.sequelize!.fn('COUNT', '*'), 'count'],
          [RSIData.sequelize!.fn('AVG', RSIData.sequelize!.col('rsi_value')), 'avg_rsi'],
          [RSIData.sequelize!.fn('MIN', RSIData.sequelize!.col('rsi_value')), 'min_rsi'],
          [RSIData.sequelize!.fn('MAX', RSIData.sequelize!.col('rsi_value')), 'max_rsi'],
        ],
        group: ['stock_type', 'klt'],
        raw: true,
      });

      // 获取推荐数据统计
      const recommendationStats = await RSIRecommendation.findAll({
        attributes: [
          'suggestion',
          [RSIRecommendation.sequelize!.fn('COUNT', '*'), 'count'],
          [RSIRecommendation.sequelize!.fn('COUNT', RSIRecommendation.sequelize!.literal('CASE WHEN is_processed = false THEN 1 END')), 'pending'],
        ],
        group: ['suggestion'],
        raw: true,
      });

      // 今日数据统计
      const today = dayjs().format('YYYY-MM-DD');
      const todayRawCount = await RSIData.count({
        where: {
          created_date: today,
        },
      });

      const todayRecommendationCount = await RSIRecommendation.count({
        where: {
          created_date: today,
        },
      });

      return {
        raw_data_stats: rawDataStats,
        recommendation_stats: recommendationStats,
        today_stats: {
          raw_data_count: todayRawCount,
          recommendation_count: todayRecommendationCount,
        },
        data_separation: {
          description: '原始数据与分析结果已分离存储',
          raw_data_table: 'rsi_data',
          recommendation_table: 'rsi_recommendations',
        },
      };
    } catch (error) {
      console.error('❌ 获取RSI统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 根据原始数据ID获取关联的推荐
   * @param rsiDataIds 原始数据ID数组
   */
  static async getRecommendationsByDataIds(rsiDataIds: number[]): Promise<any[]> {
    try {
      return await RSIRecommendation.findAll({
        where: {
          rsi_data_id: {
            [Op.in]: rsiDataIds,
          },
        },
        order: [['analysis_timestamp', 'DESC']],
      });
    } catch (error) {
      console.error('❌ 获取关联推荐失败:', error);
      throw error;
    }
  }

  /**
   * 更新推荐处理状态
   * @param recommendationIds 推荐ID数组
   * @param isProcessed 处理状态
   */
  static async updateRecommendationStatus(recommendationIds: number[], isProcessed: boolean): Promise<void> {
    try {
      await RSIRecommendation.update(
        { is_processed: isProcessed },
        {
          where: {
            id: {
              [Op.in]: recommendationIds,
            },
          },
        }
      );
      console.log(`✅ 已更新${recommendationIds.length}条推荐的处理状态为${isProcessed}`);
    } catch (error) {
      console.error('❌ 更新推荐处理状态失败:', error);
      throw error;
    }
  }
}

export default RSIService; 