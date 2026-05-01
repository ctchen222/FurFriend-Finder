# VPS Bootstrap

Owner-operated steps. The repo does not need VPS SSH, kubeconfig, or DNS credentials.

1. Point DNS `A` or `AAAA` records for the production domain at the VPS.
2. Restrict the firewall to SSH, HTTP, and HTTPS.
3. Install single-node k3s:

```sh
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
```

4. Install cert-manager and create a production `ClusterIssuer` named by `ingress.tls.clusterIssuer`.
5. Install Argo CD in the `argocd` namespace.
6. Apply `deploy/argocd/application.yaml` after replacing `repoURL` with the real repository URL.

Safe to share: `kubectl get nodes`, cert-manager readiness, Argo CD application health. Do not share kubeconfig.
