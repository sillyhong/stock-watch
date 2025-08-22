# 数据库崩溃保护机制

## 概述

当系统数据库崩溃或不可用时，通过环境变量 `ENABLE_DATABASE_STORAGE=false` 可以让所有API跳过数据库操作而继续正常运行，确保核心业务功能不中断。

## 🔧 实现范围

### 1. RSI相关API (`/api/rsi/`)

#### `/api/rsi/data` - RSI数据查询
- **禁用时**: 返回空数据列表，保持API响应格式不变
- **响应结构**: 
```json
{
  "success": true,
  "message": "数据库存储已禁用，无法查询历史数据",
  "data": [],
  "pagination": { "total": 0, "page": 1, "limit": 20, "totalPages": 0 },
  "note": "系统当前运行在数据库禁用模式下，RSI分析功能正常但无历史数据查询"
}
```

#### `/api/rsi/recommendations` - RSI推荐查询
- **禁用时**: 返回空推荐列表
- **功能**: 实时RSI分析和邮件推荐功能正常运行

#### `/api/rsi/statistics` - RSI统计信息
- **禁用时**: 返回默认统计信息
- **包含**: 系统状态说明，表明数据库禁用模式

### 2. 调度器API (`/api/scheduler/`)

#### `/api/scheduler/stats` - 调度器统计
- **禁用时**: 返回默认统计信息
- **功能**: 任务执行正常，只是不记录和查询日志

### 3. 监控API (`/api/*-rsi-watch/`, `/api/backtrend/`)

#### 所有watch和backtrend API
- **禁用时**: 跳过日志记录，直接执行核心RSI分析任务
- **功能**: RSI分析、邮件通知完全正常
- **日志**: 控制台输出执行状态，不影响功能

## 🛡️ 核心保护机制

### SchedulerService 保护
```typescript
// 主要执行函数
static async executeWithLogging<T>() {
  if (!ENABLE_DATABASE_STORAGE) {
    console.log('🔄 数据库存储已禁用，直接执行任务不记录日志');
    return await executionFunction(); // 直接执行，跳过日志
  }
  // 正常的日志记录流程...
}

// 统计查询保护
static async getExecutionStats() {
  if (!ENABLE_DATABASE_STORAGE) {
    return { /* 默认统计数据 */ };
  }
  // 正常的数据库查询...
}
```

### RSIService 保护
```typescript
static async batchSaveRSIData() {
  if (!ENABLE_DATABASE_STORAGE) {
    console.log('🔄 数据库存储已禁用，跳过RSI数据保存');
    return;
  }
  // 正常的数据库保存操作...
}
```

## 📊 功能对比表

| 功能模块 | 数据库启用时 | 数据库禁用时 | 核心功能是否受影响 |
|---------|-------------|-------------|------------------|
| RSI分析计算 | ✅ 正常 | ✅ 正常 | ❌ 无影响 |
| 邮件通知 | ✅ 正常 | ✅ 正常 | ❌ 无影响 |
| 历史数据查询 | ✅ 正常 | ⚠️ 返回空数据 | ⚠️ 部分受影响 |
| 任务调度执行 | ✅ 正常 | ✅ 正常 | ❌ 无影响 |
| 日志记录 | ✅ 正常 | ❌ 跳过 | ❌ 无影响 |
| 统计信息 | ✅ 正常 | ⚠️ 返回默认值 | ⚠️ 部分受影响 |

## 🚨 应急使用场景

### 1. 数据库服务器崩溃
```bash
# 立即禁用数据库操作
export ENABLE_DATABASE_STORAGE=false
# 重启应用或热重载配置
```

### 2. 数据库连接池耗尽
```bash
# 暂时禁用数据库写操作，减轻负载
export ENABLE_DATABASE_STORAGE=false
```

### 3. 数据库维护期间
```bash
# 维护期间保持核心功能正常
export ENABLE_DATABASE_STORAGE=false
```

## 🔍 监控和日志

### 控制台日志标识
```
🔄 数据库存储已禁用，跳过RSI数据保存
🔄 数据库存储已禁用，直接执行任务不记录日志: A股15分钟RSI监控
✅ 任务执行成功 [A股日RSI监控] (数据库禁用模式)
❌ 任务执行失败 [港股15分钟RSI回测] (数据库禁用模式)
```

### API响应标识
所有受影响的API响应都包含 `note` 字段：
```json
{
  "note": "系统当前运行在数据库禁用模式下，实时RSI分析功能正常运行"
}
```

## ⚡ 性能优势

### 1. 降低系统负载
- 跳过所有数据库写操作
- 减少数据库连接使用
- 降低I/O压力

### 2. 提升响应速度
- API调用无需等待数据库操作
- 任务执行更快完成
- 减少超时风险

### 3. 提高系统稳定性
- 数据库故障不影响核心功能
- 避免连锁故障
- 保证服务连续性

## 🔄 恢复流程

### 1. 数据库修复完成后
```bash
# 重新启用数据库存储
export ENABLE_DATABASE_STORAGE=true
# 重启应用
```

### 2. 验证功能恢复
- 检查RSI数据查询API是否返回正常数据
- 验证统计API是否显示真实统计
- 确认新的任务执行会记录日志

## 💡 最佳实践

1. **监控告警**: 设置监控检测 `ENABLE_DATABASE_STORAGE` 状态
2. **定期检查**: 在数据库禁用期间定期检查核心功能
3. **及时恢复**: 数据库修复后立即恢复存储功能
4. **数据备份**: 禁用期间重要的RSI分析结果需要其他方式保存

## 🛠️ 技术细节

- **环境变量检查**: 每个数据库操作前都会检查 `ENABLE_DATABASE_STORAGE`
- **优雅降级**: 不是简单的错误返回，而是功能性降级
- **日志保留**: 控制台日志仍然记录关键操作状态
- **向后兼容**: API响应格式保持一致，只是数据内容不同

这个机制确保了即使在数据库完全不可用的情况下，股票RSI分析系统的核心功能仍能正常运行。
