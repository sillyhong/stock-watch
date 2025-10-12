import dayjs, { Dayjs } from "dayjs";
import { EMA55BreadType } from "./config";

/**
 * 高级功能：检查当前价格是否大于等于MA55
 * @param currentPrice 当前价格
 * @param ma55Value MA55值
 * @returns 是否通过MA55过滤
 */
export const checkMA55Filter = (currentPrice: number, ma55Value: number | string): boolean => {
    if (typeof ma55Value === 'string' || ma55Value === 0) {
      return false; // 如果MA55无效，不过滤
    }
    return currentPrice >= ma55Value;
  };
  

/**
 * MA55突破检测参数
 */
interface IMA55BreakthroughParams {
    itemTime: Dayjs;
    currentPrice: number;
    stockName: string;
    ma55Data: Array<[string, number | string, number | string, number | string, number | string, number | string, number | string]>;
    RSIData: { full_klines: Record<string, unknown>[] };
  }
  
  /**
   * MA55突破检测结果
   */
  interface IMA55BreakthroughResult {
    ma55BreakThrough: boolean;
    ma55BreadBreakthrough: string;
  }
  
  /**
   * 检测MA55首次突破
   * @param params MA55突破检测参数
   * @returns MA55突破检测结果
   */
  export function detectMA55FirstBreakthrough(params: IMA55BreakthroughParams): IMA55BreakthroughResult {
    const { itemTime, currentPrice, stockName, ma55Data, RSIData } = params;
    
    let ma55BreakThrough = false;
    let ma55BreadBreakthrough = '';
  
  
    // 找到当前时间点在MA55数据中的索引
    const currentMa55Index = ma55Data.findIndex((maItem) => 
      dayjs(maItem[0] as string).isSame(itemTime, 'minute')
    );
    
    if (currentMa55Index === -1) {
      return { ma55BreakThrough, ma55BreadBreakthrough };
    }
  
    const currentMa55Item = ma55Data[currentMa55Index];
    const currentMa55Value = Number(currentMa55Item[4]); // MA55是第5个值（索引4）
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MA55检测] ${stockName} 当前MA55值:${currentMa55Value.toFixed(2)} 索引位置:${currentMa55Index}`);
    
    // 检查当前价格是否突破MA55
    ma55BreakThrough = checkMA55Filter(currentPrice, currentMa55Value);
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MA55检测] ${stockName} 突破检测结果: ${ma55BreakThrough ? '已突破' : '未突破'} (${currentPrice.toFixed(2)} ${ma55BreakThrough ? '>=' : '<'} ${currentMa55Value.toFixed(2)})`);
    
    // 只有当前突破了MA55，才需要检查是否首次突破
    if (!ma55BreakThrough) {
      return { ma55BreakThrough, ma55BreadBreakthrough };
    }
  
    // 检查前15个时间段是否有突破记录
    let isFirstBreakthrough = true;
    const lookbackPeriods = Math.min(5, currentMa55Index); // 最多回溯5个周期
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MA55检测] ${stockName} 开始回溯检查，回溯周期数:${lookbackPeriods}`);
    
    for (let i = 1; i <= lookbackPeriods; i++) {
      const prevIndex = currentMa55Index - i;
      const prevMa55Item = ma55Data[prevIndex];
      const prevMa55Value = Number(prevMa55Item[4]);// MA55是第5个值（索引4）
      
      // 查找对应时间点的K线价格
      const prevKline = RSIData.full_klines.find((klineItem: Record<string, unknown>) => 
        dayjs(klineItem.date as string).isSame(dayjs(prevMa55Item[0] as string), 'minute')
      );
      
      if (prevKline) {
        const prevPrice = Number(prevKline.close);
        const prevBreakthrough = checkMA55Filter(prevPrice, prevMa55Value);
        
        // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MA55检测] ${stockName} 回溯${i}期 时间:${dayjs(prevMa55Item[0] as string).format('HH:mm')} 价格:${prevPrice.toFixed(2)} MA55:${prevMa55Value.toFixed(2)} ${prevBreakthrough ? '✓已突破' : '✗未突破'}`);
        
        // 如果之前已经突破过MA55，则不是首次突破
        if (prevBreakthrough) {
          isFirstBreakthrough = false;
          // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MA55检测] ${stockName} 发现历史突破，非首次突破`);
          break;
        }
      }
    }
    
    // 只有首次突破才标记
    if (isFirstBreakthrough && ma55BreakThrough) {
      ma55BreadBreakthrough = `🚀${EMA55BreadType.FISRT_BREAK_THROUGH}`;
      // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [高级功能] ⭐⭐⭐ ${stockName} 首次突破MA55: 价格${currentPrice.toFixed(2)} > MA55(${currentMa55Value.toFixed(2)}) ⭐⭐⭐`);
    } else if(ma55BreakThrough) {
      ma55BreadBreakthrough = `🚀${EMA55BreadType.LATEST_BREAK_THROUGH}`;
    }
  
    return { ma55BreakThrough, ma55BreadBreakthrough };
  }