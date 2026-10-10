import type { NextApiRequest, NextApiResponse } from 'next';
import SchedulerService from '@/services/schedulerService';
import { EJobType, EMarketType } from '@/services/models/SchedulerLog';

export const dynamic = 'force-dynamic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { days = '7', jobType, marketType } = req.query;
      const daysNum = parseInt(days as string);

      // 获取执行统计
      const stats = await SchedulerService.getExecutionStats(daysNum);

      // 获取需要重试的任务
      const retryableTasks = await SchedulerService.getRetryableTasks(
        jobType as EJobType,
        marketType as EMarketType
      );

      res.status(200).json({
        success: true,
        data: {
          statistics: stats,
          retryable_tasks: retryableTasks,
          task_types: {
            DAY_RSI_WATCH: '日RSI监控',
            BACKTREND_15RSI: '15分钟RSI回测'
          },
          market_types: {
            A: 'A股',
            HK: '港股',
            US: '美股',
            ALL: '全市场'
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ 获取定时器统计失败:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }

  } else if (req.method === 'POST') {
    // 手动清理过期日志
    try {
      const { retentionDays = 30 } = req.body;
      const deletedCount = await SchedulerService.cleanupOldLogs(retentionDays);

      res.status(200).json({
        success: true,
        message: `清理了 ${deletedCount} 条过期日志`,
        deleted_count: deletedCount,
        retention_days: retentionDays,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ 清理日志失败:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }

  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 