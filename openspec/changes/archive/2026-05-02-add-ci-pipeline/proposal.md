## Why

The project currently has no dedicated CI workflow for code quality and testing. All validation — lint, type checking, unit tests, integration tests, and Helm chart validation — is bundled into a single `validate` job inside `deploy-image.yml`, which conflates CI and CD concerns and prevents fast, actionable feedback during pull request review.

## What Changes

- Add `.github/workflows/ci.yml`: a dedicated CI workflow with four sequential jobs (`lint`, `type-check`, `test-unit`, `test-integration`, `helm-validate`) that form a fail-fast DAG, triggered on all PRs and pushes to `main`/`dev`
- Add `lint` and `type-check` scripts to `package.json` (`eslint src/` and `tsc --noEmit`) — currently ESLint and TypeScript-ESLint are installed but have no runnable scripts
- Refactor `deploy-image.yml` validate job: remove `jest --runInBand` and `helm unittest` steps, keeping only `pnpm build`, `helm lint`, and `helm template` as pre-image-build guards; the new `ci.yml` becomes the authoritative test gate

## Capabilities

### New Capabilities

- `ci-pipeline`: Defines the GitHub Actions CI workflow structure, job dependency graph, trigger conditions, test type routing, and the boundary between CI (quality gate) and CD (deployment automation)

### Modified Capabilities

- None

## Impact

- `.github/workflows/ci.yml` — new file
- `.github/workflows/deploy-image.yml` — validate job simplified (remove jest and helm-unittest steps)
- `package.json` — add `lint` and `type-check` scripts
- No changes to application source code, routes, services, repositories, or database schema
- No changes to existing test files or `jest.config.js`
