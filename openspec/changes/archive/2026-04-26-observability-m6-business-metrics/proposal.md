## Why

M1–M4 wired up the OTel signal pipeline (traces / metrics / logs) but registered zero custom metrics — every metric currently in Prometheus comes from auto-instrumentation. The capability spec already pre-declares a `Business Metrics` requirement covering match requests, email send outcomes, and database pool health, but no production code emits those instruments. M5 closed the log-quality gap; M6 closes the metric-coverage gap so on-call has actionable signal for the three highest-value flows.

## What Changes

- Add a single shared metrics module (`src/config/metrics.ts`) that registers the project meter and exports three instruments: `match_requests_total` (Counter), `email_sends_total` (Counter), `db_pool_connections` (ObservableGauge).
- Instrument the matching service to count every match request with a `status` attribute.
- Instrument the mail service to count every send attempt with a `status` attribute on both resolve and reject paths.
- Register an observable callback in the database module that reports `pg.Pool` totalCount / idleCount / waitingCount as a single gauge keyed by `state`.
- No collector / backend / Grafana provisioning changes — metrics ride the existing OTLP gRPC pipeline and 15s `PeriodicExportingMetricReader`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- observability — fulfill the previously aspirational `Business Metrics` requirement with concrete instrument names, attribute schemas, and verification scenarios.

## Impact

- Affected runtime modules: `src/Service/matching.ts`, `src/Service/mail.ts`, `src/db.ts`.
- New module: `src/config/metrics.ts`.
- Affected infra: none (collector, Prometheus, Tempo, Loki, Grafana provisioning untouched).
- No API / route / schema / dependency / user-facing changes.
- New env vars: none. Existing `OTEL_*` env vars cover all configuration.
