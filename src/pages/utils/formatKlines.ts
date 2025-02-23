export const formatKlinesData = (sourceData) => {

//所有返回数据对应的数组
const sourceDataArray = sourceData?.klines?.map((v: string, index: number) => {
    const tempobj = v.split(',')
    return {
      index,
      date: tempobj[0],
      open: parseFloat(tempobj[1]),
      close: parseFloat(tempobj[2]),
      high: parseFloat(tempobj[3]),
      low: parseFloat(tempobj[4]),
      volume: parseFloat(tempobj[5]),
      volume_money: parseFloat(tempobj[6]),
      zf: parseFloat(tempobj[7]),
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
