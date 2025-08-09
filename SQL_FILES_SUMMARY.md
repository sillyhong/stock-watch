# 📊 RSI 数据库 SQL 文件完整指南

## 🎯 总览

根据你的 Sequelize 模型，我已经为你创建了完整的 SQL 数据库脚本集合，支持 **MySQL**数据库。这些脚本可以让你直接在数据库中创建 RSI 分析系统所需的所有表结构。

## 📁 文件清单

### 📋 核心 SQL 文件

| 文件名 | 数据库类型 | 大小 | 功能描述 |
|--------|------------|------|----------|
| **`database/create_tables.sql`** | MySQL 8.0+ | ~8KB | MySQL 专用建表脚本，包含视图和优化建议 |
| **`database/create_tables_postgresql.sql`** | PostgreSQL 12+ | ~12KB | PostgreSQL 专用，含存储函数和高级特性 |
| **`database/create_tables_sqlite.sql`** | SQLite 3.x | ~10KB | SQLite 专用，适合开发环境和轻量部署 |

### 🛠️ 辅助工具文件

| 文件名 | 类型 | 功能描述 |
|--------|------|----------|
| **`database/setup_database.sh`** | Shell 脚本 | 自动化数据库设置工具，支持三种数据库 |
| **`database/demo_queries.sql`** | SQL 演示 | 包含 100+ 示例查询，展示如何使用数据库 |
| **`database/README.md`** | 文档 | 详细的数据库使用指南和故障排除 |

## 🚀 快速开始

### 方式一：使用自动化脚本（推荐）

```bash
# 进入数据库目录
cd database

# 给脚本执行权限
chmod +x setup_database.sh

# 选择你的数据库类型并执行
./setup_database.sh sqlite      # 开发环境推荐
./setup_database.sh mysql       # 生产环境
./setup_database.sh postgresql  # 企业级部署

# 强制执行并运行测试
./setup_database.sh sqlite -f -t
```

### 方式二：手动执行 SQL 文件

#### SQLite（开发环境）
```bash
# 创建数据目录
mkdir -p data

# 执行 SQL 脚本
sqlite3 data/rsi_data.sqlite < database/create_tables_sqlite.sql

# 验证创建结果
sqlite3 data/rsi_data.sqlite "SELECT name FROM sqlite_master WHERE type='table';"
```

#### MySQL（生产环境）
```bash
# 连接 MySQL
mysql -u your_username -p

# 在 MySQL 中执行
CREATE DATABASE rsi_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rsi_database;
source /path/to/database/create_tables.sql;
SHOW TABLES;
```

#### PostgreSQL（企业环境）
```bash
# 创建数据库
createdb -U your_username rsi_database

# 执行脚本
psql -U your_username -d rsi_database -f database/create_tables_postgresql.sql

# 验证结果
psql -U your_username -d rsi_database -c "\dt"
```

## 📊 数据库表结构

### 🗃️ 主要数据表

#### 1. `rsi_data` - RSI 数据主表
**存储所有 RSI 计算结果**

| 字段名 | 类型 | 说明 | 索引 |
|--------|------|------|------|
| `id` | INTEGER | 主键自增 | ✅ PRIMARY |
| `stock_code` | VARCHAR(20) | 股票代码 | ✅ 复合索引 |
| `stock_name` | VARCHAR(100) | 股票名称 | - |
| `stock_type` | ENUM | A股/HK股/US股 | ✅ 复合索引 |
| `klt` | INTEGER | K线类型(5/15/101) | ✅ 复合索引 |
| `rsi_value` | DECIMAL(10,2) | RSI指标值 | ✅ 单独索引 |
| `suggestion` | ENUM | 买卖建议 | ✅ 复合索引 |
| `price` | DECIMAL(10,2) | 当前价格 | - |
| `timestamp` | DATETIME | 数据时间戳 | ✅ 复合索引 |
| `created_date` | DATE | 创建日期 | ✅ 单独索引 |

#### 2. `rsi_recommendations` - RSI 推荐表
**专门存储买卖建议数据**

| 字段名 | 类型 | 说明 | 索引 |
|--------|------|------|------|
| `is_processed` | BOOLEAN | 是否已处理 | ✅ 复合索引 |
| *其他字段* | - | 与 rsi_data 相同 | - |

### 🔍 高性能索引设计

```sql
-- 主查询索引（股票代码+K线类型+时间）
idx_stock_code_klt_timestamp

-- 统计分析索引（股票类型+K线类型+日期）
idx_stock_type_klt_created_date

-- 推荐查询索引（建议类型+时间戳）
idx_suggestion_timestamp

-- 业务处理索引（建议类型+处理状态）
idx_suggestion_is_processed
```

### 📈 智能视图系统

#### 统计视图
- **`v_rsi_statistics`** - 按日期和类型统计 RSI 数据
- **`v_latest_recommendations`** - 最新推荐数据
- **`v_realtime_rsi`** - 实时 RSI 监控
- **`v_stock_performance`** - 股票表现分析

#### PostgreSQL 专属功能
- **`get_latest_rsi()`** - 获取股票最新 RSI 函数
- **`batch_insert_rsi_data()`** - 批量插入数据函数
- **`cleanup_old_rsi_data()`** - 数据清理函数

## 💡 使用示例

### 🔍 基础查询

```sql
-- 查询今日超买超卖股票
SELECT stock_code, stock_name, rsi_value, suggestion 
FROM rsi_data 
WHERE (rsi_value <= 20 OR rsi_value >= 80) 
  AND created_date = CURRENT_DATE;

-- 统计各类型建议数量
SELECT suggestion, COUNT(*) as count
FROM rsi_recommendations 
WHERE is_processed = FALSE
GROUP BY suggestion;
```

### 📊 高级分析

```sql
-- RSI 分布分析
SELECT 
    CASE 
        WHEN rsi_value <= 30 THEN '超卖'
        WHEN rsi_value >= 70 THEN '超买'
        ELSE '正常'
    END as rsi_status,
    COUNT(*) as stock_count
FROM rsi_data 
GROUP BY rsi_status;

-- 使用统计视图
SELECT * FROM v_rsi_statistics 
WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY);
```

## 🔧 配置和集成

### 环境变量配置

创建 `.env.local` 文件：

```env
# 开发环境（SQLite）
NODE_ENV=development

# 生产环境（MySQL）
DATABASE_URL=mysql://user:password@localhost:3306/rsi_database

# 企业环境（PostgreSQL）
DATABASE_URL=postgresql://user:password@localhost:5432/rsi_database
DATABASE_SSL=false
```

### Next.js 集成

```bash
# 安装数据库依赖（已在 package.json 中配置）
npm install sequelize sqlite3 pg mysql2

# 初始化数据库
npm run db:init

# 重置数据库（慎用）
npm run db:reset
```

## ⚡ 性能优化

### 数据库特定优化

#### MySQL 优化
```sql
-- 调整缓冲池大小
SET GLOBAL innodb_buffer_pool_size = 268435456; -- 256MB

-- 启用查询缓存
SET GLOBAL query_cache_size = 67108864; -- 64MB
```

#### PostgreSQL 优化
```sql
-- 调整工作内存
SET work_mem = '4MB';

-- 启用自动分析
ALTER TABLE rsi_data SET (autovacuum_analyze_scale_factor = 0.05);
```

#### SQLite 优化
```sql
-- WAL 模式提升并发
PRAGMA journal_mode = WAL;

-- 内存缓存优化
PRAGMA cache_size = 8192; -- 8MB
```

### 数据分区建议

对于大数据量场景：

```sql
-- MySQL 按月分区
ALTER TABLE rsi_data PARTITION BY RANGE (TO_DAYS(created_date)) (
    PARTITION p202501 VALUES LESS THAN (TO_DAYS('2025-02-01')),
    PARTITION p202502 VALUES LESS THAN (TO_DAYS('2025-03-01'))
);

-- PostgreSQL 分区表
CREATE TABLE rsi_data_2025_01 PARTITION OF rsi_data
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## 🛡️ 数据安全和维护

### 备份策略

```bash
# MySQL 备份
mysqldump -u user -p rsi_database > backup_$(date +%Y%m%d).sql

# PostgreSQL 备份
pg_dump -U user -d rsi_database | gzip > backup_$(date +%Y%m%d).sql.gz

# SQLite 备份
cp data/rsi_data.sqlite data/backup_$(date +%Y%m%d).sqlite
```

### 数据清理

```sql
-- 清理 90 天前的历史数据
DELETE FROM rsi_data 
WHERE created_date < DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY);

-- 清理已处理的推荐
DELETE FROM rsi_recommendations 
WHERE is_processed = TRUE 
  AND created_date < DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY);
```

## 🧪 测试和验证

### 执行演示查询

```bash
# 运行完整的演示查询集合
mysql -u user -p rsi_database < database/demo_queries.sql

# 或针对 PostgreSQL
psql -U user -d rsi_database -f database/demo_queries.sql

# 或针对 SQLite
sqlite3 data/rsi_data.sqlite < database/demo_queries.sql
```

### 性能测试

```sql
-- 检查索引使用情况
EXPLAIN SELECT * FROM rsi_data 
WHERE stock_code = '000001' AND klt = 15;

-- 分析表统计信息
ANALYZE TABLE rsi_data; -- MySQL
ANALYZE rsi_data;       -- PostgreSQL
```

## 🔗 集成现有系统

### 自动数据保存

你的现有 `fetchRSIAndSendEmail.ts` 已经集成了数据库保存功能：

```typescript
// 自动保存 RSI 结果到数据库
RSIDatabaseSaver.saveRSIResults({
    rsiDataList,
    stockType,
    klt,
    reqType,
    isBacktesting,
    currentDate
});
```

### API 接口

访问以下端点查询数据：

- **`GET /api/rsi/data`** - 查询所有 RSI 数据
- **`GET /api/rsi/recommendations`** - 查询买卖建议
- **`GET /api/rsi/statistics`** - 获取统计信息

### Web 界面

访问 **`http://localhost:3008/rsi-dashboard`** 查看完整的数据看板。

## 🐛 故障排除

### 常见问题解决

1. **连接失败**
   ```bash
   # 检查服务状态
   systemctl status mysql      # MySQL
   systemctl status postgresql # PostgreSQL
   ```

2. **表不存在**
   ```sql
   -- 验证表创建
   SHOW TABLES;                           -- MySQL
   \dt                                    -- PostgreSQL
   .tables                                -- SQLite
   ```

3. **性能问题**
   ```sql
   -- 查看慢查询
   SHOW PROCESSLIST;                      -- MySQL
   SELECT * FROM pg_stat_activity;        -- PostgreSQL
   ```

### 数据一致性检查

```sql
-- 检查重复数据
SELECT stock_code, timestamp, COUNT(*) 
FROM rsi_data 
GROUP BY stock_code, timestamp 
HAVING COUNT(*) > 1;

-- 检查异常 RSI 值
SELECT * FROM rsi_data 
WHERE rsi_value < 0 OR rsi_value > 100;
```

## 📞 技术支持

如果遇到问题，请检查：

1. **数据库版本兼容性** - 确保使用推荐版本
2. **网络连接** - 检查防火墙和端口设置
3. **权限配置** - 确认数据库用户权限
4. **日志信息** - 查看应用和数据库日志

## 🎉 总结

你现在拥有了：

✅ **3 套完整的数据库脚本** - 支持 MySQL、PostgreSQL、SQLite  
✅ **自动化设置工具** - 一键部署数据库环境  
✅ **高性能索引设计** - 优化查询性能  
✅ **丰富的视图和函数** - 简化数据分析  
✅ **100+ 示例查询** - 快速上手使用  
✅ **完整的集成方案** - 与现有系统无缝对接  
✅ **详细的文档说明** - 涵盖所有使用场景  

这套完整的 SQL 解决方案将为你的 RSI 股票分析系统提供强大、可靠、高性能的数据库支持！

---

💡 **下一步建议：**
1. 选择合适的数据库类型运行设置脚本
2. 执行演示查询熟悉数据结构
3. 根据实际需求调整索引和分区策略
4. 建立定期备份和维护计划 