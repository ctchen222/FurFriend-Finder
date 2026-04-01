# [M-03] `ORDER BY` 子句使用括號語法，多欄排序時 SQL 語法錯誤

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 使用多欄排序的列表查詢（findAllWithShelter） |

## 問題描述

`ORDER BY` 子句使用 `ORDER BY ( field1, field2 ) DESC` 的括號語法，在 PostgreSQL 中，括號在此語境不合法，會導致多欄排序時 SQL 語法錯誤。

## 影響的檔案與位置

- `backend/src/repository/base.db.ts` 第 28 行
- `backend/src/repository/animal.db.ts` 第 33 行（findAll 重寫）
- `backend/src/repository/animal.db.ts` 第 73 行（findAllWithShelter）

## 根本原因（Root Cause）

```typescript
// base.db.ts:28
const orderByStr = orderBy && orderBy.length > 0 ?
    `ORDER BY ( ${orderBy.join(", ")} ) DESC` : "ORDER BY id ASC";
// 當 orderBy = ['update_date', 'open_date'] 時，展開為：
// ORDER BY ( update_date, open_date ) DESC  ← 括號在此不合法
```

## 影響範圍（Impact）

使用 `orderBy` 參數時（特別是 `findAllWithShelter` 使用 `update_date, open_date` 多欄排序），SQL 語法錯誤，查詢失敗。

## 修復規格（Fix Specification）

### 需要的修改

**`base.db.ts:28` 和 `animal.db.ts:33`, `73`**
```typescript
// Before:
`ORDER BY ( ${orderBy.join(", ")} ) DESC`

// After（方案 A，最簡單）:
`ORDER BY ${orderBy.join(", ")} DESC`

// After（方案 B，更精確，每欄獨立 DESC）:
`ORDER BY ${orderBy.map(col => `${col} DESC`).join(", ")}`
```

### 修改後的預期行為

帶 `orderBy` 參數的查詢正確排序，不拋出 SQL 語法錯誤。

## 驗收條件（Acceptance Criteria）

- [ ] 帶多個 `orderBy` 欄位的查詢不拋出 SQL 語法錯誤
- [ ] 結果按預期順序排序
- [ ] base.db.ts 和 animal.db.ts 中所有相關位置都完成修改
