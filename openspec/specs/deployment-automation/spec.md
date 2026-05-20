# deployment-automation Specification

## Purpose
TBD - created by archiving change deploy-k3s-gitops. Update Purpose after archive.
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

The repository SHALL publish production images to GitHub Container Registry through GitHub Actions.

#### Scenario: Main branch image publish

- **WHEN** a main branch commit passes install, test, and build checks
- **THEN** CI SHALL publish an image to GHCR
- **AND** the production image tag SHALL include the Git commit SHA

#### Scenario: Failed validation blocks deployment state

- **WHEN** install, tests, build, or image publish fail
- **THEN** CI SHALL NOT update production GitOps values
- **AND** no new production rollout SHALL be triggered by that failed commit

#### Scenario: GitOps value update avoids recursive CI loops

- **WHEN** CI commits a production image tag update into GitOps values
- **THEN** the workflow SHALL use a bot identity and a deterministic commit message
- **AND** the workflow SHALL include a skip condition that prevents bot value-update commits from publishing another production image
- **AND** workflow concurrency SHALL prevent overlapping image publish and values-update runs for the same branch
- **AND** workflow permissions SHALL be limited to the package and contents permissions needed for image push and value update

### Requirement: Helm Production Manifests

The repository SHALL provide a Helm chart under `/deploy` that describes the production application and database release.

#### Scenario: Helm renders without cluster access

- **WHEN** an operator or CI runs `helm lint` and `helm template`
- **THEN** the chart SHALL render without requiring access to the VPS
- **AND** it SHALL include the app Deployment, Service, Ingress, ConfigMap, Secret references, readiness probe, and liveness probe
- **AND** it SHALL include PostgreSQL StatefulSet, PVC, Service, schema initialization Job, and backup CronJob resources

#### Scenario: Production values avoid plaintext secrets

- **WHEN** production values are committed
- **THEN** they SHALL define non-sensitive deployment settings such as image repository, image tag, domain placeholder, resources, and secret names
- **AND** they SHALL NOT contain plaintext SMTP, LINE, Google Geocoding, admin API key, database password, or SOPS age private key values

#### Scenario: Helm unit tests cover rendered production resources

- **WHEN** the production Helm chart is added under `/deploy`
- **THEN** the chart SHALL include helm-unittest test suites under the chart test path
- **AND** the tests SHALL assert rendered app Deployment, Service, Ingress, ConfigMap, Secret references, readiness probe, and liveness probe behavior
- **AND** the tests SHALL assert rendered PostgreSQL StatefulSet/PVC/Service, schema initialization Job, and backup CronJob behavior
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

### Requirement: GitOps Deployment State

The repository SHALL provide desired deployment state for Argo CD without storing cluster credentials.

#### Scenario: Argo CD application manifest exists

- **WHEN** the repo-owned deployment artifacts are complete
- **THEN** they SHALL include an Argo CD Application manifest or equivalent bootstrap manifest
- **AND** the manifest SHALL point to the production deployment path in Git
- **AND** it SHALL NOT include kubeconfig or cluster-admin credentials

#### Scenario: CI updates image tag through Git

- **WHEN** CI publishes a valid GHCR image
- **THEN** CI SHALL update the production image tag in GitOps values
- **AND** the update SHALL be represented as a Git commit
- **AND** the image tag SHALL map back to the source commit SHA

### Requirement: Secret and Operations Templates

The repository SHALL provide templates and runbooks that let the owner operate production without exposing secrets to the agent.

#### Scenario: SOPS template is prepared

- **WHEN** deployment automation artifacts are complete
- **THEN** the repo SHALL include SOPS configuration and a production Secret template
- **AND** the template SHALL be safe to commit without real secret values
- **AND** documentation SHALL explain how the owner encrypts real values locally

#### Scenario: owner-side secret apply workflow is documented

- **WHEN** encrypted production Secret manifests are committed
- **THEN** documentation SHALL explain that first-version Argo CD does not decrypt SOPS files in repo-server
- **AND** the owner SHALL have documented commands to decrypt locally and apply the resulting Kubernetes Secret before first sync
- **AND** decrypted Secret output SHALL remain untracked and outside Git

#### Scenario: Runbooks are available

- **WHEN** repo-owned deployment automation is complete
- **THEN** runbooks SHALL describe rollback, PostgreSQL schema initialization verification, backup verification, restore, off-VPS backup copy options, GitHub/GHCR setup, telemetry configuration, and VPS rebuild workflows
- **AND** runbooks SHALL identify which commands are owner-operated and which outputs are safe to share

### Requirement: Production Telemetry Configuration

The repository SHALL make the first production deployment behavior explicit when the k3s observability stack is not yet deployed.

#### Scenario: Observability stack is absent

- **WHEN** production values are rendered before a k3s observability stack exists
- **THEN** telemetry environment values SHALL either disable OTLP export or point to an owner-provided reachable endpoint
- **AND** the app SHALL still start without requiring an in-cluster OTel Collector

#### Scenario: Observability stack is deferred

- **WHEN** the deployment automation change is implemented
- **THEN** deploying OTel Collector, Prometheus, Grafana, Tempo, or Loki to k3s SHALL remain outside this change unless a later accepted spec adds it
- **AND** runbooks SHALL state this explicitly

