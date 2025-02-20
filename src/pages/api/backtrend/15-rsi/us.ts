import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchUSRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';

let USBacktrendTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    let rsiData

    if (isEmpty(USBacktrendTask)) {
      USBacktrendTask = cron.schedule('3 17 * * 1-5', ()=>{
        fetchUSRSI({
          klt: EKLT['15M'],
          currentDate: dayjs(),
          isBacktesting: true,
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
      // rsiData = await fetchUSRSI({ klt: EKLT['15M'], sendEmail: false, isBacktesting: true})
    }
    res.status(200).json({ message: 'Cron job set to US [15]RSI backtrend every workday',data: rsiData });
  } else if (req.method === 'DELETE') {
    if (USBacktrendTask) {
      USBacktrendTask.stop();
      USBacktrendTask = null;
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
