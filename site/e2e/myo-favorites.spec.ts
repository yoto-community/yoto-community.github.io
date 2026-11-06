import { expect, test } from '@playwright/test';

const TOOLKIT_KEY = 'yoto-community:toolkit:v1';
const FAVOURITES_URL = 'https://yoto-community.github.io/icons-catalogue/favorites';
const META_PATTERN = /https:\/\/yoto-community\.github\.io\/icons-catalogue\/icons\/.+\.json/;

function iconItem(index: number) {
  return {
    type: 'icon',
    id: `icon-${index}`,
    title: `Icon ${index}`,
    addedAt: '2026-11-06',
  };
}

function iconMeta(id: string) {
  return {
    id,
    source: 'yotoicons',
    title: `Title ${id}`,
    preview_image: `https://cdn.example/${id}.png`,
    download_url: `https://cdn.example/${id}.png`,
  };
}

test('shows the 12 most recent favourite icons on step 3', async ({ page }) => {
  const items = Array.from({ length: 13 }, (_, index) => iconItem(index));

  await page.addInitScript(
    ({ key, items }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, items }));
    },
    { key: TOOLKIT_KEY, items },
  );

  await page.route(META_PATTERN, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop()?.replace('.json', '') ?? '';
    await route.fulfill({ json: iconMeta(id) });
  });

  await page.goto('/myo/#step-3');

  const section = page.locator('[data-myo-favorites]');
  const tiles = section.locator('[data-myo-favorites-grid] > li');

  await expect(section).toBeVisible();
  await expect(tiles).toHaveCount(12);

  const first = tiles.first();
  await expect(first).toContainText('Title icon-12');
  await expect(first.locator('img')).toHaveAttribute('src', 'https://cdn.example/icon-12.png');
  await expect(first.locator('a')).toHaveAttribute('href', 'https://cdn.example/icon-12.png');
  await expect(first.locator('a')).toHaveAttribute('download', 'Title icon-12.png');
  await expect(first.locator('a')).toHaveAttribute('aria-label', /Download.*Title icon-12/);

  await expect(section.locator('[data-myo-favorites-all]')).toHaveAttribute('href', FAVOURITES_URL);
  await expect(section.locator('[data-myo-favorites-all]')).toContainText('13');
  await expect(tiles.last()).toContainText('Title icon-1');
});

test('hides the section when there is no favourite icon', async ({ page }) => {
  await page.goto('/myo/#step-3');

  await expect(page.locator('[data-myo-favorites]')).toBeHidden();
});

test('keeps a catalogue link when a lookup fails', async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          items: [
            {
              type: 'icon',
              id: 'broken',
              title: 'Broken icon',
              addedAt: '2026-11-06',
            },
          ],
        }),
      );
    },
    { key: TOOLKIT_KEY },
  );

  await page.route(META_PATTERN, async (route) => {
    await route.fulfill({ status: 404, body: 'not found' });
  });

  await page.goto('/myo/#step-3');

  const section = page.locator('[data-myo-favorites]');
  const tile = section.locator('[data-myo-favorites-grid] > li').first();

  await expect(section).toBeVisible();
  await expect(tile).toContainText('Broken icon');
  await expect(tile.locator('a')).toHaveAttribute('href', FAVOURITES_URL);
  await expect(tile.locator('img')).toBeHidden();
});
