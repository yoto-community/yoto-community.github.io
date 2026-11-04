import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../scripts/lib/catalog';
import { createLoader } from '../scripts/lib/load';

const load = createLoader();

describe('buildCatalog', () => {
  it('exposes a versioned, stable shape', () => {
    const catalog = buildCatalog({
      categories: load.categories(),
      projects: load.projects(),
      tags: load.tags(),
      collections: load.collections(),
    });
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.projects.length).toBeGreaterThanOrEqual(55);
    expect(catalog.categories).toHaveLength(9);
    expect(catalog.projects[0]).toHaveProperty('slug');
  });

  it('never leaks the meta file shape', () => {
    const catalog = buildCatalog({
      categories: load.categories(),
      projects: load.projects(),
      tags: load.tags(),
      collections: load.collections(),
    });
    expect(JSON.stringify(catalog)).not.toContain('updatedAt');
  });
});
