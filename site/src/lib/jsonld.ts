import type { Project } from '../../../scripts/lib/types';

/**
 * Serializes JSON-LD so it can be inlined into a `<script>` element without
 * letting data close the tag or open new markup.
 */
export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function projectJsonLd(
  project: Project,
  url: string,
  description = project.description,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.name,
    description,
    url,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: project.platforms.join(', '),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(project.repo ? { codeRepository: project.repo } : {}),
  };
}

export function listJsonLd(projects: Project[], url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url,
    numberOfItems: projects.length,
    itemListElement: projects.map((project, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: project.name,
      url: project.url,
    })),
  };
}
