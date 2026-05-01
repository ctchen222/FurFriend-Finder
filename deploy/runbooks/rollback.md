# Rollback

Rollbacks are GitOps value changes.

1. Find the previous known-good image tag from Git history:

```sh
git log -- deploy/furfriend-finder/values-production.yaml
```

2. Edit `deploy/furfriend-finder/values-production.yaml` and set `image.tag` to the previous commit SHA.
3. Commit and push:

```sh
git add deploy/furfriend-finder/values-production.yaml
git commit -m "chore(deploy): roll back image tag to PREVIOUS_SHA [skip image]"
git push
```

4. Let Argo CD sync, then verify rollout and health:

```sh
kubectl -n furfriend-finder rollout status deployment/furfriend-finder
curl -fsS https://furfriend.example.com/health
```

If rollback involves database schema incompatibility, stop and restore from a verified backup instead of repeatedly restarting the app.
