## Context

The repository already has the M1-M6 observability baseline: health checks, OpenTelemetry traces and metrics, structured logs, trace/log correlation, business counters, DB pool gauges, and Grafana datasource provisioning. The active `grafana-dashboard-provisioning` change adds the file-based dashboard provisioning mechanism and four baseline dashboards.

This change is the next layer. It does not redefine how Grafana provisioning works. It adds the missing optimization metrics and uses the existing provisioning path to present them clearly:

- Product behavior: matching latency, candidate volume, result count, no-result rate, truncation, and county inventory.
- Dependency health: geocoding, database operations, and email delivery.
- Data freshness: public-data sync success, duration, updated rows, and last success time.
- Runtime/VPS readiness: Node runtime metrics and service scrape health where available.
- SLO-readiness: dashboard-only SLI views for availability and quick-match latency.

The later `deploy-k3s-observability-stack` change should be able to package these same dashboards and metrics without changing their datasource UIDs or query semantics.

## Goals / Non-Goals

**Goals:**

- Add low-cardinality metrics that explain why matching is slow, empty, truncated, or dependency-bound.
- Track both matching boundaries:
  - pure matching work inside `performMatch()`.
  - full `GET /api/lost-animals/match/:id` flow including lost animal lookup, owner lookup, matching, and optional email.
- Track shelter-animal and lost-animal inventory by normalized Taiwan city/county without exposing addresses or coordinates.
- Track core repository operations only, not every SQL query.
- Track email outcomes by template and classified failure reason.
- Track public-data sync freshness and update volume.
- Expose the new data through provisioned Grafana dashboards stored in the repo.
- Keep dashboard content compatible with the later k3s observability chart by preserving datasource UIDs (`prometheus`, `loki`, `tempo`) and avoiding Docker-only assumptions in dashboard queries.
- Define dashboard-visible SLO readiness for:
  - HTTP availability target: 99%.
  - quick-match P95 latency target: 5 seconds.

**Non-Goals:**

- Do not merge this change into `grafana-dashboard-provisioning`.
- Do not change matching ranking, filtering, geocoding, email preference, or sync business semantics.
- Do not add alert rules, notification policies, receivers, or real alerting secrets.
- Do not solve telemetry retention, off-host backup, object storage, or k3s deployment.
- Do not add raw address, coordinate, email, user ID, animal ID, SQL text, or free-form error-message labels.

## Decisions

### Decision 1: Keep dashboard provisioning and optimization metrics as separate changes

`grafana-dashboard-provisioning` owns the mechanism: Grafana reads repo-authored JSON from `observability/grafana/provisioning/dashboards/` using stable datasource UIDs. This change consumes that mechanism by adding new dashboards and updating existing dashboard content only where the new metric labels require it.

Alternative considered: merge the optimization metrics into M7. Rejected because M7 is mostly complete and should remain a dashboard-provisioning milestone, while this change touches application services, repositories, metrics definitions, tests, and dashboard content.

### Decision 2: Use explicit metric families with low-cardinality labels

Metrics will live in `src/config/metrics.ts` and use the existing `furfriend-finder` meter. Shared helpers can wrap duration recording and error classification, but labels must stay bounded:

- Allowed labels: `status`, `operation`, `template`, `reason`, `source`, `table`, `boundary`, `city_county`.
- Disallowed labels: address, coordinates, email, user ID, owner ID, animal ID, raw SQL, raw external API URL, exception message.

This keeps Prometheus storage growth predictable and makes the later k3s stack safer on a small VPS.

### Decision 3: Instrument matching at two boundaries

The pure `performMatch()` metric explains matching algorithm behavior: candidate count, deduped shelter-address workload, truncation, distance filtering, returned result count, and no-result outcomes.

The full match-flow metric explains the user-visible workflow behind `GET /api/lost-animals/match/:id`: lost-animal lookup, owner lookup, matching, and optional match-notification email. Both boundaries are needed because a slow user request may be caused by DB lookup or email delivery even when pure matching is healthy.

### Decision 4: Treat geocoding as an external dependency with classified status

`src/Service/geo.ts` will classify Google Geocoding outcomes into bounded statuses such as `ok`, `zero_results`, `over_query_limit`, `request_denied`, and `error`. Duration and request counts will be recorded for each call, while matching-specific shelter geocoding failures will be counted separately so operators can distinguish lost-place failures from shelter-address failures.

### Decision 5: Track only core DB operations

Repository instrumentation will focus on product-critical operations: finding match candidates, loading shelter animals, loading lost animals, loading owners, bulk inserting shelter animals, and bulk inserting lost animals. The operation label will be a curated enum rather than a function name generated dynamically from arbitrary call sites.

### Decision 6: Extend email metrics without breaking current counters

`email_sends_total` already exists with a `status` label. This change extends it with a low-cardinality `template` label while preserving `sent` and `failed` status values. Additional failure metrics will use classified reasons such as `smtp_rejected`, `auth`, `timeout`, `network`, `template`, and `unknown`.

### Decision 7: Dashboard split follows operator questions

The dashboard inventory will be plural:

- `product-optimization.json`: matching latency, candidates, results, no-result, truncation, and county inventory.
- `dependency-health.json`: geocoding, DB operation latency/errors, DB pool saturation, and email delivery.
- `data-freshness.json`: public-data sync runs, duration, update volume, API failures, and last success time.
- `runtime-vps.json`: Node runtime metrics, service scrape status, and observability target health where available.
- `slo-readiness.json`: availability and quick-match latency SLI panels, targets, and error-budget-style context without alert state.

The existing `business-metrics.json` can be updated only if the new labels make the current business panels more useful.

### Decision 8: k3s compatibility is a dashboard and scrape contract, not a Helm implementation here

This change keeps dashboards portable by using datasource UIDs and metric names, not Docker Compose service URLs. Runtime/VPS panels may show partial data locally until node/container scrape targets exist. The later `deploy-k3s-observability-stack` change can map those panels to node-exporter, kubelet/cAdvisor, kube-state-metrics, or equivalent Prometheus scrape targets.

### Decision 9: Keep host/container scrape targets out of Docker Compose for this change

The currently installed runtime instrumentation is `@opentelemetry/instrumentation-runtime-node`, which emits Node/V8 runtime metric names such as `nodejs.eventloop.utilization`, `nodejs.eventloop.delay.p99`, `nodejs.eventloop.time`, `v8js.gc.duration`, `v8js.memory.heap.used`, `v8js.memory.heap.limit`, and heap-space gauges. Prometheus receives these through the existing OTLP collector path and exposes them with Prometheus-safe names including unit suffixes, such as `nodejs_eventloop_utilization_ratio`, `nodejs_eventloop_delay_p99_seconds`, `v8js_gc_duration_seconds_bucket`, and `v8js_memory_heap_used_bytes`.

Docker Compose will not add node-exporter or cAdvisor in this change. Runtime dashboards will show Node/V8 metrics when present, generic Prometheus scrape health from `up`, and documentation panels for host/container queries that require the later k3s observability stack.

## Risks / Trade-offs

- Risk: Too many labels create high-cardinality Prometheus series -> Mitigation: use only curated enum labels and reject raw identifiers or free-form error labels.
- Risk: Instrumentation changes accidentally alter business behavior -> Mitigation: metrics must be side-effect-only and tests should assert existing matching/email/sync outcomes.
- Risk: SLO panels look authoritative before enough baseline data exists -> Mitigation: label them as readiness/inspection panels and keep alerting in the separate alert-rules change.
- Risk: Runtime/VPS panels are sparse in Docker Compose -> Mitigation: design panels to tolerate missing series with zero/no-data fallbacks and document which panels require later scrape targets.
- Risk: Dashboard queries become k3s-incompatible -> Mitigation: use stable datasource UIDs and metric names, leaving service URL rewriting to the k3s chart.

## Migration Plan

1. Add metric definitions and helper functions in `src/config/metrics.ts`.
2. Instrument matching, geocoding, core repositories, email, and sync paths.
3. Add or update unit tests for metric registration and critical instrumentation paths.
4. Add provisioned dashboard JSON files under `observability/grafana/provisioning/dashboards/`.
5. Validate dashboard JSON, OpenSpec, TypeScript, and targeted tests.
6. Restart the local Grafana container and confirm the provisioned dashboards load.

Rollback is code-level: remove the new instrumentation and dashboard JSON files. No database migration is required.

## Open Questions

- Whether Docker Compose should add node-exporter/cAdvisor now or leave host/container metrics entirely to the k3s observability stack.
- Whether county inventory should be implemented from current repository queries first or as a dedicated aggregate query for better performance.
