import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, './../../../.test.env') });

let API_URL: string;

test.describe('Basic Navigation', () => {
	test.beforeAll(async () => {
		if (!process.env.API_URL) {
			throw new Error('API_URL is not set in environment variables');
		}
		if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
			throw new Error('TEST_EMAIL or TEST_PASSWORD is not set in environment variables');
		}
		API_URL = process.env.API_URL;
	})
	test('Navigate to Home Page', async ({ page }) => {
		await page.goto(`${API_URL}`);
		await expect(page).toHaveTitle('首頁 - FurFriend Finder');
		await expect(page.locator('h1')).toContainText('🐾 FurFriend Finder 🐾');
	});

	test('Navigate to Shelter Animal Page', async ({ page }) => {
		await page.goto(`${API_URL}`);
		await page.getByRole('link', { name: '收容所動物' }).click();
		await expect(page).toHaveURL(`${API_URL}/shelter-animals`);
		await expect(page.locator('h1')).toContainText('收容所動物列表');
	});

	test('Navigate to Report Lost Page', async ({ page }) => {
		await page.goto(`${API_URL}/`);
		await page.getByRole('link', { name: '協尋登記', exact: true }).click();
		await expect(page).toHaveURL(`${API_URL}/report-lost`);
		await expect(page.locator('h1')).toContainText('協尋寵物資料登記');
	});

	test('Navigate to Login Page', async ({ page }) => {
		await page.goto(`${API_URL}`);
		await page.getByRole('link', { name: '登入' }).click();
		await expect(page).toHaveURL(`${API_URL}/login`);
		await expect(page.locator('h1')).toContainText('登入 FurFriend Finder');
	});

	test('Navigate to Register Page', async ({ page }) => {
		await page.goto(`${API_URL}/login`);
		await page.getByRole('link', { name: '點此註冊' }).click();
		await expect(page).toHaveURL(`${API_URL}/register`);
		await expect(page.locator('h1')).toContainText('註冊新帳號');
	});
});
