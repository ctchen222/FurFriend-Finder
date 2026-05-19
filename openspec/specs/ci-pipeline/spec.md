## Purpose

Define the repository CI workflow, quality-gate job graph, path-aware execution rules, and the boundary between CI checks and deployment-image validation.

## Requirements

### Requirement: CI workflow triggers on PR and branch push
The system SHALL run the CI workflow on every pull request targeting any branch, and on every push to `main` or `dev`. The workflow SHALL use `concurrency` to cancel in-progress runs for the same ref when a newer commit is pushed.

#### Scenario: PR opened or updated
- **WHEN** a pull request is opened, synchronized, or reopened
- **THEN** the CI workflow is triggered

#### Scenario: Push to main or dev
- **WHEN** a commit is pushed to `main` or `dev`
- **THEN** the CI workflow is triggered

#### Scenario: Concurrent runs cancelled
- **WHEN** a second push to the same ref arrives while CI is running
- **THEN** the in-progress run is cancelled and the new run starts

### Requirement: CI workflow detects changed paths before running expensive jobs
The system SHALL provide a `changes` job that runs before app and Helm validation jobs. The job SHALL use path filters to expose at least two outputs: `app` for application/tooling changes and `helm` for Helm chart changes.

#### Scenario: App path changed
- **WHEN** a pull request changes `src/**`, `package.json`, `tsconfig.json`, `pnpm-lock.yaml`, `eslint.config.js`, or `.github/actions/**`
- **THEN** the `changes` job sets `app` to `true`

#### Scenario: Helm path changed
- **WHEN** a pull request changes `deploy/furfriend-finder/**`
- **THEN** the `changes` job sets `helm` to `true`

#### Scenario: Unrelated path changed
- **WHEN** a pull request changes only files outside the configured app and Helm paths
- **THEN** the `changes` job completes and the path-filtered app and Helm jobs are skipped

### Requirement: lint job runs ESLint on app changes
The system SHALL provide a `lint` job that runs `pnpm lint` when `changes.outputs.app == true`. The `package.json` SHALL define a `lint` script as `eslint src/`.

#### Scenario: Lint passes
- **WHEN** app paths changed and all TypeScript source files under `src/` conform to ESLint rules
- **THEN** the `lint` job exits with code 0

#### Scenario: Lint skipped
- **WHEN** no app paths changed
- **THEN** the `lint` job is skipped

#### Scenario: Lint fails on violation
- **WHEN** app paths changed and a source file contains an ESLint rule violation
- **THEN** the `lint` job fails and `CI status gate` fails

### Requirement: type-check job validates TypeScript types on app changes
The system SHALL provide a `type-check` job that runs `pnpm type-check` (`tsc --noEmit`) when `changes.outputs.app == true`. The `package.json` SHALL define a `type-check` script as `tsc --noEmit`.

#### Scenario: Type check passes
- **WHEN** app paths changed and all TypeScript source files under `src/` have no type errors
- **THEN** the `type-check` job exits with code 0

#### Scenario: Type check skipped
- **WHEN** no app paths changed
- **THEN** the `type-check` job is skipped

#### Scenario: Type check fails on error
- **WHEN** app paths changed and a source file introduces a TypeScript type error
- **THEN** the `type-check` job fails and `CI status gate` fails

### Requirement: build job validates TypeScript compilation before merge
The system SHALL provide a `build` job that runs `pnpm run build` when `changes.outputs.app == true`. The job SHALL depend on `type-check` and SHALL use the shared Node.js setup action.

#### Scenario: Build passes
- **WHEN** app paths changed, `type-check` passes, and `pnpm run build` exits with code 0
- **THEN** the `build` job is marked successful

#### Scenario: Build skipped
- **WHEN** no app paths changed
- **THEN** the `build` job is skipped

#### Scenario: TypeScript compilation error blocks merge
- **WHEN** app paths changed and `pnpm run build` exits with a non-zero code
- **THEN** the `build` job fails and `CI status gate` fails

### Requirement: test-unit job runs Jest unit tests on app changes
The system SHALL provide a `test-unit` job that runs `pnpm test:unit` (`jest --testPathPattern='src/__test__/unit'`) when `changes.outputs.app == true`. This job SHALL depend on both `lint` and `type-check` passing before it starts.

#### Scenario: Unit tests pass
- **WHEN** app paths changed and all unit tests under `src/__test__/unit/` pass
- **THEN** the `test-unit` job exits with code 0 and `test-integration` is unblocked

#### Scenario: Unit tests skipped
- **WHEN** no app paths changed
- **THEN** the `test-unit` job is skipped

#### Scenario: Unit test failure blocks integration
- **WHEN** app paths changed and any unit test fails
- **THEN** the `test-unit` job fails and `CI status gate` fails

### Requirement: test-integration job runs Jest integration tests without a database
The system SHALL provide a `test-integration` job that runs `pnpm test:integration` (`jest --testPathPattern='src/__test__/integration'`) when `changes.outputs.app == true`. This job SHALL depend on `test-unit` passing. The job SHALL NOT configure any `services` such as PostgreSQL, as repository and service dependencies are mocked via `jest.mock()`.

#### Scenario: Integration tests pass
- **WHEN** app paths changed and all integration tests under `src/__test__/integration/` pass
- **THEN** the `test-integration` job exits with code 0

#### Scenario: Integration tests skipped
- **WHEN** no app paths changed
- **THEN** the `test-integration` job is skipped

#### Scenario: Integration test failure
- **WHEN** app paths changed and any integration test fails
- **THEN** the `test-integration` job fails and `CI status gate` fails

### Requirement: helm-validate job validates Helm chart correctness on Helm changes
The system SHALL provide a `helm-validate` job that runs `helm lint`, `helm template`, and `helm unittest` against `deploy/furfriend-finder/` when `changes.outputs.helm == true`. This job SHALL depend only on the lightweight path-detection job and SHALL NOT depend on `lint` or `type-check`. The job SHALL install the `helm-unittest` plugin before running tests.

#### Scenario: Helm chart passes all checks
- **WHEN** Helm paths changed and `helm lint`, `helm template --values deploy/furfriend-finder/values-production.yaml`, and `helm unittest` all succeed
- **THEN** the `helm-validate` job exits with code 0

#### Scenario: Helm validate skipped
- **WHEN** no Helm paths changed
- **THEN** the `helm-validate` job is skipped

#### Scenario: Helm template render failure
- **WHEN** Helm paths changed and a Helm template produces invalid YAML
- **THEN** the `helm-validate` job fails and `CI status gate` fails

#### Scenario: Helm unit test failure
- **WHEN** Helm paths changed and an assertion in `deploy/furfriend-finder/tests/*.yaml` does not match the rendered template
- **THEN** the `helm-validate` job fails and `CI status gate` fails

### Requirement: CI status gate aggregates path-filtered job results
The system SHALL provide a final `CI status gate` job that runs with `if: always()` and depends on `changes`, all app jobs, and `helm-validate`. The status gate SHALL fail when any upstream job failed or was cancelled, and SHALL pass when upstream jobs succeeded or were intentionally skipped by path filters.

#### Scenario: App-only change succeeds
- **WHEN** app paths changed, all app jobs pass, and `helm-validate` is skipped
- **THEN** `CI status gate` passes

#### Scenario: Helm-only change succeeds
- **WHEN** Helm paths changed, `helm-validate` passes, and app jobs are skipped
- **THEN** `CI status gate` passes

#### Scenario: Upstream job fails
- **WHEN** any upstream job reports `failure` or `cancelled`
- **THEN** `CI status gate` fails

### Requirement: pnpm dependencies are installed with frozen lockfile and cached
Every CI job that invokes `pnpm` SHALL install dependencies using `pnpm install --frozen-lockfile`. Node.js setup SHALL use `actions/setup-node@v4` with `cache: pnpm` to cache the pnpm store across runs, keyed to `pnpm-lock.yaml`.

#### Scenario: Cache hit on unchanged lockfile
- **WHEN** `pnpm-lock.yaml` has not changed since the last run
- **THEN** pnpm store cache is restored and `pnpm install` completes without downloading packages already present in the cache

#### Scenario: Lockfile modification attempted
- **WHEN** a workflow step would modify `pnpm-lock.yaml` during install
- **THEN** `--frozen-lockfile` causes the install to fail, surfacing the inconsistency

### Requirement: deploy-image validate job no longer runs tests
The `validate` job in `deploy-image.yml` SHALL NOT run `jest` or `helm unittest`. It SHALL retain only `pnpm install`, `pnpm build`, `helm lint`, and `helm template` as a minimal pre-image-build compilation and chart-render guard.

#### Scenario: Image build proceeds after successful build step
- **WHEN** `pnpm build` succeeds in the `validate` job
- **THEN** the `image` job is unblocked and proceeds to build the Docker image

#### Scenario: Test failures do not appear in deploy workflow output
- **WHEN** a unit or integration test fails
- **THEN** the failure is surfaced in `ci.yml`, not in `deploy-image.yml`
