# 中途之家成員管理驗收

日期：2026-09-07。範圍：C1.2。

## 使用流程

- Owner 可用 Email 邀請管理員或協作者；Admin 只能邀請及管理協作者；Editor 只能查看成員名稱與角色。
- 邀請連結要求登入受邀且已驗證的 Email。錯誤帳號只會看到切換帳號提示，不會出現接受按鈕。
- Owner 可調整 Admin／Editor、移除成員及撤銷邀請；所有操作完成後重新讀取伺服器權限。
- Owner 移轉先寄出確認信，接任者接受前不變更權限；接受交易完成後舊 Owner 變為 Admin，接任者成為唯一 Owner。
- 移除待接任成員時，同一交易撤銷相關移轉，避免畫面殘留無法完成的等待狀態。

## 安全與資料限制

- HTTP 只採 session actor 並要求同源 mutation；Zod 嚴格拒絕額外角色或 user 欄位。
- token 使用 HMAC 簽章，資料庫只保存 SHA-256；log、管理 API 與 audit event 都不包含原始 token。
- 邀請有效 7 天、一次性且可撤銷；接受時重新檢查 Email、驗證狀態、組織營運狀態及邀請者當下權限。
- PostgreSQL partial unique index 限制同 Email 單一待處理邀請、每組織單一待處理移轉；既有 deferred owner FK 確保交易提交時恰有一位有效 Owner。
- 組織 Email 使用獨立 outbox，不受走失寵物通知偏好影響；失效事件取消寄送，SMTP 失敗最多三次並採 1／5 分鐘退避。

## 目前驗證證據

- 完整 Jest：58 suites、373 tests 通過。
- 完整 Playwright：25 tests 通過，包含真實註冊、Mailpit、走失通報／配對／寄信、收容所篩選與組織流程。
- 隔離 PostgreSQL schema：migration 重跑為 0；邀請錯誤帳號、撤銷重放、角色隔離、Owner 移轉、唯一 Owner 及立即撤權通過。
- 組織邀請透過本機 Mailpit 實際送達，outbox 只在 SMTP 成功後標記 SENT；一次性測試 schema 已清理。
- backend build、frontend type-check/build、`src` 與 `web/src` ESLint、`git diff --check` 通過。

## 2026-09-09 Phase C H0 regression 與 V13 recovery

| 驗證 | 實際結果 |
| --- | --- |
| `pnpm exec jest --runInBand --roots src --testPathIgnorePatterns='/node_modules/|/dist/|e2e'` | 67 suites / 465 tests 通過，4.244 秒 |
| `pnpm type-check`、`pnpm lint`、`pnpm build`、`pnpm build:web` | 全部 exit 0 |
| `DOTENV_CONFIG_PATH=/Users/ctchen/Development/project/FurFriend-Finder/.env pnpm exec tsx src/scripts/verify-organizations.ts` | invitation/transfer 過期狀態 commit、durable cooldown、SMTP outbox 與 quota 驗證通過；只移除 disposable schema |
| `DOTENV_CONFIG_PATH=/Users/ctchen/Development/project/FurFriend-Finder/.env pnpm verify:organization-review` | V13 timestamp migration、RUNNING claim recovery、renewal 與 stale-claim fencing 通過；只移除 disposable schema |
| `DOTENV_CONFIG_PATH=/Users/ctchen/Development/project/FurFriend-Finder/.env pnpm test:c2:e2e` | 7 / 7 情境通過，aggregate exit 0，52.0 秒 |

V13 部署 recovery 的契約如下：migration 前先停止 worker；既有 `RUNNING` jobs 一律 reset 成可重新 claim 的 `PENDING`，舊 claim token 與 lease 不保留。歷史 `sent_at` 是既有 wall-time 參考資料，不承諾可還原為精確 instant。worker 對 SMTP 維持 at-least-once；SMTP acceptance 不能宣稱為收件匣送達。

組織、動物與照片 quotas 可由環境變數設定，預設為 5／500／1073741824 bytes；照片處理 limiter 預設 2 個 permit，且只在單一 API process 內生效，不是跨 process 的 distributed limiter。

## 尚未包含

- 平台審核、組織發布／停權操作與一般訪客公開頁（C1.3）。
- 中途動物刊登、圖片與 pg_trgm 搜尋（C2）。
- 認養申請及審核流程（C3）。
