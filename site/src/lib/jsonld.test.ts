import { describe, expect, it } from 'vitest';
import { jsonLdScript, listJsonLd, projectJsonLd } from './jsonld';
import type { Project } from '../../../scripts/lib/types';

const project = {
  slug: 'louis',
  name: 'Louis',
  url: 'https://github.com/stuartromanek/louis',
  repo: 'https://github.com/stuartromanek/louis',
  description: 'Turn YouTube into a card.',
  category: 'create',
  tags: ['youtube'],
  author: 'Stuart Romanek',
  license: 'MIT',
  status: 'active',
  official: false,
  platforms: ['web'],
  added: '2026-11-03',
} as Project;

describe('projectJsonLd', () => {
  it('describes a free SoftwareApplication', () => {
    const jsonLd = projectJsonLd(project, 'https://yoto-community.github.io/p/louis/');
    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Louis',
      url: 'https://yoto-community.github.io/p/louis/',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      codeRepository: 'https://github.com/stuartromanek/louis',
    });
  });

  it('omits codeRepository when there is no repo', () => {
    const { repo: _repo, ...withoutRepo } = project;
    expect(projectJsonLd(withoutRepo as Project, 'https://example.com/')).not.toHaveProperty(
      'codeRepository',
    );
  });

  it('uses the given description verbatim', () => {
    expect(
      projectJsonLd(project, 'https://yoto-community.github.io/fr/p/louis/', 'Une carte YouTube.'),
    ).toMatchObject({ description: 'Une carte YouTube.' });
  });
});

describe('listJsonLd', () => {
  it('numbers the items from one', () => {
    const jsonLd = listJsonLd([project], 'https://yoto-community.github.io/projects/') as {
      '@context': string;
      '@type': string;
      url: string;
      numberOfItems: number;
      itemListElement: Array<{ position: number }>;
    };
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('ItemList');
    expect(jsonLd.url).toBe('https://yoto-community.github.io/projects/');
    expect(jsonLd.numberOfItems).toBe(1);
    expect(jsonLd.itemListElement.map((item) => item.position)).toEqual([1]);
  });

  it('increments positions across items', () => {
    const jsonLd = listJsonLd(
      [project, { ...project, slug: 'other', name: 'Other' }],
      'https://yoto-community.github.io/projects/',
    ) as { numberOfItems: number; itemListElement: Array<{ position: number }> };
    expect(jsonLd.numberOfItems).toBe(2);
    expect(jsonLd.itemListElement.map((item) => item.position)).toEqual([1, 2]);
  });
});

describe('jsonLdScript', () => {
  it('escapes script-breaking characters', () => {
    const data = listJsonLd(
      [{ ...project, name: '</script><img onerror=x>', description: 'a & b' }],
      'https://example.com/',
    );
    const serialized = jsonLdScript(data);
    expect(serialized).not.toContain('</script');
    expect(serialized).not.toContain('<img');
    expect(serialized).not.toContain('&');
    expect(JSON.parse(serialized).itemListElement[0].name).toBe('</script><img onerror=x>');
  });

  it('produces JSON that round-trips unchanged', () => {
    const data = projectJsonLd(project, 'https://yoto-community.github.io/p/louis/');
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });
});
