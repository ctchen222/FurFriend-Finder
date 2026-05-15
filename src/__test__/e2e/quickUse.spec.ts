import { test, expect } from '@playwright/test';

test.describe('Quick Use', () => {
	// TODO: This test depends on a live external API and asserts a fixed result count (10).
	// It is unreliable without proper API mocking. Skipped until mock is implemented.
	test.skip('Quick Use', async ({ page }) => {
		await page.goto('http://localhost:2486');
		await page.getByRole('link', { name: '快速比對' }).click();
		await expect(page).toHaveURL('http://localhost:2486/quick-use');
		await expect(page.locator('h1')).toContainText('快速比對走失毛孩');
		await page.getByLabel('毛孩名稱 (選填)').fill('二寶');
		await page.getByLabel('種類').selectOption('狗');
		await page.getByLabel('品種 (選填)').fill('柴犬');
		await page.getByLabel('性別').selectOption('公');
		await page.getByLabel('毛色 (選填)').fill('黃色');
		await page.getByLabel('走失地點 (縣市區)').fill('高雄市內門區');
		await page.getByRole('button', { name: '開始比對' }).click();
		await expect(page.locator('h2')).toContainText('比對結果');

		// TODO: Or mock api
		await page.waitForSelector('.result-card');
		const results = await page.locator('.result-card').count();
		expect(results).toBe(10);
	});
});
