"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  BugOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import styles from "./page.module.css";

const { Title, Text } = Typography;
const LOG_API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/log-analyze`;

type LogLevel = "error" | "warn" | "info";
type LogFile = { name: string; size: number; modifiedAt: string };
type LogLine = { text: string; level: LogLevel };
type LogResponse = {
  directory: string;
  files: LogFile[];
  selectedFile: string | null;
  lines: LogLine[];
  totalLines: number;
  truncated: boolean;
  serverTime: string;
};

const lineOptions = [200, 500, 1000, 5000, 10000].map((value) => ({ label: `最近 ${value} 行`, value }));
const levelOptions = [
  { label: "全部级别", value: "all" },
  { label: "仅错误", value: "error" },
  { label: "仅警告", value: "warn" },
  { label: "仅信息", value: "info" },
];

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value?: string) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

async function requestLogs(file: string | undefined, lines: number): Promise<LogResponse> {
  const params = new URLSearchParams({ lines: String(lines) });
  if (file) params.set("file", file);
  const response = await fetch(`${LOG_API}?${params.toString()}`, { cache: "no-store" });
  const payload = (await response.json()) as { success: boolean; data?: LogResponse; error?: string };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? `日志接口请求失败（HTTP ${response.status}）`);
  }
  return payload.data;
}

function LogAnalyzeContent() {
  const { message } = AntApp.useApp();
  const viewportRef = useRef<HTMLDivElement>(null);
  const keepAtBottomRef = useRef(true);
  const [files, setFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [lineLimit, setLineLimit] = useState(200);
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [serverTime, setServerTime] = useState<string>();
  const [directory, setDirectory] = useState<string>();
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [clearConfirmStep, setClearConfirmStep] = useState<0 | 1 | 2>(0);
  const [confirmFileName, setConfirmFileName] = useState("");
  const [clearing, setClearing] = useState(false);

  async function loadLogs(file = selectedFile, showLoading = true, requestedLineLimit = lineLimit) {
    if (showLoading) setRefreshing(true);
    try {
      const data = await requestLogs(file, requestedLineLimit);
      setFiles(data.files);
      setSelectedFile(data.selectedFile ?? undefined);
      setLines(data.lines);
      setServerTime(data.serverTime);
      setDirectory(data.directory);
      setTruncated(data.truncated);
      setError(undefined);
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "读取日志失败";
      setError(messageText);
      if (file) {
        try {
          const fallback = await requestLogs(undefined, requestedLineLimit);
          setFiles(fallback.files);
          setSelectedFile(fallback.selectedFile ?? undefined);
          setLines(fallback.lines);
          setServerTime(fallback.serverTime);
          setDirectory(fallback.directory);
          setTruncated(fallback.truncated);
          setError(undefined);
        } catch {
          // Keep the last successful view when the fallback request also fails.
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadLogs(undefined);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const intervalId = window.setInterval(() => {
      if (!document.hidden) void loadLogs(selectedFile, false);
    }, 60_000);

    const handleVisibility = () => {
      if (!document.hidden) void loadLogs(selectedFile, false);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoRefresh, selectedFile, lineLimit]);

  useEffect(() => {
    if (keepAtBottomRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [lines]);

  const visibleLines = useMemo(() => {
    const query = search.trim().toLowerCase();
    return lines.filter((line) => {
      const matchesLevel = level === "all" || line.level === level;
      const matchesSearch = !query || line.text.toLowerCase().includes(query);
      return matchesLevel && matchesSearch;
    });
  }, [level, lines, search]);

  const counts = useMemo(
    () => ({
      error: lines.filter((line) => line.level === "error").length,
      warn: lines.filter((line) => line.level === "warn").length,
      info: lines.filter((line) => line.level === "info").length,
    }),
    [lines],
  );

  const selectedFileMeta = files.find((file) => file.name === selectedFile);

  function handleScroll() {
    const viewport = viewportRef.current;
    if (!viewport) return;
    keepAtBottomRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 36;
  }

  function handleClear() {
    setLines([]);
    message.info("已清空当前页面日志视图，下一次刷新会重新加载");
  }

  async function clearSelectedLog() {
    if (!selectedFile || confirmFileName !== selectedFile) return;
    setClearing(true);
    try {
      const response = await fetch(LOG_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", file: selectedFile }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? `清空失败（HTTP ${response.status}）`);
      }
      setClearConfirmStep(0);
      setConfirmFileName("");
      message.success(`${selectedFile} 内容已清空，文件仍保留`);
      await loadLogs(selectedFile);
    } catch (clearError) {
      const messageText = clearError instanceof Error ? clearError.message : "清空日志失败";
      setError(messageText);
      message.error(messageText);
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Text className={styles.eyebrow}>PM2 OBSERVABILITY</Text>
            <Title level={2} className={styles.title}>日志实时分析</Title>
            <Text className={styles.subtitle}>只读查看服务器 PM2 输出，页面打开时每 1 分钟同步一次</Text>
          </div>
          <div className={styles.headerActions}>
            <Badge status={error ? "error" : "processing"} text={error ? "日志读取异常" : "监控在线"} />
            <Link href="/" className={styles.backLink}><ArrowLeftOutlined /> 返回控制台</Link>
          </div>
        </header>

        {error && <Alert type="warning" showIcon message="日志读取提示" description={error} closable onClose={() => setError(undefined)} />}

        <Card className={styles.controlCard} bordered={false}>
          <div className={styles.controlGrid}>
            <div>
              <Text className={styles.controlLabel}>日志文件</Text>
              <Select
                showSearch
                style={{ width: "100%" }}
                placeholder="选择 PM2 日志文件"
                value={selectedFile}
                options={files.map((file) => ({ label: `${file.name} · ${formatBytes(file.size)}`, value: file.name }))}
                onChange={(value) => void loadLogs(value)}
                notFoundContent="暂无 .log 文件"
              />
            </div>
            <div>
              <Text className={styles.controlLabel}>读取范围</Text>
              <Select
                style={{ width: "100%" }}
                value={lineLimit}
                options={lineOptions}
                onChange={(value) => {
                  setLineLimit(value);
                  void loadLogs(selectedFile, true, value);
                }}
              />
            </div>
            <div>
              <Text className={styles.controlLabel}>级别筛选</Text>
              <Select style={{ width: 120 }} value={level} options={levelOptions} onChange={setLevel} />
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索日志内容"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Space>
              <Switch checked={autoRefresh} onChange={setAutoRefresh} />
              <Text className={styles.subtitle}>自动刷新</Text>
              <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void loadLogs(selectedFile)}>
                刷新
              </Button>
              <Button
                danger
                icon={<ClearOutlined />}
                disabled={!selectedFile}
                onClick={() => setClearConfirmStep(1)}
              >
                清空文件
              </Button>
              <Button icon={<ClearOutlined />} onClick={handleClear}>清空视图</Button>
            </Space>
          </div>
        </Card>

        <div className={styles.statGrid}>
          <Space wrap size={[12, 12]}>
            <Card className={styles.statCard} bordered={false} size="small"><Statistic title="当前行数" value={lines.length} prefix={<FileTextOutlined />} /></Card>
            <Card className={styles.statCard} bordered={false} size="small"><Statistic title="错误" value={counts.error} valueStyle={{ color: "#ff7875" }} prefix={<BugOutlined />} /></Card>
            <Card className={styles.statCard} bordered={false} size="small"><Statistic title="警告" value={counts.warn} valueStyle={{ color: "#ffc069" }} prefix={<WarningOutlined />} /></Card>
            <Card className={styles.statCard} bordered={false} size="small"><Statistic title="信息" value={counts.info} valueStyle={{ color: "#69c0ff" }} prefix={<ClockCircleOutlined />} /></Card>
          </Space>
        </div>

        <Card
          className={styles.logCard}
          bordered={false}
          title={
            <Space>
              <span>{selectedFile ?? "PM2 日志"}</span>
              {selectedFileMeta && <Tag>{formatBytes(selectedFileMeta.size)}</Tag>}
            </Space>
          }
          extra={<Tag color={truncated ? "gold" : "blue"}>{truncated ? "尾部内容" : "完整内容"}</Tag>}
        >
          <Spin spinning={loading} tip="读取日志中...">
            <div ref={viewportRef} className={styles.logViewport} onScroll={handleScroll}>
              {visibleLines.length === 0 ? (
                <div className={styles.emptyState}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={files.length ? "没有匹配的日志行" : "没有可读取的 PM2 日志"} />
                </div>
              ) : (
                visibleLines.map((line, index) => (
                  <div key={`${index}-${line.text}`} className={`${styles.logLine} ${line.level === "error" ? styles.errorLine : ""} ${line.level === "warn" ? styles.warnLine : ""}`}>
                    <span className={styles.lineNumber}>{index + 1}</span>
                    <span className={styles.lineText}>{line.text || " "}</span>
                  </div>
                ))
              )}
            </div>
          </Spin>
        </Card>

        <div className={styles.footerMeta}>
          <Text className={styles.footerMeta}>目录：{directory ?? "/root/.pm2/logs"}</Text>
          <Text className={styles.footerMeta}>服务端更新时间：{formatTime(serverTime)} · 显示 {visibleLines.length} / {lines.length} 行</Text>
        </div>

        <Modal
          open={clearConfirmStep === 1}
          title="第一次确认：清空日志文件内容"
          okText="继续确认"
          cancelText="取消"
          maskClosable={false}
          onCancel={() => setClearConfirmStep(0)}
          onOk={() => setClearConfirmStep(2)}
        >
          <Alert
            type="warning"
            showIcon
            message="只会清空内容，不会删除文件"
            description={
              selectedFile
                ? `${selectedFile} 当前大小为 ${formatBytes(selectedFileMeta?.size ?? 0)}。清空后文件会保留，PM2 可以继续写入。`
                : "当前没有选中的日志文件。"
            }
          />
        </Modal>

        <Modal
          open={clearConfirmStep === 2}
          title="第二次确认：输入文件名"
          okText={clearing ? "清空中..." : "确认清空内容"}
          cancelText="取消"
          okButtonProps={{ danger: true, disabled: !selectedFile || confirmFileName !== selectedFile, loading: clearing }}
          maskClosable={false}
          onCancel={() => {
            setClearConfirmStep(0);
            setConfirmFileName("");
          }}
          onOk={() => void clearSelectedLog()}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text>请输入完整文件名以确认操作：</Text>
            <Text code>{selectedFile}</Text>
            <Input
              autoFocus
              value={confirmFileName}
              placeholder="输入上面的完整文件名"
              onChange={(event) => setConfirmFileName(event.target.value)}
            />
          </Space>
        </Modal>
      </div>
    </main>
  );
}

export default function LogAnalyzePage() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#13c2c2",
          borderRadius: 8,
          colorBgContainer: "#0c1c30",
          colorText: "#d7e3f4",
          colorTextSecondary: "#8da3bb",
        },
      }}
    >
      <AntApp>
        <LogAnalyzeContent />
      </AntApp>
    </ConfigProvider>
  );
}
