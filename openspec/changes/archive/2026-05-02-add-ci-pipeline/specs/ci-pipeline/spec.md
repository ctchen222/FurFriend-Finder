## ADDED Requirements

### Requirement: CI workflow triggers on PR and branch push
The system SHALL run the CI workflow on every pull request targeting any branch, and on every push to `main` or `dev`. The workflow SHALL use `concurrency` to cancel in-progress runs for the same ref when a newer commit is pushed.

#### Scenario: PR opened or updated
- **WHEN** a pull request is opened, synchronized, or reopened
- **THEN** the CI workflow is triggered and all jobs run

#### Scenario: Push to main or dev
- **WHEN** a commit is pushed to `main` or `dev`
- **THEN** the CI workflow is triggered and all jobs run

#### Scenario: Concurrent runs cancelled
- **WHEN** a second push to the same ref arrives while CI is running
- **THEN** the in-progress run is cancelled and the new run starts

---

### Requirement: lint job runs ESLint on source code
The system SHALL provide a `lint` job that runs `pnpm lint` (ESLint over `src/`) with no upstream dependencies. The `package.json` SHALL define a `lint` script as `eslint src/`.

#### Scenario: Lint passes
- **WHEN** all TypeScript source files under `src/` conform to ESLint rules
- **THEN** the `lint` job exits with code 0

#### Scenario: Lint fails on violation
- **WHEN** a source file contains an ESLint rule violation
- **THEN** the `lint` job fails and downstream jobs (`test-unit`, `helm-validate`) do not start

---

### Requirement: type-check job validates TypeScript types
The system SHALL provide a `type-check` job that runs `pnpm type-check` (`tsc --noEmit`) with no upstream dependencies. The `package.json` SHALL define a `type-check` script as `tsc --noEmit`.

#### Scenario: Type check passes
- **WHEN** all TypeScript source files under `src/` have no type errors
- **THEN** the `type-check` job exits with code 0

#### Scenario: Type check fails on error
- **WHEN** a source file introduces a TypeScript type error
- **THEN** the `type-check` job fails and downstream jobs do not start

---

### Requirement: test-unit job runs Jest unit tests
The system SHALL provide a `test-unit` job that runs `pnpm test:unit` (`jest --testPathPattern='src/__test__/unit'`). This job SHALL depend on both `lint` and `type-check` passing before it starts.

#### Scenario: Unit tests pass
- **WHEN** all unit tests under `src/__test__/unit/` pass
- **THEN** the `test-unit` job exits with code 0 and `test-integration` is unblocked

#### Scenario: Unit test failure blocks integration
- **WHEN** any unit test fails
- **THEN** the `test-unit` job fails and `test-integration` does not start

---

### Requirement: test-integration job runs Jest integration tests without a database
The system SHALL provide a `test-integration` job that runs `pnpm test:integration` (`jest --testPathPattern='src/__test__/integration'`). This job SHALL depend on `test-unit` passing. The job SHALL NOT configure any `services` (e.g., PostgreSQL), as all repository and service dependencies are mocked via `jest.mock()`.

#### Scenario: Integration tests pass
- **WHEN** all integration tests under `src/__test__/integration/` pass
- **THEN** the `test-integration` job exits with code 0

#### Scenario: Integration test failure
- **WHEN** any integration test fails
- **THEN** the `test-integration` job fails and the workflow is marked failed

---

### Requirement: helm-validate job validates Helm chart correctness
The system SHALL provide a `helm-validate` job that runs `helm lint`, `helm template`, and `helm unittest` against `deploy/furfriend-finder/`. This job SHALL depend on both `lint` and `type-check` passing and SHALL run in parallel with `test-unit`. The job SHALL install the `helm-unittest` plugin before running tests.

#### Scenario: Helm chart passes all checks
- **WHEN** `helm lint`, `helm template --values deploy/furfriend-finder/values-production.yaml`, and `helm unittest` all succeed
- **THEN** the `helm-validate` job exits with code 0

#### Scenario: Helm template render failure
- **WHEN** a change to a Helm template causes `helm template` to produce invalid YAML
- **THEN** the `helm-validate` job fails

#### Scenario: Helm unit test failure
- **WHEN** an assertion in `deploy/furfriend-finder/tests/*.yaml` does not match the rendered template
- **THEN** the `helm-validate` job fails

---

### Requirement: pnpm dependencies are installed with frozen lockfile and cached
Every CI job that invokes `pnpm` SHALL install dependencies using `pnpm install --frozen-lockfile`. Node.js setup SHALL use `actions/setup-node@v4` with `cache: pnpm` to cache the pnpm store across runs, keyed to `pnpm-lock.yaml`.

#### Scenario: Cache hit on unchanged lockfile
- **WHEN** `pnpm-lock.yaml` has not changed since the last run
- **THEN** pnpm store cache is restored and `pnpm install` completes without downloading packages

#### Scenario: Lockfile modification attempted
- **WHEN** a workflow step would modify `pnpm-lock.yaml` during install
- **THEN** `--frozen-lockfile` causes the install to fail, surfacing the inconsistency

---

### Requirement: deploy-image validate job no longer runs tests
The `validate` job in `deploy-image.yml` SHALL NOT run `jest` or `helm unittest`. It SHALL retain only `pnpm install`, `pnpm build`, `helm lint`, and `helm template` as a minimal pre-image-build compilation guard.

#### Scenario: Image build proceeds after successful build step
- **WHEN** `pnpm build` succeeds in the `validate` job
- **THEN** the `image` job is unblocked and proceeds to build the Docker image

#### Scenario: Test failures do not appear in deploy workflow output
- **WHEN** a unit or integration test fails
- **THEN** the failure is surfaced in `ci.yml`, not in `deploy-image.yml`
