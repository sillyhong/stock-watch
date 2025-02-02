/**
 * K线图
 */

// import merge from 'lodash/merge'
import {  getKlineData,  } from "../data/kline"
// import { draw } from "./draw"
// import { fq_type, Kline_Options } from './options'
// import { getCommonDataLoadData, getCommonDataNoLoadData, Kline_CommonData } from './common_data'
// import { event_manager } from '../tools/event'
// import { loading, nodata } from '../loading'
// import { regInteraction } from './interaction'
// import { getAddEndDay } from '../tools/date'
import { dealDataWithData } from './calculate'
// import { debounce } from 'lodash'
// import { KlineInteraction } from './interaction_new'



/** k线图 */
export class kline {

  /** 合并过的选项 */
//   options: Kline_Options

  /** 绘图计算数据 */
//   common_data = {} as any

  /** 绘图canvas对象 */
  canvas!: HTMLCanvasElement

  /** 绘图canvs ctx对象 */
  ctx!: CanvasRenderingContext2D

  /** 行情接口原始数据 */
//   source_data!: SourceData

  /** 处理过的行情数据 */
//   data!: KlineData

  /** 绘图容器 */
  container!: HTMLDivElement 

  /** 事件管理器 */
  event!: event_manager

  /** 数据偏移量 */
  show_offset = 0

  /** 数据切片起始位置 */
  show_start_index = 0

  /** 数据切片结束位置 */
  show_end_index = 0

  /** 信息地雷数据 */
//   infomine_data = null as InfoMineData
  infomine_data_cd !: NodeJS.Timeout

  /** 除权除息数据 */
//   cqcx_data = null as  null | CQCXType
  cqcx_data_cd !: NodeJS.Timeout  
  
  dpr = 1

  drag = false

  infobox_move = false

  /** 点击坐标x */
  click_x = 0

  datacd!: NodeJS.Timer;

  // debounce = {
  //   drawInfoMine: null as any,
  //   drawCqcx: null as any
  // }
  
//   constructor(input_options:any) {

//     //合并参数
//     this.options = merge({}, default_options, input_options)
//     this.common_data.kline_count = this.options.kline_count
//     this.common_data.data_count = this.options.kline_count * 2 + 30
//     this.common_data.show_offset = this.options.show_offset
//     this.show_offset = this.options.show_offset

//     this.options.font = this.options.fontsize + 'px ' + this.options.fontfamily
//     if(window.devicePixelRatio && window.devicePixelRatio > 1){
//       this.dpr = window.devicePixelRatio
//       this.options.width = this.options.width * this.dpr
//       this.options.height = this.options.height * this.dpr
//       this.options.font = this.options.fontsize * this.dpr + 'px ' + this.options.fontfamily
//       this.options.fontsize = this.options.fontsize * this.dpr
//     }

//     this.initDOM()
//   }

  /** 初始化DOM */
//   initDOM(){
//     let container = document.createElement('div')
//     container.className = 'quotechart2022_c'
//     container.style.width = this.options.width / this.dpr + 'px'
//     container.style.height = this.options.height / this.dpr + 'px'
//     container.style.backgroundColor = this.options.background_color
//     // container.appendChild(loading(this.options.height)) //加载中

//     this.container = container
//     document.getElementById(this.options.id)!.innerHTML = ''
//     document.getElementById(this.options.id)!.appendChild(container) 

//     //初始化事件
//     this.event = new event_manager()

//     // if(this.options.infomine){
//     //   this.debounce.drawInfoMine = debounce(()=>{
//     //     infomine(this)
//     //   }, 300, {
//     //     leading: false
//     //   })
//     // }
//     // if(this.options.infomine){
//     //   this.debounce.drawInfoMine = debounce(async()=>{
//     //     return await getInfoMineDataWithCache
//     //   }, 300, {
//     //     leading: false
//     //   })
//     // }

//     // if(this.options.cqcx){
//     //   this.debounce.drawCqcx = debounce(()=>{
//     //     cqcx(this)
//     //   }, 300, {
//     //     leading: false
//     //   })
//     // }

    
//     //注册交互事件
//     if(this.options.interaction){
//       new KlineInteraction(this)
//     }   
//     // if(this.options.interaction){
//     //   regInteraction(this.container, this.event, this.dpr, this.options.width, this.options.height, this)
//     // }
//   }

  /** 获取数据 */
  async getData(){
    const data = await getKlineData(this)

    // if(data != null) this.source_data = data

    //计算和数据相关的数据
    return dealDataWithData(this)

    // //信息地雷
    // if(this.options.cqcx && this.options.type == 'day'){
    //   this.infomine_data = await getInfoMineDataWithCache(this.options.quotecode, )
    // }

    // //除权除息
  }




  /** 加载数据绘图 */
//   async draw(){

//     if(this.options.refresh_time > 0){
//       try {
//         clearInterval(this.datacd)

//         this.datacd = setInterval(()=>{
//           this.getDataDraw()
//         }, this.options.refresh_time * 1000)

//       } catch (error) {
        
//       }
//     }

//     this.getDataDraw()
//   }

//   async getDataDraw(){
//     await this.getData()

//     //如果没有数据
//     if(this.source_data == null ){ //|| this.source_data.klines.length == 0
//       this.container.innerHTML = ''
//       this.container.appendChild(nodata(this.options.height))
//       return false
//     }  

//     getCommonDataLoadData(this)

//     this.reDraw()    
//   }

  /** 不加载数据重绘 */
//   reDraw(){

//     // let timestart = new Date() 

//     dealDataWithoutData(this)

//     // console.info('统计用时1', (new Date()).getTime() - timestart.getTime() , '毫秒')

//     // timestart = new Date() 
//     draw(this)

//     // console.info(this)
    

//     // let timestart = new Date() 

//     // //事件
//     // // this.event = new event_manager()

//     // //获取数据
//     // let data = this.data

//     // //计算通用数据 
//     // this.data = data
//     // // console.info(JSON.stringify(data.full_klines))
     
//     // getCommonData(this)
//     // console.info(this)     

//     // draw(this)

//     // console.info('统计用时2', (new Date()).getTime() - timestart.getTime() , '毫秒')
//   }

//   /** 更改类型 */
//   changeType(totype: kline_type){
//     this.options.type = totype
//     this.draw()
//   }

  /** 更改复权 */
//   changeFQ(totype: fq_type){
//     this.options.fq_type = totype
//     this.draw()
//   }

  /** 更改指标 */
//   changeIndicator(totype: indicator_type){
//     this.options.indicator_type = totype
//     getCommonDataLoadData(this)
//     this.reDraw()
//   }  

  /** 更改主图指标 */
//   changeMainIndicator(totype: main_indicator_type){
//     this.options.main_indicator_type = totype
//     getCommonDataLoadData(this)
//     this.reDraw()
//   }

  /** 放大 缩短 */
//   zoomIn(){
//     this.common_data.kline_count = this.common_data.kline_count - this.options.zoom_step
//     if(this.common_data.kline_count < this.options.kline_min_count){
//       this.common_data.kline_count = this.options.kline_min_count
//     }
//     // this.reDraw()
//     this.debounceReload(true)
//   }

  /** 缩小 拉长 */
//   zoomOut(){
//     let to = this.common_data.kline_count + this.options.zoom_step
//     // console.info('cc', )

//     let x_scale = (this.options.width - this.common_data.x_number_width - 2) / to

//     //
//     if(x_scale < 3.1 * this.dpr) return false

//     this.common_data.kline_count = to
    
//     this.debounceReload(true)
//     // this.reDraw()
//   }

  // //缩短
  // async zoomIn(){
  //   // this.init()
  //   let tocount = Math.round(this.common_data.kline_count / this.options.zoom_step)
  //   if(tocount <= this.options.kline_min_count) tocount = this.options.kline_min_count //最少根
    
  //   if(this.common_data.kline_count == tocount) return false

  //   this.common_data.kline_count = tocount
  //   this.draw() 
  // }

  // //拉长
  // async zoomOut(){

  //   let tocount = Math.round(this.common_data.kline_count * this.options.zoom_step)

  //   //获取数据
  //   let data = await getKlineDataWithCache({
  //     quotecode: this.options.quotecode,
  //     type: this.options.type,
  //     fq_type: this.options.fq_type,
  //     ut: this.options.ut,
  //     count: tocount,
  //     endday: this.options.endday
  //   }, this.options.cache_time)

  //   //如果没有数据
  //   if(data == null){
  //     this.container.innerHTML = ''
  //     this.container.appendChild(nodata(this.options.height))
  //     return false
  //   }

  //   if(tocount > data.full_klines.length){
  //     if(data.full_klines.length > this.options.kline_count) tocount = data.full_klines.length
  //     if(data.full_klines.length < this.options.kline_count && tocount > this.options.kline_count) tocount = this.options.kline_count
  //   }

  //   if(tocount < this.options.kline_min_count) tocount = this.options.kline_min_count
  //   if(tocount > this.common_data.kline_count) this.common_data.kline_count = tocount

  //   this.data = data   
  //   this.reDraw()
  // }

  /** 显示成交量 */
  showVolume(){
    this.options.show_volume = true
    this.reDraw()
  }

  /** 关闭成交量 */
  closeVolume(){
    this.options.show_volume = false
    this.reDraw()
  }

  /** 停止自刷 */
//   stopRefresh(){
//     try {
//       clearInterval(this.datacd)
//     } catch (error) {
      
//     }
//   }

//   async move(lines:number){
//     // console.info('lines',lines)

//     if(lines != 0){

      

//       // this.common_data.show_offset = this.common_data.show_offset + lines
//       // this.common_data.show_offset = lines

//       // console.info(this.common_data.show_offset)

//       let wy = (this.common_data.show_offset == null ? 0 : this.common_data.show_offset) + lines

//       // console.info('wy', wy)
      
//       // if(wy == this.show_offset) return false
      
//       // console.info('wy1', this.common_data.show_offset, wy)

//       // if(wy > 0) return false
//       if(wy > 0) wy = 0

//       if(this.common_data.max_count != null && Math.abs(wy) > ( this.common_data.max_count - this.common_data.kline_count )){
        
//         if(wy < 0 && Math.abs(wy) > ( this.common_data.max_count - this.common_data.kline_count ) ){
//           wy =  this.common_data.kline_count - this.common_data.max_count
//         }
//         else{
//           return false
//         }
//       }
      

//       // console.info('wy',wy)
      


//       // if(this.show_start_index == 0 && this.show_end_index < Math.min(this.common_data.kline_count, this.data.full_klines.length)){
//       //   this.show_end_index = Math.min(this.common_data.kline_count, this.data.full_klines.length)
//       //   wy = this.show_end_index - this.data.full_klines.length
//       //   if(wy == this.show_offset) return false

//       // }

//       this.show_offset = wy      

//       // //@ts-ignore
//       // this.data.klines = this.data.full_klines.slice(this.show_start_index, this.show_end_index)


//       // this.data.klines.forEach((v:any,index:number)=>{
//       //   v.showindex = index
//       // }) 

//       this.reDraw()      
//     }





//     // let lastday = this.data.full_klines[this.data.full_klines.length - 1].date

//     // if(lines > 0){
//     //   let to_day = getAddEndDay(lastday, lines)
//     //   console.info(to_day)
//     // }
//     // else if(lines < 0){
//     //   let todata = this.data.full_klines[this.data.full_klines.length - 1 + lines]
//     //   if(todata != undefined){
//     //     let to_day = todata.date.replace(/-/g, '')
//     //     console.info(to_day)   

//     //     //获取数据
//     //     let data = await getKlineDataWithCache({
//     //       quotecode: this.options.quotecode,
//     //       type: this.options.type,
//     //       fq_type: this.options.fq_type,
//     //       ut: this.options.ut,
//     //       count: this.options.kline_count,
//     //       endday: to_day
//     //     }, this.options.cache_time)

//     //     //如果没有数据
//     //     if(data == null){
//     //       // this.container.innerHTML = ''
//     //       // this.container.appendChild(nodata(this.options.height))
//     //       return false
//     //     }

//     //     // if(tocount > data.full_klines.length){
//     //     //   if(data.full_klines.length > this.options.kline_count) tocount = data.full_klines.length
//     //     //   if(data.full_klines.length < this.options.kline_count && tocount > this.options.kline_count) tocount = this.options.kline_count
//     //     // }

//     //     // if(tocount < this.options.kline_min_count) tocount = this.options.kline_min_count
//     //     // if(tocount > this.common_data.kline_count) this.common_data.kline_count = tocount

//     //     this.data = data   
//     //     this.reDraw()     
//     //   }
  
      
//     // }
//   }

//   clickMove(step: number){
//     this.move(step)
//     this.saveShowOffset()
//   }

//   debounceReload = debounce((redraw = false)=>{
//     let now_data_count = this.common_data.data_count
//     let toshow_data_count = this.common_data.kline_count * 2 + 30 - this.show_offset
//     // console.info(now_data_count, toshow_data_count)
    
//     if(toshow_data_count > now_data_count){
//       this.common_data.data_count = toshow_data_count
//       this.draw()
//     }
//     else if(redraw){
//       this.reDraw()
//     }


//     // if(this.show_offset == show_offset) return false

//   }, 100, {
//     leading: false
//   })

//   saveShowOffset(){
//     this.common_data.show_offset = this.show_offset as number
//     if(this.show_offset < 0){
//       this.debounceReload()
//     }
//   }

  /** 删除所有绘图和附加HTML和相关自刷和DOM事件 */
//   destroy(){
//     this.stopRefresh()
//     try {
//       document.getElementById(this.options.id)?.removeChild(this.container)
//     } catch (error) {
      
//     }
//   }

}
