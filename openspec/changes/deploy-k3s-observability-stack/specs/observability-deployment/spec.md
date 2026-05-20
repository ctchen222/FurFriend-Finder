## ADDED Requirements

### Requirement: Helm-Managed Observability Stack

The repository SHALL provide Helm-managed Kubernetes manifests for the VPS observability stack.

#### Scenario: chart renders core components

- **WHEN** the observability Helm chart is rendered
- **THEN** it SHALL include workloads and Services for OTel Collector, Prometheus, Tempo, Loki, and Grafana
- **AND** the rendered chart SHALL include ConfigMaps for the Collector, Prometheus, Tempo, Loki, Grafana datasources, and Grafana dashboard provisioning

#### Scenario: chart packages dashboard JSON

- **WHEN** the observability Helm chart is rendered
- **THEN** the Grafana dashboard JSON files produced by `grafana-dashboard-provisioning` SHALL be mounted or provisioned into Grafana automatically
- **AND** no manual dashboard import SHALL be required after install

#### Scenario: optional optimization dashboards are included when available

- **WHEN** optimization dashboard JSON files exist in the Grafana provisioning directory
- **THEN** the observability Helm chart SHALL mount or provision those dashboard files into Grafana using the same file-based provisioning path
- **AND** it SHALL preserve datasource UIDs and query semantics

#### Scenario: incomplete optional dashboard artifacts do not block the base stack

- **WHEN** optimization dashboard artifacts are still incomplete
- **THEN** the observability Helm chart SHALL still be allowed to deploy the base Collector, Prometheus, Tempo, Loki, Grafana, and baseline dashboard provisioning stack
- **AND** it SHALL document that optimization dashboards are not included yet
- **AND** it SHALL NOT reimplement a separate manual dashboard import mechanism

#### Scenario: chart supports production values

- **WHEN** production values are supplied
- **THEN** the chart SHALL allow configuring image tags, resource requests and limits, PVC sizes, storage class, Grafana host, TLS secret, ClusterIssuer, and Grafana admin Secret reference

### Requirement: Application Telemetry Integration

The deployment SHALL connect the production FurFriend application to the in-cluster observability stack through Helm values.

#### Scenario: app telemetry enabled

- **WHEN** the production app release is configured for the observability stack
- **THEN** `OTEL_SDK_DISABLED` SHALL render as `"false"`
- **AND** `OTEL_EXPORTER_OTLP_ENDPOINT` SHALL point to the OTel Collector Service in the cluster

#### Scenario: app can start before observability exists

- **WHEN** the observability stack is intentionally disabled or not yet installed
- **THEN** the app Helm values SHALL allow telemetry to remain disabled
- **AND** the app Deployment SHALL still render and start using the existing production configuration

### Requirement: GitOps Handoff

The repository SHALL define how the observability Helm release is applied to the VPS/k3s cluster without giving CI or the agent direct cluster access.

#### Scenario: Argo CD application exists

- **WHEN** the repo-owned deployment artifacts are complete
- **THEN** an Argo CD Application or equivalent GitOps manifest SHALL point to the observability Helm chart and production values
- **AND** it SHALL be separate from the application release unless a later design explicitly chooses an app-of-apps layout

#### Scenario: owner supplies sensitive runtime values

- **WHEN** Grafana admin credentials or other production secrets are needed
- **THEN** the repo SHALL provide templates and instructions
- **AND** the owner SHALL create or encrypt the real Secret values outside the agent context

## ADDED Requirements

### Requirement: Owner-Operated Local kubectl Access Preflight

The deployment documentation SHALL provide an owner-operated local workstation path for verifying the VPS k3s cluster with `kubectl` before relying on the observability stack runbooks.

#### Scenario: Owner accesses the VPS k3s API through an SSH tunnel
- **GIVEN** the owner has SSH access to the VPS
- **WHEN** the owner opens a tunnel from an unused local port such as `127.0.0.1:16643` to VPS `127.0.0.1:6443`
- **THEN** local `kubectl` can reach the k3s API server without exposing the Kubernetes API publicly

#### Scenario: Owner uses a stable kubeconfig context
- **GIVEN** the owner copied the VPS k3s kubeconfig into an owner-only local file
- **WHEN** the owner updates the copied server endpoint, renames the context to `furfriend-vps`, and merges it into `~/.kube/config`
- **THEN** daily cluster checks can use `kubectl config use-context furfriend-vps` instead of repeating `KUBECONFIG=...` prefixes

#### Scenario: Repository preserves the access boundary
- **GIVEN** kubeconfig files and SSH credentials are secret-equivalent material
- **WHEN** local cluster access is documented
- **THEN** the repository does not store kubeconfig files, SSH credentials, cluster-admin tokens, or VPS secrets
- **AND** public k3s API exposure, OIDC, kubelogin, and RBAC hardening remain deferred until multi-user or always-on private access is required
