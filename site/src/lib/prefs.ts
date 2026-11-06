/**
 * Shared same-origin preferences: theme and language.
 *
 * The portal, the icon catalogue and the podcast catalogue all live under
 * `yoto-community.github.io`, so they share one `localStorage`. This module is
 * the portal-side implementation of `yoto-community:prefs:v1`; the contract is
 * documented in `docs/shared-storage.md`.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type LocalePreference = 'en' | 'fr';

export const PREFS_VERSION = 1;
export const PREFS_KEY = 'yoto-community:prefs:v1';

const THEME_VALUES: readonly ThemePreference[] = ['light', 'dark', 'system'];
const LOCALE_VALUES: readonly LocalePreference[] = ['en', 'fr'];

export interface Prefs {
  version: typeof PREFS_VERSION;
  theme?: ThemePreference;
  locale?: LocalePreference;
}

export interface PrefsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isTheme(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_VALUES as readonly string[]).includes(value);
}

function isLocale(value: unknown): value is LocalePreference {
  return typeof value === 'string' && (LOCALE_VALUES as readonly string[]).includes(value);
}

export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return { version: PREFS_VERSION };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { version: PREFS_VERSION };
    }

    const record = parsed as Record<string, unknown>;
    if (record.version !== PREFS_VERSION) return { version: PREFS_VERSION };

    const prefs: Prefs = { version: PREFS_VERSION };
    if (isTheme(record.theme)) prefs.theme = record.theme;
    if (isLocale(record.locale)) prefs.locale = record.locale;
    return prefs;
  } catch {
    return { version: PREFS_VERSION };
  }
}

export function safePrefsStorage(): PrefsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readKey(storage: PrefsStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Read the shared preference. Until a site writes the new key, fall back to the
 * historical catalogue keys so existing choices survive the migration.
 */
export function readPrefs(storage: PrefsStorage | null = safePrefsStorage()): Prefs {
  if (!storage) return { version: PREFS_VERSION };

  let prefs: Prefs;
  try {
    const raw = storage.getItem(PREFS_KEY);
    prefs = raw === null ? { version: PREFS_VERSION } : parsePrefs(raw);
  } catch {
    return { version: PREFS_VERSION };
  }

  if (!prefs.theme) {
    const legacyTheme = readKey(storage, 'yoto-icons-theme');
    if (isTheme(legacyTheme)) prefs.theme = legacyTheme;
  }
  if (!prefs.locale) {
    const legacyLocale = readKey(storage, 'yoto-locale') ?? readKey(storage, 'locale');
    if (isLocale(legacyLocale)) prefs.locale = legacyLocale;
  }

  return prefs;
}

/** Merge a partial preference and persist it. Returns `false` on blocked storage. */
export function writePrefs(
  patch: Partial<Omit<Prefs, 'version'>>,
  storage: PrefsStorage | null = safePrefsStorage(),
): boolean {
  if (!storage) return false;

  try {
    const current = readPrefs(storage);
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        ...current,
        ...patch,
        version: PREFS_VERSION,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}
