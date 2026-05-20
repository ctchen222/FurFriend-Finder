# GitHub and GHCR Setup

Owner-operated steps. Do not paste tokens or private repository settings into chat.

1. Confirm GitHub Actions is enabled for the repository.
2. Confirm workflow permissions allow Actions to read/write repository contents and publish packages.
3. Decide GHCR visibility. Public images simplify k3s pulls. Private images require an image pull secret.
4. If GHCR is private, create a least-privilege token locally and apply an image pull secret:

```sh
kubectl -n furfriend-finder create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username="$GITHUB_USER" \
  --docker-password="$GHCR_TOKEN"
```

5. Add the pull secret name to `deploy/furfriend-finder/values-production.yaml`:

```yaml
image:
  pullSecrets:
    - name: ghcr-pull
```

Safe to share: package visibility, workflow run URL, image tag SHA. Do not share tokens.

## Deploy Key Bypass For GitOps Image Tag Updates

`main` remains protected: normal code changes must go through pull requests and required checks. The production image workflow still needs one narrow direct-push path after a successful `main` image build: updating `deploy/furfriend-finder/values-production.yaml` so Argo CD sees the new image tag.

For this owner-operated repo, the simplest account-free path is a write deploy key scoped to this repository. This avoids creating a separate machine user or PAT while keeping human direct pushes blocked.

Owner-operated setup:

1. Create an Ed25519 SSH key pair for GitOps image tag updates.
2. Add the public key to repository deploy keys with write access.
3. Store the private key as the repository secret `GITOPS_DEPLOY_KEY`.
4. Open the repository `Settings`.
5. Go to `Rules` -> `Rulesets`.
6. Open `Protect main`.
7. Keep the pull-request and required-check rules enabled.
8. Add the `DeployKey` actor to the bypass list.
9. Do not add humans, admins, write-role users, maintain-role users, or broad teams to the bypass list. Remove broad `RepositoryRole` bypass entries from `Protect main` unless they are intentionally required for a separate policy.

```sh
gh api repos/ctchen222/FurFriend-Finder/rulesets/16479946 \
  --jq '.bypass_actors'
```

The desired `Protect main` bypass actor is:

```json
{"actor_id":null,"actor_type":"DeployKey","bypass_mode":"always"}
```

The workflow uses the `GITOPS_DEPLOY_KEY` secret only in the `Update GitOps image tag` job. The workflow's default `GITHUB_TOKEN` keeps repository contents read-only. That job fails before pushing unless the only changed file is `deploy/furfriend-finder/values-production.yaml` and the diff only touches the production image `repository` and `tag` lines.

If `Build and Publish Image` fails after the image is pushed, check the `Update GitOps image tag` job first. A `GH013` ruleset error means the deploy-key bypass is missing or misconfigured.

A dedicated deploy bot or custom GitHub App can be introduced later if this repository needs stricter separation between general workflow automation and deployment automation. That is not required for the current owner-operated setup.
