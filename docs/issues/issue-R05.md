# [R-05] `Promise.all` geocoding 時單一地址失敗導致整批配對失敗

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 走失動物配對（findMatchesAndSendMail、findMatches） |

## 問題描述

`animalLost.ts` 使用 `Promise.all()` 對每隻配對動物進行 geocoding，但 `GeoService.geocoding()` 在 `OVER_QUERY_LIMIT`、`REQUEST_DENIED` 等情況會拋出 `CustomError`。只要一隻動物的地址拋出例外，整個 `Promise.all` 就會 reject，導致所有配對結果丟失。

## 影響的檔案與位置

- `backend/src/Service/animalLost.ts` 第 58-71 行（findMatchesAndSendMail）
- `backend/src/Service/animalLost.ts` 第 114-127 行（findMatches）

## 根本原因（Root Cause）

```typescript
// animalLost.ts:58-71
const animalsWithDistance = await Promise.all(
    matchedAnimals.map(async (animal) => {
        const animalCoordinates = await this.geoService.geocoding(animal.found_place);
        // ↑ 若此 throw CustomError（如 OVER_QUERY_LIMIT），整個 Promise.all reject
        const distance = GeoService.calculateDistance(lostAnimalCoordinates, animalCoordinates);
        return { ...animal, distance };
    })
);
```

`Promise.all` 的語義是「任一個 reject 就整批 reject」。

## 影響範圍（Impact）

在 Google Maps API 達到速率限制、或任何一筆收容所地址觸發 geocoding 錯誤時，整個配對流程失敗，用戶收不到任何配對結果，且無法得知原因。

## 修復規格（Fix Specification）

### 需要的修改

**`animalLost.ts:58-71`（findMatchesAndSendMail）和 第 114-127 行（findMatches）**

```typescript
// Before: Promise.all（一個失敗全部失敗）
const animalsWithDistance = await Promise.all(
    matchedAnimals.map(async (animal) => {
        const animalCoordinates = await this.geoService.geocoding(animal.found_place);
        const distance = GeoService.calculateDistance(lostAnimalCoordinates, animalCoordinates);
        return { ...animal, distance: parseFloat(distance.toFixed(2)) };
    })
);

// After: 使用 try-catch 讓單個失敗不影響其他
const animalsWithDistance = await Promise.all(
    matchedAnimals.map(async (animal) => {
        if (!animal.found_place) {
            return { ...animal, distance: Infinity };
        }
        try {
            const animalCoordinates = await this.geoService.geocoding(animal.found_place);
            if (!animalCoordinates) {
                return { ...animal, distance: Infinity };
            }
            const distance = GeoService.calculateDistance(lostAnimalCoordinates, animalCoordinates);
            return { ...animal, distance: parseFloat(distance.toFixed(2)) };
        } catch {
            // geocoding 失敗時，此動物排在最遠，不影響其他動物
            return { ...animal, distance: Infinity };
        }
    })
);
```

### 修改後的預期行為

單一動物 geocoding 失敗時，該動物距離設為 Infinity（排在最後），其他動物的配對結果正常回傳。

## 驗收條件（Acceptance Criteria）

- [ ] 單一動物 geocoding 失敗時，不影響其他動物的配對結果
- [ ] API 回傳剩餘的正常配對結果（非整批失敗）
- [ ] OVER_QUERY_LIMIT 情況下，仍能回傳部分配對結果
- [ ] findMatches 和 findMatchesAndSendMail 都完成修改
