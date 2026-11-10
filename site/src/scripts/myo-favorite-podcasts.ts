import {
  recentFavoritePodcasts,
  resolveFavoritePodcasts,
  type FavoritePodcast,
} from '../lib/favorite-podcasts';
import {
  LEGACY_TOOLKIT_KEYS,
  TOOLKIT_EVENT,
  TOOLKIT_KEY,
  legacyToolkit,
  readToolkit,
  type ToolkitItem,
} from '../lib/toolkit';
import type { Lang } from '../lib/routes';

const section = document.querySelector<HTMLElement>('[data-myo-favorite-podcasts]');

if (section) {
  const root = section;
  const grid = section.querySelector<HTMLUListElement>('[data-myo-podcast-grid]');
  const allLink = section.querySelector<HTMLAnchorElement>('[data-myo-podcast-all]');
  const status = section.querySelector<HTMLElement>('[data-myo-podcast-status]');
  const lang: Lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';

  const catalogueUrl =
    section.dataset.catalogueUrl ??
    'https://yoto-community.github.io/podcast-catalogue/en/favorites/';
  const seeAllLabel = section.dataset.labelSeeAll ?? 'See all my favourite podcasts';
  const openLabel = section.dataset.labelOpen ?? 'View the podcast';
  const unavailableLabel =
    section.dataset.labelUnavailable ??
    'Podcast details could not be loaded right now. Open the catalogue to see your favourites.';

  /** Transparent 1×1 GIF: an `<img>` that is hidden until the lookup succeeds. */
  const BLANK_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  interface Tile {
    item: ToolkitItem;
    li: HTMLLIElement;
    link: HTMLAnchorElement;
    thumb: HTMLSpanElement;
    img: HTMLImageElement;
    initial: HTMLSpanElement;
    name: HTMLSpanElement;
  }

  let request: AbortController | null = null;
  let generation = 0;

  function initial(title: string): string {
    const first = Array.from(title.trim())[0];
    return first ? first.toUpperCase() : '?';
  }

  function createTile(item: ToolkitItem): Tile {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'myo-podcast';
    link.href = catalogueUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${openLabel} — ${item.title}`);

    const thumb = document.createElement('span');
    thumb.className = 'myo-podcast-thumb is-empty';

    const fallback = document.createElement('span');
    fallback.className = 'myo-podcast-thumb-initial';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.textContent = initial(item.title);

    const img = document.createElement('img');
    img.src = BLANK_PIXEL;
    img.alt = '';
    img.width = 56;
    img.height = 56;
    img.hidden = true;
    thumb.append(fallback, img);

    const name = document.createElement('span');
    name.className = 'myo-podcast-name';
    name.textContent = item.title;

    link.append(thumb, name);
    li.append(link);

    const tile: Tile = { item, li, link, thumb, img, initial: fallback, name };

    img.addEventListener(
      'error',
      () => {
        img.hidden = true;
        fallback.hidden = false;
        thumb.classList.add('is-empty');
      },
      { once: true },
    );

    return tile;
  }

  function applyMeta(tile: Tile, meta: FavoritePodcast['meta']): void {
    if (!meta) {
      tile.link.href = catalogueUrl;
      tile.link.setAttribute('aria-label', `${openLabel} — ${tile.item.title}`);
      return;
    }

    tile.name.textContent = meta.title;
    tile.initial.textContent = initial(meta.title);
    tile.link.href = meta.url;
    tile.link.setAttribute('aria-label', `${openLabel} — ${meta.title}`);

    if (meta.image) {
      tile.img.src = meta.image;
      tile.img.hidden = false;
      tile.initial.hidden = true;
      tile.thumb.classList.remove('is-empty');
    } else {
      tile.img.hidden = true;
      tile.initial.hidden = false;
      tile.thumb.classList.add('is-empty');
    }
  }

  function hideSection(): void {
    request?.abort();
    request = null;
    generation += 1;
    grid?.replaceChildren();
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }
    root.hidden = true;
  }

  async function refresh(): Promise<void> {
    const toolkit = readToolkit();
    // Le catalogue reste propriétaire de la liste de podcasts. Tant que la
    // trousse n'a pas reçu de slice `podcast`, les anciens favoris du catalogue
    // sont la seule source.
    const source = toolkit.items.some((item) => item.type === 'podcast')
      ? toolkit.items
      : legacyToolkit().items;
    const podcastCount = source.filter((item) => item.type === 'podcast').length;
    const items = recentFavoritePodcasts(source);

    if (items.length === 0) {
      hideSection();
      return;
    }

    root.hidden = false;
    if (allLink) {
      allLink.href = catalogueUrl;
      allLink.textContent = `${seeAllLabel} (${podcastCount})`;
    }
    if (status) {
      status.textContent = '';
      status.hidden = true;
    }

    const tiles = items.map(createTile);
    grid?.replaceChildren(...tiles.map((tile) => tile.li));

    const token = ++generation;
    const nextRequest = new AbortController();
    request?.abort();
    request = nextRequest;
    const timeout = window.setTimeout(() => nextRequest.abort(), 5000);

    const results = await resolveFavoritePodcasts(
      items,
      (url, init) => fetch(url, init),
      lang,
      nextRequest.signal,
    );
    window.clearTimeout(timeout);
    if (token !== generation) return;
    request = null;

    results.forEach((result, index) => {
      const tile = tiles[index];
      if (tile) applyMeta(tile, result.meta);
    });

    if (status && results.every((result) => result.meta === null)) {
      status.textContent = unavailableLabel;
      status.hidden = false;
    }
  }

  window.addEventListener('storage', (event) => {
    if (
      event.key === TOOLKIT_KEY ||
      (event.key !== null && LEGACY_TOOLKIT_KEYS.some((legacy) => legacy.key === event.key))
    ) {
      void refresh();
    }
  });

  window.addEventListener(TOOLKIT_EVENT, () => void refresh());

  void refresh();
}
