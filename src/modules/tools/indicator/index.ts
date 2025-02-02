/**
 * 指标算法
 */
import sum from 'lodash/sum'

/** 前pre日之和 */
export function SUM(data:any, callback:Function, thisindex: number, pre:number){
  return sum(data.filter((v:any, index:number)=>{
    return index <= thisindex && index > (thisindex - pre)
  }).map((v:any)=>{
    return callback(v)
  }))
}

/** 简单平均 */
export function MA(data:any, callback:Function, thisindex:number, pre:number){
  return SUM(data, callback, thisindex, pre) / pre
}