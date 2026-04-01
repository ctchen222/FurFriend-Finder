# [L-07] `GeoService.calculateDistance` 回傳 meters 但沒有說明單位

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | docs / tech-debt |
| **影響功能** | 配對結果的距離顯示 |

## 問題描述

`GeoService.calculateDistance` 使用 `geolib.getDistance()`，預設回傳 **meters**（公尺），但程式碼和 API 回應中都沒有標示單位。前端顯示 `5123.45` 時，用戶不知道是 5123 公里還是公尺。

## 影響的檔案與位置

- `backend/src/Service/geo.ts` 第 43-52 行
- `backend/src/Service/animalLost.ts`（使用 distance 的地方）

## 根本原因（Root Cause）

```typescript
// geo.ts:43-52
static calculateDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
) {
    const distance = getDistance(
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng }
    );
    return distance;  // geolib 預設回傳 meters，但沒有說明
}
```

`animalLost.ts` 中只做了 `.toFixed(2)` 格式化，沒有單位轉換，API 回應的 `distance` 欄位是公尺（meter）值。

## 影響範圍（Impact）

前端顯示配對結果時，`distance: 5123.45` 沒有單位，用戶無法理解距離含義。若前端誤以為是 km，5123 km 的距離顯示會讓用戶困惑。

## 修復規格（Fix Specification）

### 需要的修改

**方案 A（建議）— 在 geo.ts 中轉換為 km 並更名**
```typescript
// geo.ts
static calculateDistanceKm(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
): number {
    const distanceInMeters = getDistance(
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng }
    );
    return parseFloat((distanceInMeters / 1000).toFixed(2));  // 回傳 km
}
```

更新 `animalLost.ts` 使用 `calculateDistanceKm`，並移除其中的 `.toFixed(2)`（已在 geo.ts 處理）。

前端顯示時加上單位：`${animal.distance} km`。

### 修改後的預期行為

API 回傳的 `distance` 欄位是以 km 為單位的數值，前端顯示時附上「km」單位。

## 驗收條件（Acceptance Criteria）

- [ ] 配對結果中的 `distance` 欄位以 km 為單位
- [ ] 前端顯示距離時附上「km」單位，例如「5.12 km」
- [ ] API 文件（若有）說明 distance 單位
