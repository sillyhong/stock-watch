import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchAMainTrend } from '@/pages/utils/fetchMainTrendAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import { EReqType } from '@/pages/utils/config';
import SchedulerService, { ISchedulerContext } from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';
import { MainTrendConfigs, IMainTrendConditionConfig } from '@/pages/utils/mainTrendConfig';

export const dynamic = 'force-dynamic';

let ATask: cron.ScheduledTask | null;

// ========== 主涨段配置 ==========
// 可以根据需要切换不同的市场和主涨段级别
// 
// A股配置：
//   - MainTrendConfigs.A_DAY_MAIN_TREND     - A股日线主涨段（月MACD + 日MA55 + 60分BOLL）
//   - MainTrendConfigs.A_MIN_60_MAIN_TREND  - A股60分钟主涨段（周MACD + 日MA55 + 60分BOLL）
//   - MainTrendConfigs.A_MIN_30_MAIN_TREND  - A股30分钟主涨段（日MACD + 60分MA55 + 30分BOLL）
// 
// 港股配置：
//   - MainTrendConfigs.HK_DAY_MAIN_TREND    - 港股日线主涨段
//   - MainTrendConfigs.HK_MIN_60_MAIN_TREND - 港股60分钟主涨段
// 
// 美股配置：
//   - MainTrendConfigs.US_DAY_MAIN_TREND    - 美股日线主涨段
//   - MainTrendConfigs.US_MIN_60_MAIN_TREND - 美股60分钟主涨段
const MAIN_TREND_CONFIG: IMainTrendConditionConfig = MainTrendConfigs.A_DAY_MAIN_TREND;

/**
 * 定时器执行函数 - A股主涨段监控
 * 
 * 使用配置化的主涨段条件进行检测
 * 
 * @returns 主涨段股票检测结果数组
 */
async function executeScheduledTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.A),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.A,
    apiPath: '/api/day-rise/a',
    cronExpression: '40 16 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log(`🚀 开始执行主涨段定时监控任务 [${MAIN_TREND_CONFIG.name}]...`);
    console.log(`检测条件:`);
    console.log(`  1. ${MAIN_TREND_CONFIG.macd.description}`);
    console.log(`  2. ${MAIN_TREND_CONFIG.ma.description}`);
    console.log(`  3. ${MAIN_TREND_CONFIG.boll.description}`);
    
    const results: unknown[] = [];
    
    try {
      // 执行主涨段检测（使用配置化的条件）
      const mainTrendResult = await fetchAMainTrend({
        reqType: EReqType.EASY_MONEY,
        klt: EKLT.DAY,
        currentDate: dayjs(),
        sendEmail: true,
        stockType: MAIN_TREND_CONFIG.marketType,  // 传入市场类型
        config: MAIN_TREND_CONFIG  // 传入配置
      });
      if (mainTrendResult) results.push(mainTrendResult);
    } catch (error) {
      console.error('主涨段检测失败:', error);
    }

    console.log(`✅ 主涨段定时监控任务执行完成 [${MAIN_TREND_CONFIG.name}]`);
    return results;
  });
}

/**
 * 手动执行函数 - A股主涨段监控（带监控）
 * 
 * 使用配置化的主涨段条件进行检测
 * 
 * @param triggeredBy 触发来源（IP地址或用户标识）
 * @returns 主涨段股票检测结果
 */
async function executeManualTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.A),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.A,
    apiPath: '/api/day-rise/a',
    cronExpression: '40 16 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log(`🔧 开始手动执行主涨段监控任务 [${MAIN_TREND_CONFIG.name}]...`);
    console.log(`检测条件:`);
    console.log(`  1. ${MAIN_TREND_CONFIG.macd.description}`);
    console.log(`  2. ${MAIN_TREND_CONFIG.ma.description}`);
    console.log(`  3. ${MAIN_TREND_CONFIG.boll.description}`);
    
    // 执行主涨段检测（使用配置化的条件）
    const result = await fetchAMainTrend({
      reqType: EReqType.EASY_MONEY,
      klt: EKLT.DAY,
      sendEmail: true,
      currentDate: dayjs(),
      stockType: MAIN_TREND_CONFIG.marketType,  // 传入市场类型
      config: MAIN_TREND_CONFIG  // 传入配置
    });

    console.log(`✅ 主涨段手动监控任务执行完成 [${MAIN_TREND_CONFIG.name}]`);
    return result;
  });
}

/**
 * API路由处理函数 - 主涨段监控（支持多市场配置化）
 * 
 * 支持的HTTP方法：
 * - GET: 创建定时任务并执行一次手动检测
 * - DELETE: 停止定时任务
 * 
 * 定时任务配置：
 * - 执行时间: 工作日 16:40 (中国时区)
 * - 执行内容: 检测主涨段股票并发送邮件
 * 
 * 主涨段配置（可在文件顶部修改 MAIN_TREND_CONFIG）：
 * A股配置：
 *   - A_DAY_MAIN_TREND: A股日线主涨段（月MACD + 日MA55 + 60分BOLL）
 *   - A_MIN_60_MAIN_TREND: A股60分钟主涨段（周MACD + 日MA55 + 60分BOLL）
 *   - A_MIN_30_MAIN_TREND: A股30分钟主涨段（日MACD + 60分MA55 + 30分BOLL）
 * 港股配置：
 *   - HK_DAY_MAIN_TREND: 港股日线主涨段
 *   - HK_MIN_60_MAIN_TREND: 港股60分钟主涨段
 * 美股配置：
 *   - US_DAY_MAIN_TREND: 美股日线主涨段
 *   - US_MIN_60_MAIN_TREND: 美股60分钟主涨段
 * 
 * @param req NextJS API请求对象
 * @param res NextJS API响应对象
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (req.method === 'GET') {
    console.log('isEmpty(ATask)', isEmpty(ATask));
    
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(ATask)) {
        console.log(`📅 创建主涨段定时监控任务 [${MAIN_TREND_CONFIG.name}]...`);
        
        ATask = cron.schedule('40 16 * * 1-5', async () => {
          try {
            await executeScheduledTask();
          } catch (error) {
            console.error(`❌ 主涨段定时监控任务执行失败 [${MAIN_TREND_CONFIG.name}]:`, error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

        console.log(`✅ 主涨段定时监控任务创建成功 [${MAIN_TREND_CONFIG.name}]，将在工作日16:40执行`);
        console.log('   监控条件:');
        console.log(`   1. ${MAIN_TREND_CONFIG.macd.description}`);
        console.log(`   2. ${MAIN_TREND_CONFIG.ma.description}`);
        console.log(`   3. ${MAIN_TREND_CONFIG.boll.description}`);
      }
      
      // 执行手动任务
      const mainTrendData = await executeManualTask(clientIP as string);

      res.status(200).json({ 
        message: `主涨段监控任务已启动 [${MAIN_TREND_CONFIG.name}]`,
        config_name: MAIN_TREND_CONFIG.name,
        market_type: MAIN_TREND_CONFIG.marketType,
        description: '使用配置化的主涨段条件进行检测（支持A股、港股、美股）',
        schedule: '工作日 16:40',
        conditions: {
          condition1: MAIN_TREND_CONFIG.macd.description,
          condition2: MAIN_TREND_CONFIG.ma.description,
          condition3: MAIN_TREND_CONFIG.boll.description
        },
        data: mainTrendData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.A),
          cron_description: SchedulerService.getCronDescription('40 16 * * 1-5')
        }
      });

    } catch (error) {
      console.error(`❌ 主涨段监控API执行失败 [${MAIN_TREND_CONFIG.name}]:`, error);
      res.status(500).json({ 
        message: `主涨段监控任务执行失败 [${MAIN_TREND_CONFIG.name}]`,
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (ATask) {
      ATask.stop();
      ATask = null;
      console.log(`🛑 主涨段定时监控任务已停止 [${MAIN_TREND_CONFIG.name}]`);
      res.status(200).json({ 
        message: `主涨段定时监控任务已停止 [${MAIN_TREND_CONFIG.name}]`,
        config_name: MAIN_TREND_CONFIG.name,
        market_type: MAIN_TREND_CONFIG.marketType,
        stopped_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
    } else {
      res.status(400).json({ 
        message: '定时任务未运行',
        status: 'not_running'
      });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
