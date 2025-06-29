import dayjs from "dayjs"
import { IFutuStockInfo } from "./config"
import { EKLT } from "../interface"

// 格式化东方财富 klines
export const formatKlinesData = (sourceData) => {

//所有返回数据对应的数组
const sourceDataArray = sourceData?.klines?.map((v: string, index: number) => {
    const tempobj = v.split(',')
    // if(sourceData?.klines?.length -1 === index) {
    //   // f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61
    //   // 2025-06-27,166.66,178.40,188.00,165.16,49179,872626769.00,13.68,6.83,11.41,8.18 // 11
    //   // f51,f52,f53,f54,f55,f59,f60,f61,f56,f57,f58
    //   // 2025-06-27,166.66,178.40,188.00,165.16,6.83,11.41,8.18 // 8
    //   console.log('tempobj123', tempobj, 'tempobj.length', tempobj?.length, 'v',v)
    // }
    return {
      index,
      date: tempobj[0],
      open: parseFloat(tempobj[1]),
      close: parseFloat(tempobj[2]),
      high: parseFloat(tempobj[3]),
      low: parseFloat(tempobj[4]),
      // 需要获取最后三位，根据长度获取
      volume: parseFloat(tempobj[tempobj.length -3 ]),
      volume_money: parseFloat(tempobj[tempobj.length -2]),
      zf: parseFloat(tempobj[tempobj.length -1]),
      // volume: parseFloat(tempobj[5]),
      // volume_money: parseFloat(tempobj[6]),
      // zf: parseFloat(tempobj[7]),
      zdf: parseFloat(tempobj[8]),
      zde: parseFloat(tempobj[9]),
      hsl: parseFloat(tempobj[10]),
      pre_close: 0,
      showindex: index
    }
  })

  sourceDataArray.map((v: any, index: number) => { //昨收
    if (index == 0) {
      v.pre_close = sourceData.preKPrice
    }
    else {
      v.pre_close = sourceDataArray[index - 1].close
    }
  })

  return  {
    code: sourceData.code,
    market: sourceData.market,
    name: sourceData.name,
    decimal: sourceData.decimal,
    dktotal: sourceData.dktotal,
    full_klines: sourceDataArray,
    klines: []
  }

}

// 格式化富途 klines
export const formatFutuKlinesData = (
  stockLists: IFutuStockInfo[],
  stockData: any,
  klt: EKLT
) => {
  // 查找目标股票信息
  const findStockIndex = stockLists.findIndex(
    (stockItem: IFutuStockInfo) => stockItem.stockId === stockData?.data?.stockId
  );
  const targetStock: IFutuStockInfo = stockLists[findStockIndex];
  let klines = []
  // 处理K线数据
  if(klt === EKLT["5M"] || klt === EKLT["15M"]) {
    klines = (stockData?.data?.list || [])
    .filter((item: any) => {
      // item.time 可能是秒或毫秒
      const t = String(item.time).length === 10 ? item.time * 1000 : item.time;
      const hour = dayjs(t).hour();
      const minute = dayjs(t).minute();
      // 保留9:30到15:00范围内的数据，且分钟只能为0,15,30,45
      if (hour < 9 || hour > 15) return false;
      if (hour === 9 && minute < 30) return false;
      if (hour === 15 && minute > 0) return false;

      if(klt === EKLT["5M"]){
        return [0, 5,10 ,15, 20, 25, 30, 35,40, 45, 50, 55].includes(minute);
      }else if(klt === EKLT["15M"]) {
        return [0, 15, 30, 45].includes(minute);
      }
    })
    .map((item: any) => {
      // 补全所有字段，兼容不存在的字段
      const t = String(item.time).length === 10 ? item.time * 1000 : item.time;
      const timeStr = dayjs(t).format('YYYY-MM-DD HH:mm');
      // 兼容字段名，部分字段可能不存在
      // 东方财富格式: "2025-05-15 14:45,266.28,265.60,266.28,265.22,3910,103824368.00,0.40,-0.26,-0.68,0.14"
      // 富途部分字段可能为undefined，需补全为0
      return [
        timeStr,
        item.open ?? 0,
        item.cc_price ?? item.close ?? 0,
        item.high ?? 0,
        item.low ?? 0,
        item.volume ?? 0,
        item.turnover ?? 0,
        item.amplitude ?? 0,
        item.change ?? 0,
        item.ratio ?? 0,
        item.turnoverRate ?? 0
      ].join(',');
    });
  } else if (klt === EKLT.DAY) {

     klines = (stockData?.data?.list || [])
    .slice(-60)
    .map(item => {
      // 东方财富格式: "2025-05-15 14:45,266.28,265.60,266.28,265.22,3910,103824368.00,0.40,-0.26,-0.68,0.14"
      // 假设item结构: { time, open, close, high, low, volume, turnover, amplitude, change, ratio, turnoverRate }
      // 你需要根据实际返回字段名调整下方属性
      const t = String(item.k).length === 10 ? item.k * 1000 : item.k;
      const timeStr = dayjs(t).format('YYYY-MM-DD HH:mm');
      // 兼容字段名，部分字段可能不存在
      /* 
          c: "251.18"
          cp: "-4.96"
          h: "255.98"
          k: 1749744000
          l: "250.48"
          lc: 256.14
          o: "253.6"
          r: 0.02083
          t: 1448369996.29
          v: 5738800
      */
      return  [
        timeStr,
        item.o,
        item.c, 
        item.h,
        item.l,
        item.v,
        item.t,
        item?.amplitude,
        item.lc,
        item.r,
        item?.turnoverRate
      ].join(',');
    });
  }
  

  // 补全格式
  return {
    code: targetStock?.stockCode ?? stockData?.data?.stockId ?? '',
    market: 4,
    name: targetStock?.name ?? '',
    decimal: 2,
    dktotal: 3730,
    preKPrice: stockData?.data?.preClose ?? 0,
    klines: klines
  };
};
