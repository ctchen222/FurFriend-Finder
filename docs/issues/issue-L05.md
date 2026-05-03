# [L-05] `package.json` 有不必要的 `crypto` npm 依賴

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🔵 Low |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | 無功能影響，但增加不必要依賴 |

## 問題描述

`package.json` 中有 `"crypto": "^1.0.1"` 依賴，但 Node.js 已內建 `crypto` 模組，不需要安裝此 npm 套件。npm 上的 `crypto` 套件是空的 stub，專為舊版 browserify 環境設計，在 Node.js 環境中無用。

## 影響的檔案與位置

- `backend/package.json`（dependencies 中的 `"crypto": "^1.0.1"`）

## 根本原因（Root Cause）

```json
{
    "dependencies": {
        "crypto": "^1.0.1",   // ❌ Node.js 內建，不需要安裝
        ...
    }
}
```

`webhook.Controller.ts` 使用 `import crypto from 'crypto'`，這直接使用 Node.js 內建模組，不需要 npm 安裝。

## 影響範圍（Impact）

- 不必要的 npm 依賴增加安裝大小
- 可能與 Node.js 內建模組產生版本衝突（雖然 npm 的 crypto stub 基本上是空的）
- `npm audit` 可能誤報此套件的安全問題

## 修復規格（Fix Specification）

### 需要的修改

```bash
cd backend && npm uninstall crypto
```

確認 `webhook.Controller.ts` 等使用 `crypto` 的檔案只用 `import crypto from 'crypto'`（Node.js 內建），移除後仍能正常運作。

### 修改後的預期行為

`package.json` 不含 `crypto` 依賴，`import crypto from 'crypto'` 仍正常使用 Node.js 內建模組。

## 驗收條件（Acceptance Criteria）

- [ ] `package.json` dependencies 中不再有 `"crypto"`
- [ ] `import crypto from 'crypto'` 正常運作（使用 Node.js 內建）
- [ ] 專案可正常 build 和啟動
