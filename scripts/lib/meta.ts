import type { ProjectMeta, Status } from './types';

interface GitHubRepo {
  stargazers_count?: number;
  pushed_at?: string;
  archived?: boolean;
  license?: { spdx_id?: string } | null;
}

export function repoFromUrl(url: string): { owner: string; repo: string } | null {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2] };
}

export function metaFromApi(json: unknown): ProjectMeta {
  const repo = json as GitHubRepo;
  return {
    stars: repo.stargazers_count ?? 0,
    lastCommit: repo.pushed_at?.slice(0, 10),
    archived: repo.archived ?? false,
    licenseDetected: repo.license?.spdx_id === 'NOASSERTION' ? undefined : repo.license?.spdx_id,
  };
}

export function suggestStatus(meta: ProjectMeta, today: string): Status {
  if (meta.archived) return 'archived';
  if (!meta.lastCommit) return 'active';
  const days = (Date.parse(today) - Date.parse(meta.lastCommit)) / 86_400_000;
  // Guard against NaN in days calculation
  if (isNaN(days)) return 'active';
  if (days < 183) return 'active';
  if (days < 365) return 'maintained';
  return 'stale';
}
