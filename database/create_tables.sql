-- ====================================================================
-- RSI 数据库表创建脚本
-- 基于 Sequelize 模型生成的 SQL 语句
-- 
-- 支持数据库: MySQL 8.0+, PostgreSQL 12+, SQLite 3.x
-- 创建时间: 2025-01-27
-- ====================================================================

-- 设置字符集（MySQL）
-- SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ====================================================================
-- 1. RSI 数据主表 (rsi_data)
-- ====================================================================
-- 选择数据库
USE stock;

CREATE TABLE IF NOT EXISTS `rsi_data` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stock_code` VARCHAR(20) NOT NULL COMMENT '股票代码',
    `stock_name` VARCHAR(100) NOT NULL COMMENT '股票名称',
    `stock_type` ENUM('A', 'HK', 'US') NOT NULL COMMENT '股票类型：A股、港股、美股',
    `market` INTEGER NOT NULL COMMENT '市场类型编号',
    `klt` INTEGER NOT NULL COMMENT 'K线类型：5=5分钟, 15=15分钟, 101=日线',
    `klt_desc` VARCHAR(20) NOT NULL COMMENT 'K线类型描述',
    `rsi_value` DECIMAL(10, 2) NOT NULL COMMENT 'RSI指标值',
    `price` DECIMAL(10, 2) NOT NULL COMMENT '当前价格',
    `price_change` VARCHAR(20) NULL COMMENT '价格变化百分比',
    `timestamp` DATETIME NOT NULL COMMENT 'RSI数据对应的时间戳',
    `market_link` TEXT NOT NULL COMMENT '股票市场链接',
    `req_type` ENUM('EASY_MONEY', 'FU_TU') NOT NULL COMMENT '数据请求类型',
    `created_date` DATE NOT NULL COMMENT '数据创建日期',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RSI原始数据表 - 仅存储从东方财富拉取的纯净RSI数据';

-- ====================================================================
-- 2. RSI 推荐表 (rsi_recommendations)
-- ====================================================================

CREATE TABLE IF NOT EXISTS `rsi_recommendations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rsi_data_id` INTEGER NULL COMMENT '关联的RSI原始数据ID',
    `stock_code` VARCHAR(20) NOT NULL COMMENT '股票代码',
    `stock_name` VARCHAR(100) NOT NULL COMMENT '股票名称',
    `stock_type` ENUM('A', 'HK', 'US') NOT NULL COMMENT '股票类型：A股、港股、美股',
    `market` INTEGER NOT NULL COMMENT '市场类型编号',
    `klt` INTEGER NOT NULL COMMENT 'K线类型：5=5分钟, 15=15分钟, 101=日线',
    `klt_desc` VARCHAR(20) NOT NULL COMMENT 'K线类型描述',
    `rsi_value` DECIMAL(10, 2) NOT NULL COMMENT 'RSI指标值',
    `suggestion` ENUM('立即买入🚀', '建议买入🔥', '立即卖出😱', '建议卖出🚨') NOT NULL COMMENT '买卖建议',
    `price` DECIMAL(10, 2) NOT NULL COMMENT '当前价格',
    `price_change` VARCHAR(20) NULL COMMENT '价格变化百分比',
    `volume` BIGINT NULL COMMENT '成交量',
    `timestamp` DATETIME NOT NULL COMMENT 'RSI数据对应的时间戳',
    `market_link` TEXT NOT NULL COMMENT '股票市场链接',
    `is_chip_increase` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否筹码集中度上升',
    `is_backtest` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否为回测数据',
    `backtest_profit` TEXT NULL COMMENT '回测收益信息',
    `trade_direction` BOOLEAN NULL COMMENT '交易方向趋势',
    `req_type` ENUM('EASY_MONEY', 'FU_TU') NOT NULL COMMENT '数据请求类型',
    `created_date` DATE NOT NULL COMMENT '数据创建日期',
    `is_processed` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否已处理',
    `analysis_timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分析生成时间',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`rsi_data_id`) REFERENCES `rsi_data`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='RSI分析推荐表 - 基于原始RSI数据生成的买卖建议和趋势分析';

-- ====================================================================
-- 3. 定时器执行监控表 (scheduler_logs)
-- ====================================================================

CREATE TABLE IF NOT EXISTS `scheduler_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_name` VARCHAR(100) NOT NULL COMMENT '定时任务名称',
    `job_type` ENUM('DAY_RSI_WATCH', 'BACKTREND_15RSI') NOT NULL COMMENT '任务类型',
    `market_type` ENUM('A', 'HK', 'US', 'ALL') NOT NULL COMMENT '市场类型',
    `api_path` VARCHAR(200) NOT NULL COMMENT 'API路径',
    `cron_expression` VARCHAR(50) NOT NULL COMMENT 'Cron表达式',
    `start_time` DATETIME NOT NULL COMMENT '任务开始时间',
    `end_time` DATETIME NULL COMMENT '任务结束时间',
    `duration_ms` INTEGER NULL COMMENT '执行时长(毫秒)',
    `status` ENUM('RUNNING', 'SUCCESS', 'FAILED', 'TIMEOUT') NOT NULL DEFAULT 'RUNNING' COMMENT '执行状态',
    `success` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '执行成功标志位',
    `retry_count` INTEGER NOT NULL DEFAULT 0 COMMENT '重试次数',
    `max_retries` INTEGER NOT NULL DEFAULT 3 COMMENT '最大重试次数',
    `error_message` TEXT NULL COMMENT '错误信息',
    `data_count` INTEGER NULL COMMENT '处理的数据条数',
    `execution_details` JSON NULL COMMENT '执行详情(JSON格式)',
    `next_run_time` DATETIME NULL COMMENT '下次执行时间',
    `is_manual` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否手动触发',
    `triggered_by` VARCHAR(50) NULL COMMENT '触发者(IP或用户)',
    `environment` VARCHAR(20) NOT NULL DEFAULT 'production' COMMENT '运行环境',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='定时器执行监控表 - 记录API定时任务的执行状态和重试逻辑';

-- ====================================================================
-- 4. 创建索引 - RSI 原始数据表
-- ====================================================================

-- 复合索引：股票代码 + K线类型 + 时间戳 (主要查询索引)
CREATE INDEX `idx_stock_code_klt_timestamp` ON `rsi_data` (`stock_code`, `klt`, `timestamp`);

-- 复合索引：股票类型 + K线类型 + 创建日期 (统计分析索引)
CREATE INDEX `idx_stock_type_klt_created_date` ON `rsi_data` (`stock_type`, `klt`, `created_date`);

-- 复合索引：RSI值 + 时间戳 (RSI值范围查询索引)
CREATE INDEX `idx_rsi_value_timestamp` ON `rsi_data` (`rsi_value`, `timestamp`);

-- 单列索引：创建日期 (日期范围查询)
CREATE INDEX `idx_created_date` ON `rsi_data` (`created_date`);

-- 单列索引：时间戳 (时间范围查询)
CREATE INDEX `idx_timestamp` ON `rsi_data` (`timestamp`);

-- ====================================================================
-- 5. 创建索引 - RSI 分析推荐表
-- ====================================================================

-- 外键索引：关联原始数据ID (关联查询索引)
CREATE INDEX `idx_rsi_data_id` ON `rsi_recommendations` (`rsi_data_id`);

-- 复合索引：股票代码 + 建议类型 + 时间戳 (推荐主查询索引)
CREATE INDEX `idx_stock_code_suggestion_timestamp` ON `rsi_recommendations` (`stock_code`, `suggestion`, `timestamp`);

-- 复合索引：股票类型 + K线类型 + 创建日期 (统计分析索引)
CREATE INDEX `idx_stock_type_klt_created_date_rec` ON `rsi_recommendations` (`stock_type`, `klt`, `created_date`);

-- 复合索引：建议类型 + 处理状态 (业务处理索引)
CREATE INDEX `idx_suggestion_is_processed` ON `rsi_recommendations` (`suggestion`, `is_processed`);

-- 复合索引：RSI值 + 建议类型 (分析查询索引)
CREATE INDEX `idx_rsi_value_suggestion` ON `rsi_recommendations` (`rsi_value`, `suggestion`);

-- 复合索引：分析时间 + 处理状态 (时序分析索引)
CREATE INDEX `idx_analysis_timestamp_processed` ON `rsi_recommendations` (`analysis_timestamp`, `is_processed`);

-- 单列索引：创建日期 (日期范围查询)
CREATE INDEX `idx_created_date_rec` ON `rsi_recommendations` (`created_date`);

-- ====================================================================
-- 6. 创建索引 - 定时器执行监控表
-- ====================================================================

-- 复合索引：任务类型 + 市场类型 + 执行时间 (主要查询索引)
CREATE INDEX `idx_job_type_market_start_time` ON `scheduler_logs` (`job_type`, `market_type`, `start_time`);

-- 复合索引：执行状态 + 成功标志 + 重试次数 (状态查询索引)
CREATE INDEX `idx_status_success_retry` ON `scheduler_logs` (`status`, `success`, `retry_count`);

-- 复合索引：任务名称 + 执行时间 (任务历史查询索引)
CREATE INDEX `idx_job_name_start_time` ON `scheduler_logs` (`job_name`, `start_time`);

-- 单列索引：开始时间 (时间范围查询)
CREATE INDEX `idx_start_time` ON `scheduler_logs` (`start_time`);

-- 单列索引：下次执行时间 (调度查询)
CREATE INDEX `idx_next_run_time` ON `scheduler_logs` (`next_run_time`);

-- 复合索引：失败任务重试查询 (success=false + retry_count < max_retries)
CREATE INDEX `idx_failed_retry_lookup` ON `scheduler_logs` (`success`, `retry_count`, `max_retries`);

-- 单列索引：API路径 (按接口统计)
CREATE INDEX `idx_api_path` ON `scheduler_logs` (`api_path`);

-- ====================================================================
-- 7. 创建视图 - 便于查询和统计
-- ====================================================================

-- RSI 原始数据统计视图
CREATE OR REPLACE VIEW `v_rsi_data_statistics` AS
SELECT 
    stock_type,
    klt,
    klt_desc,
    DATE(created_at) as date,
    COUNT(*) as total_records,
    AVG(rsi_value) as avg_rsi,
    MIN(rsi_value) as min_rsi,
    MAX(rsi_value) as max_rsi,
    COUNT(CASE WHEN rsi_value <= 30 THEN 1 END) as oversold_count,
    COUNT(CASE WHEN rsi_value >= 70 THEN 1 END) as overbought_count,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price
FROM rsi_data 
GROUP BY stock_type, klt, klt_desc, DATE(created_at)
ORDER BY date DESC;

-- RSI 推荐统计视图
CREATE OR REPLACE VIEW `v_rsi_recommendations_statistics` AS
SELECT 
    stock_type,
    klt,
    klt_desc,
    DATE(analysis_timestamp) as analysis_date,
    COUNT(*) as total_recommendations,
    COUNT(CASE WHEN suggestion LIKE '%买入%' THEN 1 END) as buy_count,
    COUNT(CASE WHEN suggestion LIKE '%卖出%' THEN 1 END) as sell_count,
    COUNT(CASE WHEN suggestion LIKE '立即%' THEN 1 END) as immediate_count,
    COUNT(CASE WHEN suggestion LIKE '建议%' THEN 1 END) as suggested_count,
    COUNT(CASE WHEN is_processed = TRUE THEN 1 END) as processed_count,
    AVG(rsi_value) as avg_rsi_with_suggestion
FROM rsi_recommendations 
GROUP BY stock_type, klt, klt_desc, DATE(analysis_timestamp)
ORDER BY analysis_date DESC;

-- 最新推荐视图
CREATE OR REPLACE VIEW `v_latest_recommendations` AS
SELECT 
    r.*,
    ROW_NUMBER() OVER (PARTITION BY r.stock_code, r.klt ORDER BY r.analysis_timestamp DESC) as rn
FROM rsi_recommendations r
WHERE r.is_processed = FALSE
AND r.analysis_timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR);

-- RSI 数据与推荐关联视图
CREATE OR REPLACE VIEW `v_rsi_data_with_recommendations` AS
SELECT 
    d.id as data_id,
    d.stock_code,
    d.stock_name,
    d.stock_type,
    d.klt,
    d.klt_desc,
    d.rsi_value,
    d.price,
    d.timestamp as data_timestamp,
    r.id as recommendation_id,
    r.suggestion,
    r.analysis_timestamp,
    r.is_processed,
    r.is_chip_increase,
    r.trade_direction,
    CASE 
        WHEN r.id IS NOT NULL THEN 'HAS_RECOMMENDATION'
        ELSE 'NO_RECOMMENDATION'
    END as recommendation_status
FROM rsi_data d
LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id
ORDER BY d.timestamp DESC;

-- ====================================================================
-- 7. 插入示例数据（可选）
-- ====================================================================

-- 插入RSI原始数据示例（仅包含纯净的原始数据字段）
-- INSERT INTO `rsi_data` (
--   `stock_code`, `stock_name`, `stock_type`, `market`, `klt`, `klt_desc`, 
--   `rsi_value`, `price`, `price_change`, `volume`, `timestamp`, 
--   `market_link`, `req_type`, `created_date`
-- ) VALUES
-- ('000001', '平安银行', 'A', 1, 15, '15RSI', 75.50, 10.50, '+2.1', 1250000, NOW(), 'https://quote.eastmoney.com/sz000001.html', 'EASY_MONEY', CURDATE()),
-- ('000002', '万科A', 'A', 1, 101, 'DAYRSI', 25.30, 18.20, '-1.8', 980000, NOW(), 'https://quote.eastmoney.com/sz000002.html', 'EASY_MONEY', CURDATE()),
-- ('00700', '腾讯控股', 'HK', 116, 15, '15RSI', 80.20, 320.50, '+1.2', 8500000, NOW(), 'https://quote.eastmoney.com/hk00700.html', 'FU_TU', CURDATE());

-- 插入RSI分析推荐示例（包含分析和趋势相关字段）
-- INSERT INTO `rsi_recommendations` (
--   `rsi_data_id`, `stock_code`, `stock_name`, `stock_type`, `market`, `klt`, `klt_desc`, 
--   `rsi_value`, `suggestion`, `price`, `price_change`, `volume`, `timestamp`, 
--   `market_link`, `is_chip_increase`, `is_backtest`, `backtest_profit`, 
--   `trade_direction`, `req_type`, `created_date`, `is_processed`
-- ) VALUES
-- (1, '000001', '平安银行', 'A', 1, 15, '15RSI', 75.50, '建议卖出🚨', 10.50, '+2.1', 1250000, NOW(), 'https://quote.eastmoney.com/sz000001.html', FALSE, FALSE, NULL, FALSE, 'EASY_MONEY', CURDATE(), FALSE),
-- (2, '000002', '万科A', 'A', 1, 101, 'DAYRSI', 25.30, '建议买入🔥', 18.20, '-1.8', 980000, NOW(), 'https://quote.eastmoney.com/sz000002.html', TRUE, FALSE, NULL, TRUE, 'EASY_MONEY', CURDATE(), FALSE),
-- (3, '00700', '腾讯控股', 'HK', 116, 15, '15RSI', 80.20, '立即卖出😱', 320.50, '+1.2', 8500000, NOW(), 'https://quote.eastmoney.com/hk00700.html', FALSE, FALSE, NULL, FALSE, 'FU_TU', CURDATE(), FALSE);

-- ====================================================================
-- 8. 数据库优化建议
-- ====================================================================

-- 设置 MySQL 优化参数
-- SET GLOBAL innodb_buffer_pool_size = 268435456; -- 256MB
-- SET GLOBAL max_connections = 200;
-- SET GLOBAL query_cache_size = 67108864; -- 64MB

-- 分区建议（按创建日期分区，适合大数据量）
-- ALTER TABLE rsi_data PARTITION BY RANGE (TO_DAYS(created_date)) (
--     PARTITION p202501 VALUES LESS THAN (TO_DAYS('2025-02-01')),
--     PARTITION p202502 VALUES LESS THAN (TO_DAYS('2025-03-01')),
--     PARTITION p202503 VALUES LESS THAN (TO_DAYS('2025-04-01')),
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- ====================================================================
-- 执行完成
-- ====================================================================
-- 🎉 RSI分析数据库表创建完成！
-- 
-- 📊 表结构说明：
-- ✅ rsi_data: 原始RSI数据表 - 仅存储从东方财富拉取的纯净数据
-- ✅ rsi_recommendations: 分析推荐表 - 存储基于原始数据生成的买卖建议和趋势分析
-- 
-- 🔗 表关系：
-- rsi_recommendations.rsi_data_id -> rsi_data.id (外键关联)
-- 
-- 📋 下一步操作：
-- 1. 检查表结构：
--    DESCRIBE rsi_data; 
--    DESCRIBE rsi_recommendations;
-- 
-- 2. 查看索引：
--    SHOW INDEX FROM rsi_data; 
--    SHOW INDEX FROM rsi_recommendations;
-- 
-- 3. 测试连接：
--    SELECT COUNT(*) FROM rsi_data;
--    SELECT COUNT(*) FROM rsi_recommendations;
-- 
-- 4. 查看视图：
--    SELECT * FROM v_rsi_data_statistics LIMIT 5;
--    SELECT * FROM v_rsi_recommendations_statistics LIMIT 5;
--    SELECT * FROM v_latest_recommendations LIMIT 10;
--    SELECT * FROM v_rsi_data_with_recommendations LIMIT 10;
-- 
-- 5. 验证外键关联：
--    SELECT d.stock_code, d.rsi_value, r.suggestion 
--    FROM rsi_data d 
--    LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id 
--    LIMIT 5;
-- 
-- 🚀 数据库已就绪，可以开始使用RSI分析系统！
-- ==================================================================== 