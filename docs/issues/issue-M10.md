# [M-10] 農業部 API URL 硬編碼在程式碼中，無法通過環境變數配置

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 動物資料定時同步（cron job 和 manualUpdate） |

## 問題描述

農業部開放資料 API 的 URL 被硬編碼在 Service 層程式碼中，無法通過環境變數在不同環境（開發、測試、生產）中配置不同的端點，也無法在測試時指向 mock server。

## 影響的檔案與位置

- `backend/src/Service/animal.ts` 第 12-14 行
- `backend/src/Service/animalLost.ts` 第 143-145 行

## 根本原因（Root Cause）

```typescript
// animal.ts:12-14
const response = await axios.get(
    'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL',
);

// animalLost.ts:143-145
const response = await axios.get(
    'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i',
);
```

## 影響範圍（Impact）

- 測試環境無法指向 mock API，難以撰寫 unit test
- API URL 變更時需修改程式碼並重新部署
- 無法在不同環境使用不同的 API 端點

## 修復規格（Fix Specification）

### 需要的修改

**在 `.env` 加入**
```
MOA_SHELTER_ANIMALS_URL=https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL
MOA_LOST_ANIMALS_URL=https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i
```

**`animal.ts:12-14`**
```typescript
// Before:
const response = await axios.get(
    'https://data.moa.gov.tw/...',
);

// After:
const url = process.env.MOA_SHELTER_ANIMALS_URL;
if (!url) throw new Error('MOA_SHELTER_ANIMALS_URL is not configured');
const response = await axios.get(url);
```

**`animalLost.ts:143-145`** — 相同模式，使用 `MOA_LOST_ANIMALS_URL`。

### 修改後的預期行為

API URL 可透過環境變數配置，測試時可指向 mock server。

## 驗收條件（Acceptance Criteria）

- [ ] `animal.ts` 和 `animalLost.ts` 中不再有硬編碼的 API URL
- [ ] URL 從環境變數讀取，未設定時啟動時明確報錯
- [ ] `.env.example` 中包含這兩個環境變數
