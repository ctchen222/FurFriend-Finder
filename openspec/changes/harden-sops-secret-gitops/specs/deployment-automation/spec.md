## MODIFIED Requirements

### Requirement: Secret and Operations Templates

The repository SHALL provide encrypted production Secret manifests, templates, GitOps automation, and runbooks that let the owner operate production without exposing secrets to GitHub, CI, the agent, terminal logs, or Kubernetes plaintext apply annotations.

#### Scenario: SOPS template is prepared

- **WHEN** deployment automation artifacts are complete
- **THEN** the repo SHALL include SOPS configuration and production Secret templates
- **AND** each template SHALL be safe to commit without real secret values
- **AND** documentation SHALL explain how the owner encrypts real values locally

#### Scenario: encrypted production secrets are committed

- **WHEN** production Secret values are ready
- **THEN** the owner SHALL commit only SOPS-encrypted Kubernetes Secret manifests under `deploy/secrets/*.sops.yaml`
- **AND** plaintext Secret manifests, decrypted SOPS output, and age private keys SHALL NOT be committed
- **AND** `.gitignore` SHALL exclude local decrypted Secret outputs

#### Scenario: Argo CD decrypts SOPS secrets during sync

- **WHEN** encrypted production Secret manifests are committed and the SOPS bootstrap is installed
- **THEN** Argo CD SHALL use a repo-server Config Management Plugin to decrypt `deploy/secrets/*.sops.yaml`
- **AND** Argo CD SHALL apply the resulting Kubernetes Secrets to the configured namespaces
- **AND** the owner SHALL NOT need to manually decrypt and apply Secret manifests for normal rotations

#### Scenario: secret sync avoids plaintext last-applied annotations

- **WHEN** Argo CD applies decrypted Kubernetes Secret manifests
- **THEN** the sync mode SHALL NOT store decrypted Secret content in `kubectl.kubernetes.io/last-applied-configuration`
- **AND** verification SHALL confirm managed Secrets do not contain plaintext applied-manifest annotations

#### Scenario: app, database, and Grafana secrets share one GitOps model

- **WHEN** the production app, PostgreSQL, or Grafana admin credentials are changed
- **THEN** the change SHALL be represented as an encrypted SOPS diff in Git
- **AND** the `furfriend-secrets` Argo CD Application SHALL sync the corresponding Kubernetes Secret
- **AND** workloads that do not pick up Secret changes automatically SHALL be restarted or rolled out through an explicit owner-operated step

#### Scenario: Runbooks are available

- **WHEN** repo-owned secret automation is complete
- **THEN** runbooks SHALL describe age key setup, Argo CD SOPS bootstrap, encrypted secret editing, rotation, safe verification, and rollback
- **AND** runbooks SHALL identify which commands are owner-operated and which outputs are safe to share
