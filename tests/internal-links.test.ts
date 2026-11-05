import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkInternalLinks, extractLinks, resolveTargets } from '../scripts/lib/internal-links';

const tempDirs: string[] = [];

function makeDist(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'yoto-links-'));
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

describe('extractLinks', () => {
  it('collects href and src attributes', () => {
    expect(
      extractLinks(
        '<a href="/a">x</a><script src="/b.js"></script><a href="https://example.com">y</a>',
      ),
    ).toEqual(['/a', '/b.js', 'https://example.com']);
  });
});

describe('resolveTargets', () => {
  it('maps directory routes to index.html', () => {
    expect(resolveTargets('/', '/dist')).toEqual([join('/dist', 'index.html')]);
    expect(resolveTargets('/projects/', '/dist')).toEqual([
      join('/dist', 'projects', 'index.html'),
    ]);
    expect(resolveTargets('/projects', '/dist')).toEqual([join('/dist', 'projects', 'index.html')]);
  });

  it('maps file routes to the file itself', () => {
    expect(resolveTargets('/api/catalog.json', '/dist')).toEqual([
      join('/dist', 'api/catalog.json'),
    ]);
  });
});

describe('checkInternalLinks', () => {
  it('reports missing internal links and ignores external, anchors and sibling sites', () => {
    const dir = makeDist({
      'index.html': [
        '<a href="/existing/">ok</a>',
        '<a href="/missing/">bad</a>',
        '<a href="https://example.com/">external</a>',
        '<a href="/icons-catalogue/">sibling site</a>',
        '<a href="https://yoto-community.github.io/existing/">same origin</a>',
        '<a href="#top">anchor</a>',
        '<a href="mailto:test@example.com">mail</a>',
        '<script src="/app.js"></script>',
      ].join(''),
      'existing/index.html': 'ok',
      'app.js': 'console.log(1);',
    });

    const result = checkInternalLinks(dir, 'https://yoto-community.github.io');

    expect(result.checked).toBe(4);
    expect(result.issues).toEqual([{ source: 'index.html', target: '/missing/' }]);
  });
});
