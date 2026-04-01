# [M-11] `GeoService.geocoding` 未捕捉網路層錯誤，axios 例外直接傳播

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 所有需要 geocoding 的配對流程 |

## 問題描述

`GeoService.geocoding()` 只處理了 Google Maps API 回傳的 `status` 狀態碼，但沒有捕捉 axios 的網路層錯誤（timeout、DNS 失敗、網路中斷等）。這些例外會直接傳播到上層，與 R-05 問題相互放大，導致配對流程完全失敗。

## 影響的檔案與位置

- `backend/src/Service/geo.ts` 第 16-41 行

## 根本原因（Root Cause）

```typescript
// geo.ts:16-41
async geocoding(address: string): Promise<{ lat: number; lng: number } | null> {
    const { data } = await this.client.geocode(geocodeRequest);
    // ❌ 若 axios 拋出網路錯誤，直接傳播，沒有捕捉
    switch (data.status) {
        case 'OK': { ... }
        case 'ZERO_RESULTS': return null;
        case 'OVER_QUERY_LIMIT': throw new CustomError(...);
        case 'REQUEST_DENIED': throw new CustomError(...);
        default: throw new CustomError(...);
    }
}
```

## 影響範圍（Impact）

網路不穩定時，geocoding 失敗會拋出未預期的 AxiosError，若上層沒有妥善處理，配對流程完全中斷。

## 修復規格（Fix Specification）

### 需要的修改

**`geo.ts:16-41`**
```typescript
// After:
async geocoding(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const { data } = await this.client.geocode(geocodeRequest);
        switch (data.status) {
            case 'OK': {
                const location = data.results[0].geometry.location;
                return locationSchema.parse(location);
            }
            case 'ZERO_RESULTS':
                return null;
            case 'OVER_QUERY_LIMIT':
                throw new CustomError(apiMessage.GEOCODING_RATE_LIMIT);
            case 'REQUEST_DENIED':
                throw new CustomError(apiMessage.INVALID_CREDENTIALS);
            default:
                throw new CustomError(apiMessage.GEOCODING_FAILED);
        }
    } catch (error) {
        if (error instanceof CustomError) throw error;  // 重新拋出已知錯誤
        // 網路錯誤、timeout 等：視為找不到地址
        logger.warn(`Geocoding network error for address "${address}":`, error);
        return null;
    }
}
```

### 修改後的預期行為

網路錯誤時 geocoding 回傳 `null`（不拋出例外），上層用 Infinity 距離處理。API 錯誤仍正確拋出 CustomError。

## 驗收條件（Acceptance Criteria）

- [ ] 網路斷線時，`geocoding()` 回傳 `null`，不拋出未預期的例外
- [ ] OVER_QUERY_LIMIT 和 REQUEST_DENIED 仍拋出 CustomError
- [ ] 網路錯誤被記錄到 logger.warn
