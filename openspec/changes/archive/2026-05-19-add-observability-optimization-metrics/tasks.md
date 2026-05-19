## 1. Metric Definitions And Safety

- [x] 1.1 Add optimization metric definitions and shared helpers in `src/config/metrics.ts` using the existing `furfriend-finder` meter.
- [x] 1.2 Define bounded label vocabularies for `status`, `operation`, `template`, `reason`, `source`, `table`, `boundary`, and `city_county`.
- [x] 1.3 Add tests that verify all new metric instruments are registered without creating a new exporter, reader, or meter.
- [x] 1.4 Add tests or helper assertions that prevent raw address, coordinate, email, user ID, animal ID, SQL text, URL, or exception-message labels.

## 2. Matching And County Inventory Metrics

- [x] 2.1 Instrument `src/Service/matching.ts` to record `match_duration_milliseconds{boundary="perform_match"}` for pure `performMatch()` latency.
- [x] 2.2 Instrument the full `GET /api/lost-animals/match/:id` service flow to record `match_duration_milliseconds{boundary="match_flow"}`.
- [x] 2.3 Record match candidate count, result count, truncation count, and no-result count without changing matching output.
- [x] 2.4 Add shelter-animal inventory by normalized Taiwan city/county.
- [x] 2.5 Add lost-animal inventory by normalized Taiwan city/county.
- [x] 2.6 Add or update matching tests for duration, candidate/result, truncation, no-result, and unchanged business behavior.

## 3. Geocoding Dependency Metrics

- [x] 3.1 Classify geocoding outcomes in `src/Service/geo.ts` as bounded statuses such as `ok`, `zero_results`, `over_query_limit`, `request_denied`, and `error`.
- [x] 3.2 Record `geocoding_requests_total{status}` and `geocoding_duration_milliseconds{status}` for every geocoding API call.
- [x] 3.3 Record `geocoding_unique_shelter_addresses_total` for the deduplicated shelter-address workload in matching.
- [x] 3.4 Increment `geocoding_failed_shelter_total` for shelter-address geocoding failures during matching.
- [x] 3.5 Add geocoding tests for status classification, duration recording, and no raw address labels.

## 4. Core Database Operation Metrics

- [x] 4.1 Define the curated DB operation list for product-critical repository calls.
- [x] 4.2 Instrument selected repository operations with `db_query_duration_milliseconds{operation}`.
- [x] 4.3 Instrument selected repository operation failures with `db_query_errors_total{operation}`.
- [x] 4.4 Add repository tests that verify operation labels are bounded and raw SQL/error messages are not labels.
- [x] 4.5 Confirm existing DB pool gauge behavior still works after adding repository operation metrics.

## 5. Email Delivery Metrics

- [x] 5.1 Extend mail sending paths to pass a bounded `template` value such as `verification`, `reset_password`, `match_notice`, or `generic`.
- [x] 5.2 Record `email_send_duration_milliseconds{template}` for sent and failed email attempts.
- [x] 5.3 Preserve `email_sends_total{status}` behavior while adding the `template` label.
- [x] 5.4 Add `email_failures_total{template,reason}` with bounded failure reasons such as `smtp_rejected`, `auth`, `timeout`, `network`, `template`, and `unknown`.
- [x] 5.5 Update mail and auth tests for template labels, failure classification, and existing sent/failed counter behavior.

## 6. Animal Data Sync Metrics

- [x] 6.1 Instrument scheduled and manual animal data sync runs with `animal_sync_runs_total{status}`.
- [x] 6.2 Record `animal_sync_duration_milliseconds` for shelter-animal and lost-animal sync work.
- [x] 6.3 Record `animal_sync_updated_rows_total{table}` for rows updated by each synced dataset.
- [x] 6.4 Expose `animal_sync_last_success_timestamp` after successful sync completion.
- [x] 6.5 Record `animal_sync_api_failures_total{source}` for public-data API failures.
- [x] 6.6 Add sync tests for success, failure, update-count, and last-success behavior.

## 7. Runtime And VPS Readiness Metrics

- [x] 7.1 Confirm which Node runtime metric names are emitted by the current OpenTelemetry runtime instrumentation.
- [x] 7.2 Add runtime dashboard queries for process memory, heap, CPU, event-loop, and GC metrics that tolerate missing series.
- [x] 7.3 Decide whether Docker Compose should add node-exporter/cAdvisor now or leave host/container scrape targets to `deploy-k3s-observability-stack`.
- [x] 7.4 Add service scrape-health panels using available `up` or equivalent Prometheus target-health metrics.
- [x] 7.5 Document any runtime/VPS panels that require later k3s scrape targets.

## 8. Provisioned Grafana Dashboards

- [x] 8.1 Add `product-optimization.json` with matching latency, candidate/result counts, no-result, truncation, and county inventory panels.
- [x] 8.2 Add `dependency-health.json` with geocoding, DB operation latency/errors, DB pool saturation, and email delivery panels.
- [x] 8.3 Add `data-freshness.json` with sync run, duration, update-count, API-failure, and last-success panels.
- [x] 8.4 Add `runtime-vps.json` with runtime metrics, scrape health, and observability target-health panels.
- [x] 8.5 Add `slo-readiness.json` with HTTP availability target 99% and quick-match P95 target 5 seconds.
- [x] 8.6 Update `business-metrics.json` only where the new `template` or related labels improve the existing business panels.
- [x] 8.7 Ensure all dashboard JSON files use datasource UIDs `prometheus`, `loki`, and `tempo`, and do not introduce another provisioning mechanism.

## 9. Local Verification

- [x] 9.1 Run dashboard JSON validation with `jq empty` for all provisioned dashboards.
- [x] 9.2 Run `openspec validate add-observability-optimization-metrics --strict`.
- [x] 9.3 Run targeted unit tests for metrics, matching, geocoding, DB, mail, and sync instrumentation.
- [x] 9.4 Run `pnpm exec tsc --noEmit`.
- [x] 9.5 Run `docker compose config --quiet`.
- [x] 9.6 Restart Grafana and confirm the new dashboards are provisioned without manual import.
- [x] 9.7 Generate sample app traffic and confirm Prometheus queries for the new metrics return data.

## 10. k3s Compatibility Check

- [x] 10.1 Confirm the new dashboard files remain packageable by `deploy-k3s-observability-stack` without changing datasource UIDs.
- [x] 10.2 Confirm no dashboard query depends on Docker Compose service names.
- [x] 10.3 Confirm runtime/VPS panels either work in Docker Compose or clearly map to future k3s scrape targets.
- [x] 10.4 Confirm this change does not add telemetry retention, off-host backup, alert receivers, or real secrets.
