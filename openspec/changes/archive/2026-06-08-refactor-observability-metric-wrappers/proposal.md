## Why

The current observability metrics implementation is functionally complete, but service and repository code now contains repeated metric-specific `try`/`catch`/`finally` patterns. This makes business logic harder to scan and increases the chance that future metric additions use inconsistent labels, forget duration recording, or accidentally expose unsafe labels.

This change consolidates metric recording behind small shared wrappers so product code can express business intent while metric safety, duration timing, success/error counting, and bounded labels stay centralized.

## What Changes

- Inventory all application code paths that directly record custom metrics:
  - matching metrics
  - geocoding metrics
  - database operation metrics
  - email delivery metrics
  - animal data sync metrics
  - county inventory gauges
  - DB pool gauge registration
- Add reusable metric wrappers in `src/config/metrics.ts` for common recording patterns:
  - duration around async work
  - success/error outcome counters
  - match request timing and status
  - geocoding request timing and status
  - email send timing, status, and classified failure reason
  - animal sync run timing, status, update count, last success, and API failure count
- Refactor services/repositories to use wrappers where that reduces duplicated metric plumbing.
- Preserve all metric names, label keys, label values, datasource UIDs, and dashboard queries.
- Keep special-case business behavior local when needed, such as inventory refresh failure being non-fatal.
- Update tests to verify wrapper behavior and unchanged metric semantics.

## Non-Goals

- Do not add new metrics or dashboards.
- Do not change Prometheus metric names or labels.
- Do not change matching, geocoding, email, sync, or repository business behavior.
- Do not change k3s deployment or Grafana provisioning.
- Do not archive or modify `deploy-k3s-observability-stack`.

## Capabilities

### Modified Capabilities

- `observability`: Refactor metric recording to use centralized wrappers while preserving existing observability behavior and safety guarantees.

## Impact

- Affected code:
  - `src/config/metrics.ts`
  - `src/Service/matching.ts`
  - `src/Service/geo.ts`
  - `src/Service/animalLost.ts`
  - `src/Service/mail.ts`
  - `src/Service/animal.ts`
  - `src/Service/animalSync.ts`
  - repository files that use `recordDbOperation`
- Affected tests:
  - metric registration and wrapper tests
  - matching, geocoding, DB, mail, and sync instrumentation tests
- Runtime behavior:
  - No intended functional change.
  - Metrics should continue to populate the already provisioned Grafana dashboards.
