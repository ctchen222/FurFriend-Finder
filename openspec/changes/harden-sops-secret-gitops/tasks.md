## 1. Live Secret Risk Containment

- [ ] 1.1 Remove `kubectl.kubernetes.io/last-applied-configuration` from `furfriend-finder-app-secret` without changing Secret data.
- [ ] 1.2 Remove `kubectl.kubernetes.io/last-applied-configuration` from `furfriend-finder-postgres-secret` without changing Secret data.
- [ ] 1.3 Verify the live Secrets still exist and print only non-sensitive metadata plus key names.
- [ ] 1.4 Record that existing plaintext annotation exposure requires credential rotation assessment.

## 2. Rotation Assessment

- [ ] 2.1 Inventory which live Secret keys were exposed through annotations without copying their values into docs or logs.
- [ ] 2.2 Rotate external-provider credentials that were exposed, including mail, LINE, Google, and admin API credentials where applicable.
- [ ] 2.3 Plan and execute PostgreSQL password rotation across PostgreSQL, `DATABASE_URL`, schema jobs, and backup jobs.
- [ ] 2.4 Commit rotated values only through encrypted SOPS manifests.

## 3. Argo CD SOPS Bootstrap

- [ ] 3.1 Confirm `.sops.yaml` uses the intended age public recipient.
- [ ] 3.2 Create or update `argocd/sops-age-key` from the owner workstation without printing the private key.
- [ ] 3.3 Add or verify the SOPS Config Management Plugin ConfigMap.
- [ ] 3.4 Patch or configure `argocd-repo-server` with the SOPS CMP sidecar and SOPS binary.
- [ ] 3.5 Configure `furfriend-secrets` to sync `deploy/secrets` with a no-plaintext-annotation apply mode such as server-side apply.

## 4. Secret Manifests

- [ ] 4.1 Keep non-sensitive namespace manifests under `deploy/secrets/*.plain.yaml`.
- [ ] 4.2 Keep app and PostgreSQL Secret manifests under encrypted `deploy/secrets/*.sops.yaml`.
- [ ] 4.3 Keep Grafana admin credentials under encrypted `deploy/secrets/grafana-admin.sops.yaml`.
- [ ] 4.4 Ensure templates contain placeholders only and are not applied directly.

## 5. Verification

- [ ] 5.1 Verify encrypted SOPS files can decrypt with `SOPS_AGE_KEY_FILE` without printing values.
- [ ] 5.2 Run Kubernetes dry-run validation for Argo CD SOPS bootstrap manifests.
- [ ] 5.3 Sync `furfriend-secrets` and verify expected Secret names and key names exist.
- [ ] 5.4 Verify managed Secrets do not contain plaintext `last-applied-configuration` annotations after sync.
- [ ] 5.5 Verify the app, PostgreSQL, backup CronJob, schema Job, and Grafana use the expected Secret names after sync.

## 6. Documentation

- [ ] 6.1 Update `deploy/runbooks/secrets.md` with owner-operated bootstrap, edit, rotation, and safe verification steps.
- [ ] 6.2 Update related deployment or observability runbooks so Grafana admin setup references the shared SOPS GitOps path.
- [ ] 6.3 Document that encrypted `*.sops.yaml` files may be pushed to GitHub, while private age keys and decrypted files must never be committed.
