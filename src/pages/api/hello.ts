// src/pages/api/hello.ts
import { GetConvert } from '@/modules/tools/indicator/old';

import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { formatKlinesData } from '../utils/formatKlines';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 处理 GET 请求
  if (req.method === 'GET') {
    // const eastmoneyData =  await axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.300033&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1%2Cf2%2Cf3%2Cf4%2Cf5%2Cf6%2Cf7%2Cf8&fields2=f51%2Cf52%2Cf53%2Cf54%2Cf55%2Cf56%2Cf57%2Cf58%2Cf59%2Cf60%2Cf61%2Cf62%2Cf63%2Cf64&klt=15&fqt=1&end=20250127&lmt=210&cb=quote_jp20')
    const eastmoneyData =  await axios.get('https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.300033&ut=fa5fd1943c7b386f172d6893dbfba10b&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=15&fqt=0&beg=20250101&end=20251231')
    
    console.log("🚀 ~ handler ~ eastmoneyData:", eastmoneyData?.data?.data)
    const sourceData = eastmoneyData?.data?.data
    
        const RSIData = formatKlinesData(sourceData)
    const data = GetConvert('RSI',RSIData.full_klines)

    res.status(200).json({ message: data });
  } else {
    // 处理其他请求方法
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}