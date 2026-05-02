## Context

Following the `add-ci-pipeline` change, the pipeline has five correctness and performance gaps identified through research into large open-source projects (tRPC, Turborepo, NestJS, Hono):

1. `deploy-image.yml` builds Docker images with zero layer caching despite the Dockerfile already using the optimal `pnpm fetch` multi-stage pattern
2. Four Node.js CI jobs duplicate five identical setup steps each (20 lines × 4 = 80 lines of boilerplate)
3. `helm-validate` depends on `lint` and `type-check` despite having no logical relationship to TypeScript code quality
4. `ci.yml` has no job that runs `pnpm run build`, so broken TypeScript compilation is not caught before merge
5. `deploy-image.yml` runs its `validate` job on PRs, duplicating work already done by `ci.yml`
6. Branch protection rules are not configured, making `ci.yml` checks advisory rather than enforced

The Dockerfile structure is already optimal — four stages (`base → deps → build/prod-deps → runtime`) with `pnpm fetch` isolated to the `deps` stage so that source-only changes never invalidate the dependency layer.

## Goals / Non-Goals

**Goals:**
- Reduce Docker image build time on source-only commits from ~3-5 min to ~30-60s
- Eliminate setup boilerplate duplication across Node.js CI jobs
- Ensure `helm-validate` starts immediately without waiting for unrelated checks
- Gate PR merges on successful `pnpm build`
- Remove the redundant PR run of `deploy-image.yml` once `ci.yml` covers quality checks
- Document the operator steps for branch protection configuration

**Non-Goals:**
- Jest test sharding (test suite under threshold: <300 tests, <5 min)
- `actions/upload-artifact` for build outputs (no cross-job sharing need)
- Container image vulnerability scanning with Trivy (supply chain incident in 2026-03-19, deferred)
- `pnpm audit` blocking gate (deferred; monitoring only)
- Switching Docker cache backend from `type=gha` to `type=registry` (10 GB GHA limit not yet reached)
- Upgrading `pnpm store` cache from `cache: pnpm` to explicit `actions/cache` (no measurable benefit at this scale)

## Decisions

### Decision 1: Docker cache backend — `type=gha` with `mode=max`

`type=gha` is the zero-configuration choice for GitHub-hosted runners. The alternative `type=registry` (using GHCR as a cache registry) is more durable across branches and immune to the 10 GB GHA cache limit, but adds setup complexity. The GHA approach is chosen first; upgrade to `type=registry` when cache eviction becomes a problem.

`mode=max` caches all intermediate build stages including the `deps` stage where `pnpm fetch` runs. `mode=min` only caches the final stage and would not help because the most expensive layer is `pnpm fetch` in `deps`. Cost: ~20-30s extra to export the cache on each push. Benefit: `pnpm fetch` (~60-90s) is skipped on every subsequent build where `pnpm-lock.yaml` has not changed.

### Decision 2: Composite action covers only Node.js setup, not Helm setup

The `helm-validate` job does not need Node.js at all. Creating a single composite action for all CI setup would force Helm jobs to install pnpm unnecessarily. The composite action is scoped to: checkout → corepack enable → setup-node (22, cache pnpm) → pnpm install --frozen-lockfile.

### Decision 3: `helm-validate` runs with no `needs`

Helm chart validation has no dependency on TypeScript lint or type checking results. The original `needs: [lint, type-check]` was added as a conservative fail-fast gate but introduces unnecessary serialization (~30-60s wait). Removing `needs` lets `helm-validate` start at t=0 alongside `lint` and `type-check`.

Tradeoff: if `lint` fails, `helm-validate` runner minutes are "wasted". Accepted because helm-validate is fast (~1 min) and Helm chart changes are orthogonal to TypeScript changes — both are cheap enough that parallel execution is always net better.

### Decision 4: `build` job placement in DAG

```
lint ──┬──────────────────────────────── test-unit ──── test-integration
       │                                      ↑
type-check ──── build ────────────────────────┘
       │
       └──── helm-validate (independent, no needs)
```

`build` needs `type-check` (not `lint`) because `tsc --noEmit` and `tsc` (emit) share the same type resolution. If `type-check` passes, `build` is very likely to succeed or fail on a separate concern (asset copying, missing files). `build` does not need to precede `test-unit` — tests mock all imports and do not depend on `dist/`.

**Alternative considered**: gating `test-unit` on `build`. Rejected because mocked unit tests do not run against compiled output and the serialization would increase wall-clock time.

### Decision 5: Remove `pull_request` trigger from `deploy-image.yml`

`deploy-image.yml`'s `validate` job currently runs on PRs, doing `pnpm build` + `helm lint` + `helm template`. After this change:
- `pnpm build` is covered by ci.yml `build` job
- `helm lint` + `helm template` are covered by ci.yml `helm-validate` job

The deploy workflow has no new information to add for PRs. Its only purpose is producing deployment artifacts (Docker image, gitops update), which are only needed on push to `main`. Removing the PR trigger eliminates one full runner invocation per PR.

**Prerequisite**: this is only safe after the `build` job is added to `ci.yml` (Decision 4). Removing the PR trigger before that would create a window where broken builds could be merged.

### Decision 6: Branch protection is an operator step

GitHub branch protection rules cannot be configured through workflow files — they require GitHub Settings UI or the GitHub API with admin credentials. The rules to configure are documented here and in the spec, but not automated.

## Risks / Trade-offs

- **GHA cache eviction**: GHA Cache has a 10 GB per-repo limit and evicts least-recently-used entries. If cache is evicted (e.g., after a long holiday), the next build pays full cost. Mitigation: acceptable — the next push after eviction rebuilds the cache automatically.
- **`helm-validate` runner minutes on lint failure**: With no `needs`, helm-validate consumes a runner even when lint is broken. Cost is <1 min per failed run. Accepted.
- **Branch protection not enforced until operator configures it**: CI remains advisory until the operator completes step 6. The implementation tasks include this as an explicit documented step.

## Migration Plan

1. Add composite action at `.github/actions/setup/action.yml`
2. Refactor `ci.yml` Node.js jobs to use composite action
3. Remove `needs` from `helm-validate`
4. Add `build` job to `ci.yml`
5. Add Docker build cache to `deploy-image.yml`
6. Remove `pull_request` trigger from `deploy-image.yml`
7. (Operator) Configure branch protection rules for `main`
