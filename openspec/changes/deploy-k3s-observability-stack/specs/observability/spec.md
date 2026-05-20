## MODIFIED Requirements

### Requirement: Grafana Datasource Availability

The system SHALL provision Prometheus, Tempo, and Loki as Grafana datasources automatically in both Docker Compose and Helm/k3s deployments, so that no manual configuration is required after the observability stack starts.

#### Scenario: Stack cold start

- **WHEN** the observability stack starts from scratch
- **THEN** Grafana loads with Prometheus, Tempo, and Loki datasources already configured
- **AND** each datasource passes its built-in connection test

#### Scenario: Datasource UIDs are stable

- **WHEN** the stack restarts
- **THEN** the datasource UIDs remain the same (`prometheus`, `tempo`, `loki`)
- **AND** any saved dashboard or alert that references those UIDs continues to work

#### Scenario: Kubernetes datasource URLs use internal services

- **WHEN** Grafana runs in the k3s observability Helm release
- **THEN** Prometheus, Tempo, and Loki datasource URLs SHALL point to Kubernetes internal Service DNS names
- **AND** they SHALL NOT point to Docker Compose hostnames, localhost, or public ingress URLs

## ADDED Requirements

### Requirement: Kubernetes Observability Signal Parity

The system SHALL provide the same traces, metrics, logs, business metrics, datasource provisioning, and baseline dashboards in the Helm/k3s deployment that are available in the local Docker Compose observability stack after `grafana-dashboard-provisioning` is complete. Optimization metrics and dashboards SHALL be included when their provisioning artifacts exist, but they SHALL NOT block the base k3s observability deployment.

#### Scenario: application telemetry reaches the in-cluster Collector

- **WHEN** the production app Helm release has telemetry enabled
- **THEN** the app SHALL send OTLP traces, metrics, and logs to the in-cluster OTel Collector Service
- **AND** the app SHALL NOT use `localhost` as its OTLP endpoint in k3s

#### Scenario: metrics are visible in Grafana

- **WHEN** the app receives HTTP traffic and Prometheus scrapes the Collector
- **THEN** Grafana SHALL show HTTP duration metrics, DB pool metrics, and business metrics including `match_requests_total`, `email_sends_total`, and `db_pool_connections`
- **AND** Grafana SHALL show optimization metrics and dashboards when those metrics and dashboard JSON files are implemented

#### Scenario: traces are visible in Grafana

- **WHEN** the app handles a traced request
- **THEN** the trace SHALL be exported through the Collector to Tempo
- **AND** Grafana SHALL be able to open the trace from the Tempo datasource

#### Scenario: logs are visible in Grafana

- **WHEN** the app emits structured logs
- **THEN** the logs SHALL be exported through the Collector to Loki
- **AND** Grafana SHALL be able to query those logs from the Loki datasource

### Requirement: Grafana-Only External Observability Access

The system SHALL expose Grafana as the only externally reachable observability UI in the VPS/k3s deployment.

#### Scenario: Grafana ingress is enabled

- **WHEN** the observability Helm release is installed with ingress enabled
- **THEN** Grafana SHALL be reachable over HTTPS through the configured host
- **AND** anonymous Grafana access SHALL be disabled
- **AND** admin credentials SHALL come from a Kubernetes Secret

#### Scenario: signal stores remain internal

- **WHEN** the observability Helm release is rendered
- **THEN** OTel Collector, Prometheus, Tempo, and Loki Services SHALL be `ClusterIP`
- **AND** no Ingress SHALL be created for OTel Collector, Prometheus, Tempo, or Loki

### Requirement: Kubernetes Observability Persistence Boundary

The system SHALL persist Grafana state, Prometheus metrics, Tempo traces, and Loki logs across pod restarts in the VPS/k3s deployment, while clearly distinguishing this from off-VPS disaster recovery.

#### Scenario: pod restart persistence

- **WHEN** Grafana, Prometheus, Tempo, or Loki pods restart
- **THEN** their PVC-backed data SHALL remain available after the replacement pod becomes ready

#### Scenario: volume loss is not treated as recovery

- **WHEN** an observability PVC is deleted or the VPS disk is lost
- **THEN** the system SHALL NOT claim historical telemetry recovery unless an object-store-backed hardening implementation is enabled
- **AND** the operator documentation SHALL point to the production-hardening plan for off-VPS retention
