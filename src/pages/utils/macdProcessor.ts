import dayjs, { Dayjs } from "dayjs";
import { EGlodCrossType } from "./config";

/**
 * MACD趋势状态枚举
 */
export enum MACDTrendState {
  STRONG = '强',                        // DEA上穿零轴后，高位死叉
  EXTREMELY_STRONG = '极强',             // DIF上穿零轴后，到DEA上穿零轴
  MEDIUM_STRONG = '偏强',              // 低位金叉后，DIF第一次上穿零轴(中偏强)
  EXTREMELY_WEAK = '极弱',               // DIF下穿零轴，到DEA下穿零轴
  WEAK = '弱',                          // DEA下穿零轴后到低位金叉
  MEDIUM_WEAK = '偏弱',              // 高位死叉到DIF下穿零轴(中偏弱)
  UNKNOWN = ''                      // 无法判断
}

/**
 * 高级功能：检测MACD金叉（DIFF >= DEA）
 * @param diffValue DIFF值
 * @param deaValue DEA值
 * @returns 是否为金叉
 */
export const checkMACDGoldenCross = (diffValue: number | string, deaValue: number | string): boolean => {
  if (typeof diffValue === 'string' || typeof deaValue === 'string') {
    return false; // 如果值无效，不算金叉
  }
  return diffValue >= deaValue;
};


/**
 * MACD金叉检测参数
 */
export interface IMACDGoldenCrossParams {
    itemTime: Dayjs;
    stockName: string;
    macdData: Array<[string, number | string, number | string, number | string]>;
  }
  
  /**
   * MACD金叉检测结果
   */
  export interface IMACDGoldenCrossResult {
    macdGoldenCross: boolean;
    macdGoldenCrossStr: string;
    trendState?: MACDTrendState;  // 趋势状态
    trendStateEmoji?: string;     // 趋势状态表情符号
  }
  
  /**
   * 判断MACD趋势状态
   * 通过回溯历史数据，判断当前处于6种趋势状态中的哪一种
   * 
   * 状态转换序列（循环）：
   * 弱 → (低位金叉) → 中偏强 → (DIF上穿零轴) → 极强 → (DEA上穿零轴) → 强 → (高位死叉) → 中性偏弱 → (DIF下穿零轴) → 极弱 → (DEA下穿零轴) → 弱
   */
  function determineMACDTrendState(
    currentIndex: number,
    macdData: Array<[string, number | string, number | string, number | string]>,
    lookbackPeriods: number
  ): MACDTrendState {
    // 关键事件标记 - 记录最近一次发生的位置
    let lastLowGoldenCross = -1;      // 最近一次低位金叉位置（DIFF上穿DEA，且都在零轴下方）
    let lastDiffCrossUpZero = -1;     // 最近一次DIF上穿零轴位置
    let lastDeaCrossUpZero = -1;      // 最近一次DEA上穿零轴位置
    let lastHighDeadCross = -1;       // 最近一次高位死叉位置（DIFF下穿DEA，且都在零轴上方）
    let lastDiffCrossDownZero = -1;   // 最近一次DIF下穿零轴位置
    let lastDeaCrossDownZero = -1;    // 最近一次DEA下穿零轴位置

    // 从当前位置向前回溯
    for (let i = 0; i <= lookbackPeriods; i++) {
      const idx = currentIndex - i;
      if (idx < 0) break;
      
      const currentItem = macdData[idx];
      const currentDiff = Number(currentItem[1]);
      const currentDea = Number(currentItem[2]);
      
      // 需要前一个数据点来判断穿越
      if (idx > 0) {
        const prevItem = macdData[idx - 1];
        const prevDiff = Number(prevItem[1]);
        const prevDea = Number(prevItem[2]);
        
        // 检测低位金叉：DIFF上穿DEA，且都在零轴下方
        if (prevDiff < prevDea && currentDiff >= currentDea && currentDiff < 0 && currentDea < 0) {
          if (lastLowGoldenCross === -1) lastLowGoldenCross = idx;
        }
        
        // 检测DIF上穿零轴
        if (prevDiff < 0 && currentDiff >= 0) {
          if (lastDiffCrossUpZero === -1) lastDiffCrossUpZero = idx;
        }
        
        // 检测DEA上穿零轴
        if (prevDea < 0 && currentDea >= 0) {
          if (lastDeaCrossUpZero === -1) lastDeaCrossUpZero = idx;
        }
        
        // 检测高位死叉：DIFF下穿DEA，且都在零轴上方
        if (prevDiff >= prevDea && currentDiff < currentDea && currentDiff > 0 && currentDea > 0) {
          if (lastHighDeadCross === -1) lastHighDeadCross = idx;
        }
        
        // 检测DIF下穿零轴
        if (prevDiff >= 0 && currentDiff < 0) {
          if (lastDiffCrossDownZero === -1) lastDiffCrossDownZero = idx;
        }
        
        // 检测DEA下穿零轴
        if (prevDea >= 0 && currentDea < 0) {
          if (lastDeaCrossDownZero === -1) lastDeaCrossDownZero = idx;
        }
      }
    }

    // 根据关键事件的发生顺序判断当前状态
    // 使用状态机模型：按照状态转换序列，判断当前处于哪两个事件之间
    
    // 收集所有已发生的事件
    const events = [
      { type: 'lowGoldenCross', index: lastLowGoldenCross, order: 1 },
      { type: 'diffCrossUpZero', index: lastDiffCrossUpZero, order: 2 },
      { type: 'deaCrossUpZero', index: lastDeaCrossUpZero, order: 3 },
      { type: 'highDeadCross', index: lastHighDeadCross, order: 4 },
      { type: 'diffCrossDownZero', index: lastDiffCrossDownZero, order: 5 },
      { type: 'deaCrossDownZero', index: lastDeaCrossDownZero, order: 6 }
    ];

    // 过滤出已发生的事件，并按索引降序排序（最近的在前）
    const occurredEvents = events
      .filter(e => e.index !== -1)
      .sort((a, b) => b.index - a.index);

    if (occurredEvents.length === 0) {
      return MACDTrendState.UNKNOWN;
    }

    // 获取最近发生的事件
    const mostRecentEvent = occurredEvents[0];

    // 首先获取当前的DIFF和DEA值，用于验证
    const currentItem = macdData[currentIndex];
    const currentDiff = Number(currentItem[1]);
    const currentDea = Number(currentItem[2]);


    // 根据状态转换序列判断当前状态
    // 关键：需要判断当前处于哪个阶段的"之间"，并且验证与当前位置是否一致
    
    switch (mostRecentEvent.type) {
      case 'lowGoldenCross':
        // 低位金叉后，判断是否已经发生了DIF上穿零轴
        // 验证：1) 当前应该在低位（DIF和DEA都在零轴下方或刚上穿）
        //      2) 当前必须仍然保持金叉状态（DIFF >= DEA）
        if (lastDiffCrossUpZero === -1 || lastDiffCrossUpZero < lastLowGoldenCross) {
          // 验证当前状态是否合理
          const isStillGoldenCross = currentDiff >= currentDea;
          const isValid = currentDiff < 0.5 && isStillGoldenCross;
          if (isValid) {
            return MACDTrendState.MEDIUM_STRONG;
          }
        }
        break;
        
      case 'diffCrossUpZero':
        // DIF上穿零轴后，判断是否已经发生了DEA上穿零轴
        // 验证：1) DIF应该在零轴上方，DEA应该在零轴下方
        //      2) 当前必须仍然保持金叉状态（DIFF >= DEA）
        if (lastLowGoldenCross !== -1 && lastDiffCrossUpZero > lastLowGoldenCross) {
          if (lastDeaCrossUpZero === -1 || lastDeaCrossUpZero < lastDiffCrossUpZero) {
            // 验证当前状态
            const isStillGoldenCross = currentDiff >= currentDea;
            const isValid = currentDiff >= -0.1 && currentDea < 0.5 && isStillGoldenCross;
            if (isValid) {
              return MACDTrendState.EXTREMELY_STRONG;
            }
          }
        }
        break;
        
      case 'deaCrossUpZero':
        // DEA上穿零轴后，判断是否已经发生了高位死叉
        // 验证：1) DIF和DEA应该都在零轴上方
        //      2) 当前必须仍然保持金叉状态（DIFF >= DEA）
        if (lastDiffCrossUpZero !== -1 && lastDeaCrossUpZero > lastDiffCrossUpZero) {
          if (lastHighDeadCross === -1 || lastHighDeadCross < lastDeaCrossUpZero) {
            // 验证当前状态
            const isStillGoldenCross = currentDiff >= currentDea;
            const isValid = currentDiff >= -0.5 && currentDea >= -0.5 && isStillGoldenCross;
            if (isValid) {
              return MACDTrendState.STRONG;
            }
          }
        }
        break;
        
      case 'highDeadCross':
        // 高位死叉后，判断是否已经发生了DIF下穿零轴
        // 验证：1) 应该还在零轴上方或刚下穿
        //      2) 当前必须仍然保持死叉状态（DIFF < DEA）
        if (lastDeaCrossUpZero !== -1 && lastHighDeadCross > lastDeaCrossUpZero) {
          if (lastDiffCrossDownZero === -1 || lastDiffCrossDownZero < lastHighDeadCross) {
            // 验证当前状态
            const isStillDeadCross = currentDiff < currentDea;
            const isValid = currentDiff >= -0.5 && isStillDeadCross;
            if (isValid) {
              return MACDTrendState.MEDIUM_WEAK;
            }
          }
        }
        break;
        
      case 'diffCrossDownZero':
        // DIF下穿零轴后，判断是否已经发生了DEA下穿零轴
        // 验证：1) DIF应该在零轴下方，DEA应该在零轴上方或刚下穿
        //      2) 当前必须仍然保持死叉状态（DIFF < DEA）
        if (lastHighDeadCross !== -1 && lastDiffCrossDownZero > lastHighDeadCross) {
          if (lastDeaCrossDownZero === -1 || lastDeaCrossDownZero < lastDiffCrossDownZero) {
            // 验证当前状态
            const isStillDeadCross = currentDiff < currentDea;
            const isValid = currentDiff < 0.5 && currentDea >= -0.5 && isStillDeadCross;
            if (isValid) {
              return MACDTrendState.EXTREMELY_WEAK;
            }
          }
        }
        break;
        
      case 'deaCrossDownZero':
        // DEA下穿零轴后，判断是否已经发生了低位金叉
        // 验证：1) DIF和DEA应该都在零轴下方
        //      2) 当前必须仍然保持死叉状态（DIFF < DEA）
        if (lastDiffCrossDownZero !== -1 && lastDeaCrossDownZero > lastDiffCrossDownZero) {
          if (lastLowGoldenCross === -1 || lastLowGoldenCross < lastDeaCrossDownZero) {
            // 验证当前状态
            const isStillDeadCross = currentDiff < currentDea;
            const isValid = currentDiff < 0.5 && currentDea < 0.5 && isStillDeadCross;
            if (isValid) {
              return MACDTrendState.WEAK;
            }
          }
        }
        break;
    }

    // 如果上述条件都不满足（包括验证失败的情况），
    // 根据当前DIFF和DEA的位置关系直接判断基础状态
    // 这是最可靠的兜底逻辑
    if (currentDiff < 0 && currentDea < 0) {
      // 都在零轴下方
      return currentDiff >= currentDea ? MACDTrendState.MEDIUM_STRONG : MACDTrendState.WEAK;
    } else if (currentDiff >= 0 && currentDea >= 0) {
      // 都在零轴上方
      return currentDiff >= currentDea ? MACDTrendState.STRONG : MACDTrendState.MEDIUM_WEAK;
    } else if (currentDiff >= 0 && currentDea < 0) {
      // DIF在零轴上方，DEA在零轴下方
      return MACDTrendState.EXTREMELY_STRONG;
    } else {
      // DIF在零轴下方，DEA在零轴上方（极少见情况）
      return MACDTrendState.EXTREMELY_WEAK;
    }
  }

  /**
   * 获取趋势状态对应的表情符号
   */
  function getTrendStateEmoji(state: MACDTrendState): string {
    switch (state) {
      case MACDTrendState.EXTREMELY_STRONG:
        return '🔥🔥🔥'; // 极强
      case MACDTrendState.STRONG:
        return '🔥🔥';   // 强
      case MACDTrendState.MEDIUM_STRONG:
        return '🔥';     // 偏强
      case MACDTrendState.EXTREMELY_WEAK:
        return '❄️❄️❄️';   // 极弱
      case MACDTrendState.WEAK:
        return '❄️❄️';     // 弱
      case MACDTrendState.MEDIUM_WEAK:
        return '❄️';     // 偏弱
      default:
        return '❓';     // 未知
    }
  }

  /**
   * 检测MACD首次金叉和趋势状态
   * @param params MACD金叉检测参数
   * @returns MACD金叉检测结果
   */
  export function detectMACDFirstGoldenCross(params: IMACDGoldenCrossParams): IMACDGoldenCrossResult {
    const { itemTime, macdData } = params;
    
    let macdGoldenCross = false;
    let macdGoldenCrossStr = '';
    let trendState: MACDTrendState = MACDTrendState.UNKNOWN;
    let trendStateEmoji = '';
  
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD检测] ${stockName} 开始检测 时间:${itemTime.format('YYYY-MM-DD HH:mm')} MACD数据量:${macdData.length}`);
  
    // 找到当前时间点在MACD数据中的索引
    const currentMacdIndex = macdData.findIndex((macdItem) => 
      dayjs(macdItem[0] as string).isSame(itemTime, 'minute')
    );
    
    if (currentMacdIndex === -1) {
      // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD检测] ${stockName} 未找到当前时间点的MACD数据`);
      return { macdGoldenCross, macdGoldenCrossStr };
    }
  
    const currentMacdItem = macdData[currentMacdIndex];
    const currentDiffValue = Number(currentMacdItem[1]); // DIFF是第2个值（索引1）
    const currentDeaValue = Number(currentMacdItem[2]);  // DEA是第3个值（索引2）
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD检测] ${stockName} 当前MACD DIFF:${currentDiffValue.toFixed(4)} DEA:${currentDeaValue.toFixed(4)} 索引位置:${currentMacdIndex}`);
    
    // 检查当前是否金叉
    macdGoldenCross = checkMACDGoldenCross(currentDiffValue, currentDeaValue);
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD检测] ${stockName} 金叉检测结果: ${macdGoldenCross ? '金叉' : '非金叉'} (DIFF ${macdGoldenCross ? '>=' : '<'} DEA)`);
    
    // 回溯7个时间段判断趋势状态（TODO: 设计算法找出将要金叉的情况，金叉只管3根线）
    const lookbackPeriods = Math.min(7, currentMacdIndex);
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD趋势] ${stockName} 开始趋势分析，回溯周期数:${lookbackPeriods}`);
    
    trendState = determineMACDTrendState(currentMacdIndex, macdData, lookbackPeriods);
    trendStateEmoji = getTrendStateEmoji(trendState);
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD趋势] ${stockName} 趋势状态: ${trendState} ${trendStateEmoji}`);
    
    // 只有当前是金叉状态，才需要检查是否首次金叉
    if (!macdGoldenCross) {
      macdGoldenCrossStr = trendStateEmoji;
      
      return { 
        macdGoldenCross, 
        macdGoldenCrossStr,
        trendState,
        trendStateEmoji
      };
    }
  
    // 检查前7个时间段是否有金叉记录
    let isFirstGoldenCross = true;
    
    // console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] [MACD检测] ${stockName} 开始回溯检查首次金叉`);
    
    for (let i = 1; i <= lookbackPeriods; i++) {
      const prevIndex = currentMacdIndex - i;
      const prevMacdItem = macdData[prevIndex];
      const prevDiffValue = Number(prevMacdItem[1]);
      const prevDeaValue = Number(prevMacdItem[2]);
      
      const prevGoldenCross = checkMACDGoldenCross(prevDiffValue, prevDeaValue);
      
      // 如果之前已经是金叉状态（DIFF >= DEA），则不是首次金叉
      if (prevGoldenCross) {
        isFirstGoldenCross = false;
        break;
      }
    }
    
    // 构建高级功能字符串
    if (isFirstGoldenCross && macdGoldenCross) {
      macdGoldenCrossStr = ` 🚀${EGlodCrossType.FISRT_GOLDEN_CROSS} ${trendStateEmoji}${trendState}`;
    } else if(macdGoldenCross){
      macdGoldenCrossStr = ` 🚀${EGlodCrossType.LATEST_GOLDEN_CROSS} ${trendStateEmoji}${trendState}`;
    } 
  
    return { 
      macdGoldenCross, 
      macdGoldenCrossStr,
      trendState,
      trendStateEmoji
    };
  }