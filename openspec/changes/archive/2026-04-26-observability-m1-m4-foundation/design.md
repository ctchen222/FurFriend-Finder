## Context

M1-M4 establish the baseline observability stack for FurFriend Finder. The current implementation already includes the `/health` route, startup health checks, OpenTelemetry SDK initialization, Docker Compose services for Collector/Tempo/Prometheus/Grafana/Loki, Grafana datasource provisioning, and Winston OpenTelemetry transport.

## Goals / Non-Goals

**Goals:**

- Document the implemented M1-M4 architecture in OpenSpec.
- Keep the app boot order compatible with OpenTelemetry auto-instrumentation.
- Ensure Docker Compose uses one canonical Collector config path.
- Keep the observability stack local-first and self-contained.

**Non-Goals:**

- Do not add M6 business metrics or M7 dashboards.
- Do not change authentication, matching, notification, or data-sync product behavior.
- Do not introduce managed observability vendors or hosted services.

## Decisions

- Use OpenTelemetry auto-instrumentation in `src/instrumentation.ts` and load it before app startup. Local development imports it from `src/main.ts`, while Docker/PM2 use Node `--require` for compiled output.
- Route telemetry through the OTel Collector rather than exporting directly from the app to each backend. This keeps backend routing in `observability/otel-collector-config.yaml`.
- Use Prometheus for metrics, Tempo for traces, Loki for logs, and Grafana for a unified operator UI. Datasource UIDs remain stable as `prometheus`, `tempo`, and `loki`.
- Keep PostgreSQL as the critical health dependency and expose health through `/health` plus Docker healthcheck.

## Risks / Trade-offs

- Auto-instrumentation depends on initialization order. Mitigation: keep `src/main.ts` importing instrumentation before app code and production commands using `--require`.
- Local observability adds Docker Compose services. Mitigation: isolate state in named volumes and keep app code pointed at `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Collector config filename drift can cause confusion. Mitigation: mount the canonical `.yaml` config from Docker Compose.
