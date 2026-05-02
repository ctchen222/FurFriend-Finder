## 1. Add package.json scripts

- [x] 1.1 Add `"lint": "eslint src/"` to `package.json` scripts
- [x] 1.2 Add `"type-check": "tsc --noEmit"` to `package.json` scripts
- [x] 1.3 Run `pnpm lint` locally and confirm it exits without error
- [x] 1.4 Run `pnpm type-check` locally and confirm it exits without error

## 2. Create ci.yml workflow

- [x] 2.1 Create `.github/workflows/ci.yml` with triggers: `pull_request` (all branches) and `push` to `main`/`dev`
- [x] 2.2 Add `concurrency` group keyed to `github.workflow-${{ github.ref }}` with `cancel-in-progress: true`
- [x] 2.3 Add `lint` job: Corepack enable → setup-node@v4 (node 22, cache pnpm) → pnpm install --frozen-lockfile → pnpm lint
- [x] 2.4 Add `type-check` job: same pnpm setup → pnpm type-check (no upstream dependency)
- [x] 2.5 Add `test-unit` job: `needs: [lint, type-check]` → same pnpm setup → pnpm test:unit
- [x] 2.6 Add `helm-validate` job: `needs: [lint, type-check]` → setup-helm@v4 → install helm-unittest plugin → helm lint → helm template → helm unittest
- [x] 2.7 Add `test-integration` job: `needs: [test-unit]` → same pnpm setup → pnpm test:integration (no `services` block)

## 3. Refactor deploy-image.yml validate job

- [x] 3.1 Remove the `Run tests` step (`pnpm exec jest --runInBand`) from the `validate` job
- [x] 3.2 Remove the `Install helm-unittest` step from the `validate` job
- [x] 3.3 Remove the `Run Helm unit tests` step (`helm unittest`) from the `validate` job
- [x] 3.4 Confirm the validate job retains: checkout → corepack → setup-node → pnpm install → pnpm build → setup-helm → helm lint → helm template

## 4. Verify

- [ ] 4.1 Push changes to a feature branch and open a PR; confirm all five `ci.yml` jobs appear in the PR checks
- [ ] 4.2 Confirm `lint`, `type-check`, `test-unit`, `test-integration`, and `helm-validate` all pass
- [ ] 4.3 Confirm `deploy-image.yml` validate job output no longer contains Jest or Helm unittest output
