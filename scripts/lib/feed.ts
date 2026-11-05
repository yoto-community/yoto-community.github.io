import type { ChangelogEntry } from './types';

export interface FeedOptions {
  siteUrl: string;
  repoUrl: string;
  title: string;
  description: string;
  projectNames?: Record<string, string>;
}

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '');

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isoDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function rfc822Date(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

export function entryUrl(entry: ChangelogEntry, options: FeedOptions): string {
  const siteUrl = withoutTrailingSlash(options.siteUrl);
  const repoUrl = withoutTrailingSlash(options.repoUrl);
  return /^[0-9a-f]{7,40}$/i.test(entry.id)
    ? `${repoUrl}/commit/${entry.id}`
    : `${siteUrl}/changelog/#${entry.id}`;
}

export function formatEntryDescription(
  entry: ChangelogEntry,
  projectNames: Record<string, string> = {},
): string {
  const parts: string[] = [];
  const names = entry.projects.map((slug) => projectNames[slug] ?? slug);

  if (names.length > 0) {
    const shown = names.slice(0, 8);
    const rest = names.length - shown.length;
    parts.push(
      `${names.length} project${names.length === 1 ? '' : 's'} changed: ${shown.join(', ')}${
        rest > 0 ? ` and ${rest} more` : ''
      }.`,
    );
  }

  if (entry.areas.length > 0) {
    parts.push(`Updated ${entry.areas.join(', ')}.`);
  }

  return parts.join(' ');
}

export function renderRss(entries: ChangelogEntry[], options: FeedOptions): string {
  const siteUrl = withoutTrailingSlash(options.siteUrl);
  const projectNames = options.projectNames ?? {};
  const items = entries
    .map((entry) => {
      const url = entryUrl(entry, options);
      return `
    <item>
      <title>${xmlEscape(entry.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <pubDate>${rfc822Date(entry.date)}</pubDate>
      <description>${xmlEscape(formatEntryDescription(entry, projectNames))}</description>
    </item>`;
    })
    .join('');

  const lastBuildDate = rfc822Date(entries[0]?.date ?? new Date().toISOString());

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(options.title)}</title>
    <link>${xmlEscape(siteUrl)}</link>
    <description>${xmlEscape(options.description)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${xmlEscape(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

export function renderJsonFeed(entries: ChangelogEntry[], options: FeedOptions): string {
  const siteUrl = withoutTrailingSlash(options.siteUrl);
  const projectNames = options.projectNames ?? {};

  return `${JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: options.title,
      home_page_url: siteUrl,
      feed_url: `${siteUrl}/feed.json`,
      description: options.description,
      language: 'en',
      items: entries.map((entry) => ({
        id: entry.id,
        url: entryUrl(entry, options),
        title: entry.title,
        content_text: formatEntryDescription(entry, projectNames),
        date_published: isoDate(entry.date),
      })),
    },
    null,
    2,
  )}\n`;
}
