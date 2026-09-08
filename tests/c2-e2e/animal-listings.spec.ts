import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

async function login(page: Page, role = 'owner') {
    await page.goto('/login');
    await page
        .getByLabel('Email', { exact: true })
        .fill(`${role}@c2.example.test`);
    await page
        .getByLabel('密碼', { exact: true })
        .fill('C2-acceptance-password!');
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await expect(page).toHaveURL(/profile/);
    const response = await page.request.get('/api/v1/organizations');
    return (await response.json()).organizations[0].id as string;
}
async function draft(page: Page, orgId: string, name: string) {
    await page.goto(`/orgs/${orgId}/animals`);
    await page.getByRole('link', { name: '新增動物', exact: true }).click();
    await page.getByLabel('名字').fill(name);
    await page.getByLabel('認識牠').fill('喜歡陪伴，也喜歡安靜地曬太陽。');
    await page.getByRole('button', { name: '儲存草稿', exact: true }).click();
    await expect(page).toHaveURL(/\/animals\/[0-9a-f-]{36}$/);
    return page.url().split('/').pop()!;
}

test('real login → draft → photo → preview → publish → anonymous detail → withdraw', async ({
    page,
    request,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const orgId = await login(page);
    await page.goto(`/orgs/${orgId}`);
    await page.getByRole('link', { name: '管理動物', exact: true }).click();
    await expect(page.getByRole('heading', { name: '動物管理' })).toBeVisible();
    const id = await draft(page, orgId, '小橘驗收');
    await expect(
        page.getByRole('button', { name: '公開動物', exact: true }),
    ).toBeDisabled();
    const png = await sharp({
        create: { width: 400, height: 300, channels: 3, background: '#e0aa70' },
    })
        .png()
        .toBuffer();
    let finishUpload!: () => void;
    const uploadGate = new Promise<void>((resolve) => {
        finishUpload = resolve;
    });
    await page.route(
        `**/api/v1/organizations/${orgId}/animals/${id}/photos`,
        async (route) => {
            await uploadGate;
            await route.continue();
        },
    );
    await page
        .getByLabel('上傳照片')
        .setInputFiles({ name: 'cat.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByLabel('名字')).toBeDisabled();
    await expect(
        page.getByRole('button', { name: '預覽已儲存內容' }),
    ).toBeDisabled();
    finishUpload();
    await expect(page.getByText('照片已上傳。', { exact: true })).toBeVisible();
    await page.unroute(`**/api/v1/organizations/${orgId}/animals/${id}/photos`);
    const api = `/api/v1/organizations/${orgId}/animals/${id}`;
    const saved = (await (await page.request.get(api)).json()).animal;
    const publicApi = `/api/v1/public/organizations/${orgId}/animals/${id}`;
    expect((await request.get(publicApi)).status()).toBe(404);
    expect(
        (
            await request.get(`${publicApi}/photos/${saved.photoIds[0]}`)
        ).status(),
    ).toBe(404);
    await page.getByRole('button', { name: '預覽已儲存內容' }).click();
    await expect(page.getByRole('dialog')).toContainText('小橘驗收');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '公開動物', exact: true }).click();
    await expect(page.getByText('已公開，大家可以看見牠了。')).toBeVisible();
    expect((await request.get(publicApi)).status()).toBe(200);
    expect(
        (
            await request.get(`${publicApi}/photos/${saved.photoIds[0]}`)
        ).headers()['content-type'],
    ).toBe('image/webp');
    const publicPage = await page.context().browser()!.newPage();
    await publicPage.goto(
        `http://localhost:2487/foster-organizations/${orgId}`,
    );
    await publicPage.getByRole('link', { name: /小橘驗收/ }).click();
    await expect(
        publicPage.getByRole('heading', { name: '認識小橘驗收' }),
    ).toBeVisible();
    await expect(
        publicPage.getByRole('button', { name: '儲存草稿' }),
    ).toHaveCount(0);
    await publicPage.close();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '下架並編輯' }).click();
    await expect(page.getByText('已下架，可以編輯草稿。')).toBeVisible();
    expect((await request.get(publicApi)).status()).toBe(404);
    expect(
        (
            await request.get(`${publicApi}/photos/${saved.photoIds[0]}`)
        ).status(),
    ).toBe(404);
    await page.getByLabel('送養狀態').selectOption('ADOPTED');
    await page.getByRole('button', { name: '儲存草稿', exact: true }).click();
    await expect(page.getByText('草稿已儲存。', { exact: true })).toBeVisible();
    expect(
        (await (await page.request.get(api)).json()).animal.adoptionStatus,
    ).toBe('ADOPTED');
    expect(errors).toEqual([]);
});

test('save failure retains input, navigation protects dirty fields, stale versions reject overwrites', async ({
    page,
}) => {
    const orgId = await login(page);
    const id = await draft(page, orgId, '衝突驗收');
    const api = `/api/v1/organizations/${orgId}/animals/${id}`;
    await page.getByLabel('名字').fill('我正在編輯');
    await Promise.all([
        page.waitForEvent('dialog').then((dialog) => dialog.dismiss()),
        page.getByRole('link', { name: '← 動物管理' }).click(),
    ]);
    await expect(page.getByLabel('名字')).toHaveValue('我正在編輯');
    await Promise.all([
        page.waitForEvent('dialog').then((dialog) => dialog.dismiss()),
        page.evaluate(() => window.history.back()),
    ]);
    await expect(page.getByLabel('名字')).toHaveValue('我正在編輯');
    await page.route(`**${api}`, async (route) => {
        if (route.request().method() === 'PATCH')
            await route.fulfill({
                status: 503,
                json: { message: '暫時無法儲存，請重試' },
            });
        else await route.continue();
    });
    await page.getByRole('button', { name: '儲存草稿', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('暫時無法儲存');
    await expect(page.getByLabel('名字')).toHaveValue('我正在編輯');
    await page.unroute(`**${api}`);
    const a = (await (await page.request.get(api)).json()).animal;
    const {
        id: _id,
        organizationId: _org,
        photoIds: _photos,
        publishedAt: _published,
        version,
        ...fields
    } = a;
    expect(
        (
            await page.request.patch(api, {
                data: {
                    ...fields,
                    name: '另一位成員的修改',
                    expectedVersion: version,
                },
            })
        ).status(),
    ).toBe(200);
    await page.getByRole('button', { name: '儲存草稿', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('其他成員已更新資料');
    await expect(page.getByLabel('名字')).toHaveValue('我正在編輯');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '重新載入', exact: true }).click();
    await expect(page.getByLabel('名字')).toHaveValue('另一位成員的修改');
});

test('editor prepares drafts but cannot publish or act in another organization', async ({
    page,
}) => {
    const orgId = await login(page, 'editor');
    const id = await draft(page, orgId, '協作者草稿');
    await expect(
        page.getByRole('button', { name: '公開動物', exact: true }),
    ).toHaveCount(0);
    expect(
        (
            await page.request.post(
                `/api/v1/organizations/${orgId}/animals/${id}/publication`,
                { data: { expectedVersion: 1 } },
            )
        ).status(),
    ).toBe(403);
    expect(
        (
            await page.request.get(
                `/api/v1/organizations/11111111-1111-4111-8111-111111111111/animals/${id}`,
            )
        ).status(),
    ).toBe(404);
});

test('editor layout works at all supported widths and empty/error states are usable', async ({
    page,
}) => {
    const orgId = await login(page);
    await draft(page, orgId, '排版驗收');
    await page.goto(`/orgs/${orgId}/animals/new`);
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(
            page.getByRole('heading', { name: '新增動物', exact: true }),
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: `test-results/c2-editor-${width}.png`,
            fullPage: true,
        });
    }
    await page.getByLabel('名字').focus();
    await page.keyboard.type('鍵盤操作');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('動物種類')).toBeFocused();
    await page.getByLabel('名字').fill('');
    await page.route(`**/api/v1/organizations/${orgId}/animals?`, (route) =>
        route.fulfill({ status: 503, json: { message: '目前無法載入動物' } }),
    );
    await page.goto(`/orgs/${orgId}/animals`);
    await expect(page.getByRole('alert')).toContainText('目前無法載入動物');
    await page.unrouteAll();
    await page.getByRole('button', { name: '重新載入' }).click();
    await expect(page.locator('.listing-card').first()).toBeVisible();
});
