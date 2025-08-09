import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchARSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import { EReqType } from '@/pages/utils/config';
import SchedulerService, { ISchedulerContext } from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';

export const dynamic = 'force-dynamic';

let ATask: cron.ScheduledUSTask;

// 定时器执行函数
async function executeScheduledTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.A),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.A,
    apiPath: '/api/day-rsi-watch/a',
    cronExpression: '40 16 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🚀 开始执行A股日RSI定时任务...');
    
    const results: unknown[] = [];
    
    try {
      // 执行EASY_MONEY请求
      const easyMoneyResult = await fetchARSI({
        reqType: EReqType.EASY_MONEY,
        klt: EKLT.DAY,
        currentDate: dayjs()
      });
      if (easyMoneyResult) results.push(easyMoneyResult);
    } catch (error) {
      console.error('EASY_MONEY请求失败:', error);
    }

    try {
      // 执行FU_TU请求
      const futuResult = await fetchARSI({
        reqType: EReqType.FU_TU,
        klt: EKLT.DAY,
        currentDate: dayjs()
      });
      if (futuResult) results.push(futuResult);
    } catch (error) {
      console.error('FU_TU请求失败:', error);
    }

    console.log('✅ A股日RSI定时任务执行完成');
    return results;
  });
}

// 手动执行函数（带监控）
async function executeManualTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.A),
    jobType: EJobType.DAY_RSI_WATCH,
    marketType: EMarketType.A,
    apiPath: '/api/day-rsi-watch/a',
    cronExpression: '40 16 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🔧 开始手动执行A股日RSI任务...');
    
    const result = await fetchARSI({
      klt: EKLT.DAY,
      sendEmail: true
    });

    console.log('✅ A股日RSI手动任务执行完成');
    return result;
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (req.method === 'GET') {
    console.log('isEmpty(ATask)', isEmpty(ATask));
    
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(ATask)) {
        console.log('📅 创建A股日RSI定时任务...');
        
        ATask = cron.schedule('40 16 * * 1-5', async () => {
          try {
            await executeScheduledTask();
          } catch (error) {
            console.error('❌ A股日RSI定时任务执行失败:', error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

        console.log('✅ A股日RSI定时任务创建成功，将在工作日16:40执行');
      }
      
      // 执行手动任务
      const rsiData = await executeManualTask(clientIP as string);

      res.status(200).json({ 
        message: 'Cron job set to check A RSI every workday.',
        schedule: '工作日 16:40',
        data: rsiData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.DAY_RSI_WATCH, EMarketType.A),
          cron_description: SchedulerService.getCronDescription('40 16 * * 1-5')
        }
      });

    } catch (error) {
      console.error('❌ A股日RSI API执行失败:', error);
      res.status(500).json({ 
        message: 'Failed to execute A RSI task',
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (ATask) {
      ATask.stop();
      ATask = null;
      console.log('🛑 A股日RSI定时任务已停止');
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
