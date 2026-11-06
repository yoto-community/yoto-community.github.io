import { describe, expect, it, vi } from 'vitest';
import {
  FAVORITE_ICON_LIMIT,
  favoriteIconMetaUrl,
  parseFavoriteIconMeta,
  recentFavoriteIcons,
  resolveFavoriteIcons,
  type FetchLike,
} from './favorite-icons';
import type { ToolkitItem } from './toolkit';

const DATE = '2026-11-06';

function item(type: ToolkitItem['type'], id: string, title = id): ToolkitItem {
  return { type, id, title, addedAt: DATE };
}

function iconMeta(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    title: `Title ${id}`,
    preview_image: `https://cdn.example/${id}.png`,
    download_url: `https://cdn.example/${id}.png`,
    ...overrides,
  };
}

describe('favoriteIconMetaUrl', () => {
  it('encodes the icon id in the catalogue lookup path', () => {
    expect(favoriteIconMetaUrl('a/b c')).toBe(
      'https://yoto-community.github.io/icons-catalogue/icons/a%2Fb%20c.json',
    );
  });
});

describe('recentFavoriteIcons', () => {
  it('keeps icon items only, most recent first, capped at the limit', () => {
    const items = [
      item('project', 'louis'),
      ...Array.from({ length: FAVORITE_ICON_LIMIT + 1 }, (_, index) =>
        item('icon', `icon-${index}`),
      ),
      item('podcast', 'une-histoire'),
    ];

    const selected = recentFavoriteIcons(items);

    expect(selected).toHaveLength(FAVORITE_ICON_LIMIT);
    expect(selected[0]?.id).toBe(`icon-${FAVORITE_ICON_LIMIT}`);
    expect(selected[selected.length - 1]?.id).toBe('icon-1');
  });

  it('returns every icon when there are fewer than the limit', () => {
    expect(recentFavoriteIcons([item('icon', 'a')]).map((entry) => entry.id)).toEqual(['a']);
  });
});

describe('parseFavoriteIconMeta', () => {
  it('accepts a valid lookup payload', () => {
    expect(parseFavoriteIconMeta(iconMeta('a'), 'Fallback')).toEqual({
      id: 'a',
      title: 'Title a',
      preview: 'https://cdn.example/a.png',
      download: 'https://cdn.example/a.png',
    });
  });

  it('falls back to the toolkit title when the payload has none', () => {
    const meta = parseFavoriteIconMeta(iconMeta('a', { title: '  ' }), 'Bluey');
    expect(meta?.title).toBe('Bluey');
  });

  it('falls back to the download URL when the preview is missing', () => {
    const meta = parseFavoriteIconMeta(
      { id: 'a', title: 'A', download_url: 'https://cdn.example/a.png' },
      'A',
    );
    expect(meta).toMatchObject({
      preview: 'https://cdn.example/a.png',
      download: 'https://cdn.example/a.png',
    });
  });

  it('rejects an empty id', () => {
    expect(parseFavoriteIconMeta(iconMeta(''), 'Fallback')).toBeNull();
  });

  it('rejects non-http image URLs', () => {
    expect(
      parseFavoriteIconMeta(
        iconMeta('a', { preview_image: 'javascript:alert(1)', download_url: '/relative.png' }),
        'A',
      ),
    ).toBeNull();
    expect(
      parseFavoriteIconMeta(iconMeta('a', { preview_image: '', download_url: '' }), 'A'),
    ).toBeNull();
  });
});

describe('resolveFavoriteIcons', () => {
  it('returns metadata in item order and keeps the item when a lookup fails', async () => {
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      const id = decodeURIComponent(url.split('/').pop()?.replace('.json', '') ?? '');
      if (id === 'missing') return { ok: false, json: async () => ({}) };
      if (id === 'mismatch') {
        return { ok: true, json: async () => iconMeta('another-icon') };
      }
      return { ok: true, json: async () => iconMeta(id) };
    });

    const result = await resolveFavoriteIcons(
      [item('icon', 'a'), item('icon', 'missing'), item('icon', 'mismatch')],
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.map((entry) => entry.item.id)).toEqual(['a', 'missing', 'mismatch']);
    expect(result.map((entry) => entry.meta?.title ?? null)).toEqual(['Title a', null, null]);
  });

  it('does not fetch anything without favourite icons', async () => {
    const fetchImpl: FetchLike = vi.fn();

    await expect(resolveFavoriteIcons([], fetchImpl)).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
