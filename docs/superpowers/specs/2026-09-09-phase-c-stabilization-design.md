# Phase C Stabilization Design

日期：2026-09-09；使用者已核准 H0 Phase C 穩定化後開始實作。

## 目標

修正已合併 Phase C 的四類風險：過期狀態被交易 rollback、寄信期限與 cooldown 不一致、多 worker 固定 lease 造成重複副作用，以及組織／動物／圖片缺少資源界線。此批不新增搜尋、認養申請、手機 App 或外部 queue。

## 邊界與順序

```text
membership correctness
  -> durable mail cooldown
  -> renewable worker lease
  -> bounded organization/photo resources
  -> full regression and real PostgreSQL verification
```

政府 ShelterAnimal、組織 OrganizationAnimal 與走失匹配資料流維持原有邊界。本批只穩定既有行為，不改 matching 排名與候選集合。

## 1. 組織生命週期與寄信契約

接受 invitation 或 ownership transfer 時，若資料仍為 `PENDING` 但已過期，transaction 內更新成 `EXPIRED` 並回傳內部 sentinel；transaction commit 後，service 才轉為原本的 404 domain error。如此維持對外不可枚舉行為，同時保存資料生命週期。

Invitation 的期限維持七天；ownership transfer 維持二十四小時，信件文案必須與資料庫一致。

建立邀請、重寄邀請與建立 ownership transfer 共用 PostgreSQL durable cooldown。既有組織 row lock 會序列化同組織 mutation；repository 在撤銷舊 token 或建立新 outbox 前查詢最近六十秒相同組織、收件者與 mail kind 的 outbox。被限制時回 429，且不撤銷舊 token、不新增 audit 或 outbox。

## 2. Renewable worker lease

Match、lost-mail、organization-mail 與既有 organization-notice 使用同一組 lease 常數：120 秒 lease、每 30 秒續租。每個 repository 提供由 `id + claimToken + RUNNING + lease 尚未過期` fencing 的 `renew()`。

Worker 在外部副作用開始前啟動 renewal，完成、失敗或取消時一律清除 timer。續租失敗會記錄 bounded job ID，不記錄 Email、SMTP 回應或 token。SMTP 仍是 at-least-once；續租降低正常慢工作被重領的機率，但不宣稱 exactly-once。

Geocoding client request timeout 設為十秒，避免單次外部請求無限等待。Match job crash 後不再續租，120 秒後可由其他 worker reclaim。

## 3. Resource guardrails

限制集中在 `organizationLimits` config，接受嚴格正整數環境變數並採安全預設：

| 環境變數 | 預設 |
| --- | ---: |
| `MAX_ORGANIZATIONS_PER_USER` | 5 |
| `MAX_ANIMALS_PER_ORGANIZATION` | 500 |
| `MAX_ORGANIZATION_PHOTO_BYTES` | 1073741824 |
| `PHOTO_PROCESSING_CONCURRENCY` | 2 |

建立組織時鎖定 account row 後計數；建立動物與新增圖片時沿用 organization row lock 後計數，避免同一組織內並行超額。request-id idempotent retry 必須先回傳原結果，不因 quota 已滿而失敗。

圖片正規化前使用 process-wide fail-fast semaphore。無名額時回 429 `PHOTO_PROCESSING_BUSY`；不建立無界記憶體 queue。正規化完成後以輸出 WebP byte size 檢查組織總容量，超額回 422 `ORGANIZATION_PHOTO_QUOTA`。release 必須放在 `finally`，解碼失敗也不洩漏 permit。

## 4. 驗收與回退

- 每一垂直 slice 先產生可觀察的失敗測試，再做最小修正。
- 真實 PostgreSQL 驗證過期 commit、cooldown 並行、stale claim、crash reclaim 與 quota 並行。
- Jest、type-check、lint、backend build、React build 與既有 C2 Playwright 不得退步。
- 新限制全部有安全預設與 `.env.example` 說明，但不修改使用者主工作目錄的 dirty `.env.example`。
- 回退應回退應用程式；本批不需要破壞性 down migration，也不刪除既有 outbox 或動物資料。

### V13 safe recovery

V13 timestamp migration 前必須停止所有 worker。migration 將 legacy `RUNNING` claim reset 為 `PENDING`、清除 claim token 與 lease，讓新 worker 以新的 token 重新 claim；不可嘗試保留混合來源的 lease。歷史 `sent_at` 保留作為既有 wall-time reference data，不保證可還原為精確 instant。

SMTP 語意維持 at-least-once，SMTP acceptance 不等同收件匣送達。圖片 limiter 是 per API process 的 fail-fast semaphore；組織／動物／照片 quotas 皆由環境變數設定並以安全預設啟動，並非跨 process distributed quota limiter。

## 不在本批

- C2.3 `pg_trgm`／跨來源動物搜尋。
- C3 認養申請。
- 外部 broker、Redis rate limiter、object storage。
- Better Auth／Nodemailer dependency upgrade；另開 dependency hardening PR。
