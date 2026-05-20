# Secrets and SOPS

Owner-operated bootstrap plus GitOps sync. Production secret values stay encrypted in Git. The age private key stays only on the owner's workstation and in the VPS k3s `argocd` namespace.

## Model

- `.sops.yaml` contains the public age recipient. It is safe to commit.
- `deploy/secrets/*.sops.yaml` contains encrypted Kubernetes Secret manifests. These files are safe to commit.
- The age private key must not be committed. Argo CD needs a copy in the `argocd` namespace so repo-server can decrypt encrypted manifests during sync.
- `furfriend-secrets` is the Argo CD Application that renders encrypted secret manifests through the `sops-secrets-v1.0` Config Management Plugin.

## Local Key Setup

Install `sops` and `age` locally.

Generate an age key and back it up offline:

```sh
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
```

Add the `SOPS_AGE_KEY_FILE` export to your shell profile if `sops` does not automatically find the age key on your workstation.

Replace the placeholder recipient in `.sops.yaml` with the public age recipient when rotating keys.

## Create Or Edit Encrypted Secrets

Copy a template, fill real values locally, and encrypt it:

```sh
cp deploy/secrets/production-secrets.template.yaml deploy/secrets/production-secrets.sops.yaml
sops --encrypt --in-place deploy/secrets/production-secrets.sops.yaml
```

The current encrypted production files are:

```sh
deploy/secrets/production.sops.yaml
deploy/secrets/grafana-admin.sops.yaml
```

Edit an encrypted secret later with:

```sh
sops deploy/secrets/production.sops.yaml
sops deploy/secrets/grafana-admin.sops.yaml
```

Do not commit decrypted files or paste decrypted values into logs. `deploy/secrets/*.decrypted.yaml` is ignored.

## Bootstrap Argo CD SOPS Decryption

Create the age private key Secret in Argo CD:

```sh
kubectl --context furfriend-vps -n argocd create secret generic sops-age-key \
  --from-file=keys.txt="$HOME/.config/sops/age/keys.txt" \
  --dry-run=client -o yaml \
  | kubectl --context furfriend-vps apply --server-side -f -
```

Install the SOPS Config Management Plugin and patch repo-server with the sidecar:

```sh
kubectl --context furfriend-vps apply -f deploy/argocd/sops-cmp-plugin.yaml

kubectl --context furfriend-vps -n argocd patch deployment argocd-repo-server \
  --type strategic \
  --patch-file deploy/argocd/sops-repo-server-patch.yaml

kubectl --context furfriend-vps -n argocd rollout status deployment/argocd-repo-server
```

The sidecar runs the `sops-secrets-v1.0` plugin. It emits non-sensitive `*.plain.yaml` manifests, decrypts `*.sops.yaml` files from the `deploy/secrets` Application path, and sends the resulting Kubernetes manifests to Argo CD.

The sidecar reads the same private age key from `/sops-age/keys.txt` through `SOPS_AGE_KEY_FILE`; that file comes from the `sops-age-key` Secret above.

## Sync Secrets

After the repo-server sidecar is ready, create the secrets Application:

```sh
kubectl --context furfriend-vps apply -f deploy/argocd/secrets-application.yaml
kubectl --context furfriend-vps -n argocd get application furfriend-secrets
```

Argo CD will then pull encrypted secret files from GitHub, decrypt them inside repo-server with `sops-age-key`, and apply the resulting Kubernetes Secrets.

The `deploy/secrets/namespaces.plain.yaml` file lets the secrets Application create the `furfriend-finder` and `observability` namespaces before applying Secrets. The namespace manifests use `Prune=false` so deleting the secrets Application does not prune namespaces and their workloads.

Confirm the Secrets exist without printing secret values:

```sh
kubectl --context furfriend-vps -n furfriend-finder get secret furfriend-finder-app-secret furfriend-finder-postgres-secret
kubectl --context furfriend-vps -n observability get secret furfriend-grafana-admin
```

## Rotation

To rotate a secret:

1. Run `sops deploy/secrets/<name>.sops.yaml`.
2. Change the value.
3. Commit and merge the encrypted diff.
4. Let `furfriend-secrets` sync.
5. Restart workloads that do not pick up changed Secret values automatically.
