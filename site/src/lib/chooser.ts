import type { Platform, Project } from '../../../scripts/lib/types';
import type { Lang } from './routes';

export type Goal =
  'youtube' | 'files' | 'podcast' | 'audiobook' | 'backup' | 'automate' | 'develop';
export type Level = 'simple' | 'advanced';
export type ChooserPlatform = Platform | 'self-hosted' | 'any';

export interface ChooserState {
  goal: Goal;
  platform: ChooserPlatform;
  level: Level;
}

/**
 * The subset of a project the chooser needs. The full Project is assignable,
 * and the same shape can be serialised into the page for the client script.
 */
export interface ChooserProject extends Pick<
  Project,
  | 'slug'
  | 'name'
  | 'description'
  | 'category'
  | 'tags'
  | 'platforms'
  | 'requires'
  | 'warning'
  | 'status'
  | 'official'
  | 'meta'
> {
  descriptionFr?: string;
  statusLabel?: string;
}

export type ReasonCode = 'goal' | 'category' | 'platform' | 'simple' | 'official';

export interface Recommendation {
  project: ChooserProject;
  score: number;
  reasons: ReasonCode[];
}

const GOAL_RULES: Record<Goal, { categories: string[]; tags: string[] }> = {
  youtube: { categories: ['create'], tags: ['youtube', 'myo'] },
  files: { categories: ['create'], tags: ['myo', 'audiobook'] },
  podcast: { categories: ['audio'], tags: ['podcast', 'rss'] },
  audiobook: { categories: ['audio', 'create'], tags: ['audiobook'] },
  backup: { categories: ['backup'], tags: [] },
  automate: { categories: ['automate'], tags: [] },
  develop: { categories: ['develop'], tags: [] },
};

const ADVANCED_REQUIRES = new Set(['yoto-api-key', 'self-hosted']);
const DESKTOP_PLATFORMS = new Set(['windows', 'macos', 'linux']);

function worksOn(project: ChooserProject, platform: ChooserPlatform): boolean {
  if (platform === 'any') return true;
  if (platform === 'self-hosted') return project.requires?.includes('self-hosted') ?? false;
  if (project.platforms.includes(platform)) return true;
  if (DESKTOP_PLATFORMS.has(platform)) {
    return project.platforms.includes('web') || project.platforms.includes('cli');
  }
  return false;
}

function isAdvanced(project: ChooserProject): boolean {
  return (
    (project.requires?.some((requirement) => ADVANCED_REQUIRES.has(requirement)) ?? false) ||
    project.platforms.includes('cli') ||
    project.warning === 'experimental'
  );
}

export function scoreProject(project: ChooserProject, state: ChooserState): number {
  const rule = GOAL_RULES[state.goal];
  const goalRelevant =
    rule.categories.includes(project.category) ||
    project.tags.some((tag) => rule.tags.includes(tag));
  let score = 0;
  if (rule.categories.includes(project.category)) score += 4;
  score += project.tags.filter((tag) => rule.tags.includes(tag)).length * 3;
  if (goalRelevant && state.platform !== 'any' && worksOn(project, state.platform)) score += 3;
  if (project.status === 'stale') score -= 5;
  if (state.level === 'simple' && isAdvanced(project)) score -= 3;
  return score;
}

function reasonsFor(project: ChooserProject, state: ChooserState): ReasonCode[] {
  const rule = GOAL_RULES[state.goal];
  const reasons: ReasonCode[] = [];
  if (project.tags.some((tag) => rule.tags.includes(tag))) reasons.push('goal');
  if (rule.categories.includes(project.category)) reasons.push('category');
  if (state.platform !== 'any' && worksOn(project, state.platform)) reasons.push('platform');
  if (state.level === 'simple' && !isAdvanced(project)) reasons.push('simple');
  if (project.official) reasons.push('official');
  return reasons.slice(0, 3);
}

function compare(
  a: { project: ChooserProject; score: number },
  b: { project: ChooserProject; score: number },
): number {
  return (
    b.score - a.score ||
    (b.project.meta?.stars ?? 0) - (a.project.meta?.stars ?? 0) ||
    a.project.name.localeCompare(b.project.name, 'en')
  );
}

export function recommendProjects(
  projects: ChooserProject[],
  state: ChooserState,
  limit = 3,
): Recommendation[] {
  return projects
    .filter((project) => project.status !== 'archived' && project.status !== 'deprecated')
    .map((project) => ({ project, score: scoreProject(project, state) }))
    .filter((entry) => entry.score > 0)
    .sort(compare)
    .slice(0, limit)
    .map((entry) => ({ ...entry, reasons: reasonsFor(entry.project, state) }));
}

export interface ChooserOption<T extends string> {
  id: T;
  label: Record<Lang, string>;
}

export const GOALS: ChooserOption<Goal>[] = [
  { id: 'youtube', label: { en: 'Turn YouTube into a card', fr: 'Transformer YouTube en carte' } },
  {
    id: 'files',
    label: { en: 'Turn audio files into a card', fr: 'Transformer des fichiers audio en carte' },
  },
  {
    id: 'podcast',
    label: { en: 'Turn a podcast into a card', fr: 'Transformer un podcast en carte' },
  },
  {
    id: 'audiobook',
    label: { en: 'Turn an audiobook into a card', fr: 'Transformer un livre audio en carte' },
  },
  { id: 'backup', label: { en: 'Back up my cards', fr: 'Sauvegarder mes cartes' } },
  { id: 'automate', label: { en: 'Automate my player', fr: 'Automatiser mon lecteur' } },
  { id: 'develop', label: { en: 'Build with the API', fr: 'Développer avec l’API' } },
];

export const PLATFORMS: ChooserOption<ChooserPlatform>[] = [
  { id: 'any', label: { en: 'No preference', fr: 'Peu importe' } },
  { id: 'web', label: { en: 'Web browser', fr: 'Navigateur web' } },
  { id: 'windows', label: { en: 'Windows', fr: 'Windows' } },
  { id: 'macos', label: { en: 'macOS', fr: 'macOS' } },
  { id: 'linux', label: { en: 'Linux', fr: 'Linux' } },
  { id: 'android', label: { en: 'Android', fr: 'Android' } },
  { id: 'ios', label: { en: 'iOS', fr: 'iOS' } },
  { id: 'self-hosted', label: { en: 'Self-hosted server', fr: 'Serveur auto-hébergé' } },
];

export const LEVELS: ChooserOption<Level>[] = [
  {
    id: 'simple',
    label: {
      en: 'I don’t want to install anything',
      fr: 'Je ne veux rien installer',
    },
  },
  {
    id: 'advanced',
    label: {
      en: 'I’m comfortable with a terminal',
      fr: 'Je suis à l’aise avec un terminal',
    },
  },
];

export function parseChooserState(search: string): ChooserState | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const goal = GOALS.find((option) => option.id === params.get('goal'))?.id;
  const platform = PLATFORMS.find((option) => option.id === params.get('platform'))?.id;
  const level = LEVELS.find((option) => option.id === params.get('level'))?.id;
  return goal && platform && level ? { goal, platform, level } : null;
}

export function serializeChooserState(state: ChooserState): string {
  return new URLSearchParams({
    goal: state.goal,
    platform: state.platform,
    level: state.level,
  }).toString();
}

const GOAL_NOUNS: Record<Goal, Record<Lang, string>> = {
  youtube: { en: 'YouTube', fr: 'YouTube' },
  files: { en: 'audio files', fr: 'les fichiers audio' },
  podcast: { en: 'podcasts', fr: 'les podcasts' },
  audiobook: { en: 'audiobooks', fr: 'les livres audio' },
  backup: { en: 'backups', fr: 'la sauvegarde' },
  automate: { en: 'automation', fr: 'l’automatisation' },
  develop: { en: 'development', fr: 'le développement' },
};

const PLATFORM_NOUNS: Record<Exclude<ChooserPlatform, 'any'>, Record<Lang, string>> = {
  web: { en: 'the browser', fr: 'le navigateur' },
  windows: { en: 'Windows', fr: 'Windows' },
  macos: { en: 'macOS', fr: 'macOS' },
  linux: { en: 'Linux', fr: 'Linux' },
  android: { en: 'Android', fr: 'Android' },
  ios: { en: 'iOS', fr: 'iOS' },
  cli: { en: 'the terminal', fr: 'le terminal' },
  'home-assistant': { en: 'Home Assistant', fr: 'Home Assistant' },
  hardware: { en: 'dedicated hardware', fr: 'un matériel dédié' },
  api: { en: 'the API', fr: 'l’API' },
  'self-hosted': { en: 'your own server', fr: 'votre serveur' },
};

export function reasonLabels(rec: Recommendation, state: ChooserState, lang: Lang): string[] {
  return rec.reasons.map((reason) => {
    switch (reason) {
      case 'goal':
        return lang === 'fr'
          ? `Pensé pour ${GOAL_NOUNS[state.goal].fr}`
          : `Made for ${GOAL_NOUNS[state.goal].en}`;
      case 'category':
        return lang === 'fr' ? 'Adapté à cette tâche' : 'Fits this task';
      case 'platform': {
        const platform = state.platform;
        if (platform === 'any') return lang === 'fr' ? 'Compatible' : 'Compatible';
        if (platform === 'web') {
          return lang === 'fr' ? 'Fonctionne dans le navigateur' : 'Runs in the browser';
        }
        const noun = PLATFORM_NOUNS[platform][lang];
        return lang === 'fr' ? `Fonctionne sur ${noun}` : `Works on ${noun}`;
      }
      case 'simple':
        return lang === 'fr' ? 'Sans terminal ni clé API' : 'No terminal or API key';
      case 'official':
        return lang === 'fr' ? 'Outil officiel Yoto' : 'Official Yoto tool';
    }
  });
}

export function goalFilterHref(goal: Goal, base = '/projects/'): string {
  const rule = GOAL_RULES[goal];
  const params = new URLSearchParams();
  if (rule.categories[0]) params.set('cat', rule.categories[0]);
  if (rule.tags[0]) params.set('tag', rule.tags[0]);
  return `${base}?${params.toString()}`;
}

export function projectsFilterHref(state: ChooserState, base = '/projects/'): string {
  return goalFilterHref(state.goal, base);
}

const MYO_STEPS: Partial<Record<Goal, number>> = {
  youtube: 1,
  files: 2,
  podcast: 1,
  audiobook: 1,
};

export function myoStep(goal: Goal): number | undefined {
  return MYO_STEPS[goal];
}
