# Owner-Operated Local kubectl Access

This change expects the owner to verify the VPS k3s cluster from a local workstation before relying on the observability stack runbooks. The repository documents the access pattern, but it must not store kubeconfig files, SSH credentials, cluster-admin tokens, or VPS secrets.

The implementation runbook lives in `deploy/runbooks/local-kubectl-access.md`.

## Recommended Path

Use an SSH tunnel from the local workstation to the VPS k3s API server, then merge the VPS kubeconfig into the local kubeconfig as a named context.

```bash
ssh -N -L 16643:127.0.0.1:6443 <user>@<vps>
```

The VPS k3s API server listens on `127.0.0.1:6443` by default. The local workstation should use an unused local port such as `127.0.0.1:16643` to avoid colliding with local Kubernetes distributions such as Docker Desktop, kind, k3d, or minikube.

Copy the owner-only kubeconfig from the VPS:

```bash
scp <user>@<vps>:/etc/rancher/k3s/k3s.yaml ~/.kube/furfriend-vps.yaml
chmod 600 ~/.kube/furfriend-vps.yaml
```

Update the copied kubeconfig server endpoint:

```yaml
server: https://127.0.0.1:16643
```

Rename the copied context to a stable local context name:

```bash
KUBECONFIG=~/.kube/furfriend-vps.yaml kubectl config rename-context default furfriend-vps
```

Merge the VPS kubeconfig into the local kubeconfig:

```bash
KUBECONFIG=~/.kube/config:~/.kube/furfriend-vps.yaml kubectl config view --flatten > ~/.kube/config.merged
mv ~/.kube/config.merged ~/.kube/config
chmod 600 ~/.kube/config
```

After that, daily usage should rely on the context name:

```bash
kubectl config use-context furfriend-vps
kubectl get nodes
kubectl -n furfriend-finder get pods,svc,ingress,pvc
kubectl -n argocd get applications
```

## Verification

The owner should verify:

- `kubectl config get-contexts` lists `furfriend-vps`.
- `kubectl config current-context` returns `furfriend-vps` after switching.
- `kubectl get nodes` can read the VPS k3s node list through the SSH tunnel.
- `kubectl -n furfriend-finder get pods,svc,ingress,pvc` can inspect the application namespace.
- `kubectl -n argocd get applications` can inspect the GitOps control plane when Argo CD is installed.

## Boundaries

- The kubeconfig is secret-equivalent and must not be committed.
- The SSH tunnel is the default documented access path.
- Public k3s API exposure is deferred.
- OIDC, kubelogin, and RBAC hardening are deferred until multi-user access is required.
- A private network such as Tailscale or WireGuard can replace the SSH tunnel later, but that requires a stable private endpoint and k3s TLS SAN planning.
