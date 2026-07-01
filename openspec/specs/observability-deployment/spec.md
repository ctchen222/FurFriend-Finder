# observability-deployment Specification

## Purpose
TBD - created by archiving change deploy-k3s-observability-stack. Update Purpose after archive.
## Requirements
### Requirement: Owner-Operated Local kubectl Access Preflight

The deployment documentation SHALL provide an owner-operated local workstation path for verifying the VPS k3s cluster with `kubectl` before relying on the observability stack runbooks.

#### Scenario: Owner accesses the VPS k3s API through an SSH tunnel
- **GIVEN** the owner has SSH access to the VPS
- **WHEN** the owner opens a tunnel from an unused local port such as `127.0.0.1:16643` to VPS `127.0.0.1:6443`
- **THEN** local `kubectl` can reach the k3s API server without exposing the Kubernetes API publicly

#### Scenario: Owner uses a stable kubeconfig context
- **GIVEN** the owner copied the VPS k3s kubeconfig into an owner-only local file
- **WHEN** the owner updates the copied server endpoint, renames the context to `furfriend-vps`, and merges it into `~/.kube/config`
- **THEN** daily cluster checks can use `kubectl config use-context furfriend-vps` instead of repeating `KUBECONFIG=...` prefixes

#### Scenario: Repository preserves the access boundary
- **GIVEN** kubeconfig files and SSH credentials are secret-equivalent material
- **WHEN** local cluster access is documented
- **THEN** the repository does not store kubeconfig files, SSH credentials, cluster-admin tokens, or VPS secrets
- **AND** public k3s API exposure, OIDC, kubelogin, and RBAC hardening remain deferred until multi-user or always-on private access is required

