## Context

Grafana dashboards can be created three ways: (1) entirely by hand in the UI, (2) by importing community dashboards from grafana.com/grafana/dashboards, or (3) by writing JSON from scratch. This design uses repository-authored JSON for all four dashboards, informed by common OpenTelemetry dashboard patterns but not dependent on grafana.com availability.

All dashboards are ultimately stored as JSON under `observability/grafana/provisioning/dashboards/` and loaded via the provisioner config. The canonical authoring workflow is: build in UI → export JSON → commit to repo. The `allowUiUpdates: true` setting in `dashboards.yaml` permits UI edits to provisioned dashboards, enabling iterative refinement.

## Goals / Non-Goals

**Goals:**

- Provide an immediately useful on-call view (Application Overview) with zero PromQL knowledge required.
- Provide a business-readable trend view (Business Metrics) showing daily/weekly match volume and email delivery health.
- Enable trace and log drill-down from a single dashboard without switching to Explore.
- All dashboards version-controlled in repo and auto-provisioned on `docker compose up`.

**Non-Goals:**

- Alerting rules and notification channels — those belong in a future change.
- SLO / error budget panels — require baseline data first (run for 2+ weeks before meaningful SLOs can be defined).
- Multi-environment dashboard variants (staging vs production) — single-environment scope for now.
- Authentication / RBAC for dashboard access — deferred.

## Decisions

### Decision 1: First-party provisioned JSON

Community dashboards are useful references, but importing them into this repository would still require cleanup and manual export. The implementation will instead author focused JSON files directly with only metrics emitted by this stack: `http_server_duration_milliseconds_*`, `match_requests_total`, `email_sends_total`, and `db_pool_connections`.

### Decision 2: Grafana Variables for interactive filtering

Every dashboard will expose at minimum:
- A **time range** variable (built-in, always present via the top-right time picker)
- A **status** variable for Business Metrics (`match_requests_total` and `email_sends_total` both have a `status` label)

Variable definition for `status`:
```
Type: Query
Datasource: Prometheus
Query: label_values(match_requests_total, status)
Label: Status
Multi-value: true
Include All: true
Default: All
```

This lets an operator filter all panels to show only `error` status without editing any PromQL.

### Decision 3: Dashboard-specific panel inventory

**application-overview.json** (base: community ID `19004` + customisation)

| Panel | Visualization | Query |
|-------|--------------|-------|
| HTTP Request Rate | Time series | `sum(rate(http_server_duration_milliseconds_count[5m])) or on() vector(0)` |
| P95 Latency (ms) | Time series | `(histogram_quantile(0.95, sum by (le) (rate(http_server_duration_milliseconds_bucket[5m]))) >= 0) or on() vector(0)` |
| Error Rate % | Stat | `rate(http_server_duration_milliseconds_count{http_status_code=~"5.."}[5m]) / rate(http_server_duration_milliseconds_count[5m]) * 100` |
| DB Pool — all states | Time series | `db_pool_connections` (three lines: total/idle/waiting via `state` label) |
| DB Pool Waiting | Stat + threshold | `db_pool_connections{state="waiting"}` — red when > 0 |

**business-metrics.json** (fully custom)

| Panel | Visualization | Query |
|-------|--------------|-------|
| Match Requests | Stat | `increase(match_requests_total[$__range])` |
| Match Success Rate | Gauge (0–100%) | `sum(increase(match_requests_total{status="success"}[$__range])) / sum(increase(match_requests_total[$__range])) * 100` |
| Match Requests Trend | Time series | `sum by (status) (increase(match_requests_total[$__rate_interval])) or on() vector(0)` |
| Email Sends | Stat | `increase(email_sends_total[$__range])` |
| Email Success Rate | Gauge (0–100%) | `sum(increase(email_sends_total{status="sent"}[$__range])) / sum(increase(email_sends_total[$__range])) * 100` |
| Email Outcome Breakdown | Bar chart | `sum by (status) (increase(email_sends_total[$__rate_interval])) or on() vector(0)` |
| DB Pool Health | Time series | `db_pool_connections` |

`$__range` keeps summary stats aligned with the selected dashboard time range. `$__rate_interval` is used for sparse event counters so short zoom windows do not turn panels into misleading "No data" states.

**traces-explorer.json** (Tempo datasource, Search query type)

| Panel | Visualization | Config |
|-------|--------------|--------|
| Error Traces | Table | Datasource: Tempo, TraceQL `{ status = error }`, Limit: 20 |
| Slow Traces | Table | Datasource: Tempo, TraceQL `{ duration > 500ms }`, Limit: 20 |
| Trace Latency Distribution | Time series | Datasource: Prometheus, `histogram_quantile(0.5|0.95|0.99, rate(http_server_duration_milliseconds_bucket[5m]))` |

**logs-explorer.json** (Loki datasource)

| Panel | Visualization | Query |
|-------|--------------|-------|
| Live Log Stream | Logs | `{service_name="furfriend-finder"}` |
| Error Logs Only | Logs | `{service_name="furfriend-finder"} \| detected_level=~"error\|warn"` |
| Log Volume by Level | Time series | `sum by (detected_level) (rate({service_name="furfriend-finder"}[$__interval]))` |
| Log Rate (all) | Stat | `sum(rate({service_name="furfriend-finder"}[5m]))` |

### Decision 4: Duplicate DB pool panels instead of using Panel Library

`db_pool_connections` appears in both Application Overview and Business Metrics dashboards. The panels are duplicated in each provisioned JSON file rather than stored as Grafana Library Panels. This keeps every dashboard self-contained and ensures deleting the `grafana_data` volume does not remove shared panel definitions.

### Decision 5: Export and clean before committing

Provisioned dashboard JSON must reference the actual datasource UIDs (`prometheus`, `tempo`, `loki` as defined in `datasources.yaml`) and must not include import-time placeholders such as `__inputs`.

## Risks / Trade-offs

- Risk: Grafana dashboard JSON format changes when Grafana is upgraded. Mitigation: pin the Grafana Docker image version (`grafana/grafana:12.2.1`) rather than using `latest`.
- Risk: `$__interval` in business metrics panels may produce unexpected results at very short time ranges (< 1 minute). Mitigation: set a minimum interval of `1m` in panel options.
- Trade-off: `allowUiUpdates: true` means UI changes are not automatically written back to the JSON file — an operator could make UI edits that are lost on next `docker compose up`. Mitigation: document in the repo README that UI changes must be exported and committed; consider setting `allowUiUpdates: false` once dashboards are stable.
