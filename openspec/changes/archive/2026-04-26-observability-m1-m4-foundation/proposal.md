## Why

The observability foundation for M1-M4 exists in the codebase but was not captured as an OpenSpec change. Recording it makes the health, tracing, metrics, Grafana datasource, and log-correlation work reviewable and gives later milestones a clear baseline.

## What Changes

- Capture M1 health check behavior and Docker healthcheck integration.
- Capture M2/M3 OpenTelemetry SDK startup, auto-instrumentation, OTLP trace export, and Prometheus metrics export.
- Capture M3 Grafana stack provisioning for Prometheus and Tempo.
- Capture M4 Loki ingestion and Winston-to-OpenTelemetry log forwarding with trace correlation.
- Align Docker Compose to mount the canonical Collector config file name used by the observability plan.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `observability`: Establish the implemented M1-M4 observability foundation as the baseline for health checks, traces, metrics, datasource provisioning, log ingestion, and trace/log correlation.

## Impact

- Affected code/config: `src/libs/healthCheck.ts`, `src/router/healthRouter.ts`, `src/instrumentation.ts`, `src/config/logger.ts`, `Dockerfile`, `ecosystem.config.ts`, `docker-compose.yml`, `observability/*`.
- Affected systems: Docker health checks, OpenTelemetry Collector, Prometheus, Tempo, Loki, Grafana.
- No database schema changes and no user-facing route behavior changes beyond `/health`.
