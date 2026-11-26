"use client";

import { useEffect, useState } from "react";
import { Alert, App as AntApp, Button, Card, Input, Popconfirm, Space, Table, Tag, TreeSelect, Typography } from "antd";
import { ReloadOutlined, SaveOutlined, SearchOutlined } from "@ant-design/icons";
import { pinyin } from "pinyin-pro";
import styles from "./page.module.css";

type Stock = { code: string; market: number; name: string; price: number | null; changePercent: number | null };
type MappingStatus = { fileName: string; status: "running" | "complete" | "partial" | "failed"; total: number; completed: number; matched: number; failed: number; error?: string; failureSamples?: Array<{ secid: string; error: string }> };
type BoardResponse = { success: boolean; error?: string; bkCode: string; count: number; stocks: Stock[]; filePath: string | null; futuMapping?: MappingStatus | null };
type Board = { code: string; name: string; categories: string[]; industryLevels?: number[] };

const API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/eastmoney/board-stocks`;
const BOARDS_API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/eastmoney/boards`;
const MAPPING_API = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/eastmoney/futu-mapping`;
const presets = [
  { code: "BK1128", label: "CPO概念", file: "cpo" },
  { code: "BK0546", label: "玻璃玻纤", file: "boliboxian" },
  { code: "BK0800", label: "BK0800" },
];

function defaultFile(code: string, name?: string) {
  const preset = presets.find((item) => item.code === code);
  if (preset?.file) return preset.file;
  const boardName = name?.trim().replace(/(?:概念|板块)$/, "") || name?.trim();
  if (!boardName) return code.toLowerCase();
  const result = pinyin(boardName.normalize("NFKC"), { toneType: "none", type: "array" })
    .join("").toLowerCase().replace(/ü/g, "v").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/g, "").slice(0, 80);
  return result || code.toLowerCase();
}

function BoardContent() {
  const { message } = AntApp.useApp();
  const [code, setCode] = useState("BK1128");
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("cpo");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<BoardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [boardsError, setBoardsError] = useState("");
  const [boardsRefreshKey, setBoardsRefreshKey] = useState(0);
  const [treeValue, setTreeValue] = useState<string>();
  const [mapping, setMapping] = useState<MappingStatus | null>(null);

  useEffect(() => {
    if (!mapping || mapping.status !== "running") return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      fetch(`${MAPPING_API}?fileName=${encodeURIComponent(mapping.fileName)}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json() as { mapping?: MappingStatus };
          if (data.mapping) setMapping(data.mapping);
        })
        .catch(() => { /* Keep the last status; the next poll will retry. */ });
    }, 3000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [mapping?.fileName, mapping?.status]);

  useEffect(() => {
    const controller = new AbortController();
    setBoardsLoading(true);
    setBoardsError("");
    fetch(BOARDS_API, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { success: boolean; boards?: Board[]; error?: string };
        if (!response.ok || !data.success || !Array.isArray(data.boards)) throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
        setBoards(data.boards);
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setBoardsError(reason instanceof Error ? reason.message : "获取板块列表失败"); })
      .finally(() => { if (!controller.signal.aborted) setBoardsLoading(false); });
    return () => controller.abort();
  }, [boardsRefreshKey]);

  useEffect(() => {
    const board = boards.find((item) => item.code === code);
    if (board) setFileName((current) => current === code.toLowerCase() ? defaultFile(code, board.name) : current);
  }, [boards, code]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    const params = new URLSearchParams({ bkCode: code, preview: "true" });
    fetch(`${API}?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as BoardResponse;
        if (!response.ok || !data.success) throw new Error(data.error || `请求失败（HTTP ${response.status}）`);
        return data;
      })
      .then((data) => setResult(data))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "获取板块失败");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [code, refreshKey]);

  function selectBoard(value: string, selectedTreeValue?: string) {
    const selected = value.trim();
    const next = (boards.find((board) => board.name.toLowerCase() === selected.toLowerCase())?.code ?? selected).toUpperCase();
    if (!/^BK\d{4}$/.test(next)) { message.error("请输入板块代码，或从搜索结果中选择板块"); return; }
    const board = boards.find((item) => item.code === next);
    setInput(next);
    setTreeValue((current) => {
      if (selectedTreeValue) return selectedTreeValue;
      if (current?.endsWith(`:${next}`)) return current;
      if (board?.categories.includes("行业")) return `industry:${board.industryLevels?.[0] ?? 0}:${next}`;
      const category = board?.categories.find((item) => item === "概念" || item === "地域");
      return category ? `${category}:${next}` : undefined;
    });
    if (next === code) {
      setRefreshKey((current) => current + 1);
    } else {
      setFileName(defaultFile(next, board?.name));
      setQuery("");
      setPage(1);
      setCode(next);
    }
  }

  async function saveBoard() {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(fileName)) { message.error("文件名只能包含字母、数字、下划线和连字符"); return; }
    setSaving(true);
    try {
      const params = new URLSearchParams({ bkCode: code, fileName });
      const response = await fetch(`${API}?${params}`, { cache: "no-store" });
      const data = await response.json() as BoardResponse;
      if (!response.ok || !data.success) throw new Error(data.error || `保存失败（HTTP ${response.status}）`);
      setResult(data);
      setMapping(data.futuMapping ?? null);
      message.success(`已保存 ${data.count} 只股票至 ${data.filePath}`);
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "保存失败");
    } finally { setSaving(false); }
  }

  const makeLeaves = (items: Board[], group: string) => items.map((board) => ({
    title: `${board.name} · ${board.code}`,
    value: `${group}:${board.code}`,
    isLeaf: true,
  }));
  const industryGroups = [1, 2, 3, 0].map((level) => {
    const items = boards.filter((board) => board.categories.includes("行业") && (level === 0 ? !board.industryLevels?.length : board.industryLevels?.includes(level)));
    return {
      title: `${level ? `${["", "一级", "二级", "三级"][level]}行业` : "未标注级别"} · ${items.length}`,
      value: `industry:${level}`,
      selectable: false,
      children: makeLeaves(items, `industry:${level}`),
    };
  }).filter((group) => group.children.length > 0);
  const boardTree = [
    { title: "行业板块", value: "category:industry", selectable: false, children: industryGroups },
    ...["概念", "地域"].map((category) => ({
      title: `${category}板块`,
      value: `category:${category}`,
      selectable: false,
      children: makeLeaves(boards.filter((board) => board.categories.includes(category)), category),
    })),
  ];
  const filtered = (result?.stocks ?? []).filter((stock) => `${stock.name} ${stock.code}`.toLowerCase().includes(query.trim().toLowerCase()));
  const columns = [
    { title: "股票名称", dataIndex: "name", key: "name", render: (name: string, stock: Stock) => <a href={`https://quote.eastmoney.com/unify/r/${stock.market}.${stock.code}`} target="_blank" rel="noreferrer">{name}</a> },
    { title: "股票代码", dataIndex: "code", key: "code", render: (value: string, stock: Stock) => <span className={styles.code}>{stock.market}.{value}</span> },
    { title: "最新价", dataIndex: "price", key: "price", align: "right" as const, render: (value: number | null) => value === null ? "--" : value.toFixed(2) },
    { title: "涨跌幅", dataIndex: "changePercent", key: "changePercent", align: "right" as const, render: (value: number | null) => value === null ? "--" : <span className={value > 0 ? styles.up : value < 0 ? styles.down : ""}>{value > 0 ? "+" : ""}{value.toFixed(2)}%</span> },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div><div className={styles.eyebrow}>EASTMONEY / BOARD EXPLORER</div><Typography.Title level={2} className={styles.title}>板块</Typography.Title><Typography.Text className={styles.subtitle}>切换板块，查看成分股与最新行情</Typography.Text></div>
          <Button icon={<ReloadOutlined />} loading={loading} disabled={saving} onClick={() => setRefreshKey((current) => current + 1)}>刷新行情</Button>
        </header>
        <Card className={styles.controls}>
          <div className={styles.label}>快捷板块</div>
          <Space wrap>{presets.map((item) => <Button key={item.code} type={code === item.code ? "primary" : "default"} disabled={saving} onClick={() => selectBoard(item.code)}>{item.label} <span className={styles.presetCode}>{item.code}</span></Button>)}</Space>
          <div className={styles.actions}>
            <div>
              <div className={styles.label}>查询其他板块 {boardsLoading ? "· 正在加载板块列表" : boards.length ? `· 已加载 ${boards.length} 个` : ""}</div>
              <TreeSelect aria-label="选择板块" style={{ width: "100%" }} value={treeValue} disabled={saving} loading={boardsLoading} treeData={boardTree} showSearch allowClear treeLine placeholder="展开分类，或搜索板块名称 / BK 代码" notFoundContent={boardsLoading ? "正在加载板块列表" : "没有匹配的板块"} filterTreeNode={(search, node) => Boolean(node.isLeaf) && String(node.title).toLowerCase().includes(search.trim().toLowerCase())} onChange={(value: string | undefined) => { if (!value) { setTreeValue(undefined); return; } selectBoard(value.slice(value.lastIndexOf(":") + 1), value); }} />
              {boardsError && <div className={styles.boardError}>板块列表加载失败，可手动输入 BK 代码。<Button type="link" size="small" onClick={() => setBoardsRefreshKey((current) => current + 1)}>重试</Button></div>}
            </div>
            <div><div className={styles.label}>手动查询</div><Input.Search aria-label="手动查询板块" value={input} disabled={saving} onChange={(event) => setInput(event.target.value)} placeholder="输入板块名称或 BK 代码" onSearch={(value) => selectBoard(value)} enterButton="查询" allowClear /></div>
            <div><div className={styles.label}>保存文件名</div><Space.Compact><Input aria-label="保存文件名" value={fileName} disabled={saving} onChange={(event) => setFileName(event.target.value)} suffix=".ts" /><Popconfirm title="保存板块股票列表？" description={`将更新 src/pages/data/astock/${fileName}.ts`} onConfirm={() => void saveBoard()} okText="确认保存" cancelText="取消" disabled={loading || saving || !result}><Button icon={<SaveOutlined />} loading={saving} disabled={loading || !result}>保存股票列表</Button></Popconfirm></Space.Compact></div>
          </div>
        </Card>
        {error && <Alert className={styles.alert} type="error" showIcon message="板块数据获取失败" description={error} />}
      {mapping && <Alert className={styles.alert} type={mapping.status === "complete" ? "success" : mapping.status === "running" ? "info" : "warning"} showIcon message={`${mapping.fileName}.ts 的富途映射${mapping.status === "running" ? "生成中" : mapping.status === "complete" ? "已生成" : "未完全生成"}：${mapping.matched}/${mapping.total} 只`} description={mapping.status === "running" ? `已处理 ${mapping.completed}/${mapping.total}，可关闭页面，任务在服务器后台继续。` : mapping.error || (mapping.failed ? `失败 ${mapping.failed} 只，不影响东方财富股票池。${mapping.failureSamples?.map((item) => `${item.secid}: ${item.error}`).join("；") ?? ""}` : "后续富途兜底会优先使用该映射；请求签名每次动态生成，不写入文件。")} />}
        <Card className={styles.list} title={<Space><span>成分股列表</span><Tag color="cyan">{code}</Tag><Typography.Text type="secondary">{result ? `${result.count} 只股票` : ""}</Typography.Text></Space>} extra={<Input aria-label="搜索股票" prefix={<SearchOutlined />} placeholder="搜索名称或代码" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} allowClear />}>
          <Table<Stock> rowKey={(stock) => `${stock.market}.${stock.code}`} columns={columns} dataSource={filtered} loading={loading} pagination={{ current: page, onChange: setPage, pageSize: 25, showSizeChanger: false, showTotal: (total) => `共 ${total} 只` }} scroll={{ x: 560 }} locale={{ emptyText: error ? "暂无数据，请重试" : "没有匹配的股票" }} />
          <div className={styles.note}>行情来自东方财富，价格与涨跌幅可能延迟。浏览不会修改股票文件。</div>
        </Card>
      </div>
    </main>
  );
}

export default function BoardsPage() {
  return <BoardContent />;
}
