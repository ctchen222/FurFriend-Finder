## MODIFIED Requirements

### Requirement: Owner-Controlled Secret Custody

Production secrets and SOPS age private keys SHALL remain under owner control while allowing Argo CD inside the VPS cluster to decrypt encrypted GitOps Secret manifests.

#### Scenario: age key is created and backed up

- **WHEN** the owner creates the SOPS age key
- **THEN** the private key SHALL be stored outside the repository
- **AND** the owner SHALL back it up before relying on encrypted production secrets
- **AND** only the public age recipient SHALL be used in repo configuration

#### Scenario: age key is bootstrapped into Argo CD

- **WHEN** Argo CD needs to decrypt SOPS-managed production Secrets
- **THEN** the owner SHALL create or update an `argocd` namespace Kubernetes Secret containing the age private key
- **AND** the repo-server SOPS plugin SHALL read that key from `SOPS_AGE_KEY_FILE`
- **AND** the private key SHALL NOT be printed, committed, or shared

#### Scenario: production secrets are encrypted locally

- **WHEN** production secret values are ready
- **THEN** the owner SHALL encrypt them locally with SOPS
- **AND** only encrypted Kubernetes Secret manifests SHALL be committed
- **AND** plaintext `.env` files SHALL remain local-development only

#### Scenario: existing plaintext apply annotations are removed

- **WHEN** live Kubernetes Secrets contain `kubectl.kubernetes.io/last-applied-configuration` with plaintext Secret values
- **THEN** the owner SHALL remove those annotations without changing Secret data
- **AND** verification SHALL inspect only metadata and key names, not Secret values
- **AND** future secret sync SHALL avoid reintroducing plaintext applied-manifest annotations

#### Scenario: exposed secret values are rotated

- **WHEN** a Secret value has appeared in plaintext annotations, logs, screenshots, shell history, or chat output
- **THEN** the owner SHALL treat that value as exposed
- **AND** external-provider credentials SHALL be rotated at their provider
- **AND** cluster credentials such as PostgreSQL passwords SHALL be rotated through a coordinated workload rollout plan
- **AND** the rotated values SHALL be committed only as encrypted SOPS diffs
