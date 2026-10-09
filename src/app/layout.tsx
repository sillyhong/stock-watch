import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
