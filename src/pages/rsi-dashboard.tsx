import React, { useState, useEffect, useCallback } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { EStockType, EKLT } from './interface';
import { ERSISuggestion } from './utils/config';

// 类型定义
interface RSIDataItem {
  id: number;
  stock_code: string;
  stock_name: string;
  stock_type: EStockType;
  klt: number;
  klt_desc: string;
  rsi_value: number | string;
  suggestion: ERSISuggestion | null;
  price: string;
  price_change: string | null;
  volume: number | null;
  timestamp: string;
  is_chip_increase: boolean;
  market_link: string;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Statistics {
  total_records: number;
  today_records: number;
  buy_recommendations: number;
  sell_recommendations: number;
  by_stock_type: {
    A: number;
    HK: number;
    US: number;
  };
  by_klt: {
    [key: string]: number;
  };
}

interface SearchFilters {
  stockCode: string;
  stockName: string;
  stockType: EStockType | '';
  klt: EKLT | '';
  suggestion: ERSISuggestion | '';
  dateRange: [Dayjs | null, Dayjs | null] | null;
}

const RSIDashboard: React.FC = () => {
  // 状态管理
  const [data, setData] = useState<RSIDataItem[]>([]);
  const [recommendations, setRecommendations] = useState<RSIDataItem[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [recPagination, setRecPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'recommendations' | 'charts' | 'analysis'>('data');
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [chartData, setChartData] = useState<any[]>([]);
  const [successRateData, setSuccessRateData] = useState<any>(null);
  const [tradingPoints, setTradingPoints] = useState<any[]>([]);
  
  // 搜索和过滤状态
  const [filters, setFilters] = useState<SearchFilters>({
    stockCode: '',
    stockName: '',
    stockType: '',
    klt: '',
    suggestion: '',
    dateRange: null,
  });

  // 获取RSI数据
  const fetchRSIData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.stockCode && { stockCode: filters.stockCode }),
        ...(filters.stockName && { stockName: filters.stockName }),
        ...(filters.stockType && { stockType: filters.stockType }),
        ...(filters.klt && { klt: filters.klt.toString() }),
        ...(filters.suggestion && { suggestion: filters.suggestion }),
        ...(filters.dateRange && filters.dateRange[0] && filters.dateRange[1] && {
          startDate: filters.dateRange[0].format('YYYY-MM-DD'),
          endDate: filters.dateRange[1].format('YYYY-MM-DD'),
        }),
      });

      const response = await fetch(`/api/rsi/data?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setPagination(result.pagination);
      } else {
        console.error('获取RSI数据失败:', result.message);
      }
    } catch (error) {
      console.error('获取RSI数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, filters]);

  // 获取RSI推荐数据
  const fetchRecommendations = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: recPagination.limit.toString(),
        ...(filters.stockType && { stockType: filters.stockType }),
        ...(filters.klt && { klt: filters.klt.toString() }),
        ...(filters.suggestion && { suggestion: filters.suggestion }),
        ...(filters.dateRange && filters.dateRange[0] && filters.dateRange[1] && {
          startDate: filters.dateRange[0].format('YYYY-MM-DD'),
          endDate: filters.dateRange[1].format('YYYY-MM-DD'),
        }),
      });

      const response = await fetch(`/api/rsi/recommendations?${params}`);
      const result = await response.json();

      if (result.success) {
        setRecommendations(result.data);
        setRecPagination(result.pagination);
      } else {
        console.error('获取RSI推荐数据失败:', result.message);
      }
    } catch (error) {
      console.error('获取RSI推荐数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [recPagination.limit, filters]);

  // 获取统计信息
  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/rsi/statistics');
      const result = await response.json();

      if (result.success) {
        setStatistics(result.data);
      }
    } catch (error) {
      console.error('获取统计信息失败:', error);
    }
  }, []);

  // 初始化数据
  useEffect(() => {
    fetchStatistics();
    if (activeTab === 'data') {
      fetchRSIData(1);
    } else if (activeTab === 'recommendations') {
      fetchRecommendations(1);
    }
  }, [activeTab]);

  // 处理搜索
  const handleSearch = () => {
    if (activeTab === 'data') {
      fetchRSIData(1);
    } else {
      fetchRecommendations(1);
    }
  };

  // 处理重置
  const handleReset = () => {
    setFilters({
      stockCode: '',
      stockName: '',
      stockType: '',
      klt: '',
      suggestion: '',
      dateRange: null,
    });
  };

  // 表格列定义
  const columns = [
    {
      title: '股票信息',
      key: 'stock_info',
      width: 180,
      render: (record: RSIDataItem) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.stock_name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.stock_code}</div>
        </div>
      ),
    },
    {
      title: '市场/周期',
      key: 'market_info',
      width: 120,
      render: (record: RSIDataItem) => (
        <div>
          <span style={{ 
            padding: '2px 8px', 
            background: '#1890ff', 
            color: 'white', 
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {record.stock_type}
          </span>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>{record.klt_desc}</div>
        </div>
      ),
    },
    {
      title: 'RSI值',
      key: 'rsi_value',
      width: 100,
      render: (record: RSIDataItem) => {
        const rsiValue = parseFloat(String(record.rsi_value));
        return (
          <span style={{ 
            color: rsiValue <= 30 ? '#52c41a' : rsiValue >= 70 ? '#ff4d4f' : '#000',
            fontWeight: 'bold'
          }}>
            {record.rsi_value}
          </span>
        );
      },
      sorter: (a: RSIDataItem, b: RSIDataItem) => parseFloat(String(a.rsi_value)) - parseFloat(String(b.rsi_value)),
    },
    {
      title: '操作建议',
      key: 'suggestion',
      width: 140,
      render: (record: RSIDataItem) => {
        const suggestion = record.suggestion;
        if (!suggestion) return <span style={{ color: '#999' }}>-</span>;
        
        const color = suggestion.includes('买入') ? '#52c41a' : '#ff4d4f';
        return (
          <span style={{ 
            color,
            fontWeight: 'bold',
            padding: '2px 8px',
            background: color + '20',
            borderRadius: '4px'
          }}>
            {suggestion}
          </span>
        );
      },
    },
    {
      title: '价格信息',
      key: 'price_info',
      width: 120,
      render: (record: RSIDataItem) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>¥{record.price}</div>
          {record.price_change && (
            <div style={{ 
              color: parseFloat(record.price_change) >= 0 ? '#52c41a' : '#ff4d4f',
              fontSize: '12px'
            }}>
              {parseFloat(record.price_change) >= 0 ? '+' : ''}{record.price_change}%
            </div>
          )}
        </div>
      ),
    },
    {
      title: '时间',
      key: 'timestamp',
      width: 120,
      render: (record: RSIDataItem) => (
        <span style={{ fontSize: '12px' }}>
          {dayjs(record.timestamp).format('MM-DD HH:mm')}
        </span>
      ),
      sorter: (a: RSIDataItem, b: RSIDataItem) => 
        dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (record: RSIDataItem) => (
        <a
          href={record.market_link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1890ff' }}
        >
          查看详情
        </a>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* 页面标题 */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ margin: '16px 0 8px', color: '#1890ff', fontSize: '32px' }}>
            RSI 数据分析看板
          </h1>
          <p style={{ color: '#666', fontSize: '16px' }}>
            实时RSI指标数据分析与智能买卖建议系统
          </p>
        </div>

        {/* 统计卡片 */}
        {statistics && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '16px', 
            marginBottom: '32px' 
          }}>
            <div style={{ 
              background: 'white', 
              padding: '24px', 
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ color: '#666', fontSize: '14px' }}>总记录数</div>
              <div style={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}>
                {statistics?.total_records?.toLocaleString()}
              </div>
            </div>
            <div style={{ 
              background: 'white', 
              padding: '24px', 
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ color: '#666', fontSize: '14px' }}>今日记录</div>
              <div style={{ color: '#722ed1', fontSize: '24px', fontWeight: 'bold' }}>
                {statistics?.today_records?.toLocaleString()}
              </div>
            </div>
            <div style={{ 
              background: 'white', 
              padding: '24px', 
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ color: '#666', fontSize: '14px' }}>买入建议</div>
              <div style={{ color: '#52c41a', fontSize: '24px', fontWeight: 'bold' }}>
                {statistics?.buy_recommendations?.toLocaleString()}
              </div>
            </div>
            <div style={{ 
              background: 'white', 
              padding: '24px', 
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <div style={{ color: '#666', fontSize: '14px' }}>卖出建议</div>
              <div style={{ color: '#ff4d4f', fontSize: '24px', fontWeight: 'bold' }}>
                {statistics?.sell_recommendations?.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* 搜索过滤区域 */}
        <div style={{ 
          background: 'white', 
          padding: '24px', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '24px'
        }}>
          <h2 style={{ marginBottom: '16px', color: '#333' }}>搜索筛选</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px',
            marginBottom: '16px'
          }}>
            <input
              type="text"
              placeholder="输入股票代码"
              value={filters.stockCode}
              onChange={(e) => setFilters(prev => ({ ...prev, stockCode: e.target.value }))}
              style={{
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <input
              type="text"
              placeholder="输入股票名称"
              value={filters.stockName}
              onChange={(e) => setFilters(prev => ({ ...prev, stockName: e.target.value }))}
              style={{
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <select
              value={filters.stockType}
              onChange={(e) => setFilters(prev => ({ ...prev, stockType: e.target.value as EStockType | '' }))}
              style={{
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">选择股票类型</option>
              <option value="A">A股</option>
              <option value="HK">港股</option>
              <option value="US">美股</option>
            </select>
            <select
              value={filters.klt}
              onChange={(e) => setFilters(prev => ({ ...prev, klt: e.target.value as EKLT | '' }))}
              style={{
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="">选择K线类型</option>
              <option value="5">5分钟</option>
              <option value="15">15分钟</option>
              <option value="101">日线</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSearch}
              style={{
                padding: '8px 16px',
                background: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              搜索
            </button>
            <button
              onClick={handleReset}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#666',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              重置
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#666',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              刷新
            </button>
          </div>
        </div>

        {/* 标签页切换 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ borderBottom: '1px solid #d9d9d9' }}>
            <div style={{ display: 'flex', gap: '32px' }}>
              <button
                onClick={() => setActiveTab('data')}
                style={{
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'data' ? '2px solid #1890ff' : '2px solid transparent',
                  color: activeTab === 'data' ? '#1890ff' : '#666'
                }}
              >
                📊 原始数据 ({pagination.total})
              </button>
              <button
                onClick={() => setActiveTab('recommendations')}
                style={{
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'recommendations' ? '2px solid #1890ff' : '2px solid transparent',
                  color: activeTab === 'recommendations' ? '#1890ff' : '#666'
                }}
              >
                💡 买卖建议 ({recPagination.total})
              </button>
              <button
                onClick={() => setActiveTab('charts')}
                style={{
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'charts' ? '2px solid #1890ff' : '2px solid transparent',
                  color: activeTab === 'charts' ? '#1890ff' : '#666'
                }}
              >
                📈 RSI图表
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                style={{
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'analysis' ? '2px solid #1890ff' : '2px solid transparent',
                  color: activeTab === 'analysis' ? '#1890ff' : '#666'
                }}
              >
                📋 成功率分析
              </button>
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div style={{ 
          background: 'white', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          {/* 数据表格 */}
          {(activeTab === 'data' || activeTab === 'recommendations') && (
            <>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <div style={{ color: '#666' }}>加载中...</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#fafafa' }}>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            style={{
                              padding: '16px',
                              textAlign: 'left',
                              borderBottom: '1px solid #f0f0f0',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#666'
                            }}
                          >
                            {col.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(activeTab === 'data' ? data : recommendations).map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              style={{
                                padding: '16px',
                                fontSize: '14px',
                                verticalAlign: 'top'
                              }}
                            >
                              {col.render ? col.render(item) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* RSI图表 */}
          {activeTab === 'charts' && (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', color: '#333' }}>📈 RSI图表分析</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <input
                    type="text"
                    placeholder="输入股票代码查看图表"
                    value={selectedStock}
                    onChange={(e) => setSelectedStock(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                  <select
                    value={filters.klt}
                    onChange={(e) => setFilters(prev => ({ ...prev, klt: e.target.value as EKLT | '' }))}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">选择K线类型</option>
                    <option value="15">15分钟</option>
                    <option value="101">日线</option>
                  </select>
                  <button
                    onClick={() => {
                      if (selectedStock && filters.klt) {
                        // 这里将调用图表数据API
                        console.log('加载图表数据:', selectedStock, filters.klt);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    加载图表
                  </button>
                </div>
              </div>
              
              {chartData.length > 0 ? (
                <div style={{ height: '400px', background: '#fafafa', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ textAlign: 'center', color: '#666', paddingTop: '150px' }}>
                    📊 RSI趋势图表
                    <br />
                    <small>包含买入点(绿色)和卖出点(红色)标记</small>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  height: '300px', 
                  background: '#f9f9f9', 
                  borderRadius: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#999'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
                  <div>请选择股票代码和K线类型来查看RSI图表</div>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    图表将显示RSI趋势和买入/卖出点
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 成功率分析 */}
          {activeTab === 'analysis' && (
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', color: '#333' }}>📋 15分钟RSI成功率分析</h3>
                <div style={{ 
                  background: '#f0f8ff', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '24px',
                  border: '1px solid #e6f7ff'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#1890ff' }}>📊 分析策略</h4>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    🔹 <strong>买入条件:</strong> RSI &lt; 25（超卖区域）
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    🔹 <strong>卖出条件:</strong> RSI &gt; 75（超买区域）
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    🔹 <strong>最小持有:</strong> 4小时（15分钟×16个周期）
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch('/api/rsi/success-rate?days=30');
                        const result = await response.json();
                        if (result.success) {
                          setSuccessRateData(result.data);
                        }
                      } catch (error) {
                        console.error('获取成功率数据失败:', error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#52c41a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    分析30天数据
                  </button>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch('/api/rsi/trading-points?klt=15&days=7');
                        const result = await response.json();
                        if (result.success) {
                          setTradingPoints(result.data.trading_points);
                        }
                      } catch (error) {
                        console.error('获取交易点失败:', error);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    查看最新信号
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  分析中...
                </div>
              ) : (
                <>
                  {/* 成功率统计 */}
                  {successRateData && (
                    <div style={{ marginBottom: '32px' }}>
                      <h4 style={{ marginBottom: '16px', color: '#333' }}>🎯 总体统计</h4>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                        gap: '16px',
                        marginBottom: '24px'
                      }}>
                        <div style={{ background: '#f6ffed', padding: '16px', borderRadius: '8px', border: '1px solid #b7eb8f' }}>
                          <div style={{ fontSize: '12px', color: '#666' }}>总体成功率</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                            {successRateData.total_stats.overall_success_rate}%
                          </div>
                        </div>
                        <div style={{ background: '#f0f5ff', padding: '16px', borderRadius: '8px', border: '1px solid #adc6ff' }}>
                          <div style={{ fontSize: '12px', color: '#666' }}>总交易次数</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                            {successRateData.total_stats.total_trades}
                          </div>
                        </div>
                        <div style={{ background: '#fff7e6', padding: '16px', borderRadius: '8px', border: '1px solid #ffd591' }}>
                          <div style={{ fontSize: '12px', color: '#666' }}>平均收益</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                            {successRateData.total_stats.average_profit}%
                          </div>
                        </div>
                        <div style={{ background: '#f9f0ff', padding: '16px', borderRadius: '8px', border: '1px solid #d3adf7' }}>
                          <div style={{ fontSize: '12px', color: '#666' }}>分析股票数</div>
                          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                            {successRateData.total_stats.total_stocks}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 最新交易信号 */}
                  {tradingPoints.length > 0 && (
                    <div style={{ marginBottom: '32px' }}>
                      <h4 style={{ marginBottom: '16px', color: '#333' }}>🚦 最新交易信号</h4>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ background: '#fafafa' }}>
                            <tr>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>股票</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>信号</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>RSI值</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>价格</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tradingPoints.slice(0, 10).map((point, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '12px' }}>
                                  <div style={{ fontWeight: 'bold' }}>{point.stock_name}</div>
                                  <div style={{ fontSize: '12px', color: '#666' }}>{point.stock_code}</div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    background: point.action === 'buy' ? '#f6ffed' : '#fff2f0',
                                    color: point.action === 'buy' ? '#52c41a' : '#ff4d4f',
                                    border: `1px solid ${point.action === 'buy' ? '#b7eb8f' : '#ffb3b3'}`
                                  }}>
                                    {point.action === 'buy' ? '🚀 买入' : '😱 卖出'}
                                    {point.signal_strength === 'immediate' ? ' (立即)' : ' (建议)'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{point.rsi_value}</td>
                                <td style={{ padding: '12px' }}>¥{point.price}</td>
                                <td style={{ padding: '12px', fontSize: '12px' }}>
                                  {dayjs(point.timestamp).format('MM-DD HH:mm')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!successRateData && !tradingPoints.length && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '60px 20px',
                      color: '#999',
                      background: '#fafafa',
                      borderRadius: '8px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                      <div style={{ marginBottom: '8px' }}>点击上方按钮开始分析</div>
                      <div style={{ fontSize: '12px' }}>
                        系统将分析15分钟RSI数据的交易成功率
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RSIDashboard;
