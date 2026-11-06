import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const paths = [
  '/',
  '/projects/',
  '/p/louis/',
  '/fr/',
  '/fr/projects/',
  '/myo/',
  '/editor/',
  '/fr/editor/',
  '/changelog/',
  '/fr/changelog/',
  '/chooser/',
  '/fr/chooser/',
];

for (const path of paths) {
  test(`no serious accessibility violation on ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `GET ${path}`).toBe(200);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      blocking,
      JSON.stringify(
        blocking.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target),
        })),
      ),
    ).toEqual([]);
  });
}
