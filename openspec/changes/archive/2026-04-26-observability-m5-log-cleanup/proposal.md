## Why

Application runtime logs still have a few paths that bypass the project Winston logger: the daily animal sync cron imports the Better Auth logger, and LINE/auth flows use raw `console.*`. Those logs will not reliably reach the OpenTelemetry log pipeline and Loki, leaving production incidents harder to diagnose.

## What Changes

- Route the daily animal sync cron logs through the project Winston logger.
- Replace app runtime `console.log` and `console.error` calls in LINE push and password reset hooks with structured logger calls.
- Keep CLI smoke-test console output unchanged because it is not production app runtime logging.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `observability`: Tighten structured log ingestion so scheduled jobs and app runtime notification/auth logs cannot bypass the structured logger.

## Impact

- Affected code: `src/libs/dataSchedule.utils.ts`, `src/libs/sendTextMsgByUserId.utils.ts`, `src/auth.ts`.
- Affected systems: Winston logs, OpenTelemetry Winston transport, Loki ingestion.
- No API, route, database schema, dependency, or user-facing behavior changes.
