import { describe, expect, it } from 'vitest';
import { editProjectUrl, translateProjectUrl } from './contribute-links';

const REPO = 'https://github.com/yoto-community/yoto-community.github.io';

describe('editProjectUrl', () => {
  it('points at the YAML file on main', () => {
    expect(editProjectUrl('yoto-cli')).toBe(`${REPO}/edit/main/data/projects/yoto-cli.yml`);
  });

  it('encodes a slug instead of letting it add path segments', () => {
    expect(editProjectUrl('../schema/project')).toBe(
      `${REPO}/edit/main/data/projects/..%2Fschema%2Fproject.yml`,
    );
  });
});

describe('translateProjectUrl', () => {
  it('prefills the translation form, the title and the slug', () => {
    const url = new URL(translateProjectUrl('yoto-cli', 'yoto-cli'));
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO}/issues/new`);
    expect(url.searchParams.get('template')).toBe('translate-project.yml');
    expect(url.searchParams.get('title')).toBe('[Translation]: yoto-cli');
    expect(url.searchParams.get('slug')).toBe('yoto-cli');
  });

  it('keeps a project name with spaces and accents in the title only', () => {
    const url = new URL(translateProjectUrl('yoto-space', 'Yoto Space'));
    expect(url.searchParams.get('title')).toBe('[Translation]: Yoto Space');
    expect(url.searchParams.get('slug')).toBe('yoto-space');
  });
});
