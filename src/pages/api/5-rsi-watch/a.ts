import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchARSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { EKLT } from '@/pages/interface';
import { EReqType } from '@/pages/utils/config';

// 启用 dayjs 时区插件
dayjs.extend(utc);
dayjs.extend(timezone);

export const dynamic = 'force-dynamic';


let ATask: cron.ScheduledTask | null = null;

// 检查当前时间是否在允许的执行时间段内
function isInAllowedTimeRange(): boolean {
  const now = dayjs().tz('Asia/Shanghai');
  const hour = now.hour();
  const minute = now.minute();
  const currentMinutes = hour * 60 + minute;
  
  // 9:25-10:00 (565-600分钟)
  const morningStart = 9 * 60 + 25; // 565
  const morningEnd = 10 * 60; // 600
  
  // 14:30-15:00 (870-900分钟)
  const afternoonStart = 14 * 60 + 30; // 870
  const afternoonEnd = 15 * 60; // 900
  
  return (currentMinutes >= morningStart && currentMinutes <= morningEnd) ||
         (currentMinutes >= afternoonStart && currentMinutes <= afternoonEnd);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const rsiData = undefined;
    console.log('isEmpty(ATask)',isEmpty(ATask))
    if (isEmpty(ATask)) {
      // 每5分钟执行，但只在9:25-15:00之间触发，内部会再次检查精确时间段
      ATask = cron.schedule('*/5 9-15 * * 1-5', ()=>{
        // 检查是否在允许的时间段内
        if (!isInAllowedTimeRange()) {
          console.log('当前时间不在允许的执行时间段内，跳过执行');
          return;
        }
        
        console.log('执行 RSI 监控任务:', dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'));
        fetchARSI({
          reqType: EReqType.EASY_MONEY,
          klt: EKLT['5M'],
          currentDate: dayjs()
        })
        fetchARSI({
          reqType: EReqType.FU_TU,
          klt: EKLT['5M'],
          currentDate: dayjs()
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
    }
    
    // rsiData = await fetchARSI({ reqType: EReqType.EASY_MONEY, klt: EKLT['5M'], sendEmail: true})

    res.status(200).json({ message: 'Cron job set to check A RSI every 5 minutes.', data: rsiData });
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
