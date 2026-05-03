# [M-04] `authRouter` 所有路由缺少 `catchAsync` wrapper，非同步錯誤無法被捕捉

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 所有認證 API（register/login/logout/reset-password/settings） |

## 問題描述

`authRouter` 的所有路由沒有使用 `catchAsync` wrapper，而其他 router（animalRouter、animalLostRouter、webhookRouter）都有。這導致 `authController` 中拋出的非同步錯誤無法被 Express 的 errorHandler 捕捉。

## 影響的檔案與位置

- `backend/src/router/authRouter.ts` 第 11-24 行

## 根本原因（Root Cause）

```typescript
// authRouter.ts — 缺少 catchAsync
router.route('/signup').post(authCtrler.createUser);
router.route('/login').post(authCtrler.loginUser);
router.route('/logout').post(authCtrler.logoutUser);
router.route('/reset-password').post(authCtrler.resetPassword);
router.route('/settings').patch(authCtrler.updateSettings);

// 對比 animalRouter.ts（正確做法）:
router.route('/').get(catchAsync(animalCtrler.fetchList))
```

Express 不會自動捕捉非同步 handler 中拋出的 Promise rejection，需要 `catchAsync` wrapper 來轉發錯誤到 `next(error)`。

## 影響範圍（Impact）

`authController` 中的非同步例外（如 DB 連線失敗、better-auth API 錯誤等）不會被 errorHandler 處理，而是導致 `UnhandledPromiseRejection`，可能使 Node.js 程序崩潰。

## 修復規格（Fix Specification）

### 需要的修改

**`authRouter.ts:11-24`**
```typescript
// Before:
import { authCtrler } from '../Controller/authController';
// ...
router.route('/signup').post(authCtrler.createUser);
router.route('/login').post(authCtrler.loginUser);
router.route('/logout').post(authCtrler.logoutUser);
router.route('/reset-password').post(authCtrler.resetPassword);
router.route('/settings').patch(authCtrler.updateSettings);

// After:
import { catchAsync } from '../libs/catchAsync';
import { authCtrler } from '../Controller/authController';
// ...
router.route('/signup').post(catchAsync(authCtrler.createUser));
router.route('/login').post(catchAsync(authCtrler.loginUser));
router.route('/logout').post(catchAsync(authCtrler.logoutUser));
router.route('/reset-password').post(catchAsync(authCtrler.resetPassword));
router.route('/settings').patch(catchAsync(authCtrler.updateSettings));
```

### 修改後的預期行為

authController 中的非同步例外被正確傳遞到 errorHandler，回傳適當的錯誤 response。

## 驗收條件（Acceptance Criteria）

- [ ] authController 中的非同步例外觸發 errorHandler
- [ ] 不出現 UnhandledPromiseRejection
- [ ] 所有 auth 路由都套用了 catchAsync
