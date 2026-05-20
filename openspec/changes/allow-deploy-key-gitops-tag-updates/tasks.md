## 1. Root Cause Documentation

- [x] 1.1 Record the PR #38 failure chain: `CI` passed, GHCR image build/push passed, and `Update GitOps image tag` failed.
- [x] 1.2 Document the exact ruleset conflict: `Protect main` blocks direct pushes because changes must go through PR and required checks.
- [x] 1.3 Clarify that the failure is a deployment automation policy mismatch, not an app, Helm, observability, or GHCR build failure.

## 2. GitHub Ruleset Setup

- [x] 2.1 Choose the bypass actor. Revised to use a repo-scoped write deploy key after GitHub rejected the official GitHub Actions App as a ruleset bypass actor for this repository.
- [x] 2.2 Add only the `DeployKey` actor to the `Protect main` ruleset bypass list.
- [x] 2.3 Remove broad `RepositoryRole` bypass actors from `Protect main` and keep human direct pushes, broad write-role bypass, and admin bypass disabled unless explicitly justified later.
- [x] 2.4 Avoid separate deployment credentials; no machine-user account, PAT, custom GitHub App credential, or `DEPLOY_BOT_TOKEN` is required for the deploy-key path.
- [x] 2.5 Document the owner-operated setup steps because deploy-key and ruleset bypass configuration live outside repository code.
- [x] 2.6 Create the repository write deploy key and store its private key in the `GITOPS_DEPLOY_KEY` repository secret.

## 3. Workflow Update

- [x] 3.1 Update `.github/workflows/deploy-image.yml` so repository contents permission stays read-only and only the `update-gitops` job uses `secrets.GITOPS_DEPLOY_KEY`.
- [x] 3.2 Keep GHCR image publishing on the existing GitHub Actions token with package write permission.
- [x] 3.3 Add a diff guard that fails before commit or push unless the only changed file is `deploy/furfriend-finder/values-production.yaml`.
- [x] 3.4 Add an image-block guard so the GitOps job only updates the production image repository/tag block.
- [x] 3.5 Keep the deterministic commit message with `[skip image]`.
- [x] 3.6 Ensure tag-update commits do not recursively trigger another image publish.

## 4. Verification

- [x] 4.1 Run local workflow syntax checks where available. Ran Ruby YAML parse and `git diff --check`; `actionlint` is not installed locally.
- [ ] 4.2 Verify a normal PR merge to `main` publishes the GHCR image successfully.
- [ ] 4.3 Verify the `Update GitOps image tag` job pushes the `[skip image]` commit to `main` using the deploy key.
- [ ] 4.4 Verify the tag-update commit updates only `deploy/furfriend-finder/values-production.yaml`.
- [ ] 4.5 Verify the tag-update commit does not trigger another image publish run.
- [ ] 4.6 Verify a non-bot direct push to `main` remains rejected by the ruleset.

## 5. Follow-Up Cleanup

- [x] 5.1 Decide whether the previous failed image-tag update for commit `3bfa4b075cacb9d50e031a3105ed6a018b4e9aa7` needs to be recreated manually after the workflow is fixed. It should be recreated through the corrected deploy-key path or a normal PR because the image build succeeded but the GitOps tag update was rejected.
- [ ] 5.2 If needed, update the production image tag through the corrected deploy-key path or a normal PR.
