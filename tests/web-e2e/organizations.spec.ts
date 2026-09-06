import { expect, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const organization = { id, name: '小橘中途之家', type: 'INDIVIDUAL', description: '照顧等待家的貓咪', city: '臺北市', publicContact: '', reviewStatus: 'PENDING', operationalStatus: 'ACTIVE', publishedAt: null, version: 1, role: 'OWNER' };

test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/me', route => route.fulfill({ json: { user: { id: 'org-ui-user', name: '測試使用者', emailVerified: true } } }));
});

test('creates an organization, preserves retry identity, and shows private workspace status', async ({ page }) => {
    const requests: Record<string, unknown>[] = [];
    await page.route(/\/api\/v1\/organizations(?:\?.*)?$/, async route => {
        if (route.request().method() === 'POST') {
            requests.push(route.request().postDataJSON());
            await route.fulfill({ status: requests.length === 1 ? 503 : 201, json: requests.length === 1 ? { message: '暫時無法建立，請重試' } : { organization } });
        } else await route.fulfill({ json: { organizations: [], nextCursor: null } });
    });
    await page.route(`**/api/v1/organizations/${id}`, route => route.fulfill({ json: { organization } }));
    await page.goto('/organizations');
    await expect(page.getByRole('heading', { name: '尚未加入中途之家' })).toBeVisible();
    await page.getByRole('link', { name: '建立中途之家', exact: true }).click();
    await page.getByLabel('中途之家名稱').fill('小橘中途之家');
    await page.getByLabel('所在縣市').fill('臺北市');
    await page.getByLabel('介紹', { exact: true }).fill('照顧等待家的貓咪');
    await page.getByRole('button', { name: '建立組織', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('暫時無法建立');
    await page.getByRole('button', { name: '建立組織', exact: true }).click();
    await expect(page).toHaveURL(`/orgs/${id}`);
    expect(requests).toHaveLength(2);
    expect(requests[0].requestId).toBe(requests[1].requestId);
    expect(requests[0]).not.toHaveProperty('ownerId');
    await expect(page.getByRole('heading', { name: '小橘中途之家', exact: true })).toBeVisible();
    await expect(page.getByText('尚未公開', { exact: true })).toBeVisible();
    await expect(page.getByText('待審核', { exact: true })).toBeVisible();
    await expect(page.getByText('負責人', { exact: true })).toBeVisible();
});

test('switching organizations never displays the previous private workspace and handles revoked access', async ({ page }) => {
    await page.route(/\/api\/v1\/organizations(?:\?.*)?$/, route => route.fulfill({ json: { organizations: [organization, { ...organization, id: otherId, name: '另一間中途之家', role: 'EDITOR' }], nextCursor: null } }));
    await page.route(`**/api/v1/organizations/${id}`, route => route.fulfill({ json: { organization } }));
    await page.route(`**/api/v1/organizations/${otherId}`, route => route.fulfill({ status: 404, json: { message: '找不到此組織' } }));
    await page.goto(`/orgs/${id}`);
    await expect(page.getByRole('heading', { name: '小橘中途之家', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '切換組織', exact: true }).click();
    await page.getByRole('link', { name: '另一間中途之家', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('找不到此組織');
    await expect(page.getByRole('heading', { name: '小橘中途之家', exact: true })).toHaveCount(0);
});

test('unauthenticated organization deep links retain a safe Google callback', async ({ page }) => {
    await page.route('**/api/v1/me', route => route.fulfill({ status: 401, json: { message: '請登入' } }));
    await page.route('**/api/v1/config', route => route.fulfill({ json: { googleOAuthEnabled: true } }));
    let callback = '';
    await page.route('**/api/auth/sign-in/social', async route => {
        callback = route.request().postDataJSON().callbackURL;
        await route.fulfill({ status: 503, json: { message: '測試停止導向 Google' } });
    });
    await page.goto(`/orgs/${id}`);
    await page.getByRole('button', { name: '使用 Google 繼續' }).click();
    await expect.poll(() => callback).toBe(`http://localhost:5173/orgs/${id}`);
});

test('workspace stays within mobile viewport', async ({ page }) => {
    await page.route(`**/api/v1/organizations/${id}`, route => route.fulfill({ json: { organization: { ...organization, name: '很長的中途之家名稱'.repeat(5) } } }));
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/orgs/${id}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
});
