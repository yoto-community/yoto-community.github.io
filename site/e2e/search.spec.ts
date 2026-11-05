import { expect, test, type Page } from '@playwright/test';

const resultPaths = async (page: Page): Promise<string[]> => {
  const links = page.locator('.pagefind-ui__result-link');
  await expect(links.first()).toBeVisible();
  return links.evaluateAll((nodes) =>
    nodes.map((node) => new URL((node as HTMLAnchorElement).href).pathname),
  );
};

test('French search returns French pages', async ({ page }) => {
  await page.goto('/fr/');
  const input = page.locator('#search input');
  await expect(input).toBeVisible();
  await input.fill('découpage');

  const paths = await resultPaths(page);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths.every((path) => path.startsWith('/fr/'))).toBe(true);
});

test('English search returns English pages', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('#search input');
  await expect(input).toBeVisible();
  await input.fill('splitting');

  const paths = await resultPaths(page);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths.every((path) => !path.startsWith('/fr/'))).toBe(true);
});
