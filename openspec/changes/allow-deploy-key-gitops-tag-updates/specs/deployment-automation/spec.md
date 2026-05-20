## MODIFIED Requirements

### Requirement: GHCR Image Publishing

The repository SHALL publish production images to GitHub Container Registry through GitHub Actions and SHALL update GitOps deployment state without weakening `main` branch protection for human writers.

#### Scenario: Main branch image publish

- **WHEN** a main branch commit passes install, test, and build checks
- **THEN** CI SHALL publish an image to GHCR
- **AND** the production image tag SHALL include the Git commit SHA

#### Scenario: Failed validation blocks deployment state

- **WHEN** install, tests, build, or image publish fail
- **THEN** CI SHALL NOT update production GitOps values
- **AND** no new production rollout SHALL be triggered by that failed commit

#### Scenario: GitOps value update uses authorized deploy-key bypass

- **WHEN** CI successfully publishes a production image from `main`
- **THEN** the GitOps image tag update SHALL be pushed with the repository secret `GITOPS_DEPLOY_KEY`
- **AND** the repository SHALL have exactly one write deploy key for this automation path
- **AND** the `DeployKey` actor SHALL be explicitly allowed to bypass the `main` pull-request requirement for this automation path
- **AND** developers, admins, broad roles, and human users SHALL remain unable to push directly to `main`

#### Scenario: GitOps value update is path-restricted

- **WHEN** the workflow prepares the GitOps image tag commit
- **THEN** the workflow SHALL fail before push if any file other than `deploy/furfriend-finder/values-production.yaml` is changed
- **AND** the intended diff SHALL only update the production image repository/tag block

#### Scenario: GitOps value update avoids recursive CI loops

- **WHEN** CI commits a production image tag update into GitOps values
- **THEN** the workflow SHALL use a deterministic commit message
- **AND** the workflow SHALL include `[skip image]` or an equivalent skip condition that prevents value-update commits from publishing another production image
- **AND** workflow concurrency SHALL prevent overlapping image publish and values-update runs for the same branch
- **AND** workflow permissions SHALL keep the default `GITHUB_TOKEN` repository contents permission read-only

### Requirement: GitOps Deployment State

The repository SHALL provide desired deployment state for Argo CD without storing cluster credentials, and the production image tag SHALL be updated through a protected automation path.

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
- **AND** the update SHALL succeed under the repository's protected `main` ruleset through the authorized deploy-key bypass
