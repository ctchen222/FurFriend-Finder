## Why

The `add-ci-pipeline` change introduced a working CI/CD pipeline, but a subsequent audit (informed by research into 10k+ star open-source projects) identified six correctness and performance issues: Docker image builds have zero layer caching, four Node.js CI jobs duplicate identical setup boilerplate, `helm-validate` is unnecessarily serialized behind unrelated checks, the CI workflow has no `pnpm build` gate leaving compiled output unverified before merge, the deploy workflow redundantly runs on PRs once CI is the quality gate, and there are no branch protection rules enforcing CI as a merge requirement.

## What Changes

- Add Docker build layer caching (`cache-from`/`cache-to: type=gha,mode=max`) to `deploy-image.yml`'s `Build and push` step
- Extract a reusable composite action at `.github/actions/setup/action.yml` covering checkout → corepack → setup-node → pnpm install; refactor all four Node.js CI jobs to use it
- Remove `needs: [lint, type-check]` from `helm-validate` job so it starts at t=0 alongside other independent jobs
- Add a `build` job to `ci.yml` that runs `pnpm run build` (needs `type-check`) to gate merges on successful TypeScript compilation
- Remove the `pull_request` trigger from `deploy-image.yml` — once `ci.yml` is the required check, the deploy workflow only needs to run on `push: main`
- Document branch protection rule configuration required on GitHub (operator step, cannot be automated)

## Capabilities

### New Capabilities

- `ci-pipeline-optimization`: Defines the performance and correctness improvements to the CI/CD pipeline established by `add-ci-pipeline`, including caching strategy, job structure, and merge gate requirements

### Modified Capabilities

- `ci-pipeline`: The `build` job addition and `helm-validate` DAG change constitute requirement-level behavior changes to the existing CI pipeline spec

## Impact

- `.github/workflows/ci.yml` — add `build` job, refactor 4 jobs to use composite action, remove `needs` from `helm-validate`
- `.github/workflows/deploy-image.yml` — add Docker build cache, remove `pull_request` trigger
- `.github/actions/setup/action.yml` — new composite action file
- `package.json` — no changes
- No changes to application source code, tests, Helm charts, or database schema
- Branch protection rules require manual operator configuration in GitHub Settings
