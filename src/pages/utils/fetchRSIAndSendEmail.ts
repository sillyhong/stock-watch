import axios from "axios";
import { formatKlinesData } from "./formatKlines";
// import { GetConvert } from "@/modules/tools/indicator/old";
import { GetConvert } from "@/modules/tools/indicator/origin_old";
import dayjs, { Dayjs } from "dayjs";
import { EStockType, MarketType, EKLT, getEKLTDesc } from "../interface";
import { isTodayWorkday } from "./workday";
import { QQMail } from "./email";
import { StockLists } from "./stockList";
import { PrePullDayConfig } from "./config";
import { a_beijiaosuo } from "../data/astock/beijiaosuo";


export const MarketOpenSetting = {
 [EStockType.A]: {
  marketOpenHour: '09:30',
  marketCloseHour: '15:00',
 },
 [EStockType.HK]: {
  marketOpenHour: '09:30',
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

const prehandleFetch = async ({
  stockType,
  currentDate = dayjs(),
  sendEmail = true,
  klt
}: {
  stockType: EStockType,
  klt: number,
  currentDate?: Dayjs,
  sendEmail?: boolean
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
    return await fetchRSIAndSendEmail({
        stockLists: StockLists[klt as keyof typeof StockLists][stockType],
        currentDate,
        sendEmail,
        stockType,
        klt,
    });
}

export const fetchUSRSI = async (params: {  klt: number, currentDate?: Dayjs, sendEmail?: boolean }) => {
    return prehandleFetch({ stockType: EStockType.US, ...params });
}

export const fetchARSI = async (params: {  klt: number, currentDate?: Dayjs, sendEmail?: boolean }) => {
    return prehandleFetch({ stockType: EStockType.A, ...params });
}

export const fetchHKRSI = async (params: {  klt: number, currentDate?: Dayjs, sendEmail?: boolean }) => {
    return prehandleFetch({ stockType: EStockType.HK, ...params });
}


export const fetchRSIAndSendEmail = async ({
  stockLists = [],
  currentDate = dayjs(),
  sendEmail = true,
  stockType,
  klt = EKLT['15M'],
}: {
  stockLists: string[],
  stockType: EStockType,
  currentDate?: Dayjs,
  sendEmail?: boolean,
  klt: EKLT,
}) => {
      const targetRSIData: any[] =[]
      // 需要前6个周期的值，需要向前几天拉取数据
      const prePullDay = PrePullDayConfig[stockType][klt]
      const startFormatDay = dayjs(currentDate).subtract(prePullDay,'day').format('YYYYMMDD');
      // const endFormatDay = dayjs(currentDate).format('YYYYMMDD');
     
      const requests = stockLists.length > 0 ? stockLists.map(stockId =>  {
        const reqUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${stockId}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=${klt}&fqt=0&beg=${startFormatDay}&end=20500000`
        // console.log("🚀 ~ reqUrl:", reqUrl)
        return axios.get(reqUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
          }
        });
      }
        
      ) : [];
        const results = await Promise.all(requests);
        const kltDesc = getEKLTDesc(klt)
        let emailContent
        const buyList: any[] = [];
        const sellList: any[] = [];

        results?.forEach(eastmoneyData => {
          const sourceData = eastmoneyData?.data?.data;
          // console.log("🚀 ~ sourceData:", sourceData)
          const stockName = sourceData?.name;
          const market = sourceData?.market;
          const stockCode = sourceData?.code;
          const marketType = MarketType[market]

          const RSIData = formatKlinesData(sourceData);
          const fullKlinesData = GetConvert('RSI', RSIData.full_klines);
          // console.log("🚀 ~ stockName:",stockName, 'fullKlinesData:', fullKlinesData)
          const stockRSIData = fullKlinesData?.map(item => {
            const itemTime = dayjs(item[0]);
            // currentDate - itemTime
            const diffInMinutes = currentDate.diff(itemTime, 'minute');
            
            // 15min RSI 只保留0-5分钟内的数据
            if((klt === EKLT["15M"] || klt === EKLT["5M"]) && (diffInMinutes > 5 || diffInMinutes < -5)) {
                return
            }

            //3天内
            if(klt === EKLT["DAY"]  && (diffInMinutes > 6000 || diffInMinutes < -5)) {
              return
            }

            // console.log("🚀 ~ stockname:", stockName,'itemTime',dayjs(itemTime).format('YYYY-MM-DD HH:mm:ss'), 'currentDate',dayjs(currentDate).format('YYYY-MM-DD HH:mm:ss'), 'diffInMinutes',diffInMinutes, 'item',item)
            const rsiThresholds = RSIThresholds[stockType][klt]

            const stockLink = `https://quote.eastmoney.com/${marketType}${stockCode}.html?from=classic#fullScreenChart`;
            let suggestion = '';
            if (Number(item?.[1]) <= rsiThresholds.mustBuy) {
              suggestion = '立即买入🚀';
              buyList.push(`<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: green; text-decoration: none;">${stockName}</a></td><td>${item[1]}</td><td style="color: red;">${suggestion}</td></tr>`);
              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} ➜ 立即买入🚀`;
            } else if (Number(item?.[1]) <= rsiThresholds.buy) {
              suggestion = '建议买入🔥';
              buyList.push(`<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: green; text-decoration: none;">${stockName}</a></td><td>${item[1]}</td><td style="color: orange;">${suggestion}</td></tr>`);
              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} ➜ 建议买入🔥`;
            } else if (Number(item?.[1]) >= rsiThresholds.mustSell) {
              //15分钟 不发送北交所卖出
              if(klt === EKLT["15M"] && a_beijiaosuo.includes(stockCode)) return 

              suggestion = '立即卖出😱';
              sellList.push(`<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: red; text-decoration: none;">${stockName}</a></td><td>${item[1]}</td><td style="color: red;">${suggestion}</td></tr>`);
              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} ➜ 立即卖出😱`;
            } else if (Number(item?.[1]) >= rsiThresholds.sell) {
               //15分钟 不发送北交所卖出
               if(klt === EKLT["15M"] && a_beijiaosuo.includes(stockCode)) return 
              suggestion = '建议卖出🚨';
              sellList.push(`<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: red; text-decoration: none;">${stockName}</a></td><td>${item[1]}</td><td style="color: orange;">${suggestion}</td></tr>`);
              return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} ➜ 建议卖出🚨`;
            }

          })?.filter(item => !!item);

          targetRSIData.push(...stockRSIData);

        })
        if ((buyList?.length || sellList?.length) && sendEmail) {
          // Sort buyList: '立即买入🚀' should come first
          buyList.sort((a, b) => {
            if (a.includes('立即买入🚀') && !b.includes('立即买入🚀')) return -1;
            if (!a.includes('立即买入🚀') && b.includes('立即买入🚀')) return 1;
            return 0;
          });

          // Sort sellList: '立即卖出😱' should come first
          sellList.sort((a, b) => {
            if (a.includes('立即卖出😱') && !b.includes('立即卖出😱')) return -1;
            if (!a.includes('立即卖出😱') && b.includes('立即卖出😱')) return 1;
            return 0;
          });
          const tableStyle = "border-collapse: collapse";
          const thStyle = "border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: center";
          const tdStyle = "text-align: center;";
          
          const buyTable = buyList.length ? `<table style="${tableStyle}"><tr><th style="${thStyle}">时间</th><th style="${thStyle}">指标</th><th style="${thStyle}">名字</th><th style="${thStyle}">RSI值</th><th style="${thStyle}">买入建议</th></tr>${buyList.map(row => `<tr>${row.split('</td><td>').map(cell => `<td style="${tdStyle}">${cell}</td>`).join('')}</tr>`).join('')}</table>` : '';
          const sellTable = sellList.length ? `<table style="${tableStyle}"><tr><th style="${thStyle}">时间</th><th style="${thStyle}">指标</th><th style="${thStyle}">名字</th><th style="${thStyle}">RSI值</th><th style="${thStyle}">卖出建议</th></tr>${sellList.map(row => `<tr>${row.split('</td><td>').map(cell => `<td style="${tdStyle}">${cell}</td>`).join('')}</tr>`).join('')}</table>` : '';
          emailContent = `${buyTable}${sellTable}`;
          console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 发送邮件`, targetRSIData?.length);

          const mailOptions = {
            from: `[${stockType}][${kltDesc}]<1175166300@qq.com>`, // 发件人地址
            to: '1175166300@qq.com', // 收件人地址
            subject: dayjs(currentDate).format('YYYY-MM-DD HH:mm'), // 邮件主题
            text: emailContent, // 邮件内容
          };
    
          QQMail.sendMail(mailOptions, (error: any, info: any) => {
            if (error) {
              console.log(error);
              return;
            }
            console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] Message sent: ${info.messageId}`);
          });
         }
        return targetRSIData
    };