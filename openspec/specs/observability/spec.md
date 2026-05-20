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

### Requirement: Provisioned Dashboards

The system SHALL provide four Grafana dashboards provisioned as JSON files in the repository so that observability views are available immediately after `docker compose up` without any manual UI configuration.

#### Scenario: dashboards auto-loaded on startup

- **WHEN** `docker compose up -d` is run
- **THEN** all four dashboards SHALL appear in Grafana within 30 seconds
- **AND** no manual import or UI interaction SHALL be required
- **AND** the dashboards SHALL survive container restarts without data loss

#### Scenario: dashboards survive volume deletion

- **WHEN** the `grafana_data` Docker volume is deleted and the stack is restarted
- **THEN** all four dashboards SHALL reappear automatically
- **AND** this SHALL confirm that dashboard definitions are sourced from the repository, not the volume

#### Scenario: application overview dashboard

- **WHEN** an operator opens the Application Overview dashboard
- **THEN** they SHALL see HTTP request rate, P95 latency, error rate percentage, and DB pool state
- **AND** no panel SHALL show "No data" when the application has received at least one HTTP request

#### Scenario: business metrics dashboard

- **WHEN** an operator opens the Business Metrics dashboard
- **THEN** they SHALL see match request count, match success rate, email send count, and email success rate
- **AND** a status variable dropdown SHALL allow filtering all panels to a specific status label value
- **AND** no panel SHALL show "No data" after at least one match request and one email send have been processed

#### Scenario: traces explorer dashboard

- **WHEN** an operator opens the Traces Explorer dashboard
- **THEN** they SHALL see a table of recent error traces and a table of the slowest traces
- **AND** clicking a row SHALL navigate to the full trace detail in Tempo

#### Scenario: logs explorer dashboard

- **WHEN** an operator opens the Logs Explorer dashboard
- **THEN** they SHALL see a live log stream, a filtered error/warn log stream, and a log volume chart grouped by level
- **AND** the error filter panel SHALL show only log lines where level is error or warn

### Requirement: Optimization Metric Label Safety

The system SHALL keep all optimization metrics low-cardinality and SHALL NOT use personally identifiable, location-sensitive, or unbounded free-form values as metric labels.

#### Scenario: metric labels are bounded
- **WHEN** the application records optimization metrics
- **THEN** labels SHALL be limited to curated categorical values such as `status`, `operation`, `template`, `reason`, `source`, `table`, `boundary`, or normalized `city_county`
- **AND** labels SHALL NOT include raw addresses, coordinates, email addresses, user IDs, owner IDs, animal IDs, SQL statements, raw URLs, or exception messages

### Requirement: Matching Optimization Metrics

The system SHALL emit product matching metrics that explain latency, candidate volume, result count, truncation, and no-result outcomes for both pure matching work and the full user-visible match flow.

#### Scenario: pure matching duration recorded
- **WHEN** `performMatch()` completes successfully or fails
- **THEN** the system SHALL record `match_duration_milliseconds` with `boundary="perform_match"`
- **AND** the duration SHALL include matching logic but exclude caller-side owner lookup and email delivery

#### Scenario: full match flow duration recorded
- **WHEN** `GET /api/lost-animals/match/:id` completes successfully or fails
- **THEN** the system SHALL record `match_duration_milliseconds` with `boundary="match_flow"`
- **AND** the duration SHALL include lost-animal lookup, owner lookup, matching, and optional match-notification email work

#### Scenario: candidate and result counts recorded
- **WHEN** a match request is processed
- **THEN** the system SHALL record `match_candidates_total` for the candidate count before geocoding truncation
- **AND** the system SHALL record `match_results_total` for the number of returned matches

#### Scenario: truncation and no-result outcomes counted
- **WHEN** a match request exceeds the configured geocoding batch limit
- **THEN** the system SHALL increment `match_truncated_total`
- **AND** when a successful match request returns zero results, the system SHALL increment `match_no_result_total`

### Requirement: County Inventory Metrics

The system SHALL expose shelter-animal and lost-animal inventory counts grouped by normalized Taiwan city/county.

#### Scenario: shelter-animal inventory grouped by county
- **WHEN** metrics are collected
- **THEN** the system SHALL expose the current shelter-animal count per `city_county`
- **AND** the metric SHALL NOT include shelter address, coordinates, animal ID, or owner data

#### Scenario: lost-animal inventory grouped by county
- **WHEN** metrics are collected
- **THEN** the system SHALL expose the current lost-animal count per `city_county`
- **AND** the metric SHALL use the same normalized Taiwan city/county vocabulary as shelter-animal inventory

### Requirement: Geocoding Dependency Metrics

The system SHALL emit geocoding dependency metrics with bounded status values so operators can distinguish success, no-result, quota, authorization, and generic failure modes.

#### Scenario: geocoding request counted and timed
- **WHEN** the geocoding service calls the external geocoding API
- **THEN** the system SHALL increment `geocoding_requests_total`
- **AND** the system SHALL record `geocoding_duration_milliseconds`
- **AND** each measurement SHALL include a `status` label from a bounded set such as `ok`, `zero_results`, `over_query_limit`, `request_denied`, or `error`

#### Scenario: matching shelter geocoding workload recorded
- **WHEN** the matching service deduplicates shelter addresses for geocoding
- **THEN** the system SHALL record `geocoding_unique_shelter_addresses_total`
- **AND** when shelter-address geocoding fails during matching, the system SHALL increment `geocoding_failed_shelter_total`

### Requirement: Core Database Operation Metrics

The system SHALL emit database operation duration and error metrics for selected product-critical repository operations.

#### Scenario: core operation duration recorded
- **WHEN** a selected repository operation completes
- **THEN** the system SHALL record `db_query_duration_milliseconds`
- **AND** the metric SHALL include an `operation` label from a curated list of core operations

#### Scenario: core operation error counted
- **WHEN** a selected repository operation fails
- **THEN** the system SHALL increment `db_query_errors_total`
- **AND** the metric SHALL include the same curated `operation` label
- **AND** the metric SHALL NOT include raw SQL text or database error messages as labels

### Requirement: Email Delivery Optimization Metrics

The system SHALL emit email delivery metrics grouped by template and classified failure reason while preserving the existing sent/failed status vocabulary.

#### Scenario: email duration recorded by template
- **WHEN** an email send attempt completes successfully or fails
- **THEN** the system SHALL record `email_send_duration_milliseconds`
- **AND** the metric SHALL include a low-cardinality `template` label such as `verification`, `reset_password`, `match_notice`, or `generic`

#### Scenario: email counter includes template
- **WHEN** `email_sends_total` is incremented
- **THEN** the metric SHALL include the existing `status` label with `sent` or `failed`
- **AND** the metric SHALL include the low-cardinality `template` label

#### Scenario: email failure reason classified
- **WHEN** an email send attempt fails
- **THEN** the system SHALL increment `email_failures_total`
- **AND** the metric SHALL include low-cardinality `template` and `reason` labels
- **AND** the `reason` label SHALL use classified values rather than raw exception messages

### Requirement: Animal Data Sync Metrics

The system SHALL emit data-sync metrics that show whether shelter-animal and lost-animal public data is fresh and whether sync jobs are updating rows successfully.

#### Scenario: sync run counted and timed
- **WHEN** a scheduled or manual animal data sync runs
- **THEN** the system SHALL increment `animal_sync_runs_total` with a bounded `status` label
- **AND** the system SHALL record `animal_sync_duration_milliseconds`

#### Scenario: sync update volume recorded
- **WHEN** a sync job writes shelter-animal or lost-animal rows
- **THEN** the system SHALL record `animal_sync_updated_rows_total`
- **AND** the metric SHALL include a low-cardinality `table` label identifying the synced dataset

#### Scenario: last successful sync exposed
- **WHEN** metrics are collected after a successful sync
- **THEN** the system SHALL expose `animal_sync_last_success_timestamp`
- **AND** operators SHALL be able to compare the timestamp with the current time to detect stale data

#### Scenario: sync API failure counted
- **WHEN** a public-data API request fails during sync
- **THEN** the system SHALL increment `animal_sync_api_failures_total`
- **AND** the metric SHALL include a low-cardinality `source` label

### Requirement: Runtime And VPS Readiness Metrics

The system SHALL expose runtime and VPS-readiness panels using Node runtime metrics and available Prometheus scrape targets without requiring k3s deployment in this change.

#### Scenario: Node runtime metrics available
- **WHEN** supported OpenTelemetry runtime instrumentation emits Node process, heap, event-loop, CPU, or GC metrics
- **THEN** the provisioned dashboards SHALL surface those metrics with Prometheus queries
- **AND** missing runtime series SHALL NOT break dashboard loading

#### Scenario: scrape health visible
- **WHEN** Prometheus scrapes the application or observability targets
- **THEN** the provisioned dashboards SHALL show service scrape health using available `up` or equivalent target-health metrics
- **AND** the dashboard SHALL remain compatible with future k3s scrape targets

### Requirement: Optimization Dashboard Provisioning

The system SHALL present optimization metrics through repository-controlled Grafana dashboard JSON files that use the existing dashboard provisioning mechanism.

#### Scenario: optimization dashboards are provisioned
- **WHEN** Grafana starts with the repository provisioning directory mounted
- **THEN** the product optimization, dependency health, data freshness, runtime/VPS, and SLO-readiness dashboards SHALL appear without manual UI import
- **AND** the dashboards SHALL use stable datasource UIDs `prometheus`, `loki`, and `tempo`

#### Scenario: dashboard updates reuse existing provisioning mechanism
- **WHEN** optimization dashboard JSON files are changed in the repository
- **THEN** Grafana SHALL load the updated definitions through the existing file provider
- **AND** this change SHALL NOT introduce a second dashboard provisioning mechanism

### Requirement: SLO Readiness Panels

The system SHALL expose dashboard-only SLO readiness panels for user-facing availability and quick-match latency without adding alert rules or notification receivers.

#### Scenario: availability SLO readiness visible
- **WHEN** an operator opens the SLO-readiness dashboard
- **THEN** the dashboard SHALL show HTTP availability over the selected time range
- **AND** the dashboard SHALL display a 99% target for comparison

#### Scenario: quick-match latency SLO readiness visible
- **WHEN** an operator opens the SLO-readiness dashboard
- **THEN** the dashboard SHALL show quick-match P95 latency over the selected time range
- **AND** the dashboard SHALL display a 5-second target for comparison

#### Scenario: alerting remains out of scope
- **WHEN** this change is implemented
- **THEN** the repository SHALL NOT add alert rules, notification policies, contact points, receivers, or real alerting secrets as part of this change

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
