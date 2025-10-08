import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchARSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import { EReqType } from '@/pages/utils/config';

export const dynamic = 'force-dynamic';

/**
 * 执行RSI抓取，支持自动故障转移
 * 首先尝试 EASY_MONEY，如果失败或没有数据，则自动切换到 FU_TU
 */
const executeRSIWithFallback = async (klt: EKLT, currentDate: dayjs.Dayjs) => {
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 开始执行RSI抓取任务...`);
  
  try {
    // 首先尝试 EASY_MONEY
    console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 尝试使用 EASY_MONEY 获取数据...`);
    const easyMoneyResult = await fetchARSI({
      reqType: EReqType.EASY_MONEY,
      klt,
      currentDate,
      sendEmail: true
    });
    
    // 检查是否有有效数据
    if (easyMoneyResult && Array.isArray(easyMoneyResult) && easyMoneyResult.length > 0) {
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] EASY_MONEY 成功获取到 ${easyMoneyResult.length} 条数据`);
      return easyMoneyResult;
    } else {
      console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] EASY_MONEY 没有返回有效数据，准备切换到 FU_TU...`);
      throw new Error('EASY_MONEY 返回数据为空');
    }
  } catch (easyMoneyError) {
    console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] EASY_MONEY 失败:`, easyMoneyError);
    
    try {
      // 故障转移到 FU_TU
      console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 正在使用 FU_TU 作为备用数据源...`);
      const futuResult = await fetchARSI({
        reqType: EReqType.FU_TU,
        klt,
        currentDate,
        sendEmail: true
      });
      
      if (futuResult && Array.isArray(futuResult) && futuResult.length > 0) {
        console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] FU_TU 成功获取到 ${futuResult.length} 条数据 (备用数据源)`);
        return futuResult;
      } else {
        console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] FU_TU 也没有返回有效数据`);
        throw new Error('FU_TU 返回数据为空');
      }
    } catch (futuError) {
      console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] FU_TU 也失败了:`, futuError);
      throw new Error(`所有数据源都失败: EASY_MONEY: ${easyMoneyError}, FU_TU: ${futuError}`);
    }
  }
};

let ATask: cron.ScheduledTask | null = null;
let AMorningTask: cron.ScheduledTask | null = null;
let rsiData

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    console.log('isEmpty(ATask)',isEmpty(ATask))
    if (isEmpty(ATask)) {
      ATask = cron.schedule('*/30 9-15 * * 1-5', async ()=>{
        try {
          await executeRSIWithFallback(EKLT['30M'], dayjs());
        } catch (error) {
          console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 15分钟RSI任务执行失败:`, error);
        }
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
    }

    if(isEmpty(AMorningTask)) {
      AMorningTask = cron.schedule('25 9 * * 1-5', async ()=>{
        try {
          await executeRSIWithFallback(EKLT['30M'], dayjs());
        } catch (error) {
          console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 早盘RSI任务执行失败:`, error);
        }
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      }); 
    }
    
    // const rsiData = await fetchARSI({ reqType: EReqType.EASY_MONEY, klt: EKLT['30M'], sendEmail: false})
    // const rsiData2 = await fetchARSI({ reqType: EReqType.FU_TU, klt: EKLT['30M'], sendEmail: false})


    res.status(200).json({ message: 'Cron job set to check A RSI every 30 minutes.', data: rsiData });
  } else if (req.method === 'DELETE') {
    if (ATask) {
      ATask.stop();
      ATask = null;
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
