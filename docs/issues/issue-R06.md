# [R-06] 密碼重設 `redirectTo` 硬編碼為 `https://example.com/reset-password`，功能完全無法使用

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 密碼重設流程 |

## 問題描述

`authController.resetPassword` 中 `redirectTo` 使用硬編碼的 `"https://example.com/reset-password"`（佔位符 URL），且程式碼本身有 TODO 標記說明功能未完成。使用者申請重設密碼後，收到的信件連結會導向 example.com，密碼重設流程完全無法完成。

## 影響的檔案與位置

- `backend/src/Controller/authController.ts` 第 100-120 行

## 根本原因（Root Cause）

```typescript
// authController.ts:100 — 有 TODO 標記
// TODO: Still not working, need a callback url or sth
resetPassword = async (req, res, next) => {
    const authReponse = await auth.api.requestPasswordReset({
        body: {
            email,
            redirectTo: "https://example.com/reset-password",  // ❌ 佔位符 URL
        },
    });
}
```

## 影響範圍（Impact）

所有嘗試重設密碼的使用者都無法完成流程，密碼重設功能等於不存在。

## 修復規格（Fix Specification）

### 需要的修改

**步驟 1：在 `.env` 加入環境變數**
```
APP_URL=http://localhost:2486
```

**步驟 2：修改 `authController.ts`**
```typescript
// Before:
redirectTo: "https://example.com/reset-password",

// After:
redirectTo: `${process.env.APP_URL || 'http://localhost:2486'}/reset-password`,
```

**步驟 3：確認 viewRouter 中有 `/reset-password` 路由和對應的 EJS 模板**（若不存在需新增）。

### 修改後的預期行為

使用者申請重設密碼後，收到的信件連結正確導向本專案的重設密碼頁面。

## 驗收條件（Acceptance Criteria）

- [ ] 申請重設密碼的信件連結指向正確的應用程式 URL（非 example.com）
- [ ] 使用者點擊連結後可以看到重設密碼表單
- [ ] 完成重設後密碼確實更新，使用者可用新密碼登入
