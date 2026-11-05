import { describe, expect, it } from 'vitest';
import { entryUrl, formatEntryDescription, renderJsonFeed, renderRss } from '../scripts/lib/feed';
import type { ChangelogEntry } from '../scripts/lib/types';

const entry: ChangelogEntry = {
  id: 'abc1234',
  date: '2026-11-05T10:00:00.000Z',
  title: 'Add <Louis> & "friends"',
  projects: ['louis', 'yoto-up'],
  areas: ['collections'],
};

const options = {
  siteUrl: 'https://yoto-community.github.io/',
  repoUrl: 'https://github.com/yoto-community/yoto-community.github.io/',
  title: 'Awesome Yoto — Changelog',
  description: 'New and updated projects.',
  projectNames: { louis: 'Louis', 'yoto-up': 'yoto-up' },
};

describe('entryUrl', () => {
  it('links a commit to GitHub', () => {
    expect(entryUrl(entry, options)).toBe(
      'https://github.com/yoto-community/yoto-community.github.io/commit/abc1234',
    );
  });

  it('falls back to a changelog anchor for synthesized entries', () => {
    expect(entryUrl({ ...entry, id: 'added-2026-11-03' }, options)).toBe(
      'https://yoto-community.github.io/changelog/#added-2026-11-03',
    );
  });
});

describe('formatEntryDescription', () => {
  it('names projects and referential areas', () => {
    expect(formatEntryDescription(entry, options.projectNames)).toBe(
      '2 projects changed: Louis, yoto-up. Updated collections.',
    );
  });

  it('truncates long project lists', () => {
    const many = Array.from({ length: 12 }, (_, index) => `p${index}`);
    expect(formatEntryDescription({ ...entry, projects: many, areas: [] }, {})).toBe(
      '12 projects changed: p0, p1, p2, p3, p4, p5, p6, p7 and 4 more.',
    );
  });
});

describe('renderRss', () => {
  it('renders escaped RSS with a self link', () => {
    const rss = renderRss([entry], options);

    expect(rss).toContain('<rss version="2.0"');
    expect(rss).toContain('<title>Add &lt;Louis&gt; &amp; &quot;friends&quot;</title>');
    expect(rss).toContain(
      '<atom:link href="https://yoto-community.github.io/feed.xml" rel="self" type="application/rss+xml" />',
    );
    expect(rss).toContain('<pubDate>Thu, 05 Nov 2026 10:00:00 GMT</pubDate>');
    expect(rss).not.toContain('<Louis>');
  });
});

describe('renderJsonFeed', () => {
  it('renders a valid JSON Feed 1.1 document', () => {
    const feed = JSON.parse(renderJsonFeed([entry], options)) as {
      version: string;
      home_page_url: string;
      items: Array<{ title: string; url: string; content_text: string }>;
    };

    expect(feed.version).toBe('https://jsonfeed.org/version/1.1');
    expect(feed.home_page_url).toBe('https://yoto-community.github.io');
    expect(feed.items[0]).toMatchObject({
      title: 'Add <Louis> & "friends"',
      url: 'https://github.com/yoto-community/yoto-community.github.io/commit/abc1234',
      content_text: '2 projects changed: Louis, yoto-up. Updated collections.',
    });
  });
});
