# React Web A/B 驗收

## 範圍與邊界

以 dev 為基線，單一工作分支完成 React Web A/B，等待使用者本機驗收後再開 PR。中途之家 C 與手機 App 都不在本輪實作。

前端依序分為 routes/pages、feature hooks、API client、純資料轉換與展示元件。前端不引用 repository、DB、SMTP 或 server secrets；後端的寫入、交易與寄信副作用保留在 application/service 與 repository 邊界。資料契約以 JSON 為準，手機端未來可重用 API。

## 必須通過

- [ ] PostgreSQL migration 與再次執行 no-op；不覆寫既有 DB。
- [ ] 真實 SMTP 認證與指定測試信發送；收件匣到信由使用者確認。
- [ ] 註冊 → 收到驗證信 → 驗證 → 登入 → 刷新仍登入 → 登出。
- [ ] 忘記密碼 → 收到重設信 → 重設 → 新密碼可登入。
- [ ] Google 登入依設定顯示；無 credentials 時明確列為未驗證。
- [ ] 建立案件 → worker 配對 → 結果頁 → 通知；無候選與失敗區分。
- [ ] 手動通知遵守使用者偏好與 ownership；關閉案件不再送待送通知。
- [ ] 快速比對、收容動物列表、分頁、詳情、通知設定可用。
- [ ] 手機寬度、鍵盤操作、loading/error/empty state 驗證。
- [ ] TypeScript、build、單元/API 測試與真實瀏覽器端到端測試。

## 後續 roadmap

使用者驗收 A/B → 開 PR 至 dev → 經明確同意 merge → 再規劃/實作 C：組織、成員權限、刊登與認養申請。iOS/Android 暫列未來；優先共用資料契約與業務規則，不預先建立手機專案。
