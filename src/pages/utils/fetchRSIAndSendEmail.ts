import axios from "axios";
import { formatKlinesData } from "./formatKlines";
// import { GetConvert } from "@/modules/tools/indicator/old";
import { GetConvert } from "@/modules/tools/indicator/origin_old";
import dayjs, { Dayjs } from "dayjs";
import { EStockType, MarketType, EKLT, getEKLTDesc, IFetchUSRSIParams } from "../interface";
import { createEmailItem, QQMail } from "./email";
import { EasyStockLists, FutuStockLists } from "./stockList";
import { ERSISuggestion, MarketCloseHour, PrePullDayConfig, RSIThresholds, EReqType, IFutuStockInfo, EFutuFetchUrl } from "./config";
import { a_beijiaosuo, a_beijiaosuo_cn } from "../data/astock/beijiaosuo";
import { a_xiaofeidianzi } from "../data/astock/xiaofeidanzi";
import { backtestRSI } from "./backtrend";
import { normalSortByStockName, sortByStockName, sortListBySuggestion } from "./sort";
import { formatPriceChange } from "./format";
import { ACCEPT_LANGUAGES, ACCEPTS, COOKIES, getRandomUserAgent, getRandomUserToken, randomDelay, randomFromArray, randomIP, REFERERS, shuffleArray } from "./header";
import { CYQCalculator } from "@/modules/tools/indicator/cyq";



const prehandleFetch = async ({
  reqType = EReqType.EASY_MONEY,
  stockType,
  currentDate = dayjs(),
  sendEmail = true,
  klt,
  isBacktesting = false
}: {
  reqType?: EReqType,
  stockType: EStockType,
  klt: number,
  currentDate?: Dayjs,
  sendEmail?: boolean,
  isBacktesting?: boolean
}) => {
   try {
    return await fetchRSIAndSendEmail({
      reqType,
      stockLists: reqType === EReqType.EASY_MONEY ? EasyStockLists[klt][stockType] :  FutuStockLists[klt][stockType],
      currentDate,
      sendEmail,
      stockType,
      klt,
      isBacktesting,
    });
   } catch (error) {
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][$
    ${stockType}][${klt}] error`, error)
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
  reqType,
  stockLists = [],
  currentDate = dayjs(),
  sendEmail = true,
  stockType,
  klt = EKLT['15M'],
  isBacktesting = false
}: {
  reqType: EReqType,
  stockLists: string[] | IFutuStockInfo[],
  stockType: EStockType,
  klt: EKLT,
  currentDate?: Dayjs,
  sendEmail?: boolean,
  isBacktesting?: boolean
}) => {
  let targetRSIData: any[] = [];
  // 需要前6个周期的值，需要向前几天拉取数据
  const prePullDay = PrePullDayConfig[stockType][klt];
  const startFormatDay = dayjs(currentDate).subtract(prePullDay, 'day').format('YYYYMMDD');
  // const endFormatDay = dayjs(currentDate).format('YYYYMMDD');

  // 分批次，每批10个
  const BATCH_SIZE = 10;
  const batches: any[][] = [];
  for (let i = 0; i < stockLists.length; i += BATCH_SIZE) {
    batches.push(stockLists.slice(i, i + BATCH_SIZE));
  }

  const allResults: any[] = [];


  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    // 随机打乱本批次顺序
    // batch = shuffleArray(batch);

    // 每批次都用不同的userAgent/userToken
    const userAgent = getRandomUserAgent();
    const userToken = getRandomUserToken();

    // 随机头部
    const accept = randomFromArray(ACCEPTS);
    const acceptLanguage = randomFromArray(ACCEPT_LANGUAGES);
    const referer = randomFromArray(REFERERS);
    const cookie = randomFromArray(COOKIES);
    const xForwardedFor = randomIP();
    const xRealIp = randomIP();

    // 每个请求都可以有独立的延迟和头部
    const requests = batch.map(async stockId => {
      // 每个请求前随机延迟 200~800ms
      await randomDelay(200, 800);
      if(reqType === EReqType.EASY_MONEY) {
          // 每个请求可选独立userAgent/token/头部（也可以都用本批次的）
          const reqUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${stockId}&ut=${userToken}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${klt}&fqt=0&beg=${startFormatDay}&end=20500000`;
          // console.log('reqUrl123',reqUrl)
          return axios.get(reqUrl, {
            headers: {
              'User-Agent': userAgent,
              'Accept': accept,
              'Accept-Language': acceptLanguage,
              'Referer': referer,
              'Cookie': cookie,
              'Connection': 'keep-alive',
              'X-Forwarded-For': xForwardedFor,
              'X-Real-IP': xRealIp
            },
            timeout: 120000, // 120s
          });
      } else if(reqType === EReqType.FU_TU) {
        
        //futu这里的stockId是对象
        // 分时线和日线的参数完全一致，不需要单独提取
        const stockInfo: IFutuStockInfo = stockId as any
        const params = new URLSearchParams({
          stockId: stockInfo?.stockId,
          marketType: '4',
          type: '2', //获取5日的分钟线
          marketCode: '35',
          instrumentType: '3',
          subInstrumentType: '3002',
          _: "1767110400000" //2025-12-31 0:0:0  quoteToken: e212f7dc8e
        });
        const quoteToken = stockInfo?.quoteToken
        
        // 构造请求头（需包含所有浏览器发送的字段）
        const headers = new Headers({
          'method': 'GET',
          'accept': 'application/json, text/plain, */*',
          'accept-encoding': 'gzip, deflate, br, zstd',
          'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8,es;q=0.7,ar;q=0.6',
          'cache-control': 'no-cache',
          'cookie': 'csrfToken=TRsApBujOa7ZD70O7cppI1zR; locale=zh-cn; locale.sig=ObiqV0BmZw7fEycdGJRoK-Q0Yeuop294gBeiHL1LqgQ; cipher_device_id=1749285145821143; device_id=1749285145821143; Hm_lvt_f3ecfeb354419b501942b6f9caf8d0db=1749044380,1749285146; HMACCOUNT=ED9FEDB1351799C4; futu-csrf=W5OD5PP2oCnJbDm9rRPGrjezPgc=; _gid=GA1.2.1625938493.1749285147; _ga_25WYRC4KDG=GS2.1.s1749294322$o2$g0$t1749294337$j45$l0$h0; Hm_lpvt_f3ecfeb354419b501942b6f9caf8d0db=1749295234; _gat_UA-71722593-3=1; _ga=GA1.1.792543118.1749285147; _ga_XECT8CPR37=GS2.1.s1749294322$o2$g1$t1749295235$j60$l0$h0; _ga_370Q8HQYD7=GS2.2.s1749294324$o2$g1$t1749295235$j60$l0$h0; _ga_EJJJZFNPTW=GS2.1.s1749294323$o2$g1$t1749295235$j60$l0$h0; ftreport-jssdk%40session={%22distinctId%22:%22ftv16wScUGFvhQ+J7+mpTN2oN5WHbhTplo+rBzP+mH1aG5W5vyR1xOONgSbv1b6WtWGf%22%2C%22firstId%22:%22ftv1iyS3E3VMM+8rLKzjshyBvjOGoYYMdkRc/GJ4BAZP8DGR+sVl1pAtlVqra01qHAR9%22%2C%22latestReferrer%22:%22https://www.futunn.com/%22}', // 替换为完整Cookie
          'futu-x-csrf-token': 'TRsApBujOa7ZD70O7cppI1zR', // 新增字段（浏览器请求中存在）
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'quote-token': quoteToken, // 新增字段（浏览器请求中存在）
          'referer': 'https://www.futunn.com/stock/KNW-US?chain_id=_JZb7-E8Xbh33r.1k48841&global_content=%7B%22promote_id%22%3A13766,%22sub_promote_id%22%3A2,%22f%22%3A%22nn%2Fquote%22%7D', // 替换为实际Referer
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
        });
        const futuFetchUrl = EFutuFetchUrl[klt]
        // 每个请求可选独立userAgent/token/头部（也可以都用本批次的）
        // console.log('fetch123',`${futuFetchUrl}?${params}`)
        return fetch(`${futuFetchUrl}?${params}`, {
          method: 'GET',
          headers: headers,
          mode: 'cors', // 跨域模式（与浏览器一致）
          credentials: 'include', // 包含Cookie（若需要）
        }).then(response => {
          if (!response.ok) {
            throw new Error(`请求失败：状态码 ${response.status}`);
          }
          return response.json(); // 解析JSON响应
        })
      }
    });

    try {
      // console.log(`=====共 ${batchIdx+1}, 第${batchIdx}次开始, params: ${JSON.stringify({userAgent, userToken, accept, acceptLanguage, referer, cookie, xForwardedFor, xRealIp}, undefined, 2)}===`)
      // console.log(`=====共 ${batchIdx+1}, 第${batchIdx + 1}次开始===`)
      // 批次间随机sleep 1~2秒
      if (batchIdx > 0) await randomDelay(1500, 2000);

      const batchResults = await Promise.all(requests);
      allResults.push(...batchResults);
    } catch (err) {
      // 某一批次报错，直接抛弃这一批次的数据
      console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 第${batchIdx + 1}批次请求失败，跳过该批次`, err);
      // 不 push 任何数据
    }
  }

  const kltDesc = getEKLTDesc(klt);
  let emailContent;
  let buyList: any[] = [];
  const sellList: any[] = [];

  allResults?.forEach((eastmoneyData, index) => {
    if (!eastmoneyData) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}][${stockType}][${klt}] 请求 ${index} 失败`);
      return;
    }
    let sourceData = {}
    if(reqType === EReqType.EASY_MONEY) {
     sourceData = eastmoneyData?.data?.data;
    } else {
      const findStockIndex = stockLists.findIndex((stockItem: any) => stockItem.stockId === eastmoneyData?.data?.stockId)
      const targetStock: IFutuStockInfo =  stockLists[findStockIndex] as any
      // console.log('eastmoneyData123',eastmoneyData?.data)
      const klines = (eastmoneyData?.data?.list || [])
      .filter(item => {
        // item.time 可能是秒或毫秒
        const t = String(item.time).length === 10 ? item.time * 1000 : item.time;
        const hour = dayjs(t).hour();
        const minute = dayjs(t).minute();
        // 保留9:30到15:00范围内的数据，且分钟只能为0,15,30,45
        // 9:30 <= time <= 15:00
        if (hour < 9 || hour > 15) return false;
        if (hour === 9 && minute < 30) return false;
        if (hour === 15 && minute > 0) return false;
        return [0, 15, 30, 45].includes(minute);
      })
      .map(item => {
        // 东方财富格式: "2025-05-15 14:45,266.28,265.60,266.28,265.22,3910,103824368.00,0.40,-0.26,-0.68,0.14"
        // 假设item结构: { time, open, close, high, low, volume, turnover, amplitude, change, ratio, turnoverRate }
        // 你需要根据实际返回字段名调整下方属性
        const t = String(item.time).length === 10 ? item.time * 1000 : item.time;
        const timeStr = dayjs(t).format('YYYY-MM-DD HH:mm');
        // 兼容字段名，部分字段可能不存在
        return  [
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

      sourceData = {
        "code": targetStock?.stockCode,
        "market": 4,
        "name": targetStock.name,
        "decimal": 2,
        "dktotal": 3730,
        "preKPrice": 257.1,
        "klines": klines
      }
    }
    //eastmoneyData?.data?.data;
    // console.log("🚀s ~ sourceData:", sourceData)
    const market = sourceData?.market;
    const stockCode = sourceData?.code;
    let stockName = `${a_beijiaosuo_cn.includes(sourceData?.name) ? '[北]' + sourceData?.name : sourceData?.name}`;
    if (stockCode?.startsWith('300') || stockCode?.startsWith('688')) {
      stockName = `[创]${stockName}`;
    }
    const marketType = MarketType[market];

    const RSIData = formatKlinesData(sourceData);
    //比较近三天筹码集中度是否上升
    let isChipIncrease = false

    if(reqType === EReqType.EASY_MONEY && klt === EKLT.DAY) {
        // 设置筹码分布
        // @ts-ignore
        const cm1 = new CYQCalculator(JSON.parse(JSON.stringify(RSIData?.full_klines)))
        const todayCMResult = cm1.calc(RSIData?.full_klines?.length - 1)
        const yesterDayCMResult = cm1.calc(RSIData?.full_klines?.length - 2)
        const yesterBeforeDayCMResult = cm1.calc(RSIData?.full_klines?.length -3)
      

        //筹码集中度
        const todayChips = ((todayCMResult?.percentChips?.['90']?.concentration ?? 0) * 100).toFixed(3)
        const yesterdayChips = ((yesterDayCMResult?.percentChips?.['90']?.concentration ?? 0) * 100).toFixed(3)
        const yesterBeforeChips = ((yesterBeforeDayCMResult?.percentChips?.['90']?.concentration ?? 0) * 100).toFixed(3)
        if(todayChips >= yesterdayChips && yesterdayChips >= yesterBeforeChips) {
          isChipIncrease = true
        }
    }
    
    const closeTimeMap: any = {};
    const priceChangeMap: any = RSIData?.full_klines.reduce((acc: { priceChange: any, tradeDirection: any }, kline, index) => {
      const time = dayjs(kline?.date).format('YYYY-MM-DD HH:mm'); // Format the time as needed
      const hour = dayjs(kline?.date).hour();
      const minute = dayjs(kline?.date).minute();
      const closeHourConfig = MarketCloseHour[stockType];
      //  console.log("🚀 ~ closePrices ~ minute:", {time, hour, minute, close: kline.close})
      if (hour === closeHourConfig && minute === 0) {
        closeTimeMap[time] = kline.close; // Save close price with time as key
      }

      const closeTimeMapDate = Object.keys(closeTimeMap);

      if (closeTimeMapDate) {
        // 前一天
        const previewTime = dayjs(closeTimeMapDate[closeTimeMapDate?.length - 1]).format('YYYY-MM-DD HH:mm');
        const previousClose = closeTimeMap[previewTime];
        if (previousClose) {
          const priceChange = (kline.close - previousClose) / previousClose;
          acc.priceChange[time] = (priceChange * 100).toFixed(2); // Multiply by 100 and format to 2 decimal places

          // 前两天
          const previewTwoDayTime = dayjs(closeTimeMapDate[closeTimeMapDate?.length - 2]).format('YYYY-MM-DD HH:mm');
          const previewTwoDayClose = closeTimeMap[previewTwoDayTime];
          if (previewTwoDayClose) {
            const isGoUp = Boolean(Number(previousClose) > Number(previewTwoDayClose));
            acc.tradeDirection[time] = !!isGoUp;
          }
        }
        // 判断最近两天的趋势
        const isLastIndex = index === RSIData?.full_klines.length - 1;
        if (previousClose && isLastIndex) {
          const isClose = dayjs().isAfter(dayjs().hour(closeHourConfig));
          const diffTime = isClose ? 2 : 1;
          const previewTime = dayjs(closeTimeMapDate[closeTimeMapDate?.length - diffTime]).format('YYYY-MM-DD HH:mm');
          const previousClose = closeTimeMap[previewTime];
          const priceChange = (kline.close - previousClose) / previousClose;
          acc.priceChange[time] = (priceChange * 100).toFixed(2);
          // 前两天
          const previewTwoDayTime = dayjs(closeTimeMapDate[closeTimeMapDate?.length - (diffTime + 1)]).format('YYYY-MM-DD HH:mm');
          const previewTwoDayClose = closeTimeMap[previewTwoDayTime];

          const isGoUp = Boolean(Number(previousClose) > Number(previewTwoDayClose));
          acc.tradeDirection[time] = !!isGoUp;
        }
      }

      if (klt === EKLT.DAY) {
        acc.priceChange[time] = String(kline.volume);
      }

      return acc;
    }, { priceChange: {}, tradeDirection: {} });

    const fullKlinesData = GetConvert('RSI', RSIData.full_klines, { market, stockCode, stockName, kltDesc });
    const stockRSIData = fullKlinesData?.map(item => {
      const itemTime = dayjs(item[0]);
      const formatItemTime = dayjs(item[0]).format('YYYY-MM-DD HH:mm');
      //格式化涨跌百分比
      const currentPriceChange = formatPriceChange(priceChangeMap?.priceChange?.[formatItemTime]);
      // 前两天趋势
      const currentTrade = priceChangeMap?.tradeDirection?.[formatItemTime];
      const currentTradeStr = currentTrade ? "" : "⬇️";

      // currentDate - itemTime
      const diffInMinutes = currentDate.diff(itemTime, 'minute');
      let backtestingStr = '';

      // 15min RSI 只保留0-5分钟内的数据
      if ((klt === EKLT["15M"] || klt === EKLT["5M"])) {
        if (isBacktesting) {// 接近三天
          if (diffInMinutes > 5000) return;
        } else {
          // 9.30开始不能<-5，会把冗余数据返回
          if ((diffInMinutes > 4 || diffInMinutes < -6)) return;
        }
      }

      //3天内
      if (klt === EKLT["DAY"] && (diffInMinutes > 6000 || diffInMinutes < -5)) {
        return;
      }

      const sourceItem = RSIData?.full_klines?.find(item => dayjs(item?.date).isSame(itemTime, 'minute'));
      const rsiThresholds = RSIThresholds[stockType][klt];
      const increaseStr = isChipIncrease ? '💹' : ''

      const stockLink = `https://quote.eastmoney.com/${marketType}${stockCode}.html?from=classic#fullScreenChart`;
      if (Number(item?.[1]) <= rsiThresholds.mustBuy) {

        if (isBacktesting) {
          const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType);
          const nextDayStr = `${backData?.nextdayPercentageProfit ? 'next: ' + backData?.nextdayPercentageProfit : ''}`;
          backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr}`;
        }
        buyList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.MUST_BUY, backtestingStr, currentPriceChange, currentTradeStr, increaseStr));

        return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.MUST_BUY} ${backtestingStr} ${currentTradeStr} ${increaseStr}`;
      } else if (Number(item?.[1]) <= rsiThresholds.buy) {
        if (isBacktesting) {
          const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType);
          const nextDayStr = `${backData?.nextdayPercentageProfit ? 'next: ' + backData?.nextdayPercentageProfit : ''}`;
          backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr} `;
        }
        buyList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.BUY, backtestingStr, currentPriceChange, currentTradeStr, increaseStr));

        return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.BUY} ${backtestingStr} ${currentTradeStr} ${increaseStr}`;
      } else if (Number(item?.[1]) >= rsiThresholds.mustSell && !isBacktesting) { // 回测不需要卖出信息
        //15分钟 不发送北交所卖出
        if (klt === EKLT["15M"] && [...a_beijiaosuo, ...a_xiaofeidianzi].some(item => item.includes(stockCode))) return;
        sellList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.MUST_SELL, '', currentPriceChange, currentTradeStr, increaseStr));
        return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.MUST_SELL} ${currentTradeStr} ${increaseStr}`;
      } else if (Number(item?.[1]) >= rsiThresholds.sell && !isBacktesting) { // 回测不需要卖出信息
        //15分钟 不发送北交所卖出
        if (klt === EKLT["15M"] && [...a_beijiaosuo, ...a_xiaofeidianzi].some(item => item.includes(stockCode))) return;
        sellList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.SELL, '', currentPriceChange, currentTradeStr, increaseStr));
        return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.SELL} ${currentTradeStr} ${increaseStr}`;
      }

    })?.filter(item => !!item);

    targetRSIData.push(...stockRSIData);

  });

  if ((buyList?.length || sellList?.length) && sendEmail) {
    sortListBySuggestion(buyList, ERSISuggestion.MUST_BUY);
    sortListBySuggestion(sellList, ERSISuggestion.MUST_SELL);
    // 重新根据stockName排在一起
    if (isBacktesting || klt === EKLT.DAY) {
      buyList = sortByStockName(buyList);
      normalSortByStockName(sellList);
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
      html: emailContent, // 邮件内容
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
  if (isBacktesting) {
    targetRSIData = sortByStockName(targetRSIData);
  }
  return targetRSIData;
};