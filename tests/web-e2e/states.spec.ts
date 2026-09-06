import { expect, test } from '@playwright/test';

// These UI tests isolate API boundaries; real DB/SMTP journeys live in the other specs.
test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: { message: '請先登入' } }));
});

test('inventory announces loading before an empty result arrives', async ({ page }) => {
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/animals?*', async route => {
        await ready;
        await route.fulfill({ json: { extras: { animals: [], cursors: {} } } });
    });
    try {
        await page.goto('/shelter-animals');
        await expect(page.getByRole('status')).toHaveText('載入中…');
    } finally { release(); }
    await expect(page.getByRole('heading', { name: '目前沒有符合的動物' })).toBeVisible();
});

test('registration form is operable with the keyboard', async ({ page }) => {
    await page.route('**/api/v1/config', route => route.fulfill({ json: { googleOAuthEnabled: false } }));
    await page.route('**/api/auth/sign-up/email', route => route.fulfill({ json: { user: { id: 'keyboard-test' } } }));
    await page.goto('/register');
    await expect(page.locator('main')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('姓名', { exact: true })).toBeFocused();
    await page.keyboard.type('Keyboard Test');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    await page.keyboard.type('keyboard@example.test');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('密碼', { exact: true })).toBeFocused();
    await page.keyboard.type('Keyboard-test-123!');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '建立帳號', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText('驗證信已寄出');
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

for (const state of ['PENDING', 'FAILED', 'SUCCEEDED']) {
    test(`represents saved results correctly while the job is ${state}`, async ({ page }) => {
        await page.route('**/api/v1/me', route => route.fulfill({ json: { user: { id: 'ui-test', name: '介面測試', email: 'ui@example.test' } } }));
        await page.route('**/api/v1/reports/1', route => route.fulfill({ json: {
            report: { id: 1, name: '小黑', kind: '狗', lost_place: '臺北市', status: 'OPEN', revision: 1 },
            job: { state, attempts: 1, last_error_code: state === 'FAILED' ? 'Error' : null },
            match: { run: { status: 'SUCCEEDED' }, candidates: [] },
            notification: state === 'SUCCEEDED' ? null : { state: 'SENT', attempts: 1, last_error_code: null },
        } }));
        await page.goto('/reports/1');
        if (state === 'SUCCEEDED') {
            await expect(page.getByText('配對完成', { exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { name: '目前沒有符合的動物' })).toBeVisible();
            await expect(page.getByText('本次沒有待送通知。')).toBeVisible();
        } else {
            await expect(page.getByRole('heading', { name: '上次配對結果' })).toBeVisible();
            await expect(page.getByText('上次配對的通知：郵件伺服器已接受通知')).toBeVisible();
        }
        const retry = page.getByRole('button', { name: '重新配對並依設定通知' });
        if (state === 'PENDING') await expect(retry).toBeDisabled();
        else await expect(retry).toBeEnabled();
    });
}
