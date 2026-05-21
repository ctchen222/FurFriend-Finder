# VPS GitOps Deployment

This runbook is the owner-operated path for deploying FurFriend Finder to the VPS. The repository owns GitHub Actions, GHCR image publishing, Helm charts, Argo CD manifests, encrypted Secret manifests, and desired GitOps state. The owner owns DNS, VPS SSH, kubeconfig, SOPS age private keys, GitHub repository settings, and live cluster verification.

## Deployment Model

```text
PR -> dev -> main
  -> GitHub Actions builds GHCR image
  -> Update GitOps image tag with GITOPS_DEPLOY_KEY
  -> Argo CD reads main
  -> VPS k3s reconciles app, secrets, and observability desired state
```

The normal deployment path never gives CI kubeconfig or VPS SSH access. CI only publishes an image and commits the desired image tag back to Git.

## 1. Host And Cluster Bootstrap

1. Point DNS `A` or `AAAA` records for the production domains at the VPS.
2. Restrict inbound firewall access to SSH, HTTP, and HTTPS.
3. Install single-node k3s.
4. Install cert-manager and create the production ClusterIssuer.
5. Install Argo CD in the `argocd` namespace.
6. Configure local kubectl access through `deploy/runbooks/local-kubectl-access.md`.

Safe to share: node readiness, certificate status, Argo CD application health. Do not share kubeconfig, SSH keys, tokens, or Secret data.

## 2. GitHub And GHCR Setup

Follow `deploy/runbooks/github-ghcr.md`.

Required production settings:

- GitHub Actions can publish GHCR packages.
- `Protect main` requires pull requests and `CI status gate`.
- `Protect main` bypass list uses only the `DeployKey` actor for GitOps image-tag updates.
- Repository secret `GITOPS_DEPLOY_KEY` contains the private key for the repo-scoped write deploy key.
- The write deploy key is only for updating GitOps image tags in this repository.

## 3. Secrets Bootstrap

Follow `deploy/runbooks/secrets.md`.

Required order:

1. Create or restore the local SOPS age private key.
2. Apply `sops-age-key` in the `argocd` namespace.
3. Apply the SOPS Config Management Plugin config.
4. Patch `argocd-repo-server` with the SOPS sidecar.
5. Wait for `argocd-repo-server` rollout.
6. Apply `deploy/argocd/secrets-application.yaml`.
7. Confirm required Secrets exist without printing values.

The `furfriend-secrets` Application creates the `observability` namespace and the Grafana admin Secret. Do not apply encrypted `*.sops.yaml` files directly with kubectl.

## 4. App Deployment

Apply the app Argo CD Application:

```sh
kubectl --context furfriend-vps apply -f deploy/argocd/application.yaml
kubectl --context furfriend-vps -n argocd get application furfriend-finder
```

Verify non-sensitive status:

```sh
kubectl --context furfriend-vps -n furfriend-finder get pods,jobs,cronjobs,ingress,pvc
kubectl --context furfriend-vps -n furfriend-finder logs job/furfriend-finder-schema
kubectl --context furfriend-vps -n furfriend-finder get deployment furfriend-finder
```

Verify schema readiness before treating production as ready:

```sh
kubectl --context furfriend-vps -n furfriend-finder exec statefulset/furfriend-finder-postgresql -- \
  psql -U furfriend -d furfriend_finder -c "\\dt"
```

Verify the public app health endpoint:

```sh
curl -fsS https://furfriend-finder.com/health
```

## 5. Observability Deployment

The production app is configured to export telemetry to:

```text
http://otel-collector.observability:4317
```

This only produces useful telemetry after the observability stack exists. Bootstrap order matters:

1. `furfriend-secrets` creates `observability` namespace and `furfriend-grafana-admin`.
2. `furfriend-observability` deploys OTel Collector, Prometheus, Tempo, Loki, and Grafana.
3. The app exports telemetry to the in-cluster Collector Service.

Apply the observability Argo CD Application:

```sh
kubectl --context furfriend-vps apply -f deploy/argocd/observability-application.yaml
kubectl --context furfriend-vps -n argocd get application furfriend-observability
```

Verify:

```sh
kubectl --context furfriend-vps -n observability get pods,svc,ingress,pvc
kubectl --context furfriend-vps -n furfriend-finder get configmap furfriend-finder-config \
  -o jsonpath='{.data.OTEL_SDK_DISABLED}{"\n"}{.data.OTEL_EXPORTER_OTLP_ENDPOINT}{"\n"}'
```

Expected app telemetry config:

```text
false
http://otel-collector.observability:4317
```

Use `deploy/runbooks/observability-stack.md` for Grafana datasource, dashboard, and persistence verification.

## 6. Deployment Failure Boundaries

Do not collapse these layers when debugging:

- GitHub Actions failure: image build or GitOps tag update did not complete.
- GitOps desired state failure: Git updated, but Argo CD has not synced the new revision.
- Cluster bootstrap failure: Argo CD, SOPS plugin, Secrets, namespaces, or ingress prerequisites are missing.
- Workload failure: Kubernetes resources exist, but Pods, Jobs, PVCs, certificates, or health checks fail.

Repo merge success does not prove the VPS deployed successfully. VPS deployment is confirmed only by Argo CD sync state and Kubernetes live resources.

## 7. Recovery Entry Points

- Image rollback: `deploy/runbooks/rollback.md`
- PostgreSQL backup/restore: `deploy/runbooks/backup-restore.md`
- VPS rebuild: `deploy/runbooks/vps-rebuild.md`
- Observability stack verification: `deploy/runbooks/observability-stack.md`
