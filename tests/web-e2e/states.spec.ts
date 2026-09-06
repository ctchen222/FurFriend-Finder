import { expect, test } from '@playwright/test';

// These UI tests isolate API boundaries; real DB/SMTP journeys live in the other specs.
test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: { message: '請先登入' } }));
});

test('public inventory exposes errors, retry and an empty result', async ({ page }) => {
    let fail = true;
    await page.route('**/api/animals?*', route => route.fulfill({
        status: fail ? 503 : 200,
        json: fail ? { message: '收容資料暫時無法取得' } : { extras: { animals: [], cursors: {} } },
    }));
    await page.goto('/shelter-animals');
    await expect(page.getByRole('alert')).toContainText('收容資料暫時無法取得');
    await expect(page.locator('main')).toBeFocused();
    fail = false;
    await page.getByRole('button', { name: '重新載入' }).click();
    await expect(page.getByRole('heading', { name: '目前沒有符合的動物' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const state of ['PENDING', 'FAILED']) {
    test(`labels saved candidates as previous results when the new job is ${state}`, async ({ page }) => {
        await page.route('**/api/v1/me', route => route.fulfill({ json: { user: { id: 'ui-test', name: '介面測試', email: 'ui@example.test' } } }));
        await page.route('**/api/v1/reports/1', route => route.fulfill({ json: {
            report: { id: 1, name: '小黑', kind: '狗', lost_place: '臺北市', status: 'OPEN', revision: 1 },
            job: { state, attempts: 1, last_error_code: state === 'FAILED' ? 'Error' : null },
            match: { run: { status: 'SUCCEEDED' }, candidates: [] },
            notification: { state: 'SENT', attempts: 1, last_error_code: null },
        } }));
        await page.goto('/reports/1');
        await expect(page.getByRole('heading', { name: '上次配對結果' })).toBeVisible();
        await expect(page.getByText('上次配對的通知：郵件伺服器已接受通知')).toBeVisible();
        const retry = page.getByRole('button', { name: '重新配對並依設定通知' });
        if (state === 'PENDING') await expect(retry).toBeDisabled();
        else await expect(retry).toBeEnabled();
    });
}
