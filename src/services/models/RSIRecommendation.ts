import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../lib/database';
import { EStockType, EKLT } from '../../pages/interface';
import { ERSISuggestion } from '../../pages/utils/config';
import RSIData from './RSIData';

// RSI分析推荐属性接口
export interface RSIRecommendationAttributes {
  id: number;
  rsi_data_id: number | null; // 关联的RSI原始数据ID
  stock_code: string;
  stock_name: string;
  stock_type: EStockType;
  market: number; // 市场类型编号
  klt: EKLT;
  klt_desc: string;
  rsi_value: number;
  suggestion: ERSISuggestion;
  price: number;
  price_change: string | null;
  volume: number | null;
  timestamp: Date; // RSI数据对应的时间戳
  market_link: string;
  is_chip_increase: boolean; // 是否筹码集中度上升
  is_backtest: boolean; // 是否为回测数据
  backtest_profit: string | null; // 回测收益信息
  trade_direction: boolean | null; // 交易方向趋势
  req_type: string;
  created_date: Date;
  is_processed: boolean; // 是否已处理
  analysis_timestamp: Date; // 分析生成时间
  created_at: Date;
  updated_at: Date;
}

// 创建模型时的可选属性
export type RSIRecommendationCreationAttributes = Optional<RSIRecommendationAttributes, 'id' | 'created_at' | 'updated_at' | 'is_processed' | 'analysis_timestamp'>;

// RSI分析推荐模型类
class RSIRecommendation extends Model<RSIRecommendationAttributes, RSIRecommendationCreationAttributes> implements RSIRecommendationAttributes {
  public id!: number;
  public rsi_data_id!: number | null;
  public stock_code!: string;
  public stock_name!: string;
  public stock_type!: EStockType;
  public market!: number;
  public klt!: EKLT;
  public klt_desc!: string;
  public rsi_value!: number;
  public suggestion!: ERSISuggestion;
  public price!: number;
  public price_change!: string | null;
  public volume!: number | null;
  public timestamp!: Date;
  public market_link!: string;
  public is_chip_increase!: boolean;
  public is_backtest!: boolean;
  public backtest_profit!: string | null;
  public trade_direction!: boolean | null;
  public req_type!: string;
  public created_date!: Date;
  public is_processed!: boolean;
  public analysis_timestamp!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

// 初始化RSI分析推荐模型
RSIRecommendation.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  rsi_data_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '关联的RSI原始数据ID',
    references: {
      model: RSIData,
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
  stock_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '股票代码',
  },
  stock_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '股票名称',
  },
  stock_type: {
    type: DataTypes.ENUM('A', 'HK', 'US'),
    allowNull: false,
    comment: '股票类型：A股、港股、美股',
  },
  market: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '市场类型编号',
  },
  klt: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'K线类型：5=5分钟, 15=15分钟, 101=日线',
  },
  klt_desc: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'K线类型描述',
  },
  rsi_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'RSI指标值',
  },
  suggestion: {
    type: DataTypes.ENUM('立即买入🚀', '建议买入🔥', '立即卖出😱', '建议卖出🚨'),
    allowNull: false,
    comment: '买卖建议',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '当前价格',
  },
  price_change: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '价格变化百分比',
  },
  volume: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '成交量',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: 'RSI数据对应的时间戳',
  },
  market_link: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '股票市场链接',
  },
  is_chip_increase: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否筹码集中度上升',
  },
  is_backtest: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否为回测数据',
  },
  backtest_profit: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '回测收益信息',
  },
  trade_direction: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: '交易方向趋势',
  },
  req_type: {
    type: DataTypes.ENUM('EASY_MONEY', 'FU_TU'),
    allowNull: false,
    comment: '数据请求类型',
  },
  created_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '数据创建日期',
  },
  is_processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: '是否已处理',
  },
  analysis_timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: '分析生成时间',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'RSIRecommendation',
  tableName: 'rsi_recommendations',
  comment: 'RSI分析推荐表 - 基于原始RSI数据生成的买卖建议和趋势分析',
  indexes: [
    {
      name: 'idx_rsi_data_id',
      fields: ['rsi_data_id'],
    },
    {
      name: 'idx_stock_code_suggestion_timestamp',
      fields: ['stock_code', 'suggestion', 'timestamp'],
    },
    {
      name: 'idx_stock_type_klt_created_date_rec',
      fields: ['stock_type', 'klt', 'created_date'],
    },
    {
      name: 'idx_suggestion_is_processed',
      fields: ['suggestion', 'is_processed'],
    },
    {
      name: 'idx_rsi_value_suggestion',
      fields: ['rsi_value', 'suggestion'],
    },
    {
      name: 'idx_analysis_timestamp_processed',
      fields: ['analysis_timestamp', 'is_processed'],
    },
    {
      name: 'idx_created_date_rec',
      fields: ['created_date'],
    },
  ],
});

// 定义关联关系
RSIRecommendation.belongsTo(RSIData, {
  foreignKey: 'rsi_data_id',
  as: 'rsiData',
});

RSIData.hasMany(RSIRecommendation, {
  foreignKey: 'rsi_data_id',
  as: 'recommendations',
});

export default RSIRecommendation; 
