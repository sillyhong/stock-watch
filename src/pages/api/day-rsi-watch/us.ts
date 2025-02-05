import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchUSRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';

let USTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (isEmpty(USTask)) {
      USTask = cron.schedule('0 17 * * 1-5', ()=>{
        fetchUSRSI({
          klt: EKLT.DAY,
          currentDate: dayjs()
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
      await fetchUSRSI({klt: EKLT.DAY, sendEmail: false})
    }
    res.status(200).json({ message: 'Cron job set to check RSI every workday.' });
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
