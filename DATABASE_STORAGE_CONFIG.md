# 数据库存储控制配置

## 概述

为了减少数据库过载，项目现在支持通过环境变量控制是否将RSI数据保存到数据库。

## 环境变量配置

### ENABLE_DATABASE_STORAGE

- **用途**: 控制是否将RSI数据保存到数据库
- **类型**: String (需要设置为 'true' 才启用)
- **默认值**: `false` (未设置或非'true'时默认禁用)
- **影响范围**: 
  - RSI数据的数据库保存
  - RSI查询API的可用性
  - RSI统计API的可用性

### 配置方式

#### 1. 本地开发环境

创建 `.env.local` 文件：
```bash
# 启用数据库存储
ENABLE_DATABASE_STORAGE=true

# 或禁用数据库存储（默认）
ENABLE_DATABASE_STORAGE=false
```

#### 2. 生产环境

在服务器环境变量中设置：
```bash
export ENABLE_DATABASE_STORAGE=true
```

#### 3. Next.js 项目配置

在 `next.config.ts` 中配置环境变量：
```typescript
module.exports = {
  env: {
    ENABLE_DATABASE_STORAGE: process.env.ENABLE_DATABASE_STORAGE || 'false',
  },
}
```

## 功能影响

### 启用时 (ENABLE_DATABASE_STORAGE=true)

1. **数据保存**: RSI分析结果会保存到数据库
2. **查询API**: 可以正常使用以下API：
   - `/api/rsi/data` - 查询RSI原始数据
   - `/api/rsi/recommendations` - 查询RSI推荐数据
   - `/api/rsi/statistics` - 查询RSI统计信息
3. **数据持久化**: 支持历史数据查询和统计分析

### 禁用时 (ENABLE_DATABASE_STORAGE=false，默认)

1. **数据保存**: 跳过所有数据库保存操作，减少数据库负载
2. **查询API**: 返回503状态码，提示数据库存储功能已禁用
3. **性能**: 降低数据库压力，提升系统性能
4. **功能**: RSI分析和邮件通知功能正常工作，只是不保存数据

## 实现位置

### 核心配置
- `src/pages/utils/config.ts` - 环境变量读取和默认配置

### 数据库服务
- `src/services/rsiService.ts` - 所有数据库写操作都会检查开关

### API路由
- `src/pages/api/rsi/data.ts` - RSI数据查询API
- `src/pages/api/rsi/recommendations.ts` - RSI推荐查询API  
- `src/pages/api/rsi/statistics.ts` - RSI统计查询API

### 主处理流程
- `src/pages/utils/fetchRSIAndSendEmail.ts` - RSI数据处理和保存

## 监控和日志

当数据库存储被禁用时，系统会输出相应的日志信息：

```
🔄 数据库存储已禁用，跳过RSI原始数据保存
🔄 数据库存储已禁用，跳过RSI推荐数据保存
🔄 数据库存储已禁用，跳过RSI数据保存
[时间戳][股票类型][K线类型] 数据库存储已禁用，跳过RSI数据保存
```

API调用被拒绝时会返回：
```json
{
  "success": false,
  "message": "数据库存储功能已禁用，RSI数据查询暂不可用",
  "code": "DATABASE_STORAGE_DISABLED"
}
```

## 建议使用方式

1. **开发环境**: 启用数据库存储以便测试完整功能
2. **生产环境**: 根据数据库负载情况选择是否启用
3. **高负载时期**: 临时禁用数据库存储以保护数据库
4. **数据分析需求**: 启用数据库存储以支持历史数据查询

## 注意事项

1. 环境变量修改后需要重启应用才能生效
2. 禁用数据库存储不影响RSI分析和邮件发送功能
3. 查询API在禁用状态下会返回503错误
4. 建议在禁用期间定期备份重要的RSI分析结果
