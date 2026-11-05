import {
  filterProjects,
  parseFilters,
  serializeFilters,
  sortProjects,
  type FilterState,
  type Sort,
} from '../lib/filter';
import type { Project } from '../../../scripts/lib/types';

const MANAGED = ['q', 'cat', 'status', 'platform', 'tag', 'official', 'fr', 'inactive', 'sort'];
const SORTS: Sort[] = ['category', 'recent', 'stars', 'alpha'];
const EMPTY: FilterState = {
  q: '',
  category: '',
  status: '',
  platform: '',
  tag: '',
  official: false,
  french: false,
  inactive: false,
  sort: 'category',
};

const form = document.querySelector<HTMLFormElement>('[data-filters]');
const grid = document.querySelector<HTMLElement>('[data-grid]');
const count = document.querySelector<HTMLElement>('[data-count]');
const empty = document.querySelector<HTMLElement>('[data-empty]');

if (form && grid) {
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-project]')];
  const bySlug = new Map(cards.map((card) => [card.dataset.slug ?? '', card]));
  const projects = cards.map((card) => ({
    slug: card.dataset.slug ?? '',
    name: card.dataset.name ?? '',
    description: card.dataset.description ?? '',
    category: card.dataset.category ?? '',
    status: card.dataset.status ?? '',
    tags: (card.dataset.tags ?? '').split(' ').filter(Boolean),
    platforms: (card.dataset.platforms ?? '').split(' ').filter(Boolean),
    official: card.dataset.official === '1',
    descriptionFr: card.dataset.french === '1' ? 'x' : undefined,
    added: card.dataset.added ?? '',
    meta: { stars: Number(card.dataset.stars ?? 0) },
  })) as unknown as Project[];

  let state = parseFilters(window.location.search);

  const writeUrl = (next: FilterState) => {
    const params = new URLSearchParams(window.location.search);
    for (const key of MANAGED) params.delete(key);
    for (const [key, value] of new URLSearchParams(serializeFilters(next))) {
      params.set(key, value);
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  };

  const apply = () => {
    const visible = sortProjects(filterProjects(projects, state), state.sort);
    const slugs = new Set(visible.map((project) => project.slug));
    for (const card of cards) card.hidden = !slugs.has(card.dataset.slug ?? '');
    for (const project of visible) {
      const card = bySlug.get(project.slug);
      if (card) grid.append(card);
    }
    if (empty) {
      grid.append(empty);
      empty.hidden = visible.length > 0;
    }
    if (count) {
      const label = visible.length === 1 ? count.dataset.one : count.dataset.many;
      count.textContent = `${visible.length} ${label ?? ''}`.trim();
    }
    writeUrl(state);
  };

  const setValue = (name: string, value: string) => {
    const element = form.elements.namedItem(name);
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.value = value;
    }
  };

  const setChecked = (name: string, checked: boolean) => {
    const element = form.elements.namedItem(name);
    if (element instanceof HTMLInputElement) element.checked = checked;
  };

  const sync = () => {
    setValue('q', state.q);
    setValue('cat', state.category);
    setValue('status', state.status);
    setValue('platform', state.platform);
    setValue('tag', state.tag);
    setValue('sort', state.sort);
    setChecked('official', state.official);
    setChecked('fr', state.french);
    setChecked('inactive', state.inactive);
  };

  const fieldValue = (name: string) => {
    const element = form.elements.namedItem(name);
    return element instanceof HTMLInputElement || element instanceof HTMLSelectElement
      ? element.value
      : '';
  };

  const fieldChecked = (name: string) => {
    const element = form.elements.namedItem(name);
    return element instanceof HTMLInputElement && element.checked;
  };

  const readForm = (): FilterState => {
    const sortField = form.elements.namedItem('sort');
    const sort = sortField instanceof HTMLSelectElement ? sortField.value : 'category';
    return {
      q: fieldValue('q'),
      category: fieldValue('cat'),
      status: fieldValue('status'),
      platform: fieldValue('platform'),
      tag: fieldValue('tag'),
      official: fieldChecked('official'),
      french: fieldChecked('fr'),
      inactive: fieldChecked('inactive'),
      sort: SORTS.find((option) => option === sort) ?? 'category',
    };
  };

  form.addEventListener('input', () => {
    state = readForm();
    apply();
  });

  form.addEventListener('reset', () => {
    state = { ...EMPTY };
    requestAnimationFrame(() => {
      sync();
      apply();
    });
  });

  sync();
  apply();
}
