/**
 * Favourite podcasts of the shared toolkit, resolved against the podcast
 * catalogue.
 *
 * The toolkit stores only `id` + `title` for podcasts. The podcast catalogue
 * publishes its full catalogue per language under `/api/catalog/`, so the MYO
 * guide can resolve a handful of covers without knowing the catalogue's build
 * internals. Both sites live under `yoto-community.github.io`.
 */
import type { Lang } from './routes';
import type { ToolkitItem } from './toolkit';

export const FAVORITE_PODCAST_LIMIT = 12;
export const PODCAST_CATALOGUE_BASE = 'https://yoto-community.github.io/podcast-catalogue';

/** One podcast entry, as published by the catalogue API. */
export interface FavoritePodcastMeta {
  slug: string;
  title: string;
  /** Cover URL, validated as http(s); `null` when the feed has no usable image. */
  image: string | null;
  /** Catalogue page for the podcast, or the favourites page as a fallback. */
  url: string;
}

export interface FavoritePodcast {
  item: ToolkitItem;
  /** `null` when the entry is missing from the catalogue or the lookup failed. */
  meta: FavoritePodcastMeta | null;
}

/** Narrow `fetch` shape so tests can inject a stub without building `Response`s. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

interface GroupContext {
  groupSlug?: string;
  groupTranslations?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function httpUrl(value: unknown): string | null {
  const raw = nonEmptyString(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

/** `/fr/favoris/` or `/en/favorites/` on the podcast catalogue. */
export function favoritePodcastsUrl(lang: Lang): string {
  return `${PODCAST_CATALOGUE_BASE}/${lang}/${lang === 'fr' ? 'favoris' : 'favorites'}/`;
}

/** Catalogue manifest: it lists the languages published by the API. */
export function podcastCatalogueManifestUrl(): string {
  return `${PODCAST_CATALOGUE_BASE}/api/catalog.json`;
}

/** Full catalogue of one language (all age groups in a single payload). */
export function podcastLanguageUrl(language: string): string {
  return `${PODCAST_CATALOGUE_BASE}/api/catalog/${encodeURIComponent(language)}.json`;
}

/** `/en/age-2-5/my-podcast/` — segments are encoded, never concatenated raw. */
export function podcastEntryUrl(lang: Lang, groupSlug: string, slug: string): string {
  return `${PODCAST_CATALOGUE_BASE}/${encodeURIComponent(lang)}/${encodeURIComponent(
    groupSlug,
  )}/${encodeURIComponent(slug)}/`;
}

/** Most recent podcasts first, capped so the guide stays compact. */
export function recentFavoritePodcasts(
  items: readonly ToolkitItem[],
  limit = FAVORITE_PODCAST_LIMIT,
): ToolkitItem[] {
  return items
    .filter((item) => item.type === 'podcast')
    .slice(-limit)
    .reverse();
}

/**
 * The catalogue exposes a neutral `groupSlug`; a locale may translate it. Use
 * the translated segment when one exists, then fall back to the neutral slug.
 */
function groupSlugOf(
  record: Record<string, unknown>,
  lang: Lang,
  context: GroupContext = {},
): string | null {
  const translations = record.groupTranslations ?? context.groupTranslations;
  if (lang !== 'fr' && isRecord(translations)) {
    const localized = translations[lang];
    if (isRecord(localized)) {
      const translated = nonEmptyString(localized.slug);
      if (translated) return translated;
    }
  }

  return nonEmptyString(record.groupSlug) ?? context.groupSlug ?? nonEmptyString(record.groupId);
}

export function parseFavoritePodcastMeta(
  value: unknown,
  lang: Lang,
  context: GroupContext = {},
): FavoritePodcastMeta | null {
  if (!isRecord(value)) return null;

  const slug = nonEmptyString(value.slug);
  if (!slug) return null;

  const title = nonEmptyString(value.name) ?? slug;
  const groupSlug = groupSlugOf(value, lang, context);
  const url = groupSlug ? podcastEntryUrl(lang, groupSlug, slug) : favoritePodcastsUrl(lang);

  return { slug, title, image: httpUrl(value.imageUrl), url };
}

/**
 * Read one language payload: `{ shards: [{ groupSlug, groupTranslations,
 * entries: [...] }] }`. Malformed shards and entries are skipped instead of
 * failing the whole language.
 */
export function parseFavoritePodcastCatalog(
  value: unknown,
  lang: Lang,
): FavoritePodcastMeta[] | null {
  if (!isRecord(value) || !Array.isArray(value.shards)) return null;

  const items: FavoritePodcastMeta[] = [];
  for (const shard of value.shards) {
    if (!isRecord(shard) || !Array.isArray(shard.entries)) continue;

    const context: GroupContext = {
      groupSlug: nonEmptyString(shard.groupSlug) ?? undefined,
      groupTranslations: shard.groupTranslations,
    };
    for (const entry of shard.entries) {
      const meta = parseFavoritePodcastMeta(entry, lang, context);
      if (meta) items.push(meta);
    }
  }

  return items;
}

/** Read the language codes from `/api/catalog.json`. */
export function parsePodcastLanguages(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.languages)) return null;

  const languages: string[] = [];
  for (const entry of value.languages) {
    if (!isRecord(entry)) continue;
    const code = nonEmptyString(entry.code);
    if (code && !languages.includes(code)) languages.push(code);
  }

  return languages.length > 0 ? languages : null;
}

/**
 * Resolve each item against the catalogue, independently from the others.
 * A failed language keeps the entries already seen; missing entries stay
 * `null` so the UI can fall back to the toolkit title and the favourites page.
 */
export async function resolveFavoritePodcasts(
  items: readonly ToolkitItem[],
  fetchImpl: FetchLike,
  lang: Lang,
  signal?: AbortSignal,
): Promise<FavoritePodcast[]> {
  if (items.length === 0) return [];

  const bySlug = new Map<string, FavoritePodcastMeta>();

  try {
    const manifestResponse = await fetchImpl(
      podcastCatalogueManifestUrl(),
      signal ? { signal } : undefined,
    );
    if (!manifestResponse.ok) {
      return items.map((item) => ({ item, meta: null }));
    }

    const languages = parsePodcastLanguages(await manifestResponse.json());
    if (!languages) return items.map((item) => ({ item, meta: null }));

    const settled = await Promise.allSettled(
      languages.map(async (language) => {
        const response = await fetchImpl(
          podcastLanguageUrl(language),
          signal ? { signal } : undefined,
        );
        if (!response.ok) return [];
        return parseFavoritePodcastCatalog(await response.json(), lang) ?? [];
      }),
    );

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const meta of result.value) {
        if (!bySlug.has(meta.slug)) bySlug.set(meta.slug, meta);
      }
    }
  } catch {
    // Offline, aborted or malformed payload: keep what was already resolved.
  }

  return items.map((item) => ({ item, meta: bySlug.get(item.id) ?? null }));
}
