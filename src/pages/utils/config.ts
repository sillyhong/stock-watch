import { EKLT, EStockType } from "../interface"

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


// 计算准确的RSI需要拉取前面几天的数据
export const PrePullDayConfig = {
    [EStockType.A]: {
        [EKLT['5M']]: 7,
        [EKLT['15M']]: 14,// 检查正确 至少 15条数据
        [EKLT['DAY']]: 90,// 最新的几天准确，距离越长不准确
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