# deployment-automation Specification

## Purpose

Define the repo-owned deployment automation contract for FurFriend Finder. The repository owns the container build, GHCR publishing, Helm charts, Argo CD desired state, GitOps image-tag updates, and local validation. The repository SHALL NOT require VPS SSH, kubeconfig, cluster-admin credentials, or plaintext production secrets to build, validate, publish, or update desired deployment state.

## Requirements

### Requirement: Reproducible Repo-Owned Image Build

The repository SHALL define a production container build that can be executed from a clean checkout without VPS access.

#### Scenario: Clean CI build

- **WHEN** CI builds the production image from a clean checkout
- **THEN** dependency installation SHALL use pnpm with a committed lockfile
- **AND** TypeScript compilation SHALL happen during the image build
- **AND** the runtime image SHALL NOT depend on a pre-existing local `dist` directory

#### Scenario: Runtime health smoke test

- **WHEN** the production image starts with required environment variables and a reachable PostgreSQL endpoint
- **THEN** it SHALL run the compiled application
- **AND** it SHALL expose the configured `PORT`
- **AND** `GET /health` SHALL return success

### Requirement: GHCR Image Publishing

The repository SHALL publish production images to GitHub Container Registry through GitHub Actions after changes land on `main`.

#### Scenario: Main branch image publish

- **WHEN** a `main` branch commit passes deployment-image validation
- **THEN** CI SHALL publish an image to GHCR
- **AND** the production image tag SHALL include the Git commit SHA

#### Scenario: Failed validation blocks deployment state

- **WHEN** install, build, Helm lint, Helm render, or image publish fails
- **THEN** CI SHALL NOT update production GitOps values
- **AND** no new production rollout SHALL be triggered by that failed commit

### Requirement: Protected GitOps Image Tag Updates

The repository SHALL update production GitOps image state without weakening `main` branch protection for human writers.

#### Scenario: Deploy key updates the production image tag

- **WHEN** CI successfully publishes a production image from `main`
- **THEN** the `Update GitOps image tag` job SHALL update `deploy/furfriend-finder/values-production.yaml`
- **AND** the update SHALL be pushed with the repository secret `GITOPS_DEPLOY_KEY`
- **AND** the `GITHUB_TOKEN` repository contents permission SHALL remain read-only for that job
- **AND** the resulting Git commit SHALL map the production image tag back to the source commit SHA

#### Scenario: GitOps update is file and field restricted

- **WHEN** the workflow prepares the GitOps image tag commit
- **THEN** the workflow SHALL fail before push if any file other than `deploy/furfriend-finder/values-production.yaml` is changed
- **AND** the intended diff SHALL only update the production image `repository` and `tag` lines

#### Scenario: GitOps update avoids recursive image publish loops

- **WHEN** CI commits a production image tag update into GitOps values
- **THEN** the workflow SHALL use a deterministic commit message containing `[skip image]`
- **AND** `Build and publish GHCR image` SHALL be skipped for that tag-update commit
- **AND** `Update GitOps image tag` SHALL be skipped for that tag-update commit
- **AND** workflow concurrency SHALL prevent overlapping image publish and values-update runs for the same branch

### Requirement: Helm Production Manifests

The repository SHALL provide Helm charts under `/deploy` that describe production Kubernetes resources.

#### Scenario: app chart renders without cluster access

- **WHEN** an operator or CI runs `helm lint` and `helm template` for `deploy/furfriend-finder`
- **THEN** the chart SHALL render without requiring access to the VPS
- **AND** it SHALL include the app Deployment, Service, Ingress, ConfigMap, Secret references, readiness probe, and liveness probe
- **AND** it SHALL include PostgreSQL StatefulSet, PVC, Service, schema initialization Job, and backup CronJob resources

#### Scenario: observability chart renders without cluster access

- **WHEN** an operator or CI runs `helm lint` and `helm template` for `deploy/observability-stack`
- **THEN** the chart SHALL render without requiring access to the VPS
- **AND** it SHALL include OTel Collector, Prometheus, Tempo, Loki, Grafana, Services, PVC-backed storage, Grafana Ingress, datasources, and dashboard provisioning
- **AND** only Grafana SHALL be externally exposed by the rendered observability manifests

#### Scenario: Production values avoid plaintext secrets

- **WHEN** production values are committed
- **THEN** they SHALL define non-sensitive deployment settings such as image repository, image tag, domain, resources, storage sizes, and secret names
- **AND** they SHALL NOT contain plaintext SMTP, LINE, Google Geocoding, admin API key, database password, Grafana admin password, or SOPS age private key values

#### Scenario: Helm unit tests cover rendered production resources

- **WHEN** production Helm charts are changed
- **THEN** chart test suites SHALL assert key rendered resources and safety boundaries
- **AND** the tests SHALL run locally with `helm unittest` without requiring VPS or Kubernetes cluster access
- **AND** CI SHALL fail when helm-unittest assertions fail

### Requirement: Database Schema Initialization

The repository SHALL provide a deployment path that initializes the production PostgreSQL schema before the app is considered ready for real traffic.

#### Scenario: Clean database is initialized

- **WHEN** the Helm release is applied to a clean PostgreSQL instance
- **THEN** a schema initialization or migration Job SHALL apply the project SQL schema
- **AND** the Job SHALL complete before production verification treats the application as ready
- **AND** the Job SHALL NOT require manual execution of SQL from an operator shell for the normal deployment path

#### Scenario: Required tables are verified

- **WHEN** deployment verification runs after schema initialization
- **THEN** it SHALL verify that core tables from the existing schema exist
- **AND** `/health` success alone SHALL NOT be treated as proof that the database schema is ready

### Requirement: Argo CD Desired State

The repository SHALL provide desired deployment state for Argo CD without storing cluster credentials.

#### Scenario: app Application manifest exists

- **WHEN** repo-owned app deployment artifacts are complete
- **THEN** the repository SHALL include an Argo CD Application manifest for `deploy/furfriend-finder`
- **AND** the manifest SHALL point to `main`
- **AND** it SHALL NOT include kubeconfig, cluster-admin credentials, or GitHub deploy keys

#### Scenario: secrets Application manifest exists

- **WHEN** encrypted production secret manifests are managed through GitOps
- **THEN** the repository SHALL include an Argo CD Application manifest for `deploy/secrets`
- **AND** it SHALL use the SOPS Config Management Plugin
- **AND** it SHALL NOT require plaintext Secret manifests to be committed

#### Scenario: observability Application manifest exists

- **WHEN** the k3s observability stack is repo-owned
- **THEN** the repository SHALL include an Argo CD Application manifest for `deploy/observability-stack`
- **AND** it SHALL target the `observability` namespace
- **AND** it SHALL depend operationally on the Grafana admin Secret being available before Grafana can become ready

### Requirement: Secret and Operations Templates

The repository SHALL provide templates and runbooks that let the owner operate production without exposing secrets to the agent.

#### Scenario: SOPS templates are prepared

- **WHEN** production secret automation artifacts are complete
- **THEN** the repository SHALL include SOPS configuration and Secret templates
- **AND** templates SHALL be safe to commit without real secret values
- **AND** documentation SHALL explain how the owner encrypts real values locally

#### Scenario: encrypted secrets are GitOps-managed

- **WHEN** encrypted production Secret manifests are committed
- **THEN** Argo CD SHALL decrypt them through the repo-server SOPS plugin after owner bootstrap
- **AND** decrypted Secret output SHALL remain untracked and outside Git
- **AND** the age private key SHALL NOT be stored in the repository

#### Scenario: Runbooks are available

- **WHEN** repo-owned deployment automation is complete
- **THEN** runbooks SHALL describe VPS GitOps deployment, GitHub/GHCR setup, secrets/SOPS bootstrap, observability bootstrap, rollback, PostgreSQL backup/restore, and VPS rebuild workflows
- **AND** runbooks SHALL identify which commands are owner-operated and which outputs are safe to share

### Requirement: Production Telemetry Configuration

The repository SHALL make the production application telemetry dependency explicit.

#### Scenario: Observability stack is installed

- **WHEN** the production app is configured for the k3s observability stack
- **THEN** `OTEL_SDK_DISABLED` SHALL render as `false`
- **AND** `OTEL_EXPORTER_OTLP_ENDPOINT` SHALL point to `http://otel-collector.observability:4317`
- **AND** the app SHALL NOT use `localhost` as the OTLP endpoint in k3s

#### Scenario: Observability stack is absent

- **WHEN** the observability stack is intentionally disabled or not yet installed
- **THEN** the app SHALL still start and serve traffic
- **AND** operators SHALL treat missing telemetry data as a deployment dependency gap, not as proof that application deployment failed
