import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchUSRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import SchedulerService, { ISchedulerContext } from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';

export const dynamic = 'force-dynamic';

let USTask: cron.ScheduledUSTask;

// 定时器执行函数
async function executeScheduledUSTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.US),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.US,
    apiPath: '/api/day-rsi-watch/us',
    cronExpression: '0 18 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🚀 开始执行美股日RSI定时任务...');
    
    const results: unknown[] = [];
    
    try {
      // 执行美股RSI请求
      const usResult = await fetchUSRSI({
        klt: EKLT.DAY,
        currentDate: dayjs()
      });
      if (usResult) results.push(usResult);
    } catch (error) {
      console.error('美股日RSI请求失败:', error);
    }

    console.log('✅ 美股日RSI定时任务执行完成');
    return results;
  });
}

// 手动执行函数（带监控）
async function executeManualUSTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.US),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.US,
    apiPath: '/api/day-rsi-watch/us',
    cronExpression: '0 18 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🔧 开始手动执行美股日RSI任务...');
    
    const result = await fetchUSRSI({
      klt: EKLT.DAY,
      sendEmail: false
    });

    console.log('✅ 美股日RSI手动任务执行完成');
    return result;
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (req.method === 'GET') {
    console.log('isEmpty(USTask)', isEmpty(USTask));
    
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(USTask)) {
        console.log('📅 创建美股日RSI定时任务...');
        
        USTask = cron.schedule('0 18 * * 1-5', async () => {
          try {
            await executeScheduledUSTask();
          } catch (error) {
            console.error('❌ 美股日RSI定时任务执行失败:', error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

        console.log('✅ 美股日RSI定时任务创建成功，将在工作日18:00执行');
      }
      
      // 执行手动任务
      const rsiData = await executeManualUSTask(clientIP as string);

      res.status(200).json({ 
        message: 'Cron job set to check US RSI every workday.',
        schedule: '工作日 18:00',
        market: '美股',
        data: rsiData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.US),
          cron_description: SchedulerService.getCronDescription('0 18 * * 1-5')
        }
      });

    } catch (error) {
      console.error('❌ 美股日RSI API执行失败:', error);
      res.status(500).json({ 
        message: 'Failed to execute US RSI task',
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (USTask) {
      USTask.stop();
      USTask = null;
      console.log('🛑 美股日RSI定时任务已停止');
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
