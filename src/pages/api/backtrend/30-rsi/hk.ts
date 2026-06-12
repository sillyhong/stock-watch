import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchHKRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import SchedulerService, { ISchedulerContext } from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';

export const dynamic = 'force-dynamic';

let HbacktrendTask: cron.ScheduledUSTask;

// 定时器执行函数（30分钟RSI回测）
async function executeScheduledHKBacktrendTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.BACKTREND_30RSI, EMarketType.HK),
    jobType: EJobType.BACKTREND_30RSI,
    marketType: EMarketType.HK,
    apiPath: '/api/backtrend/30-rsi/hk',
    cronExpression: '13 17 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🚀 开始执行港股30分钟RSI回测定时任务...');
    
    const results: unknown[] = [];
    
    try {
      // 执行港股30分钟RSI回测请求
      const hkResult = await fetchHKRSI({
        klt: EKLT['30M'],
        currentDate: dayjs(),
        isBacktesting: true,
      });
      if (hkResult) results.push(hkResult);
    } catch (error) {
      console.error('港股30分钟RSI回测请求失败:', error);
    }

    console.log('✅ 港股30分钟RSI回测定时任务执行完成');
    return results;
  });
}

// 手动执行函数（带监控）
async function executeManualHKBacktrendTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.BACKTREND_30RSI, EMarketType.HK),
    jobType: EJobType.BACKTREND_30RSI,
    marketType: EMarketType.HK,
    apiPath: '/api/backtrend/30-rsi/hk',
    cronExpression: '20 17 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🔧 开始手动执行港股30分钟RSI回测任务...');
    
    const result = await fetchHKRSI({
      klt: EKLT['30M'],
      sendEmail: true,
      isBacktesting: true
    });

    console.log('✅ 港股30分钟RSI回测手动任务执行完成');
    return result;
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const isImmediately = req.query?.isImmediately || false

  let rsiData
  if (req.method === 'GET') {
    console.log('isEmpty(HbacktrendTask)', isEmpty(HbacktrendTask));
    
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(HbacktrendTask)) {
        console.log('📅 创建港股30分钟RSI回测定时任务...');
        
        HbacktrendTask = cron.schedule('20 17 * * 1-5', async () => {
          try {
            await executeScheduledHKBacktrendTask();
          } catch (error) {
            console.error('❌ 港股30分钟RSI回测定时任务执行失败:', error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

      }
      
      // 执行手动任务
      if(isImmediately) {
         rsiData = await executeManualHKBacktrendTask(clientIP as string);
      }

      res.status(200).json({ 
        message: 'Cron job set to HK [30]RSI backtrend every workday',
        schedule: '工作日 17:20',
        market: '港股',
        task_type: '30分钟RSI回测',
        data: rsiData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.BACKTREND_30RSI, EMarketType.HK),
          cron_description: SchedulerService.getCronDescription('13 17 * * 1-5')
        }
      });

    } catch (error) {
      console.error('❌ 港股30分钟RSI回测API执行失败:', error);
      res.status(500).json({ 
        message: 'Failed to execute HK 30RSI backtrend task',
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (HbacktrendTask) {
      HbacktrendTask.stop();
      HbacktrendTask = null;
      console.log('🛑 港股30分钟RSI回测定时任务已停止');
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
