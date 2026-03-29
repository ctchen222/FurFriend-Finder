# [L-03] 批次 INSERT 沒有 try-catch-finally 來確保 ROLLBACK

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 每日資料同步（批次插入動物和走失動物資料） |

## 問題描述

`bulkInsertAnimals`（`animal.db.ts`）和 `bulkInsertAnimalLosts`（`animalLost.db.ts`）中使用 `START TRANSACTION`，但沒有 try-catch，若批次插入中途失敗，transaction 不會被回滾，資料庫可能進入不一致狀態。

## 影響的檔案與位置

- `backend/src/repository/animal.db.ts` 第 98-165 行
- `backend/src/repository/animalLost.db.ts` 第 60-162 行

## 根本原因（Root Cause）

```typescript
// animal.db.ts:98-165
async bulkInsertAnimals(animals: Animal[]): Promise<number> {
    await pool.query("START TRANSACTION");
    // ... 多個 await pool.query() 呼叫
    // ❌ 沒有 try-catch，若任一查詢失敗，transaction 懸掛
    await pool.query("COMMIT");
    return insertedRowCount;
}
```

## 影響範圍（Impact）

每天 cron job 執行時，若批次插入中途遇到錯誤（如格式不正確的資料），部分資料已插入但 transaction 沒有 COMMIT 或 ROLLBACK，導致資料庫狀態不一致。

## 修復規格（Fix Specification）

### 需要的修改

**`animal.db.ts:98` 和 `animalLost.db.ts:60`**
```typescript
// Before:
async bulkInsertAnimals(animals: Animal[]): Promise<number> {
    await pool.query("START TRANSACTION");
    let insertedRowCount = 0;
    // ... 批次插入邏輯
    await pool.query("COMMIT");
    return insertedRowCount;
}

// After:
async bulkInsertAnimals(animals: Animal[]): Promise<number> {
    await pool.query("START TRANSACTION");
    try {
        let insertedRowCount = 0;
        // ... 批次插入邏輯（不變）
        await pool.query("COMMIT");
        return insertedRowCount;
    } catch (error) {
        await pool.query("ROLLBACK");
        throw error;  // 重新拋出讓上層知道失敗
    }
}
```

### 修改後的預期行為

批次插入中途失敗時，已插入的部分資料被回滾，不出現懸掛的 open transaction。

## 驗收條件（Acceptance Criteria）

- [ ] 批次插入中途失敗時，資料庫執行 ROLLBACK
- [ ] 不出現懸掛的 open transaction
- [ ] 兩個檔案（`animal.db.ts` 和 `animalLost.db.ts`）都完成修改
