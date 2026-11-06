import { expect, test } from '@playwright/test';

const CELLS = 16 * 16;

test.describe('track icon editor', () => {
  test('paints a pixel and turns the Yoto advice into live checks', async ({ page }) => {
    await page.goto('/editor/');
    await expect(page.locator('.ie-cell')).toHaveCount(CELLS);

    // The default colour is pure black, which the editor must flag.
    await page.locator('.ie-cell').first().click();
    await expect(page.locator('[data-checks] li.is-warn')).toContainText('Pure black');

    // A white pixel is readable on the dark player background.
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.getByRole('button', { name: '#ffffff' }).click();
    await page.locator('.ie-cell').first().click();
    await expect(page.locator('[data-checks] li.is-ok')).toContainText('Ready for a track');
  });

  test('downloads a 16×16 PNG', async ({ page }) => {
    await page.goto('/editor/');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download the PNG' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('yoto-track-icon.png');
  });

  test('paints with the keyboard and keeps the draft across reloads', async ({ page }) => {
    await page.goto('/editor/');
    await page.locator('.ie-cell').first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('awesome-yoto:track-icon-draft')))
      .toContain('"g"');

    await page.reload();
    await expect(page.locator('.ie-cell').nth(1)).not.toHaveAttribute('aria-label', /empty/);
  });
});
