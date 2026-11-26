"use client";

import { useEffect, useState } from "react";
import { Alert, App as AntApp, Button, Checkbox, Drawer, Empty, Input, Pagination, Space, Table, Tabs, Tag, Tooltip, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ApiTaskDefinition } from "@/config/apiCatalog";
import type { StockPoolSource, TaskPool } from "@/services/stockPoolService";
import styles from "./page.module.css";

type Catalog = { tasks: ApiTaskDefinition[]; sources: StockPoolSource[]; pools: TaskPool[] };
type PoolMarket = "A" | "HK" | "US";
type SourceOption = { id: string; fileName: string; label: string; exportName?: string; count?: number; scope?: StockPoolSource["scope"]; origin?: string; classifiedAt?: string; warning?: string; missing: boolean };
const api = `${process.env.NEXT_PUBLIC_BASE_PATH || "/stock"}/api/stock-pools`;
const markets: { key: PoolMarket; label: string }[] = [
  { key: "A", label: "A股" },
  { key: "HK", label: "港股" },
  { key: "US", label: "美股" },
];
const optionPageSize = 20;

export default function StockPoolsPage() {
  const { message } = AntApp.useApp();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [market, setMarket] = useState<PoolMarket>("A");
  const [editing, setEditing] = useState<ApiTaskDefinition | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stocks, setStocks] = useState<string[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [optionPage, setOptionPage] = useState(1);

  async function refresh() {
    try {
      setError("");
      const response = await fetch(api, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载失败");
      setCatalog(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "加载失败");
    }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (!editing) return;
    const controller = new AbortController();
    setStocks(null);
    setPreviewError("");
    fetch(`${api}?taskId=${encodeURIComponent(editing.id)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "预览失败");
        setStocks(data.stocks);
      })
      .catch((reason) => { if (!controller.signal.aborted) setPreviewError(reason instanceof Error ? reason.message : "预览失败"); });
    return () => controller.abort();
  }, [editing]);

  function openTask(task: ApiTaskDefinition) {
    const pool = catalog?.pools.find((item) => item.taskId === task.id);
    if (!pool) return;
    setSelected(pool.sources);
    setVersion(pool.version);
    setSourceSearch("");
    setSelectedOnly(false);
    setOptionPage(1);
    setEditing(task);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(api, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: editing.id, sources: selected, version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      message.success("股票池已保存，下次任务执行时生效");
      setEditing(null);
      await refresh();
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : "保存失败");
    } finally { setSaving(false); }
  }

  const available = catalog?.sources.filter((source) => source.market === editing?.market) ?? [];
  const missing = selected.filter((id) => !available.some((source) => source.id === id));
  const options: SourceOption[] = [
    ...missing.map((id) => ({ id, fileName: id, label: id, missing: true })),
    ...available.map((source) => ({ ...source, missing: false })),
  ];
  const search = sourceSearch.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    (!selectedOnly || selected.includes(option.id)) &&
    (!search || `${option.label} ${option.fileName} ${option.exportName ?? ""} ${option.id}`.toLowerCase().includes(search)),
  );
  const currentOptionPage = Math.min(optionPage, Math.max(1, Math.ceil(filteredOptions.length / optionPageSize)));
  const visibleOptions = filteredOptions.slice((currentOptionPage - 1) * optionPageSize, currentOptionPage * optionPageSize);
  const tasks = catalog?.tasks.filter((task) => task.market === market) ?? [];
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>TASK CONFIGURATION</span><Typography.Title level={2}>配置池</Typography.Title><p>按市场管理任务股票分类，配置保存后在下次执行时生效。</p></div>
        <Button onClick={() => void refresh()}>刷新</Button>
      </div>
      {error && <Alert type="error" showIcon message="无法加载股票池配置" description={error} className={styles.alert} />}
      <Tabs
        className={styles.marketTabs}
        activeKey={market}
        onChange={(key) => setMarket(key as PoolMarket)}
        items={markets.map((item) => ({ key: item.key, label: <span>{item.label}<span className={styles.marketCount}>{catalog?.tasks.filter((task) => task.market === item.key).length ?? "–"}</span></span> }))}
      />
      <div className={styles.panel}>
        <Table<ApiTaskDefinition> rowKey="id" dataSource={tasks} loading={!catalog && !error} scroll={{ x: 600 }} pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }} columns={[
          { title: "任务", dataIndex: "title", render: (title: string, task) => <div><strong>{title}</strong><div className={styles.subtle}>{task.id}</div></div> },
          { title: "周期", dataIndex: "intervalLabel", render: (label: string) => <Tag>{label}</Tag> },
          { title: "已选分类", render: (_, task) => {
            const sources = catalog?.pools.find((item) => item.taskId === task.id)?.sources ?? [];
            if (!sources.length) return <span className={styles.subtle}>未配置</span>;
            return <Tooltip title={sources.map((id) => catalog?.sources.find((source) => source.id === id && source.market === task.market)?.label ?? id).join("、")}><span className={styles.sourceSummary}>{sources.slice(0, 2).map((id) => <Tag key={id}>{catalog?.sources.find((source) => source.id === id && source.market === task.market)?.label ?? id}</Tag>)}{sources.length > 2 && <Tag>+{sources.length - 2}</Tag>}</span></Tooltip>;
          } },
          { title: "操作", width: 100, fixed: "right", render: (_, task) => <Button type="link" onClick={() => openTask(task)}>配置</Button> },
        ]} />
      </div>
      <Drawer title={editing?.title} width="min(560px, 100vw)" open={!!editing} onClose={() => setEditing(null)} extra={<Button type="primary" loading={saving} onClick={() => void save()}>保存配置</Button>}>
        <p className={styles.subtle}>按东方财富行业和 BK 编码配置；“部分股票”仅包含原有股票，不是板块全部成分股。无法核实的分类保留原数据，不会推测编码。</p>
        {previewError && <Alert type="warning" showIcon message="当前配置无法读取" description={previewError} className={styles.alert} />}
        {stocks && <div className={styles.preview}>当前已保存配置：<strong>{stocks.length}</strong> 只股票</div>}
        <div className={styles.sourceHeader}>
          <div><strong>股票分类</strong><span className={styles.sourceCount}>已选 {selected.length} 项 · 可用 {available.length} 项</span></div>
          <Checkbox checked={selectedOnly} onChange={(event) => { setSelectedOnly(event.target.checked); setOptionPage(1); }}>仅看已选</Checkbox>
        </div>
        <Input aria-label="搜索股票分类" prefix={<SearchOutlined />} placeholder="搜索分类或文件名" allowClear value={sourceSearch} onChange={(event) => { setSourceSearch(event.target.value); setOptionPage(1); }} />
        {visibleOptions.length ? <div className={styles.options}>
          {visibleOptions.map((option) => <Checkbox
            className={styles.option}
            key={option.id}
            checked={selected.includes(option.id)}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelected((current) => checked ? current.includes(option.id) ? current : [...current, option.id] : current.filter((id) => id !== option.id));
            }}
          ><span className={styles.optionContent}><strong>{option.label}</strong><small>{option.missing ? "文件缺失或不属于该市场，请取消选择" : `${option.scope === "partial" ? "部分股票" : option.scope === "file" ? "板块文件（成分未核验）" : option.scope === "candidate" ? "根据文件名匹配，需核实" : "待核实"} · ${option.count} 只 · ${option.fileName}${option.origin ? ` · 原分类 ${option.origin.split("/").pop()}` : ""}${option.classifiedAt ? ` · 归类于 ${option.classifiedAt}` : ""}${option.warning ? ` · ${option.warning}` : ""}`}</small></span></Checkbox>)}
        </div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={options.length ? "没有匹配的股票分类" : "没有可用的股票分类"} />}
        {filteredOptions.length > optionPageSize && <Pagination className={styles.optionPagination} size="small" current={currentOptionPage} total={filteredOptions.length} pageSize={optionPageSize} showSizeChanger={false} onChange={setOptionPage} />}
      </Drawer>
    </main>
  );
}
