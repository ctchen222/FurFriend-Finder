## 1. OpenSpec Artifacts

- [x] 1.1 Create the M1-M4 observability foundation proposal.
- [x] 1.2 Create the observability delta spec covering M1-M4 baseline requirements.
- [x] 1.3 Create the technical design for the M1-M4 foundation.
- [x] 1.4 Create the implementation and verification task checklist.

## 2. M1 Health Check

- [x] 2.1 Verify `/health` is mounted and backed by registered critical dependency checks.
- [x] 2.2 Verify Docker Compose includes an app healthcheck for `/health`.

## 3. M2-M3 Traces and Metrics

- [x] 3.1 Verify OpenTelemetry SDK initialization exists and exports traces and metrics through OTLP.
- [x] 3.2 Verify startup paths load instrumentation before the application.
- [x] 3.3 Verify Collector, Prometheus, Tempo, and Grafana config exists.

## 4. M4 Logs and Correlation

- [x] 4.1 Verify Loki service and config exist in the observability stack.
- [x] 4.2 Verify Winston uses OpenTelemetry transport and injects active trace/span fields.
- [x] 4.3 Verify Grafana provisions Prometheus, Tempo, and Loki datasource UIDs.

## 5. Verification

- [x] 5.1 Validate the M1-M4 OpenSpec change.
- [x] 5.2 Run the project build or equivalent TypeScript check.
