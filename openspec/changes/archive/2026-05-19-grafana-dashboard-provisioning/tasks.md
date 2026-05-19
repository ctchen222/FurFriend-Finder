## 1. OpenSpec Artifacts

- [x] 1.1 Create the M7 proposal for Grafana dashboard provisioning.
- [x] 1.2 Author the design document covering mixed community/custom approach, variable definitions, and full panel inventory with PromQL for all four dashboards.
- [x] 1.3 Author the observability delta spec adding the Provisioned Dashboards requirement.
- [x] 1.4 Run `openspec validate grafana-dashboard-provisioning` and resolve any schema errors.

## 2. Provisioning Infrastructure

- [x] 2.1 Create `observability/grafana/provisioning/dashboards/dashboards.yaml` with `allowUiUpdates: true` and 30s scan interval.
- [x] 2.2 Verify that `docker-compose.yml` mounts `./observability/grafana/provisioning` into the Grafana container (already done in M1–M4 — confirm no change needed).
- [x] 2.3 Pin the Grafana Docker image version in `docker-compose.yml` (change `grafana/grafana:latest` to a specific version, e.g. `grafana/grafana:11.6.0`) to prevent breaking changes on image updates.

## 3. Dashboard 1 — Application Overview

- [x] 3.1 Create `application-overview.json` directly as provisioned JSON using the Prometheus datasource UID.
- [x] 3.2 Include only panels backed by metrics emitted by this stack.
- [x] 3.3 Add a DB Pool panel: Time series, query `db_pool_connections`, split by `state` label, add threshold: `waiting > 0` → orange, `waiting > 2` → red.
- [x] 3.4 Add a DB Pool Waiting stat panel with colour thresholds (green = 0, red ≥ 1).
- [x] 3.5 Save as `observability/grafana/provisioning/dashboards/application-overview.json` without `__inputs` / `__requires` placeholders.

## 4. Dashboard 2 — Business Metrics (Custom)

- [x] 4.1 Create `business-metrics.json`; add a `status` variable (Type: Query, Datasource: Prometheus, Query: `label_values(match_requests_total, status)`, Multi-value: true, Include All: true).
- [x] 4.2 Add "Match Requests" Stat panel: `increase(match_requests_total[$__range])`.
- [x] 4.3 Add "Match Success Rate" Gauge panel (0–100%, green ≥ 95%, yellow ≥ 80%, red < 80%): `sum(increase(match_requests_total{status="success"}[$__range])) / sum(increase(match_requests_total[$__range])) * 100`.
- [x] 4.4 Add "Match Requests Trend" Time series panel split by status: `sum by (status) (increase(match_requests_total[$__rate_interval])) or on() vector(0)`.
- [x] 4.5 Add "Email Sends" Stat panel: `increase(email_sends_total[$__range])`.
- [x] 4.6 Add "Email Success Rate" Gauge panel (same thresholds as 4.3): `sum(increase(email_sends_total{status="sent"}[$__range])) / sum(increase(email_sends_total[$__range])) * 100`.
- [x] 4.7 Add "Email Outcome Breakdown" Bar chart split by status: `sum by (status) (increase(email_sends_total[$__rate_interval])) or on() vector(0)`.
- [x] 4.8 Add DB Pool Time series panel directly in the provisioned dashboard JSON.
- [x] 4.9 Export and save as `observability/grafana/provisioning/dashboards/business-metrics.json`.

## 5. Dashboard 3 — Traces Explorer

- [x] 5.1 Create `traces-explorer.json` with Tempo datasource panels.
- [x] 5.2 Add "Error Traces" Table panel: Datasource Tempo, TraceQL `{ status = error }`, Limit 20.
- [x] 5.3 Add "Slow Traces" Table panel: Datasource Tempo, TraceQL `{ duration > 500ms }`, Limit 20.
- [x] 5.4 Add "Latency Percentiles" Time series panel (Prometheus): three queries for p50/p95/p99 using `histogram_quantile` over `http_server_duration_milliseconds_bucket`.
- [x] 5.5 Export and save as `observability/grafana/provisioning/dashboards/traces-explorer.json`.

## 6. Dashboard 4 — Logs Explorer

- [x] 6.1 Create `logs-explorer.json` with Loki datasource panels.
- [x] 6.2 Add "Live Log Stream" Logs panel: `{service_name="furfriend-finder"}`, enable "Wrap lines", set "Deduplication" to none.
- [x] 6.3 Add "Error and Warn Logs" Logs panel: `{service_name="furfriend-finder"} | detected_level=~"error|warn"`.
- [x] 6.4 Add "Log Volume by Level" Time series panel: `sum by (detected_level) (rate({service_name="furfriend-finder"}[$__interval]))`.
- [x] 6.5 Add "Log Rate" Stat panel: `sum(rate({service_name="furfriend-finder"}[5m]))`.
- [x] 6.6 Export and save as `observability/grafana/provisioning/dashboards/logs-explorer.json`.

## 7. Provisioning Durability

- [x] 7.1 Confirm dashboard JSON files do not reference Grafana Library Panels or import placeholders.
- [x] 7.2 Confirm all datasource references use stable UIDs (`prometheus`, `tempo`, `loki`).
- [x] 7.3 Confirm all four dashboard JSON files are stored under `observability/grafana/provisioning/dashboards/`.

## 8. Verification

- [x] 8.1 Run `docker compose restart grafana` (or wait 30 seconds after dropping JSON files) and confirm all four dashboards appear in Grafana → Dashboards.
- [x] 8.2 Confirm no panel shows "No data" in the default last-15-minutes time range after triggering at least one match request and one email send.
- [x] 8.3 Confirm the Business Metrics `status` variable dropdown works: selecting "error" filters Match Requests Trend to show only the error series.
- [x] 8.4 Confirm Traces Explorer table links to Tempo trace detail on row click.
- [x] 8.5 Confirm Logs Explorer error filter returns only log lines with level=error or level=warn.
- [x] 8.6 Delete and recreate the `grafana_data` Docker volume, run `docker compose up -d`, and confirm all four dashboards re-appear automatically (proving provisioning is working, not relying on persisted volume state).
