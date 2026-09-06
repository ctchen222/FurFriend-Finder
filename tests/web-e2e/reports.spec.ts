import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

async function registerAndLogin(page: Page, request: APIRequestContext, email: string) {
    await page.goto('/register');
    await page.getByLabel('姓名', { exact: true }).fill('協尋測試');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('密碼', { exact: true }).fill('Local-report-123!');
    await page.getByRole('button', { name: '建立帳號', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('驗證信已寄出');
    let link = '';
    await expect.poll(async () => {
        const { messages } = await (await request.get('http://localhost:8025/api/v1/messages')).json();
        const message = messages.find((item: any) => item.Subject.includes('Verify') && item.To.some((to: any) => to.Address === email));
        if (!message) return false;
        const detail = await (await request.get(`http://localhost:8025/api/v1/message/${message.ID}`)).json();
        link = detail.Text.match(/https?:\/\/[^\s]+/)?.[0] ?? '';
        return !!link;
    }).toBe(true);
    await page.goto(link);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('密碼', { exact: true }).fill('Local-report-123!');
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await expect(page).toHaveURL(/profile/);
}

test('create report, match in real DB, send mail, edit, close and reject another user', async ({ page, request, browser }) => {
    test.setTimeout(120_000);
    const email = `report-${Date.now()}@example.test`;
    await registerAndLogin(page, request, email);
    await page.getByRole('link', { name: '新增案件', exact: true }).click();
    await page.getByLabel('寵物名字').fill('回家測試小黑');
    await page.getByRole('combobox', { name: '物種', exact: true }).selectOption('狗');
    await page.getByLabel('品種', { exact: true }).fill('米克斯');
    await page.getByLabel('毛色').fill('黑色');
    await page.getByLabel('走失地點（必填）').fill('臺北市信義區市府路1號');
    await page.getByRole('button', { name: '儲存案件並執行配對' }).click();
    await expect(page).toHaveURL(/\/reports\/\d+$/);
    const reportId = page.url().split('/').pop();
    await expect.poll(async () => {
        const data = await (await page.request.get(`/api/v1/reports/${reportId}`)).json();
        return { job: data.job?.state, mail: data.notification?.state, candidates: data.match?.candidates.length };
    }, { timeout: 60_000 }).toEqual({ job: 'SUCCEEDED', mail: 'SENT', candidates: 10 });
    await expect(page.getByRole('heading', { name: '可能的匹配' })).toBeVisible();
    const { messages } = await (await request.get('http://localhost:8025/api/v1/messages')).json();
    expect(messages.some((item: any) => item.Subject.includes('最新配對通知') && item.To.some((to: any) => to.Address === email))).toBe(true);

    const stranger = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const strangerPage = await stranger.newPage();
    await registerAndLogin(strangerPage, request, `stranger-${Date.now()}@example.test`);
    expect((await strangerPage.request.get(`/api/v1/reports/${reportId}`)).status()).toBe(404);
    expect((await strangerPage.request.post(`/api/v1/reports/${reportId}/match`)).status()).toBe(404);
    expect((await strangerPage.request.post(`/api/lost-animals/match/${reportId}/notify`)).status()).toBe(404);
    await stranger.close();

    await page.getByRole('button', { name: '編輯案件', exact: true }).click();
    await page.getByLabel('寵物名字').fill('小黑更新線索');
    await page.getByRole('button', { name: '儲存並重新配對' }).click();
    await expect(page.getByRole('heading', { name: '小黑更新線索的協尋案件' })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '已找回', exact: true }).click();
    await expect(page.getByText('已標記為找回', { exact: true })).toBeVisible();
    const detail = await (await page.request.get(`/api/v1/reports/${reportId}`)).json();
    expect(detail.report.status).toBe('REUNITED');
    expect(detail.report.revision).toBe(3);
    expect((await page.request.post(`/api/v1/reports/${reportId}/match`)).status()).toBe(409);
    expect((await page.request.post(`/api/lost-animals/match/${reportId}/notify`)).status()).toBe(409);
});

test('public pages, pagination, quick matching and responsive layout', async ({ page }) => {
    await page.goto('/shelter-animals');
    await expect(page.locator('.pet-card')).toHaveCount(12);
    const first = await page.locator('.pet-card h3').first().textContent();
    await page.getByRole('button', { name: '下一頁' }).click();
    await expect(page.locator('.pet-card h3').first()).not.toHaveText(first!);
    await page.locator('.pet-card h3 a').first().click();
    await expect(page.getByRole('heading', { name: '辨識資訊' })).toBeVisible();
    await page.goto('/quick-use');
    await page.getByLabel('走失地點（必填）').fill('臺北市信義區市府路1號');
    await page.getByRole('button', { name: '尋找可能的匹配' }).click();
    await expect(page.locator('.pet-card')).toHaveCount(10);
    for (const width of [320, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.screenshot({ path: 'test-results/react-quick-match.png', fullPage: true });
});

test('legacy manual notification honors opt-out and legacy closure updates the current revision', async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = `opt-out-${Date.now()}@example.test`;
    await registerAndLogin(page, request, email);
    expect((await page.request.patch('/api/v1/me/settings', { data: { enabled: false } })).ok()).toBe(true);
    const created = await page.request.post('/api/v1/reports', {
        data: { name: '拒收通知測試', kind: '狗', sex: 'N', lost_place: '臺北市信義區市府路1號' },
    });
    expect(created.status()).toBe(201);
    const { report } = await created.json();
    const notification = await page.request.post(`/api/lost-animals/match/${report.id}/notify`);
    expect(notification.status()).toBe(202);
    await expect.poll(async () => {
        const detail = await (await page.request.get(`/api/v1/reports/${report.id}`)).json();
        return { job: detail.job?.state, mail: detail.notification?.state };
    }, { timeout: 60_000 }).toEqual({ job: 'SUCCEEDED', mail: 'DISABLED' });
    const { messages } = await (await request.get('http://localhost:8025/api/v1/messages')).json();
    expect(messages.some((item: any) => item.Subject.includes('最新配對通知') && item.To.some((to: any) => to.Address === email))).toBe(false);
    expect((await page.request.post(`/api/lost-animals/${report.id}/close`, {
        data: { expectedRevision: 1, status: 'closed' },
    })).status()).toBe(200);
    const closed = await (await page.request.get(`/api/v1/reports/${report.id}`)).json();
    expect(closed.report.status).toBe('CLOSED');
    expect(closed.report.revision).toBe(2);
    expect((await page.request.post(`/api/lost-animals/match/${report.id}/notify`)).status()).toBe(409);
});
