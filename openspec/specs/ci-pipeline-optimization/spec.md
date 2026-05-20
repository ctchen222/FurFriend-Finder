## Purpose

Define CI/CD optimization behavior that improves workflow maintainability, Docker build performance, and merge-gate enforceability.

## Requirements

### Requirement: Docker image builds use layer caching
The `deploy-image.yml` `Build and push` step SHALL configure `cache-from: type=gha` and `cache-to: type=gha,mode=max` on `docker/build-push-action`. This enables GitHub Actions Cache as the Docker layer cache backend, with all intermediate build stages cached.

#### Scenario: Source-only change with warm cache
- **WHEN** only files under `src/` change and `pnpm-lock.yaml` is unchanged
- **THEN** the Docker build restores cacheable dependency layers instead of re-running all dependency fetch work

#### Scenario: pnpm-lock.yaml changes invalidate deps cache
- **WHEN** `pnpm-lock.yaml` is modified in a commit
- **THEN** the dependency layer cache is invalidated and dependency fetch work re-runs

#### Scenario: First build or cache eviction
- **WHEN** no GHA cache entry exists for the current branch
- **THEN** the build completes without error and exports a new cache entry for subsequent runs

### Requirement: Node.js CI setup is defined once as a composite action
A composite action SHALL exist at `.github/actions/setup/action.yml` that performs Node.js CI setup: `corepack enable`, `actions/setup-node@v4` with Node 22 and `cache: pnpm`, and `pnpm install --frozen-lockfile`. Callers SHALL run `actions/checkout@v4` before invoking the composite action. All Node.js CI jobs (`lint`, `type-check`, `build`, `test-unit`, `test-integration`) SHALL use this action instead of duplicating setup steps inline.

#### Scenario: Composite action used in lint job
- **WHEN** the `lint` job runs
- **THEN** it checks out the repository, invokes `./.github/actions/setup`, and proceeds to `pnpm lint`

#### Scenario: Node version change is applied everywhere
- **WHEN** the Node.js version is updated in the composite action
- **THEN** all Node.js jobs that use the action pick up the change without individual edits

### Requirement: deploy-image workflow does not run on pull requests
`deploy-image.yml` SHALL NOT declare a `pull_request` trigger. The workflow SHALL only run on `push` to `main`.

#### Scenario: PR opened against main
- **WHEN** a pull request targeting `main` is opened or updated
- **THEN** `deploy-image.yml` is NOT triggered; only PR CI workflows run

#### Scenario: Merge commit pushed to main
- **WHEN** a commit is pushed to `main`
- **THEN** `deploy-image.yml` runs its `validate`, `image`, and `update-gitops` pipeline subject to its job-level conditions

### Requirement: Branch protection uses a stable aggregate CI gate
The `main` branch SHALL be configured with branch protection rules requiring `CI status gate` to pass before a pull request can be merged. This is an operator step performed in GitHub Settings after the workflow has run at least once and the status check appears in GitHub.

#### Scenario: Required aggregate check passes
- **WHEN** `CI status gate` reports success on a pull request
- **THEN** the CI status-check portion of branch protection is satisfied

#### Scenario: Required aggregate check fails
- **WHEN** `CI status gate` reports failure or is pending
- **THEN** branch protection blocks merging the pull request
