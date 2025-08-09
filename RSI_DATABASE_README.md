# RSI 数据分析与交易策略系统 📊

## 📋 项目概述

本系统专门用于股票RSI(相对强弱指数)数据的存储、分析和交易策略验证。系统将原始RSI数据存储与智能分析分离，提供完整的RSI交易策略回测和成功率分析功能。

## 🎯 核心设计理念

### 1. 数据分离原则
- **`rsi_data` 表**: 专门存储从东方财富拉取的15分钟和日RSI**原始数据**
- **`rsi_recommendations` 表**: 存储基于原始数据分析生成的买卖建议
- **分析服务**: 独立的分析引擎，基于原始数据生成交易信号和成功率统计

### 2. 智能分析功能
- ✅ **RSI图表可视化**: 显示RSI趋势和买入/卖出点标记
- ✅ **交易策略回测**: 15分钟RSI策略成功率分析
- ✅ **实时交易信号**: 最新的买入/卖出信号监控

## 🏗️ 重新设计的架构

```
src/
├── services/
│   ├── models/
│   │   ├── RSIData.ts              # 原始RSI数据模型(无建议字段)
│   │   └── RSIRecommendation.ts    # 推荐数据模型
│   ├── rsiService.ts               # RSI数据服务
│   └── rsiAnalysisService.ts       # 🆕 RSI分析服务
├── pages/
│   ├── api/rsi/
│   │   ├── data.ts                 # 原始RSI数据API
│   │   ├── recommendations.ts      # 推荐数据API
│   │   ├── statistics.ts           # 统计API
│   │   ├── chart.ts                # 🆕 RSI图表数据API
│   │   ├── success-rate.ts         # 🆕 成功率分析API
│   │   └── trading-points.ts       # 🆕 交易信号API
│   └── rsi-dashboard.tsx           # 🚀 全新的分析看板
```

## 📊 数据库表结构

### RSI原始数据表 (rsi_data)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| stock_code | STRING(20) | 股票代码 |
| stock_name | STRING(100) | 股票名称 |
| stock_type | ENUM('A','HK','US') | 股票类型 |
| klt | INTEGER | K线类型(5/15/101) |
| rsi_value | DECIMAL(10,2) | RSI值 |
| price | DECIMAL(10,2) | 当前价格 |
| timestamp | DATE | RSI时间戳 |
| ~~suggestion~~ | ~~REMOVED~~ | ❌ 移除建议字段 |

**注意**: 此表专门存储原始RSI数据，不包含任何建议字段，确保数据纯净性。

### RSI推荐表 (rsi_recommendations)

基于原始数据分析生成的买卖建议，包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| ... | ... | 继承rsi_data所有字段 |
| suggestion | ENUM | 买卖建议 |
| is_processed | BOOLEAN | 是否已处理 |

## 🎯 核心功能

### 1. RSI交易信号分析

系统根据以下规则自动生成交易信号：

```typescript
RSI <= 20  → 🚀 立即买入
RSI <= 30  → 🔥 建议买入
RSI >= 80  → 😱 立即卖出
RSI >= 70  → 🚨 建议卖出
```

### 2. 15分钟RSI成功率分析

**交易策略**:
- 🟢 **买入条件**: RSI < 25 (超卖区域)
- 🔴 **卖出条件**: RSI > 75 (超买区域)  
- ⏱️ **最小持有**: 4小时 (15分钟×16个周期)

**分析指标**:
- 总体成功率
- 平均收益率
- 最大/最小收益
- 每笔交易详情

### 3. RSI图表可视化

- 📈 RSI趋势线图
- 🟢 买入点标记 (RSI ≤ 30)
- 🔴 卖出点标记 (RSI ≥ 70)
- 📊 价格走势对比

## 🚀 新增API接口

### 1. RSI图表数据
```http
GET /api/rsi/chart?stockCode=000001&klt=15&startDate=2025-01-01&endDate=2025-01-31
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "stock_code": "000001",
    "klt": 15,
    "chart_data": [
      {
        "timestamp": "2025-01-27T15:00:00.000Z",
        "rsi_value": 25.5,
        "price": 10.50,
        "trading_point": {
          "action": "buy",
          "signal_strength": "suggested"
        }
      }
    ],
    "trading_points": [...]
  }
}
```

### 2. 成功率分析
```http
GET /api/rsi/success-rate?days=30
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_stats": {
      "overall_success_rate": 68.5,
      "total_trades": 150,
      "average_profit": 3.2
    },
    "stock_analysis": [...]
  }
}
```

### 3. 交易信号监控
```http
GET /api/rsi/trading-points?klt=15&days=7
```

## 🎨 全新的Web界面

访问 `http://localhost:3008/rsi-dashboard` 体验全新的RSI分析看板：

### 🔄 四大功能模块

1. **📊 原始数据**: 查看从东方财富拉取的RSI原始数据
2. **💡 买卖建议**: 基于分析生成的交易建议
3. **📈 RSI图表**: 可视化RSI趋势和交易点
4. **📋 成功率分析**: 15分钟RSI交易策略的成功率统计

### ✨ 核心特性

- **🎯 交易点可视化**: 在RSI图表上清晰标记买入/卖出点
- **📊 成功率统计**: 实时计算交易策略的成功率
- **🚦 信号监控**: 监控最新的交易信号
- **📱 响应式设计**: 完美适配移动端和桌面端
- **⚡ 实时分析**: 点击即可分析30天交易数据

## 📈 使用示例

### 1. 查看股票RSI图表
```javascript
// 获取平安银行15分钟RSI图表
const chartData = await fetch('/api/rsi/chart?stockCode=000001&klt=15');
```

### 2. 分析交易成功率
```javascript
// 分析最近30天的成功率
const analysis = await fetch('/api/rsi/success-rate?days=30');
```

### 3. 监控交易信号
```javascript
// 获取最近7天的交易信号
const signals = await fetch('/api/rsi/trading-points?klt=15&days=7');
```

## 🔄 数据流程

```mermaid
graph LR
    A[东方财富API] --> B[RSI原始数据]
    B --> C[rsi_data表]
    C --> D[RSI分析服务]
    D --> E[交易信号]
    D --> F[成功率分析]
    E --> G[rsi_recommendations表]
    F --> H[Web看板显示]
```

## 🛠️ 安装与配置

### 1. 安装依赖
```bash
npm install sequelize mysql2 dayjs
npm install --save-dev @types/sequelize
```

### 2. 数据库配置
```env
# 生产环境配置
DATABASE_URL=mysql://username:password@localhost:3306/rsi_database
RSI_ENABLE_DATABASE=true
RSI_ENABLE_ANALYSIS=true
```

### 3. 初始化数据库
```bash
npm run db:init
```

## 📊 核心优势

### 🎯 **数据纯净性**
- 原始数据与分析结果分离
- 确保数据源的完整性和可追溯性

### 📈 **智能分析**
- 基于历史数据的成功率统计
- 实时交易信号生成
- 可视化图表展示

### 🚀 **高性能**
- 优化的数据库索引
- 异步数据处理
- 响应式用户界面

### 🔧 **易扩展**
- 模块化架构设计
- 灵活的分析策略配置
- 完整的API接口

## 📝 注意事项

1. **数据完整性**: 原始RSI数据表不包含建议字段，确保数据纯净
2. **分析准确性**: 成功率分析基于历史数据，不构成投资建议
3. **性能优化**: 建议定期清理过期数据以维持系统性能
4. **风险提示**: 交易有风险，投资需谨慎

## 🤝 贡献指南

欢迎提交问题报告和功能建议！

---

**🎉 现在您拥有了一个完整的RSI分析系统，可以：**
- 📊 存储纯净的原始RSI数据
- 💡 生成智能交易建议  
- 📈 可视化RSI趋势和交易点
- 📋 分析交易策略的成功率

**立即访问 `http://localhost:3008/rsi-dashboard` 开始您的RSI分析之旅！** 🚀 