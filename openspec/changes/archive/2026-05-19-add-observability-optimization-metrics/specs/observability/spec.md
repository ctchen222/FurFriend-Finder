## ADDED Requirements

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
