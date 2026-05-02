## ADDED Requirements

### Requirement: Docker image builds use layer caching
The `deploy-image.yml` `Build and push` step SHALL configure `cache-from: type=gha` and `cache-to: type=gha,mode=max` on `docker/build-push-action`. This enables GitHub Actions Cache as the Docker layer cache backend, with all intermediate build stages cached.

#### Scenario: Source-only change with warm cache
- **WHEN** only files under `src/` change and `pnpm-lock.yaml` is unchanged
- **THEN** the Docker build restores the `deps` stage from cache, skipping `pnpm fetch`, and total build time is under 90 seconds

#### Scenario: pnpm-lock.yaml changes invalidate deps cache
- **WHEN** `pnpm-lock.yaml` is modified in a commit
- **THEN** the `deps` stage cache is invalidated and `pnpm fetch` re-runs in full

#### Scenario: First build or cache eviction
- **WHEN** no GHA cache entry exists for the current branch
- **THEN** the build completes without error and exports a new cache entry for subsequent runs

---

### Requirement: Node.js CI setup is defined once as a composite action
A composite action SHALL exist at `.github/actions/setup/action.yml` that performs: `actions/checkout@v4` → `corepack enable` → `actions/setup-node@v4` (node 22, cache pnpm) → `pnpm install --frozen-lockfile`. All Node.js CI jobs (`lint`, `type-check`, `build`, `test-unit`, `test-integration`) SHALL use this action instead of duplicating the steps inline.

#### Scenario: Composite action used in lint job
- **WHEN** the `lint` job runs
- **THEN** it invokes `./.github/actions/setup` as its first step and proceeds directly to `pnpm lint`

#### Scenario: Node version change is applied everywhere
- **WHEN** the Node.js version is updated in the composite action
- **THEN** all five Node.js jobs pick up the change without individual edits

---

### Requirement: build job validates TypeScript compilation before merge
`ci.yml` SHALL include a `build` job that runs `pnpm run build`. This job SHALL declare `needs: [type-check]`. The job SHALL use the composite setup action.

#### Scenario: Build passes
- **WHEN** `pnpm run build` exits with code 0
- **THEN** the `build` job is marked successful

#### Scenario: TypeScript compilation error blocks merge
- **WHEN** `pnpm run build` exits with a non-zero code due to a TypeScript error
- **THEN** the `build` job fails and the PR cannot be merged (once branch protection is configured)

---

### Requirement: helm-validate runs independently without waiting for lint or type-check
The `helm-validate` job in `ci.yml` SHALL NOT declare `needs: [lint, type-check]`. It SHALL start at t=0 alongside `lint` and `type-check`.

#### Scenario: helm-validate starts at workflow trigger
- **WHEN** the CI workflow is triggered
- **THEN** `helm-validate` starts immediately without waiting for any other job to complete

#### Scenario: helm-validate failure is independent
- **WHEN** `helm-validate` fails
- **THEN** `lint` and `type-check` continue running unaffected

---

### Requirement: deploy-image workflow does not run on pull requests
`deploy-image.yml` SHALL NOT declare a `pull_request` trigger. The workflow SHALL only run on `push` to `main`.

#### Scenario: PR opened against main
- **WHEN** a pull request targeting `main` is opened or updated
- **THEN** `deploy-image.yml` is NOT triggered; only `ci.yml` runs

#### Scenario: Merge commit pushed to main
- **WHEN** a commit is pushed to `main`
- **THEN** `deploy-image.yml` runs its full `validate → image → update-gitops` pipeline

---

### Requirement: Branch protection rules enforce CI as a required merge gate
The `main` branch SHALL be configured with branch protection rules requiring the following status checks to pass before a pull request can be merged: `Lint`, `Type check`, `Build`, `Unit tests`, `Integration tests`, `Helm validate`. This is an operator step performed in GitHub Settings.

#### Scenario: All CI checks pass
- **WHEN** all six required status checks report success on a pull request
- **THEN** the merge button is enabled

#### Scenario: Any CI check fails
- **WHEN** any of the six required status checks fails or is pending
- **THEN** the merge button is disabled and the PR cannot be merged
