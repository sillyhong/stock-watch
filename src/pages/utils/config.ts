import dayjs from "dayjs";
import { EKLT, EStockType } from "../interface"


export interface IFutuStockInfo {
  stockId: string,
  name: string,
  stockCode: string,
  quoteToken: string
}

export const MarketCloseHour = {
  [EStockType.A]: 15,
  [EStockType.HK]: 16,
  [EStockType.US]: 5,
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
  marketOpenHour: '22:30',
  marketCloseHour: '04:00',
 },
} 

const isMarketOpen = (marketOpenHour: string, marketCloseHour: string, currentDate: Dayjs): boolean => {
  const marketOpenTime = dayjs(`${currentDate.format('YYYY-MM-DD')} ${marketOpenHour}`, 'YYYY-MM-DD HH:mm:ss');
  // 延长5s
  let marketCloseTime = dayjs(`${currentDate.format('YYYY-MM-DD')} ${marketCloseHour}:05`, 'YYYY-MM-DD HH:mm:ss');

  // If the market close time is earlier than the open time, it means the market closes after midnight
  if (marketCloseTime.isBefore(marketOpenTime)) {
      marketCloseTime = marketCloseTime.add(1, 'day');
  }

  console.log("🚀 ~ isMarketOpen ~ currentDate:", currentDate.format('YYYY-MM-DD HH:mm:ss'), 'marketOpenTime:', marketOpenTime.format('YYYY-MM-DD HH:mm:ss'), 'marketCloseTime:', (currentDate.isAfter(marketOpenTime) || currentDate.isSame(marketOpenTime)), (currentDate.isBefore(marketCloseTime) || currentDate.isSame(marketCloseTime)));

  return (currentDate.isAfter(marketOpenTime) || currentDate.isSame(marketOpenTime)) && (currentDate.isBefore(marketCloseTime) || currentDate.isSame(marketCloseTime));
};

export const RSIThresholds = {
  [EStockType.A]: {
    [EKLT['5M']]: {
      buy: 20,
      mustBuy: 15,
      sell: 85,
      mustSell: 90 
    },
    [EKLT['15M']]: { 
      buy: 25,
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
        [EKLT['DAY']]: 180,// 最新的几天准确，距离越长不准确; 需要考虑筹码集中度，官方传入的是210
    },
    [EStockType.HK]: {
        [EKLT['5M']]: 7, // 检查正确
        [EKLT['15M']]: 14, // 检查正确
        [EKLT['DAY']]: 90,// 不正确
    },
    [EStockType.US]: {
        [EKLT['5M']]: 7,
        [EKLT['15M']]: 14,
        [EKLT['DAY']]: 30,
    },
}


export enum EReqType  {
  'EASY_MONEY' = 'EASY_MONEY',
  'FU_TU' = 'FU_TU'
}


export const EFutuFetchUrl = {
  [EKLT["5M"]]: 'https://www.futunn.com/quote-api/quote-v2/get-quote-minute', // 选中“5日”，查看分时线
  [EKLT["15M"]]: 'https://www.futunn.com/quote-api/quote-v2/get-quote-minute', // 选中“5日”，查看分时线
  [EKLT.DAY]: 'https://www.futunn.com/quote-api/quote-v2/get-kline', //选中“日K”, 查看日线 
}