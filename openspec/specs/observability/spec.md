# observability Specification

## Purpose

Provide full-stack observability for FurFriend Finder through health checks, distributed traces,
metrics, and structured logs — all routable to a unified Grafana dashboard. Every observable
signal SHALL carry enough context to diagnose production incidents without accessing raw server
logs or connecting to the database directly.
## Requirements
### Requirement: Application Health Check
The system SHALL expose a `/health` endpoint that reflects the real-time health of all critical dependencies.

#### Scenario: All dependencies healthy
- **WHEN** a client sends `GET /health`
- **THEN** the system queries each registered critical dependency (e.g. PostgreSQL)
- **AND** returns HTTP 200 with `{ status: "ok", timestamp, services: [{ name, status, latencyMs }] }`

#### Scenario: A critical dependency is down
- **WHEN** a critical dependency fails its health check
- **THEN** the system returns HTTP 503
- **AND** the response body identifies which service failed and its status

#### Scenario: Docker healthcheck integration
- **WHEN** the application container starts
- **THEN** Docker evaluates `/health` on the configured interval
- **AND** marks the container `healthy` only when the endpoint returns HTTP 200
- **AND** restarts the container after the configured number of consecutive failures

### Requirement: Distributed Trace Generation
The system SHALL automatically generate OpenTelemetry traces for all inbound HTTP requests and outbound database queries without requiring manual instrumentation in application code.

#### Scenario: HTTP request trace
- **WHEN** any HTTP request is received
- **THEN** the system creates a root span with the HTTP method, route, and response status
- **AND** the span includes a globally unique `traceId`

#### Scenario: Database query child span
- **WHEN** a PostgreSQL query executes within a traced request
- **THEN** the system creates a child span under the active HTTP span
- **AND** the child span records the query duration
- **AND** the child span does NOT record the raw SQL statement in production

#### Scenario: Trace export
- **WHEN** a trace is complete
- **THEN** the system exports it to the OTel Collector via OTLP
- **AND** the Collector forwards it to Tempo for storage

### Requirement: HTTP Metrics Collection
The system SHALL emit HTTP request duration metrics that Prometheus can scrape.

#### Scenario: Request duration recorded
- **WHEN** an HTTP request completes
- **THEN** the system records the request duration in milliseconds
- **AND** the metric includes labels for HTTP method, route, and status code

#### Scenario: Prometheus scrape
- **WHEN** Prometheus scrapes the OTel Collector metrics endpoint
- **THEN** it receives HTTP duration histograms for all completed requests
- **AND** the metrics are queryable using PromQL within 30 seconds of the request

### Requirement: Structured Log Ingestion
The system SHALL route all application logs to Loki with trace correlation fields attached.

#### Scenario: Log emitted during a traced request
- **WHEN** the application emits a log entry during an active HTTP request
- **THEN** the log record includes the `traceId` and `spanId` of the active span
- **AND** the record is exported to the OTel Collector and forwarded to Loki

#### Scenario: Log emitted outside a request context
- **WHEN** the application emits a log entry with no active span (e.g. cron job startup)
- **THEN** the log record is still exported to Loki
- **AND** the `traceId` and `spanId` fields are absent

#### Scenario: No raw console output in production
- **WHEN** the application runs in production mode
- **THEN** all log output uses structured JSON format
- **AND** no `console.log` or `console.error` calls bypass the structured logger

#### Scenario: Cron job logs visible
- **WHEN** a scheduled cron job executes
- **THEN** its log entries appear in Loki under `service_name="furfriend-finder"`
- **AND** the entries are queryable by severity and message content

### Requirement: Trace-to-Log Correlation
The system SHALL allow an operator to navigate from a trace in Tempo to its associated logs in Loki, and vice versa, using the shared `traceId`.

#### Scenario: Operator navigates trace -> log
- **WHEN** an operator views a trace in Grafana Tempo
- **THEN** they can query Loki with the same `traceId`
- **AND** retrieve all log entries that were emitted during that request

#### Scenario: Operator navigates log -> trace
- **WHEN** an operator views a log entry in Grafana Loki
- **THEN** the `trace_id` label is present on the log stream
- **AND** the operator can use that value to locate the corresponding trace in Tempo

### Requirement: Business Metrics

The system SHALL emit three custom OpenTelemetry metrics through the project meter (`furfriend-finder`) so that operators can observe match traffic, email delivery outcomes, and database pool health without relying on auto-instrumentation alone. Custom metrics SHALL share the existing OTLP gRPC exporter and 15-second `PeriodicExportingMetricReader` configured during M3.

#### Scenario: match request counted

- **WHEN** the matching service processes a request
- **THEN** the `match_requests_total` Counter SHALL be incremented by 1
- **AND** the increment SHALL carry a `status` attribute equal to `success` or `error`
- **AND** the metric SHALL be visible in Prometheus within one export interval (≤15 seconds)

#### Scenario: email send counted

- **WHEN** the mail service attempts to send an email
- **THEN** the `email_sends_total` Counter SHALL be incremented by 1 on resolution
- **AND** the Counter SHALL also be incremented by 1 on rejection
- **AND** each increment SHALL carry a `status` attribute equal to `sent` or `failed`

#### Scenario: database pool observable

- **WHEN** the OTel SDK collects metrics
- **THEN** the `db_pool_connections` ObservableGauge SHALL report three observations
- **AND** each observation SHALL carry a `state` attribute of `total`, `idle`, or `waiting`
- **AND** the values SHALL reflect the live `pg.Pool` counters at the moment of collection

#### Scenario: shared meter and pipeline

- **WHEN** any business metric is registered
- **THEN** it SHALL use the meter named `furfriend-finder`
- **AND** it SHALL NOT introduce new exporters, readers, or collector pipelines beyond those installed in M3

### Requirement: Grafana Datasource Availability
The system SHALL provision Prometheus, Tempo, and Loki as Grafana datasources automatically, so that no manual configuration is required after `docker compose up`.

#### Scenario: Stack cold start
- **WHEN** `docker compose up` starts the observability stack from scratch
- **THEN** Grafana loads with Prometheus, Tempo, and Loki datasources already configured
- **AND** each datasource passes its built-in connection test

#### Scenario: Datasource UIDs are stable
- **WHEN** the stack restarts
- **THEN** the datasource UIDs remain the same (`prometheus`, `tempo`, `loki`)
- **AND** any saved dashboard or alert that references those UIDs continues to work

### Requirement: Sensitive Data Exclusion
The system SHALL prevent personally identifiable and location-sensitive data from appearing in
traces or logs.

#### Scenario: SQL statements in production
- **WHEN** a PostgreSQL query executes in production
- **THEN** the span attribute `db.statement` is set to `[redacted]`
- **AND** no query parameter values appear in any exported span

#### Scenario: Span attributes contain only derived values
- **WHEN** a span is created for a matching or geocoding operation
- **THEN** the span attributes contain only aggregate or categorical values
  (e.g. `candidates.total`, `city`, `status`)
- **AND** raw addresses, coordinates (`lat`/`lng`), or user identifiers do NOT appear
  as span attributes

