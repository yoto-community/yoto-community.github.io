import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createLoader } from '../scripts/lib/load';

const load = createLoader();

const tempDirs: string[] = [];

function makeDataDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'yoto-loader-'));
  tempDirs.push(dir);
  for (const [file, contents] of Object.entries(files)) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('loader', () => {
  it('loads the nine categories sorted by order', () => {
    const categories = load.categories();
    expect(categories).toHaveLength(9);
    expect(categories.map((category) => category.slug)).toEqual([
      'official',
      'create',
      'icons',
      'audio',
      'automate',
      'develop',
      'backup',
      'hardware',
      'learn',
    ]);
  });

  it('loads the controlled tag vocabulary', () => {
    expect(load.tags()).toHaveLength(28);
    expect(load.tags()).toContain('home-assistant');
    expect(load.tags()).toContain('pixel-art');
  });

  it('loads the myo-journey collection', () => {
    expect(load.collections().map((collection) => collection.slug)).toContain('myo-journey');
  });

  it('loads projects with a slug derived from the file name', () => {
    const projects = load.projects();
    const louis = projects.find((project) => project.slug === 'louis');
    expect(louis?.name).toBe('Louis');
    expect(louis?.category).toBe('create');
  });

  it('has at least 18 projects covering all nine categories', () => {
    const projects = load.projects();
    expect(projects.length).toBeGreaterThanOrEqual(18);
    expect(new Set(projects.map((project) => project.category)).size).toBe(9);
  });

  // This test was moved to the temp directory test suite to better isolate default behavior
});

describe('loader with a custom base directory', () => {
  it('reads the referentials and projects from that directory', () => {
    const dir = makeDataDir({
      'categories.yml': '- slug: second\n  order: 20\n- slug: first\n  order: 10\n',
      'tags.yml': '- custom-tag\n',
      'collections.yml': '[]\n',
      'projects/fixture.yml': 'name: Fixture\n',
    });

    const loader = createLoader(dir);

    expect(loader.categories().map((category) => category.slug)).toEqual(['first', 'second']);
    expect(loader.tags()).toEqual(['custom-tag']);
    expect(loader.collections()).toEqual([]);
    expect(loader.projects().map((project) => project.slug)).toEqual(['fixture']);
    expect(loader.errors()).toEqual([]);
  });

  it('reports a malformed project file with its relative path and keeps the rest', () => {
    const dir = makeDataDir({
      'projects/broken.yml': 'name: [unclosed\n',
      'projects/valid.yml': 'name: Valid\n',
    });

    const loader = createLoader(dir);
    const files = loader.projectFiles();

    expect(files.map((file) => file.slug)).toEqual(['valid']);
    expect(loader.errors()).toHaveLength(1);
    expect(loader.errors().join('\n')).toContain('projects/broken.yml');
  });

  it('returns empty meta when .meta.json is absent (in temp directory)', () => {
    const dir = makeDataDir({});
    const loader = createLoader(dir);
    expect(loader.meta()).toEqual({ updatedAt: '', projects: {} });
  });

  it('handles a corrupt .meta.json gracefully', () => {
    const dir = makeDataDir({
      '.meta.json': '{ invalid json }',
    });
    const loader = createLoader(dir);
    expect(loader.meta()).toEqual({ updatedAt: '', projects: {} });
  });
});
