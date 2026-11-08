import { describe, expect, it } from 'vitest';
import { validateRepository, type RepositoryInput } from '../scripts/lib/validate-repo';

const base = {
  name: 'Louis',
  url: 'https://github.com/stuartromanek/louis',
  repo: 'https://github.com/stuartromanek/louis',
  description: 'Turn a YouTube playlist into a Yoto MYO card.',
  category: 'create',
  tags: ['youtube'],
  author: 'Stuart Romanek',
  authorGithub: 'stuartromanek',
  license: 'MIT',
  status: 'active' as const,
  official: false,
  platforms: ['web' as const],
  added: '2026-11-03',
};

function input(overrides: Partial<RepositoryInput> = {}): RepositoryInput {
  return {
    today: '2026-11-03',
    categories: ['official', 'create'],
    tags: ['youtube', 'myo'],
    collections: [],
    projects: [{ slug: 'louis', data: base }],
    ...overrides,
  };
}

describe('validateRepository', () => {
  it('accepts a coherent repository', () => {
    expect(validateRepository(input()).size).toBe(0);
  });

  it('rejects an unknown category', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, category: 'nope' } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('unknown category "nope"');
  });

  it('rejects an unknown tag', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, tags: ['nope'] } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('unknown tag "nope"');
  });

  it('rejects a duplicate URL after normalization', () => {
    const errors = validateRepository(
      input({
        projects: [
          { slug: 'louis', data: base },
          {
            slug: 'louis-copy',
            data: { ...base, name: 'Louis copy', url: 'https://GitHub.com/stuartromanek/louis/' },
          },
        ],
      }),
    );
    expect(errors.get('louis-copy')?.join(' ')).toContain('duplicate url');
  });

  it('rejects a duplicate name, case-insensitively', () => {
    const errors = validateRepository(
      input({
        projects: [
          { slug: 'louis', data: base },
          { slug: 'louis-2', data: { ...base, name: 'LOUIS', url: 'https://example.com/louis' } },
        ],
      }),
    );
    expect(errors.get('louis-2')?.join(' ')).toContain('duplicate name');
  });

  it('rejects a future added date', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, added: '2027-01-01' } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('added date is in the future');
  });

  it('requires authorGithub for a GitHub repository', () => {
    const { authorGithub: _ignored, ...withoutGithub } = base;
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: withoutGithub }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('GitHub repository requires authorGithub');
  });

  it('rejects an authorGithub that does not own the repository', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, authorGithub: 'someone-else' } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('does not match the repository owner');
  });

  it('accepts a non-GitHub project without authorGithub', () => {
    const { authorGithub: _ignored, repo: _repo, ...withoutGithub } = base;
    const errors = validateRepository(
      input({
        projects: [
          {
            slug: 'louis',
            data: { ...withoutGithub, url: 'https://example.com/louis' },
          },
        ],
      }),
    );
    expect(errors.size).toBe(0);
  });

  it('rejects a collection referencing an unknown project', () => {
    const errors = validateRepository(
      input({ collections: [{ slug: 'start-here', items: ['ghost'] }] }),
    );
    expect(errors.get('collection:start-here')?.join(' ')).toContain('unknown project "ghost"');
  });

  it('rejects a duplicate category slug', () => {
    const errors = validateRepository(input({ categories: ['official', 'create', 'create'] }));
    expect(errors.get('category:create')?.join(' ')).toContain('duplicate category slug');
  });

  it('only reports duplicate category slug once even with many duplicates', () => {
    const errors = validateRepository(
      input({ categories: ['official', 'create', 'create', 'create', 'create'] }),
    );
    const errorMessages = errors.get('category:create');
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages?.[0]).toContain('duplicate category slug');
  });

  it('rejects a duplicate collection slug', () => {
    const errors = validateRepository(
      input({
        collections: [
          { slug: 'start-here', items: ['louis'] },
          { slug: 'start-here', items: ['louis'] },
        ],
      }),
    );
    expect(errors.get('collection:start-here')?.join(' ')).toContain('duplicate collection slug');
  });

  it('rejects a duplicate name with surrounding whitespace', () => {
    const errors = validateRepository(
      input({
        projects: [
          { slug: 'louis', data: base },
          {
            slug: 'louis-2',
            data: { ...base, name: '  Louis  ', url: 'https://example.com/louis' },
          },
        ],
      }),
    );
    expect(errors.get('louis-2')?.join(' ')).toContain('duplicate name');
  });

  it('reports a malformed URL instead of throwing', () => {
    const errors = validateRepository(
      input({
        projects: [{ slug: 'louis', data: { ...base, url: 'https://example.com:99999999999/x' } }],
      }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('invalid url');
  });

  it('rejects a non-kebab-case slug', () => {
    const errors = validateRepository(input({ projects: [{ slug: 'Bad_Slug', data: base }] }));
    expect(errors.get('Bad_Slug')?.join(' ')).toContain('slug must be kebab-case');
  });

  it.each([
    'https://localhost/x',
    'https://192.168.1.1/x',
    'https://bit.ly/x',
    'https://[::1]/x',
    'https://[fe80::1]/x',
    'https://[fc00::1]/x',
  ])('rejects a non-public URL (%s)', (url) => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, url } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('url must be a public, non-shortened URL');
  });

  it('accepts a public IPv6 URL', () => {
    const errors = validateRepository(
      input({
        projects: [{ slug: 'louis', data: { ...base, url: 'https://[2606:4700:4700::1111]/x' } }],
      }),
    );
    expect(errors.size).toBe(0);
  });

  it('accepts a public URL', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, url: 'https://example.com/x' } }] }),
    );
    expect(errors.size).toBe(0);
  });
});
