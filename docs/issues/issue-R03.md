# [R-03] 配對 API 遇到錯誤時呼叫 `next()` 而非 `next(error)`，錯誤被靜默吞掉

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | bug |
| **影響功能** | 走失動物配對 API（matchLostAnimal、quickMatch） |

## 問題描述

`animalLostController` 的 `matchLostAnimal` 和 `quickMatch` 方法，在偵測到 Service 層回傳 `CustomError` 時，呼叫 `return next()` 而非 `return next(result)`。這導致錯誤不會傳到 `errorHandler` middleware，client 端收到空白回應而非錯誤訊息。

## 影響的檔案與位置

- `backend/src/Controller/animalLostController.ts` 第 89-93 行（matchLostAnimal）
- `backend/src/Controller/animalLostController.ts` 第 112-115 行（quickMatch）

## 根本原因（Root Cause）

```typescript
// matchLostAnimal（第 89-93 行）
const result = await this.animalLostService.findMatchesAndSendMail(id);
if (result instanceof CustomError) {
    return next();  // ❌ next() 不帶參數 = 繼續下一個 middleware，不觸發 errorHandler
}

// quickMatch（第 112-115 行）
const result = await this.animalLostService.findMatches(lostAnimalForSearch);
if (result instanceof CustomError) {
    return next();  // ❌ 同上
}
```

`next()` 不帶參數表示「成功，繼續下一個 middleware」，而非觸發 errorHandler。

## 影響範圍（Impact）

配對地點無法 geocode、找不到走失動物記錄等情況下，API 回傳空白 response，而非正確的錯誤訊息，用戶和開發者都無從得知出了什麼問題。

## 修復規格（Fix Specification）

### 需要的修改

**`animalLostController.ts:89-93` 和第 112-115 行**
```typescript
// Before:
if (result instanceof CustomError) {
    return next();
}

// After:
if (result instanceof CustomError) {
    return next(result);  // ✅ 傳入 error，觸發 errorHandler
}
```

兩個方法（`matchLostAnimal` 和 `quickMatch`）都需要修改。

### 修改後的預期行為

發生錯誤時，API 回傳包含錯誤訊息的 JSON response，HTTP status code 對應到 CustomError 的 `httpCode`。

## 驗收條件（Acceptance Criteria）

- [ ] 地點無法 geocode 時，API 回傳包含錯誤訊息的 JSON（非空白 response）
- [ ] HTTP status code 對應到 CustomError 的 httpCode
- [ ] `errorHandler` 正確記錄錯誤日誌
