export enum EStockType {
    A = 'A',
    HK = 'HK',
    US = 'US',
  }

  
  export const MarketTYpe = {
     0: 'sz',
     1: 'sh',
  }


  export enum EKLT  {
    '15M' = 15,
    'DAY' = 101
  }

  export const getEKLTDesc = (klt: EKLT) => {
    if(klt === EKLT["15M"]) {
      return '15RSI'
    }else if (klt === EKLT.DAY){
      return 'DAYRSI'
    }
  }