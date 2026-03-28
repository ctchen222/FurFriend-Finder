import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, './../../../.test.env') });

let API_URL: string;
let TEST_EMAIL: string;
let TEST_PASSWORD: string;

test.describe('Authentication', () => {
	test.beforeAll(async () => {
		if (!process.env.API_URL) {
			throw new Error('API_URL is not set in environment variables');
		}
		if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
			throw new Error('TEST_EMAIL or TEST_PASSWORD is not set in environment variables');
		}
		API_URL = process.env.API_URL;
		TEST_EMAIL = process.env.TEST_EMAIL;
		TEST_PASSWORD = process.env.TEST_PASSWORD;
	})

	test('User Login', async ({ page }) => {
		if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
			throw new Error('TEST_EMAIL or TEST_PASSWORD is not set in environment variables');
		}
		await page.goto(`${API_URL}/login`);
		await page.getByLabel('Email').fill(TEST_EMAIL);
		await page.getByLabel('密碼').fill(TEST_PASSWORD);
		await page.getByRole('button', { name: '登入' }).click();
		await expect(page).toHaveURL(`${API_URL}/`);
		await expect(page.locator('body')).toContainText('登入成功！');
	});
	test('User Logout', async ({ page }) => {
		await page.goto(`${API_URL}/login`);
		await page.getByLabel('Email').fill(TEST_EMAIL);
		await page.getByLabel('密碼').fill(TEST_PASSWORD);
		await page.getByRole('button', { name: '登入' }).click();
		await page.getByRole('link', { name: '登出' }).click();
		await expect(page).toHaveURL(`${API_URL}/`);
		await expect(page.getByRole('link', { name: '登入' })).toBeVisible();
	});
});
