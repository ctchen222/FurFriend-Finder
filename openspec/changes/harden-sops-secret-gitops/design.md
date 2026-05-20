## Context

Live cluster inspection showed:

- `furfriend-finder-app-secret` and `furfriend-finder-postgres-secret` already exist in the `furfriend-finder` namespace.
- The production Argo CD Application points to `deploy/furfriend-finder` with `values-production.yaml`.
- The app Helm chart references Secret names but does not create the app or PostgreSQL Secrets.
- Argo CD repo-server currently runs without a SOPS Config Management Plugin sidecar.
- The live app and PostgreSQL Secrets retained `kubectl.kubernetes.io/last-applied-configuration` annotations containing plaintext secret material.

This explains why PostgreSQL works today: the cluster already has real Kubernetes Secrets. It does not prove that GitHub-hosted `*.sops.yaml` files are currently decrypted by Argo CD.

## Goals / Non-Goals

Goals:

- Remove plaintext Secret annotations from live resources.
- Establish an automated GitOps path for SOPS-encrypted Kubernetes Secret manifests.
- Keep encrypted Secret manifests safe to commit.
- Keep decrypted Secret values out of Git, terminal logs, runbook examples, and Kubernetes apply annotations.
- Make app, PostgreSQL, and Grafana admin Secrets follow the same deployment model.

Non-goals:

- Giving CI, the agent, or GitHub Actions direct cluster credentials.
- Storing the age private key in Git.
- Changing app runtime behavior outside how its existing Secret values are supplied.
- Completing unrelated observability hardening, backup, or RBAC work.

## Secret Flow

```text
owner workstation
  |
  | edits encrypted manifests with SOPS
  v
GitHub deploy/secrets/*.sops.yaml
  |
  | Argo CD pulls repo
  v
repo-server SOPS CMP sidecar
  |
  | decrypts using argocd/sops-age-key
  v
furfriend-secrets Application
  |
  | applies via a no-plaintext-annotation sync mode
  v
Kubernetes Secrets
```

The age public recipient remains in `.sops.yaml`. The age private key remains outside Git and is copied to the cluster only as `argocd/sops-age-key`.

## Plaintext Annotation Remediation

The immediate live remediation is to remove unsafe annotations without mutating Secret data:

```sh
kubectl --context furfriend-vps -n furfriend-finder annotate secret furfriend-finder-app-secret kubectl.kubernetes.io/last-applied-configuration-
kubectl --context furfriend-vps -n furfriend-finder annotate secret furfriend-finder-postgres-secret kubectl.kubernetes.io/last-applied-configuration-
```

Verification must only print metadata and key names, not values:

```sh
kubectl --context furfriend-vps -n furfriend-finder get secret furfriend-finder-app-secret -o jsonpath='{.metadata.annotations}{"\n"}'
kubectl --context furfriend-vps -n furfriend-finder get secret furfriend-finder-postgres-secret -o jsonpath='{.metadata.annotations}{"\n"}'
```

Because plaintext values were present in cluster metadata, the owner should rotate any external credentials that appeared there, including provider tokens and SMTP credentials, according to each provider's rotation workflow. PostgreSQL rotation needs a coordinated database password update and app Secret update.

## Argo CD SOPS Integration

The repo-owned implementation should provide:

- A CMP plugin ConfigMap that discovers `*.sops.yaml` and emits `*.plain.yaml`.
- A repo-server sidecar running `/var/run/argocd/argocd-cmp-server`.
- A SOPS binary available inside the sidecar.
- `SOPS_AGE_KEY_FILE=/sops-age/keys.txt` mounted from `argocd/sops-age-key`.
- A `furfriend-secrets` Application pointed at `deploy/secrets`.

The secrets Application must avoid recreating `kubectl.kubernetes.io/last-applied-configuration` with decrypted manifest content. Server-side apply is the preferred sync mode because field ownership is tracked in `managedFields` instead of storing the full applied manifest as an annotation.

## Manifest Boundaries

`deploy/secrets/*.plain.yaml` may contain only non-sensitive resources, such as Namespace manifests.

`deploy/secrets/*.sops.yaml` may contain Kubernetes Secret manifests encrypted under `.sops.yaml` rules. The encrypted files are safe to commit, but decrypted outputs are not.

Templates remain useful as local starting points, but they must not be treated as deployed state unless they are copied, filled locally, and encrypted.

## Verification Strategy

Repo-owned verification:

- SOPS encrypted files decrypt successfully with the owner age key without printing values.
- The CMP plugin manifests pass Kubernetes dry-run validation.
- The secrets Application renders both `*.plain.yaml` and decrypted `*.sops.yaml` files.
- Secret sync settings do not create plaintext last-applied annotations.
- Existing Helm charts still reference the expected Secret names.

Owner-operated live verification:

- Existing app and PostgreSQL Secrets no longer have plaintext last-applied annotations.
- `furfriend-secrets` syncs successfully.
- `furfriend-finder-app-secret`, `furfriend-finder-postgres-secret`, and `furfriend-grafana-admin` exist with expected key names.
- App and PostgreSQL continue running after Secret management moves to GitOps.
- Rotated credentials are reflected in workloads after restart or rollout where required.

## Risks / Trade-Offs

- The age private key in `argocd/sops-age-key` can decrypt production secrets. It must be treated as cluster-sensitive material and access to the `argocd` namespace must remain tightly controlled.
- Server-side apply changes field ownership behavior. The secret sync Application should own the Secret manifests so manual edits do not silently diverge.
- Rotating PostgreSQL credentials requires coordination between PostgreSQL, app `DATABASE_URL`, backup jobs, and schema jobs.
- Removing unsafe annotations does not rotate leaked credentials by itself; it only removes the ongoing metadata exposure.
