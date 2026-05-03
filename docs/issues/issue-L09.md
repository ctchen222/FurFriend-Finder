# [L-09] `errorHandler` 使用 Windows 路徑分隔符解析 stack trace

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt / bug |
| **影響功能** | 錯誤日誌的檔案位置解析 |

## 問題描述

`middleware/handler.ts` 的 errorHandler 使用 `\\`（Windows 反斜線）來解析 stack trace 中的檔案路徑，在 macOS / Linux 環境下 stack trace 使用正斜線 `/`，導致路徑解析失敗，錯誤日誌中無法正確顯示錯誤發生的檔案名稱。

## 影響的檔案與位置

- `backend/src/middleware/handler.ts` 第 25-28 行

## 根本原因（Root Cause）

```typescript
// handler.ts:25-28
const stack = err.stack?.split('\n')[1];
const fileInfo = stack?.split('\\').pop();
//                             ^^ Windows 路徑分隔符，在 macOS/Linux 上 stack trace 使用 '/'
```

Node.js 在 macOS/Linux 產生的 stack trace 格式為：
```
Error: some message
    at Object.<anonymous> (/Users/user/project/src/file.ts:10:5)
```

路徑使用正斜線 `/`，用 `\\` split 會得到整個路徑字串而非只取最後的檔名。

## 影響範圍（Impact）

- 錯誤日誌中的 `fileInfo` 欄位在 macOS/Linux 環境下顯示完整路徑或格式錯誤
- 開發環境（macOS）和 CI 環境（Linux Docker）的錯誤日誌格式不一致
- 不影響功能，但降低 debug 效率

## 修復規格（Fix Specification）

### 需要的修改

**`middleware/handler.ts:25-28`**
```typescript
// Before:
const stack = err.stack?.split('\n')[1];
const fileInfo = stack?.split('\\').pop();

// After:
const stack = err.stack?.split('\n')[1];
// 使用 path.sep 或同時支援兩種分隔符
const fileInfo = stack?.split(/[/\\]/).pop();
```

使用正則 `/[/\\]/` 同時匹配正斜線和反斜線，跨平台相容。

### 修改後的預期行為

無論在 macOS、Linux 或 Windows 上，錯誤日誌都能正確解析並顯示檔案名稱。

## 驗收條件（Acceptance Criteria）

- [ ] macOS/Linux 環境下錯誤日誌能正確顯示檔案名稱（非完整路徑）
- [ ] Windows 環境下行為不變
- [ ] TypeScript 編譯無錯誤
