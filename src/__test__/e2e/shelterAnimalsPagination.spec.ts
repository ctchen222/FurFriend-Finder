import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const viewPath = path.resolve(__dirname, '../../../views/shelter-animals.ejs');
const commonPath = path.resolve(__dirname, '../../public/js/common.js');

function animal(id: number) {
  return {
    id,
    kind: '狗',
    variety: `測試品種 ${id}`,
    sex: 'M',
    colour: '棕色',
    picture: id === 1 ? '/broken-animal-photo.jpg' : '',
    shelter_name: `測試收容所 ${id}`,
  };
}

function extractShelterAnimalsScript() {
  const view = fs.readFileSync(viewPath, 'utf8');
  const match = view.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('shelter-animals.ejs script block not found');
  return match[1];
}

test('shelter animals pagination disables previous after returning to first page', async ({ page }) => {
  const script = extractShelterAnimalsScript();
  const commonScript = fs.readFileSync(commonPath, 'utf8');
  const requests: string[] = [];

  await page.route('**/broken-animal-photo.jpg', async (route) => {
    await route.abort();
  });

  await page.route('**/api/animals**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);
    const cursor = url.searchParams.get('cursor');
    const isSecondPage = cursor === 'cursor-page-2';

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        extras: {
          animals: Array.from({ length: 12 }, (_, i) =>
            animal((isSecondPage ? 100 : 0) + i + 1),
          ),
          cursors: {
            prevCursor: 'api-prev-cursor-should-not-enable-first-page',
            nextCursor: isSecondPage ? 'cursor-page-3' : 'cursor-page-2',
          },
        },
      }),
    });
  });

  await page.setContent(`
    <base href="http://localhost/">
    <main>
      <select id="filter-kind"><option value="">全部</option></select>
      <select id="filter-sex"><option value="">全部</option></select>
      <input id="filter-city" />
      <button id="filterBtn">搜尋</button>
      <button id="resetBtn">重置</button>
      <p id="result-info"></p>
      <div id="active-filters"></div>
      <div id="animal-grid"></div>
      <div id="pagination-controls">
        <button id="prev-page" disabled>上一頁</button>
        <button id="next-page" disabled>下一頁</button>
      </div>
    </main>
    <script>${commonScript}</script>
    <script>${script}</script>
  `);

  const prevButton = page.locator('#prev-page');
  const nextButton = page.locator('#next-page');

  await expect(page.locator('.animal-card')).toHaveCount(12);
  await expect(page.locator('.animal-card-photo .animal-photo-fallback')).toHaveCount(12);
  await expect(page.getByText('No photo')).toHaveCount(0);
  await expect(page.locator('img[src*="placehold.co"]')).toHaveCount(0);
  await expect(prevButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();
  expect(requests).toEqual(['/api/animals?pageSize=12']);

  await nextButton.click();

  await expect(page.locator('.animal-card-title').first()).toContainText('測試品種 101');
  await expect(prevButton).toBeEnabled();
  await expect(nextButton).toBeEnabled();
  expect(requests).toEqual([
    '/api/animals?pageSize=12',
    '/api/animals?pageSize=12&cursor=cursor-page-2',
  ]);

  await prevButton.click();

  await expect(page.locator('.animal-card-title').first()).toContainText('測試品種 1');
  await expect(prevButton).toBeDisabled();
  await expect(nextButton).toBeEnabled();
  expect(requests).toEqual([
    '/api/animals?pageSize=12',
    '/api/animals?pageSize=12&cursor=cursor-page-2',
    '/api/animals?pageSize=12',
  ]);
});
