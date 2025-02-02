import Holidays from 'date-holidays';
import { EStockType } from '../interface';
const USHoliday = new Holidays('US');
const CHHoliday = new Holidays('CN');
const HKHoliday = new Holidays('HK');


// 判断某一天是否为周末的函数
function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 代表周日，6 代表周六
}

export const isTodayWorkday = (stockType: EStockType, date: Date) => {
  const currentDate = date || new Date();

  if(isWeekend(currentDate)) return false

  if(stockType === EStockType.A) {
    return !CHHoliday.isHoliday(currentDate);
  } else if (stockType === EStockType.HK) {
     return !HKHoliday.isHoliday(currentDate);
  } else if(stockType === EStockType.US) {
    return !USHoliday.isHoliday(currentDate);
  }
  return false
};

