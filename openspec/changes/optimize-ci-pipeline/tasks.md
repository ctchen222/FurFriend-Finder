## 1. Composite action

- [x] 1.1 Create `.github/actions/setup/action.yml` with steps: checkout → corepack enable → setup-node@v4 (node 22, cache pnpm) → pnpm install --frozen-lockfile
- [x] 1.2 Refactor `lint` job in `ci.yml` to use `- uses: ./.github/actions/setup` instead of the four inline steps
- [x] 1.3 Refactor `type-check` job in `ci.yml` to use composite action
- [x] 1.4 Refactor `test-unit` job in `ci.yml` to use composite action
- [x] 1.5 Refactor `test-integration` job in `ci.yml` to use composite action
- [x] 1.6 Verify `pnpm lint`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:integration` still run after refactor (yaml syntax check)

## 2. helm-validate DAG fix

- [x] 2.1 Remove `needs: [lint, type-check]` from `helm-validate` job in `ci.yml`
- [x] 2.2 Confirm `helm-validate` job has no `needs` field

## 3. Add build job to ci.yml

- [x] 3.1 Add `build` job to `ci.yml` with `needs: [type-check]`
- [x] 3.2 `build` job uses composite action and runs `pnpm run build`
- [x] 3.3 Confirm the updated DAG: lint+type-check+helm-validate parallel → build (needs type-check) → test-unit (needs lint+type-check) → test-integration (needs test-unit)

## 4. Docker build cache

- [x] 4.1 Add `cache-from: type=gha` to `Build and push` step in `deploy-image.yml`
- [x] 4.2 Add `cache-to: type=gha,mode=max` to `Build and push` step in `deploy-image.yml`

## 5. Remove deploy-image PR trigger

- [x] 5.1 Remove the `pull_request` block from the `on:` trigger in `deploy-image.yml`
- [x] 5.2 Confirm `deploy-image.yml` only triggers on `push: branches: [main]`

## 6. Branch protection rules (operator step)

- [ ] 6.1 Push this branch and open a PR to trigger `ci.yml` at least once so all job names appear in GitHub's status check list
- [ ] 6.2 Navigate to GitHub → Settings → Branches → Add rule → Branch name pattern: `main`
- [ ] 6.3 Enable: Require a pull request before merging
- [ ] 6.4 Enable: Require status checks to pass before merging → search and add: `Lint`, `Type check`, `Build`, `Unit tests`, `Integration tests`, `Helm validate`
- [ ] 6.5 Enable: Require branches to be up to date before merging
- [ ] 6.6 Enable: Do not allow bypassing the above settings
