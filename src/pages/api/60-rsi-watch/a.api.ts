import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchARSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import { EReqType } from '@/pages/utils/config';

export const dynamic = 'force-dynamic';

// 单只股票的请求失败时由数据获取层处理兜底，空信号不代表请求失败。
const executeRSIWithFallback = (klt: EKLT, currentDate: dayjs.Dayjs) =>
  fetchARSI({ reqType: EReqType.EASY_MONEY, klt, currentDate, sendEmail: true });

let ATask: cron.ScheduledTask | null = null;
let AMorningTask: cron.ScheduledTask | null = null;
let rsiData: unknown;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const isImmediately = req.query?.isImmediately || false
    if (isEmpty(ATask)) {
      ATask = cron.schedule('*/30 10-15 * * 1-5', async ()=>{
        try {
          await executeRSIWithFallback(EKLT['60M'], dayjs());
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
          await executeRSIWithFallback(EKLT['60M'], dayjs());
        } catch (error) {
          console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] 早盘RSI任务执行失败:`, error);
        }
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      }); 
    }
    if(isImmediately) {
       rsiData = await fetchARSI({ reqType: EReqType.EASY_MONEY, klt: EKLT['60M'], sendEmail: false})
      // const rsiData2 = await fetchARSI({ reqType: EReqType.FU_TU, klt: EKLT['30M'], sendEmail: false})
    }


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
