# k3s Observability Stack

This runbook covers the owner-operated steps for the Helm-managed observability stack. The repository owns the chart, values, Argo CD Application, tests, and templates. The owner owns DNS, real secrets, first sync, and live verification output.

## Runtime Boundary

The stack runs in the `observability` namespace:

- OTel Collector receives OTLP on `otel-collector:4317` and `otel-collector:4318`.
- Prometheus scrapes the Collector metrics exporter at `otel-collector:8889`.
- Tempo receives traces from the Collector.
- Loki receives logs from the Collector.
- Grafana is the only component exposed through Ingress.

Prometheus, Tempo, Loki, and OTel Collector must stay as `ClusterIP` Services. Do not add Ingress resources for them.

## Prerequisites

- Local `kubectl` access through the owner-operated SSH tunnel documented in `deploy/runbooks/local-kubectl-access.md`.
- Argo CD installed in the `argocd` namespace.
- cert-manager and Traefik available in the cluster.
- DNS for the Grafana host points to the VPS public IP.

The default production host is:

```text
dashboard.furfriend-finder.com
```

If a different hostname is used, update `deploy/observability-stack/values-production.yaml` before syncing Argo CD.

## Grafana Admin Secret

The repository includes the encrypted Grafana admin Secret at `deploy/secrets/grafana-admin.sops.yaml`. Edit it locally with SOPS when setting or rotating the password:

```bash
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
sops deploy/secrets/grafana-admin.sops.yaml
```

If the encrypted file must be recreated, start from the template:

```bash
cp deploy/secrets/grafana-admin.template.yaml deploy/secrets/grafana-admin.sops.yaml
sops --encrypt --in-place deploy/secrets/grafana-admin.sops.yaml
```

Commit only the encrypted `*.sops.yaml` file. Do not commit plaintext credentials or paste decrypted values into logs.

The chart expects:

```yaml
metadata:
  name: furfriend-grafana-admin
  namespace: observability
stringData:
  admin-user: admin
  admin-password: ...
```

## Optional IP Allowlisting

Grafana already requires login and TLS. If the owner has stable source IPs, create a Traefik allowlist middleware and set:

```yaml
grafana:
  ingress:
    traefikIpAllowlistMiddleware: observability-grafana-allowlist@kubernetescrd
```

Do not block the first deployment on IP allowlisting if the owner does not have stable source IPs.

## First Sync

Ensure the SOPS repo-server plugin and `furfriend-secrets` Application from `deploy/runbooks/secrets.md` are synced first. They create `furfriend-grafana-admin` from `deploy/secrets/grafana-admin.sops.yaml`.

Then add or sync the observability Argo CD Application:

```bash
kubectl --context furfriend-vps apply -f deploy/argocd/observability-application.yaml
kubectl --context furfriend-vps -n argocd get application furfriend-observability
```

Do not apply encrypted SOPS files directly with `kubectl`; Argo CD decrypts them through the `furfriend-secrets` Application.

## Non-Sensitive Status Output

After sync, record these outputs for debugging:

```bash
kubectl --context furfriend-vps -n observability get pods,svc,ingress,pvc
kubectl --context furfriend-vps -n argocd get application furfriend-observability
kubectl --context furfriend-vps -n furfriend-finder get configmap furfriend-finder-config -o jsonpath='{.data.OTEL_SDK_DISABLED}{"\n"}{.data.OTEL_EXPORTER_OTLP_ENDPOINT}{"\n"}'
```

The app should show:

```text
false
http://otel-collector.observability:4317
```

## Live Verification

Verify:

- All observability Pods are ready.
- Only Grafana has an Ingress.
- Grafana datasource health checks pass for Prometheus, Tempo, and Loki.
- App traffic appears in the application overview, business metrics, traces explorer, and logs explorer dashboards.
- Trace-to-log correlation works through shared trace IDs.
- Restarting Grafana, Prometheus, Tempo, Loki, and OTel Collector pods does not erase PVC-backed recent data.

PVC-backed storage is restart persistence, not off-VPS disaster recovery. Historical telemetry is not recoverable after PVC deletion, VPS disk loss, or VPS loss unless the production-hardening plan adds object-store-backed retention.
