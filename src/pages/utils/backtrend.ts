import  dayjs  from 'dayjs'
import { EStockType } from '../interface';

const closeHourConfig = {
    [EStockType.A]: '15',
    [EStockType.HK]: '16',
    [EStockType.US]: '4',
}

export const backtestRSI = (currentData, rsiData, stockType) => {
    const currentBuyClose = currentData.close;
    const currentDate = currentData.date;

    let todayProfit = 0;
    let nextdayProfit = 0;
    let todayPercentageProfit;
    let nextdayPercentageProfit;
    let nextday
    
    
    const closeHour = closeHourConfig[stockType]
    // Find the index of the current date in the rsiData
    const currentIndex = rsiData.findIndex(data => data.date === `${currentDate.split(' ')[0]} ${closeHour}:00`);
    //取出下一天的index
    const nextIndex = currentIndex + 1
    // console.log("🚀 ~ backtestRSI ~ nextIndex:", nextIndex, 'rsiData[nextIndex]', rsiData[nextIndex], rsiData?.length)
    if(rsiData[nextIndex]) {
        nextday = rsiData[nextIndex].date
        nextday = dayjs(nextday).set('hour', closeHour).set('minute', 0).format('YYYY-MM-DD HH:mm')
    }
    if (currentIndex !== -1) {
        const currentClosePrice = parseFloat(rsiData[currentIndex].close);
        todayProfit = parseFloat((currentClosePrice - currentBuyClose).toFixed(2));
        const prefix = Number(todayProfit) > 0 ? '+' : ''
        todayPercentageProfit = `${prefix}${parseFloat(((todayProfit / currentClosePrice) * 100).toFixed(2))}%`;
    }

    // Calculate profit based on close prices
    if (nextday) {
        const nextDayCloseIndex = rsiData.findIndex(data => data.date === nextday);
        if(nextDayCloseIndex === -1) return 
        const nextClosePrice = parseFloat(rsiData[nextDayCloseIndex].close);

        nextdayProfit = parseFloat((nextClosePrice - currentBuyClose).toFixed(2));
        const prefix = Number(nextdayProfit) > 0 ? '+' : ''
        // console.log("🚀 ~ backtestRSI ~ nextdayProfit:", nextdayProfit, 'nextClosePrice', nextClosePrice, 'currentBuyClose',currentBuyClose)
        nextdayPercentageProfit = `${prefix}${parseFloat(((nextdayProfit / nextClosePrice) * 100).toFixed(2)) ?? '-'}%`;

    }

    return {
        todayProfit,
        todayPercentageProfit,
        nextdayProfit,
        nextdayPercentageProfit
    };
};

