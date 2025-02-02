import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchUSRSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';

let USTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (isEmpty(USTask)) {
      USTask = cron.schedule('3 */15 * * * *', ()=>{
        fetchUSRSI({
          currentDate: dayjs().subtract(6, 'day')
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
      await fetchUSRSI({sendEmail: false})
    }
    res.status(200).json({ message: 'Cron job set to check RSI every 15 minutes.' });
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
