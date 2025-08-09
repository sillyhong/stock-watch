-- ====================================================================
-- RSI 分析系统演示查询
-- 展示基于重构后架构的各种查询模式和业务场景
-- 
-- 表结构：
-- - rsi_data: 原始RSI数据表 (纯净数据，无建议字段)
-- - rsi_recommendations: 分析推荐表 (包含所有分析和建议字段)
-- - 外键关联: rsi_recommendations.rsi_data_id -> rsi_data.id
-- ====================================================================

-- ====================================================================
-- 1. 数据插入演示 - 基于新的表结构
-- ====================================================================

-- 插入原始RSI数据 (仅纯净数据)
INSERT INTO rsi_data (
    stock_code, stock_name, stock_type, market, klt, klt_desc, 
    rsi_value, price, price_change, volume, timestamp, 
    market_link, req_type, created_date
) VALUES
-- A股数据
('000001', '平安银行', 'A', 1, 15, '15RSI', 75.50, 10.50, '+2.1', 1250000, '2025-01-27 14:30:00', 'https://quote.eastmoney.com/sz000001.html', 'EASY_MONEY', '2025-01-27'),
('000002', '万科A', 'A', 1, 15, '15RSI', 25.30, 18.20, '-1.8', 980000, '2025-01-27 14:30:00', 'https://quote.eastmoney.com/sz000002.html', 'EASY_MONEY', '2025-01-27'),
('000858', '五粮液', 'A', 1, 101, 'DAYRSI', 19.80, 156.30, '-3.2', 2300000, '2025-01-27 15:00:00', 'https://quote.eastmoney.com/sz000858.html', 'EASY_MONEY', '2025-01-27'),
('300750', '宁德时代', 'A', 1, 101, 'DAYRSI', 82.40, 188.50, '+5.6', 3100000, '2025-01-27 15:00:00', 'https://quote.eastmoney.com/sz300750.html', 'EASY_MONEY', '2025-01-27'),

-- 港股数据
('00700', '腾讯控股', 'HK', 116, 15, '15RSI', 78.20, 380.50, '+1.2', 8500000, '2025-01-27 15:30:00', 'https://quote.eastmoney.com/hk00700.html', 'FU_TU', '2025-01-27'),
('09988', '阿里巴巴-SW', 'HK', 116, 15, '15RSI', 22.10, 78.40, '-2.8', 12000000, '2025-01-27 15:30:00', 'https://quote.eastmoney.com/hk09988.html', 'FU_TU', '2025-01-27'),
('01024', '快手-W', 'HK', 116, 101, 'DAYRSI', 85.60, 45.80, '+8.3', 15600000, '2025-01-27 16:00:00', 'https://quote.eastmoney.com/hk01024.html', 'FU_TU', '2025-01-27'),

-- 美股数据
('AAPL', '苹果', 'US', 105, 15, '15RSI', 25.70, 225.40, '-1.5', 45000000, '2025-01-27 21:30:00', 'https://quote.eastmoney.com/us/AAPL.html', 'FU_TU', '2025-01-27'),
('TSLA', '特斯拉', 'US', 105, 15, '15RSI', 79.30, 248.90, '+3.8', 32000000, '2025-01-27 21:30:00', 'https://quote.eastmoney.com/us/TSLA.html', 'FU_TU', '2025-01-27'),
('NVDA', '英伟达', 'US', 105, 101, 'DAYRSI', 18.50, 142.30, '-4.2', 68000000, '2025-01-27 22:00:00', 'https://quote.eastmoney.com/us/NVDA.html', 'FU_TU', '2025-01-27');

-- 插入分析推荐数据 (基于原始数据的分析结果)
INSERT INTO rsi_recommendations (
    rsi_data_id, stock_code, stock_name, stock_type, market, klt, klt_desc, 
    rsi_value, suggestion, price, price_change, volume, timestamp, 
    market_link, is_chip_increase, is_backtest, trade_direction, 
    req_type, created_date, is_processed
) VALUES
-- 基于RSI值生成的建议
(1, '000001', '平安银行', 'A', 1, 15, '15RSI', 75.50, '建议卖出🚨', 10.50, '+2.1', 1250000, '2025-01-27 14:30:00', 'https://quote.eastmoney.com/sz000001.html', FALSE, FALSE, FALSE, 'EASY_MONEY', '2025-01-27', FALSE),
(2, '000002', '万科A', 'A', 1, 15, '15RSI', 25.30, '建议买入🔥', 18.20, '-1.8', 980000, '2025-01-27 14:30:00', 'https://quote.eastmoney.com/sz000002.html', TRUE, FALSE, TRUE, 'EASY_MONEY', '2025-01-27', FALSE),
(3, '000858', '五粮液', 'A', 1, 101, 'DAYRSI', 19.80, '立即买入🚀', 156.30, '-3.2', 2300000, '2025-01-27 15:00:00', 'https://quote.eastmoney.com/sz000858.html', FALSE, FALSE, TRUE, 'EASY_MONEY', '2025-01-27', FALSE),
(4, '300750', '宁德时代', 'A', 1, 101, 'DAYRSI', 82.40, '立即卖出😱', 188.50, '+5.6', 3100000, '2025-01-27 15:00:00', 'https://quote.eastmoney.com/sz300750.html', FALSE, FALSE, FALSE, 'EASY_MONEY', '2025-01-27', FALSE),
(5, '00700', '腾讯控股', 'HK', 116, 15, '15RSI', 78.20, '建议卖出🚨', 380.50, '+1.2', 8500000, '2025-01-27 15:30:00', 'https://quote.eastmoney.com/hk00700.html', FALSE, FALSE, FALSE, 'FU_TU', '2025-01-27', FALSE),
(6, '09988', '阿里巴巴-SW', 'HK', 116, 15, '15RSI', 22.10, '建议买入🔥', 78.40, '-2.8', 12000000, '2025-01-27 15:30:00', 'https://quote.eastmoney.com/hk09988.html', TRUE, FALSE, TRUE, 'FU_TU', '2025-01-27', FALSE),
(7, '01024', '快手-W', 'HK', 116, 101, 'DAYRSI', 85.60, '立即卖出😱', 45.80, '+8.3', 15600000, '2025-01-27 16:00:00', 'https://quote.eastmoney.com/hk01024.html', FALSE, FALSE, FALSE, 'FU_TU', '2025-01-27', FALSE),
(8, 'AAPL', '苹果', 'US', 105, 15, '15RSI', 25.70, '建议买入🔥', 225.40, '-1.5', 45000000, '2025-01-27 21:30:00', 'https://quote.eastmoney.com/us/AAPL.html', FALSE, FALSE, TRUE, 'FU_TU', '2025-01-27', FALSE),
(9, 'TSLA', '特斯拉', 'US', 105, 15, '15RSI', 79.30, '建议卖出🚨', 248.90, '+3.8', 32000000, '2025-01-27 21:30:00', 'https://quote.eastmoney.com/us/TSLA.html', FALSE, FALSE, FALSE, 'FU_TU', '2025-01-27', FALSE),
(10, 'NVDA', '英伟达', 'US', 105, 101, 'DAYRSI', 18.50, '立即买入🚀', 142.30, '-4.2', 68000000, '2025-01-27 22:00:00', 'https://quote.eastmoney.com/us/NVDA.html', TRUE, FALSE, TRUE, 'FU_TU', '2025-01-27', FALSE);

-- ====================================================================
-- 2. 原始RSI数据查询 (rsi_data表)
-- ====================================================================

-- 查询最新的原始RSI数据
SELECT 
    stock_code,
    stock_name,
    stock_type,
    klt_desc,
    rsi_value,
    price,
    price_change,
    timestamp
FROM rsi_data 
ORDER BY timestamp DESC 
LIMIT 10;

-- 查询特定股票的RSI历史趋势
SELECT 
    stock_code,
    stock_name,
    rsi_value,
    price,
    timestamp,
    DATE(timestamp) as trade_date,
    -- 标记RSI区域
    CASE 
        WHEN rsi_value <= 30 THEN '超卖区域'
        WHEN rsi_value >= 70 THEN '超买区域'
        ELSE '正常区域'
    END as rsi_zone
FROM rsi_data 
WHERE stock_code = '000001'
AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY timestamp DESC;

-- 统计原始RSI数据分布
SELECT 
    stock_type,
    klt_desc,
    COUNT(*) as total_records,
    AVG(rsi_value) as avg_rsi,
    MIN(rsi_value) as min_rsi,
    MAX(rsi_value) as max_rsi,
    COUNT(CASE WHEN rsi_value <= 30 THEN 1 END) as oversold_count,
    COUNT(CASE WHEN rsi_value >= 70 THEN 1 END) as overbought_count
FROM rsi_data 
WHERE DATE(timestamp) = CURDATE()
GROUP BY stock_type, klt_desc
ORDER BY stock_type, klt;

-- 查询RSI极值股票
SELECT 
    stock_code,
    stock_name,
    rsi_value,
    price,
    CASE 
        WHEN rsi_value <= 20 THEN '严重超卖'
        WHEN rsi_value <= 30 THEN '超卖'
        WHEN rsi_value >= 80 THEN '严重超买'
        WHEN rsi_value >= 70 THEN '超买'
        ELSE '正常'
    END as rsi_level
FROM rsi_data 
WHERE rsi_value <= 20 OR rsi_value >= 80
ORDER BY rsi_value;

-- ====================================================================
-- 3. 分析推荐查询 (rsi_recommendations表)
-- ====================================================================

-- 查询最新的买卖建议
SELECT 
    stock_code,
    stock_name,
    rsi_value,
    suggestion,
    price,
    price_change,
    analysis_timestamp,
    is_chip_increase,
    trade_direction,
    is_processed
FROM rsi_recommendations 
WHERE DATE(analysis_timestamp) = CURDATE()
ORDER BY analysis_timestamp DESC 
LIMIT 10;

-- 查询立即买入建议
SELECT 
    stock_code,
    stock_name,
    rsi_value,
    suggestion,
    price,
    is_chip_increase,
    analysis_timestamp
FROM rsi_recommendations 
WHERE suggestion IN ('立即买入🚀', '建议买入🔥')
AND DATE(analysis_timestamp) = CURDATE()
AND is_processed = FALSE
ORDER BY rsi_value ASC;

-- 查询立即卖出建议
SELECT 
    stock_code,
    stock_name,
    rsi_value,
    suggestion,
    price,
    trade_direction,
    analysis_timestamp
FROM rsi_recommendations 
WHERE suggestion IN ('立即卖出😱', '建议卖出🚨')
AND DATE(analysis_timestamp) = CURDATE()
AND is_processed = FALSE
ORDER BY rsi_value DESC;

-- 统计建议分布
SELECT 
    stock_type,
    klt_desc,
    suggestion,
    COUNT(*) as count,
    AVG(rsi_value) as avg_rsi_with_suggestion
FROM rsi_recommendations 
WHERE DATE(analysis_timestamp) = CURDATE()
GROUP BY stock_type, klt_desc, suggestion
ORDER BY stock_type, klt, suggestion;

-- 按建议紧急程度排序
SELECT 
    CASE 
        WHEN suggestion = '立即买入🚀' THEN 1
        WHEN suggestion = '立即卖出😱' THEN 2
        WHEN suggestion = '建议买入🔥' THEN 3
        WHEN suggestion = '建议卖出🚨' THEN 4
        ELSE 5
    END as priority,
    suggestion,
    stock_code,
    stock_name,
    rsi_value,
    price,
    analysis_timestamp
FROM rsi_recommendations 
WHERE is_processed = FALSE
ORDER BY priority, analysis_timestamp DESC;

-- ====================================================================
-- 4. 关联查询 (原始数据 + 分析结果)
-- ====================================================================

-- 查询原始数据及其对应的分析建议
SELECT 
    d.stock_code,
    d.stock_name,
    d.rsi_value as original_rsi,
    d.price as original_price,
    d.timestamp as data_timestamp,
    r.suggestion,
    r.is_chip_increase,
    r.trade_direction,
    r.analysis_timestamp,
    TIMESTAMPDIFF(MINUTE, d.timestamp, r.analysis_timestamp) as analysis_delay_minutes
FROM rsi_data d
INNER JOIN rsi_recommendations r ON d.id = r.rsi_data_id
WHERE DATE(d.timestamp) = CURDATE()
ORDER BY d.timestamp DESC;

-- 查询有建议的股票占原始数据的比例
SELECT 
    d.stock_type,
    d.klt_desc,
    COUNT(d.id) as total_data_records,
    COUNT(r.id) as records_with_recommendations,
    ROUND(COUNT(r.id) * 100.0 / COUNT(d.id), 2) as recommendation_rate_percent
FROM rsi_data d
LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id
WHERE DATE(d.timestamp) = CURDATE()
GROUP BY d.stock_type, d.klt_desc
ORDER BY recommendation_rate_percent DESC;

-- 查询原始数据但无分析建议的记录
SELECT 
    d.stock_code,
    d.stock_name,
    d.rsi_value,
    d.price,
    d.timestamp,
    CASE 
        WHEN d.rsi_value <= 30 THEN '超卖但无建议'
        WHEN d.rsi_value >= 70 THEN '超买但无建议'
        ELSE '正常无建议'
    END as status
FROM rsi_data d
LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id
WHERE r.id IS NULL
AND (d.rsi_value <= 30 OR d.rsi_value >= 70)
ORDER BY d.rsi_value;

-- ====================================================================
-- 5. 使用视图的查询
-- ====================================================================

-- 使用原始数据统计视图
SELECT * FROM v_rsi_data_statistics 
WHERE date = CURDATE()
ORDER BY total_records DESC;

-- 使用推荐统计视图
SELECT * FROM v_rsi_recommendations_statistics 
WHERE analysis_date = CURDATE()
ORDER BY total_recommendations DESC;

-- 使用最新推荐视图
SELECT 
    stock_code,
    stock_name,
    suggestion,
    rsi_value,
    analysis_timestamp
FROM v_latest_recommendations 
WHERE rn = 1  -- 每只股票最新的推荐
ORDER BY analysis_timestamp DESC;

-- 使用关联视图查询
SELECT 
    stock_code,
    stock_name,
    rsi_value,
    price,
    data_timestamp,
    suggestion,
    analysis_timestamp,
    recommendation_status
FROM v_rsi_data_with_recommendations 
WHERE data_timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY data_timestamp DESC
LIMIT 20;

-- ====================================================================
-- 6. 15分钟RSI交易策略分析查询
-- ====================================================================

-- 查找15分钟RSI的潜在买入机会 (RSI < 25)
SELECT 
    d.stock_code,
    d.stock_name,
    d.rsi_value,
    d.price,
    d.timestamp,
    '潜在买入机会' as signal_type,
    r.suggestion as existing_recommendation
FROM rsi_data d
LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id
WHERE d.klt = 15
AND d.rsi_value < 25
AND d.timestamp >= DATE_SUB(NOW(), INTERVAL 4 HOUR)
ORDER BY d.rsi_value ASC, d.timestamp DESC;

-- 查找15分钟RSI的潜在卖出机会 (RSI > 75)
SELECT 
    d.stock_code,
    d.stock_name,
    d.rsi_value,
    d.price,
    d.timestamp,
    '潜在卖出机会' as signal_type,
    r.suggestion as existing_recommendation
FROM rsi_data d
LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id
WHERE d.klt = 15
AND d.rsi_value > 75
AND d.timestamp >= DATE_SUB(NOW(), INTERVAL 4 HOUR)
ORDER BY d.rsi_value DESC, d.timestamp DESC;

-- 分析15分钟RSI的成功率模拟
-- (查找买入后4小时内RSI上升的情况)
SELECT 
    buy_signals.stock_code,
    buy_signals.stock_name,
    buy_signals.rsi_value as buy_rsi,
    buy_signals.price as buy_price,
    buy_signals.timestamp as buy_time,
    future_data.rsi_value as future_rsi,
    future_data.price as future_price,
    future_data.timestamp as check_time,
    ROUND(((future_data.price - buy_signals.price) / buy_signals.price) * 100, 2) as profit_percent
FROM (
    SELECT * FROM rsi_data 
    WHERE klt = 15 AND rsi_value < 25 
    AND timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)
) buy_signals
INNER JOIN (
    SELECT * FROM rsi_data
    WHERE klt = 15
) future_data ON buy_signals.stock_code = future_data.stock_code
WHERE future_data.timestamp > buy_signals.timestamp
AND future_data.timestamp <= DATE_ADD(buy_signals.timestamp, INTERVAL 4 HOUR)
AND future_data.rsi_value > 75
ORDER BY profit_percent DESC;

-- ====================================================================
-- 7. 数据质量检查和完整性验证
-- ====================================================================

-- 检查原始数据完整性
SELECT 
    'rsi_data完整性检查' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN stock_code IS NULL OR stock_code = '' THEN 1 END) as missing_stock_code,
    COUNT(CASE WHEN rsi_value IS NULL THEN 1 END) as missing_rsi_value,
    COUNT(CASE WHEN price IS NULL THEN 1 END) as missing_price,
    COUNT(CASE WHEN timestamp IS NULL THEN 1 END) as missing_timestamp
FROM rsi_data 
WHERE DATE(timestamp) = CURDATE();

-- 检查推荐数据完整性
SELECT 
    'rsi_recommendations完整性检查' as check_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN rsi_data_id IS NULL THEN 1 END) as missing_data_reference,
    COUNT(CASE WHEN suggestion IS NULL OR suggestion = '' THEN 1 END) as missing_suggestion,
    COUNT(CASE WHEN analysis_timestamp IS NULL THEN 1 END) as missing_analysis_time
FROM rsi_recommendations 
WHERE DATE(analysis_timestamp) = CURDATE();

-- 检查外键关联完整性
SELECT 
    '外键关联检查' as check_type,
    COUNT(r.id) as recommendations_count,
    COUNT(d.id) as linked_data_count,
    COUNT(r.id) - COUNT(d.id) as orphaned_recommendations
FROM rsi_recommendations r
LEFT JOIN rsi_data d ON r.rsi_data_id = d.id
WHERE DATE(r.analysis_timestamp) = CURDATE();

-- 检查重复数据
SELECT 
    stock_code,
    timestamp,
    COUNT(*) as duplicate_count
FROM rsi_data 
GROUP BY stock_code, timestamp
HAVING COUNT(*) > 1;

-- ====================================================================
-- 8. 高级分析查询
-- ====================================================================

-- 分析股票RSI分布
SELECT 
    CASE 
        WHEN rsi_value <= 20 THEN '严重超卖 (≤20)'
        WHEN rsi_value <= 30 THEN '超卖 (21-30)'
        WHEN rsi_value <= 50 THEN '偏弱 (31-50)'
        WHEN rsi_value <= 70 THEN '偏强 (51-70)'
        WHEN rsi_value <= 80 THEN '超买 (71-80)'
        ELSE '严重超买 (>80)'
    END as rsi_range,
    COUNT(*) as stock_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM rsi_data), 2) as percentage
FROM rsi_data 
GROUP BY 
    CASE 
        WHEN rsi_value <= 20 THEN '严重超卖 (≤20)'
        WHEN rsi_value <= 30 THEN '超卖 (21-30)'
        WHEN rsi_value <= 50 THEN '偏弱 (31-50)'
        WHEN rsi_value <= 70 THEN '偏强 (51-70)'
        WHEN rsi_value <= 80 THEN '超买 (71-80)'
        ELSE '严重超买 (>80)'
    END
ORDER BY 
    CASE 
        WHEN rsi_value <= 20 THEN 1
        WHEN rsi_value <= 30 THEN 2
        WHEN rsi_value <= 50 THEN 3
        WHEN rsi_value <= 70 THEN 4
        WHEN rsi_value <= 80 THEN 5
        ELSE 6
    END;

-- 分析不同市场的RSI特征
SELECT 
    stock_type,
    klt_desc,
    COUNT(*) as count,
    ROUND(AVG(rsi_value), 2) as avg_rsi,
    ROUND(STDDEV(rsi_value), 2) as rsi_stddev,
    MIN(rsi_value) as min_rsi,
    MAX(rsi_value) as max_rsi
FROM rsi_data 
GROUP BY stock_type, klt, klt_desc
ORDER BY stock_type, klt;

-- 分析建议生成率
SELECT 
    d.stock_type,
    d.klt_desc,
    CASE 
        WHEN d.rsi_value <= 30 THEN '超卖区域'
        WHEN d.rsi_value >= 70 THEN '超买区域'
        ELSE '正常区域'
    END as rsi_zone,
    COUNT(d.id) as total_records,
    COUNT(r.id) as generated_recommendations,
    ROUND(COUNT(r.id) * 100.0 / COUNT(d.id), 2) as recommendation_generation_rate
FROM rsi_data d
LEFT JOIN rsi_recommendations r ON d.id = r.rsi_data_id
GROUP BY d.stock_type, d.klt_desc, 
    CASE 
        WHEN d.rsi_value <= 30 THEN '超卖区域'
        WHEN d.rsi_value >= 70 THEN '超买区域'
        ELSE '正常区域'
    END
ORDER BY recommendation_generation_rate DESC;

-- ====================================================================
-- 9. 性能优化查询示例 (使用索引)
-- ====================================================================

-- 使用股票代码+K线类型+时间戳索引的高效查询
SELECT 
    stock_code,
    stock_name,
    AVG(rsi_value) as avg_rsi,
    COUNT(*) as data_points,
    MIN(timestamp) as earliest_time,
    MAX(timestamp) as latest_time
FROM rsi_data 
WHERE stock_code = '000001' 
AND klt = 15
AND timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY stock_code, stock_name;

-- 使用复合索引查询
SELECT 
    stock_type,
    klt,
    created_date,
    COUNT(*) as daily_count
FROM rsi_data 
WHERE stock_type = 'A' 
AND klt = 15
AND created_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY stock_type, klt, created_date
ORDER BY created_date DESC;

-- ====================================================================
-- 执行说明
-- ====================================================================

-- 🎯 重构后的优势:
-- 1. 数据纯净性: rsi_data表只包含原始数据，无分析结果干扰
-- 2. 关联清晰: 通过外键明确原始数据与分析结果的关系  
-- 3. 扩展性强: 可以基于同一原始数据生成多种分析结果
-- 4. 查询高效: 索引优化，支持复杂的关联查询
-- 
-- 💡 使用建议:
-- - 原始数据查询使用 rsi_data 表
-- - 分析结果查询使用 rsi_recommendations 表
-- - 关联分析使用 JOIN 查询或视图
-- - 统计分析优先使用预创建的视图
-- 
-- ==================================================================== 