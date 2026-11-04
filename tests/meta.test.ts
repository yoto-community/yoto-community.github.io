import { describe, expect, it } from 'vitest';
import { metaFromApi, repoFromUrl, suggestStatus } from '../scripts/lib/meta';

describe('repoFromUrl', () => {
  it('extracts owner and repo from a GitHub URL', () => {
    expect(repoFromUrl('https://github.com/yotoplay/yoto-sdk')).toEqual({
      owner: 'yotoplay',
      repo: 'yoto-sdk',
    });
  });

  it('returns null for a non-GitHub URL', () => {
    expect(repoFromUrl('https://yoto.dev/')).toBeNull();
  });
});

describe('metaFromApi', () => {
  it('maps the GitHub payload', () => {
    expect(
      metaFromApi({
        stargazers_count: 57,
        pushed_at: '2026-09-12T10:00:00Z',
        archived: false,
        license: { spdx_id: 'MIT' },
      }),
    ).toEqual({ stars: 57, lastCommit: '2026-09-12', archived: false, licenseDetected: 'MIT' });
  });

  it('tolerates a missing license', () => {
    expect(metaFromApi({ stargazers_count: 0, pushed_at: '2026-01-01T00:00:00Z' })).toEqual({
      stars: 0,
      lastCommit: '2026-01-01',
      archived: false,
      licenseDetected: undefined,
    });
  });

  it('maps NOASSERTION as undefined license', () => {
    expect(
      metaFromApi({
        stargazers_count: 0,
        pushed_at: '2026-01-01T00:00:00Z',
        license: { spdx_id: 'NOASSERTION' },
      }),
    ).toEqual({
      stars: 0,
      lastCommit: '2026-01-01',
      archived: false,
      licenseDetected: undefined,
    });
  });
});

describe('suggestStatus', () => {
  const today = '2026-11-03';
  it('returns active under six months', () => {
    expect(suggestStatus({ lastCommit: '2026-07-01' }, today)).toBe('active');
  });
  it('returns maintained between six and twelve months', () => {
    expect(suggestStatus({ lastCommit: '2025-12-01' }, today)).toBe('maintained');
  });
  it('returns stale after twelve months', () => {
    expect(suggestStatus({ lastCommit: '2025-01-01' }, today)).toBe('stale');
  });
  it('returns archived regardless of date', () => {
    expect(suggestStatus({ lastCommit: '2026-10-01', archived: true }, today)).toBe('archived');
  });

  // Exact day offsets from `today` (2026-11-03).
  it('returns active at 182 days ago (just under six months)', () => {
    expect(suggestStatus({ lastCommit: '2026-05-05' }, today)).toBe('active');
  });
  it('returns maintained at exactly 183 days ago (six-month boundary)', () => {
    expect(suggestStatus({ lastCommit: '2026-05-04' }, today)).toBe('maintained');
  });
  it('returns maintained at 184 days ago', () => {
    expect(suggestStatus({ lastCommit: '2026-05-03' }, today)).toBe('maintained');
  });
  it('returns maintained at 364 days ago (just under twelve months)', () => {
    expect(suggestStatus({ lastCommit: '2025-11-04' }, today)).toBe('maintained');
  });
  it('returns stale at exactly 365 days ago (twelve-month boundary)', () => {
    expect(suggestStatus({ lastCommit: '2025-11-03' }, today)).toBe('stale');
  });
});
