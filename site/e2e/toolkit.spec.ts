import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const TOOLKIT_KEY = 'yoto-community:toolkit:v1';

test('adds a project to the toolkit, persists it and removes it', async ({ page }) => {
  await page.goto('/projects/');
  const card = page.locator('[data-project][data-slug="louis"]');
  const toggle = card.locator('[data-toolkit-toggle]');

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, TOOLKIT_KEY);

  expect(stored).toMatchObject({
    version: 1,
    items: [{ type: 'project', id: 'louis', title: 'Louis' }],
  });

  await page.goto('/toolkit/');
  const row = page.locator('[data-toolkit-group="project"] li').filter({ hasText: 'Louis' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Remove from toolkit/ }).click();

  await expect(page.locator('[data-toolkit-empty]')).toBeVisible();
  await expect(page.locator('[data-toolkit-group="project"]')).toBeHidden();

  await page.reload();
  await expect(page.locator('[data-toolkit-empty]')).toBeVisible();
});



test('syncs the toolkit between two tabs', async ({ context, page }) => {
  const other = await context.newPage();
  await other.goto('/toolkit/');
  await page.goto('/projects/');

  await page.locator('[data-project][data-slug="louis"] [data-toolkit-toggle]').click();

  await expect(other.locator('[data-toolkit-group="project"] li')).toHaveCount(1);
  await expect(other.locator('[data-toolkit-group="project"] li')).toContainText('Louis');
});

test('exports and imports the toolkit JSON', async ({ page }) => {
  await page.goto('/toolkit/');
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        items: [
          {
            type: 'project',
            id: 'louis',
            title: 'Louis',
            addedAt: '2026-11-06',
          },
        ],
      }),
    );
  }, TOOLKIT_KEY);
  await page.reload();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path as string, 'utf8'));
  expect(exported).toEqual({
    version: 1,
    items: [{ type: 'project', id: 'louis', title: 'Louis', addedAt: '2026-11-06' }],
  });

  await page.locator('[data-toolkit-import]').setInputFiles({
    name: 'toolkit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        items: [
          {
            type: 'podcast',
            id: 'une-histoire',
            title: 'Une histoire',
            addedAt: '2026-11-06',
          },
        ],
      }),
    ),
  });

  await expect(page.getByText('Toolkit imported.')).toBeVisible();
  await expect(page.locator('[data-toolkit-group="podcast"] li')).toContainText('Une histoire');
  await expect(page.locator('[data-toolkit-group="project"] li')).toContainText('Louis');
});

test('applies shared theme and language preferences', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'yoto-community:prefs:v1',
      JSON.stringify({ version: 1, theme: 'dark', locale: 'fr' }),
    );
  });
  await page.reload();

  await expect(page).toHaveURL(/\/fr\/$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const english = page.getByRole('link', { name: 'English version' });
  await english.evaluate((element) =>
    element.addEventListener('click', (event) => event.preventDefault(), { once: true }),
  );
  await english.click();
  await expect(page).toHaveURL(/\/fr\/$/);

  const prefs = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('yoto-community:prefs:v1') ?? '{}'),
  );
  expect(prefs).toMatchObject({ version: 1, theme: 'dark', locale: 'en' });
});

test('mirrors legacy favourites without modifying their keys', async ({ page }) => {
  await page.goto('/toolkit/');
  await page.evaluate(() => {
    localStorage.removeItem('yoto-community:toolkit:v1');
    localStorage.setItem('yoto-icons-favorites', JSON.stringify(['icon-a']));
  });
  await page.reload();

  const icon = page.locator('[data-toolkit-group="icon"] li');
  await expect(icon).toHaveCount(1);
  await icon.getByRole('button', { name: /Remove from toolkit/ }).click();

  await expect(page.locator('[data-toolkit-group="icon"]')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('yoto-icons-favorites'))).toBe(
    JSON.stringify(['icon-a']),
  );
});
