import { describe, expect, it } from 'vitest';
import { projectActions } from './project-actions';

describe('projectActions', () => {
  it('shows only the repository when both links are the same', () => {
    expect(
      projectActions({
        url: 'https://github.com/yoto-community/yoto-community.github.io',
        repo: 'https://github.com/yoto-community/yoto-community.github.io',
      }),
    ).toEqual({ showWebsite: false, showRepo: true, primary: 'repo' });
  });

  it('ignores a trailing slash when comparing the two links', () => {
    expect(
      projectActions({
        url: 'https://github.com/foo/bar/',
        repo: 'https://github.com/foo/bar',
      }),
    ).toEqual({ showWebsite: false, showRepo: true, primary: 'repo' });
  });

  it('shows both links when the website and repository differ', () => {
    expect(
      projectActions({
        url: 'https://example.com',
        repo: 'https://github.com/foo/bar',
      }),
    ).toEqual({ showWebsite: true, showRepo: true, primary: 'website' });
  });

  it('shows only the website when there is no repository', () => {
    expect(projectActions({ url: 'https://example.com' })).toEqual({
      showWebsite: true,
      showRepo: false,
      primary: 'website',
    });
  });
});
