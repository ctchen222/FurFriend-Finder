## MODIFIED Requirements

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
