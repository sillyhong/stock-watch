import type { NextApiRequest, NextApiResponse } from "next";
import { getLogSnapshot, LogAnalyzeError } from "@/services/logAnalyzeService";

export const config = {
  api: {
    responseLimit: "4mb",
  },
};

function getQueryString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseLineLimit(value: string | undefined): number {
  const parsed = Number(value ?? 200);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(1000, Math.max(1, Math.floor(parsed)));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
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
