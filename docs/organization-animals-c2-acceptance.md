# C2.1 / C2.2 動物刊登與工作區驗收

範圍：組織動物草稿、照片、預覽、公開／下架及送養狀態；在組織公開頁提供已公開動物的入口。領養申請、跨來源搜尋、推薦與手機 App 留待後續。

## 行為契約

- 動物與政府匯入資料分表；每次操作同時驗證組織、會員、動物歸屬。
- ACTIVE 組織的已驗證 Owner/Admin/Editor 可建立及編輯草稿；公開／下架限 Owner/Admin。
- 公開要求組織 ACTIVE、APPROVED、已公開，動物具名稱、物種、縣市、介紹及至少一張照片。
- 已公開動物需先下架才可編輯，避免 Editor 繞過公開審核；暫停或未公開的組織，其動物及照片均不對外提供。
- 草稿與公開狀態獨立於 AVAILABLE / IN_DISCUSSION / ADOPTED；已送養不會被誤標可領養。
- 所有變更驗證版本，舊版本回 409，禁止靜默覆蓋。建立使用 requestId 防止網路重試重複刊登。操作與 audit 同一 transaction。
- 最多六張照片，每張輸入 5 MiB、最多 2500 萬像素；只接受 JPEG/PNG/WebP，解碼後重新編碼 WebP，移除 EXIF，輸出最多 1 MiB。
- 目前照片存 PostgreSQL bytea，與草稿一起 transaction 儲存，免額外服務即可本機驗收；此決策適用早期規模，正式大量刊登前移至 object storage。圖片由有存取檢查的 API 提供，禁止靜態 URL 洩漏草稿。
- 前端沿用既有色彩、panel、表單與按鈕；組織入口提供動物管理，獨立頁面編輯；保存失敗保留輸入，離開未存變更有確認，公開前可預覽。

## 分階段驗收

| 階段 | 必須通過 |
| --- | --- |
| C2.1 資料與權限 | migration 可重跑、跨組織拒絕、移除成員拒絕、Editor 無法公開、未驗證拒絕寫入、版本衝突、idempotency、audit rollback |
| C2.1 圖片與公開 | 假圖片／SVG／超限拒絕、六張上限、相片刪除及封面順序、草稿照片匿名 404、組織下架後公開動物與照片 404 |
| C2.2 操作 | 建立→儲存→上傳→預覽→公開→匿名瀏覽→下架；表單失敗保留、空白／載入／錯誤狀態、鍵盤可操作、320/768/1024/1440 不溢位 |

## 2026-09-08 驗收結果

| 驗證 | 結果 |
| --- | --- |
| `pnpm exec jest --runInBand --roots src` | 63 suites / 396 tests 通過 |
| `pnpm verify:organization-animals` | 真實 PostgreSQL 的上述 C2.1 條件通過；測試 schema 自動移除 |
| `pnpm test:c2:e2e` | 4 個整合情境通過；使用獨立 schema、真實 Better Auth 登入、HTTP API、圖片解碼與 built React |
| 既有 React regression | design / filters / organization-membership / organization-review-publication / organizations / shelter-selection / states 共 25 個通過 |
| 型別、lint、React build | 通過 |
| 本機 migration | V11 套用 1 個 migration；第二次套用 0 個 |

C2 瀏覽器驗收另包含：照片上傳中暫停編輯、preview Escape 關閉、取消內部連結／瀏覽器返回保留草稿、儲存失敗保留輸入、版本衝突明確重載、四個螢幕寬度及鍵盤操作。截圖輸出於 `test-results/c2-editor-{320,768,1024,1440}.png`。

既有註冊驗證信與走失配對的完整 SMTP E2E 本輪未重寄；相關後端單元與整合 regression 已跑。C2 fixture 不啟動 mail/matching workers，避免處理使用者待寄郵件。

## 本機 review

1. 維持原本 `pnpm dev:api`、`pnpm dev:web`，進入「我的中途之家 → 管理動物」。
2. 新增動物、儲存草稿、上傳照片並預覽。Editor 可以準備草稿；Owner/Admin 可以公開。
3. 公開前組織必須已核准並公開，動物必須有名字、物種、縣市、介紹及照片。
4. 無痕視窗開啟組織公開頁，進入動物詳情；下架後再次請求應無法讀取。

`pnpm test:c2:e2e` 自動建立獨立測試資料與 2487 port 的測試伺服器，結束後移除該次 schema。測試 fixture 帳密只存在該 schema。正式使用者帳號與刊登資料不被測試改寫。

前端路由改用同套 React Router 的 data router，以支援 `useBlocker` 保護返回／切換頁面的未儲存內容；刷新與關閉頁面另有 `beforeunload` 保護。既有網址與登入 returnTo 維持相同。

影像 API 依據：[Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/)、[output](https://sharp.pixelplumbing.com/api-output/)。離頁保護依據：[React Router useBlocker](https://reactrouter.com/api/hooks/useBlocker)。
