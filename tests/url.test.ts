import { describe, expect, it } from 'vitest';
import { normalizeUrl, urlsEqual } from '../scripts/lib/url';

describe('normalizeUrl', () => {
  it('lowercases the host, keeps the path, drops the trailing slash', () => {
    expect(normalizeUrl('https://GitHub.com/Foo/Bar/')).toBe('https://github.com/Foo/Bar');
  });

  it('drops the fragment and tracking query', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x#top')).toBe('https://example.com/a');
  });
});

describe('urlsEqual', () => {
  it('ignores host casing and trailing slashes', () => {
    expect(urlsEqual('https://GitHub.com/foo/', 'https://github.com/foo')).toBe(true);
  });

  it('distinguishes different paths', () => {
    expect(urlsEqual('https://github.com/foo', 'https://github.com/bar')).toBe(false);
  });
});
