## Context

Following the `add-ci-pipeline` change, the pipeline has correctness and performance gaps identified through research into large open-source projects (tRPC, Turborepo, NestJS, Hono):

1. `deploy-image.yml` builds Docker images with zero layer caching despite the Dockerfile already using the optimal `pnpm fetch` multi-stage pattern
2. Four Node.js CI jobs duplicate five identical setup steps each (20 lines × 4 = 80 lines of boilerplate)
3. `helm-validate` depends on `lint` and `type-check` despite having no logical relationship to TypeScript code quality
4. `ci.yml` has no job that runs `pnpm run build`, so broken TypeScript compilation is not caught before merge
5. `deploy-image.yml` runs its `validate` job on PRs, duplicating work already done by `ci.yml`
6. `ci.yml` runs app and Helm checks even when only unrelated files changed
7. Path-filtered jobs need one stable branch-protection target so skipped jobs do not leave required checks pending
8. Branch protection rules are not configured, making `ci.yml` checks advisory rather than enforced

The Dockerfile structure is already optimal — four stages (`base → deps → build/prod-deps → runtime`) with `pnpm fetch` isolated to the `deps` stage so that source-only changes never invalidate the dependency layer.

## Goals / Non-Goals

**Goals:**
- Reduce Docker image build time on source-only commits from ~3-5 min to ~30-60s
- Eliminate setup boilerplate duplication across Node.js CI jobs
- Ensure `helm-validate` starts immediately without waiting for unrelated checks
- Gate PR merges on successful `pnpm build`
- Skip app and Helm jobs when a PR only changes unrelated files
- Provide a stable aggregate `CI status gate` required check for branch protection
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

### Decision 3: Path-aware CI job selection

CI starts with a lightweight `changes` job powered by `dorny/paths-filter`. It exposes two outputs:

- `app`: true for `src/**`, `package.json`, `tsconfig.json`, `pnpm-lock.yaml`, `eslint.config.js`, and `.github/actions/**`
- `helm`: true for `deploy/furfriend-finder/**`

App jobs (`lint`, `type-check`, `build`, `test-unit`, `test-integration`) run only when `app == true`. `helm-validate` runs only when `helm == true`. This avoids spending runner minutes on checks that cannot be affected by the current diff.

The path filters are intentionally conservative. Workflow changes that affect job definitions should still be reviewed carefully, and `.github/actions/**` is included because changes to the local composite action directly affect Node.js CI execution.

### Decision 4: `helm-validate` runs independently after path detection

Helm chart validation has no dependency on TypeScript lint or type checking results. The original `needs: [lint, type-check]` was added as a conservative fail-fast gate but introduces unnecessary serialization (~30-60s wait). Removing `needs` lets `helm-validate` start at t=0 alongside `lint` and `type-check`.

With path filtering, `helm-validate` still depends on the lightweight `changes` job so it can skip non-Helm diffs. It no longer depends on `lint` or `type-check`.

### Decision 5: `build` job placement in DAG

```
changes ── app=true ── lint ─────────────── test-unit ── test-integration
        │              type-check ── build ─────┘
        │
        └─ helm=true ── helm-validate

status-gate depends on all jobs and accepts skipped path-filtered jobs.
```

`build` needs `type-check` (not `lint`) because `tsc --noEmit` and `tsc` (emit) share the same type resolution. If `type-check` passes, `build` is very likely to succeed or fail on a separate concern (asset copying, missing files). `build` does not need to precede `test-unit` — tests mock all imports and do not depend on `dist/`.

**Alternative considered**: gating `test-unit` on `build`. Rejected because mocked unit tests do not run against compiled output and the serialization would increase wall-clock time.

### Decision 6: Stable `status-gate` for branch protection

Path filtering means individual jobs can be skipped. If branch protection requires each path-filtered job directly, GitHub can leave required checks pending or force unrelated jobs to run just to satisfy branch protection.

The workflow therefore adds a final `status-gate` job with `if: always()` and `needs` on all CI jobs. It fails if any upstream job failed or was cancelled, and passes when jobs passed or were intentionally skipped. Branch protection should require `CI status gate` as the stable aggregate check.

### Decision 7: Remove `pull_request` trigger from `deploy-image.yml`

`deploy-image.yml`'s `validate` job currently runs on PRs, doing `pnpm build` + `helm lint` + `helm template`. After this change:
- `pnpm build` is covered by ci.yml `build` job
- `helm lint` + `helm template` are covered by ci.yml `helm-validate` job

The deploy workflow has no new information to add for PRs. Its only purpose is producing deployment artifacts (Docker image, gitops update), which are only needed on push to `main`. Removing the PR trigger eliminates one full runner invocation per PR.

**Prerequisite**: this is only safe after the `build` job is added to `ci.yml` (Decision 4). Removing the PR trigger before that would create a window where broken builds could be merged.

### Decision 8: Branch protection is an operator step

GitHub branch protection rules cannot be configured through workflow files — they require GitHub Settings UI or the GitHub API with admin credentials. The rules to configure are documented here and in the spec, but not automated.

## Risks / Trade-offs

- **GHA cache eviction**: GHA Cache has a 10 GB per-repo limit and evicts least-recently-used entries. If cache is evicted (e.g., after a long holiday), the next build pays full cost. Mitigation: acceptable — the next push after eviction rebuilds the cache automatically.
- **Path filter drift**: If new app-affecting files are introduced and not added to the `app` filter, CI could skip checks incorrectly. Mitigation: keep filters conservative and update them with new build/test inputs.
- **Skipped job branch protection confusion**: Requiring individual skipped jobs can make PR checks confusing. Mitigation: require `CI status gate` as the stable branch protection check.
- **Branch protection not enforced until operator configures it**: CI remains advisory until the operator completes step 6. The implementation tasks include this as an explicit documented step.

## Migration Plan

1. Add composite action at `.github/actions/setup/action.yml`
2. Refactor `ci.yml` Node.js jobs to use composite action
3. Add path-aware `changes` job to `ci.yml`
4. Remove direct `lint`/`type-check` dependency from `helm-validate`
5. Add `build` job to `ci.yml`
6. Add final `status-gate` job to aggregate path-filtered job results
7. Add Docker build cache to `deploy-image.yml`
8. Remove `pull_request` trigger from `deploy-image.yml`
9. (Operator) Configure branch protection rules for `main`
