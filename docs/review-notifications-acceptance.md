# 審核通知與介面改善驗收

日期：2026-09-08。分支 `feature/260908-review-notifications`，保留 dev 基底與尚未合併的 C1/C2 相依提交。未 push、未開 PR、未 merge。

## 使用流程

1. 更新後先執行 `pnpm db:migrate`，再啟動 API 與新版 `pnpm workers`。API 本身不會啟動 worker；舊 worker 不得與新通知任務混用。
2. 用非組織成員的平台審核員核准／退回組織。Owner/Admin 在個人空間看到通知、未讀數及組織入口，並由 outbox 寄 email。
3. 停權／恢復通知發給當時全體有效成員。寄送及讀取時再次檢查成員資格；停權不阻擋此通知。核准／退回通知另要求目前仍為 Owner/Admin。
4. 審核工作台「通知寄送狀態」顯示 heartbeat、待處理／失敗數及逾時警示。失敗可重送，需確認、通過權限／成員檢查及一分鐘冷卻，並留下 audit。Reviewer 不可替自己參與的組織重送。
5. 新通知才適用本機 V12 migration，**不補寄既有二寶之家或其他歷史審核**。請另建測試組織驗收，不必為測試反覆停權真實組織。

`pnpm workers` 也會處理既有協尋與邀請待辦；測試請使用下方隔離 verifier，不要以啟動真實 worker 代替測試。

## 實作契約

- 組織狀態、review／moderation、audit、站內通知與 outbox 在同一 client transaction。通知任務建立失敗時整筆回滾。
- `organization_notifications` 以 `(organization_id,organization_version,kind,recipient_id)` 唯一；每通知最多一個 outbox 工作。不建立跨服務 EventBus 或 Redis queue。
- 共用 outbox 儲存；原邀請 worker 只領 MEMBER_INVITATION／OWNERSHIP_TRANSFER，新 notice worker 只領 ORGANIZATION_NOTICE，避免把新種類誤認為移轉。
- 四個 worker 迴圈互相隔離；同一迴圈不重疊。SIGTERM 停止領取後等待最多 15 秒讓在途工作收尾，逾期依租約恢復。
- 租約 120 秒，寄送中每 30 秒續租；claim token 防止舊 worker 覆寫新結果。SMTP TCP／greeting timeout 10 秒，idle timeout 30 秒；不是外部副作用 exactly-once 保證。
- 暫時錯誤最多 8 次嘗試；間隔 1 分、5 分、30 分、2 小時、6 小時、12 小時、24 小時。認證錯誤／SMTP 5xx 為永久失敗，等待處理後人工重送。
- 每次寄一個收件人，只有 SMTP accepted 包含該收件人才標 SENT，保存 message ID。記錄 sanitized error code，不保存 SMTP 錯誤全文或密碼。
- SMTP 已接受、DB 寫回前當機，重試仍可能重寄；固定 Message-ID 僅供追蹤。不宣稱收件匣投遞／已讀，無供應商 webhook。
- worker 超過 90 秒無 heartbeat、超過 5 分鐘的逾期待辦或 FAILED 工作，在審核頁標「需要處理」；狀態每 30 秒更新。這是站內操作警示，沒有新接外部告警供應商。
- 通知正文是事件快照；頁面／信件連結提醒以最新狀態為準。移除成員不能撤回已寄出的 email 或已閱讀內容。

## API

| 路徑 | 權限與行為 |
| --- | --- |
| GET `/api/v1/me/organization-notifications?pageSize=20&cursor=` | 本人、目前有資格；最新優先、穩定序號游標、未讀數 |
| POST `/api/v1/me/organization-notifications/:id/read` | 本人、仍有資格；冪等 204；其他人 404 |
| GET `/api/v1/reviewer/notice-deliveries?cursor=` | 平台 Reviewer；健康狀態與分頁失敗工作，不輸出 email |
| POST `/api/v1/reviewer/notice-deliveries/:id/retries` | 獨立 Reviewer；FAILED 才可重送，狀態／權限變更回 409／403 |

所有端點都使用既有 session、same-origin 與 no-store。通知／審核寄送不受協尋 Email 偏好控制。錯誤回傳沿用 organization error contract。

## 驗收命令與證據

- `pnpm exec jest --runInBand --roots src`：65 suites／407 tests 通過。
- `pnpm verify:organization-review`：真實隔離 PostgreSQL；V12 首跑／重跑、審核回滾、收件人／撤權、分頁、冪等已讀、重複 enqueue、租約回收、舊 claim、重試及重送權限通過。
- `VERIFY_NOTICE_SMTP=true pnpm verify:organization-review`：臨時 localhost SMTP 421 失敗後仍為 PENDING 並延遲；恢復後 Mailpit 接受 5 封，2 筆已移除成員取消，成功工作均有 message ID。不使用 `.env` 的真實 SMTP。
- `pnpm test:c2:e2e`：7 個隔離 DB／真實 HTTP／Better Auth／Chrome 情境通過；包含審核→站內通知→標已讀→最新組織、跨帳號拒絕、已讀失敗保留、底線修正、長名稱、四種卡片寬度及原 C2 刊登回歸。
- 瀏覽器測試先證明原卡片 `text-decoration-line: underline`，改為局部卡片樣式後確認 `none`，保留 focus outline；不全站移除一般連結底線。
- `pnpm verify:organization-animals`：既有 C2 真實 DB 權限、圖片、公開與交易回歸通過。
- 既有 React regression：design／filters／organization-membership／organization-review-publication／organizations／shelter-selection／states 共 25 個通過。
- Backend build、前後端型別與 ESLint、React build、`git diff --check` 通過；本機 V12 首次套用 1 個 migration，第二次 0 個。加入審核員切換時重新掛載後，另重跑 3 個通知定向瀏覽器測試通過。

若回退程式，不可讓不認識新 kind 的舊版 worker 處理 outbox。先停止 workers，保留通知與待寄資料，待新版恢復；不提供刪除真實通知的自動 down migration。

本輪未實測外部收件匣，沒有啟動真實背景寄送、修改真實組織審核狀態或補寄舊事件。Mailpit 僅留本輪測試信；一次性測試 schema 結束後移除。

## 前端與後續

保留暖色配色；公開／私人組織卡片統一標題、類型標籤、地區、留白及明確入口；取消名稱底線，不顯示缺少介紹的佔位文字。新增通知區支援未讀、錯誤、空狀態、分頁及重新整理。個人通知與寄送工作台依登入身分重新掛載。

目前 C1 及 C2.1／C2.2 已實作；本批通知與 UI 待使用者 review。下一批是 C2 條件／pg_trgm 動物搜尋；之後 C3 領養申請與結案。一般編輯／公開下架通知、手機 App、部署與外部 queue 不在本批。
