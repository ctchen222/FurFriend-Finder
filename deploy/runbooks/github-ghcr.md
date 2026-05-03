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
