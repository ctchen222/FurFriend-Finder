## Why

The live VPS currently has working app and PostgreSQL Secrets, but Argo CD is not yet configured to decrypt SOPS files automatically. The existing live Secrets also retained plaintext values in `kubectl.kubernetes.io/last-applied-configuration`, so future secret automation must prevent plaintext from being stored in Git, logs, or Kubernetes annotations.

## What Changes

- Remove plaintext `last-applied-configuration` annotations from existing live app and PostgreSQL Secrets without changing Secret data.
- Treat any secret values previously present in live Secret annotations as exposed and rotate them where practical.
- Replace the first-version owner-side local decrypt/apply workflow with an Argo CD SOPS Config Management Plugin flow.
- Add a `furfriend-secrets` GitOps Application that renders `deploy/secrets/*.plain.yaml` and decrypts `deploy/secrets/*.sops.yaml`.
- Configure the secrets sync path to avoid recreating plaintext `last-applied-configuration` annotations.
- Manage app, PostgreSQL, and Grafana admin Secrets through encrypted SOPS manifests committed to Git.
- Keep the SOPS age private key owner-controlled and bootstrapped into the VPS only as an `argocd` namespace Secret.
- Update runbooks so operators can rotate encrypted secrets without printing decrypted values.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `deployment-automation`: Production Secrets move from documented local decrypt/apply to Argo CD SOPS-backed GitOps sync.
- `vps-operations`: Owner secret custody expands to include Argo CD age-key bootstrap, live annotation cleanup, and rotation after plaintext exposure.

## Impact

- Affected deployment artifacts: `.sops.yaml`, `deploy/secrets/**`, `deploy/argocd/**`, and secret-related runbooks.
- Affected live cluster resources: `furfriend-finder-app-secret`, `furfriend-finder-postgres-secret`, future `furfriend-grafana-admin`, Argo CD repo-server, and the `argocd/sops-age-key` Secret.
- Security impact: removes plaintext Secret metadata, prevents future plaintext annotation drift, and makes encrypted secret changes safe to push to GitHub.
- No application routes, matching logic, data sync behavior, database schema, or frontend behavior change.
