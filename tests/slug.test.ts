import { describe, expect, it } from 'vitest';
import { slugify } from '../scripts/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Yoto Book Maker')).toBe('yoto-book-maker');
  });

  it('strips accents', () => {
    expect(slugify('Icônes & Design')).toBe('icones-design');
  });

  it('collapses separators and trims edges', () => {
    expect(slugify('  --Hello,   World!--  ')).toBe('hello-world');
  });

  it('caps length at 60 characters without a trailing hyphen', () => {
    const result = slugify('a'.repeat(80));
    expect(result).toHaveLength(60);
    expect(result.endsWith('-')).toBe(false);
  });

  it('falls back to "project" when nothing is left', () => {
    expect(slugify('***')).toBe('project');
  });
});
