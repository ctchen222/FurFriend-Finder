# React Web A/B 驗收

## 範圍與邊界

以 dev 為基線，單一工作分支完成 React Web A/B，等待使用者本機驗收後再開 PR。中途之家 C 與手機 App 都不在本輪實作。

前端依序分為 routes/pages、feature hooks、API client、純資料轉換與展示元件。前端不引用 repository、DB、SMTP 或 server secrets；後端的寫入、交易與寄信副作用保留在 application/service 與 repository 邊界。資料契約以 JSON 為準，手機端未來可重用 API。

## 必須通過

- [ ] PostgreSQL migration 與再次執行 no-op；不覆寫既有 DB。
- [ ] 真實 SMTP 認證與指定測試信發送；收件匣到信由使用者確認。
- [x] 註冊 → 本機 Mailpit 收到驗證信 → 驗證 → 登入 → 刷新仍登入 → 登出。外部收件匣待人工確認。
- [x] 忘記密碼 → Mailpit 收到重設信 → 重設 → 新密碼可登入。
- [ ] Google 登入依設定顯示；無 credentials 時明確列為未驗證。
- [ ] 建立案件 → worker 配對 → 結果頁 → 通知；無候選與失敗區分。
- [ ] 手動通知遵守使用者偏好與 ownership；關閉案件不再送待送通知。
- [ ] 快速比對、收容動物列表、分頁、詳情、通知設定可用。
- [ ] 手機寬度、鍵盤操作、loading/error/empty state 驗證。
- [ ] TypeScript、build、單元/API 測試與真實瀏覽器端到端測試。

## 後續 roadmap

使用者驗收 A/B → 開 PR 至 dev → 經明確同意 merge → 再規劃/實作 C：組織、成員權限、刊登與認養申請。iOS/Android 暫列未來；優先共用資料契約與業務規則，不預先建立手機專案。

## 已取得證據與仍待驗收

- `tests/web-e2e/auth.spec.ts`：真實瀏覽器帳號流程，包含通知偏好切頁與重新整理後一致。
- `tests/web-e2e/reports.spec.ts`：真實 DB 建案、worker 配對、Mailpit 通知、編輯、找回、跨帳號拒絕；舊手動通知遵守拒收偏好、舊結案更新 revision。公開列表／分頁／詳情／快速配對，以及 320、768、1024、1440 寬度無水平溢出。
- `src/__test__/integration/reactWebRouter.test.ts`：React 建置入口、深層網址、HTML 404，以及 API／靜態資產邊界。
- `src/__test__/unit/service/matching.service.test.ts`：收容所地理編碼失敗保留候選，距離未知不冒充零距離。
- 單一成功建案案例不等於完整匹配品質；無候選、故障恢復、人工標註品質、Google 真實 callback、完整無障礙與容器 runtime 仍須分別核對。上方未勾選項目不得視為已完成。

本機啟動、SMTP 模式與人工操作順序見 [local-react-testing.md](local-react-testing.md)。
