import {
  recentFavoriteIcons,
  resolveFavoriteIcons,
  type FavoriteIcon,
} from '../lib/favorite-icons';
import {
  LEGACY_TOOLKIT_KEYS,
  TOOLKIT_EVENT,
  TOOLKIT_KEY,
  legacyToolkit,
  readToolkit,
  type ToolkitItem,
} from '../lib/toolkit';

const section = document.querySelector<HTMLElement>('[data-myo-favorites]');

if (section) {
  const root = section;
  const grid = section.querySelector<HTMLUListElement>('[data-myo-favorites-grid]');
  const allLink = section.querySelector<HTMLAnchorElement>('[data-myo-favorites-all]');
  const status = section.querySelector<HTMLElement>('[data-myo-favorites-status]');

  const favouritesUrl =
    section.dataset.favouritesUrl ?? 'https://yoto-community.github.io/icons-catalogue/favorites';
  const seeAllLabel = section.dataset.labelSeeAll ?? 'See all my favourites';
  const downloadLabel = section.dataset.labelDownload ?? 'Download';
  const openLabel = section.dataset.labelOpen ?? 'View in the catalogue';
  const unavailableLabel =
    section.dataset.labelUnavailable ??
    'Thumbnails could not be loaded right now. Open the catalogue to see your favourites.';

  /** Transparent 1×1 GIF: an `<img>` that is hidden until the lookup succeeds. */
  const BLANK_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  interface Tile {
    item: ToolkitItem;
    li: HTMLLIElement;
    link: HTMLAnchorElement;
    thumb: HTMLSpanElement;
    img: HTMLImageElement;
    name: HTMLSpanElement;
  }

  let request: AbortController | null = null;
  let generation = 0;

  function safeFilename(title: string): string {
    const cleaned = title.replace(/[\\/:*?"<>|]+/g, '-').trim();
    return cleaned || 'icon';
  }

  function catalogueLink(): string {
    return favouritesUrl;
  }

  function createTile(item: ToolkitItem): Tile {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'myo-favorite';
    link.href = catalogueLink();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${openLabel} — ${item.title}`);

    const thumb = document.createElement('span');
    thumb.className = 'myo-favorite-thumb is-empty';

    const img = document.createElement('img');
    img.src = BLANK_PIXEL;
    img.alt = '';
    img.width = 16;
    img.height = 16;
    img.hidden = true;
    thumb.append(img);

    const name = document.createElement('span');
    name.className = 'myo-favorite-name';
    name.textContent = item.title;

    link.append(thumb, name);
    li.append(link);

    const tile: Tile = { item, li, link, thumb, img, name };

    img.addEventListener(
      'error',
      () => {
        img.hidden = true;
        thumb.classList.add('is-empty');
        link.href = catalogueLink();
        link.removeAttribute('download');
        link.setAttribute('aria-label', `${openLabel} — ${name.textContent ?? item.title}`);
      },
      { once: true },
    );

    return tile;
  }

  function applyMeta(tile: Tile, meta: FavoriteIcon['meta']): void {
    if (!meta) {
      tile.link.href = catalogueLink();
      tile.link.removeAttribute('download');
      tile.link.setAttribute('aria-label', `${openLabel} — ${tile.item.title}`);
      return;
    }

    tile.name.textContent = meta.title;
    tile.img.src = meta.preview;
    tile.img.hidden = false;
    tile.thumb.classList.remove('is-empty');
    tile.link.href = meta.download;
    tile.link.setAttribute('download', `${safeFilename(meta.title)}.png`);
    tile.link.setAttribute('aria-label', `${downloadLabel} — ${meta.title}`);
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
    // Le catalogue reste propriétaire de la liste d'icônes. Tant que la
    // trousse n'a pas reçu de slice `icon` (cas d'un toolkit créé par le
    // portail pour un projet avant l'ajout de favoris), les anciens favoris
    // du catalogue sont la seule source.
    const source = toolkit.items.some((item) => item.type === 'icon')
      ? toolkit.items
      : legacyToolkit().items;
    const iconCount = source.filter((item) => item.type === 'icon').length;
    const items = recentFavoriteIcons(source);

    if (items.length === 0) {
      hideSection();
      return;
    }

    root.hidden = false;
    if (allLink) {
      allLink.href = catalogueLink();
      allLink.textContent = `${seeAllLabel} (${iconCount})`;
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

    const results = await resolveFavoriteIcons(
      items,
      (url, init) => fetch(url, init),
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
