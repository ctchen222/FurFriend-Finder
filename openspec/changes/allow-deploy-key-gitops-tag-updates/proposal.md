## Why

After PR #38 merged `dev` into `main`, the normal CI workflow passed and the GHCR image was built successfully, but the `Build and Publish Image` workflow failed while trying to push the GitOps image tag update back to `main`. The failure happened because the `Protect main` ruleset requires changes to go through pull requests, while the workflow still needs one narrow automation path to push the `deploy/furfriend-finder/values-production.yaml` image-tag commit.

An attempted GitHub Actions App bypass was rejected by GitHub with `Actor GitHub Actions integration must be part of the ruleset source or owner organization`, and the repository UI does not expose GitHub Actions as a selectable bypass actor. The simpler account-free path for this repository is a write deploy key scoped to this repo only.

## What Changes

- Keep `main` protected for humans and normal repository writers: code changes must still go through PR and required checks.
- Add a narrowly scoped deploy-key bypass path for the GitOps image tag update only.
- Use a repo-scoped write deploy key stored as a GitHub Actions secret; do not create a separate machine user, PAT, or custom GitHub App credential for this fix.
- Add workflow guardrails that fail the job unless the only changed file is `deploy/furfriend-finder/values-production.yaml`.
- Keep the deterministic `[skip image]` commit message so tag-update commits do not recursively publish another image.
- Document the owner-operated GitHub ruleset setup required for the deploy-key bypass actor.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `deployment-automation`: GitOps image tag updates must work with protected `main` by using an explicitly authorized deploy-key bypass, without granting direct push rights to humans.

## Impact

- Affected workflow: `.github/workflows/deploy-image.yml`.
- Affected GitHub settings: `Protect main` ruleset bypass actor for deploy keys, plus a repo deploy key with write access.
- Affected deployment artifact: `deploy/furfriend-finder/values-production.yaml` image repository/tag block.
- No application source, database schema, Helm runtime behavior, or observability stack behavior changes.
