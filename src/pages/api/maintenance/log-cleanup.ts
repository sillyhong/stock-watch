import type { NextApiRequest, NextApiResponse } from "next";
import {
  getLogCleanupState,
  LOG_CLEANUP_CRON,
  LOG_CLEANUP_RETENTION_DAYS,
  LOG_CLEANUP_TIMEZONE,
  runLogCleanup,
} from "@/services/logCleanupService";

export const dynamic = "force-dynamic";

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      schedule: LOG_CLEANUP_CRON,
      timezone: LOG_CLEANUP_TIMEZONE,
      retentionDays: LOG_CLEANUP_RETENTION_DAYS,
      state: getLogCleanupState(),
    });
  }

  if (req.method === "POST") {
    try {
      const summary = await runLogCleanup({ dryRun: parseBoolean(req.query.dryRun) || parseBoolean(req.body?.dryRun) });
      return res.status(200).json({ success: true, summary });
    } catch (error) {
      return res.status(409).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
