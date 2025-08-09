import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../lib/database';
import { EStockType, EKLT } from '../../pages/interface';

// RSI原始数据属性接口
interface RSIDataAttributes {
  id: number;
  stock_code: string;
  stock_name: string;
  stock_type: EStockType; // A股、港股、美股
  market: number; // 市场类型
  klt: EKLT; // K线类型：5M, 15M, DAY
  klt_desc: string; // K线类型描述：5RSI, 15RSI, DAYRSI
  rsi_value: number; // RSI值
  price: number; // 当前价格
  price_change: string | null; // 价格变化百分比
  timestamp: Date; // RSI数据时间
  market_link: string; // 股票链接
  req_type: string; // 请求类型：EASY_MONEY 或 FU_TU
  created_date: Date; // 数据创建时间
  created_at: Date;
  updated_at: Date;
}

// 创建模型时的可选属性
type RSIDataCreationAttributes = Optional<RSIDataAttributes, 'id' | 'created_at' | 'updated_at'>;

// RSI原始数据模型类
class RSIData extends Model<RSIDataAttributes, RSIDataCreationAttributes> implements RSIDataAttributes {
  public id!: number;
  public stock_code!: string;
  public stock_name!: string;
  public stock_type!: EStockType;
  public market!: number;
  public klt!: EKLT;
  public klt_desc!: string;
  public rsi_value!: number;
  public price!: number;
  public price_change!: string | null;
  public timestamp!: Date;
  public market_link!: string;
  public req_type!: string;
  public created_date!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

// 初始化RSI原始数据模型
RSIData.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
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
  modelName: 'RSIData',
  tableName: 'rsi_data',
  comment: 'RSI原始数据表 - 仅存储从东方财富拉取的纯净RSI数据',
  indexes: [
    {
      name: 'idx_stock_code_klt_timestamp',
      fields: ['stock_code', 'klt', 'timestamp'],
    },
    {
      name: 'idx_stock_type_klt_created_date',
      fields: ['stock_type', 'klt', 'created_date'],
    },
    {
      name: 'idx_rsi_value_timestamp',
      fields: ['rsi_value', 'timestamp'],
    },
    {
      name: 'idx_created_date',
      fields: ['created_date'],
    },
    {
      name: 'idx_timestamp',
      fields: ['timestamp'],
    },
  ],
});

export default RSIData; 