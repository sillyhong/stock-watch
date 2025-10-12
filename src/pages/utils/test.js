import  dayjs  from 'dayjs'
export const backtestRSI = (currentData, rsiData) => {
    const currentBuyClose = currentData.close;
    const currentDate = currentData.date;

    let todayProfit = 0;
    let nextdayProfit = 0;
    let todayPercentageProfit;
    let nextdayPercentageProfit;
    let nextday

    // Find the index of the current date in the rsiData
    const currentIndex = rsiData.findIndex(data => data.date === `${currentDate.split(' ')[0]} 15:00`);
    //取出下一天的index
    const nextIndex = currentIndex + 1
    // console.log("🚀 ~ backtestRSI ~ nextIndex:", nextIndex, 'rsiData[nextIndex]', rsiData[nextIndex], rsiData?.length)
    if(rsiData[nextIndex]) {
        nextday = rsiData[nextIndex].date
        nextday = dayjs(currentDate).set('hour', 15).set('minute', 0).format('YYYY-MM-DD HH:mm:ss')
    }
    if (currentIndex !== -1) {
        const currentClosePrice = parseFloat(rsiData[currentIndex].close);
        todayProfit = parseFloat((currentClosePrice - currentBuyClose).toFixed(2));
        const prefix = Number(todayProfit) > 0 ? '+' : ''
        todayPercentageProfit = `${prefix}${parseFloat(((todayProfit / currentClosePrice) * 100).toFixed(2))}%`;
    }

    // Calculate profit based on close prices
    if (nextday) {
        const nextClosePrice = parseFloat(rsiData[nextIndex].close);

        nextdayProfit = parseFloat((nextClosePrice - currentBuyClose).toFixed(2));
        const prefix = Number(nextdayProfit) > 0 ? '+' : ''
        console.log("🚀 ~ backtestRSI ~ nextdayProfit:", nextdayProfit, 'prefix', prefix)

        // nextdayPercentageProfit = parseFloat(((todayProfit / nextClosePrice) * 100).toFixed(2)) + '%';
        nextdayPercentageProfit = `${prefix}${parseFloat(((nextdayProfit / nextClosePrice) * 100).toFixed(2)) ?? '-'}%`;

    }

    return {
        todayProfit,
        todayPercentageProfit,
        nextdayProfit,
        nextdayPercentageProfit
    };
};



const currentData =  {
    index: 39,
    date: '2025-02-07 11:30',
    open: 42.9,
    close: 44.55,
    high: 44.8,
    low: 42.77,
    volume: 3.97,
    volume_money: NaN,
    zf: NaN,
    zdf: NaN,
    zde: NaN,
    hsl: NaN,
    pre_close: 42.85,
    showindex: 39
  }

// 定义一系列日期的股票数据
const rsiData = [
    {
        index: 37,
        date: '2025-02-07 11:00',
        open: 42.06,
        close: 42.27,
        high: 42.31,
        low: 42,
        volume: 0.5,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.06,
        showindex: 37
      },
      {
        index: 38,
        date: '2025-02-07 11:15',
        open: 42.27,
        close: 42.85,
        high: 42.95,
        low: 42.2,
        volume: 1.37,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.27,
        showindex: 38
      },
      {
        index: 39,
        date: '2025-02-07 11:30',
        open: 42.9,
        close: 44.55,
        high: 44.8,
        low: 42.77,
        volume: 3.97,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.85,
        showindex: 39
      },
      {
        index: 40,
        date: '2025-02-07 13:15',
        open: 44.65,
        close: 44.09,
        high: 44.65,
        low: 43.4,
        volume: -1.03,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 44.55,
        showindex: 40
      },
      {
        index: 41,
        date: '2025-02-07 13:30',
        open: 44.1,
        close: 43.83,
        high: 44.38,
        low: 43.82,
        volume: -0.59,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 44.09,
        showindex: 41
      },
      {
        index: 42,
        date: '2025-02-07 13:45',
        open: 43.82,
        close: 43.41,
        high: 44.02,
        low: 43.22,
        volume: -0.96,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 43.83,
        showindex: 42
      },
      {
        index: 43,
        date: '2025-02-07 14:00',
        open: 43.41,
        close: 42.98,
        high: 43.42,
        low: 42.85,
        volume: -0.99,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 43.41,
        showindex: 43
      },
      {
        index: 44,
        date: '2025-02-07 14:15',
        open: 42.99,
        close: 42.45,
        high: 43.2,
        low: 42.23,
        volume: -1.23,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.98,
        showindex: 44
      },
      {
        index: 45,
        date: '2025-02-07 14:30',
        open: 42.44,
        close: 42.59,
        high: 42.75,
        low: 41.86,
        volume: 0.33,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.45,
        showindex: 45
      },
      {
        index: 46,
        date: '2025-02-07 14:45',
        open: 42.6,
        close: 42.96,
        high: 42.99,
        low: 42.6,
        volume: 0.87,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.59,
        showindex: 46
      },
      {
        index: 47,
        date: '2025-02-07 15:00',
        open: 42.96,
        close: 43.3,
        high: 43.39,
        low: 42.77,
        volume: 0.79,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.96,
        showindex: 47
      },
      {
        index: 48,
        date: '2025-02-10 09:45',
        open: 42.87,
        close: 42.81,
        high: 43.71,
        low: 42.41,
        volume: -1.13,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 43.3,
        showindex: 48
      },
      {
        index: 49,
        date: '2025-02-10 10:00',
        open: 42.81,
        close: 42.95,
        high: 43.16,
        low: 42.55,
        volume: 0.33,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.81,
        showindex: 49
      },
      {
        index: 50,
        date: '2025-02-10 10:15',
        open: 42.94,
        close: 43.14,
        high: 43.27,
        low: 42.81,
        volume: 0.44,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.95,
        showindex: 50
      },
      {
        index: 51,
        date: '2025-02-10 10:30',
        open: 43.13,
        close: 43,
        high: 43.24,
        low: 42.74,
        volume: -0.32,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 43.14,
        showindex: 51
      },
      {
        index: 52,
        date: '2025-02-10 10:45',
        open: 43,
        close: 42.88,
        high: 43,
        low: 42.63,
        volume: -0.28,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 43,
        showindex: 52
      },
      {
        index: 53,
        date: '2025-02-10 11:00',
        open: 42.88,
        close: 42.72,
        high: 43,
        low: 42.7,
        volume: -0.37,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.88,
        showindex: 53
      },
      {
        index: 54,
        date: '2025-02-10 11:15',
        open: 42.72,
        close: 42.57,
        high: 42.75,
        low: 42.54,
        volume: -0.35,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.72,
        showindex: 54
      },
      {
        index: 55,
        date: '2025-02-10 11:30',
        open: 42.57,
        close: 42.82,
        high: 42.89,
        low: 42.51,
        volume: 0.59,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.57,
        showindex: 55
      },
      {
        index: 56,
        date: '2025-02-10 13:15',
        open: 42.83,
        close: 42.68,
        high: 42.91,
        low: 42.56,
        volume: -0.33,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.82,
        showindex: 56
      },
      {
        index: 57,
        date: '2025-02-10 13:30',
        open: 42.68,
        close: 42.74,
        high: 42.9,
        low: 42.61,
        volume: 0.14,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.68,
        showindex: 57
      },
      {
        index: 58,
        date: '2025-02-10 13:45',
        open: 42.75,
        close: 43.04,
        high: 43.23,
        low: 42.6,
        volume: 0.7,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.74,
        showindex: 58
      },
      {
        index: 59,
        date: '2025-02-10 14:00',
        open: 43.04,
        close: 42.79,
        high: 43.08,
        low: 42.74,
        volume: -0.58,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 43.04,
        showindex: 59
      },
      {
        index: 60,
        date: '2025-02-10 14:15',
        open: 42.8,
        close: 42.85,
        high: 42.95,
        low: 42.78,
        volume: 0.14,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.79,
        showindex: 60
      },
      {
        index: 61,
        date: '2025-02-10 14:30',
        open: 42.86,
        close: 42.99,
        high: 43.13,
        low: 42.83,
        volume: 0.33,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.85,
        showindex: 61
      },
      {
        index: 62,
        date: '2025-02-10 14:45',
        open: 42.98,
        close: 42.91,
        high: 43,
        low: 42.76,
        volume: -0.19,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.99,
        showindex: 62
      },
      {
        index: 63,
        date: '2025-02-10 15:00',
        open: 42.92,
        close: 42.99,
        high: 43.03,
        low: 42.92,
        volume: 0.19,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.91,
        showindex: 63
      },
      {
        index: 64,
        date: '2025-02-11 09:45',
        open: 42.6,
        close: 42.4,
        high: 42.8,
        low: 41.33,
        volume: -1.37,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.99,
        showindex: 64
      },
      {
        index: 65,
        date: '2025-02-11 10:00',
        open: 42.38,
        close: 42.39,
        high: 42.8,
        low: 42.16,
        volume: -0.02,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.4,
        showindex: 65
      },
      {
        index: 66,
        date: '2025-02-11 10:15',
        open: 42.37,
        close: 42.28,
        high: 42.37,
        low: 42.05,
        volume: -0.26,
        volume_money: NaN,
        zf: NaN,
        zdf: NaN,
        zde: NaN,
        hsl: NaN,
        pre_close: 42.39,
        showindex: 66
      },
     
];

// 调用 backtestRSI 函数进行回测
// const result = backtestRSI(currentData, rsiData);
// console.log(result);