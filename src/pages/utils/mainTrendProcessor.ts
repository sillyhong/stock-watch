import dayjs from "dayjs";
import axios from 'axios';
import { formatKlinesData } from './formatKlines';
import { GetConvert } from '@/modules/tools/indicator/old';
import { 
  IMainTrendConditionConfig, 
  DEFAULT_MAIN_TREND_CONFIG, 
  getMAIndexByPeriod,
  getKlineTypeDescription 
} from './mainTrendConfig';
import {
  ACCEPT_LANGUAGES,
  ACCEPTS,
  COOKIES,
  REFERERS,
  getRandomUserAgent,
  getRandomUserToken,
  randomDelay,
  randomFromArray,
  randomIP,
} from './header';
import { calculateChipConcentrationDetails } from './config';
import { a_beijiaosuo_cn } from '../data/astock/beijiaosuo';
import { EStockType } from '../interface';

/**
 * 主涨段检测结果
 */
export interface IMainTrendResult {
  stockCode: string;
  stockName: string;
  currentPrice: number;
  checkTime: string;
  
  // 条件1: MACD金叉
  macdGoldenCross: boolean;
  macdDiff: number | string;
  macdDea: number | string;
  macdDescription: string;
  
  // 条件2: MA均线
  aboveMA: boolean;
  maValue: number | string;
  maDescription: string;
  
  // 条件3: BOLL中轨
  aboveBollMid: boolean;
  bollMid: number | string;
  bollCurrent: number | string;
  bollDescription: string;

  // 日筹码集中度
  dailyChipConcentration: number | string;
  dailyChipConcentrationIncreasing: boolean;
  dailyChipConcentrationTrend: number[];
  
  // 综合判断
  isMainTrend: boolean;
  
  // 配置信息
  configName: string;
}

const EASTMONEY_CIRCUIT_BREAK_ERROR = 'EASTMONEY_CIRCUIT_BREAK';
let eastmoneyCircuitOpen = false;

function resetEastmoneyCircuit() {
  eastmoneyCircuitOpen = false;
}

function openEastmoneyCircuit() {
  eastmoneyCircuitOpen = true;
}

function isEastmoneyCircuitBreakError(error: unknown): boolean {
  const errorText = [
    error instanceof Error ? error.message : '',
    typeof error === 'string' ? error : '',
    JSON.stringify(error),
    String(error),
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '',
  ].join(' ');
  return (
    errorText.includes(EASTMONEY_CIRCUIT_BREAK_ERROR) ||
    errorText.includes('socket hang up') ||
    errorText.includes('ECONNRESET')
  );
}

function buildEastmoneyHeaders() {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': randomFromArray(ACCEPTS),
    'Accept-Language': randomFromArray(ACCEPT_LANGUAGES),
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Origin': 'https://quote.eastmoney.com',
    'Referer': randomFromArray(REFERERS),
    'Connection': 'keep-alive',
    // cookie引起的socket hang up
    // 'Cookie': randomFromArray(COOKIES),
    'Cookie': 'qgqp_b_id=b898f5e6ae213256636d2ac010423889; st_nvi=T8VaEUWdkb_sskT2hfMVzadd2; quote_lt=1; nid18=0f38fc1a4d417dd2a32a0335f8de07eb; nid18_create_time=1774771880634; gviem=u91aImC1GZZFwv7Anax-va67a; gviem_create_time=1774771880634; emshistory=%5B%22000725%22%2C%22%E5%B8%9D%E7%A7%91%E8%82%A1%E4%BB%BD%22%5D; mtp=1; ct=FTL0qafJAyvTd7cLLCw2yGK7xK36FhHbA5IpNz66TbjbrD0HmbWxMYzIKIoUhdbuY9fR2w16MMx-7bnxa_GvTnqEGJLSnNgng0Co4SK-R9TgqgeSV3INAJQHSCEyfQc_6vFOYLzWYVX2_ECIXeX19UtVACmho9Jq_xWdDdEzhO8; ut=FobyicMgeV4zP63_B6e5XMcasMYUTUdXFriGH84GknZuJwoBF4JKaI0OXzKaSOdteSdXV7ZEKyHH5jefGM8OBnWYuR-EbeuDPWkiRaHqZxUvkXKpzfU7WSMdtXBzA36O1loBJ-z3AwWeB3S1la9fnS7efa-kULdG21wN6qMzhLyjsAS3NReFLzbsnJ_5k2PzNmQVfKLEMQayrbJyibVC3DheLLvguKdsDojDMU1UCG818rUFoTkDzXNgyQUoOPc50iR5bjP2CWVh6z9i20e9jMWQsq_Ymv7URFUtdnWjt9FXGKjxDjvPuRCacBZ1JfDp7WoVMgqzTBsedh6GhW2TYbkiY2g2PLpAGN2gabI9fY0yfYG_ptGCaF4otdGGW2zmz6DXpszm9crCJzBOnkp_uEbyvx-2ShzoW42jC221cLM4yEfvpyPL4har8_JkOAzXTEc6boM4n7QDlTY7D3gxta5RQogCQqalK531DI0WlXE4on6h20G6ydDqHTOPOOhLpgc4KWVzGEQ; pi=1181325662278720%3Ba1181325662278720%3B%E9%87%91%E5%8F%89%E9%A9%BE55%E7%BA%BF%3BG9LXinD5cq0tMk4YHqvW7rW6rOTW9RM1MNpN%2BybYIGDs3TA1F0bRlnXfWwO2vJqwPoP9SA%2FbAEgJ6pjO3AxYeqv8FJ2rQIzRzImpUNEahBx7lCkHBud%2FpOM5z%2FjYG0A44U3dmASZ7UtFrVka2QW34nxh%2BumYx0Nc6C3vkZZim%2BmjfKfIEvYkZMAPiQQVmU%2BuldRrGhmQ%3BG7DHaR3t8WX0MHiPoUkRkOgscHc3shcAtt91lqXPUTvCJ1BeOhnB6wsKdnCoEb9GfAKe8qILfKHWcTSDJSiuBJeD4XLtHUOsO%2BPUB%2F5zdCZCSj5RPJBzTzaVAipKAmbQrD1A3KJUwwYu9RJQ06b%2FmS7XCyA%2B4Q%3D%3D; uidal=1181325662278720%e9%87%91%e5%8f%89%e9%a9%be55%e7%ba%bf; sid=138013372; vtpst=|; st_si=81781159463632; st_pvi=01848825546785; st_sp=2026-01-14%2017%3A24%3A13; st_inirUrl=https%3A%2F%2Fwx.mail.qq.com%2F; st_sn=1; st_psi=20260616165156921-111000300841-7981005574; st_asi=delete; fullscreengg=1; fullscreengg2=1; wsc_checkuser_ok=1',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'X-Forwarded-For': randomIP(),
    'X-Real-IP': randomIP(),
  };
}

/**
 * 获取股票数据的通用函数
 * @param secid 股票代码（格式：市场代码.股票代码，如 0.300033）
 * @param klt K线周期类型（101=日线, 102=周线, 103=月线, 60=60分钟, 15=15分钟等）
 * @param lmt 返回数据条数限制
 * @param fqt 复权类型（0=不复权, 1=前复权, 2=后复权）
 */
async function fetchStockData(
  secid: string,
  klt: number,
  lmt: number,
  fqt: number = 1
) {
  if (eastmoneyCircuitOpen) {
    throw new Error(EASTMONEY_CIRCUIT_BREAK_ERROR);
  }

  await randomDelay(200, 600);

  const endDate = dayjs().format('YYYYMMDD');
  const userToken = getRandomUserToken();
  const requestTs = Date.now();
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&ut=${userToken}&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6%2Cf7%2Cf8&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58%2Cf59%2Cf60%2Cf61%2Cf62%2Cf63%2Cf64&klt=${klt}&fqt=${fqt}&end=${endDate}&lmt=${lmt}&_=${requestTs}`;
  const headers = buildEastmoneyHeaders()
  
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers,
    });
    
    return response?.data?.data;
  } catch (error) {
    const errorJSON = JSON.stringify(error);
    console.error(`获取股票数据失败 (secid=${secid}, klt=${klt}),url=${url}:`, errorJSON.substring(0, 200), 'headers', headers);
    if (isEastmoneyCircuitBreakError(error)) {
      openEastmoneyCircuit();
      throw new Error(EASTMONEY_CIRCUIT_BREAK_ERROR);
    }
    return null;
  }
}

/**
 * 检查MACD是否金叉（可配置周期）
 * @param secid 股票代码
 * @param klt K线周期
 * @param lmt 数据条数
 * @param fqt 复权类型
 * @returns { isGoldenCross: boolean, diff: number, dea: number }
 */
async function checkMacdGoldenCross(secid: string, klt: number, lmt: number, fqt: number) {
  try {
    const sourceData = await fetchStockData(secid, klt, lmt, fqt);
    
    if (!sourceData || !sourceData.klines) {
      return { isGoldenCross: false, diff: '--', dea: '--' };
    }
    
    // 格式化数据
    const formattedData = formatKlinesData(sourceData);
    const klinesData = formattedData.full_klines;
    
    // 计算MACD
    const macdData = GetConvert('MACD', klinesData) as Array<[string, number | string, number | string, number | string]>;
    
    if (!macdData || macdData.length === 0) {
      return { isGoldenCross: false, diff: '--', dea: '--' };
    }
    
    // 获取最新一条数据（数组最后一个元素）
    const latestMacd = macdData[macdData.length - 1];
    const latestSecondMacd = macdData[macdData.length - 2];
    const diff = Number(latestMacd[1]); // DIFF值
    const dea = Number(latestMacd[2]);  // DEA值
    const latestMdata = Number(latestMacd[3]);  // Modal值
    const latestSecondMdata = Number(latestSecondMacd[3]);  // Modal值
    
    // 金叉：DIFF > DEA
    const isLineGoldenCross = diff > dea;
    const isModalGoldenCross = latestMdata > latestSecondMdata || latestSecondMdata == latestMdata
    const isGoldenCross = isLineGoldenCross && isModalGoldenCross
    // console.log("🚀 ~ checkMacdGoldenCross ~ secid:", secid, 'diff',diff, 'dea',dea, 'latestMdata', latestMdata, 'latestSecondMdata',latestSecondMdata, 'isGoldenCross',isGoldenCross)
    
    return { isGoldenCross, diff, dea };
  } catch (error) {
    console.error(`检查MACD金叉失败 (klt=${klt}):`, error);
    if (isEastmoneyCircuitBreakError(error)) {
      throw new Error(EASTMONEY_CIRCUIT_BREAK_ERROR);
    }
    return { isGoldenCross: false, diff: '--', dea: '--' };
  }
}

/**
 * 检查是否在MA均线上方（可配置周期和均线）
 * @param secid 股票代码
 * @param klt K线周期
 * @param period MA周期（5/10/20/55/255）
 * @param lmt 数据条数
 * @param fqt 复权类型
 * @returns { isAbove: boolean, currentPrice: number, maValue: number, stockName: string }
 */
async function checkMA(secid: string, klt: number, period: number, lmt: number, fqt: number) {
  try {
    const sourceData = await fetchStockData(secid, klt, lmt, fqt);
    
    if (!sourceData || !sourceData.klines) {
      return { isAbove: false, currentPrice: 0, maValue: '--', stockName: '' };
    }
    
    // 提取股票真实名称
    const stockName = sourceData.name || '';
    
    // 格式化数据
    const formattedData = formatKlinesData(sourceData);
    const klinesData = formattedData.full_klines;
    
    // 计算MA
    const maData = GetConvert('MA', klinesData) as Array<[string, number | string, number | string, number | string, number | string, number | string, number | string]>;
    
    if (!maData || maData.length === 0) {
      return { isAbove: false, currentPrice: 0, maValue: '--', stockName };
    }
    
    // 获取最新一条数据
    const latestMa = maData[maData.length - 1];
    const maIndex = getMAIndexByPeriod(period);
    const maValue = Number(latestMa[maIndex]);
    
    // 获取当前价格（从最新的K线数据）
    const latestKline = klinesData[klinesData.length - 1] as Record<string, unknown>;
    const currentPrice = Number(latestKline.close);
    
    // 判断：当前价格 > MA
    const isAbove = currentPrice > maValue;
    
    return { isAbove, currentPrice, maValue, stockName };
  } catch (error) {
    console.error(`检查MA失败 (klt=${klt}, period=${period}):`, error);
    if (isEastmoneyCircuitBreakError(error)) {
      throw new Error(EASTMONEY_CIRCUIT_BREAK_ERROR);
    }
    return { isAbove: false, currentPrice: 0, maValue: '--', stockName: '' };
  }
}

/**
 * 检查是否在BOLL中轨上方（可配置周期）
 * @param secid 股票代码
 * @param klt K线周期
 * @param lmt 数据条数
 * @param fqt 复权类型
 * @returns { isAbove: boolean, current: number, mid: number }
 */
async function checkBoll(secid: string, klt: number, lmt: number, fqt: number) {
  try {
    const sourceData = await fetchStockData(secid, klt, lmt, fqt);
    
    if (!sourceData || !sourceData.klines) {
      return { isAbove: false, current: 0, mid: '--' };
    }
    
    // 格式化数据
    const formattedData = formatKlinesData(sourceData);
    const klinesData = formattedData.full_klines;
    
    // 计算BOLL
    const bollData = GetConvert('BOLL', klinesData) as Array<[string, number | string, number | string, number | string]>;
    
    if (!bollData || bollData.length === 0) {
      return { isAbove: false, current: 0, mid: '--' };
    }
    
    // 获取最新三条条数据
    const latestBoll = bollData[bollData.length - 1];
    const secondToLastBoll = bollData[bollData.length - 2];
    const thirdToLastBoll = bollData[bollData.length - 3];
    const fourthToLastBoll = bollData[bollData.length - 4];
    const fifthToLastBoll = bollData[bollData.length - 5];
    const sixthToLastBoll = bollData[bollData.length - 6];
    const tenthToLastBoll = bollData[bollData.length - 10];
    /* 
        [
        "2026-02-13 15:00",
        346.243,
        355.91,
        336.575
        ]
    */
    const bollMid = Number(latestBoll[1]);   // 中轨
    const secondToLastBollMid = Number(secondToLastBoll[1]);   // 中轨
    const thirdToLastbollMid = Number(thirdToLastBoll[1]);   // 中轨
    const fouthToLastbollMid = Number(fourthToLastBoll[1]);   // 中轨
    const fifthToLastbollMid = Number(fifthToLastBoll[1]);   // 中轨
    const sixthToLastbollMid = Number(sixthToLastBoll[1]);   // 中轨
    const tehthToLastbollMid = Number(tenthToLastBoll[1]);   // 中轨
    
    // 获取当前价格
    const latestKline = klinesData[klinesData.length - 1] as Record<string, unknown>;
    const secondToLatestKline = klinesData[klinesData.length - 2] as Record<string, unknown>;
    const thirdToLatestKline = klinesData[klinesData.length - 3] as Record<string, unknown>;
    const fouthToLatestKline = klinesData[klinesData.length - 4] as Record<string, unknown>;
    const fifthToLatestKline = klinesData[klinesData.length - 5] as Record<string, unknown>;
    const sixthToLatestKline = klinesData[klinesData.length - 6] as Record<string, unknown>;
    const tenthToLatestKline = klinesData[klinesData.length - 10] as Record<string, unknown>;

    const currentPrice = Number(latestKline.close);
    const secondPrice = Number(secondToLatestKline.close);
    const thirdPrice = Number(thirdToLatestKline.close);
    const fouthPrice = Number(fouthToLatestKline.close);
    const fifthPrice = Number(fifthToLatestKline.close);
    const sixthPrice = Number(sixthToLatestKline.close);
    const tenthPrice = Number(tenthToLatestKline.close);
    
    // 判断：当前价格 > BOLL中轨
    const isAbove = currentPrice >= bollMid 
    && secondPrice >= secondToLastBollMid 
    && thirdPrice >= thirdToLastbollMid
    && fouthPrice >= fouthToLastbollMid
    && fifthPrice >= fifthToLastbollMid
    && sixthPrice >= sixthToLastbollMid
    && tenthPrice >= tehthToLastbollMid;
    
    return { isAbove, current: currentPrice, mid: bollMid };
  } catch (error) {
    console.error(`检查BOLL失败 (klt=${klt}):`, error);
    if (isEastmoneyCircuitBreakError(error)) {
      throw new Error(EASTMONEY_CIRCUIT_BREAK_ERROR);
    }
    return { isAbove: false, current: 0, mid: '--' };
  }
}

async function checkDailyChipConcentration(secid: string, lmt: number = 320, fqt: number = 1) {
  try {
    const sourceData = await fetchStockData(secid, 101, lmt, fqt);

    if (!sourceData || !sourceData.klines) {
      return {
        isIncreasing: false,
        latestConcentration: '--' as number | string,
        concentrationTrend: [] as number[],
      };
    }

    const formattedData = formatKlinesData(sourceData);
    const { isIncreasing, latestConcentration, concentrationTrend } = calculateChipConcentrationDetails(formattedData);

    return {
      isIncreasing,
      latestConcentration: latestConcentration == null ? '--' : latestConcentration,
      concentrationTrend,
    };
  } catch (error) {
    console.error('检查日筹码集中度失败:', error);
    if (isEastmoneyCircuitBreakError(error)) {
      throw new Error(EASTMONEY_CIRCUIT_BREAK_ERROR);
    }
    return {
      isIncreasing: false,
      latestConcentration: '--' as number | string,
      concentrationTrend: [] as number[],
    };
  }
}

/**
 * 格式化股票名称（添加特殊标识）
 * @param stockName 原始股票名称
 * @param stockCode 股票代码
 * @returns 格式化后的股票名称
 */
function formatStockName(stockName: string, stockCode: string): string {
  // 添加北交所标识
  let formattedName = a_beijiaosuo_cn.includes(stockName) 
    ? `[北]${stockName}` 
    : stockName;
  
  // 添加创业板/科创板标识
  if (stockCode.startsWith('300') || stockCode.startsWith('688')) {
    formattedName = `[创]${formattedName}`;
  }
  
  return formattedName;
}

/**
 * 检测股票是否处于主涨段（串行检测，优化性能）
 * 
 * 检测顺序：
 * 1. 先检查MACD金叉，不符合直接返回
 * 2. 再检查MA均线，不符合直接返回
 * 3. 最后检查BOLL中轨，不符合直接返回
 * 
 * @param stockCode 股票代码（如：300033）
 * @param stockName 股票名称（仅用于日志，实际会从API获取真实名称）
 * @param config 主涨段条件配置（可选，默认使用A股日线主涨段配置）
 * @returns 主涨段检测结果
 */
export async function detectMainTrend(
  stockCode: string,
  stockName: string,
  config?: IMainTrendConditionConfig
): Promise<IMainTrendResult> {
  // 如果没有传入配置，使用A股的默认配置
  const finalConfig = config || DEFAULT_MAIN_TREND_CONFIG[EStockType.A];
  const secid = `${stockCode}`;
  const checkTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  
  console.log(`\n========== 开始检测主涨段 [${finalConfig.name}] ========== 股票: ${stockName} (${stockCode}) 检测时间: ${checkTime}` );
  
  // 初始化返回结果（默认为不符合）
  const result: IMainTrendResult = {
    stockCode,
    stockName,
    currentPrice: 0,
    checkTime,
    
    macdGoldenCross: false,
    macdDiff: '--',
    macdDea: '--',
    macdDescription: finalConfig.macd.description,
    
    aboveMA: false,
    maValue: '--',
    maDescription: finalConfig.ma.description,
    
    aboveBollMid: false,
    bollMid: '--',
    bollCurrent: '--',
    bollDescription: finalConfig.boll.description,

    dailyChipConcentration: '--',
    dailyChipConcentrationIncreasing: false,
    dailyChipConcentrationTrend: [],
    
    isMainTrend: false,
    configName: finalConfig.name
  };
  
  // ========== 条件1: 检查MACD金叉 ==========
  // console.log(`\n检查条件1: ${finalConfig.macd.description}...`);
  const macdResult = await checkMacdGoldenCross(
    secid, 
    finalConfig.macd.klt, 
    finalConfig.macd.lmt, 
    finalConfig.macd.fqt
  );
  
  result.macdGoldenCross = macdResult.isGoldenCross;
  result.macdDiff = macdResult.diff;
  result.macdDea = macdResult.dea;
  
  // console.log(`条件1结果: ${macdResult.isGoldenCross ? '✓ 符合' : '✗ 不符合'} (DIFF=${macdResult.diff}, DEA=${macdResult.dea})`);
  
  // 如果MACD不符合，直接返回
  if (!macdResult.isGoldenCross) {
    console.log(`\n❌ MACD金叉不符合，跳过后续检查`);
    return result;
  }
  
  // ========== 条件2: 检查MA均线 ==========
  // console.log(`\n检查条件2: ${finalConfig.ma.description}...`);
  const maResult = await checkMA(
    secid, 
    finalConfig.ma.klt, 
    finalConfig.ma.period, 
    finalConfig.ma.lmt, 
    finalConfig.ma.fqt
  );
  
  result.aboveMA = maResult.isAbove;
  result.maValue = maResult.maValue;
  result.currentPrice = maResult.currentPrice;
  
  // 更新为真实的股票名称并格式化（添加前缀）
  if (maResult.stockName) {
    result.stockName = formatStockName(maResult.stockName, stockCode);
    console.log(`真实股票名称: ${result.stockName}`);
  }
  
  // console.log(`条件2结果: ${maResult.isAbove ? '✓ 符合' : '✗ 不符合'} (价格=${maResult.currentPrice}, MA${finalConfig.ma.period}=${maResult.maValue})`);
  
  // 如果MA不符合，直接返回
  if (!maResult.isAbove) {
    console.log(`\n❌ MA${finalConfig.ma.period}不符合，跳过后续检查`);
    return result;
  }
  
  // ========== 条件3: 检查BOLL中轨 ==========
  // console.log(`\n检查条件3: ${finalConfig.boll.description}...`);
  const bollResult = await checkBoll(
    secid, 
    finalConfig.boll.klt, 
    finalConfig.boll.lmt, 
    finalConfig.boll.fqt
  );
  
  result.aboveBollMid = bollResult.isAbove;
  result.bollMid = bollResult.mid;
  result.bollCurrent = bollResult.current;

  const chipResult = await checkDailyChipConcentration(
    secid,
    finalConfig.ma.klt === 101 ? finalConfig.ma.lmt : 320,
    finalConfig.ma.fqt
  );
  result.dailyChipConcentrationIncreasing = chipResult.isIncreasing;
  result.dailyChipConcentration = chipResult.latestConcentration;
  result.dailyChipConcentrationTrend = chipResult.concentrationTrend;
  
  // console.log(`条件3结果: ${bollResult.isAbove ? '✓ 符合' : '✗ 不符合'} (价格=${bollResult.current}, BOLL中轨=${bollResult.mid})`);
  
  // 判断是否满足主涨段条件（三个条件都满足）
  result.isMainTrend = 
    macdResult.isGoldenCross && 
    maResult.isAbove && 
    bollResult.isAbove;
  
  // 打印最终结果
  console.log(`\n🎯 主涨段判断: ${result.isMainTrend ? '✅ 符合主涨段' : '❌ 不符合主涨段'}`);
  
  return result;
}

/**
 * 批量检测多只股票的主涨段
 * @param stocks 股票列表 [{ code, name }]
 * @param config 主涨段条件配置（可选，默认使用A股日线主涨段配置）
 * @returns 符合主涨段条件的股票列表
 */
export async function detectMainTrendBatch(
  stocks: Array<{ code: string; name: string }>,
  config?: IMainTrendConditionConfig
): Promise<IMainTrendResult[]> {
  resetEastmoneyCircuit();

  // 如果没有传入配置，使用A股的默认配置
  const finalConfig = config || DEFAULT_MAIN_TREND_CONFIG[EStockType.A];
  
  console.log(`\n========== 批量检测主涨段 [${finalConfig.name}] ========== 股票数量: ${stocks.length} 检测条件:`);
  console.log(`  
    1. ${finalConfig.macd.description} (${getKlineTypeDescription(finalConfig.macd.klt)})
    2. ${finalConfig.ma.description} (${getKlineTypeDescription(finalConfig.ma.klt)}) 
    3. ${finalConfig.boll.description} (${getKlineTypeDescription(finalConfig.boll.klt)})
  `);
  
  const results: IMainTrendResult[] = [];
  
  // 限流后要立即熔断，使用单只串行执行避免继续放大请求
  const batchSize = 8;
  for (let i = 0; i < stocks.length; i += batchSize) {
    if (eastmoneyCircuitOpen) {
      console.warn('东方财富请求已熔断，停止后续主涨段检测');
      break;
    }

    const batch = stocks.slice(i, i + batchSize);
    
    console.log(`\n处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocks.length / batchSize)}...`);
    
    let batchResults: IMainTrendResult[];
    try {
      batchResults = await Promise.all(
        batch.map(stock =>
          detectMainTrend(stock.code, stock.name, finalConfig)
        )
      );
    } catch (error) {
      if (isEastmoneyCircuitBreakError(error)) {
        openEastmoneyCircuit();
        console.warn('东方财富返回 socket hang up/ECONNRESET，已触发熔断并停止后续请求');
        break;
      }
      throw error;
    }
    
    // 只保留符合主涨段条件的股票
    const mainTrendStocks = batchResults.filter(r => r.isMainTrend);
    results.push(...mainTrendStocks);
    
    // 批次间延迟，避免请求过快
    if (i + batchSize < stocks.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`符合条件的股票: ${results.length} 只`);
  
  return results;
}
