# [L-04] 函數名稱拼字錯誤：`prettiftyDailyAnimalData`（多了一個 `t`）

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 日報資料格式化（`prettifyDailyAnimalData`） |

## 問題描述

`prettifyDailyAnimalData.utils.ts` 中的函數名稱為 `prettiftyDailyAnimalData`（多了一個 `t`），與 `prettifyAnimalData` 等其他函數的命名規範不一致，造成混淆。

## 影響的檔案與位置

- `backend/src/libs/prettifyDailyAnimalData.utils.ts` 第 1、18 行

## 根本原因（Root Cause）

```typescript
// 第 1 行
const prettiftyDailyAnimalData = (dailyAnimalData: object[]): string => {
//    ^^^^^^^^^^^ 應為 prettifyDailyAnimalData（無多餘的 t）
```

## 影響範圍（Impact）

命名規範不一致，讓讀程式碼的人困惑。若有其他地方 import 此函數，使用的也是拼字錯誤的名稱，形成一致的錯誤。

## 修復規格（Fix Specification）

### 需要的修改

**`prettifyDailyAnimalData.utils.ts`**
```typescript
// Before:
const prettiftyDailyAnimalData = (dailyAnimalData: object[]): string => {
    // ...
};
export default prettiftyDailyAnimalData;

// After:
const prettifyDailyAnimalData = (dailyAnimalData: object[]): string => {
    // ...
};
export default prettifyDailyAnimalData;
```

搜尋所有 import 此模組的地方，確認名稱更新一致。

### 修改後的預期行為

函數名稱正確為 `prettifyDailyAnimalData`，與命名規範一致。

## 驗收條件（Acceptance Criteria）

- [ ] 函數名稱為 `prettifyDailyAnimalData`（無多餘的 t）
- [ ] export 名稱一致
- [ ] TypeScript 編譯無錯誤
