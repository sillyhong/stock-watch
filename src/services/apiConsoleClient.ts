import type { ApiTaskDefinition } from "@/config/apiCatalog";
import type { SchedulerTaskState } from "@/services/schedulerRegistry";
import { withAppBasePath } from "@/services/appPath";

export type ConsoleAction = "immediate" | "start" | "stop";

export type ApiConsoleResult = {
  ok: boolean;
  httpStatus: number;
  data: unknown;
  durationMs: number;
};

export class ApiConsoleError extends Error {
  code: "NETWORK_ERROR" | "HTTP_ERROR" | "BUSINESS_ERROR" | "TIMEOUT" | "UNKNOWN";
  httpStatus?: number;
  data?: unknown;
  durationMs?: number;

  constructor(
    message: string,
    code: ApiConsoleError["code"],
    options?: { httpStatus?: number; data?: unknown; durationMs?: number },
  ) {
    super(message);
    this.name = "ApiConsoleError";
    this.code = code;
    this.httpStatus = options?.httpStatus;
    this.data = options?.data;
    this.durationMs = options?.durationMs;
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function invokeApiTask(task: ApiTaskDefinition, action: ConsoleAction): Promise<ApiConsoleResult> {
  const url = new URL(withAppBasePath(task.endpoint), window.location.origin);
  if (action === "immediate") {
    url.searchParams.set("isImmediately", "true");
  }

  const startedAt = performance.now();
  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: action === "stop" ? "DELETE" : "GET",
      cache: "no-store",
    });
  } catch (error) {
    throw new ApiConsoleError(error instanceof Error ? error.message : "Network request failed", "NETWORK_ERROR");
  }

  const data = await parseResponse(response);
  const durationMs = Math.round(performance.now() - startedAt);

  if (!response.ok) {
    throw new ApiConsoleError(
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message?: unknown }).message)
        : `HTTP ${response.status}`,
      "HTTP_ERROR",
      { httpStatus: response.status, data, durationMs },
    );
  }

  if (typeof data === "object" && data !== null && "success" in data && (data as { success?: unknown }).success === false) {
    throw new ApiConsoleError("接口返回 success=false", "BUSINESS_ERROR", {
      httpStatus: response.status,
      data,
      durationMs,
    });
  }

  return { ok: true, httpStatus: response.status, data, durationMs };
}

export async function fetchSchedulerStatus() {
  const response = await fetch(withAppBasePath("/api/scheduler/status"), { cache: "no-store" });
  const data = (await parseResponse(response)) as {
    success?: boolean;
    data?: { tasks?: SchedulerTaskState[] };
    error?: string;
  } | null;

  if (!response.ok || !data?.success) {
    throw new ApiConsoleError(data?.error ?? `HTTP ${response.status}`, "HTTP_ERROR", {
      httpStatus: response.status,
      data,
    });
  }

  return data.data?.tasks ?? [];
}

export async function fetchSchedulerStats() {
  const response = await fetch(withAppBasePath("/api/scheduler/stats?days=7"), { cache: "no-store" });
  const data = (await parseResponse(response)) as {
    success?: boolean;
    data?: { statistics?: { summary?: Record<string, number> } };
    error?: string;
  } | null;

  if (!response.ok || !data?.success) {
    throw new ApiConsoleError(data?.error ?? `HTTP ${response.status}`, "HTTP_ERROR", {
      httpStatus: response.status,
      data,
    });
  }

  return data.data?.statistics?.summary ?? null;
}

export async function reportSchedulerAction(input: {
  taskId: string;
  action: ConsoleAction | "failure";
  message?: string;
  error?: string;
  durationMs?: number;
}) {
  try {
    await fetch(withAppBasePath("/api/scheduler/status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    // Reporting is best effort; it must not turn a successful business request into a failure.
  }
}
