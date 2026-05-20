import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const viewPath = path.resolve(__dirname, '../../../views/quick-use.ejs');
const commonPath = path.resolve(__dirname, '../../public/js/common.js');

function extractQuickUseScript() {
	const view = fs.readFileSync(viewPath, 'utf8');
	const match = view.match(/<script>([\s\S]*?)<\/script>/);
	if (!match) throw new Error('quick-use.ejs script block not found');
	return match[1];
}

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

		test('renders local missing-photo fallback for quick-match results', async ({ page }) => {
			const commonScript = fs.readFileSync(commonPath, 'utf8');
			const quickUseScript = extractQuickUseScript();

			await page.route('**/api/lost-animals/quick-match', async (route) => {
				await route.fulfill({
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						extras: {
							top10Matches: [
								{
									id: 1,
									kind: '狗',
									variety: '米克斯',
									sex: 'M',
									colour: '黑色',
									picture: '',
									distance: 1.2,
									shelter_name: '測試收容所',
									found_place: '測試地點',
								},
							],
						},
					}),
				});
			});

			await page.setContent(`
				<base href="http://localhost/">
				<form id="quickMatchForm">
					<input id="kind" name="kind" value="狗">
					<input id="lost_place" name="lost_place" value="台北市中山區">
					<button id="submitBtn" type="submit">開始比對</button>
				</form>
				<section id="resultsSection" hidden>
					<div id="matchResults"></div>
				</section>
				<script>${commonScript}</script>
				<script>${quickUseScript}</script>
			`);

			await page.getByRole('button', { name: '開始比對' }).click();

			await expect(page.locator('.result-card')).toHaveCount(1);
			await expect(page.locator('.result-photo-button .animal-photo-fallback')).toHaveCount(1);
			await expect(page.getByText('照片暫缺')).toHaveCount(1);
			await expect(page.getByText('No photo')).toHaveCount(0);
			await expect(page.locator('img[src*="placehold.co"]')).toHaveCount(0);
		});
	});
