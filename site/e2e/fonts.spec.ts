import { expect, test } from '@playwright/test';

test('loads at most the Latin font subsets', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.woff2')) fontRequests.push(request.url());
  });

  await page.goto('/');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.length).toBeLessThanOrEqual(2);

  const families = await page.evaluate(() => [...document.fonts].map((font) => font.family));
  expect(families.some((family) => family.includes('Nunito Variable'))).toBe(true);
});
