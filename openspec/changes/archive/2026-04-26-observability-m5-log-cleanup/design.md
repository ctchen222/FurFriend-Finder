## Context

M4 added the OpenTelemetry/Winston/Loki path, but three app runtime paths still bypass that path: the cron schedule imports `logger` from `better-auth`, LINE push delivery logs with `console.*`, and the Better Auth password reset hook logs with `console.log`. M5 is a cleanup step to make existing observability guarantees true without changing product behavior.

## Goals / Non-Goals

**Goals:**

- Ensure daily cron logs, LINE push logs, and password reset hook logs use the project Winston logger.
- Preserve existing side effects and control flow.
- Keep logs structured so the existing OpenTelemetry Winston transport can forward them to Loki.

**Non-Goals:**

- Do not redesign logger formatting, trace field names, or Grafana datasource configuration.
- Do not remove console output from standalone CLI scripts such as SMTP smoke tests.
- Do not add new metrics, spans, alerts, routes, or database schema.

## Decisions

- Use `src/config/logger.ts` as the single app runtime logging entrypoint. This matches existing middleware/logger usage and keeps logs attached to the configured Winston transports.
- Replace raw console calls with concise event names and metadata. Avoid logging email addresses or message bodies; log operational outcomes and error objects only.
- Keep the cron schedule behavior unchanged. Only the logger import changes so startup, success, and failure logs enter the same pipeline as HTTP logs.

## Risks / Trade-offs

- Error objects may serialize differently between Console and OpenTelemetry transports. Mitigation: keep error metadata structured and rely on Winston transport handling rather than stringifying manually in new log calls.
- Password reset logs become less personally identifying by omitting email. Mitigation: include `userId` when available for operational correlation without exposing email addresses.
