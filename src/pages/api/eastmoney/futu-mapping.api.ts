import type { NextApiRequest, NextApiResponse } from 'next';
import { getFutuMappingStatus } from '@/services/futuMappingService';

export const dynamic = 'force-dynamic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const fileName = typeof req.query.fileName === 'string' ? req.query.fileName : '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(fileName)) return res.status(400).json({ error: '无效的股票池文件名' });
  try {
    const mapping = await getFutuMappingStatus(fileName);
    return res.status(mapping ? 200 : 404).json({ success: !!mapping, mapping });
  } catch (error) {
    console.error('[futu-mapping] 查询失败:', error instanceof Error ? error.message : String(error));
    return res.status(500).json({ success: false, error: '无法读取富途映射状态' });
  }
}
