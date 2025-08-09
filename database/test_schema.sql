-- ====================================================================
-- RSI 数据库表结构测试脚本
-- 用于验证表结构是否正确创建
-- ====================================================================

-- 测试表结构
DESCRIBE rsi_data;
DESCRIBE rsi_recommendations;

-- 测试视图是否创建成功
SHOW FULL TABLES WHERE Table_type = 'VIEW';

-- 测试外键关联
SELECT 
    TABLE_NAME, 
    COLUMN_NAME, 
    REFERENCED_TABLE_NAME, 
    REFERENCED_COLUMN_NAME 
FROM information_schema.KEY_COLUMN_USAGE 
WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
AND REFERENCED_TABLE_NAME = 'rsi_data';

-- 测试索引是否创建成功
SHOW INDEX FROM rsi_data;
SHOW INDEX FROM rsi_recommendations;

-- 验证表结构差异
SELECT 
    'rsi_data表字段数' as description,
    COUNT(*) as count
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'rsi_data';

SELECT 
    'rsi_recommendations表字段数' as description,
    COUNT(*) as count
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'rsi_recommendations';

-- 检查rsi_data表是否不包含建议字段
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'rsi_data'
ORDER BY ORDINAL_POSITION;

-- 检查rsi_recommendations表是否包含分析字段
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_COMMENT
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'rsi_recommendations'
AND COLUMN_NAME IN ('suggestion', 'is_chip_increase', 'is_backtest', 'trade_direction', 'rsi_data_id')
ORDER BY ORDINAL_POSITION; 