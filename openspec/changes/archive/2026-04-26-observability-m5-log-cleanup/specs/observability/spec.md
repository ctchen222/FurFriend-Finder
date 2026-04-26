## MODIFIED Requirements

### Requirement: Structured Log Ingestion
The system SHALL route all application runtime logs to Loki with trace correlation fields attached when a trace context is active. Application runtime logs MUST use the project structured logger and MUST NOT bypass it with raw console output or package-specific internal loggers.

#### Scenario: Log emitted during a traced request
- **WHEN** the application emits a log entry during an active HTTP request
- **THEN** the log record includes the `traceId` and `spanId` of the active span
- **AND** the record is exported to the OTel Collector and forwarded to Loki

#### Scenario: Log emitted outside a request context
- **WHEN** the application emits a log entry with no active span (e.g. cron job startup)
- **THEN** the log record is still exported to Loki
- **AND** the `traceId` and `spanId` fields are absent

#### Scenario: No raw console output in production runtime
- **WHEN** the application runs in production mode
- **THEN** all application runtime log output uses structured JSON format
- **AND** no `console.log` or `console.error` calls in runtime application modules bypass the structured logger

#### Scenario: Cron job logs visible
- **WHEN** a scheduled cron job executes
- **THEN** its log entries are emitted through the project structured logger
- **AND** its log entries appear in Loki under `service_name="furfriend-finder"`
- **AND** the entries are queryable by severity and message content

#### Scenario: Notification and auth hook logs use project logger
- **WHEN** LINE push delivery or password reset hook logic emits an application log
- **THEN** the log is emitted through the project structured logger
- **AND** the log does not use raw console output or the Better Auth internal logger
