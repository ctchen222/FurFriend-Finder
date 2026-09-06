import { expect, test } from '@playwright/test';

const pet = {
    id: 42,
    sub_id: 'CAAAG1150617003',
    variety: '混種貓',
    kind: '貓',
    sex: 'F',
    colour: '黑白色',
    shelter_name: '測試動物之家',
};
test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({ status: 401, json: {} }),
    );
    await page.route('**/api/animals/random', (route) =>
        route.fulfill({ json: { extras: { animal: pet } } }),
    );
    await page.route('**/api/animals?*', (route) =>
        route.fulfill({ json: { extras: { animals: [pet], cursors: {} } } }),
    );
    await page.route('**/api/animals/42', (route) =>
        route.fulfill({ json: { extras: { animal: pet } } }),
    );
});

test('restores the original home sections, palette and mobile navigation', async ({
    page,
}) => {
    await page.goto('/');
    await expect(
        page.getByRole('heading', { name: '今日推薦動物' }),
    ).toBeVisible();
    await expect(page.locator('.hero-action-panel .action-card')).toHaveCount(
        3,
    );
    await expect(page.locator('.featured-card')).toContainText('混種貓');
    await expect(page.locator('.action-card--primary')).toHaveCSS(
        'background-color',
        'rgb(184, 92, 56)',
    );
    await page.setViewportSize({ width: 320, height: 800 });
    const toggle = page.getByRole('button', { name: '切換選單' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page
        .getByRole('navigation', { name: '主要導覽' })
        .getByRole('link', { name: '收容所動物' })
        .click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
    }
});

test('keeps shelter identifiers out of headings but available in details', async ({
    page,
}) => {
    await page.goto('/shelter-animals');
    await expect(
        page.getByRole('heading', { name: '混種貓', exact: true }),
    ).toBeVisible();
    await expect(page.locator('h3')).not.toContainText(pet.sub_id);
    await page.getByRole('link', { name: '混種貓', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('混種貓');
    await expect(page.getByText(pet.sub_id, { exact: true })).toBeVisible();
    await expect(
        page.getByRole('button', { name: '複製收容編號' }),
    ).toBeVisible();
});

test('registration offers Google without requiring an email or password', async ({
    page,
}) => {
    await page.route('**/api/v1/config', (route) =>
        route.fulfill({ json: { googleOAuthEnabled: true } }),
    );
    let body: Record<string, string> | undefined;
    await page.route('**/api/auth/sign-in/social', (route) => {
        body = route.request().postDataJSON();
        return route.fulfill({
            status: 503,
            json: { message: 'Google 登入暫時無法使用，請稍後再試。' },
        });
    });
    await page.goto('/register');
    await page.getByRole('button', { name: '使用 Google 繼續' }).click();
    expect(body).toEqual({
        provider: 'google',
        callbackURL: 'http://localhost:5173/profile',
    });
    await expect(page.getByRole('alert')).toContainText(
        'Google 登入暫時無法使用',
    );
    await expect(
        page.getByRole('button', { name: '使用 Google 繼續' }),
    ).toBeEnabled();
});
