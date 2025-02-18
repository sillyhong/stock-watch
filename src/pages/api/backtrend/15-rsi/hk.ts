import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchHKRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';

let HbacktrendTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    let rsiData: any
    if (isEmpty(HbacktrendTask)) {
      HbacktrendTask = cron.schedule('2 17 * * 1-5', ()=>{
        fetchHKRSI({
          klt: EKLT['15M'],
          currentDate: dayjs(),
          isBacktesting: true,
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
    }
    // rsiData = await fetchHKRSI({ klt: EKLT['15M'], sendEmail: true, isBacktesting: true})


    res.status(200).json({ message: 'Cron job set to RSI backtrend every workday', data: rsiData });
  } else if (req.method === 'DELETE') {
    if (HbacktrendTask) {
      HbacktrendTask.stop();
      HbacktrendTask = null;
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
