import  dayjs  from 'dayjs'
import { EStockType, IKlineItem } from '../interface';
import { getUSMarketHours } from './config';

// 静态配置，美股时间现在动态获取
const closeHourConfig = {
    [EStockType.A]: '15',
    [EStockType.HK]: '16',
    [EStockType.US]: '4',  // 默认值，实际使用时动态计算
}

interface ICurrentData {
    close: number;
    date: string;
}

export const backtestRSI = (currentData: ICurrentData, rsiData: IKlineItem[], stockType: EStockType) => {
    const currentBuyClose = currentData.close;
    const currentDate = currentData.date;

    let todayProfit = 0;
    let nextdayProfit = 0;
    let todayPercentageProfit;
    let nextdayPercentageProfit;
    let nextday
    
    
    let compareDate: string;
    let closeHour: number;
    
    // Find the index of the current date in the rsiData
    if(stockType === EStockType.US ){
        // 动态获取美股收盘时间
        const currentDataDate = dayjs(currentDate);
        const usMarketHours = getUSMarketHours(currentDataDate);
        closeHour = usMarketHours.closeHour;
        
        const currentHour = dayjs(currentData?.date).hour();
        const currentUSDate = currentHour <= closeHour ? dayjs(currentDate) : dayjs(currentDate).add(1, 'day') 
        compareDate = `${dayjs(currentUSDate)?.format('YYYY-MM-DD')} ${String(closeHour).padStart(2, '0')}:00` 
    }else {
        closeHour = Number(closeHourConfig[stockType]);
        compareDate = `${currentDate.split(' ')[0]} ${String(closeHour)}:00`
    }
    // console.log('123', rsiData.map(item=> item.date))
    const currentIndex = rsiData.findIndex((data: IKlineItem) => data?.date === compareDate);
    //取出下一天的index
    const nextIndex = currentIndex + 1
    // console.log("🚀 ~ backtestRSI ~ currentIndex:", currentIndex, 'nextIndex', nextIndex, compareDate, 'time',`${currentDate.split(' ')[0]} ${closeHour}:00`)
    if(rsiData[nextIndex]) {
        nextday = stockType === EStockType.US ? dayjs(rsiData[nextIndex].date).add(1, 'day') : dayjs(rsiData[nextIndex].date)
        nextday = dayjs(nextday).set('hour', closeHour).set('minute', 0).format('YYYY-MM-DD HH:mm')
    }
    if (currentIndex !== -1) {
        const currentClosePrice = Number(rsiData[currentIndex].close);
        todayProfit = parseFloat((currentClosePrice - currentBuyClose).toFixed(2));
        const prefix = Number(todayProfit) > 0 ? '+' : ''
        todayPercentageProfit = `${prefix}${parseFloat(((todayProfit / currentClosePrice) * 100).toFixed(2))}%`;
    }

    // Calculate profit based on close prices
    if (nextday) {
        const nextDayCloseIndex = rsiData.findIndex((data: IKlineItem) => data.date === nextday);
        if(nextDayCloseIndex === -1) return {
            todayProfit,
            todayPercentageProfit,
            nextdayProfit,
            nextdayPercentageProfit
        }; 
        const nextClosePrice = Number(rsiData[nextDayCloseIndex].close);

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

