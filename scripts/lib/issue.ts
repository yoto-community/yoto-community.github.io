import { slugify } from './slug';
import type { ProjectFile } from './types';

const EMPTY = new Set(['', '_No response_']);

const LABELS = [
  'name',
  'url',
  'repository',
  'description',
  'french description',
  'category',
  'tags',
  'platforms',
  'official',
  'author',
  'license',
];

const escape = (label: string) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HEADING = `^### (${LABELS.map(escape).join('|')})\\s*$`;

export function parseIssueForm(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // Only the form's own headings split fields: a "### Features" typed inside a
  // description stays part of that description instead of becoming a field.
  const matches = [...body.matchAll(new RegExp(HEADING, 'gim'))];

  for (const [index, match] of matches.entries()) {
    const label = match[1]?.trim().toLowerCase();
    if (!label) continue;
    const start = (match.index ?? 0) + match[0].length;
    const next = matches[index + 1];
    const value = body.slice(start, next?.index ?? body.length).trim();
    fields[label] = EMPTY.has(value) ? '' : value;
  }

  return fields;
}

const KNOWN_CATEGORIES = new Set([
  'official',
  'create',
  'icons',
  'audio',
  'automate',
  'develop',
  'backup',
  'hardware',
  'learn',
]);

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function projectFromIssue(
  fields: Record<string, string>,
  today: string,
): { slug: string; data: ProjectFile } {
  const name = fields.name?.trim() ?? '';
  if (!name) throw new Error('name is required');
  const slug = slugify(name);
  const category = fields.category?.trim() ?? '';
  if (!KNOWN_CATEGORIES.has(category)) throw new Error(`unknown category "${category}"`);

  const repository = fields.repository?.trim() ?? '';
  const descriptionFr = fields['french description']?.trim() ?? '';
  // Every entry ships a French description (pnpm check:fr enforces it), so the
  // submission workflow refuses to open a pull request without one.
  if (!descriptionFr) throw new Error('french description is required');

  const data = {
    name,
    url: fields.url?.trim() ?? '',
    ...(repository ? { repo: repository } : {}),
    description: fields.description?.trim() ?? '',
    descriptionFr,
    category,
    tags: list(fields.tags),
    author: fields.author?.trim() || 'Unknown',
    license: fields.license?.trim() || 'Unknown',
    status: 'active',
    official: /^yes$/i.test(fields.official?.trim() ?? ''),
    platforms: list(fields.platforms),
    added: today,
  } as ProjectFile;

  return { slug, data };
}
