# [R-01] ownerMap key 有尾部空白與換行，走失動物飼主對應永遠失敗

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 走失動物資料同步（bulkInsertAnimalLosts） |

## 問題描述

每天 cron job 從農業部 API 同步走失動物資料時，程式嘗試把每筆資料的飼主資訊對應到 owner 資料表。對應邏輯使用 `ownerMap`（一個 Map 物件），但建立 key 和查詢 key 時，因為 template literal 的換行和尾部空格不一致，導致 `ownerMap.get()` 永遠回傳 `undefined`，所有走失動物都被指派給 Unknown 主人。

## 影響的檔案與位置

- `backend/src/repository/animalLost.db.ts` 第 110 行（建立 key）
- `backend/src/repository/animalLost.db.ts` 第 124-126 行（查詢 key）
- `backend/src/repository/animal.db.ts` 第 217 行（建立 key，同樣問題）
- `backend/src/repository/animal.db.ts` 第 231-233 行（查詢 key，同樣問題）

## 根本原因（Root Cause）

建立 key（`animalLost.db.ts:110`）時：
```typescript
const key = `${row.phone}_${row.email} `;   // 尾部有一個空格
```

查詢 key（`animalLost.db.ts:124-126`）時：
```typescript
const ownerKey = `
    ${animal.owner_phone && animal.owner_phone.trim() !== "" ?
        animal.owner_phone.trim() : 'Unknown'}_${...} `;
// 開頭有換行+縮排，尾部也有空格 → 和建立 key 的字串永遠不相等
```

兩個字串永遠不匹配，`ownerMap.get(ownerKey)` 永遠回傳 `undefined`，程式 fallback 使用 `unknownOwnerId`。

## 影響範圍（Impact）

每次 cron job（每天 00:00）或 manualUpdate 同步後，所有有真實飼主資料的走失動物，其 `owner_id` 都會被設為 Unknown 的 id，飼主對應資料完全錯誤，後續的 Email 通知也無法寄到正確的飼主。

## 修復規格（Fix Specification）

### 需要的修改

**`animalLost.db.ts:110` — 建立 key**
```typescript
// Before:
const key = `${row.phone}_${row.email} `;

// After:
const key = `${row.phone}_${row.email}`;
```

**`animalLost.db.ts:124-126` — 查詢 key**
```typescript
// Before:
const ownerKey = `
    ${animal.owner_phone && animal.owner_phone.trim() !== "" ?
        animal.owner_phone.trim() : 'Unknown'}_${animal.owner_email && animal.owner_email.trim() !== "" ? animal.owner_email.trim() : 'Unknown'} `;

// After:
const phone = animal.owner_phone?.trim() || 'Unknown';
const email = animal.owner_email?.trim() || 'Unknown';
const ownerKey = `${phone}_${email}`;
```

`animal.db.ts` 第 217 行和第 231-233 行也需要相同修改。

### 修改後的預期行為

有真實飼主資料的走失動物，同步後 `owner_id` 正確對應到該飼主，而非 Unknown。

## 驗收條件（Acceptance Criteria）

- [ ] 有已知 phone 或 email 的走失動物同步後，`owner_id` 對應到正確的 owner
- [ ] 沒有連絡資料的走失動物，`owner_id` 才對應到 Unknown
- [ ] `ownerMap.get(ownerKey)` 在有資料時回傳正確的 owner id，不回傳 undefined
