import { describe, expect, it } from 'vitest';
import {
  LEGACY_TOOLKIT_KEYS,
  TOOLKIT_KEY,
  TOOLKIT_VERSION,
  addItem,
  groupToolkitItems,
  hasItem,
  mergeToolkits,
  parseToolkit,
  parseToolkitImport,
  readToolkit,
  removeItem,
  serializeToolkit,
  toggleItem,
  writeToolkit,
  type Toolkit,
  type ToolkitItem,
  type ToolkitStorage,
} from './toolkit';

const DATE = '2026-11-06';

const project = (overrides: Partial<ToolkitItem> = {}): ToolkitItem => ({
  type: 'project',
  id: 'louis',
  title: 'Louis',
  addedAt: DATE,
  ...overrides,
});

function memoryStorage(initial: Record<string, string> = {}): ToolkitStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe('parseToolkit', () => {
  it('returns an empty v1 toolkit for missing or malformed values', () => {
    expect(parseToolkit(null)).toEqual({ version: TOOLKIT_VERSION, items: [] });
    expect(parseToolkit('not json', DATE)).toEqual({ version: TOOLKIT_VERSION, items: [] });
  });

  it('reads a valid contract value', () => {
    const value = {
      version: 1,
      items: [project(), { type: 'icon', id: 'moon-42', title: 'Moon', addedAt: DATE }],
    };

    expect(parseToolkit(JSON.stringify(value), DATE)).toEqual(value);
  });

  it('repairs items with a missing title or date instead of dropping them', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [{ type: 'podcast', id: 'une-histoire' }],
    });

    expect(parseToolkit(raw, DATE).items).toEqual([
      { type: 'podcast', id: 'une-histoire', title: 'une-histoire', addedAt: DATE },
    ]);
  });

  it('drops unknown types, empty ids and duplicates', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        project(),
        project({ title: 'Duplicate' }),
        { type: 'playlist', id: 'later', title: 'Later', addedAt: DATE },
        { type: 'icon', id: '', title: 'Empty', addedAt: DATE },
      ],
    });

    expect(parseToolkit(raw, DATE).items).toEqual([project()]);
  });

  it('ignores unknown contract versions rather than guessing their shape', () => {
    const raw = JSON.stringify({ version: 99, items: [project()] });

    expect(parseToolkit(raw, DATE)).toEqual({ version: TOOLKIT_VERSION, items: [] });
  });
});

describe('parseToolkitImport', () => {
  it('accepts a valid toolkit, including an empty one', () => {
    expect(parseToolkitImport(JSON.stringify({ version: 1, items: [] }), DATE)).toEqual({
      version: 1,
      items: [],
    });
    expect(parseToolkitImport(JSON.stringify({ version: 1, items: [project()] }), DATE)).toEqual({
      version: 1,
      items: [project()],
    });
  });

  it('rejects malformed JSON and unknown contract versions', () => {
    expect(parseToolkitImport('{', DATE)).toBeNull();
    expect(parseToolkitImport(JSON.stringify({ version: 2, items: [] }), DATE)).toBeNull();
    expect(parseToolkitImport(JSON.stringify({ items: [] }), DATE)).toBeNull();
  });
});

describe('serializeToolkit', () => {
  it('round-trips through parseToolkit', () => {
    const toolkit: Toolkit = {
      version: 1,
      items: [project(), { type: 'icon', id: 'moon-42', title: 'Moon', addedAt: DATE }],
    };

    expect(parseToolkit(serializeToolkit(toolkit), DATE)).toEqual(toolkit);
  });
});

describe('toolkit mutations', () => {
  it('adds an item without mutating the input', () => {
    const initial: Toolkit = { version: 1, items: [] };
    const next = addItem(initial, project());

    expect(initial.items).toEqual([]);
    expect(next.items).toEqual([project()]);
  });

  it('does not add the same type and id twice', () => {
    const initial: Toolkit = { version: 1, items: [project()] };

    expect(addItem(initial, project({ title: 'Renamed' })).items).toEqual([project()]);
  });

  it('keeps the same id when the item type differs', () => {
    const initial: Toolkit = { version: 1, items: [project({ id: 'shared' })] };
    const next = addItem(initial, {
      type: 'icon',
      id: 'shared',
      title: 'Shared icon',
      addedAt: DATE,
    });

    expect(next.items).toHaveLength(2);
  });

  it('removes and toggles by type and id', () => {
    const initial: Toolkit = { version: 1, items: [project()] };
    const removed = removeItem(initial, 'project', 'louis');

    expect(removed.items).toEqual([]);
    expect(toggleItem(initial, project()).items).toEqual([]);
    expect(toggleItem(removed, project()).items).toEqual([project()]);
    expect(hasItem(initial, 'project', 'louis')).toBe(true);
    expect(hasItem(initial, 'icon', 'louis')).toBe(false);
  });

  it('merges toolkits without duplicating shared items and keeps existing titles', () => {
    const local: Toolkit = { version: 1, items: [project()] };
    const imported: Toolkit = {
      version: 1,
      items: [
        project({ title: 'Imported Louis' }),
        { type: 'podcast', id: 'une-histoire', title: 'Une histoire', addedAt: DATE },
      ],
    };

    expect(mergeToolkits(local, imported).items).toEqual([
      project(),
      { type: 'podcast', id: 'une-histoire', title: 'Une histoire', addedAt: DATE },
    ]);
  });
});

describe('groupToolkitItems', () => {
  it('groups items by type without changing their order', () => {
    const toolkit: Toolkit = {
      version: 1,
      items: [
        project(),
        { type: 'icon', id: 'moon-42', title: 'Moon', addedAt: DATE },
        { type: 'project', id: 'toto', title: 'Toto', addedAt: DATE },
      ],
    };

    expect(groupToolkitItems(toolkit)).toEqual({
      project: [project(), { type: 'project', id: 'toto', title: 'Toto', addedAt: DATE }],
      icon: [{ type: 'icon', id: 'moon-42', title: 'Moon', addedAt: DATE }],
      podcast: [],
    });
  });
});

describe('readToolkit / writeToolkit', () => {
  it('returns an empty toolkit when storage is unavailable', () => {
    expect(readToolkit(null, DATE)).toEqual({ version: 1, items: [] });
  });

  it('never throws when storage reads or writes fail', () => {
    const failing: ToolkitStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };

    expect(readToolkit(failing, DATE)).toEqual({ version: 1, items: [] });
    expect(writeToolkit({ version: 1, items: [project()] }, failing)).toBe(false);
  });

  it('persists the toolkit under the versioned key', () => {
    const storage = memoryStorage();
    const toolkit: Toolkit = { version: 1, items: [project()] };

    expect(writeToolkit(toolkit, storage)).toBe(true);
    expect(storage.values.get(TOOLKIT_KEY)).toBe(serializeToolkit(toolkit));
    expect(readToolkit(storage, DATE)).toEqual(toolkit);
  });

  it('mirrors legacy favourites only until the new key exists', () => {
    const storage = memoryStorage({
      'yoto-icons-favorites': JSON.stringify(['icon-a', 'icon-b']),
      'yoto-favorites': JSON.stringify(['episode-a']),
    });

    expect(readToolkit(storage, DATE).items).toEqual([
      { type: 'icon', id: 'icon-a', title: 'icon-a', addedAt: DATE },
      { type: 'icon', id: 'icon-b', title: 'icon-b', addedAt: DATE },
      { type: 'podcast', id: 'episode-a', title: 'episode-a', addedAt: DATE },
    ]);

    writeToolkit({ version: 1, items: [project()] }, storage);

    expect(readToolkit(storage, DATE).items).toEqual([project()]);
    expect(storage.values.get('yoto-icons-favorites')).toBe(JSON.stringify(['icon-a', 'icon-b']));
    expect(storage.values.get('yoto-favorites')).toBe(JSON.stringify(['episode-a']));
  });

  it('uses the documented legacy keys', () => {
    expect(LEGACY_TOOLKIT_KEYS).toEqual([
      { key: 'yoto-icons-favorites', type: 'icon' },
      { key: 'yoto-favorites', type: 'podcast' },
    ]);
  });
});
