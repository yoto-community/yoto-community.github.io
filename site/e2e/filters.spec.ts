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
