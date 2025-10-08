import { MA } from '.'

/**
 * 计算价格均线
 * @param data 
 * @returns 
 */
export function CloseMA(data:Array<{
  date: string,
  close: number
}>){
  return data.map((v, index)=>{

    let ma5:number|string = '-'
    if(index >= 5){
      ma5 = MA(
        data,
        (v2:any)=>{
          return v2.close
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
          return v2.close
        },
        index,
        10
      )
    }

    let ma20:number|string = '-'
    if(index >= 20){
      ma20 = MA(
        data,
        (v2:any)=>{
          return v2.close
        },
        index,
        20
      )
    }    

    // let ma30:number|string = '-'
    // if(index >= 30){
    //   ma30 = MA(
    //     data,
    //     (v2:any)=>{
    //       return v2.close
    //     },
    //     index,
    //     30
    //   )
    // } 

    // let ma60:number|string = '-'
    // if(index >= 60){
    //   ma60 = MA(
    //     data,
    //     (v2:any)=>{
    //       return v2.close
    //     },
    //     index,
    //     60
    //   )
    // } 

    let ma55:number|string = '-'
    if(index >= 55){
      ma55 = MA(
        data,
        (v2:any)=>{
          return v2.close
        },
        index,
        55
      )
    } 

    let ma233:number|string = '-'
    if(index >= 233){
      ma233 = MA(
        data,
        (v2:any)=>{
          return v2.close
        },
        index,
        233
      )
    } 

    return [
      v.date,
      ma5,
      ma10,
      ma20,
      // ma30,
      // ma60
      ma55,
      ma233,
    ]
  })
}