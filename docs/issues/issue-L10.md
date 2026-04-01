# [L-10] `middleware/auth.ts` 只是空的 re-export，命名具有誤導性

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 認證中介軟體架構 |

## 問題描述

`backend/src/middleware/auth.ts` 的內容只是從 `'../auth'` re-export `auth` 物件，沒有任何 middleware 邏輯。檔案放在 `middleware/` 目錄下、命名為 `auth.ts`，會讓開發者誤以為這是 Express middleware 函數（`(req, res, next) => void`），但實際上只是一個 re-export 模組。

## 影響的檔案與位置

- `backend/src/middleware/auth.ts`（整個檔案）

## 根本原因（Root Cause）

```typescript
// middleware/auth.ts（完整內容）
import { auth } from '../auth';
export { auth };
```

這個檔案只做 re-export，沒有 middleware 功能。真正的 auth middleware 應該是：
```typescript
// 實際的 middleware 應長這樣
export const requireAuth = (req, res, next) => {
    // 驗證 session / token
};
```

## 影響範圍（Impact）

- 新進開發者查看 `middleware/auth.ts` 時，預期看到 auth middleware 但卻看到 re-export，造成困惑
- 命名不符合慣例，增加維護成本
- 若 `viewRouter.ts` 有加上 auth 檢查的需求（見 M-08），這個檔案的存在可能讓人誤以為已經有 middleware 在處理

## 修復規格（Fix Specification）

### 需要的修改

**方案 A（建議）— 刪除此檔案，直接從 `'../auth'` import**

移除 `middleware/auth.ts`，所有使用此 re-export 的地方改為直接 import：
```typescript
// Before（使用 re-export）:
import { auth } from '../middleware/auth';

// After（直接 import）:
import { auth } from '../auth';
```

**方案 B — 將此檔案轉為真正的 middleware**

若要在 middleware 目錄保留 auth 相關邏輯，應實作真正的 Express middleware 函數（配合 M-08 的修復需求）。

### 修改後的預期行為

`middleware/` 目錄中的檔案都是真正的 Express middleware，不包含空的 re-export 模組。

## 驗收條件（Acceptance Criteria）

- [ ] `middleware/auth.ts` 要麼被刪除，要麼包含真正的 middleware 邏輯
- [ ] 所有原本透過此 re-export import `auth` 的地方都正常運作
- [ ] TypeScript 編譯無錯誤
