## 1. Composite action

- [x] 1.1 Create `.github/actions/setup/action.yml` with steps: checkout → corepack enable → setup-node@v4 (node 22, cache pnpm) → pnpm install --frozen-lockfile
- [x] 1.2 Refactor `lint` job in `ci.yml` to use `- uses: ./.github/actions/setup` instead of the four inline steps
- [x] 1.3 Refactor `type-check` job in `ci.yml` to use composite action
- [x] 1.4 Refactor `test-unit` job in `ci.yml` to use composite action
- [x] 1.5 Refactor `test-integration` job in `ci.yml` to use composite action
- [x] 1.6 Verify `pnpm lint`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:integration` still run after refactor (yaml syntax check)

## 2. helm-validate DAG fix

- [x] 2.1 Remove direct `needs: [lint, type-check]` from `helm-validate` job in `ci.yml`
- [x] 2.2 Confirm `helm-validate` only depends on the lightweight path-detection job

## 3. Add build job to ci.yml

- [x] 3.1 Add `build` job to `ci.yml` with `needs: [changes, type-check]`
- [x] 3.2 `build` job uses composite action and runs `pnpm run build`
- [x] 3.3 Confirm the updated DAG: changes → app jobs and Helm jobs based on path filters; build depends on type-check; integration tests depend on unit tests

## 4. Path-aware CI execution

- [x] 4.1 Add `changes` job using `dorny/paths-filter@v3`
- [x] 4.2 Add `app` filter for source, package, TypeScript, lockfile, ESLint, and local composite action changes
- [x] 4.3 Add `helm` filter for `deploy/furfriend-finder/**`
- [x] 4.4 Gate Node.js jobs with `if: needs.changes.outputs.app == 'true'`
- [x] 4.5 Gate `helm-validate` with `if: needs.changes.outputs.helm == 'true'`

## 5. CI status gate

- [x] 5.1 Add final `status-gate` job with `if: always()`
- [x] 5.2 Make `status-gate` depend on `changes`, all app jobs, and `helm-validate`
- [x] 5.3 Fail `status-gate` when any upstream job is `failure` or `cancelled`
- [x] 5.4 Allow `success` and intentionally `skipped` upstream jobs

## 6. Docker build cache

- [x] 6.1 Add `cache-from: type=gha` to `Build and push` step in `deploy-image.yml`
- [x] 6.2 Add `cache-to: type=gha,mode=max` to `Build and push` step in `deploy-image.yml`

## 7. Remove deploy-image PR trigger

- [x] 7.1 Remove the `pull_request` block from the `on:` trigger in `deploy-image.yml`
- [x] 7.2 Confirm `deploy-image.yml` only triggers on `push: branches: [main]`

## 8. Branch protection rules (operator step)

- [ ] 8.1 Push this branch and open a PR to trigger `ci.yml` at least once so all job names appear in GitHub's status check list
- [ ] 8.2 Navigate to GitHub → Settings → Branches → Add rule → Branch name pattern: `main`
- [ ] 8.3 Enable: Require a pull request before merging
- [ ] 8.4 Enable: Require status checks to pass before merging → search and add: `CI status gate`
- [ ] 8.5 Enable: Require branches to be up to date before merging
- [ ] 8.6 Enable: Do not allow bypassing the above settings
