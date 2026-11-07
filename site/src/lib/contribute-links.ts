import { REPO_URL } from './site';

/** The GitHub web editor for a project entry. Main is the only editable branch. */
export function editProjectUrl(slug: string): string {
  return `${REPO_URL}/edit/main/data/projects/${encodeURIComponent(slug)}.yml`;
}

/**
 * Prefills the translation issue form. GitHub maps query parameters to the
 * issue-form field ids, so `slug` and `title` land in the right inputs.
 */
export function translateProjectUrl(slug: string, name: string): string {
  const params = new URLSearchParams({
    template: 'translate-project.yml',
    title: `[Translation]: ${name}`,
    slug,
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
