## Why

FurFriend Finder already has application telemetry, local Docker Compose observability services, and Grafana provisioning, but the VPS/k3s production path currently deploys only the application and PostgreSQL with telemetry disabled. Operators need the same traces, metrics, logs, and dashboards available on the VPS through Grafana without SSH access, raw database access, or public exposure of the internal signal stores.

## What Changes

- Add a Helm-managed k3s observability stack for OTel Collector, Prometheus, Tempo, Loki, and Grafana.
- Package the existing Collector, Prometheus, Tempo, Loki, Grafana datasource, and dashboard provisioning into Kubernetes-native ConfigMaps, Services, workloads, and PVC-backed storage.
- Enable production application telemetry by configuring the app Helm release to send OTLP traffic to the in-cluster OTel Collector.
- Expose only Grafana through HTTPS ingress; keep OTel Collector, Prometheus, Tempo, and Loki internal to the cluster.
- Reuse the current Grafana datasource UIDs and provisioned dashboards so the VPS stack shows the current health, HTTP, database pool, business metrics, trace, and log views.
- Add repo-owned Helm tests and owner-operated verification steps for Grafana access, datasource health, dashboard data, trace/log correlation, and persistence across pod restarts.

## Dependency and Sequencing Model

This change has one runtime foundation and two dashboard-content relationships:

- M1-M6 observability baseline is the runtime foundation. It already defines app telemetry, the Collector pipeline, Prometheus/Loki/Tempo targets, datasource UIDs, and baseline metric names. The k3s stack can deploy from this foundation.
- `grafana-dashboard-provisioning` is a prerequisite only for dashboard provisioning parity. If the k3s chart claims the current baseline dashboards are available without manual import, it must package the provisioning mechanism and dashboard JSON from that change.
- No active change named `add-observability-optimization-metrics` exists in the current OpenSpec tree. Optimization dashboard JSON files are already present in `observability/grafana/provisioning/dashboards/`, so the k3s chart should package the files that exist without changing datasource UIDs or query semantics.

Implementation should follow this order when possible:

1. Deploy the k3s observability runtime from the existing M1-M6 signal contract.
2. Include `grafana-dashboard-provisioning` artifacts when claiming dashboard provisioning parity.
3. Include optimization dashboard JSON files when they exist in the Grafana provisioning directory.

If optimization dashboard artifacts are absent in a future checkout, this change may still be complete for the base k3s stack and baseline dashboard parity. It must only document that optimization dashboards are a follow-up extension.

## Provisioning and Helm Integration Method

- Treat the Docker Compose Grafana provisioning files as the source input for dashboard behavior:
  - `observability/grafana/provisioning/datasources/datasources.yaml`
  - `observability/grafana/provisioning/dashboards/dashboards.yaml`
  - `observability/grafana/provisioning/dashboards/*.json`
- Verify provisioning in Docker before porting it by checking Grafana APIs for:
  - dashboard presence through `/api/search`
  - datasource UIDs `prometheus`, `tempo`, and `loki`
  - datasource reachability where Grafana supports a health endpoint
- In Helm, mount the same datasource and dashboard definitions into Grafana as ConfigMaps instead of relying on manual UI imports or Grafana volume state.
- Replace Docker Compose datasource URLs with Kubernetes internal Service DNS names while preserving datasource UIDs:
  - Prometheus: `http://<prometheus-service>:9090`
  - Tempo: `http://<tempo-service>:3200`
  - Loki: `http://<loki-service>:3100`
- Keep Grafana as the only externally exposed observability surface. OTel Collector, Prometheus, Tempo, and Loki stay internal `ClusterIP` Services.
- Store mutable runtime state on PVCs: Grafana state, Prometheus metrics, Tempo traces, and Loki logs. This provides restart durability, not VPS-loss disaster recovery.
- Load Grafana admin credentials from a Kubernetes Secret. The proposal must not require committing real credentials.
- Integrate the app chart by enabling telemetry only after the Collector is deployed and by setting the app OTLP endpoint to the in-cluster Collector Service, never `localhost`.

## Grafana Access and Ingress Model

- Add a Grafana `Ingress` resource in the observability Helm chart so the operator can open Grafana from a local browser through a stable HTTPS hostname, `dashboard.furfriend-finder.com`.
- Do not create or modify the cluster-level `IngressClass` by default. The existing k3s deployment already uses Traefik-style ingress values in the app chart, so the Grafana ingress should default to `ingressClassName: traefik`.
- Make `ingress.className` configurable in Helm values so the owner can switch it if the VPS cluster uses a different ingress controller.
- Require DNS to point the Grafana hostname at the VPS public IP before treating browser access as ready.
- Attach cert-manager TLS configuration to the Grafana Ingress, including a configurable ClusterIssuer and TLS Secret name.
- Keep the app hostname and Grafana hostname as separate Ingress resources. The app remains on `furfriend-finder.com`; Grafana uses its own operator-facing host.
- Keep OTel Collector, Prometheus, Tempo, and Loki without any Ingress. Grafana is the only public observability entry point.
- Allow SSH tunnel access as a fallback for private/operator debugging, but treat the HTTPS Grafana hostname as the normal deployment path.

## Capabilities

### New Capabilities

- `observability-deployment`: Defines how the observability stack is deployed and operated on single-node k3s through Helm and GitOps.

### Modified Capabilities

- `observability`: Extends the existing observability capability so traces, metrics, logs, datasource provisioning, and dashboards must work in the Helm/k3s production deployment, not only in Docker Compose.

## Impact

- Affected repo artifacts: `deploy/**` Helm charts and production values, Grafana dashboard provisioning files, observability config files, runbooks, Argo CD/GitOps manifests, and Helm unit tests.
- Affected production systems: single-node k3s on the VPS, Traefik ingress, cert-manager TLS, persistent volumes, application Deployment telemetry env, and Grafana admin credentials.
- User-facing route changes: none for the application. A new private/admin Grafana hostname or path will be introduced for operators.
- Security impact: Grafana becomes the only externally reachable observability UI; internal stores and collectors must remain ClusterIP-only and unauthenticated only inside the cluster network.
- Database schema changes: none expected.
