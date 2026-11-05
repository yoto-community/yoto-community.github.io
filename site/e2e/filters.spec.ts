import { expect, test } from '@playwright/test';

test('filters update the URL and the visible cards', async ({ page }) => {
  await page.goto('/projects/');
  const count = page.locator('[data-count]');
  await expect(count).toHaveText(/^\s*\d+ projects\s*$/);

  await page.getByLabel('Category').selectOption('create');
  await expect(page).toHaveURL(/\?cat=create/);
  const countText = await page.locator('[data-count]').textContent();
  const expected = Number(countText?.match(/\d+/)?.[0]);
  await expect(page.locator('[data-project]:visible')).toHaveCount(expected);
  await expect(page.locator('[data-project][data-category="official"]:visible')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).not.toHaveURL(/cat=/);
});

test('inactive projects are hidden by default and can be shown', async ({ page }) => {
  await page.goto('/projects/');
  const stale = page.locator('[data-project][data-slug="yoto-music"]');

  await expect(stale).toBeHidden();
  await page.getByLabel('Show inactive projects').check();
  await expect(stale).toBeVisible();
  await expect(page).toHaveURL(/inactive=1/);
});

test('category pages hide inactive projects with the same toggle', async ({ page }) => {
  await page.goto('/categories/backup/');
  const stale = page.locator('[data-project][data-slug="yoto-backup"]');

  await expect(stale).toBeHidden();
  await page.getByLabel('Show inactive projects').check();
  await expect(stale).toBeVisible();
  await expect(page).toHaveURL(/inactive=1/);
});
