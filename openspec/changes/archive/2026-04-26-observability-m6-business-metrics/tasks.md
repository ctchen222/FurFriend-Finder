## 1. OpenSpec Artifacts

- [x] 1.1 Create the M6 proposal for business metrics instrumentation.
- [x] 1.2 Author the design document covering Counter vs Gauge decisions and registration ordering.
- [x] 1.3 Author the observability delta spec modifying the Business Metrics requirement.
- [x] 1.4 Run `openspec validate observability-m6-business-metrics` and resolve any schema errors.

## 2. Shared Metrics Module

- [x] 2.1 Create `src/config/metrics.ts` exposing `matchRequestCounter`, `emailCounter`, and a `registerDbPoolGauge(pool)` helper.
- [x] 2.2 Use `metrics.getMeter('furfriend-finder')` at module scope to align with `OTEL_SERVICE_NAME`.
- [x] 2.3 Document expected attribute keys (`status`, `state`) inline with concise comments only where the WHY is non-obvious.

## 3. Instrumentation

- [x] 3.1 Increment `matchRequestCounter` with `{ status: 'success' | 'error' }` in `src/Service/matching.ts` for both branches of the matching flow.
- [x] 3.2 Increment `emailCounter` with `{ status: 'sent' | 'failed' }` in `src/Service/mail.ts` on the resolve and reject paths of the nodemailer Promise.
- [x] 3.3 Call `registerDbPoolGauge(pool)` in `src/db.ts` immediately after constructing the `pg.Pool`.
- [x] 3.4 Ensure the observable callback emits three observations per export, one per `state` value (`total`, `idle`, `waiting`).

## 4. Tests

- [x] 4.1 Unit-test the matching service to confirm `matchRequestCounter.add` is invoked with the correct status on success and error paths.
- [x] 4.2 Unit-test the mail service for both resolve and reject branches.
- [x] 4.3 Unit-test that `registerDbPoolGauge` registers a callback that reads `pool.totalCount` / `idleCount` / `waitingCount`.
- [x] 4.4 Run `npm run build` and `npm test` and confirm both pass.

## 5. Verification

- [ ] 5.1 Start docker-compose, trigger one match request, wait at least 20 seconds, and confirm `match_requests_total > 0` in Prometheus.
- [ ] 5.2 Trigger an email send and confirm `email_sends_total` reports a `status=sent` time series; force a failure path and confirm a `status=failed` time series appears.
- [ ] 5.3 Confirm `db_pool_connections` returns three time series (one per `state`) under one minute after start-up.
- [ ] 5.4 Inspect a sample Prometheus result with `curl -s 'http://localhost:9090/api/v1/query?query=db_pool_connections' | jq` and confirm shapes match the design.
