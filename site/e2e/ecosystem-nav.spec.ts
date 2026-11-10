import { expect, test } from '@playwright/test';

test('the community bar links to the three sites in the same tab', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Community sites' });
  await expect(nav.getByRole('link', { name: 'Awesome Yoto' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  const icons = nav.getByRole('link', { name: 'Icon catalogue' });
  await expect(icons).toHaveAttribute('href', 'https://yoto-community.github.io/icons-catalogue/');
  await expect(icons).not.toHaveAttribute('target');

  const podcasts = nav.getByRole('link', { name: 'Podcast directory' });
  await expect(podcasts).toHaveAttribute(
    'href',
    'https://yoto-community.github.io/podcast-catalogue/en/',
  );
  await expect(podcasts).not.toHaveAttribute('target');
});

test('the French community bar links to the French sibling sites', async ({ page }) => {
  await page.goto('/fr/');

  const nav = page.getByRole('navigation', { name: 'Sites de la communauté' });
  await expect(nav.getByRole('link', { name: 'Awesome Yoto' })).toHaveAttribute('href', '/fr/');
  await expect(nav.getByRole('link', { name: 'Annuaire de podcasts' })).toHaveAttribute(
    'href',
    'https://yoto-community.github.io/podcast-catalogue/fr/',
  );
});

test('renders a single header bar with community and app navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('header .yc-header__inner')).toHaveCount(1);
  await expect(page.locator('.app-bar')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Community sites' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});

test('keeps one bar on mobile and moves the community links into the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');

  await expect(page.locator('.yc-nav')).toBeHidden();
  await expect(page.locator('.mobile-menu')).toBeVisible();
  await expect(
    page.locator('.mobile-menu').getByRole('link', { name: 'Icon catalogue' }),
  ).toBeHidden();

  await page.locator('.mobile-menu summary').click();

  await expect(
    page.locator('.mobile-menu').getByRole('link', { name: 'Icon catalogue' }),
  ).toBeVisible();
});
