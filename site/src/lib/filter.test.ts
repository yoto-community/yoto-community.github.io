import { describe, expect, it } from 'vitest';
import {
  filterProjects,
  parseFilters,
  serializeFilters,
  sortProjects,
  type FilterState,
} from './filter';
import type { Project } from '../../../scripts/lib/types';

const projects = [
  {
    slug: 'old',
    name: 'Old tool',
    url: 'https://c.example',
    category: 'create',
    description: 'An old tool.',
    tags: ['cli'],
    author: 'B',
    license: 'MIT',
    status: 'stale',
    official: false,
    platforms: ['cli'],
    added: '2025-01-01',
  },
  {
    slug: 'yoto',
    name: 'Yoto',
    url: 'https://b.example',
    category: 'official',
    description: 'The official app.',
    tags: ['kids'],
    author: 'Yoto',
    license: 'Proprietary',
    status: 'active',
    official: true,
    platforms: ['web', 'ios'],
    added: '2026-10-01',
    meta: { stars: 5 },
  },
  {
    slug: 'louis',
    name: 'Louis',
    url: 'https://a.example',
    category: 'create',
    description: 'Turn YouTube into a card.',
    descriptionFr: 'Transforme YouTube en carte.',
    tags: ['youtube', 'web'],
    author: 'A',
    license: 'MIT',
    status: 'active',
    official: false,
    platforms: ['web'],
    added: '2026-11-01',
    meta: { stars: 50 },
  },
] as Project[];

const empty: FilterState = {
  q: '',
  category: '',
  status: '',
  platform: '',
  tag: '',
  official: false,
  french: false,
  inactive: false,
  sort: 'category',
};

describe('parseFilters', () => {
  it('reads every supported parameter', () => {
    const state = parseFilters(
      '?q=you&cat=create&status=active&platform=web&tag=youtube&official=1&fr=1&inactive=1&sort=stars',
    );
    expect(state).toEqual({
      q: 'you',
      category: 'create',
      status: 'active',
      platform: 'web',
      tag: 'youtube',
      official: true,
      french: true,
      inactive: true,
      sort: 'stars',
    });
  });

  it('ignores unknown sort values', () => {
    expect(parseFilters('?sort=nope').sort).toBe('category');
  });
});

describe('serializeFilters', () => {
  it('omits empty values', () => {
    expect(serializeFilters(empty)).toBe('');
  });

  it('round-trips a non-empty state', () => {
    const state = {
      ...empty,
      q: 'you',
      category: 'create',
      official: true,
      inactive: true,
      sort: 'recent' as const,
    };
    expect(parseFilters(`?${serializeFilters(state)}`)).toEqual(state);
  });
});

describe('filterProjects', () => {
  it('matches text against name and descriptions', () => {
    expect(filterProjects(projects, { ...empty, q: 'youtube' }).map((p) => p.slug)).toEqual([
      'louis',
    ]);
    expect(filterProjects(projects, { ...empty, q: 'officiel' })).toEqual([]);
  });

  it('matches accented text without typing the diacritics', () => {
    const accented = [
      {
        ...projects[2],
        slug: 'icones',
        name: 'Icônes',
        description: 'Icônes 16x16 pour les cartes Yoto.',
        descriptionFr: 'Icônes 16x16 pour les cartes Yoto.',
      },
    ] as Project[];

    expect(filterProjects(accented, { ...empty, q: 'icones' }).map((p) => p.slug)).toEqual([
      'icones',
    ]);
    expect(filterProjects(accented, { ...empty, q: 'ICÔNES' }).map((p) => p.slug)).toEqual([
      'icones',
    ]);
  });

  it('combines category, status, platform and tag', () => {
    expect(
      filterProjects(projects, { ...empty, category: 'create', status: 'active' }).map(
        (p) => p.slug,
      ),
    ).toEqual(['louis']);
    expect(
      filterProjects(projects, { ...empty, platform: 'cli', status: 'stale' }).map((p) => p.slug),
    ).toEqual(['old']);
    expect(filterProjects(projects, { ...empty, tag: 'youtube' }).map((p) => p.slug)).toEqual([
      'louis',
    ]);
  });

  it('hides stale, archived and deprecated projects when no status is selected', () => {
    const extended = [
      ...projects,
      { ...projects[0], slug: 'archived', status: 'archived' },
      { ...projects[0], slug: 'deprecated', status: 'deprecated' },
    ] as Project[];

    expect(filterProjects(extended, empty).map((p) => p.slug)).toEqual(['yoto', 'louis']);
    expect(filterProjects(extended, { ...empty, status: 'stale' }).map((p) => p.slug)).toEqual([
      'old',
    ]);
    expect(filterProjects(extended, { ...empty, status: 'archived' }).map((p) => p.slug)).toEqual([
      'archived',
    ]);
    expect(filterProjects(extended, { ...empty, status: 'deprecated' }).map((p) => p.slug)).toEqual(
      ['deprecated'],
    );
  });

  it('shows inactive projects when the toggle is enabled', () => {
    const extended = [
      ...projects,
      { ...projects[0], slug: 'archived', status: 'archived' },
      { ...projects[0], slug: 'deprecated', status: 'deprecated' },
    ] as Project[];

    expect(filterProjects(extended, { ...empty, inactive: true }).map((p) => p.slug)).toEqual([
      'old',
      'yoto',
      'louis',
      'archived',
      'deprecated',
    ]);
  });

  it('filters by official and French availability', () => {
    expect(filterProjects(projects, { ...empty, official: true }).map((p) => p.slug)).toEqual([
      'yoto',
    ]);
    expect(filterProjects(projects, { ...empty, french: true }).map((p) => p.slug)).toEqual([
      'louis',
    ]);
  });

  it('combines category, status and tag', () => {
    expect(
      filterProjects(projects, {
        ...empty,
        category: 'create',
        status: 'active',
        tag: 'youtube',
      }).map((p) => p.slug),
    ).toEqual(['louis']);
    expect(
      filterProjects(projects, {
        ...empty,
        category: 'create',
        status: 'stale',
        tag: 'youtube',
      }),
    ).toEqual([]);
  });
});

describe('sortProjects', () => {
  it('sorts by recency, stars and name', () => {
    expect(sortProjects(projects, 'recent').map((p) => p.slug)).toEqual(['louis', 'yoto', 'old']);
    expect(sortProjects(projects, 'stars').map((p) => p.slug)).toEqual(['louis', 'yoto', 'old']);
    expect(sortProjects(projects, 'alpha').map((p) => p.slug)).toEqual(['louis', 'old', 'yoto']);
  });

  it('keeps the source order for category', () => {
    expect(sortProjects(projects, 'category').map((p) => p.slug)).toEqual(['old', 'yoto', 'louis']);
  });

  it('does not mutate its input', () => {
    const before = projects.map((p) => p.slug);
    sortProjects(projects, 'alpha');
    sortProjects(projects, 'recent');
    expect(projects.map((p) => p.slug)).toEqual(before);
    expect(before).toEqual(['old', 'yoto', 'louis']);
  });

  it('sorts a filtered subset', () => {
    const filtered = filterProjects(projects, empty);
    expect(sortProjects(filtered, 'alpha').map((p) => p.slug)).toEqual(['louis', 'yoto']);
    expect(sortProjects(filtered, 'recent').map((p) => p.slug)).toEqual(['louis', 'yoto']);
  });
});
