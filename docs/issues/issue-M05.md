# [M-05] `/profile` 等私人頁面缺少認證保護，任何人都能存取

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | security |
| **影響功能** | 個人資料頁面（/profile）、走失動物登錄頁面（/report-lost） |

## 問題描述

`viewRouter` 的所有路由都沒有認證中介軟體保護，未登入的用戶可以直接訪問 `/profile` 和 `/report-lost` 等應該需要登入才能存取的頁面。

## 影響的檔案與位置

- `backend/src/router/viewRouter.ts`（全部路由）

## 根本原因（Root Cause）

```typescript
// viewRouter.ts — 沒有任何認證 middleware
router.get('/profile', async (req, res) => {
    // 只做「有無用戶」的條件判斷，但不強制要求登入
    let lostAnimals: any[] = [];
    if (res.locals.user && res.locals.user.email) {
        // 有登入才查資料（但頁面仍然渲染）
    }
    res.render('profile', { user: res.locals.user, lostAnimals });
    // ❌ 未登入用戶也能看到 /profile 頁面
});
```

## 影響範圍（Impact）

未登入用戶可以訪問 `/profile`（看到空的個人資料頁）和 `/report-lost`（看到走失動物登錄表單），暴露了不應對未授權用戶顯示的頁面結構。

## 修復規格（Fix Specification）

### 需要的修改

**步驟 1：建立 `backend/src/middleware/requireAuth.ts`**
```typescript
import express from 'express';

export const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
) => {
    if (!res.locals.user) {
        return res.redirect('/login?error=' + encodeURIComponent('請先登入'));
    }
    next();
};
```

**步驟 2：修改 `viewRouter.ts`，在私人路由套用 `requireAuth`**
```typescript
import { requireAuth } from '../middleware/requireAuth';

// Before:
router.get('/profile', async (req, res) => { ... });
router.get('/report-lost', (req, res) => { ... });

// After:
router.get('/profile', requireAuth, async (req, res) => { ... });
router.get('/report-lost', requireAuth, (req, res) => { ... });
```

### 修改後的預期行為

未登入用戶訪問私人頁面時，被重導向到 `/login` 並附上提示訊息。已登入用戶正常訪問。

## 驗收條件（Acceptance Criteria）

- [ ] 未登入用戶訪問 `/profile` 被重導到 `/login?error=請先登入`
- [ ] 未登入用戶訪問 `/report-lost` 被重導到 `/login`
- [ ] 已登入用戶正常訪問所有頁面
