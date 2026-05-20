## Context

The current production image workflow has three stages:

1. Validate the app and Helm chart.
2. Build and push the image to GHCR.
3. Update `deploy/furfriend-finder/values-production.yaml` on `main` so Argo CD sees the new image tag.

During the PR #38 `dev -> main` merge, stages 1 and 2 completed successfully. Stage 3 created a commit like:

```text
chore(deploy): update image tag to <main-sha> [skip image]
```

but `git push` failed with GH013 because the `Protect main` repository ruleset requires changes to be made through pull requests and expects the `CI status gate` check. This is a policy mismatch: production needs a deterministic GitOps tag update, but `main` correctly blocks ordinary direct pushes.

## Goals / Non-Goals

Goals:

- Keep human and general-purpose token direct pushes to `main` blocked.
- Let only the production GitOps deploy key update the app image tag after a successful main image publish.
- Ensure the GitHub Actions GitOps update job can only publish the expected GitOps file change.
- Preserve the existing image tag contract: the deployed image tag maps back to the source commit SHA.
- Avoid recursive image publish loops from tag-update commits.

Non-goals:

- Removing `main` branch protection or the PR requirement.
- Allowing developers, admins, or arbitrary human actors to bypass `main`.
- Allowing the GitOps update automation to make arbitrary code changes.
- Moving app deployment state out of Git.
- Changing Argo CD, k3s, Helm chart semantics, or GHCR visibility.
- Creating a separate machine-user account, PAT, or custom GitHub App credential for this fix.

## Security Model

The attempted built-in GitHub Actions bypass is not available for this repository. The GitHub UI does not expose GitHub Actions in the bypass list, and the REST API rejected the official `github-actions` App as an `Integration` bypass actor with:

```text
Actor GitHub Actions integration must be part of the ruleset source or owner organization
```

The simplest account-free actor for this owner-operated repository is therefore a repo-scoped write deploy key. The private key is stored as the repository secret `GITOPS_DEPLOY_KEY`, and the public key is added to the repository as a write deploy key. The `Protect main` ruleset then allows the `DeployKey` actor type to bypass the pull-request requirement for this narrow automation path.

Normal users and broad roles such as `Write`, `Maintain`, `Admin`, or `Repository administrators` are not added to bypass. Existing broad `RepositoryRole` bypass actors must be removed from `Protect main` unless there is a separate explicit reason to keep them.

Because this bypass allows any configured write deploy key for the repository to push through the ruleset, the repository should keep only one write deploy key for this automation path and avoid adding unrelated write deploy keys. The workflow must enforce a second boundary before pushing:

- only `deploy/furfriend-finder/values-production.yaml` may be changed;
- the update must modify the `image.repository` and `image.tag` block only;
- the commit message must include `[skip image]`;
- the final GitOps update job checks out with `secrets.GITOPS_DEPLOY_KEY`;
- the workflow's default `GITHUB_TOKEN` stays read-only for repository contents.

This keeps the branch policy strict for code while allowing the one automation path required by GitOps.

A dedicated machine user or custom GitHub App can be introduced later if the repository needs stronger separation between deploy keys and deployment automation. That adds setup overhead and is explicitly not part of this fix.

## Workflow Design

The `update-gitops` job should:

1. Check out `main` with `actions/checkout` using `secrets.GITOPS_DEPLOY_KEY`.
2. Update the production values image block to:

```yaml
image:
  repository: ghcr.io/ctchen222/furfriend-finder
  tag: <main commit sha>
```

3. Validate the diff before committing:

```sh
changed_files="$(git diff --name-only)"
test "$changed_files" = "deploy/furfriend-finder/values-production.yaml"
```

4. Commit as `github-actions[bot]` with a deterministic message:

```text
chore(deploy): update image tag to <sha> [skip image]
```

5. Push to `main` over SSH with the repo-scoped deploy key, which succeeds only after the `DeployKey` actor is allowed to bypass the `Protect main` ruleset.

The existing skip condition remains:

```yaml
github.actor != 'github-actions[bot]' &&
!contains(github.event.head_commit.message, '[skip image]')
```

The `[skip image]` marker is the primary loop guard. The existing `github.actor != 'github-actions[bot]'` condition can remain as an extra guard, but the deploy-key push path must not depend on the actor being `github-actions[bot]`.

## Owner-Operated GitHub Setup

The owner must configure GitHub outside the repository:

- Create one write deploy key for this repository and store its private key in the repository secret `GITOPS_DEPLOY_KEY`.
- Add a `DeployKey` bypass actor to the `Protect main` ruleset.
- Remove broad `RepositoryRole` bypass actors from `Protect main` so write/admin roles do not get general direct-push bypass.
- Keep PR and required-check rules enabled for everyone else.

The repo should document this setup because it cannot be fully expressed in workflow YAML.

## Verification Strategy

Repo-owned verification:

- Render or lint the workflow YAML if a local tool is available.
- Confirm the workflow's `GITHUB_TOKEN` repository contents permission remains read-only.
- Confirm only the `update-gitops` job uses `secrets.GITOPS_DEPLOY_KEY`.
- Confirm the workflow fails if any file other than `deploy/furfriend-finder/values-production.yaml` is changed by the GitOps update step.
- Confirm `[skip image]` remains in the tag-update commit message.

Owner-operated live verification:

- Merge a normal PR into `main`.
- Confirm `CI` passes.
- Confirm `Build and publish GHCR image` succeeds.
- Confirm `Update GitOps image tag` pushes the `[skip image]` commit to `main` using the deploy key.
- Confirm the tag-update commit does not trigger another image publish.
- Confirm a non-bot direct push to `main` remains rejected by the ruleset.

## Risks / Trade-Offs

- Allowing deploy keys to bypass `main` means any write deploy key configured on the repository can push through the ruleset. Mitigation: keep only the GitOps deploy key with write access, rotate it if exposed, and avoid unrelated write deploy keys.
- Updating rulesets by API is less discoverable than the UI. Mitigation: document the exact `DeployKey` actor, verify the resulting `bypass_actors`, and avoid broad repository-role bypass entries.
- GitHub rulesets are configured outside code, so drift is possible. Mitigation: document the expected settings and verify them during release setup.
- Path-only checks in workflow are guardrails, not a replacement for repository review discipline. They reduce accidental workflow drift but still depend on protecting workflow file changes through PR review.
