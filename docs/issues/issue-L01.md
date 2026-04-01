# [L-01] `animal.db.ts` 中有兩個孤立的死碼方法，永遠不會被呼叫

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 無（死碼） |

## 問題描述

`animal.db.ts` 中有兩個永遠不會被呼叫的方法：`bulkInsertAnimalLosts`（與 `animalLost.db.ts` 完全重複）和 `findMatchingAnimals`（使用錯誤的 table 名稱且 variety 參數被忽略）。這些死碼增加維護負擔，也容易造成混淆。

## 影響的檔案與位置

- `backend/src/repository/animal.db.ts` 第 167-280 行

## 根本原因（Root Cause）

```typescript
// animal.db.ts:167-269 — 與 animalLost.db.ts 完全重複，但不會被呼叫
async bulkInsertAnimalLosts(animalLosts: AnimalLostData[]): Promise<number> {
    // AnimalLostService 使用 AnimalLostRepository，不是 AnimalRepository
    // 這個方法是複製過來但從未被使用的
}

// animal.db.ts:271-280 — 使用錯誤 table 名稱，variety 參數被忽略
async findMatchingAnimals(kind?: string, sex?: string, variety?: string) {
    const query = `SELECT * FROM animals WHERE kind = $1 AND sex = $2;`
    //                             ^^^^^^^ 不存在的 table，variety 參數也沒用到
}
```

## 影響範圍（Impact）

死碼增加程式碼庫大小，讓讀者混淆（看到 `bulkInsertAnimalLosts` 在 `animal.db.ts` 中會誤以為應該使用它）。

## 修復規格（Fix Specification）

### 需要的修改

刪除 `animal.db.ts` 第 167-280 行（兩個孤立方法）：
- 刪除 `bulkInsertAnimalLosts`（第 167-269 行）
- 刪除 `findMatchingAnimals`（第 271-280 行）

確認沒有任何地方呼叫 `AnimalRepository` 的這兩個方法（搜尋確認後再刪除）。

### 修改後的預期行為

`animal.db.ts` 只包含真正會被使用的方法，程式碼更清晰。

## 驗收條件（Acceptance Criteria）

- [ ] `animal.db.ts` 不再包含 `bulkInsertAnimalLosts` 和 `findMatchingAnimals`
- [ ] TypeScript 編譯無錯誤
- [ ] 現有功能不受影響（確認沒有呼叫點）
