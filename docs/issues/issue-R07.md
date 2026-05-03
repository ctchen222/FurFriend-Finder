# [R-07] Email 驗證 `callbackURL` 被 comment 掉，新用戶可能無法完成 email 驗證

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 使用者註冊後的 email 驗證流程 |

## 問題描述

`authController.createUser` 呼叫 `auth.api.signUpEmail()` 時，`callbackURL` 被 comment 掉（有 TODO 標記），better-auth 在沒有 callbackURL 的情況下可能無法正確導向驗證完成頁面，導致新用戶收到的驗證連結無法正常完成驗證流程。由於 `requireEmailVerification: true`，未驗證的用戶無法登入。

## 影響的檔案與位置

- `backend/src/Controller/authController.ts` 第 26-35 行

## 根本原因（Root Cause）

```typescript
// authController.ts:26-35
const authResponse = await auth.api.signUpEmail({
    body: {
        name,
        email,
        password,
        // TODO: change callbackURL to your frontend URL
        // callbackURL: "https://example.com/callback",  // ❌ 完全被 comment 掉
    },
    asResponse: true
})
```

`callbackURL` 是 better-auth 中 email 驗證完成後要導向的 URL。沒有設定時，better-auth 可能使用預設值，導致驗證後導向錯誤頁面。

## 影響範圍（Impact）

新用戶收到驗證信後，點擊連結可能無法完成驗證，也無法正常登入（因為 `auth.ts` 設定了 `requireEmailVerification: true`）。

## 修復規格（Fix Specification）

### 需要的修改

**`authController.ts:26-35`**
```typescript
// Before:
// TODO: change callbackURL to your frontend URL
// callbackURL: "https://example.com/callback",

// After:
callbackURL: `${process.env.APP_URL || 'http://localhost:2486'}/`,
```

確認 `APP_URL` 環境變數已設定（可與 R-06 一起處理）。

### 修改後的預期行為

新用戶收到驗證信後，點擊連結成功完成驗證，並被導向到首頁（或指定頁面），可正常登入。

## 驗收條件（Acceptance Criteria）

- [ ] 新用戶收到驗證信後，點擊連結成功完成驗證
- [ ] 驗證完成後被導向到正確頁面（非 404 或錯誤頁面）
- [ ] 驗證後的用戶可以使用 email/password 正常登入
