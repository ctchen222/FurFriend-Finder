# [L-06] 寄件人 email 地址硬編碼在設定檔中

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 所有 Email 功能（驗證信、配對通知、歡迎信等） |

## 問題描述

`config/mail.ts` 中有硬編碼的私人 email 地址 `abfa762466@gmail.com` 作為預設寄件人，這個地址被暴露在 source code 和 git 歷史中。

## 影響的檔案與位置

- `backend/src/config/mail.ts` 第 15 行

## 根本原因（Root Cause）

```typescript
// config/mail.ts:15
this.sentFrom = process.env.SMTP_SENT_FROM || 'abfa762466@gmail.com'
//                                             ^^^^^^^^^^^^^^^^^^^ 私人 email 暴露在 source code
```

## 影響範圍（Impact）

- 個人 email 地址暴露在 git 歷史中（即使未來移除，歷史記錄仍存在）
- 可能引發 spam 問題
- 部署到生產環境時可能忘記設定環境變數，導致用生產系統的個人 gmail 帳號寄信

## 修復規格（Fix Specification）

### 需要的修改

**`config/mail.ts:15`**
```typescript
// Before:
this.sentFrom = process.env.SMTP_SENT_FROM || 'abfa762466@gmail.com'

// After:
if (!process.env.SMTP_SENT_FROM) {
    throw new Error('SMTP_SENT_FROM environment variable is required');
}
this.sentFrom = process.env.SMTP_SENT_FROM;
```

在 `.env.example` 中加入：
```
SMTP_SENT_FROM=noreply@yourapp.com
```

### 修改後的預期行為

`config/mail.ts` 不含任何硬編碼的 email 地址，未設定環境變數時在啟動時明確報錯。

## 驗收條件（Acceptance Criteria）

- [ ] `config/mail.ts` 不含任何硬編碼的 email 地址
- [ ] 未設定 `SMTP_SENT_FROM` 時，應用程式啟動時拋出明確錯誤
- [ ] `.env.example` 包含 `SMTP_SENT_FROM` 設定說明
