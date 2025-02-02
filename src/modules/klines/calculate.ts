import clone from 'lodash/clone'

/** 计算行情数据相关数据 */
export function dealDataWithData(thiskline: kline) {
    const source_data = clone(thiskline.source_data || thiskline.klines )
    const { options, common_data } = thiskline
  
    if (source_data.klines instanceof Array) {
  
      //判断是否已经打到最大条数
      if(source_data.klines.length < common_data.data_count){
        // console.info('max')
        common_data.max_count = source_data.klines.length
      }
      else{
        common_data.max_count = null
      }
  
      //所有返回数据对应的数组
      const back_data_array = source_data.klines.map((v: string, index: number) => {
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
  
      back_data_array.map((v: any, index: number) => { //昨收
        if (index == 0) {
          v.pre_close = source_data.preKPrice
        }
        else {
          v.pre_close = back_data_array[index - 1].close
        }
      })
  
      thiskline.data = {
        code: source_data.code,
        market: source_data.market,
        name: source_data.name,
        decimal: source_data.decimal,
        dktotal: source_data.dktotal,
        full_klines: back_data_array,
        klines: []
      }
    }
  }
  