## 1. OpenSpec Replan

- [x] 1.1 Split the original broad deployment spec into repo-owned and owner-operated capability specs.
- [x] 1.2 Rework proposal and design around the authority boundary between agent work and VPS owner work.
- [x] 1.3 Replan tasks into independently verifiable workstreams.
- [x] 1.4 Run OpenSpec validation and resolve schema errors.

## 2. Repo-Owned Deployment Automation

- [x] 2.1 Migrate deployment workflows to pnpm and commit `pnpm-lock.yaml`.
- [x] 2.2 Replace the Dockerfile with a pinned Node LTS multi-stage build that compiles the app inside the image build.
- [x] 2.3 Add GitHub Actions install/test/build/image-publish workflow using pnpm and GHCR commit SHA tags.
- [x] 2.4 Add CI safeguards for GitOps image-tag commits: bot identity, skip condition, concurrency, and least-privilege workflow permissions.
- [x] 2.5 Add `/deploy` Helm chart for app Deployment, Service, Ingress, ConfigMap, Secret references, probes, resources, PostgreSQL StatefulSet/PVC/Service, schema initialization Job, backup CronJob, and helm-unittest suites covering key rendered resources.
- [x] 2.6 Add production values with placeholders for owner-provided domain, storageClass, GHCR image repository, and secret names.
- [x] 2.7 Add Argo CD Application manifest that tracks the production deployment path but does not require committing kubeconfig.
- [x] 2.8 Add SOPS configuration, encrypted-secret template, and owner-side local decrypt/apply instructions without real secret values.
- [x] 2.9 Add rollback, backup, restore, VPS rebuild, GitHub/GHCR setup, and telemetry configuration runbooks.
- [x] 2.10 Verify repo-owned artifacts with pnpm build/test, Docker build, `helm lint`, `helm template`, `helm unittest`, and OpenSpec validation.
- [x] 2.11 Add `deploy/ansible/inventory.ini.example`, `deploy/ansible/group_vars/vps.yml`, and `deploy/ansible/bootstrap.yml` covering base packages (including k3s dependencies, vim, htop), UFW firewall rules, and idempotent k3s installation.

## 3. Owner-Operated GitHub and VPS Bootstrap

- [x] 3.1 Configure GitHub Actions and GHCR settings needed for CI image publishing.
- [x] 3.2 Decide whether the GHCR package is public or private; if private, configure image pull access for the cluster.
- [x] 3.3 Install single-node k3s on the VPS and verify node readiness.
- [x] 3.4 Configure firewall and DNS so only SSH, HTTP, and HTTPS are exposed.
- [x] 3.5 Install cert-manager and verify a production ClusterIssuer can issue TLS certificates.
- [x] 3.6 Install Argo CD and connect it to the repository deployment path.
- [x] 3.7 Create and back up the SOPS age private key; provide only the public recipient for repo configuration.
- [x] 3.8 Encrypt production Kubernetes Secrets locally with SOPS, commit only encrypted manifests, then locally decrypt/apply the Kubernetes Secret to the cluster before first sync.
- [x] 3.9 Sync the production Argo CD application and verify database schema, app readiness, and `/health` over HTTPS.
- [x] 3.10 Trigger and verify the first PostgreSQL backup, then rehearse restore into a safe target.
- [x] 3.11 Configure or document an off-VPS backup copy path before treating backups as VPS-loss protection.

## 4. Handoff and Feedback Loop

- [x] 4.1 Owner reports non-sensitive bootstrap values: domain, namespace, storageClass, ingress class if non-default, and Argo CD app status.
- [x] 4.2 Adjust Helm values/templates based on owner-reported cluster behavior.
- [x] 4.3 Owner reports non-sensitive rollout output: Pod readiness, certificate readiness, migration/schema Job status, `/health` status, and backup file name.
- [x] 4.4 Resolve deployment issues through repo patches and repeat Argo CD sync until Healthy/Synced.

## 5. Closure Evidence

- [x] 5.1 Owner confirmed the VPS-side k3s, GitOps, secret, backup, and production deployment steps were executed because they require owner-only VPS, DNS, cluster-admin, and secret access.
- [x] 5.2 Verified the public production homepage at `https://www.furfriend-finder.com/` returns HTTP 200.
- [x] 5.3 Verified the public production health endpoint at `https://www.furfriend-finder.com/health` returns HTTP 200 with `status: ok` and PostgreSQL `status: up`.
