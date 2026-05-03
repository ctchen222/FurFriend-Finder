# First Argo CD Sync

Owner-operated steps after k3s, DNS, cert-manager, Argo CD, GHCR access, and Secrets are ready.

1. Update `deploy/furfriend-finder/values-production.yaml` placeholders: domain, storage class, image repository, and secret names.
2. Apply the Argo CD application:

```sh
kubectl apply -f deploy/argocd/application.yaml
```

3. Watch resources:

```sh
kubectl -n furfriend-finder get pods,jobs,cronjobs,ingress,pvc
kubectl -n furfriend-finder logs job/furfriend-finder-schema
```

4. Verify schema readiness:

```sh
kubectl -n furfriend-finder exec statefulset/furfriend-finder-postgresql -- \
  psql -U furfriend -d furfriend_finder -c "\\dt"
```

5. Verify HTTPS health:

```sh
curl -fsS https://furfriend.example.com/health
```

Safe to share: pod readiness, Job status, certificate status, `/health` status. Do not share Secret data.
