import { AStockList, AStockList_Futu_Token } from "../data/astock/astock"
import { a_bantaoti, a_bantaoti_futu_token } from "../data/astock/bandaoti"
import { a_beijiaosuo } from "../data/astock/beijiaosuo"
import { a_xiaofeidianzi, a_xiaofeidianzi_futu_token } from "../data/astock/xiaofeidanzi"
import { a_zhishu } from "../data/astock/zhishu"
import { EKLT, EStockType } from "../interface"


// 自选股 https://quote.eastmoney.com/zixuan/?from=home  (https://myfavor.eastmoney.com/v4/webouter/gstkinfos?appkey=e9166c7e9cdfad3aa3fd7d93b757e9b1&cb=jQuery37109098349407811925_1738471725338&g=1&_=1738471725340)
//热门股 https://quote.eastmoney.com/newapi/gethotgubalist


// https://quote.eastmoney.com/newapi/gethotgubalist_hk
export const HKStockList = [
    '116.00700', // 腾讯
    '116.01810', // 小米集团
    '116.09988', // 阿里巴巴-W
    '116.03690', // 美团-W
    '116.09868', // 小鹏汽车-W
    '116.02015', // 理想汽车-W
    '116.00981', // 中心国际
    '116.01347',// 华虹半导体
    '116.01918', // 融创中国 // todo 2.10 5分钟没推送
    '116.03896',// 金山云
    '116.02498', // 速腾聚创
    '116.06682', // 第四范式
    '116.01024',// 快手-W
    '116.06099',// 招商银行
    '116.06881',// 中国银河
    '116.02252',// 微创机器人-B
    '116.02013',// 微盟集团
    '116.09626',// 哔哩哔哩
    '116.02533',// 黑芝麻智能
  ]

// https://quote.eastmoney.com/newapi/gethotgubalist_us
export const USStockList = [
   '105.NVDA', // 英伟达
   '106.BABA', // 阿里爸爸
   '105.TSLA',// 特斯拉
   '105.MSFT',// 微软
   '106.XPEV',// '小鹏汽车'
   '105.META',//Meta Platforms Inc-A
   '105.PDD',//拼多多
   '105.GOOGL',// 谷歌-A
   '105.JD',//京东
   '105.BIDU',//百度
   '105.AMD',//超威半导体
   '105.AVGO',// 博通
]



export const EasyStockLists = {
  [EKLT["5M"]] : {
    [EStockType.A]: [...AStockList],
    [EStockType.HK]: HKStockList,
    [EStockType.US]: USStockList,
  },
  [EKLT["15M"]] : {
    // [EStockType.A]: [ ...AStockList, ...a_xiaofeidianzi, ...a_bantaoti, ...a_beijiaosuo],
    [EStockType.A]: [ ...AStockList, ...a_bantaoti, ...a_beijiaosuo],
    [EStockType.HK]: HKStockList,
    [EStockType.US]: USStockList,
  },
  [EKLT["DAY"]] : {
    [EStockType.A]: [...AStockList, ...a_xiaofeidianzi, ...a_bantaoti, ...a_beijiaosuo],
    [EStockType.HK]: HKStockList,
    [EStockType.US]: USStockList,
  },
} 

export const FutuStockLists = {
  [EKLT["5M"]] : {
    [EStockType.A]: [...AStockList_Futu_Token],
    [EStockType.HK]: [],//HKStockList,
    [EStockType.US]: [],//USStockList,
  },
  [EKLT["15M"]] : {
    // [EStockType.A]: [ ...AStockList, ...a_xiaofeidianzi_futu_token, ...a_bantaoti_futu_token, ...a_beijiaosuo],
    [EStockType.A]: [ ...AStockList_Futu_Token,  a_bantaoti_futu_token  ],
    [EStockType.HK]: [],//HKStockList,
    [EStockType.US]: [],//USStockList,
  },
  [EKLT["DAY"]] : {
    [EStockType.A]: [...AStockList_Futu_Token, a_xiaofeidianzi_futu_token, ...a_bantaoti_futu_token, ...a_xiaofeidianzi_futu_token],
    // [EStockType.A]: [...AStockList, ...a_xiaofeidianzi, ...a_bantaoti, ...a_beijiaosuo],
    [EStockType.HK]: [],//HKStockList,
    [EStockType.US]: [],//USStockList,
  },
} 

