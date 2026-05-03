# [M-06] `POST /api/animals/manualUpdate` 缺少認證，任何人可觸發全資料庫同步

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | security |
| **影響功能** | 手動觸發動物資料更新（manualUpdate） |

## 問題描述

`POST /api/animals/manualUpdate` 路由沒有任何認證或授權檢查，任何人都可以對伺服器發送請求觸發大量 API 呼叫（農業部開放資料 API）和 DB 批次插入操作，可被用於 DoS 攻擊。

## 影響的檔案與位置

- `backend/src/router/animalRouter.ts` 第 18-19 行

## 根本原因（Root Cause）

```typescript
// animalRouter.ts:18-19
router.route('/manualUpdate')
    .post(catchAsync(animalCtrler.updateTableAnimal));  // ❌ 無任何認證
```

## 影響範圍（Impact）

- 攻擊者可大量呼叫此端點，觸發大量外部 API 呼叫，耗盡 API quota 或導致 DB 過載
- 可能造成服務不穩定或中斷

## 修復規格（Fix Specification）

### 需要的修改

**方案 A（最簡單）— 使用現有的 requireAuth middleware**
```typescript
import { requireAuth } from '../middleware/requireAuth';

router.route('/manualUpdate')
    .post(requireAuth, catchAsync(animalCtrler.updateTableAnimal));
```

**方案 B（建議）— 加入 ADMIN_TOKEN 驗證，即使未登入也可從 CI/CD 觸發**
```typescript
// 新增 middleware/requireAdminToken.ts
export const requireAdminToken = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// animalRouter.ts
router.route('/manualUpdate')
    .post(requireAdminToken, catchAsync(animalCtrler.updateTableAnimal));
```
在 `.env` 加入 `ADMIN_TOKEN=<secure-random-string>`。

### 修改後的預期行為

未認證的請求收到 401，認證後的管理員可以正常觸發更新。

## 驗收條件（Acceptance Criteria）

- [ ] 未帶認證的請求回傳 401
- [ ] 認證後的請求正常執行資料同步
- [ ] ADMIN_TOKEN 從環境變數讀取，不硬編碼
