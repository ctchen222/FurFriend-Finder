import { test, expect, type APIRequestContext } from '@playwright/test';

const mailpit = 'http://localhost:8025';
async function emailLink(request: APIRequestContext, email: string, subject: string) {
    let link = '';
    await expect.poll(async () => {
        const response = await request.get(`${mailpit}/api/v1/messages`);
        const { messages } = await response.json();
        const message = messages.find((item: any) => item.Subject.includes(subject) && item.To.some((to: any) => to.Address === email));
        if (!message) return false;
        const detail = await (await request.get(`${mailpit}/api/v1/message/${message.ID}`)).json();
        link = (detail.Text as string).match(/https?:\/\/[^\s]+/)?.[0] ?? '';
        return Boolean(link);
    }).toBe(true);
    return link;
}

test('register, verify email, login, persist session, settings, logout and reset password', async ({ page, request }) => {
    const email = `react-${Date.now()}@example.test`;
    const password = 'Local-acceptance-123!';
    await page.goto('/register');
    await page.getByLabel('姓名', { exact: true }).fill('React 驗收');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('密碼', { exact: true }).fill(password);
    await page.getByRole('button', { name: '建立帳號', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('驗證信已寄出');
    await page.goto(await emailLink(request, email, 'Verify'));
    await expect(page).toHaveURL(/login\?verified=1/);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('密碼', { exact: true }).fill(password);
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await expect(page).toHaveURL(/profile/);
    await expect(page.getByRole('heading', { name: '個人資料', exact: true })).toBeVisible();
    await expect(page.locator('.profile-info')).toContainText(email);
    await page.reload();
    await expect(page.locator('.profile-info')).toContainText(email);
    await page.getByLabel('接收配對 Email 通知').uncheck();
    await expect(page.getByRole('status')).toContainText('通知設定已儲存');
    await expect(page.getByLabel('接收配對 Email 通知')).not.toBeChecked();
    await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '快速比對', exact: true }).click();
    await page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '個人資料', exact: true }).click();
    await expect(page.getByLabel('接收配對 Email 通知')).not.toBeChecked();
    await page.reload();
    await expect(page.getByLabel('接收配對 Email 通知')).not.toBeChecked();
    await page.getByRole('button', { name: '登出', exact: true }).click();
    await page.goto('/profile');
    await expect(page).toHaveURL(/login/);
    await page.goto('/forgot-password');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: '寄送重設連結' }).click();
    await expect(page.getByRole('status')).toContainText('若此信箱已註冊');
    await page.goto(await emailLink(request, email, 'Reset'));
    await expect(page).toHaveURL(/reset-password\?token=/);
    await page.getByLabel('新密碼').fill('Updated-acceptance-456!');
    await page.getByRole('button', { name: '更新密碼' }).click();
    await expect(page.getByRole('status')).toContainText('密碼已更新');
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('密碼', { exact: true }).fill('Updated-acceptance-456!');
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await expect(page.locator('.profile-info')).toContainText(email);
});
