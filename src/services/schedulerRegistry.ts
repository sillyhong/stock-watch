export type SchedulerTaskStatus = "RUNNING" | "STOPPED" | "EXECUTING" | "SUCCESS" | "FAILED" | "UNKNOWN";

export type SchedulerTaskState = {
  taskId: string;
  status: SchedulerTaskStatus;
  startedAt?: string;
  lastTriggeredAt?: string;
  lastFinishedAt?: string;
  lastDurationMs?: number;
  lastMessage?: string;
  lastError?: string;
  updatedAt: string;
};

type RegistryStore = Map<string, SchedulerTaskState>;

const globalWithRegistry = globalThis as typeof globalThis & {
  __stockWatchSchedulerRegistry?: RegistryStore;
};

const registry: RegistryStore = globalWithRegistry.__stockWatchSchedulerRegistry ?? new Map();
globalWithRegistry.__stockWatchSchedulerRegistry = registry;

function now() {
  return new Date().toISOString();
}

function getOrCreate(taskId: string): SchedulerTaskState {
  const existing = registry.get(taskId);
  if (existing) return existing;

  const initial: SchedulerTaskState = {
    taskId,
    status: "UNKNOWN",
    updatedAt: now(),
  };
  registry.set(taskId, initial);
  return initial;
}

export function listSchedulerStates(taskIds: string[] = []) {
  const ids = taskIds.length > 0 ? taskIds : Array.from(registry.keys());
  return ids.map((taskId) => ({ ...getOrCreate(taskId) }));
}

export function recordSchedulerAction(input: {
  taskId: string;
  action: "immediate" | "start" | "stop" | "failure";
  message?: string;
  error?: string;
  durationMs?: number;
}) {
  const state = getOrCreate(input.taskId);
  const timestamp = now();

  state.updatedAt = timestamp;
  state.lastMessage = input.message;
  state.lastError = input.error;
  state.lastDurationMs = input.durationMs;

  if (input.action === "stop") {
    state.status = "STOPPED";
    state.lastFinishedAt = timestamp;
  } else if (input.action === "failure") {
    state.status = "FAILED";
    state.lastFinishedAt = timestamp;
  } else if (input.action === "start" || input.action === "immediate") {
    state.status = "RUNNING";
    state.startedAt = state.startedAt ?? timestamp;
    state.lastTriggeredAt = timestamp;
    state.lastFinishedAt = timestamp;
  }

  registry.set(input.taskId, state);
  return { ...state };
}
