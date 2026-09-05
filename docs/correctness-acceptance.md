# FurFriend Finder 正確性驗收條件

本文件是三輪正確性工作的驗收契約。每一項都必須有對應的自動化證據或人工操作紀錄；「程式存在」或「單元測試通過」不等於整項驗收完成。

## 分支與套用順序

所有 PR 的 base 都是 `dev`。資料庫 migration 必須依下列順序套用：

```text
V3 source provenance
  -> V4 lost-report ownership
  -> V5 OAuth account identity
  -> V6 report lifecycle and match jobs
  -> V7 notification outbox
```

目前各責任分支的目的與 commit，請以 PR 描述中的實際 commit 為準；開 PR 前先確認分支沒有混入未授權的 dirty files。

## 自動化驗收

在每個 PR 分支上執行：

```bash
pnpm exec tsc --noEmit
pnpm exec jest --runInBand --silent
pnpm build
```

Migration runner 額外執行：

```bash
pnpm db:migrate
```

預期結果：TypeScript、Jest、build 均 exit code 0；migration 第二次執行必須為 no-op，且修改已套用 SQL 後必須拒絕啟動。

## 功能驗收矩陣

| 領域 | 必須證明的條件 | 證據 |
| --- | --- | --- |
| API 匯入 | 同一來源紀錄重跑不產生重複資料 | 匯入前後 row count、唯一索引錯誤為 0 |
| API 匯入 | 無效／缺漏日期不被轉成 1970 年 | DB 查詢確認欄位為 `NULL` |
| API 匯入 | 每筆外部資料可追溯來源 | `source_system`、`source_record_id` 可查回原始 API 紀錄 |
| DB migration | 多程序同時執行不重複套用 | 兩個 migration process 的 `schema_migrations` 只有一筆 |
| DB migration | migration 被修改時 fail closed | checksum mismatch 使 command exit non-zero |
| 走失案件 | 未登入使用者不能讀取或修改他人案件 | API integration test 回傳 401/403 |
| 走失案件 | 關閉案件後不再產生新配對通知 | close 後 pending/running job 被取消 |
| matching | 候選不受固定 200 筆或 150 公里硬切限制 | regression test 包含超過限制但應命中的候選 |
| matching | 排序穩定且結果可解釋 | 相同輸入多次排序一致，candidate 有 reason/score |
| matching | 舊 revision 不會覆寫新 revision | worker stale-job test 通過 |
| email | matching 結果先持久化再寄信 | outbox 有 candidate snapshot，寄信失敗可 retry |
| email | 使用者關閉 mail preference 時不寄信 | mail worker 將通知標為 disabled |
| Google OAuth | Google 新帳號可建立並登入 | 真實 OAuth callback browser test |
| Google OAuth | 未驗證 provider email 不可綁定既有帳號 | callback 被拒絕且既有帳號不變 |
| Google OAuth | `returnTo` 不能導向外部網址 | allowlist test 與 browser test |

## 必須補做的外部驗收

以下項目不能由目前的 mock／unit test 代替：

1. 使用乾淨 PostgreSQL 套用 V3～V7，再使用既有資料庫執行升級。
2. 使用真實 MOA API fixture，執行兩次匯入並比對 row count、來源欄位與更新欄位。
3. 使用測試 SMTP 驗證 outbox → worker → provider 的成功、失敗與重試。
4. 使用 Google OAuth 測試帳號完成註冊、登入、登出、錯誤 email linking 與非法 redirect。
5. 使用至少 30 筆人工標註的走失／命中案例重新計算 matching 指標；未完成前不得宣稱圖片 matching 已達 production-ready。

## 通過門檻

只有在下列條件全部成立時，才可稱為「第一階段正確性完成」：

- 自動化驗收全部通過。
- V3～V7 在乾淨與既有 PostgreSQL 都成功套用。
- Google OAuth 與 SMTP 的外部驗收有可重現紀錄。
- matching 有人工標註資料與版本化指標。
- 所有 PR 都由使用者審查後才可合併到 `dev`。

