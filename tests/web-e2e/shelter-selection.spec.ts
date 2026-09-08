import { expect, test } from '@playwright/test';

test('shelter filter is shareable, clears on region change, and remains responsive', async ({ page }) => {
    await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: {} }));
    await page.route('**/api/animals/shelters', route => route.fulfill({ json: { extras: { shelters: [
        { id: 42, name: '臺北測試收容所', address: '臺北市內湖區', tel: '02-0000' },
        { id: 43, name: '臺南測試收容所', address: '臺南市南區', tel: '06-0000' },
    ], truncated: false } } }));
    await page.route('**/api/animals?*', route => route.fulfill({ json: { extras: { animals: [], cursors: {} } } }));
    await page.goto('/shelter-animals');
    await page.getByLabel('縣市／地址').fill('台北');
    await page.getByLabel('收容所', { exact: true }).selectOption('42');
    await page.getByRole('button', { name: '查詢', exact: true }).click();
    await expect(page).toHaveURL(/shelterId=42/);
    await page.reload();
    await expect(page.getByLabel('收容所', { exact: true })).toHaveValue('42');
    await expect(page.getByText('排序：資料更新日由新到舊')).toHaveCount(0);
    await expect(page.getByText(/目前未依你的定位或距離排序/)).toHaveCount(0);
    await page.getByLabel('縣市／地址').fill('臺南');
    await expect(page.getByLabel('收容所', { exact: true })).toHaveValue('');
    await page.getByRole('button', { name: '查詢', exact: true }).click();
    await expect(page).not.toHaveURL(/shelterId/);
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
});

test('unavailable shelter metadata does not silently drop a selected shelter', async ({ page }) => {
    await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: {} }));
    await page.route('**/api/animals/shelters', route => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
    await page.route('**/api/animals?*', route => route.fulfill({ json: { extras: { animals: [], cursors: {} } } }));
    await page.goto('/shelter-animals?shelterId=999');
    await expect(page.getByText('清單暫時無法取得，仍可使用其他篩選。')).toBeVisible();
    await expect(page.getByLabel('收容所', { exact: true })).toHaveValue('999');
    await page.getByRole('button', { name: '查詢', exact: true }).click();
    await expect(page).toHaveURL(/shelterId=999/);
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expect(page.getByLabel('收容所', { exact: true })).toHaveValue('');
});
