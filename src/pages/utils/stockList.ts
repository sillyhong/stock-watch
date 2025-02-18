import { a_beijiaosuo } from "../data/astock/beijiaosuo"
import { a_xiaofeidianzi } from "../data/astock/xiaofeidanzi"
import { EKLT, EStockType } from "../interface"


// 自选股 https://quote.eastmoney.com/zixuan/?from=home  (https://myfavor.eastmoney.com/v4/webouter/gstkinfos?appkey=e9166c7e9cdfad3aa3fd7d93b757e9b1&cb=jQuery37109098349407811925_1738471725338&g=1&_=1738471725340)
//热门股 https://quote.eastmoney.com/newapi/gethotgubalist
export const AStockList = [
    //券商
    "0.872808",
    "0.873122",
    "0.300750",
    "1.600519",
    "0.300561",
    "0.300377",
    "0.300380",
    "0.300085", // 银之杰
    "0.002670",
    "0.300803",
    "0.300033", // 同花顺
    "0.300059",
    "0.300166", //东方国信

    //芯片
    "0.300913",
    "0.430139",
    "1.600171",
    "1.688709",
    "0.300077",
    "1.688981",
    "0.300046",
    "0.300223",
    "1.688525",
    "0.300769",
    "0.300068",
    "0.002654",

    //华为
    "0.830799",
    "0.300433",
    "0.300468",
    "0.300058",
    "0.300010",
    "0.002607",
    "0.300192",
    "1.600661",
    "1.688609",
    "0.002261",
    "0.301236",
    "0.301337",
    "0.300339",
    "0.000158",

    // AI
    "0.000681",
    "0.300242",
    "0.300071",
    "0.833533",
    "0.839493",
    "0.300290",
    "0.000628",
    "0.002229",
    "0.300624",
    "0.300418",
    "0.300622",
    "0.300781",
    "0.300364",
    "0.300795",
    "0.300063",
    "1.603108",

    // 光电
    '0.834770', //艾能聚',


    // 护盘
    "1.601857",
    "0.834021",
    "1.600696",
    "1.600792",
    "1.601898",

    // 连跌
    "0.301517",
    "0.002085",
    "0.301568",
    "0.300469",
    "1.601127",
    "1.603099",
    "0.002995"
]

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
    '116.02252',// 微创机器人-B
    '116.02013',// 微盟集团
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



export const StockLists = {
  [EKLT["5M"]] : {
    [EStockType.A]: AStockList,
    [EStockType.HK]: HKStockList,
    [EStockType.US]: USStockList,
  },
  [EKLT["15M"]] : {
    [EStockType.A]: [...AStockList, ...a_xiaofeidianzi,...a_beijiaosuo],
    [EStockType.HK]: HKStockList,
    [EStockType.US]: USStockList,
  },
  [EKLT["DAY"]] : {
    [EStockType.A]: AStockList,
    [EStockType.HK]: HKStockList,
    [EStockType.US]: USStockList,
  },
 } 


   // 自选
// "data": {
//         "stkinfolist": [{
//             "security": "90$BK1031$49315581307696",
//             "star": true,
//             "updatetime": 20230307071527,
//             "price": "2031.57"
//         }, {
//             "security": "90$BK0816$30234585776912",
//             "star": true,
//             "updatetime": 20200813101957,
//             "price": "--"
//         }, {
//             "security": "90$BK0815$30897056026400",
//             "star": true,
//             "updatetime": 20200907135458,
//             "price": "--"
//         }, {
//             "security": "90$BK0480$38214809314304",
//             "star": false,
//             "updatetime": 20241226235402,
//             "price": "42452.81"
//         }, {
//             "security": "90$BK1168$35849937633408",
//             "star": false,
//             "updatetime": 20241226183640,
//             "price": "1602.4"
//         }, {
//             "security": "90$BK1184$48821006100640",
//             "star": false,
//             "updatetime": 20241210085931,
//             "price": "1150.51"
//         }, {
//             "security": "1$000510$46665106113040",
//             "star": false,
//             "updatetime": 20241116222405,
//             "price": "4687.89"
//         }, {
//             "security": "90$BK0578$30351320014080",
//             "star": false,
//             "updatetime": 20241105065917,
//             "price": "2166.71"
//         }, {
//             "security": "90$BK0554$46216990082784",
//             "star": false,
//             "updatetime": 20240912083039,
//             "price": "8667.89"
//         }, {
//             "security": "90$BK1164$24769689315456",
//             "star": false,
//             "updatetime": 20240327083001,
//             "price": "1008.65"
//         }, {
//             "security": "90$BK1166$49731156494432",
//             "star": false,
//             "updatetime": 20240321141838,
//             "price": "1091.22"
//         }, {
//             "security": "90$BK0967$15858791692448",
//             "star": false,
//             "updatetime": 20240320205136,
//             "price": "774.98"
//         }, {
//             "security": "90$BK0910$38662734087264",
//             "star": false,
//             "updatetime": 20240308085203,
//             "price": "1898.07"
//         }, {
//             "security": "90$BK1158$47875596014992",
//             "star": false,
//             "updatetime": 20240229092412,
//             "price": "1175.7"
//         }, {
//             "security": "90$BK1046$21853254571856",
//             "star": false,
//             "updatetime": 20240228091713,
//             "price": "1028.97"
//         }, {
//             "security": "90$BK1090$19662110118368",
//             "star": false,
//             "updatetime": 20240226092748,
//             "price": "1091.6"
//         }, {
//             "security": "90$BK0714$23607030116992",
//             "star": false,
//             "updatetime": 20240222161436,
//             "price": "818.51"
//         }, {
//             "security": "90$BK0485$37702794426864",
//             "star": false,
//             "updatetime": 20240222090033,
//             "price": "12527.43"
//         }, {
//             "security": "90$BK0505$21161724825120",
//             "star": false,
//             "updatetime": 20240221134424,
//             "price": "6984.86"
//         }, {
//             "security": "90$BK1013$49236581313904",
//             "star": false,
//             "updatetime": 20230329104125,
//             "price": "1172.97"
//         }, {
//             "security": "90$BK0727$22263484480128",
//             "star": false,
//             "updatetime": 20230310141326,
//             "price": "1333.56"
//         }, {
//             "security": "90$BK0837$27035479702240",
//             "star": false,
//             "updatetime": 20230301231827,
//             "price": "903.81"
//         }, {
//             "security": "90$BK1126$30548274564064",
//             "star": false,
//             "updatetime": 20230207172220,
//             "price": "1267.44"
//         }, {
//             "security": "90$BK1036$49827596171360",
//             "star": false,
//             "updatetime": 20221117134433,
//             "price": "1277.78"
//         }, {
//             "security": "90$BK1104$32615738919904",
//             "star": false,
//             "updatetime": 20221019131938,
//             "price": "--"
//         }, {
//             "security": "90$BK1008$20750224803248",
//             "star": false,
//             "updatetime": 20221031215044,
//             "price": "--"
//         }, {
//             "security": "90$BK0987$39910108517632",
//             "star": false,
//             "updatetime": 20220701131125,
//             "price": "--"
//         }, {
//             "security": "90$BK0481$22916832504816",
//             "star": false,
//             "updatetime": 20220602134506,
//             "price": "--"
//         }, {
//             "security": "90$BK0433$31712305287008",
//             "star": false,
//             "updatetime": 20220601143400,
//             "price": "--"
//         }, {
//             "security": "90$BK1037$22577173300848",
//             "star": false,
//             "updatetime": 20220531130550,
//             "price": "--"
//         }, {
//             "security": "0$399995$34999247217424",
//             "star": false,
//             "updatetime": 20220526231131,
//             "price": "4257.97"
//         }, {
//             "security": "90$BK0978$19365972801280",
//             "star": false,
//             "updatetime": 20220511095418,
//             "price": "--"
//         }, {
//             "security": "90$BK0735$39592076002320",
//             "star": false,
//             "updatetime": 20220209094746,
//             "price": "--"
//         }, {
//             "security": "90$BK1009$40381416993760",
//             "star": false,
//             "updatetime": 20211220092931,
//             "price": "--"
//         }, {
//             "security": "90$BK0864$36481658902880",
//             "star": false,
//             "updatetime": 20211122090713,
//             "price": "--"
//         }, {
//             "security": "90$BK0494$21573286892048",
//             "star": false,
//             "updatetime": 20211117220914,
//             "price": "--"
//         }, {
//             "security": "90$BK0478$23097656815184",
//             "star": false,
//             "updatetime": 20211112094818,
//             "price": "--"
//         }, {
//             "security": "90$BK0438$31200290425552",
//             "star": false,
//             "updatetime": 20211104150541,
//             "price": "--"
//         }, {
//             "security": "90$BK0595$32930799222640",
//             "star": false,
//             "updatetime": 20211104124206,
//             "price": "--"
//         }, {
//             "security": "90$BK0883$40598666113040",
//             "star": false,
//             "updatetime": 20211020093404,
//             "price": "--"
//         }, {
//             "security": "90$BK0493$39558354882560",
//             "star": false,
//             "updatetime": 20211014114416,
//             "price": "--"
//         }, {
//             "security": "90$BK1004$39869402118800",
//             "star": false,
//             "updatetime": 20211014094221,
//             "price": "--"
//         }, {
//             "security": "90$BK0428$43225948837664",
//             "star": false,
//             "updatetime": 20210927090218,
//             "price": "--"
//         }, {
//             "security": "90$BK0479$38033984965696",
//             "star": false,
//             "updatetime": 20210909164136,
//             "price": "--"
//         }, {
//             "security": "90$BK0437$16050132515040",
//             "star": false,
//             "updatetime": 20210831144221,
//             "price": "--"
//         }, {
//             "security": "90$BK0711$36976234105456",
//             "star": false,
//             "updatetime": 20200918145726,
//             "price": "--"
//         }]
//     }
// });