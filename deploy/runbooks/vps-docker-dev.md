# VPS Docker dev runbook

本 runbook 只描述 FurFriend dev。主機既有 Zeabur/K3s/containerd、ingress、監控與 80/443 不得由本流程停止或修改；SSH bootstrap、Docker 安裝與 token 寫入由主機管理者另行執行。

## 主機目錄

```text
/opt/furfriend/dev/                         checkout / release files
/etc/furfriend/dev.env                     app and Compose variables
/etc/furfriend/dev.cloudflare-tunnel-token cloudflared token, mode 0600
/var/backups/furfriend/dev                 PostgreSQL dumps
```

`dev.env` 不進 Git。至少包含 `IMAGE_REPOSITORY`、`POSTGRES_*`、`DATABASE_URL`、app URL、Mailpit SMTP 設定、`APP_ENV_FILE` 與 `CLOUDFLARE_TUNNEL_TOKEN_FILE`；Threads token 不需要放在 VPS。

## 自動部署邊界

合併到 `dev` 後，GitHub Actions 會等待同一個 commit 的 `CI status gate`，建置並推送 `linux/amd64` immutable GHCR digest，再使用 `development` Environment 的 SSH secrets 呼叫 `/usr/local/sbin/furfriend-deploy dev <digest>`。一般 app/worker release 不需要手動 SSH。

`/usr/local/sbin` 下的 root-owned scripts 不會因為 image 更新而自動替換。修改 deploy/rollback/status script 時，先在 PR 驗證，再用受控暫存目錄一次性安裝並比對 SHA-256；安裝後的日常 app release 才會沿用自動 CD。

## 本機預覽

```bash
docker-compose --env-file /etc/furfriend/dev.env \
  -f deploy/compose/compose.yaml \
  -f deploy/compose/compose.dev.yaml config --quiet
```

## 發布

固定由 CI 傳入 image digest；不要傳 tag：

```bash
sudo /usr/local/sbin/furfriend-deploy dev sha256:<64-hex-digest>
```

流程是 pull → 啟動 PostgreSQL/Mailpit → migration → 啟動 app/worker/cloudflared 並等待 healthcheck → `docker compose ps`。migration 失敗時不啟動新 app/worker。

成功後 script 會把 `IMAGE_DIGEST` 原子更新回 `/etc/furfriend/dev.env`，並把前一版寫入 `/var/lib/furfriend/dev/previous-digest`。app 與 worker 應該使用同一個 repository@digest；兩者只是啟動 command 不同。

## 驗收

```bash
curl -fsS https://dev.furfriend-finder.com/health
curl -fsSI https://dev.furfriend-finder.com/images/twobao222.jpg
```

另外確認 Cloudflare Tunnel 是 `Healthy`、worker container 正常、DB/Mailpit 沒有 host port、K3s workload 沒有新增錯誤或 OOM。

## 日常觀察與 logs

```bash
gh run list --workflow ci.yml --branch dev --limit 5
sudo /usr/local/sbin/furfriend-status dev --logs 100
sudo docker images --digests ghcr.io/ctchen222/furfriend-finder
sudo docker logs --tail 200 furfriend-dev-app-1
sudo docker logs --tail 200 furfriend-dev-worker-1
curl -fsS https://dev.furfriend-finder.com/health
```

`furfriend-status` 不會輸出 Compose environment、database URL、OAuth、Threads 或 Tunnel token；失敗時 GitHub Actions 只收集 bounded status/log output。

## 回退與備份

```bash
sudo /usr/local/sbin/furfriend-backup
sudo /usr/local/sbin/furfriend-rollback dev sha256:<previous-64-hex-digest>
```

rollback 不自動降級資料庫 schema；只有確認前版 app 與目前 schema 相容時才執行。
