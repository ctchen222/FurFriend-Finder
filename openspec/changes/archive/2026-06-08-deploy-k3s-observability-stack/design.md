## Context

The current repo state has three layers of observability work:

- Completed baseline, archived as M1-M6: `/health`, OpenTelemetry traces and metrics, structured logs with trace/span injection, business metrics, Collector routing to Tempo/Prometheus/Loki, and Grafana datasource provisioning.
- Active dashboard work: `grafana-dashboard-provisioning` has the four dashboard JSON files present in `observability/grafana/provisioning/dashboards/`, but several live Grafana verification tasks remain unchecked.
- Optimization dashboard inventory: no active change named `add-observability-optimization-metrics` exists in the current OpenSpec tree, but optimization dashboard JSON files already exist for product matching, dependency health, data freshness, runtime/VPS readiness, and SLO-readiness. The k3s chart packages the files that exist, but absent future optimization artifacts should not block the first k3s observability deployment.
- Active production hardening work: `observability-production-hardening` defines tail sampling, S3-compatible storage, and long-term metrics retention, but those runtime changes are not implemented yet.

The deployment side is also split. `deploy-k3s-gitops` already introduced the app/PostgreSQL Helm path and the owner-operated k3s boundary, but the production values still set `OTEL_SDK_DISABLED: "true"` and leave `OTEL_EXPORTER_OTLP_ENDPOINT` empty. That means the current VPS deployment can run the Node server and PostgreSQL, but it cannot receive or view production telemetry yet.

This change deploys the current observability functionality to k3s. It does not complete the separate production hardening plan unless explicitly pulled into this change later.

`grafana-dashboard-provisioning` is now archived and provides baseline dashboard provisioning parity. Optimization dashboards are packaged when their JSON files exist. Helm deployment, ingress, storage, and GitOps remain this change's responsibility.

## Goals / Non-Goals

**Goals:**

- Deploy the current observability stack to the VPS k3s cluster with Helm.
- Preserve the existing telemetry pipeline: app -> OTel Collector -> Prometheus/Tempo/Loki -> Grafana.
- Preserve the current Grafana datasources and dashboard inventory.
- Make Grafana the only externally reachable observability surface.
- Keep Prometheus, Tempo, Loki, and OTel Collector private inside the cluster.
- Enable app telemetry in production values by pointing OTLP to the in-cluster Collector.
- Keep all repo-owned artifacts verifiable without SSH or cluster-admin access.
- Keep owner-only actions explicit: DNS, TLS, Grafana admin secret, Argo CD sync, storage sizing, and live traffic verification.

**Non-Goals:**

- Agent access to the VPS, kubeconfig, production DNS, or production secrets.
- Replacing the existing app/PostgreSQL Helm chart from `deploy-k3s-gitops`.
- Changing application routes, matching logic, notification behavior, or database schema.
- Making Prometheus, Tempo, Loki, or the Collector publicly reachable.
- Claiming off-VPS disaster recovery for telemetry data.
- Completing MinIO/S3/Thanos/tail-sampling hardening unless the existing `observability-production-hardening` change is merged into this scope.

## Workstream Decisions

### Decision 1: Separate observability Helm chart

Create a dedicated Helm chart, tentatively `deploy/observability-stack`, instead of folding every service into the app chart. The app chart owns the web application and PostgreSQL. The observability chart owns telemetry collection, storage, and visualization.

This keeps release cadence separate: app rollouts can change image tags frequently while Grafana, Prometheus, Loki, Tempo, and Collector versions change more deliberately.

### Decision 2: Internal signal plane, Grafana-only external UI

The Kubernetes services for OTel Collector, Prometheus, Tempo, and Loki are `ClusterIP` only. The chart creates an Ingress only for Grafana. Grafana anonymous access remains disabled, and the admin password comes from a Kubernetes Secret rather than values committed to Git.

If the VPS has no private VPN or identity provider yet, the first secure baseline is:

- TLS through cert-manager.
- Grafana login required.
- Strong generated admin password in a Kubernetes Secret.
- Optional Traefik IP allowlist middleware if the owner has stable source IPs.

### Decision 3: Package existing configs first

The first Helm version should package the existing local config as Kubernetes ConfigMaps:

- `observability/otel-collector-config.yaml`
- `observability/prometheus.yml`
- `observability/tempo.yaml`
- `observability/loki.yaml`
- `observability/grafana/provisioning/datasources/datasources.yaml`
- `observability/grafana/provisioning/dashboards/dashboards.yaml`
- `observability/grafana/provisioning/dashboards/*.json`

Kubernetes service names must replace Docker Compose hostnames where needed, but the datasource UIDs stay stable: `prometheus`, `tempo`, and `loki`.

The dashboard inventory should be refreshed from the available dashboard-producing changes:

- baseline dashboards from `grafana-dashboard-provisioning`
- optimization dashboards from the Grafana provisioning directory, when those files exist

### Decision 4: Enable application telemetry through values

The app chart already renders:

- `OTEL_SDK_DISABLED`
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

This change updates the production deployment contract so production can set:

- `OTEL_SDK_DISABLED: "false"`
- `OTEL_SERVICE_NAME: "furfriend-finder"`
- `OTEL_EXPORTER_OTLP_ENDPOINT: "http://<collector-service>:4317"`

The exact service DNS should be generated from the observability chart release name and namespace. The app release must not point to localhost in k3s.

### Decision 5: PVC-backed storage is the first VPS baseline

For the first k3s move, Prometheus, Tempo, Loki, and Grafana use PVCs backed by the cluster storage class, likely `local-path` on single-node k3s. This survives pod restarts and rescheduling on the same node, but it does not survive PVC deletion, host disk loss, or VPS loss.

The stronger storage plan remains covered by `observability-production-hardening`: S3-compatible storage, long-term metrics retention, and tail sampling.

### Decision 6: GitOps follows the existing authority boundary

Repo-owned work includes the Helm chart, values, Argo CD application manifest, runbook, and tests. Owner-operated work includes applying real Grafana credentials, choosing hostnames, configuring DNS/TLS, syncing Argo CD, and pasting non-sensitive status outputs back for debugging.

The agent should not require production secrets or kubeconfig to complete repo-owned work.

## Runtime Architecture

```text
Browser / operator
  |
  | HTTPS
  v
Traefik Ingress
  |
  v
Grafana Service
  |
  | queries
  +--> Prometheus Service --scrapes--> OTel Collector metrics exporter
  +--> Tempo Service <------------- OTel Collector traces exporter
  +--> Loki Service <-------------- OTel Collector logs exporter

FurFriend app pod
  |
  | OTLP gRPC/HTTP
  v
OTel Collector Service
```

Only the top Grafana path crosses the public ingress boundary.

## Verification Strategy

Repo-owned verification:

- `helm lint deploy/observability-stack`
- `helm template deploy/observability-stack -f <production-like values>`
- `helm unittest deploy/observability-stack`
- `helm template deploy/furfriend-finder` to confirm telemetry env changes render correctly.
- `openspec validate deploy-k3s-observability-stack`

Owner-operated live verification:

- Confirm all observability Pods are ready.
- Confirm only Grafana has an Ingress.
- Confirm Grafana datasources for Prometheus, Tempo, and Loki pass connection checks.
- Generate app traffic and confirm dashboards show HTTP, DB pool, match, email, trace, and log data.
- Confirm trace-to-log lookup works through shared trace IDs.
- Restart Grafana, Prometheus, Tempo, Loki, and Collector pods and confirm the dashboard definitions and recent data survive pod restarts.

## Risks / Trade-offs

- Risk: single-node PVC storage is not disaster recovery. Mitigation: state this clearly and leave off-VPS object storage under `observability-production-hardening`.
- Risk: exposing Grafana can leak operational data. Mitigation: expose only Grafana, require auth, use TLS, and optionally add IP allowlisting.
- Risk: app telemetry points to the wrong service DNS. Mitigation: Helm tests should assert the rendered OTLP endpoint, and live verification should inspect the app ConfigMap and environment.
- Risk: dashboard JSON was authored for Docker Compose service names. Mitigation: datasource UIDs stay stable while URLs are generated for Kubernetes service names.
- Risk: resource pressure on a small VPS. Mitigation: provide conservative default CPU/memory requests and make retention/storage sizes configurable.

## Owner-Operated Local kubectl Access

The owner may verify the VPS k3s cluster from a local workstation by using an SSH tunnel to the k3s API server and merging the copied kubeconfig into `~/.kube/config` as the `furfriend-vps` context. This is an owner-operated preflight for the deployment runbooks, not a repository-owned secret or an agent-operated production access path.

The documented default is:

- Local workstation forwards an unused local port such as `127.0.0.1:16643` to the VPS k3s API server at `127.0.0.1:6443`.
- The copied kubeconfig is renamed to the stable `furfriend-vps` context.
- The copied kubeconfig is merged into `~/.kube/config`.
- Daily usage switches context with `kubectl config use-context furfriend-vps`.

The repository must not store kubeconfig files, SSH credentials, cluster-admin tokens, or VPS secrets. Public Kubernetes API exposure, OIDC, kubelogin, and broader RBAC hardening remain deferred until multi-user or always-on private access is required.
