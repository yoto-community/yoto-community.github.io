import { describe, expect, it, vi } from 'vitest';
import {
  FAVORITE_PODCAST_LIMIT,
  favoritePodcastsUrl,
  parseFavoritePodcastCatalog,
  parseFavoritePodcastMeta,
  parsePodcastLanguages,
  podcastCatalogueManifestUrl,
  podcastEntryUrl,
  podcastLanguageUrl,
  recentFavoritePodcasts,
  resolveFavoritePodcasts,
  type FetchLike,
} from './favorite-podcasts';
import type { ToolkitItem } from './toolkit';

const DATE = '2026-11-06';
const MANIFEST_URL = 'https://yoto-community.github.io/podcast-catalogue/api/catalog.json';
const FR_URL = 'https://yoto-community.github.io/podcast-catalogue/api/catalog/fr.json';
const EN_URL = 'https://yoto-community.github.io/podcast-catalogue/api/catalog/en.json';

function item(type: ToolkitItem['type'], id: string, title = id): ToolkitItem {
  return { type, id, title, addedAt: DATE };
}

function entry(slug: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug,
    name: `Podcast ${slug}`,
    groupSlug: 'age-2-5',
    imageUrl: `https://cdn.example/${slug}.jpg`,
    ...overrides,
  };
}

function languagePayload(shards: unknown[] = [{ groupSlug: 'age-2-5', entries: [] }]): {
  shards: unknown[];
} {
  return { shards };
}

describe('recentFavoritePodcasts', () => {
  it('keeps podcast items only, most recent first, capped at the limit', () => {
    const items = [
      item('project', 'louis'),
      ...Array.from({ length: FAVORITE_PODCAST_LIMIT + 1 }, (_, index) =>
        item('podcast', `podcast-${index}`),
      ),
      item('icon', 'bluey'),
    ];

    const selected = recentFavoritePodcasts(items);

    expect(selected).toHaveLength(FAVORITE_PODCAST_LIMIT);
    expect(selected[0]?.id).toBe(`podcast-${FAVORITE_PODCAST_LIMIT}`);
    expect(selected[selected.length - 1]?.id).toBe('podcast-1');
  });

  it('returns every podcast when there are fewer than the limit', () => {
    expect(
      recentFavoritePodcasts([item('podcast', 'une-histoire')]).map((entry) => entry.id),
    ).toEqual(['une-histoire']);
  });
});

describe('catalogue URLs', () => {
  it('builds the localized favourites page', () => {
    expect(favoritePodcastsUrl('fr')).toBe(
      'https://yoto-community.github.io/podcast-catalogue/fr/favoris/',
    );
    expect(favoritePodcastsUrl('en')).toBe(
      'https://yoto-community.github.io/podcast-catalogue/en/favorites/',
    );
  });

  it('builds the manifest and language URLs', () => {
    expect(podcastCatalogueManifestUrl()).toBe(MANIFEST_URL);
    expect(podcastLanguageUrl('fr')).toBe(FR_URL);
  });

  it('encodes every path segment of an entry URL', () => {
    expect(podcastEntryUrl('en', 'age-2-5', 'a/b c')).toBe(
      'https://yoto-community.github.io/podcast-catalogue/en/age-2-5/a%2Fb%20c/',
    );
  });
});

describe('parseFavoritePodcastMeta', () => {
  it('accepts a valid catalogue entry', () => {
    expect(parseFavoritePodcastMeta(entry('une-histoire'), 'en')).toEqual({
      slug: 'une-histoire',
      title: 'Podcast une-histoire',
      image: 'https://cdn.example/une-histoire.jpg',
      url: 'https://yoto-community.github.io/podcast-catalogue/en/age-2-5/une-histoire/',
    });
  });

  it('falls back to the slug when the entry has no name', () => {
    expect(parseFavoritePodcastMeta(entry('sans-nom', { name: '  ' }), 'fr')?.title).toBe(
      'sans-nom',
    );
  });

  it('rejects an empty slug', () => {
    expect(parseFavoritePodcastMeta(entry(''), 'fr')).toBeNull();
    expect(parseFavoritePodcastMeta(null, 'fr')).toBeNull();
  });

  it('keeps the entry when the cover is missing or not http(s)', () => {
    expect(parseFavoritePodcastMeta(entry('a', { imageUrl: '' }), 'fr')).toMatchObject({
      slug: 'a',
      image: null,
    });
    expect(
      parseFavoritePodcastMeta(entry('a', { imageUrl: 'javascript:alert(1)' }), 'fr'),
    ).toMatchObject({ slug: 'a', image: null });
  });

  it('falls back to the favourites page when the group is unknown', () => {
    const meta = parseFavoritePodcastMeta(
      { slug: 'a', name: 'A', imageUrl: 'https://cdn.example/a.jpg' },
      'fr',
    );
    expect(meta?.url).toBe(favoritePodcastsUrl('fr'));
  });

  it('uses the shard group context when the entry has no group slug', () => {
    const meta = parseFavoritePodcastMeta(
      { slug: 'a', name: 'A', imageUrl: 'https://cdn.example/a.jpg' },
      'en',
      { groupSlug: 'age-2-5' },
    );
    expect(meta?.url).toBe('https://yoto-community.github.io/podcast-catalogue/en/age-2-5/a/');
  });

  it('prefers a localized group slug from the shard', () => {
    const meta = parseFavoritePodcastMeta(
      { slug: 'a', name: 'A', imageUrl: 'https://cdn.example/a.jpg', groupId: 'age-2-5' },
      'en',
      { groupSlug: 'age-2-5', groupTranslations: { en: { slug: 'toddlers' } } },
    );
    expect(meta?.url).toBe('https://yoto-community.github.io/podcast-catalogue/en/toddlers/a/');
  });
});

describe('parseFavoritePodcastCatalog', () => {
  it('reads every shard and applies its group context', () => {
    expect(
      parseFavoritePodcastCatalog(
        languagePayload([
          { groupSlug: 'age-2-5', entries: [entry('a', { groupSlug: undefined })] },
          { groupSlug: 'age-5-7', entries: [entry('b', { groupSlug: undefined })] },
        ]),
        'fr',
      ),
    ).toEqual([
      {
        slug: 'a',
        title: 'Podcast a',
        image: 'https://cdn.example/a.jpg',
        url: 'https://yoto-community.github.io/podcast-catalogue/fr/age-2-5/a/',
      },
      {
        slug: 'b',
        title: 'Podcast b',
        image: 'https://cdn.example/b.jpg',
        url: 'https://yoto-community.github.io/podcast-catalogue/fr/age-5-7/b/',
      },
    ]);
  });

  it('skips malformed shards and entries without rejecting the payload', () => {
    const items = parseFavoritePodcastCatalog(
      languagePayload([null, { entries: [entry('a')] }, { entries: [{ name: 'No slug' }, null] }]),
      'fr',
    );
    expect(items).toHaveLength(1);
    expect(items?.[0]?.slug).toBe('a');
  });

  it('rejects a payload without a shards array', () => {
    expect(parseFavoritePodcastCatalog({ language: 'fr' }, 'fr')).toBeNull();
    expect(parseFavoritePodcastCatalog([], 'fr')).toBeNull();
  });
});

describe('parsePodcastLanguages', () => {
  it('reads unique language codes', () => {
    expect(
      parsePodcastLanguages({
        languages: [{ code: 'fr' }, { code: 'en' }, { code: 'fr' }, { label: 'No code' }, null],
      }),
    ).toEqual(['fr', 'en']);
  });

  it('returns null without a usable language list', () => {
    expect(parsePodcastLanguages({})).toBeNull();
    expect(parsePodcastLanguages({ languages: [] })).toBeNull();
  });
});

describe('resolveFavoritePodcasts', () => {
  function catalogueFetch(): FetchLike {
    return vi.fn(async (url: string) => {
      if (url === MANIFEST_URL) {
        return {
          ok: true,
          json: async () => ({ languages: [{ code: 'fr' }, { code: 'en' }] }),
        };
      }
      if (url === FR_URL) {
        return {
          ok: true,
          json: async () => languagePayload([{ groupSlug: 'age-2-5', entries: [entry('a')] }]),
        };
      }
      if (url === EN_URL) {
        return {
          ok: true,
          json: async () => languagePayload([{ groupSlug: 'age-5-7', entries: [entry('b')] }]),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
  }

  it('resolves every language and returns metadata in item order', async () => {
    const fetchImpl = catalogueFetch();

    const result = await resolveFavoritePodcasts(
      [item('podcast', 'a'), item('podcast', 'b'), item('podcast', 'missing')],
      fetchImpl,
      'fr',
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledWith(MANIFEST_URL, undefined);
    expect(result.map((entry) => entry.item.id)).toEqual(['a', 'b', 'missing']);
    expect(result.map((entry) => entry.meta?.title ?? null)).toEqual([
      'Podcast a',
      'Podcast b',
      null,
    ]);
  });

  it('does not fetch anything without favourite podcasts', async () => {
    const fetchImpl: FetchLike = vi.fn();

    await expect(resolveFavoritePodcasts([], fetchImpl, 'fr')).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps every item when the manifest is unreachable', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await resolveFavoritePodcasts([item('podcast', 'a')], fetchImpl, 'fr');

    expect(result).toEqual([{ item: item('podcast', 'a'), meta: null }]);
  });

  it('keeps entries from one language when another language fails', async () => {
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      if (url === MANIFEST_URL) {
        return {
          ok: true,
          json: async () => ({ languages: [{ code: 'fr' }, { code: 'en' }] }),
        };
      }
      if (url === FR_URL) {
        return {
          ok: true,
          json: async () => languagePayload([{ groupSlug: 'age-2-5', entries: [entry('a')] }]),
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    const result = await resolveFavoritePodcasts(
      [item('podcast', 'a'), item('podcast', 'b')],
      fetchImpl,
      'fr',
    );

    expect(result.map((entry) => entry.meta?.title ?? null)).toEqual(['Podcast a', null]);
  });

  it('aborts cleanly without throwing', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });

    const result = await resolveFavoritePodcasts(
      [item('podcast', 'a')],
      fetchImpl,
      'fr',
      controller.signal,
    );

    expect(result).toEqual([{ item: item('podcast', 'a'), meta: null }]);
  });
});
