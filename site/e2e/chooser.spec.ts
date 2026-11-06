import { expect, test } from '@playwright/test';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('keeps the static tool list and the goal filter links usable', async ({ page }) => {
    await page.goto('/chooser/');
    await expect(page.getByRole('heading', { name: 'Which tool is right for me?' })).toBeVisible();
    await expect(page.locator('[data-creation-tools] a', { hasText: 'Louis' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Turn YouTube into a card' }).first(),
    ).toHaveAttribute('href', '/projects/?cat=create&tag=youtube');
  });

  test('submits the three answers as a GET form', async ({ page }) => {
    await page.goto('/chooser/');
    await page.getByRole('radio', { name: 'Turn YouTube into a card' }).check();
    await page.getByRole('radio', { name: 'macOS' }).check();
    await page.getByRole('radio', { name: 'I don’t want to install anything' }).check();
    await page.getByRole('button', { name: 'See my result' }).click();
    await expect(page).toHaveURL(/goal=youtube/);
    await expect(page).toHaveURL(/platform=macos/);
    await expect(page).toHaveURL(/level=simple/);
  });
});

test('MYO step anchors clear the sticky header', async ({ page }) => {
  // global.css smooth-scrolls fragments, which would still be animating when the
  // assertion runs (and measure the element far below the header). The site turns
  // that off under prefers-reduced-motion, so emulate it for an instant scroll.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/myo/#step-3');
  const top = await page
    .locator('#step-3')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(72);
});

test('renders results from a shared URL and keeps the answers checked', async ({ page }) => {
  await page.goto('/chooser/?goal=youtube&platform=macos&level=simple');
  await expect(page.locator('[data-results] li').first()).toContainText('Louis');
  await expect(page.locator('input[name="goal"]:checked')).toHaveValue('youtube');
  await expect(page.locator('input[name="platform"]:checked')).toHaveValue('macos');
  await expect(page.locator('input[name="level"]:checked')).toHaveValue('simple');
});

test('three clicks update the URL and the results without a reload', async ({ page }) => {
  await page.goto('/chooser/');
  await page.getByRole('radio', { name: 'Turn YouTube into a card' }).check();
  await page.getByRole('radio', { name: 'macOS' }).check();
  await page.getByRole('radio', { name: 'I don’t want to install anything' }).check();

  await expect(page).toHaveURL(/goal=youtube/);
  await expect(page).toHaveURL(/platform=macos/);
  await expect(page).toHaveURL(/level=simple/);

  const first = page.locator('[data-results] li').first();
  await expect(first).toContainText('Louis');
  await expect(first).toContainText('Best match');
  await expect(first.locator('[data-reasons] li')).toHaveCount(3);

  await expect(page.locator('[data-results-status]')).toContainText('3 results');
  await expect(page.locator('[data-results-status]')).toContainText('Best match: Louis');

  await page.reload();
  await expect(page.locator('[data-results] li').first()).toContainText('Louis');
});
