# Local kubectl Access to the VPS k3s Cluster

This runbook documents the owner-operated path for accessing the VPS k3s cluster from a local workstation. It is intended for deployment and observability verification. Do not commit kubeconfig files, SSH credentials, cluster-admin tokens, or VPS secrets.

## Why Port 6443

k3s exposes the Kubernetes API server on HTTPS port `6443` by default. `kubectl` always talks to the Kubernetes API server first, then the API server reads or changes cluster resources such as Nodes, Pods, Services, Ingresses, PVCs, and Argo CD Applications.

The recommended local setup forwards an unused local workstation port to the VPS-local k3s API server:

```text
local kubectl
  -> https://127.0.0.1:<local-api-port>
  -> SSH tunnel
  -> VPS 127.0.0.1:6443
  -> k3s API server
```

Use a local port such as `16443` or `16643` instead of `6443` to avoid colliding with Docker Desktop, kind, k3d, minikube, or another local Kubernetes cluster.

## 1. Open the SSH Tunnel

Run this in a dedicated terminal and keep it open while using `kubectl`:

```bash
ssh -N -L 16643:127.0.0.1:6443 <user>@<vps>
```

This does not expose the k3s API publicly. It only makes the remote API reachable through the owner SSH session.

For routine use, the tunnel can run in the background instead of occupying a terminal:

```bash
ssh -fN -L 16643:127.0.0.1:6443 \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  root@178.156.151.78
```

Check whether the tunnel is listening:

```bash
lsof -nP -iTCP:16643 -sTCP:LISTEN
```

Stop the background tunnel by killing the matching SSH process:

```bash
pkill -f "ssh -fN -L 16643:127.0.0.1:6443"
```

A longer-lived setup can move the connection details into `~/.ssh/config`:

```sshconfig
Host furfriend-vps-k3s
  HostName 178.156.151.78
  User root
  LocalForward 16643 127.0.0.1:6443
  ExitOnForwardFailure yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Then start the tunnel with:

```bash
ssh -fN furfriend-vps-k3s
```

## 2. Copy the VPS k3s kubeconfig

Copy the owner-only kubeconfig from the VPS:

```bash
mkdir -p ~/.kube
scp <user>@<vps>:/etc/rancher/k3s/k3s.yaml ~/.kube/furfriend-vps.yaml
chmod 600 ~/.kube/furfriend-vps.yaml
```

Edit `~/.kube/furfriend-vps.yaml` and change the cluster server endpoint:

```yaml
server: https://127.0.0.1:16643
```

The copied kubeconfig is secret-equivalent material because the default k3s file usually grants high cluster privileges.

## 3. Rename the Context

Rename the copied kubeconfig context to a stable local name:

```bash
KUBECONFIG=~/.kube/furfriend-vps.yaml kubectl config rename-context default furfriend-vps
```

If the copied file already has a non-`default` context name, inspect it first:

```bash
KUBECONFIG=~/.kube/furfriend-vps.yaml kubectl config get-contexts
```

Then rename the displayed context to `furfriend-vps`.

## 4. Merge into the Local kubeconfig

Back up the current local kubeconfig first:

```bash
cp ~/.kube/config ~/.kube/config.backup
```

Merge the VPS kubeconfig into the normal local kubeconfig:

```bash
KUBECONFIG=~/.kube/config:~/.kube/furfriend-vps.yaml kubectl config view --flatten > ~/.kube/config.merged
mv ~/.kube/config.merged ~/.kube/config
chmod 600 ~/.kube/config
```

After this one-time setup, daily usage does not need `KUBECONFIG=...` prefixes.

## 5. Use the Context

Switch to the VPS cluster:

```bash
kubectl config use-context furfriend-vps
kubectl config current-context
```

Verify cluster access:

```bash
kubectl get nodes
kubectl -n furfriend-finder get pods,svc,ingress,pvc
kubectl -n argocd get applications
```

When working across multiple clusters, prefer explicit contexts for risky commands:

```bash
kubectl --context furfriend-vps get nodes
```

## 6. Troubleshooting

### `connection refused` on `127.0.0.1:<local-api-port>`

If `kubectl` reports:

```text
The connection to the server 127.0.0.1:<local-api-port> was refused
```

the kubeconfig is pointing at the expected local tunnel endpoint, but no SSH tunnel is currently listening on that local port. This is a local TCP connectivity failure, not a Kubernetes authentication, RBAC, or certificate failure.

Confirm the tunnel terminal is still running, or start it again:

```bash
ssh -N -L 16643:127.0.0.1:6443 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 root@178.156.151.78
```

In another terminal, check that the local port is listening:

```bash
lsof -nP -iTCP:16643 -sTCP:LISTEN
nc -vz 127.0.0.1 16643
```

Then retry:

```bash
kubectl --context furfriend-vps get nodes
```

If the SSH tunnel is running and `kubectl` reaches the API server, later failures will usually change from `connection refused` to certificate, authentication, authorization, or namespace-specific errors.

## 7. Completion Criteria

This preflight is complete only after the owner runs the verification commands through the SSH tunnel and confirms:

- `kubectl config get-contexts` lists `furfriend-vps`.
- `kubectl config current-context` returns `furfriend-vps` after switching.
- `kubectl get nodes` returns the VPS k3s node list.
- `kubectl -n furfriend-finder get pods,svc,ingress,pvc` can read application namespace resources.
- `kubectl -n argocd get applications` can read Argo CD applications after Argo CD is installed.

Writing this runbook is the documentation deliverable. It does not prove live cluster access until the owner performs the verification.

## 8. Boundaries

- Keep the SSH tunnel as the default access path for this single-owner VPS.
- Do not expose the k3s API server publicly for this change.
- Do not commit kubeconfig files or kubeconfig-derived credentials.
- Defer OIDC, kubelogin, and broader RBAC hardening until multi-user access is required.
- A private network such as Tailscale or WireGuard can replace the SSH tunnel later, but that requires stable private DNS or IP addressing and k3s TLS SAN planning.
