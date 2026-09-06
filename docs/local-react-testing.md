# React A/B 本機測試

本機前端為 `http://localhost:5173`，API 為 `http://localhost:2486`。
這份流程不會部署 VPS，也不會建立或合併 PR。Phase C 與原生 App 不在本輪範圍。

## 安裝與資料庫

在專案根目錄，使用 Node.js 22.22.2 與專案指定的 pnpm：

```bash
nvm use 22.22.2
pnpm install --frozen-lockfile
pnpm --dir web install --frozen-lockfile
docker ps -a --filter name=PostgreSQL
docker start PostgreSQL
pnpm db:migrate
pnpm sync:shelter
```

`PostgreSQL` 是本機已確認存在的容器名稱；其他電腦請先確認自己的容器。
沿用 `.env` 的 `DATABASE_URL`，不要刪除容器 volume 或清空資料庫。
Migration 成功後再次執行應套用 0 筆。`sync:shelter` 會呼叫外部收容資料 API 並更新 DB，非離線測試；地址比對也可能需要外部地理編碼服務。

## 啟動：真實寄信模式

三個終端機都先在專案根目錄執行 `nvm use 22.22.2`。

```bash
# 終端機 1：後端
pnpm dev:api
```

```bash
# 終端機 2：React
pnpm dev:web
```

```bash
# 終端機 3：背景配對與寄信
pnpm workers
```

以 `http://localhost:5173` 開啟網站；不要混用 `127.0.0.1`，避免登入 cookie 與 callback origin 不一致。
`dev:api` 僅覆寫子程序的本機網址，不改寫 `.env`，並停用資料排程。配對與通知需要第三個終端機的 worker。

SMTP 由 API 與 worker 各自讀取，兩個程序必須使用相同模式：

| 變數 | 用途 |
| --- | --- |
| `SMTP_HOST` | SMTP 供應商主機 |
| `SMTP_PORT` | 供應商指定的連接埠 |
| `SMTP_SECURE` | 是否直接使用 TLS；依供應商設定 |
| `SMTP_USER`、`SMTP_PASSWORD` | SMTP 認證，不是網站使用者密碼 |
| `SMTP_SENT_FROM` | 供應商允許的寄件者 |
| `SMTP_TEST_TO` | 實際測試信收件者 |

```bash
pnpm smtp:smoke
```

此命令會認證並真的寄出一封測試信。`Accepted` 只證明 SMTP 接受，不證明收件匣已收到；請連垃圾信件匣一起確認。不要把 `.env` 或 SMTP 密碼貼進 issue、PR 或截圖。

## 自動化驗收：本機攔信模式

瀏覽器測試使用 `example.test` 帳號，必須搭配 Mailpit，不要對真實 SMTP 跑這組測試。
本機已建立 Mailpit 容器時：

```bash
docker start furfriend-react-mailpit
```

新環境才需建立一次：

```bash
docker run -d --name furfriend-react-mailpit \
  -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 \
  -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 \
  ghcr.io/axllent/mailpit:v1.27.4
```

上述 SMTP 認證放寬設定只供 loopback 本機測試，不得照搬到公開主機。
先停止已啟動的 API／worker，再在各自的終端機設定以下環境變數：

```bash
export SMTP_HOST=localhost SMTP_PORT=1025 SMTP_SECURE=false
export SMTP_USER=dev SMTP_PASSWORD=dev
export SMTP_SENT_FROM='FurFriend <dev@example.test>'
```

接著分別執行 `pnpm dev:api` 與 `pnpm workers`；前端仍為 `pnpm dev:web`。
信件只會進入 `http://localhost:8025`，不會送往外部收件匣。
切回真實 SMTP 時，關閉這兩個終端機並在沒有上述覆寫的新終端機啟動。

已安裝 Google Chrome 後，可在第四個終端機執行：

```bash
pnpm test:web:e2e
pnpm exec tsc --noEmit
pnpm exec jest --runInBand --silent
pnpm build:web
```

瀏覽器測試會新增可辨識的測試帳號與走失案件，不會清空 DB；同一時間只跑一組，以免測試產物互相覆蓋。

## 人工驗收順序

1. 註冊 → 收取驗證信 → 點連結 → 登入 → 重新整理仍登入。
2. 關閉通知 → 切到其他頁再返回 → 設定仍維持 → 重新開啟。
3. 建立走失案件 → 等待配對 → 查看候選與理由 → 確認通知信內容一致。
4. 修改案件 → 確認新版本結果 → 標記找回 → 不能再重新配對。
5. 登出 → 私人頁要求登入 → 忘記密碼 → 收取重設信 → 用新密碼登入。
6. 公開收容列表、分頁、詳情與快速比對，在桌面及手機寬度操作。

Google OAuth 必須另外配置 provider 並完成真實 callback 驗收；未配置或未測試不能算通過。
配對流程成功不等於配對準確率已驗證；人工標註品質驗收仍是 Phase C 前的獨立關卡。

## 建置後入口

執行 `pnpm build:web` 後，API 也能提供 React 靜態頁面與深層網址。
日常開發仍使用 `5173`，以保持熱更新與本機登入 callback 的 origin 一致。
尚未建置時，後端頁面入口會回傳明確的 503 提示，不會悄悄回退舊頁面。
驗收期間如需比較舊版，可明確設定 `LEGACY_WEB_ENABLED=true` 後重啟 API；預設使用 React。

## 舊 API 相容性

`POST /api/lost-animals/match/:id/notify` 改為回傳 HTTP 202 與 `extras.queued=true`。
這代表已接受背景配對要求，不代表已寄信；不再回傳同步計算的 `top10Matches` 或 `notified`。
請從 `GET /api/v1/reports/:id` 讀取配對與通知狀態。新舊通知及結案 API 使用同一個 application service，遵守 ownership、案件 revision、結案狀態與通知偏好。
