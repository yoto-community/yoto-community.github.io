import { validateProjectFile } from './schema';
import { normalizeUrl } from './url';
import type { ProjectFile } from './types';

export interface ProjectEntry {
  slug: string;
  data: unknown;
}

export interface CollectionEntry {
  slug: string;
  items: string[];
}

export interface RepositoryInput {
  today: string;
  categories: string[];
  tags: string[];
  collections: CollectionEntry[];
  projects: ProjectEntry[];
}

const URL_KEYS: Array<keyof ProjectFile> = ['url', 'repo'];

const SHORTENERS = new Set([
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
]);

function isPrivateHost(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '');
  if (bare === 'localhost' || bare.endsWith('.local')) return true;
  if (bare === '::1') return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(bare)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f]:/i.test(bare)) return true; // fe80::/10
  if (/^::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(bare)) return true;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254)
  );
}

function safeNormalize(value: string): string | null {
  try {
    return normalizeUrl(value);
  } catch {
    return null;
  }
}

export function validateRepository(input: RepositoryInput): Map<string, string[]> {
  const errors = new Map<string, string[]>();
  const add = (key: string, message: string) => {
    const list = errors.get(key) ?? [];
    list.push(message);
    errors.set(key, list);
  };

  // Validate uniqueness of categories in input
  const categorySlugs = new Set<string>();
  const seenCategoryErrors = new Set<string>();
  for (const slug of input.categories) {
    if (categorySlugs.has(slug)) {
      if (!seenCategoryErrors.has(slug)) {
        add(`category:${slug}`, 'duplicate category slug');
        seenCategoryErrors.add(slug);
      }
    } else {
      categorySlugs.add(slug);
    }
  }

  const tags = new Set(input.tags);
  const projectsBySlug = new Map<string, ProjectFile>();
  const names = new Map<string, string>();
  const urls = new Map<string, string>();

  // Validate uniqueness of collections in input
  const collectionSlugs = new Set<string>();
  const seenCollectionErrors = new Set<string>();
  for (const collection of input.collections) {
    if (collectionSlugs.has(collection.slug)) {
      if (!seenCollectionErrors.has(collection.slug)) {
        add(`collection:${collection.slug}`, 'duplicate collection slug');
        seenCollectionErrors.add(collection.slug);
      }
    } else {
      collectionSlugs.add(collection.slug);
    }
  }

  for (const entry of input.projects) {
    const schemaErrors = validateProjectFile(entry.data);
    if (schemaErrors.length > 0) {
      for (const message of schemaErrors) add(entry.slug, message);
      continue;
    }
    const data = entry.data as ProjectFile;
    if (!input.categories.includes(data.category))
      add(entry.slug, `unknown category "${data.category}"`);
    for (const tag of data.tags) {
      if (!tags.has(tag)) add(entry.slug, `unknown tag "${tag}"`);
    }
    if (!/^[a-z0-9-]+$/.test(entry.slug)) {
      add(entry.slug, 'slug must be kebab-case');
    }
    if (data.added > input.today) add(entry.slug, 'added date is in the future');

    const nameKey = data.name.trim().toLowerCase();
    const owner = names.get(nameKey);
    if (owner && owner !== entry.slug) add(entry.slug, `duplicate name with "${owner}"`);
    else names.set(nameKey, entry.slug);

    // Check duplicate URLs after normalization
    for (const urlKey of URL_KEYS) {
      const value = data[urlKey];
      if (typeof value !== 'string') continue;

      // Normalize URL for comparison
      const normalizedValue = safeNormalize(value);
      if (!normalizedValue) {
        add(entry.slug, `invalid ${urlKey}`);
        continue;
      }
      const parsed = new URL(value);
      if (isPrivateHost(parsed.hostname) || SHORTENERS.has(parsed.hostname)) {
        add(entry.slug, `${urlKey} must be a public, non-shortened URL`);
        continue;
      }
      const owner = urls.get(normalizedValue);
      if (owner && owner !== entry.slug) {
        add(entry.slug, `duplicate ${urlKey} with "${owner}"`);
      } else {
        urls.set(normalizedValue, entry.slug);
      }
    }

    if ('status' in data && data.status === 'deprecated' && !data.deprecatedBy) {
      add(entry.slug, 'deprecated project requires deprecatedBy');
    }
    // Defence in depth: the JSON Schema already enforces these.
    if ('featured' in data && data.featured && !data.featuredReason) {
      add(entry.slug, 'featured project requires featuredReason');
    }

    projectsBySlug.set(entry.slug, data);
  }

  // Now validate collection items
  for (const collection of input.collections) {
    for (const item of collection.items) {
      if (!projectsBySlug.has(item)) {
        add(`collection:${collection.slug}`, `unknown project "${item}"`);
      }
    }
  }

  return errors;
}
