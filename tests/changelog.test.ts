import { describe, expect, it } from 'vitest';
import { fallbackEntries, parseGitLog } from '../scripts/lib/changelog';

const raw = [
  '\x1eabc123\x1f2026-11-05T10:00:00+01:00\x1ffeat: add louis',
  'data/projects/louis.yml',
  'data/collections.yml',
  '\x1edef456\x1f2026-11-04T10:00:00+01:00\x1fchore: update tags',
  'data/tags.yml',
].join('\n');

describe('parseGitLog', () => {
  it('maps commits to changed projects and referential areas', () => {
    const entries = parseGitLog(raw);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: 'abc123',
      title: 'feat: add louis',
      projects: ['louis'],
      areas: ['collections'],
    });
    expect(entries[1]).toMatchObject({
      id: 'def456',
      title: 'chore: update tags',
      projects: [],
      areas: ['tags'],
    });
  });

  it('ignores records without a project or referential change', () => {
    expect(parseGitLog('\x1eabc\x1f2026-11-05T10:00:00Z\x1fdocs: nothing\nREADME.md')).toEqual([]);
  });

  it('ignores malformed headers', () => {
    expect(parseGitLog('\x1enot-a-header\ndata/projects/louis.yml')).toEqual([]);
  });
});

describe('fallbackEntries', () => {
  it('groups projects by added date, newest first', () => {
    const entries = fallbackEntries([
      { slug: 'b', added: '2026-11-03' },
      { slug: 'a', added: '2026-11-03' },
      { slug: 'c', added: '2026-10-01' },
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: 'added-2026-11-03',
      date: '2026-11-03T12:00:00.000Z',
      title: 'Add 2 projects',
      projects: ['a', 'b'],
      areas: [],
    });
    expect(entries[1]).toMatchObject({
      id: 'added-2026-10-01',
      title: 'Add 1 project',
      projects: ['c'],
    });
  });
});
