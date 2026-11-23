"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { AppstoreOutlined, BarChartOutlined, FileSearchOutlined, FileTextOutlined, GlobalOutlined } from "@ant-design/icons";
import { Layout, Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { apiCatalog, marketOptions, type FeatureCode, type MarketCode } from "@/config/apiCatalog";
import styles from "./PlatformShell.module.css";

type NavigationState = {
  marketFilter: MarketCode;
  setMarketFilter: Dispatch<SetStateAction<MarketCode>>;
  featureFilter: FeatureCode;
  setFeatureFilter: Dispatch<SetStateAction<FeatureCode>>;
  showReutersPipeline: boolean;
  setShowReutersPipeline: Dispatch<SetStateAction<boolean>>;
};

const NavigationContext = createContext<NavigationState | null>(null);

export function usePlatformNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("usePlatformNavigation must be used inside PlatformShell");
  return value;
}

export default function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [marketFilter, setMarketFilter] = useState<MarketCode>("ALL");
  const [featureFilter, setFeatureFilter] = useState<FeatureCode>("ALL");
  const [showReutersPipeline, setShowReutersPipeline] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const routePath = (pathname ?? "/").replace(/^\/stock(?=\/|$)/, "") || "/";
  const selectedKey = routePath === "/boards"
    ? "BOARDS"
    : routePath === "/log-analyze"
      ? "LOG_ANALYZE"
      : showReutersPipeline
        ? "REUTERS"
        : featureFilter === "AI"
          ? "REPORT_ANALYSIS"
          : marketFilter;

  const items: MenuProps["items"] = useMemo(() => [
    { key: "ALL", icon: <AppstoreOutlined />, label: "全部任务" },
    { key: "REUTERS", icon: <GlobalOutlined />, label: "Reuters" },
    { key: "REPORT_ANALYSIS", icon: <FileTextOutlined />, label: "报告分析" },
    { key: "BOARDS", icon: <BarChartOutlined />, label: "板块" },
    { key: "LOG_ANALYZE", icon: <FileSearchOutlined />, label: "日志分析" },
    { type: "divider" },
    {
      type: "group",
      label: "市场",
      children: marketOptions.slice(1).map((market) => ({ key: market.key, label: market.label })),
    },
  ], []);

  function handleMenuClick({ key }: { key: string }) {
    if (key === "BOARDS") {
      router.push("/boards");
      return;
    }
    if (key === "LOG_ANALYZE") {
      router.push("/log-analyze");
      return;
    }
    if (routePath !== "/") router.push("/");
    if (key === "REPORT_ANALYSIS") {
      setMarketFilter("ALL");
      setFeatureFilter("AI");
      setShowReutersPipeline(false);
      return;
    }
    if (key === "REUTERS") {
      setMarketFilter("ALL");
      setFeatureFilter("ALL");
      setShowReutersPipeline(true);
      return;
    }
    setShowReutersPipeline(false);
    setMarketFilter(key as MarketCode);
    setFeatureFilter("ALL");
  }

  const navigation = useMemo(() => ({
    marketFilter,
    setMarketFilter,
    featureFilter,
    setFeatureFilter,
    showReutersPipeline,
    setShowReutersPipeline,
  }), [marketFilter, featureFilter, showReutersPipeline]);

  return (
    <NavigationContext.Provider value={navigation}>
      <Layout className={styles.layout}>
        <Layout.Sider
          className={styles.sider}
          width={248}
          collapsedWidth={72}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
        >
          <div className={styles.brand}>
            <div className={styles.brandMark}>SW</div>
            {!collapsed && (
              <div className={styles.brandCopy}>
                <Typography.Text className={styles.brandTitle}>Stock Watch</Typography.Text>
                <Typography.Text className={styles.brandSubtitle}>MARKET OPERATIONS</Typography.Text>
              </div>
            )}
          </div>
          <Menu
            className={styles.menu}
            mode="inline"
            theme="dark"
            selectedKeys={[selectedKey]}
            items={items}
            onClick={handleMenuClick}
          />
          {!collapsed && (
            <div className={styles.siderFooter}>
              <span>{apiCatalog.length} 个已登记任务</span>
              <span>仅执行 Catalog API</span>
            </div>
          )}
        </Layout.Sider>
        <Layout className={styles.main}>
          <Layout.Content className={styles.content}>{children}</Layout.Content>
        </Layout>
      </Layout>
    </NavigationContext.Provider>
  );
}
