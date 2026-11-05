import { execFileSync } from 'node:child_process';
import type { Changelog, ChangelogArea, ChangelogEntry, Project } from './types';

const AREA_FILES: Record<string, ChangelogArea> = {
  'data/categories.yml': 'categories',
  'data/tags.yml': 'tags',
  'data/collections.yml': 'collections',
};

const MAX_ENTRIES = 100;

type ProjectRef = Pick<Project, 'slug' | 'added'>;

/**
 * Parses the output of `git log --pretty=format:%x1e%H%x1f%cI%x1f%s --name-only`.
 * Each record starts with a unit separator, then the commit header, then the
 * files it touched.
 */
export function parseGitLog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];

  for (const chunk of raw.split('\x1e')) {
    const lines = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const header = lines.shift();
    if (!header) continue;

    const [id, date, title] = header.split('\x1f');
    if (!id || !date || !title) continue;

    const projects = new Set<string>();
    const areas = new Set<ChangelogArea>();
    for (const file of lines) {
      const project = /^data\/projects\/([^/]+)\.yml$/.exec(file)?.[1];
      if (project) {
        projects.add(project);
        continue;
      }
      const area = AREA_FILES[file];
      if (area) areas.add(area);
    }

    if (projects.size === 0 && areas.size === 0) continue;

    entries.push({
      id,
      date,
      title,
      projects: [...projects].sort(),
      areas: [...areas],
    });
  }

  return entries;
}

/**
 * Last-resort changelog used when git history is unavailable (for example a
 * shallow archive export). It groups projects by their editorial `added` date.
 */
export function fallbackEntries(projects: ProjectRef[]): ChangelogEntry[] {
  const byDate = new Map<string, string[]>();
  for (const project of projects) {
    const slugs = byDate.get(project.added) ?? [];
    slugs.push(project.slug);
    byDate.set(project.added, slugs);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, slugs]) => {
      const sorted = [...slugs].sort();
      const entry: ChangelogEntry = {
        id: `added-${date}`,
        date: `${date}T12:00:00.000Z`,
        title: `Add ${sorted.length} project${sorted.length === 1 ? '' : 's'}`,
        projects: sorted,
        areas: [],
      };
      return entry;
    });
}

export function buildChangelog(root: string, projects: ProjectRef[]): Changelog {
  let entries: ChangelogEntry[] = [];

  try {
    const raw = execFileSync(
      'git',
      [
        'log',
        '--no-merges',
        '-n',
        String(MAX_ENTRIES),
        '--pretty=format:%x1e%H%x1f%cI%x1f%s',
        '--name-only',
        '--',
        'data/projects',
        'data/categories.yml',
        'data/tags.yml',
        'data/collections.yml',
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    entries = parseGitLog(raw);
  } catch {
    // No git, shallow checkout, or not a repository: fall back to `added`.
  }

  if (entries.length === 0) entries = fallbackEntries(projects);

  return { generatedAt: new Date().toISOString(), entries };
}
