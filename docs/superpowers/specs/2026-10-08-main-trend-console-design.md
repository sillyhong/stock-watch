# Main Trend Console Expansion

## Goal

Expose the existing main-trend definitions from `src/pages/utils/mainTrendConfig.ts` in the API control console. Cover A股, 港股, 美股 across `DAY`, `MIN_60`, and `MIN_30` without duplicating strategy rules.

## Scope

- Add nine catalog entries: three markets x three main-trend intervals.
- Display these tasks as `主涨段`, not `日涨幅`.
- Add one shared API handler under `src/pages/api/day-rise` with market and interval routing.
- Keep legacy `/api/day-rise/a`, `/api/day-rise/hk`, and `/api/day-rise/us` routes callable with their existing behavior; the console uses the new nested routes.
- Read configs directly from `MainTrendConfigs`; no strategy-condition rewrite.
- Keep each market/interval cron task independent.

## API Contract

New routes:

```text
GET    /api/day-rise/{market}/{interval}
DELETE /api/day-rise/{market}/{interval}
```

`market`: `a | hk | us`.

`interval`: `day | 60m | 30m`.

`GET` starts the interval-specific cron task. `isImmediately=true` also runs one scan. `DELETE` stops only that interval-specific task. Response includes config name, market, interval, conditions, schedule, and execution data.

Legacy routes remain available without behavior changes, avoiding a breaking change for existing callers. New console entries use the explicit nested routes above.

## Catalog/UI

- Replace existing `day-rise` labels with `主涨段` labels.
- Add nine tasks with explicit market, interval, feature, purpose, endpoint, and config-derived condition descriptions.
- Keep existing card actions, stop confirmation, response drawer, and status reporting.
- Add `MAIN_TREND` feature filter option.

## Implementation Notes

- Centralize route behavior in a reusable handler/factory.
- Build a typed market/interval-to-config map from `MainTrendConfigs`.
- Keep cron handles in a `Map` keyed by `market + interval`.
- Use `fetchAMainTrend({ stockType, config })`, preserving config values exactly.
- Do not execute external market APIs during tests.

## Verification

- Catalog contains exactly nine main-trend entries.
- Every new endpoint maps to an existing config.
- Invalid market/interval returns `400`.
- Status can distinguish each of nine task IDs.
- Existing legacy route behavior remains callable.
- Browser shows all nine tasks under the main-trend filter.
- Typecheck/build results reported separately from pre-existing repository errors.
