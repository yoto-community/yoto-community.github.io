import { describe, expect, it } from 'vitest';
import { createLoader } from '../scripts/lib/load';

const load = createLoader();
const projects = load.projects();

describe('content', () => {
  it('lists at least 55 projects', () => {
    expect(projects.length).toBeGreaterThanOrEqual(55);
  });

  it('covers every category with at least two projects', () => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      counts.set(project.category, (counts.get(project.category) ?? 0) + 1);
    }
    for (const category of load.categories()) {
      expect(counts.get(category.slug) ?? 0, category.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('writes one factual sentence per description', () => {
    for (const project of projects) {
      expect(project.description.trim(), project.slug).toMatch(/[.!]$/);
      expect(project.description.length, project.slug).toBeGreaterThanOrEqual(20);
      expect(project.description.length, project.slug).toBeLessThanOrEqual(180);
    }
  });

  it('provides a French description for every project', () => {
    for (const project of projects) {
      expect(project.descriptionFr, project.slug).toBeTruthy();
      expect(project.descriptionFr?.trim().length, project.slug).toBeGreaterThanOrEqual(20);
      expect(project.descriptionFr?.trim().length, project.slug).toBeLessThanOrEqual(180);
    }
  });

  it('marks deprecated projects with a replacement', () => {
    for (const project of projects.filter((item) => item.status === 'deprecated')) {
      expect(project.deprecatedBy, project.slug).toBeTruthy();
    }
  });

  it('features editor picks with an English and French reason', () => {
    const featured = projects.filter((project) => project.featured);
    expect(featured.length).toBeGreaterThanOrEqual(3);
    for (const project of featured) {
      expect(project.featuredReason, project.slug).toBeTruthy();
      expect(project.featuredReasonFr, project.slug).toBeTruthy();
    }
  });
});
