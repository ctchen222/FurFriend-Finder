# [M-14] E2E 測試缺少 API Mock，依賴真實後端資料，結果不穩定

| 欄位 | 內容 |
|------|------|
| **嚴重等級** | 🟠 Medium |
| **狀態** | Open |
| **分類** | tech-debt |
| **影響功能** | E2E 測試（quickUse.spec.ts） |

## 問題描述

`quickUse.spec.ts` 直接呼叫真實 API，並假設回傳剛好 10 筆結果。測試結果取決於資料庫當前狀態，在空資料庫環境（如 CI/CD）或資料不足時必然失敗。程式碼中也有 `// TODO: Or mock api` 標記未處理。

## 影響的檔案與位置

- `backend/src/__test__/e2e/quickUse.spec.ts` 第 18 行

## 根本原因（Root Cause）

```typescript
// quickUse.spec.ts:18
// TODO: Or mock api
await page.waitForSelector('.result-item');
const results = await page.locator('.result-item').count();
expect(results).toBe(10);  // ❌ 假設後端一定回傳 10 筆
```

E2E 測試沒有隔離外部依賴，測試結果不確定性高。

## 影響範圍（Impact）

- CI/CD 環境（空 DB）測試必然失敗
- 資料庫資料變動後測試結果可能改變
- 無法獨立驗證前端邏輯（如結果渲染是否正確）

## 修復規格（Fix Specification）

### 需要的修改

使用 Playwright 的 `page.route()` intercept API 請求，注入固定的 mock 資料：

```typescript
// quickUse.spec.ts
import { test, expect } from '@playwright/test';

const mockAnimals = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    kind: '狗',
    variety: '米克斯',
    sex: 'M',
    colour: '黃色',
    found_place: '台北市中山區',
    shelter_name: '台北市動物之家',
    shelter_address: '台北市中山區',
    shelter_tel: '02-12345678',
    distance: (i + 1) * 0.5,
}));

test('quick match 顯示 10 筆配對結果', async ({ page }) => {
    // Mock API 回應
    await page.route('**/api/lost-animals/quick-match', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                top10Matches: mockAnimals,
                metadata: { total: 10 }
            })
        });
    });

    await page.goto('http://localhost:2486/quick-use');
    // ... 填寫表單並提交
    await page.waitForSelector('.result-item');
    const results = await page.locator('.result-item').count();
    expect(results).toBe(10);
});
```

### 修改後的預期行為

測試在空資料庫也能通過，結果穩定可預期。

## 驗收條件（Acceptance Criteria）

- [ ] E2E 測試在空資料庫也能通過
- [ ] 測試使用 Playwright route interception mock API
- [ ] CI/CD 環境可穩定執行測試
- [ ] 移除 `// TODO: Or mock api` 標記
