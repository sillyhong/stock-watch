/**
 * DMI指标算法
 */

import sum from 'lodash/sum'
import { MA, SUM } from '.'

export function DMI(data:any){

  const N = 14
  const M = 6

  const data2 = data.map((v: any)=>{
    return {
      date: v.date,
      high: v.high,
      low: v.low,
      close: v.close,
      pre_close: v.pre_close,
      open: v.open
    }
  })

  //app pc拿不到正确的第一条昨收，这里是强行为了和他们对齐
  data2[0].pre_close = data2[0].open

  data2.forEach((v:any,index:number)=>{
    if( index == 0){
      v.PDI = '-'
      v.MDI = '-'
      v.ADX = '-'
      v.ADXR = '-'
      return
    }

    v.MTR = SUM(data2, (v2:any)=>{return Math.max(Math.max(v2.high - v2.low, Math.abs(v2.high - v2.pre_close)), Math.abs(v2.low - v2.pre_close))}, index, N)
    v.HD = v.high - data2[index - 1].high
    v.LD = data2[index - 1].low - v.low
    v.DMP = SUM(data2, (v2:any)=>{return v2.HD > 0 && v2.HD > v2.LD ? v2.HD : 0}, index, N)
    v.DMM = SUM(data2, (v2:any)=>{return v2.LD > 0 && v2.LD > v2.HD ? v2.LD : 0}, index, N)
    v.PDI = v.DMP * 100 / v.MTR
    v.MDI = v.DMM * 100 / v.MTR
    if(index >= M){
      v.ADX = MA(data2, (v2:any)=>{ return Math.abs(v2.MDI - v2.PDI) / (v2.MDI + v2.PDI) * 100}, index, M)
    }
    else{
      v.ADX = '-'
    }
    if(index >= 2 * M){
      v.ADXR = (v.ADX + data2[index - M].ADX) / 2
    }
    else{
      v.ADXR = '-'
    }
    
  })

  return data2.map((v:any)=>{
    return [
      v.date,
      v.PDI == '-' ? '-' : v.PDI.toFixed(3) / 1,
      v.MDI == '-' ? '-' : v.MDI.toFixed(3) / 1,
      v.ADX == '-' ? '-' : v.ADX.toFixed(3) / 1,
      v.ADXR == '-' ? '-' : v.ADXR.toFixed(3) / 1
    ]
  })
}
