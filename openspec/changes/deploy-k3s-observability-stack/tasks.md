## 1. OpenSpec Artifacts

- [x] 1.1 Sync current observability status from active and archived OpenSpec changes.
- [x] 1.2 Author the proposal for `deploy-k3s-observability-stack`.
- [x] 1.3 Author the design document covering current state, Helm topology, Grafana exposure, storage boundary, GitOps handoff, and verification.
- [x] 1.4 Author spec deltas for `observability` and `observability-deployment`.
- [x] 1.5 Run `openspec validate deploy-k3s-observability-stack` and resolve schema errors.
- [x] 1.6 Confirm `grafana-dashboard-provisioning` is complete or explicitly scoped before claiming baseline dashboard provisioning parity. Confirmed archived as `2026-05-19-grafana-dashboard-provisioning` with baseline dashboard JSON present.
- [x] 1.7 Confirm whether `add-observability-optimization-metrics` artifacts exist; if not, document optimization dashboards as a non-blocking follow-up. Confirmed no active change with that name exists; packaged currently available optimization dashboard JSON files as non-blocking optional artifacts.

## 2. Observability Helm Chart

- [x] 2.1 Add a dedicated Helm chart, tentatively `deploy/observability-stack`.
- [x] 2.2 Add values for image repositories/tags, resource requests/limits, storageClass, PVC sizes, retention settings, Grafana host, TLS secret, ClusterIssuer, and Grafana admin Secret reference.
- [x] 2.3 Render OTel Collector Deployment/Service/ConfigMap with OTLP gRPC, OTLP HTTP, and Prometheus exporter ports.
- [x] 2.4 Render Prometheus StatefulSet/Service/PVC/ConfigMap scraping the Collector metrics exporter.
- [x] 2.5 Render Tempo StatefulSet/Service/PVC/ConfigMap receiving traces from the Collector.
- [x] 2.6 Render Loki StatefulSet/Service/PVC/ConfigMap receiving logs from the Collector.
- [x] 2.7 Render Grafana Deployment/Service/PVC/ConfigMaps with datasource and dashboard provisioning.

## 3. Grafana-Only External Access

- [x] 3.1 Add Grafana Ingress with TLS and cert-manager ClusterIssuer support.
- [x] 3.2 Keep Collector, Prometheus, Tempo, and Loki Services as ClusterIP-only.
- [x] 3.3 Disable Grafana anonymous auth by default.
- [x] 3.4 Load Grafana admin credentials from an existing Kubernetes Secret.
- [x] 3.5 Document optional Traefik IP allowlisting or private-access alternatives for the owner.

## 4. Existing Functionality Parity

- [x] 4.1 Package the existing Collector config from `observability/otel-collector-config.yaml`.
- [x] 4.2 Package the existing Prometheus config from `observability/prometheus.yml`.
- [x] 4.3 Package the existing Tempo config from `observability/tempo.yaml`.
- [x] 4.4 Package the existing Loki config from `observability/loki.yaml`.
- [x] 4.5 Package Grafana datasource provisioning with stable UIDs: `prometheus`, `tempo`, and `loki`.
- [x] 4.6 Package the provisioned dashboards: application overview, business metrics, traces explorer, and logs explorer.
- [x] 4.7 Package optimization dashboards from `add-observability-optimization-metrics` if their JSON files exist; otherwise document them as a follow-up extension. Packaged currently available optimization dashboard JSON files from the Grafana provisioning directory.
- [x] 4.8 Adjust Docker Compose service hostnames to Kubernetes Service DNS names where required.

## 5. App Helm Integration

- [x] 5.1 Update production values to support telemetry-enabled deployment against the in-cluster Collector.
- [x] 5.2 Keep telemetry disabled as an explicit fallback for clusters that have not installed observability yet.
- [x] 5.3 Add Helm tests that assert `OTEL_SDK_DISABLED` and `OTEL_EXPORTER_OTLP_ENDPOINT` render correctly for both enabled and disabled telemetry modes.
- [x] 5.4 Add a runbook note explaining that the production app must not use `localhost` as the OTLP endpoint in k3s.

## 6. GitOps and Owner-Operated Setup

- [x] 6.1 Add an Argo CD Application manifest or equivalent GitOps entry for the observability Helm release.
- [x] 6.2 Add production values placeholders for Grafana host, namespace, storageClass, PVC sizes, and secret names.
- [x] 6.3 Add a Grafana admin Secret template without real credentials.
- [x] 6.4 Document owner-operated DNS/TLS steps for the Grafana hostname.
- [x] 6.5 Document owner-operated first sync and non-sensitive status outputs to report back.

## 7. Verification

- [x] 7.1 Run `helm lint deploy/observability-stack`.
- [x] 7.2 Run `helm template deploy/observability-stack` with production-like values.
- [x] 7.3 Add and run `helm unittest deploy/observability-stack`.
- [x] 7.4 Run `helm template deploy/furfriend-finder` to verify app telemetry config.
- [ ] 7.5 Owner verifies all observability Pods are ready in k3s.
- [ ] 7.6 Owner verifies only Grafana has an Ingress.
- [ ] 7.7 Owner verifies Grafana datasource health checks for Prometheus, Tempo, and Loki.
- [ ] 7.8 Owner generates app traffic and verifies dashboards show health, HTTP, DB pool, match, email, trace, and log data.
- [ ] 7.9 Owner verifies trace-to-log correlation from Grafana.
- [ ] 7.10 Owner restarts observability pods and verifies dashboards and recent data survive pod restarts.

## 1A. Owner-Operated Local kubectl Access Preflight
- [x] 1A.1 Document the SSH tunnel path from the local workstation to the VPS k3s API server, using an unused local port such as `127.0.0.1:16643` -> VPS `127.0.0.1:6443`.
- [x] 1A.2 Document copying the VPS k3s kubeconfig into an owner-only local file and treating it as secret-equivalent material.
- [x] 1A.3 Document renaming the copied kubeconfig context to `furfriend-vps`.
- [x] 1A.4 Document merging the VPS kubeconfig into `~/.kube/config` so daily usage can rely on `kubectl config use-context furfriend-vps`.
- [x] 1A.5 Document local verification commands for nodes, the `furfriend-finder` namespace, and Argo CD applications.
- [x] 1A.6 Explicitly defer public k3s API exposure, OIDC, kubelogin, and RBAC hardening until multi-user or always-on private access is required.
- [x] 1A.7 Owner runs the local `kubectl` verification commands through the SSH tunnel and records that `furfriend-vps` can read nodes, `furfriend-finder` resources, and Argo CD applications. Verified nodes, `furfriend-finder` namespace resources, and Argo CD application access through `furfriend-vps`.
