const Holidays = require('date-holidays');
const USHoliday = new Holidays('US');
const CHHoliday = new Holidays('CN');
const HKHoliday = new Holidays('HK');
// TODO 手动添加节假日
// console.log(CHHoliday.getHolidays(2026))
// 判断某一天是否为周末的函数
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 代表周日，6 代表周六
}

 const EStockType = {
  A: 'A',
  HK: 'HK',
  US: 'US',
}

 const isTodayWorkday = (stockType, date) => {
  const currentDate = date || new Date();
  console.log("🚀 ~ isTodayWorkday ~ currentDate:", currentDate)
  if(isWeekend(currentDate)) return false

  if(stockType === EStockType.A) {
    return !CHHoliday.isHoliday(currentDate);
  } else if (stockType === EStockType.HK) {
     return !HKHoliday.isHoliday(currentDate);
  } else if(stockType === EStockType.US) {
    return !USHoliday.isHoliday(currentDate) ;
  }
  return false
};

// console.log(isTodayWorkday(EStockType.US, new Date('2025-01-31')))
// console.log(isTodayWorkday(EStockType.US))
console.log(isTodayWorkday(EStockType.A, new Date('2025-01-31')))
// console.log(isTodayWorkday(EStockType.A))
// console.log(isTodayWorkday(EStockType.HK))

