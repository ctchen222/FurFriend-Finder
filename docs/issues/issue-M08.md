# [M-08] cursor 分頁邏輯假設 ID 從 1 開始且連續，刪除資料後分頁損壞

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 動物列表分頁（所有使用 cursorPairGenerate 的 API） |

## 問題描述

`database.utils.ts` 的 `cursorPairGenerate` 函數使用 `data[0]?.id === 1` 判斷是否為第一頁，並用 `firstElementId - pageSize - 1` 計算 prevCursor。當資料有被刪除導致 ID 不連續時，這兩個邏輯都會產生錯誤的結果。

## 影響的檔案與位置

- `backend/src/libs/database.utils.ts` 第 10-19 行

## 根本原因（Root Cause）

```typescript
// database.utils.ts:10-19
const isFirstPage = data[0]?.id === 1;  // ❌ 假設第一筆 ID 一定是 1
const firstElementId = data[0]?.id;
const lastElementId = data[data.length - 1]?.id;

if (firstElementId && !isFirstPage) {
    prevCursor = Buffer.from(
        JSON.stringify({ "id": firstElementId - pageSize - 1 })  // ❌ 假設 ID 連續
    ).toString('base64');
}
```

若刪除了 id=1 的資料，`isFirstPage` 永遠為 false，第一頁也會出現 prevCursor。若 ID 不連續，`firstElementId - pageSize - 1` 計算出不存在的 ID。

## 影響範圍（Impact）

在生產環境中，若有任何資料被刪除，分頁導航可能出現錯誤（第一頁有 prevCursor、跳頁等問題）。

## 修復規格（Fix Specification）

### 需要的修改

**`database.utils.ts`**
```typescript
// Before:
export function cursorPairGenerate(data: any[], pageSize: number) {
    const isFirstPage = data[0]?.id === 1;
    // ...
    if (firstElementId && !isFirstPage) {
        prevCursor = Buffer.from(JSON.stringify({ "id": firstElementId - pageSize - 1 })).toString('base64');
    }
}

// After:
export function cursorPairGenerate(data: any[], pageSize: number, currentCursor?: string) {
    if (!data || data.length === 0) return { prevCursor: undefined, nextCursor: undefined };

    const firstElementId = data[0]?.id;
    const lastElementId = data[data.length - 1]?.id;

    // 有傳入 cursor 才可能有上一頁（沒 cursor = 第一頁）
    const prevCursor = (currentCursor && firstElementId)
        ? Buffer.from(JSON.stringify({ id: firstElementId - 1 })).toString('base64')
        : undefined;

    // 有滿一頁才可能有下一頁
    const nextCursor = (data.length === pageSize && lastElementId)
        ? Buffer.from(JSON.stringify({ id: lastElementId })).toString('base64')
        : undefined;

    return { prevCursor, nextCursor };
}
```

同時更新所有呼叫 `cursorPairGenerate` 的地方，傳入 `currentCursor` 參數。

### 修改後的預期行為

刪除早期資料後，分頁仍正確。第一頁不出現 prevCursor，最後一頁不出現 nextCursor。

## 驗收條件（Acceptance Criteria）

- [ ] 資料庫中有刪除的資料時，分頁導航仍正確
- [ ] 第一次請求（無 cursor）不出現 prevCursor
- [ ] 最後一頁不出現 nextCursor
