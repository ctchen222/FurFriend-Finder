import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, role: string) {
    await page.goto('/login');
    await page
        .getByLabel('Email', { exact: true })
        .fill(`${role}@c2.example.test`);
    await page
        .getByLabel('密碼', { exact: true })
        .fill('C2-acceptance-password!');
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await expect(page).toHaveURL(/profile/);
}
test('real review → personal notice → read; unauthorized users cannot read or retry', async ({
    page,
    browser,
    request,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, 'owner');
    const created = await page.request.post('/api/v1/organizations', {
        data: {
            requestId: crypto.randomUUID(),
            name: '通知驗收之家',
            type: 'INDIVIDUAL',
            city: '臺北市',
        },
    });
    expect(created.status()).toBe(201);
    const { organization } = await created.json();
    const reviewer = await browser.newPage();
    await login(reviewer, 'reviewer');
    await reviewer.goto('/review/organizations');
    const card = reviewer
        .locator('.reviewer-card')
        .filter({ hasText: '通知驗收之家' });
    await card.getByRole('button', { name: '核准', exact: true }).click();
    await expect(card).toHaveCount(0);
    await page.goto('/profile');
    const notices = page.getByRole('region', { name: /中途之家通知/ });
    await expect(notices).toContainText('通知驗收之家');
    await expect(notices).toContainText('中途之家已通過審核');
    await expect(notices).toContainText('1 則未讀');
    const data = await (
        await page.request.get('/api/v1/me/organization-notifications')
    ).json();
    expect(
        (await request.get('/api/v1/me/organization-notifications')).status(),
    ).toBe(401);
    expect(
        (
            await reviewer.request.post(
                `/api/v1/me/organization-notifications/${data.notifications[0].id}/read`,
                { data: {} },
            )
        ).status(),
    ).toBe(404);
    expect(
        (await page.request.get('/api/v1/reviewer/notice-deliveries')).status(),
    ).toBe(403);
    for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: testInfo.outputPath(`notifications-${width}.png`),
            fullPage: true,
        });
    }
    await page.route(
        '**/api/v1/me/organization-notifications/*/read',
        (route) =>
            route.fulfill({
                status: 503,
                json: { message: '暫時無法儲存，請重試' },
            }),
    );
    await notices.getByRole('button', { name: '標為已讀' }).click();
    await expect(notices.getByRole('alert')).toContainText('暫時無法儲存');
    await expect(notices).toContainText('1 則未讀');
    await page.unroute('**/api/v1/me/organization-notifications/*/read');
    await notices.getByRole('button', { name: '標為已讀' }).click();
    await expect(notices).not.toContainText('則未讀');
    await notices.getByRole('link', { name: '查看組織最新狀態' }).click();
    await expect(page).toHaveURL(new RegExp(`/orgs/${organization.id}$`));
    await reviewer.getByText('通知寄送狀態', { exact: true }).click();
    await expect(reviewer.getByRole('alert')).toContainText('背景寄信服務');
    expect(errors).toEqual([]);
    await reviewer.close();
});

test('long names and absent descriptions wrap without placeholder noise', async ({
    page,
}) => {
    const name = '二寶的家'.repeat(16);
    await page.route('**/api/v1/public/organizations?*', (route) =>
        route.fulfill({
            json: {
                organizations: [
                    {
                        id: '11111111-1111-4111-8111-111111111111',
                        name,
                        type: 'INDIVIDUAL',
                        city: '',
                        description: '',
                        publicContact: '',
                        publishedAt: new Date().toISOString(),
                    },
                ],
                nextCursor: null,
            },
        }),
    );
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/foster-organizations');
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
        ),
    ).toBe(true);
    await expect(page.getByText('尚未填寫介紹', { exact: false })).toHaveCount(
        0,
    );
});

test('organization cards have clear actions, no title underline, and responsive focus', async ({
    page,
}, testInfo) => {
    await page.goto('/foster-organizations');
    const link = page.getByRole('link', { name: '小橘中途之家', exact: true });
    await expect(link).toBeVisible();
    await page.screenshot({
        path: testInfo.outputPath('directory-before-or-after.png'),
        fullPage: true,
    });
    await expect(link).toHaveCSS('text-decoration-line', 'none');
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).not.toHaveCSS('outline-style', 'none');
        await page.screenshot({
            path: testInfo.outputPath(`directory-${width}.png`),
            fullPage: true,
        });
    }
    await login(page, 'owner');
    await page.goto('/organizations');
    await expect(
        page.getByRole('link', { name: '小橘中途之家', exact: true }),
    ).toHaveCSS('text-decoration-line', 'none');
});
