import type { NextApiRequest, NextApiResponse } from "next";
import { clearLogFile, getLogSnapshot, LogAnalyzeError } from "@/services/logAnalyzeService";

export const config = {
  api: {
    responseLimit: "20mb",
  },
};

function getQueryString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseLineLimit(value: string | undefined): number {
  const parsed = Number(value ?? 200);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(10000, Math.max(200, Math.floor(parsed)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "POST") {
    if (req.body?.action !== "clear" || typeof req.body?.file !== "string") {
      return res.status(400).json({ success: false, error: "action 或 file 参数无效" });
    }

    try {
      const data = await clearLogFile(req.body.file);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error instanceof LogAnalyzeError) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      console.error("[log-analyze] failed to clear PM2 log", error);
      return res.status(500).json({ success: false, error: "清空 PM2 日志失败" });
    }
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const data = await getLogSnapshot(
      getQueryString(req.query.file),
      parseLineLimit(getQueryString(req.query.lines)),
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    if (error instanceof LogAnalyzeError) {
      return res.status(error.statusCode).json({ success: false, error: error.message });
    }
    console.error("[log-analyze] failed to read PM2 logs", error);
    return res.status(500).json({ success: false, error: "读取 PM2 日志失败" });
  }
}
