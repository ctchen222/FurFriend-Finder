## ADDED Requirements

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
