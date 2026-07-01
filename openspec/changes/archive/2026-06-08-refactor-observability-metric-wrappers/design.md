## Context

The custom metric layer now covers the key product and operations paths:

| Area | Current metrics |
| --- | --- |
| Matching | `match_requests_total`, `match_duration_milliseconds`, candidate/result histograms, truncation and no-result counters |
| Geocoding | request counter, duration histogram, status classification, shelter workload/failure metrics |
| Database | operation duration and error metrics via `recordDbOperation` |
| Email | send counter, send duration, failure counter, template and reason labels |
| Data sync | run counter, duration, updated rows, last success, public API failures |
| Inventory | shelter/lost animal observable gauges by normalized city/county |
| Pool | `db_pool_connections` observable gauge |

The common shape is repeated:

```text
start timer
try
  run business work
  record success metrics
catch
  record error metrics
  rethrow
finally
  record duration
```

This pattern is correct but should live in one place instead of being copied across services.

## Design

### Wrapper Layers

Use two wrapper layers:

1. Generic wrappers in `src/config/metrics.ts`
   - `recordMetricDuration(...)`
   - `recordMetricOutcome(...)`

2. Domain wrappers in `src/config/metrics.ts`
   - `recordDbOperation(...)`
   - `recordMatchRequest(...)`
   - `recordMatchFlow(...)`
   - `recordGeocodingRequest(...)`
   - `recordEmailAttempt(...)`
   - `recordEmailTemplateFailure(...)`
   - `recordAnimalSyncRun(...)`
   - `recordAnimalSyncApiRequest(...)`

Domain wrappers know the bounded label vocabulary. Services should not manually construct repeated metric attributes when a wrapper exists.

### Metrics Ownership

`src/config/metrics.ts` remains the only place that:

- defines metric instruments
- validates safe labels
- centralizes bounded label attributes
- records generic metric success/error/duration behavior

Service and repository files remain responsible for:

- business logic
- domain classification decisions
- choosing the correct wrapper operation/source/template/boundary

### Metric Inventory

Direct metric instrument calls should be limited to:

- `src/config/metrics.ts`
- tests that mock or assert instruments
- unavoidable point observations such as inventory setter callbacks

Service code should prefer domain helpers:

```ts
return recordMatchRequest('perform_match', async () => {
  // matching business logic
});
```

```ts
return recordEmailAttempt('verification', classifyEmailFailureReason, async () => {
  return this.mailer.sendMail(options);
});
```

```ts
return recordAnimalSyncRun('shelter_animals_api', 'animal', async () => {
  return this.repository.bulkInsertAnimals(animals);
});
```

### Error Handling

Wrappers must rethrow the original error after recording metrics. They must not convert business errors into metric-specific errors.

Template rendering failures are different from SMTP send failures. They should be recorded with `reason="template"` before rethrowing, but they should not increment `email_sends_total` because no send attempt reached the mailer.

Inventory refresh failures remain non-fatal because they happen after a successful sync. This local `try/catch` is intentional business resilience, not repeated metric plumbing.

### Compatibility

No metric names or labels change. Existing dashboards continue to query the same Prometheus series.

## Risks

- Over-abstracting all metrics into one generic wrapper could hide business intent.
  - Mitigation: keep small domain wrappers instead of one mega wrapper.
- Refactoring could accidentally change success/error semantics.
  - Mitigation: update targeted tests for each metric path before marking tasks complete.
- Some geocoding status classification is response-dependent.
  - Mitigation: use a wrapper that allows the service to set bounded status before returning or throwing.
