# VPS Rebuild

Owner-operated recovery outline.

1. Recreate the VPS and DNS/firewall baseline.
2. Install k3s, cert-manager, and Argo CD.
3. Restore the SOPS age private key from offline backup.
4. Decrypt and apply production Secrets locally.
5. Apply the Argo CD application.
6. Restore PostgreSQL from the latest verified backup if the PVC is lost.
7. Verify schema tables, app rollout, TLS certificate, and `/health`.

Safe to share: high-level status outputs and backup filename. Do not share kubeconfig, decrypted secrets, or age private key material.
