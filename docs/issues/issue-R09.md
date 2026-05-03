# [R-09] 單元測試中 `animmal`（多一個 m）拼字錯誤，測試永遠失敗

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug（測試程式碼） |
| **影響功能** | `findRandomAnimal` 單元測試 |

## 問題描述

`animal.db.test.ts` 中驗證 `findRandomAnimal` SQL 查詢的 `expect` 語句，包含 `animmal.picture`（多了一個 m），但實際 SQL 使用 `animal.picture`（正確）。這個測試永遠失敗，`findRandomAnimal` 的 SQL 正確性無法被自動化驗證。

## 影響的檔案與位置

- `backend/src/__test__/unit/animal.db.test.ts` 第 40 行

## 根本原因（Root Cause）

```typescript
// 測試（第 40 行）— 有拼字錯誤
expect(calledQuery).toContain(
    `WHERE animmal.picture IS NOT NULL AND animal.picture <> ''`,
    //          ^^^^^^ 多了一個 m
);

// 實際 SQL（animal.db.ts:292）— 正確
WHERE ${this.tableName}.picture IS NOT NULL AND ${this.tableName}.picture <> ''
// 展開為：WHERE animal.picture IS NOT NULL AND animal.picture <> ''
```

## 影響範圍（Impact）

此測試永遠 fail，開發者可能誤以為是 production code 的問題，或習慣性忽略 test failures，降低整體測試信賴度。`findRandomAnimal`（LINE Bot 抽卡功能使用）的 SQL 正確性無法被自動化保護。

## 修復規格（Fix Specification）

### 需要的修改

**`animal.db.test.ts:40`**
```typescript
// Before（有錯）:
expect(calledQuery).toContain(
    `WHERE animmal.picture IS NOT NULL AND animal.picture <> ''`,
);

// After（修正）:
expect(calledQuery).toContain(
    `WHERE animal.picture IS NOT NULL AND animal.picture <> ''`,
);
```

### 修改後的預期行為

`npm test` 執行 `animal.db.test.ts` 時，`findRandomAnimal` 相關測試通過。

## 驗收條件（Acceptance Criteria）

- [ ] `npm test` 執行 `animal.db.test.ts` 時，`findRandomAnimal` 相關測試通過
- [ ] 測試正確驗證 SQL 字串包含 `animal.picture`
