# 既有 Zeabur/K3s 主機上的 Docker Compose 部署與 CI/CD 規劃

狀態：部署檔案初版已實作於 `feature/260909-docker-dev-deployment`，更新於 2026-09-09。尚未安裝 Docker、建立 Tunnel、修改 DNS、上傳 secrets、push、merge 或部署應用程式。

本回合已完成 repository-side slice：dev Compose（app、worker、PostgreSQL、migration、Mailpit、cloudflared）、dev env 範本、deploy/rollback/backup scripts、Docker Compose validation、GHCR immutable digest build 與 dev-only SSH deploy workflow。SSH 主機 bootstrap、套件安裝、Cloudflare Dashboard、DNS、VPS runtime 與 Threads publish 仍未執行。

本 worktree 的工作分支是 `docs/260908-vps-deployment-plan`，基底仍是 2026-09-08 的 `origin/dev`（`2b0b293`），目前落後新的 `origin/dev`。實作必須另從最新 `dev` 建立符合規範的功能分支；本文件中的程式碼盤點在實作前仍須重新核對。

## 已核准的目標與階段邊界

使用者已確認以下方向：

1. 目標主機維持現況，不清空、不重裝、不停用或移除 Zeabur/K3s。
2. 在同一台主機旁掛 Docker Engine 與 Docker Compose，部署 FurFriend Finder。
3. GitHub Actions 建置不可變映像並推送 GHCR，再透過 SSH 自動部署。
4. 先只部署 `dev` branch 到 `dev.furfriend-finder.com`。
5. dev 部署成功後，以公開的二寶圖片測試第一篇 Threads 貼文。
6. `main` / production 保留在完整目標架構中，但本階段不部署、不切正式 DNS。
7. Threads 每日自動發文不在本次範圍，等第一篇人工測試成功後另行設計。

## 決策摘要

採用「既有 Zeabur/K3s + 旁掛 Docker Compose + Cloudflare Tunnel」的共存架構。

- K3s、containerd、Zeabur ingress、監控與平台 namespace 保持運作。
- FurFriend app、worker、PostgreSQL、Mailpit 及 `cloudflared` 使用 Docker Compose。
- 不使用 Argo CD；舊 Helm/Argo CD 檔案只保留歷史，不參與新部署。
- 不啟動 Caddy，因為現有 K3s ingress 已占用主機 80/443。
- Docker app、PostgreSQL、Mailpit 不發布公網 port。
- `cloudflared` 從 Docker network 連到 app，再主動建立出站 Tunnel 到 Cloudflare。
- dev 與未來 production 使用獨立 Compose project、network、volume、database、secrets 與 Cloudflare Tunnel token。

這是單機、低流量階段的折衷：不破壞現有平台，但 K3s、Docker、dev 與未來 production 仍共享 CPU、RAM、磁碟與單機故障範圍。

## 2026-09-09 主機唯讀實查

目標：`ubuntu@43.167.157.132`。已驗證 SSH 可用；未讀取任何 Secret 內容。

| 項目 | 實查結果 | 部署影響 |
| --- | --- | --- |
| OS / CPU | Ubuntu 24.04.4 LTS、amd64、2 vCPU | GHCR 映像需支援 `linux/amd64` |
| RAM / swap | 3.6 GiB RAM、約 2.1 GiB available、1.9 GiB swap | 只能先跑受限的 dev 工作負載 |
| 磁碟 | 根目錄約 59 GB、49 GB 可用 | Docker image、K3s volume 與 DB 共用磁碟 |
| K3s | v1.36.4+k3s1，active | 不停止、不移除 |
| K3s 使用量 | 約 1708 MiB / 65% | Docker 加入後必須設資源上限並觀察 OOM |
| 平台工作負載 | 約 20 個 Zeabur、cert-manager、metrics/logs Pod | 未見 FurFriend；平台元件保持不動 |
| 平台儲存 | Victoria Logs / Metrics 各有 10 GiB PVC | 與 Docker DB 共享實體磁碟 |
| Docker | 未找到、service inactive | 需新增 Docker Engine + Compose plugin |
| 網路 | 80/443、6443、10250、4222、9090 已監聽 | 不讓 Docker/Caddy 搶占既有 port |
| 防火牆 | UFW inactive | 需另查雲端防火牆；Tunnel 不要求開放 app port |
| dev DNS | `dev.furfriend-finder.com` 尚無 A/AAAA/CNAME | 建立 Tunnel route 後產生/確認 CNAME |
| 正式網址 | Cloudflare 代理存在，但目前回傳 522 | 本階段不修復或切換 production |

K3s Pod CIDR、Service CIDR、主機 routes 與 Docker 預設 bridge CIDR 仍須在安裝前完整記錄。Docker 可能調整 iptables；安裝前後都要驗證 K3s ingress、Pod 網路及 Zeabur Dashboard 健康，失敗時停止部署並回復新增設定。

## 架構與資料流

```text
Internet
   |
   v
Cloudflare HTTPS
   |
   +------------------------------+
   |                              |
dev.furfriend-finder.com     furfriend-finder.com
   |                              |
dev Cloudflare Tunnel        production Tunnel（未部署）
   |                              |
cloudflared                  cloudflared
   | Docker edge network          | Docker prod edge network
dev app:2486                 prod app:2486
   |                              |
dev backend network          prod backend network
   +--> dev PostgreSQL             +--> prod PostgreSQL
   +--> dev worker                 +--> prod worker
   +--> Mailpit                    +--> production SMTP

同一台 VPS 仍同時運行：
Zeabur/K3s/containerd/ingress/metrics/logs（保持不動）
```

Cloudflare Tunnel 只取代原計畫的 Caddy 入口層。Docker Compose、GHCR、SSH 自動部署、migration、worker、環境隔離及 rollback 方向不變。

## 為什麼使用 Cloudflare Tunnel

| 方案 | 結果 | 決定 |
| --- | --- | --- |
| Caddy 綁主機 80/443 | 與現有 K3s ingress 衝突 | 不採用 |
| Docker 公開 `2486` | 增加攻擊面，且 Cloudflare 一般 HTTP proxy 不使用此應用 port | 不採用 |
| K3s Ingress 轉發到 host Docker port | 可行，但形成 K3s Service/EndpointSlice 到 host Docker 的脆弱混合路由 | 保留為 Tunnel 失敗時備案 |
| Cloudflare Tunnel | 僅需出站連線，不占 80/443，app 可留在 Docker 私有 network | 採用 |

Tunnel 代價是 Cloudflare 與 token 成為入口依賴。`cloudflared` 停止時網站不可達；任何取得 Tunnel token 的人都可啟動 connector，因此 dev/prod 必須分開 token，並支援撤銷與輪替。

## Docker Compose 環境設計

| 項目 | dev（本階段部署） | production（未來部署） |
| --- | --- | --- |
| 分支 | `dev` | `main` |
| URL | `dev.furfriend-finder.com` | `furfriend-finder.com` |
| Compose project | `furfriend-dev` | `furfriend-prod` |
| App / worker | dev commit 的同一 image digest | main commit 的同一 image digest |
| PostgreSQL | 獨立容器、帳號、volume | 獨立容器、帳號、volume |
| Tunnel | `furfriend-dev` + dev token | `furfriend-prod` + prod token |
| 通知 | Mailpit；真實 LINE/SMTP 關閉或測試憑證 | 正式服務，另行核准 |
| 資料同步 | `DISABLE_DATA_CRON=true` | 未來正式啟用前另驗證 |
| Threads | `THREADS_ENABLED=false` | 每日發文功能完成前仍為 false |
| Telemetry | `OTEL_SDK_DISABLED=true` | 初期仍可停用，另行評估 |

dev 與 production 的 Compose override 會分開，但本實作階段只建立與啟用 dev deploy caller。共用 Compose 結構應保留未來 production 擴充點；production secrets、container、volume、Tunnel、DNS 與 deploy job 均不在本階段建立或執行。

### 網路邊界

- `cloudflared` 與 app 只共用 `edge` network。
- app、worker 與 PostgreSQL 共用 `backend` internal network。
- `cloudflared` 不加入 backend network。
- PostgreSQL、Mailpit UI、app 2486 均不做 host port publishing。
- 管理 Mailpit 或 DB 時只使用短期 SSH tunnel 或 `docker compose exec`。
- Compose network CIDR 必須在實作時避開 K3s、主機與供應商網路。

### 初始 dev 資源上限

| 服務 | 初始 memory limit | 備註 |
| --- | ---: | --- |
| app | 384 MiB | 啟動與受控 smoke 後量測 |
| worker | 256 MiB | 不執行大量匯入；驗證工作 queue |
| PostgreSQL | 512 MiB | dev 小資料集 |
| Mailpit | 128 MiB | 限制保存量 |
| cloudflared | 128 MiB | 單一 dev Tunnel |
| 合計 | 1408 MiB | 不含 Docker daemon 與既有 K3s |

這些是保護主機的測試上限，不是容量保證。部署期間持續量測 Linux available memory、swap、OOM、K3s Pod readiness、app latency 與 DB 狀態。若 dev 使 K3s 或主機不穩，立即停止 FurFriend dev Compose；不藉機停用 Zeabur 元件。

## 專案實際需求與待修缺口

| 來源 | 已確認行為 | 本次要求 |
| --- | --- | --- |
| `Dockerfile` | 多階段建置 backend + React，runtime 包含 dist、views、sql | runner 建置；VPS 只 pull；驗證 `linux/amd64` |
| `package.json` | build 複製 `src/public/images/**` | 二寶圖片必須存在於 image 的 `/images/twobao222.jpg` |
| `src/app.ts` | HTTP 2486、DB startup check、靜態檔與資料同步 cron | app 一份；dev 關閉資料 cron |
| `src/workers/main.ts` | matching/mail worker loop | 獨立 worker service，不以 app healthy 代替 worker healthy |
| `src/scripts/migrate.ts` | migration runner + `DATABASE_URL` | 同 digest 一次性 migration service |
| `docker-compose.yml` | DB port、observability、無完整 production worker boundary | 不直接沿用；建立部署專用 Compose |
| `.github/workflows/ci.yml` | path filter 可能略過 sql/views/deploy | 補齊 paths 與 real PostgreSQL migration gate |
| `.github/workflows/deploy-image.yml` | main-only、Helm tag、自動 push main | 由 `dev` push 觸發 immutable GHCR image + SSH Compose 流程；CI 仍由 branch protection 作為合併 gate |

## Cloudflare Tunnel 設定

在 Cloudflare Dashboard 建立 remotely-managed Tunnel：

```text
Networking
-> Tunnels
-> Create a tunnel
-> name: furfriend-dev
-> Docker
```

Dashboard 顯示的 token 不貼入聊天、GitHub log 或 Compose。將 token 以 root-only 檔案放在主機：

```text
/etc/furfriend/dev.cloudflare-tunnel-token
```

Compose 以 secret file 掛入 `cloudflared`，並使用 `--token-file`；不得把 token 直接寫在 command、environment 或 image 中。正式實作固定 `cloudflared` 版本或 image digest，不使用浮動 `latest` 作為 release 契約。

Published application route：

| 欄位 | dev 值 |
| --- | --- |
| Subdomain | `dev` |
| Domain | `furfriend-finder.com` |
| Path | 空白 |
| Service URL | `http://app:2486` |

`cloudflared` 與 app 位於相同 Docker `edge` network，所以使用穩定的 Compose service name `app`，不依賴容器 IP。建立 route 後確認 DNS CNAME、Tunnel `Healthy`、外部 HTTPS 及 `/health`。若主機出站受限，先確認可連 Cloudflare Tunnel 所需的 7844 port。

production 未來使用另一個 `furfriend-prod` Tunnel；不得讓 dev token 或 Compose stack 可以接管 production hostname。

## CI/CD：目前只啟用 dev

```text
feature/* -> PR to dev -> CI -> 使用者核准合併
                                  |
                              push dev
                                  |
                    CI -> build/test linux/amd64 image
                                  |
                         push immutable digest to GHCR
                                  |
                       SSH deploy furfriend-dev
                                  |
                 pull -> migration -> app/worker/tunnel
                                  |
                  health/static/worker/isolation smoke
```

| 事件 | 自動執行 | 是否更新網站 |
| --- | --- | --- |
| PR 到 `dev` | lint、types、unit、integration、React、migration、Compose validation | 否；PR 不取得 deploy secrets |
| 合併到 `dev` | 重跑 gate、建置/推送 GHCR、SSH 部署 | 僅 dev |
| PR / push 到 `main` | 本階段沿用安全 CI；不部署 production | 否 |
| dev deploy 失敗 | 停止後續步驟、保存診斷、視 schema 相容性回復前版 digest | 不標記成功 |
| 手動 dev rollback | 指定 dev 曾成功部署的 digest | 僅 dev |

production 最終流程仍是 `dev -> main PR -> 使用者核准 merge -> main image -> production deploy`，但會在 dev 與第一篇 Threads 測試完成後另行啟用。禁止直接 push `dev`/`main`，禁止 bot 自動 merge 或寫回 branch。

GitHub 建立 `development` Environment，限制只由 `dev` 部署，保存：

- 受限 SSH deploy key
- host、user 與 verified known_hosts
- GHCR 主機端 read-only pull credential 的部署方式
- dev deployment URL

SSH 只呼叫 VPS 上 root-owned、不可由 deploy user 改寫的固定 script；參數只接受 `dev` 與合法 image digest。必須序列化 deploy，避免舊 workflow 覆蓋新版本。CI 測試 job 不取得 deploy 或應用程式 secrets。

## 預計交付

| 類型 | 路徑 | 用途 |
| --- | --- | --- |
| Compose | `deploy/compose/compose.yaml` | app、worker、PostgreSQL、Mailpit、cloudflared 共用結構 |
| dev override | `deploy/compose/compose.dev.yaml` | dev URL、資源、Mailpit、cron/Threads 關閉 |
| production example | `deploy/compose/compose.prod.example.yaml` | 僅記錄未來差異，不啟用 production |
| env 範本 | `deploy/compose/env.dev.example` | 無秘密的設定契約 |
| scripts | `deploy/scripts/deploy.sh`、`rollback.sh`、`backup.sh` | 固定 dev 發布、回退與 DB 備份 |
| bootstrap | `deploy/scripts/bootstrap-docker-host.sh` 或受控 runbook | 安裝 Docker 並驗證 K3s 不受影響 |
| workflow | `.github/workflows/ci.yml`、`deploy-image.yml` | CI gate、`dev` push 後 GHCR 與 dev SSH deploy |
| runbook | `deploy/runbooks/vps-docker-dev.md` | bootstrap、Tunnel、deploy、rollback、診斷 |
| 主機設定 | `/opt/furfriend/dev`、`/etc/furfriend/dev.env` | release metadata 與 root-only secrets |
| Tunnel token | `/etc/furfriend/dev.cloudflare-tunnel-token` | 僅供 dev cloudflared secret mount |

舊 Helm、Argo CD 與 observability manifests 暫時保留作歷史，但新 workflow 不再更新 Helm tag，也不讓 Argo CD 操作 Docker Compose。

## Migration、回滾與備份

一般 dev deploy：

```text
取得主機 deploy lock
-> 驗證目標仍是最新允許的 dev SHA
-> pull immutable image digest
-> 檢查磁碟、DB 與備份
-> 暫停 app/worker 寫入
-> 同 digest 執行 migration
-> 啟動 app/worker/cloudflared
-> health + static asset + worker smoke
-> 記錄成功 digest
```

Migration 失敗即停止。DB migration 不自動降版；只有 schema 相容時才能回到前版 app digest。migration 採 additive expand/contract，破壞性變更另行規劃。

dev PostgreSQL 使用命名 volume，發布前執行 `pg_dump`；第一階段至少保留可驗證的本機 dev 備份，production 上線前必須改成加密的主機外備份並完成 restore 演練。同機 volume 或 backup 不能算 production 災難復原。

## 第一篇 Threads 測試

Threads 測試只在 dev 部署驗收通過後進行，不屬於 Docker deploy workflow，也不把 Threads token 上傳 VPS。

圖片：

```text
https://dev.furfriend-finder.com/images/twobao222.jpg
```

驗收順序：

```text
GET /images/twobao222.jpg -> 200 + image/jpeg + public HTTPS
-> 本機 .env 驗證 Threads token 身分/權限
-> 建立 IMAGE container
-> 等待 container 完成
-> 顯示貼文文字與圖片供使用者確認
-> 使用者明確核准
-> 呼叫 threads_publish
-> 保存 post ID / permalink / 時間，不保存 token
```

`THREADS_ENABLED=false` 維持於 dev。每日挑選動物、發文資料表、冪等、重試、token refresh、告警與排程 worker 留待下一份 spec。

## 實作任務與驗收

### Task 1：建立最新 dev 實作分支與基準驗證

**Dependencies:** 無。

**工作：** 從最新 `dev` 建立 `feature/260909-docker-dev-deployment` 的獨立 worktree；重新核對 Dockerfile、migration、worker、env、CI、dirty tree 與既有部署檔。

**驗收：**

- 分支基底等於當下最新 `origin/dev`。
- 原工作目錄既有修改完全不變。
- `pnpm lint`、`pnpm type-check`、相關 tests 與 builds 的基準結果留存。

### Task 2：建立可驗證的 dev Compose 垂直切片

**Dependencies:** Task 1。

**工作：** 建立 app + PostgreSQL + migration，再加入 worker、Mailpit、cloudflared；設定 healthcheck、dependency、internal network、named volume、log rotation 與資源上限。

**驗收：**

- `docker compose config` 成功且不輸出真實 secret。
- 空 DB migration、重跑及前版升級測試成功。
- app/worker 使用相同 image digest；DB/app 不公開 host port。
- 容器內 `/images/twobao222.jpg` 可讀。

### Checkpoint A：本機/隔離環境

- CI、build、Compose validation 與 real PostgreSQL migration 全部通過。
- app、worker、Mailpit、cloudflared network boundary 經人工 review。
- 使用者確認後才修改 VPS。

### Task 3：非破壞性主機 bootstrap

**Dependencies:** Checkpoint A。

**工作：** 記錄 K3s/network 基準，安裝 Docker Engine + Compose plugin，建立受限 deploy identity、目錄、log/磁碟政策及 dev secret files；不停止 K3s/containerd。

**驗收：**

- Docker hello-world/Compose smoke 成功。
- K3s node、Pod、ingress 與既有 Zeabur URL 在安裝前後皆正常。
- 80/443 owner 不變；FurFriend 尚未公開任何 host port。
- Docker 與 K3s CIDR 無衝突，主機無新增 OOM。

### Task 4：dev Tunnel、DNS 與首次受控部署

**Dependencies:** Task 3；使用者在 Cloudflare Dashboard 建立 dev Tunnel/token。

**工作：** 將 token 放入 root-only secret file，設定 `dev.furfriend-finder.com -> http://app:2486` route，首次執行 migration 與 dev Compose。

**驗收：**

- Tunnel 顯示 `Healthy`，DNS CNAME 正確。
- 外部 `/health`、React 首頁與二寶圖片皆為有效 HTTPS。
- DB、Mailpit、2486 不可由公網直接連線。
- `DISABLE_DATA_CRON=true`、`THREADS_ENABLED=false`，未寄真實通知。
- K3s/Zeabur 服務未被變更或中斷。

### Checkpoint B：dev runtime

- 重啟 dev container 後 DB volume 與服務恢復。
- worker 啟動、heartbeat/backlog 可查，但不產生未授權外部副作用。
- 記憶體、swap、磁碟與 K3s readiness 在可接受範圍。
- 使用者於 dev 網站人工驗收。

### Task 5：dev 自動 CD 與 rollback

**Dependencies:** Checkpoint B。

**工作：** GitHub Actions 在 dev merge 後建置 GHCR digest，透過受限 SSH 執行固定 deploy script；加入 concurrency、latest-SHA、防 secret log、smoke 與 rollback。

**驗收：**

- 一次核准的 feature -> dev merge 自動更新 dev 網站。
- release metadata 可追到 commit SHA、CI run 與 image digest。
- 模擬部署失敗不標記成功；相容的前版 digest 可回退。
- workflow 不 push/merge `dev` 或 `main`，不部署 production。

### Checkpoint C：第一階段完成

- dev 自動 CD、隔離、HTTPS、靜態圖片、migration、worker、restart、rollback 全部留存證據。
- production container/Tunnel/volume/secrets 仍不存在。
- 進入 Threads 第一篇人工測試；發布前再次取得使用者確認。

## 風險與緩解

| 風險 | 影響 | 緩解 |
| --- | --- | --- |
| K3s + Docker 爭用 3.6 GiB RAM | OOM、Zeabur 或 app 中斷 | dev-only、硬限制、關閉重工作、逐步啟動與量測 |
| Docker iptables 影響 K3s | ingress/Pod 網路失效 | 安裝前後 smoke、記錄 routes/CIDR、先停止 FurFriend 而非 K3s |
| Tunnel token 外洩 | 未授權 connector | file secret、dev/prod 分離、禁止 log、可撤銷輪替 |
| Tunnel/Cloudflare 中斷 | dev 網站不可達 | health alert、connector restart；K3s bridge 僅作備案 |
| 同機磁碟耗盡 | K3s 與 DB 同時受影響 | image/log retention、磁碟告警、備份移出主機 |
| migration 與舊版不相容 | rollback 受阻 | additive schema、先備份、migration gate、禁止自動降版 |
| main 被意外部署 | 未驗收版本上線 | 本階段無 production caller/secrets/Tunnel，workflow 明確拒絕 prod |

## 執行前仍需的使用者操作／資訊

1. 在 Cloudflare Dashboard 建立 `furfriend-dev` Tunnel；token 只在需要時安全放入主機，不貼到聊天。
2. 確認 Cloudflare 帳號可管理 `furfriend-finder.com` 的 Tunnel route/DNS。
3. 實作 PR 完成並通過 review 後，明確核准是否允許修改 VPS。
4. 第一篇 Threads 文字與正式發布仍需另一次明確確認。

## 官方參考

- [Cloudflare：建立 Dashboard-managed Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/)
- [Cloudflare：Published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)
- [Cloudflare：Tunnel DNS records](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)
- [Cloudflare：Tunnel token permissions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/remote-tunnel-permissions/)
- [Cloudflare：Tunnel run parameters / token file](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/run-parameters/)
- [Docker：Compose production](https://docs.docker.com/compose/how-tos/production/)
- [Docker：Compose networking](https://docs.docker.com/compose/how-tos/networking/)
- [Docker：Compose project name](https://docs.docker.com/compose/how-tos/project-name/)
- [GitHub：Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
- [GitHub：Deployment environments and controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
