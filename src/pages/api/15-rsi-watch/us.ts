import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchUSRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';

export const dynamic = 'force-dynamic';


let USTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    let rsiData

    if (isEmpty(USTask)) {
      USTask = cron.schedule('*/15 22-23,0-4 * * 1-5', ()=>{
        fetchUSRSI({
          klt: EKLT['15M'],
          currentDate: dayjs()
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
      // rsiData = await fetchUSRSI({ klt: EKLT['15M'], sendEmail: false})
    }
    res.status(200).json({ message: 'Cron job set to check US RSI every 15 minutes.',data: rsiData });
  } else if (req.method === 'DELETE') {
    if (USTask) {
      USTask.stop();
      USTask = null;
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
