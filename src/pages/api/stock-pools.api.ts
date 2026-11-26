import type { NextApiRequest, NextApiResponse } from 'next';
import { getTaskPool, getTaskStocks, listStockSources, stockPoolTasks, updateTaskPool } from '@/services/stockPoolService';

export const dynamic = 'force-dynamic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const taskId = typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
      if (taskId) {
        const pool = await getTaskPool(taskId);
        const stocks = pool.sources.length ? await getTaskStocks(taskId) : [];
        return res.status(200).json({ success: true, pool, stocks });
      }
      const tasks = stockPoolTasks();
      const sources = await listStockSources();
      const pools = await Promise.all(tasks.map((task) => getTaskPool(task.id)));
      return res.status(200).json({ success: true, tasks, sources, pools });
    }
    if (req.method === 'PUT') {
      const { taskId, sources, version } = req.body ?? {};
      if (typeof taskId !== 'string' || !Array.isArray(sources) || !sources.every((source: unknown) => typeof source === 'string') || typeof version !== 'number') {
        return res.status(400).json({ success: false, error: 'taskId、sources 或 version 无效' });
      }
      if (!stockPoolTasks().some((task) => task.id === taskId)) return res.status(404).json({ success: false, error: '未知股票任务' });
      const pool = await updateTaskPool(taskId, sources, version);
      return res.status(200).json({ success: true, pool });
    }
    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stock-pools]', message);
    return res.status(message.includes('其他人修改') ? 409 : 500).json({ success: false, error: message });
  }
}
