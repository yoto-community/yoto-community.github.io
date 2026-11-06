import { describe, expect, it } from 'vitest';
import {
  PREFS_KEY,
  PREFS_VERSION,
  parsePrefs,
  readPrefs,
  resolveTheme,
  writePrefs,
  type PrefsStorage,
} from './prefs';

function memoryStorage(initial: Record<string, string> = {}): PrefsStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('parsePrefs', () => {
  it('returns an empty v1 object for missing or invalid input', () => {
    expect(parsePrefs(null)).toEqual({ version: PREFS_VERSION });
    expect(parsePrefs('not json')).toEqual({ version: PREFS_VERSION });
    expect(parsePrefs(JSON.stringify({ version: 99, theme: 'dark' }))).toEqual({
      version: PREFS_VERSION,
    });
  });

  it('keeps valid theme and locale values', () => {
    expect(parsePrefs(JSON.stringify({ version: 1, theme: 'dark', locale: 'fr' }))).toEqual({
      version: 1,
      theme: 'dark',
      locale: 'fr',
    });
  });

  it('drops unknown values without dropping valid siblings', () => {
    expect(parsePrefs(JSON.stringify({ version: 1, theme: 'sepia', locale: 'en' }))).toEqual({
      version: 1,
      locale: 'en',
    });
  });
});

describe('readPrefs', () => {
  it('reads the shared key first', () => {
    const storage = memoryStorage({
      [PREFS_KEY]: JSON.stringify({ version: 1, theme: 'light', locale: 'en' }),
      'yoto-icons-theme': 'dark',
      'yoto-locale': 'fr',
    });

    expect(readPrefs(storage)).toEqual({ version: 1, theme: 'light', locale: 'en' });
  });

  it('falls back to the historical catalogue keys', () => {
    const storage = memoryStorage({
      'yoto-icons-theme': 'dark',
      'yoto-locale': 'fr',
    });

    expect(readPrefs(storage)).toEqual({ version: 1, theme: 'dark', locale: 'fr' });
  });

  it('never throws when storage is unavailable', () => {
    expect(readPrefs(null)).toEqual({ version: 1 });
    expect(
      readPrefs({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {},
      }),
    ).toEqual({ version: 1 });
  });
});

describe('writePrefs', () => {
  it('merges a patch and preserves the other preference', () => {
    const storage = memoryStorage({
      [PREFS_KEY]: JSON.stringify({ version: 1, theme: 'dark', locale: 'fr' }),
    });

    expect(writePrefs({ theme: 'light' }, storage)).toBe(true);
    expect(JSON.parse(storage.values.get(PREFS_KEY) ?? '{}')).toEqual({
      version: 1,
      theme: 'light',
      locale: 'fr',
    });
  });

  it('returns false instead of throwing when storage is full or blocked', () => {
    expect(writePrefs({ locale: 'en' }, null)).toBe(false);
    expect(
      writePrefs(
        { locale: 'en' },
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('quota');
          },
        },
      ),
    ).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('resolves the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
