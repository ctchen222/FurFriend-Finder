## Context

The OTel SDK in `src/instrumentation.ts:17-29` already constructs a `MeterProvider` with an OTLP gRPC exporter and a 15-second `PeriodicExportingMetricReader`. Auto-instrumentations populate HTTP / pg / Express RED metrics, but no business-level meter has been created. The capability spec at `openspec/specs/observability/spec.md` names three required instruments without specifying registration mechanics; this design fixes those mechanics.

## Goals / Non-Goals

**Goals:**

- Single source of truth for instrument creation so future indicators (MOA latency, LINE throughput) plug into the same module.
- Meter name aligned with `OTEL_SERVICE_NAME` (`furfriend-finder`) so attribute joins in Prometheus and Tempo work without alias tables.
- Zero new exporter / reader / collector configuration — everything reuses M3 plumbing.
- DB pool gauge reported via `addCallback`, not periodic background polling, so the gauge cost is bounded by the metric export interval.

**Non-Goals:**

- Adding histograms (e.g., match latency distribution). Defer until we know which percentiles SREs want.
- Adding MOA API / LINE message metrics — flagged as ad-hoc post-M7 work.
- Adding alerting rules. Alerts depend on baselines; gather two weeks of data first.
- Adding Grafana dashboards — that is M7.

## Decisions

### Decision 1: Counter vs UpDownCounter for match / email totals

We use `Counter` for both `match_requests_total` and `email_sends_total`. They are monotonically increasing event tallies, which is exactly the Counter contract. UpDownCounter would also work but is meant for values that can decrease (in-flight requests, queue depth); using it here would only add cognitive load when readers run `rate()` queries.

### Decision 2: ObservableGauge for `db_pool_connections`, with `state` as a low-cardinality label

`pg.Pool` exposes `totalCount` / `idleCount` / `waitingCount` as instantaneous snapshot integers. Counter / UpDownCounter would force us to track deltas ourselves, which fights the source of truth. ObservableGauge with an `addCallback` reading the three values once per export window is cheapest and exactly representable. We emit a single gauge with a `state` attribute (`total` | `idle` | `waiting`) instead of three separate gauges; downstream PromQL grouping is more ergonomic with a label, and it keeps cardinality fixed at 3.

### Decision 3: Module-scope meter caching

`metrics.getMeter('furfriend-finder')` is called once at module load. The OTel spec already requires meters to be cached and idempotent, but pinning it at module scope makes intent explicit and prevents future maintainers from accidentally calling `getMeter()` per request.

### Decision 4: Pass the `pg.Pool` instance into `metrics.ts`, not the other way around

`metrics.ts` exposes a `registerDbPoolGauge(pool: Pool)` function that `src/db.ts` calls after constructing the pool. The reverse (importing `pool` from `db.ts` into `metrics.ts`) would create a circular import path through the rest of the data layer.

## Risks / Trade-offs

- Risk: callback-style ObservableGauge silently fails if registration happens before the SDK is ready. Mitigation: `metrics.ts` is imported transitively from `src/main.ts` after `src/instrumentation.ts`, so SDK init precedes registration; we additionally wrap the callback in try/catch and log via the project Winston logger to surface any export-time errors.
- Risk: high attribute cardinality on `email_sends_total.status` if recipients or error codes leak into the label. Mitigation: status is enumerated as `'sent' | 'failed'` only; underlying error payloads are logged, not labeled.
- Trade-off: we skip latency histograms, which means we cannot answer "P95 of match request" until M7+. Acceptable for now because traces in Tempo already provide per-request latency, and adding a histogram without an SLO target would just add noise.
- Trade-off: emitting DB pool data only every 15s means a sudden pool exhaustion lasting <15s might be missed. Acceptable for a first pass; shorten the export interval or add a `db_pool_wait_events_total` counter later if needed.
