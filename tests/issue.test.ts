import { describe, expect, it } from 'vitest';
import { parseIssueForm, projectFromIssue } from '../scripts/lib/issue';

const body = `### Name

Louis

### URL

https://github.com/stuartromanek/louis

### Repository

https://github.com/stuartromanek/louis

### Description

Turn a YouTube playlist into a Yoto MYO card, with automatic splitting.

### Category

create

### Tags

youtube, web

### Platforms

web

### Official

No

### French description

Transforme une playlist YouTube en carte MYO Yoto.`;

describe('parseIssueForm', () => {
  it('maps every heading to its value', () => {
    const fields = parseIssueForm(body);
    expect(fields.name).toBe('Louis');
    expect(fields.category).toBe('create');
    expect(fields.repository).toBe('https://github.com/stuartromanek/louis');
  });

  it('treats _No response_ as empty', () => {
    expect(parseIssueForm('### Repository\n\n_No response_').repository).toBe('');
  });

  it('keeps a description that contains a markdown heading', () => {
    const withHeading = body.replace(
      'with automatic splitting.',
      'with automatic splitting.\n\n### Features\n- splitting\n- icons',
    );
    const fields = parseIssueForm(withHeading);
    expect(fields.description).toBe(
      'Turn a YouTube playlist into a Yoto MYO card, with automatic splitting.\n\n### Features\n- splitting\n- icons',
    );
    expect(fields).not.toHaveProperty('features');
    expect(fields.category).toBe('create');
  });
});

describe('projectFromIssue', () => {
  it('builds a valid project file', () => {
    const { slug, data } = projectFromIssue(parseIssueForm(body), '2026-11-03');
    expect(slug).toBe('louis');
    expect(data).toMatchObject({
      name: 'Louis',
      category: 'create',
      tags: ['youtube', 'web'],
      platforms: ['web'],
      official: false,
      status: 'active',
      added: '2026-11-03',
    });
  });

  it('maps repository and french description to their file keys', () => {
    const { data } = projectFromIssue(parseIssueForm(body), '2026-11-03');
    expect(data.repo).toBe('https://github.com/stuartromanek/louis');
    expect(data.descriptionFr).toBe('Transforme une playlist YouTube en carte MYO Yoto.');
  });

  it('splits tags and platforms on commas and newlines', () => {
    const fields = {
      ...parseIssueForm(body),
      tags: 'youtube,\nmqtt, api',
      platforms: 'web, home-assistant',
    };
    const { data } = projectFromIssue(fields, '2026-11-03');
    expect(data.tags).toEqual(['youtube', 'mqtt', 'api']);
    expect(data.platforms).toEqual(['web', 'home-assistant']);
  });

  it('rejects an unknown category', () => {
    expect(() =>
      projectFromIssue({ ...parseIssueForm(body), category: 'nope' }, '2026-11-03'),
    ).toThrow('unknown category');
  });

  it('rejects a submission without a French description', () => {
    const fields = { ...parseIssueForm(body), 'french description': '' };
    expect(() => projectFromIssue(fields, '2026-11-03')).toThrow('french description is required');
  });
});
