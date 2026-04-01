# [M-02] `findOne()` 中 JOIN 子句放在 WHERE 之後，SQL 語法不合法

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 任何使用 `findOne()` 搭配 `joinOptions` 的查詢 |

## 問題描述

`BaseRepository.findOne()` 方法中，JOIN 子句（`${joinStr}`）被放在 WHERE 子句之後，這在 SQL 標準中是不合法的語法（正確順序：`FROM ... JOIN ... WHERE ...`）。

## 影響的檔案與位置

- `backend/src/repository/base.db.ts` 第 55-77 行

## 根本原因（Root Cause）

```typescript
// base.db.ts:60-75
const query = `
    SELECT ${options ? options.join(", ") : "*"}
    FROM ${this.tableName}
    WHERE ${conditionStr.join(" AND ")}
    ${joinStr}   // ❌ JOIN 放在 WHERE 後面，SQL 語法錯誤
    LIMIT 1
`;
```

正確的 SQL 語法應為：`FROM table JOIN other_table ON ... WHERE condition`。

## 影響範圍（Impact）

任何傳入 `joinOptions` 參數的 `findOne()` 呼叫都會拋出 SQL 語法錯誤。目前專案中若有使用 joinOptions，相關功能將完全無法使用。

## 修復規格（Fix Specification）

### 需要的修改

**`base.db.ts:60-75`**
```typescript
// Before:
const query = `
    SELECT ${options ? options.join(", ") : "*"}
    FROM ${this.tableName}
    WHERE ${conditionStr.join(" AND ")}
    ${joinStr}
    LIMIT 1
`;

// After:
const query = `
    SELECT ${options ? options.join(", ") : "*"}
    FROM ${this.tableName}
    ${joinStr}
    WHERE ${conditionStr.join(" AND ")}
    LIMIT 1
`;
```

### 修改後的預期行為

帶 `joinOptions` 的 `findOne()` 呼叫正確執行，回傳預期的查詢結果。

## 驗收條件（Acceptance Criteria）

- [ ] 帶 `joinOptions` 的 `findOne()` 呼叫不拋出 SQL 語法錯誤
- [ ] 查詢結果正確
- [ ] 不帶 `joinOptions` 的呼叫行為不變
