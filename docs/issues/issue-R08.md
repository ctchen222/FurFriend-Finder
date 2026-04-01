# [R-08] 前端使用 `innerHTML` 直接渲染 API 資料，存在 XSS 安全風險

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔴 Critical |
| **狀態** | Open |
| **分類** | security |
| **影響功能** | 快速比對頁面（quick-use）、收容所動物列表頁面（shelter-animals） |

## 問題描述

`quick-use.ejs` 和 `shelter-animals.ejs` 中，JavaScript 使用 template literal 與 `innerHTML` 直接渲染 API 回傳的動物資料（種類、品種、收容所名稱等）。若資料庫中存有惡意 HTML 或中間人攻擊篡改 API 回應，會導致 XSS 攻擊執行任意 JavaScript。

## 影響的檔案與位置

- `backend/views/quick-use.ejs` 第 211-222 行
- `backend/views/shelter-animals.ejs` 第 246-255 行

## 根本原因（Root Cause）

```javascript
// quick-use.ejs:211-222
itemDiv.innerHTML = `
    <div class="result-details">
        <p><strong>種類:</strong> ${animal.kind}</p>
        <p><strong>品種:</strong> ${animal.variety}</p>
        <p><strong>收容所:</strong> ${animal.name} (${animal.tel})</p>
    </div>
`;
// ↑ 若 animal.kind = '<script>alert("XSS")</script>'，會被執行
```

`innerHTML` 會解析並執行 HTML 標籤和 JavaScript。

## 影響範圍（Impact）

若攻擊者能在資料庫中插入惡意資料，或透過 MITM 攻擊篡改 API 回應，可以竊取用戶 session cookie、執行釣魚攻擊，或進行其他惡意操作。

## 修復規格（Fix Specification）

### 需要的修改

**在兩個 EJS 頁面的 `<script>` 區塊加入 `escapeHtml` helper 函數：**
```javascript
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}
```

**`quick-use.ejs:211-222` — 所有動態內容改用 `escapeHtml` 包裝：**
```javascript
// Before:
itemDiv.innerHTML = `<p><strong>種類:</strong> ${animal.kind}</p>`;

// After:
itemDiv.innerHTML = `<p><strong>種類:</strong> ${escapeHtml(animal.kind)}</p>`;
```

**`shelter-animals.ejs:246-255` — 相同處理。**

### 修改後的預期行為

資料中含 `<script>` 標籤時，顯示為純文字，不被瀏覽器執行。

## 驗收條件（Acceptance Criteria）

- [ ] 資料中含 `<script>alert('XSS')</script>` 時，顯示為純文字，不執行
- [ ] 頁面功能（顯示動物資訊）不受影響
- [ ] quick-use 和 shelter-animals 兩個頁面都完成修復
