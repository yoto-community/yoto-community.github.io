import { urlsEqual } from '../../../scripts/lib/url';
import type { Project } from '../../../scripts/lib/types';

export interface ProjectActions {
  showWebsite: boolean;
  showRepo: boolean;
  primary: 'website' | 'repo';
}

/**
 * Most GitHub-hosted projects use the repository as their website. Showing both
 * buttons would send visitors to the same page, so the repository becomes the
 * single primary action in that case.
 */
export function projectActions(project: Pick<Project, 'url' | 'repo'>): ProjectActions {
  const hasRepo = Boolean(project.repo);
  const distinctRepo = hasRepo && !urlsEqual(project.url, project.repo as string);
  const repoIsPrimary = hasRepo && !distinctRepo;

  return {
    showWebsite: !hasRepo || distinctRepo,
    showRepo: hasRepo,
    primary: repoIsPrimary ? 'repo' : 'website',
  };
}
