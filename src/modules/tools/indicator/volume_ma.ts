import { MA } from '.'

/**
 * 计算成交量均线
 * @param data 
 * @returns 
 */
export function VolumeMA(data:Array<{
  date: string,
  volume: number
}>){
  return data.map((v, index)=>{

    let ma5:number|string = '-'
    if(index >= 5){
      ma5 = MA(
        data,
        (v2:any)=>{
          return v2.volume
        },
        index,
        5
      )
    }
    
    let ma10:number|string = '-'
    if(index >= 10){
      ma10 = MA(
        data,
        (v2:any)=>{
          return v2.volume
        },
        index,
        10
      )
    }

    return [
      v.date,
      ma5,
      ma10
    ]
  })
}