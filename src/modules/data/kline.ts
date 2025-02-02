/**
 * 获取K线图数据
 */

import jsonp from "./jsonp"
import { Kline_Options, kline_type, fq_type } from '../kline/options'
import takeRight from 'lodash/takeRight'
import sumBy from 'lodash/sumBy'
import lastIndexOf from 'lodash/lastIndexOf'
import config from '../../config/web'
import object_hash from 'object-hash'
import { datacache } from './datacache'
import { kline } from "../kline"




export type SourceData = {
  code: string,
  market: number,
  name: string,
  decimal: number,
  dktotal: number,
  preKPrice: number,
  klines: Array<string>
}

export async function getKlineData(thiskline: kline):Promise<SourceData|null> {

  const {options, common_data} = thiskline

  //5(5分钟)，15(15分钟)，30(30分钟)，60(60分钟)，101(日)，102(周)，103(月)，104(季)，105(半年)，106(年)。
  let klt = 101
  switch (options.type) {
    case 'day':
      klt = 101
      break;
    case 'week':
      klt = 102
      break;  
    case 'month':
      klt = 103
      break;
    case 'season':
      klt = 104
      break;
    case 'half_year':
      klt = 105
      break;
    case 'year':
      klt = 106
      break;     
    case '5min':
      klt = 5
      break; 
    case '15min':
      klt = 15
      break;
    case '30min':
      klt = 30
      break;      
    case '60min':
      klt = 60
      break;         
  }

  let fqt = 1
  switch (options.fq_type) {
    case 'qfq':
      fqt = 1
      break;
    case 'hfq':
      fqt = 2
      break;  
    case 'bfq':
      fqt = 0
      break;
  }

  try {
    const backdata:any = await jsonp(
      `${config.getUrl('quote_history_api')}api/qt/stock/kline/get?secid=${options.quotecode}&ut=${options.ut}&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58%2Cf59%2Cf60%2Cf61&klt=${klt}&fqt=${fqt}${options.beg ? '&' + options.beg : ''}&end=${options.end}&lmt=${common_data.data_count}`,
      {
        param: 'cb',
        prefix: 'quote_jp'
      }
    )

    if(backdata?.data) return backdata.data
    return null
  } catch (error) {
    console.error(error)
  }
  return null
}


const infomine_type = {
  1: "新闻",
  2: "公告",
  3: "研报"
}

/**
 * 信息地雷数据
 */
export type InfoMineData = null | {
  [key:string]: Array<{
    type: string,
    title: string,
    url: string
  }>
}



/**
 * 获取个股信息地雷
 * @param code 代码 格式:300059
 * @param start_date 开始日期 格式:2022-09-29
 * @param end_date 结束日期 格式:2022-09-29
 * @returns 
 */
export async function getInfoMineData(code: string, start_date: string, end_date: string):Promise<InfoMineData> {
  try {
    const backdata:any = await jsonp(
      `${config.getUrl('news_api')}api/infomine?code=${code}&marketType=&types=1%2C2&startTime=${start_date}&endTime=${end_date}&format=yyyy-MM-dd`,
      {
        param: 'cb',
        prefix: 'quote_jp'
      }
    )

    if(backdata?.Data instanceof Array && backdata.Data.length > 0){    
      const returnobj:{
        [key:string]: Array<{
          type: string,
          title: string,
          url: string
        }>
      } = {}
      backdata.Data.forEach(function(v:any, index:number){
        if(returnobj[v.Time] == undefined){
          returnobj[v.Time] = [{
            type: infomine_type[v.Type as keyof typeof infomine_type],
            title: v.Title,
            url: v.Url || v.UniqueUrl
          }]
        }
        else{
          returnobj[v.Time].push({
            type: infomine_type[v.Type as keyof typeof infomine_type],
            title: v.Title,
            url: v.Url || v.UniqueUrl
          })
        } 
      })
      return returnobj
    }
  } catch (error) {
    console.error(error)
  }

  return null
}


/**
 * 获取个股信息地雷带缓存
 * @param code 代码 格式:300059
 * @param start_date 开始日期 格式:2022-09-29
 * @param end_date 结束日期 格式:2022-09-29
 * @returns 
 */
export async function getInfoMineDataWithCache(code: string, start_date: string, end_date: string, cache_time: number):Promise<InfoMineData> {
  const cache_key = object_hash({
    name: 'infomine',
    code: code,
    // start_date: start_date,
    // end_date: end_date,
  })

  if(datacache.get(cache_key)){
    return datacache.get(cache_key)
  }
  else{
    const data = await getInfoMineData(code, start_date, end_date)
    datacache.set(cache_key, data, cache_time * 1000)
    return data
  }
}

/** 除权除息数据 */
export type CQCXType = Array<{
    date: string,
    type: number,
    pxbl: number,
    sgbl: number,
    cxbl: number,
    pgbl: number,
    pgjg: number,
    pghg: number,
    zfbl: number,
    zfgs: number,
    zfjg: number,
    ggflag: number,
    zzbl: number
  }>

/**
 * 获取个股除权除息数据
 * @param quotecode 代码 格式:0.300059
 * @param ut 行情ut字符串
 * @returns 
 */
export async function getCQCX(quotecode: string, ut: string):Promise<null | CQCXType> {

  const cache_key = 'cqxc_' + quotecode

  if(datacache.get(cache_key)){
    return datacache.get(cache_key)
  }

  try {
    const backdata:any = await jsonp(
      `${config.getUrl('quote_api')}api/qt/stock/cqcx/get?secid=${quotecode}&ut=${ut}`,
      {
        param: 'cb',
        prefix: 'quote_jp'
      }
    )

    if(backdata?.data?.records instanceof Array){
      datacache.set(cache_key, backdata.data.records, 60 * 60)
      return backdata.data.records
    }
  } catch (error) {
    console.error(error)
  }

  return null
}

