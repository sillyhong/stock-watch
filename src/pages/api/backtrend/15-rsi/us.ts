import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchUSRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import SchedulerService, { ISchedulerContext } from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';

export const dynamic = 'force-dynamic';

let USBacktrendTask: cron.ScheduledUSTask;

// 定时器执行函数（15分钟RSI回测）
async function executeScheduledUSBacktrendTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.BACKTREND_15RSI, EMarketType.US),
    jobType: EJobType.BACKTREND_15RSI,
    marketType: EMarketType.US,
    apiPath: '/api/backtrend/15-rsi/us',
    cronExpression: '4 17 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🚀 开始执行美股15分钟RSI回测定时任务...');
    
    const results: unknown[] = [];
    
    try {
      // 执行美股15分钟RSI回测请求
      const usResult = await fetchUSRSI({
        klt: EKLT['15M'],
        currentDate: dayjs(),
        isBacktesting: true,
      });
      if (usResult) results.push(usResult);
    } catch (error) {
      console.error('美股15分钟RSI回测请求失败:', error);
    }

    console.log('✅ 美股15分钟RSI回测定时任务执行完成');
    return results;
  });
}

// 手动执行函数（带监控）
async function executeManualUSBacktrendTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.BACKTREND_15RSI, EMarketType.US),
    jobType: EJobType.BACKTREND_15RSI,
    marketType: EMarketType.US,
    apiPath: '/api/backtrend/15-rsi/us',
    cronExpression: '4 17 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🔧 开始手动执行美股15分钟RSI回测任务...');
    
    const result = await fetchUSRSI({
      klt: EKLT['15M'],
      sendEmail: false,
      isBacktesting: true
    });

    console.log('✅ 美股15分钟RSI回测手动任务执行完成');
    return result;
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const isImmediately = req.query?.isImmediately || false
  
  if (req.method === 'GET') {
    let rsiData
    console.log('isEmpty(USBacktrendTask)', isEmpty(USBacktrendTask));
    
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(USBacktrendTask)) {
        console.log('📅 创建美股15分钟RSI回测定时任务...');
        
        USBacktrendTask = cron.schedule('4 17 * * 1-5', async () => {
          try {
            await executeScheduledUSBacktrendTask();
          } catch (error) {
            console.error('❌ 美股15分钟RSI回测定时任务执行失败:', error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

        console.log('✅ 美股15分钟RSI回测定时任务创建成功，将在工作日17:04执行');
      }
      
      // 执行手动任务
      if(isImmediately) {
        rsiData = await executeManualUSBacktrendTask(clientIP as string);
      }

      res.status(200).json({ 
        message: 'Cron job set to US [15]RSI backtrend every workday',
        schedule: '工作日 17:04',
        market: '美股',
        task_type: '15分钟RSI回测',
        data: rsiData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.BACKTREND_15RSI, EMarketType.US),
          cron_description: SchedulerService.getCronDescription('4 17 * * 1-5')
        }
      });

    } catch (error) {
      console.error('❌ 美股15分钟RSI回测API执行失败:', error);
      res.status(500).json({ 
        message: 'Failed to execute US 15RSI backtrend task',
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (USBacktrendTask) {
      USBacktrendTask.stop();
      USBacktrendTask = null;
      console.log('🛑 美股15分钟RSI回测定时任务已停止');
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
