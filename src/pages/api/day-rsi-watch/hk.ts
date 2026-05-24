import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchHKRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import SchedulerService, { ISchedulerContext } from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';

export const dynamic = 'force-dynamic';

let HTask: cron.ScheduledUSTask;

// 定时器执行函数
async function executeScheduledHKTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.HK),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.HK,
    apiPath: '/api/day-rsi-watch/hk',
    cronExpression: '5 18 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🚀 开始执行港股日RSI定时任务...');
    
    const results: unknown[] = [];
    
    try {
      // 执行港股RSI请求
      const hkResult = await fetchHKRSI({
        klt: EKLT.DAY,
        currentDate: dayjs()
      });
      if (hkResult) results.push(hkResult);
    } catch (error) {
      console.error('港股日RSI请求失败:', error);
    }

    console.log('✅ 港股日RSI定时任务执行完成');
    return results;
  });
}

// 手动执行函数（带监控）
async function executeManualHKTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.HK),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.HK,
    apiPath: '/api/day-rsi-watch/hk',
    cronExpression: '5 18 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🔧 开始手动执行港股日RSI任务...');
    
    const result = await fetchHKRSI({
      klt: EKLT.DAY,
      sendEmail: false
    });

    console.log('✅ 港股日RSI手动任务执行完成');
    return result;
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (req.method === 'GET') {
    let rsiData
    console.log('isEmpty(HTask)', isEmpty(HTask));
    
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(HTask)) {
        console.log('📅 创建港股日RSI定时任务...');
        
        HTask = cron.schedule('5 18 * * 1-5', async () => {
          try {
            await executeScheduledHKTask();
          } catch (error) {
            console.error('❌ 港股日RSI定时任务执行失败:', error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

        console.log('✅ 港股日RSI定时任务创建成功，将在工作日18:05执行');
      }
      
      // 执行手动任务
      rsiData = await executeManualHKTask(clientIP as string);

      res.status(200).json({ 
        message: 'Cron job set to check HK RSI every workday.',
        schedule: '工作日 18:05',
        market: '港股',
        data: rsiData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.HK),
          cron_description: SchedulerService.getCronDescription('5 18 * * 1-5')
        }
      });

    } catch (error) {
      console.error('❌ 港股日RSI API执行失败:', error);
      res.status(500).json({ 
        message: 'Failed to execute HK RSI task',
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (HTask) {
      HTask.stop();
      HTask = null;
      console.log('🛑 港股日RSI定时任务已停止');
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
