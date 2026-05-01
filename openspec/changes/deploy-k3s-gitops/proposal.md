## Why

FurFriend Finder is moving from local/docker-compose operation to a VPS-hosted homelab deployment. The work has two different authority boundaries:

- Repository-owned deployment automation that can be implemented and verified without VPS access.
- Operator-owned VPS work that must be performed by the project owner because it requires SSH, DNS, cluster-admin access, GitHub settings, and production secrets.

The OpenSpec change is therefore split into two capability specs. This keeps automation work implementable by an agent while making the human-only VPS steps explicit, auditable, and safe.

## What Changes

- Add a repo-side deployment automation spec for pnpm, reproducible Docker images, GHCR publishing, Helm manifests, GitOps image-tag updates, SOPS templates, and backup manifests.
- Add an owner-side VPS operations spec for k3s bootstrap, DNS/TLS, Argo CD installation, SOPS key custody, encrypted secret creation, first sync, backup verification, and rollback/rebuild drills.
- Add an Ansible Playbook (`deploy/ansible/bootstrap.yml`) that codifies the VPS package installation and firewall configuration steps, replacing the equivalent manual runbook steps with idempotent, version-controlled automation.
- Replan tasks into two tracks so repo work can progress independently from privileged VPS operations.

## Capabilities

### New Capabilities

- `deployment-automation`: Defines the repository artifacts and CI/CD automation required to produce and describe deployable production state.
- `vps-operations`: Defines the operator workflow required to prepare, connect, verify, and maintain the VPS-hosted k3s environment.

### Modified Capabilities

- None.

## Impact

- Affected repo artifacts: `Dockerfile`, package manager lockfile, GitHub Actions workflows, `/deploy/**`, SOPS configuration/templates, runbooks, Ansible Playbook, and OpenSpec deployment specs.
- Affected owner-operated systems: VPS, DNS provider, k3s, Traefik, cert-manager, Argo CD, GHCR/package settings, SOPS age key material, PostgreSQL backups.
- Database schema changes: none expected.
- User-facing route changes: none expected; `/health` becomes the production readiness/liveness boundary.
