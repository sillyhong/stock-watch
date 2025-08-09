import type { NextApiRequest, NextApiResponse } from 'next';
import cron from 'node-cron';
import isEmpty from "lodash/isEmpty";
import { fetchARSI } from '@/pages/utils/fetchRSIAndSendEmail';
import dayjs from 'dayjs';
import { EKLT } from '@/pages/interface';
import { EReqType } from '@/pages/utils/config';

export const dynamic = 'force-dynamic';


let ATask: cron.ScheduledUSTask;
let AMorningTask: cron.ScheduledUSTask;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    let rsiData: any
    console.log('isEmpty(ATask)',isEmpty(ATask))
    if (isEmpty(ATask)) {
      ATask = cron.schedule('*/15 9-15 * * 1-5', ()=>{
        fetchARSI({
          reqType: EReqType.EASY_MONEY,
          klt: EKLT['15M'],
          currentDate: dayjs()
        })
         fetchARSI({
          reqType: EReqType.FU_TU,
          klt: EKLT['15M'],
          currentDate: dayjs()
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      });
    }

    if(isEmpty(AMorningTask)) {
      AMorningTask = cron.schedule('25 9 * * 1-5', ()=>{
        fetchARSI({
          klt: EKLT['15M'],
          currentDate: dayjs()
        })
      }, {
        timezone: "Asia/Shanghai",
        scheduled: true
      }); 
    }
    
    rsiData = await fetchARSI({ reqType: EReqType.EASY_MONEY, klt: EKLT['15M'], sendEmail: false})
    // const rsiData2 = await fetchARSI({ reqType: EReqType.FU_TU, klt: EKLT['15M'], sendEmail: false})


    res.status(200).json({ message: 'Cron job set to check A RSI every 15 minutes.', data: rsiData });
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
