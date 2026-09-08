# 審核通知實作清單

- [x] 1. 核准／退回交易通知與 outbox、收件人 API、基本通知 UI、寄信
- [x] 2. 停權／恢復與撤權安全測試
- [x] Checkpoint A：真實 DB 交易、migration 重跑、跨帳號隔離通過
- [x] 3. worker 隔離、SMTP 重試／租約、寄送健康與重送
- [x] Checkpoint B：故障復原與 Mailpit 驗證
- [x] 4. 中途卡片與通知 UI 一致性、手機與鍵盤驗收
- [x] 5. 回歸測試、進度同步、驗收文件與 review 交付
- [ ] 使用者 review 通知文案、審核入口與新卡片；未 push／未 merge
