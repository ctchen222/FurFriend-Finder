# vps-operations Specification

## Purpose

Define the owner-operated VPS deployment contract for FurFriend Finder. The repository supplies desired state and automation, but the owner controls privileged VPS access, kubeconfig, DNS, TLS bootstrap, SOPS age private keys, Argo CD bootstrap, and live verification.

## Requirements

### Requirement: Owner-Controlled VPS Bootstrap

The VPS SHALL be bootstrapped by the project owner because it requires privileged host and cluster access.

#### Scenario: k3s node is ready

- **WHEN** the owner installs k3s on the VPS
- **THEN** `kubectl get nodes` SHALL report the node as Ready
- **AND** kubeconfig SHALL remain outside the repository
- **AND** only non-sensitive readiness output SHOULD be shared back for troubleshooting

#### Scenario: network entry is prepared

- **WHEN** the owner configures VPS networking and DNS
- **THEN** the production domain SHALL resolve to the VPS
- **AND** the firewall SHALL expose only required inbound ports for SSH, HTTP, and HTTPS
- **AND** the k3s API SHALL stay private by default, reachable through the owner-operated SSH tunnel or another private access path

### Requirement: Owner-Controlled TLS and Argo CD Bootstrap

The owner SHALL install and verify cluster-level components needed before GitOps can deploy the app.

#### Scenario: TLS issuer is ready

- **WHEN** cert-manager is installed
- **THEN** the owner SHALL create or apply a production ClusterIssuer
- **AND** a minimal Ingress test SHALL prove that TLS certificates can be issued before the application is promoted

#### Scenario: Argo CD is connected

- **WHEN** Argo CD is installed
- **THEN** the owner SHALL connect it to the repository deployment path
- **AND** Argo CD SHALL be able to read the repo without exposing cluster-admin credentials to CI
- **AND** Argo CD application health and sync status MAY be shared back as non-sensitive output

### Requirement: Owner-Controlled GitHub and GHCR Settings

The owner SHALL configure GitHub and GHCR settings that require repository or account permissions.

#### Scenario: CI can publish images

- **WHEN** the repo workflow is ready to publish a production image
- **THEN** the owner SHALL ensure GitHub Actions has package write permission for GHCR
- **AND** any required repository variables or secrets SHALL be configured by the owner

#### Scenario: GitOps tag update can push to protected main

- **WHEN** production image publishing is enabled
- **THEN** the owner SHALL configure one repo-scoped write deploy key for GitOps image-tag updates
- **AND** the private key SHALL be stored as `GITOPS_DEPLOY_KEY`
- **AND** the `Protect main` ruleset SHALL allow only the `DeployKey` actor to bypass the pull-request requirement for this automation path
- **AND** broad human, write-role, maintain-role, admin, or team bypass entries SHALL NOT be used for normal deployment automation

#### Scenario: cluster can pull images

- **WHEN** the production app image is private in GHCR
- **THEN** the owner SHALL configure Kubernetes image pull credentials
- **AND** those credentials SHALL remain outside the repository unless stored as SOPS-encrypted Secret material
- **AND** the owner MAY avoid image pull credentials by making the GHCR package public if that is acceptable

### Requirement: Owner-Controlled Secret Custody

Production secrets and SOPS age private keys SHALL remain under owner control.

#### Scenario: age key is created and backed up

- **WHEN** the owner creates the SOPS age key
- **THEN** the private key SHALL be stored outside the repository
- **AND** the owner SHALL back it up before relying on encrypted production secrets
- **AND** only the public age recipient SHALL be used in repo configuration

#### Scenario: production secrets are encrypted locally

- **WHEN** production secret values are ready
- **THEN** the owner SHALL encrypt them locally with SOPS
- **AND** only encrypted Kubernetes Secret manifests SHALL be committed
- **AND** plaintext `.env` files SHALL remain local-development only

#### Scenario: Argo CD can decrypt encrypted secrets

- **WHEN** encrypted production Secret manifests are managed through GitOps
- **THEN** the owner SHALL create the `sops-age-key` Secret in the `argocd` namespace
- **AND** the owner SHALL install the SOPS Config Management Plugin config
- **AND** the owner SHALL patch `argocd-repo-server` with the SOPS sidecar
- **AND** the age private key SHALL NOT be printed, committed, or shared

### Requirement: Owner-Controlled GitOps Deployment Sequence

The owner SHALL bootstrap Argo CD Applications in dependency order so desired state can reconcile cleanly.

#### Scenario: secrets sync precedes dependent workloads

- **WHEN** Argo CD SOPS decryption is ready
- **THEN** the owner SHALL apply or sync the `furfriend-secrets` Application
- **AND** it SHALL create the required namespaces and Kubernetes Secrets
- **AND** Grafana SHALL NOT be treated as ready until `furfriend-grafana-admin` exists in the `observability` namespace

#### Scenario: app sync succeeds

- **WHEN** Argo CD synchronizes the production application
- **THEN** Kubernetes SHALL create or update the app, PostgreSQL, Ingress, schema initialization, and backup resources
- **AND** app Pods SHALL become Ready
- **AND** the production HTTPS `/health` endpoint SHALL report success

#### Scenario: observability sync succeeds

- **WHEN** Argo CD synchronizes the observability Application
- **THEN** Kubernetes SHALL create the `observability` namespace resources for OTel Collector, Prometheus, Tempo, Loki, and Grafana
- **AND** only Grafana SHALL have an Ingress
- **AND** Grafana SHALL use the configured admin Secret and TLS hostname
- **AND** app telemetry SHALL export to the in-cluster Collector Service

### Requirement: Owner-Controlled First Production Verification

The owner SHALL perform and verify the first production synchronization on the VPS.

#### Scenario: database schema is verified

- **WHEN** the first app sync completes
- **THEN** the owner SHALL verify that the schema initialization or migration Job completed successfully
- **AND** required application tables SHALL exist before production traffic is considered ready
- **AND** `/health` success alone SHALL NOT complete first-sync verification

#### Scenario: observability stack is verified

- **WHEN** the observability Application reports synced and healthy
- **THEN** the owner SHALL verify Pods, Services, Ingresses, and PVCs in the `observability` namespace
- **AND** datasource health for Prometheus, Tempo, and Loki SHALL be verified in Grafana
- **AND** app traffic SHALL appear in dashboards before observability verification is considered complete

#### Scenario: cluster-specific values are reported safely

- **WHEN** repo templates need cluster-specific adjustment
- **THEN** the owner SHALL provide non-sensitive values such as domain, namespace, storageClass, ingress class, certificate status, Pod readiness, and Argo CD sync status
- **AND** secrets, kubeconfig, tokens, deploy keys, age private keys, and private SSH keys SHALL NOT be shared

### Requirement: Owner-Controlled Backup and Recovery Verification

The owner SHALL verify PostgreSQL backup and restore behavior on the VPS.

#### Scenario: first backup is verified

- **WHEN** the backup CronJob is installed
- **THEN** the owner SHALL trigger or wait for the first backup
- **AND** a timestamped dump file SHALL appear in the configured persistent VPS-mounted backup path
- **AND** only non-sensitive backup metadata SHOULD be shared for troubleshooting

#### Scenario: off-VPS copy is configured or explicitly deferred

- **WHEN** backup verification is complete
- **THEN** the owner SHALL either configure an off-VPS backup copy path
- **OR** explicitly record that current backups only protect against logical database damage and do not protect against total VPS loss

#### Scenario: restore is rehearsed safely

- **WHEN** a restore rehearsal is performed
- **THEN** the owner SHALL restore a selected dump into a safe target database or namespace
- **AND** production data SHALL NOT be overwritten without an explicit manual confirmation step

### Requirement: Owner-Controlled Operations Feedback Loop

The deployment process SHALL use owner-provided non-sensitive outputs to refine repo-owned artifacts.

#### Scenario: deployment issue requires repo change

- **WHEN** the owner reports a non-sensitive failure state
- **THEN** repo-owned Helm values, templates, workflows, specs, or runbooks SHALL be patched in Git
- **AND** Argo CD SHALL re-sync from Git after the owner approves or triggers the sync

#### Scenario: rollback is needed

- **WHEN** the current production release is faulty
- **THEN** the owner SHALL restore a previous image tag through GitOps state
- **AND** Argo CD SHALL synchronize the rollback to k3s
