import type { NextApiRequest, NextApiResponse } from "next";
import { apiCatalog } from "@/config/apiCatalog";
import { listSchedulerStates, recordSchedulerAction } from "@/services/schedulerRegistry";

export const dynamic = "force-dynamic";

type StatusResponse = {
  success: boolean;
  data?: {
    tasks: ReturnType<typeof listSchedulerStates>;
    serverTime: string;
  };
  error?: string;
};

export default function handler(req: NextApiRequest, res: NextApiResponse<StatusResponse>) {
  if (req.method === "GET") {
    return res.status(200).json({
      success: true,
      data: {
        tasks: listSchedulerStates(apiCatalog.map((task) => task.id)),
        serverTime: new Date().toISOString(),
      },
    });
  }

  if (req.method === "POST") {
    const { taskId, action, message, error, durationMs } = req.body ?? {};
    const validAction = ["immediate", "start", "stop", "failure"].includes(action);

    if (typeof taskId !== "string" || !validAction) {
      return res.status(400).json({ success: false, error: "taskId or action is invalid" });
    }

    if (!apiCatalog.some((task) => task.id === taskId)) {
      return res.status(404).json({ success: false, error: "Unknown task" });
    }

    const state = recordSchedulerAction({
      taskId,
      action,
      message: typeof message === "string" ? message : undefined,
      error: typeof error === "string" ? error : undefined,
      durationMs: typeof durationMs === "number" ? durationMs : undefined,
    });

    return res.status(200).json({
      success: true,
      data: {
        tasks: [state],
        serverTime: new Date().toISOString(),
      },
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
}
