"use client";

import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import { useServerInsertedHTML } from "next/navigation";
import { useState, type ReactNode } from "react";

export default function AntdStyleRegistry({ children }: { children: ReactNode }) {
  const [cache] = useState(() => createCache());

  useServerInsertedHTML(() => {
    const styles = extractStyle(cache, { plain: true, once: true });
    if (styles.includes('.data-ant-cssinjs-cache-path{content:"";}')) return null;
    return <style id="antd-cssinjs" dangerouslySetInnerHTML={{ __html: styles }} />;
  });

  return <StyleProvider cache={cache}>{children}</StyleProvider>;
}
