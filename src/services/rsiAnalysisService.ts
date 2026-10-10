import dayjs from 'dayjs';
import RSIData from './models/RSIData';
import RSIRecommendation, { RSIRecommendationCreationAttributes } from './models/RSIRecommendation';
import { EStockType, EKLT } from '../pages/interface';
import { ERSISuggestion } from '../pages/utils/config';
import { Op } from 'sequelize';

// 买入卖出点接口
export interface ITradingPoint {
  id: number;
  stock_code: string;
  stock_name: string;
  rsi_value: number;
  price: number;
  timestamp: Date;
  action: 'buy' | 'sell';
  signal_strength: 'immediate' | 'suggested'; // 立即 或 建议
  suggestion?: ERSISuggestion;
}

// 成功率分析结果接口
export interface ISuccessRateAnalysis {
  stock_code: string;
  stock_name: string;
  total_trades: number;
  successful_trades: number;
  success_rate: number;
  average_profit: number;
  max_profit: number;
  min_profit: number;
  trades: {
    buy_date: string;
    buy_price: number;
    buy_rsi: number;
    sell_date: string;
    sell_price: number;
    sell_rsi: number;
    profit_percent: number;
    holding_days: number;
  }[];
}

// RSI图表数据接口
export interface IRSIChartData {
  timestamp: Date;
  rsi_value: number;
  price: number;
  trading_point?: ITradingPoint;
}

/**
 * RSI分析服务类
 * 专门用于分析原始RSI数据，生成买入卖出点和成功率统计
 * 适配新的数据分离架构：基于原始数据进行分析
 */
export class RSIAnalysisService {
  
  /**
   * 根据RSI值判断买入卖出信号
   * @param rsiValue RSI值
   * @returns 交易信号
   */
  static getTradingSignal(rsiValue: number): { action: 'buy' | 'sell' | null, strength: 'immediate' | 'suggested' } {
    if (rsiValue <= 20) {
      return { action: 'buy', strength: 'immediate' }; // 立即买入🚀
    } else if (rsiValue <= 30) {
      return { action: 'buy', strength: 'suggested' }; // 建议买入🔥
    } else if (rsiValue >= 80) {
      return { action: 'sell', strength: 'immediate' }; // 立即卖出😱
    } else if (rsiValue >= 70) {
      return { action: 'sell', strength: 'suggested' }; // 建议卖出🚨
    }
    return { action: null, strength: 'suggested' };
  }

  /**
   * 将交易信号转换为建议文本
   * @param signal 交易信号
   * @returns 建议文本
   */
  static convertSignalToSuggestion(signal: { action: 'buy' | 'sell' | null, strength: 'immediate' | 'suggested' }): ERSISuggestion | null {
    if (!signal.action) return null;
    
    if (signal.action === 'buy') {
      return signal.strength === 'immediate' ? ERSISuggestion.MUST_BUY : ERSISuggestion.BUY;
    } else {
      return signal.strength === 'immediate' ? ERSISuggestion.MUST_SELL : ERSISuggestion.SELL;
    }
  }

  /**
   * 获取指定股票的RSI图表数据和交易点
   * @param stockCode 股票代码
   * @param klt K线类型
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns RSI图表数据
   */
  static async getRSIChartData(
    stockCode: string,
    klt: EKLT,
    startDate?: string,
    endDate?: string
  ): Promise<IRSIChartData[]> {
    try {
      const where: Record<string, unknown> = {
        stock_code: stockCode,
        klt: klt,
      };

      if (startDate && endDate) {
        where.timestamp = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

      // 查询原始RSI数据
      const rsiDataList = await RSIData.findAll({
        where,
        order: [['timestamp', 'ASC']],
        raw: true,
      });

      // 转换为图表数据并标记交易点
      const chartData: IRSIChartData[] = rsiDataList.map((data) => {
        const signal = this.getTradingSignal(data.rsi_value);
        const chartPoint: IRSIChartData = {
          timestamp: data.timestamp,
          rsi_value: data.rsi_value,
          price: data.price,
        };

        // 如果有交易信号，添加交易点
        if (signal.action) {
          const suggestion = this.convertSignalToSuggestion(signal);
          chartPoint.trading_point = {
            id: data.id,
            stock_code: data.stock_code,
            stock_name: data.stock_name,
            rsi_value: data.rsi_value,
            price: data.price,
            timestamp: data.timestamp,
            action: signal.action,
            signal_strength: signal.strength,
            suggestion: suggestion || undefined,
          };
        }

        return chartPoint;
      });

      return chartData;
    } catch (error) {
      console.error('❌ 获取RSI图表数据失败:', error);
      throw error;
    }
  }

  /**
   * 分析15分钟RSI交易成功率
   * 策略：第一天RSI < 25买入，第二天RSI > 75卖出
   * @param stockCode 股票代码（可选，为空则分析所有股票）
   * @param days 分析天数（默认30天）
   * @returns 成功率分析结果
   */
  static async analyze15MinRSISuccessRate(
    stockCode?: string,
    days: number = 30
  ): Promise<ISuccessRateAnalysis[]> {
    try {
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const where: Record<string, unknown> = {
        klt: 15, // 15分钟RSI
        timestamp: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        }
      };

      if (stockCode) {
        where.stock_code = stockCode;
      }

      // 获取15分钟RSI原始数据
      const rsiDataList = await RSIData.findAll({
        where,
        order: [['stock_code', 'ASC'], ['timestamp', 'ASC']],
        raw: true,
      });

      // 按股票分组
      const stockGroups = this.groupByStock(rsiDataList);
      const analysisResults: ISuccessRateAnalysis[] = [];

      // 分析每只股票
      for (const [stockCodeKey, stockData] of stockGroups.entries()) {
        const result = this.analyzeStockSuccessRate(stockCodeKey, stockData);
        if (result.total_trades > 0) {
          analysisResults.push(result);
        }
      }

      return analysisResults.sort((a, b) => b.success_rate - a.success_rate);
    } catch (error) {
      console.error('❌ 分析15分钟RSI成功率失败:', error);
      throw error;
    }
  }

  /**
   * 按股票代码分组RSI数据
   */
  private static groupByStock(rsiDataList: RSIData[]): Map<string, RSIData[]> {
    const groups = new Map<string, RSIData[]>();
    
    rsiDataList.forEach(data => {
      const stockCode = data.stock_code;
      if (!groups.has(stockCode)) {
        groups.set(stockCode, []);
      }
      groups.get(stockCode)!.push(data);
    });

    return groups;
  }

  /**
   * 分析单只股票的成功率
   */
  private static analyzeStockSuccessRate(stockCode: string, stockData: RSIData[]): ISuccessRateAnalysis {
    const trades: Record<string, unknown>[] = [];
    let buyPosition: Record<string, unknown> | null = null;

    // 遍历数据寻找交易机会
    for (let i = 0; i < stockData.length; i++) {
      const current = stockData[i];
      const rsiValue = parseFloat(String(current.rsi_value));

      // 寻找买入点：RSI < 25
      if (!buyPosition && rsiValue < 25) {
        buyPosition = {
          buy_date: dayjs(current.timestamp as Date).format('YYYY-MM-DD HH:mm'),
          buy_price: parseFloat(String(current.price)),
          buy_rsi: rsiValue,
          buy_timestamp: current.timestamp,
        };
        continue;
      }

      // 寻找卖出点：RSI > 75 且距离买入至少1天
      if (buyPosition && rsiValue > 75) {
        const buyTime = dayjs(buyPosition.buy_timestamp as Date);
        const sellTime = dayjs(current.timestamp as Date);
        const holdingHours = sellTime.diff(buyTime, 'hour');

        // 至少持有4小时（15分钟*16个周期）
        if (holdingHours >= 4) {
          const sellPrice = parseFloat(String(current.price));
          const buyPrice = buyPosition.buy_price as number;
          const profitPercent = ((sellPrice - buyPrice) / buyPrice) * 100;

          trades.push({
            ...buyPosition,
            sell_date: sellTime.format('YYYY-MM-DD HH:mm'),
            sell_price: sellPrice,
            sell_rsi: rsiValue,
            profit_percent: profitPercent,
            holding_days: sellTime.diff(buyTime, 'day', true),
          });

          buyPosition = null; // 重置买入位置
        }
      }
    }

    // 计算成功率统计
    const successfulTrades = trades.filter(trade => (trade.profit_percent as number) > 0);
    const totalTrades = trades.length;
    const successRate = totalTrades > 0 ? (successfulTrades.length / totalTrades) * 100 : 0;

    const profits = trades.map(trade => trade.profit_percent as number);
    const averageProfit = totalTrades > 0 ? profits.reduce((sum, p) => sum + p, 0) / totalTrades : 0;
    const maxProfit = totalTrades > 0 ? Math.max(...profits) : 0;
    const minProfit = totalTrades > 0 ? Math.min(...profits) : 0;

    return {
      stock_code: stockCode,
      stock_name: stockData[0]?.stock_name as string || stockCode,
      total_trades: totalTrades,
      successful_trades: successfulTrades.length,
      success_rate: parseFloat(successRate.toFixed(2)),
      average_profit: parseFloat(averageProfit.toFixed(2)),
      max_profit: parseFloat(maxProfit.toFixed(2)),
      min_profit: parseFloat(minProfit.toFixed(2)),
      trades: trades.map(trade => ({
        buy_date: trade.buy_date as string,
        buy_price: trade.buy_price as number,
        buy_rsi: trade.buy_rsi as number,
        sell_date: trade.sell_date as string,
        sell_price: trade.sell_price as number,
        sell_rsi: trade.sell_rsi as number,
        profit_percent: trade.profit_percent as number,
        holding_days: trade.holding_days as number,
      })),
    };
  }

  /**
   * 获取所有交易点（买入/卖出信号）
   * 基于原始RSI数据计算交易信号，同时查询已存在的推荐
   * @param stockType 股票类型
   * @param klt K线类型
   * @param days 查询天数
   * @returns 交易点列表
   */
  static async getTradingPoints(
    stockType?: EStockType,
    klt?: EKLT,
    days: number = 7
  ): Promise<ITradingPoint[]> {
    try {
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const where: Record<string, unknown> = {
        timestamp: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        }
      };

      if (stockType) where.stock_type = stockType;
      if (klt) where.klt = klt;

      // 查询原始RSI数据，同时关联推荐数据
      const rsiDataList = await RSIData.findAll({
        where,
        include: [{
          model: RSIRecommendation,
          as: 'recommendations',
          required: false,
        }],
        order: [['timestamp', 'DESC']],
        raw: false,
      });

      const tradingPoints: ITradingPoint[] = [];

      rsiDataList.forEach((data) => {
        const signal = this.getTradingSignal(data.rsi_value);
        if (signal.action) {
          // 获取已存在的推荐（如果有）
          const recommendations = (data as RSIData & { recommendations?: RSIRecommendation[] }).recommendations;
          const existingRecommendation = recommendations?.[0];
          const suggestion = existingRecommendation?.suggestion || this.convertSignalToSuggestion(signal);

          tradingPoints.push({
            id: data.id,
            stock_code: data.stock_code,
            stock_name: data.stock_name,
            rsi_value: data.rsi_value,
            price: data.price,
            timestamp: data.timestamp,
            action: signal.action,
            signal_strength: signal.strength,
            suggestion: suggestion || undefined,
          });
        }
      });

      return tradingPoints;
    } catch (error) {
      console.error('❌ 获取交易点失败:', error);
      throw error;
    }
  }

  /**
   * 基于原始RSI数据生成推荐
   * 扫描原始数据，为符合条件的数据生成推荐记录
   * @param stockType 股票类型
   * @param klt K线类型
   * @param days 扫描天数
   * @returns 生成的推荐数量
   */
  static async generateRecommendationsFromRawData(
    stockType?: EStockType,
    klt?: EKLT,
    days: number = 1
  ): Promise<number> {
    try {
      const endDate = dayjs();
      const startDate = endDate.subtract(days, 'day');

      const where: Record<string, unknown> = {
        timestamp: {
          [Op.between]: [startDate.toDate(), endDate.toDate()]
        }
      };

      if (stockType) where.stock_type = stockType;
      if (klt) where.klt = klt;

      // 查询原始RSI数据，排除已有推荐的数据
      const rsiDataList = await RSIData.findAll({
        where,
        include: [{
          model: RSIRecommendation,
          as: 'recommendations',
          required: false,
        }],
        raw: false,
      });

      const newRecommendations: RSIRecommendationCreationAttributes[] = [];

      for (const data of rsiDataList) {
        const recommendations = (data as RSIData & { recommendations?: RSIRecommendation[] }).recommendations;
        const hasExistingRecommendation = (recommendations || []).length > 0;
        
        if (!hasExistingRecommendation) {
          const signal = this.getTradingSignal(data.rsi_value);
          if (signal.action) {
            const suggestion = this.convertSignalToSuggestion(signal);
            if (suggestion) {
              newRecommendations.push({
                rsi_data_id: data.id,
                stock_code: data.stock_code,
                stock_name: data.stock_name,
                stock_type: data.stock_type,
                market: data.market,
                klt: data.klt,
                klt_desc: data.klt_desc,
                rsi_value: data.rsi_value,
                suggestion: suggestion,
                price: data.price,
                price_change: data.price_change,
                volume: null, // 原始数据中没有volume字段
                timestamp: data.timestamp,
                market_link: data.market_link,
                is_chip_increase: false,
                is_backtest: false,
                backtest_profit: null,
                trade_direction: signal.action === 'buy',
                req_type: data.req_type,
                created_date: new Date(),
                is_processed: false,
              });
            }
          }
        }
      }

      if (newRecommendations.length > 0) {
        await RSIRecommendation.bulkCreate(newRecommendations, {
          ignoreDuplicates: true,
        });
        console.log(`✅ 基于原始数据生成了${newRecommendations.length}条新推荐`);
      }

      return newRecommendations.length;
    } catch (error) {
      console.error('❌ 生成推荐失败:', error);
      throw error;
    }
  }
}

export default RSIAnalysisService; 
