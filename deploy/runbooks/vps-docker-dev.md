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

## 驗收

```bash
curl -fsS https://dev.furfriend-finder.com/health
curl -fsSI https://dev.furfriend-finder.com/images/twobao222.jpg
```

另外確認 Cloudflare Tunnel 是 `Healthy`、worker container 正常、DB/Mailpit 沒有 host port、K3s workload 沒有新增錯誤或 OOM。

## 回退與備份

```bash
sudo /usr/local/sbin/furfriend-backup
sudo /usr/local/sbin/furfriend-rollback dev sha256:<previous-64-hex-digest>
```

rollback 不自動降級資料庫 schema；只有確認前版 app 與目前 schema 相容時才執行。
