# [L-08] 生產環境 EJS 頁面有 `console.log` 除錯碼，暴露內部 cursor 資訊

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | security / tech-debt |
| **影響功能** | 收容所動物列表頁面（shelter-animals） |

## 問題描述

`shelter-animals.ejs` 中有兩行 `console.log` 印出 cursor 資訊（`currentPrevCursor` 和 `currentNextCursor`），任何打開瀏覽器 DevTools 的用戶都可以看到分頁 cursor 的 base64 值。

## 影響的檔案與位置

- `backend/views/shelter-animals.ejs` 第 265-266 行

## 根本原因（Root Cause）

```javascript
// shelter-animals.ejs:265-266（開發除錯用的 log 未清除）
console.log('Prev Cursor:', currentPrevCursor);
console.log('Next Cursor:', currentNextCursor);
```

## 影響範圍（Impact）

- 暴露內部分頁實作細節（cursor 是 base64 編碼的 JSON，包含 `{ id: ... }`）
- 用戶可以反向工程了解資料庫 ID 結構
- 不符合生產環境最佳實踐

## 修復規格（Fix Specification）

### 需要的修改

直接刪除這兩行 console.log：
```javascript
// Before:
console.log('Prev Cursor:', currentPrevCursor);
console.log('Next Cursor:', currentNextCursor);

// After:
// （刪除這兩行）
```

若未來需要除錯，可以使用瀏覽器 DevTools 的條件斷點，不需要 console.log。

### 修改後的預期行為

生產環境的瀏覽器 console 不顯示 cursor 資訊，分頁功能正常運作。

## 驗收條件（Acceptance Criteria）

- [ ] 瀏覽器 console 不顯示 `Prev Cursor` 和 `Next Cursor` 資訊
- [ ] 分頁功能（上一頁/下一頁）不受影響
