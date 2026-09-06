# React Web A/B 驗收

## 範圍與邊界

以 dev 為基線，單一工作分支完成 React Web A/B，等待使用者本機驗收後再開 PR。中途之家 C 與手機 App 都不在本輪實作。

前端依序分為 routes/pages、feature hooks、API client、純資料轉換與展示元件。前端不引用 repository、DB、SMTP 或 server secrets；後端的寫入、交易與寄信副作用保留在 application/service 與 repository 邊界。資料契約以 JSON 為準，手機端未來可重用 API。

## 必須通過

- [x] PostgreSQL migration 與再次執行 no-op；7 筆已套用，再次執行為 0 筆；既有 DB 保留。
- [x] 真實 SMTP 連線認證；2026-09-07 重驗通過，這次未重複寄信。
- [ ] 外部收件匣到信由使用者確認；SMTP 接受不等於投遞成功。
- [x] 註冊 → 本機 Mailpit 收到驗證信 → 驗證 → 登入 → 刷新仍登入 → 登出。外部收件匣待人工確認。
- [x] 忘記密碼 → Mailpit 收到重設信 → 重設 → 新密碼可登入。
- [x] Google 登入依設定顯示；真實註冊頁可前往 Google，回呼後 DB 已有新帳號、已驗證 Email 與有效 session。
- [ ] 使用者確認 Google 登入後重新整理、登出、再次登入的完整體驗。
- [x] 建立案件 → worker 配對 → 結果頁 → Mailpit 通知；隔離 SQL 驗證無候選，介面測試區分成功、等待與失敗。
- [x] 手動通知遵守使用者偏好與 ownership；關閉案件取消待處理工作／待送通知。已交付 SMTP 或正在寄送的郵件不保證撤回。
- [x] 快速比對、收容動物列表、物種／性別／縣市篩選、分頁、詳情、通知設定可用。
- [x] 320／768／1024／1440 寬度無水平溢出；鍵盤註冊、loading/error/empty state 驗證。這不是完整 WCAG 認證。
- [x] 2026-09-07：完整後端 lint、TypeScript、前後端 build、322 個 Jest 測試與 11 個瀏覽器案例通過。
- [x] 前次 Docker build 與完整 runtime 健康／DB 查詢通過；最後 migration 錯誤處理修正尚未重建映像。本機驗收使用目前原始碼程序。

## 後續 roadmap

使用者驗收 A/B → 開 PR 至 dev → 經明確同意 merge → 再規劃/實作 C：組織、成員權限、刊登與認養申請。iOS/Android 暫列未來；優先共用資料契約與業務規則，不預先建立手機專案。

## 已取得證據與仍待驗收

2026-09-07 原版設計恢復：React 共用原版 CSS，恢復首頁推薦、導覽、收容卡片、表單與個人頁；收容編號移至詳細頁。前端 lint、型別／build 與 14 個瀏覽器案例通過；Docker web-build 已驗證原版 CSS 依賴可用。原版通知開關的零尺寸 input 已修正為完整可操作區域，未使用強制點擊略過問題。

- `tests/web-e2e/auth.spec.ts`：真實瀏覽器帳號流程，包含通知偏好切頁與重新整理後一致。
- `tests/web-e2e/reports.spec.ts`：真實 DB 建案、worker 配對、Mailpit 通知、編輯、找回、跨帳號拒絕；舊手動通知遵守拒收偏好、舊結案更新 revision。公開列表／分頁／詳情／快速配對，以及 320、768、1024、1440 寬度無水平溢出。
- `src/__test__/integration/reactWebRouter.test.ts`：React 建置入口、深層網址、HTML 404，以及 API／靜態資產邊界。
- `src/__test__/unit/service/matching.service.test.ts`：收容所地理編碼失敗保留候選，距離未知不冒充零距離。
- `src/scripts/verify-empty-matching.ts`：隔離的 PostgreSQL 暫存表，真實 service／worker／repository 完成空結果並不建立通知；結案取消待處理匹配、停用待送通知，且通知無法再被領取；public 收容動物仍為 8,282 筆。
- `src/__test__/unit/migrationRunner.test.ts`：解鎖失敗會銷毀連線；migration 與解鎖同時失敗時保留原始 migration 錯誤。修正後本機 migration 再執行為 0 筆。
- `tests/web-e2e/states.spec.ts`：受控 API 的 loading、error/retry、空資料、鍵盤表單，以及等待／失敗時明確標示舊配對結果與舊通知。
- `src/__test__/unit/auth.oauth.test.ts`：Google provider profile 驗證與既有未驗證帳號拒絕綁定；不能代替真實 Google callback。
- `tests/web-e2e/filters.spec.ts`：真實篩選與 cursor 下一頁維持條件、無重複資料、清除條件同步更新欄位。
- 單一成功建案案例不等於完整匹配品質。真實 Google callback、外部收件匣到信、SMTP 接受後程序崩潰的重寄風險與人工標註品質仍需另行驗收；不得宣稱 exactly-once 寄信或保證找回率。

## 人工關卡與邊界

目前 Google credentials 已配置，API 已重新載入。已用真實瀏覽器由 React 註冊頁前往 Google 登入畫面，未看到 invalid_client 或 redirect_uri_mismatch。之後唯讀 DB 檢查確認 2026-09-07 00:25（台北）建立一筆新的 Google 帳號，Email 已驗證且有有效 session；沒有讀取或輸出帳號個資、token。此證據支持回呼建帳成功，但使用者瀏覽器重整、登出與再次登入仍待確認。不要貼出 secret、授權碼或 session。
使用者驗收前不開 PR、不 merge；C 必須等待 A/B 驗收、經批准合併，以及走失匹配品質關卡通過。
現有 EJS 以 `LEGACY_WEB_ENABLED=true` 作明確回退選項，待使用者驗收後再決定退役，不影響預設 React 路徑。

本機啟動、SMTP 模式與人工操作順序見 [local-react-testing.md](local-react-testing.md)。
