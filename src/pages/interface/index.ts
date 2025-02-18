import { Dayjs } from "dayjs"

export enum EStockType {
    A = 'A',
    HK = 'HK',
    US = 'US',
  }

  
  export const MarketType = {
     0: 'sz',
     1: 'sh',
     105: 'us/', // 美股
     106: 'us/',// 美股
     116: 'hk/'// 港股
  }


  export enum EKLT  {
    '5M' = 5,
    '15M' = 15,
    'DAY' = 101
  }


  export const getEKLTDesc = (klt: EKLT) => {
    if(klt === EKLT["5M"]) {
      return '5RSI'
    }else if(klt === EKLT["15M"]) {
      return '15RSI'
    }else if (klt === EKLT.DAY){
      return 'DAYRSI'
    }
  }


  export interface IFetchUSRSIParams  {
      klt: number, 
      currentDate?: Dayjs, 
      sendEmail?: boolean,
      isBacktesting?: boolean,
  }

