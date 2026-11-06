import type { Project } from '../../../scripts/lib/types';

export type Sort = 'category' | 'recent' | 'stars' | 'alpha';

export interface FilterState {
  q: string;
  category: string;
  status: string;
  platform: string;
  tag: string;
  official: boolean;
  french: boolean;
  inactive: boolean;
  toolkit: boolean;
  sort: Sort;
}

const SORTS: Sort[] = ['category', 'recent', 'stars', 'alpha'];
const HIDDEN_BY_DEFAULT = new Set<Project['status']>(['stale', 'archived', 'deprecated']);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function parseFilters(search: string): FilterState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sort = params.get('sort') as Sort | null;
  return {
    q: params.get('q') ?? '',
    category: params.get('cat') ?? '',
    status: params.get('status') ?? '',
    platform: params.get('platform') ?? '',
    tag: params.get('tag') ?? '',
    official: params.get('official') === '1',
    french: params.get('fr') === '1',
    inactive: params.get('inactive') === '1',
    toolkit: params.get('toolkit') === '1',
    sort: sort && SORTS.includes(sort) ? sort : 'category',
  };
}

export function serializeFilters(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('cat', state.category);
  if (state.status) params.set('status', state.status);
  if (state.platform) params.set('platform', state.platform);
  if (state.tag) params.set('tag', state.tag);
  if (state.official) params.set('official', '1');
  if (state.french) params.set('fr', '1');
  if (state.inactive) params.set('inactive', '1');
  if (state.toolkit) params.set('toolkit', '1');
  if (state.sort !== 'category') params.set('sort', state.sort);
  return params.toString();
}

export function filterProjects(
  projects: Project[],
  state: FilterState,
  toolkitIds?: ReadonlySet<string>,
): Project[] {
  const query = normalize(state.q.trim());
  const toolkit = state.toolkit ? (toolkitIds ?? new Set<string>()) : null;
  return projects.filter((project) => {
    if (toolkit && !toolkit.has(project.slug)) return false;
    if (state.category && project.category !== state.category) return false;
    if (state.status) {
      if (project.status !== state.status) return false;
    } else if (!state.inactive && HIDDEN_BY_DEFAULT.has(project.status)) {
      return false;
    }
    if (
      state.platform &&
      !project.platforms.includes(state.platform as Project['platforms'][number])
    )
      return false;
    if (state.tag && !project.tags.includes(state.tag)) return false;
    if (state.official && !project.official) return false;
    if (state.french && !project.descriptionFr) return false;
    if (query) {
      const haystack = normalize(
        [project.name, project.description, project.descriptionFr ?? ''].join(' '),
      );
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortProjects(projects: Project[], sort: Sort): Project[] {
  const copy = [...projects];
  switch (sort) {
    case 'recent':
      return copy.sort((a, b) => b.added.localeCompare(a.added));
    case 'stars':
      return copy.sort((a, b) => (b.meta?.stars ?? 0) - (a.meta?.stars ?? 0));
    case 'alpha':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}
