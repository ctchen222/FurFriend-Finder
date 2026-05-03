## Context

The repo already has a Dockerfile, docker-compose services, a `/health` endpoint, and observability configuration. It does not yet have a production Helm chart, Argo CD application, GitHub Actions image publishing workflow, production secret workflow, or Kubernetes-native PostgreSQL deployment.

The target runtime is a single VPS running single-node k3s. The project owner is the only actor with permission to access the VPS, manage DNS, hold production secrets, and operate cluster-admin workflows. The implementation must respect that boundary.

## Goals / Non-Goals

**Goals:**

- Make all repo-owned deployment artifacts reviewable and testable without VPS access.
- Give the owner exact operator runbooks for privileged VPS, DNS, Argo CD, SOPS, and production secret steps.
- Keep CI responsible for test/build/image publication and Git state updates.
- Keep Argo CD responsible for applying desired state to k3s after the owner bootstraps it.
- Use GHCR commit SHA image tags for deterministic rollout and rollback.
- Run PostgreSQL in k3s with persistent storage and a daily logical backup path.
- Apply the existing database schema during deployment so a clean PostgreSQL instance is actually usable.

**Non-Goals:**

- Agent access to the VPS.
- Agent access to production secrets, kubeconfig, DNS credentials, or age private keys.
- Multi-node k3s high availability.
- Staging environment.
- Managed PostgreSQL.
- Application feature, route, or database schema changes.
- Deploying the observability stack to k3s in the first production cut; production shall run with telemetry disabled or pointed at an owner-provided endpoint until a separate observability deployment change is accepted.

## Workstream Decisions

### Decision 1: One OpenSpec change, two capability specs

This is one deployment initiative, but the specs are split by execution authority. `deployment-automation` covers artifacts an agent can implement in the repo. `vps-operations` covers privileged steps the owner must execute and verify.

### Decision 2: Same-repo `/deploy` GitOps layout

The first version keeps Helm chart, production values, SOPS templates, backup manifests, and Argo CD application definition in this repository. A separate infra repo can come later when multiple services make ownership separation worth the overhead.

### Decision 3: CI never directly deploys to the VPS

GitHub Actions builds, tests, publishes GHCR images, and updates GitOps values. It does not receive kubeconfig and does not run `kubectl` or `helm upgrade` against the VPS.

### Decision 4: Operator secrets stay owner-local until encrypted

Production secret values are never requested by the agent. The repo provides encrypted-manifest templates and commands. The owner creates the age key, stores the private key, encrypts real values locally, and commits only encrypted SOPS output.

### Decision 5: First version uses owner-side SOPS decryption, not Argo CD repo-server decryption

The first deployment does not install an Argo CD SOPS/KSOPS/helm-secrets plugin. Encrypted manifests remain the Git source of truth, but the owner decrypts them locally and applies the resulting Kubernetes Secret to the cluster before Argo CD syncs the application. This keeps age private key material out of Argo CD until we explicitly choose a plugin-based secret flow later.

### Decision 6: Database schema initialization is a deployment artifact

The Helm release includes a schema initialization or migration Job that applies the existing SQL schema to a clean PostgreSQL database before the app is expected to serve traffic. `/health` only proves connectivity, so deployment verification must also prove required tables exist.

### Decision 7: Helm chart behavior is covered by helm-unittest

The production Helm chart includes local unit tests using the `helm-unittest` plugin. These tests assert important rendered resources and value-driven behavior before anything is applied to k3s. This complements `helm lint` and `helm template`: lint catches chart structure issues, template proves rendering succeeds, and helm-unittest verifies that rendered Kubernetes objects contain the expected names, images, probes, secret references, ingress/TLS settings, PostgreSQL resources, schema Job, and backup CronJob wiring.

### Decision 8: VPS-local backups are first-line recovery, not full VPS-loss protection

The first version writes daily `pg_dump` files to a persistent VPS-mounted path and requires a restore rehearsal. This protects against logical database damage and some Kubernetes/PVC mistakes. Full VPS-loss protection requires an owner-operated off-VPS copy target, such as object storage, rsync to another host, or manual download, and is tracked explicitly as a follow-up owner operation.

### Decision 9: CI image-tag commits must avoid recursive deploy loops

The GitHub Actions workflow that updates GitOps values must use a bot identity, workflow concurrency, least-privilege permissions, and a skip condition so the bot commit does not endlessly trigger publish/update cycles.

### Decision 10: VPS outputs are non-sensitive handoff points

The owner can paste non-sensitive status outputs back into the development loop, such as `kubectl get nodes`, certificate status, Argo CD app health, rollout status, and backup file names. Sensitive values and kubeconfig stay local to the owner.

### Decision 11: Ansible Playbook is a repo artifact, not an owner-operated tool

The Ansible Playbook lives under `deploy/ansible/` alongside the Helm chart and runbooks. It is a
repo-owned artifact (Section 2) because it can be written and reviewed without VPS access. Executing
it is owner-operated (Section 3) because it requires SSH access to the VPS and a locally created
`inventory.ini` file with the VPS IP.

The Playbook covers package installation, UFW firewall rules, and k3s install — the exact steps in
`deploy/runbooks/vps-bootstrap.md` items 2–3. cert-manager and Argo CD installation are kept as
manual runbook steps because they involve applying Kubernetes CRDs and require kubeconfig context;
automating them via the Ansible `k8s` module is deferred unless operational burden grows.

`inventory.ini` (containing the VPS IP) is gitignored and created locally from `inventory.ini.example`.
The IP is not a secret, but keeping it local avoids environment-specific state in the repo.

## Risks / Trade-offs

- Risk: splitting specs can hide dependencies. Mitigation: tasks mark the handoff points where repo work waits for owner-provided non-sensitive values such as domain, storageClass, ingress class, and Argo CD app status.
- Risk: single-node k3s can lose app and database together. Mitigation: local backups and restore rehearsal reduce common database recovery risk; off-VPS backup copy is required before claiming VPS-loss recovery.
- Risk: SOPS key loss blocks rebuild. Mitigation: key custody and recovery are explicit requirements in `vps-operations`.
- Risk: owner-side SOPS decryption adds a manual step before Argo CD sync. Mitigation: keep it explicit in runbooks and defer repo-server SOPS plugins until the base deployment is working.
- Trade-off: same-repo GitOps creates deployment commits in the app repo. Acceptable for the first production setup; use consistent bot commits and keep `/deploy` isolated.
