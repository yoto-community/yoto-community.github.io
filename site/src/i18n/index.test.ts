import { describe, expect, it } from 'vitest';
import { en, fr, t, translate } from './index';

describe('i18n', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('translates a known key', () => {
    expect(t('fr', 'nav.projects')).toBe('Projets');
    expect(t('en', 'nav.projects')).toBe('Projects');
  });

  it('falls back to English for a missing or empty French value', () => {
    expect(translate({}, 'nav.myo')).toBe('MYO guide');
    expect(translate({ 'nav.myo': '' }, 'nav.myo')).toBe('MYO guide');
  });
});
