"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Layout,
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
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { ApiTaskDefinition, FeatureCode, IntervalCode } from "@/config/apiCatalog";
import { apiCatalog, featureOptions, intervalOptions } from "@/config/apiCatalog";
import type { SchedulerTaskState } from "@/services/schedulerRegistry";
import type { ReutersRegion, ReutersSourceStats } from "@/services/reuters/types";
import {
  ApiConsoleError,
  fetchSchedulerStats,
  fetchSchedulerStatus,
  invokeApiTask,
  reportSchedulerAction,
  type ConsoleAction,
} from "@/services/apiConsoleClient";
import styles from "./page.module.css";
import { usePlatformNavigation } from "./PlatformShell";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const REUTERS_API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/reuters`;

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

type ReutersLastRun = {
  executedAt: string;
  date: string;
  sourceMode?: 'all' | 'google-news';
  filePath: string | null;
  fetched: Record<ReutersRegion, string[]>;
  incremental: Record<ReutersRegion, string[]>;
  sourcesByRegion?: Record<ReutersRegion, ReutersSourceStats>;
  emailSent: boolean;
  emailSkippedReason?: string;
  errors: string[];
};

type ReutersStatusResponse = {
  success: boolean;
  schedule: string;
  cronExpression: string;
  running: boolean;
  initialized: boolean;
  lastRun: ReutersLastRun | null;
};

const reutersSourceCards = [
  { key: "direct" as const, title: "Reuters 直连", description: "Reuters Section API，失败时回退网页解析" },
  { key: "rsshub" as const, title: "RSSHub Reuters", description: "US、China 走对应分区；Iran 从 Middle East 分区筛选" },
  { key: "googleNews" as const, title: "Google News RSS", description: "按 Reuters 域名与地区路径搜索新闻" },
];

function ReutersPipelinePanel({
  status,
  loading,
  error,
  testing,
  onTest,
  onRefresh,
}: {
  status: ReutersStatusResponse | null;
  loading: boolean;
  error: string | null;
  testing: boolean;
  onTest: () => void;
  onRefresh: () => void;
}) {
  const regions: ReutersRegion[] = ["us", "china", "iran"];
  const regionNames: Record<ReutersRegion, string> = { us: "US", china: "China", iran: "Iran" };
  const lastRun = status?.lastRun;

  return (
    <Space direction="vertical" size="middle" className={styles.reutersPanel}>
      <Card className={styles.filterCard} size="small">
        <div className={styles.reutersPanelHeader}>
          <div>
            <Title level={5} className={styles.sectionTitle}>Reuters 新闻采集链路</Title>
            <Text type="secondary">定时任务使用 Google News RSS；立即联测仍并行检查三条来源，且不发邮件、不改定时器</Text>
            <div className={styles.reutersSchedule}>
              <Tag color={status?.initialized ? "green" : "default"}>
                {status ? (status.initialized ? "定时器已注册" : "定时器未注册") : "定时器状态未知"}
              </Tag>
              <Text type="secondary">{status?.schedule ?? "工作日A股交易时段每5分钟，非工作日06:00执行一次"}</Text>
              {status?.running && <Tag color="processing">任务执行中</Tag>}
            </div>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>刷新状态</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={onTest} loading={testing} disabled={testing}>
              立即联测（不发邮件）
            </Button>
          </Space>
        </div>
      </Card>

      {error && <Alert type="warning" showIcon message="Reuters 状态暂不可用" description={error} />}

      <Row gutter={[16, 16]} className={styles.pipelineGrid}>
        {reutersSourceCards.map((source) => {
          const sourceStats = lastRun?.sourcesByRegion;
          const counts = regions.map((region) => sourceStats?.[region]?.[source.key]?.count ?? 0);
          const total = counts.reduce((sum, count) => sum + count, 0);
          const skippedBySchedule = lastRun?.sourceMode === "google-news" && source.key !== "googleNews";
          const failures = regions.flatMap((region) => {
            const message = sourceStats?.[region]?.[source.key]?.error;
            return message ? [`${regionNames[region]}: ${message}`] : [];
          });
          return (
            <Col xs={24} md={12} xxl={8} key={source.key}>
              <Card className={styles.pipelineCard} loading={loading && !lastRun} size="small">
                <div className={styles.pipelineTitle}>
                  <Text strong>{source.title}</Text>
                  <Tag color={!lastRun || skippedBySchedule ? "default" : failures.length ? (total ? "warning" : "red") : "green"}>
                    {!lastRun ? "待测试" : skippedBySchedule ? "定时链路未使用" : failures.length ? (total ? "部分可用" : "失败") : "正常"}
                  </Tag>
                </div>
                <Paragraph className={styles.pipelineDescription}>{source.description}</Paragraph>
                <Statistic title="本次来源标题数" value={lastRun ? total : "--"} />
                <Text className={styles.pipelineRegionCounts} type="secondary">
                  {regions.map((region, index) => `${regionNames[region]} ${lastRun ? counts[index] : "--"}`).join("  ·  ")}
                </Text>
                {failures.length > 0 && <Alert className={styles.pipelineError} type="warning" showIcon message={failures.join("；")} />}
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card className={styles.filterCard} size="small">
        <Space wrap>
          <Text strong>最近执行</Text>
          <Tag>{lastRun ? formatTime(lastRun.executedAt) : "尚无运行记录"}</Tag>
          {lastRun && <Tag color="blue">增量 US {lastRun.incremental.us.length} · China {lastRun.incremental.china.length} · Iran {lastRun.incremental.iran.length}</Tag>}
          {lastRun?.filePath && <Text type="secondary">存储：{lastRun.filePath}</Text>}
        </Space>
        {lastRun?.errors.length ? <Alert className={styles.pipelineError} type="warning" showIcon message={`本次有 ${lastRun.errors.length} 项来源请求异常，详情见上方来源卡片。`} /> : null}
      </Card>
      <Alert type="info" showIcon message="Google News RSS 使用范围" description="Google News RSS 条款限定个人非商业 feed 阅读用途；用于商业产品或再分发前，请先核实相应授权。" />
    </Space>
  );
}

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
  const {
    marketFilter,
    setMarketFilter,
    featureFilter,
    setFeatureFilter,
    showReutersPipeline,
  } = usePlatformNavigation();
  const [intervalFilter, setIntervalFilter] = useState<IntervalCode>("ALL");
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
  const [reutersStatus, setReutersStatus] = useState<ReutersStatusResponse | null>(null);
  const [reutersStatusLoading, setReutersStatusLoading] = useState(false);
  const [reutersStatusError, setReutersStatusError] = useState<string | null>(null);
  const [reutersTesting, setReutersTesting] = useState(false);

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

  useEffect(() => {
    if (!showReutersPipeline) return;
    setIntervalFilter("ALL");
    const controller = new AbortController();
    const loadStatus = async () => {
      setReutersStatusLoading(true);
      try {
        const response = await fetch(`${REUTERS_API}?statusOnly=true`, { cache: "no-store", signal: controller.signal });
        const data = await response.json() as ReutersStatusResponse & { error?: string };
        if (!response.ok || !data.success) throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
        setReutersStatus(data);
        setReutersStatusError(null);
      } catch (reason) {
        if (!controller.signal.aborted) setReutersStatusError(reason instanceof Error ? reason.message : "获取 Reuters 状态失败");
      } finally {
        if (!controller.signal.aborted) setReutersStatusLoading(false);
      }
    };
    void loadStatus();
    const intervalId = window.setInterval(() => {
      if (!document.hidden) void loadStatus();
    }, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [showReutersPipeline]);

  useEffect(() => {
    if (featureFilter !== "REUTERS") return;
    setIntervalFilter("ALL");
    setMarketFilter("ALL");
  }, [featureFilter, setMarketFilter]);

  async function refreshReutersStatus() {
    setReutersStatusLoading(true);
    try {
      const response = await fetch(`${REUTERS_API}?statusOnly=true`, { cache: "no-store" });
      const data = await response.json() as ReutersStatusResponse & { error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
      setReutersStatus(data);
      setReutersStatusError(null);
    } catch (reason) {
      setReutersStatusError(reason instanceof Error ? reason.message : "获取 Reuters 状态失败");
    } finally {
      setReutersStatusLoading(false);
    }
  }

  async function testReutersPipelines() {
    setReutersTesting(true);
    try {
      const response = await fetch(`${REUTERS_API}?isImmediately=true&sendEmail=false&skipScheduler=true`, { cache: "no-store" });
      const data = await response.json() as { message?: string; lastRun?: ReutersLastRun; error?: string };
      if (data.lastRun) setReutersStatus((current) => current ? { ...current, lastRun: data.lastRun! } : current);
      await refreshReutersStatus();
      if (!response.ok) throw new Error(data.message || data.error || `请求失败（HTTP ${response.status}）`);
      message.success("Reuters 三链路执行完成，未发送邮件");
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "Reuters 三链路执行失败");
    } finally {
      setReutersTesting(false);
    }
  }

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

  return (
    <Layout className={styles.shell}>
        <Header className={styles.header}>
          <div>
            <Title level={4} className={styles.pageTitle}>定时器 API 控制台</Title>
            <Text type="secondary">市场数据任务 · 执行、启停、状态一站管理</Text>
          </div>
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
          {showReutersPipeline ? (
            <ReutersPipelinePanel
              status={reutersStatus}
              loading={reutersStatusLoading}
              error={reutersStatusError}
              testing={reutersTesting}
              onTest={() => void testReutersPipelines()}
              onRefresh={() => void refreshReutersStatus()}
            />
          ) : <>
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
                <Button
                  icon={<FileTextOutlined />}
                  type={featureFilter === "AI" ? "primary" : "default"}
                  aria-pressed={featureFilter === "AI"}
                  onClick={() => {
                    const nextFeature = featureFilter === "AI" ? "ALL" : "AI";
                    setFeatureFilter(nextFeature);
                    if (nextFeature === "AI") {
                      setMarketFilter("ALL");
                      setIntervalFilter("ALL");
                    }
                  }}
                >
                  报告分析
                </Button>
                <Select
                  className={styles.featureSelect}
                  value={featureFilter}
                  options={featureOptions}
                  onChange={(value) => {
                    setFeatureFilter(value as FeatureCode);
                    if (value === "REUTERS") {
                      setMarketFilter("ALL");
                      setIntervalFilter("ALL");
                    }
                  }}
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
          </>}
        </Content>
      <Drawer
        title={drawerTask?.title ?? "任务详情"}
        width="min(560px, calc(100vw - 24px))"
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
  return <ApiConsolePage />;
}
