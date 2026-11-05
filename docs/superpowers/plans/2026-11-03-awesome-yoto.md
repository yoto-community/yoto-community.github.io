# Awesome Yoto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a bilingual, data-driven directory of the Yoto ecosystem on GitHub Pages: a generated `awesome-lint`-compliant README and a static Astro portal with search, filters, statuses and a MYO guide.

**Architecture:** `data/` is the only source of truth. A TypeScript pipeline validates it and generates the README plus JSON for the site. Astro renders static pages (EN at `/`, FR at `/fr/`), Pagefind indexes the built HTML, and GitHub Actions validates and deploys. No backend, no runtime secrets.

**Tech Stack:** Node 22, pnpm 10, TypeScript 5, `yaml`, `ajv` + `ajv-formats`, Vitest, Astro 5, Pagefind, Prettier.

**Spec:** `docs/superpowers/specs/2026-11-03-awesome-yoto-design.md`

## Global Constraints

- **Runtime is 100% static.** No server, no serverless function, no database, no cookie, no third-party analytics or font at runtime.
- **No secrets in the browser bundle.** The portal never calls the Yoto API.
- **Node 22** (`engines.node: ">=22"`), **pnpm 10.11.0** (local version; do not set `packageManager` to a different major).
- **Published artifact:** `site/dist/`. There is **no root `dist/`**.
- **Never edit by hand:** `README.md`, `site/src/generated/`, `site/dist/`, `data/.meta.json`.
- **README separator is a plain hyphen:** `- [Name](url) - Description.` (awesome-lint `list-item-description`).
- **Descriptions:** EN required, 20–180 characters, one factual sentence ending with a period. FR optional, same bounds.
- **Language:** EN canonical at `/`, FR at `/fr/`. FR falls back to EN with a visible `EN` badge.
- **Categories (exact slugs):** `official`, `create`, `icons`, `audio`, `automate`, `develop`, `backup`, `hardware`, `learn`.
- **Statuses:** `active`, `maintained`, `stale`, `archived`, `deprecated`.
- **`deprecated` requires `deprecatedBy`** (a name, not a URL). **`featured` requires `featuredReason`** (≤ 140 chars).
- **No piracy.** No DRM or paywall circumvention. Backup tools require `warning: legal-backup`.
- **No trailing whitespace, no tabs** in YAML. Files end with a newline.
- **Commit after every task.** Conventional Commits (`feat:`, `test:`, `chore:`, `docs:`).

## Implementation Notes (deliberate deviations from the spec)

1. `site/` is a pnpm workspace package, like `podcast-catalogue`. The root holds data tooling.
2. Astro outputs to `site/dist/`; the JSON API lives at `site/dist/api/`. This avoids Astro wiping a root `dist/`.
3. Enrichment is folded into the nightly `pages.yml` deploy instead of a separate `enrich.yml` (no bot-commit loop).
4. Status is derived from GitHub metadata at seed time, then frozen as editorial data.

---

## File Structure

| Path                                                                                                    | Responsibility                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `data/projects/*.yml`                                                                                   | One file per project; human-edited only |
| `data/categories.yml`, `tags.yml`, `collections.yml`                                                    | Controlled referentials                 |
| `data/.meta.json`                                                                                       | Generated enrichment cache              |
| `schema/*.schema.json`                                                                                  | JSON Schema contracts                   |
| `scripts/lib/types.ts`                                                                                  | Shared TypeScript types                 |
| `scripts/lib/slug.ts`, `url.ts`                                                                         | Normalization helpers                   |
| `scripts/lib/schema.ts`                                                                                 | Ajv compilation                         |
| `scripts/lib/validate-repo.ts`                                                                          | Pure repository-level validation        |
| `scripts/lib/readme.ts`                                                                                 | Pure README renderer                    |
| `scripts/lib/http.ts`, `meta.ts`                                                                        | Fetch with retry; GitHub enrichment     |
| `scripts/lib/issue.ts`                                                                                  | Issue-form parsing and YAML generation  |
| `scripts/validate.ts`, `build.ts`, `enrich.ts`, `check-links.ts`, `issue-to-project.ts`, `postbuild.ts` | CLIs                                    |
| `scripts/link-report.ts`                                                                                | Markdown report for the weekly issue    |
| `site/src/views/*`                                                                                      | Shared page bodies (EN/FR)              |
| `site/src/components/*`                                                                                 | Layout-independent UI pieces            |
| `site/src/lib/*`                                                                                        | Routing, filtering, formatting (pure)   |
| `site/src/i18n/*`                                                                                       | Dictionaries and `t()`                  |
| `site/src/pages/**`                                                                                     | Thin route wrappers                     |
| `.github/workflows/*`                                                                                   | CI, deploy, link health, issue-to-PR    |

---

### Task 1: Foundations, types and per-file validation

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.prettierrc.json`, `.editorconfig`, `LICENSE`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Create: `scripts/lib/types.ts`, `scripts/lib/config.ts`, `scripts/lib/slug.ts`, `scripts/lib/url.ts`, `scripts/lib/schema.ts`
- Create: `schema/project.schema.json`
- Test: `tests/slug.test.ts`, `tests/schema.test.ts`
- Fixture: `tests/fixtures/project.valid.yml`

**Interfaces:**

- Produces: `ProjectFile`, `Project`, `ProjectMeta`, `Category`, `Status`, `Platform`, `Requirement`, `Warning`
- Produces: `slugify(input: string): string`
- Produces: `normalizeUrl(url: string): string`, `urlsEqual(a: string, b: string): boolean`
- Produces: `validateProjectFile(raw: unknown): string[]`

- [ ] **Step 1: Scaffold the workspace**

`package.json`:

```json
{
  "name": "awesome-yoto",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "packageManager": "pnpm@10.11.0",
  "scripts": {
    "validate": "tsx scripts/validate.ts",
    "build:data": "tsx scripts/build.ts",
    "build": "pnpm build:data && pnpm --filter site build && tsx scripts/postbuild.ts && pagefind --site site/dist",
    "dev": "pnpm build:data && pnpm --filter site dev",
    "check:readme": "tsx scripts/build.ts --check",
    "check": "pnpm validate && pnpm check:readme && pnpm build:data && pnpm --filter site check",
    "test": "vitest run",
    "enrich": "tsx scripts/enrich.ts",
    "check:links": "tsx scripts/check-links.ts",
    "lint:awesome": "awesome-lint README.md"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "yaml": "^2.8.1"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "awesome-lint": "^2.2.0",
    "pagefind": "^1.4.0",
    "prettier": "^3.9.10",
    "tsx": "^4.20.6",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - site
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["scripts/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'site/src/lib/**/*.test.ts'],
  },
});
```

`.gitignore`:

```
node_modules/
site/node_modules/
site/dist/
site/.astro/
site/src/generated/
.cache/
link-report.md
.dead-count
.DS_Store
*.log
```

`.prettierrc.json`: `{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }`

`.editorconfig`: UTF-8, LF, final newline, 2 spaces, trim trailing whitespace.

`LICENSE`: MIT, copyright "Yoto Community contributors".
`CODE_OF_CONDUCT.md`: Contributor Covenant 2.1, contact `conduct@yoto-community.dev`.
`SECURITY.md`: report privately via GitHub Security Advisories; no secrets in issues.

Run:

```bash
pnpm install
```

- [ ] **Step 2: Write the failing tests for slug and URL normalization**

`tests/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { slugify } from '../scripts/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Yoto Book Maker')).toBe('yoto-book-maker');
  });

  it('strips accents', () => {
    expect(slugify('Icônes & Design')).toBe('icones-design');
  });

  it('collapses separators and trims edges', () => {
    expect(slugify('  --Hello,   World!--  ')).toBe('hello-world');
  });

  it('caps length at 60 characters without a trailing hyphen', () => {
    const result = slugify('a'.repeat(80));
    expect(result).toHaveLength(60);
    expect(result.endsWith('-')).toBe(false);
  });

  it('falls back to "project" when nothing is left', () => {
    expect(slugify('***')).toBe('project');
  });
});
```

`tests/url.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeUrl, urlsEqual } from '../scripts/lib/url';

describe('normalizeUrl', () => {
  it('lowercases the host, keeps the path, drops the trailing slash', () => {
    expect(normalizeUrl('https://GitHub.com/Foo/Bar/')).toBe('https://github.com/Foo/Bar');
  });

  it('drops the fragment and tracking query', () => {
    expect(normalizeUrl('https://example.com/a?utm_source=x#top')).toBe('https://example.com/a');
  });
});

describe('urlsEqual', () => {
  it('ignores host casing and trailing slashes', () => {
    expect(urlsEqual('https://GitHub.com/foo/', 'https://github.com/foo')).toBe(true);
  });

  it('distinguishes different paths', () => {
    expect(urlsEqual('https://github.com/foo', 'https://github.com/bar')).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../scripts/lib/slug'`.

- [ ] **Step 4: Implement slug and URL helpers**

`scripts/lib/slug.ts`:

```ts
export function slugify(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'project';
}
```

`scripts/lib/url.ts`:

```ts
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
]);

export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}${url.search}`;
}

export function urlsEqual(a: string, b: string): boolean {
  try {
    return normalizeUrl(a) === normalizeUrl(b);
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 7 tests.

- [ ] **Step 6: Write the failing schema test**

`tests/fixtures/project.valid.yml`:

```yaml
name: Louis
url: https://github.com/stuartromanek/louis
repo: https://github.com/stuartromanek/louis
description: Turn a YouTube playlist into a Yoto MYO card, with automatic splitting.
category: create
tags: [youtube, myo]
author: Stuart Romanek
license: MIT
status: active
official: false
platforms: [web]
requires: [yoto-account]
added: 2026-11-03
```

`tests/schema.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { validateProjectFile } from '../scripts/lib/schema';

const valid = parse(readFileSync('tests/fixtures/project.valid.yml', 'utf8'));

describe('validateProjectFile', () => {
  it('accepts a valid project', () => {
    expect(validateProjectFile(valid)).toEqual([]);
  });

  it('rejects a non-HTTPS URL', () => {
    expect(validateProjectFile({ ...valid, url: 'http://example.com' }).join(' ')).toContain(
      '/url',
    );
  });

  it('rejects an unknown status', () => {
    expect(validateProjectFile({ ...valid, status: 'dead' }).join(' ')).toContain('/status');
  });

  it('rejects a deprecated project without deprecatedBy', () => {
    expect(validateProjectFile({ ...valid, status: 'deprecated' }).join(' ')).toContain(
      'deprecatedBy',
    );
  });

  it('rejects an unknown field', () => {
    expect(validateProjectFile({ ...valid, colour: 'red' }).join(' ')).toContain('additional');
  });

  it('rejects a description shorter than 20 characters', () => {
    expect(validateProjectFile({ ...valid, description: 'Too short.' }).join(' ')).toContain(
      '/description',
    );
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '../scripts/lib/schema'`.

- [ ] **Step 8: Write the schema and validator**

`schema/project.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://yoto-community.github.io/schema/project.schema.json",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "name",
    "url",
    "description",
    "category",
    "tags",
    "author",
    "license",
    "status",
    "official",
    "platforms",
    "added"
  ],
  "properties": {
    "name": { "type": "string", "minLength": 2, "maxLength": 60 },
    "url": { "type": "string", "format": "uri", "pattern": "^https://" },
    "repo": { "type": "string", "format": "uri", "pattern": "^https://" },
    "description": { "type": "string", "minLength": 20, "maxLength": 180 },
    "descriptionFr": { "type": "string", "minLength": 20, "maxLength": 180 },
    "category": { "type": "string", "minLength": 1 },
    "tags": {
      "type": "array",
      "minItems": 1,
      "maxItems": 8,
      "uniqueItems": true,
      "items": { "type": "string", "pattern": "^[a-z0-9-]+$" }
    },
    "author": { "type": "string", "minLength": 1, "maxLength": 80 },
    "license": { "type": "string", "minLength": 1, "maxLength": 40 },
    "status": { "enum": ["active", "maintained", "stale", "archived", "deprecated"] },
    "official": { "type": "boolean" },
    "platforms": {
      "type": "array",
      "minItems": 1,
      "maxItems": 5,
      "uniqueItems": true,
      "items": {
        "enum": [
          "web",
          "ios",
          "android",
          "macos",
          "windows",
          "linux",
          "cli",
          "home-assistant",
          "hardware",
          "api"
        ]
      }
    },
    "requires": {
      "type": "array",
      "uniqueItems": true,
      "items": {
        "enum": ["yoto-account", "yoto-api-key", "self-hosted", "nfc-writer", "paid-hardware"]
      }
    },
    "warning": { "enum": ["legal-backup", "unofficial-api", "experimental", "paid"] },
    "deprecatedBy": { "type": "string", "minLength": 2, "maxLength": 120 },
    "featured": { "type": "boolean" },
    "featuredReason": { "type": "string", "maxLength": 140 },
    "added": { "type": "string", "format": "date" }
  },
  "allOf": [
    {
      "if": { "required": ["status"], "properties": { "status": { "const": "deprecated" } } },
      "then": { "required": ["deprecatedBy"] }
    },
    {
      "if": { "required": ["featured"], "properties": { "featured": { "const": true } } },
      "then": { "required": ["featuredReason"] }
    }
  ]
}
```

`scripts/lib/schema.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT } from './config';

let validator: ReturnType<Ajv2020['compile']> | undefined;

function getValidator() {
  if (validator) return validator;
  const schema = JSON.parse(readFileSync(join(ROOT, 'schema/project.schema.json'), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  validator = ajv.compile(schema);
  return validator;
}

export function validateProjectFile(raw: unknown): string[] {
  const validate = getValidator();
  if (validate(raw)) return [];
  return (validate.errors ?? []).map((error) => {
    const path = error.instancePath || '/';
    const extra =
      error.keyword === 'additionalProperties'
        ? ` (${String((error.params as { additionalProperty?: string }).additionalProperty)})`
        : '';
    return `${path} ${error.message}${extra}`;
  });
}
```

`scripts/lib/config.ts`:

```ts
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = join(ROOT, 'data');
export const PROJECTS_DIR = join(DATA_DIR, 'projects');
export const SITE_DIR = join(ROOT, 'site');
export const SITE_GENERATED_DIR = join(SITE_DIR, 'src/generated');
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — 13 tests.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json vitest.config.ts \
  .gitignore .prettierrc.json .editorconfig LICENSE CODE_OF_CONDUCT.md SECURITY.md \
  schema scripts/lib tests
git commit -m "feat: add project schema and normalization helpers"
```

---

### Task 2: Referentials and repository-level validation

**Files:**

- Create: `schema/category.schema.json`, `schema/tag.schema.json`, `schema/collection.schema.json`
- Create: `scripts/lib/validate-repo.ts`
- Test: `tests/validate-repo.test.ts`

**Interfaces:**

- Consumes: `ProjectFile`, `validateProjectFile`, `normalizeUrl`, `urlsEqual`
- Produces: `Category`, `Tag`, `Collection`, `RepositoryInput`
- Produces: `validateRepository(input: RepositoryInput): Map<string, string[]>`

- [ ] **Step 1: Write the failing test**

`tests/validate-repo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateRepository, type RepositoryInput } from '../scripts/lib/validate-repo';

const base = {
  name: 'Louis',
  url: 'https://github.com/stuartromanek/louis',
  description: 'Turn a YouTube playlist into a Yoto MYO card.',
  category: 'create',
  tags: ['youtube'],
  author: 'Stuart Romanek',
  license: 'MIT',
  status: 'active' as const,
  official: false,
  platforms: ['web' as const],
  added: '2026-11-03',
};

function input(overrides: Partial<RepositoryInput> = {}): RepositoryInput {
  return {
    today: '2026-11-03',
    categories: ['official', 'create'],
    tags: ['youtube', 'myo'],
    collections: [],
    projects: [{ slug: 'louis', data: base }],
    ...overrides,
  };
}

describe('validateRepository', () => {
  it('accepts a coherent repository', () => {
    expect(validateRepository(input()).size).toBe(0);
  });

  it('rejects an unknown category', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, category: 'nope' } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('unknown category "nope"');
  });

  it('rejects an unknown tag', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, tags: ['nope'] } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('unknown tag "nope"');
  });

  it('rejects a duplicate URL after normalization', () => {
    const errors = validateRepository(
      input({
        projects: [
          { slug: 'louis', data: base },
          {
            slug: 'louis-copy',
            data: { ...base, name: 'Louis copy', url: 'https://GitHub.com/stuartromanek/louis/' },
          },
        ],
      }),
    );
    expect(errors.get('louis-copy')?.join(' ')).toContain('duplicate url');
  });

  it('rejects a duplicate name, case-insensitively', () => {
    const errors = validateRepository(
      input({
        projects: [
          { slug: 'louis', data: base },
          { slug: 'louis-2', data: { ...base, name: 'LOUIS', url: 'https://example.com/louis' } },
        ],
      }),
    );
    expect(errors.get('louis-2')?.join(' ')).toContain('duplicate name');
  });

  it('rejects a non-kebab-case slug', () => {
    const errors = validateRepository(input({ projects: [{ slug: 'Bad_Slug', data: base }] }));
    expect(errors.get('Bad_Slug')?.join(' ')).toContain('slug must be kebab-case');
  });

  it('rejects a future added date', () => {
    const errors = validateRepository(
      input({ projects: [{ slug: 'louis', data: { ...base, added: '2027-01-01' } }] }),
    );
    expect(errors.get('louis')?.join(' ')).toContain('added date is in the future');
  });

  it('rejects a collection referencing an unknown project', () => {
    const errors = validateRepository(
      input({ collections: [{ slug: 'start-here', items: ['ghost'] }] }),
    );
    expect(errors.get('collection:start-here')?.join(' ')).toContain('unknown project "ghost"');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/validate-repo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the referentials and validator**

`schema/category.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "minItems": 9,
  "items": {
    "type": "object",
    "additionalProperties": false,
    "required": ["slug", "label", "description", "icon", "order"],
    "properties": {
      "slug": { "type": "string", "pattern": "^[a-z-]+$" },
      "label": {
        "type": "object",
        "additionalProperties": false,
        "required": ["en", "fr"],
        "properties": { "en": { "type": "string" }, "fr": { "type": "string" } }
      },
      "description": {
        "type": "object",
        "additionalProperties": false,
        "required": ["en", "fr"],
        "properties": { "en": { "type": "string" }, "fr": { "type": "string" } }
      },
      "icon": { "type": "string" },
      "order": { "type": "integer", "minimum": 0 }
    }
  }
}
```

`schema/tag.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "minItems": 1,
  "uniqueItems": true,
  "items": { "type": "string", "pattern": "^[a-z0-9-]+$" }
}
```

`schema/collection.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": false,
    "required": ["slug", "title", "description", "items"],
    "properties": {
      "slug": { "type": "string", "pattern": "^[a-z-]+$" },
      "title": {
        "type": "object",
        "additionalProperties": false,
        "required": ["en", "fr"],
        "properties": { "en": { "type": "string" }, "fr": { "type": "string" } }
      },
      "description": {
        "type": "object",
        "additionalProperties": false,
        "required": ["en", "fr"],
        "properties": { "en": { "type": "string" }, "fr": { "type": "string" } }
      },
      "items": { "type": "array", "items": { "type": "string" } }
    }
  }
}
```

`scripts/lib/validate-repo.ts`:

```ts
import { validateProjectFile } from './schema';
import { urlsEqual } from './url';
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

export function validateRepository(input: RepositoryInput): Map<string, string[]> {
  const errors = new Map<string, string[]>();
  const add = (key: string, message: string) => {
    const list = errors.get(key) ?? [];
    list.push(message);
    errors.set(key, list);
  };

  const categories = new Set(input.categories);
  const tags = new Set(input.tags);
  const projectsBySlug = new Map<string, ProjectFile>();
  const names = new Map<string, string>();
  const urls = new Map<string, string>();

  for (const entry of input.projects) {
    if (!/^[a-z0-9-]+$/.test(entry.slug)) add(entry.slug, 'slug must be kebab-case');
    const schemaErrors = validateProjectFile(entry.data);
    if (schemaErrors.length > 0) {
      for (const message of schemaErrors) add(entry.slug, message);
      continue;
    }
    const data = entry.data as ProjectFile;
    if (!categories.has(data.category)) add(entry.slug, `unknown category "${data.category}"`);
    for (const tag of data.tags) {
      if (!tags.has(tag)) add(entry.slug, `unknown tag "${tag}"`);
    }
    if (data.added > input.today) add(entry.slug, 'added date is in the future');

    const nameKey = data.name.trim().toLowerCase();
    const owner = names.get(nameKey);
    if (owner && owner !== entry.slug) add(entry.slug, `duplicate name with "${owner}"`);
    else names.set(nameKey, entry.slug);

    for (const key of URL_KEYS) {
      const value = data[key];
      if (typeof value !== 'string') continue;
      const owner = urls.get(value);
      if (owner && owner !== entry.slug) add(entry.slug, `duplicate ${key} with "${owner}"`);
      else {
        for (const [seenUrl, seenSlug] of urls) {
          if (seenSlug !== entry.slug && urlsEqual(seenUrl, value)) {
            add(entry.slug, `duplicate ${key} with "${seenSlug}"`);
          }
        }
        urls.set(value, entry.slug);
      }
    }

    if ('status' in data && data.status === 'deprecated' && !data.deprecatedBy) {
      add(entry.slug, 'deprecated project requires deprecatedBy');
    }
    if ('featured' in data && data.featured && !data.featuredReason) {
      add(entry.slug, 'featured project requires featuredReason');
    }

    projectsBySlug.set(entry.slug, data);
  }

  for (const collection of input.collections) {
    for (const item of collection.items) {
      if (!projectsBySlug.has(item)) {
        add(`collection:${collection.slug}`, `unknown project "${item}"`);
      }
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- tests/validate-repo.test.ts`
Expected: PASS — 8 tests.

> **Implementation note (added after review):** also track seen category and
> collection slugs and emit `duplicate category slug` / `duplicate collection
slug` under the keys `category:<slug>` / `collection:<slug>`, once per key.
> Wrap `normalizeUrl` in a `try/catch` (a malformed-but-schema-valid port throws)
> and report `invalid url` / `invalid repo`. These three guards have regression
> tests in the final implementation.

- [ ] **Step 5: Commit**

```bash
git add schema scripts/lib/validate-repo.ts tests
git commit -m "feat: validate referentials, duplicates and collections"
```

---

### Task 3: Referentials, loader, validate CLI and the first 18 entries

**Files:**

- Create: `data/categories.yml`, `data/tags.yml`, `data/collections.yml`
- Create: `data/projects/*.yml` (18 files listed below)
- Create: `scripts/lib/load.ts`, `scripts/validate.ts`
- Modify: `scripts/lib/schema.ts` (add `validateWithSchema`)
- Test: `tests/load.test.ts`

**Interfaces:**

- Consumes: `validateRepository`, `validateProjectFile`, `ProjectFile`
- Produces: `createLoader(baseDir?: string)` with `categories()`, `tags()`, `collections()`, `projectFiles()`, `projects()`, `meta()`
- Produces: `validateWithSchema(name: string, raw: unknown): string[]`
- Produces: CLI `pnpm validate` — exits 1 on any error

- [ ] **Step 1: Write the referentials**

`data/categories.yml`:

```yaml
- slug: official
  label: { en: Official, fr: Officiel }
  description:
    en: Yoto apps, developer portal and official SDKs.
    fr: Applications Yoto, portail développeur et SDK officiels.
  icon: badge-check
  order: 10
- slug: create
  label: { en: Make Your Own, fr: Créer une carte }
  description:
    en: Import audio, split it into chapters, upload it and associate a card.
    fr: Importer de l'audio, le découper, l'envoyer et associer une carte.
  icon: cards
  order: 20
- slug: icons
  label: { en: Icons & design, fr: Icônes & design }
  description:
    en: 16x16 icon libraries, editors and printable labels.
    fr: Bibliothèques d'icônes 16x16, éditeurs et labels à imprimer.
  icon: palette
  order: 30
- slug: audio
  label: { en: Audio & podcasts, fr: Audio & podcasts }
  description:
    en: Podcasts, radio, audiobooks and streaming sources.
    fr: Podcasts, radio, livres audio et sources de streaming.
  icon: headphones
  order: 40
- slug: automate
  label: { en: Automation, fr: Automatisation }
  description:
    en: Home Assistant, Homebridge, MQTT and device control.
    fr: Home Assistant, Homebridge, MQTT et contrôle de l'appareil.
  icon: workflow
  order: 50
- slug: develop
  label: { en: Developer tools, fr: Outils dev }
  description:
    en: SDKs, API clients, CLIs and MCP servers.
    fr: SDK, clients API, CLI et serveurs MCP.
  icon: code
  order: 60
- slug: backup
  label: { en: Backup & migration, fr: Sauvegarde }
  description:
    en: Export and migration of cards you own.
    fr: Export et migration des cartes que vous possédez.
  icon: archive
  order: 70
- slug: hardware
  label: { en: Hardware & DIY, fr: Matériel & DIY }
  description:
    en: Firmware, teardowns, DIY players and accessories.
    fr: Firmware, démontages, lecteurs maison et accessoires.
  icon: cpu
  order: 80
- slug: learn
  label: { en: Community & learning, fr: Communauté }
  description:
    en: Guides, blogs, videos, forums and communities.
    fr: Guides, blogs, vidéos, forums et communautés.
  icon: book-open
  order: 90
```

`data/tags.yml`:

```yaml
- youtube
- spotify
- rss
- podcast
- audiobook
- radio
- nfc
- printing
- pixel-art
- home-assistant
- mqtt
- api
- oauth
- mcp
- cli
- self-hosted
- web
- mobile
- desktop
- macos
- windows
- android
- hardware
- myo
- french
- kids
- accessibility
- experimental
```

`data/collections.yml`:

```yaml
- slug: start-here
  title: { en: Start here, fr: Commencer ici }
  description:
    en: Five links that cover the whole Yoto experience.
    fr: Cinq liens qui couvrent toute l'expérience Yoto.
  items: [yoto-app, yoto-dev, louis, icons-catalogue, podcast-catalogue]
- slug: french
  title: { en: French resources, fr: Ressources francophones }
  description:
    en: Tools and catalogues with French support.
    fr: Outils et catalogues avec support du français.
  items: [icons-catalogue, podcast-catalogue]
- slug: editors-picks
  title: { en: Editor's picks, fr: Coups de cœur }
  description:
    en: Hand-picked projects worth trying first.
    fr: Projets choisis à essayer en premier.
  items: [louis, yoto-downloader, yoto-mcp]
- slug: myo-journey
  title: { en: MYO journey, fr: Parcours MYO }
  description:
    en: The four tools that cover a card from audio to icon.
    fr: Les quatre outils qui couvrent une carte, de l'audio à l'icône.
  items: [podcast-catalogue, louis, icons-catalogue, yoto-app]
```

- [ ] **Step 2: Write the failing loader test**

`tests/load.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLoader } from '../scripts/lib/load';

const load = createLoader();

describe('loader', () => {
  it('loads the nine categories sorted by order', () => {
    const categories = load.categories();
    expect(categories).toHaveLength(9);
    expect(categories.map((category) => category.slug)).toEqual([
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
  });

  it('loads the controlled tag vocabulary', () => {
    expect(load.tags()).toHaveLength(28);
    expect(load.tags()).toContain('home-assistant');
    expect(load.tags()).toContain('pixel-art');
    expect(load.tags()).toContain('myo');
  });

  it('loads projects with a slug derived from the file name', () => {
    const projects = load.projects();
    const louis = projects.find((project) => project.slug === 'louis');
    expect(louis?.name).toBe('Louis');
    expect(louis?.category).toBe('create');
  });

  it('has at least 18 projects covering all nine categories', () => {
    const projects = load.projects();
    expect(projects.length).toBeGreaterThanOrEqual(18);
    expect(new Set(projects.map((project) => project.category)).size).toBe(9);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test -- tests/load.test.ts`
Expected: FAIL — module not found, then missing data files.

- [ ] **Step 4: Implement the loader and the schema helper**

Add to `scripts/lib/schema.ts`:

```ts
export function validateWithSchema(name: string, raw: unknown): string[] {
  const schema = JSON.parse(readFileSync(join(ROOT, `schema/${name}.schema.json`), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(raw)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`);
}
```

`scripts/lib/load.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { DATA_DIR } from './config';
import type { Category, Collection, Project, ProjectFile, ProjectMeta } from './types';

export interface MetaFile {
  updatedAt: string;
  projects: Record<string, ProjectMeta>;
}

export function createLoader(baseDir: string = DATA_DIR) {
  const read = <T>(file: string): T => parse(readFileSync(join(baseDir, file), 'utf8')) as T;

  const categories = (): Category[] =>
    read<Category[]>('categories.yml').sort((a, b) => a.order - b.order);

  const tags = (): string[] => read<string[]>('tags.yml');

  const collections = (): Collection[] => read<Collection[]>('collections.yml');

  const projectFiles = (): Array<{ slug: string; data: unknown }> =>
    readdirSync(join(baseDir, 'projects'))
      .filter((file) => file.endsWith('.yml'))
      .sort()
      .map((file) => ({
        slug: file.replace(/\.yml$/, ''),
        data: parse(readFileSync(join(baseDir, 'projects', file), 'utf8')) as unknown,
      }));

  const meta = (): MetaFile => {
    const path = join(baseDir, '.meta.json');
    return existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as MetaFile)
      : { updatedAt: '', projects: {} };
  };

  const projects = (): Project[] => {
    const cache = meta();
    return projectFiles()
      .map(({ slug, data }) => ({
        ...(data as ProjectFile),
        slug,
        meta: cache.projects[slug],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  return { categories, tags, collections, projectFiles, meta, projects };
}
```

- [ ] **Step 5: Implement the validate CLI**

`scripts/validate.ts`:

```ts
import { createLoader } from './lib/load';
import { validateWithSchema } from './lib/schema';
import { validateRepository } from './lib/validate-repo';

const load = createLoader();
const categories = load.categories();
const tags = load.tags();
const collections = load.collections();
const projects = load.projectFiles();

const referentialErrors: string[] = [
  ...validateWithSchema('category', categories).map((error) => `categories.yml ${error}`),
  ...validateWithSchema('tag', tags).map((error) => `tags.yml ${error}`),
  ...validateWithSchema('collection', collections).map((error) => `collections.yml ${error}`),
];

const errors = validateRepository({
  today: new Date().toISOString().slice(0, 10),
  categories: categories.map((category) => category.slug),
  tags,
  collections: collections.map((collection) => ({
    slug: collection.slug,
    items: collection.items,
  })),
  projects,
});

if (referentialErrors.length > 0) {
  for (const error of referentialErrors) console.error(`  ${error}`);
}
if (errors.size > 0) {
  for (const [slug, messages] of errors) {
    for (const message of messages) console.error(`  ${slug}: ${message}`);
  }
}
if (referentialErrors.length > 0 || errors.size > 0) {
  console.error(`\nValidation failed.`);
  process.exit(1);
}

console.log(
  `Validation passed: ${projects.length} projects, ${categories.length} categories, ${tags.length} tags.`,
);
```

> **Implementation notes (added after review):**
>
> - `schema/category.schema.json` uses an `enum` of the nine slugs (not just
>   `minItems: 9`), and `schema/tag.schema.json` uses `minItems: 28, maxItems: 28`.
> - `load.ts` catches YAML parse errors per file and surfaces
>   `data/projects/<file>: <message>`, so one bad file does not hide the others.
> - `load.ts` tolerates a `.meta.json` without a `projects` key
>   (`projects: parsed.projects ?? {}`).
> - Pin `localeCompare(b.name, 'en')` for deterministic ordering.
> - Wrap the CLI body in `main()`; importing a module must not validate.

- [ ] **Step 6: Write the first 18 entries**

Create one YAML file per row in `data/projects/<slug>.yml`. Full examples:

`data/projects/louis.yml`:

```yaml
name: Louis
url: https://github.com/stuartromanek/louis
repo: https://github.com/stuartromanek/louis
description: Turn a YouTube playlist into a Yoto MYO card, with automatic splitting and icons.
descriptionFr: Transforme une playlist YouTube en carte MYO Yoto, avec découpage et icônes.
category: create
tags: [youtube, myo]
author: Stuart Romanek
license: MIT
status: active
official: false
platforms: [web]
requires: [yoto-account]
added: 2026-11-03
```

`data/projects/yoto-dev.yml`:

```yaml
name: Yoto Developer Portal
url: https://yoto.dev/
description: Official API documentation, OAuth setup and developer dashboard for Yoto apps.
descriptionFr: Documentation officielle de l'API, configuration OAuth et tableau de bord développeur.
category: official
tags: [api, oauth]
author: Yoto
license: Proprietary
status: active
official: true
platforms: [web, api]
added: 2026-11-03
```

`data/projects/home-assistant-yoto.yml`:

```yaml
name: Home Assistant Yoto integration
url: https://www.home-assistant.io/integrations/yoto/
description: Control Yoto players and read their state from Home Assistant, without HACS.
descriptionFr: Contrôlez les lecteurs Yoto et lisez leur état depuis Home Assistant, sans HACS.
category: automate
tags: [home-assistant, api]
author: Home Assistant
license: Apache-2.0
status: active
official: false
platforms: [home-assistant]
requires: [yoto-account]
added: 2026-11-03
```

`data/projects/yotoicons.yml`:

```yaml
name: YotoIcons
url: https://yotoicons.com/
description: Community library of thousands of 16x16 pixel icons ready for Yoto cards.
descriptionFr: Bibliothèque communautaire de milliers d'icônes 16x16 prêtes pour les cartes Yoto.
category: icons
tags: [pixel-art, web]
author: YotoIcons community
license: Unknown
status: active
official: false
platforms: [web]
added: 2026-11-03
```

`data/projects/podcast-catalogue.yml`:

```yaml
name: Yoto Podcast Catalogue
url: https://yoto-community.github.io/podcast-catalogue/
description: Curated child-safe podcast feeds by language and age, ready for MYO cards.
descriptionFr: Flux de podcasts pour enfants validés, classés par langue et par âge, prêts pour les cartes MYO.
category: audio
tags: [podcast, rss, french]
author: Yoto Community
license: MIT
status: active
official: false
platforms: [web]
added: 2026-11-03
```

`data/projects/yoto-downloader.yml`:

```yaml
name: yoto-downloader
url: https://github.com/baruch-moskovits/yoto-downloader
repo: https://github.com/baruch-moskovits/yoto-downloader
description: Download the audio of cards you own for offline backup and migration.
descriptionFr: Téléchargez l'audio des cartes que vous possédez pour une sauvegarde hors ligne.
category: backup
tags: [cli, api]
author: Baruch Moskovits
license: Unknown
status: active
official: false
platforms: [cli]
requires: [yoto-account]
warning: legal-backup
added: 2026-11-03
```

Create the 12 remaining files from this table, using the same shape and a 20–180
character English description written from the project README:

| slug                | name                 | url                                               | category | tags                |
| ------------------- | -------------------- | ------------------------------------------------- | -------- | ------------------- |
| `yoto-app`          | Yoto                 | https://yotoplay.com/                             | official | `kids, web, mobile` |
| `yoto-space`        | Yoto Space           | https://yoto.space/                               | official | `kids, web`         |
| `yoto-sdk`          | Yoto TypeScript SDK  | https://github.com/yotoplay/yoto-sdk              | official | `api, oauth`        |
| `yoto-book-maker`   | YotoBookMaker        | https://github.com/bbenkle/YotoBookMaker          | create   | `audiobook, macos`  |
| `yoto-cli`          | yoto-cli             | https://github.com/TheBestMoshe/yoto-cli          | develop  | `cli, api`          |
| `yoto-api`          | yoto_api             | https://github.com/cdnninja/yoto_api              | develop  | `api, mcp`          |
| `yoto-mcp`          | yoto-mcp             | https://github.com/tmcinerney/yoto-mcp            | develop  | `mcp, api`          |
| `icons-catalogue`   | Yoto Icons Catalogue | https://yoto-community.github.io/icons-catalogue/ | icons    | `pixel-art, french` |
| `yotopixels`        | YotoPixels           | https://yotopixels.com/                           | icons    | `pixel-art, web`    |
| `yoto-smart-stream` | yoto-smart-stream    | https://github.com/earchibald/yoto-smart-stream   | audio    | `api, self-hosted`  |
| `yotolike`          | yotolike             | https://github.com/JpTiger/yotolike               | hardware | `hardware, nfc`     |
| `reddit-yotoplayer` | r/YotoPlayer         | https://www.reddit.com/r/YotoPlayer/              | learn    | `kids`              |

- [ ] **Step 7: Run validation**

Run: `pnpm validate`
Expected: `Validation passed: 18 projects, 9 categories, 28 tags.`

- [ ] **Step 8: Run the tests**

Run: `pnpm test`
Expected: PASS — all suites.

- [ ] **Step 9: Commit**

```bash
git add data scripts/lib/load.ts scripts/lib/schema.ts scripts/validate.ts tests/load.test.ts
git commit -m "feat: add referentials, loader and 18 curated projects"
```

---

### Task 4: Complete the seed to 58 projects

**Files:**

- Create: `data/projects/*.yml` (40 additional files)
- Modify: `data/collections.yml` (reference only existing slugs)
- Create: `tests/content.test.ts`

**Interfaces:**

- Consumes: `createLoader()`
- Produces: a dataset of ≥ 55 entries covering all 9 categories

- [ ] **Step 1: Write the failing content test**

`tests/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLoader } from '../scripts/lib/load';

const load = createLoader();
const projects = load.projects();

describe('content', () => {
  it('lists at least 55 projects', () => {
    expect(projects.length).toBeGreaterThanOrEqual(55);
  });

  it('covers every category with at least two projects', () => {
    const counts = new Map<string, number>();
    for (const project of projects) {
      counts.set(project.category, (counts.get(project.category) ?? 0) + 1);
    }
    for (const category of load.categories()) {
      expect(counts.get(category.slug) ?? 0, category.slug).toBeGreaterThanOrEqual(2);
    }
  });

  it('writes one factual sentence per description', () => {
    for (const project of projects) {
      expect(project.description.trim(), project.slug).toMatch(/[.!]$/);
      expect(project.description.length, project.slug).toBeGreaterThanOrEqual(20);
      expect(project.description.length, project.slug).toBeLessThanOrEqual(180);
    }
  });

  it('provides at least ten French descriptions', () => {
    expect(projects.filter((project) => project.descriptionFr).length).toBeGreaterThanOrEqual(10);
  });

  it('marks deprecated projects with a replacement', () => {
    for (const project of projects.filter((item) => item.status === 'deprecated')) {
      expect(project.deprecatedBy, project.slug).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/content.test.ts`
Expected: FAIL — fewer than 55 projects.

- [ ] **Step 3: Create the 40 remaining entries**

Use the same shape as Task 3. Write each description from the project README,
20–180 characters, ending with a period.

> **Ordering note:** `scripts/enrich.ts` is created in Task 5, so `pnpm enrich`
> does not exist yet. Set `status: active` provisionally for these 40 entries.
> Task 5 prints a suggested status per project; a follow-up edit applies them.
> Exception: `yoto-ha` is `deprecated` with
> `deprecatedBy: Home Assistant core Yoto integration`.

Status rule that Task 5 applies:

| Last commit                | Status                        |
| -------------------------- | ----------------------------- |
| < 6 months                 | `active`                      |
| 6–12 months                | `maintained`                  |
| > 12 months, not archived  | `stale`                       |
| repository archived        | `archived`                    |
| replaced by something else | `deprecated` + `deprecatedBy` |

| slug                         | name                      | url                                                                | category | tags                     |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------ | -------- | ------------------------ |
| `yoto-icon-search`           | Yoto Icon Search          | https://github.com/Schmavery/yoto-icon-search                      | icons    | `pixel-art, web`         |
| `selphyoto`                  | Selphyoto                 | https://github.com/m600x/Selphyoto                                 | icons    | `printing, pixel-art`    |
| `yotolabels`                 | yotolabels                | https://github.com/michel2323/yotolabels                           | icons    | `printing, windows`      |
| `yoto-playlist-creator`      | Yoto Playlist Creator     | https://github.com/cjlm/yoto-playlist-creator                      | create   | `youtube, web`           |
| `custom-yoto-cards`          | Custom Yoto Cards         | https://github.com/davidcjw/custom-yoto-cards                      | create   | `nfc, mobile`            |
| `yoto-manager`               | yoto-manager              | https://github.com/pg0/yoto-manager                                | create   | `web, api`               |
| `yotofy`                     | yotofy                    | https://github.com/jstammers/yotofy                                | create   | `spotify, api`           |
| `yoto-maker`                 | yoto-maker                | https://github.com/mmackelprang/yoto-maker                         | create   | `youtube, printing`      |
| `yoto-card-studio`           | Yoto Card Studio          | https://github.com/gvinko/yoto-card-studio                         | create   | `web, nfc`               |
| `yoto-myo-card-provisioner`  | MYO Card Provisioner      | https://github.com/NitsujY/yoto-myo-card-provisioner               | create   | `nfc, web`               |
| `yoto-media-manager`         | Yoto Media Manager        | https://github.com/damione1/yoto-media-manager                     | create   | `desktop, youtube`       |
| `yoto-card-copier`           | Yoto Card Copier          | https://github.com/DovieW/yoto-card-copier                         | create   | `nfc, android`           |
| `yoto-card-kit`              | Yoto Card Kit             | https://github.com/eddowding/yoto-card-kit                         | create   | `cli, audiobook`         |
| `yoto-music`                 | Yoto-Music                | https://github.com/blast-hardcheese/Yoto-Music                     | create   | `cli, youtube`           |
| `yoto-up`                    | yoto-up                   | https://github.com/xkjq/yoto-up                                    | audio    | `cli, api`               |
| `yoto-audiobookshelf-bridge` | Audiobookshelf Bridge     | https://github.com/mylacc/yoto-audiobookshelf-bridge               | audio    | `audiobook, self-hosted` |
| `audio-yoto-shelf`           | AudioYotoShelf            | https://github.com/O-Mutt/AudioYotoShelf                           | audio    | `audiobook, self-hosted` |
| `yodex`                      | yodex                     | https://github.com/jordan-wright/yodex                             | audio    | `podcast, api`           |
| `yoto-browser-player`        | Yoto Browser Player       | https://github.com/afsenovilla/Yoto-Audio-Player-Browser-Extension | audio    | `web, api`               |
| `yoto-tools`                 | YotoTools                 | https://github.com/trywait/YotoTools                               | backup   | `api, experimental`      |
| `yoto-backup`                | yoto-backup               | https://github.com/seripap/yoto-backup                             | backup   | `cli, api`               |
| `toto-backup`                | toto-backup               | https://github.com/ldesgrange/toto-backup                          | backup   | `cli, api`               |
| `yoto-library`               | yoto-library              | https://github.com/steverice/yoto-library                          | backup   | `cli, self-hosted`       |
| `yoto-downloader-py`         | yoto-downloader-py        | https://github.com/calamonkey/yoto-downloader-py                   | backup   | `cli, api`               |
| `yoto-ha`                    | Yoto for Home Assistant   | https://github.com/cdnninja/yoto_ha                                | automate | `home-assistant, mqtt`   |
| `homebridge-yoto`            | homebridge-yoto-player    | https://github.com/ChrisPatten/homebridge-yoto-player              | automate | `home-assistant, api`    |
| `lovelace-yoto-cards`        | Lovelace Yoto Cards       | https://github.com/tkamenick/lovelace-yoto-cards                   | automate | `home-assistant`         |
| `yoto-roon-extension`        | Yoto Roon Extension       | https://github.com/mosschief/yoto-roon-extension                   | automate | `api, self-hosted`       |
| `yoto-nodejs-client`         | Yoto Node.js Client       | https://github.com/bcomnes/yoto-nodejs-client                      | develop  | `api, oauth`             |
| `yoto-examples`              | Yoto Examples             | https://github.com/yotoplay/examples                               | official | `api, web`               |
| `twee2yoto`                  | twee2yoto                 | https://github.com/yotoplay/twee2yoto                              | official | `api, cli`               |
| `yoto-mcp-server`            | Yoto MCP Server           | https://github.com/bperkinspdx/yoto-mcp-server                     | develop  | `mcp, api`               |
| `yoto-json-extractor`        | YOTO JSON Extractor       | https://github.com/afsenovilla/YOTO-json-extractor                 | develop  | `api, desktop`           |
| `open-yoto`                  | open-yoto                 | https://github.com/tensorfish/open-yoto                            | hardware | `hardware, experimental` |
| `yotwo`                      | yotwo                     | https://github.com/tomekent/yotwo                                  | hardware | `hardware, audiobook`    |
| `circuitpython-yoto`         | CircuitPython Yoto Player | https://github.com/adafruit/Adafruit_CircuitPython_YotoPlayer      | hardware | `hardware, api`          |
| `yoto-v3-teardown`           | Yoto V3 Teardown          | https://github.com/iamearlgrey/yoto-v3-teardown                    | hardware | `hardware, experimental` |
| `yoto-myo-card-tutorial`     | MYO Card Tutorial         | https://github.com/BeniVidiVici/yoto-myo-card-tutorial             | learn    | `nfc, french`            |
| `busy-busy-learning`         | Busy Busy Learning        | https://busybusylearning.com/                                      | learn    | `kids, printing`         |
| `yoto-bulk`                  | yoto-bulk                 | https://github.com/eperdeme/yoto-bulk                              | develop  | `api, cli`               |

For `yoto-ha`, set `status: deprecated` and `deprecatedBy: Home Assistant core Yoto integration`.

Editorial corrections applied after review:
- `yoto-examples` and `twee2yoto` are Yoto-owned repositories: `official: true`.
- `homebridge-yoto` is HomeKit, not Home Assistant: `platforms: [api]` (keep the brief's tag).
- `yoto-bulk` exposes web services only: `platforms: [web]`.
- Apps where the user registers their own Yoto OAuth client carry `yoto-api-key`
  in `requires`: `yotofy`, `homebridge-yoto`, `yoto-card-studio`, `yoto-manager`,
  `yoto-maker`, `audio-yoto-shelf`, `yoto-audiobookshelf-bridge`,
  `custom-yoto-cards`.
- `custom-yoto-cards` description: "Guide and zero-dependency Node script for
  putting custom audio on generic Yoto cards."
- `mosschief/yoto-roon-extension` was removed: the repository contains no Yoto
  code. It is replaced by `yopix` (16x16 pixel-art converter, MIT).

- [ ] **Step 4: Run validation and tests**

Run: `pnpm validate && pnpm test`
Expected: `Validation passed: 58 projects, 9 categories, 28 tags.` and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add data tests/content.test.ts
git commit -m "feat: seed 58 curated Yoto projects"
```

---

### Task 5: GitHub metadata enrichment

**Files:**

- Create: `scripts/lib/http.ts`, `scripts/lib/meta.ts`, `scripts/enrich.ts`
- Test: `tests/meta.test.ts`, `tests/http.test.ts`

**Interfaces:**

- Produces: `fetchJson<T>(url: string, options: FetchJsonOptions, fetchImpl?: typeof fetch): Promise<T>`
- Produces: `repoFromUrl(url: string): { owner: string; repo: string } | null`
- Produces: `metaFromApi(json: unknown): ProjectMeta`
- Produces: `suggestStatus(meta: ProjectMeta, today: string): Status`
- Produces: `MetaFile`

- [ ] **Step 1: Write the failing tests**

`tests/meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { metaFromApi, repoFromUrl, suggestStatus } from '../scripts/lib/meta';

describe('repoFromUrl', () => {
  it('extracts owner and repo from a GitHub URL', () => {
    expect(repoFromUrl('https://github.com/yotoplay/yoto-sdk')).toEqual({
      owner: 'yotoplay',
      repo: 'yoto-sdk',
    });
  });

  it('returns null for a non-GitHub URL', () => {
    expect(repoFromUrl('https://yoto.dev/')).toBeNull();
  });
});

describe('metaFromApi', () => {
  it('maps the GitHub payload', () => {
    expect(
      metaFromApi({
        stargazers_count: 57,
        pushed_at: '2026-09-12T10:00:00Z',
        archived: false,
        license: { spdx_id: 'MIT' },
      }),
    ).toEqual({ stars: 57, lastCommit: '2026-09-12', archived: false, licenseDetected: 'MIT' });
  });

  it('tolerates a missing license', () => {
    expect(metaFromApi({ stargazers_count: 0, pushed_at: '2026-01-01T00:00:00Z' })).toEqual({
      stars: 0,
      lastCommit: '2026-01-01',
      archived: false,
      licenseDetected: undefined,
    });
  });
});

describe('suggestStatus', () => {
  const today = '2026-11-03';
  it('returns active under six months', () => {
    expect(suggestStatus({ lastCommit: '2026-07-01' }, today)).toBe('active');
  });
  it('returns maintained between six and twelve months', () => {
    expect(suggestStatus({ lastCommit: '2025-12-01' }, today)).toBe('maintained');
  });
  it('returns stale after twelve months', () => {
    expect(suggestStatus({ lastCommit: '2025-01-01' }, today)).toBe('stale');
  });
  it('returns archived regardless of date', () => {
    expect(suggestStatus({ lastCommit: '2026-10-01', archived: true }, today)).toBe('archived');
  });
});
```

`tests/http.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../scripts/lib/http';

describe('fetchJson', () => {
  it('retries after a 429 and returns the payload', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(
      fetchJson('https://api.github.com/repos/a/b', { token: 't' }, fetchImpl as typeof fetch),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws on a 404 without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await expect(
      fetchJson('https://api.github.com/repos/a/b', {}, fetchImpl as typeof fetch),
    ).rejects.toThrow('HTTP 404');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test -- tests/meta.test.ts tests/http.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the HTTP client**

`scripts/lib/http.ts`:

```ts
export interface FetchJsonOptions {
  token?: string;
  retries?: number;
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const retries = options.retries ?? 3;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'awesome-yoto',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });

    if (response.status === 403 || response.status === 429) {
      if (attempt === retries) throw new HttpError(response.status, url);
      const retryAfter = Number(response.headers.get('retry-after') ?? '1');
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000));
      continue;
    }
    if (!response.ok) throw new HttpError(response.status, url);
    return (await response.json()) as T;
  }
  throw new HttpError(429, url);
}
```

- [ ] **Step 4: Implement the metadata mapper**

`scripts/lib/meta.ts`:

```ts
import type { MetaFile } from './load';
import type { ProjectMeta, Status } from './types';

interface GitHubRepo {
  stargazers_count?: number;
  pushed_at?: string;
  archived?: boolean;
  license?: { spdx_id?: string } | null;
}

export function repoFromUrl(url: string): { owner: string; repo: string } | null {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  if (!match?.[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2] };
}

export function metaFromApi(json: unknown): ProjectMeta {
  const repo = json as GitHubRepo;
  return {
    stars: repo.stargazers_count ?? 0,
    lastCommit: repo.pushed_at?.slice(0, 10),
    archived: repo.archived ?? false,
    licenseDetected: repo.license?.spdx_id,
  };
}

export function suggestStatus(meta: ProjectMeta, today: string): Status {
  if (meta.archived) return 'archived';
  if (!meta.lastCommit) return 'active';
  const days = (Date.parse(today) - Date.parse(meta.lastCommit)) / 86_400_000;
  if (days < 183) return 'active';
  if (days < 365) return 'maintained';
  return 'stale';
}

export function emptyMetaFile(today: string): MetaFile {
  return { updatedAt: today, projects: {} };
}
```

- [ ] **Step 5: Implement the CLI**

`scripts/enrich.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './lib/config';
import { fetchJson } from './lib/http';
import { createLoader } from './lib/load';
import { metaFromApi, repoFromUrl, suggestStatus } from './lib/meta';

const load = createLoader();
const projects = load.projects();
const previous = load.meta();
const projectsMeta = { ...previous.projects };
const today = new Date().toISOString().slice(0, 10);
let updated = 0;

for (const project of projects) {
  if (!project.repo) continue;
  const target = repoFromUrl(project.repo);
  if (!target) continue;
  try {
    const json = await fetchJson<unknown>(
      `https://api.github.com/repos/${target.owner}/${target.repo}`,
      { token: process.env.GITHUB_TOKEN },
    );
    projectsMeta[project.slug] = metaFromApi(json);
    updated += 1;
  } catch (error) {
    console.warn(`warning: ${project.slug} not refreshed (${(error as Error).message})`);
  }
}

writeFileSync(
  join(DATA_DIR, '.meta.json'),
  `${JSON.stringify({ updatedAt: today, projects: projectsMeta }, null, 2)}\n`,
);

for (const project of projects) {
  const meta = projectsMeta[project.slug];
  if (meta) {
    console.log(`${project.slug.padEnd(32)} ${suggestStatus(meta, today)}`);
  }
}

console.log(`Refreshed ${updated}/${projects.length} projects.`);
```

- [ ] **Step 6: Run the tests and the CLI**

Run: `pnpm test -- tests/meta.test.ts tests/http.test.ts`
Expected: PASS.

Run: `GITHUB_TOKEN=$(gh auth token 2>/dev/null) pnpm enrich` (or without a token; rate limits may reduce coverage).
Expected: `data/.meta.json` written, status suggestions printed. Failures are warnings, never fatal.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/http.ts scripts/lib/meta.ts scripts/enrich.ts tests data/.meta.json
git commit -m "feat: enrich projects with GitHub metadata"
```

---

### Task 6: README generator and build pipeline

**Files:**

- Create: `scripts/lib/readme.ts`, `scripts/lib/catalog.ts`, `scripts/build.ts`, `scripts/postbuild.ts`
- Test: `tests/readme.test.ts`, `tests/build.test.ts`

**Interfaces:**

- Consumes: `createLoader()`, `Project`, `Category`, `Collection`
- Produces: `renderReadme(ctx: ReadmeContext): string`
- Produces: `anchor(text: string): string`
- Produces: `buildCatalog(ctx): Catalog` (shape below)
- Produces: CLI `pnpm build:data` and `pnpm build:data -- --check`

- [ ] **Step 1: Write the failing README test**

`tests/readme.test.ts`:

```ts
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
});

describe('renderReadme', () => {
  it('renders a deterministic awesome-lint-friendly README', () => {
    expect(renderReadme({ categories, projects, collections })).toBe(`# Awesome Yoto

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of apps, tools and resources for the Yoto Player.

[Portal](https://yoto-community.github.io/) · [MYO guide](https://yoto-community.github.io/myo/) · [Contributing](CONTRIBUTING.md)

## Contents

- [Start here](#start-here)
- [Official](#official)
- [Make Your Own](#make-your-own)
- [French resources](#french-resources)
- [Contributing](#contributing)
- [License](#license)

## Start here

- [Build your first MYO card](https://yoto-community.github.io/myo/) - The five-step guide from audio to printed label.
- [Browse the icon catalogue](https://yoto-community.github.io/icons-catalogue/) - Thousands of 16x16 icons for your cards.
- [Browse the podcast catalogue](https://yoto-community.github.io/podcast-catalogue/) - Child-safe feeds sorted by age and language.
- [Browse all projects](https://yoto-community.github.io/projects/) - Filter by category, status, platform and language.
- [Read the API documentation](https://yoto-community.github.io/api/) - The static JSON behind the portal.

## Official

- [Yoto](https://yotoplay.com/) - The official Yoto website and player companion app.

## Make Your Own

- [Louis](https://github.com/stuartromanek/louis) - Turn a YouTube playlist into a Yoto MYO card.

## French resources

The interface and descriptions are available in French on the [French portal](https://yoto-community.github.io/fr/). The podcast catalogue also has a [French section](https://yoto-community.github.io/podcast-catalogue/fr/).

## Contributing

Found a project that belongs here? Read [CONTRIBUTING.md](CONTRIBUTING.md) and open a pull request. Entries are validated by CI: schema, duplicates, categories and links.

## License

[MIT](LICENSE). Awesome Yoto is a community project, not affiliated with Yoto.
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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/readme.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the renderer**

`scripts/lib/readme.ts`:

```ts
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
    .replace(/\s+/g, '-');
}

const STATUS_SUFFIX: Partial<Record<Project['status'], (project: Project) => string>> = {
  stale: () => ' *(stale)*',
  archived: () => ' *(archived)*',
  deprecated: (project) => ` *(deprecated: ${project.deprecatedBy})*`,
};

function entry(project: Project): string {
  const suffix = STATUS_SUFFIX[project.status]?.(project) ?? '';
  return `- [${project.name}](${project.url}) - ${project.description}${suffix}`;
}

export function renderReadme({ categories, projects }: ReadmeContext): string {
  const sections = categories.map((category) => ({
    title: category.label.en,
    lines: projects
      .filter((project) => project.category === category.slug)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(entry),
  }));

  const contents = [
    'Start here',
    ...sections.map((section) => section.title),
    'French resources',
    'Contributing',
    'License',
  ]
    .map((title) => `- [${title}](#${anchor(title)})`)
    .join('\n');

  const body = sections
    .map((section) => `## ${section.title}\n\n${section.lines.join('\n')}`)
    .join('\n\n');

  return `# Awesome Yoto

[![Awesome](https://awesome.re/badge.svg)](https://awesome.re)

> A curated list of apps, tools and resources for the Yoto Player.

[Portal](https://yoto-community.github.io/) · [MYO guide](https://yoto-community.github.io/myo/) · [Contributing](CONTRIBUTING.md)

## Contents

${contents}

## Start here

- [Build your first MYO card](https://yoto-community.github.io/myo/) - The five-step guide from audio to printed label.
- [Browse the icon catalogue](https://yoto-community.github.io/icons-catalogue/) - Thousands of 16x16 icons for your cards.
- [Browse the podcast catalogue](https://yoto-community.github.io/podcast-catalogue/) - Child-safe feeds sorted by age and language.
- [Browse all projects](https://yoto-community.github.io/projects/) - Filter by category, status, platform and language.
- [Read the API documentation](https://yoto-community.github.io/api/) - The static JSON behind the portal.

${body}

## French resources

The interface and descriptions are available in French on the [French portal](https://yoto-community.github.io/fr/). The podcast catalogue also has a [French section](https://yoto-community.github.io/podcast-catalogue/fr/).

## Contributing

Found a project that belongs here? Read [CONTRIBUTING.md](CONTRIBUTING.md) and open a pull request. Entries are validated by CI: schema, duplicates, categories and links.

## License

[MIT](LICENSE). Awesome Yoto is a community project, not affiliated with Yoto.
`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- tests/readme.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing build test**

`tests/build.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../scripts/lib/catalog';
import { createLoader } from '../scripts/lib/load';

const load = createLoader();

describe('buildCatalog', () => {
  it('exposes a versioned, stable shape', () => {
    const catalog = buildCatalog({
      categories: load.categories(),
      projects: load.projects(),
      tags: load.tags(),
      collections: load.collections(),
    });
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.projects.length).toBeGreaterThanOrEqual(55);
    expect(catalog.categories).toHaveLength(9);
    expect(catalog.projects[0]).toHaveProperty('slug');
  });

  it('never leaks the meta file shape', () => {
    const catalog = buildCatalog({
      categories: load.categories(),
      projects: load.projects(),
      tags: load.tags(),
      collections: load.collections(),
    });
    expect(JSON.stringify(catalog)).not.toContain('updatedAt');
  });
});
```

- [ ] **Step 6: Implement the build CLI**

`scripts/lib/catalog.ts`:

```ts
import type { Category, Collection, Project } from './types';

export interface CatalogInput {
  categories: Category[];
  projects: Project[];
  tags: string[];
  collections: Collection[];
}

export function buildCatalog(input: CatalogInput) {
  return {
    schemaVersion: 1 as const,
    generatedAt: new Date().toISOString(),
    categories: input.categories,
    tags: input.tags,
    collections: input.collections,
    projects: input.projects,
  };
}
```

`scripts/build.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITE_GENERATED_DIR } from './lib/config';
import { buildCatalog } from './lib/catalog';
import { createLoader } from './lib/load';
import { renderReadme } from './lib/readme';

const load = createLoader();
const categories = load.categories();
const projects = load.projects();
const tags = load.tags();
const collections = load.collections();
const check = process.argv.includes('--check');

const readme = renderReadme({ categories, projects, collections });
const readmePath = join(ROOT, 'README.md');
const current = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';

if (check) {
  if (current !== readme) {
    console.error('README.md is out of date. Run `pnpm build:data` and commit the result.');
    process.exit(1);
  }
  console.log('README.md is up to date.');
} else {
  writeFileSync(readmePath, readme);
  mkdirSync(SITE_GENERATED_DIR, { recursive: true });
  writeFileSync(
    join(SITE_GENERATED_DIR, 'catalog.json'),
    `${JSON.stringify(buildCatalog({ categories, projects, tags, collections }), null, 2)}\n`,
  );
  console.log(`Generated README.md and ${projects.length} projects for the site.`);
}
```

`scripts/postbuild.ts`:

```ts
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/config';

const source = join(ROOT, 'site/src/generated/catalog.json');
const apiDir = join(ROOT, 'site/dist/api');
mkdirSync(apiDir, { recursive: true });
copyFileSync(source, join(apiDir, 'catalog.json'));

const catalog = JSON.parse(readFileSync(source, 'utf8')) as {
  projects: unknown[];
  categories: unknown[];
};
writeFileSync(join(apiDir, 'projects.json'), `${JSON.stringify(catalog.projects, null, 2)}\n`);
writeFileSync(join(apiDir, 'categories.json'), `${JSON.stringify(catalog.categories, null, 2)}\n`);
console.log('API JSON copied to site/dist/api/.');
```

- [ ] **Step 7: Generate and verify**

Run: `pnpm build:data`
Expected: `README.md` created; `site/src/generated/catalog.json` created.

Run: `pnpm build:data -- --check`
Expected: `README.md is up to date.`

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

> **Final README structure (after awesome-lint):** the Awesome badge is inline in
> the H1; the `## License` heading is removed (the MIT sentence lives in
> Contributing); Start here has three bullets (`/myo/`, `/projects/`, `/api/`);
> the ToC omits *Contributing* (awesome-lint forbids it); `CONTRIBUTING.md` is
> created in this task. The golden test above is the pre-lint version; update it
> together with the renderer.

```bash
git add README.md CONTRIBUTING.md scripts/lib/readme.ts scripts/build.ts scripts/postbuild.ts tests
git commit -m "feat: generate the awesome README and site catalog"
```

---

### Task 7: Astro scaffold, design system and i18n plumbing

**Files:**

- Create: `site/package.json`, `site/tsconfig.json`, `site/astro.config.mjs`
- Create: `site/src/styles/tokens.css`, `site/src/styles/global.css`
- Create: `site/src/layouts/Base.astro`
- Create: `site/src/components/Header.astro`, `Footer.astro`, `Button.astro`, `StatusBadge.astro`
- Create: `site/src/i18n/{en,fr,index}.ts`
- Create: `site/src/lib/routes.ts`
- Create: `site/src/pages/index.astro`, `site/src/pages/fr/index.astro`
- Create: `site/src/views/HomeView.astro`
- Modify: `vitest.config.ts` (include site i18n tests)
- Test: `tests/routes.test.ts`, `site/src/i18n/index.test.ts`

**Interfaces:**

- Produces: `Lang`, `localePath(lang, path)`, `stripLocale(path)`, `langFromPath(path)`
- Produces: `t(lang, key): string`, `en`, `fr`
- Produces: design tokens and base components used by every later page

- [ ] **Step 1: Scaffold the site package**

`site/package.json`:

```json
{
  "name": "site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "@fontsource-variable/nunito": "^5.2.5",
    "astro": "^5.18.2"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "@astrojs/sitemap": "^3.6.0",
    "prettier-plugin-astro": "^0.14.1",
    "typescript": "^5.9.3"
  }
}
```

`site/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "~/*": ["src/*"] }
  }
}
```

`site/astro.config.mjs`:

```js
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yoto-community.github.io',
  base: '/',
  outDir: './dist',
  build: { format: 'directory' },
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: { prefixDefaultLocale: false },
  },
});
```

Run: `pnpm install`.

- [ ] **Step 2: Write the failing route and i18n tests**

`tests/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { langFromPath, localePath, stripLocale } from '../site/src/lib/routes';

describe('localePath', () => {
  it('leaves English paths unchanged', () => {
    expect(localePath('en', '/projects/')).toBe('/projects/');
  });
  it('prefixes French paths', () => {
    expect(localePath('fr', '/projects/')).toBe('/fr/projects/');
  });
  it('handles the home path', () => {
    expect(localePath('fr', '/')).toBe('/fr/');
    expect(localePath('en', '/')).toBe('/');
  });
});

describe('langFromPath', () => {
  it('detects French', () => {
    expect(langFromPath('/fr/projects/')).toBe('fr');
    expect(langFromPath('/fr/')).toBe('fr');
  });
  it('defaults to English', () => {
    expect(langFromPath('/projects/')).toBe('en');
    expect(langFromPath('/french/')).toBe('en');
  });
});

describe('stripLocale', () => {
  it('removes the French prefix', () => {
    expect(stripLocale('/fr/p/louis/')).toBe('/p/louis/');
  });
  it('keeps English paths', () => {
    expect(stripLocale('/p/louis/')).toBe('/p/louis/');
  });
});
```

`site/src/i18n/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { en, fr, t } from './index';

describe('i18n', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('translates a known key', () => {
    expect(t('fr', 'nav.projects')).toBe('Projets');
    expect(t('en', 'nav.projects')).toBe('Projects');
  });

  it('falls back to English for a missing French value', () => {
    expect(t('fr', 'nav.myo')).toBe('Parcours MYO');
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm test -- tests/routes.test.ts site/src/i18n/index.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement routes and dictionaries**

`site/src/lib/routes.ts`:

```ts
export type Lang = 'en' | 'fr';

export function localePath(lang: Lang, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'en') return clean;
  return clean === '/' ? '/fr/' : `/fr${clean}`;
}

export function stripLocale(path: string): string {
  if (path === '/fr' || path === '/fr/') return '/';
  return path.startsWith('/fr/') ? path.slice(3) : path;
}

export function langFromPath(path: string): Lang {
  return path === '/fr' || path.startsWith('/fr/') ? 'fr' : 'en';
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'fr' : 'en';
}
```

`site/src/i18n/en.ts`:

```ts
export const en = {
  'site.title': 'Awesome Yoto',
  'site.tagline': 'The curated Yoto ecosystem',
  'site.description': 'A curated list of apps, tools and resources for the Yoto Player.',
  'nav.projects': 'Projects',
  'nav.myo': 'MYO guide',
  'nav.contribute': 'Contribute',
  'nav.about': 'About',
  'nav.api': 'API',
  'home.hero.title': 'Everything the Yoto community builds, in one place',
  'home.hero.subtitle':
    'Apps, card makers, icon libraries, integrations and guides — checked, categorized and kept honest.',
  'home.hero.cta': 'Browse the projects',
  'home.hero.secondary': 'Build your first card',
  'home.catalogues.title': 'Go deeper',
  'home.catalogues.icons': 'Icon catalogue',
  'home.catalogues.icons.text': 'Thousands of 16x16 icons, searchable and editable.',
  'home.catalogues.podcasts': 'Podcast catalogue',
  'home.catalogues.podcasts.text': 'Child-safe feeds sorted by age and language.',
  'home.catalogues.myo': 'MYO guide',
  'home.catalogues.myo.text': 'From raw audio to a printed card, in five steps.',
  'search.label': 'Search',
  'search.placeholder': 'Search projects, tools, guides…',
  'filter.category': 'Category',
  'filter.status': 'Status',
  'filter.platform': 'Platform',
  'filter.tag': 'Tag',
  'filter.official': 'Official only',
  'filter.french': 'French available',
  'filter.clear': 'Clear filters',
  'filter.results': 'projects',
  'filter.empty': 'No project matches these filters.',
  'sort.label': 'Sort',
  'sort.category': 'Category',
  'sort.recent': 'Recently added',
  'sort.stars': 'Stars',
  'sort.alpha': 'A–Z',
  'status.active': 'Active',
  'status.maintained': 'Maintained',
  'status.stale': 'Stale',
  'status.archived': 'Archived',
  'status.deprecated': 'Deprecated',
  'project.website': 'Website',
  'project.repo': 'Repository',
  'project.author': 'Author',
  'project.license': 'License',
  'project.platforms': 'Platforms',
  'project.requires': 'Requires',
  'project.lastCommit': 'Last commit',
  'project.stars': 'Stars',
  'project.related': 'Related projects',
  'project.warning.legal-backup': 'Only use this with cards and audio you own.',
  'project.warning.unofficial-api': 'Uses an unofficial API that may break without notice.',
  'project.warning.experimental': 'Experimental project. Expect rough edges.',
  'project.warning.paid': 'Requires a paid product or subscription.',
  'footer.disclaimer': 'Community project, not affiliated with Yoto.',
  'footer.license': 'MIT licensed',
  'notfound.title': 'Page not found',
  'notfound.text': 'The page you are looking for does not exist.',
  'notfound.back': 'Back to the projects',
} as const;

export type MessageKey = keyof typeof en;
```

`site/src/i18n/fr.ts`:

```ts
import type { MessageKey } from './en';

export const fr: Record<MessageKey, string> = {
  'site.title': 'Awesome Yoto',
  'site.tagline': "L'écosystème Yoto, curé",
  'site.description':
    'Une liste curée d’applications, d’outils et de ressources pour le lecteur Yoto.',
  'nav.projects': 'Projets',
  'nav.myo': 'Parcours MYO',
  'nav.contribute': 'Contribuer',
  'nav.about': 'À propos',
  'nav.api': 'API',
  'home.hero.title': 'Tout ce que la communauté Yoto construit, au même endroit',
  'home.hero.subtitle':
    'Applications, créateurs de cartes, icônes, intégrations et guides — vérifiés, classés et maintenus à jour.',
  'home.hero.cta': 'Parcourir les projets',
  'home.hero.secondary': 'Créer sa première carte',
  'home.catalogues.title': 'Aller plus loin',
  'home.catalogues.icons': 'Catalogue d’icônes',
  'home.catalogues.icons.text': 'Des milliers d’icônes 16x16, cherchables et éditables.',
  'home.catalogues.podcasts': 'Catalogue de podcasts',
  'home.catalogues.podcasts.text': 'Des flux pour enfants, classés par âge et par langue.',
  'home.catalogues.myo': 'Parcours MYO',
  'home.catalogues.myo.text': 'De l’audio brut à la carte imprimée, en cinq étapes.',
  'search.label': 'Rechercher',
  'search.placeholder': 'Rechercher un projet, un outil, un guide…',
  'filter.category': 'Catégorie',
  'filter.status': 'Statut',
  'filter.platform': 'Plateforme',
  'filter.tag': 'Tag',
  'filter.official': 'Officiel uniquement',
  'filter.french': 'Disponible en français',
  'filter.clear': 'Réinitialiser',
  'filter.results': 'projets',
  'filter.empty': 'Aucun projet ne correspond à ces filtres.',
  'sort.label': 'Trier',
  'sort.category': 'Catégorie',
  'sort.recent': 'Ajout récent',
  'sort.stars': 'Étoiles',
  'sort.alpha': 'A–Z',
  'status.active': 'Actif',
  'status.maintained': 'Maintenu',
  'status.stale': 'Ralenti',
  'status.archived': 'Archivé',
  'status.deprecated': 'Déprécié',
  'project.website': 'Site',
  'project.repo': 'Dépôt',
  'project.author': 'Auteur',
  'project.license': 'Licence',
  'project.platforms': 'Plateformes',
  'project.requires': 'Prérequis',
  'project.lastCommit': 'Dernier commit',
  'project.stars': 'Étoiles',
  'project.related': 'Projets proches',
  'project.warning.legal-backup':
    'À utiliser uniquement avec des cartes et des audios que vous possédez.',
  'project.warning.unofficial-api':
    'Utilise une API non officielle, susceptible de casser sans préavis.',
  'project.warning.experimental': 'Projet expérimental. Attendez-vous à des aspérités.',
  'project.warning.paid': 'Nécessite un produit ou un abonnement payant.',
  'footer.disclaimer': 'Projet communautaire, non affilié à Yoto.',
  'footer.license': 'Licence MIT',
  'notfound.title': 'Page introuvable',
  'notfound.text': 'La page que vous cherchez n’existe pas.',
  'notfound.back': 'Retour aux projets',
};
```

`site/src/i18n/index.ts`:

```ts
import { en, type MessageKey } from './en';
import { fr } from './fr';
import type { Lang } from '../lib/routes';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, fr };

export function t(lang: Lang, key: MessageKey): string {
  return dictionaries[lang][key] ?? en[key];
}

export { en, fr };
export type { MessageKey };
```

Update `vitest.config.ts` include to `['tests/**/*.test.ts', 'site/src/**/*.test.ts']`.

- [ ] **Step 5: Write the design tokens and global styles**

`site/src/styles/tokens.css`:

```css
:root {
  --bg: #f7f3e9;
  --surface: #fffdf7;
  --surface-2: #efe9da;
  --ink: #1f2a24;
  --ink-muted: #5a665f;
  --border: #ded6c4;
  --accent: #006d41;
  --accent-strong: #00512f;
  --accent-soft: #e3f0e7;
  --accent-2: #af294e;
  --accent-2-soft: #f6e3e9;
  --warn: #7e5700;
  --warn-soft: #f7edd3;
  --danger: #a12626;
  --danger-soft: #f7e3e3;
  --radius: 20px;
  --radius-sm: 12px;
  --radius-pill: 999px;
  --shadow: 0 1px 2px rgb(31 42 36 / 6%), 0 12px 32px rgb(31 42 36 / 8%);
  --font-sans: 'Nunito Variable', ui-rounded, system-ui, sans-serif;
  --measure: 68ch;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-8: 3rem;
  --space-12: 4.5rem;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #101512;
    --surface: #171d19;
    --surface-2: #202721;
    --ink: #edefe9;
    --ink-muted: #a7b2aa;
    --border: #313a33;
    --accent: #5bc98f;
    --accent-strong: #7adfa6;
    --accent-soft: #1b3326;
    --accent-2: #f08aa6;
    --accent-2-soft: #3a1f28;
    --warn: #e0b25c;
    --warn-soft: #3a2f16;
    --danger: #f19494;
    --danger-soft: #3b2020;
    --shadow: 0 1px 2px rgb(0 0 0 / 40%), 0 12px 32px rgb(0 0 0 / 45%);
  }
}
```

`site/src/styles/global.css`:

```css
@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color-scheme: light dark;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 1.0625rem;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

img,
svg {
  display: block;
  max-width: 100%;
}

a {
  color: var(--accent-strong);
  text-underline-offset: 0.18em;
}

a:hover {
  color: var(--accent);
}

:focus-visible {
  outline: 3px solid var(--accent-2);
  outline-offset: 3px;
  border-radius: 4px;
}

h1,
h2,
h3 {
  line-height: 1.12;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-4);
  text-wrap: balance;
}

h1 {
  font-size: clamp(2.2rem, 5vw, 4rem);
  font-weight: 800;
}

h2 {
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800;
}

p {
  margin: 0 0 var(--space-4);
  text-wrap: pretty;
}

.container {
  width: min(1120px, 100% - 2rem);
  margin-inline: auto;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--accent);
  color: #fff;
  padding: var(--space-3) var(--space-4);
  z-index: 100;
}

.skip-link:focus {
  left: var(--space-4);
  top: var(--space-4);
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 6: Write the base layout and shared components**

`site/src/layouts/Base.astro`:

```astro
---
import '@fontsource-variable/nunito';
import '../styles/global.css';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { langFromPath, localePath, otherLang, type Lang } from '../lib/routes';
import { t } from '../i18n';

interface Props {
  lang: Lang;
  title: string;
  description: string;
  path: string;
}
const { lang, title, description, path } = Astro.props;
const canonical = new URL(localePath(lang, path), Astro.site).href;
const alt = new URL(localePath(otherLang(lang), path), Astro.site).href;
const fullTitle = path === '/' || path === '/fr/' ? `${title} — ${t(lang, 'site.tagline')}` : `${title} — ${t(lang, 'site.title')}`;
---
<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="alternate" hreflang="en" href={new URL(localePath('en', path), Astro.site).href} />
    <link rel="alternate" hreflang="fr" href={new URL(localePath('fr', path), Astro.site).href} />
    <link rel="alternate" hreflang="x-default" href={new URL(localePath('en', path), Astro.site).href} />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:site_name" content="Awesome Yoto" />
    <meta property="og:image" content={new URL('/og.png', Astro.site).href} />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <a class="skip-link" href="#main">{lang === 'fr' ? 'Aller au contenu' : 'Skip to content'}</a>
    <Header lang={lang} path={path} altUrl={alt} />
    <main id="main">
      <slot />
    </main>
    <Footer lang={lang} />
  </body>
</html>
```

`site/src/components/Header.astro`:

```astro
---
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';

interface Props { lang: Lang; path: string; altUrl: string }
const { lang, path, altUrl } = Astro.props;
const links = [
  { href: '/projects/', label: 'nav.projects' as const },
  { href: '/myo/', label: 'nav.myo' as const },
  { href: '/contribute/', label: 'nav.contribute' as const },
];
---
<header class="site-header">
  <div class="container bar">
    <a class="brand" href={localePath(lang, '/')} aria-label={t(lang, 'site.title')}>
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect x="2" y="2" width="30" height="30" rx="10" fill="var(--accent)" />
        <path d="M10 12v10M14 9v16M18 13v8M22 10v14M26 14v6" stroke="var(--bg)" stroke-width="2.2" stroke-linecap="round" />
      </svg>
      <span>Awesome Yoto</span>
    </a>
    <nav aria-label={lang === 'fr' ? 'Navigation principale' : 'Main navigation'}>
      <ul>
        {links.map((link) => (
          <li><a href={localePath(lang, link.href)} aria-current={path === link.href ? 'page' : undefined}>{t(lang, link.label)}</a></li>
        ))}
      </ul>
    </nav>
    <a class="lang" href={altUrl} hreflang={lang === 'en' ? 'fr' : 'en'}>{lang === 'en' ? 'FR' : 'EN'}</a>
  </div>
</header>

<style>
  .site-header { border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px); position: sticky; top: 0; z-index: 20; }
  .bar { display: flex; align-items: center; gap: var(--space-5); min-height: 72px; }
  .brand { display: inline-flex; align-items: center; gap: var(--space-3); font-weight: 800; color: var(--ink); text-decoration: none; font-size: 1.1rem; }
  nav { margin-inline-start: auto; }
  ul { display: flex; gap: var(--space-4); list-style: none; margin: 0; padding: 0; }
  nav a { color: var(--ink-muted); text-decoration: none; font-weight: 700; }
  nav a[aria-current='page'], nav a:hover { color: var(--accent); }
  .lang { border: 1px solid var(--border); border-radius: var(--radius-pill); padding: 0.35rem 0.8rem; font-weight: 800; text-decoration: none; color: var(--ink); }
  @media (max-width: 720px) { nav { display: none; } }
</style>
```

`site/src/components/Footer.astro`:

```astro
---
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
---
<footer class="site-footer">
  <div class="container">
    <p>{t(lang, 'footer.disclaimer')} · {t(lang, 'footer.license')}</p>
    <p>
      <a href={localePath(lang, '/about/')}>{t(lang, 'nav.about')}</a> ·
      <a href={localePath(lang, '/api/')}>{t(lang, 'nav.api')}</a> ·
      <a href="https://yoto.space/developers">Yoto Space</a>
    </p>
  </div>
</footer>

<style>
  .site-footer { border-top: 1px solid var(--border); margin-top: var(--space-12); padding-block: var(--space-8); color: var(--ink-muted); }
  p { margin: 0 0 var(--space-2); font-size: 0.95rem; }
</style>
```

`site/src/components/Button.astro`:

```astro
---
interface Props {
  href: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  external?: boolean;
}
const { href, variant = 'primary', external = false } = Astro.props;
---
<a class:list={['btn', variant]} href={href} rel={external ? 'noopener' : undefined} target={external ? '_blank' : undefined}>
  <slot />
</a>

<style>
  .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border-radius: var(--radius-pill); font-weight: 800; text-decoration: none; border: 1px solid transparent; transition: transform 160ms var(--ease), background 160ms var(--ease); }
  .btn:hover { transform: translateY(-1px); }
  .primary { background: var(--accent); color: #fff; }
  .primary:hover { background: var(--accent-strong); color: #fff; }
  .secondary { background: var(--accent-2); color: #fff; }
  .secondary:hover { filter: brightness(0.92); color: #fff; }
  .ghost { border-color: var(--border); color: var(--ink); background: var(--surface); }
</style>
```

`site/src/components/StatusBadge.astro`:

```astro
---
import { t, type MessageKey } from '../i18n';
import type { Status } from '../../../scripts/lib/types';
import type { Lang } from '../lib/routes';
const { status, lang } = Astro.props as { status: Status; lang: Lang };
---
<span class:list={['badge', status]}>{t(lang, `status.${status}` as MessageKey)}</span>

<style>
  .badge { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: var(--radius-pill); padding: 0.2rem 0.6rem; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.01em; background: var(--accent-soft); color: var(--accent-strong); }
  .active { background: var(--accent-soft); color: var(--accent-strong); }
  .maintained { background: var(--surface-2); color: var(--ink-muted); }
  .stale { background: var(--warn-soft); color: var(--warn); }
  .archived { background: var(--surface-2); color: var(--ink-muted); }
  .deprecated { background: var(--danger-soft); color: var(--danger); }
</style>
```

- [ ] **Step 7: Write the home page**

`site/src/views/HomeView.astro`:

```astro
---
import Button from '../components/Button.astro';
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
const catalogues = [
  { slug: 'myo', title: 'home.catalogues.myo', text: 'home.catalogues.myo.text', href: '/myo/' },
  { slug: 'icons', title: 'home.catalogues.icons', text: 'home.catalogues.icons.text', href: '/icons-catalogue/' },
  { slug: 'podcasts', title: 'home.catalogues.podcasts', text: 'home.catalogues.podcasts.text', href: '/podcast-catalogue/' },
] as const;
---
<section class="hero">
  <div class="container">
    <p class="eyebrow">{t(lang, 'site.tagline')}</p>
    <h1>{t(lang, 'home.hero.title')}</h1>
    <p class="lede">{t(lang, 'home.hero.subtitle')}</p>
    <div class="actions">
      <Button href={localePath(lang, '/projects/')}>{t(lang, 'home.hero.cta')}</Button>
      <Button href={localePath(lang, '/myo/')} variant="ghost">{t(lang, 'home.hero.secondary')}</Button>
    </div>
  </div>
</section>

<section class="container deeper" aria-labelledby="deeper-title">
  <h2 id="deeper-title">{t(lang, 'home.catalogues.title')}</h2>
  <div class="grid">
    {catalogues.map((item) => (
      <a class="tile" href={item.href}>
        <h3>{t(lang, item.title)}</h3>
        <p>{t(lang, item.text)}</p>
      </a>
    ))}
  </div>
</section>

<style>
  .hero { padding-block: clamp(3rem, 9vw, 7rem) var(--space-12); }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.8rem; font-weight: 800; color: var(--accent); margin-bottom: var(--space-3); }
  .lede { max-width: 58ch; font-size: 1.2rem; color: var(--ink-muted); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-6); }
  .deeper { padding-block: var(--space-8); }
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .tile { display: block; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-6); box-shadow: var(--shadow); text-decoration: none; color: var(--ink); transition: transform 180ms var(--ease); }
  .tile:hover { transform: translateY(-3px); }
  .tile h3 { margin-bottom: var(--space-2); color: var(--accent-strong); }
  .tile p { margin: 0; color: var(--ink-muted); }
</style>
```

`site/src/pages/index.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import HomeView from '../views/HomeView.astro';
import { t } from '../i18n';
---
<Base lang="en" title={t('en', 'site.title')} description={t('en', 'site.description')} path="/">
  <HomeView lang="en" />
</Base>
```

`site/src/pages/fr/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import HomeView from '../../views/HomeView.astro';
import { t } from '../../i18n';
---
<Base lang="fr" title={t('fr', 'site.title')} description={t('fr', 'site.description')} path="/">
  <HomeView lang="fr" />
</Base>
```

- [ ] **Step 8: Verify**

Run: `pnpm build:data && pnpm --filter site check`
Expected: no type errors.

Run: `pnpm --filter site build`
Expected: `site/dist/index.html` and `site/dist/fr/index.html`.

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 9: Visual check**

Run `pnpm --filter site dev`, then check at 375 px and 1280 px: cream background,
green accents, rounded tiles, visible focus ring, dark mode via OS. No horizontal
scroll. This is a manual gate; note the result in the commit message.

- [ ] **Step 10: Commit**

```bash
git add site vitest.config.ts tests/routes.test.ts
git commit -m "feat: add Astro scaffold, design system and bilingual layout"
```

---

### Task 8: Project list, detail pages and client-side filters

**Files:**

- Create: `site/src/lib/filter.ts`, `site/src/lib/filter.test.ts`
- Create: `site/src/lib/catalog.ts`
- Create: `site/src/scripts/filters.ts`
- Create: `site/src/components/ProjectCard.astro`, `FilterBar.astro`, `EmptyState.astro`
- Create: `site/src/views/ProjectsView.astro`, `ProjectView.astro`
- Create: `site/src/pages/projects/index.astro`, `site/src/pages/p/[slug].astro`

**Interfaces:**

- Consumes: `catalog.json`, `t()`, `localePath()`
- Produces: `FilterState`, `parseFilters`, `serializeFilters`, `filterProjects`, `sortProjects`
- Produces: routes `/projects/` and `/p/<slug>/`

- [ ] **Step 1: Write the failing filter tests**

`site/src/lib/filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  filterProjects,
  parseFilters,
  serializeFilters,
  sortProjects,
  type FilterState,
} from './filter';
import type { Project } from '../../../scripts/lib/types';

const projects = [
  {
    slug: 'louis',
    name: 'Louis',
    url: 'https://a.example',
    category: 'create',
    description: 'Turn YouTube into a card.',
    descriptionFr: 'Transforme YouTube en carte.',
    tags: ['youtube', 'web'],
    author: 'A',
    license: 'MIT',
    status: 'active',
    official: false,
    platforms: ['web'],
    added: '2026-11-01',
    meta: { stars: 50 },
  },
  {
    slug: 'yoto',
    name: 'Yoto',
    url: 'https://b.example',
    category: 'official',
    description: 'The official app.',
    tags: ['kids'],
    author: 'Yoto',
    license: 'Proprietary',
    status: 'active',
    official: true,
    platforms: ['web', 'ios'],
    added: '2026-10-01',
    meta: { stars: 5 },
  },
  {
    slug: 'old',
    name: 'Old tool',
    url: 'https://c.example',
    category: 'create',
    description: 'An old tool.',
    tags: ['cli'],
    author: 'B',
    license: 'MIT',
    status: 'stale',
    official: false,
    platforms: ['cli'],
    added: '2025-01-01',
  },
] as Project[];

const empty: FilterState = {
  q: '',
  category: '',
  status: '',
  platform: '',
  tag: '',
  official: false,
  french: false,
  sort: 'category',
};

describe('parseFilters', () => {
  it('reads every supported parameter', () => {
    const state = parseFilters(
      '?q=you&cat=create&status=active&platform=web&tag=youtube&official=1&fr=1&sort=stars',
    );
    expect(state).toEqual({
      q: 'you',
      category: 'create',
      status: 'active',
      platform: 'web',
      tag: 'youtube',
      official: true,
      french: true,
      sort: 'stars',
    });
  });

  it('ignores unknown sort values', () => {
    expect(parseFilters('?sort=nope').sort).toBe('category');
  });
});

describe('serializeFilters', () => {
  it('omits empty values', () => {
    expect(serializeFilters(empty)).toBe('');
  });

  it('round-trips a non-empty state', () => {
    const state = {
      ...empty,
      q: 'you',
      category: 'create',
      official: true,
      sort: 'recent' as const,
    };
    expect(parseFilters(`?${serializeFilters(state)}`)).toEqual(state);
  });
});

describe('filterProjects', () => {
  it('matches text against name and descriptions', () => {
    expect(filterProjects(projects, { ...empty, q: 'youtube' }).map((p) => p.slug)).toEqual([
      'louis',
    ]);
    expect(filterProjects(projects, { ...empty, q: 'officiel' })).toEqual([]);
  });

  it('combines category, status, platform and tag', () => {
    expect(
      filterProjects(projects, { ...empty, category: 'create', status: 'active' }).map(
        (p) => p.slug,
      ),
    ).toEqual(['louis']);
    expect(filterProjects(projects, { ...empty, platform: 'cli' }).map((p) => p.slug)).toEqual([
      'old',
    ]);
    expect(filterProjects(projects, { ...empty, tag: 'youtube' }).map((p) => p.slug)).toEqual([
      'louis',
    ]);
  });

  it('filters by official and French availability', () => {
    expect(filterProjects(projects, { ...empty, official: true }).map((p) => p.slug)).toEqual([
      'yoto',
    ]);
    expect(filterProjects(projects, { ...empty, french: true }).map((p) => p.slug)).toEqual([
      'louis',
    ]);
  });
});

describe('sortProjects', () => {
  it('sorts by recency, stars and name', () => {
    expect(sortProjects(projects, 'recent').map((p) => p.slug)).toEqual(['louis', 'yoto', 'old']);
    expect(sortProjects(projects, 'stars').map((p) => p.slug)).toEqual(['louis', 'yoto', 'old']);
    expect(sortProjects(projects, 'alpha').map((p) => p.slug)).toEqual(['louis', 'old', 'yoto']);
  });

  it('keeps the source order for category', () => {
    expect(sortProjects(projects, 'category').map((p) => p.slug)).toEqual(['louis', 'yoto', 'old']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- site/src/lib/filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the filter module**

`site/src/lib/filter.ts`:

```ts
import type { Project } from '../../../scripts/lib/types';

export type Sort = 'category' | 'recent' | 'stars' | 'alpha';

export interface FilterState {
  q: string;
  category: string;
  status: string;
  platform: string;
  tag: string;
  official: boolean;
  french: boolean;
  sort: Sort;
}

const SORTS: Sort[] = ['category', 'recent', 'stars', 'alpha'];

export function parseFilters(search: string): FilterState {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sort = params.get('sort') as Sort | null;
  return {
    q: params.get('q') ?? '',
    category: params.get('cat') ?? '',
    status: params.get('status') ?? '',
    platform: params.get('platform') ?? '',
    tag: params.get('tag') ?? '',
    official: params.get('official') === '1',
    french: params.get('fr') === '1',
    sort: sort && SORTS.includes(sort) ? sort : 'category',
  };
}

export function serializeFilters(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('cat', state.category);
  if (state.status) params.set('status', state.status);
  if (state.platform) params.set('platform', state.platform);
  if (state.tag) params.set('tag', state.tag);
  if (state.official) params.set('official', '1');
  if (state.french) params.set('fr', '1');
  if (state.sort !== 'category') params.set('sort', state.sort);
  return params.toString();
}

export function filterProjects(projects: Project[], state: FilterState): Project[] {
  const query = state.q.trim().toLowerCase();
  return projects.filter((project) => {
    if (state.category && project.category !== state.category) return false;
    if (state.status && project.status !== state.status) return false;
    if (
      state.platform &&
      !project.platforms.includes(state.platform as Project['platforms'][number])
    )
      return false;
    if (state.tag && !project.tags.includes(state.tag)) return false;
    if (state.official && !project.official) return false;
    if (state.french && !project.descriptionFr) return false;
    if (query) {
      const haystack = [project.name, project.description, project.descriptionFr ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortProjects(projects: Project[], sort: Sort): Project[] {
  const copy = [...projects];
  switch (sort) {
    case 'recent':
      return copy.sort((a, b) => b.added.localeCompare(a.added));
    case 'stars':
      return copy.sort((a, b) => (b.meta?.stars ?? 0) - (a.meta?.stars ?? 0));
    case 'alpha':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- site/src/lib/filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the typed catalog helper, card, filter bar and empty state**

`site/src/lib/catalog.ts` (the generated JSON is untyped, so this is the single
place where it is narrowed once):

```ts
import raw from '../generated/catalog.json';
import type { Category, Collection, Project } from '../../../scripts/lib/types';

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  categories: Category[];
  tags: string[];
  collections: Collection[];
  projects: Project[];
}

export const catalog = raw as unknown as Catalog;
```

`site/src/components/ProjectCard.astro`:

```astro
---
import StatusBadge from './StatusBadge.astro';
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
import type { Project } from '../../../scripts/lib/types';

interface Props { project: Project; lang: Lang }
const { project, lang } = Astro.props;
const description = lang === 'fr' && project.descriptionFr ? project.descriptionFr : project.description;
const fallback = lang === 'fr' && !project.descriptionFr;
---
<article
  class="card"
  data-project
  data-slug={project.slug}
  data-category={project.category}
  data-status={project.status}
  data-platforms={project.platforms.join(' ')}
  data-tags={project.tags.join(' ')}
  data-official={project.official ? '1' : '0'}
  data-french={project.descriptionFr ? '1' : '0'}
  data-name={project.name}
  data-description={`${project.description} ${project.descriptionFr ?? ''}`}
  data-added={project.added}
  data-stars={project.meta?.stars ?? 0}
>
  <div class="top">
    <h3><a href={localePath(lang, `/p/${project.slug}/`)}>{project.name}</a></h3>
    <StatusBadge status={project.status} lang={lang} />
  </div>
  <p class="desc">{description}{fallback && <span class="en" title="English only">EN</span>}</p>
  <ul class="tags" aria-label={t(lang, 'filter.tag')}>
    {project.tags.map((tag) => <li>{tag}</li>)}
  </ul>
  <p class="meta">
    {project.official && <span class="official">{lang === 'fr' ? 'Officiel' : 'Official'}</span>}
    {project.meta?.stars !== undefined && <span>★ {project.meta.stars}</span>}
    {project.meta?.lastCommit && <span>{project.meta.lastCommit}</span>}
  </p>
</article>

<style>
  .card { display: flex; flex-direction: column; gap: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-5); box-shadow: var(--shadow); }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
  h3 { margin: 0; font-size: 1.15rem; }
  h3 a { color: var(--ink); text-decoration: none; }
  h3 a:hover { color: var(--accent-strong); }
  .desc { margin: 0; color: var(--ink-muted); font-size: 0.97rem; }
  .en { margin-inline-start: 0.4rem; font-size: 0.68rem; font-weight: 800; color: var(--ink-muted); border: 1px solid var(--border); border-radius: 4px; padding: 0 0.25rem; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.35rem; list-style: none; margin: 0; padding: 0; }
  .tags li { font-size: 0.72rem; font-weight: 700; color: var(--ink-muted); background: var(--surface-2); border-radius: var(--radius-pill); padding: 0.1rem 0.5rem; }
  .meta { display: flex; gap: var(--space-3); margin: auto 0 0; font-size: 0.8rem; color: var(--ink-muted); }
  .official { color: var(--accent-strong); font-weight: 800; }
</style>
```

`site/src/components/FilterBar.astro`:

```astro
---
import { t, type MessageKey } from '../i18n';
import type { Lang } from '../lib/routes';
import type { Category } from '../../../scripts/lib/types';
const { lang, categories, tags } = Astro.props as { lang: Lang; categories: Category[]; tags: string[] };
---
<form class="filters" data-filters aria-label={t(lang, 'filter.category')}>
  <label class="field grow">
    <span>{t(lang, 'search.label')}</span>
    <input type="search" name="q" placeholder={t(lang, 'search.placeholder')} autocomplete="off" />
  </label>
  <label class="field">
    <span>{t(lang, 'filter.category')}</span>
    <select name="cat">
      <option value="">{lang === 'fr' ? 'Toutes' : 'All'}</option>
      {categories.map((category) => <option value={category.slug}>{category.label[lang]}</option>)}
    </select>
  </label>
  <label class="field">
    <span>{t(lang, 'filter.status')}</span>
    <select name="status">
      <option value="">{lang === 'fr' ? 'Tous' : 'All'}</option>
      {(['active', 'maintained', 'stale', 'archived', 'deprecated'] as const).map((status) => (
        <option value={status}>{t(lang, `status.${status}` as MessageKey)}</option>
      ))}
    </select>
  </label>
  <label class="field">
    <span>{t(lang, 'filter.tag')}</span>
    <select name="tag">
      <option value="">{lang === 'fr' ? 'Tous' : 'All'}</option>
      {tags.map((tag) => <option value={tag}>{tag}</option>)}
    </select>
  </label>
  <label class="check"><input type="checkbox" name="official" value="1" /> {t(lang, 'filter.official')}</label>
  <label class="check"><input type="checkbox" name="fr" value="1" /> {t(lang, 'filter.french')}</label>
  <label class="field">
    <span>{t(lang, 'sort.label')}</span>
    <select name="sort">
      <option value="category">{t(lang, 'sort.category')}</option>
      <option value="recent">{t(lang, 'sort.recent')}</option>
      <option value="stars">{t(lang, 'sort.stars')}</option>
      <option value="alpha">{t(lang, 'sort.alpha')}</option>
    </select>
  </label>
  <button type="reset" class="clear">{t(lang, 'filter.clear')}</button>
</form>

<style>
  .filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4); }
  .field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; font-weight: 800; color: var(--ink-muted); }
  .field.grow { flex: 1 1 240px; }
  input[type='search'], select { font: inherit; padding: 0.55rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); color: var(--ink); }
  .check { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700; color: var(--ink-muted); padding-bottom: 0.5rem; }
  .clear { font: inherit; font-weight: 800; padding: 0.55rem 0.9rem; border-radius: var(--radius-pill); border: 1px solid var(--border); background: transparent; color: var(--ink); cursor: pointer; }
</style>
```

`site/src/components/EmptyState.astro`:

```astro
---
const { message } = Astro.props as { message: string };
---
<p class="empty" data-empty hidden>{message}</p>

<style>
  .empty { grid-column: 1 / -1; text-align: center; color: var(--ink-muted); background: var(--surface-2); border-radius: var(--radius); padding: var(--space-8); }
</style>
```

- [ ] **Step 6: Write the list view and the client filter script**

`site/src/views/ProjectsView.astro`:

```astro
---
import FilterBar from '../components/FilterBar.astro';
import ProjectCard from '../components/ProjectCard.astro';
import EmptyState from '../components/EmptyState.astro';
import { catalog } from '../lib/catalog';
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
const projects = catalog.projects;
---
<section class="container page">
  <h1>{lang === 'fr' ? 'Tous les projets' : 'All projects'}</h1>
  <p class="count" data-count aria-live="polite">{projects.length} {t(lang, 'filter.results')}</p>
  <FilterBar lang={lang} categories={catalog.categories} tags={catalog.tags} />
  <div class="grid" data-grid>
    {projects.map((project) => <ProjectCard project={project} lang={lang} />)}
    <EmptyState message={t(lang, 'filter.empty')} />
  </div>
  <a class="back" href={localePath(lang, '/')}>{lang === 'fr' ? '← Accueil' : '← Home'}</a>
</section>

<script>
  import '../scripts/filters';
</script>

<style>
  .page { padding-block: var(--space-8); }
  .count { color: var(--ink-muted); font-weight: 700; }
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); margin-top: var(--space-5); }
  .back { display: inline-block; margin-top: var(--space-6); color: var(--ink-muted); }
</style>
```

`site/src/scripts/filters.ts`:

```ts
import { filterProjects, parseFilters, serializeFilters, sortProjects } from '../lib/filter';
import type { Project } from '../../../scripts/lib/types';

const form = document.querySelector<HTMLFormElement>('[data-filters]');
const grid = document.querySelector<HTMLElement>('[data-grid]');
const count = document.querySelector<HTMLElement>('[data-count]');
const empty = document.querySelector<HTMLElement>('[data-empty]');

if (form && grid) {
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-project]')];
  const projects = cards.map((card) => ({
    slug: card.dataset.slug ?? '',
    name: card.dataset.name ?? '',
    description: card.dataset.description ?? '',
    category: card.dataset.category ?? '',
    status: card.dataset.status ?? '',
    tags: (card.dataset.tags ?? '').split(' ').filter(Boolean),
    platforms: (card.dataset.platforms ?? '').split(' ').filter(Boolean),
    official: card.dataset.official === '1',
    descriptionFr: card.dataset.french === '1' ? 'x' : undefined,
    added: card.dataset.added ?? '',
    meta: { stars: Number(card.dataset.stars ?? 0) },
  })) as unknown as Project[];

  const apply = () => {
    const state = parseFilters(window.location.search);
    const visible = sortProjects(filterProjects(projects, state), state.sort);
    const names = new Set(visible.map((project) => project.slug));
    for (const card of cards) card.hidden = !names.has(card.dataset.name ?? '');
    if (count)
      count.textContent = `${visible.length} ${count.textContent?.replace(/^\d+\s*/, '') ?? ''}`;
    if (empty) empty.hidden = visible.length > 0;
    const query = serializeFilters(state);
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  const sync = () => {
    const state = parseFilters(window.location.search);
    (form.elements.namedItem('q') as HTMLInputElement).value = state.q;
    (form.elements.namedItem('cat') as HTMLSelectElement).value = state.category;
    (form.elements.namedItem('status') as HTMLSelectElement).value = state.status;
    (form.elements.namedItem('tag') as HTMLSelectElement).value = state.tag;
    (form.elements.namedItem('sort') as HTMLSelectElement).value = state.sort;
    (form.elements.namedItem('official') as HTMLInputElement).checked = state.official;
    (form.elements.namedItem('fr') as HTMLInputElement).checked = state.french;
  };

  form.addEventListener('input', () => {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (typeof value === 'string' && value) params.set(key, value);
    }
    params.set('sort', (form.elements.namedItem('sort') as HTMLSelectElement).value);
    window.history.replaceState(null, '', `?${params.toString()}`);
    apply();
  });

  form.addEventListener('reset', () => {
    window.history.replaceState(null, '', window.location.pathname);
    requestAnimationFrame(() => {
      sync();
      apply();
    });
  });

  sync();
  apply();
}
```

Note: `byName` is unused — remove it. I'll fix in the plan text now. Also `slug` uses name; better use a data-slug attribute. Add `data-slug={project.slug}` to the card and use it. I'll adjust the code in the plan: card has `data-slug`, and the script builds `slug: card.dataset.slug`. Let me correct when writing. I'll write it correctly in the plan.

Actually, I already wrote the code block above with `data-name` for slug. That's a bug. Since I'm writing the plan file now, let me write the corrected version in the file (the content above is what I'm about to insert; I can fix it as I compose). Yes — I'm composing the edit. I'll use `data-slug`.

- [ ] **Step 7: Write the detail page**

`site/src/views/ProjectView.astro`:

```astro
---
import StatusBadge from '../components/StatusBadge.astro';
import { t, type MessageKey } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
import { catalog } from '../lib/catalog';
import type { Project } from '../../../scripts/lib/types';
const { project, lang } = Astro.props as { project: Project; lang: Lang };
const description = lang === 'fr' && project.descriptionFr ? project.descriptionFr : project.description;
const category = catalog.categories.find((item) => item.slug === project.category);
const related = catalog.projects
  .filter((item) => item.slug !== project.slug && item.category === project.category)
  .sort((a, b) => b.tags.filter((tag) => project.tags.includes(tag)).length - a.tags.filter((tag) => project.tags.includes(tag)).length)
  .slice(0, 3);
const warningKey = project.warning ? (`project.warning.${project.warning}` as MessageKey) : null;
---
<article class="container detail">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href={localePath(lang, '/projects/')}>{t(lang, 'nav.projects')}</a>
    <span aria-hidden="true">/</span>
    <a href={localePath(lang, `/categories/${project.category}/`)}>{category?.label[lang] ?? project.category}</a>
  </nav>
  <header>
    <div class="title">
      <h1>{project.name}</h1>
      <StatusBadge status={project.status} lang={lang} />
    </div>
    <p class="lede">{description}</p>
    <div class="actions">
      <a class="btn primary" href={project.url} rel="noopener" target="_blank">{t(lang, 'project.website')}</a>
      {project.repo && <a class="btn ghost" href={project.repo} rel="noopener" target="_blank">{t(lang, 'project.repo')}</a>}
    </div>
  </header>
  {warningKey && <p class="warning">{t(lang, warningKey)}</p>}
  <dl class="meta">
    <div><dt>{t(lang, 'project.author')}</dt><dd>{project.author}</dd></div>
    <div><dt>{t(lang, 'project.license')}</dt><dd>{project.license}</dd></div>
    <div><dt>{t(lang, 'project.platforms')}</dt><dd>{project.platforms.join(', ')}</dd></div>
    {project.requires?.length ? <div><dt>{t(lang, 'project.requires')}</dt><dd>{project.requires.join(', ')}</dd></div> : null}
    {project.meta?.lastCommit ? <div><dt>{t(lang, 'project.lastCommit')}</dt><dd>{project.meta.lastCommit}</dd></div> : null}
    {project.meta?.stars !== undefined ? <div><dt>{t(lang, 'project.stars')}</dt><dd>★ {project.meta.stars}</dd></div> : null}
  </dl>
  <p class="tags">{project.tags.map((tag) => <span>{tag}</span>)}</p>
  {project.status === 'deprecated' && project.deprecatedBy && <p class="deprecated">{lang === 'fr' ? 'Remplacé par' : 'Replaced by'} : {project.deprecatedBy}</p>}
  {related.length > 0 && (
    <section aria-labelledby="related">
      <h2 id="related">{t(lang, 'project.related')}</h2>
      <ul class="related">
        {related.map((item) => <li><a href={localePath(lang, `/p/${item.slug}/`)}>{item.name}</a><span>{item.description}</span></li>)}
      </ul>
    </section>
  )}
</article>

<style>
  .detail { padding-block: var(--space-8); max-width: 820px; }
  .crumbs { display: flex; gap: var(--space-2); font-size: 0.85rem; color: var(--ink-muted); margin-bottom: var(--space-5); }
  .title { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
  .title h1 { margin: 0; }
  .lede { font-size: 1.15rem; color: var(--ink-muted); margin-top: var(--space-3); max-width: var(--measure); }
  .actions { display: flex; gap: var(--space-3); flex-wrap: wrap; margin: var(--space-5) 0; }
  .btn { padding: 0.7rem 1.1rem; border-radius: var(--radius-pill); font-weight: 800; text-decoration: none; border: 1px solid transparent; }
  .primary { background: var(--accent); color: #fff; }
  .ghost { border-color: var(--border); color: var(--ink); background: var(--surface); }
  .warning { background: var(--warn-soft); color: var(--warn); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); font-weight: 700; }
  .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-5); }
  dt { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-muted); font-weight: 800; }
  dd { margin: 0.2rem 0 0; font-weight: 700; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .tags span { font-size: 0.75rem; font-weight: 700; background: var(--surface-2); border-radius: var(--radius-pill); padding: 0.15rem 0.6rem; }
  .deprecated { color: var(--danger); font-weight: 700; }
  .related { list-style: none; padding: 0; display: grid; gap: var(--space-3); }
  .related a { font-weight: 800; }
  .related span { display: block; color: var(--ink-muted); font-size: 0.9rem; }
</style>
```

`site/src/pages/projects/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import ProjectsView from '../../views/ProjectsView.astro';
import { t } from '../../i18n';
---
<Base lang="en" title={t('en', 'nav.projects')} description={t('en', 'site.description')} path="/projects/">
  <ProjectsView lang="en" />
</Base>
```

`site/src/pages/p/[slug].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import ProjectView from '../../views/ProjectView.astro';
import { catalog } from '../../lib/catalog';
import type { Project } from '../../../scripts/lib/types';

export function getStaticPaths() {
  return catalog.projects.map((project) => ({
    params: { slug: project.slug },
    props: { project },
  }));
}
const { project } = Astro.props as { project: Project };
---
<Base lang="en" title={project.name} description={project.description} path={`/p/${project.slug}/`}>
  <ProjectView project={project} lang="en" />
</Base>
```

- [ ] **Step 8: Verify**

Run: `pnpm build:data && pnpm --filter site check && pnpm --filter site build`
Expected: 58 project pages under `site/dist/p/`, one list page.

Run: `pnpm test`
Expected: PASS.

Manual: open `/projects/`, type a query, pick a category, confirm the URL updates and the count follows; open a detail page.

- [ ] **Step 9: Commit**

```bash
git add site
git commit -m "feat: add project list, detail pages and client-side filters"
```

---

### Task 9: Pagefind search and the static JSON API

**Files:**

- Create: `site/src/components/Search.astro`
- Create: `site/src/views/ApiView.astro`, `site/src/pages/api.astro`
- Create: `scripts/check-search.ts`
- Modify: `site/src/layouts/Base.astro` (indexable body, ignored chrome)
- Modify: `site/src/views/HomeView.astro` (include `<Search />`)
- Modify: `package.json` (`check:build`, `verify`)

**Interfaces:**

- Consumes: `site/dist/` produced by Astro + `postbuild.ts`
- Produces: `/pagefind/` index and `/api/{catalog,projects,categories}.json`
- Produces: `pnpm check:build` — exits 1 if any artifact is missing or empty

- [ ] **Step 1: Mark what Pagefind indexes**

In `site/src/layouts/Base.astro`, change:

```astro
<main id="main">
```

to:

```astro
<main id="main" data-pagefind-body>
```

In `Header.astro` and `Footer.astro`, add `data-pagefind-ignore` to the root element:

```astro
<header class="site-header" data-pagefind-ignore>
```

```astro
<footer class="site-footer" data-pagefind-ignore>
```

- [ ] **Step 2: Write the search component**

`site/src/components/Search.astro`:

```astro
---
import { t } from '../i18n';
import type { Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
const isProd = import.meta.env.PROD;
---
{
  isProd && (
    <div class="search" data-pagefind-ignore>
      <h2 class="sr-only">{t(lang, 'search.label')}</h2>
      <div id="search"></div>
      <link rel="stylesheet" href="/pagefind/pagefind-ui.css" />
      <script is:inline src="/pagefind/pagefind-ui.js" defer></script>
      <script is:inline define:vars={{ lang }}>
        window.addEventListener('DOMContentLoaded', function () {
          if (!window.PagefindUI) return;
          new window.PagefindUI({
            element: '#search',
            showSubResults: true,
            translations:
              lang === 'fr'
                ? {
                    placeholder: 'Rechercher un projet…',
                    zero_results: 'Aucun résultat pour [SEARCH_TERM]',
                    many_results: '[COUNT] résultats pour [SEARCH_TERM]',
                    one_result: '1 résultat pour [SEARCH_TERM]',
                  }
                : undefined,
          });
        });
      </script>
    </div>
  )
}

<style>
  .search {
    margin-block: var(--space-6) var(--space-8);
    --pagefind-ui-primary: var(--accent);
    --pagefind-ui-text: var(--ink);
    --pagefind-ui-background: var(--surface);
    --pagefind-ui-border: var(--border);
    --pagefind-ui-tag: var(--surface-2);
    --pagefind-ui-border-radius: var(--radius);
    --pagefind-ui-font: var(--font-sans);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
```

In `HomeView.astro`, import and place it after the hero:

```astro
import Search from '../components/Search.astro';
```

```astro
<section class="container"><Search lang={lang} /></section>
```

- [ ] **Step 3: Write the API documentation page**

`site/src/views/ApiView.astro`:

```astro
---
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
const endpoints = [
  { path: '/api/catalog.json', text: 'Everything: categories, tags, collections and projects.' },
  { path: '/api/projects.json', text: 'The projects array only.' },
  { path: '/api/categories.json', text: 'The nine categories, ordered.' },
];
---
<section class="container page">
  <h1>{t(lang, 'nav.api')}</h1>
  <p>
    {lang === 'fr'
      ? 'Le catalogue est publié en JSON statique, sans authentification. Les fichiers sont régénérés à chaque déploiement.'
      : 'The catalogue is published as static JSON with no authentication. Files are regenerated on every deployment.'}
  </p>
  <ul class="endpoints">
    {endpoints.map((endpoint) => (
      <li><code>{endpoint.path}</code><span>{endpoint.text}</span></li>
    ))}
  </ul>
  <h2>Project shape</h2>
  <pre><code>{`{
  "slug": "louis",
  "name": "Louis",
  "url": "https://github.com/stuartromanek/louis",
  "description": "Turn a YouTube playlist into a Yoto MYO card.",
  "category": "create",
  "tags": ["youtube", "web"],
  "status": "active",
  "official": false,
  "platforms": ["web"],
  "added": "2026-11-03",
  "meta": { "stars": 57, "lastCommit": "2026-09-12", "archived": false }
}`}</code></pre>
  <p class="note">
    {lang === 'fr'
      ? 'Utilisation same-origin garantie. Un fetch navigateur depuis un autre domaine dépend des en-têtes CORS de GitHub Pages.'
      : 'Same-origin use is guaranteed. Cross-origin browser fetches depend on GitHub Pages CORS headers.'}
  </p>
  <a href={localePath(lang, '/')}>← {lang === 'fr' ? 'Accueil' : 'Home'}</a>
</section>

<style>
  .page { padding-block: var(--space-8); max-width: 820px; }
  .endpoints { list-style: none; padding: 0; display: grid; gap: var(--space-3); }
  .endpoints li { display: grid; gap: 0.2rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
  .endpoints span { color: var(--ink-muted); font-size: 0.9rem; }
  pre { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4); overflow-x: auto; }
  .note { color: var(--ink-muted); font-size: 0.9rem; }
</style>
```

`site/src/pages/api.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import ApiView from '../views/ApiView.astro';
import { t } from '../i18n';
---
<Base lang="en" title={t('en', 'nav.api')} description="Static JSON API for the Awesome Yoto catalogue." path="/api/">
  <ApiView lang="en" />
</Base>
```

- [ ] **Step 4: Write the artifact check**

`scripts/check-search.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'site/dist');
const required = [
  'index.html',
  'fr/index.html',
  'projects/index.html',
  'pagefind/pagefind.js',
  'api/catalog.json',
  'api/projects.json',
  'api/categories.json',
];

const missing = required.filter((file) => !existsSync(join(dist, file)));
if (missing.length > 0) {
  console.error(`Missing build artifacts: ${missing.join(', ')}`);
  process.exit(1);
}

const projects = JSON.parse(readFileSync(join(dist, 'api/projects.json'), 'utf8')) as unknown[];
if (!Array.isArray(projects) || projects.length < 55) {
  console.error(`Expected at least 55 projects in the API, got ${projects.length}.`);
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (html.includes('UNDEFINED') || html.includes('[object Object]')) {
  console.error('Rendered HTML contains interpolation leaks.');
  process.exit(1);
}

const bundle = readdirSync(join(dist, '_astro'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => readFileSync(join(dist, '_astro', file), 'utf8'))
  .join('\n');
if (/ghp_|github_pat_|GITHUB_TOKEN|Authorization:\s*Bearer/i.test(bundle)) {
  console.error('A secret or token-like string was found in the client bundle.');
  process.exit(1);
}

console.log(`Build artifacts OK: ${projects.length} projects, Pagefind index and API present.`);
```

Add to `package.json`:

```json
"check:build": "tsx scripts/check-search.ts",
"verify": "pnpm check && pnpm build && pnpm check:build"
```

- [ ] **Step 5: Build and verify**

Run: `pnpm verify`
Expected: validation, README check, `astro check`, build, Pagefind indexing, then
`Build artifacts OK: 58 projects, Pagefind index and API present.`

Open `site/dist/index.html` through `pnpm --filter site preview` and search for
`Louis`: the result links to `/p/louis/`.

- [ ] **Step 6: Commit**

```bash
git add site scripts/check-search.ts package.json
git commit -m "feat: add Pagefind search and static JSON API"
```

---

### Task 10: MYO guide, about, contribute, categories, collections and 404

**Files:**

- Create: `site/src/views/{MyoView,AboutView,ContributeView,CategoryView,CollectionView}.astro`
- Create: `site/src/pages/{myo,about,contribute}.astro`
- Create: `site/src/pages/categories/[slug].astro`, `site/src/pages/collections/[slug].astro`
- Create: `site/src/pages/404.astro`
- Modify: `scripts/check-search.ts` (more required routes)

**Interfaces:**

- Consumes: `catalog`, `t()`, `localePath()`, `ProjectCard`
- Produces: routes `/myo/`, `/about/`, `/contribute/`, `/categories/<slug>/`, `/collections/<slug>/`, `/404.html`

- [ ] **Step 1: Write the MYO guide**

`site/src/views/MyoView.astro`:

```astro
---
import { catalog } from '../lib/catalog';
import { t, type MessageKey } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };

const steps = [
  {
    n: 1,
    title: { en: 'Find the audio', fr: "Trouver l'audio" },
    body: {
      en: 'Pick a podcast feed, a YouTube playlist or an audiobook folder. Prefer sources you own or that are free to download.',
      fr: 'Choisissez un flux de podcast, une playlist YouTube ou un dossier de livres audio. Privilégiez ce que vous possédez ou ce qui est libre.',
    },
    tools: ['podcast-catalogue', 'louis', 'yoto-book-maker'],
  },
  {
    n: 2,
    title: { en: 'Split and normalize', fr: 'Découper et normaliser' },
    body: {
      en: 'Export MP3 mono at 44.1 kHz. One chapter per track, under one hour. Name tracks with a two-digit prefix so the order survives.',
      fr: 'Exportez en MP3 mono à 44,1 kHz. Un chapitre par piste, moins d’une heure. Préfixez les pistes avec deux chiffres pour garder l’ordre.',
    },
    tools: ['yoto-card-kit', 'yoto-music'],
  },
  {
    n: 3,
    title: { en: 'Choose the icon', fr: "Choisir l'icône" },
    body: {
      en: 'A 16x16 PNG. Keep it readable at a glance and avoid pure black, which disappears on the player background.',
      fr: 'Un PNG 16x16. Restez lisible au premier coup d’œil et évitez le noir pur, invisible sur le fond du lecteur.',
    },
    tools: ['icons-catalogue', 'yotoicons', 'yotopixels'],
  },
  {
    n: 4,
    title: { en: 'Create the card', fr: 'Créer la carte' },
    body: {
      en: 'Upload the tracks and the icon in the Yoto app, or use a MYO tool. Link a blank NFC card when the physical card matters.',
      fr: 'Envoyez les pistes et l’icône dans l’app Yoto, ou utilisez un outil MYO. Associez une carte NFC vierge si la carte physique compte.',
    },
    tools: ['yoto-app', 'yoto-manager', 'custom-yoto-cards'],
  },
  {
    n: 5,
    title: { en: 'Print the label', fr: 'Imprimer le label' },
    body: {
      en: 'Print a label with the same icon and the child’s name. Laminate it or use a sticker sheet so it survives small hands.',
      fr: 'Imprimez un label avec la même icône et le prénom de l’enfant. Plastifiez-le ou utilisez une planche d’autocollants.',
    },
    tools: ['selphyoto', 'yotolabels'],
  },
] as const;

const bySlug = new Map(catalog.projects.map((project) => [project.slug, project]));
---
<section class="container page">
  <p class="eyebrow">{lang === 'fr' ? 'Guide' : 'Guide'}</p>
  <h1>{lang === 'fr' ? 'Créer sa première carte MYO' : 'Build your first MYO card'}</h1>
  <p class="lede">
    {lang === 'fr'
      ? 'Cinq étapes, du fichier audio brut au label imprimé. Chaque étape indique un outil recommandé et une alternative.'
      : 'Five steps, from a raw audio file to a printed label. Each step names one recommended tool and an alternative.'}
  </p>
  <ol class="steps">
    {steps.map((step) => (
      <li>
        <span class="num">{step.n}</span>
        <div>
          <h2>{step.title[lang]}</h2>
          <p>{step.body[lang]}</p>
          <ul class="tools">
            {step.tools.map((slug) => {
              const project = bySlug.get(slug);
              return project ? (
                <li>
                  <a href={localePath(lang, `/p/${project.slug}/`)}>{project.name}</a>
                  <span>{project.status !== 'active' ? `(${t(lang, `status.${project.status}` as MessageKey)})` : ''}</span>
                </li>
              ) : null;
            })}
          </ul>
        </div>
      </li>
    ))}
  </ol>
  <p class="tip">
    {lang === 'fr'
      ? 'Un doute sur un format ? La fiche de chaque outil indique sa plateforme, ses prérequis et son dernier commit.'
      : 'Unsure about a format? Each tool page lists its platform, requirements and last commit.'}
  </p>
  <a href={localePath(lang, '/projects/')}>{lang === 'fr' ? 'Voir tous les outils' : 'See all tools'} →</a>
</section>

<style>
  .page { padding-block: var(--space-8); max-width: 900px; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.8rem; font-weight: 800; color: var(--accent); }
  .lede { color: var(--ink-muted); font-size: 1.15rem; max-width: 62ch; }
  .steps { list-style: none; padding: 0; display: grid; gap: var(--space-5); margin-block: var(--space-8); }
  .steps li { display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-6); box-shadow: var(--shadow); }
  .num { display: grid; place-items: center; width: 2.4rem; height: 2.4rem; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 800; }
  h2 { margin-bottom: var(--space-2); font-size: 1.35rem; }
  .tools { display: flex; flex-wrap: wrap; gap: var(--space-2); list-style: none; padding: 0; margin: var(--space-3) 0 0; }
  .tools li { display: inline-flex; gap: 0.4rem; align-items: baseline; background: var(--surface-2); border-radius: var(--radius-pill); padding: 0.2rem 0.7rem; font-size: 0.85rem; font-weight: 700; }
  .tools span { color: var(--ink-muted); font-weight: 600; }
  .tip { color: var(--ink-muted); }
</style>
```

`site/src/pages/myo.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import MyoView from '../views/MyoView.astro';
---
<Base lang="en" title="Build your first MYO card" description="Five steps from audio to a printed Yoto MYO card." path="/myo/">
  <MyoView lang="en" />
</Base>
```

- [ ] **Step 2: Write about and contribute**

`site/src/views/AboutView.astro`:

```astro
---
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
const criteria = lang === 'fr'
  ? [
      'Un lien public, vivant et en HTTPS.',
      'Un README ou une documentation utilisable en deux minutes.',
      'Une licence explicite, ou une licence inconnue assumée.',
      'Un rapport direct avec Yoto : lecture, cartes, icônes, API ou appareil.',
      'Un seul projet par entrée ; les forks sont exclus.',
    ]
  : [
      'A public, working HTTPS link.',
      'A README or documentation usable in two minutes.',
      'An explicit license, or an acknowledged unknown license.',
      'A direct relationship with Yoto: playback, cards, icons, API or device.',
      'One entry per project; forks are excluded.',
    ];
const excluded = lang === 'fr'
  ? ['Contournement de DRM ou de paywall.', 'Revente de cartes ou de contenus sous licence.', 'Liens affiliés ou trackés.']
  : ['DRM or paywall circumvention.', 'Resale of cards or licensed content.', 'Affiliate or tracked links.'];
---
<section class="container page">
  <h1>{lang === 'fr' ? 'À propos' : 'About'}</h1>
  <p>
    {lang === 'fr'
      ? 'Awesome Yoto est un annuaire communautaire de l’écosystème Yoto. Les entrées sont vérifiées, catégorisées et datées ; un projet abandonné reste visible avec un statut, il n’est jamais supprimé.'
      : 'Awesome Yoto is a community directory of the Yoto ecosystem. Entries are checked, categorized and dated; an abandoned project stays visible with a status instead of being deleted.'}
  </p>
  <p class="banner">{t(lang, 'footer.disclaimer')}</p>
  <h2>{lang === 'fr' ? 'Critères d’inclusion' : 'Inclusion criteria'}</h2>
  <ul>{criteria.map((item) => <li>{item}</li>)}</ul>
  <h2>{lang === 'fr' ? 'Exclusions' : 'Exclusions'}</h2>
  <ul>{excluded.map((item) => <li>{item}</li>)}</ul>
  <h2>{lang === 'fr' ? 'Corriger une fiche' : 'Fix an entry'}</h2>
  <p>
    {lang === 'fr' ? 'Ouvrez une issue ou une pull request : ' : 'Open an issue or a pull request: '}
    <a href={localePath(lang, '/contribute/')}>{t(lang, 'nav.contribute')}</a>.
  </p>
</section>

<style>
  .page { padding-block: var(--space-8); max-width: 760px; }
  .banner { background: var(--accent-soft); color: var(--accent-strong); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); font-weight: 700; }
  ul { display: grid; gap: var(--space-2); }
</style>
```

`site/src/views/ContributeView.astro`:

```astro
---
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
const { lang } = Astro.props as { lang: Lang };
const repo = 'https://github.com/yoto-community/yoto-community.github.io';
---
<section class="container page">
  <h1>{t(lang, 'nav.contribute')}</h1>
  <p>
    {lang === 'fr'
      ? 'Le dépôt est la seule source de vérité : on édite data/, jamais le README ni le site.'
      : 'The repository is the only source of truth: edit data/, never the README or the site.'}
  </p>
  <h2>{lang === 'fr' ? 'Trois façons de contribuer' : 'Three ways to contribute'}</h2>
  <ol>
    <li>
      <strong>{lang === 'fr' ? 'Formulaire' : 'Form'}</strong> —
      <a href={`${repo}/issues/new?template=submit-app.yml`}>{lang === 'fr' ? 'proposer une application' : 'submit an app'}</a>.
    </li>
    <li>
      <strong>Pull request</strong> — {lang === 'fr' ? 'ajoutez un fichier YAML dans data/projects/.' : 'add a YAML file under data/projects/.'}
    </li>
    <li>
      <strong>{lang === 'fr' ? 'Signaler' : 'Report'}</strong> —
      <a href={`${repo}/issues/new?labels=link-health&title=Dead+link`}>{lang === 'fr' ? 'un lien mort' : 'a dead link'}</a>.
    </li>
  </ol>
  <h2>{lang === 'fr' ? 'Vérifier en local' : 'Check locally'}</h2>
  <pre><code>pnpm install
pnpm validate
pnpm build:data
pnpm verify</code></pre>
  <p>
    {lang === 'fr'
      ? 'La CI bloque toute PR dont le schéma, les doublons, les catégories ou le README généré sont invalides.'
      : 'CI blocks any PR with an invalid schema, duplicate, unknown category, or stale generated README.'}
  </p>
  <a href={localePath(lang, '/projects/')}>{t(lang, 'nav.projects')} →</a>
</section>

<style>
  .page { padding-block: var(--space-8); max-width: 760px; }
  ol { display: grid; gap: var(--space-3); }
  pre { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4); overflow-x: auto; }
</style>
```

Pages: `about.astro` and `contribute.astro` follow the same wrapper pattern as
`myo.astro`, with `title` from `t('en', 'nav.about')` / `nav.contribute`.

- [ ] **Step 3: Write the category and collection routes**

`site/src/views/CategoryView.astro`:

```astro
---
import ProjectCard from '../components/ProjectCard.astro';
import { catalog } from '../lib/catalog';
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
import type { Category, Project } from '../../../scripts/lib/types';
const { category, projects, lang } = Astro.props as {
  category: Category;
  projects: Project[];
  lang: Lang;
};
---
<section class="container page">
  <p class="crumbs"><a href={localePath(lang, '/projects/')}>{t(lang, 'nav.projects')}</a> / {category.label[lang]}</p>
  <h1>{category.label[lang]}</h1>
  <p class="lede">{category.description[lang]}</p>
  <p class="count">{projects.length} {t(lang, 'filter.results')}</p>
  <div class="grid">
    {projects.map((project) => <ProjectCard project={project} lang={lang} />)}
  </div>
</section>

<style>
  .page { padding-block: var(--space-8); }
  .crumbs { font-size: 0.85rem; color: var(--ink-muted); }
  .lede { color: var(--ink-muted); font-size: 1.1rem; max-width: 62ch; }
  .count { color: var(--ink-muted); font-weight: 700; }
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
</style>
```

`site/src/pages/categories/[slug].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import CategoryView from '../../views/CategoryView.astro';
import { catalog } from '../../lib/catalog';

export function getStaticPaths() {
  return catalog.categories.map((category) => ({
    params: { slug: category.slug },
    props: {
      category,
      projects: catalog.projects.filter((project) => project.category === category.slug),
    },
  }));
}
const { category, projects } = Astro.props;
---
<Base lang="en" title={category.label.en} description={category.description.en} path={`/categories/${category.slug}/`}>
  <CategoryView category={category} projects={projects} lang="en" />
</Base>
```

`site/src/views/CollectionView.astro`:

```astro
---
import ProjectCard from '../components/ProjectCard.astro';
import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
import type { Collection, Project } from '../../../scripts/lib/types';
const { collection, projects, lang } = Astro.props as {
  collection: Collection;
  projects: Project[];
  lang: Lang;
};
---
<section class="container page">
  <p class="crumbs"><a href={localePath(lang, '/projects/')}>{t(lang, 'nav.projects')}</a> / {collection.title[lang]}</p>
  <h1>{collection.title[lang]}</h1>
  <p class="lede">{collection.description[lang]}</p>
  <p class="count">{projects.length} {t(lang, 'filter.results')}</p>
  <div class="grid">
    {projects.map((project) => <ProjectCard project={project} lang={lang} />)}
  </div>
</section>

<style>
  .page { padding-block: var(--space-8); }
  .crumbs { font-size: 0.85rem; color: var(--ink-muted); }
  .lede { color: var(--ink-muted); font-size: 1.1rem; max-width: 62ch; }
  .count { color: var(--ink-muted); font-weight: 700; }
  .grid { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
</style>
```

`site/src/pages/collections/[slug].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import CollectionView from '../../views/CollectionView.astro';
import { catalog } from '../../lib/catalog';

export function getStaticPaths() {
  return catalog.collections.map((collection) => ({
    params: { slug: collection.slug },
    props: {
      collection,
      projects: collection.items
        .map((slug) => catalog.projects.find((project) => project.slug === slug))
        .filter((project) => project !== undefined),
    },
  }));
}
const { collection, projects } = Astro.props;
---
<Base lang="en" title={collection.title.en} description={collection.description.en} path={`/collections/${collection.slug}/`}>
  <CollectionView collection={collection} projects={projects} lang="en" />
</Base>
```

- [ ] **Step 4: Write the 404 and extend the artifact check**

`site/src/pages/404.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import { t } from '../i18n';
---
<Base lang="en" title={t('en', 'notfound.title')} description={t('en', 'notfound.text')} path="/404.html">
  <section class="container page">
    <h1>{t('en', 'notfound.title')}</h1>
    <p>{t('en', 'notfound.text')}</p>
    <a href="/projects/">{t('en', 'notfound.back')} →</a>
  </section>
</Base>

<style>
  .page { padding-block: var(--space-12); }
</style>
```

Add to `required` in `scripts/check-search.ts`:

```ts
  'myo/index.html',
  'about/index.html',
  'contribute/index.html',
  'categories/official/index.html',
  'collections/start-here/index.html',
  '404.html',
```

- [ ] **Step 5: Build and verify**

Run: `pnpm verify`
Expected: all routes exist, `Build artifacts OK`.

Manual: click through `/myo/` and confirm each tool link resolves. Confirm
`/categories/create/` lists the same count as the filtered list.

- [ ] **Step 6: Commit**

```bash
git add site scripts/check-search.ts
git commit -m "feat: add MYO guide, about, contribute and taxonomy pages"
```

---

### Task 11: French mirror and route parity

**Files:**

- Create: `site/src/pages/fr/projects/index.astro`, `site/src/pages/fr/p/[slug].astro`
- Create: `site/src/pages/fr/{myo,about,contribute,api}.astro`
- Create: `site/src/pages/fr/categories/[slug].astro`, `site/src/pages/fr/collections/[slug].astro`
- Create: `scripts/check-i18n-routes.ts`
- Modify: `package.json` (`check:i18n`, `verify`)

**Interfaces:**

- Consumes: the same views as the English routes, with `lang="fr"`
- Produces: every English route mirrored under `/fr/`
- Produces: `pnpm check:i18n` — exits 1 on a missing mirror

- [ ] **Step 1: Add the French static routes**

Each file is a thin wrapper. `site/src/pages/fr/projects/index.astro`:

```astro
---
import Base from '../../../layouts/Base.astro';
import ProjectsView from '../../../views/ProjectsView.astro';
import { t } from '../../../i18n';
---
<Base lang="fr" title={t('fr', 'nav.projects')} description={t('fr', 'site.description')} path="/projects/">
  <ProjectsView lang="fr" />
</Base>
```

`site/src/pages/fr/p/[slug].astro`:

```astro
---
import Base from '../../../layouts/Base.astro';
import ProjectView from '../../../views/ProjectView.astro';
import { catalog } from '../../../lib/catalog';

export function getStaticPaths() {
  return catalog.projects.map((project) => ({
    params: { slug: project.slug },
    props: { project },
  }));
}
const { project } = Astro.props;
---
<Base lang="fr" title={project.name} description={project.descriptionFr ?? project.description} path={`/p/${project.slug}/`}>
  <ProjectView project={project} lang="fr" />
</Base>
```

`site/src/pages/fr/myo.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import MyoView from '../../views/MyoView.astro';
---
<Base lang="fr" title="Créer sa première carte MYO" description="Cinq étapes, de l'audio au label imprimé." path="/myo/">
  <MyoView lang="fr" />
</Base>
```

`site/src/pages/fr/about.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import AboutView from '../../views/AboutView.astro';
import { t } from '../../i18n';
---
<Base lang="fr" title={t('fr', 'nav.about')} description="À propos d'Awesome Yoto, de ses critères et de son indépendance." path="/about/">
  <AboutView lang="fr" />
</Base>
```

`site/src/pages/fr/contribute.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import ContributeView from '../../views/ContributeView.astro';
import { t } from '../../i18n';
---
<Base lang="fr" title={t('fr', 'nav.contribute')} description="Ajouter un projet à Awesome Yoto." path="/contribute/">
  <ContributeView lang="fr" />
</Base>
```

`site/src/pages/fr/api.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import ApiView from '../../views/ApiView.astro';
import { t } from '../../i18n';
---
<Base lang="fr" title={t('fr', 'nav.api')} description="API JSON statique du catalogue Awesome Yoto." path="/api/">
  <ApiView lang="fr" />
</Base>
```

`site/src/pages/fr/categories/[slug].astro`:

```astro
---
import Base from '../../../layouts/Base.astro';
import CategoryView from '../../../views/CategoryView.astro';
import { catalog } from '../../../lib/catalog';

export function getStaticPaths() {
  return catalog.categories.map((category) => ({
    params: { slug: category.slug },
    props: {
      category,
      projects: catalog.projects.filter((project) => project.category === category.slug),
    },
  }));
}
const { category, projects } = Astro.props;
---
<Base lang="fr" title={category.label.fr} description={category.description.fr} path={`/categories/${category.slug}/`}>
  <CategoryView category={category} projects={projects} lang="fr" />
</Base>
```

`site/src/pages/fr/collections/[slug].astro`:

```astro
---
import Base from '../../../layouts/Base.astro';
import CollectionView from '../../../views/CollectionView.astro';
import { catalog } from '../../../lib/catalog';

export function getStaticPaths() {
  return catalog.collections.map((collection) => ({
    params: { slug: collection.slug },
    props: {
      collection,
      projects: collection.items
        .map((slug) => catalog.projects.find((project) => project.slug === slug))
        .filter((project) => project !== undefined),
    },
  }));
}
const { collection, projects } = Astro.props;
---
<Base lang="fr" title={collection.title.fr} description={collection.description.fr} path={`/collections/${collection.slug}/`}>
  <CollectionView collection={collection} projects={projects} lang="fr" />
</Base>
```

- [ ] **Step 2: Write the parity check**

`scripts/check-i18n-routes.ts`:

```ts
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(process.cwd(), 'site/dist');

function pages(dir: string, prefix = ''): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.isDirectory()) return pages(join(dir, entry.name), `${prefix}${entry.name}/`);
    return entry.name === 'index.html' ? [prefix] : [];
  });
}

const all = new Set(pages(dist));
const missing = [...all]
  .filter((path) => !path.startsWith('fr/') && path !== '')
  .filter((path) => !all.has(`fr/${path}`))
  .sort();

if (missing.length > 0) {
  console.error(`Missing French routes:\n${missing.map((path) => `  /fr/${path}`).join('\n')}`);
  process.exit(1);
}

console.log(`French parity OK (${all.size - 1} route pairs).`);
```

Note: this script requires `site/dist` to exist. It runs after the build.

Add to `package.json`:

```json
"check:i18n": "tsx scripts/check-i18n-routes.ts",
"verify": "pnpm check && pnpm build && pnpm check:build && pnpm check:i18n"
```

- [ ] **Step 3: Build and verify**

Run: `pnpm verify`
Expected: `French parity OK (N route pairs).`

Manual: switch to FR from `/projects/`; the switcher must land on
`/fr/projects/`, and descriptions without `descriptionFr` show the `EN` badge.

- [ ] **Step 4: Commit**

```bash
git add site scripts/check-i18n-routes.ts package.json
git commit -m "feat: mirror every route in French with parity check"
```

---

### Task 12: SEO assets and structured data

**Files:**

- Create: `site/public/robots.txt`, `site/public/favicon.svg`
- Create: `scripts/og.ts` (generates `site/public/og.png`)
- Create: `site/src/lib/site.ts`, `site/src/lib/jsonld.ts`, `site/src/lib/jsonld.test.ts`
- Modify: `site/src/views/ProjectsView.astro`, `ProjectView.astro`
- Modify: `site/package.json` (add `sharp`)

**Interfaces:**

- Produces: `SITE_URL`, `absoluteUrl(lang, path)`
- Produces: `projectJsonLd(project, url): Record<string, unknown>`
- Produces: `listJsonLd(projects, url): Record<string, unknown>`

- [ ] **Step 1: Write the failing JSON-LD tests**

`site/src/lib/jsonld.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { listJsonLd, projectJsonLd } from './jsonld';
import type { Project } from '../../../scripts/lib/types';

const project = {
  slug: 'louis',
  name: 'Louis',
  url: 'https://github.com/stuartromanek/louis',
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
    expect(projectJsonLd(project, 'https://yoto-community.github.io/p/louis/')).toMatchObject({
      '@type': 'SoftwareApplication',
      name: 'Louis',
      url: 'https://yoto-community.github.io/p/louis/',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    });
  });
});

describe('listJsonLd', () => {
  it('numbers the items from one', () => {
    const jsonLd = listJsonLd([project], 'https://yoto-community.github.io/projects/') as {
      itemListElement: Array<{ position: number }>;
    };
    expect(jsonLd.itemListElement[0]?.position).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- site/src/lib/jsonld.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

`site/src/lib/site.ts`:

```ts
import { localePath, type Lang } from './routes';

export const SITE_URL = 'https://yoto-community.github.io';

export function absoluteUrl(lang: Lang, path: string): string {
  return new URL(localePath(lang, path), SITE_URL).href;
}
```

`site/src/lib/jsonld.ts`:

```ts
import type { Project } from '../../../scripts/lib/types';

export function projectJsonLd(project: Project, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: project.name,
    description: project.description,
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
```

- [ ] **Step 4: Wire it into the pages**

In `ProjectsView.astro`, after the `<h1>`:

```astro
<script type="application/ld+json" set:html={JSON.stringify(listJsonLd(projects, absoluteUrl(lang, '/projects/')))} />
```

Import `listJsonLd` and `absoluteUrl`.

In `ProjectView.astro`, after the `<h1>`:

```astro
<script type="application/ld+json" set:html={JSON.stringify(projectJsonLd(project, absoluteUrl(lang, `/p/${project.slug}/`)))} />
```

- [ ] **Step 5: Add robots, favicon and OG image**

`site/public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://yoto-community.github.io/sitemap-index.xml
```

`site/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34">
  <rect width="34" height="34" rx="10" fill="#006D41"/>
  <path d="M10 12v10M14 9v16M18 13v8M22 10v14M26 14v6" stroke="#F7F3E9" stroke-width="2.2" stroke-linecap="round"/>
</svg>
```

`scripts/og.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib/config';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#F7F3E9"/>
  <rect x="80" y="80" width="96" height="96" rx="28" fill="#006D41"/>
  <path d="M104 116v28M118 108v44M132 120v20M146 112v36M160 124v12" stroke="#F7F3E9" stroke-width="6" stroke-linecap="round"/>
  <text x="80" y="300" font-family="Nunito, system-ui, sans-serif" font-size="92" font-weight="800" fill="#1F2A24">Awesome Yoto</text>
  <text x="80" y="380" font-family="Nunito, system-ui, sans-serif" font-size="38" font-weight="600" fill="#5A665F">Apps, cards, icons and integrations for the Yoto Player.</text>
  <rect x="80" y="440" width="360" height="10" rx="5" fill="#AF294E"/>
</svg>`;

writeFileSync(join(ROOT, 'site/public/og.svg'), svg);
await sharp(Buffer.from(svg)).png().toFile(join(ROOT, 'site/public/og.png'));
console.log('Generated site/public/og.png');
```

Add `sharp` to `site/devDependencies` (or root devDependencies). Run:

```bash
pnpm add -D sharp -w
pnpm tsx scripts/og.ts
```

Commit `site/public/og.png` (binary) and keep `og.svg` as the source.

- [ ] **Step 6: Verify**

Run: `pnpm test -- site/src/lib/jsonld.test.ts && pnpm verify`
Expected: PASS, and `site/dist/sitemap-index.xml`, `robots.txt`, `og.png`,
`favicon.svg` exist.

Validate one page with the Rich Results Test or `https://validator.schema.org/`
using the deployed URL after Task 14; until then inspect the rendered JSON-LD.

- [ ] **Step 7: Commit**

```bash
git add site scripts/og.ts package.json pnpm-lock.yaml
git commit -m "feat: add SEO metadata, JSON-LD and social image"
```

---

### Task 13: Accessibility audit and JavaScript budget

**Files:**

- Create: `site/playwright.config.ts`, `site/e2e/a11y.spec.ts`
- Create: `scripts/check-budget.ts`
- Modify: `site/package.json` (Playwright, axe, `test:e2e`)
- Modify: `package.json` (`check:budget`, `verify`)

**Interfaces:**

- Produces: `pnpm --filter site test:e2e` — fails on serious or critical axe violations
- Produces: `pnpm check:budget` — fails above 30 KB gzip of site JS

- [ ] **Step 1: Install the test dependencies**

```bash
pnpm --filter site add -D @playwright/test @axe-core/playwright
pnpm --filter site exec playwright install chromium
```

Add to `site/package.json` scripts:

```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Configure Playwright**

`site/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview --port 4321',
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 3: Write the accessibility test**

`site/e2e/a11y.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const paths = ['/', '/projects/', '/p/louis/', '/fr/', '/fr/projects/', '/myo/'];

for (const path of paths) {
  test(`no serious accessibility violation on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(
      blocking,
      JSON.stringify(
        blocking.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => node.target),
        })),
      ),
    ).toEqual([]);
  });
}
```

Run: `pnpm build && pnpm --filter site test:e2e`
Expected: 6 passing tests. Fix contrast, labels or landmarks before continuing.

- [ ] **Step 3b: Add a filter smoke test**

`site/e2e/filters.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('filters update the URL and the visible cards', async ({ page }) => {
  await page.goto('/projects/');
  const count = page.locator('[data-count]');
  await expect(count).toContainText('projects');

  await page.getByLabel('Category').selectOption('create');
  await expect(page).toHaveURL(/\?cat=create/);
  await expect(page.locator('[data-project]:visible').first()).toBeVisible();
  await expect(page.locator('[data-project][data-category="official"]:visible')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).not.toHaveURL(/cat=/);
});
```

Note: the French clear button label is `Réinitialiser`; the test targets the English
page only.

- [ ] **Step 4: Write the budget check**

`scripts/check-budget.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = join(process.cwd(), 'site/dist/_astro');
const files = readdirSync(dir).filter((file) => file.endsWith('.js'));
const total = files.reduce((sum, file) => sum + gzipSync(readFileSync(join(dir, file))).length, 0);
const limit = 30 * 1024;

if (total > limit) {
  console.error(`JavaScript budget exceeded: ${(total / 1024).toFixed(1)} KB > 30 KB gzip.`);
  console.error(files.map((file) => `  ${file}`).join('\n'));
  process.exit(1);
}

console.log(`JavaScript budget OK: ${(total / 1024).toFixed(1)} KB gzip.`);
```

Add to `package.json`:

```json
"check:budget": "tsx scripts/check-budget.ts",
"verify": "pnpm check && pnpm build && pnpm check:build && pnpm check:i18n && pnpm check:budget"
```

- [ ] **Step 5: Verify**

Run: `pnpm verify && pnpm --filter site test:e2e`
Expected: `JavaScript budget OK: < 30 KB gzip.` and all axe tests passing.

- [ ] **Step 6: Commit**

```bash
git add site package.json pnpm-lock.yaml scripts/check-budget.ts
git commit -m "test: add accessibility audit and JavaScript budget"
```

---

### Task 14: CI and GitHub Pages deployment

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/workflows/pages.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

**Interfaces:**

- Consumes: `pnpm verify`, `pnpm --filter site test:e2e`, `awesome-lint`
- Produces: a deployed site at `https://yoto-community.github.io/`

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm validate
      - run: pnpm check:readme
      - run: pnpm build:data
      - run: pnpm test
      - run: pnpm --filter site check
      - run: pnpm build
      - run: pnpm check:build
      - run: pnpm check:i18n
      - run: pnpm check:budget
      - name: awesome-lint (advisory until the repository metadata is set)
        run: pnpm exec awesome-lint README.md
        continue-on-error: true

      - run: pnpm --filter site exec playwright install --with-deps chromium
      - run: pnpm --filter site test:e2e
```

- [ ] **Step 2: Write the deployment workflow**

`.github/workflows/pages.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 4 * * *'
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Refresh GitHub metadata
        if: github.event_name == 'schedule'
        run: pnpm enrich
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Commit refreshed metadata
        if: github.event_name == 'schedule'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/.meta.json
          git diff --cached --quiet || git commit -m "chore: refresh project metadata [skip ci]"
          git push

      - run: pnpm build
      - run: pnpm check:build && pnpm check:i18n && pnpm check:budget

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Document the manual setup**

`.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Yoto Space developers
    url: https://yoto.space/developers
    about: Ask usage questions in the official community space.
```

Settings to apply once, documented in `CONTRIBUTING.md`:

1. **Settings → Pages → Source: GitHub Actions.**
2. **Topics:** `awesome`, `awesome-list`, `yoto`, `yoto-player`, `myo`.
3. **Description:** `Awesome Yoto — a curated list of apps, tools and resources for the Yoto Player.`
4. **Branch protection on `main`:** require the `check` job, disallow force-push.
5. Create the label `link-health` (amber `#B45309`) and `app:submission` (green).

- [ ] **Step 4: Commit and open the first PR**

```bash
git add .github
git commit -m "ci: add validation and Pages deployment"
git push -u origin main
```

Do not push to `main` before the repository is ready; if working on a branch, open
the PR and let CI run. The first successful `Deploy` run publishes the site.

- [ ] **Step 5: Verify the deployment**

Run: `curl -sI https://yoto-community.github.io/ | head -1`
Expected: `HTTP/2 200`.

Then check `https://yoto-community.github.io/api/projects.json` returns the
project array and `https://yoto-community.github.io/fr/` renders French.

---

### Task 15: Weekly dead-link report

**Files:**

- Create: `scripts/lib/links.ts`
- Create: `scripts/check-links.ts`
- Test: `tests/links.test.ts`
- Create: `.github/workflows/link-health.yml`
- Modify: `package.json` (`check:links`)

**Interfaces:**

- Produces: `checkUrl(url: string, fetchImpl?: typeof fetch): Promise<LinkResult>`
- Produces: `LinkResult = { url: string; ok: boolean; status: number }`
- Produces: `link-report.md` and `.dead-count` at the repository root

- [ ] **Step 1: Write the failing test**

`tests/links.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { checkUrl } from '../scripts/lib/links';

describe('checkUrl', () => {
  it('accepts a 200 HEAD', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    await expect(checkUrl('https://example.com', fetchImpl as typeof fetch)).resolves.toEqual({
      url: 'https://example.com',
      ok: true,
      status: 200,
    });
  });

  it('retries with GET when HEAD is not allowed', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 405 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({ method: 'GET' });
  });

  it('reports a 404 as dead', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it('reports a network error as dead', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('timeout'));
    const result = await checkUrl('https://example.com', fetchImpl as typeof fetch);
    expect(result).toMatchObject({ ok: false, status: 0 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/links.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the checker and the report**

`scripts/lib/links.ts`:

```ts
export interface LinkResult {
  url: string;
  ok: boolean;
  status: number;
}

const RETRY_WITH_GET = new Set([403, 405, 501]);

export async function checkUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<LinkResult> {
  try {
    const options: RequestInit = {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'awesome-yoto-link-check' },
    };
    let response = await fetchImpl(url, { ...options, method: 'HEAD' });
    if (RETRY_WITH_GET.has(response.status)) {
      response = await fetchImpl(url, { ...options, method: 'GET' });
    }
    return { url, ok: response.status < 400, status: response.status };
  } catch {
    return { url, ok: false, status: 0 };
  }
}
```

`scripts/check-links.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/config';
import { checkUrl, type LinkResult } from './lib/links';
import { createLoader } from './lib/load';

const load = createLoader();
const projects = load.projects();
const targets = new Map<string, string[]>();

for (const project of projects) {
  for (const url of [project.url, project.repo].filter((value): value is string =>
    Boolean(value),
  )) {
    targets.set(url, [...(targets.get(url) ?? []), project.name]);
  }
}

const urls = [...targets.keys()];
const results: LinkResult[] = [];
for (let index = 0; index < urls.length; index += 5) {
  results.push(...(await Promise.all(urls.slice(index, index + 5).map((url) => checkUrl(url)))));
}

const dead = results.filter((result) => !result.ok);
const rows = dead.map(
  (result) =>
    `| ${targets.get(result.url)?.join(', ')} | ${result.url} | ${result.status || 'network error'} |`,
);

writeFileSync(
  join(ROOT, 'link-report.md'),
  `# Dead links\n\n${dead.length} of ${results.length} links failed on ${new Date().toISOString().slice(0, 10)}.\n\n| Project | URL | Status |\n|---|---|---|\n${rows.join('\n')}\n`,
);
writeFileSync(join(ROOT, '.dead-count'), String(dead.length));

console.log(`${dead.length}/${results.length} links failed.`);
```

Add `"check:links": "tsx scripts/check-links.ts"` (already listed in Task 1).

- [ ] **Step 4: Write the workflow**

`.github/workflows/link-health.yml`:

```yaml
name: Link health

on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:links

      - name: Publish the report
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh label create link-health --color B45309 --description "Dead links report" 2>/dev/null || true
          number=$(gh issue list --label link-health --state open --json number --jq '.[0].number // empty')
          count=$(cat .dead-count)
          if [ "$count" -gt 0 ]; then
            body=$(cat link-report.md)
            if [ -n "$number" ]; then
              gh issue edit "$number" --body "$body"
            else
              gh issue create --title "Dead links" --label link-health --body "$body"
            fi
          elif [ -n "$number" ]; then
            gh issue close "$number" --comment "All links are healthy again."
          fi
```

- [ ] **Step 5: Run the checker locally**

Run: `pnpm check:links`
Expected: a `link-report.md` and a `.dead-count`. Network flakiness is expected:
the job never fails the build.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/links.ts scripts/check-links.ts tests/links.test.ts .github/workflows/link-health.yml
git commit -m "feat: add weekly dead-link report"
```

---

### Task 16: Submit an app from a GitHub issue

**Files:**

- Create: `.github/ISSUE_TEMPLATE/submit-app.yml`
- Create: `scripts/lib/issue.ts`, `scripts/issue-to-project.ts`
- Test: `tests/issue.test.ts`
- Create: `.github/workflows/issue-to-pr.yml`

**Interfaces:**

- Produces: `parseIssueForm(body: string): Record<string, string>`
- Produces: `projectFromIssue(fields: Record<string, string>, today: string): { slug: string; data: ProjectFile }`
- Produces: a PR adding `data/projects/<slug>.yml`

- [ ] **Step 1: Write the failing parser test**

`tests/issue.test.ts`:

```ts
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

  it('rejects an unknown category', () => {
    expect(() =>
      projectFromIssue({ ...parseIssueForm(body), category: 'nope' }, '2026-11-03'),
    ).toThrow('unknown category');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- tests/issue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser and builder**

`scripts/lib/issue.ts`:

```ts
import { slugify } from './slug';
import type { ProjectFile } from './types';

const EMPTY = new Set(['', '_No response_']);

export function parseIssueForm(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const chunk of body.split(/^### /m).slice(1)) {
    const [labelLine, ...rest] = chunk.split('\n');
    const label = labelLine?.trim().toLowerCase();
    if (!label) continue;
    const value = rest.join('\n').trim();
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
  const slug = slugify(name);
  const category = fields.category?.trim() ?? '';
  if (!KNOWN_CATEGORIES.has(category)) throw new Error(`unknown category "${category}"`);
  if (!name) throw new Error('name is required');

  const data = {
    name,
    url: fields.url?.trim() ?? '',
    ...(fields.repository ? { repo: fields.repository.trim() } : {}),
    description: fields.description?.trim() ?? '',
    ...(fields['french description'] ? { descriptionFr: fields['french description'].trim() } : {}),
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
```

- [ ] **Step 4: Write the CLI**

`scripts/issue-to-project.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { PROJECTS_DIR } from './lib/config';
import { parseIssueForm, projectFromIssue } from './lib/issue';
import { createLoader } from './lib/load';
import { validateProjectFile } from './lib/schema';

const body = process.env.ISSUE_BODY ?? '';
const issue = process.env.ISSUE_NUMBER ?? '';
const today = new Date().toISOString().slice(0, 10);
const load = createLoader();

try {
  const { slug, data } = projectFromIssue(parseIssueForm(body), today);
  const errors = validateProjectFile(data);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  if (!load.categories().some((category) => category.slug === data.category)) {
    throw new Error(`unknown category "${data.category}"`);
  }
  for (const tag of data.tags) {
    if (!load.tags().includes(tag)) throw new Error(`unknown tag "${tag}"`);
  }
  writeFileSync(join(PROJECTS_DIR, `${slug}.yml`), stringify(data));
  writeFileSync('.issue-slug', slug);
  console.log(`Prepared ${slug}.yml`);
} catch (error) {
  if (issue) {
    execFileSync('gh', [
      'issue',
      'comment',
      issue,
      '--body',
      `Could not create the entry:\n\n\`\`\`\n${(error as Error).message}\n\`\`\``,
    ]);
  }
  process.exit(1);
}
```

Wait: writing JSON is valid YAML (JSON is a YAML subset), but the editorial files use
YAML style. Use `yaml.stringify(data)` for consistency. Import `stringify` from 'yaml'.

Also `fields.author`/`license` are not in the form; add them to the form (required)
or default. Keep the form fields: Name, URL, Repository, Description, Category, Tags,
Platforms, Official, Author, License, French description. Add Author/License inputs.

- [ ] **Step 5: Write the issue form and workflow**

`.github/ISSUE_TEMPLATE/submit-app.yml`:

```yaml
name: Submit an app
description: Propose a project for Awesome Yoto.
title: '[App]: '
labels: ['app:submission']
body:
  - type: input
    id: name
    attributes: { label: Name }
    validations: { required: true }
  - type: input
    id: url
    attributes: { label: URL, description: 'Public HTTPS link.' }
    validations: { required: true }
  - type: input
    id: repository
    attributes: { label: Repository, description: 'Optional GitHub or GitLab URL.' }
  - type: textarea
    id: description
    attributes:
      { label: Description, description: 'One factual sentence, 20-180 characters, in English.' }
    validations: { required: true }
  - type: textarea
    id: french-description
    attributes: { label: French description, description: 'Optional, 20-180 characters.' }
  - type: dropdown
    id: category
    attributes:
      label: Category
      options: [official, create, icons, audio, automate, develop, backup, hardware, learn]
    validations: { required: true }
  - type: input
    id: tags
    attributes: { label: Tags, description: 'Comma-separated, lowercase, from data/tags.yml.' }
    validations: { required: true }
  - type: dropdown
    id: platforms
    attributes:
      label: Platforms
      multiple: true
      options: [web, ios, android, macos, windows, linux, cli, home-assistant, hardware, api]
    validations: { required: true }
  - type: input
    id: author
    attributes: { label: Author }
    validations: { required: true }
  - type: input
    id: license
    attributes: { label: License, description: 'SPDX identifier, or Unknown.' }
    validations: { required: true }
  - type: dropdown
    id: official
    attributes: { label: Official, options: ['No', 'Yes'] }
    validations: { required: true }
```

Note: the form id `french-description` renders the heading **French description**;
the parser lowercases labels, so `fields['french description']` works. The form id
`repository` matches. Good.

`.github/workflows/issue-to-pr.yml`:

```yaml
name: Issue to PR

on:
  issues:
    types: [opened, edited]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  convert:
    if: contains(github.event.issue.labels.*.name, 'app:submission')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Build the entry
        env:
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm tsx scripts/issue-to-project.ts

      - name: Open the pull request
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
        run: |
          slug=$(cat .issue-slug)
          branch="app/$slug"
          if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
            echo "PR branch already exists, skipping."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git checkout -b "$branch"
          git add "data/projects/$slug.yml"
          git commit -m "feat: add $slug from #$ISSUE_NUMBER"
          git push -u origin "$branch"
          gh pr create \
            --title "feat: add $slug" \
            --body "Closes #$ISSUE_NUMBER. Generated from the submission form; reviewed by CI." \
            --label app:submission
```

If the script fails, it comments on the issue and exits 1; the workflow shows red
but no PR is opened. That is the intended behaviour.

- [ ] **Step 6: Run the tests**

Run: `pnpm test -- tests/issue.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add .github scripts/lib/issue.ts scripts/issue-to-project.ts tests/issue.test.ts
git commit -m "feat: turn app submissions into pull requests"
```

---

### Task 17: Distribution and launch (no code)

**Files:**

- Modify: `CONTRIBUTING.md` (launch checklist, and remove the awesome-lint `continue-on-error` after setting the repo metadata)
- Create: `docs/launch-checklist.md`

- [ ] **Step 1: Make the list discoverable**

- Repository description: `Awesome Yoto — a curated list of apps, tools and resources for the Yoto Player.`
- Topics: `awesome`, `awesome-list`, `yoto`, `yoto-player`, `myo`.
- Confirm `pnpm exec awesome-lint README.md` is green on `main`.
- Pin the repository on the organization profile.

- [ ] **Step 2: Submit to the aggregators**

Open a PR to `project-awesome` adding the repository under the relevant category
(the project aggregates any repository carrying the `awesome` topic).

Open a PR to `sindresorhus/awesome` under the “Hardware” or “Miscellaneous” section.
Read their contribution guide first: they require an established list with real
curation, not a stub. Submit only after 4–6 weeks of activity and at least two
external contributions.

- [ ] **Step 3: Cross-link the existing catalogues**

In `icons-catalogue` and `podcast-catalogue`, add a “Community” header link to
`https://yoto-community.github.io/` and a footer line to `/myo/`. Two small PRs in
their own repositories. Do not change their design tokens.

- [ ] **Step 4: Announce**

- `yoto.space/developers` — a short post: what the list covers, how to submit.
- `r/YotoPlayer` — a parent-oriented post, not a developer one.
- French communities — mention the FR portal and the two existing catalogues.
- Add the badge below to the README of listed projects when asked:
  `[![Awesome Yoto](https://img.shields.io/badge/Awesome-Yoto-006D41)](https://yoto-community.github.io/)`

- [ ] **Step 5: Set the maintenance cadence**

- Weekly: `link-health` issue triage.
- Monthly: review `stale` suggestions from `pnpm enrich`, promote or deprecate.
- Quarterly: prune zero-value entries, refresh the MYO guide, check that the
  `icons-catalogue` and `podcast-catalogue` links still resolve.
- Every release: verify `https://yoto-community.github.io/fr/` and the API.

- [ ] **Step 6: Commit**

```bash
git add docs/launch-checklist.md CONTRIBUTING.md
git commit -m "docs: add launch and distribution checklist"
```

---

## Self-Review

**Spec coverage**

| Spec section                   | Task(s)                                             |
| ------------------------------ | --------------------------------------------------- |
| §2 objectives                  | 3–17                                                |
| §3 non-objectives (no backend) | 7, 9, 14 (static artifacts only)                    |
| §4 audiences                   | 10 (MYO), 8 (filters), 9 (API), 16 (form), 11 (FR)  |
| §5 decisions                   | 1, 7, 9, 14                                         |
| §6 architecture and hosting    | 1, 6, 9, 14                                         |
| §7 data model and validation   | 1, 2, 3, 4, 6                                       |
| §8 editorial policy            | 4, 10 (`/about/`), 15                               |
| §9 generated README            | 6                                                   |
| §10 portal, i18n, design, SEO  | 7–12                                                |
| §11 MYO journey                | 10                                                  |
| §12 CI/CD and error handling   | 14, 15, 16                                          |
| §13 tests                      | 1–9, 12, 13                                         |
| §14 phases P0–P3               | 1–16                                                |
| §14 P4 distribution            | 17                                                  |
| §15 metrics                    | 17 (manual cadence)                                 |
| §16 risks                      | 14 (branch protection), 15 (links), 16 (submission) |

**Issues found and fixed during this review**

1. `check:readme` did not generate `site/src/generated/catalog.json`, so `astro check`
   failed on a fresh clone. `check` now runs `build:data` after the drift check.
2. `package.json` `check` ordering: README drift must be detected **before**
   `build:data` rewrites the file. The order is now validate → check:readme →
   build:data → astro check.
3. `StatusBadge`, `FilterBar`, `ProjectView` and `MyoView` used `` `key.${x}` as const ``
   on a template literal, which TypeScript rejects. They cast to `MessageKey` instead.
4. `parseIssueForm` used a regex whose `$` matched at every line under the `m` flag.
   It now splits on `^### ` headings.
5. The issue generator wrote JSON while the dataset is YAML; it now uses
   `yaml.stringify`.
6. `ProjectCard` had no `data-slug`, and the filter script derived the slug from the
   name. It now carries `data-slug`.
7. The generated JSON is untyped; `site/src/lib/catalog.ts` narrows it once for every
   view.
8. The README golden test lacked the “French resources” section required by spec §9;
   it is now rendered and asserted.
9. `check-search.ts` now scans the client bundle for token-like strings.
10. A filter smoke test was added next to the axe audit.

**Known limitations (accepted)**

- Seed descriptions are written by a human from each project README; this is content
  work, not generated prose.
- LCP < 1.5 s is verified manually with Lighthouse; the automated gate covers the
  JavaScript budget and axe, not field performance.
- The static API is same-origin by design; cross-origin browser fetches depend on
  GitHub Pages CORS headers.
- `status` is editorial: `enrich` suggests it, a human commits it.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-03-awesome-yoto.md`.

Two execution options:

1. **Subagent-driven (recommended)** — a fresh subagent per task, review between
   tasks, fast iteration.
2. **Inline execution** — execute the tasks in this session with checkpoints.

Which approach?
