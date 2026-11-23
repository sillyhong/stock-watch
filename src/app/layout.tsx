import type { Metadata } from "next";
import { App as AntApp, ConfigProvider, theme } from "antd";
import "./globals.css";
import AntdStyleRegistry from "./AntdStyleRegistry";
import PlatformShell from "./PlatformShell";

export const metadata: Metadata = {
  title: "Stock Watch API Control Center",
  description: "Ant Design control console for stock-market scheduled APIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdStyleRegistry>
          <ConfigProvider
            theme={{
              algorithm: theme.darkAlgorithm,
              token: {
                colorPrimary: "#13c2c2",
                colorBgBase: "#07111f",
                colorBgLayout: "#07111f",
                colorBgContainer: "#0c1c30",
                colorBgElevated: "#10263b",
                colorText: "#d7e3f4",
                colorTextHeading: "#f2f7ff",
                colorTextSecondary: "#a9bdd2",
                colorBorder: "#24405d",
                colorSuccess: "#62dca5",
                colorSuccessBg: "#112b21",
                colorSuccessBgHover: "#173829",
                colorSuccessBorder: "#286b4b",
                colorWarning: "#ffd166",
                colorWarningBg: "#302711",
                colorWarningBgHover: "#3a3017",
                colorWarningBorder: "#806528",
                colorError: "#ff8585",
                colorErrorBg: "#301b21",
                colorErrorBgHover: "#3e222a",
                colorErrorBorder: "#7a3946",
                colorInfo: "#65d8ff",
                colorInfoBg: "#102a3b",
                colorInfoBgHover: "#15384c",
                colorInfoBorder: "#28627c",
                colorIcon: "#9ab0c7",
                colorIconHover: "#eaf4ff",
                borderRadius: 8,
              },
              components: {
                Message: {
                  contentBg: "#10263b",
                  contentPadding: "10px 16px",
                },
              },
            }}
          >
            <AntApp>
              <PlatformShell>{children}</PlatformShell>
            </AntApp>
          </ConfigProvider>
        </AntdStyleRegistry>
      </body>
    </html>
  );
}
