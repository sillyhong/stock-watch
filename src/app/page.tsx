"use client";

import "@ant-design/v5-patch-for-react-19";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  ConfigProvider,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Layout,
  Menu,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { ApiTaskDefinition, FeatureCode, IntervalCode, MarketCode } from "@/config/apiCatalog";
import { apiCatalog, featureOptions, intervalOptions, marketOptions } from "@/config/apiCatalog";
import type { SchedulerTaskState } from "@/services/schedulerRegistry";
import {
  ApiConsoleError,
  fetchSchedulerStats,
  fetchSchedulerStatus,
  invokeApiTask,
  reportSchedulerAction,
  type ConsoleAction,
} from "@/services/apiConsoleClient";
import styles from "./page.module.css";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

type TaskResponse = {
  action: ConsoleAction;
  ok: boolean;
  httpStatus?: number;
  durationMs?: number;
  data?: unknown;
  error?: string;
  errorCode?: string;
  createdAt: string;
};

const statusMeta: Record<
  SchedulerTaskState["status"],
  { label: string; color: string; badge: "success" | "processing" | "error" | "default" | "warning" }
> = {
  RUNNING: { label: "运行中", color: "green", badge: "success" },
  STOPPED: { label: "已停止", color: "default", badge: "default" },
  EXECUTING: { label: "执行中", color: "blue", badge: "processing" },
  SUCCESS: { label: "成功", color: "green", badge: "success" },
  FAILED: { label: "失败", color: "red", badge: "error" },
  UNKNOWN: { label: "未知", color: "gold", badge: "warning" },
};

function formatTime(value?: string) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function stringifyData(data: unknown) {
  if (typeof data === "string") return data;
  if (data === undefined) return "暂无响应内容";
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function getErrorDetails(error: unknown) {
  if (error instanceof ApiConsoleError) {
    return {
      message: error.message,
      code: error.code,
      httpStatus: error.httpStatus,
      durationMs: error.durationMs,
      data: error.data,
    };
  }
  return {
    message: error instanceof Error ? error.message : "未知错误",
    code: "UNKNOWN",
    data: undefined,
  };
}

function StatusTag({ status }: { status: SchedulerTaskState["status"] }) {
  const meta = statusMeta[status];
  return (
    <Tag color={meta.color} bordered={false}>
      <Badge status={meta.badge} /> {meta.label}
    </Tag>
  );
}

function TaskCard({
  task,
  state,
  busyAction,
  onAction,
  onOpen,
}: {
  task: ApiTaskDefinition;
  state: SchedulerTaskState;
  busyAction?: ConsoleAction;
  onAction: (task: ApiTaskDefinition, action: ConsoleAction) => void;
  onOpen: (task: ApiTaskDefinition) => void;
}) {
  return (
    <Card
      className={styles.taskCard}
      size="small"
      title={
        <div className={styles.taskTitle}>
          <span>{task.title}</span>
          <StatusTag status={state.status} />
        </div>
      }
      extra={
        <Tooltip title="查看详情">
          <Button aria-label={`查看 ${task.title} 详情`} icon={<EyeOutlined />} type="text" onClick={() => onOpen(task)} />
        </Tooltip>
      }
    >
      <Paragraph className={styles.purpose} ellipsis={{ rows: 2 }}>
        {task.purpose}
      </Paragraph>

      <Space wrap size={[6, 6]} className={styles.metaTags}>
        <Tag>{task.marketLabel}</Tag>
        <Tag>{task.intervalLabel}</Tag>
        <Tag color="blue">{task.featureLabel}</Tag>
      </Space>

      <Descriptions className={styles.cardDescriptions} column={1} size="small">
        <Descriptions.Item label="调度">{task.schedule?.label ?? "手动执行"}</Descriptions.Item>
        <Descriptions.Item label="接口">
          <Text code>{task.endpoint}</Text>
        </Descriptions.Item>
      </Descriptions>

      <Divider className={styles.cardDivider} />
      <Space wrap size={[8, 8]}>
        {task.capabilities.immediate && (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={busyAction === "immediate"}
            disabled={Boolean(busyAction)}
            onClick={() => onAction(task, "immediate")}
          >
            立即执行
          </Button>
        )}
        {task.capabilities.start && (
          <Button
            size="small"
            icon={<ClockCircleOutlined />}
            loading={busyAction === "start"}
            disabled={Boolean(busyAction)}
            onClick={() => onAction(task, "start")}
          >
            启动定时
          </Button>
        )}
        {task.capabilities.stop && (
          <Popconfirm
            title="停止定时任务？"
            description="服务器中的定时器将停止。"
            okText="停止"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => onAction(task, "stop")}
          >
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              loading={busyAction === "stop"}
              disabled={Boolean(busyAction)}
            >
              停止定时
            </Button>
          </Popconfirm>
        )}
      </Space>
    </Card>
  );
}

function ApiConsolePage() {
  const { message } = AntApp.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [marketFilter, setMarketFilter] = useState<MarketCode>("ALL");
  const [intervalFilter, setIntervalFilter] = useState<IntervalCode>("ALL");
  const [featureFilter, setFeatureFilter] = useState<FeatureCode>("ALL");
  const [searchText, setSearchText] = useState("");
  const [states, setStates] = useState<SchedulerTaskState[]>([]);
  const [responses, setResponses] = useState<Record<string, TaskResponse>>({});
  const [busyActions, setBusyActions] = useState<Record<string, ConsoleAction | undefined>>({});
  const [drawerTask, setDrawerTask] = useState<ApiTaskDefinition | null>(null);
  const [statsSummary, setStatsSummary] = useState<Record<string, number> | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const stateMap = useMemo(
    () => Object.fromEntries(states.map((state) => [state.taskId, state])) as Record<string, SchedulerTaskState>,
    [states],
  );

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return apiCatalog.filter((task) => {
      const matchesMarket = marketFilter === "ALL" || task.market === marketFilter;
      const matchesInterval = intervalFilter === "ALL" || task.interval === intervalFilter;
      const matchesFeature = featureFilter === "ALL" || task.feature === featureFilter;
      const matchesQuery =
        !query ||
        [task.title, task.purpose, task.endpoint, task.marketLabel, task.featureLabel]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesMarket && matchesInterval && matchesFeature && matchesQuery;
    });
  }, [featureFilter, intervalFilter, marketFilter, searchText]);

  const runningCount = states.filter((state) => state.status === "RUNNING").length;

  async function refreshData(showLoading = false) {
    if (showLoading) setRefreshing(true);
    const [statusResult, statsResult] = await Promise.allSettled([fetchSchedulerStatus(), fetchSchedulerStats()]);

    if (statusResult.status === "fulfilled") {
      setStates(statusResult.value);
      setServiceError(null);
    } else {
      setServiceError(getErrorDetails(statusResult.reason).message);
    }

    if (statsResult.status === "fulfilled") {
      setStatsSummary(statsResult.value);
      setStatsError(null);
    } else {
      setStatsError(getErrorDetails(statsResult.reason).message);
    }

    setInitialLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void refreshData();

    const intervalId = window.setInterval(() => {
      if (!document.hidden) void refreshData();
    }, 30_000);

    const handleVisibility = () => {
      if (!document.hidden) void refreshData();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  async function runAction(task: ApiTaskDefinition, action: ConsoleAction) {
    setBusyActions((current) => ({ ...current, [task.id]: action }));
    const startedAt = new Date().toISOString();

    try {
      const result = await invokeApiTask(task, action);
      setResponses((current) => ({
        ...current,
        [task.id]: {
          action,
          ok: true,
          httpStatus: result.httpStatus,
          durationMs: result.durationMs,
          data: result.data,
          createdAt: startedAt,
        },
      }));
      await reportSchedulerAction({
        taskId: task.id,
        action,
        message:
          typeof result.data === "object" && result.data !== null && "message" in result.data
            ? String((result.data as { message?: unknown }).message)
            : `${action} completed`,
        durationMs: result.durationMs,
      });
      message.success(`${task.title}：${action === "stop" ? "已停止" : "请求已完成"}`);
    } catch (error) {
      const details = getErrorDetails(error);
      setResponses((current) => ({
        ...current,
        [task.id]: {
          action,
          ok: false,
          httpStatus: details.httpStatus,
          durationMs: details.durationMs,
          data: details.data,
          error: details.message,
          errorCode: details.code,
          createdAt: startedAt,
        },
      }));
      await reportSchedulerAction({ taskId: task.id, action: "failure", error: details.message });
      message.error(`${task.title}：${details.message}`);
    } finally {
      setBusyActions((current) => ({ ...current, [task.id]: undefined }));
      void refreshData();
    }
  }

  const drawerResponse = drawerTask ? responses[drawerTask.id] : undefined;
  const drawerState = drawerTask
    ? stateMap[drawerTask.id] ?? { taskId: drawerTask.id, status: "UNKNOWN" as const, updatedAt: "" }
    : null;

  const menuItems = [
    { key: "ALL", icon: <AppstoreOutlined />, label: "全部任务" },
    { type: "divider" as const },
    {
      type: "group" as const,
      label: "市场",
      children: marketOptions.slice(1).map((market) => ({ key: market.key, label: market.label })),
    },
  ];

  return (
    <Layout className={styles.shell}>
      <Sider
        className={styles.sider}
        collapsible
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
      >
        <div className={styles.brand}>
          <div className={styles.brandMark}>SW</div>
          {!collapsed && (
            <div>
              <Text className={styles.brandTitle}>Stock Watch</Text>
              <Text className={styles.brandSubTitle}>API Control Center</Text>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[marketFilter]}
          items={menuItems}
          onClick={({ key }) => setMarketFilter(key as MarketCode)}
        />
        {!collapsed && (
          <div className={styles.siderFooter}>
            <Text type="secondary">{apiCatalog.length} 个已登记任务</Text>
            <Text type="secondary">仅执行 Catalog API</Text>
          </div>
        )}
      </Sider>

      <Layout>
        <Header className={styles.header}>
          <Space size="middle">
            <Button
              type="text"
              aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <div>
              <Title level={4} className={styles.pageTitle}>定时器 API 控制台</Title>
              <Text type="secondary">市场数据任务 · 执行、启停、状态一站管理</Text>
            </div>
          </Space>
          <Space wrap>
            <Badge status={serviceError ? "error" : "processing"} text={serviceError ? "状态接口异常" : "服务在线"} />
            <Tooltip title="刷新状态与统计">
              <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refreshData(true)}>
                刷新
              </Button>
            </Tooltip>
          </Space>
        </Header>

        <Content className={styles.content}>
          <Row gutter={[16, 16]} className={styles.overviewRow}>
            <Col xs={24} sm={8} xl={6}>
              <Card className={styles.overviewCard} size="small">
                <Statistic title="已登记任务" value={apiCatalog.length} prefix={<SettingOutlined />} />
              </Card>
            </Col>
            <Col xs={24} sm={8} xl={6}>
              <Card className={styles.overviewCard} size="small">
                <Statistic title="运行中" value={runningCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: "#389e0d" }} />
              </Card>
            </Col>
            <Col xs={24} sm={8} xl={6}>
              <Card className={styles.overviewCard} size="small">
                <Statistic title="7天成功率" value={statsSummary?.success_rate ?? 0} suffix="%" prefix={<ClockCircleOutlined />} />
              </Card>
            </Col>
            <Col xs={24} xl={6}>
              <Card className={styles.overviewCard} size="small">
                <div className={styles.healthCard}>
                  <Text type="secondary">状态接口</Text>
                  <Tag color={serviceError ? "red" : "green"}>{serviceError ? "异常" : "在线"}</Tag>
                  {statsError && <Text type="danger">统计不可用</Text>}
                </div>
              </Card>
            </Col>
          </Row>

          {serviceError && (
            <Alert
              className={styles.topAlert}
              type="warning"
              showIcon
              message="状态接口暂不可用"
              description={`${serviceError}。任务操作仍可尝试，页面不会伪造运行状态。`}
            />
          )}

          <Card className={styles.filterCard} size="small">
            <Space direction="vertical" size="middle" className={styles.filterStack}>
              <div className={styles.filterHeader}>
                <div>
                  <Title level={5} className={styles.sectionTitle}>任务目录</Title>
                  <Text type="secondary">按市场、分时、功能筛选；点击任务查看接口详情</Text>
                </div>
                <Text type="secondary">显示 {filteredTasks.length} / {apiCatalog.length}</Text>
              </div>
              <Space wrap size={[12, 12]}>
                <Segmented
                  options={intervalOptions}
                  value={intervalFilter}
                  onChange={(value) => setIntervalFilter(value as IntervalCode)}
                />
                <Select
                  className={styles.featureSelect}
                  value={featureFilter}
                  options={featureOptions}
                  onChange={(value) => setFeatureFilter(value as FeatureCode)}
                />
                <Input
                  allowClear
                  className={styles.searchInput}
                  prefix={<SearchOutlined />}
                  placeholder="搜索任务、用途、接口"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </Space>
            </Space>
          </Card>

          <Spin spinning={initialLoading} tip="加载任务状态...">
            {filteredTasks.length === 0 ? (
              <Card className={styles.emptyCard}>
                <Empty description="没有匹配任务" />
              </Card>
            ) : (
              <Row gutter={[16, 16]} className={styles.taskGrid}>
                {filteredTasks.map((task) => (
                  <Col xs={24} xl={12} xxl={8} key={task.id}>
                    <TaskCard
                      task={task}
                      state={stateMap[task.id] ?? { taskId: task.id, status: "UNKNOWN", updatedAt: "" }}
                      busyAction={busyActions[task.id]}
                      onAction={(selectedTask, action) => void runAction(selectedTask, action)}
                      onOpen={setDrawerTask}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </Spin>
        </Content>
      </Layout>

      <Drawer
        title={drawerTask?.title ?? "任务详情"}
        width={Math.min(560, typeof window === "undefined" ? 560 : window.innerWidth - 24)}
        open={Boolean(drawerTask)}
        onClose={() => setDrawerTask(null)}
        extra={drawerState ? <StatusTag status={drawerState.status} /> : null}
      >
        {drawerTask && drawerState && (
          <Space direction="vertical" size="large" className={styles.drawerContent}>
            <Descriptions bordered column={1} size="small" title="任务信息">
              <Descriptions.Item label="用途">{drawerTask.purpose}</Descriptions.Item>
              <Descriptions.Item label="市场">{drawerTask.marketLabel}</Descriptions.Item>
              <Descriptions.Item label="分时">{drawerTask.intervalLabel}</Descriptions.Item>
              <Descriptions.Item label="功能">{drawerTask.featureLabel}</Descriptions.Item>
              <Descriptions.Item label="接口"><Text code>{drawerTask.endpoint}</Text></Descriptions.Item>
              <Descriptions.Item label="调度">{drawerTask.schedule?.label ?? "手动执行"}</Descriptions.Item>
              <Descriptions.Item label="时区">{drawerTask.schedule?.timezone ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="最近触发">{formatTime(drawerState.lastTriggeredAt)}</Descriptions.Item>
              <Descriptions.Item label="最近完成">{formatTime(drawerState.lastFinishedAt)}</Descriptions.Item>
              <Descriptions.Item label="耗时">{drawerState.lastDurationMs ? `${drawerState.lastDurationMs} ms` : "暂无"}</Descriptions.Item>
            </Descriptions>

            <Alert
              type="info"
              showIcon
              message="动作说明"
              description={
                drawerTask.capabilities.immediate
                  ? "立即执行会携带 isImmediately=true；该接口可能同时创建定时任务。"
                  : "该接口当前仅支持启动与停止定时，不提供立即执行参数。"
              }
            />

            {drawerTask.sideEffects && (
              <div>
                <Text strong>副作用提示</Text>
                <div className={styles.sideEffects}>
                  {drawerTask.sideEffects.map((effect) => <Tag key={effect} color="orange">{effect}</Tag>)}
                </div>
              </div>
            )}

            <div>
              <Text strong>最近响应</Text>
              {drawerResponse ? (
                <Card className={styles.responseCard} size="small">
                  <Space direction="vertical" className={styles.responseMeta}>
                    <Space wrap>
                      <Tag color={drawerResponse.ok ? "green" : "red"}>{drawerResponse.ok ? "成功" : "失败"}</Tag>
                      <Tag>{drawerResponse.action}</Tag>
                      {drawerResponse.httpStatus && <Tag>HTTP {drawerResponse.httpStatus}</Tag>}
                      {drawerResponse.durationMs !== undefined && <Tag>{drawerResponse.durationMs} ms</Tag>}
                      {drawerResponse.errorCode && <Tag color="red">{drawerResponse.errorCode}</Tag>}
                    </Space>
                    {drawerResponse.error && <Alert type="error" showIcon message={drawerResponse.error} />}
                    <pre className={styles.jsonPanel}>{stringifyData(drawerResponse.data)}</pre>
                  </Space>
                </Card>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无本次页面会话响应" />
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </Layout>
  );
}

export default function Home() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 8,
          colorBgLayout: "#f5f7fa",
        },
      }}
    >
      <AntApp>
        <ApiConsolePage />
      </AntApp>
    </ConfigProvider>
  );
}
