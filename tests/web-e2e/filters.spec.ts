import { expect, test } from '@playwright/test';

test('species, sex and city filters are retained across cursor pages and clearing', async ({ page }) => {
    await page.goto('/shelter-animals');
    await page.getByRole('combobox', { name: '物種', exact: true }).selectOption('貓');
    await page.getByRole('combobox', { name: '性別', exact: true }).selectOption('F');
    await page.getByLabel('縣市／地址').fill('臺北市');
    const firstResponse = page.waitForResponse(response => response.url().includes('/api/animals?') && response.url().includes('kind='));
    await page.getByRole('button', { name: '查詢', exact: true }).click();
    const first = (await (await firstResponse).json()).extras;
    expect(first.animals).toHaveLength(12);
    expect(first.animals.every((animal: any) => animal.kind === '貓' && animal.sex === 'F' && animal.shelter_address.includes('臺北市'))).toBe(true);
    const nextResponse = page.waitForResponse(response => response.url().includes('/api/animals?') && response.url().includes('cursor='));
    await page.getByRole('button', { name: '下一頁' }).click();
    const next = (await (await nextResponse).json()).extras;
    expect(next.animals.length).toBeGreaterThan(0);
    expect(next.animals.every((animal: any) => animal.kind === '貓' && animal.sex === 'F' && animal.shelter_address.includes('臺北市'))).toBe(true);
    expect(next.animals.some((animal: any) => first.animals.some((previous: any) => previous.id === animal.id))).toBe(false);
    const previousResponse = page.waitForResponse(response => response.url().includes('/api/animals?') && !response.url().includes('cursor='));
    await page.getByRole('button', { name: '上一頁', exact: true }).click();
    const previous = (await (await previousResponse).json()).extras;
    expect(previous.animals.map((animal: any) => animal.id)).toEqual(first.animals.map((animal: any) => animal.id));
    await page.getByRole('link', { name: '清除條件，回到第一頁' }).click();
    await expect(page.getByRole('combobox', { name: '物種', exact: true })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: '性別', exact: true })).toHaveValue('');
    await expect(page.getByLabel('縣市／地址')).toHaveValue('');
});
