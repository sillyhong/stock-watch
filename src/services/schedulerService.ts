import SchedulerLog, { EJobType, EMarketType, EExecutionStatus } from './models/SchedulerLog';
import { Op } from 'sequelize';
import { ENABLE_DATABASE_STORAGE } from '../pages/utils/config';

// 定时器执行上下文接口
export interface ISchedulerContext {
  jobName: string;
  jobType: EJobType;
  marketType: EMarketType;
  apiPath: string;
  cronExpression: string;
  isManual?: boolean;
  triggeredBy?: string;
  environment?: string;
  maxRetries?: number;
}

// 执行结果接口
export interface IExecutionResult {
  success: boolean;
  dataCount?: number;
  details?: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * 调度服务类
 * 负责管理定时器的监控、日志记录和重试逻辑
 */
export class SchedulerService {
  
  /**
   * 创建执行日志记录
   * @param context 执行上下文
   * @returns 创建的日志记录
   */
  static async createExecutionLog(context: ISchedulerContext): Promise<SchedulerLog | null> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log(`🔄 数据库存储已禁用，跳过任务日志记录: ${context.jobName}`);
      return null;
    }
    
    const now = new Date();
    const log = await SchedulerLog.create({
      job_name: context.jobName,
      job_type: context.jobType,
      market_type: context.marketType,
      api_path: context.apiPath,
      cron_expression: context.cronExpression,
      start_time: now,
      status: EExecutionStatus.RUNNING,
      is_manual: context.isManual || false,
      triggered_by: context.triggeredBy || null,
      environment: context.environment || 'production',
      max_retries: context.maxRetries || 3,
      created_at: now,
      updated_at: now,
    });

    console.log(`📝 创建定时器执行日志 [${context.jobName}] - ID: ${log.id}`);
    return log;
  }

  /**
   * 记录执行成功
   * @param logId 日志ID
   * @param result 执行结果
   */
  static async recordSuccess(logId: number, result: IExecutionResult): Promise<void> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log(`🔄 数据库存储已禁用，跳过成功日志记录: ${logId}`);
      return;
    }

    const log = await SchedulerLog.findByPk(logId);
    if (!log) {
      console.error(`❌ 找不到执行日志 ID: ${logId}`);
      return;
    }

    await log.markAsSuccess(result.dataCount, result.details);
    console.log(`✅ 定时器执行成功 [${log.job_name}] - 处理数据: ${result.dataCount || 0} 条`);
  }

  /**
   * 记录执行失败
   * @param logId 日志ID  
   * @param result 执行结果
   * @param shouldRetry 是否应该重试
   */
  static async recordFailure(logId: number, result: IExecutionResult, shouldRetry: boolean = true): Promise<void> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log(`🔄 数据库存储已禁用，跳过失败日志记录: ${logId}`);
      return;
    }

    const log = await SchedulerLog.findByPk(logId);
    if (!log) {
      console.error(`❌ 找不到执行日志 ID: ${logId}`);
      return;
    }

    await log.markAsFailed(result.errorMessage || 'Unknown error', shouldRetry);
    
    if (shouldRetry && log.needsRetry()) {
      console.log(`🔄 定时器执行失败，将重试 [${log.job_name}] - 重试次数: ${log.retry_count}/${log.max_retries}`);
    } else {
      console.log(`❌ 定时器执行失败 [${log.job_name}] - ${result.errorMessage}`);
    }
  }

  /**
   * 记录执行超时
   * @param logId 日志ID
   */
  static async recordTimeout(logId: number): Promise<void> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log(`🔄 数据库存储已禁用，跳过超时日志记录: ${logId}`);
      return;
    }

    const log = await SchedulerLog.findByPk(logId);
    if (!log) {
      console.error(`❌ 找不到执行日志 ID: ${logId}`);
      return;
    }

    await log.markAsTimeout();
    console.log(`⏰ 定时器执行超时 [${log.job_name}]`);
  }

  /**
   * 包装定时器执行函数，自动记录日志
   * @param context 执行上下文
   * @param executionFunction 要执行的函数
   * @param timeoutMs 超时时间(毫秒)，默认30分钟
   * @returns 执行结果
   */
  static async executeWithLogging<T>(
    context: ISchedulerContext,
    executionFunction: () => Promise<T>,
    timeoutMs: number = 30 * 60 * 1000 // 30分钟
  ): Promise<T | null> {
    // 检查数据库存储是否启用
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log(`🔄 数据库存储已禁用，直接执行任务不记录日志: ${context.jobName}`);
      try {
        const result = await executionFunction();
        console.log(`✅ 任务执行成功 [${context.jobName}] (数据库禁用模式)`);
        return result;
      } catch (error) {
        console.error(`❌ 任务执行失败 [${context.jobName}] (数据库禁用模式):`, error);
        throw error;
      }
    }

    const log = await this.createExecutionLog(context);
    if (!log) {
      // 如果日志创建失败，直接执行任务
      return await executionFunction();
    }

    let timeoutHandle: NodeJS.Timeout | null = null;
    let isCompleted = false;

    try {
      // 设置超时处理
      timeoutHandle = setTimeout(async () => {
        if (!isCompleted) {
          isCompleted = true;
          await this.recordTimeout(log.id);
        }
      }, timeoutMs);

      // 执行任务
      const result = await executionFunction();
      
      if (!isCompleted) {
        isCompleted = true;
        clearTimeout(timeoutHandle);
        
        // 判断结果类型并记录
        if (Array.isArray(result)) {
          await this.recordSuccess(log.id, { 
            success: true, 
            dataCount: result.length,
            details: { resultType: 'array', resultLength: result.length }
          });
        } else if (typeof result === 'object' && result !== null) {
          await this.recordSuccess(log.id, { 
            success: true,
            details: { resultType: 'object', result }
          });
        } else {
          await this.recordSuccess(log.id, { 
            success: true,
            details: { resultType: typeof result, result }
          });
        }
      }

      return result;

    } catch (error) {
      if (!isCompleted) {
        isCompleted = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.recordFailure(log.id, {
          success: false,
          errorMessage,
        });
      }

      // 重新抛出错误，让调用方决定如何处理
      throw error;
    }
  }

  /**
   * 获取需要重试的任务
   * @param jobType 任务类型
   * @param marketType 市场类型
   * @returns 需要重试的任务列表
   */
  static async getRetryableTasks(
    jobType?: EJobType,
    marketType?: EMarketType
  ): Promise<SchedulerLog[]> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log('🔄 数据库存储已禁用，返回空的重试任务列表');
      return [];
    }

    const where: Record<string, unknown> = {
      success: false,
      [Op.and]: [
        { retry_count: { [Op.lt]: { [Op.col]: 'max_retries' } } },
        {
          [Op.or]: [
            { next_run_time: { [Op.lte]: new Date() } },
            { next_run_time: null }
          ]
        }
      ]
    };

    if (jobType) where.job_type = jobType;
    if (marketType) where.market_type = marketType;

    return await SchedulerLog.findAll({
      where,
      order: [['next_run_time', 'ASC']],
    });
  }

  /**
   * 获取任务执行统计
   * @param days 查询天数，默认7天
   * @returns 执行统计
   */
  static async getExecutionStats(days: number = 7): Promise<Record<string, unknown>> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log('🔄 数据库存储已禁用，返回默认执行统计');
      return {
        summary: {
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
          timeout_executions: 0,
          success_rate: 0
        },
        by_job_type: [],
        by_market_type: [],
        recent_failures: [],
        note: '数据库存储已禁用，统计数据不可用'
      };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await SchedulerLog.findAll({
      where: {
        start_time: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        'job_type',
        'market_type',
        'status',
        [SchedulerLog.sequelize!.fn('COUNT', '*'), 'count'],
        [SchedulerLog.sequelize!.fn('AVG', SchedulerLog.sequelize!.col('duration_ms')), 'avg_duration'],
        [SchedulerLog.sequelize!.fn('SUM', SchedulerLog.sequelize!.col('data_count')), 'total_data_count'],
      ],
      group: ['job_type', 'market_type', 'status'],
      raw: true,
    });

    // 获取最近的失败任务
    const recentFailures = await SchedulerLog.findAll({
      where: {
        status: EExecutionStatus.FAILED,
        start_time: {
          [Op.gte]: startDate
        }
      },
      order: [['start_time', 'DESC']],
      limit: 10,
      attributes: ['job_name', 'market_type', 'start_time', 'error_message', 'retry_count'],
    });

    // 计算成功率
    const successRateStats = await SchedulerLog.findAll({
      where: {
        start_time: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        'job_type',
        'market_type',
        [SchedulerLog.sequelize!.fn('COUNT', '*'), 'total'],
        [SchedulerLog.sequelize!.fn('SUM', SchedulerLog.sequelize!.literal('CASE WHEN success = true THEN 1 ELSE 0 END')), 'success_count'],
      ],
      group: ['job_type', 'market_type'],
      raw: true,
    });

    return {
      stats_period_days: days,
      execution_stats: stats,
      recent_failures: recentFailures,
      success_rates: successRateStats,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * 清理过期日志
   * @param retentionDays 保留天数，默认30天
   * @returns 清理的记录数
   */
  static async cleanupOldLogs(retentionDays: number = 30): Promise<number> {
    if (!ENABLE_DATABASE_STORAGE) {
      // console.log('🔄 数据库存储已禁用，跳过日志清理操作');
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedCount = await SchedulerLog.destroy({
      where: {
        created_at: {
          [Op.lt]: cutoffDate
        },
        status: {
          [Op.in]: [EExecutionStatus.SUCCESS, EExecutionStatus.FAILED, EExecutionStatus.TIMEOUT]
        }
      }
    });

    console.log(`🗑️ 清理了 ${deletedCount} 条超过 ${retentionDays} 天的定时器日志`);
    return deletedCount;
  }

  /**
   * 生成任务名称
   * @param jobType 任务类型
   * @param marketType 市场类型
   * @returns 任务名称
   */
  static generateJobName(jobType: EJobType, marketType: EMarketType): string {
    const jobTypeMap = {
      [EJobType.DAY_RSI_WATCH]: 'DAY_RSI',
      [EJobType.BACKTREND_15RSI]: 'BACKTREND_15RSI',
    };

    return `${jobTypeMap[jobType]}_${marketType}`;
  }

  /**
   * 获取Cron表达式描述
   * @param cronExpression Cron表达式
   * @returns 可读的描述
   */
  static getCronDescription(cronExpression: string): string {
    const cronDescriptions: Record<string, string> = {
      '40 16 * * 1-5': '工作日 16:40',
      '50 16 * * 1-5': '工作日 16:50', 
      '0 18 * * 1-5': '工作日 18:00',
      '5 18 * * 1-5': '工作日 18:05',
      '4 17 * * 1-5': '工作日 17:04',
      '3 17 * * 1-5': '工作日 17:03',
    };

    return cronDescriptions[cronExpression] || cronExpression;
  }
}

export default SchedulerService; 