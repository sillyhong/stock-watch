import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchHKRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';

export const dynamic = 'force-dynamic';

let HTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    let rsiData: any
    console.log('isEmpty(HTask)',isEmpty(HTask))
    if (isEmpty(HTask)) {
      HTask = cron.schedule('5 17 * * 1-5', ()=>{
        fetchHKRSI({
          klt: EKLT.DAY,
          currentDate: dayjs()
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
    }
    // rsiData = await fetchHKRSI({klt: EKLT.DAY, sendEmail: false })

    res.status(200).json({ message: 'Cron job set to check HK RSI every workday.', data: rsiData });
  } else if (req.method === 'DELETE') {
    if (HTask) {
      HTask.stop();
      HTask = null;
      res.status(200).json({ message: 'Cron job has been stopped.' });
    } else {
      res.status(400).json({ message: 'Cron job is not running.' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
