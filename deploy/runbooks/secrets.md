# Secrets and SOPS

Owner-operated steps. Production secret values and the age private key stay local.

1. Install `sops` and `age` locally.
2. Generate an age key and back it up offline:

```sh
age-keygen -o ~/.config/sops/age/keys.txt
```

3. Replace the placeholder recipient in `.sops.yaml` with the public age recipient.
4. Copy the template, fill real values locally, and encrypt it:

```sh
cp deploy/secrets/production-secrets.template.yaml deploy/secrets/production-secrets.sops.yaml
sops --encrypt --in-place deploy/secrets/production-secrets.sops.yaml
```

5. Before first Argo CD sync, decrypt locally and apply the Kubernetes Secret:

```sh
sops --decrypt deploy/secrets/production-secrets.sops.yaml > deploy/secrets/production-secrets.decrypted.yaml
kubectl apply -f deploy/secrets/production-secrets.decrypted.yaml
rm deploy/secrets/production-secrets.decrypted.yaml
```

This first version does not configure Argo CD repo-server SOPS decryption. Do not commit decrypted files.
