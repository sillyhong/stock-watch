/**
 * 主涨段监控配置文件
 * 
 * 支持配置不同级别的主涨段（日线主涨段、60分钟主涨段等）
 * 支持配置不同市场的主涨段（A股、港股、美股）
 */

import { EKLT, EStockType } from "../interface";

/**
 * K线周期类型
 * 101 = 日线
 * 102 = 周线
 * 103 = 月线
 * 60 = 60分钟
 * 30 = 30分钟
 * 15 = 15分钟
 * 5 = 5分钟
 */
export enum EKlineType {
  MIN_5 = 5,
  MIN_15 = 15,
  MIN_30 = 30,
  MIN_60 = 60,
  DAY = 101,
  WEEK = 102,
  MONTH = 103
}

/**
 * 主涨段条件配置接口
 */
export interface IMainTrendConditionConfig {
  // 条件名称（用于显示）
  name: string;
  
  // 市场类型（A股、港股、美股）
  marketType: EStockType;
  
  eltConfig: EKLT,
  // MACD检测配置
  macd: {
    klt: EKlineType;      // K线周期
    lmt: number;          // 获取数据条数
    fqt: number;          // 复权类型（0=不复权, 1=前复权, 2=后复权）
    description: string;  // 描述
  };
  
  // MA均线检测配置
  ma: {
    klt: EKlineType;      // K线周期
    period: number;       // 均线周期（如 55 表示 MA55）
    lmt: number;          // 获取数据条数
    fqt: number;          // 复权类型
    description: string;  // 描述
  };
  
  // BOLL布林带检测配置
  boll: {
    klt: EKlineType;      // K线周期
    lmt: number;          // 获取数据条数
    fqt: number;          // 复权类型
    description: string;  // 描述
  };
}

/**
 * 预设的主涨段配置
 */
export const MainTrendConfigs = {
  // ==================== A股配置 ====================
  /**
   * A股日线主涨段配置
   * 条件：月MACD金叉 + 日MA55 + 60分钟BOLL中轨
   */
  A_DAY_MAIN_TREND: {
    name: 'A股日线主涨段',
    marketType: EStockType.A,
    eltConfig: EKLT['DAY'],
    macd: {
      klt: EKlineType.MONTH,  // 月线MACD
      lmt: 100,
      fqt: 1,
      description: '月线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.DAY,    // 日线MA
      period: 55,             // MA55
      lmt: 320,
      fqt: 1,
      description: '日线在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_60, // 60分钟BOLL
      lmt: 440,
      fqt: 1,
      description: '60分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,

  /**
   * A股60分钟主涨段配置
   * 条件：周MACD金叉 + 日MA55 + 60分钟BOLL中轨
   */
  A_MIN_60_MAIN_TREND: {
    name: 'A股60分钟主涨段',
    marketType: EStockType.A,
    eltConfig: EKLT['60M'],
    macd: {
      klt: EKlineType.WEEK,   // 周线MACD
      lmt: 100,
      fqt: 1,
      description: '周线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.MIN_60,    // 60分MA
      period: 55,             // MA55
      lmt: 255,
      fqt: 1,
      description: '60分线在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_30, // 60分钟BOLL
      lmt: 440,
      fqt: 1,
      description: '30分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,

  /**
   * A股30分钟主涨段配置
   * 条件：日MACD金叉 + 60分钟MA55 + 30分钟BOLL中轨
   */
  A_MIN_30_MAIN_TREND: {
    name: 'A股30分钟主涨段',
    marketType: EStockType.A,
    eltConfig: EKLT['30M'],
    macd: {
      klt: EKlineType.DAY,    // 日线MACD
      lmt: 255,
      fqt: 1,
      description: '日线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.MIN_60, // 60分钟MA
      period: 55,             // MA55
      lmt: 440,
      fqt: 1,
      description: '60分钟在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_30, // 30分钟BOLL
      lmt: 880,
      fqt: 1,
      description: '30分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,

  // ==================== 港股配置 ====================
  /**
   * 港股日线主涨段配置
   * 条件：月MACD金叉 + 日MA55 + 60分钟BOLL中轨
   */
  HK_DAY_MAIN_TREND: {
    name: '港股日线主涨段',
    marketType: EStockType.HK,
    eltConfig: EKLT['DAY'],
    macd: {
      klt: EKlineType.MONTH,
      lmt: 100,
      fqt: 1,
      description: '月线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.DAY,
      period: 55,
      lmt: 320,
      fqt: 1,
      description: '日线在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_60,
      lmt: 440,
      fqt: 1,
      description: '60分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,

  /**
   * 港股60分钟主涨段配置
   */
  HK_MIN_60_MAIN_TREND: {
    name: '港股60分钟主涨段',
    marketType: EStockType.HK,
    eltConfig: EKLT['60M'],
    macd: {
      klt: EKlineType.WEEK,
      lmt: 100,
      fqt: 1,
      description: '周线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.DAY,
      period: 55,
      lmt: 255,
      fqt: 1,
      description: '日线在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_60,
      lmt: 440,
      fqt: 1,
      description: '60分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,

  // ==================== 美股配置 ====================
  /**
   * 美股日线主涨段配置
   * 条件：月MACD金叉 + 日MA55 + 60分钟BOLL中轨
   */
  US_DAY_MAIN_TREND: {
    name: '美股日线主涨段',
    marketType: EStockType.US,
    eltConfig: EKLT['DAY'],
    macd: {
      klt: EKlineType.MONTH,
      lmt: 100,
      fqt: 1,
      description: '月线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.DAY,
      period: 55,
      lmt: 320,
      fqt: 1,
      description: '日线在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_60,
      lmt: 440,
      fqt: 1,
      description: '60分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,

  /**
   * 美股60分钟主涨段配置
   */
  US_MIN_60_MAIN_TREND: {
    name: '美股60分钟主涨段',
    marketType: EStockType.US,
    eltConfig: EKLT['60M'],
    macd: {
      klt: EKlineType.WEEK,
      lmt: 100,
      fqt: 1,
      description: '周线MACD金叉（DIFF > DEA）'
    },
    ma: {
      klt: EKlineType.DAY,
      period: 55,
      lmt: 255,
      fqt: 1,
      description: '日线在MA55上方'
    },
    boll: {
      klt: EKlineType.MIN_60,
      lmt: 440,
      fqt: 1,
      description: '60分钟在BOLL中轨上方'
    }
  } as IMainTrendConditionConfig,
};

/**
 * 默认使用的主涨段配置（按市场）
 */
export const DEFAULT_MAIN_TREND_CONFIG = {
  [EStockType.A]: MainTrendConfigs.A_DAY_MAIN_TREND,
  [EStockType.HK]: MainTrendConfigs.HK_DAY_MAIN_TREND,
  [EStockType.US]: MainTrendConfigs.US_DAY_MAIN_TREND,
};

/**
 * 获取MA数据中对应周期的索引
 * MA数据格式: [时间, MA5, MA10, MA20, MA55, MA255]
 * [
    "2026-02-13",
    345.524,
    348.07500000000005,
    352.545,
    340.98163636363637,
    315.4889270386265
    ]
 */
export function getMAIndexByPeriod(period: number): number {
  const periodMap: Record<number, number> = {
    5: 1,
    10: 2,
    20: 3,
    55: 4,
    255: 5
  };
  
  return periodMap[period] || 4; // 默认返回MA55的索引
}

/**
 * 获取K线周期的中文描述
 */
export function getKlineTypeDescription(klt: EKlineType): string {
  const descriptions: Record<number, string> = {
    [EKlineType.MIN_5]: '5分钟',
    [EKlineType.MIN_15]: '15分钟',
    [EKlineType.MIN_30]: '30分钟',
    [EKlineType.MIN_60]: '60分钟',
    [EKlineType.DAY]: '日线',
    [EKlineType.WEEK]: '周线',
    [EKlineType.MONTH]: '月线'
  };
  
  return descriptions[klt] || '未知周期';
}
