import { expect, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const publicOrganization = {
    id,
    name: '小橘中途之家',
    type: 'INDIVIDUAL',
    description: '照顧等待家的貓咪',
    city: '臺北市',
    publicContact: 'contact@example.test',
    publishedAt: '2026-09-07T00:00:00.000Z',
};

test('anonymous visitors can search and read only the public organization projection', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({ status: 401, json: { message: '請登入' } }),
    );
    await page.route(/\/api\/v1\/public\/organizations\?.*/, (route) =>
        route.fulfill({
            json: { organizations: [publicOrganization], nextCursor: null },
        }),
    );
    await page.route(`**/api/v1/public/organizations/${id}`, (route) =>
        route.fulfill({ json: { organization: publicOrganization } }),
    );
    await page.goto('/foster-organizations');
    await expect(
        page.getByRole('heading', { name: '中途之家', exact: true }),
    ).toBeVisible();
    await page.getByLabel('名稱或介紹').fill('貓咪');
    await page.getByRole('button', { name: '搜尋', exact: true }).click();
    await page.getByRole('link', { name: '小橘中途之家' }).click();
    await expect(page.getByText('contact@example.test')).toBeVisible();
    await expect(page.getByText(id)).toHaveCount(0);
    await expect(page.getByText(/@review\.test/)).toHaveCount(0);
});

test('an approved owner explicitly publishes and receives version-conflict feedback', async ({
    page,
}) => {
    const approved = {
        ...publicOrganization,
        reviewStatus: 'APPROVED',
        operationalStatus: 'ACTIVE',
        publishedAt: null,
        version: 2,
        role: 'OWNER',
    };
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            json: { user: { id: 'owner', name: 'Owner', emailVerified: true } },
        }),
    );
    await page.route(`**/api/v1/organizations/${id}/profile`, (route) =>
        route.fulfill({ json: { organization: approved } }),
    );
    await page.route(`**/api/v1/organizations/${id}/members`, (route) =>
        route.fulfill({
            json: {
                members: [],
                invitations: [],
                transfer: null,
                capabilities: {
                    inviteRoles: [],
                    canManageMembers: false,
                    canTransferOwnership: false,
                },
            },
        }),
    );
    let attempts = 0;
    await page.route(
        `**/api/v1/organizations/${id}/publications`,
        async (route) => {
            attempts += 1;
            if (attempts === 1)
                await route.fulfill({
                    status: 409,
                    json: { message: '資料已更新，請重新載入後再試' },
                });
            else
                await route.fulfill({
                    json: {
                        organization: {
                            ...approved,
                            version: 3,
                            publishedAt: publicOrganization.publishedAt,
                        },
                    },
                });
        },
    );
    await page.goto(`/orgs/${id}`);
    await page.getByRole('button', { name: '公開中途之家' }).click();
    await expect(page.getByRole('alert')).toContainText('重新載入');
    await page.getByRole('button', { name: '公開中途之家' }).click();
    await expect(page.getByText('已公開', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '取消公開' })).toBeVisible();
});

test('a reviewer can approve without sending a forged identity', async ({
    page,
}) => {
    const reviewOrganization = {
        ...publicOrganization,
        reviewStatus: 'PENDING',
        operationalStatus: 'ACTIVE',
        publishedAt: null,
        version: 1,
    };
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            json: {
                user: {
                    id: 'reviewer',
                    name: 'Reviewer',
                    emailVerified: true,
                    isOrganizationReviewer: true,
                },
            },
        }),
    );
    let reviewed = false;
    await page.route(/\/api\/v1\/reviewer\/organizations\?.*/, (route) => {
        return route.fulfill({
            json: {
                organizations: reviewed ? [] : [reviewOrganization],
                nextCursor: null,
            },
        });
    });
    let submitted: Record<string, unknown> = {};
    await page.route(
        `**/api/v1/reviewer/organizations/${id}/reviews`,
        async (route) => {
            submitted = route.request().postDataJSON();
            reviewed = true;
            await route.fulfill({
                json: {
                    organization: {
                        ...reviewOrganization,
                        reviewStatus: 'APPROVED',
                        version: 2,
                    },
                },
            });
        },
    );
    await page.goto('/review/organizations');
    await page.getByRole('button', { name: '核准', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: '這裡目前沒有項目' }),
    ).toBeVisible();
    expect(submitted).toEqual({
        expectedVersion: 1,
        decision: 'APPROVED',
        reason: '',
    });
    expect(submitted).not.toHaveProperty('reviewerId');
});

test('public organization pages fit a small mobile viewport', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({ status: 401, json: { message: '請登入' } }),
    );
    await page.route(`**/api/v1/public/organizations/${id}`, (route) =>
        route.fulfill({
            json: {
                organization: {
                    ...publicOrganization,
                    publicContact: 'long-contact-'.repeat(40),
                },
            },
        }),
    );
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/foster-organizations/${id}`);
    await expect(
        page.getByRole('heading', { name: '小橘中途之家' }),
    ).toBeVisible();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBe(true);
});
