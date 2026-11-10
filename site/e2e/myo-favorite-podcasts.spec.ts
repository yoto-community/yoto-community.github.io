import { expect, test, type Page } from '@playwright/test';

const TOOLKIT_KEY = 'yoto-community:toolkit:v1';
const MANIFEST_PATTERN =
  /^https:\/\/yoto-community\.github\.io\/podcast-catalogue\/api\/catalog\.json$/;
const LANGUAGE_PATTERN =
  /^https:\/\/yoto-community\.github\.io\/podcast-catalogue\/api\/catalog\/[a-z-]+\.json$/;
const FAVOURITES_URL = 'https://yoto-community.github.io/podcast-catalogue/en/favorites/';
const ENTRY_BASE = 'https://yoto-community.github.io/podcast-catalogue/en/age-2-5/';

function podcastItem(index: number) {
  return {
    type: 'podcast',
    id: `podcast-${index}`,
    title: `Podcast ${index}`,
    addedAt: '2026-11-06',
  };
}

function podcastEntry(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    name: `Podcast ${slug}`,
    groupSlug: 'age-2-5',
    imageUrl: `https://cdn.example/${slug}.jpg`,
    ...overrides,
  };
}

async function routeCatalogue(page: Page, entries: unknown[]): Promise<void> {
  await page.route(MANIFEST_PATTERN, async (route) => {
    await route.fulfill({ json: { languages: [{ code: 'en' }] } });
  });
  await page.route(LANGUAGE_PATTERN, async (route) => {
    await route.fulfill({ json: { shards: [{ groupSlug: 'age-2-5', entries }] } });
  });
}

test('shows the 12 most recent favourite podcasts on step 1', async ({ page }) => {
  const items = Array.from({ length: 13 }, (_, index) => podcastItem(index));

  await page.addInitScript(
    ({ key, items }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, items }));
    },
    { key: TOOLKIT_KEY, items },
  );

  await routeCatalogue(
    page,
    items.map((item) => podcastEntry(item.id)),
  );

  await page.goto('/myo/#step-1');

  const section = page.locator('[data-myo-favorite-podcasts]');
  const tiles = section.locator('[data-myo-podcast-grid] > li');

  await expect(section).toBeVisible();
  await expect(tiles).toHaveCount(12);

  const first = tiles.first();
  await expect(first).toContainText('Podcast podcast-12');
  await expect(first.locator('img')).toHaveAttribute('src', 'https://cdn.example/podcast-12.jpg');
  await expect(first.locator('a')).toHaveAttribute('href', `${ENTRY_BASE}podcast-12/`);
  await expect(first.locator('a')).toHaveAttribute('aria-label', /View the podcast.*podcast-12/);

  await expect(section.locator('[data-myo-podcast-all]')).toHaveAttribute('href', FAVOURITES_URL);
  await expect(section.locator('[data-myo-podcast-all]')).toContainText('13');
  await expect(tiles.last()).toContainText('Podcast podcast-1');
});

test('hides the section when there is no favourite podcast', async ({ page }) => {
  await page.goto('/myo/#step-1');

  await expect(page.locator('[data-myo-favorite-podcasts]')).toBeHidden();
});

test('falls back to the catalogue favourites when the toolkit only holds projects', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, legacyKey }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          items: [{ type: 'project', id: 'louis', title: 'Louis', addedAt: '2026-11-06' }],
        }),
      );
      localStorage.setItem(legacyKey, JSON.stringify(['legacy-podcast']));
    },
    { key: TOOLKIT_KEY, legacyKey: 'yoto-favorites' },
  );

  await routeCatalogue(page, [podcastEntry('legacy-podcast')]);

  await page.goto('/myo/#step-1');

  const section = page.locator('[data-myo-favorite-podcasts]');
  const tiles = section.locator('[data-myo-podcast-grid] > li');

  await expect(section).toBeVisible();
  await expect(tiles).toHaveCount(1);
  await expect(tiles.first()).toContainText('Podcast legacy-podcast');
  await expect(section.locator('[data-myo-podcast-all]')).toContainText('1');
});

test('keeps a catalogue link and the toolkit title when the lookup fails', async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          items: [
            {
              type: 'podcast',
              id: 'broken',
              title: 'Broken podcast',
              addedAt: '2026-11-06',
            },
          ],
        }),
      );
    },
    { key: TOOLKIT_KEY },
  );

  await page.route(MANIFEST_PATTERN, async (route) => {
    await route.fulfill({ status: 404, body: 'not found' });
  });

  await page.goto('/myo/#step-1');

  const section = page.locator('[data-myo-favorite-podcasts]');
  const tile = section.locator('[data-myo-podcast-grid] > li').first();

  await expect(section).toBeVisible();
  await expect(tile).toContainText('Broken podcast');
  await expect(tile.locator('a')).toHaveAttribute('href', FAVOURITES_URL);
  await expect(tile.locator('img')).toBeHidden();
  await expect(section.locator('[data-myo-podcast-status]')).toBeVisible();
});

test('shows the first letter when a cover is missing', async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          items: [
            {
              type: 'podcast',
              id: 'sans-cover',
              title: 'Sans cover',
              addedAt: '2026-11-06',
            },
          ],
        }),
      );
    },
    { key: TOOLKIT_KEY },
  );

  await routeCatalogue(page, [podcastEntry('sans-cover', { imageUrl: '' })]);

  await page.goto('/myo/#step-1');

  const tile = page.locator('[data-myo-podcast-grid] > li').first();

  await expect(tile).toContainText('Podcast sans-cover');
  await expect(tile.locator('.myo-podcast-thumb-initial')).toBeVisible();
  await expect(tile.locator('.myo-podcast-thumb-initial')).toHaveText('P');
  await expect(tile.locator('img')).toBeHidden();
});
