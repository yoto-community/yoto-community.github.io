import type { Category, Collection, Project } from './types';

export interface ReadmeContext {
  categories: Category[];
  projects: Project[];
  collections: Collection[];
}

export function anchor(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-');
}

function escapeInline(value: string): string {
  return value.replace(/([\\[\]()])/g, '\\$1');
}

const STATUS_SUFFIX: Partial<Record<Project['status'], (project: Project) => string>> = {
  stale: () => ' *(stale)*',
  archived: () => ' *(archived)*',
  deprecated: (project) => ` *(deprecated: ${escapeInline(project.deprecatedBy ?? '')})*`,
};

function entry(project: Project): string {
  const suffix = STATUS_SUFFIX[project.status]?.(project) ?? '';
  return `- [${escapeInline(project.name)}](${project.url}) - ${escapeInline(project.description)}${suffix}`;
}

export function renderReadme({ categories, projects }: ReadmeContext): string {
  const sections = categories.map((category) => ({
    title: category.label.en,
    lines: projects
      .filter((project) => project.category === category.slug)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry),
  }));

  const contents = ['Start here', ...sections.map((section) => section.title), 'French resources']
    .map((title) => `- [${title}](#${anchor(title)})`)
    .join('\n');

  const body = sections
    .map((section) => `## ${section.title}\n\n${section.lines.join('\n')}`)
    .join('\n\n');

  return `# Awesome Yoto [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of apps, tools and resources for the Yoto Player.

[Open the portal](https://yoto-community.github.io/).

## Contents

${contents}

## Start here

- [Build your first MYO card](https://yoto-community.github.io/myo/) - The six-step guide from audio to printed label.
- [Browse all projects](https://yoto-community.github.io/projects/) - Filter by category, status, platform and language.
- [Read the API documentation](https://yoto-community.github.io/api/) - The static JSON behind the portal.

${body}

## French resources

The interface and descriptions are available in French on the [French portal](https://yoto-community.github.io/fr/). The podcast catalogue also has a [French section](https://yoto-community.github.io/podcast-catalogue/fr/).

## Contributing

Found a project that belongs here? Read [CONTRIBUTING.md](CONTRIBUTING.md) and open a pull request. Entries are validated by CI: schema, duplicates, categories and tags. Links are checked weekly.

Released under the [MIT license](LICENSE). Awesome Yoto is a community project, not affiliated with Yoto.
`;
}
