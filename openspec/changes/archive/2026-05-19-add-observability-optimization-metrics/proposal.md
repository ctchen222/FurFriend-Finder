## Why

The current observability stack can show HTTP health, traces, logs, baseline business counters, and DB pool state, but it does not yet explain why the product is slow, why matching quality drops, whether third-party dependencies are the bottleneck, or whether the VPS/runtime is approaching capacity.

This change adds optimization-focused metrics and provisioned Grafana views so developers can see the full matching, geocoding, database, email, sync, and runtime picture without writing ad hoc PromQL during every investigation.

This change is intentionally separate from `grafana-dashboard-provisioning`. The earlier M7 change owns the dashboard provisioning mechanism and baseline dashboards. This change depends on that mechanism and extends it with new product, dependency, data freshness, runtime, and SLO-readiness views after the underlying metrics exist.

## What Changes

- Add P0 matching metrics for the core product path:
  - `match_duration_milliseconds` histogram for end-to-end matching latency.
  - `match_candidates_total` histogram for candidate volume before truncation.
  - `match_results_total` histogram for returned result count.
  - `match_truncated_total` counter for `GEOCODING_BATCH_LIMIT` truncation events.
  - `match_no_result_total` counter for successful match requests that return zero results.
- Add P0 geocoding dependency metrics:
  - `geocoding_requests_total{status}` counter using low-cardinality status values such as `ok`, `zero_results`, `over_query_limit`, `request_denied`, and `error`.
  - `geocoding_duration_milliseconds` histogram.
  - `geocoding_unique_shelter_addresses_total` histogram for deduped shelter-address workload size.
  - `geocoding_failed_shelter_total` counter for shelter geocoding failures during matching.
- Add P1 database metrics:
  - `db_query_duration_milliseconds{operation}` histogram for key repository operations.
  - `db_query_errors_total{operation}` counter.
  - Derived dashboard panels for DB pool waiting and saturation.
- Add P1 email metrics:
  - `email_send_duration_milliseconds{template}` histogram.
  - Extend email counters to include a low-cardinality `template` label such as `verification`, `reset_password`, `match_notice`, or `generic`.
  - Add `email_failures_total{template,reason}` with low-cardinality reasons only.
- Add P1 data sync / cron metrics:
  - `animal_sync_runs_total{status}` counter.
  - `animal_sync_duration_milliseconds` histogram.
  - `animal_sync_updated_rows_total{table}` histogram or counter.
  - `animal_sync_last_success_timestamp` observable gauge.
  - `animal_sync_api_failures_total{source}` counter.
- Add P2 runtime and VPS-readiness metrics:
  - Node process memory, heap, CPU, event-loop delay, and GC metrics when supported by the OTel runtime instrumentation.
  - Dashboard panels for container/runtime health using existing Prometheus scrape targets where available.
  - Dashboard panels for observability service health (`up`, scrape status, and collector export health) where available.
- Extend Grafana provisioning so the new metrics are visible immediately after stack startup:
  - Add provisioned optimization dashboards for product matching, dependency health, data freshness, runtime/VPS readiness, and SLO-readiness.
  - Keep related information grouped together across multiple dashboards instead of overloading the existing baseline dashboards.
  - Update existing `business-metrics.json` only where needed to surface the extended labels clearly.
  - Keep all dashboard JSON under `observability/grafana/provisioning/dashboards/` and use stable datasource UIDs (`prometheus`, `loki`, `tempo`).
- Add SLO-readiness metrics and panels for:
  - HTTP availability over the selected dashboard range, with a 99% SLO target.
  - Quick-match P95 latency, with a 5-second target.
  - Error-budget-style context for dashboard inspection only.
- Add tests for metric registration and key instrumentation paths.

Non-goals:

- Do not change matching ranking, filtering, geocoding behavior, email preference behavior, or data-sync business semantics.
- Do not add raw address, coordinates, email, user ID, animal ID, or free-form error messages as metric labels.
- Do not add alert rules, notification policies, receivers, webhooks, SMTP settings, Slack/LINE/PagerDuty integrations, or alert secrets; those belong to `add-observability-alert-rules`.
- Do not solve long-term telemetry storage, retention, off-host backup, or k3s deployment in this change; those remain part of production hardening / k3s observability work.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `observability`: Add optimization metrics for matching, geocoding, database operations, email delivery, data sync, runtime health, and provisioned Grafana dashboard presentation.

## Impact

- Affected services:
  - `src/Service/matching.ts` for matching duration, candidate/result counts, truncation, no-result, and geocoding workload metrics.
  - `src/Service/geo.ts` for geocoding request and duration metrics.
  - `src/Service/mail.ts` and `src/auth.ts` for email duration, template label, and failure classification.
  - `src/Service/animalSync.ts` and `src/libs/dataSchedule.utils.ts` for cron/data-sync metrics.
- Affected repositories:
  - `src/repository/animalLost.db.ts`, `src/repository/animal.db.ts`, `src/repository/owner.db.ts`, and any other repository selected for DB operation metrics.
- Affected observability config:
  - `src/config/metrics.ts` for metric definitions and shared helpers.
  - `src/instrumentation.ts` if Node runtime metrics require OTel instrumentation configuration.
  - `observability/grafana/provisioning/dashboards/` for the new and updated dashboard JSON files.
  - `grafana-dashboard-provisioning` remains the source of the provisioning mechanism; this change only adds or updates provisioned dashboard content.
- Affected routes/workflows:
  - `POST /api/lost-animals/quick-match`
  - `GET /api/lost-animals/match/:id`
  - email verification, password reset, and match-notification email paths.
  - scheduled animal data sync.
- Affected tests:
  - Unit tests for metrics registration.
  - Unit tests for matching, geocoding, mail, and sync instrumentation.
  - Dashboard JSON validation and PromQL smoke checks.
- No new external infrastructure dependency is required.
