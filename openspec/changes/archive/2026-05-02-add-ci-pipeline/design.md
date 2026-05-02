## Context

The project has a single workflow file (`deploy-image.yml`) that bundles both quality validation and deployment automation. Its `validate` job runs `jest --runInBand` (all tests serially), `pnpm build`, and three Helm steps in sequence. There is no separate CI workflow, and `package.json` has no `lint` or `type-check` scripts despite ESLint and TypeScript-ESLint being installed.

Current test inventory:
- **Unit tests** (`src/__test__/unit/`) — pure Jest, no external dependencies
- **Integration tests** (`src/__test__/integration/`) — Jest + Supertest, all repositories and services are `jest.mock()`'d; no real database required
- **Helm unit tests** (`deploy/furfriend-finder/tests/`) — `helm-unittest` plugin, pure template rendering against YAML fixtures; no cluster required
- **E2E tests** (`src/__test__/e2e/`) — Playwright, requires a running application; excluded from Jest via `testPathIgnorePatterns`
- **SMTP smoke test** (`src/scripts/mailgun-smoke-test.ts`) — requires real Mailgun credentials; manual post-deploy check only

## Goals / Non-Goals

**Goals:**
- Introduce a dedicated `ci.yml` workflow that acts as the authoritative quality gate for PRs and branch pushes
- Provide fast, actionable feedback by separating jobs and running cheap checks before expensive ones
- Route each test type to its correct phase (CI vs CD)
- Reduce duplication: test execution lives only in `ci.yml`, not also in `deploy-image.yml`

**Non-Goals:**
- E2E (Playwright) tests — require a running application; out of scope for this change
- SMTP smoke test — requires real credentials; remains a manual post-deploy step
- Coverage enforcement thresholds or coverage gates
- Docker layer caching optimisation in `deploy-image.yml`
- Branch protection rule configuration (operator action, outside repo automation)

## Decisions

### Decision 1: CI and CD workflows are separate files

`ci.yml` handles quality (lint, types, tests). `deploy-image.yml` handles deployment (build, push, gitops). They are independent workflows with different triggers and concerns.

**Alternative considered**: keep a single workflow with more jobs. Rejected because a failing lint check should not prevent a hotfix image push in an emergency; separation allows each workflow to evolve independently.

### Decision 2: Job DAG — partial parallelism

```
lint ─┬─────────────────────────────────── test-unit ─── test-integration
      │                                        ↑
type-check ──── helm-validate ────────────────┘
```

Concretely:
- `lint` and `type-check` run in parallel (no deps, ~30 s each)
- `test-unit` and `helm-validate` both need `lint` and `type-check` to pass, then run in parallel (~2 min and ~1 min respectively)
- `test-integration` needs `test-unit` to pass (~3 min)

**Rationale**: style and type errors are the cheapest to catch. Running unit tests before integration tests avoids spending time on controller-level tests when pure logic tests already fail.

### Decision 3: Integration tests require no database service container

All four integration test files mock every repository and service via `jest.mock()`. The `src/__test__/setup.ts` file sets `DATABASE_URL` as a dummy env var to satisfy module imports; no real connection is made. Therefore `services: postgres` is not needed in the CI job.

**Verified by**: reading `animalCtrler.test.ts` and `authController.test.ts` — every repository class is replaced with `jest.fn().mockImplementation(...)` before any import of application code runs.

### Decision 4: Test type routing via `--testPathPattern`

`jest.config.js` uses `testMatch` that covers all `.test.ts` files under `src/`. The existing `package.json` scripts already route by directory:
- `test:unit` → `jest --testPathPattern='src/__test__/unit'`
- `test:integration` → `jest --testPathPattern='src/__test__/integration'`

No changes to `jest.config.js` are required. New CI jobs call the existing npm scripts directly.

### Decision 5: `helm-validate` combines lint + template + unittest in one job

`helm lint`, `helm template`, and `helm unittest` are all static and fast (< 1 min total). Splitting them into three jobs adds scheduling overhead with no parallelism benefit. A single `helm-validate` job is cleaner.

**helm-unittest** requires installing the plugin (`helm plugin install`) before running. The CI job installs it fresh each run; there is no persistent Helm plugin cache across GitHub Actions runners.

### Decision 6: `deploy-image.yml` validate job keeps only `pnpm build`

After this change, `deploy-image.yml` validate retains:
- `pnpm install` + `pnpm build` — confirms the TypeScript source compiles to a distributable before Docker picks it up

It drops:
- `jest --runInBand` → moved to `ci.yml`
- `helm lint` / `helm template` / `helm unittest` → moved to `ci.yml`

`helm lint` and `helm template` remain as light guards in `deploy-image.yml` only if a future decision reinstates them; they are not required once `ci.yml` is the branch protection gate.

### Decision 7: pnpm setup via Corepack

```yaml
- run: corepack enable
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
```

This matches the existing `deploy-image.yml` pattern and avoids introducing a separate `pnpm/action-setup` action. `cache: pnpm` enables automatic `~/.pnpm-store` caching keyed to `pnpm-lock.yaml`.

## Risks / Trade-offs

- **Helm plugin download on every run** → `helm-unittest` has no official GitHub Actions cache support. Each CI run does a fresh `helm plugin install` (~5-10 s). Acceptable given the plugin is small and the download is from GitHub Releases.
- **`deploy-image.yml` can still run without `ci.yml` passing** → Until branch protection rules require `ci.yml` checks, the two workflows are independent. This is an operator configuration step outside this change.
- **`test:integration` running after `test:unit` adds latency on the happy path** → Integration tests (controller-level, fully mocked) could theoretically run in parallel with unit tests. The sequential ordering is a deliberate trade-off: unit failures are cheaper to diagnose and fix, so surfacing them first reduces wasted runner time when both suites would fail.

## Migration Plan

1. Add `lint` and `type-check` to `package.json` scripts
2. Add `.github/workflows/ci.yml`
3. Verify all jobs pass on a test PR
4. Remove `jest --runInBand`, `helm unittest`, `helm lint`, `helm template` from `deploy-image.yml` validate job
5. (Operator step) Add `ci.yml` job statuses as required checks in GitHub branch protection settings for `main`
