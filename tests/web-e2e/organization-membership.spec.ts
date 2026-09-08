import { expect, test } from '@playwright/test';

const id = '11111111-1111-4111-8111-111111111111';
const invitationId = '22222222-2222-4222-8222-222222222222';
const token = `${invitationId}.${'a'.repeat(43)}`;
const organization = {
    id,
    name: '小橘中途之家',
    type: 'GROUP',
    description: '',
    city: '臺北市',
    publicContact: '',
    reviewStatus: 'PENDING',
    operationalStatus: 'ACTIVE',
    publishedAt: null,
    version: 1,
    role: 'OWNER',
};
const owner = {
    userId: 'owner',
    name: '小明',
    email: 'owner@example.com',
    role: 'OWNER',
    joinedAt: '2026-09-07T00:00:00.000Z',
};
const editor = {
    userId: 'editor',
    name: '小美',
    email: 'editor@example.com',
    role: 'EDITOR',
    joinedAt: '2026-09-07T00:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            json: {
                user: {
                    id: 'owner',
                    name: '小明',
                    email: 'owner@example.com',
                    emailVerified: true,
                },
            },
        }),
    );
    await page.route(`**/api/v1/organizations/${id}/profile`, (route) =>
        route.fulfill({ json: { organization } }),
    );
});

test('owner invites, changes role, removes, and starts a confirmed ownership transfer', async ({
    page,
}) => {
    let invitations: any[] = [];
    let members = [owner, editor];
    let transfer: any = null;
    await page.route(`**/api/v1/organizations/${id}/members`, (route) =>
        route.fulfill({
            json: {
                members,
                invitations,
                transfer,
                capabilities: {
                    inviteRoles: ['ADMIN', 'EDITOR'],
                    canManageMembers: true,
                    canTransferOwnership: true,
                },
            },
        }),
    );
    await page.route(
        `**/api/v1/organizations/${id}/invitations`,
        async (route) => {
            const body = route.request().postDataJSON();
            invitations = [
                {
                    id: invitationId,
                    email: body.email,
                    role: body.role,
                    status: 'PENDING',
                    expiresAt: '2026-09-14T00:00:00.000Z',
                    delivery: {
                        state: 'FAILED',
                        attempts: 3,
                        sentAt: null,
                        failureReason: 'network',
                        resendAvailableAt: '2026-09-07T00:00:00.000Z',
                    },
                },
            ];
            await route.fulfill({
                status: 201,
                json: { invitation: invitations[0] },
            });
        },
    );
    await page.route(
        `**/api/v1/organizations/${id}/invitations/${invitationId}/resend`,
        async (route) => {
            invitations = [
                {
                    ...invitations[0],
                    id: '33333333-3333-4333-8333-333333333333',
                    delivery: {
                        state: 'PENDING',
                        attempts: 0,
                        sentAt: null,
                        failureReason: null,
                        resendAvailableAt: '2026-09-07T00:01:00.000Z',
                    },
                },
            ];
            await route.fulfill({
                status: 201,
                json: { invitation: invitations[0] },
            });
        },
    );
    await page.route(
        `**/api/v1/organizations/${id}/members/editor`,
        async (route) => {
            members = members.map((member) =>
                member.userId === 'editor'
                    ? { ...member, role: route.request().postDataJSON().role }
                    : member,
            );
            await route.fulfill({ json: { member: members[1] } });
        },
    );
    await page.route(
        `**/api/v1/organizations/${id}/members/editor/remove`,
        async (route) => {
            members = members.filter((member) => member.userId !== 'editor');
            transfer = null;
            await route.fulfill({ status: 204 });
        },
    );
    await page.route(
        `**/api/v1/organizations/${id}/ownership-transfers`,
        async (route) => {
            transfer = {
                id: invitationId,
                toUserId: 'editor',
                toName: '小美',
                status: 'PENDING',
                expiresAt: '2026-09-14T00:00:00.000Z',
            };
            await route.fulfill({ status: 201, json: { transfer } });
        },
    );

    await page.goto(`/orgs/${id}`);
    await page.getByLabel('Email').fill('helper@example.com');
    await page.getByRole('button', { name: '寄出邀請' }).click();
    await expect(page.getByText('helper@example.com')).toBeVisible();
    await expect(page.getByText('寄送失敗，請重新寄送')).toBeVisible();
    await page.getByRole('button', { name: '重新寄送' }).click();
    await expect(page.getByText('等待寄送')).toBeVisible();
    await expect(
        page.getByText('新邀請已排入寄送，舊連結已失效。'),
    ).toBeVisible();

    await page.getByLabel('小美的角色').selectOption('ADMIN');
    await expect(page.getByLabel('小美的角色')).toHaveValue('ADMIN');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '移轉給小美' }).click();
    await expect(page.getByText('等待 小美 確認接任負責人。')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '移除小美' }).click();
    await expect(
        page.locator('.member-row').filter({ hasText: '小美' }),
    ).toHaveCount(0);
});

test('editor sees a private roster without member email or management controls', async ({
    page,
}) => {
    await page.route(`**/api/v1/organizations/${id}/profile`, (route) =>
        route.fulfill({
            json: { organization: { ...organization, role: 'EDITOR' } },
        }),
    );
    await page.route(`**/api/v1/organizations/${id}/members`, (route) =>
        route.fulfill({
            json: {
                members: [
                    { ...owner, email: undefined },
                    { ...editor, email: undefined },
                ],
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
    await page.goto(`/orgs/${id}`);
    await expect(page.getByRole('heading', { name: '成員' })).toBeVisible();
    await expect(page.getByText('owner@example.com')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '寄出邀請' })).toHaveCount(0);
});

test('invitation requires the matching account and accepts into the workspace', async ({
    page,
}) => {
    let matches = false;
    await page.route(`**/api/v1/organization-invitations/${token}`, (route) =>
        route.fulfill({
            json: {
                invitation: {
                    organizationId: id,
                    organizationName: '小橘中途之家',
                    role: 'EDITOR',
                    expiresAt: '2026-09-14T00:00:00.000Z',
                    accountMatches: matches,
                    status: 'PENDING',
                },
            },
        }),
    );
    await page.route(
        `**/api/v1/organization-invitations/${token}/accept`,
        (route) => route.fulfill({ json: { organizationId: id } }),
    );
    await page.goto(`/organization-invitations/${token}`);
    await expect(page.getByText('請切換至收到邀請的 Email 帳號')).toBeVisible();
    await expect(page.getByRole('button', { name: '接受邀請' })).toHaveCount(0);
    matches = true;
    await page.reload();
    await page.getByRole('button', { name: '接受邀請' }).click();
    await expect(page).toHaveURL(`/orgs/${id}`);
});

test('member workspace stays usable at supported widths', async ({ page }) => {
    await page.route(`**/api/v1/organizations/${id}/members`, (route) =>
        route.fulfill({
            json: {
                members: [owner, editor],
                invitations: [],
                transfer: null,
                capabilities: {
                    inviteRoles: ['ADMIN', 'EDITOR'],
                    canManageMembers: true,
                    canTransferOwnership: true,
                },
            },
        }),
    );
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/orgs/${id}`);
        await expect(page.getByRole('heading', { name: '成員' })).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
    }
});
