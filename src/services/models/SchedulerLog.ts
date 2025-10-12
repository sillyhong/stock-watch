import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../lib/database';

// 任务类型枚举
export enum EJobType {
  DAY_RSI_WATCH = 'DAY_RSI_WATCH',
  BACKTREND_15RSI = 'BACKTREND_15RSI',
  BACKTREND_30RSI = 'BACKTREND_30RSI',
}

// 市场类型枚举
export enum EMarketType {
  A = 'A',
  HK = 'HK', 
  US = 'US',
  ALL = 'ALL',
}

// 执行状态枚举
export enum EExecutionStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
}

// 定时器监控日志属性接口
interface SchedulerLogAttributes {
  id: number;
  job_name: string; // 定时任务名称
  job_type: EJobType; // 任务类型
  market_type: EMarketType; // 市场类型
  api_path: string; // API路径
  cron_expression: string; // Cron表达式
  start_time: Date; // 任务开始时间
  end_time: Date | null; // 任务结束时间
  duration_ms: number | null; // 执行时长(毫秒)
  status: EExecutionStatus; // 执行状态
  success: boolean; // 执行成功标志位
  retry_count: number; // 重试次数
  max_retries: number; // 最大重试次数
  error_message: string | null; // 错误信息
  data_count: number | null; // 处理的数据条数
  execution_details: Record<string, unknown> | null; // 执行详情(JSON格式)
  next_run_time: Date | null; // 下次执行时间
  is_manual: boolean; // 是否手动触发
  triggered_by: string | null; // 触发者(IP或用户)
  environment: string; // 运行环境
  created_at: Date;
  updated_at: Date;
}

// 创建模型时的可选属性
type SchedulerLogCreationAttributes = Optional<SchedulerLogAttributes, 
  'id' | 'created_at' | 'updated_at' | 'end_time' | 'duration_ms' | 'success' | 
  'retry_count' | 'max_retries' | 'error_message' | 'data_count' | 'execution_details' | 
  'next_run_time' | 'is_manual' | 'triggered_by' | 'environment'
>;

// 定时器监控日志模型类
class SchedulerLog extends Model<SchedulerLogAttributes, SchedulerLogCreationAttributes> implements SchedulerLogAttributes {
  public id!: number;
  public job_name!: string;
  public job_type!: EJobType;
  public market_type!: EMarketType;
  public api_path!: string;
  public cron_expression!: string;
  public start_time!: Date;
  public end_time!: Date | null;
  public duration_ms!: number | null;
  public status!: EExecutionStatus;
  public success!: boolean;
  public retry_count!: number;
  public max_retries!: number;
  public error_message!: string | null;
  public data_count!: number | null;
  public execution_details!: Record<string, unknown> | null;
  public next_run_time!: Date | null;
  public is_manual!: boolean;
  public triggered_by!: string | null;
  public environment!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * 标记任务开始执行
   */
  async markAsRunning(): Promise<void> {
    await this.update({
      status: EExecutionStatus.RUNNING,
      start_time: new Date(),
    });
  }

  /**
   * 标记任务成功完成
   */
  async markAsSuccess(dataCount?: number, executionDetails?: Record<string, unknown>): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.start_time.getTime();
    
    await this.update({
      status: EExecutionStatus.SUCCESS,
      success: true,
      end_time: endTime,
      duration_ms: duration,
      data_count: dataCount,
      execution_details: executionDetails,
    });
  }

  /**
   * 标记任务失败
   */
  async markAsFailed(errorMessage: string, shouldRetry: boolean = false): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.start_time.getTime();
    
    const updates: Partial<SchedulerLogAttributes> = {
      status: EExecutionStatus.FAILED,
      success: false,
      end_time: endTime,
      duration_ms: duration,
      error_message: errorMessage,
    };

    if (shouldRetry && this.retry_count < this.max_retries) {
      updates.retry_count = this.retry_count + 1;
      // 计算下次重试时间 (指数退避: 2^retry_count 分钟后重试)
      const retryDelayMinutes = Math.pow(2, this.retry_count);
      updates.next_run_time = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
    }

    await this.update(updates);
  }

  /**
   * 标记任务超时
   */
  async markAsTimeout(): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.start_time.getTime();
    
    await this.update({
      status: EExecutionStatus.TIMEOUT,
      success: false,
      end_time: endTime,
      duration_ms: duration,
      error_message: 'Task execution timeout',
    });
  }

  /**
   * 检查是否需要重试
   */
  needsRetry(): boolean {
    return !this.success && this.retry_count < this.max_retries;
  }

  /**
   * 获取下次重试时间
   */
  getNextRetryTime(): Date | null {
    if (!this.needsRetry()) return null;
    return this.next_run_time;
  }
}

// 初始化定时器监控日志模型
SchedulerLog.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  job_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '定时任务名称',
  },
  job_type: {
    type: DataTypes.ENUM('DAY_RSI_WATCH', 'BACKTREND_15RSI'),
    allowNull: false,
    comment: '任务类型',
  },
  market_type: {
    type: DataTypes.ENUM('A', 'HK', 'US', 'ALL'),
    allowNull: false,
    comment: '市场类型',
  },
  api_path: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'API路径',
  },
  cron_expression: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Cron表达式',
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '任务开始时间',
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '任务结束时间',
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '执行时长(毫秒)',
  },
  status: {
    type: DataTypes.ENUM('RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT'),
    allowNull: false,
    defaultValue: 'RUNNING',
    comment: '执行状态',
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '执行成功标志位',
  },
  retry_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: '重试次数',
  },
  max_retries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    comment: '最大重试次数',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '错误信息',
  },
  data_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '处理的数据条数',
  },
  execution_details: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '执行详情(JSON格式)',
  },
  next_run_time: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '下次执行时间',
  },
  is_manual: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否手动触发',
  },
  triggered_by: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '触发者(IP或用户)',
  },
  environment: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'production',
    comment: '运行环境',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'SchedulerLog',
  tableName: 'scheduler_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  comment: '定时器执行监控表 - 记录API定时任务的执行状态和重试逻辑',
  indexes: [
    {
      name: 'idx_job_type_market_start_time',
      fields: ['job_type', 'market_type', 'start_time'],
    },
    {
      name: 'idx_status_success_retry',
      fields: ['status', 'success', 'retry_count'],
    },
    {
      name: 'idx_job_name_start_time',
      fields: ['job_name', 'start_time'],
    },
    {
      name: 'idx_start_time',
      fields: ['start_time'],
    },
    {
      name: 'idx_next_run_time',
      fields: ['next_run_time'],
    },
    {
      name: 'idx_failed_retry_lookup',
      fields: ['success', 'retry_count', 'max_retries'],
    },
    {
      name: 'idx_api_path',
      fields: ['api_path'],
    },
  ],
});

export default SchedulerLog; 