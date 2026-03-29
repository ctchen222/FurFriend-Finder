# [L-02] `AnimalRepository.findAll()` 重複繼承的程式碼，多餘的 override

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 動物列表 API |

## 問題描述

`AnimalRepository.findAll()`（第 26-45 行）的程式碼與 `BaseRepository.findAll()`（第 21-40 行）完全相同，是不必要的方法 override。

## 影響的檔案與位置

- `backend/src/repository/animal.db.ts` 第 26-45 行
- `backend/src/repository/base.db.ts` 第 21-40 行

## 根本原因（Root Cause）

```typescript
// animal.db.ts:26-45（與 base.db.ts 完全相同）
async findAll<T>(pageSize, cursor, options, orderBy): Promise<T[]> {
    const orderByStr = orderBy && orderBy.length > 0 ?
        `ORDER BY ( ${orderBy.join(", ")} ) DESC` : "ORDER BY id ASC";
    const query = `
        SELECT ${options ? options.join(", ") : "*"}
        FROM ${this.tableName}
        ${cursor ? `WHERE id > ${cursor}` : ""}
        ${orderByStr}
        LIMIT ${pageSize};
    `;
    const result = await pool.query(query)
    return result.rows;
}
```

## 影響範圍（Impact）

M-01 的 SQL Injection 修復需要同時修改 `base.db.ts` 和 `animal.db.ts` 兩個地方，容易遺漏。

## 修復規格（Fix Specification）

### 需要的修改

刪除 `animal.db.ts` 中的 `findAll` 方法定義（第 26-45 行），讓它直接使用繼承自 `BaseRepository` 的方法。

```typescript
// Before: animal.db.ts 有重複的 findAll 定義

// After: 刪除 animal.db.ts 中的 findAll，使用繼承的方法
// （BaseRepository 的 findAll 已覆蓋此功能）
```

### 修改後的預期行為

`animalRepository.findAll()` 仍然正常運作，使用 `BaseRepository` 繼承的方法。

## 驗收條件（Acceptance Criteria）

- [ ] `animal.db.ts` 不再定義 `findAll` 方法
- [ ] `animalRepository.findAll()` 仍正常運作
- [ ] TypeScript 編譯無錯誤
