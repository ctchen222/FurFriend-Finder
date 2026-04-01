# [R-02] `findAnimalsByCity` 使用不存在的資料表名稱，SQL 查詢必定失敗

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 依城市搜尋收容所動物（GET /api/animals/city/:city） |

## 問題描述

`AnimalRepository.findAnimalsByCity()` 的 SQL 查詢使用了不存在的資料表名稱 `animals`（複數）和 `animal_shelters`（複數），導致任何呼叫此端點的請求都會拋出 SQL 錯誤。

## 影響的檔案與位置

- `backend/src/repository/animal.db.ts` 第 12-23 行

## 根本原因（Root Cause）

```typescript
// animal.db.ts:12-23
async findAnimalsByCity(city: string) {
    const query = `
        SELECT * FROM ${this.tableName}
        LEFT JOIN animal_shelters ON animals.animal_shelter_id = animal_shelters.id
        WHERE animal_shelters.address LIKE $1;
    `
    // this.tableName = "animal"（正確）
    // 但 JOIN 條件用的是 animals（複數，不存在）
    // JOIN 的目標表是 animal_shelters（複數，不存在，實際是 animal_shelter）
}
```

## 影響範圍（Impact）

`GET /api/animals/city/:city` 端點 100% 拋出 PostgreSQL 錯誤 `relation "animals" does not exist`，依城市搜尋功能完全無法使用。

## 修復規格（Fix Specification）

### 需要的修改

**`animal.db.ts:14-16`**
```typescript
// Before（有錯）:
LEFT JOIN animal_shelters ON animals.animal_shelter_id = animal_shelters.id
WHERE animal_shelters.address LIKE $1;

// After（正確）:
LEFT JOIN animal_shelter ON animal.animal_shelter_id = animal_shelter.id
WHERE animal_shelter.address LIKE $1;
```

### 修改後的預期行為

`GET /api/animals/city/台北` 正常回傳 200 和該城市的動物列表。

## 驗收條件（Acceptance Criteria）

- [ ] `GET /api/animals/city/台北` 回傳 200 和動物列表
- [ ] 不出現 `relation "animals" does not exist` 錯誤
- [ ] JOIN 和 WHERE 條件使用正確的資料表名稱 `animal_shelter`
