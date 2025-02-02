/**
 * 文本或者计算工具
 */

import max from 'lodash/max'
import isNumber from 'lodash/isNumber'

/**
 * 如果是数字就tofixed然后转化成数字，如果不是数字就原样返回
 * @param input 
 * @param tofixed 
 */
export function numberFixedCut(input:any, tofixed = 2){
  if(isNumber(input)){
    return parseFloat(input.toFixed(tofixed))
  }
  return input
}

/**
 * 数字显示
 * @param num 
 * @param tofixed 
 * @param replacestr 
 * @param is_pencent
 * @returns 
 */
export function numberToFixed(num: any, tofixed = 2, color = 0, replacestr = '-', is_pencent = false){
  if(isNumber(num)){
    let numstr = num.toFixed(tofixed)
    if(is_pencent){
      numstr += '%'
    }
    if(color > 0){
      numstr = '<span class="price_up">' + numstr + '</span>'
    }
    else if(color < 0){
      numstr = '<span class="price_down">' + numstr + '</span>'
    }

    return '<span class="price_draw">' + numstr + '</span>'
  }
  return '<span class="price_draw">' + replacestr + '</span>'
}

/**
 * 转换数字时间 例如 202208240915这样的
 * @param input 
 * @returns 
 */
export function transNumberTime(input:number){
  let datestr = input.toString()

  let date = '-'
  let year = '-'
  let time = '-'
  let dateobj = new Date()

  if(datestr.length == 12){
    year = datestr.substring(0, 4)
    date = datestr.substring(4, 6) + '-' + datestr.substring(4, 8)
    time = datestr.substring(8, 10) + ':' + datestr.substring(10, 12)
    dateobj = new Date(
      parseInt(datestr.substring(0, 4)),
      parseInt(datestr.substring(4, 6)) - 1,
      parseInt(datestr.substring(6, 8)),
      parseInt(datestr.substring(8, 10)),
      parseInt(datestr.substring(10, 12))
    )
  }

  return {
    dateobj,
    date,
    year,
    time
  }
}

/**
 * 获取成交量文本
 * @param num 
 */
export function getVolumeText(num: number, fixed = 2){

  if(isNaN(num)) return ''

  if(num >= 100000000 || num <= -100000000){
    return (num / 100000000).toFixed(fixed) + '亿'
  }  
  else if(num >= 10000 || num <= -10000){
    return (num / 10000).toFixed(fixed) + '万'
  }

  return Math.round(num).toString()
}

/**
 * 获取文本的宽度
 * @param text 文本
 * @param style 样式
 * @returns 
 */
export function getTextWidth(text: string, style = '12px Arial'){
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d') as CanvasRenderingContext2D  
  return ctx.measureText(text).width
}


/**
 * 获取一组文本在canvas里面的最大宽度
 * @param input 字符串数组
 * @param style 样式
 */
export function getMaxTextWidth(input: Array<string>, style = '12px Arial'){
  let canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  ctx.font = style

  return Math.ceil(max(input.map(v=>{
    return ctx.measureText(v).width
  })) as number)
}

/**
 * 修整坐标数字+0.5
 */
export function axisIntAdd(input:number){
  return Math.trunc(input) + 0.5
}

/**
 * 修整坐标数字-0.5
 */
export function axisIntReduce(input:number){
  return Math.trunc(input) - 0.5
}

/** 
 * 绘制一组文字
 */
export function fillTextList(
  ctx: CanvasRenderingContext2D,
  list:Array<{
    txt: string,
    color?: string
  }>,
  x: number,
  y: number,
){

  let txt_length = 0
  list.forEach((v, index)=>{
    ctx.save()
    if(v.color) ctx.fillStyle = v.color
    ctx.fillText(
      v.txt,
      x + txt_length,
      y
    )
    ctx.restore()
    txt_length += ctx.measureText(v.txt).width
  })
}

/**
 * 获取最小值和最大值平分的数字数组
 * @param min_number 最小值
 * @param max_number 最大值
 * @param split 平分数量 >=0
 * @param average 指定中间值
 */
export function getSplitNumberArray(min_number:number, max_number:number, split:number, average?: number){

  let arr = [] as Array<number>

  if(min_number > max_number){
    [min_number, max_number] = [max_number, min_number]
  }

  if(average == undefined){
    arr.push(min_number)
    for (let i = 0; i < split; i++) {
      arr.push(
        (max_number - min_number) / (split + 1) * (i + 1) + min_number
      )
    }
    arr.push(max_number)    
  }
  else{
    let maxspan = max([Math.abs(max_number - average), Math.abs(min_number - average)])!
    max_number = average + maxspan
    min_number = average - maxspan

    if(split == 0){
      arr.push(min_number)
      arr.push(average)
      arr.push(max_number)
    }
    else{
      arr = arr.concat(getSplitNumberArray(min_number, average, split)).slice(0, arr.length - 1).concat(getSplitNumberArray(average, max_number, split))
    }
  }  

  return arr

}

/**
 * 获取最大值，最小值，中间值，平分之后的数组，考虑小数点数误差
 */
export function getSplitNumberArrayWithDecimal(max: number, min: number, average: number, split: number, decimal: number){
  let ylist = getSplitNumberArray(min, max, split,average)

  let wc = false  

  do{
    wc = false
    //判断tofixed误差是否超过阈值
    let wc_value = Math.abs(ylist[1] - ylist[0])
    let show_wc_value = Math.abs(dealFloatDecimal(ylist[1], decimal) - ylist[1])
    if(show_wc_value / wc_value > 0.05) wc = true

    if(wc){
      max = dealFloatDecimal(max + Math.pow(10, -decimal), decimal)
      min = dealFloatDecimal(min - Math.pow(10, -decimal), decimal)
      ylist = getSplitNumberArray(min, max, split, average)
    }
  }while (wc)

  let list = ylist.map(v=>{
    return {
      price: parseFloat(v.toFixed(decimal)),
      percent: ((v - average) / average * 100).toFixed(2) + '%'
    }
  })

  return list
}

/**
 * 解决浮点数操作丢失精度问题
 * @param input 
 * @param decimal 
 * @returns 
 */
export function dealFloatDecimal(input: number, decimal: number){
  return parseFloat(input.toFixed(decimal))
}


/**
 * 获取最小值和最大值平分的数字数组，包含中线数字0,利润趋势图用
 * @param min_number 最小值
 * @param max_number 最大值
 * @param split 平分数量 >=0
 * @param average 指定中间值
 */
export function getSplitNumberArrayWithZeroMoney(min_number:number, max_number:number, splitnumber = 3, start = 0){

  const split = splitnumber + 1

  let maxspan = Math.round(max_number)
  let minspan = Math.round(min_number)

  if(minspan > maxspan){
    [minspan, maxspan] = [maxspan, minspan]
  }

  if(minspan > start) minspan = start
  if(maxspan < start) maxspan = start

  let zoom = Math.max(Math.abs(maxspan), Math.abs(minspan)).toString().length - 2
  if(zoom < 0) zoom = 0
  let show_end = Math.round(maxspan / Math.pow(10, zoom))
  let show_start = Math.round(minspan / Math.pow(10, zoom))

  if(show_start >= start){
    while ((show_end - show_start) % split != 0 || !checkArrayHasNumber(show_start, show_end, split, start) ) {
      show_end ++
    }
  }
  else if(show_end <= start){
    while ((show_end - show_start) % split != 0 || !checkArrayHasNumber(show_start, show_end, split, start) ) {
      show_start --
    }
  }
  else{

    //初始化数组
    let initarray = makeArray(show_start, show_end, split + 1) 
    
    //找出第几个最接近start
    let closeindex = getIndexCloseStart(initarray, start)

    let times = getMinTimes(split - closeindex, closeindex) //最小公倍数
    

    if((Math.abs(show_start) - start) / closeindex >= (Math.abs(show_end) - start) / (split - closeindex)){ //左边开始
      while (show_start % times != 0) {
        show_start --
      }
      show_end = start + (Math.abs(show_start) - start) / closeindex * (split - closeindex)
    }
    else{ //右边开始
      while (show_end % times != 0) {
        show_end ++
      }
      show_start = start - (Math.abs(show_end) - start) / (split - closeindex) * closeindex     
    }
  }

  let returnarray = makeArray(show_start, show_end, split + 1).map((v, index)=>{
    return {
      number: v * Math.pow(10, zoom),
      text: getVolumeText(v * Math.pow(10, zoom), 0)
    }
  })

  //检查是否有重复的文字
  returnarray.forEach((v,i)=>{
    if(i > 0){
      if(returnarray[i].text == returnarray[i - 1].text){
        returnarray[i - 1].text = getVolumeText(returnarray[i - 1].number, 1)
        returnarray[i].text = getVolumeText(v.number, 1)
      }
    }
  })

  return returnarray

}

/**
 * 检查均分数组是否含有某个数字
 * @param start 数字开始
 * @param end 数字结束
 * @param split 均分数量
 * @param chechnum 检查的数字
 * @returns 
 */
function checkArrayHasNumber(start: number, end: number, split: number, chechnum: number){
  let span = (end - start) / split

  let result = false

  for (let i = 0; i <= split; i++) {
    if(start + span * i == chechnum){
      result = true
    }
  }
  return result
}

/** 获取数组中离start最近的序号 */
function getIndexCloseStart(array: Array<number>, start: number){
  let index = 1
  for (let i = 2; i < array.length - 1; i++) {
    if(Math.abs(array[i]) - start < Math.abs(array[i - 1]) - start){
      index = i
    }
  }
  return index
}

/** 最小公倍数 */
function getMinTimes(num1: number, num2: number){
  let times = Math.min(num1, num2)
  while (times % num1 != 0 || times % num2 != 0) {
    times++
  }
  return times
}

function makeArray(start: number, end: number, length: number){
  let span = (end - start) / (length - 1)
  return Array.from(new Array(length)).map((v, index)=>{
    return start + span * index
  })
}