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

let ATBackTrendask: cron.ScheduledUSTask;

// 定时器执行函数（15分钟RSI回测）
async function executeScheduledBacktrendTask(): Promise<unknown[] | null> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.BACKTREND_15RSI, EMarketType.A),
    jobType: EJobType.BACKTREND_15RSI,
    marketType: EMarketType.A,
    apiPath: '/api/backtrend/15-rsi/a',
    cronExpression: '50 16 * * 1-5',
    isManual: false,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🚀 开始执行A股15分钟RSI回测定时任务...');
    
    const results: unknown[] = [];
    
    // try {
    //   // 执行FU_TU请求（回测）
    //   const futuResult = await fetchARSI({
    //     reqType: EReqType.FU_TU,
    //     klt: EKLT['15M'],
    //     currentDate: dayjs(),
    //     isBacktesting: true,
    //   });
    //   if (futuResult) results.push(futuResult);
    // } catch (error) {
    //   console.error('FU_TU 15分钟RSI回测请求失败:', error);
    // }

    // 注释掉的EASY_MONEY请求暂时不执行
    try {
      const easyMoneyResult = await fetchARSI({
        reqType: EReqType.EASY_MONEY,
        klt: EKLT['15M'],
        currentDate: dayjs(),
        isBacktesting: true,
      });
      if (easyMoneyResult) results.push(easyMoneyResult);
    } catch (error) {
      console.error('EASY_MONEY 15分钟RSI回测请求失败:', error);
    }

    console.log('✅ A股15分钟RSI回测定时任务执行完成');
    return results;
  });
}

// 手动执行函数（带监控）
async function executeManualBacktrendTask(triggeredBy?: string): Promise<unknown> {
  const context: ISchedulerContext = {
    jobName: SchedulerService.generateJobName(EJobType.BACKTREND_15RSI, EMarketType.A),
    jobType: EJobType.BACKTREND_15RSI,
    marketType: EMarketType.A,
    apiPath: '/api/backtrend/15-rsi/a',
    cronExpression: '50 16 * * 1-5',
    isManual: true,
    triggeredBy,
  };

  return await SchedulerService.executeWithLogging(context, async () => {
    console.log('🔧 开始手动执行A股15分钟RSI回测任务...');
    
    const result = await fetchARSI({
      reqType: EReqType.EASY_MONEY,
      klt: EKLT['15M'],
      sendEmail: true,
      isBacktesting: true
    });

    console.log('✅ A股15分钟RSI回测手动任务执行完成');
    return result;
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (req.method === 'GET') {
    console.log('isEmpty(ATBackTrendask)', isEmpty(ATBackTrendask));
    let rsiData
    try {
      // 创建定时任务（如果不存在）
      if (isEmpty(ATBackTrendask)) {
        console.log('📅 创建A股15分钟RSI回测定时任务...');
        
        ATBackTrendask = cron.schedule('50 16 * * 1-5', async () => {
          try {
            await executeScheduledBacktrendTask();
          } catch (error) {
            console.error('❌ A股15分钟RSI回测定时任务执行失败:', error);
          }
        }, {
          timezone: "Asia/Shanghai",
          scheduled: true
        });

        console.log('✅ A股15分钟RSI回测定时任务创建成功，将在工作日16:50执行');
      }
      
      // 执行手动任务
      // rsiData = await executeManualBacktrendTask(clientIP as string);

      res.status(200).json({ 
        message: 'Cron job set to A [15]RSI backtrend every workday.',
        schedule: '工作日 16:50',
        task_type: '15分钟RSI回测',
        data: rsiData,
        monitoring: {
          enabled: true,
          job_name: SchedulerService.generateJobName(EJobType.BACKTREND_15RSI, EMarketType.A),
          cron_description: SchedulerService.getCronDescription('50 16 * * 1-5')
        }
      });

    } catch (error) {
      console.error('❌ A股15分钟RSI回测API执行失败:', error);
      res.status(500).json({ 
        message: 'Failed to execute A 15RSI backtrend task',
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } else if (req.method === 'DELETE') {
    if (ATBackTrendask) {
      ATBackTrendask.stop();
      ATBackTrendask = null;
      console.log('🛑 A股15分钟RSI回测定时任务已停止');
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
