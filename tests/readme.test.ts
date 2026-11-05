import { describe, expect, it } from 'vitest';
import { anchor, renderReadme } from '../scripts/lib/readme';
import type { Category, Collection, Project } from '../scripts/lib/types';

const categories: Category[] = [
  {
    slug: 'official',
    label: { en: 'Official', fr: 'Officiel' },
    description: { en: 'Official resources.', fr: 'Ressources officielles.' },
    icon: 'badge-check',
    order: 10,
  },
  {
    slug: 'create',
    label: { en: 'Make Your Own', fr: 'Créer une carte' },
    description: { en: 'Build cards.', fr: 'Créer des cartes.' },
    icon: 'cards',
    order: 20,
  },
];

const projects: Project[] = [
  {
    slug: 'yoto',
    name: 'Yoto',
    url: 'https://yotoplay.com/',
    description: 'The official Yoto website and player companion app.',
    category: 'official',
    tags: ['kids'],
    author: 'Yoto',
    license: 'Proprietary',
    status: 'active',
    official: true,
    platforms: ['web'],
    added: '2026-11-03',
  },
  {
    slug: 'louis',
    name: 'Louis',
    url: 'https://github.com/stuartromanek/louis',
    description: 'Turn a YouTube playlist into a Yoto MYO card.',
    category: 'create',
    tags: ['youtube'],
    author: 'Stuart Romanek',
    license: 'MIT',
    status: 'active',
    official: false,
    platforms: ['web'],
    added: '2026-11-03',
  },
];

const collections: Collection[] = [];

describe('anchor', () => {
  it('matches GitHub heading slugs', () => {
    expect(anchor('Make Your Own')).toBe('make-your-own');
    expect(anchor("Editor's picks")).toBe('editors-picks');
  });

  it('matches GitHub slugs for titles with ampersands', () => {
    expect(anchor('Icons & design')).toBe('icons--design');
  });
});

describe('renderReadme', () => {
  it('renders a deterministic awesome-lint-friendly README', () => {
    expect(renderReadme({ categories, projects, collections }))
      .toBe(`# Awesome Yoto [![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of apps, tools and resources for the Yoto Player.

[Open the portal](https://yoto-community.github.io/).

## Contents

- [Start here](#start-here)
- [Official](#official)
- [Make Your Own](#make-your-own)
- [French resources](#french-resources)

## Start here

- [Build your first MYO card](https://yoto-community.github.io/myo/) - The five-step guide from audio to printed label.
- [Browse all projects](https://yoto-community.github.io/projects/) - Filter by category, status, platform and language.
- [Read the API documentation](https://yoto-community.github.io/api/) - The static JSON behind the portal.

## Official

- [Yoto](https://yotoplay.com/) - The official Yoto website and player companion app.

## Make Your Own

- [Louis](https://github.com/stuartromanek/louis) - Turn a YouTube playlist into a Yoto MYO card.

## French resources

The interface and descriptions are available in French on the [French portal](https://yoto-community.github.io/fr/). The podcast catalogue also has a [French section](https://yoto-community.github.io/podcast-catalogue/fr/).

## Contributing

Found a project that belongs here? Read [CONTRIBUTING.md](CONTRIBUTING.md) and open a pull request. Entries are validated by CI: schema, duplicates, categories and tags. Links are checked weekly.

Released under the [MIT license](LICENSE). Awesome Yoto is a community project, not affiliated with Yoto.
`);
  });

  it('marks stale and deprecated entries', () => {
    const marked = projects.map((project) =>
      project.slug === 'louis'
        ? { ...project, status: 'deprecated' as const, deprecatedBy: 'Some replacement' }
        : project,
    );
    const output = renderReadme({ categories, projects: marked, collections });
    expect(output).toContain('*(deprecated: Some replacement)*');
  });

  it('escapes Markdown control characters in descriptions', () => {
    const tricky = projects.map((project) =>
      project.slug === 'louis'
        ? { ...project, description: 'Export cards [beta] (experimental).' }
        : project,
    );
    const output = renderReadme({ categories, projects: tricky, collections });
    expect(output).toContain(
      '- [Louis](https://github.com/stuartromanek/louis) - Export cards \\[beta\\] \\(experimental\\).',
    );
  });

  it('escapes Markdown control characters in the deprecatedBy suffix', () => {
    const marked = projects.map((project) =>
      project.slug === 'louis'
        ? { ...project, status: 'deprecated' as const, deprecatedBy: 'Fork (v2)' }
        : project,
    );
    const output = renderReadme({ categories, projects: marked, collections });
    expect(output).toContain('*(deprecated: Fork \\(v2\\))*');
  });
});
