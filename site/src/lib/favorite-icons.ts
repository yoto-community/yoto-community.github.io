/**
 * Favourite icons of the shared toolkit, resolved against the icons catalogue.
 *
 * The toolkit stores only `id` + `title` for icons. The catalogue publishes one
 * small JSON file per icon (`icons/{id}.json`), so the MYO guide can show a
 * handful of thumbnails without downloading the multi-megabyte source shards.
 * Both sites live under `yoto-community.github.io`, so the lookup is same-origin.
 */
import type { ToolkitItem } from './toolkit';

export const FAVORITE_ICON_LIMIT = 12;
export const ICONS_CATALOGUE_BASE = 'https://yoto-community.github.io/icons-catalogue';

/** One icon lookup, as stored in the catalogue. */
export interface FavoriteIconMeta {
  id: string;
  title: string;
  /** 16×16 image URL, validated as http(s). */
  preview: string;
  /** Original PNG URL, validated as http(s). */
  download: string;
}

export interface FavoriteIcon {
  item: ToolkitItem;
  /** `null` when the lookup failed or returned an unusable payload. */
  meta: FavoriteIconMeta | null;
}

/** Narrow `fetch` shape so tests can inject a stub without building `Response`s. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export function favoriteIconMetaUrl(id: string): string {
  return `${ICONS_CATALOGUE_BASE}/icons/${encodeURIComponent(id)}.json`;
}

/** Most recent icons first, capped so the guide stays compact. */
export function recentFavoriteIcons(
  items: readonly ToolkitItem[],
  limit = FAVORITE_ICON_LIMIT,
): ToolkitItem[] {
  return items
    .filter((item) => item.type === 'icon')
    .slice(-limit)
    .reverse();
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function parseFavoriteIconMeta(
  value: unknown,
  fallbackTitle: string,
): FavoriteIconMeta | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== 'string' || record.id.trim() === '') return null;

  const download = httpUrl(record.download_url) ?? httpUrl(record.preview_image);
  const preview = httpUrl(record.preview_image) ?? download;
  if (!preview || !download) return null;

  const title =
    typeof record.title === 'string' && record.title.trim() !== ''
      ? record.title.trim()
      : fallbackTitle;

  return { id: record.id.trim(), title, preview, download };
}

/**
 * Resolve each item independently: one broken lookup must not hide the others.
 * A payload for another icon is treated as a failure.
 */
export async function resolveFavoriteIcons(
  items: readonly ToolkitItem[],
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<FavoriteIcon[]> {
  if (items.length === 0) return [];

  const settled = await Promise.allSettled(
    items.map(async (item) => {
      const response = await fetchImpl(
        favoriteIconMetaUrl(item.id),
        signal ? { signal } : undefined,
      );
      if (!response.ok) return null;

      const meta = parseFavoriteIconMeta(await response.json(), item.title);
      return meta && meta.id === item.id ? meta : null;
    }),
  );

  return items.map((item, index) => {
    const result = settled[index];
    return {
      item,
      meta: result?.status === 'fulfilled' ? result.value : null,
    };
  });
}
