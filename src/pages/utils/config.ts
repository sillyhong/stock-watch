import dayjs from "dayjs";
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrAfter);
import { EKLT, EStockType, IEmailListItem, IKlineItem, IPriceChangeData, IRSICalculationData, IStockData } from "../interface"
import { CYQCalculator } from "@/modules/tools/indicator/cyq";
import axios from "axios";
import { a_beijiaosuo } from "../data/astock/beijiaosuo";
import { a_xiaofeidianzi } from "../data/astock/xiaofeidanzi";
import { IFutuStockInfo, IFutuApiResponse } from "../interface/futu";


// ================================= 常量定义 =================================

/** 数据库存储开关：控制是否将RSI数据保存到数据库，默认关闭以减少数据库负载 */
export const ENABLE_DATABASE_STORAGE = process.env.ENABLE_DATABASE_STORAGE === 'true';

/** 高级功能开关：控制是否启用MA55价格比较和MACD金叉检测等高级功能 */
export const ENABLE_ADVANCED_FEATURES = true//process.env.ENABLE_ADVANCED_FEATURES === 'true';

/** 批处理大小：每批次处理的股票数量，避免单次请求过多导致超时或被限制 */
export const BATCH_SIZE = 10;

/** 请求超时时间：120秒，防止长时间等待 */
export const REQUEST_TIMEOUT = 120000;

/** 批次间延迟范围：避免频繁请求被封禁 */
export const BATCH_DELAY_RANGE = { min: 1500, max: 2000 };

/** 单个请求延迟范围：模拟人工操作间隔 */
export const REQUEST_DELAY_RANGE = { min: 200, max: 800 };

/** 时间过滤阈值：用于过滤RSI数据的时间范围 */
export const TIME_FILTER_THRESHOLDS = {
  SHORT_TERM_MAX: 5000, // 短期回测最大分钟数
  REAL_TIME_MAX: 4,     // 实时数据最大分钟数
  REAL_TIME_MIN: -6,    // 实时数据最小分钟数
  DAY_MAX: 6000,        // 日线数据最大分钟数
  DAY_MIN: -5           // 日线数据最小分钟数
};

/** 富途API请求固定参数 */
export const FUTU_FIXED_PARAMS = {
  marketType: '4',
  type: '2',
  marketCode: '35',
  instrumentType: '3',
  subInstrumentType: '3002',
  endTimestamp: "1767110400000" // 2025-12-31 00:00:00
};

// 静态配置，美股时间现在通过getUSMarketHours动态获取
export const MarketCloseHour = {
  [EStockType.A]: 15,
  [EStockType.HK]: 16,
  [EStockType.US]: 4,  // 这个值现在动态计算，保留作为默认值
} 

export const MarketOpenSetting = {
 [EStockType.A]: {
  marketOpenHour: '09:25',
  marketCloseHour: '15:00',
 },
 [EStockType.HK]: {
  marketOpenHour: '09:25',
  marketCloseHour: '16:00',
 },
 [EStockType.US]: {
  marketOpenHour: '22:30',  // 这个值现在动态计算，保留作为默认值
  marketCloseHour: '05:00', // 更新为非夏令时的收盘时间作为默认值
 },
} 


export const RSIThresholds = {
  [EStockType.A]: {
    [EKLT['5M']]: {
      buy: 20,
      mustBuy: 15,
      sell: 85,
      mustSell: 90 
    },
    [EKLT['15M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
    [EKLT['30M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
    [EKLT['60M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
    [EKLT['DAY']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 80
    }
  },
  [EStockType.HK]: {
    [EKLT['5M']]: {
      buy: 20,
      mustBuy: 15,
      sell: 85,
      mustSell: 90 
    },
    [EKLT['15M']]: { 
      buy: 20,
      mustBuy: 15,
      sell: 80,
      mustSell: 90
    },
    [EKLT['30M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
     [EKLT['60M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
  [EKLT['DAY']]: { 
      buy: 20,
      mustBuy: 15,
      sell: 75,
      mustSell: 80 
    }
  },
  [EStockType.US]: {
    [EKLT['5M']]: {
      buy: 20,
      mustBuy: 15,
      sell: 80,
      mustSell: 90
    },
    [EKLT['15M']]: { 
      buy: 20,
      mustBuy: 15,
      sell: 80,
      mustSell: 90
    },
    [EKLT['30M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
    [EKLT['60M']]: { 
      buy: 28,
      mustBuy: 20,
      sell: 75,
      mustSell: 85 
    },
    [EKLT['DAY']]: { 
      buy: 20,
      mustBuy: 15,
      sell: 80,
      mustSell: 85
    }
  }
}


export enum ERSISuggestion {
  MUST_BUY = '立即买入🚀',
  BUY = '建议买入🔥',
  MUST_SELL = '立即卖出😱',
  SELL = '建议卖出🚨'
}

// 计算准确的RSI需要拉取前面几天的数据
export const PrePullDayConfig = {
    [EStockType.A]: {
        [EKLT['5M']]: 7,
        [EKLT['15M']]: 40,// 检查正确 至少 15条数据
        // [EKLT['DAY']]: 90,// 最新的几天准确，距离越长不准确
        [EKLT['30M']]: 40,
        [EKLT['60M']]: 40,
        [EKLT['DAY']]: 180,// 最新的几天准确，距离越长不准确; 需要考虑筹码集中度，官方传入的是210
    },
    [EStockType.HK]: {
        [EKLT['5M']]: 7, // 检查正确
        [EKLT['15M']]: 14, // 检查正确
        [EKLT['30M']]: 40,
        [EKLT['60M']]: 40,
        [EKLT['DAY']]: 90,// 不正确
    },
    [EStockType.US]: {
        [EKLT['5M']]: 7,
        [EKLT['15M']]: 14,
        [EKLT['30M']]: 40,
        [EKLT['60M']]: 40,
        [EKLT['DAY']]: 90,
    },
}

export enum EFQT  {
  BU_FU_QUAN = 0,
  QIAN_FU_QUAN = 1,
  HOU_FU_QUAN = 2,

}

export enum EReqType  {
  'EASY_MONEY' = 'EASY_MONEY',
  'FU_TU' = 'FU_TU'
}


export const EFutuFetchUrl = {
  [EKLT["5M"]]: 'https://www.futunn.com/quote-api/quote-v2/get-quote-minute', // 选中“5日”，查看分时线
  [EKLT["15M"]]: 'https://www.futunn.com/quote-api/quote-v2/get-quote-minute', // 选中“5日”，查看分时线
  [EKLT["30M"]]: 'https://www.futunn.com/quote-api/quote-v2/get-quote-minute', // 选中“5日”，查看分时线
  [EKLT["60M"]]: 'https://www.futunn.com/quote-api/quote-v2/get-quote-minute', // 选中“5日”，查看分时线
  [EKLT.DAY]: 'https://www.futunn.com/quote-api/quote-v2/get-kline', //选中“日K”, 查看日线 
}

// ================================= 常量定义 =================================

/**
 * 判断给定日期是否为美股夏令时
 * 夏令时：每年3月第二个周日 02:00 开始，至11月第一个周日 02:00 结束
 * @param date 要判断的日期，默认为当前日期
 * @returns 是否为夏令时
 */
export const isDST = (date: dayjs.Dayjs = dayjs()): boolean => {
  const year = date.year();
  
  // 计算3月第二个周日（夏令时开始）
  const march = dayjs(`${year}-03-01`);
  let marchFirstSunday = march.day(0); // 获取3月第一个周日
  // 如果3月1日之后才是第一个周日，则需要调整
  if (marchFirstSunday.month() < 2) {
    marchFirstSunday = marchFirstSunday.add(7, 'days');
  }
  const dstStart = marchFirstSunday.add(7, 'days'); // 第二个周日
  
  // 计算11月第一个周日（夏令时结束）
  const november = dayjs(`${year}-11-01`);
  let novemberFirstSunday = november.day(0); // 获取11月第一个周日
  // 如果11月1日之后才是第一个周日，则需要调整
  if (novemberFirstSunday.month() < 10) {
    novemberFirstSunday = novemberFirstSunday.add(7, 'days');
  }
  
  // 判断当前日期是否在夏令时范围内（包含开始日，不包含结束日）
  return date.isSameOrAfter(dstStart, 'day') && date.isBefore(novemberFirstSunday, 'day');
};

/**
 * 获取美股当前的开盘收盘时间（北京时间）
 * @param date 要判断的日期，默认为当前日期
 * @returns 开盘收盘时间配置
 */
export const getUSMarketHours = (date: dayjs.Dayjs = dayjs()) => {
  if (isDST(date)) {
    // 夏令时：21:30-04:00（次日）
    return {
      openHour: 21,
      openMinute: 30,
      closeHour: 4,
      closeMinute: 0,
      openTimeStr: '21:30',
      closeTimeStr: '04:00'
    };
  } else {
    // 标准时间：22:30-05:00（次日）
    return {
      openHour: 22,
      openMinute: 30,
      closeHour: 5,
      closeMinute: 0,
      openTimeStr: '22:30',
      closeTimeStr: '05:00'
    };
  }
};



/**
 * 创建批次数组：将股票列表分割成多个批次
 * @param stockLists 股票列表
 * @returns 批次数组
 */
export const createBatches = <T>(stockLists: T[]): T[][] => {
  const batches: T[][] = [];
  for (let i = 0; i < stockLists.length; i += BATCH_SIZE) {
    batches.push(stockLists.slice(i, i + BATCH_SIZE));
  }
  return batches;
};

/**
 * 创建东方财富API请求
 * @param stockId 股票ID
 * @param userToken 用户token
 * @param klt K线类型
 * @param startFormatDay 开始日期
 * @param headers 请求头
 * @returns axios请求Promise
 */
export const createEastmoneyRequest = (
  stockId: string,
  userToken: string,
  klt: number,
  startFormatDay: string,
  headers: Record<string, string>
) => {
  const reqUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${stockId}&ut=${userToken}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=${EFQT.QIAN_FU_QUAN}&beg=${startFormatDay}&end=20500000`;
  
  return axios.get(reqUrl, {
    headers,
    timeout: REQUEST_TIMEOUT,
  });
};

/**
 * 创建富途API请求
 * @param stockInfo 股票信息
 * @param klt K线类型
 * @returns fetch请求Promise
 */
export const createFutuRequest = (stockInfo: IFutuStockInfo, klt: EKLT) => {
  const params = new URLSearchParams({
    stockId: String(stockInfo.stockId),
    ...FUTU_FIXED_PARAMS,
    _: FUTU_FIXED_PARAMS.endTimestamp
  });

  const headers = new Headers({
    'method': 'GET',
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8,es;q=0.7,ar;q=0.6',
    'cache-control': 'no-cache',
    'cookie': 'csrfToken=TRsApBujOa7ZD70O7cppI1zR; locale=zh-cn; locale.sig=ObiqV0BmZw7fEycdGJRoK-Q0Yeuop294gBeiHL1LqgQ; cipher_device_id=1749285145821143; device_id=1749285145821143; Hm_lvt_f3ecfeb354419b501942b6f9caf8d0db=1749044380,1749285146; HMACCOUNT=ED9FEDB1351799C4; futu-csrf=W5OD5PP2oCnJbDm9rRPGrjezPgc=; _gid=GA1.2.1625938493.1749285147; _ga_25WYRC4KDG=GS2.1.s1749294322$o2$g0$t1749294337$j45$l0$h0; Hm_lpvt_f3ecfeb354419b501942b6f9caf8d0db=1749295234; _gat_UA-71722593-3=1; _ga=GA1.1.792543118.1749285147; _ga_XECT8CPR37=GS2.1.s1749294322$o2$g1$t1749295235$j60$l0$h0; _ga_370Q8HQYD7=GS2.2.s1749294324$o2$g1$t1749295235$j60$l0$h0; _ga_EJJJZFNPTW=GS2.1.s1749294323$o2$g1$t1749295235$j60$l0$h0; ftreport-jssdk%40session={%22distinctId%22:%22ftv16wScUGFvhQ+J7+mpTN2oN5WHbhTplo+rBzP+mH1aG5W5vyR1xOONgSbv1b6WtWGf%22%2C%22firstId%22:%22ftv1iyS3E3VMM+8rLKzjshyBvjOGoYYMdkRc/GJ4BAZP8DGR+sVl1pAtlVqra01qHAR9%22%2C%22latestReferrer%22:%22https://www.futunn.com/%22}',
    'futu-x-csrf-token': 'TRsApBujOa7ZD70O7cppI1zR',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'quote-token': stockInfo.quoteToken,
    'referer': 'https://www.futunn.com/stock/KNW-US?chain_id=_JZb7-E8Xbh33r.1k48841&global_content=%7B%22promote_id%22%3A13766,%22sub_promote_id%22%3A2,%22f%22%3A%22nn%2Fquote%22%7D',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
  });

  const futuFetchUrl = EFutuFetchUrl[klt];
  if (!futuFetchUrl) {
    throw new Error(`未找到对应的富途API URL: klt=${klt}`);
  }

  return fetch(`${futuFetchUrl}?${params}`, {
    method: 'GET',
    headers: headers,
    mode: 'cors',
    credentials: 'include',
  }).then(response => {
    if (!response.ok) {
      throw new Error(`富途API请求失败：状态码 ${response.status}`);
    }
    return response.json();
  });
};

/**
 * 处理富途数据：过滤并格式化K线数据
 * @param eastmoneyData API响应数据
 * @param stockLists 股票列表
 * @returns 格式化后的股票数据
 */
export const processFutuData = (eastmoneyData: unknown, stockLists: (string | IFutuStockInfo)[]): IStockData => {
  const findStockIndex = stockLists.findIndex((stockItem: string | IFutuStockInfo) => 
    typeof stockItem === 'object' && stockItem.stockId === (eastmoneyData as IFutuApiResponse)?.data?.stockId
  );
  
  if (findStockIndex === -1) {
    throw new Error(`未找到对应股票信息: stockId=${(eastmoneyData as IFutuApiResponse)?.data?.stockId}`);
  }

  const targetStock = stockLists[findStockIndex] as IFutuStockInfo;
  
  // 过滤并格式化K线数据：只保留交易时间内的数据，且分钟为0,15,30,45
  const klines = ((eastmoneyData as IFutuApiResponse)?.data?.list || [])
    .filter((item) => {
      // 时间戳可能是秒或毫秒格式，统一转换为毫秒
      const timestamp = String(item.time).length === 10 ? item.time * 1000 : item.time;
      const hour = dayjs(timestamp).hour();
      const minute = dayjs(timestamp).minute();
      
      // 交易时间过滤：9:30-15:00
      if (hour < 9 || hour > 15) return false;
      if (hour === 9 && minute < 30) return false;
      if (hour === 15 && minute > 0) return false;
      
      // 分钟过滤：只保留整点分钟数据
      return [0, 15, 30, 45].includes(minute);
    })
    .map((item) => {
      // 转换为东方财富格式的K线数据字符串
      const timestamp = String(item.time).length === 10 ? item.time * 1000 : item.time;
      const timeStr = dayjs(timestamp).format('YYYY-MM-DD HH:mm');
      
      return [
        timeStr,
        item.open,
        item.cc_price, 
        item.high,
        item.low,
        item.volume,
        item.turnover,
        item.amplitude,
        item.change,
        item.ratio,
        item.turnoverRate
      ].join(',');
    });

  return {
    code: targetStock.stockCode,
    market: 4,
    name: targetStock.name,
    decimal: 2,
    dktotal: 3730,
    preKPrice: 257.1,
    klines
  };
};

/**
 * 计算筹码集中度变化：分析近三天筹码集中度是否呈上升趋势
 * @param RSIData RSI数据
 * @returns 是否筹码集中度上升
 */
export const calculateChipConcentration = (RSIData: IRSICalculationData): boolean => {
  try {
    // 使用深拷贝避免修改原数据，修复构造函数参数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculator = new (CYQCalculator as any)(
      JSON.parse(JSON.stringify(RSIData?.full_klines)), 
      500,  // accuracyFactor: 精度因子，使用500提高计算精度
      90    // range: 计算范围，使用90天
    );
    
    // 计算最近三天的筹码集中度
    const todayResult = calculator.calc(RSIData?.full_klines?.length - 1);
    const yesterdayResult = calculator.calc(RSIData?.full_klines?.length - 2);
    const dayBeforeResult = calculator.calc(RSIData?.full_klines?.length - 3);

    // 获取90%筹码集中度并转换为百分比
    const todayConcentration = (todayResult?.percentChips?.['90']?.concentration ?? 0) * 100;
    const yesterdayConcentration = (yesterdayResult?.percentChips?.['90']?.concentration ?? 0) * 100;
    const dayBeforeConcentration = (dayBeforeResult?.percentChips?.['90']?.concentration ?? 0) * 100;

    // 判断是否连续上升
    return todayConcentration >= yesterdayConcentration && 
           yesterdayConcentration >= dayBeforeConcentration;
  } catch (error) {
    console.warn('筹码集中度计算失败:', error);
    return false;
  }
};

/**
 * 计算价格变化和趋势信息
 * @param RSIData RSI数据
 * @param stockType 股票类型
 * @param klt K线类型
 * @returns 价格变化数据
 */
export const calculatePriceChangeData = (RSIData: IRSICalculationData, stockType: EStockType, klt: EKLT): IPriceChangeData => {
  const closeTimeMap: Record<string, number> = {};
  const priceChangeData: IPriceChangeData = { priceChange: {}, tradeDirection: {} };

  return RSIData?.full_klines.reduce((acc: IPriceChangeData, kline: IKlineItem, index: number) => {
    const time = dayjs(kline?.date).format('YYYY-MM-DD HH:mm');
    const hour = dayjs(kline?.date).hour();
    const minute = dayjs(kline?.date).minute();
    
    // 动态获取美股收盘时间
    let closeHourConfig: number;
    if (stockType === EStockType.US) {
      const klineDate = dayjs(kline?.date);
      closeHourConfig = getUSMarketHours(klineDate).closeHour;
    } else {
      closeHourConfig = MarketCloseHour[stockType];
    }

    // 记录收盘价格
    if (hour === closeHourConfig && minute === 0) {
      closeTimeMap[time] = kline.close;
    }

    const closeTimeMapDates = Object.keys(closeTimeMap);

    if (closeTimeMapDates.length > 0) {
      // 计算相对于前一天的价格变化
      const previousTime = dayjs(closeTimeMapDates[closeTimeMapDates.length - 1]).format('YYYY-MM-DD HH:mm');
      const previousClose = closeTimeMap[previousTime];
      
      if (previousClose) {
        const priceChange = (kline.close - previousClose) / previousClose;
        acc.priceChange[time] = (priceChange * 100).toFixed(2);

        // 计算前两天的趋势方向
        if (closeTimeMapDates.length >= 2) {
          const twoDaysAgoTime = dayjs(closeTimeMapDates[closeTimeMapDates.length - 2]).format('YYYY-MM-DD HH:mm');
          const twoDaysAgoClose = closeTimeMap[twoDaysAgoTime];
          if (twoDaysAgoClose) {
            acc.tradeDirection[time] = Number(previousClose) > Number(twoDaysAgoClose);
          }
        }
      }

      // 处理最后一个数据点
      const isLastIndex = index === RSIData?.full_klines.length - 1;
      if (previousClose && isLastIndex) {
        const isMarketClosed = stockType === EStockType.US 
          ? dayjs().isAfter(dayjs().hour(getUSMarketHours().closeHour))
          : dayjs().isAfter(dayjs().hour(closeHourConfig));
        const diffTime = isMarketClosed ? 2 : 1;
        
        if (closeTimeMapDates.length >= diffTime) {
          const compareTime = dayjs(closeTimeMapDates[closeTimeMapDates.length - diffTime]).format('YYYY-MM-DD HH:mm');
          const compareClose = closeTimeMap[compareTime];
          const priceChange = (kline.close - compareClose) / compareClose;
          acc.priceChange[time] = (priceChange * 100).toFixed(2);

          // 更新趋势方向
          if (closeTimeMapDates.length >= diffTime + 1) {
            const twoDaysCompareTime = dayjs(closeTimeMapDates[closeTimeMapDates.length - (diffTime + 1)]).format('YYYY-MM-DD HH:mm');
            const twoDaysCompareClose = closeTimeMap[twoDaysCompareTime];
            acc.tradeDirection[time] = Number(compareClose) > Number(twoDaysCompareClose);
          }
        }
      }
    }

    // 日线数据特殊处理：使用成交量替代价格变化
    if (klt === EKLT.DAY) {
      acc.priceChange[time] = String(kline.volume);
    }

    return acc;
  }, priceChangeData);
};

/**
 * 处理RSI数据时间过滤
 * @param diffInMinutes 时间差（分钟）
 * @param klt K线类型
 * @param isBacktesting 是否回测模式
 * @returns 是否应该过滤掉此数据
 */
export const shouldFilterByTime = (diffInMinutes: number, klt: EKLT, isBacktesting: boolean): boolean => {
  // 短期K线数据过滤（5分钟、15分钟、30分钟）
  if (klt === EKLT["15M"] || klt === EKLT["5M"] || klt === EKLT["30M"] || klt === EKLT["60M"]) {
    if (isBacktesting) {
      // 回测模式：保留近3天的数据
      return diffInMinutes > TIME_FILTER_THRESHOLDS.SHORT_TERM_MAX;
    } else {
      // 实时模式：只保留最近几分钟的数据
      return diffInMinutes > TIME_FILTER_THRESHOLDS.REAL_TIME_MAX || 
             diffInMinutes < TIME_FILTER_THRESHOLDS.REAL_TIME_MIN;
    }
  }

  // 日线数据过滤：保留近3天内的数据
  if (klt === EKLT["DAY"]) {
    return diffInMinutes > TIME_FILTER_THRESHOLDS.DAY_MAX || 
           diffInMinutes < TIME_FILTER_THRESHOLDS.DAY_MIN;
  }

  return false;
};

/**
 * 处理RSI建议逻辑
 * @param rsiValue RSI值
 * @param rsiThresholds RSI阈值配置
 * @param stockCode 股票代码
 * @param klt K线类型
 * @param isBacktesting 是否回测模式
 * @returns RSI建议类型，如果不符合任何条件返回null
 */
interface IRSIThresholds {
  buy: number;
  mustBuy: number;
  sell: number;
  mustSell: number;
}

export const processRSISuggestion = (
  rsiValue: number,
  rsiThresholds: IRSIThresholds,
  stockCode: string,
  klt: EKLT,
  isBacktesting: boolean
): ERSISuggestion | null => {
  // 买入建议
  if (rsiValue <= rsiThresholds.mustBuy) {
    return ERSISuggestion.MUST_BUY;
  } else if (rsiValue <= rsiThresholds.buy) {
    return ERSISuggestion.BUY;
  }

  // 卖出建议（回测模式不需要卖出信息）
  if (!isBacktesting) {
    // 15分钟K线不发送北交所和小费电子的卖出信号
    const isSpecialStock = klt === EKLT["15M"] && 
      [...a_beijiaosuo, ...a_xiaofeidianzi].some(item => item.includes(stockCode));
    
    if (!isSpecialStock) {
      if (rsiValue >= rsiThresholds.mustSell) {
        return ERSISuggestion.MUST_SELL;
      } else if (rsiValue >= rsiThresholds.sell) {
        return ERSISuggestion.SELL;
      }
    }
  }

  return null;
};

/**
 * 获取股票名称：从stockId或stockInfo中提取股票名称
 * @param stockId 股票ID或股票信息对象
 * @param reqType 请求类型
 * @returns 股票名称
 */
export const getStockName = (stockId: string | IFutuStockInfo, reqType: EReqType): string => {
  if (reqType === EReqType.EASY_MONEY) {
    return stockId as string;
  } else {
    return (stockId as IFutuStockInfo).name || `Unknown-${(stockId as IFutuStockInfo).stockId}`;
  }
};

/**
 * 获取股票标识：从stockId或stockInfo中提取股票标识
 * @param stockId 股票ID或股票信息对象
 * @param reqType 请求类型
 * @returns 股票标识
 */
export const getStockIdentifier = (stockId: string | IFutuStockInfo, reqType: EReqType): string | number => {
  if (reqType === EReqType.EASY_MONEY) {
    return stockId as string;
  } else {
    return (stockId as IFutuStockInfo).stockId;
  }
};

/**
 * 获取简洁的错误信息
 * @param error 错误对象
 * @returns 简洁的错误描述
 */
export const getSimplifiedErrorMessage = (error: unknown): { type: string; message: string } => {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      return { type: 'TIMEOUT', message: '请求超时' };
    } else if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return { type: 'NETWORK', message: '网络错误' };
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return { type: 'FORBIDDEN', message: '访问被拒绝' };
    } else if (error.message.includes('404') || error.message.includes('Not Found')) {
      return { type: 'NOT_FOUND', message: '资源未找到' };
    } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      return { type: 'SERVER_ERROR', message: '服务器内部错误' };
    } else if (error.message.includes('rate limit') || error.message.includes('Too Many Requests')) {
      return { type: 'RATE_LIMIT', message: '请求频率限制' };
    } else {
      return { type: 'API_ERROR', message: error.message.substring(0, 100) };
    }
  } else if (typeof error === 'string') {
    return { type: 'UNKNOWN', message: error.substring(0, 100) };
  } else {
    return { type: 'UNKNOWN', message: '未知错误' };
  }
};

/**
 * 生成邮件内容HTML表格
 * @param buyList 买入列表
 * @param sellList 卖出列表
 * @returns HTML表格字符串
 */
export const generateEmailTables = (buyList: IEmailListItem[], sellList: IEmailListItem[]): string => {
  const tableStyle = "border-collapse: collapse";
  const thStyle = "border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: center";
  const tdStyle = "text-align: center;";

  const createTable = (list: IEmailListItem[], suggestionType: '买入' | '卖出') => {
    if (list.length === 0) return '';
    
    const rows = list.map((item: IEmailListItem) => {
      const itemStr = typeof item === 'string' ? item : String(item);
      const cells = itemStr.split('</td><td>').map((cell: string) => `<td style="${tdStyle}">${cell}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    return `<table style="${tableStyle}">
      <tr>
        <th style="${thStyle}">时间</th>
        <th style="${thStyle}">指标</th>
        <th style="${thStyle}">名字</th>
        <th style="${thStyle}">RSI值</th>
        <th style="${thStyle}">${suggestionType}建议</th>
      </tr>
      ${rows}
    </table>`;
  };

  return `${createTable(buyList, '买入')}${createTable(sellList, '卖出')}`;
};


 // 使用正则表达式解析RSI数据字符串
 export const getTimeMatch = (rsiDataStr: string) => rsiDataStr.match(/\[([^\]]+)\]/)
 export const getNameMatch = (rsiDataStr: string) =>  rsiDataStr.match(/\]\s*(.+?)\s+(\d+\.?\d*)\s+\[/)
 export const getRsiMatch = (rsiDataStr: string) =>  rsiDataStr.match(/\]\s*[^0-9]*(\d+\.?\d*)\s+\[/)
 export const getPriceChangeMatch = (rsiDataStr: string) =>  rsiDataStr.match(/\[([^%\]]*%?)\]/)
 export const getSuggestionMatch = (rsiDataStr: string) =>  rsiDataStr.match(/➜\s*([^➜]*?)(?:\s+today:|$)/)
 export const getBacktestMatch = (rsiDataStr: string) =>  rsiDataStr.match(/today:\s*([^next]+?)(?:\s+next:|$)/)


 export enum EGlodCrossType {
  FISRT_GOLDEN_CROSS= '首次金叉',
  LATEST_GOLDEN_CROSS = '最近金叉',
  FISRT_GOLDEN_DOWN = '首次死叉',
  LATEST_GOLDEN_DOWN = '最近死叉'
 }

  export enum EMA55BreadType {
  FISRT_BREAK_THROUGH = '首次突破',
  LATEST_BREAK_THROUGH = '最近突破',
  FISRT_BREAK_DOWN = '首次跌破',
  LATEST_BREAK_DOWN = '最近跌破'
 }