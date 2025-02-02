/**
 * SAR算法
 */

type Direction = 'up' | 'down'

export function SAR(data:Array<{
  date: string,
  high: number,
  low: number,
  close: number
}>){

  let af = 0.02
  let af_direction:Direction = 'up'
  let out: Array<any> = data.map(v=>{return {}})

  let temp_direction = null as null | Direction
  function AF(direction: Direction, islj:boolean){
    if(temp_direction != direction){
      temp_direction = direction
      af = 0.02
      return af
    }

    if(islj) af += 0.02

    if(af >= 0.2) af = 0.2
    return af
  }

  // function EP(index: number, direction: Direction){
  //   if(direction == 'up') return high(index - 9, index)
  //   return low(index - 9, index)
  // }

  function EP(index: number, direction: Direction){
    if(direction == 'up') return data[index - 1].high
    return data[index - 1].low
  }

  function low(start: number, end: number){
    let subarray = data.slice(start, end)
    return Math.min(...subarray.map(v=>v.low))  
  }

  function high(start: number, end: number){
    let subarray = data.slice(start, end)
    return Math.max(...subarray.map(v=>v.high))  
  }

  let first_sar

  af_direction = 'up'

  data.forEach((v,i)=>{
    if(i <= 8){
      out[i].sar = '-'
      return false
    }

    //第一根方向
    if(i == 9){
      let highest = high(0, 9)
      let lowest = low(0, 9)
      // console.info('gg', highest - data[i].high, lowest - data[i].low)
      
      if(highest - data[i].high > lowest - data[i].low){
        af_direction = 'down'
      }
    }




    let pre_sar = out[i - 1].sar
    if( i == 9 && af_direction == 'up') {
      pre_sar = low(0, 10)
    }
    if( i == 9 && af_direction == 'down') {
      pre_sar = high(0, 10)
    }  

    let af = AF(af_direction, af_direction == 'up' ? data[i].high > data[i - 1].high : data[i].low < data[i - 1].low)

    

    out[i].sar = pre_sar + af * (EP(i, af_direction) - pre_sar)

    // console.info(data[i].date, pre_sar, out[i].sar, af)

    //转向
    if(i > 9 && af_direction == 'up' && data[i].low < out[i].sar){
      af_direction = 'down'
      out[i].sar = high(i - 9, i + 1)
      return false
    }
    if(i > 9 && af_direction == 'down' && data[i].high > out[i].sar){
      af_direction = 'up'
      out[i].sar = low(i - 9, i + 1)
      return false
    }  

  })

  return data.map((v, index)=>{
    return [
      v.date,
      out[index].sar
    ]
  })
}