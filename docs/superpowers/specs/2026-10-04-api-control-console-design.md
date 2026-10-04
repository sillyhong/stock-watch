# API Control Console Design

Status: Approved design
Date: 2026-10-04

## 1. Context

The project contains many Next.js Pages API routes used to start, stop, or manually trigger stock-market timer jobs. The current workflow requires entering API URLs manually, which makes testing slow and hides the purpose of each endpoint.

The project already uses Next.js 15, React 19, TypeScript, Ant Design 5, `node-cron`, and a scheduler logging service. Existing business APIs must keep their current paths and behavior.

## 2. Scope

### Goals

- Provide one Ant Design web console for API execution and timer control.
- Group tasks by market, interval, and function.
- Explain each task purpose, schedule, endpoint, and side effects.
- Separate immediate execution, timer start, and timer stop.
- Show active timer state, execution feedback, errors, and historical summary.
- Keep deployment compatible with the existing Next.js server.

### Non-goals for V1

- Arbitrary URL debugging.
- User-editable cron expressions.
- Multi-instance distributed scheduling.
- A complete historical log management page.
- A new permission system.

## 3. Approved Visual Direction

Use layout option A with Ant Design default light theme and limited project-color customization.

- `Layout.Sider` + `Menu`: market, interval, and function navigation.
- `Layout.Header`: page title, current filters, service state, refresh action.
- `Card`: one task per card with purpose and actions.
- `Tag`/`Badge`: task and service state.
- `Descriptions`: endpoint, method, schedule, timezone, and purpose.
- `Drawer`: task details, parameters, and raw response.
- `Modal`/`Popconfirm`: stop-timer confirmation and destructive-action confirmation.
- `Alert`/`Result`/`Spin`: feedback states.
- `Table`: optional dense task view inside the same page.
- `ConfigProvider`: Ant Design default tokens plus a small project accent override.

## 4. Architecture

```text
src/app/page.tsx
  -> ApiConsolePage
      -> ApiCatalog
      -> TaskFilters
      -> TaskCardList
      -> TaskDetailDrawer
      -> ApiResponsePanel

apiCatalog -> apiConsoleClient -> existing API routes
                         -> /api/scheduler/status
                         -> /api/scheduler/stats

existing timer routes -> schedulerRegistry -> node-cron handles
                                      -> SchedulerLog/database
```

The UI is catalog-driven. It does not duplicate endpoint-specific rendering logic. Existing API routes remain the source of business execution; the catalog is the source of UI metadata and supported actions.

Recommended files:

- `src/config/apiCatalog.ts`: task definitions and display metadata.
- `src/services/apiConsoleClient.ts`: typed same-origin request helpers.
- `src/services/schedulerRegistry.ts`: active timer registry and status model.
- `src/pages/api/scheduler/status.ts`: active status endpoint.
- `src/components/api-console/`: Ant Design page components.
- `src/app/page.tsx`: page composition and initial data loading.

## 5. API Catalog Model

Each task definition contains:

```ts
type ApiParam = {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  defaultValue?: string | number | boolean;
  description?: string;
};

type ApiTaskDefinition = {
  id: string;
  title: string;
  market: 'A' | 'HK' | 'US' | 'BJS' | 'ALL';
  interval: 'DAY' | '5M' | '15M' | '30M' | '60M' | 'BACKTREND';
  feature: 'RSI' | 'MACD' | 'BOLL' | 'MA' | 'RISE' | 'REUTERS';
  purpose: string;
  endpoint: string;
  schedule?: {
    label: string;
    cron: string;
    timezone: string;
  };
  capabilities: {
    immediate: boolean;
    start: boolean;
    stop: boolean;
    status: boolean;
  };
  params?: ApiParam[];
};
```

Initial catalog groups include A-share, Hong Kong, US, and Northbound/other supported markets; daily, 5-minute, 15-minute, 30-minute, 60-minute, and backtrend intervals; RSI, MACD, BOLL, MA, rise, Reuters, and existing related jobs.

The catalog stores literal existing paths, including any legacy path that requires URL encoding. Path cleanup is outside V1.

## 6. Action Semantics and Data Flow

Initial load runs catalog loading and status/statistics requests in parallel. The page defaults to all markets and all intervals.

Actions are explicit:

```text
immediate -> existing GET with isImmediately=true where supported
start     -> existing GET
stop      -> existing DELETE
status    -> /api/scheduler/status
history   -> /api/scheduler/stats
```

The UI must never infer that every GET is a read-only query. Unsupported actions are disabled and explained in the task detail.

Task actions have per-task loading state. Duplicate clicks are blocked while the same action is pending. Successful start/stop actions refresh the current task status. Immediate execution displays status, duration, response summary, and collapsible raw JSON.

Status refresh occurs on initial load, manual refresh, and a 30-second interval. Polling pauses while the page is hidden and resumes with an immediate refresh when visible again.

## 7. Scheduler State

```ts
type TaskStatus =
  | 'RUNNING'
  | 'STOPPED'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED'
  | 'UNKNOWN';
```

The registry exposes task ID, status, start time, last trigger, last finish, duration, message, error, cron expression, and timezone.

- Active state comes from the in-process registry.
- Success/failure history comes from execution results and `SchedulerLog` when database storage is enabled.
- After a process restart, unrecovered timers show `UNKNOWN`; the UI must not claim they are running.
- Existing routes are migrated incrementally to register their timer handles.

`/api/scheduler/stats` remains responsible for historical statistics and retryable-task information. `/api/scheduler/status` is responsible for active timer state.

## 8. Error and Safety Handling

Normalize client errors into:

```text
NETWORK_ERROR
HTTP_ERROR
BUSINESS_ERROR
TIMEOUT
UNKNOWN
```

Rules:

- Show errors with HTTP status, server message, duration, and raw response when available.
- Keep independent task loading states.
- Require confirmation before stopping a timer.
- Mark notification, database-write, and other side-effect actions in the catalog.
- Do not accept arbitrary URLs from the browser.
- Do not expose database credentials, mail credentials, or external API tokens to the client.
- Production deployment must be behind internal access or reverse-proxy authentication; public exposure requires authentication before implementation is considered complete.
- A client timeout must not be presented as proof that server execution stopped. Continue status polling.

## 9. Deployment

V1 uses the existing server deployment model:

```text
next build
next start -p 3008
```

The application should run as one long-lived Node process because `node-cron` stores timer handles in process memory. Serverless or multi-replica deployment is not supported for reliable timer control in V1. External scheduling and distributed locking are future work.

The UI and API use same-origin requests by default. No client-side API secret or cross-origin configuration is required.

## 10. Testing and Acceptance

### Tests

- Validate catalog fields, categories, capabilities, and paths.
- Test client mapping for immediate, start, stop, status, and history actions.
- Test filters and search combinations.
- Test registry transitions: start, stop, duplicate start, and restart-to-unknown.
- Test loading, success, failure, unknown, modal, drawer, and raw JSON states.
- Test desktop and narrow-screen layouts.
- Run `npm run build` and start the production server for same-origin smoke checks.

### Acceptance criteria

1. User can execute existing APIs without typing URLs.
2. Every task clearly shows market, interval, function, and purpose.
3. Immediate execution, timer start, and timer stop are visibly distinct.
4. Timer state refreshes automatically and manually.
5. Repeated clicks cannot create duplicate timer requests.
6. API failures show actionable error details.
7. `npm run build` succeeds.
8. `next start` serves page and APIs from the same origin.
9. Existing API behavior remains unchanged.
10. Existing user worktree changes are preserved.
