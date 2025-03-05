import axios from "axios";
import { formatKlinesData } from "./formatKlines";
// import { GetConvert } from "@/modules/tools/indicator/old";
import { GetConvert } from "@/modules/tools/indicator/origin_old";
import dayjs, { Dayjs } from "dayjs";
import { EStockType, MarketType, EKLT, getEKLTDesc, IFetchUSRSIParams } from "../interface";
import { isTodayWorkday } from "./workday";
import { createEmailItem, QQMail } from "./email";
import { StockLists } from "./stockList";
import { ERSISuggestion, MarketCloseHour, PrePullDayConfig, RSIThresholds } from "./config";
import { a_beijiaosuo } from "../data/astock/beijiaosuo";
import { a_xiaofeidianzi } from "../data/astock/xiaofeidanzi";
import { backtestRSI } from "./backtrend";
import { normalSortByStockName, sortByStockName, sortListBySuggestion } from "./sort";
import { a_bantaoti } from "../data/astock/bandaoti";
import { formatPriceChange } from "./format";



const prehandleFetch = async ({
  stockType,
  currentDate = dayjs(),
  sendEmail = true,
  klt,
  isBacktesting = false
}: {
  stockType: EStockType,
  klt: number,
  currentDate?: Dayjs,
  sendEmail?: boolean,
  isBacktesting?: boolean
}) => {
    const checkWorkdayRes = isTodayWorkday(stockType, currentDate.toDate());

    // if(klt === 15) {
    //   if (!checkWorkdayRes) {
    //     console.warn(`[${stockType}] Today is not a workday`);
    //     return `[${stockType}] Today is not a workday`;
    //   }
    //   const marketSettings = MarketOpenSetting[stockType];
    //   if (!isMarketOpen(marketSettings.marketOpenHour, marketSettings.marketCloseHour, currentDate)) {
    //       console.warn(`[${stockType}] Market is currently closed`);
    //       return `[${stockType}] Market is currently closed`;
    //   }
    // }
  //  console.log('StockLists123', 'klt', klt, 'stockType', stockType,StockLists[klt as keyof typeof StockLists][stockType])
   try {
    return await fetchRSIAndSendEmail({
      stockLists: StockLists[klt as keyof typeof StockLists][stockType],
      currentDate,
      sendEmail,
      stockType,
      klt,
      isBacktesting,
    });
   } catch (error) {
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][$
    {stockType}][${klt}] error`, error)
   }
}

export const fetchUSRSI = async (params: IFetchUSRSIParams) => {
    return prehandleFetch({ stockType: EStockType.US, ...params });
}

export const fetchARSI = async (params: IFetchUSRSIParams) => {
    return prehandleFetch({ stockType: EStockType.A, ...params });
}

export const fetchHKRSI = async (params: IFetchUSRSIParams) => {
    return prehandleFetch({ stockType: EStockType.HK, ...params });
}


export const fetchRSIAndSendEmail = async ({
  stockLists = [],
  currentDate = dayjs(),
  sendEmail = true,
  stockType,
  klt = EKLT['15M'],
  isBacktesting = false
}: {
  stockLists: string[],
  stockType: EStockType,
  klt: EKLT,
  currentDate?: Dayjs,
  sendEmail?: boolean,
  isBacktesting?: boolean
}) => {
      let targetRSIData: any[] =[]
      // 需要前6个周期的值，需要向前几天拉取数据
      const prePullDay = PrePullDayConfig[stockType][klt]
      const startFormatDay = dayjs(currentDate).subtract(prePullDay,'day').format('YYYYMMDD');
      // const endFormatDay = dayjs(currentDate).format('YYYYMMDD');
     
      const requests = stockLists.length > 0 ? stockLists.map(stockId =>  {
        const reqUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${stockId}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f59&klt=${klt}&fqt=0&beg=${startFormatDay}&end=20500000`
        // console.log("🚀 ~ reqUrl:", reqUrl)
        return axios.get(reqUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
          },
          timeout: 120000, // 120s
        });
      }
        
      ) : [];
        const results = await Promise.all(requests);
        const kltDesc = getEKLTDesc(klt)
        let emailContent
        let buyList: any[] = [];
        const sellList: any[] = [];

        results?.forEach(eastmoneyData => {
          const sourceData = eastmoneyData?.data?.data;
          // console.log("🚀s ~ sourceData:", sourceData)
          const stockName = sourceData?.name;
          const market = sourceData?.market;
          const stockCode = sourceData?.code;
          const marketType = MarketType[market]

          const RSIData = formatKlinesData(sourceData);
          // console.log("🚀 ~ RSIData:", RSIData?.full_klines)
          let closeTimeMap: any = {}
          const priceChangeMap: any = RSIData?.full_klines.reduce((acc, kline) => {
            const time = dayjs(kline?.date).format('YYYY-MM-DD HH:mm'); // Format the time as needed
            const hour = dayjs(kline?.date).hour();
            const minute = dayjs(kline?.date).minute();
            const closeHourConfig = MarketCloseHour[stockType]
                //  console.log("🚀 ~ closePrices ~ minute:", {time, hour, minute, close: kline.close})
            if (hour === closeHourConfig && minute === 0) {
               closeTimeMap[time] = kline.close; // Save close price with time as key
            }

            const closeTimeMapDate = Object.keys(closeTimeMap)

            if(closeTimeMapDate) {
              const previewTime = dayjs(closeTimeMapDate[closeTimeMapDate?.length -1]).format('YYYY-MM-DD HH:mm')
              const previousClose = closeTimeMap[previewTime];
              if (previousClose) {
                const priceChange = (kline.close - previousClose) / previousClose;
                acc[time] = (priceChange * 100).toFixed(2); // Multiply by 100 and format to 2 decimal places
              }
            }

            if(klt === EKLT.DAY) {
              acc[time] = String(kline.volume); 
            }

            return acc;
          }, {});
        
          const fullKlinesData = GetConvert('RSI', RSIData.full_klines, { market, stockCode, stockName, kltDesc});
          const stockRSIData = fullKlinesData?.map(item => {
            const itemTime = dayjs(item[0]);
            const formatItemTime = dayjs(item[0]).format('YYYY-MM-DD HH:mm');
            //格式化涨跌百分比
            const currentPriceChange = formatPriceChange(priceChangeMap[formatItemTime])
            // currentDate - itemTime
            const diffInMinutes = currentDate.diff(itemTime, 'minute');
            let backtestingStr = ''
            // console.log("🚀 ~ stockname:", stockName,'itemTime',dayjs(itemTime).format('YYYY-MM-DD HH:mm:ss'), 'currentDate',dayjs(currentDate).format('YYYY-MM-DD HH:mm:ss'), 'diffInMinutes',diffInMinutes,)
          // console.log("🚀 ~ closePrices ~ priceChangeMap:", priceChangeMap[formatItemTime], 'formatItemTime',formatItemTime)
            
            // 15min RSI 只保留0-5分钟内的数据
            if((klt === EKLT["15M"] || klt === EKLT["5M"])) {
              if(isBacktesting) {// 接近三天
                if(diffInMinutes > 5000) return
              }else {
                // 9.30开始不能<-5，会把冗余数据返回
                if((diffInMinutes > 4 || diffInMinutes < -6)) return
              }
            }

            //3天内
            if(klt === EKLT["DAY"]  && (diffInMinutes > 6000 || diffInMinutes < -5)) {
              return
            }

            const sourceItem = RSIData?.full_klines?.find(item => dayjs(item?.date).isSame(itemTime, 'minute'));
            const rsiThresholds = RSIThresholds[stockType][klt]


            const stockLink = `https://quote.eastmoney.com/${marketType}${stockCode}.html?from=classic#fullScreenChart`;
            if (Number(item?.[1]) <= rsiThresholds.mustBuy) {
            
              if(isBacktesting) {
                const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType)
                const nextDayStr = `${backData?.nextdayPercentageProfit ? 'next: ' + backData?.nextdayPercentageProfit : ''}`
                backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr}`
              }
              buyList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.MUST_BUY, backtestingStr, currentPriceChange));

              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.MUST_BUY} ${backtestingStr}`;
            } else if (Number(item?.[1]) <= rsiThresholds.buy) {
              if(isBacktesting) {
                const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType)
                const nextDayStr = `${backData?.nextdayPercentageProfit ? 'next: ' + backData?.nextdayPercentageProfit : ''}`
                backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr} `
              }
             buyList.push(createEmailItem(item, kltDesc, stockLink, stockName,  ERSISuggestion.BUY, backtestingStr, currentPriceChange));

              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.BUY} ${backtestingStr}`;
            } else if (Number(item?.[1]) >= rsiThresholds.mustSell && !isBacktesting) { // 回测不需要卖出信息
              //15分钟 不发送北交所卖出
              if(klt === EKLT["15M"] && [...a_beijiaosuo,...a_xiaofeidianzi].some(item=> item.includes(stockCode))) return 
              sellList.push(createEmailItem(item, kltDesc, stockLink, stockName,  ERSISuggestion.MUST_SELL, '', currentPriceChange));
              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.MUST_SELL}`;
            } else if (Number(item?.[1]) >= rsiThresholds.sell && !isBacktesting) { // 回测不需要卖出信息
               //15分钟 不发送北交所卖出
              if(klt === EKLT["15M"] && [...a_beijiaosuo,...a_xiaofeidianzi].some(item=> item.includes(stockCode))) return
              sellList.push(createEmailItem(item, kltDesc, stockLink, stockName,  ERSISuggestion.SELL,'', currentPriceChange));
              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.SELL}`;
            }

          })?.filter(item => !!item);

          targetRSIData.push(...stockRSIData);

        })
        if ((buyList?.length || sellList?.length) && sendEmail) {
          sortListBySuggestion(buyList, ERSISuggestion.MUST_BUY);
          sortListBySuggestion(sellList, ERSISuggestion.MUST_SELL);
          // 重新根据stockName排在一起
         if(isBacktesting || klt === EKLT.DAY) {
          buyList = sortByStockName(buyList);
          normalSortByStockName(sellList)
         }
          const tableStyle = "border-collapse: collapse";
          const thStyle = "border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: center";
          const tdStyle = "text-align: center;";
          
          const buyTable = buyList.length ? `<table style="${tableStyle}"><tr><th style="${thStyle}">时间</th><th style="${thStyle}">指标</th><th style="${thStyle}">名字</th><th style="${thStyle}">RSI值</th><th style="${thStyle}">买入建议</th></tr>${buyList.map(row => `<tr>${row.split('</td><td>').map(cell => `<td style="${tdStyle}">${cell}</td>`).join('')}</tr>`).join('')}</table>` : '';
          const sellTable = sellList.length ? `<table style="${tableStyle}"><tr><th style="${thStyle}">时间</th><th style="${thStyle}">指标</th><th style="${thStyle}">名字</th><th style="${thStyle}">RSI值</th><th style="${thStyle}">卖出建议</th></tr>${sellList.map(row => `<tr>${row.split('</td><td>').map(cell => `<td style="${tdStyle}">${cell}</td>`).join('')}</tr>`).join('')}</table>` : '';
          emailContent = `${buyTable}${sellTable}`;

          const mailOptions = {
            from: `[${stockType}][${kltDesc}]<1175166300@qq.com>`, // 发件人地址
            to: '1175166300@qq.com', // 收件人地址
            subject: `${dayjs(currentDate).format('YYYY-MM-DD HH:mm')}${isBacktesting ? '回测' : ''}[${stockType}][${kltDesc}]`, // 邮件主题
            text: emailContent, // 邮件内容
          };
    
          QQMail.sendMail(mailOptions, (error: any, info: any) => {
            if (error) {
              console.log(error);
              return;
            }
          console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [${stockType}]${kltDesc}发送邮件`, targetRSIData?.length);
            // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Message sent: ${info.messageId}`);
          });
         }
        if(isBacktesting) {
          targetRSIData = sortByStockName(targetRSIData)
        }
        return targetRSIData
    };