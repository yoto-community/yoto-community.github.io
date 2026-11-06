/**
 * Shared same-origin toolkit contract.
 *
 * The portal and the catalogue sub-sites all live under
 * `yoto-community.github.io`, so they share one `localStorage`. This module is
 * the portal-side implementation of the versioned contract documented in
 * `docs/shared-storage.md`.
 *
 * Rules:
 * - no access to `localStorage` at module evaluation time (the module is also
 *   imported during static rendering);
 * - every read and write is guarded, because storage can be disabled or full;
 * - old catalogue keys are read-only and only used until the new key exists.
 */

export type ToolkitItemType = 'project' | 'icon' | 'podcast';

export const TOOLKIT_TYPES: readonly ToolkitItemType[] = ['project', 'icon', 'podcast'];

export const TOOLKIT_VERSION = 1;
export const TOOLKIT_KEY = 'yoto-community:toolkit:v1';
export const TOOLKIT_EVENT = 'yoto-community:toolkit-change';

export interface LegacyToolkitKey {
  readonly key: string;
  readonly type: ToolkitItemType;
}

/** Existing catalogue keys, mirrored read-only until the new key is written. */
export const LEGACY_TOOLKIT_KEYS: readonly LegacyToolkitKey[] = [
  { key: 'yoto-icons-favorites', type: 'icon' },
  { key: 'yoto-favorites', type: 'podcast' },
];

export interface ToolkitItem {
  type: ToolkitItemType;
  id: string;
  title: string;
  addedAt: string;
}

export interface Toolkit {
  version: typeof TOOLKIT_VERSION;
  items: ToolkitItem[];
}

export interface ToolkitStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isToolkitItemType(value: unknown): value is ToolkitItemType {
  return typeof value === 'string' && (TOOLKIT_TYPES as readonly string[]).includes(value);
}

export function emptyToolkit(): Toolkit {
  return { version: TOOLKIT_VERSION, items: [] };
}

export function itemKey(item: Pick<ToolkitItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}

export function hasItem(toolkit: Toolkit, type: ToolkitItemType, id: string): boolean {
  return toolkit.items.some((item) => item.type === type && item.id === id);
}

function normalizeItem(value: unknown, fallbackDate: string): ToolkitItem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { type, id, title, addedAt } = record;

  if (!isToolkitItemType(type)) return null;
  if (typeof id !== 'string' || id.trim() === '') return null;

  const cleanId = id.trim();
  return {
    type,
    id: cleanId,
    title: typeof title === 'string' && title.trim() !== '' ? title.trim() : cleanId,
    addedAt: typeof addedAt === 'string' && addedAt.trim() !== '' ? addedAt.trim() : fallbackDate,
  };
}

/** Parse any stored value, tolerating corrupted JSON, bad items and duplicates. */
export function parseToolkit(raw: string | null, fallbackDate = today()): Toolkit {
  if (!raw) return emptyToolkit();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return emptyToolkit();
    }

    const record = parsed as Record<string, unknown>;
    // A future contract may change the item shape: refuse to guess it.
    if (record.version !== TOOLKIT_VERSION || !Array.isArray(record.items)) {
      return emptyToolkit();
    }

    const seen = new Set<string>();
    const items: ToolkitItem[] = [];
    for (const value of record.items) {
      const item = normalizeItem(value, fallbackDate);
      if (!item) continue;
      const key = itemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }

    return { version: TOOLKIT_VERSION, items };
  } catch {
    return emptyToolkit();
  }
}

/**
 * Validate an imported file. Unlike `parseToolkit`, a malformed file or an
 * unknown version returns `null` so the UI can report an error instead of
 * silently importing an empty toolkit.
 */
export function parseToolkitImport(raw: string, fallbackDate = today()): Toolkit | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

    const record = parsed as Record<string, unknown>;
    if (record.version !== TOOLKIT_VERSION || !Array.isArray(record.items)) return null;

    return parseToolkit(raw, fallbackDate);
  } catch {
    return null;
  }
}

export function serializeToolkit(toolkit: Toolkit): string {
  return JSON.stringify({ version: TOOLKIT_VERSION, items: toolkit.items });
}

export function addItem(toolkit: Toolkit, item: ToolkitItem): Toolkit {
  if (hasItem(toolkit, item.type, item.id)) return toolkit;
  return { ...toolkit, items: [...toolkit.items, item] };
}

export function removeItem(toolkit: Toolkit, type: ToolkitItemType, id: string): Toolkit {
  const items = toolkit.items.filter((item) => !(item.type === type && item.id === id));
  return items.length === toolkit.items.length ? toolkit : { ...toolkit, items };
}

export function toggleItem(toolkit: Toolkit, item: ToolkitItem): Toolkit {
  return hasItem(toolkit, item.type, item.id)
    ? removeItem(toolkit, item.type, item.id)
    : addItem(toolkit, item);
}

/** Union by `type:id`; existing items keep their title and date. */
export function mergeToolkits(base: Toolkit, incoming: Toolkit): Toolkit {
  let merged = base;
  for (const item of incoming.items) merged = addItem(merged, item);
  return merged;
}

export function groupToolkitItems(toolkit: Toolkit): Record<ToolkitItemType, ToolkitItem[]> {
  const groups: Record<ToolkitItemType, ToolkitItem[]> = {
    project: [],
    icon: [],
    podcast: [],
  };
  for (const item of toolkit.items) groups[item.type].push(item);
  return groups;
}

/** `localStorage` can be unavailable (SSR, Safari private mode, disabled storage). */
export function safeStorage(): ToolkitStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function readStringArray(storage: ToolkitStorage, key: string): string[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value !== '');
  } catch {
    return [];
  }
}

/**
 * Read the catalogue favourites of the old contract. The old keys are never
 * modified or removed here.
 */
export function legacyToolkit(
  storage: ToolkitStorage | null = safeStorage(),
  fallbackDate = today(),
): Toolkit {
  if (!storage) return emptyToolkit();

  let toolkit = emptyToolkit();
  for (const legacy of LEGACY_TOOLKIT_KEYS) {
    for (const id of readStringArray(storage, legacy.key)) {
      toolkit = addItem(toolkit, {
        type: legacy.type,
        id,
        title: id,
        addedAt: fallbackDate,
      });
    }
  }
  return toolkit;
}

/**
 * Read the toolkit. Until the portal writes the new key, old catalogue
 * favourites are mirrored in read-only mode. Once the new key exists, it is the
 * only source of truth, so removing a legacy item does not bring it back.
 */
export function readToolkit(
  storage: ToolkitStorage | null = safeStorage(),
  fallbackDate = today(),
): Toolkit {
  if (!storage) return emptyToolkit();

  try {
    const raw = storage.getItem(TOOLKIT_KEY);
    return raw === null ? legacyToolkit(storage, fallbackDate) : parseToolkit(raw, fallbackDate);
  } catch {
    return emptyToolkit();
  }
}

/** Persist the toolkit. Returns `false` when storage is unavailable or full. */
export function writeToolkit(
  toolkit: Toolkit,
  storage: ToolkitStorage | null = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(TOOLKIT_KEY, serializeToolkit(toolkit));
    return true;
  } catch {
    return false;
  }
}
