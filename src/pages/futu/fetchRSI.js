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
    let targetRSIData: any[] = [];
    // 需要前6个周期的值，需要向前几天拉取数据
    const prePullDay = PrePullDayConfig[stockType][klt];
    const startFormatDay = dayjs(currentDate).subtract(prePullDay, 'day').format('YYYYMMDD');
    // const endFormatDay = dayjs(currentDate).format('YYYYMMDD');
  
    // 分批次，每批10个
    const BATCH_SIZE = 10;
    const batches: string[][] = [];
    for (let i = 0; i < stockLists.length; i += BATCH_SIZE) {
      batches.push(stockLists.slice(i, i + BATCH_SIZE));
    }
  
    const allResults: any[] = [];
  
  
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      let batch = batches[batchIdx];
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
  
        // 每个请求可选独立userAgent/token/头部（也可以都用本批次的）
        const reqUrl = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${stockId}&ut=${userToken}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f59&klt=${klt}&fqt=1&beg=${startFormatDay}&end=20500000`;
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
      const sourceData = eastmoneyData?.data?.data;
      // console.log("🚀s ~ sourceData:", sourceData)
      const market = sourceData?.market;
      const stockCode = sourceData?.code;
      let stockName = `${a_beijiaosuo_cn.includes(sourceData?.name) ? '[北]' + sourceData?.name : sourceData?.name}`;
      if (stockCode?.startsWith('300') || stockCode?.startsWith('688')) {
        stockName = `[创]${stockName}`;
      }
      const marketType = MarketType[market];
  
      const RSIData = formatKlinesData(sourceData);
      // console.log("🚀 ~ RSIData:", RSIData?.full_klines)
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
  
        const stockLink = `https://quote.eastmoney.com/${marketType}${stockCode}.html?from=classic#fullScreenChart`;
        if (Number(item?.[1]) <= rsiThresholds.mustBuy) {
  
          if (isBacktesting) {
            const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType);
            const nextDayStr = `${backData?.nextdayPercentageProfit ? 'next: ' + backData?.nextdayPercentageProfit : ''}`;
            backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr}`;
          }
          buyList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.MUST_BUY, backtestingStr, currentPriceChange, currentTradeStr));
  
          return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.MUST_BUY} ${backtestingStr} ${currentTradeStr}`;
        } else if (Number(item?.[1]) <= rsiThresholds.buy) {
          if (isBacktesting) {
            const backData = backtestRSI(sourceItem, RSIData?.full_klines, stockType);
            const nextDayStr = `${backData?.nextdayPercentageProfit ? 'next: ' + backData?.nextdayPercentageProfit : ''}`;
            backtestingStr = `today: ${backData?.todayPercentageProfit} ${nextDayStr} `;
          }
          buyList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.BUY, backtestingStr, currentPriceChange, currentTradeStr));
  
          return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.BUY} ${backtestingStr} ${currentTradeStr}`;
        } else if (Number(item?.[1]) >= rsiThresholds.mustSell && !isBacktesting) { // 回测不需要卖出信息
          //15分钟 不发送北交所卖出
          if (klt === EKLT["15M"] && [...a_beijiaosuo, ...a_xiaofeidianzi].some(item => item.includes(stockCode))) return;
          sellList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.MUST_SELL, '', currentPriceChange, currentTradeStr));
          return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.MUST_SELL} ${currentTradeStr}`;
        } else if (Number(item?.[1]) >= rsiThresholds.sell && !isBacktesting) { // 回测不需要卖出信息
          //15分钟 不发送北交所卖出
          if (klt === EKLT["15M"] && [...a_beijiaosuo, ...a_xiaofeidianzi].some(item => item.includes(stockCode))) return;
          sellList.push(createEmailItem(item, kltDesc, stockLink, stockName, ERSISuggestion.SELL, '', currentPriceChange, currentTradeStr));
          return `[${item[0]}] [${kltDesc}] ${stockName} ${item[1]} [${currentPriceChange}] ➜ ${ERSISuggestion.SELL} ${currentTradeStr}`;
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